// web/js/pricing.js
// صفحة التسعير

const API_BASE = 'https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev';
const WA_NUMBER = '201013917789';
const TOKEN_KEY = 'mowakkil_token';

// ============================================================
// الترجمات
// ============================================================
const I18N = {
  ar: {
    dir: 'rtl',
    lang: 'ar',
    heroBadge: '🎁 15 يوم تجربة مجانية',
    heroTitle: 'باقات تناسب كل مكتب محاماة',
    heroSub: 'اختار الباقة اللي تناسب حجم مكتبك. ابدأ مجانًا، وارقّي وقت ما تحتاج.',
    comparisonTitle: 'مقارنة المميزات',
    faqTitle: 'أسئلة شائعة',
    ctaTitle: 'جاهز تبدأ؟',
    ctaSub: 'جرّب مُوكِّل مجانًا لمدة 15 يوم — بدون بطاقة بنكية.',
    ctaBtn: '🚀 ابدأ مجانًا 15 يوم',
    footerText: '© 2026 مُوكِّل · كل الحقوق محفوظة',
    footerHome: 'الرئيسية',
    footerWa: 'تواصل',
    login: 'دخول',
    popular: 'الأكثر شعبية',
    subscribe: '🚀 اشترك الآن',
    subscribeFree: '🎁 ابدأ مجانًا',
    contact: '💬 تواصل',
    perMonth: '/ شهر',
    forever: 'للأبد',
    featureLabels: {
      cases: 'إدارة القضايا',
      clients: 'إدارة الموكلين',
      agenda: 'الأجندة والجلسات',
      portal: 'بوابة الموكل',
      finance: 'الإدارة المالية',
      invoices: 'الفواتير والضرائب',
      ai: 'الذكاء الاصطناعي',
      advanced_reports: 'التقارير المتقدمة',
      whatsapp: 'تكامل واتساب',
      multi_office: 'مكاتب متعددة',
      api: 'API Access',
    },
    limitLabels: {
      max_users: 'المستخدمين',
      max_cases: 'القضايا',
      max_clients: 'الموكلين',
      max_storage_mb: 'التخزين',
    },
    faqs: [
      { q: 'إيه الفرق بين الباقات؟', a: 'الباقة المجانية للمكاتب الصغيرة، الأساسية تضيف الإدارة المالية والفواتير، الاحترافية تضيف الذكاء الاصطناعي والتقارير المتقدمة، والمتقدمة للمكاتب اللي عندها فروع.' },
      { q: 'أقدر أرقّي الباقة في أي وقت؟', a: 'أيوه، تقدر ترقّي في أي وقت من صفحة "اشتراكي" جوه النظام، وهتتفعّل فورًا.' },
      { q: 'في تجربة مجانية؟', a: 'أيوه، كل مكتب جديد بياخد 15 يوم تجربة مجانية على الباقة الاحترافية بكل الميزات، بدون بطاقة بنكية.' },
      { q: 'إيه طرق الدفع المتاحة؟', a: 'بنقبل الدفع عن طريق فودافون كاش وإنستاباي. تواصل معانا وبنساعدك.' },
      { q: 'أقدر ألغي في أي وقت؟', a: 'أيوه، الاشتراك شهري وتقدر تلغيه في أي وقت، وهتفضل تستخدم لحد نهاية الشهر المدفوع.' },
      { q: 'البيانات بتاعتنا آمنة؟', a: 'أيوه، كل البيانات مشفّرة ومحفوظة على Cloudflare (بنية تحتية عالمية). ومفيش حد يقدر يوصل لبيانات مكتبك إلا إنت.' },
    ],
  },
  en: {
    dir: 'ltr',
    lang: 'en',
    heroBadge: '🎁 15-day free trial',
    heroTitle: 'Plans for every law firm',
    heroSub: 'Pick the plan that fits your firm. Start free, upgrade anytime.',
    comparisonTitle: 'Features Comparison',
    faqTitle: 'Frequently Asked Questions',
    ctaTitle: 'Ready to start?',
    ctaSub: 'Try Mowakkil free for 15 days — no credit card required.',
    ctaBtn: '🚀 Start Free 15 Days',
    footerText: '© 2026 Mowakkil · All rights reserved',
    footerHome: 'Home',
    footerWa: 'Contact',
    login: 'Login',
    popular: 'Most Popular',
    subscribe: '🚀 Subscribe',
    subscribeFree: '🎁 Start Free',
    contact: '💬 Contact',
    perMonth: '/ month',
    forever: 'forever',
    featureLabels: {
      cases: 'Case Management',
      clients: 'Client Management',
      agenda: 'Agenda & Sessions',
      portal: 'Client Portal',
      finance: 'Financial Management',
      invoices: 'Invoices & Tax',
      ai: 'Artificial Intelligence',
      advanced_reports: 'Advanced Reports',
      whatsapp: 'WhatsApp Integration',
      multi_office: 'Multiple Offices',
      api: 'API Access',
    },
    limitLabels: {
      max_users: 'Users',
      max_cases: 'Cases',
      max_clients: 'Clients',
      max_storage_mb: 'Storage',
    },
    faqs: [
      { q: 'What is the difference between plans?', a: 'Free is for small firms, Starter adds finance & invoices, Pro adds AI & advanced reports, and Plus is for firms with multiple branches.' },
      { q: 'Can I upgrade anytime?', a: 'Yes, you can upgrade anytime from the "My Subscription" page and it takes effect immediately.' },
      { q: 'Is there a free trial?', a: 'Yes, every new office gets 15 days free trial on the Professional plan with all features, no credit card required.' },
      { q: 'What payment methods?', a: 'We accept Vodafone Cash and InstaPay. Contact us and we will help you.' },
      { q: 'Can I cancel anytime?', a: 'Yes, subscriptions are monthly and you can cancel anytime. You keep access until the end of the paid month.' },
      { q: 'Is our data safe?', a: 'Yes, all data is encrypted and stored on Cloudflare (global infrastructure). Only you can access your office data.' },
    ],
  },
};

