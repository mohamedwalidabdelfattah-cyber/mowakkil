-- migration 012: نظام الفواتير

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  invoice_number TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  issue_date TEXT NOT NULL,
  due_date TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'مسودة',
  notes TEXT,
  terms TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(office_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_office ON invoices(office_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_case ON invoices(case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(office_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issue_date);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('012');