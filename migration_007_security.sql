-- migration_007_security.sql
-- إضافات أمنية وبنية تحتية — additive فقط
-- شغّله بـ: node scripts/migrate.mjs migration_007_security.sql mowakkil-db --remote

-- ============ 1) تتبّع الميجريشنز ============
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- ============ 2) Audit log ============
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  metadata TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_office ON audit_log(office_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- ============ 3) أعمدة جديدة على users ============
ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN failed_logins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- ============ 4) Soft delete ============
ALTER TABLE clients ADD COLUMN deleted_at TEXT;
ALTER TABLE cases ADD COLUMN deleted_at TEXT;
ALTER TABLE documents ADD COLUMN deleted_at TEXT;

-- ============ 5) أعمدة إضافية على offices ============
ALTER TABLE offices ADD COLUMN onboarding_step INTEGER DEFAULT 0;
ALTER TABLE offices ADD COLUMN timezone TEXT DEFAULT 'Africa/Cairo';
ALTER TABLE offices ADD COLUMN suspended_reason TEXT;

-- ============ 6) فهارس أداء وأمان ============
CREATE INDEX IF NOT EXISTS idx_users_office ON users(office_id);
CREATE INDEX IF NOT EXISTS idx_clients_office ON clients(office_id);
CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_deleted ON cases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_office ON documents(office_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_fees_office ON fees(office_id);
CREATE INDEX IF NOT EXISTS idx_tasks_office ON tasks(office_id);

-- ============ 7) تسجيل النسخة ============
INSERT OR IGNORE INTO schema_migrations (version) VALUES ('007');