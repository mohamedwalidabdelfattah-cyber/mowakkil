// worker/services/legal-search.js
// بحث قانوني + توليد مستندات — Vectorize (RAG) + bge-m3 + نماذج مجانية (Groq/Gemini/Workers AI)
import { completeText } from './llm.js';
import { createMasker } from '../lib/redact.js';
import { localizeLegalPrompt } from '../lib/country.js';
import { verifyText, annotate, summarize, summaryText } from '../lib/citations.js';

// مراجعة الأسانيد في أي نص طالع من الذكاء الاصطناعي
async function withCitationCheck(env, text) {
  try {
    const checks = await verifyText(env, text);
    return checks.length ? annotate(text, checks) + summaryText(summarize(checks)) : text;
  } catch (e) {
    console.warn('citation check failed:', e.message);
    return text;
  }
}

const DEFAULT_SYSTEM = `أنت مستشار قانوني مصري خبير، بتفكر زي محامٍ شاطر مش زي روبوت.
- بتحلل النصوص القانونية وتستنتج منها إجابات عملية.
- بتربط المواد القانونية ببعضها لو ده يخدم الإجابة.
- بتبين للمستخدم إيه اللي في صالحه وإيه اللي ضده.
- بترد بالعربية الفصحى الرسمية.
- لا تخترع مواد قانونية غير موجودة في النصوص المرفقة.
- لو النصوص مش كافية، قول "النصوص المتاحة مش كافية" واشرح إيه اللي ناقص.`;

// route/masker: خصوصية بيانات الموكلين (شوف lib/ai-privacy.js). الأسئلة العامة بتتخفي فيها
// الأرقام القومية والتليفونات برضه احتياطياً.
async function callAI(env, prompt, maxTokens = 1500, systemPrompt = null, { route = 'any', masker = createMasker() } = {}) {
  const { text } = await completeText(env, {
    system: systemPrompt || DEFAULT_SYSTEM,
    prompt,
    maxTokens,
    route,
    masker,
  });
  return text;
}

const MAX_ARTICLE_CHARS = 1200;
const trimArticle = t => {
  const s = String(t || '');
  return s.length > MAX_ARTICLE_CHARS ? s.slice(0, MAX_ARTICLE_CHARS) + '…' : s;
};

