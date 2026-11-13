-- ============================================================
-- 016_payment_requests.sql
-- طلبات الدفع اليدوي
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  amount_egp REAL NOT NULL,
  method TEXT NOT NULL,              -- 'vodafone_cash', 'instapay'
  sender_phone TEXT,                 -- رقم اللي حوّل
  sender_name TEXT,                  -- اسم اللي حوّل
  transfer_ref TEXT,                 -- رقم العملية (اختياري)
  receipt_url TEXT,                  -- رابط صورة الإيصال (اختياري)
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  reviewed_by INTEGER,               -- super_admin id
  reviewed_at TEXT,
  rejection_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_office ON payment_requests(office_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created ON payment_requests(created_at DESC);