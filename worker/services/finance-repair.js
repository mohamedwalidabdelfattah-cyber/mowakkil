// worker/services/finance-repair.js
// تصليح البيانات المالية القديمة — بيتعمل مرة واحدة لكل مكتب (علامة office_settings.finance_repair_v1)
// أول ما المكتب يفتح أي شاشة مالية بعد التحديث.
//
// اللي بيتصلح:
//  1) فاتورة لنفس شغل أتعاب مسجلة (نفس القضية ونفس المبلغ) → تتربط بالأتعاب، فالإيراد ميتحسبش مرتين
//  2) قيود الفواتير تتظبط على حالتها (المسودة من غير قيد)
//  3) "مدفوع" اتكتب بإيد على الأتعاب أو الفاتورة من غير دفعة → يتسجل كدفعة حقيقية (تسوية)
//  4) مصروفات (مكتب/جلسة/مهمة) قيدها اتمسح بالغلط → القيد يرجع
//  5) المدفوع على الأتعاب والفواتير يتحسب من الدفعات

import {
  syncInvoiceEntry, recordPayment, recalcFee, recalcInvoice, autoEntryExpense, REF,
} from './accounting.js';

const done = new Set(); // كاش في الذاكرة عشان منسألش الداتابيز كل طلب

export async function ensureFinanceRepaired(env, officeId) {
  if (!officeId || done.has(officeId)) return;
  try {
    const s = await env.DB.prepare('SELECT finance_repair_v1 FROM office_settings WHERE office_id = ?').bind(officeId).first();
    if (!s || s.finance_repair_v1) { done.add(officeId); return; }
    // نحجز العلامة الأول عشان طلبين ورا بعض ميعملوش التصليح مرتين
    const lock = await env.DB.prepare(
      `UPDATE office_settings SET finance_repair_v1 = 'running' WHERE office_id = ? AND finance_repair_v1 IS NULL`
    ).bind(officeId).run();
    if (!lock.meta.changes) { done.add(officeId); return; }
    const report = await repairOffice(env, officeId);
    await env.DB.prepare('UPDATE office_settings SET finance_repair_v1 = ? WHERE office_id = ?')
      .bind(JSON.stringify({ at: new Date().toISOString(), ...report }), officeId).run();
    done.add(officeId);
    console.log('finance repair', officeId, JSON.stringify(report));
  } catch (e) {
    console.error('finance repair failed', officeId, e.message);
    // نسيبها تتعاد المرة الجاية
    await env.DB.prepare(`UPDATE office_settings SET finance_repair_v1 = NULL WHERE office_id = ? AND finance_repair_v1 = 'running'`)
      .bind(officeId).run().catch(() => {});
  }
}

