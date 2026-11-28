// worker/routes/generated-docs.js
// المستندات المحفوظة من القوالب أو التوليد بالذكاء الاصطناعي (نص) — مربوطة بقضية أو عامة للمكتب.
// الصلاحيات من قاعدة /api/documents (عرض / إضافة وتعديل / حذف).
import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson } from '../lib/validation.js';
import { canAccessCase } from '../lib/permissions.js';

export const routes = [
  { method: 'GET',    path: '/api/documents/generated',                handler: list },
  { method: 'POST',   path: '/api/documents/generated',                handler: create },
  { method: 'GET',    path: /^\/api\/documents\/generated\/(\d+)$/,    handler: get },
  { method: 'PATCH',  path: /^\/api\/documents\/generated\/(\d+)$/,    handler: update },
  { method: 'DELETE', path: /^\/api\/documents\/generated\/(\d+)$/,    handler: remove },
];

const MAX_BODY = 60000;
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

async function checkCase(env, { officeId, access, authUser }, caseId) {
  if (!caseId) return null;
  const c = await env.DB.prepare('SELECT id FROM cases WHERE id = ? AND office_id = ? AND deleted_at IS NULL').bind(caseId, officeId).first();
  if (!c || !(await canAccessCase(env, access, authUser, caseId))) return fail(env, 'القضية مش موجودة', 404);
  return null;
}

// المستخدم "قضاياه بس" بيشوف المحفوظ على قضاياه + اللي هو عمله من غير قضية
function scopeSql(access, authUser) {
  if (access?.scope !== 'assigned') return { sql: '', binds: [] };
  return {
    sql: ` AND ((g.case_id IS NULL AND g.created_by = ?) OR g.case_id IN (SELECT case_id FROM case_members WHERE user_id = ?))`,
    binds: [authUser.user_id, authUser.user_id],
  };
}

async function list({ env, officeId, url, access, authUser }) {
  const caseId = toInt(url.searchParams.get('case_id'));
  const sc = scopeSql(access, authUser);
  let q = `SELECT g.id, g.case_id, g.title, g.source, g.template_id, g.created_at, g.updated_at,
                  substr(g.body, 1, 160) AS preview, c.case_number, u.full_name AS created_by_name
           FROM generated_documents g
           LEFT JOIN cases c ON c.id = g.case_id
           LEFT JOIN users u ON u.id = g.created_by
           WHERE g.office_id = ?${sc.sql}`;
  const binds = [officeId, ...sc.binds];
  if (caseId) { q += ' AND g.case_id = ?'; binds.push(caseId); }
  q += ' ORDER BY g.id DESC LIMIT 100';
  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results || []);
}

async function load(env, officeId, id, access, authUser) {
  const sc = scopeSql(access, authUser);
  return env.DB.prepare(`SELECT g.* FROM generated_documents g WHERE g.id = ? AND g.office_id = ?${sc.sql}`)
    .bind(id, officeId, ...sc.binds).first();
}

async function get({ env, officeId, params, access, authUser }) {
  const d = await load(env, officeId, toInt(params[0]), access, authUser);
  if (!d) return fail(env, 'المستند مش موجود', 404);
  return ok(env, d);
}

async function create(ctx) {
  const { request, env, officeId, authUser } = ctx;
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const title = clean(b.title, 200), body = clean(b.body, MAX_BODY);
  if (!title || !body) return fail(env, 'المستند فاضي', 400);
  const caseId = toInt(b.case_id) || null;
  const bad = await checkCase(env, ctx, caseId);
  if (bad) return bad;
  const source = b.source === 'template' ? 'template' : 'ai';
  const r = await env.DB.prepare(
    `INSERT INTO generated_documents (office_id, case_id, title, body, source, template_id, created_by) VALUES (?,?,?,?,?,?,?)`
  ).bind(officeId, caseId, title, body, source, clean(b.template_id, 60) || null, authUser.user_id).run();
  const id = r.meta.last_row_id;
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'generated_document', entity_id: id, request, metadata: { case_id: caseId, source } });
  return ok(env, { id }, 201);
}

async function update(ctx) {
  const { request, env, officeId, params, access, authUser } = ctx;
  const id = toInt(params[0]);
  const cur = await load(env, officeId, id, access, authUser);
  if (!cur) return fail(env, 'المستند مش موجود', 404);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const title = b.title !== undefined ? clean(b.title, 200) : cur.title;
  const body = b.body !== undefined ? clean(b.body, MAX_BODY) : cur.body;
  if (!title || !body) return fail(env, 'المستند فاضي', 400);
  let caseId = cur.case_id;
  if (b.case_id !== undefined) {
    caseId = toInt(b.case_id) || null;
    const bad = await checkCase(env, ctx, caseId);
    if (bad) return bad;
  }
  await env.DB.prepare(`UPDATE generated_documents SET title = ?, body = ?, case_id = ?, updated_at = datetime('now') WHERE id = ? AND office_id = ?`)
    .bind(title, body, caseId, id, officeId).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'generated_document', entity_id: id, request });
  return ok(env, { updated: true });
}

async function remove({ request, env, officeId, params, access, authUser }) {
  const id = toInt(params[0]);
  const cur = await load(env, officeId, id, access, authUser);
  if (!cur) return fail(env, 'المستند مش موجود', 404);
  await env.DB.prepare('DELETE FROM generated_documents WHERE id = ? AND office_id = ?').bind(id, officeId).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'delete', entity: 'generated_document', entity_id: id, request });
  return ok(env, { deleted: true });
}
