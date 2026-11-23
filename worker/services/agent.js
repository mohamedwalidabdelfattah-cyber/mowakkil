// worker/services/agent.js
// Agent ذكي — نماذج مجانية (Groq/Gemini/Workers AI) + دقة المصادر + عربية فصحى
import { chatCompletion } from './llm.js';

const SYSTEM_PROMPT = `أنت مستشار قانوني مصري خبير، بتفكر زي محامٍ شاطر مش زي روبوت.

**قواعدك الصارمة (بالترتيب):**

1. **لو المستخدم سأل سؤال قانوني عادي** (مدني، جنائي، تجاري، إداري)، استخدم أداة "search_legal_db" عشان تدور في قاعدة البيانات القانونية المصرية (5,828 مادة).

2. **لو السؤال عن أحوال شخصية** (زواج، طلاق، خلع، نفقة، حضانة، ميراث، وصية، تسليم صغير)، **الأول استخدم أداة "search_web"** عشان تدور في الإنترنت.

3. **لو السؤال محتاج معلومات حديثة** (أحكام جديدة، تعديلات تشريعية)، استخدم "search_web".

4. **ممكن تستخدم الأداتين مع بعض** لو محتاج.

5. **حلل النتايج** واربط المعلومات ببعضها.

6. **الأرقام والمواعيد المحددة (مهم جداً):**
   - لو السؤال عن **سن الحضانة**، **سن الولاية**، **مدة العدة**، **مدة النفقة**، **مدة الاستئناف**، أو أي **رقم/مدة/سن**، لازم تدور في الويب لحد ما تلاقي **الرقم الدقيق من مصدر قانوني موثوق**.
   - **اذكر الرقم صريح** في الملخص والتحليل.
   - لو مش لاقي، قول "المعلومة دي مش متاحة في المصادر المتاحة".

7. **دقة المصادر:**
   - لو من الداتابيز: "المادة X من قانون Y" — بس لو متأكد 100%.
   - لو من الويب: "المصدر: [اسم الموقع] - [الرابط]".
   - **ممنوع** تخترع أرقام مواد أو مبالغ أو أسماء.
   - لو الملف المرفق فيه بيانات ناقصة (زي "مبلغ ..........." أو "اسم ...........")، قول "المبلغ غير محدد في الملف" أو "الاسم غير محدد". **متخترعش** أرقام أو أسماء.

8. **اللغة (مهم جداً):**
   - اكتب **بالعربية الفصحى 100%**.
   - **ممنوع تماماً** تكتب أي كلمة إنجليزية جوه الرد العربي (زي "addressed" أو "Interpretation" أو "review" أو "cases" أو "personal status" أو "damage" أو "divorce" أو "custody").
   - لو محتاج مصطلح قانوني أجنبي، اكتبه بالعربي الأول وبعدين بين قوسين لو لزم: "التفسير (Interpretation)".
   - لو الموديل بيطلع كلمات إنجليزية، **استبدلها فوراً** بالبديل العربي قبل ما تكتب الرد.

9. **ردودك منظمة:** ملخص → تحليل → توصيات → مصادر.

10. **لو المستخدم رفع ملف**، حلل محتواه بس اللي موجود فعلاً.

11. **ممنوع ترفض** الإجابة على سؤال عن أحوال شخصية من غير ما تحاول تدور في الويب الأول.

**أمثلة على الكلمات الممنوعة:** addressed, Interpretation, review, cases, personal, status, damage, divorce, custody, inheritance, law, article, court, judge, contract, agreement.
**البدائل العربية:** موجّه، تفسير، مراجعة، حالات، شخصية، وضع، ضرر، طلاق، حضانة، ميراث، قانون، مادة، محكمة، قاضي، عقد، اتفاق.`;

