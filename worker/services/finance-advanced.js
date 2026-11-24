// worker/services/finance-advanced.js
// الإدارة المالية — المرحلة 3: أمانات الموكلين، ربحية القضايا والمحامين، المرتبات، المصاريف المتكررة، قفل الفترات

import { createJournalEntry, getAccountByCode, moneyAccountCode, autoEntryExpense, REF } from './accounting.js';
import { lockDate, assertOpen } from '../lib/period-lock.js';
export { lockDate, assertOpen };

const all = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
const one = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()) || {};
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ============================================================
// قفل الفترات: مفيش حركة مالية قبل التاريخ ده
// ============================================================
// ============================================================
// أمانات الموكلين (مقدم مصاريف)
//   إيداع: الصندوق/البنك مدين ← أمانات الموكلين دائن
//   صرف (مصروف اتدفع من الأمانة): أمانات الموكلين مدين ← الصندوق/البنك دائن
//   رد: أمانات الموكلين مدين ← الصندوق/البنك دائن
// ============================================================
export async function trustBalance(env, officeId, clientId) {
  const r = await one(env,
    `SELECT
       (SELECT COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE -amount END), 0) FROM trust_transactions WHERE office_id = ?1 AND client_id = ?2)
     - (SELECT COALESCE(SUM(e.total_amount), 0) FROM expenses e LEFT JOIN cases c ON c.id = e.case_id
         WHERE e.office_id = ?1 AND e.approval_status = 'approved' AND e.paid_from_trust = 1 AND COALESCE(e.client_id, c.client_id) = ?2) AS bal`,
    officeId, clientId);
  return round(r.bal);
}

