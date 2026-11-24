-- المكتب المتكامل (مدى الحياة) بياخد أدوات المكاتب الكبيرة كمان
-- (الفروع، موافقة المدير، قفل الفترات، المرتبات، المصاريف المتكررة، أمانات الموكلين، التصدير للمحاسب)
UPDATE plan_features SET features = json_set(features, '$.finance_advanced', json('true')) WHERE plan = 'lifetime_pro';