// بحث نصي احتياطي (لما Vectorize فاضي أو مفيش نتايج) — اختياري مقصور على قوانين معينة
export async function keywordArticles(env, query, lawHints = [], limit = 8, country = 'EG') {
  const words = String(query || '')
    .replace(/[؟?.,،:؛!()"'«»\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 8);
  if (!words.length) return [];

  const wordCond = words.map(() => 'article_text LIKE ?').join(' OR ');
  const binds = words.map(w => `%${w}%`);
  let sql = `SELECT id, law_name, law_number, article_number, article_text, source_url
             FROM law_articles WHERE country = ? AND (${wordCond})`;
  binds.unshift(country === 'SA' ? 'SA' : 'EG');
  if (lawHints.length) {
    sql += ` AND (${lawHints.map(() => 'law_name LIKE ?').join(' OR ')})`;
    binds.push(...lawHints.map(h => `%${h}%`));
  }
  // ترتيب بعدد الكلمات المطابقة
  const score = words.map(() => '(CASE WHEN article_text LIKE ? THEN 1 ELSE 0 END)').join(' + ');
  sql += ` ORDER BY (${score}) DESC LIMIT ?`;
  binds.push(...words.map(w => `%${w}%`), limit);

  try {
    const r = await env.DB.prepare(sql).bind(...binds).all();
    return r.results || [];
  } catch (e) {
    console.warn('keyword search failed:', e.message);
    return [];
  }
}

// بحث دلالي (Vectorize) مع fallback نصي — بيرجع مواد قانونية مقصوصة الطول
// country: مواد دولة المكتب بس (مصر / السعودية)
export async function findRelevantArticles(env, query, { lawHints = [], topK = 8, country = 'EG' } = {}) {
  const safeQuery = String(query || '').slice(0, 1500);
  const c = country === 'SA' ? 'SA' : 'EG';
  try {
    const emb = await env.AI.run('@cf/baai/bge-m3', { text: [safeQuery] });
    // بنجيب عدد أكبر وبنفلتر بالدولة من الداتابيز (الفهرس فيه المصري والسعودي مع بعض)
    const vr = await env.VECTORIZE.query(emb.data[0], { topK: Math.min(50, topK * 5), returnMetadata: 'none' });
    const ids = (vr.matches || []).filter(m => (m.score ?? 0) >= 0.45).map(m => m.id);
    if (ids.length) {
      const r = await env.DB.prepare(
        `SELECT id, law_name, law_number, article_number, article_text, source_url
         FROM law_articles WHERE country = ? AND id IN (${ids.map(() => '?').join(',')})`
      ).bind(c, ...ids).all();
      const byId = new Map((r.results || []).map(x => [String(x.id), x]));
      const rows = ids.map(id => byId.get(String(id))).filter(Boolean).slice(0, topK);
      if (rows.length) return { method: 'vector', articles: rows.map(a => ({ ...a, article_text: trimArticle(a.article_text) })) };
    }
  } catch (e) {
    console.warn('vector search failed:', e.message);
  }
  let rows = await keywordArticles(env, safeQuery, lawHints, topK, c);
  if (!rows.length && lawHints.length) rows = await keywordArticles(env, safeQuery, [], topK, c);
  return { method: 'keyword', articles: rows.map(a => ({ ...a, article_text: trimArticle(a.article_text) })) };
}

const UNSUPPORTED_TOPICS = [
  'زواج', 'طلاق', 'خلع', 'نفقة', 'حضانة', 'ميراث', 'وصية',
  'أحوال شخصية', 'عقد زواج', 'عرفي', 'مهر', 'عدة', 'نسب',
  'رؤية', 'حضانة أطفال', 'ولاية', 'وصاية', 'قوامة',
];

export async function legalSearch(env, query, { country = 'EG' } = {}) {
  const safeQuery = String(query).slice(0, 500);

  // المكتب السعودي: نصوص الأنظمة السعودية من القاعدة (الإثبات، المعاملات المدنية، الأحوال الشخصية، الشركات…)
  if (country === 'SA') {
    try {
      const { articles } = await findRelevantArticles(env, safeQuery, { topK: 8, country: 'SA' });
      if (articles.length) {
        const context = articles
          .map((r, i) => `[${i + 1}] ${r.law_name} (${r.law_number || ''}) — ${r.article_number}:\n${r.article_text}`)
          .join('\n\n');
        const prompt = localizeLegalPrompt(`قدّم استشارة قانونية لزميل.

**السؤال:** ${safeQuery}

**نصوص الأنظمة السعودية المتاحة من القاعدة (منقولة من الجريدة الرسمية):**
${context}

**قواعد صارمة:**
1. استشهد بهذه النصوص بأرقام موادها وأسماء أنظمتها كما هي، ولا تخترع مواد.
2. لو النصوص غير متعلقة بالسؤال أو غير كافية، قل ذلك صراحة في أول سطر، ثم أجب من معرفتك بالأنظمة السعودية مع التنبيه على ضرورة مراجعة النص الرسمي.
3. الترتيب: الإجابة المباشرة، ثم التحليل النظامي، ثم النقاط العملية، ثم المصادر.`, 'SA');
        const answer = await callAI(env, prompt, 1400, localizeLegalPrompt(DEFAULT_SYSTEM, 'SA'));
        return { answer: answer ? await withCitationCheck(env, answer) : buildFallbackAnswer(articles), sources: articles };
      }
      // مفيش نصوص قريبة: نجاوب من المعرفة العامة بالأنظمة وننبّه
      const answer = await callAI(env,
        localizeLegalPrompt(`السؤال: ${safeQuery}\n\nجاوب كاستشارة قانونية لزميل: الملخص، ثم التحليل وفق الأنظمة السعودية، ثم التوصيات العملية، ثم الأنظمة والمواد ذات الصلة (لو متأكد منها).`, 'SA'),
        1400, localizeLegalPrompt(DEFAULT_SYSTEM, 'SA'));
      return {
        answer: (answer || 'تعذر الحصول على إجابة الآن، حاول مرة أخرى.') +
          '\n\n---\nℹ️ لم تُوجد نصوص قريبة من السؤال في قاعدة الأنظمة السعودية (المتاح حالياً: الإثبات، المعاملات المدنية، الأحوال الشخصية، الشركات)؛ الإجابة مبنية على المعرفة العامة بالأنظمة، فراجع النص الرسمي قبل الاعتماد عليها.',
        sources: [],
        notice: 'sa_no_match',
      };
    } catch (e) {
      console.error('SA legal search failed:', e.message);
      return { answer: 'تعذر الحصول على إجابة الآن، حاول مرة أخرى.', sources: [] };
    }
  }

  const lowerQuery = safeQuery.toLowerCase();
  const unsupportedTopic = UNSUPPORTED_TOPICS.find(t => lowerQuery.includes(t));

  if (unsupportedTopic) {
    return {
      answer: `⚠️ **تنبيه مهم:**\n\nالنظام الحالي بيغطي **القوانين المدنية والجنائية والتجارية والإدارية**، لكنه **مش بيغطي الأحوال الشخصية** (الزواج، الطلاق، النفقة، الحضانة، الميراث، إلخ).\n\nعشان تحلل "${safeQuery}" بشكل دقيق، محتاج ترجع لـ:\n\n1. **قانون الأحوال الشخصية** رقم 25 لسنة 1920 وتعديلاته.\n2. **قانون الأحوال الشخصية للمسيحيين** (لو الأطراف مسيحيين).\n3. **الفتاوى الشرعية** من دار الإفتاء المصرية أو الأزهر.\n4. **استشارة محامٍ متخصص** في الأحوال الشخصية.\n\n**ملحوظة:** الزواج العرفي له أحكام خاصة في القانون المصري، ومحتاج نصوص شرعية + قانونية دقيقة.`,
      sources: [],
      warning: 'unsupported_topic',
    };
  }

  let queryEmbedding;
  try {
    const aiResponse = await env.AI.run('@cf/baai/bge-m3', { text: [safeQuery] });
    queryEmbedding = aiResponse.data[0];
  } catch (e) {
    console.error('Embedding failed:', e.message);
    return fallbackSearch(env, safeQuery);
  }

  let vectorResults;
  try {
    vectorResults = await env.VECTORIZE.query(queryEmbedding, { 
      topK: 15,
      returnMetadata: 'none' 
    });
  } catch (e) {
    console.error('Vectorize query failed:', e.message);
    return fallbackSearch(env, safeQuery);
  }

  if (!vectorResults.matches || vectorResults.matches.length === 0) {
    return fallbackSearch(env, safeQuery);
  }

  const THRESHOLD = 0.5;
  const filteredMatches = vectorResults.matches.filter(m => (m.score ?? 0) >= THRESHOLD);

  if (filteredMatches.length === 0) {
    console.warn('No relevant matches above threshold');
    return {
      answer: `⚠️ **مفيش نصوص قانونية قريبة من السؤال ده في الداتابيز.**\n\nالنظام بيغطي القوانين المدنية والجنائية والتجارية فقط. عشان تحلل "${safeQuery}" بشكل دقيق:\n\n1. استخدم **بوابة التشريعات المصرية** الرسمية.\n2. ارجع لـ **القانون المختص** مباشرة.\n3. استشر **محامٍ متخصص**.\n\nممكن أعيد صياغة السؤال بشكل أوضح لو تحب.`,
      sources: [],
      warning: 'no_relevant_results',
    };
  }

  const ids = filteredMatches.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');
  const dbResult = await env.DB.prepare(
    `SELECT id, law_name, law_number, article_number, article_text, source_url
     FROM law_articles WHERE country = 'EG' AND id IN (${placeholders})`
  ).bind(...ids).all();

  const byId = new Map(dbResult.results.map(r => [String(r.id), r]));
  const results = filteredMatches.map(m => byId.get(String(m.id))).filter(Boolean);

  if (results.length === 0) return fallbackSearch(env, safeQuery);

  const context = results
    .map((r, i) => `[${i + 1}] ${r.law_name} (${r.law_number || ''}) — ${r.article_number}:\n${r.article_text}`)
    .join('\n\n');

  const prompt = `أنت محامٍ مصري خبير بتقدم استشارة قانونية لزميل.

**السؤال:** ${safeQuery}

**النصوص القانونية المتاحة من قاعدة البيانات:**
${context}

**قواعد صارمة:**
1. لو النصوص دي **مش متعلقة بالسؤال** أو **مش كافية**، قول ده صراحةً في أول سطر: "⚠️ النصوص المتاحة مش كافية" — **متلفش وتدور**.
2. **متستخدمش** نصوص عن "العقود" عشان تجاوب على سؤال عن "الزواج" — دي مواضيع مختلفة تماماً.
3. لو النصوص متعلقة فعلاً، حللها كالتالي:
   - **الإجابة المباشرة:** جملة أو جملتين.
   - **التحليل القانوني:** إزاي المواد بتنطبق.
   - **النقاط العملية:** إيه اللي المستخدم يعمله.
   - **المصادر:** أرقام المواد وأسماء القوانين.

**قواعد الإجابة:**
- اكتب بالعربية الفصحى.
- لا تخترع مواد قانونية.
- لو السؤال عن **أحوال شخصية** (زواج، طلاق، ميراث)، قول إن النظام مش بيغطي ده ووجه المستخدم للمصادر الشرعية.`;

  try {
    const answer = await callAI(env, prompt, 1200);
    return { answer: answer ? await withCitationCheck(env, answer) : buildFallbackAnswer(results), sources: results };
  } catch (e) {
    console.error('AI failed:', e.message);
    return { answer: buildFallbackAnswer(results), sources: results };
  }
}

async function fallbackSearch(env, query) {
  const words = query.replace(/[؟?.,،:؛!]/g, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 6);
  if (!words.length) return { answer: 'اكتب سؤال أوضح', sources: [] };
  const conditions = words.map(() => 'article_text LIKE ?').join(' OR ');
  const binds = words.map(w => `%${w}%`);
  const r = await env.DB.prepare(
    `SELECT law_name, law_number, article_number, article_text, source_url
     FROM law_articles WHERE country = 'EG' AND (${conditions}) LIMIT 10`
  ).bind(...binds).all();
  const results = r.results || [];
  if (!results.length) return { answer: 'مفيش نصوص قانونية تطابق السؤال.', sources: [] };
  const context = results.map((r, i) => `[${i + 1}] ${r.law_name} — ${r.article_number}:\n${r.article_text}`).join('\n\n');
  const prompt = `أنت محامٍ مصري. حلل السؤال ده بناءً على النصوص دي:\n\n${context}\n\nالسؤال: ${query}\n\nجاوب بتحليل قانوني (مش مجرد سرد). لو النصوص مش متعلقة، قول "النصوص مش كافية".`;
  try {
    const answer = await callAI(env, prompt, 1000);
    return { answer: answer ? await withCitationCheck(env, answer) : buildFallbackAnswer(results), sources: results };
  } catch {
    return { answer: buildFallbackAnswer(results), sources: results };
  }
}

function buildFallbackAnswer(results) {
  if (!results.length) return 'مفيش نصوص قانونية تطابق السؤال.';
  const lines = [`📚 لقيتلك ${results.length} نص قانوني مرتبط:`];
  lines.push('');
  results.forEach((r, i) => {
    lines.push(`【${i + 1}】 ${r.law_name} — ${r.article_number}`);
    lines.push(r.article_text);
    lines.push('');
  });
  return lines.join('\n');
}

// ============================================================
// دالة البحث في الداتابيز (للاستخدام كأداة في الـ Agent)
// ============================================================
export async function searchLegalDb(env, query, { country = 'EG' } = {}) {
  const safeQuery = String(query).slice(0, 500);

  // كشف المواضيع غير المغطاة (المصري بس — النظام السعودي للأحوال الشخصية موجود في القاعدة)
  const lowerQuery = safeQuery.toLowerCase();
  const unsupportedTopic = country === 'SA' ? null : UNSUPPORTED_TOPICS.find(t => lowerQuery.includes(t));

  if (unsupportedTopic) {
    return {
      source: 'db',
      warning: 'unsupported_topic',
      message: 'الموضوع ده (أحوال شخصية) مش مغطى في قاعدة البيانات. استخدم search_web أو وجّه المستخدم للمصادر الشرعية.',
      results: [],
    };
  }

  const { articles, method } = await findRelevantArticles(env, safeQuery, { topK: 8, country });
  if (!articles.length) {
    return { source: 'db', results: [], message: country === 'SA' ? 'لا توجد مواد مطابقة في قاعدة الأنظمة السعودية (المتاح: الإثبات، المعاملات المدنية، الأحوال الشخصية، الشركات)' : 'مفيش نتايج في الداتابيز' };
  }
  const results = articles.map(r => ({
    law_name: r.law_name,
    law_number: r.law_number,
    article_number: r.article_number,
    article_text: r.article_text,
    source_url: r.source_url,
  }));
  return { source: 'db', method, results, count: results.length };
}

// ============================================================
// توليد المستندات
// ============================================================
export async function generateDocument(env, { doc_type, facts, parties, extra, case_id, officeId, route = 'balanced', country = 'EG' }) {
  const safeFacts = String(facts || '').trim().slice(0, 3000);
  const safeParties = String(parties || '').trim().slice(0, 500);
  const safeExtra = String(extra || '').trim().slice(0, 800);
  if (!safeFacts) return { error: 'اكتب الوقائع' };

  let caseContext = '';
  const knownNames = String(parties || '').split(/[,،\n]|\s+ضد\s+/);
  if (case_id && officeId) {
    try {
      // ✅ لازم القضية تكون تبع نفس المكتب (منع تسريب بيانات بين المكاتب)
      const c = await env.DB.prepare(
        `SELECT c.case_number, c.court, c.case_type, c.status, cl.name as client_name
         FROM cases c LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.id = ? AND c.office_id = ? AND c.deleted_at IS NULL`
      ).bind(case_id, officeId).first();
      if (c) {
        knownNames.push(c.client_name);
        caseContext = `\n\nبيانات القضية:
- رقم القضية: ${c.case_number || '—'}
- المحكمة: ${c.court || '—'}
- نوع القضية: ${c.case_type || '—'}
- الموكل: ${c.client_name || '—'}
- الحالة: ${c.status || '—'}`;
      }
    } catch (e) { console.warn('case context failed:', e.message); }
  }

  const templates = {
    'إنذار على يد محضر': 'إنذار رسمي على يد محضر يشمل: المرسل إليه، الوقائع، المطالب المحددة، المهلة، التحذير القانوني',
    'مذكرة دفاع': 'مذكرة دفاع قانونية تشمل: مقدمة، وقائع، دفوع شكلية، دفوع موضوعية مع النصوص، الطلبات الختامية',
    'صحيفة دعوى': 'صحيفة دعوى تشمل: بيانات المدعي والمدعى عليه، الموضوع، الأسانيد، الطلبات، المستندات',
    'إنذار رسمي بفسخ عقد': 'إنذار رسمي بفسخ عقد يشمل: بيانات الطرفين، أسباب الفسخ، المطالب، التحذير القانوني',
    'إخطار بإنهاء علاقة عمل': 'إخطار بإنهاء علاقة عمل وفق قانون العمل المصري يشمل: البيانات، تاريخ البداية والنهاية، السبب، المستحقات',
    'توكيل خاص': 'توكيل خاص يشمل: بيانات الموكل، الوكيل، نطاق التوكيل، المدة',
  };
  const template = templates[doc_type] || templates['مذكرة دفاع'];

  const prompt = `أنت محامٍ مصري محترف. اكتب ${doc_type} بالشكل الرسمي المعتمد في مصر.

المطلوب: ${template}${caseContext}

الوقائع:
${safeFacts}

الأطراف: ${safeParties || '.......................'}

${safeExtra ? 'تفاصيل إضافية:\n' + safeExtra : ''}

اكتب المستند كاملاً بالعربية الفصحى. ابدأ بالعنوان. لا تكتب أي تعليق من عندك.
في النهاية أضف:
---تنبيه---
هذه المسودة أولية ومحتاجة مراجعة محامٍ متخصص.`;

  try {
    // الوقائع والأطراف بيانات موكلين → إخفاء الأسماء/الأرقام + توجيه حسب خصوصية المكتب
    const masker = createMasker({ names: knownNames });
    // المكتب السعودي: الصيغة والأنظمة السعودية
    const document = await callAI(env, localizeLegalPrompt(prompt, country), 1500, localizeLegalPrompt(DEFAULT_SYSTEM, country), { route, masker });
    return {
      document: document ? await withCitationCheck(env, document) : buildTemplateDocument(doc_type, safeFacts, safeParties, safeExtra),
      doc_type,
      generated_at: new Date().toISOString(),
    };
  } catch (e) {
    console.error('generate doc failed:', e.message);
    return {
      document: buildTemplateDocument(doc_type, safeFacts, safeParties, safeExtra),
      doc_type,
      generated_at: new Date().toISOString(),
      note: 'مسودة مبنية على قالب عام',
    };
  }
}

function buildTemplateDocument(doc_type, facts, parties, extra) {
  const date = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  return `${doc_type}

التاريخ: ${date}

الأطراف: ${parties || '.......................'}

الوقائع:
${facts}

${extra ? 'تفاصيل إضافية:\n' + extra + '\n' : ''}
.......................
.......................

---تنبيه---
هذه المسودة أولية ومحتاجة مراجعة محامٍ متخصص.`;
}