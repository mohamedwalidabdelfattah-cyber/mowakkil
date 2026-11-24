-- 038: الإدارة المالية — المرحلة 3 (المكاتب المتوسطة والكبيرة)

-- 1) أمانات الموكلين (مقدم مصاريف): إيداع / رد — والصرف منها بيتسجل على المصروف نفسه (paid_from_trust)
CREATE TABLE IF NOT EXISTS trust_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  kind TEXT NOT NULL,              -- deposit | refund
  amount REAL NOT NULL,
  method TEXT,
  tx_date TEXT NOT NULL,
  description TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trust_client ON trust_transactions(office_id, client_id);
ALTER TABLE expenses ADD COLUMN paid_from_trust INTEGER NOT NULL DEFAULT 0;

-- حساب التزام: أمانات الموكلين (الفلوس دي بتاعة الموكل لحد ما تتصرف عليه أو تترد)
INSERT INTO accounts (office_id, code, name, name_en, type, category, parent_id, is_system)
SELECT a.office_id, '2107', 'أمانات الموكلين (مقدم مصاريف)', 'Client Trust Deposits', 'liability', 'current_liability', a.id, 1
FROM accounts a
WHERE a.code = '2100'
  AND NOT EXISTS (SELECT 1 FROM accounts b WHERE b.office_id = a.office_id AND b.code = '2107');

-- 2) المصاريف المتكررة: آخر مرة اتسجلت + رابط النسخة بالأصل
ALTER TABLE expenses ADD COLUMN recurring_parent_id INTEGER;
ALTER TABLE expenses ADD COLUMN recurring_last TEXT;

-- 3) قفل الفترات: مفيش إضافة/تعديل/حذف لحركة مالية تاريخها قبل التاريخ ده
ALTER TABLE office_settings ADD COLUMN lock_before TEXT;

-- 4) الباقات: قفل الفترات والتصدير للمحاسب في "المتقدمة"
UPDATE plan_features SET features = json_set(features, '$.finance_advanced', json('true')) WHERE plan = 'plus';
UPDATE plan_features SET features = json_set(features, '$.finance_advanced', json('false')) WHERE plan <> 'plus';
