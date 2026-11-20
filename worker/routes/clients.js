import { ok, fail } from '../lib/response.js';
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

  // تحسين: جلب حالة الحساب مع القائمة في استعلام واحد بدل استعلامات منفصلة
  let query = `
    SELECT c.*, 
           cu.id as account_id, 
           cu.password_hash, 
           cu.active, 
           cu.invite_token, 
           cu.invite_expires_at
    FROM clients c
    LEFT JOIN client_users cu ON cu.client_id = c.id AND cu.office_id = c.office_id
    WHERE c.office_id = ? AND c.deleted_at IS NULL
  `;
  const binds = [officeId];

  if (search) {
    query += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.national_id LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (from) { query += ' AND c.created_at >= ?'; binds.push(from); }
  if (to)   { query += ' AND c.created_at <= ?'; binds.push(to); }

  query += ' ORDER BY c.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  
  // إعادة تنسيق البيانات عشان تبقى متوافقة مع الواجهة
  const formatted = results.map(r => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    national_id: r.national_id,
    created_at: r.created_at,
    account_status: r.account_id ? {
      has_account: true,
      active: !!r.active,
      has_password: !!r.password_hash,
      invite_pending: !!r.invite_token && r.invite_expires_at && new Date(r.invite_expires_at) > new Date(),
      invite_expired: !!r.invite_token && r.invite_expires_at && new Date(r.invite_expires_at) <= new Date(),
    } : { has_account: false }
  }));

  return ok(env, formatted);
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