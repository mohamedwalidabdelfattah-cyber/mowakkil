// worker/routes/subscription.js
// API الاشتراكات

import { ok, fail } from '../lib/response.js';
import { safeJson } from '../lib/validation.js';
import {
  getSubscription,
  getFeatures,
  effectiveLimits,
  getUsage,
  getUsageDetails,
} from '../middleware/feature-gate.js';

export const publicRoutes = [
  { method: 'GET', path: '/api/subscription/plans', handler: getPlans },
];

export const routes = [
  { method: 'GET',  path: '/api/subscription/me',     handler: getMySubscription },
  { method: 'GET',  path: '/api/subscription/usage',  handler: getUsageEndpoint },
  { method: 'POST', path: '/api/subscription/change',  handler: changePlan, adminOnly: true },
];

async function getPlans({ env }) {
  // ✅ تم إضافة billing_type هنا
  const { results } = await env.DB.prepare(
    `SELECT plan, display_name, display_name_en, price_egp, features, limits, sort_order, billing_type
     FROM plan_features WHERE is_active = 1 ORDER BY sort_order`
  ).all();

  return ok(env, (results || []).map(p => ({
    plan: p.plan,
    display_name: p.display_name,
    display_name_en: p.display_name_en,
    price_egp: p.price_egp,
    features: JSON.parse(p.features || '{}'),
    limits: JSON.parse(p.limits || '{}'),
    billing_type: p.billing_type || 'monthly', // ✅ الحقل الجديد
  })));
}

async function getMySubscription({ env, officeId }) {
  const sub = await getSubscription(env, officeId);
  if (!sub) {
    return fail(env, 'مفيش اشتراك — تواصل مع الدعم', 404);
  }

  const features = getFeatures(sub.plan);
  const limits = effectiveLimits(sub);

  let daysRemaining = null;
  const targetDate = sub.status === 'trial' ? sub.trial_ends_at : sub.expires_at;
  if (targetDate) {
    daysRemaining = Math.max(0, Math.ceil(
      (new Date(targetDate) - new Date()) / 86400000
    ));
  }

  const usage = await getUsage(env, officeId);

  return ok(env, {
    plan: sub.plan,
    status: sub.status,
    started_at: sub.started_at,
    trial_ends_at: sub.trial_ends_at,
    expires_at: sub.expires_at,
    days_remaining: daysRemaining,
    features,
    limits,
    usage,
  });
}

async function getUsageEndpoint({ env, officeId }) {
  const details = await getUsageDetails(env, officeId);
  if (!details) {
    return fail(env, 'مفيش اشتراك', 404);
  }
  return ok(env, details);
}

async function changePlan({ request, env, officeId, authUser }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const newPlan = b.plan;
  // ✅ تم إضافة الباقات الجديدة هنا
  const validPlans = ['starter', 'pro', 'plus', 'lifetime_basic', 'lifetime_pro'];
  if (!validPlans.includes(newPlan)) {
    return fail(env, 'الباقة غلط', 400);
  }

  // ✅ تم إضافة الباقات الجديدة هنا
  const paidPlans = ['starter', 'pro', 'plus', 'lifetime_basic', 'lifetime_pro'];
  if (paidPlans.includes(newPlan)) {
    return fail(env, 'للترقية، اذهب لصفحة الدفع', 403, {
      code: 'PAYMENT_REQUIRED',
      redirect: '/pay',
      plan: newPlan,
    });
  }

  const sub = await getSubscription(env, officeId);
  if (!sub) return fail(env, 'مفيش اشتراك', 404);

  await env.DB.prepare(
    `UPDATE subscriptions
     SET plan = 'free', status = 'active',
         updated_at = datetime('now')
     WHERE office_id = ?`
  ).bind(officeId).run();

  await env.DB.prepare(
    `INSERT INTO subscription_history
      (office_id, old_plan, new_plan, old_status, new_status, changed_by, reason)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(
    officeId, sub.plan, 'free', sub.status, 'active',
    authUser.user_id, b.reason || 'إلغاء الاشتراك'
  ).run();

  return ok(env, { plan: 'free', status: 'active' });
}