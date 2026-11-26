import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson, toInt } from '../lib/validation.js';
import { autoEntryExpense } from '../services/accounting.js';
import { createNotification } from './notifications.js';
import { canAccessCase } from '../lib/permissions.js';

export const routes = [
  { method: 'POST', path: '/api/sessions',                       handler: createSession },
  { method: 'PATCH',  path: /^\/api\/sessions\/(\d+)$/,          handler: updateSession },
  { method: 'DELETE', path: /^\/api\/sessions\/(\d+)$/,          handler: deleteSession },
  { method: 'GET',  path: '/api/session-expenses',               handler: listExpenses },
  { method: 'POST', path: '/api/session-expenses',               handler: createExpense },
];

// الجلسة بتاعة المكتب ده؟ (ومتاحة للمستخدم لو صلاحيته "القضايا المكلّف بيها بس")
async function ownSession(env, officeId, access, authUser, id) {
  const s = await env.DB.prepare(
    `SELECT s.id, s.case_id, s.session_date, s.session_time, s.notes, c.case_number
       FROM sessions s JOIN cases c ON c.id = s.case_id
      WHERE s.id = ? AND c.office_id = ? AND c.deleted_at IS NULL`
  ).bind(id, officeId).first();
  if (!s) return null;
  if (!(await canAccessCase(env, access, authUser, s.case_id))) return null;
  return s;
}

// تعديل جلسة: التاريخ والوقت والملاحظات (قرار الجلسة)
async function updateSession({ request, env, authUser, officeId, access, params }) {
  const id = toInt(params[0]);
  const s = await ownSession(env, officeId, access, authUser, id);
  if (!s) return fail(env, 'الجلسة مش موجودة', 404);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const date = b.session_date ?? s.session_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return fail(env, 'تاريخ الجلسة غلط', 400);
  let time = s.session_time;
  if (b.session_time !== undefined) {
    time = /^([01]\d|2[0-3]):[0-5]\d$/.test(b.session_time || '') ? b.session_time : null;
  }
  let notes = s.notes;
  if (b.notes !== undefined) {
    notes = b.notes == null ? null : String(b.notes).slice(0, 2000);
  }

  await env.DB.prepare(`UPDATE sessions SET session_date = ?, session_time = ?, notes = ? WHERE id = ?`)
    .bind(date, time, notes, id).run();
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'session', entity_id: id, request,
    metadata: { from: { date: s.session_date, time: s.session_time }, to: { date, time } },
  });
  return ok(env, { id, session_date: date, session_time: time, notes });
}

// حذف جلسة — لو عليها مصاريف متسجلة (ليها قيود في الحسابات) لازم تتمسح الأول
async function deleteSession({ env, authUser, officeId, access, params, request }) {
  const id = toInt(params[0]);
  const s = await ownSession(env, officeId, access, authUser, id);
  if (!s) return fail(env, 'الجلسة مش موجودة', 404);
  const exp = await env.DB.prepare(`SELECT COUNT(*) AS n FROM session_expenses WHERE session_id = ?`).bind(id).first();
  if (exp?.n) return fail(env, `الجلسة دي عليها ${exp.n} مصروف متسجل — امسح المصاريف الأول (عشان الحسابات متتلخبطش)، وبعدين امسح الجلسة`, 409);
  await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'delete', entity: 'session', entity_id: id, request,
    metadata: { case_id: s.case_id, date: s.session_date },
  });
  return ok(env, { deleted: true });
}

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
    `INSERT INTO session_expenses (session_id, description, amount, billable) VALUES (?,?,?,?)`
  ).bind(b.session_id, b.description ?? null, b.amount, b.billable ? 1 : 0).run();

  try {
    await autoEntryExpense(env, {
      officeId,
      expenseId: r.meta.last_row_id,
      amount: b.amount,
      date: new Date().toISOString().slice(0, 10),
      description: b.description || 'مصروف جلسة',
      accountCode: '5301',
      refType: 'session_expense',
      billable: !!b.billable,
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