// worker/middleware/feature-gate.js
// بوابة الميزات + الحدود — بتتحقق من الباقة قبل ما تسمح بالوصول

import { fail } from '../lib/response.js';

const FEATURES = {
  free: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: false, invoices: false, ai: false,
    advanced_reports: false, whatsapp: false,
    multi_office: false, api: false,
  },
  starter: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, ai: false,
    advanced_reports: false, whatsapp: false,
    multi_office: false, api: false,
  },
  pro: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, ai: true,
    advanced_reports: true, whatsapp: true,
    multi_office: false, api: false,
  },
  plus: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, ai: true,
    advanced_reports: true, whatsapp: true,
    multi_office: true, api: true,
  },
};

const LIMITS = {
  free:    { max_users: 1,  max_cases: 10, max_clients: 20,  max_storage_mb: 100 },
  starter: { max_users: 3,  max_cases: 50, max_clients: 100, max_storage_mb: 1024 },
  pro:     { max_users: 10, max_cases: -1, max_clients: -1,  max_storage_mb: 10240 },
  plus:    { max_users: -1, max_cases: -1, max_clients: -1,  max_storage_mb: 51200 },
};

const PLAN_NAMES = {
  free: 'المجانية',
  starter: 'الأساسية',
  pro: 'الاحترافية',
  plus: 'المتقدمة',
};

const LIMIT_LABELS = {
  max_users: 'المستخدمين',
  max_cases: 'القضايا',
  max_clients: 'الموكلين',
  max_storage_mb: 'التخزين',
};

// ============================================================
// Subscription
// ============================================================
export async function getSubscription(env, officeId) {
  const sub = await env.DB.prepare(
    `SELECT * FROM subscriptions WHERE office_id = ?`
  ).bind(officeId).first();
  return sub || null;
}

// ============================================================
// Features
// ============================================================
export async function checkFeature(env, officeId, feature) {
  const sub = await getSubscription(env, officeId);
  if (!sub) return false;

  if (sub.status === 'trial' && sub.trial_ends_at) {
    if (new Date(sub.trial_ends_at) < new Date()) {
      return false;
    }
  }

  if (sub.status === 'expired' || sub.status === 'cancelled') {
    return false;
  }

  const planFeatures = FEATURES[sub.plan] || FEATURES.free;
  return planFeatures[feature] === true;
}

export async function requireFeature(env, officeId, feature) {
  const allowed = await checkFeature(env, officeId, feature);
  if (allowed) return null;

  const requiredPlan = getRequiredPlan(feature);

  return fail(env,
    `🔒 الميزة دي متاحة في الباقة ${PLAN_NAMES[requiredPlan]}`,
    403,
    {
      code: 'UPGRADE_REQUIRED',
      feature,
      required_plan: requiredPlan,
    }
  );
}

function getRequiredPlan(feature) {
  const order = ['free', 'starter', 'pro', 'plus'];
  for (const plan of order) {
    if (FEATURES[plan][feature]) return plan;
  }
  return 'plus';
}

// ============================================================
// Limits
// ============================================================

/**
 * ✅ التحقق من الحد
 * - بيرجع `true` لو مسموح
 * - بيرجع `false` لو وصل الحد
 * - المسؤول (admin) مستثنى من حد المستخدمين
 */
export async function checkLimit(env, officeId, limitType, currentCount, opts = {}) {
  const sub = await getSubscription(env, officeId);
  if (!sub) return false;

  // ✅ لو الاشتراك موقوف / ملغي / منتهي
  if (sub.status === 'expired' || sub.status === 'cancelled') {
    return false;
  }

  const planLimits = LIMITS[sub.plan] || LIMITS.free;
  const max = planLimits[limitType];

  // -1 = غير محدود
  if (max === -1) return true;

  // ✅ استثناء المسؤول من حد المستخدمين
  let adjusted = currentCount;
  if (limitType === 'max_users' && opts.excludeAdmins) {
    adjusted = Math.max(0, currentCount - (opts.excludeAdmins || 0));
  }

  return adjusted < max;
}

