// worker/lib/ai-quota.js
// حد يومي لطلبات الذكاء الاصطناعي لكل مكتب — عشان مكتب واحد ميخلّصش الحصة المجانية على الكل.
// بنعدّ من D1 (رسايل الشات + التحليلات النهارده) بدل KV، عشان كتابات KV المجانية محدودة.
import { fail } from './response.js';

export async function checkAiQuota(env, officeId) {
  const limit = Number(env.AI_DAILY_LIMIT || 150);
  if (limit <= 0) return null;
  try {
    const r = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
           WHERE s.office_id = ? AND m.role = 'user' AND m.created_at >= date('now')) +
         (SELECT COUNT(*) FROM analyses WHERE office_id = ? AND created_at >= date('now')) AS used`
    ).bind(officeId, officeId).first();
    const used = r?.used || 0;
    if (used >= limit) {
      return fail(env, `وصلت للحد اليومي لطلبات الذكاء الاصطناعي (${limit}). جرب بكرة.`, 429, {
        code: 'AI_DAILY_LIMIT', limit, used,
      });
    }
  } catch (e) {
    console.warn('ai quota check failed:', e.message);
  }
  return null;
}
