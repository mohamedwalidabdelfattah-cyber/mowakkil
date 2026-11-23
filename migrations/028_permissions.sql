-- 028: نظام الصلاحيات
-- users.role: admin (مالك المكتب) | partner | lawyer | secretary | accountant | trainee | custom
-- users.scope: all (كل قضايا المكتب) | assigned (القضايا المكلّف بيها بس — الباقة الاحترافية وأعلى)
-- users.custom_role_id: دور مخصص (الباقة المتقدمة) — بيتستخدم لما role = 'custom'
ALTER TABLE users ADD COLUMN scope TEXT DEFAULT 'all';
ALTER TABLE users ADD COLUMN custom_role_id INTEGER;

-- أدوار مخصصة لكل مكتب (الباقة المتقدمة)
CREATE TABLE IF NOT EXISTS office_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  name TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',   -- JSON: ["cases.view","cases.create",...]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_office_roles_office ON office_roles(office_id);

-- فريق كل قضية (مين مكلّف بيها)
CREATE TABLE IF NOT EXISTS case_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  case_id INTEGER NOT NULL REFERENCES cases(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(case_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_case_members_user ON case_members(user_id);
