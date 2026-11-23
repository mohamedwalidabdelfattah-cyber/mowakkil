// web/js/signup.js
// منطق التسجيل الذاتي

import { STORAGE_KEYS, API_BASE } from './config.js';
import { startIconify } from './icons.js';

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

// تنسيق رقم الهاتف أثناء الكتابة
document.getElementById('phone').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^\d+]/g, '');
});