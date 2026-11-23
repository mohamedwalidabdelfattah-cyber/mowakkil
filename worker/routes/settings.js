// worker/routes/settings.js
// إعدادات المكتب الشاملة

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson } from '../lib/validation.js';
import { getAiPrivacy, clearAiPrivacyCache, AI_PRIVACY_MODES } from '../lib/ai-privacy.js';

export const routes = [
  { method: 'GET',   path: '/api/settings', handler: get },
  { method: 'PATCH', path: '/api/settings', handler: update, adminOnly: true },
  { method: 'GET',   path: '/api/settings/search', handler: search },
  { method: 'GET',   path: '/api/settings/ai-privacy', handler: getAiPrivacySetting },
  { method: 'POST',  path: '/api/settings/ai-privacy', handler: setAiPrivacySetting, adminOnly: true },
];

// ============================================================
// خصوصية الذكاء الاصطناعي (مسؤول المكتب بس يغيّرها، والموافقة بتتسجل)
// ============================================================
async function getAiPrivacySetting({ env, officeId }) {
  const p = await getAiPrivacy(env, officeId);
  return ok(env, { mode: p.mode, accepted: p.accepted, accepted_at: p.accepted_at, modes: AI_PRIVACY_MODES });
}

async function setAiPrivacySetting({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !AI_PRIVACY_MODES.includes(b.mode)) return fail(env, 'اختار مستوى خصوصية صحيح', 400);
  if (b.accept !== true) return fail(env, 'لازم توافق على شروط المعالجة الأول', 400);

  await env.DB.prepare(`INSERT OR IGNORE INTO office_settings (office_id) VALUES (?)`).bind(officeId).run();
  try {
    await env.DB.prepare(
      `UPDATE office_settings
       SET ai_privacy = ?, ai_privacy_accepted_at = datetime('now'), ai_privacy_accepted_by = ?, updated_at = datetime('now')
       WHERE office_id = ?`
    ).bind(b.mode, authUser.user_id, officeId).run();
  } catch (e) {
    return fail(env, 'الإعداد ده محتاج تحديث قاعدة البيانات (migration 027) — كلّم الدعم الفني', 500);
  }
  clearAiPrivacyCache(officeId);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'ai_privacy_consent', entity: 'settings', entity_id: officeId, request,
    metadata: { mode: b.mode },
  });
  return ok(env, { mode: b.mode, accepted: true });
}

// ============================================================
// جلب الإعدادات (أو إنشاء افتراضية)
// ============================================================
async function get({ env, officeId }) {
  let row = await env.DB.prepare(
    `SELECT * FROM office_settings WHERE office_id = ?`
  ).bind(officeId).first();

  if (!row) {
    await env.DB.prepare(
      `INSERT INTO office_settings (office_id) VALUES (?)`
    ).bind(officeId).run();
    row = await env.DB.prepare(
      `SELECT * FROM office_settings WHERE office_id = ?`
    ).bind(officeId).first();
  }

  return ok(env, row || {});
}

// ============================================================
// تحديث الإعدادات
// ============================================================
async function update({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const allowed = [
    'office_name_ar', 'office_name_en', 'logo', 'address', 'phone', 'email',
    'website', 'tax_number', 'commercial_register',
    'currency', 'vat_rate', 'invoice_prefix', 'invoice_terms', 'fiscal_year_start',
    'notif_sessions', 'notif_tasks', 'notif_fees', 'notif_payments',
    'notif_cases', 'notif_clients', 'session_reminder_days',
    'theme', 'primary_color', 'font_size', 'language',
    'date_format', 'timezone',
  ];

  const fields = [];
  const binds = [];

  for (const key of allowed) {
    if (b[key] !== undefined) {
      fields.push(`${key} = ?`);
      binds.push(b[key]);
    }
  }

  if (!fields.length) return fail(env, 'مفيش تغييرات', 400);

  fields.push(`updated_at = datetime('now')`);
  binds.push(officeId);

  await env.DB.prepare(
    `UPDATE office_settings SET ${fields.join(', ')} WHERE office_id = ?`
  ).bind(...binds).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'settings', entity_id: officeId, request,
  });

  return ok(env, { updated: true });
}

