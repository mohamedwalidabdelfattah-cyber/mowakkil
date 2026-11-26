// web/js/main.js
import { getToken, getRoleFromToken, clearSession, fetchSubscription } from './api.js';
import { registerView, showView, prefetchViews } from './router.js';
import { toast, showTrialBanner, setOfficeMoneyPrefs } from './ui.js';
import { initDrawer } from './drawer.js';
import { startNotifications, openNotifications } from './notifications.js';
import { openSearch, initSearch } from './search.js';
import { startIconify, icon } from './icons.js';
import { applyChartTheme } from './chart-theme.js';
import { loadAccess, canView, guardActions, clearAccess } from './access.js';
import { startOffline } from './offline.js';
import { apiJson } from './api.js';
import { startMSA } from './msa.js';
import { startDateDom } from './date-dom.js';
import { getCurrentView } from './router.js';
import { initHelp } from './help.js';

applyChartTheme();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startIconify);
else startIconify();

// الشاشات اللي بنحتاجها من أول لحظة (الدخول + السوبر أدمن + بيانات المكتب)
import * as loginView        from './views/login.js';
import * as accountView      from './views/account.js';
import * as superadminView   from './views/superadmin.js';

registerView('account',    accountView);
registerView('superadmin', superadminView);

// باقي الشاشات بتتحمل أول ما تتفتح بس (أسرع بكتير في أول تحميل)
registerView('dashboard',    () => import('./views/dashboard.js'));
registerView('agenda',       () => import('./views/agenda.js'));
registerView('cases',        () => import('./views/cases.js'));
registerView('clients',      () => import('./views/clients.js'));
registerView('lawyers',      () => import('./views/lawyers.js'));
registerView('fees',         () => import('./views/fees.js'));
registerView('tasks',        () => import('./views/tasks.js'));
registerView('reports',      () => import('./views/reports.js'));
registerView('calc',         () => import('./views/calc.js'));
registerView('search',       () => import('./views/search.js'));
registerView('money',        () => import('./views/money.js'));
registerView('accounting',   () => import('./views/accounting.js'));
registerView('subscription', () => import('./views/subscription.js'));
registerView('settings',     () => import('./views/settings.js'));
registerView('team',         () => import('./views/team.js'));

// ✅ "المزيد" كـ view مخصّص
const moreView = {
  render(host) {
    const role = getRoleFromToken();
    const isAdmin = role === 'admin';

    const items = [
      { id: 'dashboard',    icon: '🏠', label: 'لوحة التحكم' },
      { id: 'cases',        icon: '⚖️', label: 'القضايا' },
      { id: 'clients',      icon: '👥', label: 'الموكلون' },
      { id: 'agenda',       icon: '📅', label: 'الأجندة' },
      { id: 'fees',         icon: '💰', label: 'التحصيل' },
      { id: 'tasks',        icon: '✅', label: 'المهام' },
      { id: 'lawyers',      icon: '👨‍⚖️', label: 'المحامون' },
      { id: 'money',        icon: '💼', label: 'الإدارة المالية' },
      { id: 'reports',      icon: '📊', label: 'التقارير' },
      { id: 'team',         icon: '👥', label: 'الفريق والصلاحيات' },
      { id: 'calc',         icon: '🧮', label: 'حاسبة الرسوم' },
      { id: 'search',       icon: '🔍', label: 'البحث القانوني' },
      { id: 'settings',     icon: '⚙️', label: 'الإعدادات' },
      { id: 'subscription', icon: '💎', label: 'اشتراكي' },
      { id: 'account',      icon: '👤', label: 'حسابي' },
    ].filter(it => (!it.adminOnly || isAdmin) && canView(it.id));

    host.innerHTML = `
      <div class="app-top">
        <h2>المزيد</h2>
      </div>
      <div class="more-grid">
        ${items.map(it => `
          <button class="more-item" data-more-view="${it.id}">
            <span class="more-icon">${it.icon}</span>
            <span class="more-label">${it.label}</span>
          </button>
        `).join('')}
      </div>
    `;

    host.querySelectorAll('.more-item').forEach(btn => {
      btn.addEventListener('click', () => {
        showView(btn.dataset.moreView);
      });
    });
  }
};

registerView('more', moreView);

// ============================================================
// View Switcher
// ============================================================
// بعد ما الـ JS يشتغل، الـ hidden هو المتحكم الوحيد (data-boot كان للحظة الأولى بس)
function clearBoot() { document.documentElement.removeAttribute('data-boot'); window.scrollTo(0, 0); }

function showLanding() {
  clearBoot();
  if (location.hash === '#login') history.replaceState(null, '', location.pathname);
  document.getElementById('landing-view').hidden = false;
  document.getElementById('login-gate-view').hidden = true;
  document.getElementById('app-body').hidden = true;
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.hidden = true;
}

function showLoginGate() {
  clearBoot();
  document.getElementById('landing-view').hidden = true;
  document.getElementById('login-gate-view').hidden = false;
  document.getElementById('app-body').hidden = true;
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.hidden = true;
}

function showApp() {
  document.documentElement.removeAttribute('data-boot');
  document.getElementById('landing-view').hidden = true;
  document.getElementById('login-gate-view').hidden = true;
  document.getElementById('app-body').hidden = false;
  const nav = document.getElementById('bottom-nav');
  if (nav && getToken()) nav.hidden = false;
}

window.showLanding = showLanding;
window.showLoginGate = showLoginGate;
window.showApp = showApp;

