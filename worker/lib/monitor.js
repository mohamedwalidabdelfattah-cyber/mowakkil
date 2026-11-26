// worker/lib/monitor.js
// تنبيهات صاحب النظام لما حاجة تقع — من غير ما يستنى العملاء يشتكوا.
//   - قاعدة البيانات وقفت (حصة D1 اليومية خلصت أو مش بترد)  → تنبيه فوري
//   - أخطاء كتير في السيرفر في وقت قصير                       → تنبيه
//   - الذكاء الاصطناعي فشل في كل النماذج كذا مرة              → تنبيه
// القنوات (اختياري — أي واحدة متظبطة بتشتغل):
//   Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//   ntfy (تطبيق إشعارات مجاني من غير حساب): NTFY_TOPIC
// التنبيهات كمان بتتسجل وتظهر في لوحة السوبر أدمن (تاب التنبيهات) حتى لو مفيش قناة.
// ⚠️ التنبيه عمره ما بيحتوي بيانات موكلين — بس نوع المشكلة وأول سطر من رسالة الخطأ.

const ALERTS_KEY = 'mon:alerts';
const secret = (env, k) => String(env?.[k] ?? '').trim();
const kvOf = env => env?.RATE_LIMIT_KV || null;

export function channels(env) {
  return {
    telegram: !!(secret(env, 'TELEGRAM_BOT_TOKEN') && secret(env, 'TELEGRAM_CHAT_ID')),
    ntfy: !!secret(env, 'NTFY_TOPIC'),
  };
}

async function send(env, title, body) {
  const text = `🚨 مُوكِّل — ${title}\n${body}`;
  const jobs = [];
  const tg = secret(env, 'TELEGRAM_BOT_TOKEN'), chat = secret(env, 'TELEGRAM_CHAT_ID');
  if (tg && chat) {
    jobs.push(fetch(`https://api.telegram.org/bot${tg}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    }).then(r => { if (!r.ok) throw new Error('telegram ' + r.status); return 'telegram'; }));
  }
  const topic = secret(env, 'NTFY_TOPIC');
  if (topic) {
    jobs.push(fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      // الهيدرز لازم ASCII — العنوان بالإنجليزي والتفاصيل بالعربي في الرسالة
      headers: { Title: 'Mowakkil alert', Priority: 'high', Tags: 'rotating_light' },
      body: text,
      signal: AbortSignal.timeout(10000),
    }).then(r => { if (!r.ok) throw new Error('ntfy ' + r.status); return 'ntfy'; }));
  }
  const res = await Promise.allSettled(jobs);
  return { sent: res.filter(r => r.status === 'fulfilled').map(r => r.value), failed: res.filter(r => r.status === 'rejected').map(r => String(r.reason?.message || r.reason)) };
}

/**
 * alertOwner: يبعت تنبيه لصاحب النظام (مرة واحدة كل everySec لنفس المشكلة) ويسجّله.
 * force: يتجاهل منع التكرار (لزرار "تنبيه تجريبي").
 */
export async function alertOwner(env, { key, title, body = '', everySec = 6 * 3600, force = false }) {
  const kv = kvOf(env);
  const dk = `mon:sent:${key}`;
  try {
    if (!force && kv && await kv.get(dk)) return { skipped: true };
    if (kv && !force) await kv.put(dk, '1', { expirationTtl: Math.max(60, everySec) });
  } catch {}
  let result = { sent: [], failed: [] };
  try { result = await send(env, title, body); } catch (e) { result.failed.push(e.message); }
  try {
    if (kv) {
      const list = JSON.parse((await kv.get(ALERTS_KEY)) || '[]');
      list.unshift({ at: new Date().toISOString(), key, title, body: String(body).slice(0, 400), sent: result.sent, failed: result.failed });
      await kv.put(ALERTS_KEY, JSON.stringify(list.slice(0, 40)));
    }
  } catch {}
  return result;
}

export async function recentAlerts(env) {
  try { return JSON.parse((await kvOf(env)?.get(ALERTS_KEY)) || '[]'); } catch { return []; }
}

// ---------------- رصد الأخطاء ----------------
const D1_LIMIT = /exceeded D1's free tier|daily row (read|write) limit|D1_ERROR[^\n]*limit/i;
export const isD1Limit = e => D1_LIMIT.test(String(e?.message || e || ''));

// عدّاد في ذاكرة الـ isolate (من غير ما نكتب في KV مع كل خطأ — حصة الكتابة محدودة)
const recent = { errors: [], ai: [] };
const within = (arr, ms) => { const t = Date.now() - ms; while (arr.length && arr[0] < t) arr.shift(); return arr.length; };
const firstLine = e => String(e?.message || e || '').split('\n')[0].slice(0, 160);

/** بيتنادى من معالج الأخطاء العام في index.js */
let lastD1Alert = 0;
export async function noteError(env, err, where = '') {
  try {
    if (isD1Limit(err)) {
      // وقت الوقوف كل الطلبات بتفشل — منسألش KV مع كل طلب
      if (Date.now() - lastD1Alert < 10 * 60 * 1000) return;
      lastD1Alert = Date.now();
      await alertOwner(env, {
        key: 'd1-limit', everySec: 6 * 3600,
        title: 'قاعدة البيانات وقفت — الحصة اليومية خلصت',
        body: 'Cloudflare وقّف القراءة/الكتابة من D1 لأن حصة الخطة المجانية اليومية خلصت. النظام مش هيشتغل لحد منتصف الليل UTC (2 الفجر بتوقيت مصر)، أو لحد الترقية لخطة Workers Paid.',
      });
      return;
    }
    recent.errors.push(Date.now());
    if (within(recent.errors, 10 * 60 * 1000) >= 15) {
      recent.errors.length = 0;
      await alertOwner(env, {
        key: 'errors-spike', everySec: 3600,
        title: 'أخطاء كتير في السيرفر',
        body: `أكتر من 15 خطأ في آخر 10 دقايق. آخر خطأ${where ? ` (${where})` : ''}: ${firstLine(err)}`,
      });
    }
  } catch {}
}

/** بيتنادى لما الذكاء الاصطناعي يفشل في كل النماذج */
export async function noteAiDown(env, lastErr) {
  try {
    recent.ai.push(Date.now());
    if (within(recent.ai, 30 * 60 * 1000) >= 5) {
      recent.ai.length = 0;
      await alertOwner(env, {
        key: 'ai-down', everySec: 6 * 3600,
        title: 'الذكاء الاصطناعي مش شغال',
        body: `كل النماذج فشلت 5 مرات في آخر نص ساعة (حصص خلصت أو مفاتيح بايظة). افتح «فحص النماذج» في السوبر أدمن. آخر خطأ: ${firstLine(lastErr)}`,
      });
    }
  } catch {}
}

/** فحص دوري (الـ cron كل نص ساعة): قاعدة البيانات بترد؟ */
export async function healthCheck(env) {
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
  } catch (e) {
    if (isD1Limit(e)) return noteError(env, e, 'cron');
    await alertOwner(env, {
      key: 'db-down', everySec: 3600,
      title: 'قاعدة البيانات مش بترد',
      body: `الفحص الدوري فشل: ${firstLine(e)}`,
    });
  }
}
