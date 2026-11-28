# مُوكِّل — المرجع الشامل (نسخة مفصلة)
**آخر تحديث:** 2026-11-24
**الغرض:** مرجع كامل لاستكمال العمل لو المحادثة قفلت

> 👈 **لو مستعجل:** روح على آخر قسم في الملف «📘 الدليل الشامل — 2026-11-23». فيه كل اللي اتعمل بالشرح، والأوامر جاهزة للنسخ، والمهام اللي عليك.

---

## 📌 ملخص سريع

- **المنصة:** SaaS لإدارة مكاتب المحاماة (قضايا، موكلين، محاسبة، فواتير، بوابة موكل، AI).
- **الوضع الحالي:** ✅ منشور وشغال على Cloudflare (Worker + Pages).
- **الرابط الحي:** https://mowakkil-2026.pages.dev — بوابة الموكل: https://mowakkil-2026.pages.dev/client/
- **المشروع على الجهاز:** `D:\Mohamed Walid\mowakkil`
- **GitHub (خاص/Private):** https://github.com/mohamedwalidabdelfattah-cyber/mowakkil — الفرع `master`
- **المشروع:** HTML/CSS/JS عادي (Vanilla) + Cloudflare Worker (API) + D1 + KV + Vectorize + Backblaze B2.
- **تطبيق أندرويد:** `web/downloads/mowakkil.apk` (التفاصيل في الدليل الشامل آخر الملف).

---

## 🔑 بيانات الدخول

> 🔐 الإيميلات والباسوردات و SETUP_KEY وحسابات الموكلين اتنقلت لملف `PROGRESS.secrets.md` (محلي فقط، في `.gitignore`).

### بوابة الموكل
- **الرابط:** `https://mowakkil-2026.pages.dev/client`
- **الدخول:** رقم هاتف + باسورد (أو Quick Login)
- ✅ Quick Login من الرابط (`?code=XXX&quick=1`) شغال (اتجرب 2026-11-23)


---

## 🌐 البنية التحتية الكاملة

### Cloudflare Account
- **Account ID:** `d3f7ae78663e16e3c1544a67ae48ebd8`

### Cloudflare D1 (قاعدة البيانات)
- **الاسم:** `mowakkil-db-v2`
- **ID:** `22344b60-cf0c-40b1-9783-13ea9db6916a`

### Cloudflare KV
- **الاسم:** `RATE_LIMIT_KV`
- **ID:** `79adf975838542bcafe32e45e8a241b6`
- **الغرض:** Rate limiting + Cache

### Cloudflare Vectorize
- **الحالي:** `law-articles-m3` (1024 dimension, cosine)
- **القديم (مهجور):** `law-articles-index` (768 dimension)
- **الغرض:** البحث القانوني الدلالي (RAG)

### Cloudflare Pages
- **المشروع:** `mowakkil-2026`
- **Project ID:** `8051c6b9-1b6f-4105-b7cf-260ff8236516`
- **Production Branch:** `production` ⚠️ (مهم جداً - لازم يكون production)
- **الرابط:** `https://mowakkil-2026.pages.dev`

### Cloudflare Worker (API)
- **الرابط:** `https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev`
- **الغرض:** كل عمليات الـ API (Auth, CRUD, AI, إلخ)

### Secrets على Cloudflare
| الاسم | الغرض |
|-------|-------|
| `JWT_SECRET` | توقيع JWT (ثابت — متغيّروش) |
| `SETUP_KEY` | (القيمة في `PROGRESS.secrets.md`) |
| `GEMINI_API_KEY` | Google Gemini (AI) |
| `ANTHROPIC_API_KEY` | Anthropic Claude (AI) |
| `OPENROUTER_API_KEY` | OpenRouter (AI fallback) |
| `GROQ_API_KEY` | Groq (Chat Agent أساسي) |
| `TAVILY_API_KEY` | Tavily (بحث ويب) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Service Account |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Service Account |
| `CLOUDINARY_CLOUD_NAME` | `n6ngaje6` |
| `CLOUDINARY_API_KEY` | Cloudinary |
| `CLOUDINARY_API_SECRET` | Cloudinary |
| `CLOUDINARY_UPLOAD_PRESET` | `mowakkil_docs` |
| `B2_ENDPOINT` | عنوان Backblaze S3 بالشكل `s3.<region>.backblazeb2.com` (من غير https://، ولازم يطابق region الباكت) |
| `B2_KEY_ID` | Application Key ID لباكت `mowakkil` (صلاحية Read and Write) |
| `B2_APP_KEY` | Application Key (سر، متتبعتش في أي محادثة) |
| `B2_BUCKET` | اختياري، الافتراضي في الكود `mowakkil` |

### الدفع اليدوي
- **الرقم:** `01155288607`
- **الاسم:** power media
- **الطرق:** فودافون كاش + إنستاباي

---

## 📂 هيكل المشروع الكامل

### الجذر: `C:\Users\hi\mowakkil\`

mowakkil/
├── .git/                              # Git repository
├── .gitignore                         # يستبعد node_modules, .wrangler, إلخ
├── PROGRESS.md                        # سجل التقدم الأصلي (من 4 نوفمبر)
├── PROGRESS-COMPLETE.md               # هذا الملف
├── wrangler.toml                      # إعدادات Cloudflare
├── package.json                       # dependencies
├── package-lock.json
├── audit.cjs                          # سكريبت فحص شامل
├── filter-audit.cjs                   # سكريبت فحص الفلاتر
├── filter-report.json                 # نتائج الفحص
├── office.json                        # بيانات مكتب تجريبي
├── setup.json                         # إعدادات
├── schema.sql                         # Schema كامل
├── token.txt                          # Token للاختبار
├── test-entry.json, test-expense.json, test-invoice.json, test-payment.json
├── vectors.ndjson, vectors-m3.ndjson  # Vector embeddings
├── seed-law-expanded.sql, seed-law-more.sql, seed-test-data.sql
├── seed-vectorize.mjs
├── scan-laws.mjs, scan-laws-core.mjs
│
├── node_modules/                      # (مش في Git)
│
├── web/                               # ⭐ الواجهة (Frontend)
│   ├── index.html                     # 29,550 بايت (نسخة السيرفر)
│   ├── pricing.html                   # صفحة التسعير
│   ├── signup.html                    # صفحة التسجيل
│   ├── pay.html                       # صفحة الدفع
│   ├── service-worker.js              # 2,400 بايت (PWA + Cache)
│   ├── logo-original.png              # صورة اللوجو الأصلية
│   ├── generate-logos.py              # سكريبت توليد اللوجو
│   │
│   ├── assets/                        # CSS, Fonts, Images
│   │   ├── styles.css                 # 106,890 بايت ⭐ (نسخة السيرفر)
│   │   ├── design-system.css          # 18,247 بايت
│   │   ├── landing.css                # 8,642 بايت
│   │   ├── pricing.css                # 10,157 بايت
│   │   ├── fonts.css                  # @font-face definitions
│   │   ├── site.webmanifest           # PWA manifest
│   │   ├── styles.css.old             # نسخة قديمة (احتياطي)
│   │   ├── logo.png                   # اللوجو القديم
│   │   ├── logo-ai.png, logo-ai-dark.png
│   │   ├── logo-original1.png
│   │   ├── app-icon.png
│   │   ├── apple-touch-icon.png
│   │   ├── favicon.ico, favicon.svg, favicon-96x96.png
│   │   ├── web-app-manifest-192x192.png
│   │   ├── web-app-manifest-512x512.png
│   │   ├── lady-justice.png           # صورة تمثال العدالة
│   │   │
│   │   ├── fonts/                     # خطوط محلية
│   │   │   ├── ibm-plex-sans-arabic-v15-arabic_latin-regular.woff2
│   │   │   ├── ibm-plex-sans-arabic-v15-arabic_latin-500.woff2
│   │   │   ├── ibm-plex-sans-arabic-v15-arabic_latin-600.woff2
│   │   │   ├── ibm-plex-sans-arabic-v15-arabic_latin-700.woff2
│   │   │   ├── ibm-plex-mono-v20-latin-regular.woff2
│   │   │   ├── ibm-plex-mono-v20-latin-500.woff2
│   │   │   └── ibm-plex-mono-v20-latin-600.woff2
│   │   │
│   │   └── logos/                     # ⭐ اللوجو الجديد (الذهبي)
│   │       ├── logo-transparent.png   # النسخة الشفافة الكاملة
│   │       ├── logo-xs.png            # 32x32
│   │       ├── logo-sm.png            # 48x48
│   │       ├── logo-md.png            # 64x64
│   │       ├── logo-lg.png            # 128x128
│   │       ├── logo-xl.png            # 256x256
│   │       ├── icon-192.png           # PWA 192x192
│   │       ├── icon-512.png           # PWA 512x512
│   │       └── favicon.ico            # Favicon
│   │
│   ├── js/                            # JavaScript
│   │   ├── main.js                    # 8,712 بايت ⭐ نقطة البداية
│   │   ├── config.js                  # إعدادات
│   │   ├── api.js                     # 6,457 بايت ⭐ API client
│   │   ├── state.js                   # Global state
│   │   ├── ui.js                      # 10,422 بايت ⭐ UI helpers
│   │   ├── router.js                  # 2,065 بايت ⭐ View router
│   │   ├── drawer.js                  # 10,915 بايت ⭐ القائمة الجانبية
│   │   ├── modal.js                   # Modal helpers
│   │   ├── notifications.js           # 7,415 بايت ⭐ الإشعارات
│   │   ├── search.js                  # 15,095 بايت ⭐ البحث الذكي
│   │   ├── pricing.js                 # منطق صفحة التسعير
│   │   ├── signup.js                  # منطق صفحة التسجيل
│   │   ├── pay.js                     # منطق صفحة الدفع
│   │   ├── case-detail.js             # منطق تفاصيل القضية
│   │   │
│   │   └── views/                     # صفحات التطبيق
│   │       ├── login.js               # صفحة الدخول
│   │       ├── dashboard.js           # 20,287 بايت ⭐ الداشبورد
│   │       ├── agenda.js              # 14,532 بايت (الأجندة)
│   │       ├── cases.js               # 19,175 بايت (القضايا)
│   │       ├── clients.js             # 26,394 بايت (الموكلين)
│   │       ├── lawyers.js             # 5,955 بايت (المحامين)
│   │       ├── fees.js                # 29,015 بايت (الأتعاب)
│   │       ├── tasks.js               # 25,531 بايت (المهام)
│   │       ├── reports.js             # 6,097 بايت (التقارير)
│   │       ├── calc.js                # 1,840 بايت (الحاسبة)
│   │       ├── search.js              # 35,315 بايت (البحث القانوني)
│   │       ├── account.js             # 6,421 بايت (الحساب)
│   │       ├── superadmin.js          # 27,108 بايت (Superadmin)
│   │       ├── money.js               # 39,965 بايت (الإدارة المالية)
│   │       ├── accounting.js          # 16,933 بايت (المحاسبة)
│   │       ├── invoice-detail.js      # 15,359 بايت (تفاصيل الفاتورة)
│   │       ├── subscription.js        # 7,146 بايت (الاشتراك)
│   │       └── settings.js            # 27,226 بايت (الإعدادات)
│   │
│   └── client/                        # ⭐ بوابة الموكل
│       ├── index.html                 # صفحة البوابة
│       ├── js/
│       │   ├── main.js                # منطق البوابة
│       │   └── portal.js              # مكونات البوابة
│       └── assets/
│           └── styles.css             # تنسيقات البوابة
│
├── worker/                            # ⭐ Cloudflare Worker (API)
│   ├── index.js                       # نقطة البداية (Routes)
│   ├── lib/
│   │   ├── auth.js                    # JWT verification
│   │   ├── response.js                # JSON responses
│   │   ├── router.js                  # Router
│   │   ├── validation.js              # Input validation
│   │   ├── audit.js                   # Audit log
│   │   ├── crypto.js                  # Crypto helpers
│   │   ├── jwt.js                     # JWT sign/verify
│   │   └── rate-limit.js              # Rate limiting
│   ├── middleware/
│   │   ├── feature-gate.js            # Subscription gating
│   │   └── subscription.js            # Subscription check
│   ├── services/
│   │   ├── dashboard.js               # Dashboard stats
│   │   ├── notification-jobs.js       # Cron jobs للإشعارات
│   │   ├── legal-search.js            # RAG (Vectorize)
│   │   ├── agent.js                   # ⭐ AI Chat Agent
│   │   ├── chat.js                    # Chat logic
│   │   ├── accounting.js              # Accounting logic
│   │   ├── chart-of-accounts.js       # Chart of accounts
│   │   └── fee-calc.js                # Fee calculations
│   └── routes/                        # 27 ملف API
│       ├── auth.js                    # Login/Register
│       ├── superadmin.js              # Superadmin APIs
│       ├── office.js                  # Office settings
│       ├── clients.js                 # Clients CRUD
│       ├── cases.js                   # Cases CRUD
│       ├── lawyers.js                 # Lawyers CRUD
│       ├── fees.js                    # Fees CRUD
│       ├── payments.js                # Payments CRUD
│       ├── sessions.js                # Sessions (جلسات)
│       ├── tasks.js                   # Tasks CRUD
│       ├── documents.js               # Documents upload
│       ├── reports.js                 # Reports
│       ├── tools.js                   # Utility tools
│       ├── accounts.js                # Accounts
│       ├── journal.js                 # Journal entries
│       ├── expenses.js                # Expenses
│       ├── invoices.js                # Invoices
│       ├── client-portal.js           # Client portal APIs
│       ├── subscription.js            # Subscriptions
│       ├── signup.js                  # Signup
│       ├── payment-requests.js        # Manual payments
│       ├── notifications.js           # Notifications
│       ├── calendar.js                # Calendar events
│       ├── settings.js                # Settings
│       ├── analyze.js                 # AI analysis
│       └── chat.js                    # ⭐ Chat APIs
│
├── migrations/                        # SQL migrations (22 ملف)
│   ├── 001_initial.sql                # الجداول الأساسية
│   ├── ...
│   ├── 014_subscriptions.sql          # الاشتراكات
│   ├── 015_signup_phone.sql           # رقم الهاتف
│   ├── 016_payment_requests.sql       # الدفع اليدوي
│   ├── 017_documents_d1.sql           # المستندات
│   ├── 018_task_expenses.sql          # مصاريف المهام
│   ├── 019_notifications.sql          # الإشعارات
│   ├── 020_office_settings.sql        # إعدادات المكتب
│   ├── 021_analyses.sql               # التحليلات
│   └── 022_chat.sql                   # ⭐ Chat tables
│
├── scripts/
│   └── migrate.mjs                    # Migration runner
│
├── cron/
│   └── trial-expiry.js                # Cron (تجربة منتهية)
│
└── tests/
    ├── auth.test.js
    ├── documents.test.js
    ├── setup.js
    └── tenancy.test.js

---

## 🗄️ قاعدة البيانات (D1) — الجداول

### المجموعة الأساسية
| الجدول | الغرض |
|--------|-------|
| `offices` | المكاتب (multi-tenant) |
| `users` | المستخدمين (محامين + admin) |
| `super_admins` | مسؤولو المنصة |

### البيانات الأساسية
| الجدول | الغرض |
|--------|-------|
| `clients` | الموكلين |
| `cases` | القضايا |
| `sessions` | الجلسات |
| `lawyers` | المحامين |
| `tasks` | المهام |
| `documents` | المستندات |

### المجموعة المالية
| الجدول | الغرض |
|--------|-------|
| `fees` | الأتعاب |
| `payments` | المدفوعات |
| `session_expenses` | مصاريف الجلسات |
| `expenses` | المصاريف العامة |
| `task_expenses` | مصاريف المهام |

### المحاسبة
| الجدول | الغرض |
|--------|-------|
| `accounts` | شجرة الحسابات |
| `journal_entries` | القيود اليومية |
| `journal_lines` | سطور القيود |
| `accounting_settings` | إعدادات المحاسبة |

### الفواتير
| الجدول | الغرض |
|--------|-------|
| `invoices` | الفواتير |
| `invoice_lines` | سطور الفواتير |

### الاشتراكات
| الجدول | الغرض |
|--------|-------|
| `subscriptions` | اشتراكات المكاتب |
| `plan_features` | ميزات كل باقة |
| `subscription_history` | تاريخ التغييرات |

### الدفع
| الجدول | الغرض |
|--------|-------|
| `payment_requests` | طلبات الدفع اليدوي |

### الإشعارات
| الجدول | الغرض |
|--------|-------|
| `notifications` | الإشعارات |

### الإعدادات
| الجدول | الغرض |
|--------|-------|
| `office_settings` | إعدادات المكتب |

### النظام
| الجدول | الغرض |
|--------|-------|
| `law_articles` | 5,828 مادة قانونية |
| `audit_log` | Audit trail |
| `schema_migrations` | Migrations applied |
| `cron_runs` | Cron job logs |

### بوابة الموكل
| الجدول | الغرض |
|--------|-------|
| `client_users` | حسابات العملاء |

### الشات (AI)
| الجدول | الغرض |
|--------|-------|
| `chat_sessions` | محادثات الشات |
| `chat_messages` | رسائل الشات |

### التحليل
| الجدول | الغرض |
|--------|-------|
| `analyses` | نتائج التحليل الذكي |

---

## ✅ اللي شغال (على Production)

### 1. التصميم (UI/UX Premium)
- Landing Page كاملة (Hero + Features + Stats + FAQ + CTA)
- تصميم Navy + Gold
- صفحة تسجيل بنفس الهوية
- Mobile responsive (No horizontal scroll)

### 2. الفلاتر المتقدمة (7 صفحات)
- **الفواتير:** status, client_id, from, to, search
- **القضايا:** search, type, court, archived
- **الموكلين:** search, from, to
- **المهام:** search, status, due (overdue/today/week), lawyer_id
- **الأتعاب:** search, status (paid/pending/late), from, to
- **المحامين:** search, include_inactive
- **الأجندة:** from, to, type (session/task/fee)

### 3. Dashboard Premium
- Welcome Hero (Navy + Gold)
- فلاتر فترة (7 أيام / 30 / شهر / 3 شهور / سنة)
- 4 Stats Cards
- Charts (Line + Doughnut + Bar)
- Quick Actions (4 أزرار)

### 4. Skeletons + Empty States
- `skeleton()`: text/card/chart/list
- `empty()`: icon + message + action
- Shimmer effect

### 5. AI Chat Agent (⭐ جديد)
- Chat UI كامل
- Tools: `search_legal_db` (5,828 مادة) + `search_web` (Tavily)
- 3 levels fallback: Groq → Cloudflare → OpenRouter
- حفظ محادثات في D1
- رفع ملفات (PDF/Word/TXT/صور)
- System Prompt محسّن (عربي 100%)
- Endpoints: POST /api/chat, GET /api/chat/sessions, DELETE /api/chat/sessions/:id

### 6. AI RAG (البحث القانوني)
- 5,828 مادة في D1
- Vectorize Index: `law-articles-m3` (1024 dims)
- Embeddings: `@cf/baai/bge-m3` (يدعم العربي)

### 7. Client Portal
- /client (تسجيل دخول + عرض)
- دعوة + تعطيل + إعادة + حذف
- Quick Login (⚠️ مش شغال من الرابط)
- WhatsApp Integration

### 8. الاشتراكات
- 4 باقات: Free (0) / Starter (199) / Pro (399) / Plus (799)
- Feature Gates (finance → starter, invoices → starter, ai → pro)
- API: /api/subscription/plans, /me, /change
- صفحة "اشتراكي" + Modal الترقية

### 9. صفحة التسعير (/pricing)
- 4 كروت + جدول مقارنة + FAQ + تبديل لغة

### 10. صفحة التسجيل الذاتي (/signup)
- POST /api/signup
- بيعمل: office + user + subscription (Pro trial 15 يوم) + chart of accounts
- دخل تلقائي (JWT)

### 11. Superadmin Dashboard
- 6 إحصائيات: offices, users, active, trial, MRR, ARR
- جدول مكاتب + بحث + فلترة + Modal + طلبات دفع

### 12. الدفع اليدوي
- صفحة /pay
- Superadmin يوافق → تفعيل تلقائي

### 13. تسجيل دخول بإيميل أو رقم هاتف
- /api/auth/login يقبل الاتنين

### 14. المستندات (Backblaze B2 — اتحدّث 2026-11-22)
- التخزين الفعلي على Backblaze B2 عن طريق الـ Worker (مكتبة `aws4fetch`) والبيانات الوصفية في D1
- الحد الأقصى للملف 10 ميجا (كان base64 في D1 لحد 1.5 ميجا)
- رفع + تحميل + حذف
- مرفقات في المهام

### 15. الإشعارات
- Badge + Dropdown + Polling 30s
- API: GET /api/notifications, /count, PATCH /:id/read, POST /mark-all-read
- Cron jobs للتذكيرات

### 16. التقويم
- Toast UI Calendar (CDN)
- عرض شهري/أسبوعي/يومي
- 3 أنواع أحداث
- Drag & Drop

### 17. PWA + Mobile
- Bottom Navigation (5 أزرار)
- صفحة "المزيد" (13 قسم)
- manifest + service-worker
- نظام تثبيت ذكي (Chrome/Safari/Samsung/Mi)

### 18. تحسينات الأداء
- CORS preflight caching (24h)
- Monthly-trend endpoint (1 req بدل 12)
- خطوط محلية (لا Google Fonts)
- API response caching (10s)
- 3.82s → 2.58s

### 19. الإصلاحات السابقة
- كسر الكاش (Build Version + SW unregister)
- `view-host` layout
- إصلاح "المزيد"
- إصلاح `getRoleFromToken`
- إصلاح `autoEntryInvoice`
- إصلاح `getInvite` في client-portal
- JWT_SECRET ثابت
- إصلاح Cloudinary
- إصلاح التخزين (Google Drive → D1)
- إصلاح حذف المحامي
- إصلاح مصاريف المهام
- إضافة `DELETE /api/tasks/:id`
- إضافة `DELETE /api/fees/:id`
- إضافة `PATCH /api/tasks/:id`
- تحويل `showTaskModal` لـ Modal
- إصلاح صفحة المهام
- إصلاح الأتعاب

---

## 🛠️ اللي اتعمل في هذه المحادثة (2026-11-13)

### 1. التشخيص
- اكتشفنا إن ملفات جهازك **متعدلة وبايظة** (styles.css كان 9,718 بدل 106,890).
- النسخة على Cloudflare Pages شغالة 100%.
- لا يمكن تحميل الكود المصدري من Cloudflare Pages (قيد المنصة).

### 2. سحب المرجع من السيرفر
- أنشأنا `C:\Users\hi\mowakkil-live-reference\live-ref\`.
- استخدمنا `Invoke-WebRequest` (PowerShell) لسحب 13 ملف.
- اتحملوا: `index.html`, `styles.css`, `design-system.css`, `landing.css`, `pricing.css`, `notifications.js`, `main.js`, `api.js`, `ui.js`, `drawer.js`, `router.js`, `search.js`, `service-worker.js`.

### 3. المقارنة
File                      Server    Local    Status
index.html                29550     28699    DIFF
assets\styles.css         106890    9718     DIFF (كارثي!)
assets\design-system.css  18247     5604     DIFF
assets\landing.css        8642      8437     DIFF
assets\pricing.css        10157     4325     DIFF
js\main.js                8712      8712     SAME
js\notifications.js       7415      5493     DIFF
js\api.js                 6457      6457     SAME
js\ui.js                  10422     10422    SAME
js\drawer.js              10915     10915    SAME
js\router.js              2065      2065     SAME
js\search.js              15095     15095    SAME
service-worker.js         2400      2424     DIFF

### 4. الرجوع من السيرفر
**اترجع 6 ملفات:**
- `assets/styles.css` (106,890)
- `assets/design-system.css` (18,247)
- `assets/landing.css` (8,642)
- `assets/pricing.css` (10,157)
- `index.html` (29,550)
- `js/notifications.js` (7,415)

**النتيجة:** الموقع شغال محلياً 100% مطابق للسيرفر.

### 5. إعداد Git
- سطّبنا Git: `winget install --id Git.Git`
- `git init` + `git add .` + `git commit -m "Stable version - matching production"`
- أضفنا `.gitignore` (يستبعد node_modules, .wrangler, dist, *.log, .env, web-before-restore-*, mowakkil-backup*)
- `git rm -r --cached node_modules` + commit
- مسحنا الملفات الغريبة: `web/({{}}))`, `web/\``, `web/el.remove()`, `web/modal.remove())`, `web/showInstallSheet())`, `web/{`
- `git commit -m "Clean up: remove stray files from web/"`

### 6. الباك أبس الموجودة
- `C:\Users\hi\mowakkil\web-before-restore-2026-11-13_09-52-16` (قبل الرجوع)
- `C:\Users\hi\mowakkil-backup-2026-10-30` (27 أكتوبر)
- `C:\Users\hi\mowakkil-live-reference\live-ref` (نسخة السيرفر)
- `C:\Users\hi\mowakkil-backup` (23 أكتوبر - قديم)
- `C:\Users\hi\mowakkil-backup-2026-10-26-ai` (26 أكتوبر)
- `C:\Users\hi\mowakkil-backup-final` (23 أكتوبر)
- `C:\Users\hi\mowakkil-backup-v2` (14 أكتوبر)
- `C:\Users\hi\mowakkil-backup-2026-11-06` (فاضي ❌)

---

## 🎯 الخطوات اللي لسه (التحسينات)

