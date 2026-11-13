# ============================================================
# مُوكِّل — Project Diagnostics Script
# بيفحص كل ملفات المشروع ويطلع تقرير بالأخطاء والاقتراحات
# ============================================================

import os
import re
import json
from datetime import datetime

PROJECT_ROOT = r"C:\Users\hi\mowakkil"
WEB_DIR = os.path.join(PROJECT_ROOT, "web")
WORKER_DIR = os.path.join(PROJECT_ROOT, "worker")
REPORT_FILE = os.path.join(PROJECT_ROOT, "diagnostic-report.md")

# قوائم لتجميع النتائج
errors = []
warnings = []
info = []
suggestions = []

# ============================================================
# 1. فحص الترميز
# ============================================================
print("🔍 [1/6] فحص الترميز...")
bad_encoding_files = []
for root, dirs, files in os.walk(WEB_DIR):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith(('.html', '.css', '.js')):
            path = os.path.join(root, file)
            try:
                with open(path, 'rb') as f:
                    content = f.read()
                # محاولة قراءة بـ UTF-8
                try:
                    content.decode('utf-8')
                except UnicodeDecodeError:
                    bad_encoding_files.append(os.path.relpath(path, PROJECT_ROOT))
            except Exception as e:
                errors.append(f"❌ مش قادر أقرا الملف: {path} — {e}")

if bad_encoding_files:
    for f in bad_encoding_files:
        errors.append(f"❌ ترميز غلط (مش UTF-8): `{f}`")
else:
    info.append("✅ كل الملفات ترميزها UTF-8 سليم.")

# ============================================================
# 2. فحص ألوان قديمة (بنفسجي، برتقالي)
# ============================================================
print("🎨 [2/6] فحص الألوان القديمة...")
old_colors = ['#6366F1', '#4F46E5', '#8B5CF6', '#D97706', '#B45309', '#3B82F6', '#2563EB']
old_color_hits = {}

for root, dirs, files in os.walk(WEB_DIR):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith(('.html', '.css', '.js')):
            path = os.path.join(root, file)
            rel = os.path.relpath(path, PROJECT_ROOT)
            if rel.startswith("web\\js\\export.js"):  # نتجاهل export.js (فيه أكواد بحث)
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                for color in old_colors:
                    if color.lower() in content.lower():
                        if rel not in old_color_hits:
                            old_color_hits[rel] = []
                        old_color_hits[rel].append(color)
            except:
                pass

if old_color_hits:
    for file, colors in old_color_hits.items():
        warnings.append(f"⚠️ ألوان قديمة في `{file}`: {', '.join(set(colors))}")
else:
    info.append("✅ مفيش ألوان قديمة (بنفسجي/برتقالي/أزرق) في الملفات.")

# ============================================================
# 3. فحص ملفات الـ CSS (التكرار والتعارض)
# ============================================================
print("📄 [3/6] فحص ملفات CSS...")
css_files = []
for root, dirs, files in os.walk(WEB_DIR):
    if 'node_modules' in root:
        continue
    for file in files:
        if file.endswith('.css'):
            css_files.append(os.path.join(root, file))

for css in css_files:
    rel = os.path.relpath(css, PROJECT_ROOT)
    try:
        with open(css, 'r', encoding='utf-8') as f:
            content = f.read()
        # عدد التعريفات المكررة
        selectors = re.findall(r'^([^{@/\s][^{]*?)\s*\{', content, re.MULTILINE)
        from collections import Counter
        counts = Counter(s.strip() for s in selectors if s.strip())
        dups = {k: v for k, v in counts.items() if v >= 3}
        if dups:
            warnings.append(f"⚠️ تكرارات في `{rel}`: " + ", ".join([f"`{k}` ({v}×)" for k, v in list(dups.items())[:5]]))
    except:
        pass

# ============================================================
# 4. فحص صفحات HTML (روابط مكسورة، scripts مكررة)
# ============================================================
print("🔗 [4/6] فحص صفحات HTML...")
html_pages = []
for root, dirs, files in os.walk(WEB_DIR):
    if 'node_modules' in root:
        continue
    for file in files:
        if file.endswith('.html'):
            html_pages.append(os.path.join(root, file))

