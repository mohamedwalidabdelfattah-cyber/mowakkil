import { ok, fail } from '../lib/response.js';
import { buildStatement } from '../services/client-statement.js';
import { can } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';
import { isStr, toInt, safeJson } from '../lib/validation.js';
import {
  inviteClient,
  cancelInvite,
  toggleActive,
  resendInvite,
  deleteAccount,
  getAccountStatus,
} from './client-portal.js';
import { createNotification } from './notifications.js';
import { requireLimit } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',    path: '/api/clients',                     handler: list },
  { method: 'POST',   path: '/api/clients',                     handler: create },
  { method: 'GET',    path: /^\/api\/clients\/(\d+)\/profile$/, handler: profile },
  { method: 'GET',    path: /^\/api\/clients\/(\d+)\/statement$/, handler: statement },
  { method: 'PATCH',  path: /^\/api\/clients\/(\d+)$/,          handler: update },
  { method: 'DELETE', path: /^\/api\/clients\/(\d+)$/,          handler: remove },

  // Client Portal management
  { method: 'POST',   path: '/api/clients/invite',              handler: inviteClient },
  { method: 'POST',   path: '/api/clients/cancel-invite',       handler: cancelInvite },
  { method: 'POST',   path: '/api/clients/toggle-active',       handler: toggleActive },
  { method: 'POST',   path: '/api/clients/resend-invite',       handler: resendInvite },
  { method: 'POST',   path: '/api/clients/delete-account',      handler: deleteAccount },
  { method: 'GET',    path: '/api/clients/account-status',      handler: getAccountStatus },
];

async function list({ env, officeId, url }) {
  const search = url.searchParams.get('search');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = `SELECT * FROM clients WHERE office_id = ? AND deleted_at IS NULL`;
  const binds = [officeId];

  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR national_id LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (from) { query += ' AND created_at >= ?'; binds.push(from); }
  if (to)   { query += ' AND created_at <= ?'; binds.push(to); }

  query += ' ORDER BY created_at DESC';

  // حالة حساب بوابة الموكل لكل الموكلين في استعلام واحد (بدل طلب منفصل لكل موكل)
  const [{ results }, { results: accounts }] = await Promise.all([
    env.DB.prepare(query).bind(...binds).all(),
    env.DB.prepare(
      `SELECT client_id, active, password_hash, invite_code FROM client_users
       WHERE office_id = ? ORDER BY id DESC`
    ).bind(officeId).all().catch(() => ({ results: [] })),
  ]);

  const byClient = new Map();
  for (const a of accounts || []) if (!byClient.has(a.client_id)) byClient.set(a.client_id, a);

  const rows = (results || []).map(c => {
    const a = byClient.get(c.id);
    if (!a) return { ...c, account_status: { has_account: false } };
    const pending = a.password_hash === 'PENDING';
    return {
      ...c,
      account_status: {
        has_account: true,
        active: a.active === 1,
        has_password: !pending,
        invite_pending: pending && !!a.invite_code,
        invite_expired: false,
        invite_code: a.invite_code,
      },
    };
  });
  return ok(env, rows);
}

