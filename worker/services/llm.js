// worker/services/llm.js
// سلسلة موديلات مجانية بالكامل (مفيش أي مزود محتاج بطاقة دفع).
// أسماء النماذج مش ثابتة: بتيجي من model-discovery.js اللي بيسأل كل مزود عن
// النماذج المتاحة حالياً ويجربها (وبيتحدث كل يوم لوحده). الترتيب:
//   Gemini → NVIDIA → Groq → Mistral → Cerebras → (النماذج التانية لكل مزود) → OpenRouter → Workers AI
//   أي مزود مفتاحه مش متحط بيتخطّى لوحده.
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
  const mistral = list('mistral');
  const cerebras = list('cerebras');
  const nvidia = list('nvidia');
  // الأقوى في العربي الأول، وأي مزود حصته خلصت (429) بننتقل للي بعده فوراً
  // (NVIDIA وMistral وOpenRouter بيتشالوا لوحدهم من أي طلب فيه بيانات موكلين — noClientData)
  const order = [
    ['gemini', gemini[0]], ['nvidia', nvidia[0]], ['groq', groq[0]],
    ['mistral', mistral[0]], ['cerebras', cerebras[0]],
    ['gemini', gemini[1]], ['nvidia', nvidia[1]], ['groq', groq[1]],
    ['mistral', mistral[1]], ['cerebras', cerebras[1]],
    ['openrouter', openrouter[0]], ['openrouter', openrouter[1]],
  ];
  return order
    .filter(([p, m]) => m && secret(env, ENDPOINTS[p].key).length >= 20)
    .map(([p, m]) => ({ name: p, key: ENDPOINTS[p].key, url: ENDPOINTS[p].url, model: m, tools: true, noClientData: !!ENDPOINTS[p].noClientData }));
}

// نماذج OpenAI اللي "بتفكر" (gpt-5، o3…) بترفض max_tokens و temperature غير 1
export function tokenParams(model, maxTokens, temperature) {
  return /(^|\/)(gpt-5|o\d)/i.test(String(model))
    ? { max_completion_tokens: Math.max(maxTokens, 1000) }
    : { max_tokens: maxTokens, temperature };
}

// نموذج حصته خلصت (429) → بنعدّيه لحد ما المدة تخلص، عشان الطلبات الجاية متستناش عليه
const cooling = new Map(); // "provider/model" → وقت الرجوع
function coolDown(provider, model, retryAfter) {
  const sec = Math.min(3600, Math.max(30, Number(retryAfter) || 60));
  cooling.set(`${provider}/${model}`, Date.now() + sec * 1000);
}
const isCooling = p => (cooling.get(`${p.name}/${p.model}`) || 0) > Date.now();

// الأخطاء اللي معناها إن النموذج نفسه مبقاش متاح (مش مشكلة مؤقتة)
const MODEL_GONE = /\b(404)\b|no longer available|not found|does not exist|decommissioned|deprecated|model_not_found|invalid model/i;

const WORKERS_AI_MODEL = '@cf/openai/gpt-oss-120b';
const WORKERS_AI_FALLBACK = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// المفتاح بعد شيل أي مسافات/سطر جديد اتلزق معاه وقت الحفظ
export const secret = (env, name) => String(env?.[name] ?? '').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  const body = { model: p.model, messages: messages.map(cleanMessage), ...tokenParams(p.model, maxTokens, temperature) };
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
    if (res.status === 429) coolDown(p.name, p.model, res.headers.get('retry-after'));
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

// الوضع السري: نماذج Cloudflare بس. Llama 4 Scout سياقه طويل (مناسب لمستندات القضية) وأرخص في الحصة.
const STRICT_MODELS = [WORKERS_AI_MODEL, '@cf/meta/llama-4-scout-17b-16e-instruct', WORKERS_AI_FALLBACK];

// الردود بتيجي بأشكال مختلفة حسب النموذج (Llama: response — gpt-oss: Responses API أو chat completions)
function workersAIText(r) {
  if (typeof r === 'string') return r;
  if (typeof r?.response === 'string') return r.response;
  const c = r?.choices?.[0]?.message?.content;
  if (typeof c === 'string' && c) return c;
  if (typeof r?.output_text === 'string' && r.output_text) return r.output_text;
  if (Array.isArray(r?.output)) {
    const t = r.output.filter(o => o?.type === 'message')
      .flatMap(o => o.content || []).filter(x => x?.type === 'output_text' || typeof x?.text === 'string')
      .map(x => x.text).join('');
    if (t) return t;
  }
  return r?.response != null ? JSON.stringify(r.response) : '';
}

