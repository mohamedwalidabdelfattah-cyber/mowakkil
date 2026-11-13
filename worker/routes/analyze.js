// worker/routes/analyze.js
import { ok, fail, json, cors } from '../lib/response.js';
import { requireFeature } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'OPTIONS', path: '/api/analyze/:type', handler: handleOptions },
  { method: 'POST', path: '/api/analyze/contract', handler: analyzeContract },
  { method: 'POST', path: '/api/analyze/case', handler: analyzeCase },
  { method: 'POST', path: '/api/analyze/document', handler: analyzeDocument },
  { method: 'GET', path: '/api/analyze/history', handler: getHistory },
  { method: 'GET', path: '/api/analyze/history/:id', handler: getHistoryItem },
];

async function handleOptions({ env, request }) {
  return cors(new Response(null, { status: 204 }), env, request);
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

  const text = b.text.slice(0, 4000);

  const prompt = `${PROMPTS[type]}\n\nالنص:\n${text}`;

  let result = null;
  let raw = '';

  try {
    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const resp = response.response;
    if (typeof resp === 'object' && resp !== null) {
      result = resp;
    } else {
      raw = resp || '';
    }
  } catch (e) {
    console.error('Workers AI request failed:', e.message);
    return cors(fail(env, 'فشل التحليل: ' + e.message, 500), env, request);
  }

  if (!result && raw) {
    try {
      result = extractJson(raw);
    } catch (e) {
      console.warn('JSON extract failed:', e.message);
      result = { summary: raw.slice(0, 1000), _raw: true };
    }
  }

  if (!result) {
    return cors(fail(env, 'الذكاء الاصطناعي رجّع رد فاضي', 500), env, request);
  }

  const title = result.summary ? String(result.summary).slice(0, 80) : `تحليل ${type}`;
  let insertId = null;
  try {
    const insert = await env.DB.prepare(
      `INSERT INTO analyses (office_id, user_id, type, title, input_text, result_json, file_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      officeId, userId, type, title,
      text, JSON.stringify(result), b.file_name || null
    ).run();
    insertId = insert.meta.last_row_id;
  } catch (e) {
    console.warn('Save failed:', e.message);
  }

  return cors(ok(env, {
    id: insertId,
    type,
    title,
    result,
    created_at: new Date().toISOString(),
  }), env, request);
}

// ============================================================
// JSON Extraction (fallback)
// ============================================================

function extractJson(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');

  if (firstBrace === -1) throw new Error('No JSON object found');

  if (lastBrace === -1 || lastBrace < firstBrace) {
    s = s.slice(firstBrace);
    s = completeJson(s);
  } else {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(s);
  } catch (e) {
    try {
      const completed = completeJson(s);
      return JSON.parse(completed);
    } catch (e2) {
      throw new Error('JSON parse failed: ' + e2.message);
    }
  }
}

function completeJson(s) {
  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = false; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') stack.push(c);
    if (c === '}' || c === ']') stack.pop();
  }

  if (inString) s += '"';
  while (stack.length) {
    const open = stack.pop();
    s += open === '{' ? '}' : ']';
  }
  return s;
}

// ============================================================
// History
// ============================================================

async function getHistory({ env, officeId, request }) {
  const r = await env.DB.prepare(
    `SELECT id, type, title, created_at FROM analyses WHERE office_id = ? ORDER BY id DESC LIMIT 20`
  ).bind(officeId).all();
  return cors(ok(env, { items: r.results || [] }), env, request);
}

async function getHistoryItem({ env, officeId, params, request }) {
  const r = await env.DB.prepare(
    `SELECT * FROM analyses WHERE id = ? AND office_id = ?`
  ).bind(params.id, officeId).first();
  if (!r) return cors(fail(env, 'مش موجود', 404), env, request);
  let parsed = {};
  try { parsed = JSON.parse(r.result_json || '{}'); } catch {}
  return cors(ok(env, { ...r, result: parsed }), env, request);
}