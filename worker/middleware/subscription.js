import { fail } from '../lib/response.js';

export async function checkSubscription(env, officeId) {
  const office = await env.DB.prepare(
    `SELECT status, trial_ends_at FROM offices WHERE id = ?`
  ).bind(officeId).first();

  if (!office) return fail(env, 'المكتب غير موجود', 403);
  if (office.status === 'suspended') {
    return fail(env, 'الحساب موقوف، تواصل مع الدعم', 402);
  }
  if (office.status === 'trial') {
    if (!office.trial_ends_at || new Date(office.trial_ends_at) < new Date()) {
      return fail(
        env,
        'انتهت فترة التجربة المجانية (15 يوم) — فعّل الاشتراك للمتابعة',
        402,
        { trial_expired: true }
      );
    }
  }
  return null;
}