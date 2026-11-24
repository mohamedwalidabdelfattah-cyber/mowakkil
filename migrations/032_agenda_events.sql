-- 032: مواعيد الأجندة الحرة (اجتماع، استشارة، موعد نهائي، إجراء، تذكير، شخصي، أخرى)
-- + ساعة الجلسة (الرول)
CREATE TABLE IF NOT EXISTS agenda_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  user_id INTEGER,                    -- اللي ضافه
  kind TEXT NOT NULL DEFAULT 'other', -- meeting | consultation | deadline | procedure | reminder | personal | other
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,           -- YYYY-MM-DD
  start_time TEXT,                    -- HH:MM (فاضي = طول اليوم)
  end_time TEXT,                      -- HH:MM
  location TEXT,
  notes TEXT,
  case_id INTEGER REFERENCES cases(id),
  client_id INTEGER REFERENCES clients(id),
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agenda_events_office_date ON agenda_events(office_id, start_date);
ALTER TABLE sessions ADD COLUMN session_time TEXT;