// ============================================================
// Bottom Navigation (Mobile)
// ============================================================
function initBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  if (!getToken()) return;

  nav.hidden = false;

  nav.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;

      if (target === 'menu') {
        showView('more');
        return;
      }

      showView(target);
    });
  });

  document.addEventListener('mowakkil:view-changed', (e) => {
    const viewName = e.detail?.name;
    if (!viewName) return;

    nav.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

    if (viewName === 'more') {
      nav.querySelector('[data-nav="menu"]')?.classList.add('active');
      return;
    }

    const btn = nav.querySelector(`[data-nav="${viewName}"]`);
    if (btn) btn.classList.add('active');
  });
}

// التصدير والطباعة بقوا في أماكنهم المخصصة بس (web/js/exporter.js) — مفيش أزرار بتتحقن في كل الصفحات

// ============================================================
// Events
// ============================================================
document.addEventListener('mowakkil:auth-expired', () => {
  toast('انتهت الجلسة. سجّل دخول من جديد', 'bad');
  showLoginGate();
});

document.addEventListener('mowakkil:goto-subscription', () => {
  // ✅ إخفاء الـ trial-blocker قبل ما نظهر الاشتراك
  document.getElementById('trial-blocker')?.classList.remove('show');
  showApp();
  showView('subscription');
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const actions = {
    'toggle-sa':        () => superadminView.toggleGate(),
    'sa-login':         () => superadminView.doLogin(),
    'sa-logout':        () => superadminView.doLogout(),
    'login':            () => loginView.doLogin(),
    'logout':           () => loginView.doLogout(),
    'goto-subscription':() => {
      document.getElementById('trial-blocker')?.classList.remove('show');
      showApp();
      showView('subscription');
    },
    'show-login':       () => showLoginGate(),
    'show-landing':     () => showLanding(),
  };
  actions[action]?.();
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  clearAccess();
  clearSession();
  location.reload();
});

// ✅ زرار الإعدادات في الـ topbar
document.getElementById('cfg-btn')?.addEventListener('click', () => {
  showView('settings');
});

// ✅ زرار البحث في الـ topbar
document.getElementById('search-btn')?.addEventListener('click', () => {
  openSearch();
});

// ============================================================
// Init
// ============================================================
initDrawer();
initSearch();
initHelp();
loginView.bindForm();

async function initSubscription() {
  const sub = await fetchSubscription(true);
  // القايمة الجانبية تتظبط على ميزات الباقة (مثلاً المحاسبة الكاملة)
  document.dispatchEvent(new CustomEvent('mowakkil:access-changed'));
  if (sub) {
    if (sub.status === 'trial' && sub.days_remaining <= 7) {
      showTrialBanner(sub.days_remaining, sub.plan);
    }
  }
}

if (getToken()) {
  showApp();
  accountView.loadOffice();
  guardActions(document.getElementById('view-host'));
  // الصلاحيات (بتعيد بناء القايمة لما توصل) — والتحميل للاستخدام من غير نت بيستناها،
  // عشان ميطلبش قوايم الدور ممنوع منها (أول دخول مفيش صلاحيات محفوظة)
  loadAccess().finally(() => startOffline(apiJson)); // الأجندة من غير نت + إرسال اللي اتسجل من غير نت
  document.addEventListener('mowakkil:synced', (e) => {
    const { sent, failed } = e.detail || {};
    if (sent) toast(`✅ اتبعت ${sent} عملية كانت مستنية النت`, 'ok');
    (failed || []).forEach(f => toast(`⚠️ «${f.label}» اترفضت: ${f.error}`, 'bad'));
    const v = getCurrentView();
    if (v) showView(v); // نحدّث الشاشة بالبيانات الجديدة
  });
  showView('dashboard');
  // الشاشات الأكتر استخداماً تتحمل في الخلفية عشان التنقل يبقى فوري
  // كل الشاشات بتتحمّل في الخلفية (وبتتحفظ على الجهاز) عشان أي شاشة تفتح من غير نت
  prefetchViews(['cases', 'clients', 'tasks', 'agenda', 'fees', 'search', 'money', 'accounting', 'reports',
    'lawyers', 'calc', 'settings', 'subscription', 'team']);
  // موديولات بتتحمّل جوه الشاشات وقت الحاجة — نحمّلها كمان عشان تبقى متاحة من غير نت
  setTimeout(() => {
    import('./views/invoice-detail.js').catch(() => {});
    import('./ai-privacy.js').catch(() => {});
  }, 6000);
  initSubscription();
  // الفصحى المبسطة للمكاتب السعودية (طبقة عرض — المصري زي ما هو)
  startMSA();
  // التواريخ بالهجري في كل الشاشات (حسب إعداد المكتب — السعودية هجري افتراضياً)
  startDateDom();
  apiJson('/api/settings').then(setOfficeMoneyPrefs).catch(() => {}); // عملة المكتب ونسبة الضريبة ودولته
  // لو دولة المكتب طلعت غير اللي كانت محفوظة على الجهاز: القايمة والشاشة الحالية تتبني تاني بالمسميات الصح
  document.addEventListener('mowakkil:country-changed', () => {
    startMSA(); // بتقفل نفسها لو المكتب مصري
    startDateDom();
    document.dispatchEvent(new CustomEvent('mowakkil:access-changed'));
    const v = getCurrentView();
    if (v) showView(v);
  });
  // تغيير طريقة عرض التاريخ من الإعدادات: الشاشة الحالية تتبني تاني بالتاريخ الجديد
  document.addEventListener('mowakkil:date-mode-changed', () => {
    startDateDom();
    const v = getCurrentView();
    if (v) showView(v);
  });
  startNotifications();
  initBottomNav();

  document.getElementById('notif-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotifications();
  });
} else if (location.hash === '#login' || location.pathname === '/login') {
  showLoginGate();
} else {
  showLanding();
}