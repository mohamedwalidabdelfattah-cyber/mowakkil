// worker/routes/signup.js
// التسجيل الذاتي — إنشاء مكتب جديد
// ملاحظة: الإيميل اختياري، رقم الهاتف إلزامي

import { ok, fail } from '../lib/response.js';
import { normalizeAttribution } from '../lib/attribution.js';
import { normalizeCountry, countryProfile } from '../lib/country.js';
import { hashPassword } from '../lib/crypto.js';
import { signJWT } from '../lib/jwt.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { audit } from '../lib/audit.js';
import { normalizeStoredPhone, phoneVariants } from '../lib/phone.js';
import { isValidEmail, isStr, safeJson } from '../lib/validation.js';
import { initializeChartOfAccounts } from '../services/chart-of-accounts.js';

export const publicRoutes = [
  { method: 'POST', path: '/api/signup', handler: signup },
  { method: 'GET', path: '/api/geo', handler: geo },
];

// دولة الزائر من اتصاله (Cloudflare) — علامة من علامات اختيار أسعار الباقات (مصر/السعودية)
async function geo({ env, request }) {
  return ok(env, { country: request.cf?.country || null }, 200, request);
}

// ============================================================
// Regex للأرقام المصرية
// ============================================================
function isValidPhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  // 10-15 رقم
  return digits.length >= 10 && digits.length <= 15;
}

// صيغة الحفظ الموحّدة (مصري 01… / دولي +…) — worker/lib/phone.js
const normalizePhone = normalizeStoredPhone;

// ============================================================
// Signup
// ============================================================
async function signup({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await checkRateLimit(env, `signup:${ip}`, 5, 60))) {
    return fail(env, 'حاول تاني بعد دقيقة', 429);
  }

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  // 1) التحقق من الحقول
  const officeName = (b.office_name || '').trim();
  const fullName = (b.full_name || '').trim();
  const phoneRaw = (b.phone || '').trim();
  const email = (b.email || '').trim() || null;
  const password = b.password || '';

  if (!isStr(officeName, 200)) return fail(env, 'اكتب اسم المكتب', 400);
  if (!isStr(fullName, 200)) return fail(env, 'اكتب اسمك', 400);
  if (!isValidPhone(phoneRaw)) return fail(env, 'رقم الهاتف غلط', 400);
  if (!isStr(password, 200) || password.length < 8) {
    return fail(env, 'كلمة المرور لازم 8 حروف على الأقل', 400);
  }
  if (email && !isValidEmail(email)) {
    return fail(env, 'صيغة الإيميل غلط', 400);
  }

  // دولة المكتب (مصر / السعودية) — بتحدد العملة والضريبة والتوقيت وصيغة الموبايل
  const country = normalizeCountry(b.country);
  const cp = countryProfile(country);
  const phone = normalizePhone(phoneRaw, country);

  // 2) نتأكد إن مفيش مستخدم بنفس الرقم
  const variants = phoneVariants(phoneRaw);
  const phoneExists = await env.DB.prepare(
    `SELECT id FROM users WHERE phone IN (${variants.map(() => '?').join(',')})`
  ).bind(...variants).first();
  if (phoneExists) {
    return fail(env, 'الرقم ده مستخدم بالفعل — سجّل دخول', 409);
  }

  // 3) نتأكد إن مفيش مستخدم بنفس الإيميل (لو اتحدد)
  if (email) {
    const emailExists = await env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`
    ).bind(email).first();
    if (emailExists) {
      return fail(env, 'الإيميل ده مستخدم بالفعل — سجّل دخول', 409);
    }
  }

  // 4) نعمل المكتب (ومعاه مصدر التسجيل: إعلان فيسبوك/إنستجرام…)
  const attr = normalizeAttribution(b.attribution);
  const trialEnds = new Date(Date.now() + 15 * 86400000).toISOString();
  const officeResult = await env.DB.prepare(
    `INSERT INTO offices (name, name_ar, status, trial_ends_at, timezone,
       signup_source, signup_medium, signup_campaign, signup_content, signup_referrer, signup_landing)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(officeName, officeName, 'trial', trialEnds, cp.timezone,
    attr.source, attr.medium, attr.campaign, attr.content, attr.referrer, attr.landing).run();
  const officeId = officeResult.meta.last_row_id;

  // إعدادات المكتب حسب الدولة (العملة والضريبة)
  await env.DB.prepare(
    `INSERT INTO office_settings (office_id, country, currency, vat_rate) VALUES (?, ?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET country = excluded.country, currency = excluded.currency, vat_rate = excluded.vat_rate`
  ).bind(officeId, country, cp.currency, cp.vat).run();

  // 5) نعمل المستخدم (admin)
  const { hash, salt } = await hashPassword(password);
  const userResult = await env.DB.prepare(
    `INSERT INTO users (office_id, email, phone, password_hash, full_name, role, salt)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(officeId, email, phone, hash, fullName, 'admin', salt).run();
  const userId = userResult.meta.last_row_id;

  // 6) نعمل الاشتراك — Pro trial لمدة 15 يوم
  await env.DB.prepare(
    `INSERT INTO subscriptions (office_id, plan, status, trial_ends_at)
     VALUES (?, 'pro', 'trial', ?)`
  ).bind(officeId, trialEnds).run();

  // 7) نعمل دليل الحسابات تلقائيًا
  try {
    await initializeChartOfAccounts(env, officeId);
  } catch (e) {
    console.error('chart of accounts init failed:', e.message);
    // مش مشكلة كبيرة — نقدر نعملها لاحقًا
  }

  // 8) نسجّل في الـ audit
  try {
    await audit(env, {
      office_id: officeId, user_id: userId,
      action: 'signup', entity: 'office', entity_id: officeId, request,
      metadata: { office_name: officeName, phone, source: attr.source, campaign: attr.campaign },
    });
  } catch (e) {
    console.error('audit failed:', e.message);
  }

  // 9) نعمل JWT token
  const token = await signJWT({
    user_id: userId,
    office_id: officeId,
    role: 'admin',
    name: fullName,
  }, env.JWT_SECRET);

  return ok(env, {
    token,
    user_id: userId,
    office_id: officeId,
    role: 'admin',
    name: fullName,
    office_name: officeName,
    trial_ends_at: trialEnds,
    country, currency: cp.currency, vat_rate: cp.vat,
  }, 201);
}