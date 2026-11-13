-- ============================================================
-- 015_users_phone.sql
-- إضافة phone للـ users + تخفيف email
-- ============================================================

-- 1) نضيف عمود phone
ALTER TABLE users ADD COLUMN phone TEXT;

-- 2) نعمل unique index على phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- 3) نخلي email يقبل NULL (SQLite مش بيدعم تعديل notnull، فبنعمل جدول جديد)
-- الطريقة: نعمل جدول جديد، ننقل البيانات، نستبدل

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL,
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'lawyer',
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1,
  last_login_at TEXT,
  failed_logins INTEGER DEFAULT 0,
  locked_until TEXT
);

INSERT INTO users_new (id, office_id, email, phone, password_hash, salt, full_name, role, created_at, active, last_login_at, failed_logins, locked_until)
SELECT id, office_id, email, NULL, password_hash, salt, full_name, role, created_at, active, last_login_at, failed_logins, locked_until
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys = ON;

-- 4) نعمل index على email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_office ON users(office_id);