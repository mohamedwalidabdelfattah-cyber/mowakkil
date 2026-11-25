// worker/routes/settings.js
// إعدادات المكتب الشاملة

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson } from '../lib/validation.js';
import { can, caseScope } from '../lib/permissions.js';
import { clearPrefsCache } from './notifications.js';
import { getAiPrivacy, clearAiPrivacyCache, AI_PRIVACY_MODES } from '../lib/ai-privacy.js';
import { COUNTRIES } from '../lib/country.js';

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
    'doc_storage_default', // مكان حفظ المستندات الافتراضي: cloud | device
    'wa_templates', // قوالب رسايل واتساب (JSON: session/fee/update/general)
    'notif_events', // تذكيرات مواعيد الأجندة
    'expense_approval_limit', // المصروفات اللي فوقه محتاجة موافقة المدير (المتقدمة)
    'country', // دولة المكتب: EG | SA
  ];
  if (b.country !== undefined) {
    const c = String(b.country || '').toUpperCase();
    if (!COUNTRIES[c]) return fail(env, 'الدولة مش مدعومة', 400);
    b.country = c;
    // التوقيت بيمشي مع الدولة (التذكيرات وحدود اليوم)
    await env.DB.prepare('UPDATE offices SET timezone = ? WHERE id = ?').bind(COUNTRIES[c].timezone, officeId).run();
  }
  if (b.expense_approval_limit !== undefined) {
    if (b.expense_approval_limit === null || b.expense_approval_limit === '') b.expense_approval_limit = null;
    else if (!(Number(b.expense_approval_limit) >= 0)) return fail(env, 'حد الموافقة لازم يكون رقم', 400);
    else b.expense_approval_limit = Number(b.expense_approval_limit);
  }
  if (b.session_reminder_days !== undefined) {
    const d = Number(b.session_reminder_days);
    if (!Number.isInteger(d) || d < 0 || d > 7) return fail(env, 'تذكير الجلسات لازم يكون من 0 لـ 7 أيام', 400);
  }
  for (const k of ['notif_sessions', 'notif_tasks', 'notif_fees', 'notif_payments', 'notif_cases', 'notif_clients', 'notif_events']) {
    if (b[k] !== undefined) b[k] = b[k] ? 1 : 0;
  }
  if (b.wa_templates !== undefined && b.wa_templates !== null) {
    let t = b.wa_templates;
    if (typeof t === 'object') t = JSON.stringify(t);
    let parsed;
    try { parsed = JSON.parse(t); } catch { return fail(env, 'قوالب واتساب مش مظبوطة', 400); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || String(t).length > 8000) {
      return fail(env, 'قوالب واتساب مش مظبوطة', 400);
    }
    const clean = {};
    for (const k of ['session', 'fee', 'update', 'general']) {
      if (typeof parsed[k] === 'string' && parsed[k].trim()) clean[k] = parsed[k].slice(0, 1500);
    }
    b.wa_templates = Object.keys(clean).length ? JSON.stringify(clean) : null;
  }
  if (b.doc_storage_default !== undefined && !['cloud', 'device'].includes(b.doc_storage_default)) {
    return fail(env, 'مكان الحفظ لازم يكون cloud أو device', 400);
  }

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
  clearPrefsCache(officeId);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'settings', entity_id: officeId, request,
  });

  return ok(env, { updated: true });
}

