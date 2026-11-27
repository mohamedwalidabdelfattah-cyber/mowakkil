import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { isStr, toInt, safeJson } from '../lib/validation.js';
import { recordPayment, removePayment, editPayment } from '../services/accounting.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { createNotification } from './notifications.js';

export const routes = [
  { method: 'GET',    path: '/api/payments',                    handler: list },
  { method: 'POST',   path: '/api/payments',                    handler: create },
  { method: 'GET',    path: '/api/payments/stats',              handler: stats },
  { method: 'GET',    path: /^\/api\/payments\/(\d+)$/,         handler: get },
  { method: 'PATCH',  path: /^\/api\/payments\/(\d+)$/,         handler: update },
  { method: 'DELETE', path: /^\/api\/payments\/(\d+)$/,         handler: remove },
  { method: 'GET',    path: /^\/api\/fees\/(\d+)\/payments$/,   handler: feePayments },
];

async function list({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const clientId = toInt(url.searchParams.get('client_id'));
  const caseId = toInt(url.searchParams.get('case_id'));
  const feeId = toInt(url.searchParams.get('fee_id'));
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let q = `SELECT p.*, cl.name as client_name, c.case_number, f.notes as fee_notes
           FROM payments p
           LEFT JOIN clients cl ON cl.id = p.client_id
           LEFT JOIN cases c ON c.id = p.case_id
           LEFT JOIN fees f ON f.id = p.fee_id
           WHERE p.office_id = ?`;
  const binds = [officeId];

  if (clientId) { q += ' AND p.client_id = ?'; binds.push(clientId); }
  if (caseId)   { q += ' AND p.case_id = ?';   binds.push(caseId); }
  if (feeId)    { q += ' AND p.fee_id = ?';    binds.push(feeId); }
  if (from)     { q += ' AND p.payment_date >= ?'; binds.push(from); }
  if (to)       { q += ' AND p.payment_date <= ?'; binds.push(to); }

  q += ' ORDER BY p.payment_date DESC, p.id DESC';

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results);
}

async function feePayments({ env, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const feeId = toInt(params[0]);
  if (!feeId) return fail(env, 'id غلط', 400);

  const fee = await env.DB.prepare(
    `SELECT * FROM fees WHERE id = ? AND office_id = ?`
  ).bind(feeId, officeId).first();
  if (!fee) return fail(env, 'not found', 404);

  const { results } = await env.DB.prepare(
    `SELECT * FROM payments WHERE fee_id = ? AND office_id = ?
     ORDER BY payment_date DESC, id DESC`
  ).bind(feeId, officeId).all();

  const total_paid = (results || []).reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = (fee.amount_due || 0) - total_paid;

  return ok(env, { fee, payments: results || [], total_paid, remaining });
}

async function get({ env, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const r = await env.DB.prepare(
    `SELECT p.*, cl.name as client_name, c.case_number
     FROM payments p
     LEFT JOIN clients cl ON cl.id = p.client_id
     LEFT JOIN cases c ON c.id = p.case_id
     WHERE p.id = ? AND p.office_id = ?`
  ).bind(id, officeId).first();
  if (!r) return fail(env, 'not found', 404);
  return ok(env, r);
}

async function create({ request, env, authUser, officeId }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const amount = Number(b.amount);
  if (!amount || amount <= 0) return fail(env, 'اكتب مبلغ صحيح', 400);
  if (!b.payment_date) return fail(env, 'اكتب تاريخ الدفعة', 400);

  // الدفعة ممكن تبقى على أتعاب، أو على فاتورة، أو دفعة مقدمة لموكل
  let rec;
  try {
    rec = await recordPayment(env, {
      officeId, userId: authUser.user_id, amount, method: b.method || 'نقدي', date: b.payment_date,
      feeId: toInt(b.fee_id) || null, invoiceId: toInt(b.invoice_id) || null,
      clientId: toInt(b.client_id) || null, caseId: toInt(b.case_id) || null, notes: b.notes ?? null,
    });
  } catch (e) {
    return fail(env, e.message, 400);
  }
  const receipt_number = rec.receipt_number;
  const r = { meta: { last_row_id: rec.id } };
  const fee = rec.fee || (rec.client_id ? { client_id: rec.client_id } : null);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'payment', entity_id: rec.id,
    metadata: { amount, method: b.method, receipt_number, invoice_id: b.invoice_id || null }, request,
  });

  // 🔔 إشعار فوري
  const clientName = fee?.client_id ? (await env.DB.prepare(
    `SELECT name FROM clients WHERE id = ?`
  ).bind(fee.client_id).first())?.name : null;

  await createNotification(env, {
    officeId,
    userId: null,
    type: 'payment_received',
    title: '💰 دفعة جديدة',
    body: `${amount.toLocaleString('en-US')}${clientName ? ' · ' + clientName : ''}\nإيصال: ${receipt_number}`,
    link: '#payments',
    icon: '💰',
    priority: 'normal',
    referenceType: 'payment',
    referenceId: r.meta.last_row_id,
  });

  return ok(env, { id: r.meta.last_row_id, receipt_number }, 201);
}

async function update({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const p = await env.DB.prepare(
    `SELECT * FROM payments WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!p) return fail(env, 'not found', 404);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  let after;
  try { after = await editPayment(env, officeId, p, b, authUser.user_id); }
  catch (e) { return fail(env, e.message, e.status || 400); }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'payment', entity_id: id, request,
    metadata: { from: { amount: p.amount, payment_date: p.payment_date, method: p.method }, to: after },
  });
  return ok(env, { updated: true, ...after });
}

async function remove({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const p = await env.DB.prepare(
    `SELECT * FROM payments WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!p) return fail(env, 'not found', 404);

  // بيمسح الدفعة وقيدها، وبيعيد حساب المدفوع على الأتعاب والفاتورة
  try { await removePayment(env, officeId, p); } catch (e) { return fail(env, e.message, e.status || 400); }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'payment', entity_id: id, request,
  });

  return ok(env, { deleted: true });
}

async function stats({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let where = `WHERE office_id = ?`;
  const binds = [officeId];
  if (from) { where += ' AND payment_date >= ?'; binds.push(from); }
  if (to)   { where += ' AND payment_date <= ?'; binds.push(to); }

  const totals = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total_collected, COUNT(*) as total_payments
     FROM payments ${where}`
  ).bind(...binds).first();

  const byMethod = await env.DB.prepare(
    `SELECT COALESCE(method, 'غير محدد') as method,
            COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM payments ${where}
     GROUP BY method ORDER BY total DESC`
  ).bind(...binds).all();

  const daily = await env.DB.prepare(
    `SELECT payment_date, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM payments ${where}
     GROUP BY payment_date ORDER BY payment_date DESC LIMIT 30`
  ).bind(...binds).all();

  return ok(env, {
    totals: totals || { total_collected: 0, total_payments: 0 },
    by_method: byMethod.results || [],
    daily: daily.results || [],
  });
}