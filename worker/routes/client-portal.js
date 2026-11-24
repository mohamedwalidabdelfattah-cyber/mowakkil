// worker/routes/client-portal.js
// Client Portal — بوابة الموكل

import { ok, fail } from '../lib/response.js';
import { buildStatement } from '../services/client-statement.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { audit } from '../lib/audit.js';
import { isValidEmail, isStr, toInt, safeJson } from '../lib/validation.js';

// ============================================================
// Public routes
// ============================================================
export const publicRoutes = [
  { method: 'POST', path: '/api/client-portal/login',          handler: clientLogin },
  { method: 'POST', path: '/api/client-portal/accept-invite',  handler: acceptInvite },
  { method: 'POST', path: '/api/client-portal/quick-login',    handler: quickLogin },
  { method: 'GET',  path: /^\/api\/client-portal\/invite\/([\w-]+)$/, handler: getInvite },
];

// ============================================================
// Protected routes
// ============================================================
export const protectedRoutes = [
  { method: 'GET', path: '/api/client-portal/me',                    handler: getMe },
  { method: 'POST', path: '/api/client-portal/set-password',         handler: setPassword },
  { method: 'GET', path: '/api/client-portal/cases',                 handler: myCases },
  { method: 'GET', path: /^\/api\/client-portal\/cases\/(\d+)$/,     handler: myCaseDetail },
  { method: 'GET', path: '/api/client-portal/fees',                  handler: myFees },
  { method: 'GET', path: '/api/client-portal/statement',             handler: myStatement },
  { method: 'GET', path: '/api/client-portal/invoices',              handler: myInvoices },
  { method: 'GET', path: '/api/client-portal/agenda',                handler: myAgenda },
];

// ============================================================
// Auth helper
// ============================================================
async function getClientUser(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.client_user) return null;

  const user = await env.DB.prepare(
    `SELECT cu.*, c.name as client_name, c.phone as client_phone,
            o.name_ar as office_name, o.name as office_name_fallback, o.logo as office_logo
     FROM client_users cu
     JOIN clients c ON c.id = cu.client_id
     JOIN offices o ON o.id = cu.office_id
     WHERE cu.id = ? AND cu.active = 1`
  ).bind(payload.user_id).first();

  return user || null;
}

