-- 044: دولة المادة القانونية (مصر / السعودية) — البحث القانوني بيجيب مواد دولة المكتب بس
-- المواد الحالية كلها مصرية. الأنظمة السعودية بتتضاف من laws-sa/sa-laws.sql (المصدر: جريدة أم القرى)
ALTER TABLE law_articles ADD COLUMN country TEXT NOT NULL DEFAULT 'EG';
CREATE INDEX IF NOT EXISTS idx_law_articles_country ON law_articles(country);
