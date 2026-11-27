// web/js/views/login.js
// منطق تسجيل الدخول

import { API_BASE } from '../config.js';
import { setSession, clearSession } from '../api.js';

export function bindForm() {
  document.getElementById('lg-pass')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') doLogin();
  });
}

export async function doLogin() {
  const st = document.getElementById('lg-status');
  const email = document.getElementById('lg-email').value.trim();
  const password = document.getElementById('lg-pass').value;

  if (!email || !password) {
    st.textContent = 'اكتب البيانات';
    st.className = 'status bad';
    return;
  }

  st.textContent = 'جاري الدخول...';
  st.className = 'status';

  try {
    const res = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      st.textContent = data.error || 'بيانات الدخول غلط';
      st.className = 'status bad';
      return;
    }

    setSession({
      token: data.token,
      role: data.role,
      office_id: data.office_id,
    });
    localStorage.setItem('mowakkil_name', data.name || '');

    st.textContent = '';
    window.location.reload();

  } catch (e) {
    st.textContent = 'مش قادر يتصل بالسيرفر';
    st.className = 'status bad';
  }
}

export function doLogout() {
  clearSession();
  location.reload();
}
// ============================================================
// «نسيت كلمة السر»: الطلب بيوصل لفريق مُوكِّل وبيبعتوا كلمة سر مؤقتة واتساب
// ============================================================
const SUPPORT_PHONE = '201013917789';
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openForgot() {
  document.getElementById('forgot-modal')?.remove();
  const prefill = document.getElementById('lg-email')?.value.trim() || '';
  const m = document.createElement('div');
  m.id = 'forgot-modal';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">🔑 نسيت كلمة السر</h3>
        <button class="icon-btn" data-close aria-label="إغلاق">✕</button>
      </div>
      <div id="fg-body">
        <p style="font-size:14px;color:var(--text-soft);margin:0 0 12px;line-height:1.8">
          اكتب رقم موبايلك اللي بتدخل بيه، وهنبعتلك كلمة سر جديدة على <strong>الواتساب</strong> على نفس الرقم.
        </p>
        <label class="label" for="fg-id">رقم الموبايل أو الإيميل</label>
        <input id="fg-id" class="input" type="text" inputmode="tel" autocomplete="username" placeholder="01xxxxxxxxx" value="${escHtml(prefill)}">
        <button class="btn btn-primary btn-block" data-send style="margin-top:14px">إرسال الطلب</button>
        <div id="fg-status" class="status"></div>
        <p style="font-size:12.5px;color:var(--text-soft);margin:12px 0 0;line-height:1.7">
          💡 لو إنت عضو في فريق مكتب، مدير المكتب يقدر يغيّرهالك على طول من صفحة «الفريق».
        </p>
      </div>
    </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  const input = m.querySelector('#fg-id');
  input.focus();
  const send = async () => {
    const st = m.querySelector('#fg-status');
    const identifier = input.value.trim();
    if (!identifier) { st.textContent = 'اكتب رقم الموبايل'; st.className = 'status bad'; return; }
    const btn = m.querySelector('[data-send]');
    btn.disabled = true; st.textContent = 'جاري الإرسال...'; st.className = 'status';
    try {
      const res = await fetch(API_BASE + '/api/auth/forgot', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { st.textContent = data.error || 'حصلت مشكلة، جرب تاني'; st.className = 'status bad'; btn.disabled = false; return; }
      const wa = 'https://wa.me/' + SUPPORT_PHONE + '?text=' + encodeURIComponent(`السلام عليكم، نسيت كلمة السر بتاعة حسابي على مُوكِّل. رقمي: ${identifier}`);
      m.querySelector('#fg-body').innerHTML = `
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:40px">✅</div>
          <p style="font-size:15px;font-weight:700;margin:8px 0">طلبك وصل</p>
          <p style="font-size:14px;color:var(--text-soft);line-height:1.8;margin:0 0 14px">
            هنبعتلك كلمة سر جديدة على الواتساب في أقرب وقت.<br>بعد ما تدخل بيها، غيّرها من «حسابي».
          </p>
          <a class="btn btn-block" href="${wa}" target="_blank" rel="noopener" style="background:#25D366;border-color:#25D366;color:#fff;text-decoration:none">💬 مستعجل؟ كلّمنا واتساب</a>
          <button class="btn btn-ghost btn-block" data-close style="margin-top:8px">رجوع لتسجيل الدخول</button>
        </div>`;
    } catch {
      st.textContent = 'مش قادر يتصل بالسيرفر'; st.className = 'status bad'; btn.disabled = false;
    }
  };
  m.querySelector('[data-send]').addEventListener('click', send);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });
}
