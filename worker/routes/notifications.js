// worker/routes/notifications.js
// نظام الإشعارات

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson } from '../lib/validation.js';

export const routes = [
  { method: 'GET',    path: '/api/notifications',                    handler: list },
  { method: 'GET',    path: '/api/notifications/count',              handler: count },
  { method: 'PATCH',  path: /^\/api\/notifications\/(\d+)\/read$/,   handler: markRead },
  { method: 'POST',   path: '/api/notifications/mark-all-read',      handler: markAllRead },
  { method: 'DELETE', path: /^\/api\/notifications\/(\d+)$/,         handler: remove },
  { method: 'DELETE', path: '/api/notifications/clear-all',          handler: clearAll },
];

// ============================================================
// Helper: إنشاء إشعار
// ============================================================
export async function createNotification(env, {
  officeId, userId = null, type, title, body = null, link = null,
  icon = '🔔', priority = 'normal', referenceType = null, referenceId = null, dueAt = null,
}) {
  try {
    await env.DB.prepare(
      `INSERT INTO notifications
        (office_id, user_id, type, title, body, link, icon, priority,
         reference_type, reference_id, due_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      officeId, userId, type, title, body, link, icon, priority,
      referenceType, referenceId, dueAt
    ).run();
    return true;
  } catch (e) {
    console.error('createNotification failed:', e.message);
    return false;
  }
}

// ============================================================
// 1) قائمة الإشعارات
// ============================================================
async function list({ env, officeId, authUser, url }) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const filter = url.searchParams.get('filter') || 'all'; // 'all' | 'unread' | 'read'

  let q = `SELECT * FROM notifications
           WHERE office_id = ?
             AND (user_id IS NULL OR user_id = ?)`;
  const binds = [officeId, authUser.user_id];

  if (filter === 'unread') {
    q += ` AND is_read = 0`;
  } else if (filter === 'read') {
    q += ` AND is_read = 1`;
  }

  q += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results || []);
}

// ============================================================
// 2) عدد الإشعارات غير المقروءة
// ============================================================
async function count({ env, officeId, authUser }) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM notifications
     WHERE office_id = ?
       AND (user_id IS NULL OR user_id = ?)
       AND is_read = 0`
  ).bind(officeId, authUser.user_id).first();

  return ok(env, { unread: r?.c || 0 });
}

// ============================================================
// 3) تعليم إشعار كمقروء
// ============================================================
async function markRead({ env, officeId, authUser, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const r = await env.DB.prepare(
    `UPDATE notifications
     SET is_read = 1, read_at = datetime('now')
     WHERE id = ? AND office_id = ?
       AND (user_id IS NULL OR user_id = ?)`
  ).bind(id, officeId, authUser.user_id).run();

  if (r.meta.changes === 0) return fail(env, 'not found', 404);
  return ok(env, { updated: true });
}

// ============================================================
// 4) تعليم الكل كمقروء
// ============================================================
async function markAllRead({ env, officeId, authUser }) {
  await env.DB.prepare(
    `UPDATE notifications
     SET is_read = 1, read_at = datetime('now')
     WHERE office_id = ?
       AND (user_id IS NULL OR user_id = ?)
       AND is_read = 0`
  ).bind(officeId, authUser.user_id).run();

  return ok(env, { updated: true });
}

// ============================================================
// 5) حذف إشعار
// ============================================================
async function remove({ env, officeId, authUser, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  await env.DB.prepare(
    `DELETE FROM notifications
     WHERE id = ? AND office_id = ?
       AND (user_id IS NULL OR user_id = ?)`
  ).bind(id, officeId, authUser.user_id).run();

  return ok(env, { deleted: true });
}

// ============================================================
// 6) مسح كل الإشعارات
// ============================================================
async function clearAll({ env, officeId, authUser }) {
  await env.DB.prepare(
    `DELETE FROM notifications
     WHERE office_id = ?
       AND (user_id IS NULL OR user_id = ?)`
  ).bind(officeId, authUser.user_id).run();

  return ok(env, { cleared: true });
}