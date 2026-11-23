// worker/services/model-discovery.js
// اكتشاف تلقائي للنماذج المجانية المتاحة حالياً عند كل مزود.
// الفكرة: أسماء النماذج بتتغير (مثلاً gemini-2.5-flash اتقفل للحسابات الجديدة)،
// فبدل ما نكتب اسم ثابت في الكود، بنسأل كل مزود عن قايمته ونختار الأفضل بقواعد واضحة.
//
// - النتيجة بتتخزن في KV لمدة 36 ساعة + في ذاكرة الـ isolate.
// - بتتحدث لوحدها كل يوم من الـ cron، أو فوراً لو نموذج رجّع "مش موجود".
// - لو الاكتشاف فشل لأي سبب → بنرجع لقايمة افتراضية آمنة.

const KV_KEY = 'llm:models:v1';
// الـ cron بيحدّث كل يوم، والـ TTL أطول من يوم عشان المستخدم عمره ما يستنى اكتشاف جديد
const TTL_SECONDS = 36 * 60 * 60;
const secret = (env, name) => String(env?.[name] ?? '').trim();

// قوايم افتراضية (لو الاكتشاف فشل). gemini-flash-latest اسم بيشاور دايماً على أحدث Flash.
export const DEFAULT_MODELS = {
  groq: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
  gemini: ['gemini-flash-latest', 'gemini-flash-lite-latest'],
  openrouter: [],
};

let memo = null; // { at, models }

// ---------------- Gemini ----------------
// بنختار Flash (سريع + حصة مجانية كبيرة)، المستقر قبل التجريبي، والأحدث رقماً قبل الأقدم.
function geminiScore(name) {
  const n = name.toLowerCase();
  let s = 0;
  if (n.includes('flash')) s += 100;
  if (n.includes('lite')) s -= 30;                 // أضعف — احتياطي
  if (/preview|exp|experimental/.test(n)) s -= 20; // تجريبي — بيتشال فجأة
  if (n.endsWith('-latest')) s += 15;              // اسم ثابت بيتحدث لوحده
  const v = n.match(/gemini-(\d+(?:\.\d+)?)/);
  if (v) s += parseFloat(v[1]) * 10;               // 3.0 > 2.5
  return s;
}

async function discoverGemini(env) {
  const key = secret(env, 'GEMINI_API_KEY');
  if (key.length < 20) return null;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`gemini models ${res.status}`);
  const data = await res.json();
  const names = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => String(m.name || '').replace(/^models\//, ''))
    .filter(n => n.startsWith('gemini-'))
    // مش نماذج كلام عادي: صور/صوت/تضمين/لايف/استخدام كمبيوتر
    .filter(n => !/image|tts|audio|embedding|live|vision|computer-use|robotics|native/.test(n));
  return [...new Set(names)].sort((a, b) => geminiScore(b) - geminiScore(a)).slice(0, 4);
}

// ---------------- Groq ----------------
// بنفضّل نماذج كبيرة بتدعم الأدوات (tools)، وبنستبعد الصوت/الحماية.
const GROQ_PREFERRED = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b', 'openai/gpt-oss-20b'];

async function discoverGroq(env) {
  const key = secret(env, 'GROQ_API_KEY');
  if (key.length < 20) return null;
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`groq models ${res.status}`);
  const data = await res.json();
  const ids = (data.data || [])
    .filter(m => m.active !== false)
    .map(m => String(m.id || ''))
    .filter(id => id && !/whisper|guard|tts|playai|distil|prompt-guard|compound/.test(id));
  const preferred = GROQ_PREFERRED.filter(id => ids.includes(id));
  // أي نموذج كبير جديد مش في القايمة (70b / 120b ...) ييجي بعدهم
  const others = ids.filter(id => !preferred.includes(id) && /(70b|120b|405b|235b|kimi|qwen3)/i.test(id));
  return [...preferred, ...others].slice(0, 4);
}

// ---------------- OpenRouter (اختياري) ----------------
// النماذج المجانية عندهم اسمها بيخلص بـ :free. بنختار الكبيرة اللي بتدعم أدوات وسياق طويل.
async function discoverOpenRouter(env) {
  const key = secret(env, 'OPENROUTER_API_KEY');
  if (key.length < 20) return null;
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`openrouter models ${res.status}`);
  const data = await res.json();
  const free = (data.data || []).filter(m =>
    String(m.id).endsWith(':free') &&
    Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0 &&
    (m.context_length || 0) >= 32000);
  const score = m => (m.supported_parameters?.includes('tools') ? 1000 : 0) + Math.min(500, (m.context_length || 0) / 1000);
  return free.sort((a, b) => score(b) - score(a)).slice(0, 3).map(m => m.id);
}

