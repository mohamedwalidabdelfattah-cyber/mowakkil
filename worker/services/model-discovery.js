// worker/services/model-discovery.js
// اكتشاف تلقائي للنماذج المجانية المتاحة حالياً عند كل مزود.
// الفكرة: أسماء النماذج بتتغير (مثلاً gemini-2.5-flash اتقفل للحسابات الجديدة)،
// فبدل ما نكتب اسم ثابت في الكود، بنسأل كل مزود عن قايمته ونختار الأفضل بقواعد واضحة.
//
// - النتيجة بتتخزن في KV لمدة 36 ساعة + في ذاكرة الـ isolate.
// - بتتحدث لوحدها كل يوم من الـ cron، أو فوراً لو نموذج رجّع "مش موجود".
// - لو الاكتشاف فشل لأي سبب → بنرجع لقايمة افتراضية آمنة.

const KV_KEY = 'llm:models:v3'; // v3: NVIDIA NIM اتضاف (11/2026). v2: Mistral/Cerebras (GitHub Models اتقفلت نهائياً 30/7/2026)
// الـ cron بيحدّث كل يوم، والـ TTL أطول من يوم عشان المستخدم عمره ما يستنى اكتشاف جديد
const TTL_SECONDS = 36 * 60 * 60;
const secret = (env, name) => String(env?.[name] ?? '').trim();

// قوايم افتراضية (لو الاكتشاف فشل). gemini-flash-latest اسم بيشاور دايماً على أحدث Flash.
export const DEFAULT_MODELS = {
  groq: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
  gemini: ['gemini-flash-latest', 'gemini-flash-lite-latest'],
  openrouter: [],
  mistral: ['mistral-large-latest', 'mistral-medium-latest'],
  cerebras: ['gpt-oss-120b'],
  nvidia: ['deepseek-ai/deepseek-v3.2', 'openai/gpt-oss-120b', 'qwen/qwen3-235b-a22b'],
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
const GROQ_PREFERRED = ['openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3.8-27b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];

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

// ---------------- Mistral (اختياري) ----------------
// Mistral Large قوي جداً في العربي. الخطة المجانية (Experiment) ممكن تستخدم البيانات في التدريب
// → زي OpenRouter: مستبعد من أي طلب فيه بيانات موكلين (route 'balanced').
const MISTRAL_PREFERRED = ['mistral-large-latest', 'mistral-medium-latest', 'magistral-medium-latest', 'mistral-saba-latest', 'mistral-small-latest'];
async function discoverMistral(env) {
  const key = secret(env, 'MISTRAL_API_KEY');
  if (key.length < 20) return null;
  const res = await fetch('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`mistral models ${res.status}`);
  const ids = ((await res.json()).data || []).map(m => String(m.id || ''));
  return MISTRAL_PREFERRED.filter(id => ids.includes(id)).slice(0, 3);
}

// ---------------- Cerebras (اختياري) ----------------
// أسرع استدلال (آلاف التوكنز في الثانية) — نماذج مفتوحة كبيرة.
async function discoverCerebras(env) {
  const key = secret(env, 'CEREBRAS_API_KEY');
  if (key.length < 20) return null;
  const res = await fetch('https://api.cerebras.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`cerebras models ${res.status}`);
  const ids = ((await res.json()).data || []).map(m => String(m.id || '')).filter(Boolean);
  const size = id => { const m = id.match(/(\d+)b/i); return m ? +m[1] : 0; };
  const score = id => (id === 'gpt-oss-120b' ? 1000 : 0) + (/qwen/i.test(id) ? 300 : 0) + size(id);
  return ids.filter(id => !/8b$|guard|embed/i.test(id)).sort((a, b) => score(b) - score(a)).slice(0, 3);
}

// ---------------- NVIDIA NIM (اختياري) ----------------
// build.nvidia.com: نماذج مفتوحة كبيرة (DeepSeek / Qwen / Kimi / gpt-oss) ببلاش بحد ~40 طلب/دقيقة للحساب.
// الشروط بتوصفها كتجربة، ومش واضح استخدام البيانات → noClientData (أسئلة عامة بس).
const NVIDIA_PREFER = [
  /deepseek-v3\.?\d|deepseek-v4/i,          // الأقوى في العربي والقانون
  /kimi-k2/i,
  /qwen3[\.\d-]*-?235b|qwen3\.\d/i,
  /gpt-oss-120b/i,
  /llama-4-maverick/i,
  /llama-3\.3-70b|nemotron.*(super|ultra)/i,
];
async function discoverNvidia(env) {
  const key = secret(env, 'NVIDIA_API_KEY');
  if (key.length < 20) return null;
  const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`nvidia models ${res.status}`);
  const ids = ((await res.json()).data || []).map(m => String(m.id || '')).filter(Boolean)
    // مش نماذج كلام عادي
    .filter(id => !/embed|rerank|guard|safety|reward|vision|vl\b|-vl-|clip|parse|ocr|retriever|translate|coder|math|-r1\b|distill|\b\d{1,2}b\b/i.test(id));
  const rank = id => { const i = NVIDIA_PREFER.findIndex(re => re.test(id)); return i < 0 ? 99 : i; };
  // الأحدث رقماً في نفس الفئة الأول (v3.2 قبل v3.1)
  const ver = id => parseFloat((id.match(/(\d+(?:\.\d+)?)(?!.*\d)/) || [0, 0])[1]) || 0;
  return ids.filter(id => rank(id) < 99)
    .sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a))
    .slice(0, 4);
}

// ---------------- تجربة فعلية لكل نموذج ----------------
// القايمة لوحدها مش كفاية: Google مثلاً لسه بيعرض gemini-2.5-flash في القايمة
// بس بيرفضه للحسابات الجديدة. فبنبعت سؤال صغير جداً ونحتفظ باللي بيرد بس.
// noClientData: الخطة المجانية بتسمح للمزود يستخدم المدخلات في التدريب
//   → مستبعد من أي طلب فيه بيانات موكلين (route 'balanced')، ومتاح للأسئلة القانونية العامة بس.
//   ملحوظة: Gemini المجاني كمان شروطه بتسمح بتحسين المنتجات من المدخلات — لسه مسموح في 'balanced' زي ما كان (قرار مفتوح).
// optional: لو مفتاحه مش موجود مبنعتبرهاش مشكلة في فحص السوبر أدمن.
export const ENDPOINTS = {
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: 'GEMINI_API_KEY' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', key: 'MISTRAL_API_KEY', optional: true, noClientData: true },
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', key: 'CEREBRAS_API_KEY', optional: true },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: 'GROQ_API_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', key: 'OPENROUTER_API_KEY', optional: true, noClientData: true },
  nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: 'NVIDIA_API_KEY', optional: true, noClientData: true },
};

async function probe(env, provider, model) {
  const ep = ENDPOINTS[provider];
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret(env, ep.key)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ok' }], ...(/(^|\/)(gpt-5|o\d)/i.test(model) ? { max_completion_tokens: 64 } : { max_tokens: 16 }) }),
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
  const jobs = { gemini: discoverGemini, groq: discoverGroq, openrouter: discoverOpenRouter, mistral: discoverMistral, cerebras: discoverCerebras, nvidia: discoverNvidia };
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
