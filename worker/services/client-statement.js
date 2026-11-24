// worker/services/client-statement.js
// كشف حساب الموكل + ملخص الفلوس اللي دخلت وخرجت فعلاً (الوضع المبسط)
//
// على الموكل: الأتعاب المتفق عليها، الفواتير المستقلة، ضريبة الفواتير المربوطة بأتعاب، والمصاريف اللي على حسابه
// دفع: كل الدفعات المسجلة باسمه
// الرصيد = اللي عليه − اللي دفعه

const day = (s) => String(s || '').slice(0, 10);

async function all(env, sql, ...binds) {
  return (await env.DB.prepare(sql).bind(...binds).all()).results || [];
}

// ============================================================
// كشف حساب موكل
// ============================================================
export async function buildStatement(env, officeId, clientId) {
  const client = await env.DB.prepare('SELECT id, name, phone FROM clients WHERE id = ? AND office_id = ?').bind(clientId, officeId).first();
  if (!client) return null;
  const lines = [];

  for (const f of await all(env,
    `SELECT f.id, f.amount_due, f.due_date, f.created_at, f.notes, c.case_number
     FROM fees f LEFT JOIN cases c ON c.id = f.case_id
     WHERE f.office_id = ? AND (f.client_id = ? OR (f.client_id IS NULL AND c.client_id = ?))`, officeId, clientId, clientId)) {
    lines.push({ date: day(f.created_at), kind: 'fee', description: `أتعاب${f.case_number ? ' — قضية ' + f.case_number : ''}${f.notes ? ' — ' + f.notes : ''}`, charge: Number(f.amount_due) || 0, paid: 0, ref: `fee-${f.id}` });
  }

  for (const i of await all(env,
    `SELECT i.id, i.invoice_number, i.issue_date, i.total, i.tax_amount, i.fee_id, i.status, c.case_number
     FROM invoices i LEFT JOIN cases c ON c.id = i.case_id
     WHERE i.office_id = ? AND i.client_id = ? AND i.status NOT IN ('مسودة', 'ملغاة')`, officeId, clientId)) {
    if (!i.fee_id) {
      lines.push({ date: day(i.issue_date), kind: 'invoice', description: `فاتورة ${i.invoice_number}${i.case_number ? ' — قضية ' + i.case_number : ''}`, charge: Number(i.total) || 0, paid: 0, ref: `invoice-${i.id}` });
    } else if (Number(i.tax_amount) > 0) {
      lines.push({ date: day(i.issue_date), kind: 'tax', description: `ضريبة فاتورة ${i.invoice_number}`, charge: Number(i.tax_amount) || 0, paid: 0, ref: `invoice-${i.id}` });
    }
  }

  // مصاريف على حساب الموكل
  for (const e of await all(env,
    `SELECT e.id, e.expense_date AS d, e.description, e.total_amount AS amount, c.case_number
     FROM expenses e LEFT JOIN cases c ON c.id = e.case_id
     WHERE e.office_id = ? AND e.is_reimbursable = 1 AND (e.client_id = ? OR (e.client_id IS NULL AND c.client_id = ?))`, officeId, clientId, clientId)) {
    lines.push({ date: day(e.d), kind: 'expense', description: `مصاريف: ${e.description}${e.case_number ? ' — قضية ' + e.case_number : ''}`, charge: Number(e.amount) || 0, paid: 0, ref: `expense-${e.id}` });
  }
  for (const e of await all(env,
    `SELECT se.id, se.created_at AS d, se.description, se.amount, c.case_number, s.session_date
     FROM session_expenses se JOIN sessions s ON s.id = se.session_id JOIN cases c ON c.id = s.case_id
     WHERE c.office_id = ? AND c.client_id = ? AND se.billable = 1`, officeId, clientId)) {
    lines.push({ date: day(e.d), kind: 'expense', description: `مصاريف جلسة ${day(e.session_date)}: ${e.description || ''} — قضية ${e.case_number || ''}`, charge: Number(e.amount) || 0, paid: 0, ref: `session_expense-${e.id}` });
  }
  for (const e of await all(env,
    `SELECT te.id, te.created_at AS d, te.description, te.amount, c.case_number
     FROM task_expenses te JOIN tasks t ON t.id = te.task_id JOIN cases c ON c.id = t.case_id
     WHERE te.office_id = ? AND c.client_id = ? AND te.billable = 1`, officeId, clientId)) {
    lines.push({ date: day(e.d), kind: 'expense', description: `${e.description || 'مصاريف مهمة'} — قضية ${e.case_number || ''}`, charge: Number(e.amount) || 0, paid: 0, ref: `task_expense-${e.id}` });
  }

  for (const p of await all(env,
    `SELECT p.id, p.payment_date, p.amount, p.method, p.receipt_number, p.notes
     FROM payments p WHERE p.office_id = ? AND p.client_id = ?`, officeId, clientId)) {
    lines.push({ date: day(p.payment_date), kind: 'payment', description: `دفعة — ${p.method || 'نقدي'}${p.receipt_number ? ' — إيصال ' + p.receipt_number : ''}`, charge: 0, paid: Number(p.amount) || 0, ref: `payment-${p.id}` });
  }

  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.paid ? 1 : 0) - (b.paid ? 1 : 0));
  let balance = 0;
  for (const l of lines) { balance += l.charge - l.paid; l.balance = Math.round(balance * 100) / 100; }
  const charged = lines.reduce((s, l) => s + l.charge, 0);
  const paid = lines.reduce((s, l) => s + l.paid, 0);
  return { client, lines, totals: { charged, paid, balance: Math.round((charged - paid) * 100) / 100 } };
}

