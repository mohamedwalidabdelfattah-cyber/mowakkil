-- 041: متابعة المكاتب اللي في الفترة التجريبية برسايل واتساب (من السوبر أدمن)
-- الرسايل قوالب بيعدّلها مسؤول المنصة، والنظام بيختار مين محتاج أنهي رسالة النهارده

CREATE TABLE IF NOT EXISTS followup_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  segments TEXT NOT NULL DEFAULT 'any',   -- any | not_started,stalled,active,ending,expired (مفصولة بفاصلة)
  min_day INTEGER NOT NULL DEFAULT 0,     -- بعد كام يوم من التسجيل
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS followup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id INTEGER NOT NULL,
  template_key TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_followup_log_office ON followup_log(office_id);

CREATE TABLE IF NOT EXISTS office_followup (
  office_id INTEGER PRIMARY KEY,
  stopped INTEGER NOT NULL DEFAULT 0,     -- طلب ميتبعتلوش تاني / مش مهتم
  note TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO followup_templates (key, title, segments, min_day, sort, body) VALUES
('welcome', 'ترحيب', 'any', 0, 10,
'أهلاً أ/ {الاسم} 👋
مكتب {المكتب} اتسجل على مُوكِّل بنجاح ✅

أسرع بداية: ضيف أول قضية في دقيقة، والجلسات هتنزل في الأجندة ويجيلك تذكير قبل كل جلسة.
{رابط_الموقع}

لو محتاج أي مساعدة ابعتلي هنا على طول.'),

('first_case', 'أول قضية', 'not_started', 1, 20,
'صباح الخير أ/ {الاسم} ☀️
لاحظت إن المكتب لسه فاضي، فحبيت أسهّلها عليك:
١) من «الموكلين» ضيف موكل
٢) من «القضايا» ضيف القضية ورقمها والمحكمة
٣) ضيف ميعاد الجلسة الجاية

وبس كده، مُوكِّل هيفكّرك بالجلسة ويبعت للموكل تذكير على واتساب بضغطة.
{رابط_الموقع}'),

('feature', 'ميزة بتوفر وقت', 'not_started,stalled', 3, 30,
'أ/ {الاسم}، سؤال سريع 🙂
لسه بتكتب الجلسات في أجندة ورق؟

في مُوكِّل كل جلسات الأسبوع قدامك في شاشة واحدة، وبضغطة واحدة تبعت للموكل تذكير بميعاد جلسته على واتساب.
جرّبها من هنا: {رابط_الموقع}'),

('setup_help', 'عرض مساعدة', 'not_started,stalled', 6, 40,
'أ/ {الاسم}، تحب أظبطلك المكتب بنفسي؟ 🤝
ابعتلي أسماء الموكلين وأرقام القضايا (صورة أو ملف Excel) وأنا أدخلهم لك، أو نعمل مكالمة ١٠ دقايق أوريك البرنامج.

فاضل على التجربة {الأيام_المتبقية} يوم، وحابب تلحق تستفيد منها.'),

('active_value', 'للمكتب النشيط', 'active', 7, 50,
'أ/ {الاسم} 👏
شايف إنك ضفت {القضايا} قضية و{الموكلين} موكل، شغل ممتاز!

عندك كمان في مُوكِّل:
• الأتعاب والتحصيل وكشف حساب لكل موكل
• تحليل القضايا والمستندات بالذكاء الاصطناعي
• بوابة للموكل يتابع منها قضيته

لو عندك أي اقتراح أو محتاج حاجة، أنا موجود.'),

('ending', 'التجربة قربت تخلص', 'ending', 0, 60,
'أ/ {الاسم}، فاضل {الأيام_المتبقية} يوم على الفترة التجريبية ⏳
كل بياناتك محفوظة ({القضايا} قضية و{الموكلين} موكل)، وتقدر تكمّل بالباقة اللي تناسب مكتبك:
{رابط_الباقات}

لو محتاج تسأل على أي باقة ابعتلي.'),

('expired', 'بعد انتهاء التجربة', 'expired', 0, 70,
'أ/ {الاسم}، الفترة التجريبية لمكتب {المكتب} خلصت، بس كل بياناتك لسه محفوظة 🔒
لو محتاج كام يوم زيادة عشان تقرر قولّي وأمدّهالك.
الباقات من هنا: {رابط_الباقات}');
