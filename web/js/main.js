// web/js/main.js
import { getToken, getRoleFromToken, clearSession, fetchSubscription } from './api.js';
import { registerView, showView } from './router.js';
import { toast, showTrialBanner } from './ui.js';
import { initDrawer } from './drawer.js';
import { startNotifications, openNotifications } from './notifications.js';
import { openSearch, initSearch } from './search.js';

import * as loginView        from './views/login.js';
import * as dashboardView    from './views/dashboard.js';
import * as agendaView       from './views/agenda.js';
import * as casesView        from './views/cases.js';
import * as clientsView      from './views/clients.js';
import * as lawyersView      from './views/lawyers.js';
import * as feesView         from './views/fees.js';
import * as tasksView        from './views/tasks.js';
import * as reportsView      from './views/reports.js';
import * as calcView         from './views/calc.js';
import * as searchView       from './views/search.js';
import * as accountView      from './views/account.js';
import * as superadminView   from './views/superadmin.js';
import * as moneyView        from './views/money.js';
import * as accountingView   from './views/accounting.js';
import * as subscriptionView from './views/subscription.js';
import * as settingsView     from './views/settings.js';

registerView('dashboard',     dashboardView);
registerView('agenda',        agendaView);
registerView('cases',         casesView);
registerView('clients',       clientsView);
registerView('lawyers',       lawyersView);
registerView('fees',          feesView);
registerView('tasks',         tasksView);
registerView('reports',       reportsView);
registerView('calc',          calcView);
registerView('search',        searchView);
registerView('account',       accountView);
registerView('superadmin',    superadminView);
registerView('money',         moneyView);
registerView('accounting',    accountingView);
registerView('subscription',  subscriptionView);
registerView('settings',      settingsView);

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
      { id: 'lawyers',      icon: '👨‍⚖️', label: 'المحامون',   adminOnly: true },
      { id: 'money',        icon: '💼', label: 'الإدارة المالية', adminOnly: true },
      { id: 'reports',      icon: '📊', label: 'التقارير',     adminOnly: true },
      { id: 'calc',         icon: '🧮', label: 'حاسبة الرسوم' },
      { id: 'search',       icon: '🔍', label: 'البحث القانوني' },
      { id: 'settings',     icon: '⚙️', label: 'الإعدادات' },
      { id: 'subscription', icon: '💎', label: 'اشتراكي' },
      { id: 'account',      icon: '👤', label: 'حسابي' },
    ].filter(it => !it.adminOnly || isAdmin);

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
function showLanding() {
  document.getElementById('landing-view').hidden = false;
  document.getElementById('login-gate-view').hidden = true;
  document.getElementById('app-body').hidden = true;
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.hidden = true;
}

function showLoginGate() {
  document.getElementById('landing-view').hidden = true;
  document.getElementById('login-gate-view').hidden = false;
  document.getElementById('app-body').hidden = true;
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.hidden = true;
}

function showApp() {
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
loginView.bindForm();

async function initSubscription() {
  const sub = await fetchSubscription(true);
  if (sub) {
    if (sub.status === 'trial' && sub.days_remaining <= 7) {
      showTrialBanner(sub.days_remaining, sub.plan);
    }
  }
}

if (getToken()) {
  showApp();
  accountView.loadOffice();
  showView('dashboard');
  initSubscription();
  startNotifications();
  initBottomNav();

  document.getElementById('notif-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotifications();
  });
} else {
  showLanding();
} 
