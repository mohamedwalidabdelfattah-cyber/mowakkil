-- 029: تخزين المستندات على كمبيوتر المكتب (اختياري)
-- documents.storage: cloud (Backblaze B2) | device (فولدر على كمبيوتر المستخدم — السيرفر بيحتفظ بالبيانات بس)
-- documents.device_label: اسم الجهاز اللي عليه الملف (مثلاً "كمبيوتر المكتب")
-- r2_key للملفات المحلية = 'device:' + المسار جوه الفولدر
ALTER TABLE documents ADD COLUMN storage TEXT DEFAULT 'cloud';
ALTER TABLE documents ADD COLUMN device_label TEXT;
-- مكان الحفظ الافتراضي للمكتب: cloud | device
ALTER TABLE office_settings ADD COLUMN doc_storage_default TEXT DEFAULT 'cloud';
