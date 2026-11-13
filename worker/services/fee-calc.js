export function calcFee({ value, known, degree }) {
  if (known === 'unknown') {
    const fixed = { جزئي: 20, ابتدائي: 50, استئناف: 70 };
    return { fee: fixed[degree] ?? 50, note: 'رسم ثابت لدعوى مجهولة القيمة (تقدير عام).' };
  }

  let remaining = Math.max(0, Number(value) || 0);
  let fee = 0, lastCap = 0;
  const tiers = [
    { upto: 2000,     rate: 0.03 },
    { upto: 4000,     rate: 0.04 },
    { upto: Infinity, rate: 0.05 },
  ];

  for (const t of tiers) {
    if (remaining <= 0) break;
    const span = Math.min(remaining, t.upto - lastCap);
    if (span > 0) { fee += span * t.rate; remaining -= span; }
    lastCap = t.upto;
  }

  if (degree === 'استئناف') fee *= 1.5;
  return { fee, note: 'رسم نسبي تقديري — للاسترشاد فقط، راجع قلم الكتاب.' };
}