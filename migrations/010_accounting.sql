-- migration 010: نظام محاسبي كامل (Chart of Accounts + Journal)

-- ============================================================
-- 1) جدول الحسابات (Chart of Accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  code TEXT NOT NULL,                    -- 1000, 2000, 4000, 5000...
  name TEXT NOT NULL,                    -- نقدية، بنك، أتعاب قضايا...
  name_en TEXT,                          -- Cash, Bank...
  type TEXT NOT NULL,                    -- asset | liability | equity | revenue | expense
  category TEXT,                         -- current_asset, fixed_asset, current_liability...
  parent_id INTEGER REFERENCES accounts(id),
  is_active INTEGER DEFAULT 1,
  is_system INTEGER DEFAULT 0,           -- 1 = حساب أساسي مش بيتحذف
  opening_balance REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(office_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_office ON accounts(office_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(office_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);

-- ============================================================
-- 2) دفتر اليومية (Journal Entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  entry_number TEXT NOT NULL,            -- JE-20261005-0001
  entry_date TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,                   -- payment | expense | invoice | manual
  reference_id INTEGER,                  -- id من الجدول المرتبط
  total_debit REAL NOT NULL DEFAULT 0,
  total_credit REAL NOT NULL DEFAULT 0,
  is_posted INTEGER DEFAULT 1,           -- 1 = مرحّل، 0 = مسودة
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(office_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_office ON journal_entries(office_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_ref ON journal_entries(reference_type, reference_id);

-- ============================================================
-- 3) سطور القيود (Journal Lines)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

-- ============================================================
-- 4) إعدادات المحاسبة (Accounting Settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(office_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_acc_settings_office ON accounting_settings(office_id);

-- ============================================================
-- 5) تسجيل النسخة
-- ============================================================
INSERT OR IGNORE INTO schema_migrations (version) VALUES ('010');