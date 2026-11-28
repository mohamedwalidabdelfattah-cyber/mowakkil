// worker/routes/tools.js
import { ok, fail } from '../lib/response.js';
import { calcFee } from '../services/fee-calc.js';
import { legalSearch, generateDocument, refineDocument } from '../services/legal-search.js';
import { requireClientDataAi, routeFor } from '../lib/ai-privacy.js';
import { isStr, safeJson } from '../lib/validation.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { getAiUsage } from '../lib/ai-quota.js';
import { officeCountry } from '../lib/country.js';

export const routes = [
  { method: 'POST', path: '/api/fee-calc',         handler: feeCalc },
  { method: 'GET',  path: '/api/ai/usage',         handler: aiUsage },
  { method: 'POST', path: '/api/legal-search',     handler: search },
  { method: 'POST', path: '/api/generate-doc',     handler: generateDoc },
  { method: 'POST', path: '/api/generate-doc/refine', handler: refineDoc },
];

// تعديل مسودة: صياغة أقوى / اختصار / رسمي / إضافة بند / تعديل حر
async function refineDoc({ request, env, officeId }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return gate;
  const b = await safeJson(request);
  if (!b || !isStr(b.text, 12000)) return fail(env, 'المستند مش موجود', 400);
  if (['clause', 'custom'].includes(b.action) && !String(b.instruction || '').trim()) return fail(env, 'اكتب المطلوب', 400);
  // نص المستند فيه بيانات موكلين → نفس قواعد خصوصية التوليد
  const privacy = await requireClientDataAi(env, officeId);
  if (privacy.block) return privacy.block;
  const r = await refineDocument(env, {
    text: b.text, action: String(b.action || 'custom'), instruction: b.instruction || '',
    route: routeFor(privacy.mode), country: await officeCountry(env, officeId),
  });
  if (r.error) return fail(env, r.error, 400);
  return ok(env, r);
}

// رصيد الذكاء الاصطناعي للمكتب (للعدّاد في الواجهة)
async function aiUsage({ env, officeId }) {
  return ok(env, await getAiUsage(env, officeId));
}

async function feeCalc({ request, env }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  return ok(env, calcFee(b));
}

async function search({ request, env, officeId }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b || !isStr(b.query, 500) || b.query.length < 3) {
    return fail(env, 'اكتب سؤال أوضح', 400);
  }
  return ok(env, await legalSearch(env, b.query, { country: await officeCountry(env, officeId) }));
}

async function generateDoc({ request, env, officeId }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b || !isStr(b.doc_type, 100)) return fail(env, 'اختار نوع المستند', 400);
  if (!isStr(b.facts, 3000)) return fail(env, 'اكتب الوقائع', 400);
  // الوقائع والأطراف بيانات موكلين → موافقة المكتب + توجيه حسب وضع الخصوصية
  const privacy = await requireClientDataAi(env, officeId);
  if (privacy.block) return privacy.block;
  return ok(env, await generateDocument(env, {
    route: routeFor(privacy.mode),
    doc_type: b.doc_type,
    facts: b.facts,
    parties: b.parties || '',
    extra: b.extra || '',
    case_id: b.case_id || null,
    officeId,
    country: await officeCountry(env, officeId),
  }));
}