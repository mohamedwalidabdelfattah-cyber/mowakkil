// worker/routes/accounts.js
// إدارة دليل الحسابات

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { initializeChartOfAccounts, getAccounts } from '../services/chart-of-accounts.js';
import { requireFeature } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',   path: '/api/accounts',              handler: list },
  { method: 'POST',  path: '/api/accounts/init',         handler: init, adminOnly: true },
  { method: 'POST',  path: '/api/accounts',              handler: create, adminOnly: true },
  { method: 'GET',   path: /^\/api\/accounts\/(\d+)$/,   handler: get },
  { method: 'PATCH', path: /^\/api\/accounts\/(\d+)$/,   handler: update, adminOnly: true },
  { method: 'DELETE',path: /^\/api\/accounts\/(\d+)$/,   handler: remove, adminOnly: true },
];

async function list({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const type = url.searchParams.get('type');
  const tree = url.searchParams.get('tree') === '1';

  const accounts = await getAccounts(env, officeId, type);

  if (!tree) return ok(env, accounts);

  const map = {};
  accounts.forEach(a => { map[a.id] = { ...a, children: [] }; });
  const roots = [];

  accounts.forEach(a => {
    if (a.parent_id && map[a.parent_id]) {
      map[a.parent_id].children.push(map[a.id]);
    } else {
      roots.push(map[a.id]);
    }
  });

  return ok(env, roots);
}

async function init({ env, authUser, officeId, request }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const result = await initializeChartOfAccounts(env, officeId);
  if (!result.initialized) return fail(env, result.message, 400);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'init', entity: 'accounts',
    metadata: { count: result.count }, request,
  });

  return ok(env, { initialized: true, count: result.count });
}

async function get({ env, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  const acc = await env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!acc) return fail(env, 'not found', 404);
  return ok(env, acc);
}

async function create({ request, env, authUser, officeId }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!isStr(b.code, 20)) return fail(env, 'اكتب كود الحساب', 400);
  if (!isStr(b.name, 200)) return fail(env, 'اكتب اسم الحساب', 400);
  if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(b.type)) {
    return fail(env, 'نوع الحساب غلط', 400);
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM accounts WHERE office_id = ? AND code = ?`
  ).bind(officeId, b.code).first();
  if (existing) return fail(env, 'الكود ده مستخدم بالفعل', 409);

  const r = await env.DB.prepare(
    `INSERT INTO accounts
      (office_id, code, name, name_en, type, category, parent_id, opening_balance, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(
    officeId,
    b.code,
    b.name,
    b.name_en || null,
    b.type,
    b.category || null,
    b.parent_id || null,
    b.opening_balance || 0,
    b.notes || null
  ).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'account', entity_id: r.meta.last_row_id, request,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function update({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const acc = await env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!acc) return fail(env, 'not found', 404);
  if (acc.is_system === 1 && b.code && b.code !== acc.code) {
    return fail(env, 'مينفعش تغير كود حساب أساسي', 400);
  }

  const fields = [];
  const binds = [];
  if (b.name !== undefined)            { fields.push('name = ?'); binds.push(b.name); }
  if (b.name_en !== undefined)         { fields.push('name_en = ?'); binds.push(b.name_en); }
  if (b.code !== undefined)            { fields.push('code = ?'); binds.push(b.code); }
  if (b.category !== undefined)        { fields.push('category = ?'); binds.push(b.category); }
  if (b.parent_id !== undefined)       { fields.push('parent_id = ?'); binds.push(b.parent_id || null); }
  if (b.is_active !== undefined)       { fields.push('is_active = ?'); binds.push(b.is_active); }
  if (b.opening_balance !== undefined) { fields.push('opening_balance = ?'); binds.push(b.opening_balance); }
  if (b.notes !== undefined)           { fields.push('notes = ?'); binds.push(b.notes); }

  if (!fields.length) return fail(env, 'مفيش تغييرات', 400);
  binds.push(id, officeId);

  await env.DB.prepare(
    `UPDATE accounts SET ${fields.join(', ')} WHERE id = ? AND office_id = ?`
  ).bind(...binds).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'account', entity_id: id, request,
  });

  return ok(env, { updated: true });
}

async function remove({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  const acc = await env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!acc) return fail(env, 'not found', 404);
  if (acc.is_system === 1) return fail(env, 'مينفعش تحذف حساب أساسي', 400);

  const used = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM journal_lines WHERE account_id = ?`
  ).bind(id).first();
  if (used?.count > 0) return fail(env, 'الحساب مستخدم في قيود، مينفعش يتحذف', 400);

  const children = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM accounts WHERE parent_id = ?`
  ).bind(id).first();
  if (children?.count > 0) return fail(env, 'الحساب له حسابات فرعية، احذفها الأول', 400);

  await env.DB.prepare(`DELETE FROM accounts WHERE id = ? AND office_id = ?`)
    .bind(id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'account', entity_id: id, request,
  });

  return ok(env, { deleted: true });
}