// ============================================================
// الأدوات (Tools)
// ============================================================
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_legal_db',
      description: 'ابحث في قاعدة البيانات القانونية المصرية (5,828 مادة) عن مواد ذات صلة. استخدمها لأي سؤال قانوني عادي (مدني، جنائي، تجاري، إداري).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'السؤال أو الكلمات المفتاحية' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'ابحث في الإنترنت عن معلومات قانونية حديثة، أحكام، تفسيرات، أرقام دقيقة (سن الحضانة، مدة العدة، إلخ)، أو أي حاجة مش في الداتابيز.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'سؤال البحث' },
        },
        required: ['query'],
      },
    },
  },
];

// ============================================================
// تنفيذ الأدوات
// ============================================================
async function executeTool(env, toolName, args) {
  if (toolName === 'search_legal_db') {
    const { searchLegalDb } = await import('./legal-search.js');
    return await searchLegalDb(env, args.query);
  }
  if (toolName === 'search_web') {
    return await searchWeb(env, args.query);
  }
  return { error: 'أداة غير معروفة' };
}

async function searchWeb(env, query) {
  const tavilyKey = String(env.TAVILY_API_KEY || '').trim();
  if (tavilyKey.length < 20) {
    return { error: 'TAVILY_API_KEY مش متظبط', results: [] };
  }

  try {
    // ✅ max_results 8 + advanced + include_answer
    // ✅ basic = كريدت واحد بدل اتنين (الخطة المجانية 1000 كريدت/شهر)
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tavilyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: String(query).slice(0, 400),
        search_depth: env.TAVILY_DEPTH || 'basic',
        max_results: 6,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return { error: `Tavily error: ${res.status}`, results: [] };
    }

    const data = await res.json();
    const results = (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: (r.content || '').slice(0, 800),
    }));

    return {
      source: 'web',
      results,
      tavily_answer: data.answer || null,
      query,
    };
  } catch (e) {
    return { error: e.message, results: [] };
  }
}

// ============================================================
// Chat with Agent — نماذج مجانية: Groq → Gemini → Groq Llama → Workers AI
// ============================================================
const MAX_HISTORY = 12;         // آخر 12 رسالة بس عشان منعديش context الموديل
const MAX_TOOL_RESULT = 9000;   // حد حجم نتيجة الأداة اللي بترجع للموديل

export async function chatWithAgent(env, messages, officeId, attachmentText = null) {
  let processedMessages = messages.slice(-MAX_HISTORY);
  if (processedMessages[0]?.role === 'assistant') processedMessages = processedMessages.slice(1);

  if (attachmentText && processedMessages.length > 0) {
    const lastMsg = processedMessages[processedMessages.length - 1];
    if (lastMsg.role === 'user') {
      processedMessages[processedMessages.length - 1] = {
        role: 'user',
        content: `${lastMsg.content}\n\n---\n📎 **محتوى الملف المرفق:**\n${attachmentText}`,
      };
    }
  }

  const currentMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...processedMessages,
  ];

  const MAX_ITERATIONS = 5;
  let provider = '';

  for (let iterations = 1; iterations <= MAX_ITERATIONS; iterations++) {
    // في آخر لفة بنمنع الأدوات عشان الموديل يكتب الإجابة النهائية
    const lastRound = iterations === MAX_ITERATIONS;
    const { message, provider: p } = await chatCompletion(env, {
      messages: currentMessages,
      tools: lastRound ? null : TOOLS,
      maxTokens: 2500,
      temperature: 0.2,
    });
    provider = p;

    if (message.tool_calls?.length && !lastRound) {
      currentMessages.push(message);
      for (const toolCall of message.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.warn('tool args parse failed:', e.message);
        }
        const toolResult = await executeTool(env, toolCall.function.name, args);
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult).slice(0, MAX_TOOL_RESULT),
        });
      }
      continue;
    }

    return {
      answer: message.content || '',
      usedTools: currentMessages.some(m => m.role === 'tool'),
      iterations,
      provider,
    };
  }

  throw new Error('وصلنا للحد الأقصى من المحاولات');
}