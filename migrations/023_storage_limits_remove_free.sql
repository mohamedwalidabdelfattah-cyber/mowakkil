-- ============================================================
-- 023_storage_limits_remove_free.sql
-- إخفاء الباقة المجانية + ضبط حدود المساحة (ميجا) حسب المساحة المتاحة
-- ملاحظة: التنفيذ الفعلي للحدود في worker/middleware/feature-gate.js (LIMITS)،
-- والجدول ده لعرض الأرقام في صفحة التسعير فقط. لازم الأرقام تتطابق.
-- ============================================================

UPDATE plan_features SET is_active = 0 WHERE plan = 'free';

UPDATE plan_features SET limits = json_set(limits, '$.max_storage_mb', 500)  WHERE plan = 'starter';
UPDATE plan_features SET limits = json_set(limits, '$.max_storage_mb', 2000) WHERE plan = 'pro';
UPDATE plan_features SET limits = json_set(limits, '$.max_storage_mb', 5000) WHERE plan = 'plus';
UPDATE plan_features SET limits = json_set(limits, '$.max_storage_mb', 500)  WHERE plan = 'lifetime_basic';
UPDATE plan_features SET limits = json_set(limits, '$.max_storage_mb', 2000) WHERE plan = 'lifetime_pro';
