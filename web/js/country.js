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

/**
 * تاريخ للعرض: ميلادي، وفي السعودية بيتضاف الهجري جنبه
 * style: 'long' (السبت 21 نوفمبر 2026 · 30 جمادى الأولى 1448 هـ) | 'short' | 'month'
 */
export function fmtDay(d, style = 'long') {
  const x = asDate(d);
  if (isNaN(x)) return String(d || '');
  const opts = style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
    : style === 'month' ? { month: 'long', year: 'numeric' }
    : style === 'weekday' ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  let g;
  try { g = x.toLocaleDateString(dateLocale(), opts); } catch { g = x.toDateString(); }
  if (!countryInfo().hijri) return g;
  const hOpts = style === 'month' ? { month: 'long', year: 'numeric' }
    : style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'long', year: 'numeric' };
  const h = hijriDate(x, hOpts);
  return h ? `${g} · ${h}` : g;
}
