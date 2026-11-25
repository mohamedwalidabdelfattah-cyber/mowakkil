// worker/routes/analyze.js
import { ok, fail, cors } from '../lib/response.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { extractJson } from '../lib/json-extract.js';
import { chatCompletion } from '../services/llm.js';
import { findRelevantArticles } from '../services/legal-search.js';
import { getSkill, formatSkill, GENERAL_METHOD } from '../services/legal-skills.js';
import { getCaseDocumentsText } from '../services/doc-text.js';
import { toInt } from '../lib/validation.js';
import { requireClientDataAi, routeFor } from '../lib/ai-privacy.js';
import { createMasker } from '../lib/redact.js';
import { verifyResult } from '../lib/citations.js';
import { officeCountry, localizeLegalPrompt } from '../lib/country.js';

export const routes = [
  { method: 'POST', path: '/api/analyze/contract', handler: analyzeContract },
  { method: 'POST', path: '/api/analyze/case', handler: analyzeCase },
  { method: 'POST', path: '/api/analyze/document', handler: analyzeDocument },
  { method: 'GET',  path: '/api/analyze/history', handler: getHistory },
  { method: 'GET',  path: /^\/api\/analyze\/history\/(\d+)$/, handler: getHistoryItem },
  // ✅ تحليل قضية محفوظة بالذكاء الاصطناعي (مع المهارات القانونية + المواد من الداتابيز)
  { method: 'POST', path: /^\/api\/cases\/(\d+)\/analyze$/,  handler: analyzeSavedCase },
  { method: 'GET',  path: /^\/api\/cases\/(\d+)\/analyses$/, handler: listCaseAnalyses },
];

async function runJsonPrompt(env, system, prompt, maxTokens = 3000, { route = 'any', masker = null } = {}) {
  const { message, provider } = await chatCompletion(env, {
    route,
    masker,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    maxTokens,
    temperature: 0.2,
    timeoutMs: 60000,
  });
  const raw = message.content || '';
  let result;
  try {
    result = extractJson(raw);
  } catch (e) {
    console.warn('JSON extract failed:', e.message);
    result = { summary: raw.slice(0, 1500), _raw: true };
  }
  return { result, provider };
}

