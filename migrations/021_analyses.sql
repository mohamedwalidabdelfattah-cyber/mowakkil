CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  input_text TEXT NOT NULL,
  result_json TEXT,
  file_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (office_id) REFERENCES offices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_analyses_office ON analyses(office_id);
CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(type);