### 1. اللوجو الجديد في `index.html` (5 دقائق) 🔴 عاجل
**الملفات:** موجودة في `C:\Users\hi\mowakkil\web\assets\logos\`

**التعديلات المطلوبة في `index.html`:**

في `<head>`:
استبدل:
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96x96.png">
<link rel="shortcut icon" href="/assets/favicon.ico">

بـ:
<link rel="apple-touch-icon" href="/assets/logos/icon-192.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/logos/icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/assets/logos/icon-512.png">
<link rel="shortcut icon" href="/assets/logos/favicon.ico">

في الجسم:
استبدل:
<img src="/assets/logo.png">           <!-- اللاندينج + الهيدر -->
<img src="/assets/app-icon.png">       <!-- صفحة الدخول -->

بـ:
<img src="/assets/logos/logo-md.png">  <!-- الهيدر -->
<img src="/assets/logos/logo-lg.png">  <!-- صفحة الدخول -->

**بعد التعديل:**
- اختبر الموقع
- `git add . && git commit -m "Add new gold logo"`

### 2. الألوان الذهبية في `design-system.css` (2 دقائق) 🟡 مهم
**التعديل في `:root`:**
استبدل:
--brand-gold: #D97706;
--brand-gold-hover: #B45309;
--brand-gold-light: #FEF3C7;

بـ:
--brand-gold: #D4AF37;
--brand-gold-hover: #B8860B;
--brand-gold-light: #FDE047;

**بعد التعديل:**
- اختبر
- `git add . && git commit -m "Update gold color to match logo"`

### 3. إصلاحات الموبايل في `styles.css` (10 دقائق) 🟡 مهم
**إضافة في آخر `styles.css`:**

/* ==========================================================
   FIX PACK — Mobile Fixes
   ========================================================== */

@media (max-width: 768px) {
  /* إظهار زر القائمة */
  .menu-btn {
    display: flex !important;
    width: 40px;
    height: 40px;
  }
  
  /* البحث كأيقونة */
  .search-trigger {
    display: inline-flex !important;
    width: 40px !important;
    height: 40px !important;
    padding: 0 !important;
    justify-content: center;
    align-items: center;
    flex: 0 0 auto !important;
    max-width: none !important;
  }
  .search-trigger span,
  .search-trigger-kbd {
    display: none !important;
  }
  
  /* تابات الإعدادات أفقية */
  .settings-layout { display: block !important; }
  .settings-sidebar {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    position: static !important;
    padding: 8px !important;
    gap: 6px !important;
  }
  .settings-sidebar::-webkit-scrollbar { display: none; }
  .settings-tab {
    flex-shrink: 0 !important;
    white-space: nowrap;
    padding: 10px 14px !important;
    font-size: 13px !important;
  }
}

**بعد التعديل:**
- اختبر على الموبايل (F12 → Device Toolbar)
- `git add . && git commit -m "Add mobile fixes"`

### 4. تحسينات الإشعارات (15 دقيقة) 🟢 تحسين
- تحسين Dropdown (شكل احترافي + إغلاق عند الضغط برة)
- تحديث `notifications.js` + `styles.css`
- اختبار
- commit

### 5. النشر على Cloudflare
**بعد ما كل حاجة تمام:**
cd C:\Users\hi\mowakkil\web
npx wrangler pages deploy . --project-name=mowakkil-2026 --branch=production --commit-dirty=true

---

## 🚀 الأوامر المهمة

> ⚠️ **قديم:** المسارات هنا (`C:\Users\hi\...`) من الجهاز القديم. استخدم الأوامر الجديدة في «📘 الدليل الشامل» قسم ٣ آخر الملف.

### تشغيل محلي
cd C:\Users\hi\mowakkil\web
npx serve .
# → http://localhost:3000

### Git
cd C:\Users\hi\mowakkil
git status                      # حالة المشروع
git add .                       # إضافة التعديلات
git commit -m "وصف التعديل"     # حفظ
git reset --hard HEAD           # رجوع لآخر commit
git log --oneline               # سجل commits

### النشر (بعد التأكد)
cd C:\Users\hi\mowakkil\web
npx wrangler pages deploy . --project-name=mowakkil-2026 --branch=production --commit-dirty=true

### سحب ملفات من السيرفر (لو احتجت)
$baseUrl = "https://mowakkil-2026.pages.dev"
Invoke-WebRequest -Uri "$baseUrl/index.html" -OutFile ".\live-ref\index.html" -UseBasicParsing

### عرض Deployments على Cloudflare
cd C:\Users\hi\mowakkil
npx wrangler pages deployment list --project-name=mowakkil-2026

### معرفة حجم الملفات (مقارنة)
$local = "C:\Users\hi\mowakkil\web"
$live = "C:\Users\hi\mowakkil-live-reference\live-ref"
$files = @("index.html", "assets\styles.css", "assets\design-system.css", "js\notifications.js")
foreach ($f in $files) {
    $s = if (Test-Path "$live\$f") { (Get-Item "$live\$f").Length } else { 0 }
    $l = if (Test-Path "$local\$f") { (Get-Item "$local\$f").Length } else { 0 }
    Write-Host ("{0,-30} {1,10} {2,10}" -f $f, $s, $l)
}

---

## ⚠️ ملاحظات حرجة

### Service Worker Cache (اتحل 2026-11-23 — مفيش تغيير يدوي تاني)
- ~~كل تعديل يحتاج تغيير `CACHE_NAME`~~ → الكود (html/js/css) دايماً من الشبكة الأول، والكاش للأوفلاين بس. التعديلات بتوصل أول ما تنشر.
- مدد الكاش لكل نوع ملف في `web/_headers`.

### Git Safety
- أي تعديل: عدل → اختبر → `git commit` → لو تمام كمل.
- لو مشكلة: `git reset --hard HEAD` يرجع لآخر حالة مستقرة.
- **دايماً اختبر محلياً قبل النشر.**

### Production
- **النسخة الحالية على Cloudflare شغالة 100% ومطابقة لجهازك.**
- أي deploy جديد هيلغي الـ Rollback — لازم تتأكد قبل النشر.

### الملفات الكبيرة في Git
- `node_modules` مش في Git (بسبب `.gitignore`).
- `web-before-restore-*` و `mowakkil-backup*` مش في Git.

### بيئة التشغيل
- Windows 10 (19045.6466)
- PowerShell 5.1
- Node.js (عبر npx)
- Git (متسطب حديثاً)
- Python 3.14 (لـ rembg/generate-logos.py)
- Wrangler 4.152.0

---

## 🎯 نقطة الاستكمال (لو المحادثة اتقفلت)

**ابعت الجملة دي في محادثة جديدة:**

> "أنا بكمّل تحسينات مشروع مُوكِّل. المشروع في `C:\Users\hi\mowakkil`. اقرأ الملف `C:\Users\hi\mowakkil\PROGRESS-COMPLETE.md` عشان تفهم كل حاجة. عايز أبدأ بالخطوة [اللوجو/الألوان/الموبايل/الإشعارات]."

**وبعد ما تقرأ الملف، هنكمل من حيث وقفنا.**

---
---

## 🔄 تحديثات جلسة 2026-11-13 (ما بعد السجل الأول)

### ✅ اللي اتعمل في الجلسة دي
1. **تنضيف CSS**: عملنا `styles.clean.css` (من 106 كيلو لـ 74 كيلو) وشلنا الملفات الغريبة.
2. **اللوجو الجديد**: اتحط في كل الصفحات (`logos/logo-md.png` و `logo-lg.png`).
3. **الهوية البصرية الجديدة**: عملنا `brand-theme.css` (كحلي `#0F172A` + ذهبي `#D4AF37`) وطبقناه في كل الصفحات.
4. **القضاء على البنفسجي**: استبدلنا كل أكواد `#6366F1`, `#4F46E5`, `#8B5CF6` بالذهبي/الكحلي.
5. **إصلاح الأزرار**: بقت كحلي مع حدود ذهبية، والنصوص أبيض واضحة (زي أزرار الإجراءات السريعة والتفاصيل).
6. **إصلاح الاسم العربي**: عدلنا `getCurrentUser` في `api.js` عشان يستخدم `TextDecoder` (UTF-8) بدل `atob` العادي. الاسم "محمد نجدي" ظهر صح.
7. **إصلاح القائمة الجانبية**: المربعات اللي كانت فوق "مسؤول المكتب" اختفت.
8. **Git**: كل التعديلات دي معمولها commit.

### 📂 الملفات المهمة اللي اتعدلت
- `web/assets/brand-theme.css` ⭐ (جديد - الهوية الكاملة).
- `web/assets/styles.clean.css` (جديد - نسخة نظيفة).
- `web/js/api.js` (معدل - `getCurrentUser` لـ UTF-8).
- `web/index.html` (معدل - اللوجو الجديد + `brand-theme.css`).
- `web/pricing.html`, `signup.html`, `pay.html`, `client/index.html` (كلهم محدثين).

### ⏳ المهام القادمة (اللي لسه)
1. **اختبار شامل**: `/pricing`, `/signup`, `/pay`, `/client`.
2. **النشر على Cloudflare**:
   ```powershell
   cd C:\Users\hi\mowakkil\web
   npx wrangler pages deploy . --project-name=mowakkil-2026 --branch=production --commit-dirty=true
## 🔄 تحديثات جلسة 2026-11-22 — إصلاح التخزين الخارجي (Backblaze B2)

### المشكلة
- الرفع كان بيفشل (500) لأن `@aws-sdk/client-s3` مش مناسب لـ Worker + B2.
- رابط التحميل في القضايا والمهام كان نسبي (`/api/documents/ID/download`) وبدون Authorization، فكان بيفشل حتى لو الملف اترفع.

### الحل (اتنفذ واشتغل: الرفع والتحميل من القضايا)
- استبدلنا AWS SDK بـ `aws4fetch` (توقيع SigV4 + fetch عادي).
- الـ Worker وسيط مصادقة: يتحقق من JWT والمكتب والحجم والنوع، يرفع/يجيب/يمسح من B2، ويكتب الصف في D1.

### الملفات اللي اتعدلت
| الملف | التعديل |
|-------|---------|
| `worker/lib/b2.js` | جديد: `b2Put` / `b2Get` / `b2Delete` (بيتحقق من شكل `B2_ENDPOINT`، والـ bucket من `B2_BUCKET` أو `mowakkil`) |
| `worker/routes/documents.js` | اتعاد كتابته بالدوال دي، ولو فشل INSERT في D1 بيتمسح الملف من B2، والتحميل بـ `filename*=UTF-8''` |
| `web/js/api.js` | إضافة `downloadDocument(id, name)` (fetch على `API_BASE` مع Bearer ثم blob) |
| `web/js/views/cases.js` | استيراد `downloadDocument` + زر `data-dl` بدل الرابط + handler |
| `web/js/views/tasks.js` | نفس تعديل cases.js |
| `package.json` | إزالة `@aws-sdk/client-s3` و `@aws-sdk/s3-request-presigner` و `@aws-sdk/xml-builder` و `sigv4-lite` (و `aws4fetch` فضلت) |
| `wrangler.toml` | حذف بلوك `[alias]` الخاص بـ xml-builder |

### عقد الـ API
- `POST /api/documents?case_id=&task_id=&doc_type=&file_name=` بجسم الملف خام (مش FormData) و `Content-Type` للملف.
- الامتدادات المسموحة: pdf, doc, docx, jpg, jpeg, png, txt. الحد 10 ميجا.
- `GET /api/documents/:id/download` يحتاج Bearer ويتحقق من `office_id`.
- `DELETE /api/documents/:id` يمسح من B2 ويعمل soft delete (`deleted_at`) في D1.
- عمود `r2_key` في جدول `documents` هو مفتاح الملف في B2 (الاسم مضلل بس مش لازم يتغير).

### الأسرار (Secrets)
- لازم `B2_ENDPOINT` + `B2_KEY_ID` + `B2_APP_KEY` (والـ `B2_BUCKET` اختياري).
- خطأ `InvalidAccessKeyId` ظهر لما الـ endpoint كان على region غلط، مش بسبب المفتاح. الـ endpoint لازم يطابق صفحة الباكت في Backblaze بالظبط.
- حفظ سر من PowerShell (من فولدر المشروع):
  ```powershell
  cd C:\Users\hi\mowakkil
  "القيمة" | npx wrangler secret put B2_ENDPOINT
  ```
- حفظ الأسرار بيتطبق فوراً من غير deploy، لكن تغيير الكود محتاج `npm run deploy` (للـ Worker) و`npm run deploy:web` (للواجهة).

### أوامر فحص الأخطاء
```powershell
cd C:\Users\hi\mowakkil
npx wrangler tail mowakkil-api --format pretty
```
- لازم تتشغل من فولدر المشروع، وإلا تطلع `Required Worker name missing`.
- في PowerShell مفيش `grep`؛ البديل:
  ```powershell
  Get-ChildItem worker,scripts,tests -Recurse -File | Select-String -Pattern "كلمة"
  ```

### الاختبارات
- `tests/documents.test.js` شغال (رفض أكبر من 10 ميجا، ورفض الامتدادات غير المسموحة).
- اقتراح لسه ما اتضافش: اختبارات لرفض الطلب من غير توكن (401)، الملف الفاضي (400)، وقضية مش تابعة للمكتب (400).
- اختبار الرفع الفعلي على B2 محتاج mock لـ `fetch`، واتأجل.

### ⚠️ أمان (مهم)
- مفتاح B2 اتكتب في محادثة قبل كده، لازم يتمسح من Backblaze (Application Keys) ويتعمل مفتاح جديد ويتحفظ بالأمر اللي فوق.
- ملف PROGRESS ده فيه بيانات دخول وأسرار نصية (باسوردات + SETUP_KEY). لا ترفعه على Repo عام ولا تبعته في محادثات، والأفضل تشيل البيانات الحساسة منه.

### ✅ حد المساحة لكل مكتب حسب الباقة (اتنفذ 2026-11-22، محتاج deploy واختبار)
- حدود التخزين كانت موجودة أصلاً في `LIMITS` داخل `worker/middleware/feature-gate.js` (`max_storage_mb`): free 100 / starter 1024 / pro 10240 / plus 51200 / lifetime_basic 500 / lifetime_pro 5000 (و`-1` = غير محدود).
- أضفنا `requireStorage(env, officeId, incomingBytes)` في نفس الملف: بتحسب `SUM(file_size)` للمستندات غير المحذوفة + حجم الملف الجديد بالبايت، ولو عدّت الحد بترجع 403 بكود `LIMIT_REACHED` و`limit_type: max_storage_mb`.
- `worker/routes/documents.js`: استدعاء `requireStorage` في `upload()` بعد فحص حجم الملف وقبل الرفع على B2.
- `web/js/api.js`: `uploadDocument` بيعرض `showLimitModal(err)` لما الرد 403 + `LIMIT_REACHED`.
- عرض الاستهلاك موجود أصلاً: `GET /api/subscription/usage` وصفحة "اشتراكي".
- ملاحظة: الحدود الفعلية (للتنفيذ) في الكود (`LIMITS`)، وجدول `plan_features` في D1 للعرض في صفحة التسعير فقط. أي تغيير في أرقام المساحة لازم يتعمل في الاتنين.
- لسه: deploy (`npm run deploy` و`npm run deploy:web`) وتجربة رفع على مكتب قريب من حده.

### ✅ إزالة الباقة المجانية + توزيع المساحة على 10 جيجا (2026-11-22)
- المساحة المتاحة حالياً: 10 جيجا مجانية على Backblaze (لحد ما يتم شراء مساحة أكتر).
- حدود المساحة الجديدة (ميجا): تجربة 15 يوم = 200 (بغض النظر عن الباقة)، starter 500، pro 2000، plus 5000، lifetime_basic 500، lifetime_pro 2000.
- سقف المنصة كلها `PLATFORM_STORAGE_CAP_MB` = 9500 (في feature-gate.js، ويتغير بمتغير بيئة بنفس الاسم في `[vars]` في wrangler.toml). لما تشتري مساحة أكتر ارفع الرقم ده والحدود.
- `requireStorage` بتفحص سقف المنصة أولاً (503 كود `PLATFORM_STORAGE_FULL`) ثم حد المكتب (403 كود `LIMIT_REACHED`).
- الباقة المجانية: اتشالت من `FEATURES`/`LIMITS`/`PLAN_NAMES`، وبقى فيه `FALLBACK_*` داخلي لأي اشتراك قديم باسم `free`. و`changePlan` بقت تحوّل كل التغييرات لصفحة الدفع.
- `plan_features`: الباقة free تتخفى (`is_active = 0`) والأرقام تتحدّث بـ `migrations/023_storage_limits_remove_free.sql`.
- صفحة التسعير و"اشتراكي": بقت بتعرض التخزين (كارت الباقة + جدول المقارنة + شريط الاستهلاك).
- ⚠️ لسه: فحص أي مكتب لسه `plan = 'free'` في `subscriptions` وتحديد مصيره، وفحص `signup.js` و`cron/trial-expiry.js` و`superadmin.js` و`payment-requests.js` من أي استخدام لكلمة `'free'`.
- ⚠️ أرقام الحدود موجودة في 3 أماكن (`LIMITS` في الكود، جدول `plan_features`، و`MOCK_PLANS` في pricing.js). لازم تتزامن، والأفضل مستقبلاً إن التنفيذ يقرأ من الجدول.

### 🎯 جملة الاستكمال (لو المحادثة اتقفلت)
> "أنا بكمّل مشروع مُوكِّل في `C:\Users\hi\mowakkil`. التخزين على Backblaze B2 شغال بـ aws4fetch. اقرأ ملف PROGRESS.md (آخر قسم: تحديثات 2026-11-22). عايز أختبر حد المساحة لكل باقة وأكمل التحسينات."

---

## 🔄 تحديثات 2026-11-23 — (اتنشر) — commit `6b4e13c`
**المشروع دلوقتي في:** `D:\Mohamed Walid\mowakkil` (Git بقى متسطب، ومفيش remote لسه).
**Worker version:** `9d93852c-06ea-4a12-92cf-a384c91d1de4` (الرجوع للسابقة: `ba0b2d65-7b3c-4ba0-9f1c-6513ad904dab` بـ `npx wrangler rollback`).

### الذكاء الاصطناعي (مجاني بالكامل)
- `worker/services/llm.js`: Groq gpt-oss-120b → Gemini 2.5 Flash → Groq Llama 3.3 → Workers AI. اتشال Claude (كان موديل متوقف + محتاج رصيد).
- `worker/services/legal-skills.js`: 22 مهارة قانونية لـ 32 نوع قضية (بتتحقن في التحليل). ⚠️ محتاجة مراجعة محامي للمواعيد المكتوب جنبها "(يُراجع)".
- تحليل القضية: `POST /api/cases/:id/analyze` بيقرا مرفقات القضية تلقائياً (`worker/services/doc-text.js` بـ AI.toMarkdown) + المهارة + المواد. زرار "🤖 تحليل ذكي" في القضايا.
- الشات بيحفظ المحادثات (`routes/chat.js` اتصلح)، حد يومي 150 طلب/مكتب (`AI_DAILY_LIMIT`).
- ⚠️ Vectorize `law-articles-m3` كان فاضي (0 vectors) → زرار "📚 فهرسة المواد القانونية" في لوحة السوبر أدمن. لازم يتداس مرة. وزرار "🩺 فحص النماذج" للتأكد من مفاتيح Groq/Gemini.
- ثغرات اتقفلت: generate-doc كان بيقرا قضية مكتب تاني، والشات كان بيسمح بإضافة رسايل لمحادثة مكتب تاني.

### المستندات
- 14 تصنيف (توكيل، صحيفة دعوى، حكم...) + تعديل + حذف (للأدمن أو اللي رفع) — `web/js/attachments.js`.
- التخزين في B2 مترتب: `office_X/cases/<id>/<نوع>/...`. تحميل الملفات القديمة المحفوظة في D1 اتصلح.

### التصدير
- اتشالت الأزرار العشوائية من كل الصفحات. `web/js/exporter.js` (Excel/Word/PDF بالعربي RTL) في: القضايا، الموكلين، المهام، الأتعاب، التقرير الشهري، التحليل الذكي، توليد المستندات.

### التصميم
- `web/assets/theme.css` بدل `brand-theme.css`. أيقونات خطية `web/js/icons.js` بتحوّل الإيموجي تلقائياً. `web/js/chart-theme.js` للرسوم. لوحة التحكم اتعملت من جديد. Sidebar ثابت على الكمبيوتر.

### تطبيق أندرويد (APK)
- `web/downloads/mowakkil.apk` (TWA, `com.mowakkil.app`, v1.0.0) + `web/.well-known/assetlinks.json`.
- زرار التثبيت: تثبيت أصلي → APK على أندرويد → خطوات آيفون.
- نسخة جديدة: `powershell -ExecutionPolicy Bypass -File android\build-apk.ps1 -Version 1.0.1`
- 🔐 `android/mowakkil-release.keystore` + `android/KEYSTORE-SECRETS.txt` مش في Git — **لازم نسخة احتياطية**.

### Migrations
- 023 كانت متطبقة. 024 (analyses.case_id) و025 (documents.extracted_text) و026 (documents.notes) اتطبقوا.

### النشر
- Worker: `npx wrangler deploy` — الويب: `npm run deploy:web` (اتصلح يروح لـ mowakkil-2026 / production).

---

## 🔄 تحديثات 2026-11-23 (الجزء التاني) — اتنشر — commits `195715c` → `73bf52c` → `fb72442` → (التثبيت)

### السرعة
- الشاشات بتتحمل عند الفتح بس (`registerView(name, () => import(...))` في `web/js/main.js` + `prefetchViews` في `router.js`).
- صورة تمثال العدالة: 856KB → 30KB (`web/assets/img/lady-justice.webp` + png احتياطي).
- Chart.js بقى `defer`، والخط الأساسي `preload`.
- اللاندنج: 100 طلب / 1.4MB → 33 طلب / 539KB، ومفيش إعادة تحميل.
- `GET /api/clients` بيرجع `account_status` لكل موكل (استعلام واحد بدل طلب لكل موكل).
- كاش 20 ثانية داخل الـ Worker لاستعلام المستخدم (`worker/lib/auth.js`) والاشتراك (`worker/middleware/subscription.js`). ⚠️ يعني تعطيل مستخدم/مكتب بياخد لحد 20 ثانية.

### الكاش التلقائي
- `web/service-worker.js` اتعاد كتابته: network-first للكود، stale-while-revalidate للصور والخطوط، مفيش `CACHE_NAME` يدوي ولا reload إجباري.
- `web/_headers`: no-cache للكود، كاش طويل للخطوط والصور.

### اللاندنج / الدخول / التسجيل
- `web/assets/landing.css` اتعاد بالكامل على توكنز `theme.css` (كحلي + ذهبي). `signup.html` بقى على `theme.css` + `landing.css`.
- تداخل اللاندنج والدخول اتحل: سكريبت في `<head>` بيحدد الشاشة قبل الرسم (`html[data-boot]`)، و`main.js` بيشيله أول ما يشتغل. `/#login` بيفتح الدخول مباشرة.

### الموكلين + بوابة الموكل
- `web/js/api.js`: أي POST/PUT/PATCH/DELETE ناجح بيمسح كاش القراءة (قبل كده القوايم كانت بتفضل قديمة 10 ثواني في النظام كله).
- زرار "تعطيل الحساب" لأي موكل عنده حساب (حتى اللي داخل بالرابط بس)، والدعوة الملغية ليها حالة + زرار دعوة جديدة.
- البوابة بنفس هوية التطبيق (`web/client/assets/styles.css`)، أيقونات التطبيق، أرقام لاتينية، ومبقتش بتستخدم `brand-theme.css`.
- اتشال `/api/client-portal/test-hash` واللوجز اللي كانت بتكتب جزء من بصمة الباسورد.
- اتمسحت ملفات زيادة من `web/client` (txt فاضية + نسخة قديمة من portal.js).

### تثبيت بوابة الموكل كتطبيق
- `web/client/manifest.webmanifest` جديد (اسم "بوابة الموكل"، `start_url` و`scope` = `/client/`) → بيتثبت تطبيق مستقل مش اختصار، ومش بيفتح تطبيق المحامي.
- زرار "تثبيت التطبيق" بأيقونة تنزيل: نافذة التثبيت الأصلية (Chrome/Edge/Samsung) وإلا خطوات حسب الجهاز.
- آيفون: التطبيق المتثبت ليه تخزين منفصل عن Safari → لو الموكل داخل بالرابط بس، بتظهر له ملاحظة يعمل باسورد الأول.
- اتأكدنا بـ Chrome: مفيش installability errors.

### الاختبار المحلي (من غير ما نلمس البيانات الحقيقية)
- قاعدة محلية بهيكل الإنتاج بس: `npx wrangler d1 export mowakkil-db-v2 --remote --no-data --output schema.sql` ثم `npx wrangler d1 execute mowakkil-db-v2 --local --file schema.sql`.
- تشغيل: `npx wrangler dev --local --port 8787 --var JWT_SECRET:<أي قيمة>` + `npx serve web -l 3000`. الواجهة والبوابة بيكلموا `localhost:8787` تلقائياً على localhost.

### ⚠️ لسه مفتوح
- مفيش Git remote — لازم repo **خاص** قبل الرفع (الملف ده فيه باسوردات).
- رابط دعوة الموكل = دخول دائم من غير باسورد (الكود ملوش انتهاء). التعطيل بقى بيقفله.
- `styles.css` و`styles.clean.css` متكررين (لسه الاتنين محملين).

---

# 📘 الدليل الشامل — 2026-11-23

> الدليل ده مكتوب عشان ترجعله في أي وقت من غير ما تفتكر حاجة.
> كل أمر هنا جاهز تنسخه وتلصقه في **PowerShell** زي ما هو.

## ١) ملخص اليوم في سطور

| الموضوع | اتعمل إيه | الحالة |
|---|---|---|
| بطء النظام | الشاشات بقت بتتحمل وقت الفتح بس، وصورة الصفحة الرئيسية اتصغّرت، وصفحة الموكلين بقت طلب واحد | ✅ منشور |
| الكاش | مبقاش فيه تغيير يدوي لـ `CACHE_NAME` خالص. أي تعديل بيوصل للناس أول ما تنشر | ✅ منشور |
| الصفحة الرئيسية + الدخول + التسجيل | اتعملوا من جديد بنفس ألوان التطبيق (كحلي + ذهبي)، ومبقوش بيظهروا فوق بعض | ✅ منشور |
| الموكلين | القوايم بتتحدث فوراً بعد أي تعديل، وفيه زرار «تعطيل الحساب» لأي موكل | ✅ منشور |
| بوابة الموكل | نفس شكل التطبيق، وبتتثبت كـ **تطبيق مستقل** اسمه «بوابة الموكل» | ✅ منشور |
| الأمان | اتقفل رابط تجريبي كان مفتوح، والإيميلات الحقيقية اتشالت من خانات الدخول | ✅ منشور |
| GitHub | المشروع اترفع على repo خاص بعد تنضيف كل الباسوردات والرموز والبيانات من التاريخ | ✅ مرفوع |

## ٢) الأماكن المهمة (احفظها)

