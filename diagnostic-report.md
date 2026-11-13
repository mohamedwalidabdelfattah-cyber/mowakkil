# 🩺 تقرير تشخيص مشروع مُوكِّل

**تاريخ الفحص:** 2026-11-13 18:12

---

## ❌ أخطاء (0)

✅ مفيش أخطاء حرجة.

## ⚠️ تحذيرات (7)

- ⚠️ ألوان قديمة في `web\assets\brand-theme.css`: #4F46E5, #6366F1, #8B5CF6
- ⚠️ ألوان قديمة في `web\assets\design-system.css`: #D97706
- ⚠️ تكرارات في `web\assets\fonts.css`: `}

@font-face` (5×)
- ⚠️ تكرارات في `web\assets\styles.clean.css`: `}

@media (max-width: 768px)` (9×), `}

@media (max-width: 640px)` (8×)
- ⚠️ تكرارات في `web\assets\styles.css`: `}

@media (max-width: 640px)` (5×)
- ⚠️ `legal-search.js` مفيهوش `embedding` — تأكد إن الـ API شغال
- ⚠️ `subscription.js` مفيهوش `showUpgradeModal` — المودال مش هيظهر

## ℹ️ معلومات (1)

- ✅ كل الملفات ترميزها UTF-8 سليم.

---

## 💡 اقتراحات

💡 **اقتراحات لتحسين أقسام البيع:**
   - أضف **فيديوهات قصيرة** (30 ثانية) لكل ميزة في صفحة البداية.
   - أضف **شهادات عملاء** (Testimonials) في صفحة الباقات.
   - أضف **مقارنة مباشرة** بين الباقات في `/pricing` (Table comparison).
   - استخدم **A/B testing** لصفحة البداية (CTAs مختلفة).
   - أضف **Chat Widget** (AI) في صفحة البداية للإجابة على الاستفسارات.
   - أضف **Free Trial** واضح في الهيدر (زرار `ابدأ مجاناً`).

💡 **اقتراحات للذكاء الاصطناعي:**
   - تأكد إن `searchLegalDb` بيرجع 5+ نتائج على الأقل.
   - أضف **Streaming responses** للـ Chat (بدل الانتظار).
   - أضف **حد أقصى للرسائل** في الباقة المجانية (مثلاً 10 رسائل/شهر).
   - أضف **عدد المستخدمين** في الباقة (مثلاً 1 مستخدم للـ Free، 3 للـ Pro).
   - تأكد إن `chat_sessions` بتحفظ المحادثات بشكل صحيح.

💡 **اقتراحات عامة:**
   - أضف **Sitemap.xml** + **robots.txt** لمحركات البحث.
   - أضف **Open Graph** meta tags (og:title, og:image) للمشاركة على السوشيال.
   - أضف **Google Analytics** أو **Plausible** لتتبع الزوار.
   - أضف **Error tracking** (Sentry) للـ Worker.