async function saveAnalysis(env, { officeId, userId, type, title, input, result, fileName = null, caseId = null }) {
  const json = JSON.stringify(result);
  try {
    if (caseId) {
      const r = await env.DB.prepare(
        `INSERT INTO analyses (office_id, user_id, type, title, input_text, result_json, file_name, case_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(officeId, userId, type, title, input, json, fileName, caseId).run();
      return r.meta.last_row_id;
    }
  } catch (e) {
    // عمود case_id لسه مش موجود (migration 024 ما اتطبقتش) — نحفظ من غيره
    console.warn('save with case_id failed, retrying without:', e.message);
  }
  try {
    const r = await env.DB.prepare(
      `INSERT INTO analyses (office_id, user_id, type, title, input_text, result_json, file_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(officeId, userId, type, title, input, json, fileName || (caseId ? `case:${caseId}` : null)).run();
    return r.meta.last_row_id;
  } catch (e) {
    console.warn('Save failed:', e.message);
    return null;
  }
}

// ============================================================
// Prompts (تحليل استراتيجي)
// ============================================================

const SYSTEM_PROMPT = `أنت مستشار قانوني مصري خبير، بتفكر زي محامٍ شاطر مش زي روبوت.
- بتحلل النصوص القانونية وتستنتج منها إجابات عملية.
- بتربط المواد القانونية ببعضها لو ده يخدم الإجابة.
- بتبين للمستخدم إيه اللي في صالحه وإيه اللي ضده.
- بترد بالعربية الفصحى الرسمية.
- لا تخترع مواد قانونية غير موجودة.
- ترجع JSON صالح فقط. لا تكتب أي كلام خارج JSON.

**ملاحظة مهمة:** ممكن النص اللي هيجيلك يكون فيه حروف عربية مقطعة أو معكوسة (بسبب استخراج PDF). حاول تفهم المعنى من السياق، ولو مش قادر تفهم، قول "النص غير مقروء" في الـ summary.

**قاعدة أساسية:** استخرج **كل التفاصيل المحددة** من النص (أسماء، تواريخ، مبالغ، شروط، بنود). متكتبش كلام عام زي "تواريخ مهمة" أو "مبالغ مالية" — اكتب التفاصيل الفعلية.`;

const PROMPTS = {
  contract: `حلل العقد التالي تحليلاً قانونياً عميقاً.

**اقرأ النص بعناية واستخرج:**
1. **ملخص العقد:** نوع العقد، الأطراف (بأسمائهم)، الموضوع، المدة.
2. **المخاطر القانونية:** بنود فيها مخاطر + درجة الخطورة (high/medium/low) + شرح المخاطر.
3. **البنود اللي محتاجة تعديل:** البند + المشكلة + اقتراح بديل.
4. **التوصيات العملية:** خطوات محددة.
5. **التقييم العام:** من 10.

**قواعد:**
- اذكر أسماء الأطراف الحقيقية من النص.
- اذكر التواريخ والمبالغ الفعلية.
- لو النص مش مقروء، قول "النص غير مقروء" في summary.

أرجع JSON فقط:
{
  "summary": "نص - يشمل نوع العقد والأطراف",
  "risks": [{"risk": "نص", "explanation": "نص", "severity": "high|medium|low"}],
  "unfair_terms": [{"clause": "نص", "issue": "نص", "suggestion": "نص"}],
  "recommendations": ["نص"],
  "overall_assessment": "نص"
}`,

  case: `حلل القضية التالية تحليلاً استراتيجياً.

**اقرأ النص بعناية واستخرج:**
1. **ملخص القضية:** الأطراف (بأسمائهم)، الموضوع، المطالب، المحكمة.
2. **نقاط القوة:** نقاط محددة مع شرح.
3. **نقاط الضعف:** نقاط محددة مع شرح.
4. **الدفوع المقترحة:** شكلية/موضوعية، مع الأساس القانوني (رقم المادة واسم القانون).
5. **المخاطر المحتملة.**
6. **التوصيات والخطوات الجاية.**
7. **تقييم فرص النجاح:** عالي/متوسط/منخفض.

**قواعد:**
- اذكر أسماء الأطراف الحقيقية.
- اذكر أرقام المواد القانونية الفعلية لو موجودة في النص.
- لو النص مش مقروء، قول "النص غير مقروء" في summary.

أرجع JSON فقط:
{
  "summary": "نص",
  "strengths": ["نص"],
  "weaknesses": ["نص"],
  "defenses": [{"type": "شكلي|موضوعي", "defense": "نص", "legal_basis": "نص"}],
  "risks": ["نص"],
  "recommendations": ["نص"],
  "success_probability": "عالي|متوسط|منخفض"
}`,

  document: `استخرج **كل التفاصيل المحددة** من المستند التالي.

**اقرأ النص بعناية واستخرج:**
1. **ملخص المستند:** نوع المستند، الموضوع، الأطراف.
2. **الأطراف:** أسماء كاملة + صفاتهم (موكل/خصم/شاهد).
3. **التواريخ:** كل تاريخ مع وصفه (تاريخ التوقيع، بداية العقد، نهاية العقد...).
4. **المبالغ:** كل مبلغ مع وصفه (إيجار شهري، تأمين، شرط جزائي...).
5. **الوقائع الأساسية:** كل واقعة محددة.
6. **المسائل القانونية:** كل مسألة مع شرح.
7. **المعلومات الناقصة:** إيه اللي مش واضح في النص.

**قواعد صارمة:**
- **ممنوع** تكتب كلام عام زي "تواريخ مهمة" أو "مبالغ مالية". اكتب **التفاصيل الفعلية**.
- مثال: بدل "مبالغ مالية" اكتب "إيجار شهري: 5000 جنيه، تأمين: 10000 جنيه".
- بدل "تواريخ مهمة" اكتب "تاريخ التوقيع: 2026/01/15، نهاية العقد: 2031/01/15".
- لو النص مش مقروء (حروف مقطعة)، قول "النص غير مقروء — يرجى لصق النص يدوياً" في summary.

أرجع JSON فقط:
{
  "summary": "نص",
  "parties": ["اسم - صفة"],
  "dates": ["تاريخ - وصف"],
  "amounts": ["مبلغ - وصف"],
  "key_facts": ["نص"],
  "legal_issues": ["نص"],
  "missing_info": ["نص"]
}`,
};

// ============================================================
// Handlers
// ============================================================

async function analyzeContract({ request, env, officeId, userId }) {
  return runAnalysis(env, officeId, userId, 'contract', request);
}
async function analyzeCase({ request, env, officeId, userId }) {
  return runAnalysis(env, officeId, userId, 'case', request);
}
async function analyzeDocument({ request, env, officeId, userId }) {
  return runAnalysis(env, officeId, userId, 'document', request);
}

async function runAnalysis(env, officeId, userId, type, request) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return cors(gate, env, request);
  // النص الملصوق ده مستند موكل → موافقة + خصوصية حسب إعداد المكتب
  const privacy = await requireClientDataAi(env, officeId);
  if (privacy.block) return cors(privacy.block, env, request);

  let b;
  try {
    b = await request.json();
  } catch (e) {
    return cors(fail(env, 'JSON غير صالح', 400), env, request);
  }

  if (!b || typeof b.text !== 'string') {
    return cors(fail(env, 'حقل "text" مطلوب', 400), env, request);
  }

  if (b.text.length < 30) {
    return cors(fail(env, 'النص قصير جداً — اكتب 30 حرف على الأقل', 400), env, request);
  }

  // النماذج المجانية بتدعم نصوص أطول بكتير من 4000 حرف
  const text = b.text.slice(0, 15000);
  const truncated = b.text.length > 15000;

  let result, provider;
  try {
    const masker = createMasker({ names: String(b.party_names || '').split(/[,،\n]/) });
    const country = await officeCountry(env, officeId);
    ({ result, provider } = await runJsonPrompt(env, localizeLegalPrompt(SYSTEM_PROMPT, country), `${PROMPTS[type]}\n\nالنص:\n${text}`, 3000,
      { route: routeFor(privacy.mode), masker }));
    const checked = await verifyResult(env, result);
    result = checked.result;
    result._citations = checked.summary;
    result._privacy = { mode: privacy.mode, masked: masker.count };
  } catch (e) {
    console.error('analysis failed:', e.message);
    return cors(fail(env, 'فشل التحليل: ' + e.message, 503), env, request);
  }
  if (truncated) result._truncated = true;

  const title = result.summary ? String(result.summary).slice(0, 80) : `تحليل ${type}`;
  const insertId = await saveAnalysis(env, {
    officeId, userId, type, title, input: text, result, fileName: b.file_name || null,
  });

  return cors(ok(env, {
    id: insertId,
    type,
    title,
    result,
    provider,
    created_at: new Date().toISOString(),
  }), env, request);
}

// ============================================================
// تحليل قضية محفوظة (زر "تحليل بالذكاء الاصطناعي" في تفاصيل القضية)
// ============================================================
const CASE_ANALYSIS_PROMPT = `حلل القضية التالية تحليلاً قانونياً استراتيجياً كمحامٍ مصري متخصص، مستخدماً "المهارة القانونية" و"المواد القانونية من قاعدة البيانات" المرفقة.

أرجع JSON فقط بالشكل ده (بالعربية الفصحى، وكل عنصر محدد ومرتبط بوقائع القضية، مش كلام عام):
{
  "summary": "ملخص القضية في 3-4 أسطر",
  "classification": "التكييف القانوني للنزاع",
  "competent_court": "المحكمة المختصة نوعياً ومحلياً ومدى صحة المحكمة الحالية",
  "applicable_laws": [{"law": "اسم القانون", "articles": "أرقام المواد لو موجودة في النصوص المرفقة أو متأكد منها", "relevance": "إزاي بتنطبق"}],
  "strengths": ["نقطة قوة محددة"],
  "weaknesses": ["نقطة ضعف محددة"],
  "formal_defenses": [{"defense": "الدفع الشكلي", "basis": "الأساس القانوني", "applies": "ينطبق/محتمل/لا ينطبق + السبب"}],
  "substantive_defenses": [{"defense": "الدفاع الموضوعي", "basis": "الأساس القانوني"}],
  "opponent_arguments": [{"argument": "دفاع الخصم المتوقع", "response": "الرد عليه"}],
  "evidence_needed": ["دليل أو مستند مطلوب"],
  "deadlines": [{"item": "الإجراء", "period": "الميعاد", "note": "ملاحظة أو (يُراجع النص)"}],
  "next_steps": ["خطوة عملية مرتبة حسب الأولوية"],
  "risks": ["خطر محتمل"],
  "missing_info": ["معلومة ناقصة لازم تتعرف عشان التحليل يبقى أدق"],
  "success_probability": "عالي|متوسط|منخفض",
  "success_reasoning": "سبب التقييم"
}`;

async function analyzeSavedCase({ request, env, officeId, userId, params }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return gate;
  const privacy = await requireClientDataAi(env, officeId);
  if (privacy.block) return privacy.block;

  const caseId = toInt(params[0]);
  const c = await env.DB.prepare(
    `SELECT c.*, cl.name AS client_name
     FROM cases c LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ? AND c.office_id = ? AND c.deleted_at IS NULL`
  ).bind(caseId, officeId).first();
  if (!c) return fail(env, 'القضية مش موجودة', 404);

  let b = {};
  try { b = await request.json(); } catch {}
  const facts = String(b.facts || '').trim().slice(0, 12000);
  const role = String(b.client_role || '').trim().slice(0, 50);       // مدعي/مدعى عليه/متهم/مجني عليه...
  const opponent = String(b.opponent || '').trim().slice(0, 300);
  const requests = String(b.requests || '').trim().slice(0, 1500);
  const docText = String(b.document_text || '').trim().slice(0, 8000);
  const caseType = String(b.case_type || c.case_type || '').trim();

  const [{ results: sessions }, { results: tasks }, { results: docs }] = await Promise.all([
    env.DB.prepare(`SELECT session_date, notes FROM sessions WHERE case_id = ? ORDER BY session_date ASC LIMIT 30`).bind(caseId).all(),
    env.DB.prepare(`SELECT title, status, due_date FROM tasks WHERE case_id = ? AND office_id = ? LIMIT 20`).bind(caseId, officeId).all(),
    env.DB.prepare(`SELECT file_name, doc_type FROM documents WHERE case_id = ? AND office_id = ? AND deleted_at IS NULL LIMIT 30`).bind(caseId, officeId).all(),
  ]);

  const sessionsText = (sessions || []).map(s => `- ${s.session_date}${s.notes ? ': ' + s.notes : ''}`).join('\n');

  // ✅ مرفقات القضية: بنقرا نصها تلقائياً (كلها افتراضياً، أو اللي المستخدم اختارها)
  const docIds = Array.isArray(b.document_ids) ? b.document_ids : null;
  const attached = b.use_documents === false ? [] : await getCaseDocumentsText(env, { officeId, caseId, ids: docIds });
  const readable = attached.filter(d => d.text);
  const DOCS_BUDGET = 24000;
  const perDoc = readable.length ? Math.floor(DOCS_BUDGET / readable.length) : 0;
  const attachedText = readable
    .map(d => `===== مستند: ${d.file_name}${d.doc_type ? ' (' + d.doc_type + ')' : ''} =====\n${d.text.slice(0, perDoc)}`)
    .join('\n\n');

  if (facts.length < 30 && !sessionsText && docText.length < 30 && !attachedText) {
    const why = attached.length
      ? 'مقدرتش أقرا نص المرفقات (' + attached.map(d => `${d.file_name}: ${d.error || 'فاضي'}`).join('، ') + '). اكتب الوقائع أو الصق النص.'
      : 'القضية مفيهاش مرفقات ولا ملاحظات جلسات — ارفع مستند القضية أو اكتب الوقائع.';
    return fail(env, why, 400);
  }

  const skill = getSkill(caseType);
  const searchQuery = [caseType, facts, requests, docText.slice(0, 1500), readable[0]?.text.slice(0, 1500)]
    .filter(Boolean).join(' ').slice(0, 2500);
  // قاعدة النصوص مصرية — المكتب السعودي بيتحلل وفق الأنظمة السعودية من غيرها
  const country = await officeCountry(env, officeId);
  const { articles, method } = country === 'SA'
    ? { articles: [], method: 'sa_no_db' }
    : await findRelevantArticles(env, searchQuery, { lawHints: skill.lawHints, topK: 8 });

  const caseBlock = `بيانات القضية:
- رقم القضية: ${c.case_number || '—'}
- المحكمة: ${c.court || '—'} · الدرجة: ${c.degree || '—'}
- نوع القضية: ${caseType || 'غير محدد'}
- الحالة: ${c.status || '—'}
- الموكل: ${c.client_name || '—'}${role ? ` (صفته: ${role})` : ''}
- الخصم: ${opponent || 'غير محدد'}

الوقائع كما رواها المحامي:
${facts || '(لم تُكتب وقائع — استخرج الوقائع من مستندات القضية وملاحظات الجلسات أدناه)'}

${requests ? `طلبات الموكل/الطلبات في الدعوى:\n${requests}\n` : ''}
${sessionsText ? `الجلسات وملاحظاتها:\n${sessionsText}\n` : ''}
${(tasks || []).length ? `المهام:\n${tasks.map(t => `- ${t.title} (${t.status || ''})`).join('\n')}\n` : ''}
${(docs || []).length ? `المستندات المرفقة بالملف:\n${docs.map(d => `- ${d.file_name}${d.doc_type ? ' — ' + d.doc_type : ''}`).join('\n')}\n` : ''}
${attachedText ? `نصوص مستندات القضية (مستخرجة من المرفقات — اعتمد عليها في الأسماء والتواريخ والمبالغ والطلبات):\n${attachedText}\n` : ''}
${docText ? `نص مستند لصقه المحامي:\n${docText}\n` : ''}`;

  const articlesBlock = articles.length
    ? articles.map((a, i) => `[${i + 1}] ${a.law_name}${a.law_number ? ' (' + a.law_number + ')' : ''} — ${a.article_number}:\n${a.article_text}`).join('\n\n')
    : '(لم يتم العثور على مواد مطابقة في قاعدة البيانات — اعتمد على المهارة القانونية واذكر "(يُراجع النص)" بجانب أي رقم مادة)';

  const system = localizeLegalPrompt(`${SYSTEM_PROMPT}\n\n${GENERAL_METHOD}\n\n${formatSkill(skill)}`, country);
  const prompt = localizeLegalPrompt(`${CASE_ANALYSIS_PROMPT}\n\n${caseBlock}\n\nالمواد القانونية من قاعدة البيانات:\n${articlesBlock}`, country);

  // أسماء الأطراف اللي بنعرفها بتتخفي قبل ما النص يطلع لأي نموذج
  const masker = createMasker({ names: [c.client_name, ...opponent.split(/[,،\n]/)] });

  let result, provider;
  try {
    ({ result, provider } = await runJsonPrompt(env, system, prompt, 4000, { route: routeFor(privacy.mode), masker }));
  } catch (e) {
    console.error('case analysis failed:', e.message);
    return fail(env, 'فشل التحليل: ' + e.message, 503);
  }

  const checked = await verifyResult(env, result);
  result = checked.result;

  result._meta = {
    citations: checked.summary,
    privacy: { mode: privacy.mode, masked: masker.count },
    skill: skill.title,
    articles_found: articles.length,
    search_method: method,
    sources: articles.map(a => `${a.law_name} — ${a.article_number}`),
    documents: attached.map(d => ({ file_name: d.file_name, read: Boolean(d.text), chars: d.text.length, error: d.error || null })),
  };

  const title = `تحليل قضية ${c.case_number || '#' + caseId}`;
  const id = await saveAnalysis(env, {
    officeId, userId, type: 'case_ai', title, input: caseBlock.slice(0, 20000), result, caseId,
  });

  return ok(env, { id, type: 'case_ai', title, result, provider, created_at: new Date().toISOString() });
}

async function listCaseAnalyses({ env, officeId, params }) {
  const caseId = toInt(params[0]);
  let rows = [];
  try {
    const r = await env.DB.prepare(
      `SELECT id, title, created_at FROM analyses
       WHERE office_id = ? AND type = 'case_ai' AND (case_id = ? OR file_name = ?)
       ORDER BY id DESC LIMIT 10`
    ).bind(officeId, caseId, `case:${caseId}`).all();
    rows = r.results || [];
  } catch {
    const r = await env.DB.prepare(
      `SELECT id, title, created_at FROM analyses
       WHERE office_id = ? AND type = 'case_ai' AND file_name = ?
       ORDER BY id DESC LIMIT 10`
    ).bind(officeId, `case:${caseId}`).all();
    rows = r.results || [];
  }
  return ok(env, { items: rows });
}

// ============================================================
// History
// ============================================================

async function getHistory({ env, officeId, request }) {
  const r = await env.DB.prepare(
    `SELECT id, type, title, created_at FROM analyses
     WHERE office_id = ? AND type != 'case_ai' ORDER BY id DESC LIMIT 20`
  ).bind(officeId).all();
  return cors(ok(env, { items: r.results || [] }), env, request);
}

async function getHistoryItem({ env, officeId, params, request }) {
  const r = await env.DB.prepare(
    `SELECT * FROM analyses WHERE id = ? AND office_id = ?`
  ).bind(Number(params[0]), officeId).first();
  if (!r) return cors(fail(env, 'مش موجود', 404), env, request);
  let parsed = {};
  try { parsed = JSON.parse(r.result_json || '{}'); } catch {}
  return cors(ok(env, { ...r, result: parsed }), env, request);
}