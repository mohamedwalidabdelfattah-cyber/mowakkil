// worker/middleware/feature-gate.js
// بوابة الميزات + الحدود — بتتحقق من الباقة قبل ما تسمح بالوصول

import { fail } from '../lib/response.js';

const FEATURES = {
  starter: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, accounting: false, finance_advanced: false, ai: false,
    advanced_reports: false, whatsapp: false,
    multi_office: false, api: false,
  },
  pro: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, accounting: true, finance_advanced: false, ai: true,
    advanced_reports: true, whatsapp: true,
    multi_office: false, api: false,
  },
  plus: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, accounting: true, finance_advanced: true, ai: true,
    advanced_reports: true, whatsapp: true,
    multi_office: true, api: true,
  },
  // ✅ باقات مدى الحياة
  // الأتعاب والتحصيل والمصروفات والوضع المبسط وكشف الحساب (من غير فواتير ولا محاسبة كاملة)
  lifetime_basic: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: false, accounting: false, finance_advanced: false, ai: false,
    advanced_reports: false, whatsapp: false,
    multi_office: false, api: false,
  },
  lifetime_pro: {
    cases: true, clients: true, agenda: true, portal: true,
    finance: true, invoices: true, accounting: true, finance_advanced: true, ai: true,
    advanced_reports: true, whatsapp: true,
    multi_office: false, api: true,
  },
};

const LIMITS = {
  starter: { max_users: 3,  max_cases: 50, max_clients: 100, max_storage_mb: 500 },
  pro:     { max_users: 10, max_cases: -1, max_clients: -1,  max_storage_mb: 2000 },
  plus:    { max_users: -1, max_cases: -1, max_clients: -1,  max_storage_mb: 5000 },
  // ✅ باقات مدى الحياة
  lifetime_basic: { max_users: 3,  max_cases: -1, max_clients: -1, max_storage_mb: 500 },
  lifetime_pro:   { max_users: 10, max_cases: -1, max_clients: -1, max_storage_mb: 2000 },
};

// باقة احتياطية داخلية (مش معروضة للعملاء) لأي اشتراك قديم باسم باقة غير معروف
const FALLBACK_FEATURES = {
  cases: true, clients: true, agenda: true, portal: true,
  finance: false, invoices: false, accounting: false, finance_advanced: false, ai: false,
  advanced_reports: false, whatsapp: false,
  multi_office: false, api: false,
};
const FALLBACK_LIMITS = { max_users: 1, max_cases: 10, max_clients: 20, max_storage_mb: 100 };

// سقف التخزين أثناء التجربة المجانية (15 يوم) مهما كانت باقة التجربة
export const TRIAL_STORAGE_MB = 200;
// سقف تخزين المنصة كلها (ميجا). غيّره لما تشتري مساحة أكتر على Backblaze
export const PLATFORM_STORAGE_CAP_MB = 9500;

const PLAN_NAMES = {
  starter: 'الأساسية',
  pro: 'الاحترافية',
  plus: 'المتقدمة',
  // ✅ باقات مدى الحياة
  lifetime_basic: 'التأسيس (مدى الحياة)',
  lifetime_pro: 'المكتب المتكامل (مدى الحياة)',
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

  const planFeatures = FEATURES[sub.plan] || FALLBACK_FEATURES;
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
  const order = ['starter', 'pro', 'plus'];
  for (const plan of order) {
    if (FEATURES[plan][feature]) return plan;
  }
  return 'plus';
}

// ============================================================
// Limits
// ============================================================
export async function checkLimit(env, officeId, limitType, currentCount, opts = {}) {
  const sub = await getSubscription(env, officeId);
  if (!sub) return false;

  if (sub.status === 'expired' || sub.status === 'cancelled') {
    return false;
  }

  const planLimits = LIMITS[sub.plan] || FALLBACK_LIMITS;
  const max = planLimits[limitType];

  if (max === -1) return true;

  let adjusted = currentCount;
  if (limitType === 'max_users' && opts.excludeAdmins) {
    adjusted = Math.max(0, currentCount - (opts.excludeAdmins || 0));
  }

  return adjusted < max;
}