// ============================================================
// توليد كود دعوة
// ============================================================
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================================================
// تسجيل دخول الموكل — معدّل (يختار المستخدم اللي عنده باسورد)
// ============================================================
async function clientLogin({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await checkRateLimit(env, `client_login:${ip}`, 20, 60))) {
    return fail(env, 'حاول تاني بعد دقيقة', 429);
  }

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const email = (b.email || '').trim();
  const password = b.password || '';

  if (!email || !password) return fail(env, 'اكتب الإيميل وكلمة المرور', 400);

  const cleanEmail = email.replace(/[\s\-()]/g, '');

  // ✅ البحث — بس المستخدمين اللي عندهم باسورد (مش PENDING)، والأحدث أولاً
  const user = await env.DB.prepare(
    `SELECT cu.*, c.name as client_name, c.phone as client_phone, o.name_ar as office_name
     FROM client_users cu
     JOIN clients c ON c.id = cu.client_id
     JOIN offices o ON o.id = cu.office_id
     WHERE (
       LOWER(TRIM(cu.email)) = LOWER(?)
       OR REPLACE(REPLACE(REPLACE(cu.phone, ' ', ''), '-', ''), '+', '') = ?
       OR REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', '') = ?
     ) AND cu.active = 1
     AND cu.password_hash != 'PENDING'
     ORDER BY cu.id DESC
     LIMIT 1`
  ).bind(cleanEmail, cleanEmail, cleanEmail).first();

  if (!user) {
    // ✅ لو ملقاش مستخدم عنده باسورد، نشوف لو فيه مستخدم PENDING
    const pendingUser = await env.DB.prepare(
      `SELECT cu.id FROM client_users cu
       JOIN clients c ON c.id = cu.client_id
       WHERE (
         LOWER(TRIM(cu.email)) = LOWER(?)
         OR REPLACE(REPLACE(REPLACE(cu.phone, ' ', ''), '-', ''), '+', '') = ?
         OR REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', '') = ?
       ) AND cu.active = 1 AND cu.password_hash = 'PENDING'
       LIMIT 1`
    ).bind(cleanEmail, cleanEmail, cleanEmail).first();

    if (pendingUser) {
      return fail(env, 'الحساب لسه مفعّلش — سجّل دخول بالرابط أو كلم المكتب', 401);
    }

    await audit(env, { action: 'client_login_failed', entity: 'client_user', request, metadata: { email: cleanEmail } });
    return fail(env, 'بيانات الدخول غلط', 401);
  }

  const verifyResult = await verifyPassword(password, user.password_hash, user.salt);

  if (!verifyResult) {
    await audit(env, { action: 'client_login_failed', entity: 'client_user', request, metadata: { email: cleanEmail } });
    return fail(env, 'بيانات الدخول غلط', 401);
  }

  await env.DB.prepare(`UPDATE client_users SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(user.id).run();

  const token = await signJWT({
    client_user: true,
    user_id: user.id,
    client_id: user.client_id,
    office_id: user.office_id,
    name: user.client_name,
  }, env.JWT_SECRET);

  await audit(env, {
    office_id: user.office_id, user_id: user.id,
    action: 'client_login', entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, {
    token,
    client_id: user.client_id,
    office_id: user.office_id,
    name: user.client_name,
    office_name: user.office_name,
    phone: user.client_phone,
  });
}

// ============================================================
// الحصول على بيانات الدعوة
// ============================================================
async function getInvite({ env, params }) {
  const code = params[0];
  if (!code) return fail(env, 'الكود مش موجود', 400);

  const invite = await env.DB.prepare(
    `SELECT cu.id, cu.full_name, cu.email, cu.phone, cu.invite_expires_at,
            c.name as client_name, c.phone as client_phone,
            o.name_ar as office_name, o.name as office_name_fallback
     FROM client_users cu
     JOIN clients c ON c.id = cu.client_id
     JOIN offices o ON o.id = cu.office_id
     WHERE cu.invite_code = ? AND cu.active = 1`
  ).bind(code).first();

  if (!invite) return fail(env, 'الكود غلط أو مستخدم', 404);
  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return fail(env, 'انتهت صلاحية الكود', 410);
  }

  return ok(env, {
    code,
    client_name: invite.client_name,
    client_phone: invite.client_phone || invite.phone,
    office_name: invite.office_name || invite.office_name_fallback,
    expires_at: invite.invite_expires_at,
  });
}

// ============================================================
// قبول الدعوة (باسورد)
// ============================================================
async function acceptInvite({ request, env }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const code = (b.code || '').trim();
  const password = b.password || '';

  if (!code) return fail(env, 'الكود مطلوب', 400);
  if (!isStr(password, 200) || password.length < 8) {
    return fail(env, 'كلمة المرور لازم 8 حروف على الأقل', 400);
  }

  const user = await env.DB.prepare(
    `SELECT * FROM client_users WHERE invite_code = ? AND active = 1`
  ).bind(code).first();

  if (!user) return fail(env, 'الكود غلط أو مستخدم', 404);
  if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
    return fail(env, 'انتهت صلاحية الكود', 410);
  }
  if (user.password_hash !== 'PENDING') {
    return fail(env, 'الدعوة دي اتستخدمت خلاص', 410);
  }

  const { hash, salt } = await hashPassword(password);

  await env.DB.prepare(
    `UPDATE client_users
     SET password_hash = ?, salt = ?, invite_code = NULL, invite_expires_at = NULL
     WHERE id = ?`
  ).bind(hash, salt, user.id).run();

  await audit(env, {
    office_id: user.office_id,
    action: 'client_invite_accepted', entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, { accepted: true });
}

// ============================================================
// دخول سريع (من غير باسورد)
// ============================================================
async function quickLogin({ request, env }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const code = (b.code || '').trim();
  if (!code) return fail(env, 'الكود مطلوب', 400);

  const user = await env.DB.prepare(
    `SELECT cu.*, c.name as client_name, c.phone as client_phone, o.name_ar as office_name
     FROM client_users cu
     JOIN clients c ON c.id = cu.client_id
     JOIN offices o ON o.id = cu.office_id
     WHERE cu.invite_code = ? AND cu.active = 1
     ORDER BY cu.id DESC
     LIMIT 1`
  ).bind(code).first();

  if (!user) return fail(env, 'الكود غلط أو مستخدم', 404);

  await env.DB.prepare(
    `UPDATE client_users SET last_login_at = datetime('now') WHERE id = ?`
  ).bind(user.id).run();

  await audit(env, {
    office_id: user.office_id, user_id: user.id,
    action: 'client_quick_login', entity: 'client_user', entity_id: user.id, request,
  });

  const token = await signJWT({
    client_user: true,
    user_id: user.id,
    client_id: user.client_id,
    office_id: user.office_id,
    name: user.client_name,
  }, env.JWT_SECRET);

  return ok(env, {
    token,
    client_id: user.client_id,
    office_id: user.office_id,
    name: user.client_name,
    phone: user.client_phone,
    office_name: user.office_name,
  });
}

// ============================================================
// إعداد باسورد
// ============================================================
async function setPassword({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const password = b.password || '';
  if (!isStr(password, 200) || password.length < 8) {
    return fail(env, 'كلمة المرور لازم 8 حروف على الأقل', 400);
  }

  const { hash, salt } = await hashPassword(password);

  await env.DB.prepare(
    `UPDATE client_users SET password_hash = ?, salt = ? WHERE id = ?`
  ).bind(hash, salt, user.id).run();

  await audit(env, {
    office_id: user.office_id, user_id: user.id,
    action: 'client_set_password', entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, { updated: true });
}

// ============================================================
// بيانات الموكل
// ============================================================
async function getMe({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const office = await env.DB.prepare(
    `SELECT name, name_ar, logo FROM offices WHERE id = ?`
  ).bind(user.office_id).first();

  return ok(env, {
    client: {
      id: user.client_id,
      name: user.client_name,
      phone: user.client_phone,
      email: user.email,
      has_password: user.password_hash !== 'PENDING',
    },
    office: office || {},
  });
}

// ============================================================
// قضايا الموكل
// ============================================================
async function myCases({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const { results: cases } = await env.DB.prepare(
    `SELECT id, case_number, court, degree, case_type, status, created_at
     FROM cases
     WHERE client_id = ? AND office_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(user.client_id, user.office_id).all();

  for (const c of (cases || [])) {
    const next = await env.DB.prepare(
      `SELECT session_date, notes FROM sessions
       WHERE case_id = ? AND session_date >= date('now')
       ORDER BY session_date ASC LIMIT 1`
    ).bind(c.id).first();
    c.next_session = next || null;
  }

  return ok(env, cases || []);
}

