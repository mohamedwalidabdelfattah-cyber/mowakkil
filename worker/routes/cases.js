import { ok, fail } from '../lib/response.js';
import { validBranch } from './branches.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson } from '../lib/validation.js';
import { createNotification } from './notifications.js';
import { requireLimit } from '../middleware/feature-gate.js';
import { caseScope, can } from '../lib/permissions.js';

export const routes = [
  { method: 'GET',    path: '/api/cases',                    handler: list },
  { method: 'POST',   path: '/api/cases',                    handler: create },
  { method: 'GET',    path: /^\/api\/cases\/(\d+)\/profile$/, handler: profile },
  { method: 'PATCH',  path: /^\/api\/cases\/(\d+)$/,          handler: updateStatus },
  { method: 'DELETE', path: /^\/api\/cases\/(\d+)$/,          handler: remove },
];

async function list({ env, officeId, url, access, authUser }) {
  const archived = url.searchParams.get('archived') === '1';
  const search   = url.searchParams.get('search');
  const type     = url.searchParams.get('type');
  const court    = url.searchParams.get('court');

  const cond = archived ? `= 'مؤرشفة'` : `!= 'مؤرشفة'`;

  let query = `SELECT c.*, cl.name as client_name
               FROM cases c
               LEFT JOIN clients cl ON cl.id = c.client_id
               WHERE c.office_id = ? AND c.status ${cond} AND c.deleted_at IS NULL`;
  const binds = [officeId];

  if (search) {
    query += ' AND (c.case_number LIKE ? OR c.court LIKE ? OR cl.name LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (type) {
    query += ' AND c.case_type = ?';
    binds.push(type);
  }

  if (court) {
    query += ' AND c.court LIKE ?';
    binds.push(`%${court}%`);
  }

  // اللي شايف "المكلّف بيها بس"
  const scope = caseScope(access, authUser, 'c.id');
  query += scope.sql;
  binds.push(...scope.binds);

  query += ' ORDER BY c.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return ok(env, results || []);
}

