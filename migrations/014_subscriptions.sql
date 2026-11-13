-- ============================================================
-- 014_subscriptions.sql
-- نظام الاشتراكات والباقات
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trial',
  started_at TEXT DEFAULT (datetime('now')),
  trial_ends_at TEXT,
  expires_at TEXT,
  payment_method TEXT,
  payment_ref TEXT,
  amount_paid REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_office ON subscriptions(office_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS plan_features (
  plan TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  display_name_en TEXT,
  price_egp REAL DEFAULT 0,
  features TEXT NOT NULL,
  limits TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscription_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL,
  old_plan TEXT,
  new_plan TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sub_history_office ON subscription_history(office_id);

INSERT OR REPLACE INTO plan_features (plan, display_name, display_name_en, price_egp, features, limits, sort_order) VALUES
('free', 'المجانية', 'Free', 0,
  '{"cases":true,"clients":true,"agenda":true,"portal":true,"finance":false,"invoices":false,"ai":false,"advanced_reports":false,"whatsapp":false,"multi_office":false,"api":false}',
  '{"max_users":1,"max_cases":10,"max_clients":20,"max_storage_mb":100}',
  1),

('starter', 'الأساسية', 'Starter', 199,
  '{"cases":true,"clients":true,"agenda":true,"portal":true,"finance":true,"invoices":true,"ai":false,"advanced_reports":false,"whatsapp":false,"multi_office":false,"api":false}',
  '{"max_users":3,"max_cases":50,"max_clients":100,"max_storage_mb":1024}',
  2),

('pro', 'الاحترافية', 'Pro', 399,
  '{"cases":true,"clients":true,"agenda":true,"portal":true,"finance":true,"invoices":true,"ai":true,"advanced_reports":true,"whatsapp":true,"multi_office":false,"api":false}',
  '{"max_users":10,"max_cases":-1,"max_clients":-1,"max_storage_mb":10240}',
  3),

('plus', 'المتقدمة', 'Plus', 799,
  '{"cases":true,"clients":true,"agenda":true,"portal":true,"finance":true,"invoices":true,"ai":true,"advanced_reports":true,"whatsapp":true,"multi_office":true,"api":true}',
  '{"max_users":-1,"max_cases":-1,"max_clients":-1,"max_storage_mb":51200}',
  4);

INSERT OR IGNORE INTO subscriptions (office_id, plan, status, trial_ends_at)
SELECT id, 'free', 'trial', datetime('now', '+15 days')
FROM offices;