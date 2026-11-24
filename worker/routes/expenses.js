// worker/routes/expenses.js
// المصاريف — عامة + جلسات + مهام (مدمجة)

import { ok, fail } from '../lib/response.js';
import { assertOpen } from '../lib/period-lock.js';
import { trustBalance, autoEntryTrustExpense, payrollPreview, runPayroll, generateRecurring } from '../services/finance-advanced.js';
import { requireFeature as needFeature } from '../middleware/feature-gate.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { autoEntryExpense, deleteEntriesFor, REF } from '../services/accounting.js';
import { requireFeature } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',    path: '/api/expenses',                       handler: list },
  { method: 'POST',   path: '/api/expenses',                       handler: create },
  { method: 'GET',    path: '/api/expenses/stats',                 handler: stats },
  { method: 'GET',    path: '/api/expenses/recurring',             handler: recurringList },
  { method: 'GET',    path: '/api/expenses/payroll',               handler: payrollGet },
  { method: 'POST',   path: '/api/expenses/payroll',               handler: payrollPost },
  { method: 'GET',    path: /^\/api\/expenses\/(\d+)$/,            handler: get },
  { method: 'PATCH',  path: /^\/api\/expenses\/(\d+)$/,            handler: update },
  { method: 'DELETE', path: /^\/api\/expenses\/(\d+)$/,            handler: remove },
];

// ============================================================
// ✅ قائمة المصاريف — عامة + جلسات + مهام (مدمجة)
// ============================================================
async function list({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;
  // المصاريف المتكررة اللي جه ميعادها تتسجل (لو الكرون لسه ما اشتغلش النهارده)
  await generateRecurring(env, { officeId }).catch(e => console.warn('recurring failed', e.message));

  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');
  const source = url.searchParams.get('source'); // 'general' | 'session' | 'task' | null
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '300', 10), 1000);

  // ---------- 1) المصاريف العامة ----------
  let q1 = `SELECT
              'general' as source,
              e.id, e.expense_date as date, e.description,
              e.total_amount as amount,
              e.payment_method, e.vendor,
              a.code as account_code, a.name as account_name,
              c.case_number, cl.name as client_name,
              NULL as task_title,
              u.full_name as created_by_name,
              e.is_recurring, e.recurring_frequency, e.recurring_parent_id,
              COALESCE(e.is_reimbursable, 0) AS on_client, COALESCE(e.paid_from_trust, 0) AS from_trust
            FROM expenses e
            LEFT JOIN accounts a ON a.id = e.account_id
            LEFT JOIN cases c ON c.id = e.case_id
            LEFT JOIN clients cl ON cl.id = e.client_id
            LEFT JOIN users u ON u.id = e.created_by
            WHERE e.office_id = ?`;
  const binds1 = [officeId];
  if (fromDate) { q1 += ` AND e.expense_date >= ?`; binds1.push(fromDate); }
  if (toDate)   { q1 += ` AND e.expense_date <= ?`; binds1.push(toDate); }

  // ---------- 2) مصاريف الجلسات ----------
  let q2 = `SELECT
              'session' as source,
              se.id, date(s.created_at) as date,
              se.description,
              se.amount,
              NULL as payment_method, NULL as vendor,
              '5301' as account_code, 'مصاريف قضائية' as account_name,
              c.case_number, cl.name as client_name,
              NULL as task_title,
              NULL as created_by_name,
              0 AS is_recurring, NULL AS recurring_frequency, NULL AS recurring_parent_id,
              COALESCE(se.billable, 0) AS on_client, 0 AS from_trust
            FROM session_expenses se
            JOIN sessions s ON s.id = se.session_id
            JOIN cases c ON c.id = s.case_id
            LEFT JOIN clients cl ON cl.id = c.client_id
            WHERE c.office_id = ?`;
  const binds2 = [officeId];
  if (fromDate) { q2 += ` AND date(s.created_at) >= ?`; binds2.push(fromDate); }
  if (toDate)   { q2 += ` AND date(s.created_at) <= ?`; binds2.push(toDate); }

  // ---------- 3) مصاريف المهام ----------
  let q3 = `SELECT
              'task' as source,
              te.id, date(te.created_at) as date,
              te.description,
              te.amount,
              NULL as payment_method, NULL as vendor,
              '5301' as account_code, 'مصاريف مهام' as account_name,
              c.case_number, NULL as client_name,
              t.title as task_title,
              NULL as created_by_name,
              0 AS is_recurring, NULL AS recurring_frequency, NULL AS recurring_parent_id,
              COALESCE(te.billable, 0) AS on_client, 0 AS from_trust
            FROM task_expenses te
            JOIN tasks t ON t.id = te.task_id
            LEFT JOIN cases c ON c.id = t.case_id
            WHERE te.office_id = ?`;
  const binds3 = [officeId];
  if (fromDate) { q3 += ` AND date(te.created_at) >= ?`; binds3.push(fromDate); }
  if (toDate)   { q3 += ` AND date(te.created_at) <= ?`; binds3.push(toDate); }

  // ---------- 4) ندمج ----------
  let results = [];

  if (!source || source === 'general') {
    const r = await env.DB.prepare(q1).bind(...binds1).all();
    results = results.concat(r.results || []);
  }
  if (!source || source === 'session') {
    const r = await env.DB.prepare(q2).bind(...binds2).all();
    results = results.concat(r.results || []);
  }
  if (!source || source === 'task') {
    const r = await env.DB.prepare(q3).bind(...binds3).all();
    results = results.concat(r.results || []);
  }

  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  results = results.slice(0, limit);

  return ok(env, results);
}

