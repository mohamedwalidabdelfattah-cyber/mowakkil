import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson } from '../lib/validation.js';

export const routes = [
  { method: 'GET',   path: '/api/office', handler: get },
  { method: 'GET',   path: '/api/office/onboarding', handler: onboarding, adminOnly: true },
  { method: 'PATCH', path: '/api/office', handler: update, adminOnly: true },
];

async function get({ env, officeId }) {
  const row = await env.DB.prepare(
    `SELECT id, name, name_ar, logo, status, trial_ends_at, created_at
     FROM offices WHERE id = ?`
  ).bind(officeId).first();
  return ok(env, row || {});
}

async function update({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  await env.DB.prepare(`UPDATE offices SET name_ar = ?, logo = ? WHERE id = ?`)
    .bind(b.name_ar ?? null, b.logo ?? null, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'office', entity_id: officeId, request,
  });
  return ok(env, { updated: true });
}
// خطوات البداية للمكتب الجديد (كارت في الرئيسية لمالك المكتب لحد ما يخلّصها)
async function onboarding({ env, officeId }) {
  const has = async (sql) => !!(await env.DB.prepare(sql).bind(officeId).first());
  const [client, kase, session, fee, portal, ai] = await Promise.all([
    has('SELECT 1 FROM clients WHERE office_id = ? AND deleted_at IS NULL LIMIT 1'),
    has('SELECT 1 FROM cases WHERE office_id = ? AND deleted_at IS NULL LIMIT 1'),
    has('SELECT 1 FROM sessions s JOIN cases c ON c.id = s.case_id WHERE c.office_id = ? AND c.deleted_at IS NULL LIMIT 1'),
    has('SELECT 1 FROM fees WHERE office_id = ? LIMIT 1'),
    has('SELECT 1 FROM client_users WHERE office_id = ? LIMIT 1'),       // دعوة موكل لبوابة الموكل
    has('SELECT 1 FROM ai_usage WHERE office_id = ? AND used > 0 LIMIT 1'), // أي استخدام للذكاء الاصطناعي
  ]);
  const office = await env.DB.prepare('SELECT created_at FROM offices WHERE id = ?').bind(officeId).first();
  return ok(env, { steps: { client, case: kase, session, fee, portal, ai }, created_at: office?.created_at || null });
}
