// web/js/access.js
// صلاحيات المستخدم الحالي في الواجهة: بتخفي الأقسام والأزرار اللي مش مسموحة.
// ⚠️ ده للراحة بس — الحماية الحقيقية في السيرفر (worker/lib/permissions.js) على كل طلب.
import { apiJson, getToken } from './api.js';
import { countryInfo } from './country.js';

const KEY = 'mowakkil_access';
let state = null;
try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}

// كل شاشة محتاجة صلاحية إيه عشان تظهر في القايمة وتتفتح
export const VIEW_PERMS = {
  cases: 'cases.view', clients: 'clients.view', agenda: 'agenda.view', tasks: 'tasks.view',
  fees: 'fees.view', money: 'expenses.view', accounting: 'accounting.view', reports: 'reports.view',
  lawyers: 'lawyers.view', search: 'ai.use', team: 'team.manage', subscription: 'subscription.manage',
};

// أزرار جوه الشاشات → الصلاحية المطلوبة (بتستخبى لو مش مسموحة)
const ACTION_GUARDS = [
  ['[data-del-client]', 'clients.delete'],
  ['[data-invite-client],[data-resend-invite],[data-cancel-invite],[data-toggle-active],[data-delete-account]', 'portal.manage'],
  ['[data-toggle-panel="client-panel"]', 'clients.create'],
  ['[data-del-task]', 'tasks.delete'],
  ['[data-edit-task]', 'tasks.edit'],
  ['[data-del-fee],[data-del-payment]', 'fees.delete'],
  ['[data-add-payment]', 'fees.create'],
  ['[data-del-invoice]', 'invoices.delete'],
  ['[data-del-expense],[data-del-task-expense]', 'expenses.delete'],
  ['[data-del-lawyer]', 'lawyers.manage'],
  ['[data-case-analyze],[data-ai]', 'ai.use'],
  ['.export-menu,[data-export]', 'export.use'],
];

export function getAccessState() { return state; }

/** قبل ما الصلاحيات تتحمّل بنسمح (السيرفر هيرفض لو مش مسموح) */
export function can(perm) {
  if (!perm) return true;
  if (!state?.permissions) return true;
  return state.permissions.includes(perm);
}

export function canView(view) {
  const base = String(view || '').split('-')[0];
  // حاسبة الرسوم القضائية مبنية على القانون المصري — مش بتظهر للمكاتب السعودية
  if (base === 'calc' && !countryInfo().feeCalculator) return false;
  return can(VIEW_PERMS[view] || VIEW_PERMS[base]);
}

export async function loadAccess() {
  if (!getToken()) return null;
  try {
    const me = await apiJson('/api/team/me', { skipCache: true });
    state = me;
    try { localStorage.setItem(KEY, JSON.stringify(me)); } catch {}
    document.dispatchEvent(new CustomEvent('mowakkil:access-changed', { detail: me }));
  } catch (e) {
    console.warn('access load failed:', e.message);
  }
  return state;
}

export function clearAccess() {
  state = null;
  try { localStorage.removeItem(KEY); } catch {}
}

/** يخفي الأزرار اللي مش مسموحة جوه عنصر (وبيتابع أي محتوى جديد) */
export function guardActions(root) {
  if (!root) return;
  const apply = () => {
    for (const [sel, perm] of ACTION_GUARDS) {
      const allowed = can(perm);
      root.querySelectorAll(sel).forEach(el => el.classList.toggle('perm-hidden', !allowed));
    }
  };
  apply();
  new MutationObserver(apply).observe(root, { childList: true, subtree: true });
  document.addEventListener('mowakkil:access-changed', apply);
}
