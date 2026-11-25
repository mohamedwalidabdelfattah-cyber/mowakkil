// web/js/pricing.js
import { detectVisitorCountry } from './region.js';
const API_BASE = 'https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev';
const TOKEN_KEY = 'mowakkil_token';

let currentLang = localStorage.getItem('mowakkil_pricing_lang') || 'ar';
let currentBilling = 'monthly';
let plansData = [];

// ✅ بيانات تجريبية للاختبار المحلي
const MOCK_PLANS = [
  { plan: 'starter', display_name: 'الأساسية', display_name_en: 'Starter', price_egp: 199, billing_type: 'monthly', features: { cases: true, clients: true, agenda: true, portal: true, finance: true, invoices: true, accounting: false }, limits: { max_users: 3, max_cases: -1, max_clients: -1, max_storage_mb: 500 } },
  { plan: 'pro', display_name: 'الاحترافية', display_name_en: 'Pro', price_egp: 399, billing_type: 'monthly', features: { cases: true, clients: true, agenda: true, portal: true, finance: true, invoices: true, accounting: true, ai: true, advanced_reports: true }, limits: { max_users: 5, max_cases: -1, max_clients: -1, max_storage_mb: 2000, ai_monthly: 300 } },
  { plan: 'plus', display_name: 'المتقدمة', display_name_en: 'Plus', price_egp: 799, billing_type: 'monthly', features: { cases: true, clients: true, agenda: true, portal: true, finance: true, invoices: true, accounting: true, finance_advanced: true, ai: true, advanced_reports: true, whatsapp: true, multi_office: true, api: true }, limits: { max_users: 20, max_cases: -1, max_clients: -1, max_storage_mb: 5000, ai_monthly: 1000 } },
  { plan: 'lifetime_basic', display_name: 'التأسيس (مدى الحياة)', display_name_en: 'Lifetime Basic', price_egp: 4999, billing_type: 'lifetime', features: { cases: true, clients: true, agenda: true, portal: true, finance: true }, limits: { max_users: 3, max_cases: -1, max_clients: -1, max_storage_mb: 500 } },
  { plan: 'lifetime_pro', display_name: 'المكتب المتكامل (مدى الحياة)', display_name_en: 'Lifetime Pro', price_egp: 9999, billing_type: 'lifetime', features: { cases: true, clients: true, agenda: true, portal: true, finance: true, invoices: true, accounting: true, finance_advanced: true, ai: true, advanced_reports: true, whatsapp: true, api: true }, limits: { max_users: 10, max_cases: -1, max_clients: -1, max_storage_mb: 2000, ai_monthly: 300 } },
];
// السعر بالريال للتجربة المحلية (زي قاعدة البيانات الحية: migration 045)
const MOCK_SAR = { free: 0, starter: 149, pro: 299, plus: 599, lifetime_basic: 3999, lifetime_pro: 7999 };
MOCK_PLANS.forEach(p => { p.price_sar = MOCK_SAR[p.plan] ?? null; });

