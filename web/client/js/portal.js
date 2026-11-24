// web/client/js/portal.js
// منطق بوابة الموكل

// على الجهاز (localhost) بيكلم الـ Worker المحلي للتجربة، وغير كده الـ API الحي
const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:8787'
  : 'https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev';

let currentClient = null;
let currentOffice = null;
let currentView = 'cases';

// ============================================================
// API Helper — معدل (مش بيبعت token في login/quick-login)
// ============================================================
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = localStorage.getItem('mowakkil_client_token');

  // ✅ مبنبعتش token في login / quick-login
  const isAuthEndpoint = path.includes('/login') || path.includes('/quick-login');
  if (token && !isAuthEndpoint) headers.authorization = 'Bearer ' + token;

  if (opts.body && !(opts.body instanceof FormData) && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  const res = await fetch(API_BASE + path, { ...opts, headers });

  if (res.status === 401 && !isAuthEndpoint) {
    throw new Error('انتهت الجلسة، سجّل دخول من جديد');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'خطأ في الاتصال');
  }

  return res.json();
}

// ============================================================
// Toast
// ============================================================
function toast(msg, type = '') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============================================================
// Utils
// ============================================================
function esc(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function fmtMoney(n) {
  // نفس شكل الأرقام في التطبيق (أرقام لاتينية بفواصل)
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function skeleton(n = 3) {
  return Array.from({ length: n }).map(() => '<div class="skeleton"></div>').join('');
}

function empty(msg) {
  return `<div class="empty">${esc(msg)}</div>`;
}

// ============================================================
// PWA Install
// ============================================================
function getEnvironment() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return { os: 'ios', browser: 'safari' };
  if (/android/.test(ua)) {
    if (/miuibrowser|xiaomi|mibrowser/.test(ua)) return { os: 'android', browser: 'mi' };
    if (/samsungbrowser/.test(ua)) return { os: 'android', browser: 'samsung' };
    if (/firefox/.test(ua)) return { os: 'android', browser: 'firefox' };
    if (/chrome/.test(ua)) return { os: 'android', browser: 'chrome' };
    return { os: 'android', browser: 'other' };
  }
  return { os: 'desktop', browser: 'other' };
}

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

let installBound = false;
function setupInstallButton() {
  const btn = document.getElementById('install-btn');
  if (!btn) return;
  if (isAppInstalled()) { btn.hidden = true; return; }
  btn.hidden = false;
  if (installBound) return;
  installBound = true;
  btn.addEventListener('click', installApp);
  document.addEventListener('portal:installed', () => {
    btn.hidden = true;
    toast('تم تثبيت التطبيق — هتلاقيه على الشاشة الرئيسية', 'ok');
  });
}

// التثبيت: لو المتصفح بيدعم نافذة التثبيت (Chrome/Edge/Samsung) → تطبيق حقيقي بضغطة واحدة
// غير كده (iPhone / متصفحات تانية) → خطوات واضحة
async function installApp() {
  const prompt = window.__installPrompt;
  if (prompt) {
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      window.__installPrompt = null;
      if (outcome === 'accepted') document.getElementById('install-btn').hidden = true;
      return;
    } catch {}
  }
  showInstallSheet();
}

