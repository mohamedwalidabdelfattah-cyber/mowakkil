// worker/services/llm.js
// سلسلة موديلات مجانية بالكامل (مفيش أي مزود محتاج بطاقة دفع).
// أسماء النماذج مش ثابتة: بتيجي من model-discovery.js اللي بيسأل كل مزود عن
// النماذج المتاحة حالياً ويجربها (وبيتحدث كل يوم لوحده). الترتيب:
//   Groq (أفضل نموذج) → Gemini (أفضل نموذج) → Groq (التاني) → Gemini (التاني) → OpenRouter (مجاني) → Workers AI
// لو نموذج رجّع "مش موجود/اتقفل" بيتشال فوراً وبننتقل للي بعده — المستخدم مش بيحس بحاجة.

import { getModels, markModelGone, refreshModels, ENDPOINTS } from './model-discovery.js';

// GROQ_MODEL / GEMINI_MODEL في [vars] لو حبيت تفرض نموذج معيّن (اختياري)
async function buildAttempts(env) {
  const models = await getModels(env);
  const list = (provider, override) => {
    const arr = [...(models?.[provider] || [])];
    if (override && !arr.includes(override)) arr.unshift(override);
    return arr;
  };
  const groq = list('groq', env.GROQ_MODEL);
  const gemini = list('gemini', env.GEMINI_MODEL);
  const openrouter = list('openrouter');
  const order = [
    ['groq', groq[0]], ['gemini', gemini[0]],
    ['groq', groq[1]], ['gemini', gemini[1]],
    ['openrouter', openrouter[0]], ['openrouter', openrouter[1]],
  ];
  return order
    .filter(([p, m]) => m && secret(env, ENDPOINTS[p].key).length >= 20)
    .map(([p, m]) => ({ name: p, key: ENDPOINTS[p].key, url: ENDPOINTS[p].url, model: m, tools: true }));
}

// الأخطاء اللي معناها إن النموذج نفسه مبقاش متاح (مش مشكلة مؤقتة)
const MODEL_GONE = /\b(404)\b|no longer available|not found|does not exist|decommissioned|deprecated|model_not_found|invalid model/i;

const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// المفتاح بعد شيل أي مسافات/سطر جديد اتلزق معاه وقت الحفظ
export const secret = (env, name) => String(env?.[name] ?? '').trim();
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
    model: p.model,
    messages: messages.map(cleanMessage),
    max_tokens: maxTokens,
    temperature,
  };
  if (tools?.length && p.tools) body.tools = tools;

  const res = await fetch(p.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret(env, p.key)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`${p.name}/${p.model} ${res.status}: ${txt.slice(0, 200)}`);
    err.modelGone = (res.status === 404 || res.status === 400) && MODEL_GONE.test(`${res.status} ${txt}`);
    throw err;
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
  let attempts = [];
  try { attempts = await buildAttempts(env); } catch (e) { errors.push(`discovery: ${e.message}`); }

  for (const p of attempts) {
    if (skip.includes(p.name)) continue;
    try {
      const message = await callOpenAICompatible(env, p, { messages, tools, maxTokens, temperature, timeoutMs });
      return { message, provider: p.name, model: p.model, errors };
    } catch (e) {
      console.warn(`LLM provider failed: ${e.message}`);
      errors.push(e.message);
      // النموذج اتقفل/اتشال → نشيله من القايمة عشان الطلبات الجاية متضيعش وقت عليه
      if (e.modelGone) await markModelGone(env, p.name, p.model);
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

/** فحص سريع لكل مزود (للسوبر أدمن). refresh=true → يعيد اكتشاف النماذج الأول. */
export async function providersHealth(env, { refresh = true } = {}) {
  const ping = [{ role: 'user', content: 'رد بكلمة واحدة: تمام' }];
  const out = [];
  if (refresh) { try { await refreshModels(env); } catch {} }

  // مزود مفتاحه ناقص → نوضح السبب
  for (const [name, ep] of Object.entries(ENDPOINTS)) {
    const key = secret(env, ep.key);
    if (key.length >= 20) continue;
    if (name === 'openrouter' && !key) continue; // اختياري
    out.push({ provider: name, model: '', ok: false,
      error: key ? `${ep.key} قيمته غلط (${key.length} حرف) — اعمله من جديد` : `${ep.key} مش متظبط` });
  }

  for (const p of await buildAttempts(env)) {
    const t0 = Date.now();
    try {
      // 400 توكن عشان الموديلات اللي "بتفكر" الأول يلحقوا يردوا
      await callOpenAICompatible(env, p, { messages: ping, maxTokens: 400, temperature: 0, timeoutMs: 20000 });
      out.push({ provider: p.name, model: p.model, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      out.push({ provider: p.name, model: p.model, ok: false, error: e.message.slice(0, 200) });
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
