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