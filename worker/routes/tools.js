// worker/routes/tools.js
import { ok, fail } from '../lib/response.js';
import { calcFee } from '../services/fee-calc.js';
import { legalSearch, generateDocument } from '../services/legal-search.js';
import { isStr, safeJson } from '../lib/validation.js';
import { requireFeature } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'POST', path: '/api/fee-calc',         handler: feeCalc },
  { method: 'POST', path: '/api/legal-search',     handler: search },
  { method: 'POST', path: '/api/generate-doc',     handler: generateDoc },
];

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
  return ok(env, await legalSearch(env, b.query));
}

async function generateDoc({ request, env, officeId }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b || !isStr(b.doc_type, 100)) return fail(env, 'اختار نوع المستند', 400);
  if (!isStr(b.facts, 3000)) return fail(env, 'اكتب الوقائع', 400);
  return ok(env, await generateDocument(env, {
    doc_type: b.doc_type,
    facts: b.facts,
    parties: b.parties || '',
    extra: b.extra || '',
    case_id: b.case_id || null,
    officeId,
  }));
}