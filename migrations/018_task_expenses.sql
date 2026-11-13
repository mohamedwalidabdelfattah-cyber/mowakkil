-- ============================================================
-- 018_task_expenses.sql
-- مصاريف المهام (مستقلة عن القضايا)
-- ============================================================

CREATE TABLE IF NOT EXISTS task_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_expenses_office ON task_expenses(office_id);
CREATE INDEX IF NOT EXISTS idx_task_expenses_task ON task_expenses(task_id);