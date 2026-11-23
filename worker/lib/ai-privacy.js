// worker/lib/ai-privacy.js
// إعداد "خصوصية الذكاء الاصطناعي" لكل مكتب + موافقة مسؤول المكتب قبل أول استخدام على بيانات موكلين.
//
// الأوضاع:
//   strict   🔒 سري      — مستندات وبيانات الموكلين بتروح لـ Cloudflare Workers AI بس
//                          (Cloudflare مش بيدرّب نماذجه على بيانات العملاء). الحصة المجانية اليومية محدودة.
//   balanced ⚖️ متوازن   — البيانات الشخصية بتتخفي (أسماء/رقم قومي/تليفون/إيميل) وبعدين
//                          بتروح لأفضل نموذج متاح (Gemini المجاني...). OpenRouter مستبعد دايماً لبيانات الموكلين.
//   off      ⛔ موقوف     — مفيش أي معالجة AI لبيانات الموكلين (البحث القانوني العام بس شغال).
import { fail } from './response.js';

export const AI_PRIVACY_MODES = ['strict', 'balanced', 'off'];
const DEFAULT_MODE = 'balanced';
const cache = new Map(); // officeId → { exp, value }

export async function getAiPrivacy(env, officeId) {
  const hit = cache.get(officeId);
  if (hit && hit.exp > Date.now()) return hit.value;
  let value = { mode: DEFAULT_MODE, accepted: false, accepted_at: null };
  try {
    const row = await env.DB.prepare(
      `SELECT ai_privacy, ai_privacy_accepted_at FROM office_settings WHERE office_id = ?`
    ).bind(officeId).first();
    if (row) {
      value = {
        mode: AI_PRIVACY_MODES.includes(row.ai_privacy) ? row.ai_privacy : DEFAULT_MODE,
        accepted: !!row.ai_privacy_accepted_at,
        accepted_at: row.ai_privacy_accepted_at || null,
      };
    }
  } catch (e) {
    // العمود لسه مش موجود (migration 027 ما اتطبقتش) → نشتغل بالوضع المتوازن من غير ما نوقف حاجة
    console.warn('ai privacy read failed:', e.message);
    value = { mode: DEFAULT_MODE, accepted: true, accepted_at: null, legacy: true };
  }
  cache.set(officeId, { exp: Date.now() + 30_000, value });
  return value;
}

export function clearAiPrivacyCache(officeId) { cache.delete(officeId); }

/**
 * قبل أي معالجة AI لبيانات موكلين.
 * @returns {{ block: Response|null, mode: string }}
 */
export async function requireClientDataAi(env, officeId) {
  const p = await getAiPrivacy(env, officeId);
  if (p.mode === 'off') {
    return { mode: 'off', block: fail(env,
      'معالجة الذكاء الاصطناعي لبيانات الموكلين موقوفة في إعدادات المكتب (الإعدادات ← خصوصية الذكاء الاصطناعي).',
      403, { code: 'AI_CLIENT_DATA_OFF' }) };
  }
  if (!p.accepted) {
    return { mode: p.mode, block: fail(env,
      'قبل أول استخدام للذكاء الاصطناعي على بيانات الموكلين، لازم مسؤول المكتب يختار مستوى الخصوصية ويوافق.',
      412, { code: 'AI_CONSENT_REQUIRED', mode: p.mode }) };
  }
  return { mode: p.mode, block: null };
}

/** خيار التوجيه اللي بيتبعت لـ chatCompletion */
export function routeFor(mode) {
  return mode === 'strict' ? 'strict' : 'balanced';
}
