-- 033: حالة القراءة والإخفاء لكل مستخدم (بدل ما قراءة واحد تتحسب للمكتب كله)
-- + إعداد تذكيرات مواعيد الأجندة
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_office_created ON notifications(office_id, created_at);
ALTER TABLE office_settings ADD COLUMN notif_events INTEGER DEFAULT 1;
