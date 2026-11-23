// worker/services/llm.js
// سلسلة موديلات مجانية بالكامل (مفيش أي مزود محتاج بطاقة دفع):
//   1) Groq        — openai/gpt-oss-120b   (مفتاح مجاني من console.groq.com)
//   2) Gemini      — gemini-2.5-flash      (مفتاح مجاني من aistudio.google.com)
//   3) Groq        — llama-3.3-70b-versatile (حد منفصل عن الأول)
//   4) Workers AI  — llama-3.3-70b         (الحصة المجانية اليومية في Cloudflare، صغيرة، آخر حل)
// كل مزود بيتجرب بمهلة زمنية، ولو فشل بننتقل للي بعده.

const PROVIDERS = [
  {
    name: 'groq',
    key: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: env => env.GROQ_MODEL || 'openai/gpt-oss-120b',
    tools: true,
  },
  {
    name: 'gemini',
    key: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: env => env.GEMINI_MODEL || 'gemini-2.5-flash',
    tools: true,
  },
  {
    name: 'groq-llama',
    key: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: () => 'llama-3.3-70b-versatile',
    tools: true,
  },
];

const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_TIMEOUT_MS = 45000;

// بننضف رسالة الـ assistant من أي حقول خاصة بمزود معين (زي reasoning في gpt-oss)
function cleanMessage(m) {
  const out = { role: m.role, content: m.content ?? '' };
  if (m.tool_calls?.length) {
    out.tool_calls = m.tool_calls.map(tc => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.function?.name, arguments: tc.function?.arguments || '{}' },
    }));
  }
  if (m.role === 'tool') out.tool_call_id = m.tool_call_id;
  return out;
}

async function callOpenAICompatible(env, p, { messages, tools, maxTokens, temperature, timeoutMs }) {
  const body = {
    model: p.model(env),
    messages: messages.map(cleanMessage),
    max_tokens: maxTokens,
    temperature,
  };
  if (tools?.length && p.tools) body.tools = tools;

  const res = await fetch(p.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env[p.key]}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${p.name} ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error(`${p.name}: رد فاضي`);
  if (!msg.content && !msg.tool_calls?.length) throw new Error(`${p.name}: مفيش محتوى`);
  return cleanMessage({ ...msg, role: 'assistant' });
}

async function callWorkersAI(env, { messages, maxTokens, temperature }) {
  if (!env.AI) throw new Error('Workers AI binding مش موجود');
  const r = await env.AI.run(WORKERS_AI_MODEL, {
    messages: messages.map(m => {
      if (m.role === 'tool') return { role: 'user', content: `نتيجة البحث: ${m.content}` };
      return { role: m.role, content: m.content || '' };
    }),
    max_tokens: maxTokens,
    temperature,
  });
  const text = typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response ?? '');
  if (!text) throw new Error('workers-ai: رد فاضي');
  return { role: 'assistant', content: text };
}

/**
 * chatCompletion — بيجرب المزودين بالترتيب ويرجع أول رد ناجح.
 * @returns {Promise<{ message: {role, content, tool_calls?}, provider: string, errors: string[] }>}
 */
export async function chatCompletion(env, {
  messages,
  tools = null,
  maxTokens = 2000,
  temperature = 0.2,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  skip = [],
} = {}) {
  const errors = [];

  for (const p of PROVIDERS) {
    if (!env[p.key] || skip.includes(p.name)) continue;
    try {
      const message = await callOpenAICompatible(env, p, { messages, tools, maxTokens, temperature, timeoutMs });
      return { message, provider: p.name, errors };
    } catch (e) {
      console.warn(`LLM provider failed: ${e.message}`);
      errors.push(e.message);
    }
  }

  if (!skip.includes('workers-ai')) {
    try {
      const message = await callWorkersAI(env, { messages, maxTokens, temperature });
      return { message, provider: 'workers-ai', errors };
    } catch (e) {
      console.warn(`LLM provider failed: workers-ai ${e.message}`);
      errors.push(`workers-ai: ${e.message}`);
    }
  }

  throw new Error('كل نماذج الذكاء الاصطناعي المجانية مش متاحة دلوقتي. جرب تاني بعد دقيقة.');
}

/** نص بسيط: system + user → نص الرد */
export async function completeText(env, { system, prompt, maxTokens = 1500, temperature = 0.2 }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const { message, provider } = await chatCompletion(env, { messages, maxTokens, temperature });
  return { text: message.content || '', provider };
}

/** فحص سريع لكل مزود (للسوبر أدمن) — بيبعت رسالة قصيرة جداً */
export async function providersHealth(env) {
  const ping = [{ role: 'user', content: 'رد بكلمة واحدة: تمام' }];
  const out = [];
  for (const p of PROVIDERS) {
    if (!env[p.key]) { out.push({ provider: p.name, model: p.model(env), ok: false, error: `${p.key} مش متظبط` }); continue; }
    const t0 = Date.now();
    try {
      await callOpenAICompatible(env, p, { messages: ping, maxTokens: 20, temperature: 0, timeoutMs: 15000 });
      out.push({ provider: p.name, model: p.model(env), ok: true, ms: Date.now() - t0 });
    } catch (e) {
      out.push({ provider: p.name, model: p.model(env), ok: false, error: e.message.slice(0, 200) });
    }
  }
  try {
    const t0 = Date.now();
    await callWorkersAI(env, { messages: ping, maxTokens: 10, temperature: 0 });
    out.push({ provider: 'workers-ai', model: WORKERS_AI_MODEL, ok: true, ms: Date.now() - t0 });
  } catch (e) {
    out.push({ provider: 'workers-ai', model: WORKERS_AI_MODEL, ok: false, error: e.message.slice(0, 200) });
  }
  return out;
}
