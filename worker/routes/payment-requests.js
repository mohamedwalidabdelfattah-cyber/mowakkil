// worker/routes/payment-requests.js
// طلبات الدفع اليدوي

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { getSubscription } from '../middleware/feature-gate.js';

// ============================================================
// Routes
// ============================================================
export const publicRoutes = [
  { method: 'GET', path: '/api/payment-requests/info', handler: getPaymentInfo },
];

export const officeRoutes = [
  { method: 'POST', path: '/api/payment-requests',              handler: createRequest },
  { method: 'GET',  path: '/api/payment-requests/my',           handler: myRequests },
];

export const superadminRoutes = [
  { method: 'GET',    path: '/api/superadmin/payment-requests',                      handler: listRequests },
  { method: 'GET',    path: /^\/api\/superadmin\/payment-requests\/(\d+)$/,          handler: getRequest },
  { method: 'POST',   path: /^\/api\/superadmin\/payment-requests\/(\d+)\/approve$/, handler: approveRequest },
  { method: 'POST',   path: /^\/api\/superadmin\/payment-requests\/(\d+)\/reject$/,  handler: rejectRequest },
];

// ============================================================
// إعدادات الدفع (ثابتة — هنحطها في الـ env لاحقًا)
// ============================================================
const PAYMENT_INFO = {
  vodafone_cash: {
    enabled: true,
    number: '01155288607',
    name: 'power media',
  },
  instapay: {
    enabled: true,
    number: '01155288607',
    name: 'power media',
  },
  plans: {
    starter: { name: 'الأساسية', price: 199 },
    pro:     { name: 'الاحترافية', price: 399 },
    plus:    { name: 'المتقدمة', price: 799 },
  },
};

// ============================================================
// 1) جلب معلومات الدفع (Public)
// ============================================================
async function getPaymentInfo() {
  return ok(null, { data: PAYMENT_INFO });
}

