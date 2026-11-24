// worker/routes/followup.js
// متابعة المكاتب اللي في الفترة التجريبية (لوحة مسؤول المنصة)
// النظام بيقسّم المكاتب حسب استخدامها، ويختار الرسالة المناسبة النهارده من القوالب اللي المسؤول بيعدّلها.
// الإرسال نفسه من واتساب المسؤول (رابط wa.me) — مفيش إرسال آلي من رقم شخصي.

import { ok, fail } from '../lib/response.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';

export const SEGMENTS = {
  not_started: 'مبدأش',
  stalled: 'بدأ ووقف',
  active: 'نشيط',
  ending: 'التجربة بتخلص',
  expired: 'التجربة خلصت',
};
const STALL_DAYS = 3;        // من غير أي حركة من كام يوم = وقف
const ENDING_DAYS = 3;       // فاضل كام يوم = بتخلص
const EXPIRED_WINDOW = 30;   // نتابع اللي خلصت تجربته لحد كام يوم
const COOLDOWN_DAYS = 2;     // أقل مدة بين رسالتين لنفس المكتب

export const superadminRoutes = [
  { method: 'GET',    path: '/api/superadmin/followups',                          handler: listFollowups },
  { method: 'POST',   path: /^\/api\/superadmin\/followups\/(\d+)\/sent$/,        handler: markSent },
  { method: 'PATCH',  path: /^\/api\/superadmin\/followups\/(\d+)$/,              handler: updateOfficeFollowup },
  { method: 'GET',    path: '/api/superadmin/followup-templates',                 handler: listTemplates },
  { method: 'POST',   path: '/api/superadmin/followup-templates',                 handler: createTemplate },
  { method: 'PATCH',  path: /^\/api\/superadmin\/followup-templates\/(\d+)$/,     handler: updateTemplate },
  { method: 'DELETE', path: /^\/api\/superadmin\/followup-templates\/(\d+)$/,     handler: deleteTemplate },
];

// تواريخ D1 بتتخزن 'YYYY-MM-DD HH:MM:SS' (UTC) أو ISO
function parseDate(s) {
  if (!s) return null;
  const str = String(s);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : str.replace(' ', 'T') + 'Z');
  return isNaN(d) ? null : d;
}
const DAY = 86400000;

export function classify(o, now = new Date()) {
  const created = parseDate(o.created_at) || now;
  const trialEnd = parseDate(o.trial_ends_at);
  const lastAct = parseDate(o.last_activity_at);
  const daysSince = Math.max(0, Math.floor((now - created) / DAY));
  const daysLeft = trialEnd ? Math.ceil((trialEnd - now) / DAY) : null;
  const used = (o.cases_count || 0) + (o.clients_count || 0) > 0;
  let segment;
  if (daysLeft != null && daysLeft <= 0) segment = 'expired';
  else if (daysLeft != null && daysLeft <= ENDING_DAYS) segment = 'ending';
  else if (!used) segment = 'not_started';
  else if (!lastAct || (now - lastAct) / DAY >= STALL_DAYS) segment = 'stalled';
  else segment = 'active';
  return { segment, days_since: daysSince, days_left: daysLeft };
}

export function pickTemplate(templates, office, seg, now = new Date()) {
  if (office.stopped) return { due: null, reason: 'stopped' };
  const lastSent = parseDate(office.last_sent_at);
  if (lastSent && (now - lastSent) / DAY < COOLDOWN_DAYS) return { due: null, reason: 'cooldown' };
  const sent = new Set(String(office.sent_keys || '').split(',').filter(Boolean));
  const due = templates.find(t => t.active
    && !sent.has(t.key)
    && seg.days_since >= (t.min_day || 0)
    && (t.segments === 'any' || String(t.segments).split(',').map(x => x.trim()).includes(seg.segment)));
  return { due: due || null, reason: due ? 'due' : 'done' };
}

async function listFollowups({ env }) {
  const { results: offices } = await env.DB.prepare(
    `SELECT o.id, COALESCE(o.name_ar, o.name) AS office_name, o.created_at,
            COALESCE(s.trial_ends_at, o.trial_ends_at) AS trial_ends_at,
            s.status AS sub_status, s.plan AS sub_plan,
            (SELECT full_name FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id LIMIT 1) AS owner_name,
            (SELECT phone FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id LIMIT 1) AS owner_phone,
            (SELECT COUNT(*) FROM cases c WHERE c.office_id = o.id AND c.deleted_at IS NULL) AS cases_count,
            (SELECT COUNT(*) FROM clients cl WHERE cl.office_id = o.id AND cl.deleted_at IS NULL) AS clients_count,
            (SELECT MAX(a.created_at) FROM audit_log a WHERE a.office_id = o.id) AS last_activity_at,
            (SELECT MAX(f.sent_at) FROM followup_log f WHERE f.office_id = o.id) AS last_sent_at,
            (SELECT GROUP_CONCAT(f.template_key) FROM followup_log f WHERE f.office_id = o.id) AS sent_keys,
            (SELECT COUNT(*) FROM followup_log f WHERE f.office_id = o.id) AS sent_count,
            COALESCE(of.stopped, 0) AS stopped, of.note
     FROM offices o
     LEFT JOIN subscriptions s ON s.office_id = o.id
     LEFT JOIN office_followup of ON of.office_id = o.id
     WHERE COALESCE(s.status, o.status) IN ('trial', 'expired')
     ORDER BY o.created_at DESC`
  ).all();
  const { results: templates } = await env.DB.prepare(
    'SELECT * FROM followup_templates ORDER BY sort, id'
  ).all();

  const now = new Date();
  const items = [];
  for (const o of offices || []) {
    const seg = classify(o, now);
    // اللي خلصت تجربته من زمان مش بنتابعه
    if (seg.segment === 'expired' && seg.days_left != null && -seg.days_left > EXPIRED_WINDOW) continue;
    const pick = pickTemplate(templates || [], o, seg, now);
    items.push({
      office_id: o.id, office_name: o.office_name, owner_name: o.owner_name, owner_phone: o.owner_phone,
      created_at: o.created_at, trial_ends_at: o.trial_ends_at, last_activity_at: o.last_activity_at,
      cases_count: o.cases_count, clients_count: o.clients_count,
      sent_count: o.sent_count, last_sent_at: o.last_sent_at, sent_keys: o.sent_keys ? String(o.sent_keys).split(',') : [],
      stopped: !!o.stopped, note: o.note || '',
      ...seg,
      due_key: pick.due?.key || null, status: pick.reason,
    });
  }
  const counts = {};
  for (const i of items) counts[i.segment] = (counts[i.segment] || 0) + 1;
  return ok(env, {
    items, templates: templates || [], segments: SEGMENTS, counts,
    due_today: items.filter(i => i.status === 'due' && i.owner_phone).length,
  });
}

