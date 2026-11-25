// worker/lib/citations.js
// التحقق الآلي من الأسانيد: أي "المادة X من قانون Y" في رد الذكاء الاصطناعي بنراجعها على
// قاعدة المواد (law_articles). الهدف إن المحامي يعرف فوراً إيه اللي متحقق وإيه اللي لازم يراجعه.
//
// الحالات:
//   verified      ✓  المادة موجودة في القانون ده في قاعدة البيانات
//   not_found     ⚠️ القانون موجود في القاعدة بس رقم المادة ده مش موجود (ممكن غلط/هلوسة أو نقص في القاعدة)
//   law_unknown   ℹ️ القانون نفسه مش في القاعدة — لازم مراجعة يدوية
// ملاحظة: قاعدة المواد مش كاملة لكل القوانين، فـ"مش موجود" معناها "مش متحقق" مش بالضرورة "غلط".
// السعودية: "المادة الرابعة والثمانون من نظام العمل" / "المادة 1/3 من اللائحة التنفيذية لنظام المرافعات الشرعية".
// كل مكتب بيتراجع على قوانين دولته بس (قانون العمل المصري ≠ نظام العمل السعودي).

import { articleNumber } from './ordinal.js';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const latin = s => String(s).replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));

// تطبيع عربي: من غير تشكيل/تطويل، أ/إ/آ→ا، ة→ه، ى→ي
export function normalizeAr(s) {
  return latin(String(s || ''))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim();
}

const STOP = new Set(['قانون', 'القانون', 'قوانين', 'رقم', 'لسنه', 'سنه', 'المصري', 'مصري', 'الموحد', 'موحد',
  'و', 'في', 'من', 'على', 'علي', 'بشان', 'باصدار', 'اصدار', 'وتعديلاته', 'تعديلاته', 'الجديد', 'جديد', 'المواد', 'مواد']);

// كلمات القانون المميزة: من غير "ال" ومن غير ة/ه في الآخر (المدنية = المدني)
function lawTokens(name) {
  return normalizeAr(name)
    .replace(/[0-9]+/g, ' ')
    .split(/[\s\-–—،,/()]+/)
    .map(w => w.replace(/^و?ال/, '').replace(/ه$/, '').replace(/يه$/, 'ي'))
    // المفرد والجمع واحد: "اللائحة التنفيذية" = "اللوائح التنفيذية"، "الأنظمة" = "النظام"
    .map(w => (w === 'لوائح' ? 'لائح' : w === 'انظم' ? 'نظام' : w))
    .filter(w => w.length >= 3 && !STOP.has(w) && !STOP.has('ال' + w));
}

const lawNumberKey = s => {
  const m = normalizeAr(s).match(/(\d+)\s*لسنه\s*(\d{4})/);
  return m ? `${m[1]}/${m[2]}` : null;
};

