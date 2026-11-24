-- 042: مصدر تسجيل المكتب (إعلان فيسبوك/إنستجرام/جوجل/مباشر…)
-- عشان نعرف أنهي إعلان وحملة بيجيبوا ناس بتستخدم البرنامج وتشترك فعلاً
ALTER TABLE offices ADD COLUMN signup_source TEXT;    -- facebook | instagram | messenger | google | whatsapp | referral | direct | …
ALTER TABLE offices ADD COLUMN signup_medium TEXT;    -- paid | organic | referral | …
ALTER TABLE offices ADD COLUMN signup_campaign TEXT;  -- اسم الحملة
ALTER TABLE offices ADD COLUMN signup_content TEXT;   -- اسم الإعلان
ALTER TABLE offices ADD COLUMN signup_referrer TEXT;  -- الموقع اللي جه منه (لو مفيش UTM)
ALTER TABLE offices ADD COLUMN signup_landing TEXT;   -- أول صفحة فتحها
CREATE INDEX IF NOT EXISTS idx_offices_signup_source ON offices(signup_source);
