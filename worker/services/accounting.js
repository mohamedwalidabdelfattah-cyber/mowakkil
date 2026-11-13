// worker/services/accounting.js
// خدمة محاسبية كاملة — دفتر اليومية + التقارير

// ============================================================
// توليد رقم قيد تلقائي
// ============================================================
export async function generateEntryNumber(env, officeId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM journal_entries
     WHERE office_id = ? AND substr(created_at, 1, 10) = date('now')`
  ).bind(officeId).first();
  const seq = String((count?.c || 0) + 1).padStart(4, '0');
  return `JE-${today}-${seq}`;
}

// ============================================================
// إنشاء قيد محاسبي
// ============================================================
export async function createJournalEntry(env, {
  officeId, date, description, lines,
  referenceType = null, referenceId = null, userId = null,
}) {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`القيد مش متوازن: مدين=${totalDebit} دائن=${totalCredit}`);
  }
  if (totalDebit === 0) throw new Error('القيد ما فيهوش مبالغ');

  for (const line of lines) {
    const acc = await env.DB.prepare(
      `SELECT id, type, category FROM accounts WHERE id = ? AND office_id = ? AND is_active = 1`
    ).bind(line.account_id, officeId).first();
    if (!acc) throw new Error(`الحساب ${line.account_id} مش موجود`);
    if (acc.category === 'header') throw new Error('مينفعش تستخدم حساب "header"');
  }

  const entryNumber = await generateEntryNumber(env, officeId);
  const entry = await env.DB.prepare(
    `INSERT INTO journal_entries
      (office_id, entry_number, entry_date, description,
       reference_type, reference_id, total_debit, total_credit, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(officeId, entryNumber, date, description || null,
    referenceType, referenceId, totalDebit, totalCredit, userId).run();

  const entryId = entry.meta.last_row_id;
  for (const line of lines) {
    await env.DB.prepare(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
       VALUES (?,?,?,?,?)`
    ).bind(entryId, line.account_id,
      Number(line.debit) || 0, Number(line.credit) || 0,
      line.description || null).run();
  }
  return { id: entryId, entry_number: entryNumber };
}

// ============================================================
// حذف قيد
// ============================================================
export async function deleteJournalEntry(env, officeId, entryId) {
  const entry = await env.DB.prepare(
    `SELECT * FROM journal_entries WHERE id = ? AND office_id = ?`
  ).bind(entryId, officeId).first();
  if (!entry) throw new Error('القيد مش موجود');
  if (entry.reference_type && entry.reference_type !== 'manual') {
    throw new Error('مينفعش تحذف قيد مرتبط بمعاملة');
  }
  await env.DB.prepare(`DELETE FROM journal_lines WHERE entry_id = ?`).bind(entryId).run();
  await env.DB.prepare(`DELETE FROM journal_entries WHERE id = ? AND office_id = ?`).bind(entryId, officeId).run();
  return { deleted: true };
}

// ============================================================
// جلب قيد كامل
// ============================================================
export async function getJournalEntry(env, officeId, entryId) {
  const entry = await env.DB.prepare(
    `SELECT je.*, u.full_name as created_by_name
     FROM journal_entries je
     LEFT JOIN users u ON u.id = je.created_by
     WHERE je.id = ? AND je.office_id = ?`
  ).bind(entryId, officeId).first();
  if (!entry) return null;
  const { results: lines } = await env.DB.prepare(
    `SELECT jl.*, a.code as account_code, a.name as account_name, a.type as account_type
     FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
     WHERE jl.entry_id = ? ORDER BY jl.id`
  ).bind(entryId).all();
  return { ...entry, lines: lines || [] };
}

// ============================================================
// رصيد حساب
// ============================================================
export async function getAccountBalance(env, officeId, accountId, asOfDate = null) {
  let q = `SELECT COALESCE(SUM(jl.debit), 0) as total_debit,
    COALESCE(SUM(jl.credit), 0) as total_credit
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
    WHERE jl.account_id = ? AND je.office_id = ?`;
  const binds = [accountId, officeId];
  if (asOfDate) { q += ` AND je.entry_date <= ?`; binds.push(asOfDate); }

  const result = await env.DB.prepare(q).bind(...binds).first();
  const acc = await env.DB.prepare(
    `SELECT type FROM accounts WHERE id = ? AND office_id = ?`
  ).bind(accountId, officeId).first();

  const totalDebit = result?.total_debit || 0;
  const totalCredit = result?.total_credit || 0;
  let balance = 0, normalSide = 'debit';
  if (acc) {
    if (acc.type === 'asset' || acc.type === 'expense') {
      balance = totalDebit - totalCredit; normalSide = 'debit';
    } else {
      balance = totalCredit - totalDebit; normalSide = 'credit';
    }
  }
  return { account_id: accountId, total_debit: totalDebit, total_credit: totalCredit, balance, normal_side: normalSide };
}

// ============================================================
// ميزان المراجعة
// ============================================================
export async function getTrialBalance(env, officeId, fromDate = null, toDate = null) {
  let q = `SELECT a.id, a.code, a.name, a.type, a.category,
    COALESCE(SUM(jl.debit), 0) as total_debit,
    COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.entry_id
    WHERE a.office_id = ? AND a.is_active = 1 AND a.category != 'header'`;
  const binds = [officeId];
  if (fromDate) { q += ` AND (je.entry_date IS NULL OR je.entry_date >= ?)`; binds.push(fromDate); }
  if (toDate)   { q += ` AND (je.entry_date IS NULL OR je.entry_date <= ?)`; binds.push(toDate); }
  q += ` GROUP BY a.id, a.code, a.name, a.type, a.category
         HAVING total_debit > 0 OR total_credit > 0 ORDER BY a.code`;

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  const rows = (results || []).map(r => {
    let balance = 0, debit_balance = 0, credit_balance = 0;
    if (r.type === 'asset' || r.type === 'expense') {
      balance = r.total_debit - r.total_credit;
      if (balance >= 0) debit_balance = balance; else credit_balance = -balance;
    } else {
      balance = r.total_credit - r.total_debit;
      if (balance >= 0) credit_balance = balance; else debit_balance = -balance;
    }
    return { ...r, balance, debit_balance, credit_balance };
  });
  const totalDebit = rows.reduce((s, r) => s + r.debit_balance, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit_balance, 0);
  return { rows, total_debit: totalDebit, total_credit: totalCredit, is_balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

// ============================================================
// دفتر الأستاذ
// ============================================================
export async function getGeneralLedger(env, officeId, accountId, fromDate = null, toDate = null) {
  const account = await env.DB.prepare(
    `SELECT * FROM accounts WHERE id = ? AND office_id = ?`
  ).bind(accountId, officeId).first();
  if (!account) return null;

  let openingBalance = 0;
  if (fromDate) {
    const opening = await getAccountBalance(env, officeId, accountId,
      new Date(new Date(fromDate).getTime() - 86400000).toISOString().slice(0, 10));
    openingBalance = opening.balance;
  }

  let q = `SELECT jl.id, jl.debit, jl.credit, jl.description,
    je.entry_number, je.entry_date, je.reference_type, je.reference_id
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
    WHERE jl.account_id = ? AND je.office_id = ?`;
  const binds = [accountId, officeId];
  if (fromDate) { q += ` AND je.entry_date >= ?`; binds.push(fromDate); }
  if (toDate)   { q += ` AND je.entry_date <= ?`; binds.push(toDate); }
  q += ` ORDER BY je.entry_date, je.id`;

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  let runningBalance = openingBalance;
  const movements = (results || []).map(m => {
    const change = (m.debit || 0) - (m.credit || 0);
    if (account.type === 'asset' || account.type === 'expense') runningBalance += change;
    else runningBalance -= change;
    return { ...m, running_balance: runningBalance };
  });
  return { account, opening_balance: openingBalance, movements, closing_balance: runningBalance };
}

// ============================================================
// Helper: جلب حساب بالكود
// ============================================================
export async function getAccountByCode(env, officeId, code) {
  return await env.DB.prepare(
    `SELECT id, code, name, type FROM accounts
     WHERE office_id = ? AND code = ? AND is_active = 1`
  ).bind(officeId, code).first();
}

// ============================================================
// قيد تلقائي: دفعة
// ============================================================
export async function autoEntryPayment(env, { officeId, paymentId, amount, date, method, description, feeId = null, userId }) {
  try {
    const cashAcc = await getAccountByCode(env, officeId, '1101');
    if (!cashAcc) return null;

    let creditAcc;
    if (feeId) {
      creditAcc = await getAccountByCode(env, officeId, '1103');
    } else {
      creditAcc = await getAccountByCode(env, officeId, '2106');
    }
    if (!creditAcc) return null;

    return await createJournalEntry(env, {
      officeId, date,
      description: description || `تحصيل دفعة - ${method || 'نقدي'}`,
      lines: [
        { account_id: cashAcc.id, debit: amount, credit: 0, description: 'النقدية' },
        { account_id: creditAcc.id, debit: 0, credit: amount, description: creditAcc.name },
      ],
      referenceType: 'payment', referenceId: paymentId, userId,
    });
  } catch (e) { console.error('autoEntryPayment failed:', e.message); return null; }
}

// ============================================================
// قيد تلقائي: أتعاب
// ============================================================
export async function autoEntryFeeCreated(env, { officeId, feeId, amount, date, description, userId }) {
  try {
    const clientsAcc = await getAccountByCode(env, officeId, '1103');
    const feesAcc = await getAccountByCode(env, officeId, '4101');
    if (!clientsAcc || !feesAcc) return null;

    return await createJournalEntry(env, {
      officeId, date,
      description: description || `أتعاب جديدة - قيد #${feeId}`,
      lines: [
        { account_id: clientsAcc.id, debit: amount, credit: 0, description: 'العملاء' },
        { account_id: feesAcc.id, debit: 0, credit: amount, description: 'أتعاب القضايا' },
      ],
      referenceType: 'fee', referenceId: feeId, userId,
    });
  } catch (e) { console.error('autoEntryFeeCreated failed:', e.message); return null; }
}

