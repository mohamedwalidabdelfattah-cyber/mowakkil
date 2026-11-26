import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { isStr, toInt, safeJson } from '../lib/validation.js';
import { requireLimit } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',    path: '/api/lawyers',                handler: list,   adminOnly: true },
  { method: 'POST',   path: '/api/lawyers',                handler: create, adminOnly: true },
  { method: 'PATCH',  path: /^\/api\/lawyers\/(\d+)$/,     handler: update, adminOnly: true },
  { method: 'DELETE', path: /^\/api\/lawyers\/(\d+)$/,     handler: remove, adminOnly: true },
];

async function list({ env, officeId, url }) {
  const search = url.searchParams.get('search');
  const includeInactive = url.searchParams.get('include_inactive') === '1';

  let query = `SELECT * FROM lawyers WHERE office_id = ?`;
  const binds = [officeId];

  if (!includeInactive) {
    query += ' AND active = 1';
  }

  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR grade LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return ok(env, results || []);
}

async function create({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !isStr(b.name, 200)) return fail(env, 'اكتب اسم المحامي', 400);

  const usersCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM users WHERE office_id = ?`
  ).bind(officeId).first();

  const adminsCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM users WHERE office_id = ? AND role = 'admin'`
  ).bind(officeId).first();

  const limitFail = await requireLimit(
    env, officeId, 'max_users',
    usersCount?.c || 0,
    { excludeAdmins: adminsCount?.c || 0 }
  );
  if (limitFail) return limitFail;

  const r = await env.DB.prepare(
    `INSERT INTO lawyers (office_id, name, grade, salary, phone) VALUES (?,?,?,?,?)`
  ).bind(officeId, b.name.trim(), b.grade ?? null, b.salary ?? null, b.phone ?? null).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'lawyer', entity_id: r.meta.last_row_id, request,
  });
  return ok(env, { id: r.meta.last_row_id }, 201);
}

// تعديل بيانات المحامي: الاسم والدرجة والمرتب والموبايل
async function update({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const cur = await env.DB.prepare('SELECT * FROM lawyers WHERE id = ? AND office_id = ?').bind(id, officeId).first();
  if (!cur) return fail(env, 'المحامي مش موجود', 404);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (b.name !== undefined && !isStr(String(b.name).trim(), 200)) return fail(env, 'اكتب اسم المحامي', 400);
  if (b.salary !== undefined && b.salary !== null && b.salary !== '' && !(Number(b.salary) >= 0)) return fail(env, 'المرتب لازم يكون رقم', 400);
  const clean = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
  const next = {
    name: b.name !== undefined ? String(b.name).trim() : cur.name,
    grade: b.grade !== undefined ? clean(b.grade, 100) : cur.grade,
    salary: b.salary !== undefined ? (b.salary === null || b.salary === '' ? null : Number(b.salary)) : cur.salary,
    phone: b.phone !== undefined ? clean(b.phone, 30) : cur.phone,
  };
  await env.DB.prepare('UPDATE lawyers SET name = ?, grade = ?, salary = ?, phone = ? WHERE id = ? AND office_id = ?')
    .bind(next.name, next.grade, next.salary, next.phone, id, officeId).run();
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'lawyer', entity_id: id, request,
    metadata: { from: { grade: cur.grade, salary: cur.salary }, to: { grade: next.grade, salary: next.salary } },
  });
  return ok(env, { id, ...next });
}

async function remove({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const lawyer = await env.DB.prepare(
    `SELECT id FROM lawyers WHERE id = ? AND office_id = ? AND active = 1`
  ).bind(id, officeId).first();
  if (!lawyer) return fail(env, 'المحامي مش موجود', 404);

  try {
    await env.DB.prepare(
      `UPDATE tasks SET lawyer_id = NULL WHERE lawyer_id = ? AND office_id = ?`
    ).bind(id, officeId).run();
  } catch (e) {
    console.warn('unlink tasks failed:', e.message);
  }

  const r = await env.DB.prepare(
    `UPDATE lawyers SET active = 0 WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).run();

  if (r.meta.changes === 0) return fail(env, 'فشل الحذف', 500);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'lawyer', entity_id: id,
  });
  return ok(env, { deleted: true });
}