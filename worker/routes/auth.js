import { ok, fail } from '../lib/response.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { signJWT } from '../lib/jwt.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { audit } from '../lib/audit.js';
import { phoneVariants } from '../lib/phone.js';
import { isValidEmail, isStr, safeJson } from '../lib/validation.js';
import { requireLimit } from '../middleware/feature-gate.js';
import { alertOwner } from '../lib/monitor.js';

// ============================================================
// Public routes
// ============================================================
export const publicRoutes = [
  { method: 'POST', path: '/api/auth/setup', handler: setup },
  { method: 'POST', path: '/api/auth/login', handler: login },
  { method: 'POST', path: '/api/auth/forgot', handler: forgotPassword },
];

// ============================================================
// Protected routes
// ============================================================
export const protectedRoutes = [
  { method: 'PATCH', path: '/api/auth/me',       handler: updateMe },
  { method: 'PATCH', path: '/api/auth/password', handler: changePassword },
  { method: 'POST',  path: '/api/auth/users',    handler: createUser, adminOnly: true },
];

// ------------------------------------------------------------
async function setup({ request, env }) {
  if (request.headers.get('x-setup-key') !== env.SETUP_KEY) {
    return fail(env, 'setup key غلط', 403);
  }

  const count = await env.DB.prepare(`SELECT COUNT(*) as c FROM offices`).first();
  if ((count?.c || 0) > 0) return fail(env, 'setup مقفول', 403);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!isValidEmail(b.email)) return fail(env, 'صيغة الإيميل غلط', 400);
  if (!isStr(b.password, 200) || b.password.length < 8) {
    return fail(env, 'كلمة السر لازم 8 حروف على الأقل', 400);
  }

  const trialEnds = new Date(Date.now() + 15 * 86400000).toISOString();
  const off = await env.DB.prepare(
    `INSERT INTO offices (name, name_ar, status, trial_ends_at) VALUES (?,?,?,?)`
  ).bind(b.office_name || 'مكتبي', b.office_name || null, 'trial', trialEnds).run();
  const office_id = off.meta.last_row_id;

  const { hash, salt } = await hashPassword(b.password);
  const u = await env.DB.prepare(
    `INSERT INTO users (office_id, email, password_hash, full_name, role, salt)
     VALUES (?,?,?,?,?,?)`
  ).bind(office_id, b.email, hash, b.full_name || null, 'admin', salt).run();

  await audit(env, {
    office_id, user_id: u.meta.last_row_id,
    action: 'setup', entity: 'office', entity_id: office_id, request,
  });

  return ok(env, { office_id, user_id: u.meta.last_row_id, trial_ends_at: trialEnds }, 201);
}

// ------------------------------------------------------------
async function login({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await checkRateLimit(env, `login:${ip}`, 15, 60))) {
    return fail(env, 'حاول تاني بعد دقيقة', 429);
  }

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const identifier = (b.email || '').trim();
  if (!identifier) return fail(env, 'اكتب الإيميل أو رقم الهاتف', 400);
  if (!isStr(b.password, 200)) return fail(env, 'بيانات الدخول غلط', 401);

  // الرقم ممكن يتكتب بأي شكل (010… / +2010… / 2010…) ويكون اتحفظ بالشكل القديم — بنجرب كل الأشكال
  const variants = phoneVariants(identifier);
  const phones = variants.length ? variants : [identifier];
  const user = await env.DB.prepare(
    `SELECT * FROM users WHERE email = ? OR phone IN (${phones.map(() => '?').join(',')}) ORDER BY (email = ?) DESC LIMIT 1`
  ).bind(identifier, ...phones, identifier).first();

  if (!user || !(await verifyPassword(b.password || '', user.password_hash, user.salt))) {
    await audit(env, { action: 'login_failed', entity: 'user', request, metadata: { identifier } });
    return fail(env, 'بيانات الدخول غلط', 401);
  }
  if (user.active === 0) return fail(env, 'الحساب موقوف', 403);
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return fail(env, 'الحساب مقفول مؤقتًا', 423);
  }

  const office = await env.DB.prepare(
    `SELECT status, trial_ends_at FROM offices WHERE id = ?`
  ).bind(user.office_id).first();
  if (!office) return fail(env, 'المكتب غير موجود', 403);

  await env.DB.prepare(
    `UPDATE users SET last_login_at = datetime('now'), failed_logins = 0 WHERE id = ?`
  ).bind(user.id).run();

  const token = await signJWT(
    { user_id: user.id, office_id: user.office_id, role: user.role, name: user.full_name },
    env.JWT_SECRET
  );

  await audit(env, {
    office_id: user.office_id, user_id: user.id,
    action: 'login', entity: 'user', entity_id: user.id, request,
  });

  return ok(env, {
    token,
    role: user.role,
    office_id: user.office_id,
    name: user.full_name,
    office_status: office.status,
    trial_ends_at: office.trial_ends_at,
  });
}