// ---------------- تجربة فعلية لكل نموذج ----------------
// القايمة لوحدها مش كفاية: Google مثلاً لسه بيعرض gemini-2.5-flash في القايمة
// بس بيرفضه للحسابات الجديدة. فبنبعت سؤال صغير جداً ونحتفظ باللي بيرد بس.
export const ENDPOINTS = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: 'GROQ_API_KEY' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: 'GEMINI_API_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', key: 'OPENROUTER_API_KEY' },
};

async function probe(env, provider, model) {
  const ep = ENDPOINTS[provider];
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret(env, ep.key)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ok' }], max_tokens: 16 }),
    signal: AbortSignal.timeout(20000),
  });
  // 429 = النموذج موجود بس الحصة خلصت مؤقتاً → نعتبره شغال
  return res.ok || res.status === 429;
}

async function keepWorking(env, provider, list) {
  const good = [];
  for (const m of list) {
    try { if (await probe(env, provider, m)) good.push(m); } catch {}
    if (good.length >= 2) break; // كفاية اتنين شغالين لكل مزود (توفير للحصة)
  }
  return good;
}

/** يسأل كل المزودين، يجرب نماذجهم، ويحفظ الشغال. أي مزود يفشل → قايمته الافتراضية. */
export async function refreshModels(env) {
  const models = {}; const errors = {};
  const jobs = { gemini: discoverGemini, groq: discoverGroq, openrouter: discoverOpenRouter };
  await Promise.all(Object.entries(jobs).map(async ([name, fn]) => {
    try {
      const list = await fn(env);
      if (list === null) { models[name] = DEFAULT_MODELS[name]; return; } // مفيش مفتاح
      const candidates = [...new Set([...(list || []), ...DEFAULT_MODELS[name]])];
      const working = await keepWorking(env, name, candidates);
      if (!working.length) errors[name] = 'مفيش نموذج رد في التجربة (المفتاح أو الحصة)';
      models[name] = working.length ? working : candidates.slice(0, 2);
    } catch (e) {
      errors[name] = e.message;
      models[name] = DEFAULT_MODELS[name];
    }
  }));
  const snapshot = { at: new Date().toISOString(), models, errors };
  memo = { at: Date.now(), models };
  try { await env.RATE_LIMIT_KV?.put(KV_KEY, JSON.stringify(snapshot), { expirationTtl: TTL_SECONDS }); } catch {}
  return snapshot;
}

/** قايمة النماذج الحالية (من الذاكرة ← KV ← اكتشاف جديد). */
export async function getModels(env) {
  if (memo && Date.now() - memo.at < 10 * 60 * 1000) return memo.models;
  try {
    const raw = await env.RATE_LIMIT_KV?.get(KV_KEY);
    if (raw) {
      const snap = JSON.parse(raw);
      memo = { at: Date.now(), models: snap.models };
      return snap.models;
    }
  } catch {}
  try { return (await refreshModels(env)).models; }
  catch { return DEFAULT_MODELS; }
}

/** آخر نتيجة اكتشاف (للسوبر أدمن). */
export async function getModelsSnapshot(env) {
  try {
    const raw = await env.RATE_LIMIT_KV?.get(KV_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/** نموذج رجّع "مش موجود/اتقفل" → نشيله فوراً من الذاكرة ومن KV (والاكتشاف الجاي هيجيب البديل). */
export async function markModelGone(env, provider, model) {
  if (memo?.models?.[provider]) memo.models[provider] = memo.models[provider].filter(m => m !== model);
  try {
    const raw = await env.RATE_LIMIT_KV?.get(KV_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    snap.models[provider] = (snap.models[provider] || []).filter(m => m !== model);
    if (!snap.models[provider].length) { await env.RATE_LIMIT_KV.delete(KV_KEY); memo = null; return; }
    await env.RATE_LIMIT_KV.put(KV_KEY, JSON.stringify(snap), { expirationTtl: TTL_SECONDS });
  } catch {}
}
