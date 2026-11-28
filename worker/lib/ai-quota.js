// worker/lib/ai-quota.js
// رصيد الذكاء الاصطناعي لكل مكتب:
//   - حد شهري حسب الباقة (AI_MONTHLY_LIMITS) — بيتجدد أول كل شهر (توقيت القاهرة)
//   - حد يومي للحماية (AI_DAILY_LIMIT، افتراضي 150) عشان مكتب واحد ميخلّصش الحصة المجانية على الكل
// العدّ في جدول ai_usage (صف لكل مكتب في اليوم)، وبيزيد بس لما الطلب ينجح.
import { fail } from './response.js';
import { getSubscription } from '../middleware/feature-gate.js';

// عدد طلبات الذكاء الاصطناعي في الشهر لكل باقة (0 = الميزة مش في الباقة)
export const AI_MONTHLY_LIMITS = {
  starter: 0,
  pro: 300,
  plus: 1000,
  lifetime_basic: 0,
  lifetime_pro: 300,
};
// أثناء التجربة المجانية (15 يوم) مهما كانت باقة التجربة
export const AI_TRIAL_LIMIT = 40;

// المسارات اللي بتتحسب من الرصيد (POST بس)
const AI_PATHS = [
  /^\/api\/chat$/,
  /^\/api\/legal-search$/,
  /^\/api\/generate-doc(\/refine)?$/,
  /^\/api\/analyze\/(contract|case|document|judgment|compare)$/,
  /^\/api\/cases\/\d+\/analyze$/,
];
export function isAiRequest(method, path) {
  return method === 'POST' && AI_PATHS.some(r => r.test(path));
}

// تاريخ النهارده بتوقيت القاهرة (YYYY-MM-DD)
export function cairoDay(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return new Date(d.getTime() + 2 * 3600000).toISOString().slice(0, 10);
  }
}

function nextMonthStart(day) {
  const [y, m] = day.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

function arDate(day) {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));
  } catch { return day; }
}

export function monthlyLimitFor(sub) {
  if (!sub) return 0;
  const base = AI_MONTHLY_LIMITS[sub.plan] ?? 0;
  if (sub.status === 'trial') return base > 0 ? Math.min(base, AI_TRIAL_LIMIT) : 0;
  return base;
}

// حالة الرصيد للمكتب (للعدّاد وللتحقق)
export async function getAiUsage(env, officeId, sub = undefined) {
  if (sub === undefined) sub = await getSubscription(env, officeId);
  const day = cairoDay();
  const month = day.slice(0, 7);
  const monthly = monthlyLimitFor(sub);
  const daily = Number(env.AI_DAILY_LIMIT || 150);
  let usedMonth = 0, usedToday = 0;
  try {
    const r = await env.DB.prepare(
      `SELECT COALESCE(SUM(used), 0) AS month_used,
              COALESCE(SUM(CASE WHEN day = ? THEN used END), 0) AS today_used
       FROM ai_usage WHERE office_id = ? AND day >= ? AND day < ?`
    ).bind(day, officeId, `${month}-01`, nextMonthStart(day)).first();
    usedMonth = r?.month_used || 0;
    usedToday = r?.today_used || 0;
  } catch (e) {
    console.warn('ai usage read failed:', e.message);
  }
  return {
    plan: sub?.plan || null,
    trial: sub?.status === 'trial',
    monthly_limit: monthly,
    used_month: usedMonth,
    remaining: Math.max(0, monthly - usedMonth),
    daily_limit: daily,
    used_today: usedToday,
    resets_at: nextMonthStart(day),
  };
}

// قبل الطلب: لو الرصيد خلص بنرجّع 429 برسالة واضحة. (لو الباقة مفيهاش الذكاء الاصطناعي أصلاً، بوابة الميزة جوه الـ route هي اللي بترد)
export async function checkAiQuota(env, officeId) {
  try {
    const sub = await getSubscription(env, officeId);
    const u = await getAiUsage(env, officeId, sub);
    if (u.monthly_limit <= 0) return null; // بوابة الميزة هترد بـ "محتاجة ترقية"
    if (u.used_month >= u.monthly_limit) {
      return fail(env,
        u.trial
          ? `خلص رصيد الذكاء الاصطناعي في الفترة التجريبية (${u.monthly_limit} طلب). اشترك عشان يزيد.`
          : `خلص رصيد الذكاء الاصطناعي للشهر ده (${u.monthly_limit} طلب). بيتجدد يوم ${arDate(u.resets_at)}.`,
        429, { code: 'AI_MONTHLY_LIMIT', ...u });
    }
    if (u.daily_limit > 0 && u.used_today >= u.daily_limit) {
      return fail(env, `وصلت للحد اليومي لطلبات الذكاء الاصطناعي (${u.daily_limit}). جرب بكرة.`,
        429, { code: 'AI_DAILY_LIMIT', ...u });
    }
  } catch (e) {
    console.warn('ai quota check failed:', e.message);
  }
  return null;
}

// بعد الطلب الناجح: +1
export async function recordAiUse(env, officeId) {
  try {
    await env.DB.prepare(
      `INSERT INTO ai_usage (office_id, day, used) VALUES (?, ?, 1)
       ON CONFLICT(office_id, day) DO UPDATE SET used = used + 1`
    ).bind(officeId, cairoDay()).run();
  } catch (e) {
    console.warn('ai usage record failed:', e.message);
  }
}
