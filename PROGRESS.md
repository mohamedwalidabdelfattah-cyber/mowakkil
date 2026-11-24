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