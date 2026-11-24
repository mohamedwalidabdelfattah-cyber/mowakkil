// web/js/phone.js
// تحويل أي رقم موبايل لصيغة واتساب الدولية (أرقام بس، من غير +)
// مصر افتراضياً — والأرقام الدولية (+966… / 00966… / 0966… القديمة) بتفضل على كودها
export function normalizePhone(phone) {
  const s = String(phone || '').trim();
  if (!s) return null;
  let d = s.replace(/\D/g, '');
  if (s.startsWith('+') || d.startsWith('00')) d = d.replace(/^00/, '');   // دولي صريح
  else if (/^01\d{9}$/.test(d)) d = '20' + d.slice(1);                       // 01xxxxxxxxx
  else if (/^1\d{9}$/.test(d)) d = '20' + d;                                 // 1xxxxxxxxx (من غير الصفر)
  else if (/^20\d{10}$/.test(d)) { /* مصري دولي */ }
  else if (d.startsWith('0') && d.length >= 12) d = d.slice(1);              // دولي اتحفظ بصفر قدامه (0966…)
  else if (d.startsWith('0')) d = '20' + d.replace(/^0+/, '');               // أرضي مصري
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export function waLinkFor(phone, text = '') {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}