| إيه | فين |
|---|---|
| المشروع على جهازك | `D:\Mohamed Walid\mowakkil` |
| الموقع الحي | https://mowakkil-2026.pages.dev |
| بوابة الموكل | https://mowakkil-2026.pages.dev/client/ |
| الـ API (الـ Worker) | https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev |
| الكود على GitHub (خاص) | https://github.com/mohamedwalidabdelfattah-cyber/mowakkil |
| الباسوردات والبيانات الحساسة | `PROGRESS.secrets.md` في فولدر المشروع (على جهازك بس، مش على GitHub) |
| ملفات تطبيق أندرويد | فولدر `android\` + `web\downloads\mowakkil.apk` |
| نسخة احتياطية من ملفات أندرويد ومفتاح التوقيع | `backups\mowakkil-android-backup-2026-11-23.zip` (على جهازك بس) |

## ٣) الأوامر اليومية (انسخ والصق)

> ⚠️ على جهازك git مش متسجّل في PowerShell، فلازم نكتب مساره كامل: `& "C:\Program Files\Git\cmd\git.exe"`.
> نفس الكلام لـ wrangler: `& "$env:APPDATA\npm\wrangler.cmd"`.

**ادخل فولدر المشروع (أول حاجة دايماً):**
```powershell
cd "D:\Mohamed Walid\mowakkil"
```

**شوف إيه اللي اتغير:**
```powershell
& "C:\Program Files\Git\cmd\git.exe" -c safe.directory=* status
```

**احفظ التعديلات (commit):**
```powershell
& "C:\Program Files\Git\cmd\git.exe" -c safe.directory=* add -A
& "C:\Program Files\Git\cmd\git.exe" -c safe.directory=* commit -m "وصف التعديل"
```

**ارفع على GitHub:**
```powershell
& "C:\Program Files\Git\cmd\git.exe" -c safe.directory=* push
```
- أول مرة بتطلع نافذة تسجيل دخول GitHub. سجّل وارجع، والرفع بيكمل لوحده.
- لو GitHub رفض الرفع وقال `Push cannot contain secrets`: ده معناه إن فيه باسورد أو رمز مكتوب في ملف. **متدوسش على رابط "allow"**. شيل الرمز من الملف الأول (الموضوع متشرح في قسم ٦).

**انشر الـ API (الـ Worker) — بعد أي تعديل في فولدر `worker\`:**
```powershell
& "$env:APPDATA\npm\wrangler.cmd" deploy
```

**انشر الموقع — بعد أي تعديل في فولدر `web\`:**
```powershell
& "$env:APPDATA\npm\wrangler.cmd" pages deploy web --project-name=mowakkil-2026 --branch=production --commit-dirty=true
```
- لازم `--branch=production` بالظبط، وإلا هيتنشر نسخة تجريبية مش الموقع الحقيقي.
- مش محتاج تغيّر أي رقم كاش. التعديل بيوصل للناس على طول.

**الترتيب الصح لأي تعديل:** عدّل → جرّب محلياً (قسم ٤) → انشر → commit → push.

## ٤) التجربة على جهازك من غير ما تلمس البيانات الحقيقية

الفكرة: بنشغّل نسخة من السيرفر على جهازك بقاعدة بيانات فاضية ليها نفس الشكل، فأي حاجة تجربها مبتأثرش على المكاتب الحقيقية.

**مرة واحدة بس — جهّز قاعدة البيانات المحلية (بنسحب الشكل من غير أي بيانات):**
```powershell
cd "D:\Mohamed Walid\mowakkil"
& "$env:APPDATA\npm\wrangler.cmd" d1 export mowakkil-db-v2 --remote --no-data --output schema-local.sql
& "$env:APPDATA\npm\wrangler.cmd" d1 execute mowakkil-db-v2 --local --file schema-local.sql -y
```

**كل مرة تجرب — افتح نافذتين PowerShell:**

النافذة الأولى (السيرفر):
```powershell
cd "D:\Mohamed Walid\mowakkil"; & "$env:APPDATA\npm\wrangler.cmd" dev --local --port 8787 --var "JWT_SECRET:local-test-only"
```

النافذة التانية (الموقع):
```powershell
cd "D:\Mohamed Walid\mowakkil"; npx serve web -l 3000
```

بعدها افتح http://localhost:3000. الموقع وبوابة الموكل بيكلموا السيرفر المحلي لوحدهم لما يتفتحوا من localhost، والسيرفر المحلي على 8787. اعمل حساب تجريبي من صفحة التسجيل وجرّب براحتك.

## ٥) تطبيق أندرويد (APK) — كل حاجة عنه

### إزاي شغال
- التطبيق نوعه **TWA**: بيفتح الموقع الحقيقي جوه تطبيق أندرويد. اسم الحزمة `com.mowakkil.app`.
- **أي تعديل في الموقع بيظهر في التطبيق لوحده.** مش محتاج تبني APK جديد، إلا لو غيّرت اسم التطبيق أو الأيقونة أو الألوان أو إعدادات أندرويد.
- زرار «ثبّت التطبيق» في موقع المحامي بيشتغل كده: لو المتصفح بيدعم التثبيت بيثبّت على طول، وعلى أندرويد بينزّل الـ APK، وعلى آيفون بيعرض خطوات.
- **بوابة الموكل حاجة منفصلة:** مش بتستخدم الـ APK. بتتثبت كتطبيق ويب اسمه «بوابة الموكل» من زرار «تثبيت التطبيق» جواها.

### الملفات ومعناها

| الملف | ده إيه | على GitHub؟ |
|---|---|---|
| `web\downloads\mowakkil.apk` | التطبيق اللي الناس بتنزّله من الموقع | ✅ أيوه |
| `web\.well-known\assetlinks.json` | بيثبت لأندرويد إن التطبيق تبع الموقع (عشان ميظهرش شريط العنوان) | ✅ أيوه |
| `android\twa-manifest.json` + `build.gradle` + … | إعدادات بناء التطبيق | ✅ أيوه |
| `android\build-apk.ps1` | سكريبت بيبني نسخة جديدة بأمر واحد | ✅ أيوه |
| `android\mowakkil-release.keystore` | 🔐 **مفتاح التوقيع** | ❌ لا (سري) |
| `android\KEYSTORE-SECRETS.txt` | 🔐 باسورد مفتاح التوقيع | ❌ لا (سري) |

### ⚠️ أهم حاجة: مفتاح التوقيع
- الـ keystore هو «بصمة» التطبيق. **لو ضاع، مش هتقدر تعمل تحديث للتطبيق أبداً**، وكل اللي نزّلوه هيضطروا يمسحوه وينزّلوا تطبيق جديد. ولو رفعته بعدين على Google Play، المفتاح ده لازم يفضل معاك.
- الملفين دول **مش على GitHub** عن قصد، لأنهم سريين.
- النسخة الاحتياطية في: `backups\mowakkil-android-backup-2026-11-23.zip`
- **احفظ نسخة من الملف ده في مكانين برّه الجهاز**: فلاشة + Google Drive أو إيميل لنفسك. لو الهارد باظ ومفيش نسخة برّه، المفتاح هيضيع.

### بناء نسخة جديدة من التطبيق (لما تغيّر الاسم/الأيقونة/الألوان)
```powershell
cd "D:\Mohamed Walid\mowakkil"
powershell -ExecutionPolicy Bypass -File android\build-apk.ps1 -Version 1.0.1
```
- غيّر `1.0.1` لرقم أكبر من اللي قبله في كل مرة.
- السكريبت بيحط النسخة الجديدة في `web\downloads\mowakkil.apk`. بعدها **انشر الموقع** (قسم ٣) عشان الناس تنزّلها.
- محتاج يكون Java 17 و Android SDK متسطبين، وهما متسطبين على جهازك دلوقتي.
- لو الجهاز اتغيّر: فك ضغط ملف النسخة الاحتياطية وحط `mowakkil-release.keystore` و `KEYSTORE-SECRETS.txt` في فولدر `android\` قبل البناء.

## ٦) الأمان — اللي حصل بالتفصيل

### إيه اللي اكتشفناه قبل الرفع على GitHub
git بيحفظ **كل نسخة قديمة** من المشروع، مش آخر نسخة بس. ولقينا في النسخ القديمة:
1. **9 نسخ كاملة من قاعدة البيانات** (`backup-*.sql`) فيها بيانات المكاتب والموكلين.
2. **باسوردات مكتوبة نص عادي**: حساب المحامي، والسوبر أدمن، والحساب التجريبي، والـ SETUP_KEY (في PROGRESS.md وسكريبتات الفحص).
3. **رمز دخول (token)** في `token.txt`.
4. **رمزين API لحساب Cloudflare** مكتوبين جوه `import-to-d1.mjs` و `seed-vectorize.mjs`. دول GitHub نفسه هو اللي مسكهم ورفض الرفع.
5. فولدر `node_modules` كان اترفع بالغلط، ونسختين قديمتين من الموقع.
6. الموقع الحي كان بيعرض إيميل المحامي وإيميل السوبر أدمن الحقيقيين كمثال جوه خانات الدخول.

### اللي اتعمل
- اتاخدت نسخة احتياطية كاملة من التاريخ القديم الأول: `history-backup-2026-11-23.bundle` (في فولدر المشروع، ومش على GitHub).
- الملفات الحساسة **اتشالت من كل النسخ القديمة** (اتعمل «تنضيف للتاريخ»)، وفضلت على جهازك زي ما هي.
- الباسوردات اتنقلت لملف `PROGRESS.secrets.md` على جهازك بس.
- السكريبتين بقوا يقروا رمز Cloudflare من متغير، مش مكتوب في الملف.
- ملف `.gitignore` اتحدّث عشان الملفات دي متترفعش تاني أبداً.
- فحص كل النسخ بعد التنضيف: صفر باسوردات وصفر رموز. وحجم المشروع نزل من 158 ميجا لـ 50 ميجا.
- خانات الدخول في الموقع بقت بتعرض أمثلة عامة.

### استخدام سكريبتات Cloudflare من غير ما تكتب الرمز في الملف
```powershell
$env:CLOUDFLARE_API_TOKEN = "حط الرمز الجديد هنا"
node seed-vectorize.mjs
```
الرمز بيفضل في النافذة دي بس، ولما تقفلها بيروح.

### قواعد علشان المشكلة دي متتكررش
- **متكتبش أي باسورد أو رمز جوه ملف كود أبداً.** استخدم `$env:...` زي اللي فوق، أو `wrangler secret put`.
- **متبعتش رموز أو باسوردات في أي محادثة** (ولا مع Claude ولا غيره).
- النسخ الاحتياطية لقاعدة البيانات (`backup-*.sql`) تفضل على جهازك أو Drive خاص، **مش في git**.
- لو GitHub رفض الرفع بسبب secrets: **شيل الرمز والغيه**، متدوسش «allow».

## ٧) ✅ قائمة المهام اللي عليك (علّم عليها لما تخلص)

- [ ] **الغي رمزين Cloudflare القدام:** ادخل https://dash.cloudflare.com/profile/api-tokens وامسح أي رمز قديم مش مستخدم، خصوصاً اللي ليه صلاحية D1 أو Workers AI. لو محتاج رمز للسكريبتات، اعمل واحد جديد.
- [ ] **غيّر باسورد المحامي** من داخل النظام. الحالي ضعيف جداً وكان مكشوف.
- [ ] **غيّر باسورد السوبر أدمن.**
- [ ] بعد ما تغيّرهم، حدّث `PROGRESS.secrets.md` بالجديد، أو امسح الباسوردات منه خالص واحفظها في مدير باسوردات.
- [ ] **احفظ `backups\mowakkil-android-backup-2026-11-23.zip` في مكانين برّه الجهاز** (فلاشة + Drive).
- [ ] لما تتأكد إن كل حاجة تمام على GitHub، **امسح** `history-backup-2026-11-23.bundle`، لأنه لسه فيه البيانات والرموز القديمة.
- [ ] جرّب من موبايل أندرويد حقيقي: ابعت دعوة لموكل، افتح الرابط، ودوس «تثبيت التطبيق».
- [ ] لسه ماتعملش: دوس «📚 فهرسة المواد القانونية» من لوحة السوبر أدمن (مرة واحدة)، وتأكد من مفاتيح Groq/Gemini بزرار «🩺 فحص النماذج».

## ٧.٥) مفاتيح الذكاء الاصطناعي + التبديل التلقائي للنماذج

### ليه عملنا كده
النماذج المجانية بتتغير. مثال حصل فعلاً: Google قفل `gemini-2.5-flash` للحسابات الجديدة، فالنظام كان هيقع لو اسم النموذج ثابت في الكود.

### إزاي شغال دلوقتي (`worker/services/model-discovery.js`)
1. **كل يوم الساعة 3 الفجر** السيرفر بيسأل Groq و Gemini و OpenRouter عن النماذج المتاحة.
2. **بيجرّب كل نموذج بسؤال صغير** ويحتفظ باللي بيرد بس. ده مهم، لأن Google بيعرض في قايمته نماذج مقفولة.
3. **أثناء الاستخدام:** لو نموذج رجّع «مش متاح»، بيتشال فوراً وبنروح للي بعده. **العميل مش بيحس بحاجة.**
4. **الترتيب:** Groq ← Gemini ← Groq (التاني) ← Gemini (التاني) ← OpenRouter المجاني ← ذكاء Cloudflare (من غير مفتاح، آخر حل).
5. تقدر تشوف النماذج الشغالة حالياً من لوحة السوبر أدمن ← «🩺 فحص النماذج». الزرار ده كمان بيعمل اكتشاف جديد على طول.

### المفاتيح بتتعمل مرة واحدة بس (مش بتتغير)
**ملاحظة مهمة:** السكريبت **بياخد المفتاح من الحافظة لوحده**. يعني: انسخ المفتاح الأول بزرار Copy، وبعدين شغّل الأمر **من غير ما تنسخ أي حاجة تانية في النص**. اكتب الأمر بإيدك أو استخدم زرار التشغيل.

| المزود | منين | الأمر |
|---|---|---|
| Gemini (أهم واحد) | https://aistudio.google.com/apikey ← Create API key (بيبدأ بـ `AIza`) | `powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 -Provider gemini` |
| Groq (لو اتفتح عندك) | https://console.groq.com/keys ← Create API Key (بيبدأ بـ `gsk_`) | `powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 -Provider groq` |
| Tavily (بحث النت) | https://app.tavily.com (بيبدأ بـ `tvly-`) | `powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 -Provider tavily` |
| OpenRouter (احتياطي، اختياري) | https://openrouter.ai/settings/keys | `powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 -Provider openrouter` |

**الطريقة المضمونة (اللي نجحت مع Tavily):**
1. انسخ المفتاح من موقع المزود (أيقونة 📋)، والصقه في **Notepad** وتأكد إنه سطر واحد بيبدأ بالبداية الصح.
2. حدده من Notepad واعمل Ctrl+C.
3. **على طول** شغّل الأمر في PowerShell. اكتبه بإيدك أو دوس زرار التشغيل، **متنسخوش**، عشان النسخة متمسحش المفتاح من الحافظة.
4. لو السكريبت قال «مالقيتش مفتاح في الحافظة» هيطلب منك تلصقه في خانة مخفية (مش هيظهر وانت بتلصقه، وده طبيعي).
5. متنسخش رسالة PowerShell بعدها وانت لسه محتاج المفتاح. النسخة الجديدة بتمسح القديمة.

**الحالة (2026-11-23):** Gemini ✅ اتحفظ — Tavily ✅ اتحفظ — OpenRouter ✅ اتحفظ (النماذج المجانية `:free` بس، حوالي 50 طلب/يوم) — Groq ⏳ (الموقع مكانش بيعمل مفتاح، ومش ضروري).

- شغّل الأوامر من فولدر المشروع: `cd "D:\Mohamed Walid\mowakkil"`.
- السكريبت بيجرّب المفتاح الأول، ولو اشتغل بيحفظه في Cloudflare. المفتاح **مش بيتكتب في أي ملف**.
- **متبعتش المفتاح في أي شات.** لو حصل، امسحه من موقع المزود واعمل واحد جديد.
- مفيش أي سكريبت بيدخل بإيميلك وباسوردك. ده ممنوع عند Google وممكن يقفل حسابك، ومش محتاجه لأن المفاتيح مش بتنتهي.

## ٧.٦) خصوصية الذكاء الاصطناعي + مراجعة الأسانيد (الأسبوع الأول من خارطة الطريق)

### ليه
دراسة المنافسين (ملف «مُوكِّل - دراسة المنافسين.md» على الديسكتوب) طلّعت إن أكبر خطر عندنا كان إن مستندات الموكلين بتروح لـ Gemini المجاني، وشروطه بتسمح لجوجل تستخدم البيانات. ومهلة قانون حماية البيانات المصري 151/2020 خلصت تقريباً، حوالين نوفمبر 2026.

### إزاي شغال
- **إعداد لكل مكتب** (الإعدادات ← 🔒 الخصوصية، والمسؤول بس هو اللي يغيّره):
  - 🔒 **سري:** مستندات الموكلين بتروح لـ Cloudflare بس (مش بيتدرب على البيانات). الحصة المجانية اليومية محدودة، والتحليل أبطأ (حوالي دقيقة).
  - ⚖️ **متوازن:** الأسماء المعروفة والرقم القومي والتليفونات والإيميلات بتتخفي قبل الإرسال وبترجع في الرد، وبعدين النص بيروح لـ Gemini.
  - ⛔ **إيقاف:** مفيش ذكاء اصطناعي على بيانات الموكلين.
- **موافقة مسؤول المكتب:** أول مرة حد يستخدم التحليل أو الشات بملف أو توليد المستندات، بتطلع نافذة يختار فيها المستوى ويوافق. الموافقة بتتسجل في سجل النشاط.
- **OpenRouter مستبعد دايماً** لأي بيانات موكلين. بيتستخدم بس للأسئلة القانونية العامة.
- **مراجعة الأسانيد آلياً:** أي «المادة X من قانون Y» في رد الذكاء الاصطناعي بتتراجع على قاعدة المواد:
  - ✓ متحقق
  - ⚠️ غير متحقق (المادة مش في القاعدة)
  - ℹ️ القانون مش في القاعدة
  
  قاعدة المواد مش كاملة لكل القوانين، فـ«غير متحقق» معناها «راجعها»، مش بالضرورة «غلط».

### الملفات
- `worker/lib/redact.js`: الإخفاء والإرجاع.
- `worker/lib/ai-privacy.js`: الإعداد والموافقة.
- `worker/lib/citations.js`: مراجعة الأسانيد.
- `worker/services/llm.js`: التوجيه حسب الوضع.
- `web/js/ai-privacy.js`: نافذة الموافقة وتاب الخصوصية.
- `migrations/027_ai_privacy.sql`: أعمدة الإعداد.

### حدود لازم تعرفها
- الإخفاء بيغطي الأسماء اللي النظام يعرفها (الموكل والخصم) والأرقام. أي اسم تاني مكتوب جوه المستند (شاهد مثلاً) والعناوين ممكن تعدّي في الوضع المتوازن. عشان كده الوضع السري موجود.
- اتجرب محلياً: موافقة، تحليل في الوضع السري على Cloudflare الحقيقي، إخفاء 3 بيانات، رجوع الأسماء، ومراجعة الأسانيد (مادة وهمية 9999 اتعلّم عليها صح).

## ٧.٧) نظام الصلاحيات (متربط بالباقات)

### الأدوار الجاهزة
| الدور | يقدر يعمل إيه |
|---|---|
| 👑 مالك المكتب (`admin`) | كل حاجة، بما فيها الفريق والاشتراك |
| 🤝 شريك (`partner`) | كل حاجة ماعدا الفريق والاشتراك |
| ⚖️ محامي (`lawyer`) | القضايا والموكلين (من غير حذف) والجلسات والمهام والمستندات والذكاء الاصطناعي ودعوات البوابة. من غير الحسابات |
| 📋 سكرتير (`secretary`) | الموكلين والجلسات والمهام ورفع المستندات. من غير الحسابات ولا الحذف ولا الذكاء الاصطناعي |
| 💰 محاسب (`accountant`) | الأتعاب والفواتير والمصروفات والمحاسبة والتقارير. القضايا والموكلين عرض بس |
| 🎓 متدرب (`trainee`) | القضايا المكلّف بيها بس: عرض، وتسجيل نتيجة الجلسة، وتحديث المهام |

### الربط بالباقات
- **الأساسية:** المالك والمحامي والسكرتير بس.
- **الاحترافية:** الـ 6 أدوار، وكمان «المكلّف بيها بس» لأي عضو.
- **المتقدمة:** كل ده، وكمان **أدوار مخصصة** المالك يحدد صلاحياتها واحدة واحدة. الفريق والاشتراك ممنوعين على أي دور مخصص.
- لو الباقة نزلت، الدور اللي مبقاش متاح بيشتغل بصلاحيات «محامي» لحد ما المالك يغيّره.

### إزاي شغال
- **في السيرفر** (`worker/lib/permissions.js`): كل طلب API ليه صلاحية مطلوبة (قسم + إجراء)، ولو مش مسموح بيرجع 403 بكود `PERMISSION_DENIED`. ودي الحماية الحقيقية.
- **«المكلّف بيها بس»:** جدول `case_members` (فريق كل قضية). بيفلتر القضايا والأجندة والمهام ولوحة التحكم، وأي طلب على قضية تانية بيرجع 404. اللي بينشئ قضية بيتضاف لفريقها تلقائياً.
- **الفلوس:** اللي مش معاه «الأتعاب» مش بيشوف أرقام مالية، لا في ملف القضية ولا في لوحة التحكم ولا في الأجندة.
- **في الواجهة** (`web/js/access.js`): القايمة والأزرار بتتخفى حسب الصلاحيات، والشاشات الممنوعة بتطلع «مش متاح لدورك».
- **شاشة «الفريق والصلاحيات»** (للمالك):
  - إضافة عضو بالإيميل أو الموبايل.
  - تغيير الدور والنطاق، وإيقاف عضو، وتغيير كلمة سر عضو.
  - جدول بصلاحيات كل دور.
  - الأدوار المخصصة.
- **«فريق القضية»** في تفاصيل كل قضية: مين مكلّف بيها.
- **حماية:** مينفعش تغيّر دورك أو توقف نفسك، ولازم يفضل مالك واحد على الأقل. وأي تغيير بيتسجل في سجل النشاط.
- **Migration:** `migrations/028_permissions.sql`.

### الاختبار
- 32 اختبار للمنطق.
- 23 اختبار على نظام محلي حقيقي:
  - مالك وسكرتير ومحاسب ومتدرب، كل واحد بحسابه.
  - المتدرب شاف قضيته بس، وماشافش الفلوس.
  - السكرتير اترفض في الحذف والحسابات والذكاء الاصطناعي.
- اختبار الأدوار المخصصة.

## ٧.٨) النظام كله بيشتغل من غير إنترنت

### إيه اللي بيشتغل من غير نت
- **كل الشاشات (13 شاشة):**
  - لوحة التحكم.
  - القضايا وتفاصيلها.
  - الموكلين وملفاتهم.
  - الأجندة.
  - المهام.
  - الأتعاب والتحصيل.
  - الإدارة المالية والفواتير والمصروفات.
  - المحاسبة.
  - المحامين.
  - التقارير.
  - الإعدادات.
  - الفريق.
  - الحاسبة.
- **التحميل المسبق على الجهاز (لما يكون فيه نت):**
  - الأجندة (شهرين ورا و4 شهور قدام) وكل القوايم، كل 15 دقيقة.
  - ملفات القضايا المفتوحة (لحد 200) والموكلين (لحد 300) والمهام المفتوحة، مرة في اليوم. ده عشان منتقلش على قاعدة البيانات.
  - كل الشاشات نفسها ومكتبات التقويم والرسوم والإكسيل، عشان أي شاشة تفتح حتى لو ما اتفتحتش قبل كده.
- **أي إضافة أو تعديل أو حذف من غير نت:** موكلين، وقضايا، وجلسات، ومهام، وأتعاب، ودفعات، وفواتير، ومصروفات، وقيود، ومستندات.
  - بيتحفظ في «صندوق صادر» على الجهاز، و**بيبان فوراً في القوايم**.
  - أول ما النت يرجع بيتبعت **لوحده وبالترتيب**، وبتطلع رسالة «اتبعت N عملية».
- **إضافات معتمدة على بعض:** مثلاً موكل جديد، وبعده قضية ليه، وبعدها جلسة وأتعاب على القضية دي، وكله من غير نت.
  - كل إضافة بتاخد رقم مؤقت (سالب).
  - وقت الإرسال الرقم المؤقت بيتبدّل بالرقم الحقيقي، فالقضية بتتربط بالموكل الصح.
- **رفع المستندات من غير نت:** الملف نفسه بيتحفظ على الجهاز، وبيترفع أول ما النت يرجع.
- **الأمان في المزامنة:**
  - لو عملية اترفضت (صلاحيات أو بيانات اتغيرت)، المستخدم بيعرف بالاسم.
  - لو السيرفر رفض عملية مؤقتاً، الباقي بيكمّل، واللي بيعتمد عليها بس هو اللي يستنى.
  - بعد 5 محاولات فاشلة العملية بتتشال عشان متوقفش الطابور.
- **شريط تحت الشاشة:** «📴 من غير إنترنت — شغّال على النسخة اللي على جهازك (آخر مزامنة …) · ⏳ N عملية».

### اللي محتاج نت بطبيعته
الذكاء الاصطناعي، والدفع والاشتراك، ودعوات بوابة الموكل، وإدارة الفريق. بتطلع رسالة واضحة: «العملية دي محتاجة إنترنت».

### حدود
- **البيانات على الجهاز** هي آخر نسخة اتحمّلت. لو حد في المكتب عدّل حاجة وانت من غير نت، مش هتشوفها لحد ما النت يرجع.
- **التعارض:** لو اتنين عدّلوا نفس الحاجة، آخر تعديل يوصل للسيرفر هو اللي بيكسب.
- **الفلاتر من غير نت:** لو الشاشة طلبت فلتر ما اتحفظش، بتطلع القايمة كاملة من غير فلتر.

### الملفات
- `web/js/offline.js`: التخزين على الجهاز (IndexedDB)، والتحميل المسبق، وصندوق الصادر بالأرقام المؤقتة، والمزامنة، والشريط.
- `web/js/api.js`: بيرجع للنسخة المحفوظة لما النت يقطع (أو السيرفر يقع)، وبيحط أي تعديل في صندوق الصادر، والرفع من غير نت.
- `web/service-worker.js`: بيخزن مكتبات التقويم والرسوم والإكسيل.
- `web/js/main.js`: بيحمّل كل الشاشات في الخلفية.
- البيانات دي على جهاز المستخدم بس، **وبتتمسح لما يعمل تسجيل خروج**.

### إصلاح قديم اتكشف أثناء الاختبار
عناوين المواعيد في الأجندة كانت بتظهر **فاضية**. السبب إن مكتبة التقويم بتقبل أنواع أحداث معيّنة بس (allday/time/task/milestone). اتصلح.

### الاختبار (متصفح حقيقي، كله نجح)
1. الـ 13 شاشة اتفتحوا من غير نت.
2. من غير نت: موكل جديد، وبعده قضية ليه، وبعدها جلسة وأتعاب عليها، ومستند، وتعديل قضية قديمة.
3. كل حاجة بانت فوراً في القوايم وملف القضية الجديدة.
4. الذكاء الاصطناعي طلّع رسالة «محتاجة إنترنت».
5. النت رجع:
   - القضية اتربطت بالرقم **الحقيقي** للموكل.
   - الجلسة والأتعاب اتسجلوا على القضية الحقيقية.
   - التعديل وصل، حتى والرفع فاشل قبله.
6. الرفع فضل مستني لأن النسخة المحلية مفيهاش مفاتيح التخزين السحابي، وده متوقع. على الموقع الحقيقي بيترفع عادي.

## ٧.٩) حفظ المستندات على كمبيوتر المكتب (اختياري)

### إزاي شغال
- **وقت رفع أي مستند** فيه اختيار:
  - ☁️ **السحابة:** زي الأول. بيبان على كل الأجهزة، وبيتحسب من مساحة الباقة، وحده الأقصى 10 ميجا.
  - 💻 **«الجهاز ده»:** الملف بيتحفظ في **فولدر حقيقي** على الكمبيوتر، ومتنظم لوحده: `قضية 1234-2026 / توكيل / الملف.pdf`.
- **ملفات الكمبيوتر:**
  - السيرفر بيحتفظ **ببيانات الملف بس** (الاسم والنوع والمكان)، والملف نفسه مش بيوصلنا.
  - **مش بتتحسب من مساحة الباقة**، وحدها الأقصى 200 ميجا.
  - جنب كل ملف علامة «☁️ سحابة» أو «💻 على كمبيوتر الاستقبال».
  - لو اتفتح من جهاز تاني بتطلع رسالة واضحة: «الملف ده متخزن على «كمبيوتر الاستقبال» — افتحه من الجهاز ده».
  - الحذف بيشيله من الفولدر كمان.
- **الإعدادات ← 💾 التخزين:**
  - المالك يختار المكان الافتراضي للمكتب.
  - كل جهاز يختار فولدره ويدّي نفسه اسم (مثلاً «كمبيوتر الاستقبال»).

### حدود لازم تعرفها
- شغال على **كروم أو إيدج على الكمبيوتر بس**. على الموبايل والمتصفحات التانية بيتحفظ على السحابة.
- الملف **بيبان على الجهاز اللي اتحفظ عليه بس**. مش هيبان في بوابة الموكل، والتحليل الذكي مش بيقدر يقراه (بيقول كده بوضوح).
- **النسخ الاحتياطي للفولدر ده مسؤولية المكتب**، ويُفضّل يكون جوه فولدر Google Drive أو OneDrive على الجهاز.
- المتصفح بيطلب إذن الوصول للفولدر أول مرة في كل جلسة.

### الملفات
- `web/js/device-storage.js`: الفولدر، والحفظ، والفتح، والحذف.
- `web/js/attachments.js`: الاختيار والعلامة.
- `worker/routes/documents.js`: `POST /api/documents/device`، وتحميل ملف كمبيوتر بيرجّع 409 بكود `DEVICE_FILE`.
- `migrations/029_device_storage.sql`.

### الاختبار
9 خطوات في متصفح حقيقي، كلها نجحت:
- الحفظ في الفولدر بالمسار المنظم.
- السيرفر سجّل البيانات بالاسم.
- العلامة ظهرت في القايمة.
- الفتح من نفس الجهاز اشتغل.
- رسالة «متخزن على» ظهرت من جهاز تاني.
- الحذف مسح الملف من الفولدر.

ملحوظة: نافذة اختيار الفولدر نفسها مش بتتأتمت، فالاختبار استخدم تخزين المتصفح الخاص، وليه نفس واجهة الفولدرات بالظبط.

## ٧.١٠) صفحة الباقات بنفس شكل النظام

- **المشكلة:** زرار «تسجيل الدخول» فوق كان كتابته غامقة على خلفية غامقة، فمش باين. وشكل الصفحة كان مختلف عن باقي الموقع.
- **الحل:**
  - الصفحة بقت بنفس ألوان النظام (كحلي + ذهبي) وبنفس الشريط اللي فوق في الصفحة الرئيسية.
  - زرار الدخول بقى أبيض على كحلي، و«ابدأ مجاناً» ذهبي.
  - كروت الباقات وجدول المقارنة والأسئلة متظبطين على نفس ألوان النظام. الباقة الأكثر شعبية ليها إطار ذهبي.
- **الملفات:** `web/pricing.html` و`web/assets/pricing.css`.
- **الاختبار:** كمبيوتر وموبايل. الكتابة واضحة، ومفيش حاجة طالعة برة الشاشة، ومفيش أخطاء.

## ٧.١١) رسايل واتساب الجاهزة (تذكير جلسة / أتعاب / تحديث قضية)

### بتشتغل إزاي
- تدوس الزرار، تفتح نافذة فيها رسالة جاهزة: اسم الموكل، ورقم القضية، والتاريخ، والمحكمة، أو المبلغ المتبقي.
- تقدر تعدّل الرسالة، وبعدين تدوس «افتح واتساب».
- واتساب بيفتح والرسالة مكتوبة، و**انت اللي بتدوس إرسال**.
- مفيش أي خدمة واتساب مدفوعة. الزرار بيستعمل رابط wa.me العادي.

### الزراير فين
- **لوحة التحكم:**
  - زرار «تذكير جلسات بكرة»: قايمة بكل موكلين جلسات بكرة، ولكل واحد زرار.
  - اللي اتبعتله بيتعلّم عليه ✓ على نفس الجهاز لمدة أسبوعين.
  - كمان فيه زرار جنب كل جلسة جاية.
- **الأجندة:** لما تفتح جلسة أو أتعاب.
- **الأتعاب:** زرار «تذكير» على أي أتعاب لسه مش مدفوعة كلها.
- **ملف القضية:**
  - زرار «رسالة واتساب للموكل» في النظرة العامة.
  - زرار جنب كل جلسة جاية، وجنب كل أتعاب مش مدفوعة.
- **الموكلين:** زرار «واتساب» بيفتح رسالة عامة.
- **الإعدادات ← «رسايل واتساب»:**
  - مدير المكتب يقدر يعدّل الأربع رسايل، وفيه معاينة.
  - ويقدر يرجّع الرسايل الافتراضية بزرار.
  - المتغيرات المتاحة: {client} {case} {court} {date} {amount} {due} {office}.

### تفاصيل مهمة
- **الأرقام:**
  - 010… بتتحول لـ 2010… لوحدها.
  - الأرقام اللي بتبدأ بـ + أو 00 (خليج أو برة) بتفضل زي ما هي.
- **رقم الموكل مش موجود أو غلط:** بيظهر تنبيه، وتقدر تنسخ الرسالة وتبعتها بنفسك.
- **معلومة ناقصة:** أي سطر فيه معلومة مش موجودة (مثلاً قضية من غير محكمة) بيتشال من الرسالة.
- **الباقات:** الميزة في الاحترافية والمتقدمة («تكامل واتساب»). في الأساسية الزرار بيطلّع نافذة الترقية.
- **إصلاح قديم:** رابط واتساب القديم كان بيكوّن الرقم غلط لو مكتوب من غير الصفر الأولاني.

### الملفات
- `web/js/whatsapp.js`: القوالب، وتحويل الأرقام، ونافذة الرسالة، وقايمة جلسات بكرة.
- `migrations/030_whatsapp_templates.sql`: عمود `wa_templates` في `office_settings`. اتطبّق على قاعدة البيانات الحقيقية.
- السيرفر: الأجندة، والأتعاب، ولوحة التحكم بقوا بيرجّعوا رقم الموكل. والإعدادات بتقبل `wa_templates` (JSON بس، ولحد 8000 حرف).

### الاختبار (متصفح حقيقي، كله نجح)
- **لوحة التحكم:** تذكير جلسات بكرة، والرسالة صح، والرابط `wa.me/201012345678`، والعلامة ✓ ظهرت.
- **باقي الشاشات:** الأتعاب، وملف القضية (3 أنواع رسايل)، والأجندة.
- **القوالب:** تعديل قالب من الإعدادات بيظهر في الرسالة. والقالب الغلط بيترفض (400).
- **الموبايل:** مفيش حاجة طالعة برة الشاشة.

## ٧.١٢) زرار واتساب عائم للدعم الفني

- **شكله:** دايرة خضرا بعلامة واتساب تحت على الشمال، في كل الصفحات: الموقع، والدخول، والنظام، والباقات، والتسجيل، والدفع.
- **لما حد يدوس:** واتساب بيفتح على رقم الدعم **01013917789**، برسالة جاهزة فيها هو بيكتب من أنهي صفحة (الموقع / النظام / الباقات …).
- **على الموبايل:** بيطلع فوق شريط التنقل السفلي، وفوق شريط «من غير إنترنت» لو ظاهر.
- **بيستخبى:** لما نافذة التثبيت أو البحث تتفتح، ووقت الطباعة.
- **تغيير الرقم:** من السطر `SUPPORT_PHONE` في `web/js/support-fab.js` (اكتبه بالصيغة الدولية، مثلاً 2010…).
- **الملفات:**
  - `web/js/support-fab.js`: سكربت مستقل، والتنسيق جواه.
  - سطر واحد في آخر `index.html` و`pricing.html` و`signup.html` و`pay.html`.

## ٧.١٣) رصيد الذكاء الاصطناعي لكل باقة + عدّاد ظاهر

### الرصيد الشهري
| الباقة | طلبات في الشهر |
|---|---|
| الأساسية / التأسيس | مش في الباقة |
| الاحترافية | 300 |
| المتقدمة | 1000 |
| المكتب المتكامل (مدى الحياة) | 300 |
| الفترة التجريبية | 40 |

- **التجديد:** أول كل شهر بتوقيت القاهرة.
- **بيتحسب:**
  - الشات، والبحث القانوني، وتوليد المستندات.
  - التحليل الذكي (عقد / قضية / مستند)، وتحليل القضية المحفوظة.
- **الطلب بيتحسب لو نجح بس.**
- **حد يومي للحماية:** 150 طلب في اليوم لكل مكتب، ومتغير `AI_DAILY_LIMIT` بيغيّره.
- **تغيير الأرقام:** من `AI_MONTHLY_LIMITS` و`AI_TRIAL_LIMIT` في `worker/lib/ai-quota.js`.
  - وكمان من القايمة الاحتياطية في `web/js/pricing.js` (دي اللي بتظهر في صفحة الباقات لو مفيش بيانات من السيرفر).

### المستخدم بيشوف
- **عدّاد:** في شاشة الذكاء الاصطناعي، وفي تبويب «تحليل ذكي» في ملف القضية.
  - مكتوب فيه مثلاً «رصيد الشهر: 770 من 1000 — بيتجدد 1 ديسمبر».
  - لونه بيتغير: عادي، وبرتقالي تحت 20%، وأحمر لما يخلص.
- **لما الرصيد يخلص:** نافذة «رصيد الذكاء الاصطناعي خلص» فيها ميعاد التجديد وزرار «شوف الباقات».
- **صفحة الاشتراك:** سطر بالاستخدام.
- **صفحة الباقات:** سطر «طلبات الذكاء الاصطناعي / شهر» في جدول المقارنة.

### الملفات
- **`migrations/031_ai_usage.sql`:** جدول `ai_usage`، فيه صف لكل مكتب في اليوم. اتطبّق على قاعدة البيانات الحقيقية.
- **`worker/lib/ai-quota.js`:** الحدود، والتحقق، والعدّ.
- **`worker/index.js`:** التحقق قبل أي طلب ذكاء اصطناعي، والعدّ بعده. ده بقى في مكان واحد بدل ما كان متكرر في كل شاشة.
- **`GET /api/ai/usage`:** الرصيد. ونفس البيانات موجودة كمان في `/api/subscription/me` تحت `ai`.
- **`web/js/ai-usage.js`:** العدّاد والنافذة.
- **`web/js/api.js`:** بيحدّث العدّاد بعد كل استخدام، وبيطلّع النافذة لما السيرفر يرد بـ 429.

### الاختبار (كله نجح)
- البحث القانوني اتحسب (999 فاضل من 1000).
- لما الرصيد خلص، الشات اترفض برسالة واضحة، والنافذة ظهرت في المتصفح.
- العدّاد ظاهر في الشاشة وفي ملف القضية وفي صفحة الاشتراك.
- على الموبايل مفيش حاجة طالعة برة الشاشة.

## ٧.١٤) أجندة احترافية بكل الأنواع + قايمة كاملة لدرجات وأنواع القضايا

### الأجندة
- **زرار «➕ إضافة» فيه كل الأنواع:**
  - جلسة (بالقضية والساعة/الرول).
  - مهمة (ومعاها المسؤول).
  - أتعاب مستحقة.
  - ومواعيد حرة: اجتماع / مقابلة موكل، استشارة، موعد نهائي / ميعاد طعن، إجراء (إعلان، شهر عقاري، تنفيذ…)، تذكير، شخصي، أخرى.
- **المواعيد الحرة فيها:**
  - طول اليوم أو من ساعة لساعة.
  - المكان، والقضية، والموكل، وملاحظات.
  - تعليم «تم».
- **التنقّل:** أزرار للشهر اللي قبل واللي بعد، و«النهارده»، والفترة الحالية مكتوبة فوق.
- **طرق العرض:**
  - شهر، أسبوع، يوم.
  - **قائمة:** الـ30 يوم الجايين مترتبين بالأيام. الموبايل بيفتح عليها على طول.
- **فلاتر بالألوان لكل نوع.** اختيارك بيتحفظ على الجهاز.
- **إضافة أسرع:** الضغط على يوم فاضي، أو السحب على ساعات في الأسبوع، بيفتح الإضافة بنفس التاريخ والساعة.
- **نافذة التفاصيل:**
  - رسالة واتساب للموكل.
  - تم، وتعديل، وحذف.
  - تغيير ميعاد الجلسة/المهمة/الأتعاب.
  - السحب والإفلات بيغيّر اليوم والساعة.
- **من غير نت:** الإضافة بتتحفظ على الجهاز وبتتبعت بعدين.
- **إصلاحات:**
  - «الشهر اللي بعد» كان بينقل 6 أسابيع.
  - الصفحة كانت بتتحمّل مرتين.
  - الموعد اللي من غير ساعة كان بياخد ساعة لما تغيّر النوع.

### القضايا
- **خانة «الدرجة»:** بقى فيها 27 درجة متقسمة. منها نقض، ونقض جنائي، والتماس إعادة النظر، والجنح والجنايات المستأنفة، والأسرة، والاقتصادية، ومفوضي الدولة، والإدارية العليا، والدستورية العليا، وقاضي التنفيذ.
- **خانة «النوع»:** زادت 28 نوع، وكلهم متربطين بمهارة التحليل الذكي المناسبة.
- **الملفات:**
  - `web/js/case-types.js`: فيه `CASE_TYPE_GROUPS` و`DEGREE_GROUPS`.
  - `worker/services/legal-skills.js`: فيه `CASE_TYPES`، ولازم يتطابق مع اللي فوق.

### الملفات
- **`migrations/032_agenda_events.sql`:** جدول `agenda_events` وخانة `sessions.session_time`. اتطبّق على قاعدة البيانات الحقيقية.
- **`worker/routes/calendar.js`:** المواعيد الحرة (إضافة، تعديل، حذف)، وساعة الجلسة، وصلاحية «المكلّف بيها بس».
- **`worker/routes/sessions.js`:** بقى بيقبل `session_time`.
- **`web/js/views/agenda.js`:** الصفحة كلها.
- **`web/js/offline.js`:** الأنواع الجديدة من غير نت.

### الاختبار (متصفح حقيقي، كله نجح)
- إضافة اجتماع بساعة، وموعد نهائي، وجلسة بساعة، ومهمة، وأتعاب. كلهم ظهروا في القائمة والشهر.
- تعديل، وتم، وحذف.
- الشهر اللي بعد بينقل شهر واحد.
- العنوان الفاضي بيترفض.
- على الموبايل مفيش حاجة طالعة برة الشاشة.
- درجات القضايا فيها نقض.

## ٧.١٥) إشعارات حقيقية + قايمة الجرس + البحث

### اللي اتصلح
- **إعدادات الإشعارات** كانت شكل بس، والسيرفر ما كانش بيقراها. دلوقتي كل نوع مقفول ما بيتعملش أصلاً.
- **«قرأ الكل» و«مسح»** كانوا بيأثروا على المكتب كله. دلوقتي القراءة والإخفاء لكل مستخدم لوحده (جدول `notification_reads`).
- **الصلاحيات:** كل واحد بيشوف الإشعارات اللي من حقه بس:
  - إشعارات الأتعاب لصلاحية الأتعاب.
  - حدود الباقة لمدير الاشتراك.
  - «المكلّف بيها بس» بيشوف جلسات وقضايا ومواعيد قضاياه بس.
- **قايمة الجرس** كانت بتفتح بعرض الشاشة على الكمبيوتر.
- **نافذة البحث** كانت بتملا الشاشة بالأبيض على الكمبيوتر.
- **الضغط على نتيجة بحث** ما كانش بيفتح القضية أو الموكل نفسه.
- **البحث في المحامين** كان واقف (عمود مش موجود).

### الإعدادات ← الإشعارات
- **على الجهاز ده:**
  - إشعارات الجهاز (Notification API، بتظهر حتى لو الموقع في الخلفية).
  - صوت خفيف.
  - زرار «ابعت إشعار تجريبي».
  - الاختيارات دي بتتحفظ على الجهاز بس.
- **إشعارات المكتب (المدير):** الجلسات (ومعاها ميعاد التذكير: يومها / يوم / يومين / 3 / أسبوع)، ومواعيد الأجندة، والمهام، والأتعاب المتأخرة، والتحصيل والفواتير، والقضايا والموكلين الجدد. الاختيار بيتحفظ لوحده.

### التذكيرات اليومية (كل يوم الصبح، بتوقيت القاهرة)
- **الجلسات:** قبلها بالعدد اللي المكتب اختاره، ومعاها الساعة.
- **المهام:** المستحقة النهارده.
- **الأتعاب:** المتأخرة أسبوع.
- **مواعيد الأجندة:**
  - موعد نهائي: قبله بـ 3 أيام وبيوم ويومها.
  - اجتماع واستشارة وإجراء: قبلها بيوم ويومها.
  - تذكير وشخصي: يومها، ولصاحبهم بس.

### قايمة الجرس
- **الشكل:** على الكمبيوتر قايمة تحت الجرس، وعلى الموبايل لوحة من تحت.
- **تبويبين:** الكل / مش مقروء.
- **ترتيب بالأيام،** ولون وأيقونة لكل نوع، وعلامة للعاجل.
- **لكل إشعار:** مقروء / مش مقروء / إخفاء، وزرار «عرض أقدم».
- **الضغط على الإشعار** بيفتح القضية أو الموكل.
- **زرار ⚙️** بيوديك على الإعدادات.

### البحث
- **الشكل:** كارت في النص على الكمبيوتر.
- **الضغط على نتيجة** بيفتح القضية أو الموكل على طول.
- **بقى بيدوّر كمان في:** مواعيد الأجندة، والجلسات بساعتها، وبإسم الموكل.
- **النتايج حسب الصلاحيات،** والأرقام بالإنجليزي.

### الملفات
- `migrations/033_notification_reads.sql`: اتطبّق على قاعدة البيانات الحقيقية.
- `worker/routes/notifications.js`
- `worker/services/notification-jobs.js`
- `worker/routes/settings.js` (البحث + التحقق من الإعدادات)
- `web/js/notifications.js`
- `web/js/nav-links.js` (فتح الروابط من البحث والإشعارات)
- `web/js/views/settings.js` (`renderNotifTab`)
- `web/assets/theme.css` (القسم 22)

### الاختبار (كله نجح)
- قراءة وإلغاء قراءة وإخفاء وقراءة الكل لمستخدم واحد بس، والتحميل على صفحات شغال.
- قفل «الجلسات» من الإعدادات وقف إشعار الجلسة الجديدة، وفتحها رجّعه.
- قايمة الجرس تحت الجرس على الكمبيوتر، ولوحة من تحت على الموبايل، وEsc بيقفلها.
- البحث كارت في النص، وEnter بيفتح القضية.
- على الموبايل مفيش حاجة طالعة برة الشاشة.

## ٧.١٦) تصليح كود الدولة في أرقام الموبايل (واتساب + الدخول)

### المشكلة
- زرار واتساب العميل في السوبر أدمن كان بيقول «تعذّر الحصول على رقم الهاتف بسبب كود الدولة».
- **السبب:**
  - التسجيل بـ +20 كان بيحفظ الرقم من غير الصفر (1012345678).
  - الزرار كان بيحط «2» قدامه بشكل أعمى، فيطلع 21012345678 (دولة تانية).
- **نفس الغلطة كانت بتبوّظ:**
  - الأرقام الخليجية (+966 كانت بتتحفظ 0966…).
  - الدخول برقم الموبايل لأصحاب الأرقام دي.

### اللي اتعمل
- **`web/js/phone.js`:** مكان واحد لتحويل أي رقم لصيغة واتساب الدولية. بيستخدمه السوبر أدمن، والموكلين، ودعوة الموكل، والرسايل الجاهزة، وروابط واتساب كلها.
- **`worker/lib/phone.js`:**
  - صيغة حفظ موحّدة: مصري 01…، ودولي +….
  - `phoneVariants` بتخلّي الدخول يقبل الرقم بأي شكل، حتى لو اتحفظ بالشكل القديم.
- **السيرفر:**
  - التسجيل (`signup.js`) وإضافة عضو للفريق (`team.js`) بقوا بيحفظوا بالصيغة الموحّدة، وبيتأكدوا من التكرار بكل الأشكال.
  - تسجيل الدخول (`auth.js`) بيدوّر بكل الأشكال.
- **`migrations/034_fix_user_phones.sql`:** صلّح الأرقام القديمة.
  - على قاعدة البيانات الحقيقية اتصلح 3 أرقام من 41، ومفضلش ولا رقم غلط.
- **لو الرقم بايظ خالص:** زرار واتساب ما بيظهرش بدل ما يفتح رابط غلط.

### الاختبار
- 11 شكل رقم (مصري، خليجي، إماراتي، بمسافات، بـ 00، أرضي)، كلهم صح.
- الدخول بـ 010… و+2010… و2010… ومن غير الصفر اشتغل، قبل تصليح الرقم القديم وبعده.

## ٧.١٧) تصليح تعليق صفحة الدخول بعد السوبر أدمن + حماية الرسوم

### الخروج من السوبر أدمن
- **المشكلة:** بعد الخروج من السوبر أدمن، صفحة الدخول كانت بتفتح فاضية (كأنها معلّقة) لحد ما تقفل الموقع وتفتحه.
- **السبب:**
  - فتح دخول المسؤول كان بيخفي كارت «دخول المكتب».
  - الخروج ما كانش بيرجّعه.
- **التصليح:** الخروج (`doLogout` في `web/js/views/superadmin.js`) بيمسح بقايا شاشة المسؤول، وبيفتح صفحة الدخول من جديد والفورم ظاهر.

### الرسوم في لوحة التحكم
- **المشكلة:** الرسوم كانت بتعلّق لما تروح لصفحة وترجع، ومحتاجة ريفريش.
- **السبب الأقرب:**
  - لو خرجت قبل ما اللوحة تخلّص تحميل ورجعت، كانت بتتحمّل نسختين.
  - القديمة بتكتب فوق الجديدة وبتحاول ترسم على نفس اللوحة، فالمكتبة بترفض.
- **التصليح:**
  - `web/js/router.js`: كل تنقّل ليه رقم، وكل شاشة بتترسم في صفحة جديدة (`.view-page`). الشاشة القديمة ما بتكتبش فوق الجديدة.
  - **الرسوم** (لوحة التحكم، التحصيل، الإدارة المالية، التقارير): أي رسم قديم على نفس اللوحة بيتشال قبل الجديد.
  - **لوحة التحكم** ما بتكمّلش لو المستخدم راح لصفحة تانية.
- **ملحوظة:** التعليق نفسه ما اتكررش في الاختبار عندنا، حتى مع إنترنت بطيء. ده التصليح للسبب الأقرب. لو اتكرر، نحتاج نعرف الجهاز والخطوات.

### الرسم الشهري
- **المشكلة:** «الأداء المالي» كان بيطلع صفر، لأن مفتاح الشهر اتحسب بـ `toISOString` فطلع الشهر اللي قبله.
- **التصليح:** اتصلح في `worker/services/dashboard.js`.

### الاختبار
- خروج السوبر أدمن بيفتح صفحة الدخول والفورم ظاهر.
- الـ 17 شاشة اتفتحوا من غير أخطاء.
- الرسوم شغالة بعد الرجوع، وبعد تنقّل سريع مع إنترنت بطيء.
- اختبارات الأجندة والإشعارات والبحث نجحت تاني.

## ٧.١٨) الإدارة المالية — المرحلة 1: تصليح الأرقام والربط

التقرير الكامل والمراحل الجاية في `reports/مراجعة الإدارة المالية.md`.

### اللي اتصلح
1. **الفاتورة مربوطة بالأتعاب** (`invoices.fee_id`):
   - في نافذة الفاتورة «الفاتورة دي عن أتعاب متسجلة؟». البند بيتملى لوحده، والإيراد ما بيتحسبش مرتين.
   - **قيد الفاتورة** حسب حالتها (`syncInvoiceEntry`):
     - مسودة أو ملغاة: من غير قيد.
     - مربوطة بأتعاب: الضريبة بس.
     - مستقلة: إيراد وضريبة.
2. **تحصيل الفاتورة دفعة حقيقية** (`payments.invoice_id`):
   - زرار «تسجيل دفعة» فيه المبلغ والتاريخ وطريقة الدفع، وفي سجل دفعات في صفحة الفاتورة.
   - حالة «مدفوعة» و«مدفوعة جزئياً» بتيجي من الدفعات بس.
   - الفاتورة المربوطة بتحسب دفعات الأتعاب كمان.
3. **مكان واحد لتسجيل الفلوس الداخلة** (`recordPayment` في `services/accounting.js`):
   - بيستخدمه: شاشة الدفعات، وتحصيل الفاتورة، و«مدفوع» في الأتعاب، والتصليح.
   - تقليل المدفوع بإيدك مرفوض (لازم تمسح الدفعة).
   - حذف فاتورة عليها دفعات مرفوض.
4. **طريقة الدفع ← الحساب:**
   - نقدي: الصندوق (1101).
   - تحويل أو إنستاباي أو محفظة أو شيك: البنك (1102).
   - ده للدفعات والمصروفات.
5. **مصاريف المكتب والجلسات والمهام:**
   - كل نوع ليه مرجع قيد لوحده: `expense` و`session_expense` و`task_expense`.
   - قبل كده حذف مصروف مكتب أو حذف مهمة كان بيمسح قيد مصروف تاني بنفس الرقم.
   - تعديل المبلغ بيعدّل القيد.
6. **أرقام القيود والإيصالات** بقت من أكبر رقم مش من العدد. قبل كده بعد أي حذف الرقم كان بيتكرر، والقيد بيترفض في صمت.
7. **حذف القضية والدفعة والفاتورة والقيد والحساب** كانوا بيطلّعوا خطأ (متغير `request` ناقص). اتصلحوا.
8. **التواريخ والعملة والأرقام:**
   - الشهر من يوم 1 (`localISO` و`monthStartISO` في `ui.js`).
   - العملة من الإعدادات (`cur()`)، والضريبة الافتراضية من نسبة المكتب.
   - الأرقام بالإنجليزي.

### تصليح البيانات القديمة (`services/finance-repair.js`)
- **بيشتغل لوحده مرة واحدة لكل مكتب،** أول ما يفتح أي شاشة مالية. العلامة: `office_settings.finance_repair_v1`، وفيها تقرير باللي اتعمل.
- **اللي بيعمله:**
  - بيربط الفواتير اللي بتكرر أتعاب (نفس القضية ونفس المبلغ).
  - بيظبط قيود الفواتير.
  - بيحوّل أي «مدفوع» يدوي لدفعة «تسوية تلقائية» نقدي.
  - بيرجّع قيود المصروفات اللي ضاعت.
- **`migrations/035_finance_links.sql`** صلّح المراجع وقيود المسودات والبنك.
  - على قاعدة البيانات الحقيقية اتفصل 5 قيود مصاريف (1 جلسة و4 مهام) كانت معرّضة للمسح.
- **نسخة احتياطية قبل النشر:** `backups/prod-before-finance-phase1-2026-11-24.sql`. على الجهاز بس، مش على GitHub.

### الاختبار (كله نجح)
- **سيناريو بالشكل القديم:**
  - الإيراد رجع 10,000 بدل 20,000.
  - الفاتورة اتربطت، والقيد الضايع رجع.
  - التصليح لما اتعاد ما كررش حاجة.
- **السلوك الجديد:**
  - المسودة من غير قيد، والضريبة بس عند الإرسال.
  - التحصيل بالبنك والنقدي.
  - الرفض في الحالات الغلط.
  - حذف المصروف ما بيأثرش على غيره، وتعديل المبلغ بيعدّل القيد.
- **المتصفح:**
  - العملة ر.س والضريبة 15% من الإعدادات.
  - ربط الفاتورة بالأتعاب، وتسجيل الدفعة، وقائمة الدخل من أول الشهر.
  - الـ 17 شاشة شغالة، والميزانية متوازنة.

## ٧.١٩) الإدارة المالية — المرحلة 2: الوضع المبسط وكشف الحساب وتوزيع الباقات

### «فلوس المكتب» (الوضع المبسط، أول صفحة في الإدارة المالية)
- **الملفات:** `web/js/views/money-simple.js` والسيرفر `GET /api/fees/cash-summary` (`worker/services/client-statement.js`).
- **اتحصّل من الموكلين:** نقدي أو بنك.
- **اتصرف:** على المكتب، وعن الموكلين.
- **اللي فضل:** فلوس حقيقية.
- **الفلوس اللي معاك:** الصندوق والبنك.
- **فلوس عند الموكلين:** قايمة بالمديونين، ولكل واحد «كشف حساب» و«تذكير» على واتساب.
- **سجّل بسرعة:** دفعة، ومصروف، وأتعاب، وفاتورة.
- **التنقّل بين الشهور.**
- **لوحة التحكم:** بقت بتقول «اللي فضل معاك» بنفس الأرقام، بدل «صافي الربح» المحاسبي.

### وضع المحاسب
- **دفتر اليومية ودليل الحسابات وقائمة الدخل والمركز المالي** مستخبيين من القايمة.
- **بيظهروا:** بزرار «وضع المحاسب» في فلوس المكتب، أو لدور «محاسب». وده بس لو الباقة فيها المحاسبة الكاملة.

### المصاريف على المكتب أو على الموكل
- **في الداتا:** `session_expenses.billable` و`task_expenses.billable` (migration 036)، و`expenses.is_reimbursable`.
- **المصروف اللي على الموكل:** قيده «العملاء» مدين بدل حساب مصروف، فبيتضاف لمديونيته وكشف حسابه ومبيتحسبش على المكتب.
- **ملف القضية ← «المصاريف»:**
  - زرار «➕ مصروف على القضية»، والافتراضي «على الموكل».
  - كل مصاريف القضية (جلسات ومهام وعامة) ظاهرة، ومكتوب على كل واحد مين اللي بيتحمّله.
- **نفس الاختيار موجود في:** مصروف المهمة، وشاشة المصروفات.
- **الدفعة اللي باسم موكل من غير أتعاب** بقت «على الحساب»: بتقلل مديونيته.

### كشف حساب الموكل
- **الملفات:** `web/js/statement.js` والسيرفر `GET /api/clients/:id/statement`.
- **بيتفتح من:** قايمة المديونين، أو زرار «📄 كشف حساب» جنب كل موكل.
- **فيه:** اللي عليه (أتعاب، فواتير مستقلة، ضريبة فواتير، مصاريف عليه)، واللي دفعه، والرصيد بعد كل حركة.
- **أزرار:** طباعة / PDF، وواتساب برسالة جاهزة، و«دفعة على الحساب».
- **بوابة الموكل:** كشف حسابه بيظهر تحت الأتعاب (`/api/client-portal/statement`).

### توزيع الباقات (migration 037 + `FEATURES` في `feature-gate.js`)
- **ميزة جديدة `accounting`** (القيود والقوائم المالية ووضع المحاسب) في الاحترافية والمتقدمة والمكتب المتكامل.
  - `journal.js` كله بيطلبها.
  - `accounts.js` بيطلبها ما عدا قايمة الحسابات (محتاجينها لأنواع المصروفات).
- **الأساسية:** الوضع المبسط والفواتير، من غير المحاسبة الكاملة.
- **التأسيس (مدى الحياة):** اتفتح فيها `finance`، يعني الأتعاب والتحصيل والمصروفات والوضع المبسط وكشف الحساب، من غير فواتير.
- **مكان زرار وضع المحاسب** في الباقات اللي مفيهاش المحاسبة: رابط «🔒 المحاسبة الكاملة في الاحترافية».
- **إصلاح:** التحميل في الخلفية (للشغل من غير نت) كان ممكن يطلّع نافذة ترقية في وش المستخدم. دلوقتي `apiJson(path, { silent: true })`.

### الاختبار
- **السيرفر:**
  - مصروف 450 على الموكل ومصروف مهمة 150 زوّدوا مديونيته 600 ومتحسبوش على المكتب.
  - الدفعة على الحساب قللت المديونية 600.
- **المتصفح:**
  - الكروت والمديونين ظاهرين.
  - وضع المحاسب بيظهّر ويخفي 4 صفحات.
  - الكشف ورسالة الواتساب شغالين.
  - دفعة من الكشف نزّلت الباقي.
  - مصروف القضية اتسجل على الموكل.
  - على الموبايل مفيش حاجة طالعة برة الشاشة.
- **نفس المكتب على 3 باقات** (الأساسية والتأسيس والاحترافية): المسموح اشتغل، والمقفول اترفض من السيرفر، ومفيش نافذة ترقية ظهرت لوحدها.
- **نسخة احتياطية قبل النشر:** `backups/prod-before-finance-phase2-2026-11-24.sql`.

## ٧.٢٠) الإدارة المالية — المرحلة 3: للمكاتب المتوسطة والكبيرة

### أمانات الموكلين (مقدم المصاريف) — الاحترافية وفوق
- **الجدول والحساب:**
  - جدول `trust_transactions` للإيداع والرد.
  - حساب التزام جديد **2107 أمانات الموكلين**، اتضاف لكل المكاتب الـ 43 ولشجرة الحسابات الجديدة.
- **الصرف من الأمانة:** على المصروف نفسه (`expenses.paid_from_trust`).
- **القيود:**
  - إيداع: الصندوق أو البنك مدين، و2107 دائن.
  - صرف أو رد: 2107 مدين، والصندوق أو البنك دائن.
  - مش إيراد ومش مديونية على الموكل.
- **الحماية:** مينفعش الصرف أو الرد يعدّي الرصيد.
- **في الشاشات:**
  - كشف الحساب فيه جزء «أمانة الموكل» بإيداع ورد.
  - مصروف القضية والمصروفات العامة فيهم اختيار «من أمانة الموكل».
  - «فلوس المكتب» بتنبّه إن جزء من الفلوس أمانات.
- **السيرفر:** `POST /api/fees/trust` و`GET /api/fees/trust/:clientId`.

### ربحية القضايا والمحامين — الاحترافية وفوق
- **صفحة «ربحية القضايا والمحامين»:** `web/js/views/money-profit.js` و`GET /api/fees/profitability`.
- **لكل قضية:** اتفقت، واتحصّل، ومصاريف المكتب، وعلى الموكل، والصافي (اللي اتحصّل − مصاريف المكتب).
- **لكل محامي:** نصيبه من قضايا فريقه بالتساوي على أعضاء الفريق.
- **الفترات:** الشهر، واللي فات، و3 شهور، والسنة. وتصدير Excel.

### المصاريف المتكررة والمرتبات — الاحترافية وفوق
- **المتكرر:**
  - شهري، أو كل 3 شهور، أو سنوي.
  - بيتسجل لوحده من الكرون اليومي، وكمان أول ما صفحة المصروفات تتفتح.
  - كل نسخة مربوطة بالأصل (`recurring_parent_id`)، وآخر مرة متسجلة في `recurring_last`.
  - في زرار «إيقاف التكرار».
- **«💼 صرف مرتبات الشهر»:**
  - من مرتبات المحامين على حساب 5101.
  - مرة واحدة لكل محامي في الشهر (المرجع `SAL-YYYY-MM-id`).
  - السيرفر: `GET/POST /api/expenses/payroll`.

### أدوات المكاتب الكبيرة — المتقدمة بس (ميزة `finance_advanced`)
- **قفل الفترات:**
  - `office_settings.lock_before`، والتحقق في `worker/lib/period-lock.js`.
  - مفيش إضافة أو تعديل أو حذف لدفعات أو مصروفات أو فواتير أو قيود أو أمانات أو مرتبات قبل التاريخ ده.
  - المدير بس يقدر يقفل ويفتح (`POST /api/fees/lock`).
- **التصدير للمحاسب الخارجي:** Excel فيه ملخص ودفعات ومصروفات (ومين اتحمّلها) وفواتير وأتعاب للشهر.

### الاختبار
- **الأمانات:** إيداع 1,000، وصرف 400، ورد 100، فالرصيد 500. والصرف والرد الزيادة اترفضوا.
- **الربحية:** 5 قضايا ومحاميين.
- **المرتبات:** اتسجلت مرة، والضغطة التانية ما كررتهاش.
- **الإيجار المتكرر:** بدأ من 3 شهور، واتسجل 3 مرات في مواعيده.
- **القفل:** الحركة القديمة اترفضت (423)، والجديدة اتقبلت، وبعد الفتح القديمة اتقبلت.
- **التصدير:** 5 شيتات فيهم بيانات.
- **الـ17 شاشة** شغالين.
- **نسخة احتياطية:** `backups/prod-before-finance-phase3-2026-11-24.sql`.

### لسه مش معمول (من التقرير)
اتعمل في القسم ٧.٢١ تحت.

## ٧.٢١) الفروع وموافقة المدير على المصروفات الكبيرة

**لمين:** الباقة المتقدمة + المكتب المتكامل (مدى الحياة). اتفتحت للمكتب المتكامل في نفس النشرة (migration 040).

### الفروع (مراكز التكلفة)
- بتتضاف وتتعدّل وتتحذف من «فلوس المكتب» ← كارت «أدوات المكاتب الكبيرة».
- لو حذفت فرع، قضاياه ومصروفاته بتفضل موجودة بس من غير فرع.
- القضية بتتربط بفرع من فورم الإضافة أو من ملف القضية.
- المصروف بيتربط بفرع، ولو متختارش فرع بياخد فرع القضية.
- صفحة الربحية فيها جدول «الفروع»: القضايا، اللي اتحصّل، مصاريف القضايا، المصاريف العامة، الصافي. والجدول ده بيطلع في ملف الـ Excel كمان.
- **مستخبية لحد ما المكتب يعمل أول فرع**، فالمكتب اللي ملوش فروع مش بيشوف أي خانة زيادة.

### موافقة المدير
- المدير بيحط حد للمبلغ في نفس الكارت. لو سابه فاضي، مفيش موافقات.
- لو حد من الفريق (مش المدير) سجّل مصروف أكبر من الحد، المصروف بيبقى «مستني موافقة». مفيش قيد، ومش بيتخصم من الخزنة، ومش داخل في أي تقرير أو كشف حساب.
- المدير بيوصله إشعار `expense_approval`، والإشعار ده بيظهر لصاحب صلاحية `settings.manage` بس.
- في صفحة المصاريف فيه كارت «مستني موافقتك» فيه زرار موافقة وزرار رفض.
- لما يوافق، القيد بيتعمل (عادي أو من أمانة الموكل). والموافقة بتراعي قفل الفترات ورصيد الأمانة.
- اللي سجّل المصروف بيوصله إشعار `expense_decision` بالقرار.
- المحاسب مايقدرش يوافق على مصروفه بنفسه (403).

### الملفات
- `migrations/039_branches_approvals.sql`، و`migrations/040_lifetime_pro_advanced.sql`.
- السيرفر: `worker/routes/branches.js` (جديد)، `expenses.js` (POST `/api/expenses/:id/approve`)، `cases.js`، `settings.js`، `notifications.js`، `services/finance-advanced.js` (الربحية بالفروع)، `client-statement.js` و`finance-repair.js` (استبعاد المصروفات المستنية).
- الواجهة: `views/money-simple.js`، `views/money.js`، `views/money-profit.js`، `views/cases.js`، `pricing.js`، `views/subscription.js`، `assets/theme.css`.
- تصليح: صفحة الباقات وصفحة الاشتراك بقى فيهم اسم عربي لميزة `finance_advanced` بدل ما الكلمة الإنجليزي تظهر.

### الاختبار
- **API:** المصروف الكبير من المحاسب بيستنى ومش بيأثر على الخزنة. الموافقة بتخصم 4000. الرفض مش بيخصم حاجة. مصروف المدير نفسه بيتسجل على طول.
- **المتصفح:** إضافة فرع وتغيير اسمه، حد الموافقة، جدول الفروع في الربحية، اختيار الفرع في القضية والمصروف، كارت الموافقة عند المحاسب (من غير أزرار) وعند المدير (بأزرار).
- **جولة على كل الصفحات:** مفيش أخطاء.

### النشر (2026-11-24)
- نسخة احتياطية: `backups/before-039-040-20261124-2123.sql`.
- 039 و040 اتطبقوا على قاعدة البيانات الحقيقية.
- السيرفر نسخة `21a0d94e`، والموقع اتنشر.

## ٧.٢٢) الأجندة في عرض الأسبوع + الرسوم والسرعة في الرئيسية + زرار الرجوع

- **الأجندة (أسبوع/يوم):** الـ CSS كان بيقلب اتجاه هيكل التقويم كله لـ rtl، والمكتبة (TOAST UI) بتحسب الأماكن من الشمال، فعمود الساعات كان بيتطبع فوق يوم الجمعة. دلوقتي الهيكل `ltr` والكلام بس `rtl` (آخر `theme.css`).
  - خانة «طول اليوم» بتكبر لوحدها على قد أزحم يوم، لحد 8 مواعيد (`fitAlldayPanel` في `agenda.js`)، فـ«+N» مبقتش بتتطبع فوق موعد.
  - «+N كمان» بقت بالعربي في عرض الشهر وعرض الأسبوع.
- **الرئيسية:**
  - كانت بتطلب بياناتها على 3 مراحل ورا بعض، وكل طلب على السيرفر الحقيقي بياخد حوالي نص ثانية، فكانت بتفضل ثواني فاضية والرسوم مختفية كل مرة ترجع لها.
  - دلوقتي كل الطلبات بتتبعت مع بعض (`fetchAll`).
  - آخر نسخة بتتعرض فوراً لما ترجع، وبعدين بتتحدث في الخلفية. والنسخة دي متخزنة لكل مستخدم ولكل فترة.
  - لو مكتبة Chart.js لسه بتتحمّل، الصفحة بتستناها (`whenChartReady`).
  - في التجربة والنت متبطّأ (نص ثانية لكل طلب): الرسوم ظهرت بعد 0.18 ثانية من الرجوع.
- **زرار الرجوع:** كان بيطلّع المستخدم برا البرنامج. دلوقتي `router.js` بيسجل كل تنقّل في تاريخ المتصفح من غير ما يغيّر العنوان، والرجوع بيفتح الشاشة اللي قبلها (وبيقفل أي نافذة مفتوحة).
- **النشر:** الواجهة بس (2026-11-24)، من غير أي تغيير في قاعدة البيانات أو السيرفر.

## ٧.٢٣) السبب الحقيقي لاختفاء رسوم الرئيسية (Chart.js)

- **العَرَض:** بعد الرجوع للرئيسية من أي صفحة، الرسوم موجودة بس فاضية، ولازم ريفريش. وفي الكونسول: `this._fn is not a function`.
- **السبب:** `chart-theme.js` كان بيستبدل `Chart.defaults.animation` بكائن جديد فيه `{duration, easing}` بس. Chart.js بيبني إعدادات الحركة من **مفاتيح** الكائن ده (`type`/`fn`/`from`/`to`…)، فـ`type: 'color'` كان بيضيع.
  - أي حركة ألوان بعد أول رسم (تغيير مقاس أو ماوس) كانت بتضرب الخطأ.
  - الخطأ ده بيوقف حلقة الرسم بتاعة المكتبة لكل الرسوم لحد ريفريش.
  - مكانش بيظهر عندي في الاختبارات المحلية، واتكشف بس على الموقع الحقيقي من حساب المستخدم.
- **التصليح:**
  - تعديل `duration` و`easing` بس على نفس الكائن، من غير ما نستبدله.
  - حماية زيادة: أي `Animation` من غير دالة بتقفز للقيمة النهائية بدل ما توقف الرسم كله.
- **التأكد على الموقع الحقيقي (2026-11-24):**
  - رحت للقضايا والموكلين والأجندة ورجعت للرئيسية: الرسوم مرسومة كل مرة.
  - صفر أخطاء `_fn` جديدة، وحلقة الرسم مش واقفة.

## ٧.٢٤) رأس الأيام في عرض الأسبوع

- **المشكلة:** على الشاشات الضيقة (عمود اليوم حوالي 64 بكسل)، اسم اليوم والتاريخ كانوا في سطر واحد لازقين في طرف العمود، فالأسامي كانت بتدخل في بعض. وكان فيه شريط تمرير أفقي مالوش لازمة.
- **التصليح:**
  - قالب `weekDayName` في `agenda.js`: الرقم فوق واسم اليوم تحته في النص.
  - الاسم بيظهر مختصر (سبت، أحد، إتنين، تلات، أربع، خميس، جمعة) تحت عرض 900 بكسل.
  - «النهارده» بنحسبها بنفسنا، لأن `isToday` في القالب كان بيرجع صح لكل الأيام.
  - شيلنا `line-height` الـ 38 بكسل اللي كان بيقص الاسم، والـ CSS في آخر `theme.css`.
- **التأكد:** على 583 و390 و1366 بكسل مفيش أي اسم طالع برا عموده. واتأكدت على الموقع الحقيقي (2026-11-24).

## ٧.٢٥) متابعة الفترة التجريبية برسايل واتساب (السوبر أدمن)

**المكان:** لوحة السوبر أدمن ← كارت «📣 متابعة الفترة التجريبية»، فوق قايمة المكاتب.

**المجموعات** (`classify` في `worker/routes/followup.js`):

| المجموعة | الشرط |
|---|---|
| مبدأش | مفيش قضايا ولا موكلين |
| بدأ ووقف | مفيش حركة في `audit_log` من 3 أيام أو أكتر |
| نشيط | غير كده |
| التجربة بتخلص | فاضل 3 أيام أو أقل |
| خلصت | خلصت من أقل من 30 يوم |

**اختيار الرسالة** (`pickTemplate`): أول قالب شغّال بالترتيب، يكون:
- بيناسب مجموعة المكتب.
- عدّى على تسجيل المكتب `min_day` يوم.
- متبعتش للمكتب ده قبل كده.

وبين كل رسالتين لنفس المكتب يومين على الأقل. والمكتب المتوقف مبيتبعتلوش.

**الإرسال:** المسؤول بيعاين الرسالة ويعدّلها للمكتب ده بس، وبعدين بيفتح واتساب برقمه (`wa.me`) ويتسجل إن الرسالة اتبعتت (`followup_log`). **مفيش إرسال آلي من رقم شخصي.**

**الرسايل:** قوالب في `followup_templates` بيعدّلها المسؤول من «✏️ الرسايل»:
- العنوان، والمجموعات، وبعد كام يوم، والترتيب، وتشغيل وإيقاف.
- معاينة بشكل فقاعة واتساب وهو بيكتب.
- المتغيرات: `{الاسم}` `{المكتب}` `{القضايا}` `{الموكلين}` `{الأيام_المتبقية}` `{رابط_الموقع}` `{رابط_الباقات}`.
- لو اسم المكتب بيبدأ بـ«مكتب»، «مكتب {المكتب}» مبتتكررش فيها الكلمة.
- اتحط 7 رسايل جاهزة.

**ملاحظات وإيقاف لكل مكتب:** في جدول `office_followup`.

**الملفات:**
- `migrations/041_trial_followup.sql`
- `worker/routes/followup.js` (مسجّل في `SUPERADMIN_ROUTES`)
- `web/js/views/sa-followup.js`
- `web/js/views/superadmin.js`
- `web/assets/theme.css`

**النشر (2026-11-24):**
- نسخة احتياطية: `backups/before-041-20261124-2223.sql`.
- 041 اتطبق على قاعدة البيانات الحقيقية.
- السيرفر نسخة `7cb379f8`، والموقع اتنشر.
- على الموقع الحقيقي: 20 مكتب في التجربة (17 مبدأش، 1 بدأ ووقف، 2 نشيط)، واتأكدت إن التواريخ صح.

**الخطوات الجاية (من الاقتراح):**
- كارت «خطوات البداية» جوه التطبيق.
- تسجيل مصدر الإعلان (فيسبوك/إنستجرام).
- بعدين، لو حبينا: إرسال آلي بـ WhatsApp Business Cloud API.

## ٧.٢٦) كارت «خطوات البداية» في الرئيسية

**لمين:** مالك المكتب بس (`getRole() === 'admin'`).

**الخطوات الست** (كل خطوة بتظهر بس لو الباقة فيها الميزة بتاعتها):

| الخطوة | بتتعلّم لما | الزرار بيعمل إيه |
|---|---|---|
| ضيف أول موكل | يضيف موكل | يفتح فورم الإضافة |
| ضيف أول قضية | يضيف قضية | يفتح فورم الإضافة |
| سجّل ميعاد الجلسة الجاية | يضيف جلسة | يفتح فورم الإضافة |
| سجّل الأتعاب (`finance`) | يسجّل أتعاب | يفتح فورم الإضافة |
| ادعي موكل للبوابة (`portal`) | يبعت دعوة (فيه صف في `client_users`) | بيشاور على زرار «إرسال دعوة» بس، **ومبيبعتهاش بداله** |
| اسأل المساعد القانوني (`ai`) | يستخدم الذكاء الاصطناعي (فيه صف في `ai_usage`) | يركّز على خانة السؤال في البحث القانوني |

**التقدم:** بيتحسب من البيانات الحقيقية عن طريق `GET /api/office/onboarding` (`adminOnly`) في `worker/routes/office.js`.

**بيختفي إمتى:**
- لما المستخدم يقفله بـ ✕ (بيتحفظ في `localStorage` للمستخدم ده).
- لما يخلّص كل الخطوات: بيظهر «🎉 مكتبك جاهز!» مرة واحدة.
- المكاتب اللي عدّى على إنشائها أكتر من 30 يوم ومخلّصة الخطوات مبيظهرلهاش أصلاً.
- **مش مربوط بالشراء:** اتفقنا إنه يفضل لحد ما الخطوات تخلص، لأن المشترك الجديد محتاجه برضه.

**الملفات:** `web/js/views/dashboard.js` (`mountOnboarding`)، و`web/assets/theme.css` (`.onb-*`)، و`worker/routes/office.js`.

**الاختبار:**
- على جهازي: مكتب جديد فاضي، والخطوات اتعلّمت واحدة ورا التانية، والأزرار فتحت الفورم الصح. البوابة شاورت على الزرار من غير ما تبعت، والذكاء الاصطناعي ركّز على الخانة. اشتغل على الموبايل، والجولة على كل الصفحات سليمة.
- **النشر (2026-11-24):** السيرفر نسخة `54aaab8f`، والموقع اتنشر.
- مشفتش الكارت بعيني على الموقع الحقيقي، لأن المتصفح مكانش فيه دخول مكتب.

## ٧.٢٧) تسجيل مصدر الإعلان (فيسبوك/إنستجرام/حملة/إعلان)

**الواجهة:** `web/js/attribution.js` متحمّل في `index.html` و`signup.html` و`pricing.html`.
- بيحفظ مصدر الزيارة في `localStorage` (المفتاح `mowakkil_attr`) لمدة 30 يوم: `utm_*`، و`fbclid`/`gclid`، والموقع اللي جه منه، وأول صفحة.
- لو الزيارة جاية من إعلان، بتكسب أي مصدر قبلها. غير كده، أول مصدر خارجي بيفضل.
- `signup.js` بيبعته مع التسجيل في خانة `attribution`.

**السيرفر:** `worker/lib/attribution.js` (`normalizeAttribution`):
- `fb` بتبقى facebook، و`ig` بتبقى instagram، و`msg` بتبقى messenger (Meta بتبعت `{{site_source_name}}`).
- `fbclid` من غير UTM بتبقى facebook/paid، إلا لو جه من موقع إنستجرام فبتبقى instagram.
- من غير أي حاجة من دول، المصدر بيتحدد من الموقع اللي جه منه، ولو مفيش بيبقى `direct`.
- الخانات بتتخزن في `offices.signup_*` (migration 042) وقت التسجيل.

**التقرير:** في السوبر أدمن، كارت «📊 مصادر التسجيل»، عن طريق `GET /api/superadmin/signup-sources?days=7|30|90|all`.
- بيعرض لكل مصدر، ولكل حملة وإعلان: سجّلوا، وبدأوا يستخدموا (ضافوا قضية أو موكل)، واشتركوا.
- **«اشتركوا» = دفعوا فعلاً (`amount_paid > 0`)**. فيه 26 مكتب باقتهم `active` (plus أو lifetime) من غير أي دفع، وده كان بيبوّظ النسبة.
- فيه كمان شرح لينكات Meta بزرار نسخ.
- صفحة المتابعة بقت بتعرض «📣 جه من: …» لكل مكتب.

**لينك الإعلانات** (خانة URL parameters في Meta Ads Manager):
`utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`

**الاختبار:**
- على جهازي: زيارة من لينك إعلان إنستجرام فيه حملة وإعلان اتسجّلت صح حتى بعد ما الزائر اتنقل لصفحة التسجيل. `fbclid` اتسجّل فيسبوك، والزيارة المباشرة اتسجّلت direct.
- على الموقع الحقيقي: الحفظ شغال (وبيانات الاختبار اتمسحت بعدها)، والتقرير شغال.

**النشر (2026-11-24):**
- نسخة احتياطية: `backups/before-042-20261124-2249.sql`.
- 042 اتطبق على قاعدة البيانات الحقيقية.
- السيرفر نسخة `e9c1ce24`، والموقع اتنشر.
- الـ 48 مكتب القدام ظاهرين تحت «قبل تفعيل التتبع». آخر 30 يوم: 46 سجّلوا، 9 بدأوا، 0 دفعوا.

## ٧.٢٨) تطبيق أندرويد 1.0.1: مبقاش بيقفل على الموبايلات اللي مفيهاش Chrome

- **المشكلة:** عميل نزّل التطبيق، ولما بيفتحه بيفتح ويقفل على طول.
- **السبب:**
  - التطبيق مبني بـ Bubblewrap (TWA)، وبيفتح الموقع جوه Chrome أو أي متصفح بيدعم TWA.
  - الـ fallback كان `customtabs`.
  - على موبايل مفيهوش متصفح مناسب، زي Chrome المقفول، أو هواوي وهونر من غير خدمات جوجل، أو بعض موبايلات شاومي، التطبيق كان بيقفل.
- **التصليح:**
  - `fallbackType: 'webview'` في `android/app/build.gradle` و`android/twa-manifest.json`. في الحالة دي التطبيق بيفتح الموقع جوه `WebViewFallbackActivity`، وكانت متعرّفة أصلاً في الـ Manifest.
  - اللي عندهم Chrome مفيش عندهم أي تغيير.
- **البناء:** `android\build-apk.ps1 -Version 1.0.1`.
  - versionCode بقى 2.
  - متوقّعة بنفس المفتاح، والـ SHA-256 بيبدأ بـ `BB:60:EF…` وبيطابق `assetlinks.json`.
  - اتأكدت بـ `aapt2` و`apksigner`.
- **النشر (2026-11-24):**
  - `web/downloads/mowakkil.apk` اترفع، والملف اللي على الموقع نفس الـ hash بتاع اللي على الجهاز.
  - نسخة 1.0.0 القديمة اتحفظت في `%TEMP%\mowakkil-1.0.0-backup.apk`.
- **ملحوظة:** بعد ما البناء بيخلص، عملية Gradle الجانبية بتفضل شغالة. لازم تتقفل (`gradlew --stop` أو ريستارت للجهاز)، وإلا أداة التشغيل هتفضل فاكرة إن البناء لسه شغال.

## ٧.٢٩) لوحة السوبر أدمن بقت تابات

- **ليه:** الأقسام كلها كانت في صفحة واحدة طويلة ومزحومة (الذكاء الاصطناعي، وطلبات الدفع، والمتابعة، والمصادر، والمكاتب).
- **دلوقتي:**
  - الأرقام فوق، وتحتها شريط تابات: 🏢 المكاتب، 📣 متابعة التجربة، 💳 طلبات الدفع، 📊 مصادر التسجيل، 🤖 الذكاء الاصطناعي.
  - بيظهر قسم واحد بس في كل مرة.
  - كل تاب بيحمّل بياناته أول ما يتفتح.
  - آخر تاب بيتحفظ في `localStorage` (`mowakkil_sa_tab`).
  - تاب المتابعة عليه رقم المكاتب اللي مستنية رسالة النهارده، والرقم بيتحدث بعد كل إرسال.
  - تاب طلبات الدفع عليه رقم الطلبات المستنية.
  - على الموبايل الشريط بيتحرك أفقي.
- **الملفات:** `web/js/views/superadmin.js` (`SA_TABS`، و`openTab`، و`loadTabBadges`)، و`sa-followup.js` (رقم التاب)، و`theme.css` (`.sa-tab*`).
- **النشر (2026-11-24):** الموقع بس.

## ٧.٣٠) دعم السعودية — المرحلة 1: اختيار الدولة وكل اللي بيتغير معاها

**القرار** (من صاحب المشروع): السعودية تبقى بفصحى مبسطة، والتواريخ هجري + ميلادي، ونضيف الأنظمة السعودية للبحث القانوني. الشغل متقسّم 3 مراحل.

### اختيار الدولة
- **في التسجيل:** زرارين مصر/السعودية في `signup.html` و`signup.js`.
  - الاختيار التلقائي: `?country=SA` في اللينك، أو جهاز على توقيت `Asia/Riyadh`.
  - التسجيل بيعمل `office_settings` فيها `country/currency/vat_rate`، و`offices.timezone`.
- **في الإعدادات:** كارت «🌍 دولة المكتب» في تبويب معلومات المكتب (`views/settings.js`).
  - التحويل بيغيّر العملة والضريبة، والتوقيت في السيرفر (`routes/settings.js`)، وبعدين بيعيد تحميل الصفحة.
  - المبالغ القديمة مبتتحوّلش.
- **قاعدة البيانات:** `migrations/043_office_country.sql`، وفيها `office_settings.country` وقيمتها الافتراضية `EG`.

### السيرفر
- `worker/lib/country.js`:
  - `COUNTRIES` (العملة، والضريبة، والتوقيت، وكود الاتصال).
  - `officeCountry(env, officeId)`.
  - `localizeLegalPrompt(text, country)`: بتحوّل تعليمات الذكاء الاصطناعي لسعودي (المسميات + دليل الأنظمة والجهات السعودية + فصحى + تنبيه لو مش متأكد من رقم مادة).
- **الذكاء الاصطناعي:**
  - `services/agent.js`: للمكتب السعودي من غير أداة `search_legal_db` (قاعدة النصوص مصرية).
  - `services/legal-search.js` (البحث وتوليد المستندات)، و`routes/analyze.js` (تحليل النصوص والقضايا، والسعودي من غير المواد المصرية)، و`routes/tools.js`.
- **الموبايل** (`lib/phone.js`):
  - `normalizeStoredPhone(phone, country)`: الرقم المحلي 05… في السعودية بيتحفظ +9665….
  - `phoneVariants`: الدخول بـ 05… أو 5… بيلاقي +9665….
  - `routes/team.js`: بيقبل الأرقام السعودية والدولية.
- **إخفاء البيانات** (`lib/redact.js`): الهوية/الإقامة 10 أرقام والموبايل السعودي.

### الواجهة
- `web/js/country.js`:
  - `country()` و`countryInfo()` و`isSaudi()`.
  - `fmtDay` (ميلادي · هجري أم القرى) و`hijriDate` و`dateLocale`.
  - بيخفي الأعلام على ويندوز (`html.no-flags`).
- `ui.js`:
  - `setOfficeMoneyPrefs` بيحفظ الدولة.
  - `defaultVat` بيرجع ضريبة الدولة.
  - `fmtDate` بقى ميلادي · هجري.
- `api.js`: `clearSession` بيمسح دولة وعملة وضريبة المكتب اللي خرج.
- `main.js`: لو الدولة اتغيرت بعد ما الإعدادات اتحمّلت، القايمة والشاشة الحالية بيتبنوا تاني.
- **المحاكم وأنواع القضايا** (`case-types.js`):
  - `CASE_TYPE_GROUPS_SA` و`DEGREE_GROUPS_SA`: القضاء العام، والاعتراض، وديوان المظالم، وقبل التقاضي.
  - الدرجة الافتراضية: «المحكمة العامة».
  - **محتاجة مراجعة من محامي سعودي.**
- **التواريخ:**
  - كل `ar-EG-u-nu-latn` بقت `dateLocale()`.
  - الهجري ظاهر في: الرئيسية، والأجندة (عناوين الأيام، وتفاصيل الموعد، ورقم اليوم الهجري في خانات عرض الشهر `.ag-hday`)، ورسايل واتساب.
- **المسميات:** «رقم الهوية / الإقامة»، و«رقم القضية (ناجز)»، وأمثلة الموبايل 05…، وعملة التصدير (`exporter.js`)، ومرتب المحامين بعملة المكتب.
- **البحث القانوني:** الروابط الرسمية السعودية (ناجز، وهيئة الخبراء، وديوان المظالم…)، والأسئلة المقترحة بالأنظمة.
- **حاسبة الرسوم:** مخفية للسعودية (`access.js` في `canView`).

### الاختبار
- على جهازي:
  - تسجيل مكتب سعودي من الشاشة: اتحفظ +966… والرياض وSAR و15%.
  - الرئيسية فيها الهجري، والمحاكم والأنواع سعودية، والهوية، وواتساب على 966، والعملة ر.س، والأجندة فيها الهجري.
  - الدخول بالرقم المحلي 05… اشتغل، والتحويل من السعودية لمصر وبالعكس اشتغل.
  - جولة كاملة بمكتب مصري من غير أي تغيير أو خطأ.
- إجابات الذكاء الاصطناعي نفسها ما اتجرّبتش محلياً، لأن مفاتيح الذكاء الاصطناعي مش متاحة على الجهاز.

### النشر (2026-11-25)
- نسخة احتياطية: `backups/before-043-20261125-0616.sql`.
- 043 اتطبق على قاعدة البيانات الحقيقية (17 مكتب كلهم EG).
- السيرفر نسخة `f50c1fad`.
- صفحة التسجيل الحقيقية اتأكدت (`?country=SA`).

### الجاي
- **المرحلة 2:** نصوص الشاشات بالفصحى المبسطة للمكاتب السعودية (شاشة شاشة).
- **المرحلة 3:** نصوص الأنظمة السعودية من هيئة الخبراء، في قاعدة البيانات والبحث الدلالي.
- **بعدين:** الفاتورة الإلكترونية (ZATCA): الرقم الضريبي ورمز QR.

## ٧.٣١) دعم السعودية — المرحلة 2: الفصحى المبسطة للمكاتب السعودية

- **الفكرة:** النظام فيه حوالي 540 جملة بالعامية المصرية في 25 شاشة. بدل ما نعدّل كل جملة، عملنا طبقة عرض `web/js/msa.js` بتشتغل **للمكاتب السعودية بس** (`startMSA()` في `main.js`، وبتتقفل لوحدها للمكتب المصري).
- **القاموس:**
  - `PHRASES`: عبارات كاملة الأول، زي «اللي فضل معاك» ← «المتبقي لديك» و«مفيش موكل عليه فلوس» ← «لا توجد مستحقات على الموكلين».
  - أفعال المبني للمجهول: «اتحفظت القضية» ← «تم حفظ القضية»، و«اتحفظ» لوحدها ← «تم الحفظ».
  - النفي (`NEGATION`): «مش هيتخصم» ← «لن يتخصم»، و«مش بتتحسب» ← «لا تتحسب».
  - `WORDS`: كلمات (دلوقتي/النهارده/عشان/هيتم/بيظهر… وكمان جوال ونموذج).
  - `POST`: ترتيب «بعد» في آخر الجملة.
- **بتغطي:** النصوص في الصفحة، و`placeholder/title/aria-label`، و`confirm/alert/prompt`، ورسايل الأخطاء من السيرفر (بتظهر في التوست). بتشتغل بـ `MutationObserver`.
- **مبتلمسش:**
  - خانات الكتابة، والشات ونتايج الذكاء الاصطناعي (`.chat-messages` …)، ومعاينة رسايل المتابعة.
  - الـ `option` اللي من غير `value`، لأن النص نفسه هو القيمة اللي بتتحفظ.
- **ترحيب الشات:** للسعودية بقى بالفصحى ومن غير ذكر قاعدة القوانين المصرية (`chatWelcome` في `search.js`).
- **لو جملة طلعت ركيكة:** نضيف لها عبارة كاملة في `PHRASES`، من غير ما نلمس الشاشة نفسها.
- **الاختبار:**
  - 9 شاشات أساسية بمكتب سعودي، ومفيش أي كلمة عامية ظاهرة.
  - جولة كاملة للمكتب السعودي من غير أخطاء.
  - المكتب المصري من غير أي تغيير.
  - على الموقع الحقيقي: القاموس شغال.
- **النشر (2026-11-25):** الموقع بس.

## ٧.٣٢) دعم السعودية — المرحلة 3: نصوص الأنظمة السعودية + التاريخ الهجري في النظام كله

### نصوص الأنظمة (1,559 مادة)
- **المصدر:** جريدة أم القرى الرسمية (uqn.gov.sa)، كنص HTML نضيف.
  - laws.boe.gov.sa مقفول برا السعودية (اتجرّب من الجهاز ومن Cloudflare القاهرة، ورجّع 522).
  - ملفات PDF (وزارة العدل والجمعية القضائية) حروفها بتطلع بايظة، فاترفضت.
- **الأنظمة** (اتنزّلت في `laws-sa/`، والفولدر ده متجاهل في git):

| النظام | المواد | صفحة الجريدة |
|---|---|---|
| نظام الإثبات | 129 | p=18818 |
| نظام المعاملات المدنية | 721 | p=23125 |
| نظام الأحوال الشخصية | 252 | p=19139 |
| نظام الشركات | 281 | p=19697 |
| الأدلة الإجرائية لنظام الإثبات | 135 | p=20767 |
| لائحة نظام الأحوال الشخصية | 41 | p=27013 |

- **السكربت:** `scripts/sa-laws/build-sa-laws.mjs`، ومعاه `uqn-search.mjs` و`uqn-list-laws.mjs`.
  - بيحوّل الأرقام الترتيبية لأرقام (`ordinalToNumber`).
  - فحص صارم: العدد مطابق، والتسلسل كامل، ومفيش حروف بايظة، ومفيش عناوين أبواب لازقة.
  - اتعالجت غلطتين مطبعيتين في الجريدة نفسها، في عنوان المادة 218 («المالتين») والمادة 228 (من غير «بعد») من نظام الشركات.
- **قاعدة البيانات:** `migrations/044_law_articles_country.sql` (`law_articles.country`، والمصري `EG`).
- **البحث** (`services/legal-search.js`): كل الاستعلامات بقت مفلترة بالدولة (`findRelevantArticles`، و`keywordArticles`، والبحث المصري و`fallbackSearch`).
- **المكتب السعودي:**
  - `legalSearch` بيجيب المواد السعودية ويستشهد بيها.
  - أداة `search_legal_db` في الشات بترجع، والوصف بتاعها اتغيّر للأنظمة السعودية.
  - تحليل القضايا بيستخدم المواد السعودية.
  - `SA_GUIDE` في `lib/country.js` بقى بيقول إن النصوص المرفقة سعودية رسمية.
- **الفهرسة:** `reindex-laws` بقى بيقبل `country` (فهرسة دولة واحدة بس)، والـ metadata فيها `country`.

### التاريخ الهجري
- **الإعداد:** «📅 عرض التاريخ في النظام»، في الإعدادات ← معلومات المكتب.
  - القيم: هجري / ميلادي / هجري وميلادي، ومتخزنة في `office_settings.date_format`.
  - الافتراضي: **السعودية هجري، مصر ميلادي**.
  - تغيير الدولة بيرجّع التاريخ للافتراضي.
- **`country.js`:** `dateMode` و`setDateMode` و`fmtDay` حسب الوضع، و`fmtDayShort`.
- **`date-dom.js`** (جديد):
  - أي تاريخ `YYYY-MM-DD` ظاهر في الصفحة بيتعرض هجري.
  - تحت كل خانة `input[type=date]` بيظهر «🌙 الخميس، 1 رجب 1448 هـ».
  - مبيلمسش خانات الكتابة والشات والتقويم.
- **الأجندة:** العنوان («جمادى الأولى – جمادى الآخرة 1448 هـ»)، وأرقام الأيام في الشهر هجري، وأول الشهر الهجري متعلّم، ورأس الأسبوع، وقايمة الأيام.
- **الرئيسية وواتساب:** بالهجري.
- **التخزين:** دايماً ميلادي، والتحويل عرض بس.
- **ملحوظة:** شبكة عرض الشهر في الأجندة لسه بالشهر الميلادي (المكتبة كده)، بس الأرقام والعنوان هجري. والشهور المالية في التقارير ميلادية.

### الاختبار
- استرجاع المواد مفلتر بالدولة: سؤال الخطبة جاب المادة 4 من نظام الأحوال الشخصية، والسؤال من مكتب مصري مجابش ولا مادة سعودية.
- التاريخ: الوضع الافتراضي هجري، والتبديل لـ«الاتنين» و«ميلادي» من الإعدادات شغال، والمكتب المصري من غير تغيير.
- جولة كاملة للمكتبين من غير أخطاء.

### النشر (2026-11-25)
- نسخة احتياطية: `backups/before-044-20261125-0702.sql`.
- 044 اتطبق، والـ 1,559 مادة اتضافت (EG 5,828 من id 6، وSA 1,559 من id 5834).
- السيرفر نسخة `8afef79b`، والموقع اتنشر.
- **لسه:** فهرسة المواد السعودية للبحث الدلالي محتاجة دخول سوبر أدمن: `POST /api/superadmin/ai/reindex-laws {country:'SA', after_id:0, limit:50}` بالتكرار لحد `done`. ولحد ما تتعمل، البحث السعودي شغال بالكلمات.
- **أنظمة لسه ناقصة** (مش على الجريدة كنص، ومصدرها هيئة الخبراء المقفول): المرافعات الشرعية، والإجراءات الجزائية، والعمل، والمحاكم التجارية، والتنفيذ.

## ٧.٣٣) أسعار السعودية بالريال + فهرسة الأنظمة السعودية

### الأسعار

**الأساس:** أسعار المنافسين في السعودية (شهري):

| المنافس | الأساسية | المتوسطة | الكبيرة |
|---|---|---|---|
| محكام | 199 | 499 | 999 |
| مكين | 149 | 549 | 1,190 |
| ProBase | 399 | 899 | — |
| قوفي | 350 | — | — |

**أسعار مُوكِّل** (`migrations/045_plan_price_sar.sql`، العمود `plan_features.price_sar`):

| الباقة | السعر بالريال |
|---|---|
| الأساسية | 149 / شهر |
| الاحترافية | 299 / شهر |
| المتقدمة | 599 / شهر |
| التأسيس (مدى الحياة) | 3,999 |
| المكتب المتكامل (مدى الحياة) | 7,999 |

- **API:** `GET /api/subscription/plans` بقى بيرجّع `price_sar`.
- **صفحة الباقات** (`pricing.html` و`pricing.js`):
  - فيها اختيار مصر/السعودية.
  - الدولة بتتحدد لوحدها بالترتيب ده: `?country=SA` في اللينك، أو اختيار قديم، أو دولة المكتب، أو جهاز على توقيت الرياض.
  - زرار التسجيل بيروح على `/signup?plan=X&country=SA`.
  - لو المستخدم داخل بحسابه، الزرار بيفتح واتساب الدعم.
- **صفحة الاشتراك جوه البرنامج** (`views/subscription.js`): للمكتب السعودي بالريال، والزرار «💬 اشترك عبر واتساب».
- **صفحة الدفع** (`pay.js`): للمكتب السعودي بتخفي طرق الدفع المصرية، وبتظهر كارت السعر بالريال وزرار واتساب. ده لحد ما يتعمل دفع سعودي (تحويل بنكي أو STC Pay).
- **لسه محتاج قرار:** الأسعار تتكتب شاملة ضريبة القيمة المضافة 15% ولا لأ.
- **النشر (2026-11-25):**
  - نسخة احتياطية: `backups/before-045-20261125-0718.sql`.
  - السيرفر نسخة `f23fbe78`، والموقع اتنشر.
  - اتأكدت على الموقع الحقيقي إن `?country=SA` بيعرض 149/299/599 ر.س.

### الفهرسة
- **السعودي:** الـ 1,559 مادة اتفهرست للبحث الدلالي من دخول السوبر أدمن (`reindex-laws` مع `country: 'SA'`). عدد الفهرس بقى 4,909 = 3,350 + 1,559.
- **ملاحظة قديمة:** الفهرس فيه 3,350 بس من الـ 5,828 مادة مصرية. حوالي 2,478 مادة مصرية بتتلاقى بالكلمات بس. ممكن تكمل بـ `reindex-laws` مع `country: 'EG'`.

## ٧.٣٤) أسعار كل دولة لوحدها + المكاتب السعودية في السوبر أدمن + اكتمال الفهرس

- **صفحة الباقات:** اختيار مصر/السعودية اتشال، والزائر بيشوف أسعار دولته بس. الدولة بتتحدد من `web/js/region.js` (`detectVisitorCountry`) بالعلامات دي بالترتيب:
  1. `?country=` في اللينك.
  2. دولة المكتب (لو داخل بحسابه).
  3. «سعودي» اتعرف عنه قبل كده.
  4. لغة الجهاز `xx-SA` أو توقيت الرياض.
  5. دولة الاتصال من Cloudflare (`GET /api/geo`، endpoint عام في `routes/signup.js`).

  لو مفيش أي علامة منهم، الدولة مصر.
- **التسجيل:** نفس طريقة الكشف، ولو الرقم سعودي (05… / +966…) الدولة بتتحول سعودية لوحدها، إلا لو المستخدم اختار بنفسه (`isSaudiPhone`).
- **الحالة الوحيدة اللي مش بتتكشف:** سعودي في مصر بجهاز مش سعودي ونت مصري. ده بيشوف المصري في صفحة الباقات، وبيتحوّل لما يكتب رقمه السعودي في التسجيل.
- **السوبر أدمن:**
  - فلتر الدولة في المكاتب (`GET /api/superadmin/offices?country=SA`).
  - شارة الدولة جنب اسم المكتب.
  - شارة 🇸🇦 في متابعة التجربة.
- **الفهرس:** فهرسة المواد المصرية كملت (5,828 في 7.5 دقيقة)، وعدد الفهرس بقى **7,387** = كل المواد المصرية والسعودية.
- **النشر (2026-11-25):** السيرفر نسخة `209ef637`، والموقع اتنشر. `/api/geo` من مصر بيرجّع `EG`.

## ٧.٣٥) استكمال الأنظمة السعودية + الأسعار شاملة الضريبة + بحث الدفع السعودي

- **الأسعار:** الأسعار السعودية شاملة ضريبة القيمة المضافة 15%. اتكتب ده تحت كل سعر في صفحة الباقات (`.plan-vat-note`) وفي رسالة الاشتراك على الواتساب.
- **الأنظمة السعودية:** 344 نظام ولائحة فيهم 14,771 مادة، بدل 6 أنظمة فيهم 1,559 مادة. كل النصوص من مصادر رسمية:
  - **هيئة الخبراء (laws.boe.gov.sa):**
    - الموقع مقفول برا السعودية، فبنجيب نسخة أرشيف الإنترنت من نفس الصفحة: `scripts/sa-laws/fetch-boe-wayback.mjs`.
    - التحويل لمواد بيتم بـ`build-boe-laws.mjs`، وبياخد النص الساري بس من غير نافذة «تعديلات المادة».
    - الناتج: 305 نظام ولائحة سارية فيهم 11,475 مادة.
    - قايمة أرقام الأنظمة جت من `sources.csv` في مجموعة SaudiArabicLaws على Hugging Face. النصوص نفسها مش منها، لأن ترخيصها NC-ND.
  - **البوابة القانونية لوزارة العدل (laws.moj.gov.sa):**
    - مفتوحة من مصر. السكربت `build-moj-laws.mjs` بيستخدم نفس الـAPI اللي الموقع بيستخدمه (`get-Statute-gateway-Detail`).
    - الناتج: 33 لائحة وقاعدة عدلية فيهم 1,737 مادة، منهم:
      - اللوائح التنفيذية للمرافعات (576 بند بصيغة ١/٣).
      - اللائحة التنفيذية للمحاكم التجارية، والتنفيذ، والمحاماة 1446.
      - قواعد السلوك المهني للمحامين، ولائحة التفتيش القضائي.
  - **قراءة أرقام المواد:** في `ordinal.mjs` (`articleNumber`). بيفهم صيغ الجر، و«(1)»، و«رقم (1)»، والعنوان بعد الرقم، والواو الناقصة، و«مكرر».
  - **أنظمة متجابتش:**
    - مالهاش نسخة في الأرشيف: حماية الطفل، وتملك غير السعوديين للعقار (نسخة الهيئة).
    - الصفحة المحفوظة مفيهاش مواد: الخدمة المدنية، والتقاعد المدني، وغيرهم (20 نظام).
  - النصوص اللي في الواجهة ورسائل الذكاء الاصطناعي اللي كانت بتقول «المتاح: الإثبات، المعاملات…» اتحدّثت.
- **النشر (2026-11-25):**
  - نسخة احتياطية قبل التحميل: `backups/pre-sa-laws-more-2026-11-25.sql`.
  - اتحمّل 13,212 مادة على قاعدة البيانات الحقيقية (id من 7393 لـ20604).
  - السيرفر نسخة `e8268ff6`، والموقع اتنشر.
  - الفهرسة الدلالية للمواد الجديدة: `reindex-laws {country:'SA', after_id:7392}`.
- **الدفع السعودي (بحث، لسه متنفذش):**
  - **دلوقتي:** تحويل بنكي دولي من بنك العميل السعودي على حساب مصري (IBAN/SWIFT)، مع إيصال وموافقة من السوبر أدمن.
  - **بعدين:** Paddle (بيبيع بالنيابة عننا وبيتحمل الضريبة). الدفع بالدولار لأن الريال مش مدعوم عنده، والتحويل بيوصل على حساب مصري أو Payoneer.
  - **مش مناسبة دلوقتي:** البوابات السعودية (Moyasar وTap وPaymob KSA)، لأنها محتاجة سجل تجاري سعودي.

## ٧.٣٦) مزودين ذكاء اصطناعي مجانيين أكتر

- **Mistral وCerebras اتضافوا** على Gemini وGroq وOpenRouter وWorkers AI. الكود في `worker/services/model-discovery.js` و`llm.js`.
  - المفاتيح: `MISTRAL_API_KEY` و`CEREBRAS_API_KEY`، والاتنين اختياريين. أي مزود مالوش مفتاح بيتخطّى لوحده.
  - الترتيب: Gemini ← Mistral ← Cerebras ← Groq ← النماذج التانية لكل مزود ← OpenRouter ← Workers AI.
  - كل مزود بيتسأل عن قايمة نماذجه بنفسه (`discoverMistral` و`discoverCerebras`)، ومفتاح كاش الاكتشاف اتغير لـ`llm:models:v2`.
- **حماية بيانات الموكلين:** `noClientData` بيستبعد Mistral وOpenRouter من `route: 'balanced'` (أي طلب فيه بيانات موكلين)، لأن خطتهم المجانية بتدرّب على المدخلات.
  - ملحوظة: شروط Gemini المجاني كمان بتسمح بتحسين المنتجات من المدخلات. لسه مسموح في `balanced` زي ما كان، والقرار متساب لصاحب المشروع.
- **429:** النموذج اللي حصته خلصت بيدخل فترة تبريد (`retry-after` أو 60 ثانية)، والطلبات الجاية بتعدّيه.
- **نماذج OpenAI اللي بتفكر (gpt-5 وo3):** بتاخد `max_completion_tokens` ومن غير `temperature` (`tokenParams`).
- **فحص السوبر أدمن:**
  - `?refresh=0` بيفحص من غير إعادة اكتشاف.
  - فيه ثانية بين أي طلبين لنفس المزود، عشان حد Mistral طلب واحد في الثانية.
- **GitHub Models اتشال:** الخدمة اتقفلت نهائياً في 30/7/2026، وبترد «OK» نص عادي على أي طلب. ممكن تمسح `GITHUB_MODELS_TOKEN` بأمان.
- **حالة المفاتيح (2026-11-25):**
  - Mistral: المفتاح مقبول (المفتاح الغلط بيرجّع 401 حتى من سيرفرات Cloudflare)، بس الحساب بيرجّع 429 كود 1300 مع كل طلب، رغم إن رصيده المجاني الشهري (10$) لسه ماتستخدمش. محتاج يتراجع من لوحة Mistral (تأكيد رقم الموبايل أو نوع المفتاح).
  - Groq: السر موجود بس قيمته فاضية، ومفيش مفتاح في console.groq.com.
  - Cerebras: لسه متحطش.
  - Gemini 3.6 flash وصل للحصة اليومية (429).
- **النشر:** السيرفر نسخة `20330f68`.

## ٧.٣٧) تقليل قراءات D1 (الحد المجاني 5 مليون صف في اليوم)

- **اللي حصل (2026-11-25):**
  - الإجمالي: 11.7 مليون صف اتقرا في 24 ساعة، والحد 5 مليون.
  - منهم 10.7 مليون من `reindexLaws`، لأن كل دفعة كانت بتعمل `COUNT(*)` على `law_articles` كلها (~20 ألف صف) مرتين.
  - الاستخدام العادي للنظام حوالي 200 ألف صف في اليوم.
- **التصليح:**
  - **`reindexLaws`:** التقدّم بقى بالـ id (`last_id`)، و`MAX(id)` بتقرا صف واحد. الواجهة بقت بتعدّ بنفسها، ولو وقفت بتكمّل من آخر مادة (`reindexAfter`).
  - **`lib/citations.js`:** فهرس القوانين بيتحفظ في KV (`citations:index:v1`) يوم كامل، وفي الذاكرة ساعة.
    - قبل كده كل isolate جديد كان بيقرا الجدول كله (20,604 صف).
    - لو اتضافت قوانين: `resetCitationIndex(env)`.
- **لمعرفة أكتر الاستعلامات استهلاكاً:**
  ```
  wrangler d1 insights mowakkil-db-v2 --sort-type sum --sort-by reads --limit 12 --timePeriod 1d --json
  ```
- **معلّق:** التحقق من الاستشهادات بيتعرف على «المادة X من قانون Y» بس، ومش بيتعرف على «من نظام Y» السعودية.
- **النشر:** السيرفر نسخة `eb35e966`، والموقع اتنشر.

## ٧.٣٨) التحقق من الاستشهادات السعودية + توقف D1 يوم 2026-11-25

- **`lib/citations.js`:**
  - بيتعرف على «من نظام / لائحة / اللوائح / قواعد / ضوابط».
  - بيقرا رقم المادة لو مكتوب بالحروف («الرابعة والثمانين») من `worker/lib/ordinal.js`، اللي اتنقل من `scripts/sa-laws` والسكربتات بقت بتستورده منه.
  - بيتعرف على بنود اللوائح «1/3»، وبيعتبر المفرد والجمع واحد («لائحة» = «لوائح»).
  - كل مكتب بيتراجع على قوانين دولته بس: `verifyText` و`verifyResult` بياخدوا `{ country }`، وفهرس KV بقى `citations:index:v2` وفيه دولة كل قانون.
  - العبارات اللي مفيهاش رقم («المادة المذكورة») بتتساب.
  - اسم القانون بيقف قبل «والمادة…»، عشان استشهادين في نفس الجملة ميتلزقوش في بعض.
- **الدولة بتتبعت من:** `chat.js`، و`analyze.js` (التحليل وتحليل القضية)، و`legal-search.js` (`withCitationCheck`).
- **التوقف:** يوم 2026-11-25 Cloudflare وقّفت D1 لما الحساب عدّى الحد المجاني اليومي للقراءة، بسبب الفهرسة (القسم ٧.٣٧).
  - الخطأ في السجل: `D1_ERROR: ... exceeded D1's free tier daily row read limit`.
  - اللي بيوصل للمستخدم: «حصل خطأ في السيرفر».
  - الحل: يا إما الانتظار لحد منتصف الليل UTC، يا إما الترقية لـWorkers Paid (5$ في الشهر). صاحب المشروع اختار الانتظار.
