// worker/lib/phone.js
// صيغة واحدة لحفظ أرقام الموبايل:
//   مصري   → 01XXXXXXXXX
//   دولي   → +CCC… (زي +966512345678)
// قبل كده التسجيل بـ +20 كان بيشيل الصفر (1012345678) والخليجي كان بيتحفظ 0966… — ده كان بيبوّظ واتساب والدخول.

export function normalizeStoredPhone(input) {
  const s = String(input || '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+') || d.startsWith('00')) {
    d = d.replace(/^00/, '');
    if (/^20\d{10}$/.test(d)) return '0' + d.slice(2);
    return '+' + d;
  }
  if (/^01\d{9}$/.test(d)) return d;
  if (/^1\d{9}$/.test(d)) return '0' + d;
  if (/^20\d{10}$/.test(d)) return '0' + d.slice(2);
  if (d.startsWith('0')) return d;
  return d.length >= 11 ? '+' + d : d;
}

// كل الأشكال اللي ممكن يكون الرقم اتحفظ بيها (عشان الدخول يشتغل مع الأرقام القديمة)
export function phoneVariants(input) {
  const s = String(input || '').trim();
  const d = s.replace(/\D/g, '');
  if (d.length < 8 || /[a-z@]/i.test(s)) return [];
  const out = new Set([s]);
  const n = normalizeStoredPhone(s);
  if (n) {
    out.add(n);
    if (/^01\d{9}$/.test(n)) out.add(n.slice(1));                 // الشكل القديم من غير الصفر
    if (n.startsWith('+')) { out.add('0' + n.slice(1)); out.add(n.slice(1)); } // الشكل القديم للدولي
  }
  return [...out];
}
