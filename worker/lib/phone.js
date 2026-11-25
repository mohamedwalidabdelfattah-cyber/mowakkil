// worker/lib/phone.js
// صيغة واحدة لحفظ أرقام الموبايل:
//   مصري   → 01XXXXXXXXX
//   دولي   → +CCC… (زي +966512345678)
// قبل كده التسجيل بـ +20 كان بيشيل الصفر (1012345678) والخليجي كان بيتحفظ 0966… — ده كان بيبوّظ واتساب والدخول.

// country: دولة المكتب — في السعودية الرقم المحلي 05XXXXXXXX بيتحفظ دولي +9665XXXXXXXX
export function normalizeStoredPhone(input, country = 'EG') {
  const s = String(input || '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (country === 'SA' && !s.startsWith('+') && !d.startsWith('00')) {
    if (/^05\d{8}$/.test(d)) return '+966' + d.slice(1);
    if (/^5\d{8}$/.test(d)) return '+966' + d;
  }
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
  // سعودي: اللي بيكتب 05… أو 5… وهو متسجّل +9665…
  if (/^05\d{8}$/.test(d)) out.add('+966' + d.slice(1));
  if (/^5\d{8}$/.test(d)) out.add('+966' + d);
  return [...out];
}
