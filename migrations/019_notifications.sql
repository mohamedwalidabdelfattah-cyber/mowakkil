-- ============================================================
-- 019_notifications.sql
-- نظام الإشعارات
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  user_id INTEGER REFERENCES users(id),           -- لو NULL → لكل المستخدمين
  type TEXT NOT NULL,                              -- 'session', 'task', 'fee', 'invoice', 'system'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                                        -- رابط للانتقال
  icon TEXT,                                        -- إيموجي
  priority TEXT DEFAULT 'normal',                  -- 'low', 'normal', 'high', 'urgent'
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  reference_type TEXT,                             -- 'case', 'session', 'task', 'fee', 'invoice'
  reference_id INTEGER,
  due_at TEXT,                                     -- وقت الحدث
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_office ON notifications(office_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(office_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);