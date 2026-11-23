// worker/lib/redact.js
// إخفاء البيانات الشخصية قبل ما أي نص يطلع لنموذج ذكاء اصطناعي خارجي، ورجوعها في الرد.
//
// بنخفي:
//   - أسماء الأطراف المعروفة (الموكل، الخصم، أي أسماء بنعرفها من القضية)
//   - الرقم القومي المصري (14 رقم بيبدأ بـ 2 أو 3)
//   - أرقام الموبايل المصرية (01x… / +20…) والإيميلات
// النموذج بيشوف رموز زي [شخص-1] و[رقم-قومي-1] بدل البيانات الحقيقية، وإحنا بنرجّعها في الرد.
//
// ⚠️ الإخفاء مش سحري: أسماء ما نعرفهاش (شاهد مذكور في مستند مثلاً) والعناوين ممكن تعدّي.
// عشان كده الوضع "السري" بيبعت مستندات الموكلين لـ Cloudflare بس (مش بيتدرب على البيانات).

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatinDigits = s => String(s).replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// اسم عربي → regex بيتجاهل الفرق بين أ/إ/آ/ا و ة/ه و ى/ي والتشكيل
function nameToRegex(name) {
  const chars = [...name.trim()].map(ch => {
    if ('أإآا'.includes(ch)) return '[أإآا]';
    if ('ةه'.includes(ch)) return '[ةه]';
    if ('ىي'.includes(ch)) return '[ىي]';
    if (/\s/.test(ch)) return '\\s+';
    return escapeRe(ch) + '[\\u064B-\\u0652]*';
  });
  // حدود الكلمة بالعربي: مش قبله/بعده حرف عربي أو لاتيني
  return new RegExp(`(?<![\\p{L}\\p{N}])${chars.join('')}(?![\\p{L}\\p{N}])`, 'gu');
}

const PATTERNS = [
  { kind: 'رقم-قومي', re: /(?<![\d٠-٩])[23٢٣][\d٠-٩]{13}(?![\d٠-٩])/g },
  { kind: 'هاتف', re: /(?<![\d٠-٩+])(?:\+?20|0020|0)?\s?1[0125][\s-]?[\d٠-٩]{3,4}[\s-]?[\d٠-٩]{4}(?![\d٠-٩])/g },
  { kind: 'بريد', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
];

/**
 * createMasker({ names }) → { mask(text), unmask(text), count }
 * نفس الـ masker بيدّي نفس الرمز لنفس القيمة في كل الرسايل (مهم للشات متعدد الخطوات).
 */
export function createMasker({ names = [] } = {}) {
  const toToken = new Map();   // القيمة الحقيقية (مطبّعة) → الرمز
  const toValue = new Map();   // الرمز → القيمة الحقيقية كما ظهرت أول مرة
  const counters = {};

  const tokenFor = (kind, value, key = value) => {
    if (toToken.has(key)) return toToken.get(key);
    counters[kind] = (counters[kind] || 0) + 1;
    const token = `[${kind}-${counters[kind]}]`;
    toToken.set(key, token);
    toValue.set(token, value);
    return token;
  };

  // الأسماء: الاسم الكامل + أول اسمين (لو الاسم 3 كلمات أو أكتر)، الأطول الأول
  const nameVariants = [];
  for (const raw of names) {
    const n = String(raw || '').replace(/\s+/g, ' ').trim();
    if (n.length < 3) continue;
    const parts = n.split(' ');
    nameVariants.push({ text: n, key: `name:${n}` });
    if (parts.length >= 3) nameVariants.push({ text: parts.slice(0, 2).join(' '), key: `name:${n}` });
  }
  nameVariants.sort((a, b) => b.text.length - a.text.length);
  const nameRes = nameVariants.map(v => ({ ...v, re: nameToRegex(v.text) }));

  function mask(text) {
    if (!text) return text;
    let out = String(text);
    for (const v of nameRes) {
      out = out.replace(v.re, () => tokenFor('شخص', v.text, v.key));
    }
    for (const p of PATTERNS) {
      out = out.replace(p.re, m => tokenFor(p.kind, m.trim(), `${p.kind}:${toLatinDigits(m).replace(/\D/g, '') || m}`));
    }
    return out;
  }

  function unmask(text) {
    if (!text || !toValue.size) return text;
    // النموذج أحياناً بيشيل الأقواس أو يحط مسافات: [شخص-1] / [ شخص - 1 ] / شخص-1
    return String(text).replace(
      /\[\s*(شخص|رقم-قومي|هاتف|بريد)\s*-\s*(\d+)\s*\]|(?<![\p{L}\p{N}])(شخص|رقم-قومي|هاتف|بريد)-(\d+)(?![\p{N}])/gu,
      (m, k1, n1, k2, n2) => toValue.get(`[${k1 || k2}-${n1 || n2}]`) ?? m);
  }

  return { mask, unmask, get count() { return toValue.size; } };
}

/** يطبّق unmask على كل النصوص جوه object (لنتايج JSON). */
export function unmaskDeep(value, masker) {
  if (!masker) return value;
  if (typeof value === 'string') return masker.unmask(value);
  if (Array.isArray(value)) return value.map(v => unmaskDeep(v, masker));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = unmaskDeep(v, masker);
    return out;
  }
  return value;
}
