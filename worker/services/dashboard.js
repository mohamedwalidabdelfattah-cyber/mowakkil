// worker/services/dashboard.js
// بيانات الـ Dashboard + Monthly Trend

/**
 * @param {object} env
 * @param {number} officeId
 * @param {object} options - { from, to } للفترة الزمنية
 */
export async function dashboard(env, officeId, options = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const from = options.from || null;
  const to = options.to || today;
  // "المكلّف بيها بس": الجلسات وعدد القضايا والمهام على قضاياه بس
  const sc = options.scope || { sql: '', binds: [] };
  const uid = options.assignedUser;
  const taskSql = uid ? ' AND (t.case_id IS NULL OR t.case_id IN (SELECT case_id FROM case_members WHERE user_id = ?))' : '';
  const taskBinds = uid ? [uid] : [];

  // جلسات النهاردة + المهام المفتوحة + الأتعاب المتأخرة + إجمالي القضايا/الموكلين
  const promises = [
    // جلسات النهاردة
    env.DB.prepare(
      `SELECT s.id, s.session_date, s.case_id, c.case_number, c.court, cl.name as client_name, cl.phone as client_phone
       FROM sessions s
       JOIN cases c ON c.id = s.case_id
       LEFT JOIN clients cl ON cl.id = c.client_id
       WHERE c.office_id = ? AND s.session_date = ? AND c.deleted_at IS NULL${sc.sql}
       ORDER BY s.session_date`
    ).bind(officeId, today, ...sc.binds).all(),

    // مهام مفتوحة
    env.DB.prepare(
      `SELECT t.id, t.title, t.due_date, l.name as lawyer_name
       FROM tasks t LEFT JOIN lawyers l ON l.id = t.lawyer_id
       WHERE t.office_id = ? AND t.status = 'مفتوحة'${taskSql}
       ORDER BY t.due_date LIMIT 20`
    ).bind(officeId, ...taskBinds).all(),

    // أتعاب متأخرة
    env.DB.prepare(
      `SELECT f.id, f.amount_due, f.amount_paid, f.due_date, cl.name as client_name, cl.phone as client_phone
       FROM fees f LEFT JOIN clients cl ON cl.id = f.client_id
       WHERE f.office_id = ? AND f.status != 'مدفوع بالكامل' AND f.due_date <= ?
       ORDER BY f.due_date LIMIT 20`
    ).bind(officeId, today).all(),

    // إجمالي الأتعاب
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount_due),0) as total_due, COALESCE(SUM(amount_paid),0) as total_paid
       FROM fees WHERE office_id = ?`
    ).bind(officeId).first(),

    // إجمالي القضايا
    env.DB.prepare(
      `SELECT COUNT(*) as c FROM cases c WHERE c.office_id = ? AND c.deleted_at IS NULL AND c.status != 'مؤرشفة'${sc.sql}`
    ).bind(officeId, ...sc.binds).first(),

    // إجمالي الموكلين
    env.DB.prepare(
      `SELECT COUNT(*) as c FROM clients WHERE office_id = ? AND deleted_at IS NULL`
    ).bind(officeId).first(),
  ];

  const [sessions, tasks, fees, totals, casesCount, clientsCount] = await Promise.all(promises);

  return {
    sessions_today: sessions.results || [],
    open_tasks: tasks.results || [],
    overdue_fees: fees.results || [],
    financial_summary: totals || { total_due: 0, total_paid: 0 },
    total_cases: casesCount?.c || 0,
    total_clients: clientsCount?.c || 0,
  };
}

// ============================================================
// Monthly Trend — عدد الأشهر يحدده الفلتر
// ============================================================
export async function monthlyTrend(env, officeId, months = 12) {
  const now = new Date();
  // مفتاح الشهر بيتحسب بالأرقام (مش toISOString) عشان ميتأثرش بالتوقيت ويطلع الشهر اللي قبله
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const startMonth = ym(startDate);

  const revResult = await env.DB.prepare(
    `SELECT
       substr(je.entry_date, 1, 7) as month,
       COALESCE(SUM(jl.credit - jl.debit), 0) as total
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.office_id = ?
       AND a.type = 'revenue'
       AND je.entry_date >= ?
     GROUP BY substr(je.entry_date, 1, 7)
     ORDER BY month`
  ).bind(officeId, startMonth + '-01').all();

  const expResult = await env.DB.prepare(
    `SELECT
       substr(je.entry_date, 1, 7) as month,
       COALESCE(SUM(jl.debit - jl.credit), 0) as total
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.office_id = ?
       AND a.type = 'expense'
       AND je.entry_date >= ?
     GROUP BY substr(je.entry_date, 1, 7)
     ORDER BY month`
  ).bind(officeId, startMonth + '-01').all();

  const revMap = {};
  (revResult.results || []).forEach(r => { revMap[r.month] = Number(r.total) || 0; });

  const expMap = {};
  (expResult.results || []).forEach(r => { expMap[r.month] = Number(r.total) || 0; });

  const months_data = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = ym(d);
    const label = d.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });

    months_data.push({
      month: key,
      label,
      revenue: revMap[key] || 0,
      expenses: expMap[key] || 0,
    });
  }

  return months_data;
}

// ============================================================
// ✅ جديد: حساب فترة زمنية من فلتر
// ============================================================
export function getPeriodRange(period) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case '7d':
      return { from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to: today };
    case '30d':
      return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today };
    case '3m':
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: today };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: today };
    default:
      // افتراضي: الشهر الحالي
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today };
  }
}