- **النشر:** السيرفر نسخة `dc52a160`.

## ٧.٣٩) شرح الصفحات: أيقونة ❓ + جولة تفاعلية + فيديوهات يوتيوب

- **أيقونة ❓ فوق** (`#help-btn`، `web/js/help.js`). بتفتح قايمة فيها:
  - جولة سريعة في الصفحة.
  - فيديو الصفحة على يوتيوب، وبيشتغل في نافذة جوه النظام (youtube-nocookie). لو الصفحة مالهاش فيديو بيظهر لينك القناة بداله.
  - واتساب الدعم.
- **تلميح أول زيارة:** «أول مرة هنا؟» بيظهر مرة واحدة لكل صفحة (`mowakkil_tour_seen_<view>` في localStorage).
- **محرك الجولة (`web/js/tour.js`):**
  - نور على العنصر وسهم بيتحرك وفقاعة شرح.
  - بيستنى العنصر يثبت قبل ما يرسم (النوافذ بتفتح بحركة)، وبيتابعه لو اتحرك.
  - Esc بيقفل الجولة، والأسهم بتتنقل بين الخطوات.
  - وضع autoplay للفيديو: بيمشي لوحده، ومؤشر وهمي بيدوس ويكتب بيانات تجريبية (`type`، وممكن تبقى دالة للتواريخ).