async function callWorkersAI(env, { messages, maxTokens, temperature, model = WORKERS_AI_MODEL }) {
  if (!env.AI) throw new Error('Workers AI binding مش موجود');
  const msgs = messages.map(m => {
    if (m.role === 'tool') return { role: 'user', content: `نتيجة البحث: ${m.content}` };
    return { role: m.role, content: m.content || '' };
  });
  let r;
  if (/gpt-oss/.test(model)) {
    // gpt-oss على Cloudflare بياخد صيغة Responses API: instructions + input
    const instructions = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const input = msgs.filter(m => m.role !== 'system');
    r = await env.AI.run(model, {
      ...(instructions ? { instructions } : {}),
      input,
      max_output_tokens: Math.max(maxTokens, 1000),
      reasoning: { effort: 'low' },
    });
  } else {
    r = await env.AI.run(model, { messages: msgs, max_tokens: maxTokens, temperature });
  }
  const text = workersAIText(r);
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
  // خصوصية بيانات الموكلين:
  //   route: 'any' (أسئلة عامة) | 'balanced' (من غير OpenRouter) | 'strict' (Cloudflare بس)
  //   masker: من lib/redact.js — بيخفي البيانات الشخصية قبل الإرسال ويرجّعها في الرد
  route = 'any',
  masker = null,
} = {}) {
  const errors = [];
  const outMessages = masker
    ? messages.map(m => (typeof m.content === 'string' ? { ...m, content: masker.mask(m.content) } : m))
    : messages;
  const finish = (message, provider, model) => {
    // tool_calls بتفضل بالرموز (عشان البحث على النت ميطلعش فيه أسماء حقيقية)
    if (masker && message.content) message = { ...message, content: masker.unmask(message.content) };
    return { message, provider, model, errors };
  };

  if (route !== 'strict') {
    let attempts = [];
    try { attempts = await buildAttempts(env); } catch (e) { errors.push(`discovery: ${e.message}`); }
    // المزودين اللي خطتهم المجانية بتدرّب على المدخلات (OpenRouter، Mistral) → مستبعدين لأي بيانات موكلين
    if (route === 'balanced') attempts = attempts.filter(p => !p.noClientData);

    for (const p of attempts) {
      if (skip.includes(p.name) || isCooling(p)) continue;
      try {
        const message = await callOpenAICompatible(env, p, { messages: outMessages, tools, maxTokens, temperature, timeoutMs });
        return finish(message, p.name, p.model);
      } catch (e) {
        console.warn(`LLM provider failed: ${e.message}`);
        errors.push(e.message);
        // النموذج اتقفل/اتشال → نشيله من القايمة عشان الطلبات الجاية متضيعش وقت عليه
        if (e.modelGone) await markModelGone(env, p.name, p.model);
      }
    }
  }

  if (!skip.includes('workers-ai')) {
    const models = route === 'strict' ? STRICT_MODELS : [WORKERS_AI_MODEL, WORKERS_AI_FALLBACK];
    for (const model of models) {
      try {
        const message = await callWorkersAI(env, { messages: outMessages, maxTokens, temperature, model });
        return finish(message, 'workers-ai', model);
      } catch (e) {
        console.warn(`LLM provider failed: workers-ai/${model} ${e.message}`);
        errors.push(`workers-ai/${model}: ${e.message}`);
      }
    }
  }

  if (route === 'strict') {
    const quota = errors.some(e => /4006|daily free allocation|neurons|quota/i.test(e));
    throw new Error(quota
      ? 'الحصة اليومية المجانية للوضع السري (Cloudflare) خلصت. جرب بكرة، أو حوّل المكتب للوضع "المتوازن" من الإعدادات.'
      : 'نموذج الوضع السري (Cloudflare) مش متاح دلوقتي. جرب تاني بعد دقيقة.');
  }
  // تنبيه صاحب النظام لو ده اتكرر (lib/monitor.js)
  try { const { noteAiDown } = await import('../lib/monitor.js'); await noteAiDown(env, errors[errors.length - 1]); } catch {}
  throw new Error('كل نماذج الذكاء الاصطناعي المجانية مش متاحة دلوقتي. جرب تاني بعد دقيقة.');
}

/** نص بسيط: system + user → نص الرد */
export async function completeText(env, { system, prompt, maxTokens = 1500, temperature = 0.2, route = 'any', masker = null }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const { message, provider } = await chatCompletion(env, { messages, maxTokens, temperature, route, masker });
  return { text: message.content || '', provider };
}

/** فحص سريع لكل مزود (للسوبر أدمن). refresh=true → يعيد اكتشاف النماذج الأول. */
export async function providersHealth(env, { refresh = true } = {}) {
  const ping = [{ role: 'user', content: 'رد بكلمة واحدة: تمام' }];
  const out = [];
  if (refresh) { try { await refreshModels(env); } catch {} await sleep(1500); }
  // بعض المزودين (Mistral المجاني) حدّهم طلب واحد في الثانية → ثانية بين أي طلبين لنفس المزود
  const last = {};
  const pace = async name => { const w = (last[name] || 0) + 1100 - Date.now(); if (w > 0) await sleep(w); last[name] = Date.now(); };

  // مزود مفتاحه ناقص → نوضح السبب
  for (const [name, ep] of Object.entries(ENDPOINTS)) {
    const key = secret(env, ep.key);
    if (key.length >= 20) continue;
    if (ep.optional && !key) continue; // مزود اختياري ومفتاحه مش متحط
    out.push({ provider: name, model: '', ok: false,
      error: key ? `${ep.key} قيمته غلط (${key.length} حرف) — اعمله من جديد` : `${ep.key} مش متظبط` });
  }

  for (const p of await buildAttempts(env)) {
    await pace(p.name);
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
