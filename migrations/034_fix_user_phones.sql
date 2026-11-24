-- 034: تصليح أرقام المستخدمين اللي اتحفظت غلط وقت التسجيل
-- (1) مصري اتحفظ من غير الصفر: 1012345678 → 01012345678
UPDATE users SET phone = '0' || phone
WHERE phone GLOB '1[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.phone = '0' || users.phone);

-- (2) دولي اتحفظ بصفر قدامه: 0966512345678 → +966512345678 (المصري 11 رقم بس فمش هيتأثر)
UPDATE users SET phone = '+' || substr(phone, 2)
WHERE phone GLOB '0[1-9]*' AND length(phone) >= 12 AND phone NOT GLOB '*[^0-9]*'
  AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.phone = '+' || substr(users.phone, 2));

-- (3) أي رقم اتحفظ بمسافات أو شرط
UPDATE users SET phone = replace(replace(phone, ' ', ''), '-', '')
WHERE (phone LIKE '% %' OR phone LIKE '%-%')
  AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.phone = replace(replace(users.phone, ' ', ''), '-', ''));
