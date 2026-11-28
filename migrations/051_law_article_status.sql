-- 051: حالة كل مادة قانونية + مصدر التحقق — تمهيد لتحديث المواد من الجريدة الرسمية
--   status: active (ساري) | review (يُراجع — فيه تعديل محتمل) | repealed (ملغى) | unofficial (مش نص رسمي)
--   البحث القانوني بيستبعد repealed و unofficial، و review بيوصل للذكاء الاصطناعي مع تنبيه.
ALTER TABLE law_articles ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE law_articles ADD COLUMN status_note TEXT;
ALTER TABLE law_articles ADD COLUMN verified_at TEXT;
ALTER TABLE law_articles ADD COLUMN official_source TEXT;
CREATE INDEX IF NOT EXISTS idx_law_articles_status ON law_articles(country, status);

-- 101 مادة اتكتبت بالإيد وقت إنشاء النظام (3/10/2026) — صياغات تقريبية مش النص الرسمي
UPDATE law_articles SET status = 'unofficial',
  status_note = 'نص مكتوب يدوياً وقت إنشاء النظام — ليس النص الرسمي'
WHERE country = 'EG' AND substr(added_at, 1, 10) = '2026-10-03';

-- قانون العمل 12 لسنة 2003 اتلغى بقانون العمل الجديد
UPDATE law_articles SET status = 'repealed',
  status_note = 'ملغى — حل محله قانون العمل رقم 14 لسنة 2025 (ساري من 1 سبتمبر 2025)'
WHERE country = 'EG' AND law_name IN ('قانون العمل الموحد', 'قانون العمل الموحد رقم12لسنة2003');

-- محتاجين مراجعة على الجريدة الرسمية
UPDATE law_articles SET status = 'review',
  status_note = 'يُراجع: صدر قانون الإجراءات الجنائية الجديد رقم 174 لسنة 2025 — تأكد من النص الساري'
WHERE country = 'EG' AND law_name = 'قانون الاجراءات';

UPDATE law_articles SET status = 'review',
  status_note = 'يُراجع: صدرت تعديلات تشريعية على أحكام الإيجار القديم في 2025 — تأكد من النص الساري'
WHERE country = 'EG' AND law_name IN ('قانون الايجارات 136 لسنة 1981', 'قانون الايجارات');

-- الأنظمة السعودية منقولة من المصادر الرسمية (هيئة الخبراء / وزارة العدل / أم القرى)
UPDATE law_articles SET official_source = 'هيئة الخبراء بمجلس الوزراء / وزارة العدل / جريدة أم القرى'
WHERE country = 'SA' AND official_source IS NULL;
