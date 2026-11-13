-- مُوكِّل — Cloudflare D1 schema
-- deploy: wrangler d1 execute mowakkil-db-v2 --file=schema.sql

CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT,
  logo TEXT,
  status TEXT DEFAULT 'trial',
  trial_ends_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'lawyer',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  name TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  client_id INTEGER REFERENCES clients(id),
  case_number TEXT,
  court TEXT,
  degree TEXT,
  case_type TEXT,
  status TEXT DEFAULT 'مفتوحة',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id),
  session_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lawyers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  name TEXT NOT NULL,
  grade TEXT,
  salary REAL,
  phone TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  case_id INTEGER REFERENCES cases(id),
  client_id INTEGER REFERENCES clients(id),
  amount_due REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  status TEXT DEFAULT 'مستحق',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  lawyer_id INTEGER REFERENCES lawyers(id),
  case_id INTEGER REFERENCES cases(id),
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT DEFAULT 'مفتوحة',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  case_id INTEGER REFERENCES cases(id),
  task_id INTEGER REFERENCES tasks(id),
  doc_type TEXT,
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS law_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_name TEXT NOT NULL,
  law_number TEXT,
  article_number TEXT NOT NULL,
  article_text TEXT NOT NULL,
  source_url TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS super_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT,
  active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cases_office ON cases(office_id);
CREATE INDEX IF NOT EXISTS idx_sessions_case ON sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_law_text ON law_articles(article_text);
CREATE INDEX IF NOT EXISTS idx_clients_office ON clients(office_id);
CREATE INDEX IF NOT EXISTS idx_users_office ON users(office_id);
CREATE INDEX IF NOT EXISTS idx_fees_office ON fees(office_id);
CREATE INDEX IF NOT EXISTS idx_tasks_office ON tasks(office_id);