// ============================================================
// ✅ مصروف واحد
// ============================================================
async function get({ env, officeId, params, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const source = url.searchParams.get('source') || 'general';

  if (source === 'session') {
    const r = await env.DB.prepare(
      `SELECT 'session' as source, se.*, c.case_number
       FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       JOIN cases c ON c.id = s.case_id
       WHERE se.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!r) return fail(env, 'not found', 404);
    return ok(env, r);
  }

  if (source === 'task') {
    const r = await env.DB.prepare(
      `SELECT 'task' as source, te.*, t.title as task_title
       FROM task_expenses te
       JOIN tasks t ON t.id = te.task_id
       WHERE te.id = ? AND te.office_id = ?`
    ).bind(id, officeId).first();
    if (!r) return fail(env, 'not found', 404);
    return ok(env, r);
  }

  const r = await env.DB.prepare(
    `SELECT 'general' as source, e.*, a.code as account_code, a.name as account_name,
            c.case_number, cl.name as client_name
     FROM expenses e
     LEFT JOIN accounts a ON a.id = e.account_id
     LEFT JOIN cases c ON c.id = e.case_id
     LEFT JOIN clients cl ON cl.id = e.client_id
     WHERE e.id = ? AND e.office_id = ?`
  ).bind(id, officeId).first();
  if (!r) return fail(env, 'not found', 404);
  return ok(env, r);
}

// ============================================================
// إنشاء مصروف عام
// ============================================================
async function create({ request, env, authUser, officeId }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!isStr(b.description, 300)) return fail(env, 'اكتب وصف المصروف', 400);
  if (!b.expense_date) return fail(env, 'اكتب تاريخ المصروف', 400);

  const amount = Number(b.amount);
  if (!amount || amount <= 0) return fail(env, 'اكتب مبلغ صحيح', 400);

  const tax = Number(b.tax_amount) || 0;
  const total = amount + tax;
  if (b.case_id && !b.client_id) {
    const c = await env.DB.prepare('SELECT client_id FROM cases WHERE id = ? AND office_id = ?').bind(b.case_id, officeId).first();
    if (c?.client_id) b.client_id = c.client_id;
  }
  if (b.is_reimbursable && !b.client_id) return fail(env, 'المصروف على حساب الموكل محتاج قضية أو موكل', 400);
  try { await assertOpen(env, officeId, b.expense_date); } catch (e) { return fail(env, e.message, 423); }
  // الصرف من أمانة الموكل (الاحترافية وفوق)
  if (b.paid_from_trust) {
    const g = await needFeature(env, officeId, 'accounting');
    if (g) return g;
    if (!b.client_id) return fail(env, 'الصرف من الأمانة محتاج قضية أو موكل', 400);
    const bal = await trustBalance(env, officeId, b.client_id);
    if (total > bal + 0.009) return fail(env, `رصيد أمانة الموكل ${bal} — أقل من المصروف`, 400);
    b.is_reimbursable = 0;
  }
  if (b.is_recurring && !['monthly', 'quarterly', 'yearly'].includes(b.recurring_frequency)) b.recurring_frequency = 'monthly';

  let accountId = b.account_id || null;
  if (accountId) {
    const acc = await env.DB.prepare(
      `SELECT id FROM accounts WHERE id = ? AND office_id = ? AND category = 'expense'`
    ).bind(accountId, officeId).first();
    if (!acc) return fail(env, 'الحساب مش موجود أو مش من نوع مصروف', 400);
  } else {
    const defaultAcc = await env.DB.prepare(
      `SELECT id FROM accounts WHERE office_id = ? AND code = '5406'`
    ).bind(officeId).first();
    if (defaultAcc) accountId = defaultAcc.id;
  }

  const r = await env.DB.prepare(
    `INSERT INTO expenses
      (office_id, expense_date, description, account_id, amount, tax_amount, total_amount,
       payment_method, vendor, reference_number, case_id, client_id,
       is_reimbursable, is_recurring, recurring_frequency, receipt_url, notes, created_by, paid_from_trust)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    officeId,
    b.expense_date,
    b.description,
    accountId,
    amount,
    tax,
    total,
    b.payment_method || null,
    b.vendor || null,
    b.reference_number || null,
    b.case_id || null,
    b.client_id || null,
    b.is_reimbursable ? 1 : 0,
    b.is_recurring ? 1 : 0,
    b.recurring_frequency || null,
    b.receipt_url || null,
    b.notes || null,
    authUser.user_id,
    b.paid_from_trust ? 1 : 0
  ).run();

  if (b.paid_from_trust) {
    await autoEntryTrustExpense(env, { officeId, expenseId: r.meta.last_row_id, amount: total, date: b.expense_date, description: b.description, method: b.payment_method, userId: authUser.user_id });
    await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'expense', entity_id: r.meta.last_row_id, request });
    return ok(env, { id: r.meta.last_row_id }, 201);
  }

  try {
    let accountCode = '5406';
    if (accountId) {
      const acc = await env.DB.prepare(`SELECT code FROM accounts WHERE id = ?`)
        .bind(accountId).first();
      if (acc?.code) accountCode = acc.code;
    }

    await autoEntryExpense(env, {
      officeId,
      expenseId: r.meta.last_row_id,
      amount: total,
      date: b.expense_date,
      description: b.description,
      accountCode,
      method: b.payment_method || null,
      refType: REF.expense,
      billable: !!b.is_reimbursable,
      userId: authUser.user_id,
    });
  } catch (e) {
    console.error('auto journal entry failed:', e.message);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'expense', entity_id: r.meta.last_row_id,
    metadata: { amount: total, account_id: accountId }, request,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

// ============================================================
// ✅ تعديل مصروف (عام + جلسة + مهمة)
// ============================================================
async function update({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const source = b.source || 'general';

  // ---------- جلسة ----------
  if (source === 'session') {
    const s = await env.DB.prepare(
      `SELECT se.* FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       JOIN cases c ON c.id = s.case_id
       WHERE se.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!s) return fail(env, 'not found', 404);

    const fields = [];
    const binds = [];
    if (b.description !== undefined) { fields.push('description = ?'); binds.push(b.description); }
    if (b.amount !== undefined)      { fields.push('amount = ?'); binds.push(Number(b.amount)); }
    if (b.billable !== undefined)    { fields.push('billable = ?'); binds.push(b.billable ? 1 : 0); }

    if (!fields.length) return fail(env, 'مفيش تغييرات', 400);
    binds.push(id);

    await env.DB.prepare(
      `UPDATE session_expenses SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...binds).run();
    await repostSimpleExpense(env, officeId, REF.session_expense, id, authUser.user_id);

    return ok(env, { updated: true });
  }

  // ---------- مهمة ----------
  if (source === 'task') {
    const te = await env.DB.prepare(
      `SELECT * FROM task_expenses WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();
    if (!te) return fail(env, 'not found', 404);

    const fields = [];
    const binds = [];
    if (b.description !== undefined) { fields.push('description = ?'); binds.push(b.description); }
    if (b.amount !== undefined)      { fields.push('amount = ?'); binds.push(Number(b.amount)); }
    if (b.billable !== undefined)    { fields.push('billable = ?'); binds.push(b.billable ? 1 : 0); }

    if (!fields.length) return fail(env, 'مفيش تغييرات', 400);
    binds.push(id);

    await env.DB.prepare(
      `UPDATE task_expenses SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...binds).run();
    await repostSimpleExpense(env, officeId, REF.task_expense, id, authUser.user_id);

    return ok(env, { updated: true });
  }

  // ---------- عام ----------
  const existing = await env.DB.prepare(
    `SELECT * FROM expenses WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!existing) return fail(env, 'not found', 404);

  const fields = [];
  const binds = [];

  if (b.expense_date !== undefined)       { fields.push('expense_date = ?'); binds.push(b.expense_date); }
  if (b.description !== undefined)        { fields.push('description = ?'); binds.push(b.description); }
  if (b.account_id !== undefined)         { fields.push('account_id = ?'); binds.push(b.account_id || null); }
  if (b.amount !== undefined)             { fields.push('amount = ?'); binds.push(Number(b.amount)); }
  if (b.tax_amount !== undefined)         { fields.push('tax_amount = ?'); binds.push(Number(b.tax_amount) || 0); }
  if (b.total_amount !== undefined)       { fields.push('total_amount = ?'); binds.push(Number(b.total_amount)); }
  if (b.payment_method !== undefined)     { fields.push('payment_method = ?'); binds.push(b.payment_method); }
  if (b.vendor !== undefined)             { fields.push('vendor = ?'); binds.push(b.vendor); }
  if (b.case_id !== undefined)            { fields.push('case_id = ?'); binds.push(b.case_id || null); }
  if (b.client_id !== undefined)          { fields.push('client_id = ?'); binds.push(b.client_id || null); }
  if (b.notes !== undefined)              { fields.push('notes = ?'); binds.push(b.notes); }
  if (b.is_reimbursable !== undefined)    { fields.push('is_reimbursable = ?'); binds.push(b.is_reimbursable ? 1 : 0); }
  if (b.is_recurring !== undefined)       { fields.push('is_recurring = ?'); binds.push(b.is_recurring ? 1 : 0); }
  if (b.recurring_frequency !== undefined && ['monthly', 'quarterly', 'yearly'].includes(b.recurring_frequency)) { fields.push('recurring_frequency = ?'); binds.push(b.recurring_frequency); }
  try { await assertOpen(env, officeId, existing.expense_date); if (b.expense_date) await assertOpen(env, officeId, b.expense_date); } catch (e) { return fail(env, e.message, 423); }

  if (!fields.length) return fail(env, 'مفيش تغييرات', 400);
  binds.push(id, officeId);

  await env.DB.prepare(
    `UPDATE expenses SET ${fields.join(', ')} WHERE id = ? AND office_id = ?`
  ).bind(...binds).run();

  // القيد يتحدّث بالمبلغ/الحساب/طريقة الدفع الجديدة
  const e2 = await env.DB.prepare('SELECT e.*, a.code AS account_code FROM expenses e LEFT JOIN accounts a ON a.id = e.account_id WHERE e.id = ? AND e.office_id = ?').bind(id, officeId).first();
  if (e2 && e2.paid_from_trust) {
    await deleteEntriesFor(env, officeId, REF.expense, id);
    await autoEntryTrustExpense(env, { officeId, expenseId: id, amount: Number(e2.total_amount) || 0, date: e2.expense_date, description: e2.description, method: e2.payment_method, userId: authUser.user_id });
  } else if (e2) {
    await deleteEntriesFor(env, officeId, REF.expense, id);
    await autoEntryExpense(env, { officeId, expenseId: id, amount: Number(e2.total_amount) || Number(e2.amount) || 0, date: e2.expense_date,
      description: e2.description, accountCode: e2.account_code || '5406', method: e2.payment_method, refType: REF.expense, billable: !!e2.is_reimbursable, userId: authUser.user_id });
  }

  return ok(env, { updated: true });
}

// إعادة قيد مصروف جلسة/مهمة بعد التعديل
async function repostSimpleExpense(env, officeId, refType, id, userId) {
  const row = refType === REF.session_expense
    ? await env.DB.prepare('SELECT se.amount, se.description, se.created_at, se.billable FROM session_expenses se WHERE se.id = ?').bind(id).first()
    : await env.DB.prepare('SELECT amount, description, created_at, billable FROM task_expenses WHERE id = ? AND office_id = ?').bind(id, officeId).first();
  await deleteEntriesFor(env, officeId, refType, id);
  if (row && Number(row.amount) > 0) {
    await autoEntryExpense(env, { officeId, expenseId: id, amount: Number(row.amount), date: String(row.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      description: row.description || (refType === REF.session_expense ? 'مصروف جلسة' : 'مصروف مهمة'), accountCode: '5301', refType, billable: !!row.billable, userId });
  }
}

// ============================================================
// ✅ حذف مصروف (عام + جلسة + مهمة)
// ============================================================
async function remove({ env, authUser, officeId, params, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const source = url.searchParams.get('source') || 'general';

  // ---------- جلسة ----------
  if (source === 'session') {
    const s = await env.DB.prepare(
      `SELECT se.id FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       JOIN cases c ON c.id = s.case_id
       WHERE se.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!s) return fail(env, 'not found', 404);

    await deleteEntriesFor(env, officeId, REF.session_expense, id);

    await env.DB.prepare(`DELETE FROM session_expenses WHERE id = ?`).bind(id).run();

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'delete', entity: 'session_expense', entity_id: id,
    });
    return ok(env, { deleted: true });
  }

  // ---------- مهمة ----------
  if (source === 'task') {
    const ex = await env.DB.prepare(
      `SELECT id FROM task_expenses WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();
    if (!ex) return fail(env, 'not found', 404);

    await deleteEntriesFor(env, officeId, REF.task_expense, id);

    await env.DB.prepare(`DELETE FROM task_expenses WHERE id = ?`).bind(id).run();

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'delete', entity: 'task_expense', entity_id: id,
    });
    return ok(env, { deleted: true });
  }

  // ---------- عام ----------
  const existing = await env.DB.prepare(
    `SELECT id, expense_date FROM expenses WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!existing) return fail(env, 'not found', 404);
  try { await assertOpen(env, officeId, existing.expense_date); } catch (e) { return fail(env, e.message, 423); }

  const { results: entries } = await env.DB.prepare(
    `SELECT id FROM journal_entries WHERE reference_type = 'expense' AND reference_id = ? AND office_id = ?`
  ).bind(id, officeId).all();

  for (const entry of (entries || [])) {
    await env.DB.prepare(`DELETE FROM journal_lines WHERE entry_id = ?`).bind(entry.id).run();
  }

  await env.DB.prepare(
    `DELETE FROM journal_entries WHERE reference_type = 'expense' AND reference_id = ? AND office_id = ?`
  ).bind(id, officeId).run();

  await env.DB.prepare(`DELETE FROM expenses WHERE id = ? AND office_id = ?`)
    .bind(id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'expense', entity_id: id,
  });

  return ok(env, { deleted: true });
}

