// worker/services/agent.js
// Agent ذكي — Groq (أساسي) + Cloudflare (fallback) + دقة المصادر + عربية فصحى

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
  if (!env.TAVILY_API_KEY) {
    return { error: 'TAVILY_API_KEY مش متظبط', results: [] };
  }

  try {
    // ✅ max_results 8 + advanced + include_answer
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.TAVILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: String(query).slice(0, 400),
        search_depth: 'advanced',
        max_results: 8,
        include_answer: true,
        include_raw_content: false,
      }),
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
// Chat with Agent — Groq (أساسي) + Cloudflare (fallback)
// ============================================================
export async function chatWithAgent(env, messages, officeId, attachmentText = null) {
  let processedMessages = [...messages];
  if (attachmentText && processedMessages.length > 0) {
    const lastMsg = processedMessages[processedMessages.length - 1];
    if (lastMsg.role === 'user') {
      processedMessages[processedMessages.length - 1] = {
        role: 'user',
        content: `${lastMsg.content}\n\n---\n📎 **محتوى الملف المرفق:**\n${attachmentText.slice(0, 3000)}`,
      };
    }
  }

  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...processedMessages,
  ];

  let currentMessages = [...fullMessages];
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let response = null;
    let usedProvider = '';

    // ============ المحاولة 1: Groq ============
    if (env.GROQ_API_KEY) {
      try {
        console.log('Trying Groq...');
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: currentMessages,
            tools: TOOLS,
            max_tokens: 2000,
            temperature: 0.2,
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          response = { choices: groqData.choices || [] };
          usedProvider = 'groq';
        } else {
          console.error('Groq failed:', groqRes.status);
        }
      } catch (e) {
        console.error('Groq error:', e.message);
      }
    }

    // ============ المحاولة 2: Cloudflare Fallback ============
    if (!response) {
      try {
        const cfRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: currentMessages.map(m => {
            if (m.role === 'tool') return { role: 'user', content: `نتيجة البحث: ${m.content}` };
            if (m.tool_calls) return { role: 'assistant', content: m.content || '' };
            return { role: m.role, content: m.content || '' };
          }),
          max_tokens: 2000,
          temperature: 0.2,
        });

        if (cfRes?.response) {
          response = {
            choices: [{ message: { role: 'assistant', content: cfRes.response } }],
          };
          usedProvider = 'cloudflare';
        }
      } catch (e) {
        console.error('Cloudflare error:', e.message);
      }
    }

    if (!response) throw new Error('كل الموديلات فشلت. جرب تاني بعد شوية.');

    const choice = response.choices?.[0];
    if (!choice) throw new Error('الرد فاضي من الموديل');

    const assistantMessage = choice.message;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.warn('tool args parse failed:', e.message);
        }

        console.log(`Executing tool: ${toolName}`, args);
        const toolResult = await executeTool(env, toolName, args);

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      continue;
    }

    return {
      answer: assistantMessage.content || '',
      usedTools: currentMessages.filter(m => m.role === 'tool').length > 0,
      iterations,
      provider: usedProvider,
    };
  }

  throw new Error('وصلنا للحد الأقصى من المحاولات');
}