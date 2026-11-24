// worker/routes/notifications.js
// نظام الإشعارات
// - الإشعار بيتعمل مرة للمكتب (user_id = NULL) أو لمستخدم معيّن
// - القراءة والإخفاء لكل مستخدم لوحده (notification_reads) — قراية واحد مش بتقفل الإشعار عند الباقيين
// - كل مستخدم بيشوف بس الأنواع اللي من حقه (صلاحيات + "المكلّف بيها بس")
// - إعدادات المكتب (office_settings.notif_*) بتتحكم في الأنواع اللي بتتعمل أصلاً

import { ok, fail } from '../lib/response.js';
import { toInt } from '../lib/validation.js';
import { can } from '../lib/permissions.js';

export const routes = [
  { method: 'GET',    path: '/api/notifications',                    handler: list },
  { method: 'GET',    path: '/api/notifications/count',              handler: count },
  { method: 'PATCH',  path: /^\/api\/notifications\/(\d+)\/read$/,   handler: markRead },
  { method: 'PATCH',  path: /^\/api\/notifications\/(\d+)\/unread$/, handler: markUnread },
  { method: 'POST',   path: '/api/notifications/mark-all-read',      handler: markAllRead },
  { method: 'DELETE', path: /^\/api\/notifications\/(\d+)$/,         handler: remove },
  { method: 'DELETE', path: '/api/notifications/clear-all',          handler: clearAll },
  { method: 'POST',   path: '/api/notifications/test',               handler: sendTest },
];

// ============================================================
// الأنواع: الفئة (إعداد المكتب) + الصلاحية المطلوبة للعرض
// ============================================================
export const NOTIF_TYPES = {
  session_reminder: { pref: 'notif_sessions', perm: 'agenda.view',   cat: 'session' },
  session_created:  { pref: 'notif_sessions', perm: 'agenda.view',   cat: 'session' },
  event_reminder:   { pref: 'notif_events',   perm: 'agenda.view',   cat: 'event' },
  task_due:         { pref: 'notif_tasks',    perm: 'tasks.view',    cat: 'task' },
  task_assigned:    { pref: 'notif_tasks',    perm: 'tasks.view',    cat: 'task' },
  fee_overdue:      { pref: 'notif_fees',     perm: 'fees.view',     cat: 'fee' },
  payment_received: { pref: 'notif_payments', perm: 'fees.view',     cat: 'payment' },
  invoice_created:  { pref: 'notif_payments', perm: 'invoices.view', cat: 'payment' },
  case_created:     { pref: 'notif_cases',    perm: 'cases.view',    cat: 'case' },
  client_created:   { pref: 'notif_clients',  perm: 'clients.view',  cat: 'client' },
  limit_reached:    { pref: null, perm: 'subscription.manage', cat: 'system' },
  limit_warning:    { pref: null, perm: 'subscription.manage', cat: 'system' },
  test:             { pref: null, perm: null, cat: 'system' },
};

// إعدادات المكتب (كاش قصير عشان الـ cron بيعمل إشعارات كتير ورا بعض)
const prefsCache = new Map();
async function officePrefs(env, officeId) {
  const hit = prefsCache.get(officeId);
  if (hit && Date.now() - hit.t < 60000) return hit.v;
  let v = {};
  try {
    v = (await env.DB.prepare('SELECT * FROM office_settings WHERE office_id = ?').bind(officeId).first()) || {};
  } catch { v = {}; }
  prefsCache.set(officeId, { v, t: Date.now() });
  return v;
}
export async function notifEnabled(env, officeId, type) {
  const pref = NOTIF_TYPES[type]?.pref;
  if (!pref) return true;
  const s = await officePrefs(env, officeId);
  return s[pref] === undefined || s[pref] === null ? true : Number(s[pref]) === 1;
}
export function clearPrefsCache(officeId) { prefsCache.delete(officeId); }
export async function getOfficePrefs(env, officeId) {
  return officePrefs(env, officeId);
}