// ============================================================
// 2) إنشاء طلب دفع (Office)
// ============================================================
async function createRequest({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const plan = b.plan;
  const method = b.method;

  if (!['starter', 'pro', 'plus'].includes(plan)) {
    return fail(env, 'الباقة غلط', 400);
  }
  if (!['vodafone_cash', 'instapay'].includes(method)) {
    return fail(env, 'طريقة الدفع غلط', 400);
  }

  const senderPhone = (b.sender_phone || '').trim();
  if (!isStr(senderPhone, 20)) {
    return fail(env, 'اكتب رقم اللي حوّل', 400);
  }

  const amount = PAYMENT_INFO.plans[plan].price;

  // نتأكد مفيش طلب pending لنفس المكتب
  const existing = await env.DB.prepare(
    `SELECT id FROM payment_requests WHERE office_id = ? AND status = 'pending'`
  ).bind(officeId).first();
  if (existing) {
    return fail(env, 'عندك طلب دفع قيد المراجعة بالفعل', 409);
  }

  const r = await env.DB.prepare(
    `INSERT INTO payment_requests
      (office_id, user_id, plan, amount_egp, method, sender_phone, sender_name, transfer_ref, receipt_url, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    officeId,
    authUser.user_id,
    plan,
    amount,
    method,
    senderPhone,
    b.sender_name || null,
    b.transfer_ref || null,
    b.receipt_url || null,
    b.notes || null
  ).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'payment_request',
    entity_id: r.meta.last_row_id, metadata: { plan, method, amount }, request,
  });

  return ok(env, { id: r.meta.last_row_id, status: 'pending', amount }, 201);
}

// ============================================================
// 3) طلباتي (Office)
// ============================================================
async function myRequests({ env, officeId }) {
  const { results } = await env.DB.prepare(
    `SELECT id, plan, amount_egp, method, status, created_at, reviewed_at, rejection_reason
     FROM payment_requests WHERE office_id = ? ORDER BY id DESC LIMIT 20`
  ).bind(officeId).all();

  return ok(env, results || []);
}

// ============================================================
// 4) كل الطلبات (Superadmin)
// ============================================================
async function listRequests({ env, url }) {
  const status = url.searchParams.get('status') || 'pending';

  let q = `SELECT pr.*, o.name as office_name, o.name_ar as office_name_ar
           FROM payment_requests pr
           LEFT JOIN offices o ON o.id = pr.office_id`;
  const binds = [];

  if (status !== 'all') {
    q += ` WHERE pr.status = ?`;
    binds.push(status);
  }

  q += ` ORDER BY pr.created_at DESC LIMIT 100`;

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results || []);
}

// ============================================================
// 5) طلب واحد (Superadmin)
// ============================================================
async function getRequest({ env, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const r = await env.DB.prepare(
    `SELECT pr.*, o.name as office_name, o.name_ar as office_name_ar
     FROM payment_requests pr
     LEFT JOIN offices o ON o.id = pr.office_id
     WHERE pr.id = ?`
  ).bind(id).first();

  if (!r) return fail(env, 'الطلب مش موجود', 404);
  return ok(env, r);
}

// ============================================================
// 6) الموافقة (Superadmin)
// ============================================================
async function approveRequest({ request, env, params, superAdmin }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const pr = await env.DB.prepare(
    `SELECT * FROM payment_requests WHERE id = ? AND status = 'pending'`
  ).bind(id).first();
  if (!pr) return fail(env, 'الطلب مش موجود أو اتعالج بالفعل', 404);

  const b = await safeJson(request).catch(() => ({}));
  const days = Number(b?.days) || 30;

  // 1) نحدّث الطلب
  await env.DB.prepare(
    `UPDATE payment_requests
     SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
     WHERE id = ?`
  ).bind(superAdmin.admin_id, id).run();

  // 2) نحدّث الاشتراك
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const sub = await getSubscription(env, pr.office_id);

  if (sub) {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET plan = ?, status = 'active', expires_at = ?,
           amount_paid = amount_paid + ?, payment_method = ?, payment_ref = ?,
           updated_at = datetime('now')
       WHERE office_id = ?`
    ).bind(pr.plan, expiresAt, pr.amount_egp, pr.method, String(pr.id), pr.office_id).run();

    // سجل التغييرات
    await env.DB.prepare(
      `INSERT INTO subscription_history
        (office_id, old_plan, new_plan, old_status, new_status, changed_by, reason)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(
      pr.office_id, sub.plan, pr.plan, sub.status, 'active',
      superAdmin.admin_id, `دفع يدوي - طلب #${pr.id}`
    ).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO subscriptions
        (office_id, plan, status, expires_at, amount_paid, payment_method, payment_ref)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(pr.office_id, pr.plan, 'active', expiresAt, pr.amount_egp, pr.method, String(pr.id)).run();
  }

  // 3) نحدّث المكتب
  await env.DB.prepare(
    `UPDATE offices SET status = 'active' WHERE id = ?`
  ).bind(pr.office_id).run();

  await audit(env, {
    office_id: pr.office_id, action: 'approve_payment',
    entity: 'payment_request', entity_id: id, request,
    metadata: { by: superAdmin.admin_id, plan: pr.plan, days },
  });

  return ok(env, { approved: true, expires_at: expiresAt });
}

// ============================================================
// 7) الرفض (Superadmin)
// ============================================================
async function rejectRequest({ request, env, params, superAdmin }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const b = await safeJson(request).catch(() => ({}));
  const reason = (b?.reason || '').trim() || 'مرفوض بدون سبب';

  const pr = await env.DB.prepare(
    `SELECT * FROM payment_requests WHERE id = ? AND status = 'pending'`
  ).bind(id).first();
  if (!pr) return fail(env, 'الطلب مش موجود أو اتعالج بالفعل', 404);

  await env.DB.prepare(
    `UPDATE payment_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), rejection_reason = ?
     WHERE id = ?`
  ).bind(superAdmin.admin_id, reason, id).run();

  await audit(env, {
    office_id: pr.office_id, action: 'reject_payment',
    entity: 'payment_request', entity_id: id, request,
    metadata: { by: superAdmin.admin_id, reason },
  });

  return ok(env, { rejected: true });
}