// رقم المادة بشكل موحد: "147" / "306 مكرر ا"
function articleKey(s) {
  const n = normalizeAr(s).replace(/^الماده\s*/, '');
  // بنود اللوائح التنفيذية السعودية: "1/3" (البند 1 من المادة 3)
  const sub = n.match(/^\(?\s*(\d+)\s*\/\s*(\d+)/);
  if (sub) return `${sub[1]}/${sub[2]}`;
  const m = n.match(/(\d+)\s*(مكرر[اً]?)?\s*([ا-ي])?(?![ا-ي])/);
  if (!m) return null;
  let k = m[1];
  if (m[2]) k += ' مكرر' + (m[3] ? ' ' + m[3] : '');
  return k;
}

// ---------- فهرس القوانين ----------
// بيتبني من law_articles كلها (~20 ألف صف) — فبنخزّنه في KV يوم كامل، وفي ذاكرة الـ isolate ساعة.
// قبل كده كل isolate جديد كان بيقرا الجدول كله، وده بيستهلك حصة القراءة اليومية لـ D1 بسرعة.
const CIT_KV_KEY = 'citations:index:v2'; // v2: دولة كل قانون
let index = null;
async function getIndex(env) {
  if (index && index.exp > Date.now()) return index.laws;
  try {
    const cached = await env.RATE_LIMIT_KV?.get(CIT_KV_KEY, 'json');
    if (cached?.length) {
      const laws = cached.map(l => ({ ...l, tokens: new Set(l.tokens), articles: new Set(l.articles) }));
      index = { exp: Date.now() + 60 * 60 * 1000, laws };
      return laws;
    }
  } catch {}
  const laws = await buildIndex(env);
  try {
    const plain = laws.map(l => ({ ...l, tokens: [...l.tokens], articles: [...l.articles] }));
    await env.RATE_LIMIT_KV?.put(CIT_KV_KEY, JSON.stringify(plain), { expirationTtl: 24 * 60 * 60 });
  } catch {}
  index = { exp: Date.now() + 60 * 60 * 1000, laws };
  return laws;
}

/** بعد إضافة قوانين جديدة: امسح النسخة المخزنة عشان تتبني من جديد */
export async function resetCitationIndex(env) {
  index = null;
  try { await env.RATE_LIMIT_KV?.delete(CIT_KV_KEY); } catch {}
}

async function buildIndex(env) {
  const { results } = await env.DB.prepare(
    `SELECT law_name, law_number, article_number, country FROM law_articles`
  ).all();
  const byLaw = new Map();
  for (const r of results || []) {
    const key = `${r.country || 'EG'}|${r.law_name}|${r.law_number || ''}`;
    if (!byLaw.has(key)) {
      byLaw.set(key, {
        name: r.law_name,
        country: r.country || 'EG',
        tokens: new Set(lawTokens(r.law_name)),
        number: lawNumberKey(`${r.law_number || ''} ${r.law_name}`),
        articles: new Set(),
      });
    }
    const k = articleKey(r.article_number);
    if (k) byLaw.get(key).articles.add(k);
  }
  return [...byLaw.values()].filter(l => l.tokens.size || l.number);
}

// القوانين اللي ممكن يقصدها الاستشهاد: نفس رقم القانون، أو كلمات أحدهما جوه التاني بالكامل
function matchLaws(laws, lawText) {
  const toks = new Set(lawTokens(lawText));
  const num = lawNumberKey(lawText);
  return laws.filter(l => {
    if (num && l.number === num) return true;
    if (!toks.size || !l.tokens.size) return false;
    const lInC = [...l.tokens].every(t => toks.has(t));
    const cInL = [...toks].every(t => l.tokens.has(t));
    return lInC || cInL;
  });
}

// ---------- استخراج الاستشهادات من نص ----------
// "المادة 147 من القانون المدني" / "المادتين 147 و148 من القانون المدني" / "م 18 مكرر من قانون العقوبات"
const LAW_CHARS = '(?:(?!\\s+و?(?:ال|لل|ب)?(?:ماد|مواد))[^\\n،,.؛:()"\\[\\]{}])';
const CITE_RE = new RegExp(
  // بادئة اختيارية: و/ب/ل/ف + ال/لل (والمادة، للمادة، بالمادة، وفقاً للمادتين...)
  '(?<![\\p{L}])(?:(?:[وبفل]?(?:ال|لل)|ل)(?:ماد(?:ة|ه|تين|تان|تا)|مواد)|م\\.?)\\s*\\(?\\s*' +
  '(' +
    // أرقام: 147 / 18 مكرر أ / 1/3 / 147 و148 / من 10 إلى 15
    '[0-9٠-٩]+(?:\\s*/\\s*[0-9٠-٩]+)?(?:\\s*مكرر(?:اً|ا)?(?:\\s*[أ-ي](?![أ-ي]))?)?(?:\\s*\\)?\\s*(?:،|,|و|-|إلى|الى|حتى)\\s*\\(?\\s*[0-9٠-٩]+)*' +
    // أو بالحروف (الصياغة السعودية): الرابعة والثمانون / الحادية عشرة / الخامسة بعد المائة
    '|ال\\p{L}+(?:\\s+(?:و?ال\\p{L}+|عشرة?|بعد))*' +
  ')' +
  '\\s*\\)?\\s*(?:من|في|ب)?\\s*' +
  // اسم القانون/النظام — وبيقف قبل "والمادة…" عشان استشهادين في جملة واحدة ميتلزقوش في بعض
  '((?:ال)?قانون' + LAW_CHARS + '{2,70}|(?:ال|ل)?(?:نظام|لائح[ةه]|لوائح|قواعد|ضوابط)' + LAW_CHARS + '{2,90}|(?:ال)?دستور)',
  'gu'
);

export function extractCitations(text) {
  const out = [];
  const s = String(text || '');
  for (const m of s.matchAll(CITE_RE)) {
    let articles;
    if (/[0-9٠-٩]/.test(m[1])) {
      // نطاق "من 147 إلى 150" بنتحقق من أوله وآخره بس
      const nums = latin(m[1]).split(/\s*(?:،|,|و|-|إلى|الى|حتى|\)|\()\s*/).map(x => x.trim()).filter(Boolean);
      articles = nums.map(articleKey).filter(Boolean);
    } else {
      const n = articleNumber('المادة ' + m[1]);
      articles = n ? [String(n)] : [];
    }
    // "المادة المذكورة من القانون" مش استشهاد برقم → مفيش حاجة نتحقق منها
    if (!articles.length) continue;
    const lawText = m[2].trim().replace(/\s+(?:بشأن|الخاص|والذي|التي|الذي|حيث|لأن|بما|على|وذلك|إذا|اذا)(?:\s.*)?$/u, '').trim();
    out.push({ raw: m[0].trim(), index: m.index, end: m.index + m[0].length, articles, lawText });
  }
  return out;
}

/** قوانين دولة المكتب بس (لو الدولة مش معروفة → الكل) */
const forCountry = (laws, country) =>
  (country === 'SA' || country === 'EG') ? laws.filter(l => (l.country || 'EG') === country) : laws;

/** يتحقق من كل استشهاد في نص واحد. country: دولة المكتب ('EG' | 'SA') */
export async function verifyText(env, text, { country } = {}) {
  const cites = extractCitations(text);
  if (!cites.length) return [];
  let laws;
  try { laws = forCountry(await getIndex(env), country); } catch (e) { console.warn('citations index failed:', e.message); return []; }
  return cites.map(c => {
    if (/دستور/.test(c.lawText)) return { ...c, status: 'law_unknown', law: 'الدستور' };
    const cands = matchLaws(laws, c.lawText);
    if (!cands.length) return { ...c, status: 'law_unknown', law: c.lawText };
    const missing = c.articles.filter(a => !cands.some(l => l.articles.has(a)));
    return { ...c, law: cands[0].name, status: missing.length ? 'not_found' : 'verified', missing };
  });
}

const MARK = {
  not_found: ' ⚠️(غير متحقق — المادة مش موجودة في قاعدة المواد، راجعها)',
  law_unknown: ' ℹ️(القانون ده مش في قاعدة المواد — راجعه يدوياً)',
};

/** يعلّم على الاستشهادات اللي مش متحققة جوه النص نفسه. */
export function annotate(text, results) {
  let out = String(text || '');
  for (const r of [...results].sort((a, b) => b.end - a.end)) {
    if (!MARK[r.status]) continue;
    out = out.slice(0, r.end) + MARK[r.status] + out.slice(r.end);
  }
  return out;
}

/**
 * يمشي على نتيجة JSON (تحليل قضية/عقد...) ويعلّم على الاستشهادات + يرجّع ملخص.
 * applicable_laws بيتراجع بشكل خاص لأنه منظم: { law, articles }.
 */
export async function verifyResult(env, result, { country } = {}) {
  const all = [];
  async function walk(v) {
    if (typeof v === 'string') {
      const rs = await verifyText(env, v, { country });
      all.push(...rs);
      return rs.length ? annotate(v, rs) : v;
    }
    if (Array.isArray(v)) { const a = []; for (const x of v) a.push(await walk(x)); return a; }
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = k.startsWith('_') ? x : await walk(x);
      return o;
    }
    return v;
  }
  const out = await walk(result);

  // applicable_laws: [{ law: "القانون المدني", articles: "147، 148" }]
  if (Array.isArray(out?.applicable_laws)) {
    let laws = null;
    try { laws = forCountry(await getIndex(env), country); } catch {}
    if (laws) {
      out.applicable_laws = out.applicable_laws.map(item => {
        if (!item || typeof item !== 'object' || !item.law || !item.articles) return item;
        const nums = latin(String(item.articles)).match(/\d+(?:\s*\/\s*\d+)?(?:\s*مكرر(?:اً|ا)?)?/g) || [];
        if (!nums.length) return item;
        const keys = nums.map(articleKey).filter(Boolean);
        const cands = matchLaws(laws, item.law);
        const status = !cands.length ? 'law_unknown'
          : keys.every(k => cands.some(l => l.articles.has(k))) ? 'verified' : 'not_found';
        all.push({ raw: `${item.articles} — ${item.law}`, status, law: item.law, articles: keys });
        return { ...item, verification: status };
      });
    }
  }

  return { result: out, summary: summarize(all) };
}

export function summarize(results) {
  const s = { checked: results.length, verified: 0, not_found: 0, law_unknown: 0, items: [] };
  const seen = new Set();
  for (const r of results) {
    s[r.status] = (s[r.status] || 0) + 1;
    const key = `${r.status}|${r.raw}`;
    if (r.status !== 'verified' && !seen.has(key)) { seen.add(key); s.items.push({ citation: r.raw, status: r.status }); }
  }
  s.items = s.items.slice(0, 20);
  return s;
}

/** ملخص نصي يتضاف في آخر رد الشات / المستند المولّد. */
export function summaryText(summary) {
  if (!summary?.checked) return '';
  const lines = [`\n\n---\n🔎 **مراجعة الأسانيد آلياً:** ${summary.verified} متحقق من ${summary.checked}.`];
  if (summary.not_found) lines.push(`⚠️ ${summary.not_found} مادة مش موجودة في قاعدة المواد — راجعها قبل الاعتماد عليها.`);
  if (summary.law_unknown) lines.push(`ℹ️ ${summary.law_unknown} استشهاد بقانون مش موجود في القاعدة — يُراجع يدوياً.`);
  return lines.join('\n');
}