// ============================================================
// قيد تلقائي: مصروف
// ============================================================
export async function autoEntryExpense(env, { officeId, expenseId, amount, date, description, accountCode = '5406', userId }) {
  try {
    const cashAcc = await getAccountByCode(env, officeId, '1101');
    const expenseAcc = await getAccountByCode(env, officeId, accountCode);
    if (!cashAcc || !expenseAcc) return null;

    return await createJournalEntry(env, {
      officeId, date,
      description: description || 'مصروف',
      lines: [
        { account_id: expenseAcc.id, debit: amount, credit: 0, description: expenseAcc.name },
        { account_id: cashAcc.id, debit: 0, credit: amount, description: 'النقدية' },
      ],
      referenceType: 'expense', referenceId: expenseId, userId,
    });
  } catch (e) { console.error('autoEntryExpense failed:', e.message); return null; }
}

// ============================================================
// قيد تلقائي: فاتورة
// ============================================================
export async function autoEntryInvoice(env, { officeId, invoiceId, subtotal, taxAmount, total, discount, date, description, userId }) {
  try {
    const clientsAcc = await getAccountByCode(env, officeId, '1103');
    const feesAcc = await getAccountByCode(env, officeId, '4101');
    const taxAcc = await getAccountByCode(env, officeId, '2104');

    if (!clientsAcc || !feesAcc) {
      console.error('autoEntryInvoice: missing required accounts');
      return null;
    }

    const lines = [];

    // مدين: العملاء
    lines.push({
      account_id: clientsAcc.id,
      debit: total,
      credit: 0,
      description: 'العملاء - فاتورة',
    });

    // دائن: الإيرادات
    const netRevenue = subtotal - (Number(discount) || 0);
    if (netRevenue > 0) {
      lines.push({
        account_id: feesAcc.id,
        debit: 0,
        credit: netRevenue,
        description: 'أتعاب قضايا',
      });
    }

    // دائن: الضريبة
    if (taxAmount > 0 && taxAcc) {
      lines.push({
        account_id: taxAcc.id,
        debit: 0,
        credit: taxAmount,
        description: 'ضرائب مستحقة',
      });
    } else if (taxAmount > 0 && !taxAcc) {
      // fallback: نضيف الضريبة للإيراد
      lines[1].credit += taxAmount;
    }

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.error('autoEntryInvoice: not balanced', { totalDebit, totalCredit });
      return null;
    }

    return await createJournalEntry(env, {
      officeId, date,
      description: description || `فاتورة جديدة #${invoiceId}`,
      lines,
      referenceType: 'invoice', referenceId: invoiceId, userId,
    });
  } catch (e) {
    console.error('autoEntryInvoice failed:', e.message, e.stack);
    return null;
  }
}

