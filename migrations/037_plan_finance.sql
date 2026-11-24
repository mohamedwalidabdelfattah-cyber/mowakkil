-- 037: توزيع الإدارة المالية على الباقات (reports/مراجعة الإدارة المالية.md)
--   المحاسبة الكاملة (القيود والقوائم المالية ووضع المحاسب): الاحترافية والمتقدمة والمكتب المتكامل
--   التأسيس (مدى الحياة): الأتعاب والتحصيل والمصروفات والوضع المبسط وكشف الحساب
UPDATE plan_features SET features = json_set(features, '$.accounting', json('false')) WHERE plan IN ('free', 'starter', 'lifetime_basic');
UPDATE plan_features SET features = json_set(features, '$.accounting', json('true')) WHERE plan IN ('pro', 'plus', 'lifetime_pro');
UPDATE plan_features SET features = json_set(features, '$.finance', json('true')) WHERE plan = 'lifetime_basic';
