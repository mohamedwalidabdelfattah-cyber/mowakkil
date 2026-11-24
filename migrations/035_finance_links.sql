-- 035: ربط الإدارة المالية ببعضها + تصليح القيود اللي اتلخبطت
-- (المرحلة 1 من مراجعة الإدارة المالية — reports/مراجعة الإدارة المالية.md)

-- 1) الفاتورة ممكن تتربط بأتعاب موجودة (فمتعملش إيراد تاني)، والدفعة ممكن تتربط بفاتورة
ALTER TABLE invoices ADD COLUMN fee_id INTEGER REFERENCES fees(id);
ALTER TABLE payments ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_fee ON invoices(fee_id);

-- 2) علامة إن تصليح البيانات القديمة اتعمل للمكتب (بيتعمل مرة واحدة من السيرفر)
ALTER TABLE office_settings ADD COLUMN finance_repair_v1 TEXT;

-- 3) قيود مصاريف الجلسات والمهام كانت متسجلة كـ 'expense' بنفس أرقام مصاريف المكتب → حذف واحد بيمسح التاني
--    نفرّقهم بالوصف والمبلغ (الأوصاف بتتحفظ زي ما هي في القيد)
UPDATE journal_entries SET reference_type = 'task_expense'
WHERE reference_type = 'expense'
  AND EXISTS (SELECT 1 FROM task_expenses te
              WHERE te.id = journal_entries.reference_id AND te.office_id = journal_entries.office_id
                AND te.amount = journal_entries.total_debit
                AND COALESCE(te.description, '') = COALESCE(journal_entries.description, ''))
  AND NOT EXISTS (SELECT 1 FROM expenses e
                  WHERE e.id = journal_entries.reference_id AND e.office_id = journal_entries.office_id
                    AND e.total_amount = journal_entries.total_debit AND e.description = journal_entries.description);

UPDATE journal_entries SET reference_type = 'session_expense'
WHERE reference_type = 'expense'
  AND EXISTS (SELECT 1 FROM session_expenses se
              JOIN sessions s ON s.id = se.session_id
              JOIN cases c ON c.id = s.case_id
              WHERE se.id = journal_entries.reference_id AND c.office_id = journal_entries.office_id
                AND se.amount = journal_entries.total_debit
                AND COALESCE(NULLIF(se.description, ''), 'مصروف جلسة') = COALESCE(journal_entries.description, ''))
  AND NOT EXISTS (SELECT 1 FROM expenses e
                  WHERE e.id = journal_entries.reference_id AND e.office_id = journal_entries.office_id
                    AND e.total_amount = journal_entries.total_debit AND e.description = journal_entries.description);

-- 4) الفواتير المسودة مكانش المفروض يتعملها قيد
DELETE FROM journal_lines WHERE entry_id IN (
  SELECT je.id FROM journal_entries je JOIN invoices i ON i.id = je.reference_id AND i.office_id = je.office_id
  WHERE je.reference_type = 'invoice' AND i.status IN ('مسودة', 'ملغاة'));
DELETE FROM journal_entries WHERE reference_type = 'invoice' AND id NOT IN (SELECT DISTINCT entry_id FROM journal_lines);

-- 5) الدفعات اللي مش نقدي كانت بتتسجل في الصندوق → البنك
UPDATE journal_lines SET account_id = (
    SELECT b.id FROM accounts b JOIN journal_entries je ON je.office_id = b.office_id
    WHERE je.id = journal_lines.entry_id AND b.code = '1102')
WHERE debit > 0
  AND account_id IN (SELECT id FROM accounts WHERE code = '1101')
  AND entry_id IN (
    SELECT je.id FROM journal_entries je JOIN payments p ON p.id = je.reference_id AND p.office_id = je.office_id
    WHERE je.reference_type = 'payment' AND p.method IS NOT NULL AND TRIM(p.method) NOT IN ('', 'نقدي', 'نقدا', 'نقداً', 'كاش'))
  AND EXISTS (SELECT 1 FROM accounts b JOIN journal_entries je ON je.office_id = b.office_id
              WHERE je.id = journal_lines.entry_id AND b.code = '1102');

-- 6) المصروفات اللي اتدفعت بالبنك/محفظة كانت بتطلع من الصندوق → البنك
UPDATE journal_lines SET account_id = (
    SELECT b.id FROM accounts b JOIN journal_entries je ON je.office_id = b.office_id
    WHERE je.id = journal_lines.entry_id AND b.code = '1102')
WHERE credit > 0
  AND account_id IN (SELECT id FROM accounts WHERE code = '1101')
  AND entry_id IN (
    SELECT je.id FROM journal_entries je JOIN expenses e ON e.id = je.reference_id AND e.office_id = je.office_id
    WHERE je.reference_type = 'expense' AND e.payment_method IS NOT NULL AND TRIM(e.payment_method) NOT IN ('', 'نقدي', 'نقدا', 'نقداً', 'كاش'))
  AND EXISTS (SELECT 1 FROM accounts b JOIN journal_entries je ON je.office_id = b.office_id
              WHERE je.id = journal_lines.entry_id AND b.code = '1102');
