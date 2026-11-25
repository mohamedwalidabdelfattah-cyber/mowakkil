// worker/lib/ordinal.js — أرقام المواد بالحروف ("الرابعة والثمانون") → رقم. مشترك بين الـ worker وسكربتات الأنظمة السعودية
// ============ الأرقام الترتيبية → رقم ============
const UNITS = { 'الأولى': 1, 'الحادية': 1, 'الثانية': 2, 'الثالثة': 3, 'الرابعة': 4, 'الخامسة': 5, 'السادسة': 6, 'السابعة': 7, 'الثامنة': 8, 'التاسعة': 9, 'العاشرة': 10 };
const TENS = { 'العشرون': 20, 'الثلاثون': 30, 'الأربعون': 40, 'الخمسون': 50, 'الستون': 60, 'السبعون': 70, 'الثمانون': 80, 'التسعون': 90 };
// صيغة الجر ("الحادية والستين") بتيجي كتير في عناوين المواد
for (const [k, v] of Object.entries({ ...TENS })) TENS[k.replace(/ون$/, 'ين')] = v;
// 'المالتين': خطأ مطبعي في صفحة نظام الشركات بالجريدة (عنوان المادة 218) — النص نفسه سليم
const HUNDREDS = { 'المائة': 100, 'المئة': 100, 'المائتين': 200, 'المئتان': 200, 'المئتين': 200, 'المائتان': 200, 'المالتين': 200, 'الثلاثمائة': 300, 'الأربعمائة': 400, 'الخمسمائة': 500, 'الستمائة': 600, 'السبعمائة': 700, 'الثمانمائة': 800, 'التسعمائة': 900 };

export function ordinalToNumber(raw) {
  const s = String(raw).replace(/^المادية\s+/, '').replace(/[-–(]?\s*مكرر[^\s]*\s*[-–)]?\s*$/, '').replace(/ـ/g, '').replace(/\s+/g, ' ').trim();
  let rest = s, hundreds = 0;
  if (HUNDREDS[s]) return HUNDREDS[s];
  // "... بعد المائتين" — وبنقبل كمان لو "بعد" ناقصة (خطأ مطبعي في الجريدة: "الثامنة والعشرون المائتين")
  const toks = s.split(' ');
  const last = toks[toks.length - 1];
  if (toks.length > 1 && HUNDREDS[last]) {
    hundreds = HUNDREDS[last];
    rest = toks.slice(0, -1).join(' ').replace(/\s*بعد$/, '').trim();
  }
  if (!rest) return hundreds || null;
  let n = null;
  const parts = rest.split(' ');
  if (parts.length === 1) n = UNITS[parts[0]] ?? TENS[parts[0]] ?? null;
  else if (parts.length === 2 && parts[1] === 'عشرة' && UNITS[parts[0]] && UNITS[parts[0]] < 10) n = UNITS[parts[0]] + 10;
  else if (parts.length === 2 && parts[1].startsWith('و') && TENS[parts[1].slice(1)] && UNITS[parts[0]] && UNITS[parts[0]] < 10) n = UNITS[parts[0]] + TENS[parts[1].slice(1)];
  return n == null ? null : n + hundreds;
}

// عنوان مادة كامل ("المادة (1)"، "المادة الثامنة : الدخل الخاضع للضريبة"، "المادة الثانية عشر"، "المادة ١/٣") → رقم، أو null
const AR_DIGITS = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
export function articleNumber(head) {
  let s = AR_DIGITS(String(head)).replace(/ـ/g, '').replace(/^\s*المادة\s*/, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*[:：].*$/, '').replace(/^رقم\s*/, '').replace(/[.\-–]+$/, '').trim(); // عنوان بعد النقطتين، "رقم"، نقطة
  const d = s.match(/^\(?\s*(\d+)\s*\)?(\s|$)/);                  // أرقام (وممكن بعدها عنوان)
  if (d) return +d[1];
  s = s.replace(/\s*\(.*\)\s*$/, '').trim();                       // عنوان بين قوسين بعد الترتيب
  s = s.replace(/^الاولى/, 'الأولى').replace(/ و /g, ' و');        // "الاولى"، "و الستون"
  s = s.replace(/^(\S+) عشر(\s|$)/, '$1 عشرة$2');                   // "الثانية عشر" → "الثانية عشرة"
  // "الحادية الثلاثون" (الواو ناقصة)
  s = s.replace(/^(\S+) (ال(?:عشر|ثلاث|أربع|خمس|ست|سبع|ثمان|تسع)(?:ون|ين))(\s|$)/, '$1 و$2$3');
  // "الحادية العاشرة" → الحادية عشرة
  s = s.replace(/^(\S+) العاشرة(\s|$)/, '$1 عشرة$2');
  const full = ordinalToNumber(s);
  if (full != null) return full;
  // عنوان من غير نقطتين بعد الترتيب ("المادة الأولى تعريفات") — بنجرّب أطول بداية تتقري كرقم
  const toks = s.split(' ');
  for (let k = Math.min(5, toks.length - 1); k >= 1; k--) {
    const n = ordinalToNumber(toks.slice(0, k).join(' '));
    if (n != null) return n;
  }
  return null;
}