let currentLang = localStorage.getItem('mowakkil_pricing_lang') || 'ar';
let plansData = [];

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  applyLang(currentLang);
  await loadPlans();
  renderPlans();
  renderComparison();
  renderFaq();
  setupLangToggle();
});

// ============================================================
// Language
// ============================================================
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('mowakkil_pricing_lang', lang);

  const t = I18N[lang];
  document.documentElement.lang = t.lang;
  document.documentElement.dir = t.dir;

  document.getElementById('hero-badge').textContent = t.heroBadge;
  document.getElementById('hero-title').textContent = t.heroTitle;
  document.getElementById('hero-sub').textContent = t.heroSub;
  document.getElementById('comparison-title').textContent = t.comparisonTitle;
  document.getElementById('faq-title').textContent = t.faqTitle;
  document.getElementById('cta-title').textContent = t.ctaTitle;
  document.getElementById('cta-sub').textContent = t.ctaSub;
  document.getElementById('cta-btn').textContent = t.ctaBtn;
  document.getElementById('footer-text').textContent = t.footerText;
  document.getElementById('footer-home').textContent = t.footerHome;
  document.getElementById('footer-wa').textContent = t.footerWa;
  document.getElementById('login-link').textContent = t.login;
}

function setupLangToggle() {
  document.getElementById('lang-toggle').addEventListener('click', () => {
    applyLang(currentLang === 'ar' ? 'en' : 'ar');
    renderPlans();
    renderComparison();
    renderFaq();
  });
}

