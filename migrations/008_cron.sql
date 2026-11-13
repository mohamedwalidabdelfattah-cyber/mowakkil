-- migration_008_cron.sql
-- يضيف بيانات إضافية مطلوبة لـ cron trial expiry

ALTER TABLE offices ADD COLUMN last_trial_warning_at TEXT;
ALTER TABLE offices ADD COLUMN last_expired_notice_at TEXT;

CREATE INDEX IF NOT EXISTS idx_offices_status_trial
  ON offices(status, trial_ends_at);

CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  processed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  details TEXT
);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('008');