// ============================================================
// 🔍 البحث الذكي الشامل
// ============================================================
async function search({ env, officeId, url, access, authUser }) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q || q.length < 2) {
    return ok(env, { results: [], query: q });
  }

  const term = `%${q}%`;
  const results = [];
  const allow = (perm) => access?.role === 'admin' || can(access, perm);
  const money = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  // "المكلّف بيها بس": القضايا بتاعته بس
  const sc = caseScope(access, authUser, 'c.id');
  const run = async (label, perm, fn) => {
    if (perm && !allow(perm)) return;
    try { await fn(); } catch (e) { console.error('search ' + label + ':', e.message); }
  };

  await Promise.all([
    // 1) القضايا
    run('cases', 'cases.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT c.id, c.case_number, c.court, c.status, c.case_type, cl.name as client_name
         FROM cases c
         LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.office_id = ? AND c.deleted_at IS NULL
           AND (c.case_number LIKE ? OR c.court LIKE ? OR cl.name LIKE ? OR c.case_type LIKE ?)${sc.sql}
         ORDER BY c.id DESC LIMIT 6`
      ).bind(officeId, term, term, term, term, ...sc.binds).all();
      (rows || []).forEach(r => results.push({
        type: 'case', icon: '⚖️', title: `قضية ${r.case_number || '#' + r.id}`,
        subtitle: [r.client_name, r.court, r.case_type, r.status].filter(Boolean).join(' · '),
        link: `#case-${r.id}`,
      }));
    }),

    // 2) الموكلين
    run('clients', 'clients.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT id, name, phone, national_id FROM clients
         WHERE office_id = ? AND deleted_at IS NULL
           AND (name LIKE ? OR phone LIKE ? OR national_id LIKE ?)
         ORDER BY id DESC LIMIT 6`
      ).bind(officeId, term, term, term).all();
      (rows || []).forEach(r => results.push({
        type: 'client', icon: '👤', title: r.name,
        subtitle: [r.phone, r.national_id].filter(Boolean).join(' · '),
        link: `#client-${r.id}`,
      }));
    }),

    // 3) الجلسات
    run('sessions', 'agenda.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT s.id, s.session_date, s.session_time, s.notes, c.id as case_id, c.case_number, c.court, cl.name as client_name
         FROM sessions s
         JOIN cases c ON c.id = s.case_id
         LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.office_id = ? AND c.deleted_at IS NULL
           AND (c.case_number LIKE ? OR c.court LIKE ? OR s.notes LIKE ? OR cl.name LIKE ?)${sc.sql}
         ORDER BY s.session_date DESC LIMIT 6`
      ).bind(officeId, term, term, term, term, ...sc.binds).all();
      (rows || []).forEach(r => results.push({
        type: 'session', icon: '📅',
        title: `جلسة ${r.session_date}${r.session_time ? ' · ' + r.session_time : ''}`,
        subtitle: [r.case_number ? 'قضية ' + r.case_number : '', r.client_name, r.court].filter(Boolean).join(' · '),
        link: `#case-${r.case_id}`,
      }));
    }),

    // 4) مواعيد الأجندة
    run('events', 'agenda.view', async () => {
      const own = access?.scope === 'assigned'
        ? { sql: ' AND (e.user_id = ? OR e.case_id IN (SELECT case_id FROM case_members WHERE user_id = ?))', binds: [authUser.user_id, authUser.user_id] }
        : { sql: '', binds: [] };
      const { results: rows } = await env.DB.prepare(
        `SELECT e.id, e.title, e.kind, e.start_date, e.start_time, e.location, c.case_number
         FROM agenda_events e LEFT JOIN cases c ON c.id = e.case_id
         WHERE e.office_id = ? AND (e.title LIKE ? OR e.location LIKE ? OR e.notes LIKE ?)${own.sql}
         ORDER BY e.start_date DESC LIMIT 6`
      ).bind(officeId, term, term, term, ...own.binds).all();
      (rows || []).forEach(r => results.push({
        type: 'event', icon: '🗓️', title: r.title,
        subtitle: [`${r.start_date}${r.start_time ? ' · ' + r.start_time : ''}`, r.location, r.case_number ? 'قضية ' + r.case_number : ''].filter(Boolean).join(' · '),
        link: '#agenda',
      }));
    }),

    // 5) المهام
    run('tasks', 'tasks.view', async () => {
      const own = access?.scope === 'assigned'
        ? { sql: ' AND (t.case_id IS NULL OR t.case_id IN (SELECT case_id FROM case_members WHERE user_id = ?))', binds: [authUser.user_id] }
        : { sql: '', binds: [] };
      const { results: rows } = await env.DB.prepare(
        `SELECT t.id, t.title, t.status, t.due_date, l.name as lawyer_name
         FROM tasks t
         LEFT JOIN lawyers l ON l.id = t.lawyer_id
         WHERE t.office_id = ? AND (t.title LIKE ? OR l.name LIKE ?)${own.sql}
         ORDER BY t.id DESC LIMIT 6`
      ).bind(officeId, term, term, ...own.binds).all();
      (rows || []).forEach(r => results.push({
        type: 'task', icon: '✅', title: r.title,
        subtitle: [r.lawyer_name, r.status, r.due_date].filter(Boolean).join(' · '),
        link: `#task-${r.id}`,
      }));
    }),

    // 6) الأتعاب
    run('fees', 'fees.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT f.id, f.amount_due, f.amount_paid, f.status, cl.name as client_name, c.case_number
         FROM fees f
         LEFT JOIN clients cl ON cl.id = f.client_id
         LEFT JOIN cases c ON c.id = f.case_id
         WHERE f.office_id = ? AND (cl.name LIKE ? OR c.case_number LIKE ? OR f.notes LIKE ?)
         ORDER BY f.id DESC LIMIT 6`
      ).bind(officeId, term, term, term).all();
      (rows || []).forEach(r => results.push({
        type: 'fee', icon: '💰',
        title: `أتعاب — ${r.client_name || 'موكل'}`,
        subtitle: `${money(r.amount_due)} ج · ${r.status || ''}${r.case_number ? ' · قضية ' + r.case_number : ''}`,
        link: `#fee-${r.id}`,
      }));
    }),

    // 7) الدفعات
    run('payments', 'fees.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT p.id, p.amount, p.receipt_number, p.payment_date, cl.name as client_name
         FROM payments p
         LEFT JOIN clients cl ON cl.id = p.client_id
         WHERE p.office_id = ? AND (p.receipt_number LIKE ? OR cl.name LIKE ? OR p.notes LIKE ?)
         ORDER BY p.id DESC LIMIT 6`
      ).bind(officeId, term, term, term).all();
      (rows || []).forEach(r => results.push({
        type: 'payment', icon: '💵',
        title: `دفعة — ${r.receipt_number || '#' + r.id}`,
        subtitle: [`${money(r.amount)} ج`, r.client_name, r.payment_date].filter(Boolean).join(' · '),
        link: `#payment-${r.id}`,
      }));
    }),

    // 8) الفواتير
    run('invoices', 'invoices.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT i.id, i.invoice_number, i.total, i.status, cl.name as client_name
         FROM invoices i
         LEFT JOIN clients cl ON cl.id = i.client_id
         WHERE i.office_id = ? AND (i.invoice_number LIKE ? OR cl.name LIKE ?)
         ORDER BY i.id DESC LIMIT 6`
      ).bind(officeId, term, term).all();
      (rows || []).forEach(r => results.push({
        type: 'invoice', icon: '📄',
        title: `فاتورة ${r.invoice_number}`,
        subtitle: [`${money(r.total)} ج`, r.status, r.client_name].filter(Boolean).join(' · '),
        link: `#invoice-${r.id}`,
      }));
    }),

    // 9) المحامين
    run('lawyers', 'lawyers.view', async () => {
      const { results: rows } = await env.DB.prepare(
        `SELECT id, name, phone, grade FROM lawyers
         WHERE office_id = ? AND (name LIKE ? OR phone LIKE ?)
         ORDER BY id DESC LIMIT 6`
      ).bind(officeId, term, term).all();
      (rows || []).forEach(r => results.push({
        type: 'lawyer', icon: '👨‍⚖️', title: r.name,
        subtitle: [r.grade, r.phone].filter(Boolean).join(' · '),
        link: `#lawyer-${r.id}`,
      }));
    }),
  ]);

  // ترتيب ثابت للمجموعات
  const ORDER = ['case', 'client', 'session', 'event', 'task', 'fee', 'payment', 'invoice', 'lawyer'];
  results.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  return ok(env, { results, query: q });
}