- **المحتوى:**
  - `web/js/tours.js` بالمصري: 6 صفحات (القضايا 20 خطوة، الأجندة 14، الموكلين 13، الأتعاب 14، المساعد القانوني 11، الإعدادات 12). الجولة بتفتح الفورم الحقيقي من غير ما تحفظ حاجة.
  - `web/js/tours-msa.js`: فصحى مكتوبة بإيد للسعودية، لازم تفضل بنفس ترتيب الخطوات وعددها. لو العدد اختلف بيرجع للتحويل التلقائي.
  - `web/assets/tour.css`.
- **الفيديوهات:**
  - اتسجلت أوتوماتيك بالسكربت `record-tour.mjs` (puppeteer + MediaRecorder لتسجيل التاب بصيغة WebM، 1280×720 headless).
  - التسجيل كان على مكتب تجريبي محلي ببيانات وهمية.
  - الملفات في `videos/` وGit بيتجاهلها، وفي `videos/YOUTUBE.md` العناوين والأوصاف.
  - على قناة @mowakkil، واللينكات في `web/js/tour-videos.js`.
- **عشان تضيف شرح صفحة جديدة:**
  1. ضيف خطواتها في `tours.js` و`tours-msa.js`.
  2. سجّل الفيديو.
  3. حط الـID بتاعه في `tour-videos.js`.
