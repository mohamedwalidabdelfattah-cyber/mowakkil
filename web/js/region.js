// web/js/region.js
// دولة الزائر (مصر / السعودية) لصفحة الباقات والتسجيل — من غير ما نوريه أسعار الدولة التانية
// العلامات بالترتيب:
//  1) لينك فيه ?country=SA (إعلان/حملة)
//  2) دولة مكتبه لو داخل بحسابه
//  3) اللي اتعرف عنه قبل كده (سعودي)
//  4) لغة الجهاز سعودية (ar-SA …) أو توقيت الرياض
//  5) دولة الاتصال من Cloudflare (السيرفر)
// غير كده: مصر. (السعودي اللي في مصر بيتعرف غالباً من لغة جهازه، وفي التسجيل من رقم موبايله)

const API_BASE = 'https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev';
const KEY = 'mowakkil_visitor_country';

const save = (c) => { try { localStorage.setItem(KEY, c); } catch {} return c; };

export function hintsSaudi() {
  try {
    const langs = [...(navigator.languages || []), navigator.language || ''];
    if (langs.some(l => /-SA$/i.test(l))) return true;
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Riyadh';
  } catch { return false; }
}

export async function detectVisitorCountry() {
  try {
    const q = (new URLSearchParams(location.search).get('country') || '').toUpperCase();
    if (q === 'SA' || q === 'EG') return save(q);
    if (localStorage.getItem('mowakkil_token')) {
      const office = localStorage.getItem('mowakkil_country');
      if (office === 'SA' || office === 'EG') return office;
    }
    if (localStorage.getItem(KEY) === 'SA') return 'SA';
  } catch {}
  if (hintsSaudi()) return save('SA');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(API_BASE + '/api/geo', { signal: ctrl.signal }).then(x => x.json());
    clearTimeout(t);
    if ((r.data || r).country === 'SA') return save('SA');
  } catch {}
  return 'EG';
}

/** رقم موبايل سعودي؟ (05XXXXXXXX / 5XXXXXXXX / +9665… / 009665…) */
export function isSaudiPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  return /^05\d{8}$/.test(d) || /^5\d{8}$/.test(d) || /^9665\d{8}$/.test(d) || /^009665\d{8}$/.test(d);
}
