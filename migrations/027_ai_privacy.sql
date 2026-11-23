-- 027: خصوصية الذكاء الاصطناعي لكل مكتب + موافقة مسؤول المكتب
-- ai_privacy: strict (Cloudflare بس) | balanced (إخفاء البيانات الشخصية + أفضل نموذج) | off (موقوف لبيانات الموكلين)
ALTER TABLE office_settings ADD COLUMN ai_privacy TEXT DEFAULT 'balanced';
ALTER TABLE office_settings ADD COLUMN ai_privacy_accepted_at TEXT;
ALTER TABLE office_settings ADD COLUMN ai_privacy_accepted_by INTEGER;
