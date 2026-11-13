-- ============================================================
-- 017_documents_blob.sql
-- تخزين المستندات في D1 (مؤقتًا)
-- ============================================================

ALTER TABLE documents ADD COLUMN file_data TEXT;
ALTER TABLE documents ADD COLUMN file_size INTEGER;
ALTER TABLE documents ADD COLUMN mime_type TEXT;