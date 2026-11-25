// web/js/signup.js
// منطق التسجيل الذاتي

import { STORAGE_KEYS, API_BASE } from './config.js';
import { startIconify } from './icons.js';
import { detectVisitorCountry, isSaudiPhone } from './region.js';

startIconify();

const form = document.getElementById('signup-form');
const btn = document.getElementById('signup-btn');
const status = document.getElementById('signup-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await doSignup();
});

async function doSignup() {
  const office_name = document.getElementById('office_name').value.trim();
  const full_name = document.getElementById('full_name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  const terms = document.getElementById('terms').checked;

  // Validation
  if (!office_name) return showError('اكتب اسم المكتب');
  if (!full_name) return showError('اكتب اسمك');
  if (!phone) return showError('اكتب رقم الهاتف');
  if (password.length < 8) return showError('كلمة المرور لازم 8 حروف على الأقل');
  if (password !== password2) return showError('كلمتا المرور مش متطابقتين');
  if (!terms) return showError('لازم توافق على الشروط والأحكام');

  // UI
  btn.disabled = true;
  btn.textContent = 'جاري إنشاء الحساب...';
  status.textContent = '';
  status.className = 'status';

  try {
    const res = await fetch(API_BASE + '/api/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        office_name,
        full_name,
        phone,
        email: email || null,
        password,
        country: selectedCountry, // مصر / السعودية
        // مصدر الزيارة (إعلان فيسبوك/إنستجرام…) — من attribution.js
        attribution: (typeof window.mowakkilAttribution === 'function' && window.mowakkilAttribution()) || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'فشل التسجيل');
    }

    // نحفظ التوكن
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.ROLE, data.role);
    localStorage.setItem(STORAGE_KEYS.OFFICE, String(data.office_id));
    localStorage.setItem('mowakkil_name', data.name);
    // دولة المكتب وعملته وضريبته من أول لحظة (قبل ما الإعدادات تتحمّل)
    if (data.country) localStorage.setItem('mowakkil_country', data.country);
    if (data.currency) localStorage.setItem('mowakkil_currency', data.currency);
    if (data.vat_rate != null) localStorage.setItem('mowakkil_vat', String(data.vat_rate));

    showSuccess('✅ تم إنشاء الحساب! جاري التحويل...');

    // ✅ لو فيه plan في الـ URL → /pay
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    const targetUrl = (plan && ['starter', 'pro', 'plus'].includes(plan))
      ? `/pay?plan=${plan}`
      : '/';

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 1200);

  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.textContent = '🚀 إنشاء الحساب';
  }
}

function showError(msg) {
  status.textContent = '⚠️ ' + msg;
  status.className = 'status bad';
}

function showSuccess(msg) {
  status.textContent = msg;
  status.className = 'status ok';
}

// ============ دولة المكتب ============
const COUNTRY_UI = {
  EG: { placeholder: '01012345678', hint: 'العملة جنيه، والتواريخ ميلادي، والمحاكم والقوانين المصرية' },
  SA: { placeholder: '0512345678', hint: 'العملة ريال وضريبة 15%، والتواريخ هجري وميلادي، والمحاكم والأنظمة السعودية' },
};
let selectedCountry = 'EG';
// ويندوز مبيرسمش أعلام الدول — بيكتب EG/SA، فبنخفيها
try { if (/Windows/.test(navigator.userAgent)) document.documentElement.classList.add('no-flags'); } catch {}
function pickCountry(c) {
  selectedCountry = COUNTRY_UI[c] ? c : 'EG';
  document.querySelectorAll('.country-opt').forEach(b => {
    const on = b.dataset.country === selectedCountry;
    b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on));
  });
  document.getElementById('phone').placeholder = COUNTRY_UI[selectedCountry].placeholder;
  const hint = document.getElementById('country-hint');
  if (hint) hint.textContent = COUNTRY_UI[selectedCountry].hint;
}
let countryChosenByUser = false;
document.querySelectorAll('.country-opt').forEach(b => b.addEventListener('click', () => { countryChosenByUser = true; pickCountry(b.dataset.country); }));
// اختيار تلقائي من أكتر من علامة (اللينك، لغة الجهاز، التوقيت، دولة الاتصال) — region.js
pickCountry('EG');
detectVisitorCountry().then(c => { if (!countryChosenByUser) pickCountry(c); }).catch(() => {});

// تنسيق رقم الهاتف أثناء الكتابة
document.getElementById('phone').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^\d+]/g, '');
  // رقم سعودي (05… / +966…) → المكتب سعودي، إلا لو هو اختار بنفسه
  if (!countryChosenByUser && isSaudiPhone(e.target.value)) pickCountry('SA');
});