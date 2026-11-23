-- 026: ملاحظة/وصف للمستند + فهرس للبحث حسب القضية والمهمة
-- الكود شغال من غيرها (الملاحظة بس مش هتتحفظ)
ALTER TABLE documents ADD COLUMN notes TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(office_id, case_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_task ON documents(office_id, task_id, deleted_at);
