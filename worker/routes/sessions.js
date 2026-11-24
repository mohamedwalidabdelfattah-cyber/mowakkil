import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson, toInt } from '../lib/validation.js';
import { autoEntryExpense } from '../services/accounting.js';
import { createNotification } from './notifications.js';
import { canAccessCase } from '../lib/permissions.js';

export const routes = [
  { method: 'POST', path: '/api/sessions',                       handler: createSession },
  { method: 'GET',  path: '/api/session-expenses',               handler: listExpenses },
  { method: 'POST', path: '/api/session-expenses',               handler: createExpense },
];

async function createSession({ request, env, authUser, officeId, access }) {
  const b = await safeJson(request);
  if (!b || !b.case_id || !b.session_date) {
    return fail(env, 'case_id و session_date مطلوبين', 400);
  }
  if (!(await canAccessCase(env, access, authUser, toInt(b.case_id)))) return fail(env, 'القضية مش موجودة', 400);

  const c = await env.DB.prepare(
    `SELECT id, case_number, court FROM cases WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(b.case_id, officeId).first();
  if (!c) return fail(env, 'القضية مش موجودة', 400);

  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(b.session_time || '') ? b.session_time : null;
  const r = await env.DB.prepare(
    `INSERT INTO sessions (case_id, session_date, notes, session_time) VALUES (?,?,?,?)`
  ).bind(b.case_id, b.session_date, b.notes ?? null, time).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'session', entity_id: r.meta.last_row_id, request,
  });

  // 🔔 إشعار فوري
  const caseNumber = c.case_number || `#${b.case_id}`;
  await createNotification(env, {
    officeId,
    userId: null,
    type: 'session_created',
    title: '📅 جلسة جديدة',
    body: `قضية ${caseNumber}${c.court ? ' · ' + c.court : ''}\n📅 ${b.session_date}${time ? ' · ' + time : ''}`,
    link: `#case-${b.case_id}`,
    icon: '📅',
    priority: 'normal',
    referenceType: 'session',
    referenceId: r.meta.last_row_id,
    dueAt: b.session_date,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function listExpenses({ env, officeId }) {
  const { results } = await env.DB.prepare(
    `SELECT se.*, c.case_number FROM session_expenses se
     JOIN sessions s ON s.id = se.session_id
     JOIN cases c ON c.id = s.case_id
     WHERE c.office_id = ? ORDER BY se.created_at DESC`
  ).bind(officeId).all();
  return ok(env, results);
}

async function createExpense({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b || !b.session_id || !(Number(b.amount) > 0)) {
    return fail(env, 'بيانات ناقصة', 400);
  }

  const s = await env.DB.prepare(
    `SELECT s.id FROM sessions s
     JOIN cases c ON c.id = s.case_id
     WHERE s.id = ? AND c.office_id = ?`
  ).bind(b.session_id, officeId).first();
  if (!s) return fail(env, 'الجلسة مش موجودة', 400);

  const r = await env.DB.prepare(
    `INSERT INTO session_expenses (session_id, description, amount) VALUES (?,?,?)`
  ).bind(b.session_id, b.description ?? null, b.amount).run();

  try {
    await autoEntryExpense(env, {
      officeId,
      expenseId: r.meta.last_row_id,
      amount: b.amount,
      date: new Date().toISOString().slice(0, 10),
      description: b.description || 'مصروف جلسة',
      accountCode: '5301',
      userId: authUser.user_id,
    });
  } catch (e) {
    console.error('auto journal entry failed:', e.message);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'session_expense', entity_id: r.meta.last_row_id, request,
  });
  return ok(env, { id: r.meta.last_row_id }, 201);
}