const I18N = {
  ar: {
    dir: 'rtl', lang: 'ar',
    heroBadge: '🎁 15 يوم تجربة مجانية',
    heroTitle: 'باقات تناسب كل مكتب محاماة',
    heroSub: 'اختار الباقة اللي تناسب حجم مكتبك. ابدأ بتجربة مجانية 15 يوم، وارقّي وقت ما تحتاج.',
    comparisonTitle: 'مقارنة المميزات',
    faqTitle: 'أسئلة شائعة',
    ctaTitle: 'جاهز تبدأ؟',
    ctaSub: 'جرّب مُوكِّل مجانًا لمدة 15 يوم — بدون بطاقة بنكية.',
    ctaBtn: '🚀 ابدأ مجانًا 15 يوم',
    footerText: '© 2026 مُوكِّل · كل الحقوق محفوظة',
    footerHome: 'الرئيسية', footerWa: 'تواصل', login: 'دخول',
    popular: 'الأكثر شعبية', subscribe: '🚀 اشترك الآن', subscribeFree: '🎁 ابدأ مجانًا',
    perMonth: '/ شهر', forever: 'للأبد', once: 'مرة واحدة',
    featureLabels: { cases: 'إدارة القضايا', clients: 'إدارة الموكلين', agenda: 'الأجندة والجلسات', portal: 'بوابة الموكل', finance: 'الأتعاب والتحصيل والمصروفات وكشف الحساب', invoices: 'الفواتير والضرائب', accounting: 'المحاسبة الكاملة (قيود وقوائم مالية)', finance_advanced: 'أدوات المكاتب الكبيرة (فروع، موافقات، مرتبات، قفل الفترات)', ai: 'الذكاء الاصطناعي', advanced_reports: 'التقارير المتقدمة', whatsapp: 'تكامل واتساب', multi_office: 'مكاتب متعددة', api: 'API Access' },
    limitLabels: { max_users: 'المستخدمين', max_cases: 'القضايا', max_clients: 'الموكلين', max_storage_mb: 'التخزين', ai_monthly: 'طلبات الذكاء الاصطناعي / شهر' },
    faqs: [
      { q: 'إيه الفرق بين الباقات؟', a: 'الأساسية للمكاتب الصغيرة وفيها المحاسبة والفواتير، الاحترافية تضيف الذكاء الاصطناعي والتقارير المتقدمة، والمتقدمة للمكاتب الكبيرة.' },
      { q: 'أقدر أرقّي الباقة في أي وقت؟', a: 'أيوه، من صفحة "اشتراكي" جوه النظام، وهتتفعّل فورًا.' },
      { q: 'في تجربة مجانية؟', a: 'أيوه، 15 يوم تجربة كاملة على الباقة الاحترافية، بدون بطاقة بنكية.' },
      { q: 'إيه طرق الدفع المتاحة؟', a: 'فودافون كاش وإنستاباي. تواصل معانا وبنساعدك.' },
      { q: 'أقدر ألغي في أي وقت؟', a: 'أيوه، الاشتراك شهري وتقدر تلغيه في أي وقت.' },
      { q: 'البيانات آمنة؟', a: 'أيوه، مشفّرة ومحفوظة على Cloudflare. محدش يقدر يوصل لبيانات مكتبك إلا إنت.' },
    ],
  },
  en: {
    dir: 'ltr', lang: 'en',
    heroBadge: '🎁 15-day free trial',
    heroTitle: 'Plans for every law firm',
    heroSub: 'Pick the plan that fits your firm. Start free, upgrade anytime.',
    comparisonTitle: 'Features Comparison',
    faqTitle: 'Frequently Asked Questions',
    ctaTitle: 'Ready to start?',
    ctaSub: 'Try Mowakkil free for 15 days — no credit card required.',
    ctaBtn: '🚀 Start Free 15 Days',
    footerText: '© 2026 Mowakkil · All rights reserved',
    footerHome: 'Home', footerWa: 'Contact', login: 'Login',
    popular: 'Most Popular', subscribe: '🚀 Subscribe', subscribeFree: '🎁 Start Free',
    perMonth: '/ month', forever: 'forever', once: 'once',
    featureLabels: { cases: 'Case Management', clients: 'Client Management', agenda: 'Agenda & Sessions', portal: 'Client Portal', finance: 'Fees, collections & expenses', invoices: 'Invoices & Tax', accounting: 'Full accounting (journal & statements)', finance_advanced: 'Large-firm tools (branches, approvals, payroll, period lock)', ai: 'AI', advanced_reports: 'Advanced Reports', whatsapp: 'WhatsApp', multi_office: 'Multi Offices', api: 'API Access' },
    limitLabels: { max_users: 'Users', max_cases: 'Cases', max_clients: 'Clients', max_storage_mb: 'Storage', ai_monthly: 'AI requests / month' },
    faqs: [
      { q: 'What is the difference between plans?', a: 'Starter for small firms (with finance & invoices), Pro adds AI and advanced reports, Plus for large firms.' },
      { q: 'Can I upgrade anytime?', a: 'Yes, from the "My Subscription" page.' },
      { q: 'Is there a free trial?', a: 'Yes, 15 days free on Pro plan, no credit card.' },
      { q: 'What payment methods?', a: 'Vodafone Cash and InstaPay.' },
      { q: 'Can I cancel anytime?', a: 'Yes, subscriptions are monthly.' },
      { q: 'Is our data safe?', a: 'Yes, encrypted on Cloudflare. Only you can access it.' },
    ],
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  applyLang(currentLang);
  [, currentCountry] = await Promise.all([loadPlans(), detectVisitorCountry()]);
  renderPlans();
  renderComparison();
  renderFaq();
  setupBillingToggle();
});

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

