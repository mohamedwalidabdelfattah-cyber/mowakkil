-- migration 009: نظام المدفوعات

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  fee_id INTEGER REFERENCES fees(id),
  client_id INTEGER REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  amount REAL NOT NULL DEFAULT 0,
  method TEXT,
  payment_date TEXT NOT NULL,
  receipt_number TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_office ON payments(office_id);
CREATE INDEX IF NOT EXISTS idx_payments_fee ON payments(fee_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('009');