- **النشر:** 2026-11-26.

## ٧.٤٠) الشرح لكل الصفحات + التابات

- **`web/js/tours-more.js` فيه 10 صفحات جديدة:**
  - لوحة التحكم: بتدوس على تابات الفترة.
  - المهام.
  - المحامين.
  - فلوس المكتب.
  - المصاريف: الفورم كامل، وصرف المرتبات.
  - الفواتير: تابات الحالة.
  - الربحية: تابات الفترة.
  - التقارير.
  - حاسبة الرسوم: بتحسب فعلاً.
  - الفريق والصلاحيات.
- **تفاصيل التابات في الجولات القديمة:**
  - ملف القضية (`#case-detail-modal`): 7 تابات.
  - الأجندة: عرض الأسبوع واليوم والقائمة.
  - المساعد القانوني: تاب التحليل وتاب توليد المستندات.
  - الإعدادات: الإشعارات، ونص رسايل واتساب، والمظهر، وأوضاع الخصوصية الثلاثة، والتخزين.
- **الفصحى:** الخطوات الجديدة فيها `sa: [عنوان, شرح]` جوه الخطوة نفسها. الخطوات القديمة اللي مالهاش `sa` بتاخد نصها من `tours-msa.js` بالترتيب (`msaFor` في `tour.js`).
- **التأكد من الفصحى:** `check-tours.mjs` بيتأكد إن كل خطوة في الـ16 صفحة ليها فصحى.
- **الفيديوهات:**
  - اتسجل 14 فيديو جديد/متحدّث (`videos/`). العناوين في `YOUTUBE.md` تحت «الدفعة التانية».
  - الأجندة الجديدة اترفعت: `wNWxejNvo9o`.
  - الباقيين مستنيين حد يوتيوب اليومي.
  - أي صفحة مالهاش فيديو بيظهر فيها لينك القناة.
