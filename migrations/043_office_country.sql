-- 043: دولة المكتب (مصر / السعودية) — بتحدد العملة والضريبة والتوقيت والتواريخ (هجري) والمحاكم وأنواع القضايا والأنظمة
ALTER TABLE office_settings ADD COLUMN country TEXT NOT NULL DEFAULT 'EG';
