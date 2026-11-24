-- 039: الفروع (مراكز التكلفة) + موافقة المدير على المصروفات الكبيرة — للباقة المتقدمة

-- 1) الفروع
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_branches_office ON branches(office_id);
ALTER TABLE cases ADD COLUMN branch_id INTEGER REFERENCES branches(id);
ALTER TABLE expenses ADD COLUMN branch_id INTEGER REFERENCES branches(id);

-- 2) الموافقة: المصروف اللي فوق الحد (من غير المدير) بيفضل "مستني موافقة" ومش بيدخل الحسابات
ALTER TABLE office_settings ADD COLUMN expense_approval_limit REAL;
ALTER TABLE expenses ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'; -- approved | pending | rejected
ALTER TABLE expenses ADD COLUMN approved_by INTEGER;
ALTER TABLE expenses ADD COLUMN approved_at TEXT;