- **النشر:** 2026-11-26.

## ٧.٤١) زرار «شرح» العائم بدل أيقونة ❓

- **الأيقونة اتشالت من الشريط العلوي**، لأن العملاء ممكن ميفهموش إنها للشرح.
- **الزرار الجديد (`.help-fab#help-btn`، بيتعمل من `help.js`):**
  - كبسولة كحلي بإطار ذهبي، فيها أيقونة تشغيل وكلمة «شرح» ظاهرة دايماً.
  - مكانه فوق زرار واتساب الدعم (`.support-fab`)، وبيتبعه لو اتحرك (شريط الموبايل السفلي).
  - بيظهر جوه النظام بس، وبيختفي وقت الجولة أو أي نافذة فيديو أو بحث.
- **القايمة والتلميح:** القايمة («جولة سريعة» + «فيديو الشرح» أو لينك القناة) وتلميح أول زيارة بيفتحوا فوق الزرار. واتساب اتشال من القايمة لأن زراره تحتها على طول.
- **ملحوظة:** كارت الختام في الفيديوهات المسجّلة لسه مكتوب فيه «دوس ❓». ده هيتصلّح لو الفيديوهات اتسجلت تاني.
- **النشر:** 2026-11-26.

## ٧.٤٢) فحص عام + تنبيهات + CORS + تنضيف (2026-11-26)

- **الفحص العام:**
  - syntax لكل ملفات الـJS سليم.
  - لفّة (`audit-crawl.mjs`) على 26 صفحة بالتابات بـ4 مستخدمين: أدمن مصري، أدمن سعودي، موبايل، محاسب.
  - النتيجة: مفيش أخطاء JS ولا 5xx ولا «undefined/NaN» ولا سكرول بالعرض ولا ردود بطيئة.
- **الخطأ اللي اتصلّح:** الأدوار المحدودة كانت بتطلب حاجات ممنوعة (403).
  - `offline.js` بقى بيستنى الصلاحيات (`loadAccess().finally(startOffline)`) وبيتخطى الممنوع.
  - لوحة التحكم بتجيب الأجندة لو `agenda.view` بس.
  - تابات المستندات والمهام في ملف القضية بتستخبى من غير صلاحية.
- **التنبيهات (`worker/lib/monitor.js`):**
  - امتى بيبعت:
    - D1 وقفت (الحصة خلصت أو مش بترد) → فوري.
    - أكتر من 15 خطأ في 10 دقايق.
    - كل نماذج الذكاء الاصطناعي فشلت 5 مرات في نص ساعة.
    - cron كل نص ساعة (`*/30 * * * *`) بيعمل `SELECT 1`.
  - التكرار ممنوع عن طريق KV، والسجل في `mon:alerts`، ومفيش بيانات موكلين.
  - القنوات (secrets): `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`، أو `NTFY_TOPIC` (تطبيق ntfy، اسم موضوع طويل وعشوائي).
  - تاب «🚨 التنبيهات» في السوبر أدمن: `GET /api/superadmin/alerts`، و`POST /api/superadmin/alerts/test`.
  - **لسه مفيش قناة متظبطة.**
- **CORS:** `ALLOWED_ORIGINS` = الموقع وروابط المعاينة (`https://*.mowakkil-2026.pages.dev`). `cors()` بيدعم النجمة. تطبيق الأندرويد (TWA) بيفتح نفس الموقع.
- **التنضيف:** اتمسح 8 صور مش مستخدمة (~5MB). اتسابوا:
  - `favicon.svg` و`web-app-manifest-512x512.png`: الأندرويد بيستخدمهم.
  - `logo-original.png` و`logos/logo-transparent.png`: `generate-logos.py` بيستخدمهم.
- **اقتراحات مفتوحة:**
  - Workers Paid (5$) و Time Travel 30 يوم.
  - مفاتيح Groq/Cerebras.
  - إعادة كتابة الاختبارات (`tests/` مكتوبة على schema قديم، ومفيش vitest config للـworkers).
  - التحويل البنكي السعودي.
- **النشر:** السيرفر نسخة `1e6c8246`، والموقع اتنشر.

## ٧.٤٣) التعديل والحذف لكل السجلات (2026-11-27)

- **السبب:** عميلة اشتكت إن الجلسات مفيهاش تعديل ولا حذف. لما راجعت كل نوع بيانات لقيت نفس النقص في حاجات تانية.
- **الجلسات:**
  - السيرفر: `PATCH` و`DELETE /api/sessions/:id` (التاريخ والساعة والملاحظات/القرار).
  - الحذف ممنوع لو الجلسة عليها مصاريف (409). نفس المنع اتضاف في حذف الأجندة.
  - الواجهة `web/js/session-edit.js`: أزرار في تاب الجلسات بملف القضية، و«✏️ تعديل» في تفاصيل الجلسة في الأجندة.
- **القضية:** `PATCH /api/cases/:id` بقى بيعدّل الرقم والمحكمة والدرجة والنوع والموكل. الزرار في القايمة وفي «بيانات القضية».
- **الموكل:** `PATCH /api/clients/:id` (الاسم والموبايل والرقم القومي)، والزرار في القايمة.
- **المحامي:** `PATCH /api/lawyers/:id`، والزرار في القايمة. المرتب بقى بعملة المكتب بدل «جنيه» ثابتة.
- **الأتعاب (`editFee` في `routes/fees.js`):**
  - تغيير المبلغ بيعيد قيد الأتعاب بتاريخه الأصلي، وبيحترم قفل الفترة.
  - المبلغ مينفعش يقل عن المدفوع، و`recalcFee` بيحدّث الحالة.
  - الواجهة `web/js/fee-edit.js`: في صفحة الأتعاب وتاب الأتعاب في القضية.
- **المصاريف:**
  - زرار تعديل في صفحة المصاريف (السيرفر كان جاهز).
  - حذف من تاب المصاريف في القضية بنفس `DELETE /api/expenses/:id?source=`.
  - حذف مصاريف الجلسات والمهام بقى بيحترم قفل الفترة (`entryDay` + `assertOpen`).
- **ملحوظة:** `web/js/case-detail.js` كود قديم مش مستخدم (imports بايظة). ملف القضية الحقيقي هو النافذة في `views/cases.js`.
- **الاختبار:**
  - 18 اختبار API، منهم القيد المحاسبي (`edit-api-test.mjs`).
  - 15 اختبار شاشات (`edit-ui.mjs`).
  - اللفّة الكاملة بـ4 مستخدمين: صفر مشاكل.
- **النشر:** السيرفر نسخة `8b85aca3`، والموقع اتنشر.

## ٧.٤٤) تسريع فتح الأبلكيشن على نت الموبايل (2026-11-27)

- **الشكوى:** الأبلكيشن ساعات بيعلّق والعميل بيدوس على الأيقونة أكتر من مرة. السبب كان إن الفتح بطيء على نت الموبايل الضعيف، مش إن التطبيق بيقع.
- **التصليح:**
  1. `index.html`: `modulepreload` لـ30 ملف بداية (الـ imports الثابتة من `main.js`) بدل 5 مستويات ورا بعض. لو اتضاف import ثابت جديد في البداية، ضيفه هنا.
  2. `service-worker.js`: لو الكود محفوظ والشبكة متأخرة، بيفتح بالمحفوظ بعد 1.5 ثانية بدل 4. النسخة الجديدة بتكمّل تحميل في الخلفية (`event.waitUntil`) وبتشتغل الفتحة اللي بعدها. النسخة (`res.clone`) بتتاخد قبل ما الرد يروح للصفحة.
  3. `offline.js`: تحميل القوايم للاستخدام من غير نت بيبدأ بعد 8 ثواني و`requestIdleCallback`، بدل ما يزاحم أول شاشة.
- **القياس (موبايل متوسط محاكى، الأبلكيشن متثبت):**
  - فتح يومي على 3G ضعيف: من 11.5 ثانية لـ9.
  - نت متقطع: من 13.6 ثانية لـ~7.7.
  - الموقع الحقيقي بعد النشر: الصفحة الأولى من 3.5 ثانية لـ1.75 على نت ضعيف.
- **السكربتات:** `startup-perf.mjs` و`daily-open.mjs` (بيبطّأ النت على الـ service worker نفسه، وفيه اختيار «نت متقطع»).
- **أول فتح من غير كاش** لسه ~12 ثانية على 3G، لأنه محدود بحجم الملفات (~600KB): الخطوط 4 أوزان ~250KB، وchart.js، واللوجوهات. ممكن يتحسن بعدين (وزنين خطوط بس، وchart.js وقت الحاجة).
- **مفيش APK جديد**، لأن التعديلات كلها في الموقع.

## ٧.٤٥) مراجعة المميزات الناقصة: صغرات + حقول جديدة (2026-11-27)

- **صغرات اتصلّحت:**
  - **قايمة القضايا:** بقت بتعرض «الجلسة الجاية» (`next_session` subquery، وفيه index على `sessions.case_id`).
  - **فورم «جلسة جديدة»:** اتضاف الساعة، والقايمة بتتحدث بعد الحفظ.
  - **ملف القضية:** فيه «➕ جلسة جديدة» و«➕ مهمة جديدة» جوه التابات.
  - **موكل برقم موبايل موجود:** 409 `DUPLICATE_PHONE`، والشاشة بتسأل قبل الإضافة (`allow_duplicate`).
  - **حذف موكل عنده قضايا مفتوحة أو مستحقات:** 409 `CLIENT_HAS_DATA`، والشاشة بتسأل قبل الحذف (`?force=1`).
  - **دفتر اليومية:** فلتر من/لحد. القيود الأقدم من آخر 100 ماكانش ليها أي طريقة تتشاف.
  - **ملف الموكل:** بيوضح إنه بيعرض آخر 20 دفعة وآخر 30 جلسة بس.
  - **`apiJson`:** الخطأ بقى فيه `status` و`code` و`data`.
- **الحقول الجديدة (migration 046، كلها اختيارية):**
  - **القضية:** `opponent_name` و`client_role` و`subject`. البحث بيدوّر في الخصم والموضوع، والقايمة بتعرض «ضد: …». قايمة الصفات في `clientRoles()` (مصر/السعودية).
  - **الموكل:** `email` و`address` و`notes`، مستخبيين تحت «بيانات إضافية (اختياري)».
  - **المهمة:** `notes` (التفاصيل).
- **لسه ناقص (مش مستعجل):**
  - تعديل الدفعة (البديل دلوقتي: حذف وإضافة من جديد).
  - شاشة تعديل لدليل الحسابات.
  - قيمة الدعوى.
- **الاختبار:**
  - 14 اختبار للصغرات (`gaps-test.mjs`) و14 للحقول (`fields-test.mjs`)، وإعادة اختبارات التعديل والحذف.
  - اللفّة الكاملة بـ4 مستخدمين: صفر مشاكل.
- **النشر:**
  - نسخة احتياطية قبل التغيير: `backups/pre-046-fields-2026-11-27.sql`.
  - اتعمل migration 046 على قاعدة البيانات الحقيقية.
  - السيرفر نسخة `1087eb87`، والموقع اتنشر.

## ٧.٤٦) إعادة تعيين كلمة السر من لوحة السوبر أدمن (2026-11-27)

- **السبب:** عميل نسي كلمة السر. مفيش «نسيت كلمة السر» في صفحة الدخول. صاحب المكتب كان بيقدر يغيّر كلمة سر أعضاء فريقه من صفحة الفريق، لكن لو هو نفسه نسيها مكانش فيه أي طريقة من الشاشات.
- **اللي اتعمل:** في لوحة السوبر أدمن ← ملف المكتب، اتضاف قسم «👥 مستخدمين المكتب». جنب كل مستخدم زرار «🔑 إعادة تعيين كلمة السر».
  - الزرار بيسأل الأول، وبعدين يعمل كلمة سر مؤقتة على شكل `Mw-xxxxxxxx` (من غير حروف بتتلخبط).
  - بيعرضها مع زرار «نسخ» وزرار «ابعتها واتساب» برسالة جاهزة فيها خطوات تغييرها من «حسابي».
- **في السيرفر** (`PATCH /api/superadmin/users/:id/reset-password`):
  - بقى يرجّع 404 لو المستخدم مش موجود.
  - بيفك القفل (`failed_logins = 0`, `locked_until = NULL`).
  - بيسجل في الـ audit مين عمل التغيير ولأي مكتب.
- **الاختبار:** `sa-reset-test.mjs` على عضو تجريبي محلي اتقفل حسابه بمحاولات غلط. الكلمة الجديدة دخلت، والقديمة اترفضت، وزرار الواتساب فيه الكلمة، ومفيش أخطاء.
- **النشر:** السيرفر نسخة `2ec7a721` والموقع اتنشر. على الحقيقي: الطلب من غير دخول سوبر أدمن بيرجع 403.
- **لسه:** «نسيت كلمة السر» ذاتية في صفحة الدخول (محتاجة نختار طريقة توصيل الكود: إيميل / SMS / واتساب).

## ٧.٤٧) «نسيت كلمة السر» بطلب على الواتساب (2026-11-27)

- **الطريقة اللي اختارها صاحب المشروع:** واتساب بس عن طريق طلب. مفيش خدمة إرسال، ومفيش تكلفة، ومفيش حسابات خارجية.
- **العميل:**
  - في صفحة الدخول فيه لينك «🔑 نسيت كلمة السر؟» بيفتح فورم فيه رقم الموبايل (ولو كان مكتوب في خانة الدخول بيتنقل لوحده).
  - بعد الإرسال: «طلبك وصل» وزرار «مستعجل؟ كلّمنا واتساب» على رقم الدعم.
  - للأعضاء: تلميح إن مدير المكتب يقدر يغيّرها من صفحة «الفريق».
- **السيرفر:**
  - `POST /api/auth/forgot` (عام):
    - الرد واحد `{received:true}` سواء الحساب موجود أو لأ، فمفيش كشف للحسابات.
    - طلب واحد مفتوح لكل مستخدم.
    - حد 5 طلبات/ساعة لكل IP.
    - بيبعت `alertOwner` (مفتاحه `pwreq:<id>`، مرة كل نص ساعة) وبيسجل في الـ audit.
  - `GET /api/superadmin/password-requests` و`POST /api/superadmin/password-requests/:id/dismiss`.
  - `reset-password` بيقفل أي طلب مفتوح للمستخدم لوحده.
- **السوبر أدمن:**
  - كارت «🔑 طلبات نسيت كلمة السر (عدد)» فوق التابات، مش بيظهر لو مفيش طلبات.
  - «اعمل كلمة سر» ← كلمة سر مؤقتة + «ابعتها واتساب». وفيه ✕ للتجاهل.
  - منطق إعادة التعيين بقى دالة واحدة `resetAndShow` بيستخدمها الكارت ده وملف المكتب.
- **migration 047:** جدول `password_reset_requests` (pending/done/dismissed) + 2 index.
- **الاختبار:**
  - `forgot-test.mjs`: 14 اختبار كلهم نجحوا (موبايل + سوبر أدمن + دخول بالكلمة الجديدة + القفل + التجاهل + الحماية).
  - على الحقيقي برقم مش موجود: `{received:true}` ومفيش صف اتعمل. القايمة من غير دخول بترجع 403. الفورم بيفتح من غير أخطاء.
- **النشر:** migration 047 على قاعدة البيانات الحقيقية + السيرفر نسخة `5b3a17ad` + الموقع.
- **ملحوظة:** إشعار الطلب مش هيوصل لصاحب المشروع غير لما يتظبط ntfy أو Telegram. لحد كده الطلبات بتتشاف من لوحة السوبر أدمن.

## ٧.٤٨) التنبيهات: ntfy مرفوض (429)، وتليجرام بقى بيتربط لوحده (2026-11-27)

- **المشكلة:**
  - صاحب المشروع ظبط `NTFY_TOPIC`، والتنبيه التجريبي فشل: «ntfy 429» مرتين (متسجل في KV `mon:alerts`).
  - السبب إن ntfy.sh بيحسب الحد لكل IP، وعناوين Cloudflare Workers مشتركة بين آلاف المواقع، فالرسايل من غير حساب بتترفض.
- **الحل (`worker/lib/monitor.js`):**
  - تليجرام بقى محتاج `TELEGRAM_BOT_TOKEN` بس.
  - زرار «تنبيه تجريبي» بينادي `linkTelegram`: بيقرأ `getUpdates` وياخد محادثة آخر حد بعت للبوت (المفروض صاحب المشروع بعد Start)، ويحفظها في KV `mon:tg_chat`.
  - لو محدش بعت للبوت، بيرجع «افتح البوت واضغط Start».
  - `TELEGRAM_CHAT_ID` اليدوي لسه شغال لو اتحط، وليه الأولوية.
  - ntfy: رسالة الـ 429 بقت واضحة وبتقول استخدم Telegram، واتضاف `NTFY_TOKEN` اختياري (Bearer) لو حد عمل حساب ntfy.
- **الاختبار:** `tg-unit.mjs` بـ fetch وهمي (من غير رسايل حقيقية)، 5 اختبارات نجحوا:
  - الربط بعد Start.
  - التنبيه بيروح للمحادثة الصح.
  - رسالة الخطأ لو محدش بعت للبوت.
  - ntfy 429 مبيوقفش تليجرام.
- **النشر:** السيرفر نسخة `07358a8b`. زرار التجربة من غير دخول بيرجع 403.
- **فاضل على صاحب المشروع:**
  1. يعمل بوت من @BotFather.
  2. يفتح البوت ويضغط Start.
  3. يشغّل `wrangler secret put TELEGRAM_BOT_TOKEN`.
  4. يضغط «إرسال تنبيه تجريبي».
  5. اختياري: `wrangler secret delete NTFY_TOPIC`.

## ٧.٤٩) تعديل الدفعة + قيمة الدعوى (2026-11-28)

- **تعديل الدفعة:**
  - السيرفر: `PATCH /api/payments/:id` بيعدّل المبلغ والتاريخ وطريقة الدفع والملاحظات، عن طريق `editPayment` في `services/accounting.js`.
  - رقم الإيصال مبيتغيرش.
  - قيد الدفعة بيتمسح ويتعمل تاني بالقيم الجديدة (`(معدّلة)` في الوصف)، وبعدين `recalcFee` و`recalcInvoice` و`recalcInvoicesForFee`.
  - التاريخ القديم والجديد الاتنين لازم يكونوا برة الفترة المقفولة (423).
  - بيتسجل في الـ audit القيم قبل وبعد.
  - الواجهة: في مودال دفعات الأتعاب زرار «✏️ تعديل» (`data-edit-payment`) محكوم بصلاحية `fees.edit` في `access.js`.
- **قيمة الدعوى:**
  - migration 048: `cases.claim_amount REAL`.
  - بتتحفظ في الإضافة والتعديل، والدالة `claimAmount()` بتقبل الفواصل، والصفر أو الفاضي بيبقى null.
  - الواجهة: `#c-claim` في فورم القضية، وخانة في مودال التعديل، والقيمة بتظهر في نظرة عامة ملف القضية.
- **الاختبار:**
  - `payedit-test.mjs`: 15 اختبار كلهم نجحوا. بيغطّوا:
    - المدفوع والباقي.
    - قيد واحد بالمبلغ والتاريخ الجديد.
    - رفض المبلغ الصفر.
    - الفترة المقفولة.
    - قيمة الدعوى ومسحها.
    - الشاشات.
  - اللفّة الكاملة (ALL=1): TOTAL 0.
- **النشر:**
  - نسخة احتياطية قبل التغيير: `backups/pre-048-claim-2026-11-28.sql`.
  - migration 048 على قاعدة البيانات الحقيقية (العمود اتأكد).
  - السيرفر نسخة `eb071405`، والموقع اتنشر.
  - على الحقيقي: PATCH من غير دخول بيرجع 401، والملفات الجديدة بتتحمل من غير أخطاء.

## ٧.٥٠) بحث المفاتيح المجانية الحالي + NVIDIA + Cloudflare gpt-oss (2026-11-28)

- **بحث (نوفمبر 2026)، مصادره مواقع بتجمع معلومات، والأرقام بتتغير:**
  - **مبقاش فيهم مجاني فعلي:**
    - DeepSeek الرسمي: مفيش free tier منشور.
    - Qwen/Alibaba: مليون توكن مرة واحدة لمدة 90 يوم (سنغافورة)، والـ OAuth المجاني اتقفل 4/2026.
    - Cerebras: بقى 5 دولار بكارت، بتخلص في 30 يوم.
    - SambaNova: 20 طلب في اليوم، وممكن يطلب كارت.
    - Chutes وTogether وHugging Face وGitHub Models: مقفولين.
    - Kimi على OpenRouter: اتشال 6/2026.
  - **المجاني القوي:**
    - Groq: gpt-oss-120b وQwen3.8، حوالي 30 طلب/دقيقة و1000 طلب/يوم، وLlama اتشالت 8/2026.
    - NVIDIA NIM: حوالي 40 طلب/دقيقة للحساب، والشروط بتوصفه «تجربة».
    - Gemini: Flash بس، والحدود اتقلّت.
    - Cloudflare: 10K neurons/يوم.
    - OpenRouter: `:free` بـ 50 طلب/يوم.
- **NVIDIA NIM (`model-discovery.js`):**
  - `NVIDIA_API_KEY` اختياري، و`noClientData` (أسئلة عامة بس).
  - `discoverNvidia` بيرتّب: DeepSeek v3.x/v4 ثم Kimi K2 ثم Qwen3 ثم gpt-oss-120b ثم Llama 4 Maverick، وبيستبعد الصغير والـ embed والـ r1.
  - الترتيب في `buildAttempts`: Gemini ثم NVIDIA ثم Groq ثم Mistral ثم Cerebras.
  - مفتاح الكاش بقى `llm:models:v3`.
- **Cloudflare (`llm.js`):**
  - `@cf/openai/gpt-oss-120b` بصيغة Responses API (`instructions` + `input` + `reasoning.effort: low`).
  - `workersAIText()` بيقرأ كل أشكال الرد، وLlama 3.3 احتياطي.
  - الوضع السري: gpt-oss ثم Llama 4 Scout ثم Llama 3.3.
  - اتجرب على الـ binding الحقيقي بـ worker مؤقت (`wrangler dev --remote`): رد في حوالي 0.6 ثانية واستهلك حوالي 5.5 neurons.
  - ⚠️ في التجربة قال مدة الاستئناف المدني 15 يوم (الصح 40)، ده بيأكد أهمية الاعتماد على المواد القانونية في الإجابة.