// ============================================================
// تفاصيل قضية
// ============================================================
async function myCaseDetail({ request, env, params }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const caseId = toInt(params[0]);

  const c = await env.DB.prepare(
    `SELECT * FROM cases
     WHERE id = ? AND client_id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(caseId, user.client_id, user.office_id).first();

  if (!c) return fail(env, 'القضية مش موجودة', 404);

  const { results: sessions } = await env.DB.prepare(
    `SELECT id, session_date, notes FROM sessions
     WHERE case_id = ? ORDER BY session_date DESC`
  ).bind(caseId).all();

  const { results: invoices } = await env.DB.prepare(
    `SELECT id, invoice_number, issue_date, due_date, total, paid_amount, status
     FROM invoices
     WHERE case_id = ? AND office_id = ?
     ORDER BY issue_date DESC`
  ).bind(caseId, user.office_id).all();

  return ok(env, { case: c, sessions: sessions || [], invoices: invoices || [] });
}

// ============================================================
// الأتعاب
// ============================================================
async function myFees({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const { results } = await env.DB.prepare(
    `SELECT f.id, f.amount_due, f.amount_paid, f.due_date, f.status, f.notes,
            c.case_number
     FROM fees f
     LEFT JOIN cases c ON c.id = f.case_id
     WHERE f.client_id = ? AND f.office_id = ?
     ORDER BY f.created_at DESC`
  ).bind(user.client_id, user.office_id).all();

  const totalDue = (results || []).reduce((s, f) => s + (f.amount_due || 0), 0);
  const totalPaid = (results || []).reduce((s, f) => s + (f.amount_paid || 0), 0);

  return ok(env, {
    fees: results || [],
    total_due: totalDue,
    total_paid: totalPaid,
    total_remaining: totalDue - totalPaid,
  });
}

// ============================================================
// الفواتير
// ============================================================
async function myInvoices({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const { results } = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.issue_date, i.due_date,
            i.total, i.paid_amount, i.status,
            c.case_number
     FROM invoices i
     LEFT JOIN cases c ON c.id = i.case_id
     WHERE i.client_id = ? AND i.office_id = ?
     ORDER BY i.issue_date DESC`
  ).bind(user.client_id, user.office_id).all();

  return ok(env, results || []);
}