// ============================================================
// ✅ إحصائيات (عام + جلسات + مهام)
// ============================================================
async function stats({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  // عام
  let where1 = `WHERE office_id = ?`;
  const binds1 = [officeId];
  if (from) { where1 += ' AND expense_date >= ?'; binds1.push(from); }
  if (to)   { where1 += ' AND expense_date <= ?'; binds1.push(to); }

  const totalsGeneral = await env.DB.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
     FROM expenses ${where1}`
  ).bind(...binds1).first();

  // جلسات
  let where2 = `WHERE c.office_id = ?`;
  const binds2 = [officeId];
  if (from) { where2 += ' AND date(s.created_at) >= ?'; binds2.push(from); }
  if (to)   { where2 += ' AND date(s.created_at) <= ?'; binds2.push(to); }

  const totalsSession = await env.DB.prepare(
    `SELECT COALESCE(SUM(se.amount), 0) as total, COUNT(*) as count
     FROM session_expenses se
     JOIN sessions s ON s.id = se.session_id
     JOIN cases c ON c.id = s.case_id
     ${where2}`
  ).bind(...binds2).first();

  // مهام
  let where3 = `WHERE office_id = ?`;
  const binds3 = [officeId];
  if (from) { where3 += ' AND date(created_at) >= ?'; binds3.push(from); }
  if (to)   { where3 += ' AND date(created_at) <= ?'; binds3.push(to); }

  const totalsTask = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM task_expenses ${where3}`
  ).bind(...binds3).first();

  const totalExpenses = (totalsGeneral?.total || 0) + (totalsSession?.total || 0) + (totalsTask?.total || 0);
  const totalCount = (totalsGeneral?.count || 0) + (totalsSession?.count || 0) + (totalsTask?.count || 0);

  // شهري
  const monthly = await env.DB.prepare(
    `SELECT month, SUM(total) as total, SUM(count) as count FROM (
       SELECT substr(expense_date, 1, 7) as month, total_amount as total, 1 as count
       FROM expenses ${where1}
       UNION ALL
       SELECT substr(s.created_at, 1, 7) as month, se.amount as total, 1 as count
       FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       JOIN cases c ON c.id = s.case_id
       ${where2}
       UNION ALL
       SELECT substr(created_at, 1, 7) as month, amount as total, 1 as count
       FROM task_expenses ${where3}
     ) GROUP BY month ORDER BY month DESC LIMIT 12`
  ).bind(...binds1, ...binds2, ...binds3).all();

  // أهم المصاريف
  const topExpenses = await env.DB.prepare(
    `SELECT description, total, date FROM (
       SELECT description, total_amount as total, expense_date as date
       FROM expenses ${where1}
       UNION ALL
       SELECT se.description, se.amount as total, date(s.created_at) as date
       FROM session_expenses se
       JOIN sessions s ON s.id = se.session_id
       JOIN cases c ON c.id = s.case_id
       ${where2}
       UNION ALL
       SELECT te.description, te.amount as total, date(te.created_at) as date
       FROM task_expenses te
       ${where3}
     ) ORDER BY total DESC LIMIT 10`
  ).bind(...binds1, ...binds2, ...binds3).all();

  return ok(env, {
    totals: {
      total_expenses: totalExpenses,
      count: totalCount,
      general_total: totalsGeneral?.total || 0,
      general_count: totalsGeneral?.count || 0,
      session_total: totalsSession?.total || 0,
      session_count: totalsSession?.count || 0,
      task_total: totalsTask?.total || 0,
      task_count: totalsTask?.count || 0,
    },
    monthly: monthly.results || [],
    top_expenses: topExpenses.results || [],
  });
}