- **Groq:** قايمة التفضيل اتحدّثت (gpt-oss-120b، Kimi، Qwen3.8 قبل Llama).
- **النشر:** السيرفر نسخة `54b5d80b`.
- **فاضل على صاحب المشروع:**
  - مفتاح NVIDIA من build.nvidia.com، وبعدين `wrangler secret put NVIDIA_API_KEY`، وبعدين «فحص النماذج».
  - Groq: صاحب المشروع بيقول إنه مش راضي يديه مفتاح، والسبب لسه مش معروف.

## ٧.٥١) اختيار النماذج بالعيلة + Qwen على Cloudflare + DeepSeek (2026-11-28)

- **فحص NVIDIA الحقيقي:**
  - `llm:models:v3` كان فيه nvidia = Nemotron Ultra بس.
  - قايمة NVIDIA العامة (30 نموذج) مبقاش فيها DeepSeek. الموجود: Kimi K3.1 Pro، GLM-5.3 Flash، MiniMax M3.1 Flash، Nemotron 3 Ultra.
  - الكود كان بيدوّر على `kimi-k2`.
- **OpenRouter:** كان بيختار ernie-5.5-preview وparticle-1 (سياق طويل بس). المجاني الحالي 10 نماذج، أقواهم Nemotron Ultra وGemma 4 31B.
- **الإصلاح (`model-discovery.js`):**
  - `OPEN_FAMILIES` + `NOT_CHAT` + `pickOpen()` مشتركين بين NVIDIA وOpenRouter.
  - الترتيب: Kimi، DeepSeek، GLM، Qwen الكبير، MiniMax، Nemotron Ultra/Super، gpt-oss-120b، Llama 4 Maverick، Gemma 27b+، Llama 3.3 70b.
  - النتيجة على القوايم الحقيقية: NVIDIA ← Kimi K3.1 Pro، GLM-5.3، MiniMax، Nemotron. OpenRouter ← Nemotron Ultra، Gemma 4 31B.
  - الكاش بقى `llm:models:v4`.
- **Cloudflare (worker مؤقت بـ `wrangler dev --remote`):**
  - DeepSeek V4.1 Flash: «5035 not available on the Workers Free plan».
  - Qwen 3.8 27B: شغال، عربي ممتاز، حوالي 3.8 ثانية، حوالي 51 neurons للرد القصير، وسياقه 262K.
  - GLM-4.7 Flash: صرف التوكنز كلها في التفكير، فاستبعدناه.
- **سلسلة Cloudflare بقت:**
  - العادي: gpt-oss-120b ثم Qwen 3.8 ثم Llama 3.3.
  - الوضع السري: gpt-oss ثم Qwen ثم Llama 4 Scout ثم Llama 3.3.
- **المفاتيح على السيرفر:**
  - موجودة: GEMINI، NVIDIA، OPENROUTER، GROQ، MISTRAL، TAVILY، TELEGRAM_BOT_TOKEN.
  - Groq: حالته مش معروفة. Mistral: مرفوض.
  - مش مستخدمين في الكود: ANTHROPIC_API_KEY (مدفوع) وGITHUB_MODELS_TOKEN (الخدمة اتقفلت، يتمسح).
- **DeepSeek:** مفيش طريق مجاني. الاقتراح: Workers Paid بـ 5 دولار/شهر (بيفتح DeepSeek على Cloudflare وبيرفع حد D1)، أو شحن DeepSeek الرسمي.
- **النشر:** السيرفر نسخة `59b28bf3`.

## ٧.٥٢) أسباب رفض النماذج + Gemini 503 + Groq اشتغل (2026-11-28)

- **التشخيص:** الـ probe بقى بيسجّل سبب رفض كل نموذج في الـ snapshot (`skipped` و`errors`)، وبيسجّل مين مفتاحه موجود (`keys`). اتنشر في نسخة `49a616c5`.
- **الأسباب اللي ظهرت:**
  - **Gemini 3.5–3.8 Flash:** 503 «high demand» (ضغط مؤقت عند Google)، وكان بيتشال 36 ساعة وننزل لـ Flash-Lite.
  - **Groq:** المفتاح القديم كان أقل من 20 حرف (غلط). Cloudflare Turnstile في Groq بيفشل في متصفح Claude الداخلي، والمفتاح الجديد اتعمل من Chrome العادي.
  - **Mistral:** 402 `billing_no_api_budget_configured` («You need a subscription»)، وLarge بيرجع 403 `tier_not_allowed`. خطة Experiment مش متفعّلة.
  - **Kimi K3.1 Pro / GLM-5.3 (NVIDIA):** مردّوش في 20 ثانية.
- **الإصلاح (نسخة `3889a4c0`):** الـ probe بيعتبر 503 زي 429 (النموذج موجود بس عليه ضغط). و503 وقت الاستخدام بيعمل cooldown دقيقة للنموذج ده بس.
- **الفحص الأخير:**
  - Gemini ← gemini-3.8-flash وgemini-3.7-flash.
  - Groq ← gpt-oss-120b وqwen3.8-27b (المفتاح الجديد شغال).
  - NVIDIA ← MiniMax M3.1 وNemotron Ultra.
  - OpenRouter ← Nemotron Ultra وGemma 4 31B.
  - Mistral لسه 402.

## ٧.٥٣) فحص النماذج: ⏳ للمشاكل المؤقتة (2026-11-28)

- **السبب:** Gemini كان بيظهر ❌ في «فحص النماذج» وقت الضغط عند Google (503)، رغم إنه موجود في السلسلة وشغال.
- **السيرفر:** `busyReason(e)` في `llm.js`:
  - 502/503/504 أو high demand ← `overloaded`.
  - 429 ← `quota`.
  - Timeout ← `slow`.
  - الباقي (401/402/403/404) بيفضل مشكلة حقيقية.
  - `providersHealth` بيرجّع `busy` مع كل نتيجة فاشلة.
- **الشاشة:** ⏳ مع شرح بسيط، وسطر بيقول إن الطلبات بتعدّي لوحدها، والخطأ الأصلي في الـ tooltip. أما ❌ فبقت للمفتاح والاشتراك بس.
- **الاختبار:**
  - تصنيف الأخطاء: 503 ← overloaded، 429 ← quota، timeout ← slow، 402 و401 ← مشكلة حقيقية.
  - عرض الشاشة محلياً بنتايج وهمية: من غير أخطاء.
- ⚠️ **ملاحظة:** في التعديل الأول `\d` اتكتب `d` بسبب الـ heredoc، والاختبار مسكها قبل النشر.
- **النشر:** السيرفر نسخة `c29ceb0f` والموقع اتنشر.

## ٧.٥٤) تاب «المستندات»: قوالب جاهزة + توليد أقوى + محفوظات (2026-11-28) — المرحلة 1 من تطوير قسم الذكاء الاصطناعي

- **الخطة (3 مراحل):**
  1. المستندات (اتعملت).
  2. التحليل المربوط بالشغل: عقد ← مهام/مواعيد، تحليل حكم + ميعاد الطعن، مقارنة نسختين، حفظ التحليل في القضية.
  3. المساعد بقضية: سياق القضية، وحفظ الإجابة، وأسئلة حسب التخصص.
- **📚 قوالب جاهزة:**
  - **الملفات:**
    - `web/js/doc-templates-eg.js`: البيانات.
    - `web/js/doc-templates.js`: الشاشة + `fillTemplate`.
  - **28 قالب مصري:**
    - **عقود (11):** بيع شقة، إيجار سكني، إيجار تجاري، عمل، بيع سيارة، أتعاب محاماة، قرض، بيع أرض، مقاولة، توريد، شراكة محاصة.
    - **إنذارات (3):** وفاء بمبلغ، إخلاء، فسخ.
    - **محكمة (6):** صحيفة دعوى، مذكرة دفاع، طلب تأجيل، طلب صورة رسمية، استئناف، صيغة توكيل عام في القضايا.
    - **إقرارات (5):** مخالصة، إقرار مديونية، تعهد، إيصال استلام، محضر صلح وتنازل.
    - **أحوال شخصية (3):** زواج عرفي بين مصريين، زواج عرفي مع أجنبي/ة، اتفاق نفقة وحضانة ورؤية.
  - **التعبئة التلقائية (`src`)** من القضية أو الموكل: الاسم، الرقم القومي، العنوان، الخصم، المحكمة، الرقم، الموضوع، الدرجة، قيمة الدعوى، اسم المكتب، التاريخ.
  - **الشاشة:**
    - معاينة حية، والخانة الفاضية بتطلع نقط.
    - على الشاشة الكبيرة الخانات بتتمرر جوه صندوقها والمعاينة قدامك.
    - نسخ، Word/PDF، حفظ في القضية.
    - العلامة «استرشادي» اتشالت بطلب صاحب المشروع، ومكانها سطر «راجع المستند قبل التوقيع».
  - **السعودية:** رسالة «جاية قريب» وتوجيه للتوليد.
- **✨ التوليد (`legal-search.js generateDocument`):**
  - أنواع أكتر + «نوع تاني» حر.
  - سياق القضية: الخصم، الصفة، الموضوع، القيمة، الدرجة.
  - **مواد قانونية من قاعدة البيانات** (`findRelevantArticles` topK 6) جوه الـ prompt.
  - الطول 3000 توكن.
  - **أدوات التعديل:** `POST /api/generate-doc/refine` بـ stronger / shorter / formal / clause / custom. بيتحسب من رصيد الذكاء الاصطناعي، وبيمشي على نفس خصوصية بيانات الموكلين، والمدخلات بتتراجع قبل الموافقة.
  - المسودة قابلة للتعديل بالإيد.
- **💾 المحفوظة:**
  - migration 049: `generated_documents`.
  - `worker/routes/generated-docs.js`: GET/POST/PATCH/DELETE على `/api/documents/generated`، بصلاحيات المستندات + حدود «قضاياه بس».
- **شرح الصفحة (`tours.js`)** اتحدّث.
- **الاختبار:**
  - `docstudio-test.mjs`: 20 اختبار كلهم نجحوا.
  - فحص اتساق خانات القوالب: كل `{{key}}` ليها خانة، ومفيش خانة مش مستخدمة.
  - اللفّة الكاملة: TOTAL 0.
- **النشر:** migration 049 على قاعدة البيانات الحقيقية (جدول جديد بس)، السيرفر نسخة `47b26e44`، والموقع.
  - على الحقيقي: المسارات من غير دخول بترجع 401، والملفات بتتحمل، و28 قالب.
- **⚠️ لسه:** القوالب محتاجة مراجعة محامٍ ممارس، وقوالب السعودية.

## ٧.٥٥) التحليل الذكي مربوط بالشغل (2026-11-28) — المرحلة 2

- **أنواع جديدة (`worker/routes/analyze.js`):**
  - `POST /api/analyze/judgment`: المنطوق، لصالح مين، `appeal_route` (النوع / المدة بالأيام / بداية الحساب / السند)، أسباب الطعن، التنفيذ، التوصيات، `key_dates`.
  - `POST /api/analyze/compare`: `text_a` و`text_b` و`our_party`، والنتيجة changes (قبل/بعد + لصالحنا/ضدنا/محايد) وadded وremoved وتوصية.
- **العقد والمستند:** بقوا بيرجّعوا `key_dates`، والعقد كمان بيرجّع `obligations`.
- **ربط بقضية (`case_id`):**
  - بيتحقق إن القضية تبع المكتب، وبـ `canAccessCase` لحدود «قضاياه بس».
  - التحقق بيحصل قبل موافقة الخصوصية.
  - بيتحفظ في `analyses.case_id`.
  - `listCaseAnalyses` بقى بيرجّع كل الأنواع المربوطة (مش `case_ai` بس)، وملف القضية بيعرضها بـ `renderAnalysisResult`.
  - السجل بقى فيه رقم القضية.
- **⚠️ مشكلة اتمسكت قبل النشر:** handlers اتكتبت `const` بعد مصفوفة `routes`، فبعد الـ bundling كانت undefined («hit.route.handler is not a function»)، وده كان هيوقع كل أنواع التحليل. اتحوّلت لـ function declarations.
- **الواجهة (`search.js`):**
  - زرار حكم ومقارنة، و«ربط بقضية»، وخانة النسخة الجديدة + الطرف اللي بنمثله + رفع ملف ليها.
  - عرض الحكم والمقارنة والالتزامات.
  - **`mountKeyDates`** («📅 مواعيد مهمة ← مهام»):
    - الحكم: آخر ميعاد للطعن = تاريخ الحكم + المدة، لو الحساب بيبدأ من الصدور.
    - التواريخ بتتعدّل قبل الإضافة، وبتتحول لمهام عن طريق `POST /api/tasks` مربوطة بالقضية.
- **التنسيق:** كلاسات نتايج التحليل (`ai-result-card` …) عمرها ما كان ليها CSS، واتضافت في `theme.css`.
- **الاختبار:**
  - `analyze2-test.mjs`: 14 اختبار نجحوا. ردود الذكاء الاصطناعي فيه وهمية، والمهام والقضية والحفظ حقيقيين محلياً.
  - `docstudio-test.mjs`: نجح كله.
  - اللفّة الكاملة: TOTAL 0.
- **النشر:** السيرفر نسخة `9023ca50` والموقع.
  - على الحقيقي: المسارات الجديدة بترجع 401 من غير دخول، والملفات بتتحمل من غير أخطاء.

## ٧.٥٦) المساعد بقضية + أسئلة حسب التخصص + ربط بملف القضية (2026-11-28) — المرحلة 3

- **السيرفر:**
  - `worker/services/case-context.js` (`buildCaseContext`) بيجمع:
    - بيانات القضية: الموكل وصفته، الخصم، الموضوع، القيمة.
    - آخر 12 جلسة و12 مهمة.
    - آخر 3 تحليلات (منها `case_ai`).
    - المستندات المحفوظة.
    - مقتطفات من مستندات القضية في حدود 6000 حرف.
  - `chat.js`:
    - `case_id`: بيتحقق بـ `canAccessCase` + إن القضية تبع المكتب، وإلا 404.
    - السياق بيتحط في الـ system prompt (`agent.js` `caseContext`)، و`chatCompletion` بيخفي أسماء الموكل والخصم بالـ masker.
    - المحادثة بقضية بتتعامل كبيانات موكلين: موافقة + `routeFor`.
  - migration 050: `chat_sessions.case_id`. السجل بيرجّع رقم القضية، وفتح محادثة قديمة بيرجّع قضيتها.
- **الواجهة (`search.js`):**
  - شريط «📁 بتسأل عن:».
  - أسئلة القضية (5) لما تكون مختارة، أو أسئلة حسب التخصص (عام/جنائي/أسرة/عمل/إيجارات/مدني وتجاري، 4 لكل واحد).
  - تحت كل إجابة: نسخ / Word / 💾 حفظ في القضية (`saveDocDialog`)، جوه فقاعة الإجابة.
  - تغيير القضية في نص محادثة بيبدأ محادثة جديدة بعد تأكيد.
- **ملف القضية (`cases.js`):**
  - «💬 اسأل المساعد عن القضية دي» (عن طريق `sessionStorage` `mowakkil_chat_case`).
  - تحت تحليل القضية: `mountCaseTasks`، المواعيد الحرجة والخطوات التالية ← مهام بتاريخ يتحدد.
- **CSS:** شبكة «بوابات حكومية رسمية» (`.gov-link*`) ماكانش ليها تنسيق خالص.
- **شرح الصفحة:** خطوة «📁 اسأل عن قضية».
- **الاختبار:**
  - `chatcase-test.mjs`: 16 اختبار نجحوا. السياق اتختبر unit بقاعدة بيانات وهمية، وإجابة المساعد وهمية.
  - `analyze2` و`docstudio`: نجحوا.
  - اللفّة الكاملة: TOTAL 0.
- **النشر:** migration 050 على قاعدة البيانات الحقيقية، السيرفر نسخة `c09fdbd5`، والموقع.
  - على الحقيقي: 401 من غير دخول، والملفات بتتحمل من غير أخطاء.
- **قسم الذكاء الاصطناعي بعد المراحل الـ3:**
  - المساعد: بقضية + تخصصات + حفظ.
  - التحليل: حكم + مقارنة + مهام + ربط.
  - المستندات: 28 قالب + توليد أقوى + محفوظات.
- **لسه:** قوالب السعودية، ومراجعة محامٍ للقوالب.

## ٧.٥٧) قوالب السعودية (16) + التاريخ الهجري (2026-11-28)

- **الملفات:** `web/js/doc-templates-sa.js`. `templatesFor()` بقت بترجّع القوالب السعودية للمكتب السعودي بدل رسالة «قريباً»، والمكتب المصري زي ما هو (28).
- **العقود (7):**
  - عمل: توثيق «قوى»، حماية الأجور، التأمينات، مكافأة نهاية الخدمة.
  - إيجار: تسجيل في «إيجار» عشان يبقى سند تنفيذي.
  - بيع عقار مبدئي: عربون، والإفراغ لدى كتابة العدل أو الموثق.
  - بيع سيارة: نقل الملكية من «أبشر».
  - أتعاب محاماة: الوكالة من «ناجز».
  - مقاولة: كود البناء السعودي.
  - توريد: فاتورة ضريبية إلكترونية.
- **لوائح ومذكرات (3):**
  - لائحة دعوى.
  - مذكرة جوابية.
  - لائحة اعتراضية: 30 يوم، و10 أيام في المستعجل (م 187 من نظام المرافعات الشرعية)، من تاريخ تسلم صورة الحكم.
- **إنذارات (2):** خطاب إنذار بالسداد، إشعار بعدم تجديد الإيجار.
- **إقرارات وسندات (3):**
  - مخالصة وإبراء ذمة.
  - **سند لأمر** بالبيانات الإلزامية: «سند لأمر»، تعهد غير معلق على شرط، المبلغ، الاستحقاق، مكان الوفاء، المستفيد، تاريخ ومكان الإنشاء، التوقيع.
  - اتفاقية صلح (توثيق «تراضي»).
- **أحوال شخصية (1):** اتفاقية نفقة وحضانة وزيارة (توثيق «تراضي» أو المحكمة).
- **`fillTemplate`:** قوالب `sa-*` بتعرض التاريخ ميلادي + هجري أم القرى (`Intl` `ar-SA-u-ca-islamic-umalqura-nu-latn`)، مثلاً «28/11/2026م الموافق 18 جمادى الآخرة 1448 هـ».
- **الاختبار:**
  - فحص اتساق الخانات + غياب أي مصطلح مصري (جنيه/محضر/شهر عقاري/رقم قومي).
  - `sa-templates-test.mjs`: 9 اختبارات نجحوا، على مكتب سعودي ومكتب مصري.
  - `docstudio`: نجح كله.
  - اللفّة الكاملة: TOTAL 0.
- **النشر:** الموقع بس. على الحقيقي: الملف بيتحمل، و16 قالب، والتاريخ الهجري صح.
- **⚠️ لسه:** مراجعة محامٍ سعودي ممارس، خصوصاً السند لأمر واللائحة الاعتراضية وعقد العمل.

## ٧.٥٨) تنظيف قاعدة المواد المصرية + أداة «📚 القوانين» (2026-11-28)

- **مراجعة القاعدة المصرية (5,828 مادة):**
  - 5,727 مادة من مصدر غير رسمي (flashsa)، من غير رقم قانون ولا تاريخ.
  - قانون العمل 12/2003 الملغي (615 مادة).
  - الإجراءات الجنائية 29 مادة بس.
  - **101 مادة اتكتبت بالإيد** وقت الإنشاء (3/10/2026)، وصياغتها مش النص الرسمي.
- **migration 051:**
  - `law_articles`: `status` (active/review/repealed/unofficial) + `status_note` + `verified_at` + `official_source` + index.
  - النتيجة على قاعدة البيانات الحقيقية:
    - مصر: active 5036، repealed 615، review 76، unofficial 101.
    - السعودية: active 14771.
  - ⚠️ **الكتابة الفعلية كانت 22,188 صف، مش 800 زي ما قدّرت:** `ADD COLUMN NOT NULL DEFAULT` + `CREATE INDEX` بيتحسبوا كتابة على كل صفوف الجدول. القراءة 65,269. الاتنين جوه الحدود (100 ألف كتابة و5 مليون قراءة في اليوم)، **بس أي تعديل على هيكل جدول كبير لازم يتحسب بعدد صفوفه.**
  - تحديث مصدر الـ 14,771 مادة سعودية اتشال من الـ migration (كتابة من غير لازمة).
- **البحث (`legal-search.js`):**
  - بيستبعد `repealed` و`unofficial`.
  - مادة `review` بتوصل للنموذج مع تنبيهها `[⚠️ …]`.
- **مراجعة الأسانيد (`citations.js`):**
  - الفهرس بيستبعد غير الرسمي، والكاش بقى v3.
  - الاستشهاد بقانون ملغى ← ⛔ مع السبب، وقانون «يُراجع» ← 🔄. وده ظاهر في النص والملخص وشارات تحليل القضية.
- **أداة «📚 القوانين» في السوبر أدمن (`sa-laws.js` + `law-splitter.js` + `law-extract.js` + `routes/laws-admin.js`):**
  - المصادر: ملف PDF أو Word أو صورة (الـ PDF المتصوّر بيتقري OCR صفحة صفحة)، أو لصق نص، أو ويكي مصدر.
  - التقسيم لمواد بيفهم: مادة 1، المادة (1)، مكرر (أ)، ومواد الإصدار. والإشارة «مادة 5 من…» بتفضل جوه المادة اللي هي فيها.
  - **كشف النسخ الملخصة:** اختصارات (…) في 3% من المواد أو أكتر، أو فجوتين في الترقيم أو أكتر ← منع إلا بتأكيد.
  - **نسخة ويكي مصدر من قانون العمل 14/2025 اتكشفت ملخصة:** 64 مادة من 301 فيها «…»، والمواد 72–80 و200 مش موجودة.
  - الإضافة على دفعات من 100، و«يلغي قانون» بيعلّم القديم ملغى، والفهرسة للجديد بس (`after_id`) مع «كمّل الفهرسة» لو الحصة خلصت.
  - قايمة القوانين (عند الطلب) وتغيير الحالة مع السبب.
- **الاختبار:**
  - `status-unit.mjs`: 9 اختبارات. `laws-test.mjs`: 13 اختبار.
  - اللفّة الكاملة: TOTAL 0.
- **النشر:**
  - نسخة احتياطية قبل التغيير: `backups/pre-051-law-status-2026-11-28.sql`.
  - migration 051، والسيرفر نسخة `245ab68b`، والموقع.
- **المصادر:**
  - منشورات قانونية (manshurat.org) **مش بيرد خالص** (timeout، من عندنا ومن عند صاحب المشروع).
  - ويكي مصدر فيه حوالي 20 قانون مصري، بس لازم كل واحد يتراجع.
  - NATLEX فيه نص قانون العمل (التحميل من المتصفح).
  - المطابع الأميرية بالاشتراك.
- **لسه:** نص رسمي كامل لقانون العمل 14/2025 والقوانين الناقصة (قايمتها في المحادثة)، ومراجعة القوالب.

## ٧.٥٩) جمع وإضافة قوانين ناقصة + تحسينات الاستيراد من ملفات رسمية (2026-11-28)

- **ويكي مصدر (28 صفحة اتفحصت بـ `ws-scan.mjs`):**
  - **مرفوض (ملخص أو ناقص):** قانون العمل 14/2025 (64 مادة فيها «…»، و72–80 و200 مش موجودين)، والعقوبات (14 «…» و6 فجوات)، ونقابة المهندسين.
  - **سليم:** الدستور (نص 2014 الأصلي)، و148/2019، و82/2002، و119/2008، و1/2000، و107/2013.
- **مصادر رسمية:**
  - الهيئة العامة للرقابة المالية (fra.gov.eg): قانون الشركات 159/1981 (نسخة مجمعة بالتعديلات لحد 2018)، وقانون الاستثمار 72/2017.
  - الويبو (الدستور المعدل، وحماية المستهلك 181/2018): خطوطهم بايظة وبيطلعوا رموز، ومحتاجين OCR.
  - NATLEX: التحميل من المتصفح بس (403 من غير متصفح).
  - منشورات قانونية: مش بيرد.
- **اللي اتضاف لقاعدة البيانات الحقيقية (SQL مباشر بعد التقسيم بنفس أداة الموقع، `build-law-sql.mjs`):**
  - 8 قوانين / 1,186 مادة (ids من 20605 لـ 21790).
  - الشركات `active`، والباقي `review` مع ملاحظة.
  - الدستور ملاحظته: «نص 2014 الأصلي — عُدلت مواد في 2019».
  - الإضافة استخدمت 4,826 كتابة و984 قراءة.
  - اتمسح `citations:index:v3` من KV عشان يتبني من جديد.
- **تحسينات التقسيم (`law-splitter.js`):**
  - `NFKC` لأشكال العرض العربية + ھ/ی/ک ← ه/ي/ك + شيل الخطوط الفاصلة.
  - شيل «نص المادة قبل التعديل/الإلغاء: …».
  - مواد الإصدار المتداخلة بنفس الأرقام (اللي فيها «القانون المرافق»، أو بتبدأ بـ«إصدار»، أو مادة النشر).
  - «م» في أول النص ← مكرر.
- **`law-extract.js`:** الخطوط البايظة (نسبة الحروف العربية أقل من 60%) ← OCR.
- **قايمة القوانين:** فيها `min_id` و`max_id` + زرار «🔍 فهرسة» لكل قانون.
- **النشر:** السيرفر نسخة `ba6d7623` والموقع.
- **فاضل:**
  1. صاحب المشروع يضغط «🔍 فهرسة» للـ 8 قوانين.
  2. يرفع قانون العمل والبيانات والمستهلك والدستور المعدل من الروابط اللي في المحادثة.
  3. محاولة الرفع الأولى بتاعته مااتسجلتش في `audit_log`، غالباً عشان كانت على النسخة القديمة اللي مش بتفهم أشكال العرض.

## ٨) لو حاجة باظت — ارجع لنسخة سابقة

**الموقع:** من لوحة Cloudflare → Workers & Pages → mowakkil-2026 → Deployments → اختار نسخة قديمة → «Rollback».

**الـ API (الـ Worker):**
```powershell
cd "D:\Mohamed Walid\mowakkil"; & "$env:APPDATA\npm\wrangler.cmd" rollback
```

**الكود على جهازك (يرجّع آخر commit ويمسح التعديلات اللي ماتحفظتش):**
```powershell
& "C:\Program Files\Git\cmd\git.exe" -c safe.directory=* reset --hard HEAD
```
⚠️ الأمر ده بيمسح أي تعديل ماتعملوش commit، فاتأكد الأول.

## ٩) جملة الاستكمال لو فتحت محادثة جديدة

> «أنا بكمّل مشروع مُوكِّل في `D:\Mohamed Walid\mowakkil`. اقرأ ملف `PROGRESS.md`، وخصوصاً آخر قسم «📘 الدليل الشامل — 2026-11-23». الكود على GitHub الخاص، والباسوردات في `PROGRESS.secrets.md` على الجهاز بس، فمتطلبهاش مني.»

---

**نهاية السجل الشامل.**