// ============================================================
// أرصدة كل الموكلين (مين عليه فلوس) — بنفس قواعد كشف الحساب
// ============================================================
export async function clientBalances(env, officeId) {
  // استعلامات منفصلة (D1 مش بيقبل UNION بأجزاء كتير) والتجميع هنا
  const parts = [
    ['SELECT COALESCE(f.client_id, c.client_id) AS cid, SUM(f.amount_due) AS amt FROM fees f LEFT JOIN cases c ON c.id = f.case_id WHERE f.office_id = ? GROUP BY cid', 1],
    ["SELECT client_id AS cid, SUM(total) AS amt FROM invoices WHERE office_id = ? AND fee_id IS NULL AND status NOT IN ('مسودة', 'ملغاة') GROUP BY cid", 1],
    ["SELECT client_id AS cid, SUM(tax_amount) AS amt FROM invoices WHERE office_id = ? AND fee_id IS NOT NULL AND tax_amount > 0 AND status NOT IN ('مسودة', 'ملغاة') GROUP BY cid", 1],
    ['SELECT COALESCE(e.client_id, c.client_id) AS cid, SUM(e.total_amount) AS amt FROM expenses e LEFT JOIN cases c ON c.id = e.case_id WHERE e.office_id = ? AND e.is_reimbursable = 1 GROUP BY cid', 1],
    ['SELECT c.client_id AS cid, SUM(se.amount) AS amt FROM session_expenses se JOIN sessions s ON s.id = se.session_id JOIN cases c ON c.id = s.case_id WHERE c.office_id = ? AND se.billable = 1 GROUP BY cid', 1],
    ['SELECT c.client_id AS cid, SUM(te.amount) AS amt FROM task_expenses te JOIN tasks t ON t.id = te.task_id JOIN cases c ON c.id = t.case_id WHERE te.office_id = ? AND te.billable = 1 GROUP BY cid', 1],
    ['SELECT client_id AS cid, SUM(amount) AS amt FROM payments WHERE office_id = ? GROUP BY cid', -1],
  ];
  const map = new Map();
  for (const [sql, sign] of parts) {
    for (const r of await all(env, sql, officeId)) {
      if (r.cid == null) continue;
      map.set(r.cid, (map.get(r.cid) || 0) + sign * (Number(r.amt) || 0));
    }
  }
  const ids = [...map.keys()];
  if (!ids.length) return [];
  const names = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const marks = chunk.map(() => '?').join(',');
    for (const c of await all(env, `SELECT id, name, phone FROM clients WHERE office_id = ? AND id IN (${marks})`, officeId, ...chunk)) names.set(c.id, c);
  }
  return ids
    .map(id => ({ client_id: id, name: names.get(id)?.name || 'موكل', phone: names.get(id)?.phone || null, balance: Math.round(map.get(id) * 100) / 100 }))
    .filter(r => Math.abs(r.balance) > 0.009 && names.has(r.client_id))
    .sort((a, b) => b.balance - a.balance);
}