async function create({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const casesCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM cases WHERE office_id = ? AND deleted_at IS NULL`
  ).bind(officeId).first();

  const limitFail = await requireLimit(env, officeId, 'max_cases', casesCount?.c || 0);
  if (limitFail) return limitFail;

  if (b.client_id) {
    const c = await env.DB.prepare(
      `SELECT id FROM clients WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
    ).bind(b.client_id, officeId).first();
    if (!c) return fail(env, 'الموكل مش موجود', 400);
  }

  const branchId = await validBranch(env, officeId, b.branch_id);
  if (branchId === undefined) return fail(env, 'الفرع مش موجود', 400);
  const r = await env.DB.prepare(
    `INSERT INTO cases (office_id, client_id, case_number, court, degree, case_type, branch_id)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(
    officeId,
    b.client_id ?? null,
    b.case_number ?? null,
    b.court ?? null,
    b.degree ?? null,
    b.case_type ?? null,
    branchId
  ).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'case', entity_id: r.meta.last_row_id, request,
  });

  // اللي أنشأ القضية بيبقى في فريقها تلقائياً (+ أي أعضاء اتختاروا في الفورم)
  try {
    const members = [authUser.user_id, ...(Array.isArray(b.member_ids) ? b.member_ids.map(toInt).filter(Boolean) : [])];
    const valid = (await env.DB.prepare(
      `SELECT id FROM users WHERE office_id = ? AND id IN (${members.map(() => '?').join(',')})`
    ).bind(officeId, ...members).all()).results || [];
    await env.DB.batch(valid.map(u => env.DB.prepare(
      `INSERT OR IGNORE INTO case_members (office_id, case_id, user_id) VALUES (?,?,?)`
    ).bind(officeId, r.meta.last_row_id, u.id)));
  } catch (e) {
    console.warn('case members insert failed:', e.message);
  }

  const caseNumber = b.case_number || `#${r.meta.last_row_id}`;
  await createNotification(env, {
    officeId,
    userId: null,
    type: 'case_created',
    title: '⚖️ قضية جديدة',
    body: `تم إنشاء قضية ${caseNumber}${b.court ? ' · ' + b.court : ''}`,
    link: `#case-${r.meta.last_row_id}`,
    icon: '⚖️',
    priority: 'normal',
    referenceType: 'case',
    referenceId: r.meta.last_row_id,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function profile({ env, officeId, params, access }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const caseRow = await env.DB.prepare(
    `SELECT c.*, cl.name as client_name, cl.phone as client_phone,
            cl.national_id as client_national_id
     FROM cases c
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ? AND c.office_id = ? AND c.deleted_at IS NULL`
  ).bind(id, officeId).first();

  if (!caseRow) return fail(env, 'القضية مش موجودة', 404);

  const { results: sessions } = await env.DB.prepare(
    `SELECT * FROM sessions WHERE case_id = ? ORDER BY session_date DESC`
  ).bind(id).all();

  // كل مصاريف القضية: جلسات + مهام + مصروفات عامة متسجلة على القضية (ومين بيتحمّلها)
  const { results: expenses } = await env.DB.prepare(
    `SELECT 'session' AS source, se.id, se.description, se.amount, se.billable, s.session_date, substr(se.created_at, 1, 10) AS date
       FROM session_expenses se JOIN sessions s ON s.id = se.session_id WHERE s.case_id = ?1
     UNION ALL
     SELECT 'task', te.id, te.description, te.amount, te.billable, NULL, substr(te.created_at, 1, 10)
       FROM task_expenses te JOIN tasks t ON t.id = te.task_id WHERE t.case_id = ?1 AND te.office_id = ?2
     UNION ALL
     SELECT 'general', e.id, e.description, e.total_amount, e.is_reimbursable, NULL, e.expense_date
       FROM expenses e WHERE e.case_id = ?1 AND e.office_id = ?2
     ORDER BY date DESC`
  ).bind(id, officeId).all();

  const { results: fees } = await env.DB.prepare(
    `SELECT * FROM fees WHERE case_id = ? AND office_id = ? ORDER BY created_at DESC`
  ).bind(id, officeId).all();

  const { results: documents } = await env.DB.prepare(
    `SELECT id, doc_type, file_name, r2_key, created_at
     FROM documents
     WHERE case_id = ? AND office_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(id, officeId).all();

  const { results: tasks } = await env.DB.prepare(
    `SELECT t.*, l.name as lawyer_name
     FROM tasks t
     LEFT JOIN lawyers l ON l.id = t.lawyer_id
     WHERE t.case_id = ? AND t.office_id = ?
     ORDER BY t.created_at DESC`
  ).bind(id, officeId).all();

  // اللي مش معاه صلاحية الأتعاب/المصروفات ميشوفش الفلوس في ملف القضية
  const showFees = can(access, 'fees.view');
  const showExpenses = can(access, 'expenses.view');
  const feesOut = showFees ? (fees || []) : [];
  const expensesOut = showExpenses ? (expenses || []) : [];
  const totalFees = feesOut.reduce((s, f) => s + (f.amount_due || 0), 0);
  const totalPaid = feesOut.reduce((s, f) => s + (f.amount_paid || 0), 0);
  const totalExpenses = expensesOut.reduce((s, e) => s + (e.amount || 0), 0);

  return ok(env, {
    case: caseRow,
    sessions: sessions || [],
    expenses: expensesOut,
    fees: feesOut,
    hidden: { fees: !showFees, expenses: !showExpenses },
    documents: documents || [],
    tasks: tasks || [],
    stats: {
      total_fees: totalFees,
      total_paid: totalPaid,
      total_remaining: totalFees - totalPaid,
      total_expenses: totalExpenses,
      sessions_count: (sessions || []).length,
      tasks_count: (tasks || []).length,
      documents_count: (documents || []).length,
    },
  });
}

async function updateStatus({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b || (!b.status && b.branch_id === undefined)) return fail(env, 'status مطلوب', 400);

  // الفرع (المتقدمة)
  if (b.branch_id !== undefined) {
    const branchId = await validBranch(env, officeId, b.branch_id);
    if (branchId === undefined) return fail(env, 'الفرع مش موجود', 400);
    await env.DB.prepare('UPDATE cases SET branch_id = ? WHERE id = ? AND office_id = ?').bind(branchId, id, officeId).run();
    if (!b.status) return ok(env, { updated: true });
  }

  const r = await env.DB.prepare(
    `UPDATE cases SET status = ? WHERE id = ? AND office_id = ?`
  ).bind(b.status, id, officeId).run();

  if (r.meta.changes === 0) return fail(env, 'not found', 404);
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'case', entity_id: id,
    metadata: { status: b.status }, request,
  });
  return ok(env, { updated: true });
}

async function remove({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const c = await env.DB.prepare(
    `SELECT id FROM cases WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!c) return fail(env, 'not found', 404);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE cases SET deleted_at = datetime('now') WHERE id = ? AND office_id = ?`
    ).bind(id, officeId),
    env.DB.prepare(
      `UPDATE sessions SET notes = COALESCE(notes,'') || ' [محذوفة]' WHERE case_id = ?`
    ).bind(id),
  ]);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'case', entity_id: id, request,
  });
  return ok(env, { deleted: true });
}