// ============================================================
// قوائم مالية
// ============================================================
export async function getProfitAndLoss(env, officeId, fromDate, toDate) {
  const revQ = `SELECT a.id, a.code, a.name, a.type, a.category,
    COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) as amount
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.entry_id
    WHERE a.office_id = ? AND a.type = 'revenue' AND a.category = 'revenue'
      AND (je.entry_date IS NULL OR (je.entry_date >= ? AND je.entry_date <= ?))
    GROUP BY a.id, a.code, a.name, a.type, a.category
    HAVING amount != 0 ORDER BY a.code`;
  const revenueRes = await env.DB.prepare(revQ).bind(officeId, fromDate, toDate).all();
  const revenues = revenueRes.results || [];
  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);

  const expQ = `SELECT a.id, a.code, a.name, a.type, a.category,
    COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as amount
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.entry_id
    WHERE a.office_id = ? AND a.type = 'expense' AND a.category = 'expense'
      AND (je.entry_date IS NULL OR (je.entry_date >= ? AND je.entry_date <= ?))
    GROUP BY a.id, a.code, a.name, a.type, a.category
    HAVING amount != 0 ORDER BY a.code`;
  const expenseRes = await env.DB.prepare(expQ).bind(officeId, fromDate, toDate).all();
  const expenses = expenseRes.results || [];
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

  const netProfit = totalRevenue - totalExpenses;
  const expenseGroups = {
    salaries: expenses.filter(e => e.code.startsWith('51')).reduce((s, e) => s + e.amount, 0),
    office: expenses.filter(e => e.code.startsWith('52')).reduce((s, e) => s + e.amount, 0),
    cases: expenses.filter(e => e.code.startsWith('53')).reduce((s, e) => s + e.amount, 0),
    admin: expenses.filter(e => e.code.startsWith('54')).reduce((s, e) => s + e.amount, 0),
  };

  return {
    period: { from: fromDate, to: toDate },
    revenues, expenses,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    is_profit: netProfit >= 0,
    profit_margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    expense_groups: expenseGroups,
  };
}