for page in html_pages:
    rel = os.path.relpath(page, PROJECT_ROOT)
    try:
        with open(page, 'r', encoding='utf-8') as f:
            content = f.read()

        # روابط CSS/JS
        links = re.findall(r'href="(/[^"]+\.css)"', content)
        scripts = re.findall(r'src="(/[^"]+\.js[^"]*)"', content)

        # تأكد إن الملفات موجودة
        for link in links:
            path = os.path.join(WEB_DIR, link.lstrip('/').replace('/', os.sep))
            if not os.path.exists(path):
                errors.append(f"❌ ملف CSS مش موجود: `{link}` (من {rel})")

        for script in scripts:
            script_path = script.split('?')[0]
            path = os.path.join(WEB_DIR, script_path.lstrip('/').replace('/', os.sep))
            if not os.path.exists(path):
                errors.append(f"❌ ملف JS مش موجود: `{script}` (من {rel})")

        # check duplicate scripts
        if len(scripts) != len(set(scripts)):
            warnings.append(f"⚠️ سكريبتات مكررة في `{rel}`")

        # meta viewport
        if 'viewport' not in content:
            errors.append(f"❌ مفيش meta viewport في `{rel}` (مش هيشتغل صح على الموبايل)")
    except:
        pass

# ============================================================
# 5. فحص أقسام البيع (الذكاء الاصطناعي، الاشتراكات، الباقات)
# ============================================================
print("💰 [5/6] فحص أقسام البيع والذكاء الاصطناعي...")

# 5.1 صفحة الباقات
pricing_page = os.path.join(WEB_DIR, "pricing.html")
if os.path.exists(pricing_page):
    with open(pricing_page, 'r', encoding='utf-8') as f:
        pricing_content = f.read()

    if 'brand-theme.css' not in pricing_content:
        errors.append("❌ صفحة `/pricing` مفيهاش `brand-theme.css` — الشكل هيكون مش موحد")

    if 'pricing.css' not in pricing_content:
        warnings.append("⚠️ صفحة `/pricing` مفيهاش `pricing.css`")

    if 'خطة' not in pricing_content and 'باقة' not in pricing_content:
        warnings.append("⚠️ صفحة `/pricing` ممكن تكون مفيهاش محتوى الباقات (تأكد)")

# 5.2 قسم الذكاء الاصطناعي (chat / analyze / agent)
ai_files = [
    os.path.join(WORKER_DIR, "routes", "chat.js"),
    os.path.join(WORKER_DIR, "routes", "analyze.js"),
    os.path.join(WORKER_DIR, "services", "agent.js"),
    os.path.join(WORKER_DIR, "services", "legal-search.js"),
]
for f in ai_files:
    if not os.path.exists(f):
        errors.append(f"❌ ملف AI مش موجود: `{os.path.relpath(f, PROJECT_ROOT)}`")

# 5.3 API Endpoints
ai_endpoints = {
    "chat.js": ["/api/chat"],
    "analyze.js": ["/api/analyze"],
    "legal-search.js": ["searchLegalDb", "embedding"],
}
for fname, patterns in ai_endpoints.items():
    fpath = os.path.join(WORKER_DIR, "routes" if "chat" in fname or "analyze" in fname else "services", fname)
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        for pat in patterns:
            if pat not in content:
                warnings.append(f"⚠️ `{fname}` مفيهوش `{pat}` — تأكد إن الـ API شغال")

# 5.4 صفحات البيع في index.html
index_page = os.path.join(WEB_DIR, "index.html")
if os.path.exists(index_page):
    with open(index_page, 'r', encoding='utf-8') as f:
        idx = f.read()

    # CTAs
    if 'signup' not in idx:
        errors.append("❌ صفحة البداية مفيهاش رابط `/signup` — مفيش CTA للتسجيل")
    if 'pricing' not in idx:
        warnings.append("⚠️ صفحة البداية مفيهاش رابط `/pricing`")
    if 'free' not in idx.lower() and 'مجان' not in idx and 'تجربة' not in idx:
        warnings.append("⚠️ صفحة البداية مفيهاش عرض تجربة مجانية واضح")

    # أقسام الميزات
    features_count = idx.count('landing-feature-card')
    if features_count < 4:
        warnings.append(f"⚠️ صفحة البداية فيها {features_count} كارت ميزة بس (يفضل 6+)")

# 5.5 صفحة الاشتراك
subscription_js = os.path.join(WEB_DIR, "js", "views", "subscription.js")
if os.path.exists(subscription_js):
    with open(subscription_js, 'r', encoding='utf-8') as f:
        sub_content = f.read()
    if 'showUpgradeModal' not in sub_content:
        warnings.append("⚠️ `subscription.js` مفيهوش `showUpgradeModal` — المودال مش هيظهر")
else:
    errors.append("❌ ملف `subscription.js` مش موجود")

# 5.6 صفحة الدفع
pay_page = os.path.join(WEB_DIR, "pay.html")
if not os.path.exists(pay_page):
    errors.append("❌ صفحة `/pay` مش موجودة — العميل مش هيقدر يدفع")