export async function trustLedger(env, officeId, clientId) {
  const rows = [];
  for (const t of await all(env, `SELECT id, kind, amount, method, tx_date, description FROM trust_transactions WHERE office_id = ? AND client_id = ?`, officeId, clientId)) {
    rows.push({ date: t.tx_date, kind: t.kind, description: t.description || (t.kind === 'deposit' ? 'إيداع أمانة' : 'رد أمانة'), in: t.kind === 'deposit' ? t.amount : 0, out: t.kind === 'deposit' ? 0 : t.amount, ref: `trust-${t.id}` });
  }
  for (const e of await all(env,
    `SELECT e.id, e.expense_date, e.description, e.total_amount, c.case_number FROM expenses e LEFT JOIN cases c ON c.id = e.case_id
     WHERE e.office_id = ? AND e.approval_status = 'approved' AND e.paid_from_trust = 1 AND COALESCE(e.client_id, c.client_id) = ?`, officeId, clientId)) {
    rows.push({ date: e.expense_date, kind: 'spend', description: `صرف: ${e.description}${e.case_number ? ' — قضية ' + e.case_number : ''}`, in: 0, out: e.total_amount, ref: `expense-${e.id}` });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let bal = 0;
  for (const r of rows) { bal += (r.in || 0) - (r.out || 0); r.balance = round(bal); }
  return { rows, balance: round(bal) };
}

export async function recordTrust(env, { officeId, userId, clientId, caseId = null, kind, amount, method = 'نقدي', date, description = null }) {
  amount = round(amount);
  if (!(amount > 0)) throw new Error('اكتب مبلغ صحيح');
  if (!['deposit', 'refund'].includes(kind)) throw new Error('نوع الحركة غلط');
  const client = await one(env, 'SELECT id, name FROM clients WHERE id = ? AND office_id = ?', clientId, officeId);
  if (!client.id) throw new Error('الموكل مش موجود');
  const day = String(date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  await assertOpen(env, officeId, day);
  if (kind === 'refund' && amount > await trustBalance(env, officeId, clientId) + 0.009) throw new Error('المبلغ أكبر من رصيد أمانة الموكل');
  const r = await env.DB.prepare(
    `INSERT INTO trust_transactions (office_id, client_id, case_id, kind, amount, method, tx_date, description, created_by) VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(officeId, clientId, caseId, kind, amount, method || 'نقدي', day, description, userId).run();
  const money = await getAccountByCode(env, officeId, moneyAccountCode(method)) || await getAccountByCode(env, officeId, '1101');
  const trust = await getAccountByCode(env, officeId, '2107');
  if (money && trust) {
    const lines = kind === 'deposit'
      ? [{ account_id: money.id, debit: amount, credit: 0, description: money.name }, { account_id: trust.id, debit: 0, credit: amount, description: trust.name }]
      : [{ account_id: trust.id, debit: amount, credit: 0, description: trust.name }, { account_id: money.id, debit: 0, credit: amount, description: money.name }];
    await createJournalEntry(env, { officeId, date: day, description: `${kind === 'deposit' ? 'إيداع أمانة' : 'رد أمانة'} — ${client.name}`, lines, referenceType: 'trust', referenceId: r.meta.last_row_id, userId })
      .catch(e => console.error('trust entry failed:', e.message));
  }
  return { id: r.meta.last_row_id };
}

// قيد مصروف اتدفع من الأمانة
export async function autoEntryTrustExpense(env, { officeId, expenseId, amount, date, description, method, userId }) {
  const money = await getAccountByCode(env, officeId, moneyAccountCode(method)) || await getAccountByCode(env, officeId, '1101');
  const trust = await getAccountByCode(env, officeId, '2107');
  if (!money || !trust) return null;
  return createJournalEntry(env, {
    officeId, date, description: `${description || 'مصروف'} (من أمانة الموكل)`,
    lines: [{ account_id: trust.id, debit: amount, credit: 0, description: trust.name }, { account_id: money.id, debit: 0, credit: amount, description: money.name }],
    referenceType: REF.expense, referenceId: expenseId, userId,
  }).catch(e => { console.error('trust expense entry failed:', e.message); return null; });
}

// ============================================================
// ربحية القضايا والمحامين (فلوس حقيقية: اللي اتحصّل − مصاريف المكتب على القضية)
// ============================================================
export async function profitability(env, officeId, from, to) {
  const cases = new Map();
  const get = (id) => { if (!cases.has(id)) cases.set(id, { case_id: id, collected: 0, office_expenses: 0, client_expenses: 0, agreed: 0 }); return cases.get(id); };
  for (const r of await all(env, `SELECT case_id, SUM(amount) AS s FROM payments WHERE office_id = ? AND case_id IS NOT NULL AND payment_date BETWEEN ? AND ? GROUP BY case_id`, officeId, from, to)) get(r.case_id).collected += r.s || 0;
  for (const r of await all(env, `SELECT case_id, SUM(amount_due) AS s FROM fees WHERE office_id = ? AND case_id IS NOT NULL AND substr(created_at, 1, 10) BETWEEN ? AND ? GROUP BY case_id`, officeId, from, to)) get(r.case_id).agreed += r.s || 0;
  for (const r of await all(env, `SELECT case_id, SUM(CASE WHEN is_reimbursable = 1 OR paid_from_trust = 1 THEN 0 ELSE total_amount END) AS office, SUM(CASE WHEN is_reimbursable = 1 OR paid_from_trust = 1 THEN total_amount ELSE 0 END) AS client
       FROM expenses WHERE office_id = ? AND approval_status = 'approved' AND case_id IS NOT NULL AND expense_date BETWEEN ? AND ? GROUP BY case_id`, officeId, from, to)) { const c = get(r.case_id); c.office_expenses += r.office || 0; c.client_expenses += r.client || 0; }
  for (const r of await all(env, `SELECT s.case_id, SUM(CASE WHEN se.billable = 1 THEN 0 ELSE se.amount END) AS office, SUM(CASE WHEN se.billable = 1 THEN se.amount ELSE 0 END) AS client
       FROM session_expenses se JOIN sessions s ON s.id = se.session_id JOIN cases c ON c.id = s.case_id
       WHERE c.office_id = ? AND substr(se.created_at, 1, 10) BETWEEN ? AND ? GROUP BY s.case_id`, officeId, from, to)) { const c = get(r.case_id); c.office_expenses += r.office || 0; c.client_expenses += r.client || 0; }
  for (const r of await all(env, `SELECT t.case_id, SUM(CASE WHEN te.billable = 1 THEN 0 ELSE te.amount END) AS office, SUM(CASE WHEN te.billable = 1 THEN te.amount ELSE 0 END) AS client
       FROM task_expenses te JOIN tasks t ON t.id = te.task_id
       WHERE te.office_id = ? AND t.case_id IS NOT NULL AND substr(te.created_at, 1, 10) BETWEEN ? AND ? GROUP BY t.case_id`, officeId, from, to)) { const c = get(r.case_id); c.office_expenses += r.office || 0; c.client_expenses += r.client || 0; }

  const ids = [...cases.keys()];
  const info = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const marks = chunk.map(() => '?').join(',');
    for (const c of await all(env, `SELECT c.id, c.case_number, c.case_type, c.status, cl.name AS client_name FROM cases c LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.office_id = ? AND c.id IN (${marks})`, officeId, ...chunk)) info.set(c.id, c);
  }
  const caseRows = ids.filter(id => info.has(id)).map(id => {
    const c = cases.get(id); const i = info.get(id);
    return { ...c, case_number: i.case_number, case_type: i.case_type, status: i.status, client_name: i.client_name,
      collected: round(c.collected), office_expenses: round(c.office_expenses), client_expenses: round(c.client_expenses), agreed: round(c.agreed),
      net: round(c.collected - c.office_expenses) };
  }).sort((a, b) => b.net - a.net);

  // المحامين: نصيب كل واحد من القضايا اللي في فريقها (بالتساوي على أعضاء الفريق)
  const members = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const marks = chunk.map(() => '?').join(',');
    for (const m of await all(env, `SELECT cm.case_id, cm.user_id, u.full_name FROM case_members cm JOIN users u ON u.id = cm.user_id WHERE cm.office_id = ? AND cm.case_id IN (${marks})`, officeId, ...chunk)) {
      if (!members.has(m.case_id)) members.set(m.case_id, []);
      members.get(m.case_id).push(m);
    }
  }
  const lawyers = new Map();
  for (const c of caseRows) {
    const team = members.get(c.case_id) || [];
    for (const m of team) {
      const share = 1 / team.length;
      if (!lawyers.has(m.user_id)) lawyers.set(m.user_id, { user_id: m.user_id, name: m.full_name || 'عضو', cases: 0, collected: 0, office_expenses: 0, net: 0 });
      const l = lawyers.get(m.user_id);
      l.cases += 1; l.collected += c.collected * share; l.office_expenses += c.office_expenses * share; l.net += c.net * share;
    }
  }
  const lawyerRows = [...lawyers.values()].map(l => ({ ...l, collected: round(l.collected), office_expenses: round(l.office_expenses), net: round(l.net) })).sort((a, b) => b.net - a.net);
  const unassigned = caseRows.filter(c => !(members.get(c.case_id) || []).length).length;

  // المصاريف العامة (مش على قضية) — عشان الصورة تبقى كاملة
  const general = await one(env,
    `SELECT COALESCE(SUM(total_amount), 0) AS s FROM expenses WHERE office_id = ? AND approval_status = 'approved' AND case_id IS NULL AND COALESCE(is_reimbursable, 0) = 0 AND COALESCE(paid_from_trust, 0) = 0 AND expense_date BETWEEN ? AND ?`, officeId, from, to);
  const unlinked = await one(env, `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE office_id = ? AND case_id IS NULL AND payment_date BETWEEN ? AND ?`, officeId, from, to);
  // الفروع: القضايا اللي فيها + المصروفات العامة المتسجلة على الفرع
  const branchOf = new Map();
  const branchNames = new Map((await all(env, 'SELECT id, name FROM branches WHERE office_id = ?', officeId)).map(b => [b.id, b.name]));
  if (branchNames.size) {
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80);
      for (const c of await all(env, `SELECT id, branch_id FROM cases WHERE office_id = ? AND id IN (${chunk.map(() => '?').join(',')})`, officeId, ...chunk)) branchOf.set(c.id, c.branch_id);
    }
  }
  const byBranch = new Map();
  const bget = (id) => { const k = id || 0; if (!byBranch.has(k)) byBranch.set(k, { branch_id: id || null, name: id ? (branchNames.get(id) || 'فرع') : 'بدون فرع', cases: 0, collected: 0, office_expenses: 0, general_expenses: 0 }); return byBranch.get(k); };
  if (branchNames.size) {
    for (const c of caseRows) { const g = bget(branchOf.get(c.case_id)); g.cases++; g.collected += c.collected; g.office_expenses += c.office_expenses; }
    for (const r of await all(env, `SELECT branch_id, SUM(total_amount) AS s FROM expenses WHERE office_id = ? AND approval_status = 'approved' AND case_id IS NULL AND COALESCE(is_reimbursable, 0) = 0 AND COALESCE(paid_from_trust, 0) = 0 AND expense_date BETWEEN ? AND ? GROUP BY branch_id`, officeId, from, to)) bget(r.branch_id).general_expenses += r.s || 0;
  }
  const branchRows = [...byBranch.values()].map(b => ({ ...b, collected: round(b.collected), office_expenses: round(b.office_expenses), general_expenses: round(b.general_expenses), net: round(b.collected - b.office_expenses - b.general_expenses) }))
    .sort((a, b) => (a.branch_id ? 0 : 1) - (b.branch_id ? 0 : 1) || b.net - a.net);
  return { from, to, cases: caseRows, lawyers: lawyerRows, branches: branchRows, unassigned_cases: unassigned,
    general_expenses: round(general.s), unlinked_collected: round(unlinked.s) };
}

// ============================================================
// صرف مرتبات الشهر (من بيانات المحامين) — مرة واحدة لكل محامي في الشهر
// ============================================================
export async function payrollPreview(env, officeId, month) {
  const rows = await all(env,
    `SELECT l.id, l.name, l.salary,
            (SELECT e.id FROM expenses e WHERE e.office_id = l.office_id AND e.reference_number = 'SAL-' || ? || '-' || l.id) AS paid_expense
     FROM lawyers l WHERE l.office_id = ? AND COALESCE(l.active, 1) = 1 AND COALESCE(l.salary, 0) > 0 ORDER BY l.name`, month, officeId);
  return rows.map(r => ({ lawyer_id: r.id, name: r.name, salary: round(r.salary), already_paid: !!r.paid_expense }));
}

export async function runPayroll(env, { officeId, userId, month, method = 'تحويل بنكي', date }) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw new Error('اختار الشهر');
  const day = String(date || `${month}-28`).slice(0, 10);
  await assertOpen(env, officeId, day);
  const acc = await one(env, `SELECT id, code FROM accounts WHERE office_id = ? AND code = '5101'`, officeId);
  let created = 0, total = 0;
  for (const r of await payrollPreview(env, officeId, month)) {
    if (r.already_paid) continue;
    const desc = `مرتب ${r.name} — ${month}`;
    const ins = await env.DB.prepare(
      `INSERT INTO expenses (office_id, expense_date, description, account_id, amount, tax_amount, total_amount, payment_method, reference_number, notes, created_by)
       VALUES (?,?,?,?,?,0,?,?,?,?,?)`
    ).bind(officeId, day, desc, acc.id || null, r.salary, r.salary, method, `SAL-${month}-${r.lawyer_id}`, 'صرف مرتبات الشهر', userId).run();
    await autoEntryExpense(env, { officeId, expenseId: ins.meta.last_row_id, amount: r.salary, date: day, description: desc, accountCode: '5101', method, refType: REF.expense, userId });
    created++; total += r.salary;
  }
  return { created, total: round(total) };
}

// ============================================================
// المصاريف المتكررة: كل يوم بنسجّل المستحق (شهري / كل 3 شهور / سنوي)
// ============================================================
function addPeriod(day, freq) {
  const [y, m, d] = day.split('-').map(Number);
  const months = freq === 'yearly' ? 12 : freq === 'quarterly' ? 3 : freq === 'monthly' ? 1 : 0;
  if (!months) return null;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last)); // 31 يناير → 28/29 فبراير
  return target.toISOString().slice(0, 10);
}

export async function generateRecurring(env, { officeId = null, today = null } = {}) {
  const now = today || new Date().toISOString().slice(0, 10);
  const templates = await all(env,
    `SELECT e.*, a.code AS account_code, s.plan, s.status
     FROM expenses e
     LEFT JOIN accounts a ON a.id = e.account_id
     JOIN subscriptions s ON s.office_id = e.office_id
     WHERE e.is_recurring = 1 AND e.approval_status = 'approved' AND e.recurring_frequency IN ('monthly', 'quarterly', 'yearly')
       ${officeId ? 'AND e.office_id = ?' : ''}`, ...(officeId ? [officeId] : []));
  let made = 0;
  for (const t of templates) {
    if (!['active', 'trial'].includes(t.status) || !['pro', 'plus', 'lifetime_pro'].includes(t.plan)) continue;
    let next = addPeriod(t.recurring_last || t.expense_date, t.recurring_frequency);
    let guard = 0;
    while (next && next <= now && guard++ < 24) {
      const lock = await lockDate(env, t.office_id);
      if (!(lock && next < lock)) {
        const ins = await env.DB.prepare(
          `INSERT INTO expenses (office_id, expense_date, description, account_id, amount, tax_amount, total_amount, payment_method, vendor, case_id, client_id, is_reimbursable, recurring_parent_id, notes, created_by, branch_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(t.office_id, next, t.description, t.account_id, t.amount, t.tax_amount || 0, t.total_amount, t.payment_method, t.vendor, t.case_id, t.client_id, t.is_reimbursable || 0, t.id, 'اتسجل تلقائي (مصروف متكرر)', t.created_by, t.branch_id || null).run();
        await autoEntryExpense(env, { officeId: t.office_id, expenseId: ins.meta.last_row_id, amount: t.total_amount, date: next, description: t.description,
          accountCode: t.account_code || '5406', method: t.payment_method, refType: REF.expense, billable: !!t.is_reimbursable, userId: t.created_by });
        made++;
      }
      await env.DB.prepare('UPDATE expenses SET recurring_last = ? WHERE id = ?').bind(next, t.id).run();
      next = addPeriod(next, t.recurring_frequency);
    }
  }
  return made;
}