// ============================================================
// Helper: إنشاء إشعار (بيحترم إعدادات المكتب)
// ============================================================
export async function createNotification(env, {
  officeId, userId = null, type, title, body = null, link = null,
  icon = '🔔', priority = 'normal', referenceType = null, referenceId = null, dueAt = null,
}) {
  try {
    if (!(await notifEnabled(env, officeId, type))) return false;
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
// شروط العرض للمستخدم ده
// ============================================================
function visibility(access, authUser) {
  const uid = authUser.user_id;
  let sql = ` AND n.office_id = ? AND (n.user_id IS NULL OR n.user_id = ?)
              AND COALESCE(r.hidden, 0) = 0`;
  const binds = [authUser.office_id, uid];

  // الأنواع اللي مش من حقه
  const blocked = Object.entries(NOTIF_TYPES)
    .filter(([, t]) => t.perm && !(access?.role === 'admin' || can(access, t.perm)))
    .map(([k]) => k);
  if (blocked.length) {
    sql += ` AND n.type NOT IN (${blocked.map(() => '?').join(',')})`;
    binds.push(...blocked);
  }

  // "المكلّف بيها بس": الجلسات والقضايا والمواعيد بتاعة قضاياه بس
  if (access?.scope === 'assigned') {
    sql += `
      AND (n.reference_type IS NOT 'session' OR n.reference_id IN (
            SELECT s.id FROM sessions s JOIN case_members cm ON cm.case_id = s.case_id WHERE cm.user_id = ?))
      AND (n.reference_type IS NOT 'case' OR n.reference_id IN (SELECT case_id FROM case_members WHERE user_id = ?))
      AND (n.reference_type IS NOT 'event' OR n.reference_id IN (
            SELECT e.id FROM agenda_events e WHERE e.user_id = ?
              OR e.case_id IN (SELECT case_id FROM case_members WHERE user_id = ?)))`;
    binds.push(uid, uid, uid, uid);
  }
  return { sql, binds };
}

const JOIN_READS = `LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?`;
const IS_READ = `(CASE WHEN r.read_at IS NOT NULL OR n.is_read = 1 THEN 1 ELSE 0 END)`;

// ============================================================
// 1) قائمة الإشعارات
// ============================================================
async function list({ env, authUser, access, url }) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 1), 100);
  const filter = url.searchParams.get('filter') || 'all'; // all | unread
  const before = toInt(url.searchParams.get('before')); // للصفحات: أقدم من id معيّن
  const v = visibility(access, authUser);

  let q = `SELECT n.id, n.type, n.title, n.body, n.link, n.icon, n.priority, n.reference_type, n.reference_id,
                  n.due_at, n.created_at, ${IS_READ} AS is_read
           FROM notifications n ${JOIN_READS}
           WHERE 1 = 1 ${v.sql}`;
  const binds = [authUser.user_id, ...v.binds];
  if (filter === 'unread') q += ` AND ${IS_READ} = 0`;
  if (before) { q += ' AND n.id < ?'; binds.push(before); }
  q += ' ORDER BY n.created_at DESC, n.id DESC LIMIT ?';
  binds.push(limit + 1);

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  const rows = results || [];
  const more = rows.length > limit;
  const items = rows.slice(0, limit).map(n => ({ ...n, category: NOTIF_TYPES[n.type]?.cat || 'system' }));
  return ok(env, { items, more });
}