// ============================================================
// 🔍 البحث الذكي الشامل
// ============================================================
async function search({ env, officeId, url }) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q || q.length < 2) {
    return ok(env, { results: [], query: q });
  }

  const term = `%${q}%`;
  const results = [];

  // 1) القضايا
  try {
    const { results: cases } = await env.DB.prepare(
      `SELECT c.id, c.case_number, c.court, c.status, cl.name as client_name
       FROM cases c
       LEFT JOIN clients cl ON cl.id = c.client_id
       WHERE c.office_id = ? AND c.deleted_at IS NULL
         AND (c.case_number LIKE ? OR c.court LIKE ? OR cl.name LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term, term).all();
    (cases || []).forEach(r => results.push({
      type: 'case', icon: '⚖️', title: `قضية ${r.case_number || '#' + r.id}`,
      subtitle: [r.client_name, r.court, r.status].filter(Boolean).join(' · '),
      link: `#case-${r.id}`,
    }));
  } catch (e) { console.error('search cases:', e.message); }

  // 2) الموكلين
  try {
    const { results: clients } = await env.DB.prepare(
      `SELECT id, name, phone, national_id FROM clients
       WHERE office_id = ? AND deleted_at IS NULL
         AND (name LIKE ? OR phone LIKE ? OR national_id LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term, term).all();
    (clients || []).forEach(r => results.push({
      type: 'client', icon: '👤', title: r.name,
      subtitle: [r.phone, r.national_id].filter(Boolean).join(' · '),
      link: `#client-${r.id}`,
    }));
  } catch (e) { console.error('search clients:', e.message); }

  // 3) الأتعاب
  try {
    const { results: fees } = await env.DB.prepare(
      `SELECT f.id, f.amount_due, f.amount_paid, f.status,
              cl.name as client_name, c.case_number
       FROM fees f
       LEFT JOIN clients cl ON cl.id = f.client_id
       LEFT JOIN cases c ON c.id = f.case_id
       WHERE f.office_id = ?
         AND (cl.name LIKE ? OR c.case_number LIKE ? OR f.notes LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term, term).all();
    (fees || []).forEach(r => results.push({
      type: 'fee', icon: '💰',
      title: `أتعاب — ${r.client_name || 'موكل'}`,
      subtitle: `${(r.amount_due || 0).toLocaleString('ar-EG')} ج · ${r.status || ''}${r.case_number ? ' · قضية ' + r.case_number : ''}`,
      link: `#fee-${r.id}`,
    }));
  } catch (e) { console.error('search fees:', e.message); }

  // 4) الدفعات
  try {
    const { results: payments } = await env.DB.prepare(
      `SELECT p.id, p.amount, p.receipt_number, p.payment_date,
              cl.name as client_name
       FROM payments p
       LEFT JOIN clients cl ON cl.id = p.client_id
       WHERE p.office_id = ?
         AND (p.receipt_number LIKE ? OR cl.name LIKE ? OR p.notes LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term, term).all();
    (payments || []).forEach(r => results.push({
      type: 'payment', icon: '💵',
      title: `دفعة — ${r.receipt_number || '#' + r.id}`,
      subtitle: `${(r.amount || 0).toLocaleString('ar-EG')} ج · ${r.client_name || ''} · ${r.payment_date || ''}`,
      link: `#payment-${r.id}`,
    }));
  } catch (e) { console.error('search payments:', e.message); }

  // 5) الفواتير
  try {
    const { results: invoices } = await env.DB.prepare(
      `SELECT i.id, i.invoice_number, i.total, i.status,
              cl.name as client_name
       FROM invoices i
       LEFT JOIN clients cl ON cl.id = i.client_id
       WHERE i.office_id = ?
         AND (i.invoice_number LIKE ? OR cl.name LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term).all();
    (invoices || []).forEach(r => results.push({
      type: 'invoice', icon: '📄',
      title: `فاتورة ${r.invoice_number}`,
      subtitle: `${(r.total || 0).toLocaleString('ar-EG')} ج · ${r.status} · ${r.client_name || ''}`,
      link: `#invoice-${r.id}`,
    }));
  } catch (e) { console.error('search invoices:', e.message); }

  // 6) الجلسات
  try {
    const { results: sessions } = await env.DB.prepare(
      `SELECT s.id, s.session_date, s.notes, c.case_number, c.court
       FROM sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE c.office_id = ? AND c.deleted_at IS NULL
         AND (c.case_number LIKE ? OR c.court LIKE ? OR s.notes LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term, term).all();
    (sessions || []).forEach(r => results.push({
      type: 'session', icon: '📅',
      title: `جلسة ${r.session_date}`,
      subtitle: `قضية ${r.case_number || ''} · ${r.court || ''}`,
      link: `#case-session-${r.id}`,
    }));
  } catch (e) { console.error('search sessions:', e.message); }

  // 7) المهام
  try {
    const { results: tasks } = await env.DB.prepare(
      `SELECT t.id, t.title, t.status, t.due_date, l.name as lawyer_name
       FROM tasks t
       LEFT JOIN lawyers l ON l.id = t.lawyer_id
       WHERE t.office_id = ?
         AND (t.title LIKE ? OR l.name LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term).all();
    (tasks || []).forEach(r => results.push({
      type: 'task', icon: '✅',
      title: r.title,
      subtitle: [r.lawyer_name, r.status, r.due_date].filter(Boolean).join(' · '),
      link: `#task-${r.id}`,
    }));
  } catch (e) { console.error('search tasks:', e.message); }

  // 8) المحامين
  try {
    const { results: lawyers } = await env.DB.prepare(
      `SELECT id, name, phone, email FROM lawyers
       WHERE office_id = ?
         AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
       LIMIT 5`
    ).bind(officeId, term, term, term).all();
    (lawyers || []).forEach(r => results.push({
      type: 'lawyer', icon: '👨‍⚖️',
      title: r.name,
      subtitle: [r.phone, r.email].filter(Boolean).join(' · '),
      link: `#lawyer-${r.id}`,
    }));
  } catch (e) { console.error('search lawyers:', e.message); }

  return ok(env, { results, query: q });
}