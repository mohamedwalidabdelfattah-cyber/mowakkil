// web/js/router.js
import { getRole } from './api.js';
import { canView } from './access.js';

const views = new Map();
let currentView = null;

// module: كائن فيه render، أو دالة بترجع import() (تحميل عند الحاجة)
export function registerView(name, module) {
  views.set(name, module);
}

async function resolveView(name) {
  let m = views.get(name);
  if (typeof m === 'function') {
    m = await m();
    views.set(name, m);
  }
  return m;
}

// تحميل مسبق في الخلفية لشاشات معينة (بعد الدخول، في وقت فراغ المتصفح)
export function prefetchViews(names) {
  const run = () => names.forEach(n => { if (typeof views.get(n) === 'function') resolveView(n).catch(() => {}); });
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

export function getCurrentView() { return currentView; }

export async function showView(name) {
  let realName = name;
  const aliases = {
    'cases-open':           'cases',
    'cases-arch':           'cases',
    'clients-debts':        'clients',
    'fees-pending':         'fees',
    'fees-late':            'fees',
    'money':                'money',
    'money-expenses':       'money',
    'money-income':         'money',
    'money-reports':        'money',
    'money-invoices':       'money',
    'accounting-journal':   'accounting',
    'accounting-accounts':  'accounting',
    'accounting-pl':        'accounting',
    'accounting-bs':        'accounting',
    'accounting-cf':        'accounting',
    'accounting-expenses':  'accounting',
    'subscription':         'subscription',
    'my-subscription':      'subscription',
  };
  realName = aliases[name] || name.replace(/-open$|-arch$|-debts$|-pending$|-late$/, '');

  if (!views.has(realName)) {
    const host = document.getElementById('view-host');
    host.innerHTML = `<div class="card"><div class="empty">القسم ده لسه ما اتعملش (${name})</div></div>`;
    return;
  }

  const host = document.getElementById('view-host');
  // الصلاحيات: الشاشة دي مش متاحة للدور ده
  if (!canView(realName)) {
    host.innerHTML = `<div class="card"><div class="empty">🔒 القسم ده مش متاح لدورك في المكتب — لو محتاجه كلّم مالك المكتب.</div></div>`;
    return;
  }
  host.innerHTML = '<div class="card">' + skeleton(4) + '</div>';

  let module;
  try {
    module = await resolveView(realName);
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="empty">تعذر تحميل الصفحة — تأكد من الاتصال وجرّب تاني</div></div>`;
    return;
  }
  if (module.adminOnly && getRole() !== 'admin') return;

  currentView = name;

  document.dispatchEvent(new CustomEvent('mowakkil:view-changed', {
    detail: { name: realName, subView: name },
  }));

  try {
    await module.render(host, { subView: name });
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="empty">خطأ: ${e.message}</div></div>`;
  }
}

function skeleton(n) {
  return Array.from({ length: n }).map(() => '<div class="skeleton"></div>').join('');
}