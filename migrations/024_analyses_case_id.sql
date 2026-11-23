-- 024: ربط التحليلات الذكية بالقضية (زر "تحليل بالذكاء الاصطناعي" في تفاصيل القضية)
-- الكود شغال حتى قبل تطبيق الـ migration دي (بيحفظ case:<id> في file_name كبديل)
ALTER TABLE analyses ADD COLUMN case_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_analyses_case ON analyses(office_id, case_id);
