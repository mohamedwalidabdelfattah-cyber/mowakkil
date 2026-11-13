-- migration 011: نظام المصاريف الكامل

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  expense_date TEXT NOT NULL,
  description TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  vendor TEXT,
  reference_number TEXT,
  case_id INTEGER REFERENCES cases(id),
  client_id INTEGER REFERENCES clients(id),
  is_reimbursable INTEGER DEFAULT 0,
  is_recurring INTEGER DEFAULT 0,
  recurring_frequency TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_office ON expenses(office_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_case ON expenses(case_id);
CREATE INDEX IF NOT EXISTS idx_expenses_client ON expenses(client_id);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('011');