export async function getBalanceSheet(env, officeId, asOfDate) {
  const q = `SELECT a.id, a.code, a.name, a.type, a.category,
    COALESCE(SUM(jl.debit), 0) as total_debit,
    COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.entry_id
    WHERE a.office_id = ? AND a.category != 'header'
      AND (je.entry_date IS NULL OR je.entry_date <= ?)
    GROUP BY a.id, a.code, a.name, a.type, a.category ORDER BY a.code`;
  const res = await env.DB.prepare(q).bind(officeId, asOfDate).all();
  const accounts = res.results || [];

  const calcBal = (acc) => (acc.type === 'asset' || acc.type === 'expense')
    ? acc.total_debit - acc.total_credit
    : acc.total_credit - acc.total_debit;

  const assets = accounts.filter(a => a.type === 'asset').map(a => ({ ...a, balance: calcBal(a) })).filter(a => a.balance !== 0);
  const liabilities = accounts.filter(a => a.type === 'liability').map(a => ({ ...a, balance: calcBal(a) })).filter(a => a.balance !== 0);
  const equity = accounts.filter(a => a.type === 'equity').map(a => ({ ...a, balance: calcBal(a) })).filter(a => a.balance !== 0);
  const revenues = accounts.filter(a => a.type === 'revenue').reduce((s, a) => s + calcBal(a), 0);
  const expenses = accounts.filter(a => a.type === 'expense').reduce((s, a) => s + calcBal(a), 0);
  const netProfit = revenues - expenses;

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquityBase = equity.reduce((s, a) => s + a.balance, 0);
  const totalEquity = totalEquityBase + netProfit;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    as_of: asOfDate, assets, liabilities, equity,
    total_assets: totalAssets, total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    total_liabilities_and_equity: totalLiabilitiesAndEquity,
    is_balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    net_profit: netProfit,
  };
}

export async function getCashFlow(env, officeId, fromDate, toDate) {
  const q = `SELECT je.entry_number, je.entry_date, je.description, je.reference_type,
    jl.debit, jl.credit, a.code as account_code, a.name as account_name
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN accounts a ON a.id = jl.account_id
    WHERE je.office_id = ? AND a.code IN ('1101', '1102')
      AND je.entry_date >= ? AND je.entry_date <= ?
    ORDER BY je.entry_date, je.id`;
  const res = await env.DB.prepare(q).bind(officeId, fromDate, toDate).all();
  const movements = res.results || [];

  let inflow = 0, outflow = 0;
  const inflowDetails = [], outflowDetails = [];
  for (const m of movements) {
    const net = (m.debit || 0) - (m.credit || 0);
    if (net > 0) { inflow += net; inflowDetails.push({ ...m, amount: net }); }
    else if (net < 0) { outflow += Math.abs(net); outflowDetails.push({ ...m, amount: Math.abs(net) }); }
  }
  return {
    period: { from: fromDate, to: toDate },
    opening_cash: 0, inflow, outflow,
    net_cash_flow: inflow - outflow,
    inflow_details: inflowDetails, outflow_details: outflowDetails,
    closing_cash: inflow - outflow,
  };
}

export async function getAccountingSummary(env, officeId, fromDate, toDate) {
  const pl = await getProfitAndLoss(env, officeId, fromDate, toDate);
  const bs = await getBalanceSheet(env, officeId, toDate);

  return {
    period: { from: fromDate, to: toDate },
    revenue: pl.total_revenue, expenses: pl.total_expenses,
    net_profit: pl.net_profit, profit_margin: pl.profit_margin,
    is_profit: pl.is_profit,
    total_assets: bs.total_assets, total_liabilities: bs.total_liabilities,
    total_equity: bs.total_equity,
    cash_balance: bs.assets.find(a => a.code === '1101')?.balance || 0,
    bank_balance: bs.assets.find(a => a.code === '1102')?.balance || 0,
  };
}