// ============================================================
// الوضع المبسط: الفلوس اللي دخلت وخرجت فعلاً في فترة
// ============================================================
export async function cashSummary(env, officeId, from, to) {
  const one = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()) || {};
  const isCash = `TRIM(COALESCE(method, '')) IN ('', 'نقدي', 'نقدا', 'نقداً', 'كاش')`;
  const pay = await one(
    `SELECT COALESCE(SUM(amount), 0) AS total,
            COALESCE(SUM(CASE WHEN ${isCash} THEN amount ELSE 0 END), 0) AS cash,
            COUNT(*) AS n
     FROM payments WHERE office_id = ? AND payment_date BETWEEN ? AND ?`, officeId, from, to);
  const office = await one(
    `SELECT
       (SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE office_id = ?1 AND COALESCE(is_reimbursable, 0) = 0 AND expense_date BETWEEN ?2 AND ?3)
     + (SELECT COALESCE(SUM(se.amount), 0) FROM session_expenses se JOIN sessions s ON s.id = se.session_id JOIN cases c ON c.id = s.case_id
          WHERE c.office_id = ?1 AND se.billable = 0 AND substr(se.created_at, 1, 10) BETWEEN ?2 AND ?3)
     + (SELECT COALESCE(SUM(amount), 0) FROM task_expenses WHERE office_id = ?1 AND billable = 0 AND substr(created_at, 1, 10) BETWEEN ?2 AND ?3) AS total`,
    officeId, from, to);
  const forClients = await one(
    `SELECT
       (SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE office_id = ?1 AND is_reimbursable = 1 AND expense_date BETWEEN ?2 AND ?3)
     + (SELECT COALESCE(SUM(se.amount), 0) FROM session_expenses se JOIN sessions s ON s.id = se.session_id JOIN cases c ON c.id = s.case_id
          WHERE c.office_id = ?1 AND se.billable = 1 AND substr(se.created_at, 1, 10) BETWEEN ?2 AND ?3)
     + (SELECT COALESCE(SUM(amount), 0) FROM task_expenses WHERE office_id = ?1 AND billable = 1 AND substr(created_at, 1, 10) BETWEEN ?2 AND ?3) AS total`,
    officeId, from, to);
  const agreed = await one(
    `SELECT COALESCE(SUM(amount_due), 0) AS total, COUNT(*) AS n FROM fees WHERE office_id = ? AND substr(created_at, 1, 10) BETWEEN ? AND ?`, officeId, from, to);
  // الفلوس اللي معاك دلوقتي (الصندوق والبنك من الدفاتر)
  const bal = async (code) => (await one(
    `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS b FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id JOIN accounts a ON a.id = jl.account_id
     WHERE je.office_id = ? AND a.code = ?`, officeId, code)).b || 0;
  const balances = await clientBalances(env, officeId);
  const owed = balances.filter(r => r.balance > 0);
  return {
    from, to,
    collected: Number(pay.total) || 0,
    collected_cash: Number(pay.cash) || 0,
    collected_bank: (Number(pay.total) || 0) - (Number(pay.cash) || 0),
    payments_count: pay.n || 0,
    spent_office: Number(office.total) || 0,
    spent_for_clients: Number(forClients.total) || 0,
    net: (Number(pay.total) || 0) - (Number(office.total) || 0) - (Number(forClients.total) || 0),
    agreed_fees: Number(agreed.total) || 0,
    agreed_count: agreed.n || 0,
    cash_box: Number(await bal('1101')) || 0,
    bank: Number(await bal('1102')) || 0,
    receivable_total: owed.reduce((s, r) => s + r.balance, 0),
    debtors: owed.slice(0, 15),
    credit_clients: balances.filter(r => r.balance < 0).slice(0, 10),
  };
}