// ============================================================
// Load Plans
// ============================================================
async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/api/subscription/plans`);
    const data = await res.json();
    plansData = data.data || data || [];
  } catch (e) {
    console.error('Failed to load plans:', e);
    plansData = [];
  }
}

// ============================================================
// Render Plans Grid
// ============================================================
function renderPlans() {
  const t = I18N[currentLang];
  const grid = document.getElementById('plans-grid');

  if (!plansData.length) {
    grid.innerHTML = '<div class="pricing-loading">تعذّر تحميل الباقات — حاول تاني</div>';
    return;
  }

  // ✅ نتحقق مرة واحدة من الـ login
  const isLoggedIn = !!localStorage.getItem(TOKEN_KEY);

  grid.innerHTML = plansData.map(p => {
    const isPopular = p.plan === 'pro';
    const isFree = p.plan === 'free';

    const featureLabels = t.featureLabels;
    const features = Object.entries(p.features || {})
      .filter(([_, v]) => v === true)
      .map(([k]) => featureLabels[k] || k);

    const limits = p.limits || {};
    const limitText = `👥 ${limits.max_users === -1 ? '∞' : limits.max_users} · 📁 ${limits.max_cases === -1 ? '∞' : limits.max_cases} · 👤 ${limits.max_clients === -1 ? '∞' : limits.max_clients}`;

    // ✅ القرار على أساس الحالة:
    // - الباقة المجانية → /signup دائمًا
    // - الباقة المدفوعة + مسجّل → /pay?plan=XXX
    // - الباقة المدفوعة + مش مسجّل → /signup?plan=XXX
    let ctaUrl;
    if (isFree) {
      ctaUrl = '/signup';
    } else if (isLoggedIn) {
      ctaUrl = `/pay?plan=${p.plan}`;
    } else {
      ctaUrl = `/signup?plan=${p.plan}`;
    }

    const ctaText = isFree ? t.subscribeFree : t.subscribe;

    return `
      <div class="plan-card-lg ${isPopular ? 'popular' : ''}">
        ${isPopular ? `<div class="plan-badge-lg">⭐ ${t.popular}</div>` : ''}

        <div class="plan-name-lg">${p.display_name}</div>
        <div class="plan-desc-lg">${
          p.plan === 'free' ? (currentLang === 'ar' ? 'للمكاتب الصغيرة' : 'For small firms') :
          p.plan === 'starter' ? (currentLang === 'ar' ? 'للمكاتب النامية' : 'For growing firms') :
          p.plan === 'pro' ? (currentLang === 'ar' ? 'للمكاتب المتوسطة' : 'For medium firms') :
          (currentLang === 'ar' ? 'للمكاتب الكبيرة' : 'For large firms')
        }</div>

        <div class="plan-price-lg">
          <span class="plan-price-num-lg">${p.price_egp}</span>
          <span class="plan-price-cur-lg">
            EGP<br>${isFree ? t.forever : t.perMonth}
          </span>
        </div>

        <ul class="plan-features-lg">
          ${features.slice(0, 6).map(f => `<li>${f}</li>`).join('')}
          <li style="opacity:0.6;font-size:12px">${limitText}</li>
        </ul>

        <a href="${ctaUrl}"
           class="plan-cta-lg ${isPopular ? 'primary' : 'secondary'}">
          ${ctaText}
        </a>
      </div>
    `;
  }).join('');
}

// ============================================================
// Render Comparison Table
// ============================================================
function renderComparison() {
  const t = I18N[currentLang];
  const table = document.getElementById('comparison-table');
  if (!plansData.length || !table) return;

  const allFeatures = new Set();
  plansData.forEach(p => {
    Object.keys(p.features || {}).forEach(k => allFeatures.add(k));
  });

  const features = Array.from(allFeatures);

  table.querySelector('thead').innerHTML = `
    <tr>
      <th>${currentLang === 'ar' ? 'الميزة' : 'Feature'}</th>
      ${plansData.map(p => `<th>${p.display_name}</th>`).join('')}
    </tr>
  `;

  const featureRows = features.map(f => `
    <tr>
      <td>${t.featureLabels[f] || f}</td>
      ${plansData.map(p => `
        <td>${p.features?.[f] ? '<span class="check">✓</span>' : '<span class="cross">×</span>'}</td>
      `).join('')}
    </tr>
  `).join('');

  const limitKeys = ['max_users', 'max_cases', 'max_clients', 'max_storage_mb'];
  const limitRows = limitKeys.map(k => `
    <tr>
      <td>${t.limitLabels[k] || k}</td>
      ${plansData.map(p => {
        const v = p.limits?.[k];
        const val = v === -1 ? '∞' : (k === 'max_storage_mb' ? `${v} MB` : v);
        return `<td><span class="value">${val}</span></td>`;
      }).join('')}
    </tr>
  `).join('');

  table.querySelector('tbody').innerHTML = featureRows + limitRows;
}

// ============================================================
// Render FAQ
// ============================================================
function renderFaq() {
  const t = I18N[currentLang];
  const grid = document.getElementById('faq-grid');
  if (!grid) return;

  grid.innerHTML = t.faqs.map(f => `
    <div class="faq-item">
      <h3 class="faq-q">${f.q}</h3>
      <p class="faq-a">${f.a}</p>
    </div>
  `).join('');
}