function showInstallSheet() {
  document.querySelectorAll('.install-sheet, .install-sheet-backdrop').forEach(el => el.remove());

  const env = getEnvironment();
  let title = '', sub = '', steps = '', showChromeBtn = false;

  if (env.os === 'ios') {
    title = '📲 تثبيت على iPhone';
    sub = 'اتبع الخطوات دي في Safari';
    steps = `
      <li><span class="num">1</span> افتح الموقع في متصفح <strong>Safari</strong></li>
      <li><span class="num">2</span> دوس على زر المشاركة <strong>⤴️</strong></li>
      <li><span class="num">3</span> اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> ➕</li>
      <li><span class="num">4</span> دوس <strong>"إضافة"</strong></li>
    `;
    // على iPhone التطبيق المتثبت ليه تخزين منفصل عن Safari → الدخول بالرابط بس مش هيكمل جوه التطبيق
    if (currentClient && !currentClient.has_password) {
      steps = `<li class="install-note">🔐 قبل التثبيت: اعمل باسورد من ⚙️ الإعدادات عشان تقدر تدخل من التطبيق.</li>` + steps;
    }
  } else if (env.os === 'android' && (env.browser === 'mi' || env.browser === 'firefox')) {
    title = '📲 تثبيت على Android';
    sub = 'متصفحك الحالي مش بيدعم التثبيت';
    showChromeBtn = true;
    steps = `
      <li><span class="num">1</span> افتح الموقع في <strong>Google Chrome</strong></li>
      <li><span class="num">2</span> دوس على قائمة <strong>⋮</strong> في أعلى يمين الشاشة</li>
      <li><span class="num">3</span> اختر <strong>"تثبيت التطبيق"</strong></li>
      <li><span class="num">4</span> دوس <strong>"تثبيت"</strong></li>
    `;
  } else if (env.os === 'android' && env.browser === 'samsung') {
    title = '📲 تثبيت على Samsung';
    sub = 'من قائمة Samsung Internet';
    steps = `
      <li><span class="num">1</span> دوس على قائمة <strong>☰</strong></li>
      <li><span class="num">2</span> اختر <strong>"إضافة صفحة إلى"</strong></li>
      <li><span class="num">3</span> اختر <strong>"الشاشة الرئيسية"</strong></li>
    `;
  } else if (env.os === 'android' && env.browser === 'chrome') {
    title = '📲 تثبيت على Android';
    sub = 'من قائمة Chrome';
    steps = `
      <li><span class="num">1</span> دوس على قائمة <strong>⋮</strong> في أعلى يمين الشاشة</li>
      <li><span class="num">2</span> اختر <strong>"تثبيت التطبيق"</strong></li>
      <li><span class="num">3</span> دوس <strong>"تثبيت"</strong></li>
    `;
  } else {
    title = '📲 تثبيت التطبيق';
    sub = 'من المتصفح';
    steps = `
      <li><span class="num">1</span> دوس على أيقونة التنزيل <strong>📥</strong> في شريط العنوان</li>
    `;
  }

  const chromeIntent = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;

  const html = `
    <div class="install-sheet-backdrop" id="install-backdrop"></div>
    <div class="install-sheet" id="install-sheet">
      <div class="install-handle"></div>
      <h3 class="install-title">${title}</h3>
      <p class="install-sub">${sub}</p>
      <ul class="install-steps">${steps}</ul>
      <div class="install-actions">
        ${showChromeBtn ? `<a href="${chromeIntent}" class="install-btn-primary">🌐 افتح في Chrome</a>` : ''}
        <button class="install-btn-ghost" id="install-close">${showChromeBtn ? 'مش عايز، شكرًا' : '✅ تمام، فهمت'}</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const sheet = document.getElementById('install-sheet');
  const backdrop = document.getElementById('install-backdrop');
  const closeBtn = document.getElementById('install-close');

  requestAnimationFrame(() => {
    sheet.classList.add('show');
    backdrop.classList.add('show');
  });

  const close = () => {
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    setTimeout(() => { sheet.remove(); backdrop.remove(); }, 300);
  };

  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
}

// ============================================================
// Views
// ============================================================
function showLoginGate() {
  document.getElementById('login-gate').hidden = false;
  document.getElementById('invite-gate').hidden = true;
  document.getElementById('dashboard').hidden = true;
  document.getElementById('logout-btn').hidden = true;
  document.getElementById('install-btn').hidden = true;
  document.getElementById('settings-btn').hidden = true;
}

function showInviteGate(code) {
  document.getElementById('login-gate').hidden = true;
  document.getElementById('invite-gate').hidden = false;
  document.getElementById('dashboard').hidden = true;
  document.getElementById('logout-btn').hidden = true;

  api(`/api/client-portal/invite/${code}`)
    .then(data => {
      document.getElementById('invite-info').innerHTML = `
        <div>👤 <strong>${esc(data.client_name)}</strong></div>
        ${data.client_phone ? `<div>📱 ${esc(data.client_phone)}</div>` : ''}
        <div>🏛️ ${esc(data.office_name || 'المكتب')}</div>
      `;
      document.getElementById('invite-gate').dataset.code = code;

      const passInput = document.getElementById('iv-pass');
      const pass2Input = document.getElementById('iv-pass2');
      const acceptBtn = document.getElementById('accept-btn');

      if (passInput) passInput.hidden = true;
      if (pass2Input) pass2Input.hidden = true;
      if (acceptBtn) acceptBtn.textContent = '🚀 دخول';
    })
    .catch(err => {
      const msg = err.message || '';
      if (msg.includes('اتستخدمت') || msg.includes('منتهي') || msg.includes('انتهت') || msg.includes('غلط')) {
        window.history.replaceState({}, '', window.location.pathname);
        toast('الكود مش صالح — لكن حسابك شغال، سجّل دخول', 'warning');
        setTimeout(() => {
          showLoginGate();
          const lgStatus = document.getElementById('lg-status');
          if (lgStatus) {
            lgStatus.textContent = '💡 الكود انتهى، لكن حسابك شغال — سجّل دخول بالهاتف والباسورد';
            lgStatus.className = 'status';
          }
        }, 800);
        return;
      }
      document.getElementById('invite-message').textContent = '⚠️ ' + msg;
      document.getElementById('accept-btn').disabled = true;
    });
}

async function showDashboard() {
  document.getElementById('login-gate').hidden = true;
  document.getElementById('invite-gate').hidden = true;
  document.getElementById('dashboard').hidden = false;
  document.getElementById('logout-btn').hidden = false;
  document.getElementById('settings-btn').hidden = false;

  try {
    const me = await api('/api/client-portal/me');
    currentClient = me.client;
    currentOffice = me.office;

    document.getElementById('office-name').textContent = currentOffice.name_ar || currentOffice.name || 'مُوكِّل';
    if (currentOffice.logo) {
      const logoEl = document.getElementById('office-logo');
      logoEl.src = currentOffice.logo;
      logoEl.hidden = false;
    }
    document.title = `بوابة الموكل — ${currentOffice.name_ar || currentOffice.name || ''}`;

    document.getElementById('welcome-name').textContent = currentClient.name || '';
    document.getElementById('welcome-sub').textContent = currentOffice.name_ar || currentOffice.name || '';

    setActiveTab('cases');
    await loadView('cases');
    setupInstallButton();
  } catch (err) {
    toast(err.message, 'bad');
    showLoginGate();
  }
}

async function tryShowDashboard() {
  const savedCode = localStorage.getItem('mowakkil_client_invite_code');

  if (savedCode) {
    try {
      await quickLoginDirect(savedCode);
      return;
    } catch {
      localStorage.removeItem('mowakkil_client_invite_code');
    }
  }

  const token = localStorage.getItem('mowakkil_client_token');
  if (token) {
    try {
      const res = await fetch(API_BASE + '/api/client-portal/me', {
        headers: { authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        await showDashboard();
        return;
      }
      localStorage.removeItem('mowakkil_client_token');
      localStorage.removeItem('mowakkil_client_name');
    } catch {}
  }

  showLoginGate();
}

function setActiveTab(view) {
  currentView = view;
  document.querySelectorAll('#tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
}

async function loadView(view) {
  const host = document.getElementById('view-host');
  host.innerHTML = '<div class="card">' + skeleton(4) + '</div>';
  try {
    switch (view) {
      case 'cases':    return await renderCases(host);
      case 'agenda':   return await renderAgenda(host);
      case 'fees':     return await renderFees(host);
      case 'invoices': return await renderInvoices(host);
    }
  } catch (err) {
    host.innerHTML = `<div class="card">${empty('خطأ: ' + err.message)}</div>`;
  }
}

async function renderCases(host) {
  const cases = await api('/api/client-portal/cases');
  await renderStats();
  if (!cases.length) {
    host.innerHTML = `<div class="card">${empty('مفيش قضايا مسجّلة حالياً')}</div>`;
    return;
  }
  host.innerHTML = cases.map(c => `
    <div class="item">
      <div class="top">
        <span class="name">${esc(c.case_number || 'قضية #' + c.id)}</span>
        <span class="badge ${c.status === 'مؤرشفة' ? 'suspended' : 'active'}">${esc(c.status)}</span>
      </div>
      <div class="meta">
        🏛️ ${esc(c.court || '—')}
        ${c.degree ? ' · ' + esc(c.degree) : ''}
        ${c.case_type ? ' · ' + esc(c.case_type) : ''}
      </div>
      ${c.next_session ? `
        <div class="next-session">
          📅 <strong>الجلسة القادمة:</strong> ${esc(c.next_session.session_date)}
          ${c.next_session.notes ? '<br>📝 ' + esc(c.next_session.notes) : ''}
        </div>
      ` : `<div class="meta" style="margin-top:8px;font-size:12px">⏳ مفيش جلسات قادمة</div>`}
    </div>
  `).join('');
}

async function renderAgenda(host) {
  const sessions = await api('/api/client-portal/agenda');
  if (!sessions.length) {
    host.innerHTML = `<div class="card">${empty('مفيش جلسات قادمة حالياً')}</div>`;
    return;
  }
  host.innerHTML = `
    <div class="card">
      <h3>📅 الجلسات القادمة (${sessions.length})</h3>
      ${sessions.map(s => `
        <div class="item">
          <div class="top">
            <span class="name">${esc(s.case_number || 'قضية')}</span>
            <span class="num mono">${esc(s.session_date)}</span>
          </div>
          <div class="meta">🏛️ ${esc(s.court || '—')}</div>
          ${s.notes ? `<div class="meta">📝 ${esc(s.notes)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function renderFees(host) {
  const data = await api('/api/client-portal/fees');
  host.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">${fmtMoney(data.total_due)}</div><div class="l">إجمالي الأتعاب</div></div>
      <div class="stat"><div class="n" style="color:var(--success)">${fmtMoney(data.total_paid)}</div><div class="l">المدفوع</div></div>
      <div class="stat"><div class="n" style="color:var(--danger)">${fmtMoney(data.total_remaining)}</div><div class="l">المتبقي</div></div>
    </div>
    <div class="card">
      <h3>💰 تفاصيل الأتعاب (${data.fees.length})</h3>
      ${data.fees.length ? data.fees.map(f => `
        <div class="item">
          <div class="top">
            <span class="name">${fmtMoney(f.amount_due)}</span>
            <span class="badge ${f.status === 'مدفوع بالكامل' ? 'active' : 'trial'}">${esc(f.status)}</span>
          </div>
          <div class="meta">
            ${f.case_number ? '📁 ' + esc(f.case_number) + ' · ' : ''}
            مدفوع: ${fmtMoney(f.amount_paid)} · ${esc(f.due_date || '')}
          </div>
          ${f.notes ? `<div class="meta">📝 ${esc(f.notes)}</div>` : ''}
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, ((f.amount_paid / (f.amount_due || 1)) * 100))}%"></div>
          </div>
        </div>
      `).join('') : empty('مفيش أتعاب مسجّلة')}
    </div>
    <div class="card" id="portal-statement"><h3>📄 كشف حسابي</h3><div class="meta">جاري التحميل…</div></div>
  `;
  // كشف الحساب: الأتعاب + المصاريف اللي على حسابي + دفعاتي
  try {
    const s = await api('/api/client-portal/statement');
    const SYM = { EGP: 'ج', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع' }[s.currency] || 'ج';
    const el = host.querySelector('#portal-statement');
    if (!el) return;
    el.innerHTML = `<h3>📄 كشف حسابي</h3>
      <div class="meta" style="margin-bottom:8px">عليك ${fmtMoney(s.totals.charged)} ${SYM} · دفعت ${fmtMoney(s.totals.paid)} ${SYM} · <strong>${s.totals.balance > 0 ? 'الباقي ' + fmtMoney(s.totals.balance) + ' ' + SYM : 'الحساب خالص ✅'}</strong></div>
      ${s.lines.length ? `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="text-align:right;padding:6px">التاريخ</th><th style="text-align:right;padding:6px">البيان</th><th style="padding:6px">عليك</th><th style="padding:6px">دفعت</th><th style="padding:6px">الرصيد</th></tr></thead>
        <tbody>${s.lines.map(l => `<tr style="border-top:1px solid var(--border, #eaecf0)"><td style="padding:6px;white-space:nowrap">${esc(l.date)}</td><td style="padding:6px">${esc(l.description)}</td><td style="padding:6px;white-space:nowrap">${l.charge ? fmtMoney(l.charge) : ''}</td><td style="padding:6px;white-space:nowrap;color:#027a48">${l.paid ? fmtMoney(l.paid) : ''}</td><td style="padding:6px;white-space:nowrap">${fmtMoney(l.balance)}</td></tr>`).join('')}</tbody></table></div>` : empty('مفيش حركات')}`;
  } catch { host.querySelector('#portal-statement')?.remove(); }
}

async function renderInvoices(host) {
  const invoices = await api('/api/client-portal/invoices');
  if (!invoices.length) {
    host.innerHTML = `<div class="card">${empty('مفيش فواتير حالياً')}</div>`;
    return;
  }
  host.innerHTML = `
    <div class="card">
      <h3>📄 الفواتير (${invoices.length})</h3>
      ${invoices.map(inv => {
        const remaining = (inv.total || 0) - (inv.paid_amount || 0);
        return `
          <div class="item">
            <div class="top">
              <span class="name">فاتورة ${esc(inv.invoice_number)}</span>
              <span class="badge ${inv.status === 'مدفوعة' ? 'active' : inv.status === 'متأخرة' ? 'suspended' : 'trial'}">${esc(inv.status)}</span>
            </div>
            <div class="meta">
              📅 ${esc(inv.issue_date)}
              ${inv.case_number ? ' · 📁 ' + esc(inv.case_number) : ''}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;align-items:center">
              <span style="font-weight:900;font-size:16px;color:var(--primary)">${fmtMoney(inv.total)} ج</span>
              ${remaining > 0 ? `<span style="font-size:12px;color:var(--danger)">متبقي: ${fmtMoney(remaining)} ج</span>` : '<span style="font-size:12px;color:var(--success)">✅ مدفوعة</span>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderStats() {
  const statsEl = document.getElementById('stats');
  if (!statsEl) return;
  statsEl.innerHTML = '<div class="stat"><div class="n">—</div><div class="l">جاري التحميل</div></div>';
  try {
    const [cases, fees, agenda] = await Promise.all([
      api('/api/client-portal/cases'),
      api('/api/client-portal/fees'),
      api('/api/client-portal/agenda'),
    ]);
    statsEl.innerHTML = `
      <div class="stat"><div class="n">${cases.length}</div><div class="l">📁 قضاياي</div></div>
      <div class="stat"><div class="n">${agenda.length}</div><div class="l">📅 جلسات قادمة</div></div>
      <div class="stat"><div class="n" style="color:var(--danger)">${fmtMoney(fees.total_remaining)}</div><div class="l">💰 متبقي</div></div>
    `;
  } catch { statsEl.innerHTML = ''; }
}

// ============================================================
// Actions
// ============================================================
async function doLogin() {
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
    const data = await api('/api/client-portal/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('mowakkil_client_token', data.token);
    localStorage.setItem('mowakkil_client_name', data.name);
    st.textContent = '';
    toast('أهلاً ' + (data.name || '') + ' 👋', 'ok');
    await showDashboard();
  } catch (err) {
    st.textContent = err.message;
    st.className = 'status bad';
  }
}

async function doAcceptInvite() {
  const st = document.getElementById('iv-status');
  const code = document.getElementById('invite-gate').dataset.code;
  if (!code) {
    st.textContent = 'الكود مش موجود';
    st.className = 'status bad';
    return;
  }
  st.textContent = 'جاري الدخول...';
  st.className = 'status';
  try {
    const data = await api('/api/client-portal/quick-login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    localStorage.setItem('mowakkil_client_token', data.token);
    localStorage.setItem('mowakkil_client_name', data.name || '');
    localStorage.setItem('mowakkil_client_invite_code', code);
    window.history.replaceState({}, '', window.location.pathname);
    toast('أهلاً ' + (data.name || '') + ' 👋', 'ok');
    await showDashboard();
  } catch (err) {
    st.textContent = err.message;
    st.className = 'status bad';
  }
}

// ✅ quickLoginDirect — معدل (بـ logging + معالجة أخطاء أوضح)
async function quickLoginDirect(code) {
  try {
    console.log('quickLoginDirect: trying code', code);

    const data = await api('/api/client-portal/quick-login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });

    console.log('quickLoginDirect: response', data);

    if (!data.token) {
      throw new Error('الـ API مرجعش token — جرب تاني أو كلم المكتب');
    }

    // ✅ نحفظ التوكن والاسم
    localStorage.setItem('mowakkil_client_token', data.token);
    localStorage.setItem('mowakkil_client_name', data.name || '');
    localStorage.setItem('mowakkil_client_invite_code', code);

    // ✅ نشيل الكود من الرابط عشان ميتنفذش تاني
    window.history.replaceState({}, '', window.location.pathname);

    toast('أهلاً ' + (data.name || '') + ' 👋', 'ok');

    // ✅ ننتظر شوية عشان الصفحة تحمل بالكامل
    await new Promise(r => setTimeout(r, 100));

    // ✅ نعرض الداشبورد
    await showDashboard();
  } catch (err) {
    console.error('quickLoginDirect failed:', err);
    localStorage.removeItem('mowakkil_client_invite_code');
    toast('رابط الدخول مش صالح: ' + err.message, 'bad');
    showLoginGate();
  }
}

function logout() {
  localStorage.removeItem('mowakkil_client_token');
  localStorage.removeItem('mowakkil_client_name');
  localStorage.removeItem('mowakkil_client_invite_code');
  currentClient = null;
  currentOffice = null;
  showLoginGate();
}

// ============================================================
// Settings Modal
// ============================================================
function showSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal-backdrop show';
  modal.innerHTML = `
    <div class="settings-modal">
      <div class="settings-modal-header">
        <h3>⚙️ إعدادات الحساب</h3>
        <button class="settings-close" id="settings-close">✕</button>
      </div>

      <div class="settings-body">
        <div class="settings-info">
          <div class="settings-info-row">
            <span>الاسم</span>
            <strong>${esc(currentClient?.name || '—')}</strong>
          </div>
          <div class="settings-info-row">
            <span>الهاتف</span>
            <strong style="font-family:var(--font-mono)">${esc(currentClient?.phone || '—')}</strong>
          </div>
          <div class="settings-info-row">
            <span>المكتب</span>
            <strong>${esc(currentOffice?.name_ar || currentOffice?.name || '—')}</strong>
          </div>
        </div>

        <div class="settings-section">
          <h4>🔐 كلمة المرور</h4>
          <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px;line-height:1.6">
            ${currentClient?.has_password ? 'عندك باسورد مفعّل — تقدر تغيره في أي وقت.' : 'مفيش باسورد حاليًا — إنت داخل بالرابط بس.'}
          </p>
          <button class="install-btn-primary" id="setup-pass-btn" style="border:none;width:100%">
            ${currentClient?.has_password ? '🔑 تغيير الباسورد' : '🔐 إعداد باسورد'}
          </button>
        </div>

        <div class="settings-section">
          <h4>📱 التطبيق</h4>
          <button class="install-btn-ghost" id="settings-install-btn" style="width:100%">
            📲 تثبيت التطبيق
          </button>
        </div>

        <div class="settings-section">
          <button class="install-btn-ghost" id="settings-logout-btn" style="width:100%;color:var(--bad);border-color:var(--bad)">
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#settings-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#settings-install-btn').addEventListener('click', () => { modal.remove(); installApp(); });
  modal.querySelector('#settings-logout-btn').addEventListener('click', () => { modal.remove(); logout(); });

  modal.querySelector('#setup-pass-btn').addEventListener('click', () => {
    modal.remove();
    showPasswordModal();
  });
}

// ============================================================
// Password Modal
// ============================================================
function showPasswordModal() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal-backdrop show';
  modal.innerHTML = `
    <div class="settings-modal" style="max-width:420px">
      <div class="settings-modal-header">
        <h3>🔐 ${currentClient?.has_password ? 'تغيير الباسورد' : 'إعداد باسورد'}</h3>
        <button class="settings-close" id="pass-close">✕</button>
      </div>

      <div class="settings-body">
        <label style="display:block;text-align:right;font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;font-weight:600">
          كلمة المرور (8 حروف على الأقل)
        </label>
        <input id="new-pass" type="password" placeholder="••••••••"
          style="width:100%;padding:14px;border:1px solid var(--line);border-radius:8px;font-family:'Tajawal',sans-serif;font-size:15px;background:var(--paper);text-align:right">

        <label style="display:block;text-align:right;font-size:12.5px;color:var(--ink-soft);margin:14px 0 6px;font-weight:600">
          تأكيد كلمة المرور
        </label>
        <input id="new-pass2" type="password" placeholder="••••••••"
          style="width:100%;padding:14px;border:1px solid var(--line);border-radius:8px;font-family:'Tajawal',sans-serif;font-size:15px;background:var(--paper);text-align:right">

        <div id="pass-status" class="status" style="margin-top:12px"></div>

        <button class="install-btn-primary" id="save-pass-btn" style="border:none;width:100%;margin-top:16px">
          💾 حفظ
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#pass-close').addEventListener('click', () => modal.remove());

  modal.querySelector('#save-pass-btn').addEventListener('click', async () => {
    const pass = modal.querySelector('#new-pass').value;
    const pass2 = modal.querySelector('#new-pass2').value;
    const st = modal.querySelector('#pass-status');

    if (pass.length < 8) {
      st.textContent = '⚠️ كلمة المرور لازم 8 حروف على الأقل';
      st.className = 'status bad';
      return;
    }
    if (pass !== pass2) {
      st.textContent = '⚠️ كلمتا المرور مش متطابقتين';
      st.className = 'status bad';
      return;
    }

    st.textContent = '⏳ جاري الحفظ...';
    st.className = 'status';

    try {
      await api('/api/client-portal/set-password', {
        method: 'POST',
        body: JSON.stringify({ password: pass }),
      });
      currentClient.has_password = true;
      toast('✅ تم حفظ الباسورد', 'ok');
      modal.remove();
    } catch (err) {
      st.textContent = '⚠️ ' + err.message;
      st.className = 'status bad';
    }
  });
}

// ============================================================
// Init
// ============================================================
function bindEvents() {
  document.getElementById('login-btn')?.addEventListener('click', doLogin);
  document.getElementById('lg-pass')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('accept-btn')?.addEventListener('click', doAcceptInvite);
  document.getElementById('iv-pass2')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') doAcceptInvite();
  });
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('settings-btn')?.addEventListener('click', showSettingsModal);
  document.querySelectorAll('#tabs button').forEach(b => {
    b.addEventListener('click', () => {
      setActiveTab(b.dataset.view);
      loadView(b.dataset.view);
    });
  });
}

export const initPortal = {
  showLoginGate,
  showInviteGate,
  showDashboard,
  tryShowDashboard,
  bindEvents,
  quickLoginDirect,
};