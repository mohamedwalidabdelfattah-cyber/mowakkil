-- Migration 020: Office Settings (إعدادات المكتب الشاملة)

CREATE TABLE IF NOT EXISTS office_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL UNIQUE,

  -- معلومات المكتب
  office_name_ar TEXT,
  office_name_en TEXT,
  logo TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_number TEXT,
  commercial_register TEXT,

  -- المحاسبة
  currency TEXT DEFAULT 'EGP',
  vat_rate REAL DEFAULT 0,
  invoice_prefix TEXT DEFAULT '',
  invoice_terms TEXT,
  fiscal_year_start INTEGER DEFAULT 1,

  -- الإشعارات
  notif_sessions INTEGER DEFAULT 1,
  notif_tasks INTEGER DEFAULT 1,
  notif_fees INTEGER DEFAULT 1,
  notif_payments INTEGER DEFAULT 1,
  notif_cases INTEGER DEFAULT 1,
  notif_clients INTEGER DEFAULT 1,
  session_reminder_days INTEGER DEFAULT 1,

  -- المظهر
  theme TEXT DEFAULT 'light',
  primary_color TEXT DEFAULT '#6366F1',
  font_size TEXT DEFAULT 'medium',
  language TEXT DEFAULT 'ar',

  -- عام
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  timezone TEXT DEFAULT 'Africa/Cairo',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (office_id) REFERENCES offices(id)
);

CREATE INDEX IF NOT EXISTS idx_settings_office ON office_settings(office_id);

-- إعدادات افتراضية لكل مكتب موجود
INSERT OR IGNORE INTO office_settings (office_id)
SELECT id FROM offices;