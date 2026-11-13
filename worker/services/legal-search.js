// worker/services/legal-search.js
// بحث قانوني + توليد مستندات — Vectorize (RAG) + bge-m3 + Claude + Llama fallback

async function callAI(env, prompt, maxTokens = 1500, systemPrompt = null) {
  const defaultSystem = `أنت مستشار قانوني مصري خبير، بتفكر زي محامٍ شاطر مش زي روبوت.
- بتحلل النصوص القانونية وتستنتج منها إجابات عملية.
- بتربط المواد القانونية ببعضها لو ده يخدم الإجابة.
- بتبين للمستخدم إيه اللي في صالحه وإيه اللي ضده.
- بترد بالعربية الفصحى الرسمية.
- لا تخترع مواد قانونية غير موجودة في النصوص المرفقة.
- لو النصوص مش كافية، قول "النصوص المتاحة مش كافية" واشرح إيه اللي ناقص.`;

  if (env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: Math.min(maxTokens, 1024),
          system: systemPrompt || defaultSystem,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        if (text) return text;
      } else {
        console.warn('Claude error:', res.status, await res.text());
      }
    } catch (e) {
      console.warn('Claude failed, fallback to Llama:', e.message);
    }
  }

  if (env.AI) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: systemPrompt || defaultSystem },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
      });
      return response.response || '';
    } catch (e) {
      console.error('Llama also failed:', e.message);
    }
  }

  throw new Error('No AI model available');
}

const UNSUPPORTED_TOPICS = [
  'زواج', 'طلاق', 'خلع', 'نفقة', 'حضانة', 'ميراث', 'وصية',
  'أحوال شخصية', 'عقد زواج', 'عرفي', 'مهر', 'عدة', 'نسب',
  'رؤية', 'حضانة أطفال', 'ولاية', 'وصاية', 'قوامة',
];

export async function legalSearch(env, query) {
  const safeQuery = String(query).slice(0, 500);

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
     FROM law_articles WHERE id IN (${placeholders})`
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
    return { answer: answer || buildFallbackAnswer(results), sources: results };
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
     FROM law_articles WHERE ${conditions} LIMIT 10`
  ).bind(...binds).all();
  const results = r.results || [];
  if (!results.length) return { answer: 'مفيش نصوص قانونية تطابق السؤال.', sources: [] };
  const context = results.map((r, i) => `[${i + 1}] ${r.law_name} — ${r.article_number}:\n${r.article_text}`).join('\n\n');
  const prompt = `أنت محامٍ مصري. حلل السؤال ده بناءً على النصوص دي:\n\n${context}\n\nالسؤال: ${query}\n\nجاوب بتحليل قانوني (مش مجرد سرد). لو النصوص مش متعلقة، قول "النصوص مش كافية".`;
  try {
    const answer = await callAI(env, prompt, 1000);
    return { answer: answer || buildFallbackAnswer(results), sources: results };
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
export async function searchLegalDb(env, query) {
  const safeQuery = String(query).slice(0, 500);

  // كشف المواضيع غير المغطاة
  const lowerQuery = safeQuery.toLowerCase();
  const unsupportedTopic = UNSUPPORTED_TOPICS.find(t => lowerQuery.includes(t));

  if (unsupportedTopic) {
    return {
      source: 'db',
      warning: 'unsupported_topic',
      message: 'الموضوع ده (أحوال شخصية) مش مغطى في قاعدة البيانات. استخدم search_web أو وجّه المستخدم للمصادر الشرعية.',
      results: [],
    };
  }

  let queryEmbedding;
  try {
    const aiResponse = await env.AI.run('@cf/baai/bge-m3', { text: [safeQuery] });
    queryEmbedding = aiResponse.data[0];
  } catch (e) {
    return { error: 'Embedding failed', results: [] };
  }

  let vectorResults;
  try {
    vectorResults = await env.VECTORIZE.query(queryEmbedding, {
      topK: 10,
      returnMetadata: 'none',
    });
  } catch (e) {
    return { error: 'Vectorize query failed', results: [] };
  }

  if (!vectorResults.matches || vectorResults.matches.length === 0) {
    return { source: 'db', results: [], message: 'مفيش نتايج في الداتابيز' };
  }

  const THRESHOLD = 0.5;
  const filteredMatches = vectorResults.matches.filter(m => (m.score ?? 0) >= THRESHOLD);

  if (filteredMatches.length === 0) {
    return { source: 'db', results: [], message: 'مفيش نتايج كافية في الداتابيز' };
  }

  const ids = filteredMatches.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');
  const dbResult = await env.DB.prepare(
    `SELECT id, law_name, law_number, article_number, article_text, source_url
     FROM law_articles WHERE id IN (${placeholders})`
  ).bind(...ids).all();

  const byId = new Map(dbResult.results.map(r => [String(r.id), r]));
  const results = filteredMatches
    .map(m => byId.get(String(m.id)))
    .filter(Boolean)
    .map(r => ({
      law_name: r.law_name,
      law_number: r.law_number,
      article_number: r.article_number,
      article_text: r.article_text,
      source_url: r.source_url,
    }));

  return {
    source: 'db',
    results,
    count: results.length,
  };
}

// ============================================================
// توليد المستندات
// ============================================================
export async function generateDocument(env, { doc_type, facts, parties, extra, case_id }) {
  const safeFacts = String(facts || '').trim().slice(0, 3000);
  const safeParties = String(parties || '').trim().slice(0, 500);
  const safeExtra = String(extra || '').trim().slice(0, 800);
  if (!safeFacts) return { error: 'اكتب الوقائع' };

  let caseContext = '';
  if (case_id) {
    try {
      const c = await env.DB.prepare(
        `SELECT c.case_number, c.court, c.case_type, c.status, cl.name as client_name
         FROM cases c LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.id = ?`
      ).bind(case_id).first();
      if (c) {
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
    const document = await callAI(env, prompt, 1500);
    return {
      document: document || buildTemplateDocument(doc_type, safeFacts, safeParties, safeExtra),
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