-- 045: أسعار الباقات بالريال السعودي (للمكاتب السعودية)
-- مبنية على أسعار المنافسين في السعودية (محكام 199/499/999، مكين 149/549/1190، ProBase 399/899 ر.س شهرياً)
-- وأعلى بكتير من الأسعار المصرية (199/399/799 جنيه)
ALTER TABLE plan_features ADD COLUMN price_sar REAL;
UPDATE plan_features SET price_sar = 0    WHERE plan = 'free';
UPDATE plan_features SET price_sar = 149  WHERE plan = 'starter';
UPDATE plan_features SET price_sar = 299  WHERE plan = 'pro';
UPDATE plan_features SET price_sar = 599  WHERE plan = 'plus';
UPDATE plan_features SET price_sar = 3999 WHERE plan = 'lifetime_basic';
UPDATE plan_features SET price_sar = 7999 WHERE plan = 'lifetime_pro';
