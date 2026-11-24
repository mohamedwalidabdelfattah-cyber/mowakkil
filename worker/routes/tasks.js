import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { isStr, toInt, safeJson } from '../lib/validation.js';
import { autoEntryExpense } from '../services/accounting.js';
import { createNotification } from './notifications.js';
import { canAccessCase } from '../lib/permissions.js';

export const routes = [
  { method: 'GET',   path: '/api/tasks',                 handler: list },
  { method: 'POST',  path: '/api/tasks',                 handler: create },
  { method: 'PATCH', path: /^\/api\/tasks\/(\d+)$/,      handler: update },
  { method: 'PATCH', path: /^\/api\/tasks\/(\d+)\/done$/, handler: markDone },
  { method: 'GET',   path: /^\/api\/tasks\/(\d+)\/profile$/, handler: profile },
  { method: 'POST',   path: /^\/api\/tasks\/(\d+)\/expense$/,        handler: addExpense },
  { method: 'DELETE', path: /^\/api\/tasks\/(\d+)$/,                  handler: removeTask },
  { method: 'DELETE', path: /^\/api\/task-expenses\/(\d+)$/,         handler: removeExpense },
];

async function list({ env, officeId, url, access, authUser }) {
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status');
  const due    = url.searchParams.get('due'); // 'overdue' | 'today' | 'week'
  const lawyerId = toInt(url.searchParams.get('lawyer_id'));

  let query = `SELECT t.*, l.name as lawyer_name, c.case_number FROM tasks t
               LEFT JOIN lawyers l ON l.id = t.lawyer_id
               LEFT JOIN cases c ON c.id = t.case_id
               WHERE t.office_id = ?`;
  const binds = [officeId];

  if (search) {
    query += ' AND (t.title LIKE ? OR t.notes LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (status)   { query += ' AND t.status = ?';   binds.push(status); }
  if (lawyerId) { query += ' AND t.lawyer_id = ?'; binds.push(lawyerId); }

  if (due === 'overdue') {
    query += ` AND t.due_date < date('now') AND t.status != 'منجزة'`;
  } else if (due === 'today') {
    query += ` AND t.due_date = date('now') AND t.status != 'منجزة'`;
  } else if (due === 'week') {
    query += ` AND t.due_date BETWEEN date('now') AND date('now', '+7 days') AND t.status != 'منجزة'`;
  }

  // "المكلّف بيها بس": مهام قضاياه + المهام العامة (من غير قضية)
  if (access?.scope === 'assigned') {
    query += ' AND (t.case_id IS NULL OR t.case_id IN (SELECT case_id FROM case_members WHERE user_id = ? AND office_id = ?))';
    binds.push(authUser.user_id, officeId);
  }

  query += ' ORDER BY t.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return ok(env, results || []);
}

async function create({ request, env, authUser, officeId, access }) {
  const b = await safeJson(request);
  if (!b || !isStr(b.title, 300)) return fail(env, 'اكتب عنوان المهمة', 400);
  if (b.case_id && !(await canAccessCase(env, access, authUser, toInt(b.case_id)))) return fail(env, 'القضية مش موجودة', 400);

  const r = await env.DB.prepare(
    `INSERT INTO tasks (office_id, lawyer_id, case_id, title, due_date)
     VALUES (?,?,?,?,?)`
  ).bind(
    officeId,
    b.lawyer_id ?? null,
    b.case_id ?? null,
    b.title.trim(),
    b.due_date ?? null
  ).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'task', entity_id: r.meta.last_row_id, request,
  });

  let lawyerName = null;
  let lawyerUserId = null;

  if (b.lawyer_id) {
    const lawyer = await env.DB.prepare(
      `SELECT id, name, user_id FROM lawyers WHERE id = ?`
    ).bind(b.lawyer_id).first();
    lawyerName = lawyer?.name;
    lawyerUserId = lawyer?.user_id || null;
  }

  await createNotification(env, {
    officeId,
    userId: lawyerUserId,
    type: 'task_assigned',
    title: lawyerUserId ? '📌 مهمة جديدة لك' : '✅ مهمة جديدة',
    body: `${b.title.trim()}${lawyerName ? '\n👤 ' + lawyerName : ''}${b.due_date ? '\n📅 ' + b.due_date : ''}`,
    link: `#task-${r.meta.last_row_id}`,
    icon: '✅',
    priority: 'normal',
    referenceType: 'task',
    referenceId: r.meta.last_row_id,
    dueAt: b.due_date || null,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function update({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const task = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!task) return fail(env, 'المهمة مش موجودة', 404);

  const b = await safeJson(request);
  if (!b) return fail(env, 'بيانات غير صالحة', 400);

  const title = b.title !== undefined ? (b.title || '').trim() : task.title;
  if (!title) return fail(env, 'عنوان المهمة مطلوب', 400);

  const due_date = b.due_date !== undefined ? (b.due_date || null) : task.due_date;
  const lawyer_id = b.lawyer_id !== undefined ? (b.lawyer_id || null) : task.lawyer_id;
  const case_id = b.case_id !== undefined ? (b.case_id || null) : task.case_id;
  const status = b.status !== undefined ? b.status : task.status;

  await env.DB.prepare(
    `UPDATE tasks SET title = ?, due_date = ?, lawyer_id = ?, case_id = ?, status = ?
     WHERE id = ? AND office_id = ?`
  ).bind(title, due_date, lawyer_id, case_id, status, id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'task', entity_id: id,
    metadata: { title, due_date, lawyer_id, case_id, status }, request,
  });

  return ok(env, { updated: true });
}

async function markDone({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const r = await env.DB.prepare(
    `UPDATE tasks SET status = 'منجزة' WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).run();

  if (r.meta.changes === 0) return fail(env, 'not found', 404);
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'task', entity_id: id,
  });
  return ok(env, { updated: true });
}

async function removeTask({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const task = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!task) return fail(env, 'المهمة مش موجودة', 404);

  try {
    const { results: exps } = await env.DB.prepare(
      `SELECT id FROM task_expenses WHERE task_id = ? AND office_id = ?`
    ).bind(id, officeId).all();

    for (const ex of exps || []) {
      try {
        await env.DB.prepare(
          `DELETE FROM journal_lines WHERE entry_id IN
            (SELECT id FROM journal_entries WHERE reference_type = 'task_expense' AND reference_id = ? AND office_id = ?)`
        ).bind(ex.id, officeId).run();
        await env.DB.prepare(
          `DELETE FROM journal_entries WHERE reference_type = 'task_expense' AND reference_id = ? AND office_id = ?`
        ).bind(ex.id, officeId).run();
      } catch (e) {
        console.error('delete journal failed:', e.message);
      }
    }

    await env.DB.prepare(
      `DELETE FROM task_expenses WHERE task_id = ? AND office_id = ?`
    ).bind(id, officeId).run();

    await env.DB.prepare(
      `UPDATE documents SET deleted_at = datetime('now') 
       WHERE task_id = ? AND office_id = ? AND deleted_at IS NULL`
    ).bind(id, officeId).run();

    await env.DB.prepare(
      `DELETE FROM tasks WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).run();

  } catch (e) {
    console.error('remove task failed:', e.message);
    return fail(env, 'فشل الحذف: ' + e.message, 500);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'task', entity_id: id,
  });

  return ok(env, { deleted: true });
}

