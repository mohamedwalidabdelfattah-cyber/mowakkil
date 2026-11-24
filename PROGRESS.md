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