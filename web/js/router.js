// web/js/router.js
import { getRole } from './api.js';

const views = new Map();
let currentView = null;

export function registerView(name, module) {
  views.set(name, module);
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

  const module = views.get(realName);
  if (module.adminOnly && getRole() !== 'admin') return;

  const host = document.getElementById('view-host');
  host.innerHTML = '<div class="card">' + skeleton(4) + '</div>';

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