// ============================================================
// الأجندة
// ============================================================
async function myAgenda({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);

  const { results } = await env.DB.prepare(
    `SELECT s.id, s.session_date, s.notes,
            c.case_number, c.court
     FROM sessions s
     JOIN cases c ON c.id = s.case_id
     WHERE c.client_id = ? AND c.office_id = ?
       AND s.session_date >= date('now')
     ORDER BY s.session_date ASC
     LIMIT 30`
  ).bind(user.client_id, user.office_id).all();

  return ok(env, results || []);
}

// ============================================================
// ============ Endpoints للمحامي ============
// ============================================================

export async function inviteClient({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!b.client_id) return fail(env, 'اختار الموكل', 400);

  const client = await env.DB.prepare(
    `SELECT * FROM clients WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(b.client_id, officeId).first();
  if (!client) return fail(env, 'الموكل مش موجود', 404);

  const email = (b.email || '').trim() || null;
  const phone = (b.phone || client.phone || '').trim() || null;

  if (!email && !phone) return fail(env, 'لازم إيميل أو رقم هاتف', 400);

  const existing = await env.DB.prepare(
    `SELECT id FROM client_users WHERE client_id = ? AND office_id = ? AND active = 1`
  ).bind(b.client_id, officeId).first();

  const code = generateInviteCode();

  if (existing) {
    await env.DB.prepare(
      `UPDATE client_users
       SET invite_code = ?, invite_expires_at = NULL, password_hash = 'PENDING', salt = ''
       WHERE id = ?`
    ).bind(code, existing.id).run();

    return ok(env, {
      invite_code: code,
      invite_link: `https://mowakkil-2026.pages.dev/client?code=${code}&quick=1`,
      client_name: client.name,
    });
  }

  const r = await env.DB.prepare(
    `INSERT INTO client_users
      (office_id, client_id, email, phone, password_hash, salt, full_name, invite_code, invite_expires_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(officeId, b.client_id, email, phone, 'PENDING', '', client.name, code, null).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'client_invite_sent', entity: 'client_user',
    entity_id: r.meta.last_row_id, metadata: { client_id: b.client_id }, request,
  });

  return ok(env, {
    invite_code: code,
    invite_link: `https://mowakkil-2026.pages.dev/client?code=${code}&quick=1`,
    client_name: client.name,
  }, 201);
}