async function profile({ env, officeId, params }) {
  const id = toInt(params[0]);
  const task = await env.DB.prepare(
    `SELECT t.*, l.name as lawyer_name, l.phone as lawyer_phone,
            c.case_number, c.court, c.degree
     FROM tasks t
     LEFT JOIN lawyers l ON l.id = t.lawyer_id
     LEFT JOIN cases c ON c.id = t.case_id
     WHERE t.id = ? AND t.office_id = ?`
  ).bind(id, officeId).first();
  if (!task) return fail(env, 'not found', 404);

  let sessions = [];
  if (task.case_id) {
    const s = await env.DB.prepare(
      `SELECT * FROM sessions WHERE case_id = ? ORDER BY session_date DESC LIMIT 5`
    ).bind(task.case_id).all();
    sessions = s.results || [];
  }

  const { results: taskExpenses } = await env.DB.prepare(
    `SELECT * FROM task_expenses WHERE task_id = ? ORDER BY created_at DESC`
  ).bind(id).all();

  let sessionExpenses = [];
  if (task.case_id) {
    const e = await env.DB.prepare(
      `SELECT se.*, s.session_date FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       WHERE s.case_id = ?
       ORDER BY se.created_at DESC LIMIT 10`
    ).bind(task.case_id).all();
    sessionExpenses = e.results || [];
  }

  const docs = (await env.DB.prepare(
    `SELECT * FROM documents
     WHERE office_id = ? AND (task_id = ? OR case_id = ?) AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(officeId, id, task.case_id || 0).all()).results;

  const totalTaskExpenses = (taskExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const totalSessionExpenses = (sessionExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);

  return ok(env, {
    task,
    sessions,
    task_expenses: taskExpenses || [],
    session_expenses: sessionExpenses || [],
    documents: docs,
    totals: {
      task_expenses: totalTaskExpenses,
      session_expenses: totalSessionExpenses,
      all: totalTaskExpenses + totalSessionExpenses,
    },
  });
}

async function addExpense({ request, env, authUser, officeId, params }) {
  const taskId = toInt(params[0]);
  if (!taskId) return fail(env, 'id غلط', 400);

  const b = await safeJson(request);
  if (!b || !(Number(b.amount) > 0)) {
    return fail(env, 'اكتب المبلغ', 400);
  }

  const task = await env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ? AND office_id = ?`
  ).bind(taskId, officeId).first();
  if (!task) return fail(env, 'المهمة مش موجودة', 404);

  const description = b.description || `مصروف مهمة: ${task.title}`;

  const r = await env.DB.prepare(
    `INSERT INTO task_expenses (office_id, task_id, description, amount, created_by)
     VALUES (?,?,?,?,?)`
  ).bind(officeId, taskId, description, b.amount, authUser.user_id).run();

  try {
    await autoEntryExpense(env, {
      officeId,
      expenseId: r.meta.last_row_id,
      amount: b.amount,
      date: new Date().toISOString().slice(0, 10),
      description,
      accountCode: '5301',
      refType: 'task_expense',
      userId: authUser.user_id,
    });
  } catch (e) {
    console.error('auto journal entry failed:', e.message);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'task_expense', entity_id: r.meta.last_row_id,
    metadata: { task_id: taskId, amount: b.amount }, request,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function removeExpense({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const ex = await env.DB.prepare(
    `SELECT * FROM task_expenses WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!ex) return fail(env, 'المصروف مش موجود', 404);

  try {
    await env.DB.prepare(
      `DELETE FROM journal_lines WHERE entry_id IN
        (SELECT id FROM journal_entries WHERE reference_type = 'task_expense' AND reference_id = ? AND office_id = ?)`
    ).bind(id, officeId).run();
    await env.DB.prepare(
      `DELETE FROM journal_entries WHERE reference_type = 'task_expense' AND reference_id = ? AND office_id = ?`
    ).bind(id, officeId).run();
  } catch (e) {
    console.error('delete journal failed:', e.message);
  }

  await env.DB.prepare(`DELETE FROM task_expenses WHERE id = ?`).bind(id).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'task_expense', entity_id: id,
  });

  return ok(env, { deleted: true });
}