import { verifyJWT } from './jwt.js';

export async function getAuthUser(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;

  if (payload.super === true) return payload;

  const user = await env.DB.prepare(
    `SELECT id, office_id, role, email, full_name, active
     FROM users WHERE id = ? AND office_id = ?`
  ).bind(payload.user_id, payload.office_id).first();

  if (!user) return null;
  if (user.active === 0) return null;
  if (user.role !== payload.role) return null;

  return {
    user_id:   user.id,
    office_id: user.office_id,
    role:      user.role,
    email:     user.email,
    name:      user.full_name,
  };
}