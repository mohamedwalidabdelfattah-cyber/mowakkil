-- المحادثة ممكن تبقى عن قضية معيّنة (المساعد بيشوف سياقها) — عشان الرجوع للمحادثة يرجّع نفس القضية
ALTER TABLE chat_sessions ADD COLUMN case_id INTEGER;
