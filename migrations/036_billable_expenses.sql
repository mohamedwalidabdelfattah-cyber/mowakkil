-- 036: مصاريف الجلسات والمهام ممكن تبقى على حساب الموكل (بتتضاف لمديونيته وكشف حسابه بدل ما تبقى مصروف على المكتب)
-- مصاريف المكتب العامة عندها بالفعل is_reimbursable
ALTER TABLE session_expenses ADD COLUMN billable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_expenses ADD COLUMN billable INTEGER NOT NULL DEFAULT 0;
