-- 030: قوالب رسايل واتساب لكل مكتب (JSON: {session, fee, update, general})
-- فاضي = القوالب الافتراضية اللي في الواجهة
ALTER TABLE office_settings ADD COLUMN wa_templates TEXT;
