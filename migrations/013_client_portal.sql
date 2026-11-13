-- migration 013: Client Portal

-- حسابات الموكلين
CREATE TABLE IF NOT EXISTS client_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT,
  active INTEGER DEFAULT 1,
  last_login_at TEXT,
  invite_code TEXT,
  invite_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_users_office ON client_users(office_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_phone ON client_users(phone);
CREATE INDEX IF NOT EXISTS idx_client_users_email ON client_users(email);
CREATE INDEX IF NOT EXISTS idx_client_users_invite ON client_users(invite_code);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('013');