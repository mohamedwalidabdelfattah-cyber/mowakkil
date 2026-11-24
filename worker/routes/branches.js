// worker/routes/branches.js
// الفروع (مراكز التكلفة) — الباقة المتقدمة
// القضية بتتربط بفرع، والمصروف العام كمان، والربحية بتتقسم بالفروع

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { requireFeature } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',    path: '/api/branches',                 handler: list },
  { method: 'POST',   path: '/api/branches',                 handler: create, adminOnly: true },
  { method: 'PATCH',  path: /^\/api\/branches\/(\d+)$/,      handler: update, adminOnly: true },
  { method: 'DELETE', path: /^\/api\/branches\/(\d+)$/,      handler: remove, adminOnly: true },
];

async function list({ env, officeId }) {
  const { results } = await env.DB.prepare(
    `SELECT b.id, b.name, b.active,
            (SELECT COUNT(*) FROM cases c WHERE c.branch_id = b.id AND c.deleted_at IS NULL) AS cases_count
     FROM branches b WHERE b.office_id = ? ORDER BY b.active DESC, b.name`
  ).bind(officeId).all();
  return ok(env, results || []);
}

async function create({ request, env, officeId, authUser }) {
  const g = await requireFeature(env, officeId, 'finance_advanced'); if (g) return g;
  const b = await safeJson(request);
  const name = String(b?.name || '').trim();
  if (!isStr(name, 80) || name.length < 2) return fail(env, 'اكتب اسم الفرع', 400);
  const dup = await env.DB.prepare('SELECT id FROM branches WHERE office_id = ? AND name = ?').bind(officeId, name).first();
  if (dup) return fail(env, 'فيه فرع بنفس الاسم', 400);
  const r = await env.DB.prepare('INSERT INTO branches (office_id, name) VALUES (?, ?)').bind(officeId, name).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'branch', entity_id: r.meta.last_row_id, request });
  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function update({ request, env, officeId, authUser, params }) {
  const g = await requireFeature(env, officeId, 'finance_advanced'); if (g) return g;
  const id = toInt(params[0]);
  const b = await safeJson(request);
  const fields = [], binds = [];
  if (b?.name !== undefined) {
    const name = String(b.name || '').trim();
    if (name.length < 2) return fail(env, 'اكتب اسم الفرع', 400);
    fields.push('name = ?'); binds.push(name);
  }
  if (b?.active !== undefined) { fields.push('active = ?'); binds.push(b.active ? 1 : 0); }
  if (!fields.length) return fail(env, 'مفيش تغييرات', 400);
  const r = await env.DB.prepare(`UPDATE branches SET ${fields.join(', ')} WHERE id = ? AND office_id = ?`).bind(...binds, id, officeId).run();
  if (!r.meta.changes) return fail(env, 'الفرع مش موجود', 404);
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'branch', entity_id: id, request });
  return ok(env, { updated: true });
}

async function remove({ request, env, officeId, authUser, params }) {
  const g = await requireFeature(env, officeId, 'finance_advanced'); if (g) return g;
  const id = toInt(params[0]);
  const br = await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND office_id = ?').bind(id, officeId).first();
  if (!br) return fail(env, 'الفرع مش موجود', 404);
  // القضايا والمصروفات بتفضل، بس من غير فرع
  await env.DB.prepare('UPDATE cases SET branch_id = NULL WHERE branch_id = ? AND office_id = ?').bind(id, officeId).run();
  await env.DB.prepare('UPDATE expenses SET branch_id = NULL WHERE branch_id = ? AND office_id = ?').bind(id, officeId).run();
  await env.DB.prepare('DELETE FROM branches WHERE id = ? AND office_id = ?').bind(id, officeId).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'delete', entity: 'branch', entity_id: id, request });
  return ok(env, { deleted: true });
}

// تأكيد إن الفرع تبع المكتب (للقضايا والمصروفات)
export async function validBranch(env, officeId, branchId) {
  const id = toInt(branchId);
  if (!id) return null;
  const r = await env.DB.prepare('SELECT id FROM branches WHERE id = ? AND office_id = ?').bind(id, officeId).first();
  return r ? id : undefined; // undefined = فرع مش موجود
}
