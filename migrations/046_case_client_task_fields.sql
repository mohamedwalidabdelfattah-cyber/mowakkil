-- 046: حقول ناقصة كان المحامين محتاجينها (كلها اختيارية)
-- القضية: الخصم، صفة الموكل (مدعي / مدعى عليه / …)، موضوع الدعوى
ALTER TABLE cases ADD COLUMN opponent_name TEXT;
ALTER TABLE cases ADD COLUMN client_role TEXT;
ALTER TABLE cases ADD COLUMN subject TEXT;
-- الموكل: إيميل وعنوان وملاحظات
ALTER TABLE clients ADD COLUMN email TEXT;
ALTER TABLE clients ADD COLUMN address TEXT;
ALTER TABLE clients ADD COLUMN notes TEXT;
-- المهمة: تفاصيل المطلوب
ALTER TABLE tasks ADD COLUMN notes TEXT;
