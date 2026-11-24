// web/js/drawer.js
// القائمة الجانبية

import { showView, getCurrentView } from './router.js';
import { getRoleFromToken, getNameFromToken, hasFeature } from './api.js';
import { canView, getAccessState } from './access.js';

const ICONS = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  cases: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
  clients: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
  calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  money: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  tasks: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  lawyers: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  chart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  calculator: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  diamond: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

const MENU = [
  { id: 'dashboard', icon: ICONS.home, label: 'لوحة التحكم' },
  {
    id: 'cases', icon: ICONS.cases, label: 'القضايا',
    sub: [
      { id: 'cases',       label: 'كل القضايا' },
      { id: 'cases-open',  label: 'مفتوحة' },
      { id: 'cases-arch',  label: 'مؤرشفة' },
    ],
  },
  { id: 'clients', icon: ICONS.clients, label: 'الموكلون' },
  { id: 'agenda',  icon: ICONS.calendar, label: 'الأجندة' },
  {
    id: 'fees', icon: ICONS.money, label: 'التحصيل',
    sub: [
      { id: 'fees',         label: 'كل الأتعاب' },
      { id: 'fees-pending', label: 'مستحق' },
      { id: 'fees-late',    label: 'متأخر' },
    ],
  },
  { id: 'tasks',   icon: ICONS.tasks, label: 'المهام' },
  { id: 'lawyers', icon: ICONS.lawyers, label: 'المحامون' },
  {
    id: 'money', icon: ICONS.wallet, label: 'الإدارة المالية',
    sub: [
      { id: 'money',              label: 'اللوحة المالية' },
      { id: 'money-expenses',     label: 'المصاريف' },
      { id: 'money-income',       label: 'الإيرادات' },
      { id: 'money-reports',      label: 'التقارير' },
      { id: 'money-invoices',     label: 'الفواتير' },
      { id: 'accounting-journal', label: 'دفتر اليومية' },
      { id: 'accounting-accounts',label: 'دليل الحسابات' },
      { id: 'accounting-pl',      label: 'قائمة الدخل' },
      { id: 'accounting-bs',      label: 'المركز المالي' },
    ],
  },
  { id: 'reports', icon: ICONS.chart, label: 'تقارير القضايا' },
  { id: 'calc',    icon: ICONS.calculator, label: 'حاسبة الرسوم' },
  { id: 'search',  icon: ICONS.search, label: 'البحث القانوني' },
  { id: 'team', icon: ICONS.clients, label: 'الفريق والصلاحيات' },
  { id: 'settings', icon: ICONS.settings, label: 'الإعدادات' },              // ✨ جديد
  { id: 'subscription', icon: ICONS.diamond, label: 'اشتراكي' },
  { id: 'account', icon: ICONS.user, label: 'حسابي' },
];

let currentActiveId = null;

export function initDrawer() {
  const menuBtn = document.getElementById('menu-btn');
  const backdrop = document.getElementById('drawer-backdrop');

  menuBtn?.addEventListener('click', openDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  renderMenu();
  updateUserInfo();
  // الصلاحيات اتحمّلت/اتغيّرت → نعيد بناء القايمة
  document.addEventListener('mowakkil:access-changed', () => {
    renderMenu();
    updateUserInfo();
    highlightMenu(currentActiveId);
  });

  document.addEventListener('mowakkil:view-changed', (e) => {
    closeDrawer();
    highlightMenu(e.detail?.name);
  });
}

function updateUserInfo() {
  const name = getNameFromToken() || '—';
  const role = getRoleFromToken();
  const userEl = document.getElementById('drawer-user-name');
  const roleEl = document.getElementById('drawer-user-role');
  const avatarEl = document.getElementById('drawer-avatar');

  if (userEl) userEl.textContent = name;
  const acc = getAccessState();
  if (roleEl) roleEl.textContent = acc?.role_label || (role === 'admin' ? 'مالك المكتب' : 'محامي');
  if (avatarEl && name !== '—') avatarEl.textContent = name.charAt(0);
}

export function openDrawer() {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) {
    drawer.classList.add('open');
    drawer.style.right = '0';
    drawer.style.display = 'flex';
    drawer.style.zIndex = '9999';
  }
  if (backdrop) {
    backdrop.classList.add('open');
    backdrop.style.zIndex = '9998';
  }
  document.body.classList.add('drawer-open');
}

export function closeDrawer() {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.style.right = '-340px';
  }
  if (backdrop) {
    backdrop.classList.remove('open');
  }
  document.body.classList.remove('drawer-open');
}

function renderMenu() {
  const nav = document.getElementById('drawer-nav');
  if (!nav) return;
  const role = getRoleFromToken();
  const isAdmin = role === 'admin';

  // كل قسم بيظهر حسب صلاحيات المستخدم (web/js/access.js)
  // دفتر اليومية ودليل الحسابات والقوائم المالية: للمحاسب أو لما "وضع المحاسب" يتفعّل من صفحة الإدارة المالية
  let accMode = false;
  try { accMode = localStorage.getItem('mowakkil_acc_mode') === '1'; } catch {}
  const showAccounting = hasFeature('accounting') && (accMode || getAccessState()?.role === 'accountant');
  nav.innerHTML = MENU
    .filter(item => (!item.adminOnly || isAdmin) && canView(item.id))
    .map(item => ({ ...item, sub: item.sub?.filter(s => canView(s.id) && (showAccounting || !s.id.startsWith('accounting-'))) }))
    .map(item => {
      const hasSub = item.sub && item.sub.length > 0;
      return `
        <div class="drawer-section">
          <button class="drawer-item" data-menu-id="${item.id}" ${hasSub ? 'data-has-sub="1"' : ''}>
            <span class="icon">${item.icon}</span>
            <span class="label">${item.label}</span>
            ${hasSub ? '<span class="arrow">‹</span>' : ''}
          </button>
          ${hasSub ? `
            <div class="drawer-sub" data-sub-for="${item.id}">
              ${item.sub.map(s => `
                <button class="drawer-sub-item" data-sub-view="${s.id}">
                  ${s.label}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

  nav.querySelectorAll('.drawer-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.menuId;
      const hasSub = btn.dataset.hasSub === '1';

      if (hasSub) {
        const sub = nav.querySelector(`[data-sub-for="${id}"]`);
        const isOpen = sub.classList.contains('open');
        nav.querySelectorAll('.drawer-sub').forEach(s => s.classList.remove('open'));
        nav.querySelectorAll('.drawer-item').forEach(b => b.classList.remove('expanded'));
        if (!isOpen) {
          sub.classList.add('open');
          btn.classList.add('expanded');
        } else {
          showView(id === 'money' ? 'money' : id);
          closeDrawer();
        }
      } else {
        showView(id);
        closeDrawer();
      }
    });
  });

  nav.querySelectorAll('.drawer-sub-item').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.subView);
      closeDrawer();
    });
  });
}

function highlightMenu(name) {
  if (!name) return;
  currentActiveId = name;
  const nav = document.getElementById('drawer-nav');
  if (!nav) return;
  nav.querySelectorAll('.drawer-item, .drawer-sub-item').forEach(b => b.classList.remove('active'));
  const btn = nav.querySelector(`.drawer-item[data-menu-id="${name}"]`);
  btn?.classList.add('active');
}