// ============ الدولة (مصر / السعودية): العملة والأسعار ============
// الزائر بيشوف أسعار دولته بس (مفيش مقارنة بين المصري والسعودي) — الدولة بتتعرف من أكتر من علامة (region.js)
const SUPPORT_WA = '201013917789';
let currentCountry = 'EG';
const isSA = () => currentCountry === 'SA';
function planPrice(p) {
  const v = isSA() ? (p.price_sar ?? MOCK_SAR[p.plan]) : p.price_egp;
  return v == null ? '—' : Number(v).toLocaleString('en-US');
}
const curLabel = () => (isSA() ? (currentLang === 'ar' ? 'ر.س' : 'SAR') : 'EGP');

function setupBillingToggle() {
  const toggle = document.getElementById('billing-toggle');
  if (!toggle) return;
  toggle.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBilling = btn.dataset.billing;
      renderPlans();
      renderComparison();
    });
  });
}

async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/api/subscription/plans`);
    const data = await res.json();
    plansData = data.data || data || [];
    if (!plansData.length) throw new Error('empty');
  } catch (e) {
    console.warn('API failed, using mock data for local testing');
    plansData = MOCK_PLANS;
  }
}

function fmtStorage(mb) {
  if (mb === -1) return '∞';
  if (mb >= 1024) return `${+(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function renderPlans() {
  const t = I18N[currentLang];
  const grid = document.getElementById('plans-grid');
  const filteredPlans = plansData.filter(p => (p.billing_type || 'monthly') === currentBilling);

  if (!filteredPlans.length) {
    grid.innerHTML = '<div class="pricing-loading">الباقات دي مش متاحة حالياً</div>';
    return;
  }

  const isLoggedIn = !!localStorage.getItem(TOKEN_KEY);

  grid.innerHTML = filteredPlans.map(p => {
    const isPopular = p.plan === 'pro' || p.plan === 'lifetime_pro';
    const isFree = p.plan === 'free';
    const isLifetime = p.billing_type === 'lifetime';
    const features = Object.entries(p.features || {}).filter(([_, v]) => v === true).map(([k]) => t.featureLabels[k] || k);
    const limits = p.limits || {};
    const limitText = `👥 ${limits.max_users === -1 ? '∞' : limits.max_users} · 📁 ${limits.max_cases === -1 ? '∞' : limits.max_cases} · 👤 ${limits.max_clients === -1 ? '∞' : limits.max_clients} · 💾 ${fmtStorage(limits.max_storage_mb)}`;
    let ctaUrl = isFree ? '/signup' : (isLoggedIn ? `/pay?plan=${p.plan}` : `/signup?plan=${p.plan}`);
    // السعودية: التسجيل بالسعودية مختارة، والاشتراك (للمسجّل) من خلال واتساب الدعم لحد ما يتفعّل الدفع السعودي
    if (isSA() && !isFree) {
      const name = currentLang === 'ar' ? p.display_name : (p.display_name_en || p.display_name);
      ctaUrl = isLoggedIn
        ? `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(`مرحباً، حابب أشترك في باقة ${name} (${planPrice(p)} ر.س) لمكتبي في السعودية.`)}`
        : `/signup?plan=${p.plan}&country=SA`;
    }
    const ctaText = isFree ? t.subscribeFree : t.subscribe;

    return `
      <div class="plan-card-lg ${isPopular ? 'popular' : ''}">
        ${isPopular ? `<div class="plan-badge-lg">⭐ ${t.popular}</div>` : ''}
        ${isLifetime ? `<div class="lifetime-badge">💎 ${t.once}</div>` : ''}
        <div class="plan-name-lg">${currentLang === 'ar' ? p.display_name : (p.display_name_en || p.display_name)}</div>
        <div class="plan-desc-lg">${
          p.plan === 'free' ? (currentLang === 'ar' ? 'للمكاتب الصغيرة' : 'For small firms') :
          p.plan === 'starter' ? (currentLang === 'ar' ? 'للمكاتب النامية' : 'For growing firms') :
          p.plan === 'pro' ? (currentLang === 'ar' ? 'للمكاتب المتوسطة' : 'For medium firms') :
          p.plan === 'lifetime_basic' ? (currentLang === 'ar' ? 'تأسيس المكتب' : 'Firm setup') :
          p.plan === 'lifetime_pro' ? (currentLang === 'ar' ? 'المكتب المتكامل' : 'Complete firm') :
          (currentLang === 'ar' ? 'للمكاتب الكبيرة' : 'For large firms')
        }</div>
        <div class="plan-price-lg">
          <span class="plan-price-num-lg">${planPrice(p)}</span>
          <span class="plan-price-cur-lg">${curLabel()}<br>${isFree ? t.forever : (isLifetime ? t.once : t.perMonth)}</span>
        </div>
        <ul class="plan-features-lg">
          ${features.slice(0, 6).map(f => `<li>${f}</li>`).join('')}
          <li style="opacity:0.6;font-size:12px">${limitText}</li>
        </ul>
        <a href="${ctaUrl}" class="plan-cta-lg ${isPopular ? 'primary' : 'secondary'}">${ctaText}</a>
      </div>
    `;
  }).join('');
}

function renderComparison() {
  const t = I18N[currentLang];
  const table = document.getElementById('comparison-table');
  const plans = plansData.filter(p => (p.billing_type || 'monthly') === currentBilling);
  if (!plans.length) return;

  const allFeatures = new Set();
  plans.forEach(p => Object.keys(p.features || {}).forEach(k => allFeatures.add(k)));
  const features = Array.from(allFeatures);

  table.querySelector('thead').innerHTML = `
    <tr><th>${currentLang === 'ar' ? 'الميزة' : 'Feature'}</th>${plans.map(p => `<th>${currentLang === 'ar' ? p.display_name : (p.display_name_en || p.display_name)}</th>`).join('')}</tr>
  `;
  const featureRows = features.map(f => `<tr><td>${t.featureLabels[f] || f}</td>${plans.map(p => `<td>${p.features?.[f] ? '<span class="check">✓</span>' : '<span class="cross">×</span>'}</td>`).join('')}</tr>`).join('');
  const limitKeys = ['max_users', 'max_cases', 'max_clients', 'max_storage_mb', 'ai_monthly'];
  const limitRows = limitKeys.map(k => `<tr><td>${t.limitLabels[k] || k}</td>${plans.map(p => { const v = p.limits?.[k]; if (k === 'ai_monthly' && !v) return '<td><span class="cross">×</span></td>'; const val = k === 'max_storage_mb' ? fmtStorage(v) : (v === -1 ? '∞' : v); return `<td><span class="value">${val}</span></td>`; }).join('')}</tr>`).join('');
  table.querySelector('tbody').innerHTML = featureRows + limitRows;
}

function renderFaq() {
  const t = I18N[currentLang];
  const grid = document.getElementById('faq-grid');
  grid.innerHTML = t.faqs.map(f => `<div class="faq-item"><h3 class="faq-q">${f.q}</h3><p class="faq-a">${f.a}</p></div>`).join('');
}