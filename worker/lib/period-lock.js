// worker/lib/period-lock.js
// قفل الفترات: مفيش إضافة/تعديل/حذف لحركة مالية تاريخها قبل office_settings.lock_before
export async function lockDate(env, officeId) {
  const s = await env.DB.prepare('SELECT lock_before FROM office_settings WHERE office_id = ?').bind(officeId).first().catch(() => null);
  return s?.lock_before || null;
}
export async function assertOpen(env, officeId, date) {
  const lock = await lockDate(env, officeId);
  const d = String(date || '').slice(0, 10);
  if (lock && d && d < lock) {
    const err = new Error(`الفترة لحد ${lock} مقفولة — مينفعش تضيف أو تعدّل أو تحذف حركة قبل التاريخ ده (افتح القفل من الإدارة المالية لو محتاج)`);
    err.status = 423;
    throw err;
  }
}
