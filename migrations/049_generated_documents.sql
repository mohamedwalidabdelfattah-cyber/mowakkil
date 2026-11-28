-- المستندات اللي اتعملت من القوالب أو بالذكاء الاصطناعي (نص، مش ملف) — بتتحفظ في ملف القضية
CREATE TABLE IF NOT EXISTS generated_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL,
  case_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',   -- template | ai
  template_id TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_gendocs_office ON generated_documents(office_id, id);
CREATE INDEX IF NOT EXISTS idx_gendocs_case ON generated_documents(office_id, case_id);