// ============================================================
// المصاريف المتكررة
// ============================================================
async function recurringList({ env, officeId }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const { results } = await env.DB.prepare(
    `SELECT e.*, a.code as account_code, a.name as account_name
     FROM expenses e
     LEFT JOIN accounts a ON a.id = e.account_id
     WHERE e.office_id = ? AND e.is_recurring = 1
     ORDER BY e.expense_date DESC`
  ).bind(officeId).all();

  const monthly = (results || []).reduce((s, e) => {
    if (e.recurring_frequency === 'monthly') return s + e.total_amount;
    if (e.recurring_frequency === 'yearly') return s + (e.total_amount / 12);
    return s;
  }, 0);

  return ok(env, {
    expenses: results || [],
    monthly_estimate: monthly,
    yearly_estimate: monthly * 12,
  });
}

// ============================================================
// صرف مرتبات الشهر (الاحترافية وفوق)
// ============================================================
async function payrollGet({ env, officeId, url }) {
  const g = await needFeature(env, officeId, 'accounting'); if (g) return g;
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  return ok(env, { month, lawyers: await payrollPreview(env, officeId, month) });
}
async function payrollPost({ request, env, officeId, authUser }) {
  const g = await needFeature(env, officeId, 'accounting'); if (g) return g;
  const b = await safeJson(request);
  try {
    const r = await runPayroll(env, { officeId, userId: authUser.user_id, month: b?.month, method: b?.method || 'تحويل بنكي', date: b?.date });
    await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'payroll', metadata: { month: b?.month, ...r }, request });
    return ok(env, r, 201);
  } catch (e) { return fail(env, e.message, e.status || 400); }
}