/**
 * ✅ التحقق من الحد مع رسالة فشل جاهزة
 * بيرجع `null` لو مسموح، أو `Response` لو وصل الحد
 */
export async function requireLimit(env, officeId, limitType, currentCount, opts = {}) {
  const allowed = await checkLimit(env, officeId, limitType, currentCount, opts);
  if (allowed) return null;

  const sub = await getSubscription(env, officeId);
  const planLimits = LIMITS[sub?.plan || 'free'] || LIMITS.free;
  const max = planLimits[limitType];
  const label = LIMIT_LABELS[limitType] || limitType;

  return fail(env,
    `⛔ وصلت للحد الأقصى — ${label} (${currentCount}/${max})`,
    403,
    {
      code: 'LIMIT_REACHED',
      limit_type: limitType,
      current: currentCount,
      max,
      plan: sub?.plan || 'free',
      upgrade_url: '/pricing',
    }
  );
}

/**
 * ✅ حساب الاستخدام الحالي
 */
export async function getUsage(env, officeId) {
  const [users, cases, clients, storage] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE office_id = ?`)
      .bind(officeId).first().catch(() => ({ c: 0 })),
    env.DB.prepare(`SELECT COUNT(*) as c FROM cases WHERE office_id = ? AND deleted_at IS NULL`)
      .bind(officeId).first().catch(() => ({ c: 0 })),
    env.DB.prepare(`SELECT COUNT(*) as c FROM clients WHERE office_id = ? AND deleted_at IS NULL`)
      .bind(officeId).first().catch(() => ({ c: 0 })),
    env.DB.prepare(`SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE office_id = ? AND deleted_at IS NULL`)
      .bind(officeId).first().catch(() => ({ total: 0 })),
  ]);

  const storageBytes = storage?.total || 0;
  const storageMb = Math.ceil(storageBytes / (1024 * 1024));

  return {
    users: users?.c || 0,
    cases: cases?.c || 0,
    clients: clients?.c || 0,
    storage_mb: storageMb,
  };
}

/**
 * ✅ تفاصيل الاستخدام (مع الحدود والنسب)
 */
export async function getUsageDetails(env, officeId) {
  const sub = await getSubscription(env, officeId);
  if (!sub) return null;

  const planLimits = LIMITS[sub.plan] || LIMITS.free;
  const usage = await getUsage(env, officeId);

  const items = [
    { key: 'users',   icon: '👥', label: 'المستخدمون',   used: usage.users,      limit: planLimits.max_users },
    { key: 'cases',   icon: '⚖️', label: 'القضايا',      used: usage.cases,      limit: planLimits.max_cases },
    { key: 'clients', icon: '👤', label: 'الموكلون',    used: usage.clients,    limit: planLimits.max_clients },
    { key: 'storage', icon: '💾', label: 'التخزين',      used: usage.storage_mb, limit: planLimits.max_storage_mb },
  ].map(it => {
    const isUnlimited = it.limit === -1;
    const pct = isUnlimited ? 0 : Math.min(100, Math.round((it.used / it.limit) * 100));
    return {
      ...it,
      is_unlimited: isUnlimited,
      percentage: pct,
      is_warning: !isUnlimited && pct >= 80 && pct < 100,
      is_reached: !isUnlimited && it.used >= it.limit,
      display_limit: isUnlimited ? '∞' : it.limit,
    };
  });

  return {
    plan: sub.plan,
    plan_name: PLAN_NAMES[sub.plan] || sub.plan,
    status: sub.status,
    items,
  };
}

// ============================================================
// Helpers
// ============================================================
export function getLimits(plan) {
  return LIMITS[plan] || LIMITS.free;
}

export function getFeatures(plan) {
  return FEATURES[plan] || FEATURES.free;
}

export function getPlanName(plan) {
  return PLAN_NAMES[plan] || plan;
}

export { LIMITS, FEATURES, PLAN_NAMES };