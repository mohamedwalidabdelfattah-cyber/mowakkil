import { ok, fail } from '../lib/response.js';
import { dashboard, monthlyTrend, getPeriodRange } from '../services/dashboard.js';
import { caseScope, can } from '../lib/permissions.js';

export const routes = [
  { method: 'GET', path: '/api/reports/monthly',        handler: monthly, adminOnly: true },
  { method: 'GET', path: '/api/reports/monthly-trend',  handler: trend, adminOnly: true },
  { method: 'GET', path: '/api/agenda',                 handler: agenda },
  { method: 'GET', path: '/api/dashboard',              handler: dash },
];

async function monthly({ env, officeId, url }) {
  const month = url.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return fail(env, 'month مطلوب (YYYY-MM)', 400);
  }

  const [fees, salaries, expenses] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount_due),0) as due, COALESCE(SUM(amount_paid),0) as paid
       FROM fees WHERE office_id = ? AND substr(due_date,1,7) = ?`
    ).bind(officeId, month),
    env.DB.prepare(
      `SELECT COALESCE(SUM(salary),0) as total FROM lawyers WHERE office_id = ? AND active = 1`
    ).bind(officeId),
    env.DB.prepare(
      `SELECT COALESCE(SUM(se.amount),0) as total FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       JOIN cases c ON c.id = s.case_id
       WHERE c.office_id = ? AND substr(se.created_at,1,7) = ?`
    ).bind(officeId, month),
  ]);

  const f = fees.results?.[0] || { due: 0, paid: 0 };
  const sal = salaries.results?.[0]?.total || 0;
  const exp = expenses.results?.[0]?.total || 0;
  const net = (f.paid || 0) - sal - exp;

  return ok(env, {
    month,
    fees_due: f.due,
    fees_paid: f.paid,
    salaries: sal,
    expenses: exp,
    net,
  });
}

async function trend({ env, officeId, url }) {
  const months = Math.min(Math.max(parseInt(url.searchParams.get('months') || '12', 10), 1), 24);
  const data = await monthlyTrend(env, officeId, months);
  return ok(env, data);
}

async function agenda({ env, officeId, url, access, authUser }) {
  const sc = caseScope(access, authUser, 'c.id');
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7', 10), 1), 60);
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const { results } = await env.DB.prepare(
    `SELECT s.id, s.session_date, s.case_id, c.case_number, c.court, cl.name as client_name, cl.phone as client_phone
     FROM sessions s
     JOIN cases c ON c.id = s.case_id
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.office_id = ? AND c.deleted_at IS NULL
       AND s.session_date BETWEEN ? AND ?${sc.sql}
     ORDER BY s.session_date`
  ).bind(officeId, today, end, ...sc.binds).all();
  return ok(env, results);
}

async function dash({ env, officeId, url, access, authUser }) {
  const period = url.searchParams.get('period') || 'month';
  const range = getPeriodRange(period);
  const data = await dashboard(env, officeId, { ...range, scope: caseScope(access, authUser, 'c.id'), assignedUser: access?.scope === 'assigned' ? authUser.user_id : null });
  // اللي مش معاه صلاحية الأتعاب ميشوفش الأرقام المالية في لوحة التحكم
  if (!can(access, 'fees.view')) {
    data.overdue_fees = [];
    data.financial_summary = null;
  }
  return ok(env, data);
}