# ============================================================
# 6. فحص Worker (الـ API)
# ============================================================
print("🔧 [6/6] فحص Worker...")

if os.path.exists(WORKER_DIR):
    # تأكد إن كل الـ routes موجودة
    expected_routes = [
        "auth.js", "clients.js", "cases.js", "fees.js", "invoices.js",
        "payments.js", "tasks.js", "subscription.js", "chat.js", "analyze.js",
        "notifications.js", "calendar.js", "settings.js",
    ]
    routes_dir = os.path.join(WORKER_DIR, "routes")
    for route in expected_routes:
        if not os.path.exists(os.path.join(routes_dir, route)):
            warnings.append(f"⚠️ route مش موجود: `worker/routes/{route}`")

    # فحص index.js
    worker_index = os.path.join(WORKER_DIR, "index.js")
    if os.path.exists(worker_index):
        with open(worker_index, 'r', encoding='utf-8') as f:
            w_idx = f.read()
        if 'chat' not in w_idx.lower():
            warnings.append("⚠️ `worker/index.js` مش فيه route للـ chat")
        if 'analyze' not in w_idx.lower():
            warnings.append("⚠️ `worker/index.js` مش فيه route للـ analyze")

# ============================================================
# اقتراحات عامة للتحسين
# ============================================================
suggestions.append("💡 **اقتراحات لتحسين أقسام البيع:**")
suggestions.append("   - أضف **فيديوهات قصيرة** (30 ثانية) لكل ميزة في صفحة البداية.")
suggestions.append("   - أضف **شهادات عملاء** (Testimonials) في صفحة الباقات.")
suggestions.append("   - أضف **مقارنة مباشرة** بين الباقات في `/pricing` (Table comparison).")
suggestions.append("   - استخدم **A/B testing** لصفحة البداية (CTAs مختلفة).")
suggestions.append("   - أضف **Chat Widget** (AI) في صفحة البداية للإجابة على الاستفسارات.")
suggestions.append("   - أضف **Free Trial** واضح في الهيدر (زرار `ابدأ مجاناً`).")

suggestions.append("\n💡 **اقتراحات للذكاء الاصطناعي:**")
suggestions.append("   - تأكد إن `searchLegalDb` بيرجع 5+ نتائج على الأقل.")
suggestions.append("   - أضف **Streaming responses** للـ Chat (بدل الانتظار).")
suggestions.append("   - أضف **حد أقصى للرسائل** في الباقة المجانية (مثلاً 10 رسائل/شهر).")
suggestions.append("   - أضف **عدد المستخدمين** في الباقة (مثلاً 1 مستخدم للـ Free، 3 للـ Pro).")
suggestions.append("   - تأكد إن `chat_sessions` بتحفظ المحادثات بشكل صحيح.")

suggestions.append("\n💡 **اقتراحات عامة:**")
suggestions.append("   - أضف **Sitemap.xml** + **robots.txt** لمحركات البحث.")
suggestions.append("   - أضف **Open Graph** meta tags (og:title, og:image) للمشاركة على السوشيال.")
suggestions.append("   - أضف **Google Analytics** أو **Plausible** لتتبع الزوار.")
suggestions.append("   - أضف **Error tracking** (Sentry) للـ Worker.")

# ============================================================
# كتابة التقرير
# ============================================================
with open(REPORT_FILE, 'w', encoding='utf-8') as f:
    f.write(f"# 🩺 تقرير تشخيص مشروع مُوكِّل\n\n")
    f.write(f"**تاريخ الفحص:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
    f.write("---\n\n")

    f.write(f"## ❌ أخطاء ({len(errors)})\n\n")
    if errors:
        for e in errors:
            f.write(f"- {e}\n")
    else:
        f.write("✅ مفيش أخطاء حرجة.\n")
    f.write("\n")

    f.write(f"## ⚠️ تحذيرات ({len(warnings)})\n\n")
    if warnings:
        for w in warnings:
            f.write(f"- {w}\n")
    else:
        f.write("✅ مفيش تحذيرات.\n")
    f.write("\n")

    f.write(f"## ℹ️ معلومات ({len(info)})\n\n")
    for i in info:
        f.write(f"- {i}\n")
    f.write("\n")

    f.write("---\n\n")
    f.write("## 💡 اقتراحات\n\n")
    for s in suggestions:
        f.write(f"{s}\n")

print(f"\n✅ التقرير اتحفظ في: {REPORT_FILE}")
print(f"❌ أخطاء: {len(errors)}")
print(f"⚠️ تحذيرات: {len(warnings)}")
print(f"ℹ️ معلومات: {len(info)}")