export async function repairOffice(env, officeId) {
  const report = { linked_invoices: 0, synced_invoices: 0, fee_adjustments: 0, invoice_adjustments: 0, restored_expenses: 0 };
  const all = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];

  // 1) ربط الفواتير اللي بتكرر أتعاب مسجلة
  const loose = await all(
    `SELECT id, case_id, client_id, subtotal, discount FROM invoices
     WHERE office_id = ? AND fee_id IS NULL AND case_id IS NOT NULL`, officeId);
  for (const inv of loose) {
    const net = (Number(inv.subtotal) || 0) - (Number(inv.discount) || 0);
    const cands = await all(
      `SELECT id FROM fees WHERE office_id = ? AND case_id = ?
         AND (client_id IS NULL OR ? IS NULL OR client_id = ?)
         AND (ABS(amount_due - ?) < 0.01 OR ABS(amount_due - ?) < 0.01)
         AND id NOT IN (SELECT fee_id FROM invoices WHERE fee_id IS NOT NULL AND office_id = ?)`,
      officeId, inv.case_id, inv.client_id, inv.client_id, net, Number(inv.subtotal) || 0, officeId);
    if (cands.length === 1) {
      await env.DB.prepare('UPDATE invoices SET fee_id = ? WHERE id = ? AND office_id = ?').bind(cands[0].id, inv.id, officeId).run();
      report.linked_invoices++;
    }
  }

  // 2) قيود الفواتير حسب حالتها وربطها
  for (const inv of await all('SELECT id FROM invoices WHERE office_id = ?', officeId)) {
    await syncInvoiceEntry(env, officeId, inv.id);
    report.synced_invoices++;
  }

  // 3أ) "مدفوع" على الأتعاب أكبر من الدفعات الحقيقية → دفعة تسوية
  for (const f of await all(
    `SELECT f.id, f.amount_paid, f.due_date, f.created_at,
            (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.fee_id = f.id AND p.office_id = f.office_id) AS real_paid
     FROM fees f WHERE f.office_id = ?`, officeId)) {
    const diff = (Number(f.amount_paid) || 0) - (Number(f.real_paid) || 0);
    if (diff > 0.009) {
      await recordPayment(env, { officeId, amount: diff, method: 'نقدي', date: f.due_date || String(f.created_at || '').slice(0, 10) || null,
        feeId: f.id, notes: 'تسوية تلقائية: مبلغ اتسجل مدفوع يدوياً قبل تحديث النظام' });
      report.fee_adjustments++;
    }
  }

  // 3ب) "مدفوع" على الفاتورة أكبر من دفعاتها (للمربوطة بأتعاب: من دفعات الأتعاب)
  for (const inv of await all(
    `SELECT i.id, i.fee_id, i.paid_amount, i.issue_date,
            (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.office_id = i.office_id
               AND (p.invoice_id = i.id OR (i.fee_id IS NOT NULL AND p.fee_id = i.fee_id))) AS real_paid
     FROM invoices i WHERE i.office_id = ?`, officeId)) {
    const diff = (Number(inv.paid_amount) || 0) - (Number(inv.real_paid) || 0);
    if (diff > 0.009) {
      await recordPayment(env, { officeId, amount: diff, method: 'نقدي', date: inv.issue_date,
        invoiceId: inv.id, notes: 'تسوية تلقائية: الفاتورة اتعلّمت مدفوعة يدوياً قبل تحديث النظام' });
      report.invoice_adjustments++;
    }
  }

  // 4) مصروفات قيدها ضاع
  for (const e of await all(
    `SELECT e.id, e.total_amount, e.amount, e.expense_date, e.description, e.payment_method, a.code AS account_code
     FROM expenses e LEFT JOIN accounts a ON a.id = e.account_id
     WHERE e.office_id = ? AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.office_id = e.office_id AND je.reference_type = 'expense' AND je.reference_id = e.id)`, officeId)) {
    const amt = Number(e.total_amount) || Number(e.amount) || 0;
    if (amt > 0 && await autoEntryExpense(env, { officeId, expenseId: e.id, amount: amt, date: e.expense_date, description: e.description,
      accountCode: e.account_code || '5406', method: e.payment_method, refType: REF.expense })) report.restored_expenses++;
  }
  for (const se of await all(
    `SELECT se.id, se.amount, se.description, se.created_at FROM session_expenses se
     JOIN sessions s ON s.id = se.session_id JOIN cases c ON c.id = s.case_id
     WHERE c.office_id = ? AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.office_id = c.office_id AND je.reference_type = 'session_expense' AND je.reference_id = se.id)`, officeId)) {
    if (Number(se.amount) > 0 && await autoEntryExpense(env, { officeId, expenseId: se.id, amount: Number(se.amount), date: String(se.created_at || '').slice(0, 10),
      description: se.description || 'مصروف جلسة', accountCode: '5301', refType: REF.session_expense })) report.restored_expenses++;
  }
  for (const te of await all(
    `SELECT te.id, te.amount, te.description, te.created_at FROM task_expenses te
     WHERE te.office_id = ? AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.office_id = te.office_id AND je.reference_type = 'task_expense' AND je.reference_id = te.id)`, officeId)) {
    if (Number(te.amount) > 0 && await autoEntryExpense(env, { officeId, expenseId: te.id, amount: Number(te.amount), date: String(te.created_at || '').slice(0, 10),
      description: te.description || 'مصروف مهمة', accountCode: '5301', refType: REF.task_expense })) report.restored_expenses++;
  }

  // 5) المدفوع من الدفعات
  for (const f of await all('SELECT id FROM fees WHERE office_id = ?', officeId)) await recalcFee(env, officeId, f.id);
  for (const i of await all('SELECT id FROM invoices WHERE office_id = ?', officeId)) await recalcInvoice(env, officeId, i.id); // بتحسب دفعات الأتعاب المربوطة كمان

  return report;
}