export async function requireLimit(env, officeId, limitType, currentCount, opts = {}) {
  const allowed = await checkLimit(env, officeId, limitType, currentCount, opts);
  if (allowed) return null;

  const sub = await getSubscription(env, officeId);
  const planLimits = LIMITS[sub?.plan] || FALLBACK_LIMITS;
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
      plan: sub?.plan || 'none',
      upgrade_url: '/pricing',
    }
  );
}

// الحدود الفعلية للمكتب: أثناء التجربة المساحة محدودة بـ TRIAL_STORAGE_MB
export function effectiveLimits(sub) {
  const base = LIMITS[sub?.plan] || FALLBACK_LIMITS;
  if (sub?.status === 'trial') {
    const cap = base.max_storage_mb === -1
      ? TRIAL_STORAGE_MB
      : Math.min(base.max_storage_mb, TRIAL_STORAGE_MB);
    return { ...base, max_storage_mb: cap };
  }
  return base;
}

// حد المساحة: (1) سقف المنصة كلها، (2) حد باقة المكتب. الحساب بالبايت.
export async function requireStorage(env, officeId, incomingBytes) {
  const sub = await getSubscription(env, officeId);
  const maxMb = effectiveLimits(sub).max_storage_mb;

  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(file_size), 0) AS platform_total,
            COALESCE(SUM(CASE WHEN office_id = ? THEN file_size ELSE 0 END), 0) AS office_total
     FROM documents WHERE deleted_at IS NULL AND r2_key NOT LIKE 'device:%'`
  ).bind(officeId).first();

  const platformCapMb = Number(env.PLATFORM_STORAGE_CAP_MB) || PLATFORM_STORAGE_CAP_MB;
  if ((row?.platform_total || 0) + incomingBytes > platformCapMb * 1024 * 1024) {
    return fail(env,
      'التخزين غير متاح مؤقتاً — تواصل مع الدعم',
      503,
      { code: 'PLATFORM_STORAGE_FULL' }
    );
  }

  if (maxMb === -1) return null;

  const usedBytes = row?.office_total || 0;
  if (usedBytes + incomingBytes <= maxMb * 1024 * 1024) return null;

  const usedMb = Math.ceil(usedBytes / (1024 * 1024));
  return fail(env,
    `⛔ المساحة مش كفاية — التخزين (${usedMb}/${maxMb} ميجا)`,
    403,
    {
      code: 'LIMIT_REACHED',
      limit_type: 'max_storage_mb',
      current: usedMb,
      max: maxMb,
      plan: sub?.plan || 'none',
      upgrade_url: '/pricing',
    }
  );
}

export async function getUsage(env, officeId) {
  const [users, cases, clients, storage] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE office_id = ?`)
      .bind(officeId).first().catch(() => ({ c: 0 })),
    env.DB.prepare(`SELECT COUNT(*) as c FROM cases WHERE office_id = ? AND deleted_at IS NULL`)
      .bind(officeId).first().catch(() => ({ c: 0 })),
    env.DB.prepare(`SELECT COUNT(*) as c FROM clients WHERE office_id = ? AND deleted_at IS NULL`)
      .bind(officeId).first().catch(() => ({ c: 0 })),
    env.DB.prepare(`SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE office_id = ? AND deleted_at IS NULL AND r2_key NOT LIKE 'device:%'`)
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

export async function getUsageDetails(env, officeId) {
  const sub = await getSubscription(env, officeId);
  if (!sub) return null;

  const planLimits = effectiveLimits(sub);
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
  return LIMITS[plan] || FALLBACK_LIMITS;
}

export function getFeatures(plan) {
  return FEATURES[plan] || FALLBACK_FEATURES;
}

export function getPlanName(plan) {
  return PLAN_NAMES[plan] || plan;
}

export { LIMITS, FEATURES, PLAN_NAMES };