// ------------------------------------------------------------
async function updateMe({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  if (b.email) {
    if (!isValidEmail(b.email)) return fail(env, 'صيغة الإيميل غلط', 400);
    const existing = await env.DB.prepare(
      `SELECT id FROM users WHERE email = ? AND id != ?`
    ).bind(b.email, authUser.user_id).first();
    if (existing) return fail(env, 'الإيميل ده مستخدم بالفعل', 409);
  }

  await env.DB.prepare(
    `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email)
     WHERE id = ? AND office_id = ?`
  ).bind(b.full_name ?? null, b.email ?? null, authUser.user_id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'user', entity_id: authUser.user_id, request,
  });
  return ok(env, { updated: true });
}

// ------------------------------------------------------------
async function changePassword({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!isStr(b.new_password, 200) || b.new_password.length < 8) {
    return fail(env, 'كلمة السر الجديدة لازم 8 حروف على الأقل', 400);
  }

  const user = await env.DB.prepare(
    `SELECT * FROM users WHERE id = ? AND office_id = ?`
  ).bind(authUser.user_id, officeId).first();

  if (!user || !(await verifyPassword(b.old_password || '', user.password_hash, user.salt))) {
    return fail(env, 'كلمة السر الحالية غلط', 401);
  }

  const { hash, salt } = await hashPassword(b.new_password);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, salt = ? WHERE id = ? AND office_id = ?`
  ).bind(hash, salt, authUser.user_id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'password_change', entity: 'user', entity_id: authUser.user_id, request,
  });
  return ok(env, { updated: true });
}

// ------------------------------------------------------------
async function createUser({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!isValidEmail(b.email)) return fail(env, 'صيغة الإيميل غلط', 400);
  if (!isStr(b.password, 200) || b.password.length < 8) {
    return fail(env, 'كلمة السر لازم 8 حروف على الأقل', 400);
  }

  // ✅ التحقق من الحد الأقصى للمستخدمين
  const currentCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM users WHERE office_id = ?`
  ).bind(officeId).first();

  const adminsCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM users WHERE office_id = ? AND role = 'admin'`
  ).bind(officeId).first();

  const limitFail = await requireLimit(
    env, officeId, 'max_users',
    currentCount?.c || 0,
    { excludeAdmins: adminsCount?.c || 0 }
  );
  if (limitFail) return limitFail;

  const allowedRoles = ['admin', 'lawyer'];
  const role = allowedRoles.includes(b.role) ? b.role : 'lawyer';

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(b.email).first();
  if (existing) return fail(env, 'الإيميل ده مستخدم بالفعل', 409);

  const { hash, salt } = await hashPassword(b.password);
  const r = await env.DB.prepare(
    `INSERT INTO users (office_id, email, password_hash, full_name, role, salt)
     VALUES (?,?,?,?,?,?)`
  ).bind(officeId, b.email, hash, b.full_name || null, role, salt).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'user', entity_id: r.meta.last_row_id, request,
  });
  return ok(env, { id: r.meta.last_row_id }, 201);
}
// ============================================================
// «نسيت كلمة السر»: بيسجّل طلب بيوصل للسوبر أدمن (اللي بيبعت كلمة سر مؤقتة واتساب)
// الرد واحد دايمًا سواء الرقم موجود أو لأ، عشان محدش يعرف مين عنده حساب
// ============================================================
async function forgotPassword({ request, env, ctx }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await checkRateLimit(env, `forgot:${ip}`, 5, 3600))) {
    return fail(env, 'طلبات كتير — حاول تاني بعد شوية أو كلمنا واتساب', 429);
  }
  const b = await safeJson(request);
  const identifier = String(b?.identifier || '').trim().slice(0, 120);
  if (!identifier) return fail(env, 'اكتب رقم الموبايل أو الإيميل', 400);

  const variants = phoneVariants(identifier);
  const phones = variants.length ? variants : [identifier];
  const user = await env.DB.prepare(
    `SELECT u.id, u.office_id, u.full_name, u.phone, u.role, o.name AS office_name, o.name_ar AS office_name_ar
     FROM users u LEFT JOIN offices o ON o.id = u.office_id
     WHERE u.email = ? OR u.phone IN (${phones.map(() => '?').join(',')}) ORDER BY (u.email = ?) DESC LIMIT 1`
  ).bind(identifier, ...phones, identifier).first();

  if (user) {
    // طلب واحد مفتوح لكل مستخدم يكفي
    const open = await env.DB.prepare(
      `SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'pending' LIMIT 1`
    ).bind(user.id).first();
    if (!open) {
      await env.DB.prepare(
        `INSERT INTO password_reset_requests (user_id, office_id, identifier, ip) VALUES (?,?,?,?)`
      ).bind(user.id, user.office_id, identifier, ip).run();
      const office = user.office_name_ar || user.office_name || '';
      const job = alertOwner(env, {
        key: `pwreq:${user.id}`, everySec: 1800,
        title: '🔑 طلب «نسيت كلمة السر»',
        body: `${user.full_name || ''} — ${office} — ${user.phone || identifier}. افتح لوحة السوبر أدمن وابعتله كلمة سر مؤقتة.`,
      }).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(job); else await job;
    }
    await audit(env, { office_id: user.office_id, action: 'password_reset_requested', entity: 'user', entity_id: user.id, request });
  }
  return ok(env, { received: true });
}
