// web/js/country.js
// دولة المكتب (مصر / السعودية): العملة والضريبة والتاريخ الهجري والمسميات والمحاكم
// بتتحفظ على الجهاز من إعدادات المكتب (setOfficeMoneyPrefs) — المكاتب القديمة = مصر

const KEY = 'mowakkil_country';

// ويندوز مبيرسمش أعلام الدول (إيموجي) — بيكتب حروف زي SA، فبنخفي الأعلام هناك
try { if (/Windows/.test(navigator.userAgent)) document.documentElement.classList.add('no-flags'); } catch {}

export const COUNTRY_INFO = {
  EG: {
    code: 'EG', name: 'مصر', flag: '🇪🇬', currency: 'EGP', vat: 14, dial: '20',
    hijri: false, locale: 'ar-EG-u-nu-latn',
    idLabel: 'الرقم القومي', idHint: '14 رقم', phonePlaceholder: '01012345678',
    lawWord: 'القانون', lawsWord: 'القوانين', legalSystem: 'القانون المصري',
    feeCalculator: true,
  },
  SA: {
    code: 'SA', name: 'السعودية', flag: '🇸🇦', currency: 'SAR', vat: 15, dial: '966',
    hijri: true, locale: 'ar-SA-u-ca-gregory-nu-latn',
    idLabel: 'رقم الهوية / الإقامة', idHint: '10 أرقام', phonePlaceholder: '0512345678',
    lawWord: 'النظام', lawsWord: 'الأنظمة', legalSystem: 'الأنظمة السعودية',
    feeCalculator: false, // حاسبة الرسوم القضائية مبنية على القانون المصري
  },
};

export function country() {
  try { const c = localStorage.getItem(KEY); return COUNTRY_INFO[c] ? c : 'EG'; } catch { return 'EG'; }
}
export function countryInfo() { return COUNTRY_INFO[country()]; }
export function isSaudi() { return country() === 'SA'; }

export function setCountry(c) {
  if (!COUNTRY_INFO[c]) return;
  const changed = country() !== c;
  try { localStorage.setItem(KEY, c); } catch {}
  if (changed) document.dispatchEvent(new CustomEvent('mowakkil:country-changed', { detail: { country: c } }));
}

// ============ التواريخ ============
const HIJRI_LOCALE = 'ar-SA-u-ca-islamic-umalqura-nu-latn';
const asDate = (d) => {
  if (d instanceof Date) return d;
  const s = String(d || '');
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s);
};

/** اللغة/التقويم للتاريخ الميلادي حسب الدولة */
export function dateLocale() { return countryInfo().locale; }

/** التاريخ الهجري (أم القرى) */
export function hijriDate(d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const x = asDate(d);
  if (isNaN(x)) return '';
  try { return new Intl.DateTimeFormat(HIJRI_LOCALE, opts).format(x); } catch { return ''; }
}

// ============ طريقة عرض التاريخ (من إعدادات المكتب) ============
// hijri: هجري بس — gregorian: ميلادي بس — both: الاتنين
// الافتراضي: السعودية هجري، مصر ميلادي. التخزين في الداتابيز دايماً ميلادي (YYYY-MM-DD) — ده عرض بس.
const DATE_KEY = 'mowakkil_date_mode';
export const DATE_MODES = { hijri: 'هجري', gregorian: 'ميلادي', both: 'هجري وميلادي' };
export function dateMode() {
  try { const m = localStorage.getItem(DATE_KEY); if (DATE_MODES[m]) return m; } catch {}
  return country() === 'SA' ? 'hijri' : 'gregorian';
}
export function setDateMode(m) {
  const v = DATE_MODES[m] ? m : null;
  const before = dateMode();
  try { if (v) localStorage.setItem(DATE_KEY, v); else localStorage.removeItem(DATE_KEY); } catch {}
  if (dateMode() !== before) document.dispatchEvent(new CustomEvent('mowakkil:date-mode-changed', { detail: { mode: dateMode() } }));
}
export const showsHijri = () => dateMode() !== 'gregorian';
export const hijriFirst = () => dateMode() === 'hijri';

/**
 * تاريخ للعرض حسب إعداد المكتب (هجري / ميلادي / الاتنين)
 * style: 'long' (الأربعاء، 15 جمادى الآخرة 1448 هـ) | 'short' | 'month' | 'weekday'
 */
export function fmtDay(d, style = 'long') {
  const x = asDate(d);
  if (isNaN(x)) return String(d || '');
  const opts = style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
    : style === 'month' ? { month: 'long', year: 'numeric' }
    : style === 'weekday' ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const mode = dateMode();
  let g;
  try { g = x.toLocaleDateString(dateLocale(), opts); } catch { g = x.toDateString(); }
  if (mode === 'gregorian') return g;
  // الهجري: الشهر بالاسم دايماً (الشهور الهجرية المختصرة مش مفهومة)
  const hOpts = style === 'month' ? { month: 'long', year: 'numeric' }
    : style === 'short' ? { day: 'numeric', month: 'long', year: 'numeric' }
    : style === 'weekday' ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const h = hijriDate(x, mode === 'hijri' ? hOpts : (style === 'month' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' }));
  if (!h) return g;
  return mode === 'hijri' ? h : `${g} · ${h}`;
}

/** تاريخ قصير جداً (للخانات الضيقة): هجري "15 جمادى الآخرة" أو ميلادي "25 نوفمبر" */
export function fmtDayShort(d) {
  const x = asDate(d);
  if (isNaN(x)) return String(d || '');
  if (dateMode() === 'gregorian') return x.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  return hijriDate(x, { day: 'numeric', month: 'long' });
}
