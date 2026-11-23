import { fail } from '../lib/response.js';

// كاش قصير داخل الـ isolate (20 ثانية) — بيوفّر استعلام offices في كل طلب
const OFFICE_CACHE = new Map();

export async function checkSubscription(env, officeId) {
  const hit = OFFICE_CACHE.get(officeId);
  let office;
  if (hit && hit.exp > Date.now()) {
    office = hit.office;
  } else {
    office = await env.DB.prepare(
      `SELECT status, trial_ends_at FROM offices WHERE id = ?`
    ).bind(officeId).first();
    if (OFFICE_CACHE.size > 500) OFFICE_CACHE.clear();
    OFFICE_CACHE.set(officeId, { office, exp: Date.now() + 20_000 });
  }

  if (!office) return fail(env, '\u0627\u0644\u0645\u0643\u062a\u0628 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f', 403);
  if (office.status === 'suspended') {
    return fail(env, '\u0627\u0644\u062d\u0633\u0627\u0628 \u0645\u0648\u0642\u0648\u0641\u060c \u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062f\u0639\u0645', 402);
  }
  if (office.status === 'trial') {
    if (!office.trial_ends_at || new Date(office.trial_ends_at) < new Date()) {
      return fail(
        env,
        '\u0627\u0646\u062a\u0647\u062a \u0641\u062a\u0631\u0629 \u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0627\u0646\u064a\u0629 (15 \u064a\u0648\u0645) \u2014 \u0641\u0639\u0651\u0644 \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629',
        402,
        { trial_expired: true }
      );
    }
  }
  return null;
}