export async function cancelInvite({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !b.client_id) return fail(env, 'client_id مطلوب', 400);

  const user = await env.DB.prepare(
    `SELECT * FROM client_users WHERE client_id = ? AND office_id = ?`
  ).bind(b.client_id, officeId).first();

  if (!user) return fail(env, 'مفيش حساب للموكل ده', 404);

  await env.DB.prepare(
    `UPDATE client_users SET invite_code = NULL WHERE id = ?`
  ).bind(user.id).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'cancel_invite', entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, { cancelled: true });
}

export async function toggleActive({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !b.client_id) return fail(env, 'client_id مطلوب', 400);

  const user = await env.DB.prepare(
    `SELECT * FROM client_users WHERE client_id = ? AND office_id = ?`
  ).bind(b.client_id, officeId).first();

  if (!user) return fail(env, 'مفيش حساب للموكل ده', 404);

  const newActive = user.active === 1 ? 0 : 1;

  await env.DB.prepare(
    `UPDATE client_users SET active = ? WHERE id = ?`
  ).bind(newActive, user.id).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: newActive ? 'activate_client' : 'deactivate_client',
    entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, { active: newActive === 1 });
}

export async function resendInvite({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !b.client_id) return fail(env, 'client_id مطلوب', 400);

  const user = await env.DB.prepare(
    `SELECT * FROM client_users WHERE client_id = ? AND office_id = ?`
  ).bind(b.client_id, officeId).first();

  if (!user) return fail(env, 'مفيش حساب للموكل ده', 404);

  const client = await env.DB.prepare(
    `SELECT name, phone FROM clients WHERE id = ?`
  ).bind(b.client_id).first();

  const code = generateInviteCode();

  await env.DB.prepare(
    `UPDATE client_users
     SET password_hash = 'PENDING', salt = '',
         invite_code = ?, invite_expires_at = NULL, active = 1
     WHERE id = ?`
  ).bind(code, user.id).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'resend_invite', entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, {
    invite_code: code,
    invite_link: `https://mowakkil-2026.pages.dev/client?code=${code}&quick=1`,
    client_name: client?.name || user.full_name,
    phone: client?.phone || user.phone,
  });
}

export async function deleteAccount({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !b.client_id) return fail(env, 'client_id مطلوب', 400);

  const user = await env.DB.prepare(
    `SELECT * FROM client_users WHERE client_id = ? AND office_id = ?`
  ).bind(b.client_id, officeId).first();

  if (!user) return fail(env, 'مفيش حساب للموكل ده', 404);

  await env.DB.prepare(`DELETE FROM client_users WHERE id = ?`).bind(user.id).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete_client_account', entity: 'client_user', entity_id: user.id, request,
  });

  return ok(env, { deleted: true });
}

export async function getAccountStatus({ request, env, officeId, url }) {
  const clientId = toInt(url.searchParams.get('client_id'));
  if (!clientId) return fail(env, 'client_id مطلوب', 400);

  const user = await env.DB.prepare(
    `SELECT id, active, invite_code, invite_expires_at, password_hash, last_login_at, created_at
     FROM client_users WHERE client_id = ? AND office_id = ?
     ORDER BY id DESC LIMIT 1`
  ).bind(clientId, officeId).first();

  if (!user) return ok(env, { has_account: false });

  const isPending = user.password_hash === 'PENDING';

  return ok(env, {
    has_account: true,
    active: user.active === 1,
    has_password: !isPending,
    invite_pending: isPending && !!user.invite_code,
    invite_expired: false,
    invite_code: user.invite_code,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
  });
}

// كشف حسابي (نفس كشف الحساب اللي المكتب بيشوفه)
async function myStatement({ request, env }) {
  const user = await getClientUser(request, env);
  if (!user) return fail(env, 'محتاج تسجيل دخول', 401);
  const s = await buildStatement(env, user.office_id, user.client_id);
  if (!s) return fail(env, 'مش موجود', 404);
  const st = await env.DB.prepare('SELECT currency FROM office_settings WHERE office_id = ?').bind(user.office_id).first();
  return ok(env, { lines: s.lines.map(({ ref, ...l }) => l), totals: s.totals, currency: st?.currency || 'EGP' });
}
