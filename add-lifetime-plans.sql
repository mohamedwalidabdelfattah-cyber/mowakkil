INSERT OR IGNORE INTO plan_features 
  (plan, display_name, display_name_en, price_egp, features, limits, sort_order, is_active, billing_type) 
VALUES 
  ('lifetime_basic', 'التأسيس (مدى الحياة)', 'Lifetime Basic', 4999, '{"cases":true,"clients":true,"agenda":true,"portal":true,"finance":false,"invoices":false,"ai":false,"advanced_reports":false,"whatsapp":false,"multi_office":false,"api":false}', '{"max_users":3,"max_cases":-1,"max_clients":-1,"max_storage_mb":500}', 4, 1, 'lifetime');

INSERT OR IGNORE INTO plan_features 
  (plan, display_name, display_name_en, price_egp, features, limits, sort_order, is_active, billing_type) 
VALUES 
  ('lifetime_pro', 'المكتب المتكامل (مدى الحياة)', 'Lifetime Pro', 9999, '{"cases":true,"clients":true,"agenda":true,"portal":true,"finance":true,"invoices":true,"ai":true,"advanced_reports":true,"whatsapp":true,"multi_office":false,"api":true}', '{"max_users":10,"max_cases":-1,"max_clients":-1,"max_storage_mb":5000}', 5, 1, 'lifetime');