async function markSent({ request, env, params }) {
  const officeId = toInt(params[0]);
  const b = await safeJson(request);
  const key = String(b?.template_key || '').trim();
  if (!officeId || !key) return fail(env, 'بيانات ناقصة', 400);
  const t = await env.DB.prepare('SELECT id FROM followup_templates WHERE key = ?').bind(key).first();
  if (!t) return fail(env, 'الرسالة مش موجودة', 404);
  await env.DB.prepare('INSERT INTO followup_log (office_id, template_key) VALUES (?, ?)').bind(officeId, key).run();
  return ok(env, { logged: true });
}

async function updateOfficeFollowup({ request, env, params }) {
  const officeId = toInt(params[0]);
  const b = await safeJson(request);
  if (!officeId || !b) return fail(env, 'بيانات ناقصة', 400);
  const cur = await env.DB.prepare('SELECT stopped, note FROM office_followup WHERE office_id = ?').bind(officeId).first();
  const stopped = b.stopped !== undefined ? (b.stopped ? 1 : 0) : (cur?.stopped || 0);
  const note = b.note !== undefined ? String(b.note || '').slice(0, 1000) : (cur?.note || null);
  await env.DB.prepare(
    `INSERT INTO office_followup (office_id, stopped, note, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(office_id) DO UPDATE SET stopped = excluded.stopped, note = excluded.note, updated_at = excluded.updated_at`
  ).bind(officeId, stopped, note).run();
  return ok(env, { updated: true });
}

// ============================================================
// القوالب
// ============================================================
async function listTemplates({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM followup_templates ORDER BY sort, id').all();
  return ok(env, { templates: results || [], segments: SEGMENTS });
}

function cleanTemplate(b, partial = false) {
  const out = {};
  if (!partial || b.title !== undefined) {
    const title = String(b.title || '').trim();
    if (!isStr(title, 80) || title.length < 2) return { error: 'اكتب اسم للرسالة' };
    out.title = title;
  }
  if (!partial || b.body !== undefined) {
    const body = String(b.body || '').trim();
    if (body.length < 5) return { error: 'نص الرسالة قصير قوي' };
    if (body.length > 3000) return { error: 'نص الرسالة طويل قوي (أقصى حاجة 3000 حرف)' };
    out.body = body;
  }
  if (!partial || b.segments !== undefined) {
    const list = Array.isArray(b.segments) ? b.segments : String(b.segments || 'any').split(',');
    const segs = list.map(s => String(s).trim()).filter(s => s === 'any' || SEGMENTS[s]);
    out.segments = !segs.length || segs.includes('any') ? 'any' : [...new Set(segs)].join(',');
  }
  if (!partial || b.min_day !== undefined) {
    const d = toInt(b.min_day);
    out.min_day = Math.min(60, Math.max(0, Number.isFinite(d) ? d : 0));
  }
  if (b.active !== undefined) out.active = b.active ? 1 : 0;
  if (b.sort !== undefined) out.sort = toInt(b.sort) || 0;
  return { out };
}

async function createTemplate({ request, env }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'بيانات ناقصة', 400);
  const { out, error } = cleanTemplate(b);
  if (error) return fail(env, error, 400);
  const key = 'custom_' + Date.now().toString(36);
  const max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM followup_templates').first();
  const r = await env.DB.prepare(
    `INSERT INTO followup_templates (key, title, segments, min_day, body, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(key, out.title, out.segments, out.min_day, out.body, out.active ?? 1, out.sort ?? (max.m + 10)).run();
  return ok(env, { id: r.meta.last_row_id, key }, 201);
}

async function updateTemplate({ request, env, params }) {
  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!id || !b) return fail(env, 'بيانات ناقصة', 400);
  const { out, error } = cleanTemplate(b, true);
  if (error) return fail(env, error, 400);
  const keys = Object.keys(out);
  if (!keys.length) return fail(env, 'مفيش تغييرات', 400);
  const r = await env.DB.prepare(
    `UPDATE followup_templates SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...keys.map(k => out[k]), id).run();
  if (!r.meta.changes) return fail(env, 'الرسالة مش موجودة', 404);
  return ok(env, { updated: true });
}

async function deleteTemplate({ env, params }) {
  const id = toInt(params[0]);
  const r = await env.DB.prepare('DELETE FROM followup_templates WHERE id = ?').bind(id).run();
  if (!r.meta.changes) return fail(env, 'الرسالة مش موجودة', 404);
  return ok(env, { deleted: true });
}