// ============================================================
// 2) عدد غير المقروء
// ============================================================
async function count({ env, authUser, access }) {
  const v = visibility(access, authUser);
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM notifications n ${JOIN_READS}
     WHERE ${IS_READ} = 0 ${v.sql}`
  ).bind(authUser.user_id, ...v.binds).first();
  return ok(env, { unread: r?.c || 0 });
}

// بيتأكد إن الإشعار من حق المستخدم ده
async function ownNotification(env, authUser, access, id) {
  const v = visibility(access, authUser);
  return env.DB.prepare(
    `SELECT n.id FROM notifications n ${JOIN_READS} WHERE n.id = ? ${v.sql}`
  ).bind(authUser.user_id, id, ...v.binds).first();
}

const UPSERT = {
  read: `INSERT INTO notification_reads (notification_id, user_id, read_at, hidden) VALUES (?, ?, datetime('now'), 0)
         ON CONFLICT(notification_id, user_id) DO UPDATE SET read_at = COALESCE(read_at, datetime('now'))`,
  unread: `INSERT INTO notification_reads (notification_id, user_id, read_at, hidden) VALUES (?, ?, NULL, 0)
           ON CONFLICT(notification_id, user_id) DO UPDATE SET read_at = NULL`,
  hide: `INSERT INTO notification_reads (notification_id, user_id, read_at, hidden) VALUES (?, ?, datetime('now'), 1)
         ON CONFLICT(notification_id, user_id) DO UPDATE SET hidden = 1, read_at = COALESCE(read_at, datetime('now'))`,
};
async function upsertRead(env, id, uid, { read, hidden }) {
  const sql = hidden ? UPSERT.hide : read ? UPSERT.read : UPSERT.unread;
  await env.DB.prepare(sql).bind(id, uid).run();
}

// ============================================================
// 3) مقروء / مش مقروء
// ============================================================
async function markRead({ env, authUser, access, params }) {
  const id = toInt(params[0]);
  if (!id || !(await ownNotification(env, authUser, access, id))) return fail(env, 'الإشعار مش موجود', 404);
  await upsertRead(env, id, authUser.user_id, { read: true });
  return ok(env, { updated: true });
}

async function markUnread({ env, authUser, access, params }) {
  const id = toInt(params[0]);
  if (!id || !(await ownNotification(env, authUser, access, id))) return fail(env, 'الإشعار مش موجود', 404);
  // الإشعارات القديمة (قبل القراءة لكل مستخدم) كان is_read عليها للمكتب كله — منقدرش نرجّعها إلا للكل
  await upsertRead(env, id, authUser.user_id, { read: false });
  await env.DB.prepare('UPDATE notifications SET is_read = 0 WHERE id = ? AND is_read = 1').bind(id).run();
  return ok(env, { updated: true });
}

// ============================================================
// 4) تعليم الكل كمقروء
// ============================================================
async function markAllRead({ env, authUser, access }) {
  const v = visibility(access, authUser);
  await env.DB.prepare(
    `INSERT INTO notification_reads (notification_id, user_id, read_at, hidden)
     SELECT n.id, ?, datetime('now'), 0 FROM notifications n ${JOIN_READS}
     WHERE ${IS_READ} = 0 ${v.sql}
     ON CONFLICT(notification_id, user_id) DO UPDATE SET read_at = COALESCE(read_at, datetime('now'))`
  ).bind(authUser.user_id, authUser.user_id, ...v.binds).run();
  return ok(env, { updated: true });
}

// ============================================================
// 5) إخفاء إشعار (عند المستخدم ده بس)
// ============================================================
async function remove({ env, authUser, access, params }) {
  const id = toInt(params[0]);
  if (!id || !(await ownNotification(env, authUser, access, id))) return fail(env, 'الإشعار مش موجود', 404);
  await upsertRead(env, id, authUser.user_id, { read: true, hidden: true });
  return ok(env, { deleted: true });
}

// ============================================================
// 6) مسح الكل (عند المستخدم ده بس)
// ============================================================
async function clearAll({ env, authUser, access }) {
  const v = visibility(access, authUser);
  await env.DB.prepare(
    `INSERT INTO notification_reads (notification_id, user_id, read_at, hidden)
     SELECT n.id, ?, datetime('now'), 1 FROM notifications n ${JOIN_READS}
     WHERE 1 = 1 ${v.sql}
     ON CONFLICT(notification_id, user_id) DO UPDATE SET hidden = 1, read_at = COALESCE(read_at, datetime('now'))`
  ).bind(authUser.user_id, authUser.user_id, ...v.binds).run();
  return ok(env, { cleared: true });
}

// ============================================================
// 7) إشعار تجريبي (من الإعدادات)
// ============================================================
async function sendTest({ env, authUser }) {
  await createNotification(env, {
    officeId: authUser.office_id,
    userId: authUser.user_id,
    type: 'test',
    title: 'إشعار تجريبي',
    body: 'الإشعارات شغالة تمام ✓ — هتوصلك هنا وعلى الجهاز لو فعّلت إشعارات الجهاز.',
    icon: '🔔',
    priority: 'normal',
  });
  return ok(env, { sent: true });
}