async function create({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !isStr(b.name, 200)) return fail(env, 'اكتب اسم الموكل', 400);

  const clientsCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM clients WHERE office_id = ? AND deleted_at IS NULL`
  ).bind(officeId).first();

  const limitFail = await requireLimit(env, officeId, 'max_clients', clientsCount?.c || 0);
  if (limitFail) return limitFail;

  const r = await env.DB.prepare(
    `INSERT INTO clients (office_id, name, phone, national_id) VALUES (?,?,?,?)`
  ).bind(officeId, b.name.trim(), b.phone ?? null, b.national_id ?? null).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'client', entity_id: r.meta.last_row_id, request,
  });

  await createNotification(env, {
    officeId,
    userId: null,
    type: 'client_created',
    title: '👤 موكل جديد',
    body: `تم إضافة "${b.name.trim()}"${b.phone ? ' · ' + b.phone : ''}`,
    link: `#client-${r.meta.last_row_id}`,
    icon: '👤',
    priority: 'normal',
    referenceType: 'client',
    referenceId: r.meta.last_row_id,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function profile({ env, officeId, params }) {
  const id = toInt(params[0]);
  const client = await env.DB.prepare(
    `SELECT * FROM clients WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(id, officeId).first();
  if (!client) return fail(env, 'not found', 404);

  const { results: cases } = await env.DB.prepare(
    `SELECT id, case_number, court, degree, case_type, status, created_at
     FROM cases
     WHERE client_id = ? AND office_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(id, officeId).all();

  const { results: fees } = await env.DB.prepare(
    `SELECT f.*, c.case_number
     FROM fees f
     LEFT JOIN cases c ON c.id = f.case_id
     WHERE f.client_id = ? AND f.office_id = ?
     ORDER BY f.created_at DESC`
  ).bind(id, officeId).all();

  const { results: payments } = await env.DB.prepare(
    `SELECT p.*, f.notes as fee_notes
     FROM payments p
     LEFT JOIN fees f ON f.id = p.fee_id
     WHERE p.client_id = ? AND p.office_id = ?
     ORDER BY p.payment_date DESC LIMIT 20`
  ).bind(id, officeId).all();

  const { results: sessions } = await env.DB.prepare(
    `SELECT s.id, s.session_date, s.notes, c.case_number, c.court
     FROM sessions s
     JOIN cases c ON c.id = s.case_id
     WHERE c.client_id = ? AND c.office_id = ? AND c.deleted_at IS NULL
     ORDER BY s.session_date DESC LIMIT 30`
  ).bind(id, officeId).all();

  const { results: invoices } = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.issue_date, i.total, i.paid_amount, i.status, c.case_number
     FROM invoices i
     LEFT JOIN cases c ON c.id = i.case_id
     WHERE i.client_id = ? AND i.office_id = ?
     ORDER BY i.issue_date DESC`
  ).bind(id, officeId).all();

  const totalFees = (fees || []).reduce((s, f) => s + (f.amount_due || 0), 0);
  const totalPaid = (fees || []).reduce((s, f) => s + (f.amount_paid || 0), 0);
  const totalInvoices = (invoices || []).reduce((s, i) => s + (i.total || 0), 0);
  const totalInvoicesPaid = (invoices || []).reduce((s, i) => s + (i.paid_amount || 0), 0);

  const upcomingSessions = (sessions || []).filter(s => new Date(s.session_date) >= new Date());

  return ok(env, {
    client,
    cases: cases || [],
    fees: fees || [],
    payments: payments || [],
    sessions: sessions || [],
    invoices: invoices || [],
    upcoming_sessions: upcomingSessions,
    stats: {
      total_cases: (cases || []).length,
      total_fees: totalFees,
      total_paid: totalPaid,
      total_remaining: totalFees - totalPaid,
      total_invoices: totalInvoices,
      total_invoices_paid: totalInvoicesPaid,
      total_invoices_remaining: totalInvoices - totalInvoicesPaid,
      sessions_count: (sessions || []).length,
      upcoming_count: upcomingSessions.length,
    },
  });
}

// تعديل بيانات الموكل: الاسم والموبايل والرقم القومي/الهوية
async function update({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const cur = await env.DB.prepare('SELECT * FROM clients WHERE id = ? AND office_id = ? AND deleted_at IS NULL').bind(id, officeId).first();
  if (!cur) return fail(env, 'الموكل مش موجود', 404);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (b.name !== undefined && !isStr(String(b.name).trim(), 200)) return fail(env, 'اكتب اسم الموكل', 400);
  const clean = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
  const next = {
    name: b.name !== undefined ? String(b.name).trim() : cur.name,
    phone: b.phone !== undefined ? clean(b.phone, 30) : cur.phone,
    national_id: b.national_id !== undefined ? clean(b.national_id, 30) : cur.national_id,
  };
  await env.DB.prepare('UPDATE clients SET name = ?, phone = ?, national_id = ? WHERE id = ? AND office_id = ?')
    .bind(next.name, next.phone, next.national_id, id, officeId).run();
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'client', entity_id: id, request,
    metadata: { from: { name: cur.name, phone: cur.phone }, to: { name: next.name, phone: next.phone } },
  });
  return ok(env, { id, ...next });
}

async function remove({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const r = await env.DB.prepare(
    `UPDATE clients SET deleted_at = datetime('now') WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).run();

  if (r.meta.changes === 0) return fail(env, 'not found', 404);
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'client', entity_id: id,
  });
  return ok(env, { deleted: true });
}

// ============================================================
// كشف حساب الموكل (اللي عليه، اللي دفعه، الرصيد)
// ============================================================
async function statement({ env, officeId, params, access }) {
  if (!(access?.role === 'admin' || can(access, 'fees.view'))) return fail(env, 'مش عندك صلاحية تشوف الحسابات', 403, { code: 'PERMISSION_DENIED' });
  const s = await buildStatement(env, officeId, Number(params[0]));
  if (!s) return fail(env, 'الموكل مش موجود', 404);
  const office = await env.DB.prepare('SELECT name, name_ar FROM offices WHERE id = ?').bind(officeId).first();
  const st = await env.DB.prepare('SELECT currency FROM office_settings WHERE office_id = ?').bind(officeId).first();
  return ok(env, { ...s, office: office || {}, currency: st?.currency || 'EGP' });
}
