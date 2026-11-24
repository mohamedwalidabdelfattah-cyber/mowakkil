// worker/services/accounting.js
// خدمة محاسبية كاملة — دفتر اليومية + التقارير

// ============================================================
// توليد رقم قيد تلقائي
// ============================================================
// الرقم بيتحسب من أكبر رقم النهارده (مش من العدد) — بعد حذف قيد العدد بيقل والرقم كان بيتكرر والقيد بيترفض في صمت
export async function nextSeq(env, table, column, officeId, prefix) {
  const row = await env.DB.prepare(
    `SELECT MAX(CAST(substr(${column}, ?) AS INTEGER)) AS m FROM ${table} WHERE office_id = ? AND ${column} LIKE ?`
  ).bind(prefix.length + 1, officeId, prefix + '%').first();
  return (Number(row?.m) || 0) + 1;
}

export async function generateEntryNumber(env, officeId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `JE-${today}-`;
  return prefix + String(await nextSeq(env, 'journal_entries', 'entry_number', officeId, prefix)).padStart(4, '0');
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

  // لو طلبين في نفس اللحظة خدوا نفس الرقم، نجرب الرقم اللي بعده
  let entryNumber, entry;
  for (let attempt = 0; attempt < 4; attempt++) {
    entryNumber = await generateEntryNumber(env, officeId);
    if (attempt) entryNumber = entryNumber.replace(/(\d+)$/, n => String(Number(n) + attempt).padStart(4, '0'));
    try {
      entry = await env.DB.prepare(
        `INSERT INTO journal_entries
          (office_id, entry_number, entry_date, description,
           reference_type, reference_id, total_debit, total_credit, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(officeId, entryNumber, date, description || null,
        referenceType, referenceId, totalDebit, totalCredit, userId).run();
      break;
    } catch (e) {
      if (!/UNIQUE/i.test(e.message) || attempt === 3) throw e;
    }
  }

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
// طريقة الدفع → الحساب: نقدي = الصندوق، أي حاجة تانية (تحويل، إنستاباي، محفظة، شيك…) = البنك
// ============================================================
const CASH_METHODS = ['', 'نقدي', 'نقدا', 'نقداً', 'كاش', 'cash'];
export function moneyAccountCode(method) {
  return CASH_METHODS.includes(String(method || '').trim().toLowerCase()) ? '1101' : '1102';
}

// أنواع القيود التلقائية (كل نوع ليه مرجع لوحده عشان الأرقام متتلخبطش بين الجداول)
export const REF = {
  payment: 'payment', fee: 'fee', invoice: 'invoice',
  expense: 'expense', session_expense: 'session_expense', task_expense: 'task_expense',
};

// حذف كل القيود التلقائية لعنصر معيّن
export async function deleteEntriesFor(env, officeId, refType, refId) {
  await env.DB.prepare(
    `DELETE FROM journal_lines WHERE entry_id IN
      (SELECT id FROM journal_entries WHERE reference_type = ? AND reference_id = ? AND office_id = ?)`
  ).bind(refType, refId, officeId).run();
  await env.DB.prepare(
    `DELETE FROM journal_entries WHERE reference_type = ? AND reference_id = ? AND office_id = ?`
  ).bind(refType, refId, officeId).run();
}

// ============================================================
// قيد تلقائي: دفعة
//   مدين: الصندوق أو البنك (حسب طريقة الدفع)
//   دائن: العملاء (لو على أتعاب أو فاتورة) — أو دفعات مقدمة (لو لسه مفيش أتعاب)
// ============================================================
export async function autoEntryPayment(env, { officeId, paymentId, amount, date, method, description, feeId = null, invoiceId = null, userId }) {
  try {
    const moneyAcc = await getAccountByCode(env, officeId, moneyAccountCode(method))
      || await getAccountByCode(env, officeId, '1101');
    if (!moneyAcc) return null;
    const creditAcc = await getAccountByCode(env, officeId, (feeId || invoiceId) ? '1103' : '2106');
    if (!creditAcc) return null;

    return await createJournalEntry(env, {
      officeId, date,
      description: description || `تحصيل دفعة - ${method || 'نقدي'}`,
      lines: [
        { account_id: moneyAcc.id, debit: amount, credit: 0, description: moneyAcc.name },
        { account_id: creditAcc.id, debit: 0, credit: amount, description: creditAcc.name },
      ],
      referenceType: REF.payment, referenceId: paymentId, userId,
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
      referenceType: REF.fee, referenceId: feeId, userId,
    });
  } catch (e) { console.error('autoEntryFeeCreated failed:', e.message); return null; }
}

// ============================================================
// قيد تلقائي: مصروف (مكتب / جلسة / مهمة)
//   refType: 'expense' | 'session_expense' | 'task_expense'
//   الدائن: الصندوق أو البنك حسب طريقة الدفع
// ============================================================
export async function autoEntryExpense(env, { officeId, expenseId, amount, date, description, accountCode = '5406', method = null, refType = REF.expense, userId }) {
  try {
    const moneyAcc = await getAccountByCode(env, officeId, moneyAccountCode(method))
      || await getAccountByCode(env, officeId, '1101');
    const expenseAcc = await getAccountByCode(env, officeId, accountCode)
      || await getAccountByCode(env, officeId, '5406');
    if (!moneyAcc || !expenseAcc) return null;

    return await createJournalEntry(env, {
      officeId, date,
      description: description || 'مصروف',
      lines: [
        { account_id: expenseAcc.id, debit: amount, credit: 0, description: expenseAcc.name },
        { account_id: moneyAcc.id, debit: 0, credit: amount, description: moneyAcc.name },
      ],
      referenceType: refType, referenceId: expenseId, userId,
    });
  } catch (e) { console.error('autoEntryExpense failed:', e.message); return null; }
}

// ============================================================
// إعادة حساب المدفوع على الأتعاب والفاتورة من الدفعات الحقيقية
// ============================================================
export async function recalcFee(env, officeId, feeId) {
  if (!feeId) return;
  const fee = await env.DB.prepare('SELECT amount_due FROM fees WHERE id = ? AND office_id = ?').bind(feeId, officeId).first();
  if (!fee) return;
  const t = await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE fee_id = ? AND office_id = ?').bind(feeId, officeId).first();
  const paid = Number(t?.total) || 0;
  const status = paid >= (fee.amount_due || 0) && paid > 0 ? 'مدفوع بالكامل' : paid > 0 ? 'مدفوع جزئياً' : 'مستحق';
  await env.DB.prepare('UPDATE fees SET amount_paid = ?, status = ? WHERE id = ? AND office_id = ?').bind(paid, status, feeId, officeId).run();
}

// كل الفواتير المربوطة بأتعاب معيّنة
export async function recalcInvoicesForFee(env, officeId, feeId) {
  if (!feeId) return;
  const { results } = await env.DB.prepare('SELECT id FROM invoices WHERE fee_id = ? AND office_id = ?').bind(feeId, officeId).all();
  for (const r of results || []) await recalcInvoice(env, officeId, r.id);
}

export async function recalcInvoice(env, officeId, invoiceId) {
  if (!invoiceId) return;
  const inv = await env.DB.prepare('SELECT total, status, due_date, fee_id FROM invoices WHERE id = ? AND office_id = ?').bind(invoiceId, officeId).first();
  if (!inv) return;
  // الفاتورة المربوطة بأتعاب: أي دفعة على الأتعاب (حتى قبل الفاتورة) بتتحسب منها
  const t = await env.DB.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE office_id = ? AND (invoice_id = ? OR (? IS NOT NULL AND fee_id = ?))'
  ).bind(officeId, invoiceId, inv.fee_id, inv.fee_id).first();
  const paid = Math.min(Number(t?.total) || 0, Number(inv.total) || 0);
  let status = inv.status;
  if (inv.status !== 'ملغاة') {
    if (paid > 0 && paid + 0.01 >= (inv.total || 0)) status = 'مدفوعة';
    else if (paid > 0) status = 'مدفوعة جزئياً';
    else if (inv.status === 'مدفوعة' || inv.status === 'مدفوعة جزئياً') status = 'مرسلة';
  }
  await env.DB.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ? AND office_id = ?').bind(paid, status, invoiceId, officeId).run();
}

// ============================================================
// تسجيل دفعة حقيقية (المكان الوحيد اللي بيسجّل فلوس داخلة)
//   بيستخدمه: شاشة الدفعات، تحصيل الفاتورة، "مدفوع" في الأتعاب، وتصليح البيانات القديمة
// ============================================================
export async function recordPayment(env, { officeId, userId = null, amount, method = 'نقدي', date, feeId = null, invoiceId = null, clientId = null, caseId = null, notes = null }) {
  amount = Math.round(Number(amount) * 100) / 100;
  if (!(amount > 0)) throw new Error('اكتب مبلغ صحيح');
  let fee = null, inv = null;
  if (invoiceId) {
    inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND office_id = ?').bind(invoiceId, officeId).first();
    if (!inv) throw new Error('الفاتورة مش موجودة');
    feeId = feeId || inv.fee_id || null;
  }
  if (feeId) {
    fee = await env.DB.prepare('SELECT * FROM fees WHERE id = ? AND office_id = ?').bind(feeId, officeId).first();
    if (!fee) throw new Error('الأتعاب مش موجودة');
  }
  const day = String(date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const rPrefix = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
  const receipt = rPrefix + String(await nextSeq(env, 'payments', 'receipt_number', officeId, rPrefix)).padStart(4, '0');
  const client = clientId ?? inv?.client_id ?? fee?.client_id ?? null;
  const caseRef = caseId ?? inv?.case_id ?? fee?.case_id ?? null;

  const r = await env.DB.prepare(
    `INSERT INTO payments (office_id, fee_id, invoice_id, client_id, case_id, amount, method, payment_date, receipt_number, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(officeId, feeId, invoiceId, client, caseRef, amount, method || 'نقدي', day, receipt, notes, userId).run();
  const paymentId = r.meta.last_row_id;

  await recalcFee(env, officeId, feeId);
  await recalcInvoice(env, officeId, invoiceId);
  await recalcInvoicesForFee(env, officeId, feeId);
  await autoEntryPayment(env, {
    officeId, paymentId, amount, date: day, method,
    description: `تحصيل دفعة - ${receipt}${inv ? ' - فاتورة ' + inv.invoice_number : ''}`,
    feeId, invoiceId, userId,
  });
  return { id: paymentId, receipt_number: receipt, client_id: client, fee, invoice: inv };
}

// حذف دفعة + قيدها + إعادة حساب الأتعاب والفاتورة
export async function removePayment(env, officeId, payment) {
  await env.DB.prepare('DELETE FROM payments WHERE id = ? AND office_id = ?').bind(payment.id, officeId).run();
  await deleteEntriesFor(env, officeId, REF.payment, payment.id);
  await recalcFee(env, officeId, payment.fee_id);
  await recalcInvoice(env, officeId, payment.invoice_id);
  await recalcInvoicesForFee(env, officeId, payment.fee_id);
}

// ============================================================
// قيد الفاتورة حسب حالتها وربطها
//   مسودة / ملغاة → مفيش قيد
//   مربوطة بأتعاب → الإيراد اتسجل مع الأتعاب، فبنسجّل الضريبة بس (لو فيه)
//   مستقلة → العملاء مدين، والإيراد والضريبة دائن
// ============================================================
export async function syncInvoiceEntry(env, officeId, invoiceId, userId = null) {
  await deleteEntriesFor(env, officeId, REF.invoice, invoiceId);
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND office_id = ?').bind(invoiceId, officeId).first();
  if (!inv || inv.status === 'مسودة' || inv.status === 'ملغاة') return null;
  if (inv.fee_id) {
    const tax = Number(inv.tax_amount) || 0;
    if (tax <= 0) return null;
    const clientsAcc = await getAccountByCode(env, officeId, '1103');
    const taxAcc = await getAccountByCode(env, officeId, '2104');
    if (!clientsAcc || !taxAcc) return null;
    return createJournalEntry(env, {
      officeId, date: inv.issue_date, description: `ضريبة فاتورة ${inv.invoice_number}`,
      lines: [
        { account_id: clientsAcc.id, debit: tax, credit: 0, description: 'العملاء - ضريبة' },
        { account_id: taxAcc.id, debit: 0, credit: tax, description: 'ضرائب مستحقة' },
      ],
      referenceType: REF.invoice, referenceId: invoiceId, userId,
    }).catch(e => { console.error('invoice tax entry failed:', e.message); return null; });
  }
  return autoEntryInvoice(env, {
    officeId, invoiceId, subtotal: Number(inv.subtotal) || 0, taxAmount: Number(inv.tax_amount) || 0,
    total: Number(inv.total) || 0, discount: Number(inv.discount) || 0, date: inv.issue_date,
    description: `فاتورة ${inv.invoice_number}`, userId,
  });
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
      referenceType: REF.invoice, referenceId: invoiceId, userId,
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