-- 031: عدّاد استخدام الذكاء الاصطناعي لكل مكتب في اليوم
-- الشهري = مجموع أيام الشهر. بيزيد بس لما الطلب ينجح.
CREATE TABLE IF NOT EXISTS ai_usage (
  office_id INTEGER NOT NULL,
  day TEXT NOT NULL,            -- YYYY-MM-DD (توقيت القاهرة)
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (office_id, day)
);
