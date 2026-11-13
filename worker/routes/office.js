import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson } from '../lib/validation.js';

export const routes = [
  { method: 'GET',   path: '/api/office', handler: get },
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