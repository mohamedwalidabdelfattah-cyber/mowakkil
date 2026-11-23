// web/js/views/account.js
import { apiJson, getRole } from '../api.js';
import { can } from '../access.js';
import { showView } from '../router.js';
import { toast } from '../ui.js';
import { STORAGE_KEYS } from '../config.js';

export async function render(host) {
  const isAdmin = can('team.manage');
  host.innerHTML = `
    <div class="card">
      <h3>بياناتي</h3>
      <label>الاسم</label><input id="ac-name">
      <label style="margin-top:10px">البريد الإلكتروني</label><input id="ac-email" type="email">
      <button class="primary" style="margin-top:10px" id="save-account">حفظ البيانات</button>
      <div id="ac-status" class="status" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <h3>تغيير كلمة المرور</h3>
      <label>كلمة المرور الحالية</label><input id="ac-old" type="password">
      <label style="margin-top:10px">كلمة المرور الجديدة (8 حروف على الأقل)</label><input id="ac-new" type="password">
      <button class="primary" style="margin-top:10px" id="change-pw">تغيير</button>
      <div id="ac-pw-status" class="status" style="margin-top:8px"></div>
    </div>

    ${isAdmin ? `
      <div class="card">
        <h3>👥 أعضاء المكتب وصلاحياتهم</h3>
        <p class="meta" style="margin:0 0 10px">إضافة أعضاء، تحديد دور كل واحد (شريك، محامي، سكرتير، محاسب، متدرب) والقضايا اللي يشوفها.</p>
        <button class="btn btn-primary" id="go-team">فتح الفريق والصلاحيات</button>
      </div>` : ''}
  `;

  host.querySelector('#save-account').addEventListener('click', async () => {
    const st = document.getElementById('ac-status');
    st.textContent = 'جاري الحفظ...'; st.className = 'status';
    try {
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: document.getElementById('ac-name').value.trim(),
          email: document.getElementById('ac-email').value.trim(),
        }),
      });
      st.textContent = 'اتحفظ ✓'; st.className = 'status ok';
      toast('اتحفظ', 'ok');
    } catch (e) { st.textContent = e.message; st.className = 'status bad'; }
  });

  host.querySelector('#change-pw').addEventListener('click', async () => {
    const st = document.getElementById('ac-pw-status');
    st.textContent = 'جاري التغيير...'; st.className = 'status';
    try {
      await apiJson('/api/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({
          old_password: document.getElementById('ac-old').value,
          new_password: document.getElementById('ac-new').value,
        }),
      });
      st.textContent = 'اتغيّرت ✓'; st.className = 'status ok';
      document.getElementById('ac-old').value = '';
      document.getElementById('ac-new').value = '';
    } catch (e) { st.textContent = e.message; st.className = 'status bad'; }
  });

  host.querySelector('#go-team')?.addEventListener('click', () => showView('team'));
  host.querySelector('#create-user')?.addEventListener('click', async () => {
    const st = document.getElementById('nu-status');
    st.textContent = 'جاري الإنشاء...'; st.className = 'status';
    try {
      await apiJson('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: document.getElementById('nu-name').value.trim(),
          email: document.getElementById('nu-email').value.trim(),
          password: document.getElementById('nu-pass').value,
          role: 'lawyer',
        }),
      });
      st.textContent = 'اتعمل ✓'; st.className = 'status ok';
      document.getElementById('nu-name').value = '';
      document.getElementById('nu-email').value = '';
      document.getElementById('nu-pass').value = '';
    } catch (e) { st.textContent = e.message; st.className = 'status bad'; }
  });
}

export async function saveOffice() {
  const st = document.getElementById('cfg-status');
  st.textContent = 'جاري الحفظ...'; st.className = 'status';
  try {
    const pending = localStorage.getItem(STORAGE_KEYS.LOGO_PENDING);
    const logo = pending || document.getElementById('logo-preview').src || null;
    const name_ar = document.getElementById('office-name').value.trim();
    await apiJson('/api/office', {
      method: 'PATCH',
      body: JSON.stringify({ name_ar, logo }),
    });
    st.textContent = 'اتحفظ ✓'; st.className = 'status ok';
    toast('اتحفظ', 'ok');
    if (name_ar) document.getElementById('hero-title').textContent = name_ar;
    if (logo) {
      const img = document.getElementById('hero-logo');
      img.src = logo; img.hidden = false;
      document.getElementById('logo-preview').src = logo;
    }
    localStorage.removeItem(STORAGE_KEYS.LOGO_PENDING);
  } catch (e) { st.textContent = e.message; st.className = 'status bad'; }
}

export async function loadOffice() {
  try {
    const o = await apiJson('/api/office');
    if (o?.name_ar || o?.logo) {
      document.getElementById('office-name').value = o.name_ar || '';
      if (o.name_ar) document.getElementById('hero-title').textContent = o.name_ar;
      if (o.logo) {
        const img = document.getElementById('hero-logo');
        img.src = o.logo; img.hidden = false;
        document.getElementById('logo-preview').src = o.logo;
      }
    }
    const banner = document.getElementById('trial-banner');
    if (o?.status === 'active')    { banner.textContent = '✅ الاشتراك مفعّل'; banner.className = 'trial'; }
    else if (o?.status === 'suspended') { banner.textContent = '⚠️ الحساب موقوف'; banner.className = 'trial expired'; }
    else if (o?.trial_ends_at) {
      const remaining = Math.ceil((new Date(o.trial_ends_at) - new Date()) / 86400000);
      if (remaining > 0) { banner.textContent = `🎁 فترة التجربة: متبقي ${remaining} يوم`; banner.className = 'trial'; }
      else { banner.textContent = '⚠️ انتهت فترة التجربة المجانية'; banner.className = 'trial expired'; document.getElementById('trial-blocker').classList.add('show'); }
    }
  } catch {}
}