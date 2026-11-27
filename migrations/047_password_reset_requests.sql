-- طلبات «نسيت كلمة السر»: العميل بيطلب من صفحة الدخول، والطلب بيظهر للسوبر أدمن
-- اللي بيعمله كلمة سر مؤقتة ويبعتهاله واتساب
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  office_id INTEGER,
  identifier TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | dismissed
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pwreq_status ON password_reset_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pwreq_user ON password_reset_requests(user_id, status);
