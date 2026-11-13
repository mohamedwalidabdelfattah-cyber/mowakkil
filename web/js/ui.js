// web/js/ui.js
import { clearSession } from './api.js';
import { clearState } from './state.js';

// ============ Toast ============
export function toast(msg, type = '') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============ Escape ============
export function esc(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// ============ WhatsApp ============
export function waLink(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  const prefixed = digits.startsWith('20') ? digits : '2' + digits;
  return `https://wa.me/${prefixed}`;
}

// ============ Loading Helpers (Skeletons) ============
/**
 * @param {number} lines - عدد الصفوف
 * @param {string} type - نوع الـ skeleton: 'text' | 'card' | 'chart' | 'list'
 */
export function skeleton(lines = 3, type = 'text') {
  if (type === 'card') {
    return Array.from({ length: lines }).map(() => `
      <div class="sk-card">
        <div class="sk-circle"></div>
        <div class="sk-lines">
          <div class="sk-line sk-line-lg"></div>
          <div class="sk-line sk-line-sm"></div>
        </div>
      </div>
    `).join('');
  }

  if (type === 'chart') {
    return `
      <div class="sk-chart">
        <div class="sk-chart-bars">
          <div class="sk-bar" style="height: 40%"></div>
          <div class="sk-bar" style="height: 70%"></div>
          <div class="sk-bar" style="height: 55%"></div>
          <div class="sk-bar" style="height: 90%"></div>
          <div class="sk-bar" style="height: 30%"></div>
        </div>
      </div>
    `;
  }

  if (type === 'list') {
    return Array.from({ length: lines }).map(() => `
      <div class="sk-list-item">
        <div class="sk-line sk-line-lg"></div>
        <div class="sk-line sk-line-sm"></div>
      </div>
    `).join('');
  }

  // Default: text
  return Array.from({ length: lines }).map((_, i) => `
    <div class="sk-line ${i % 3 === 0 ? 'sk-line-sm' : 'sk-line-lg'}"></div>
  `).join('');
}

// ============ Empty States ============
/**
 * @param {string} msg - الرسالة
 * @param {string} icon - الأيقونة (إيموجي)
 * @param {object} action - { text, onClick } لو عايزين زرار
 */
export function empty(msg, icon = '📭', action = null) {
  const actionHtml = action
    ? `<button class="btn btn-primary empty-action" data-empty-action>${esc(action.text)}</button>`
    : '';

  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-message">${esc(msg)}</div>
      ${actionHtml}
    </div>
  `;
}

// عشان نربط حدث الزرار ده تلقائياً
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-empty-action]');
  if (!btn) return;
  const handler = btn.__emptyHandler;
  if (handler) handler();
});

// ============ Auth lifecycle ============
export function onAuthExpired() {
  clearSession();
  clearState();
  document.dispatchEvent(new CustomEvent('mowakkil:auth-expired'));
}

export function onTrialExpired() {
  document.getElementById('trial-blocker')?.classList.add('show');
}

// ============ Formatters ============
export function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}
export function fmtDate(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('ar-EG'); } catch { return s; }
}

// ============================================================
// 🆕 Upgrade Modal
// ============================================================
const FEATURE_LABELS = {
  finance: 'الإدارة المالية',
  invoices: 'الفواتير',
  ai: 'الذكاء الاصطناعي',
  advanced_reports: 'التقارير المتقدمة',
  whatsapp: 'تكامل واتساب',
  multi_office: 'مكاتب متعددة',
  api: 'API Access',
};

const PLAN_LABELS = {
  free: 'المجانية',
  starter: 'الأساسية',
  pro: 'الاحترافية',
  plus: 'المتقدمة',
};

const PLAN_PRICES = {
  free: 0,
  starter: 199,
  pro: 399,
  plus: 799,
};

export function showUpgradeModal(feature, requiredPlan = 'starter') {
  const featureName = FEATURE_LABELS[feature] || feature;
  const planName = PLAN_LABELS[requiredPlan] || requiredPlan;
  const price = PLAN_PRICES[requiredPlan] || 0;

  document.getElementById('upgrade-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'upgrade-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card upgrade-modal-card" role="dialog" aria-modal="true">
      <div class="upgrade-icon">🔒</div>
      <h3 class="upgrade-title">الميزة دي محتاجة ترقية</h3>
      <p class="upgrade-sub">
        <strong>${esc(featureName)}</strong> متاحة في الباقة <strong>${esc(planName)}</strong>
      </p>

      <div class="upgrade-price">
        <span class="upgrade-price-num">${price}</span>
        <span class="upgrade-price-cur">ج / شهر</span>
      </div>

      <ul class="upgrade-features">
        <li>✅ كل ميزات الباقة المجانية</li>
        <li>✅ ${esc(featureName)}</li>
        <li>✅ دعم فني أسرع</li>
      </ul>

      <div class="upgrade-actions">
        <button class="btn btn-primary btn-block" data-action="go-upgrade">🚀 ترقية الآن</button>
        <button class="btn btn-ghost btn-block" data-action="close-upgrade">لاحقًا</button>
      </div>

      <p class="upgrade-foot">
        للاستفسار: <a href="https://wa.me/201013917789" target="_blank">تواصل واتساب</a>
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-upgrade' || e.target === modal) {
      closeUpgradeModal();
    } else if (action === 'go-upgrade') {
      closeUpgradeModal();
      document.dispatchEvent(new CustomEvent('mowakkil:goto-subscription'));
    }
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeUpgradeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeUpgradeModal() {
  const modal = document.getElementById('upgrade-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  }
}

// ============================================================
// 🆕 Limit Reached Modal
// ============================================================
const LIMIT_LABELS = {
  max_users: 'المستخدمين',
  max_cases: 'القضايا',
  max_clients: 'الموكلين',
  max_storage_mb: 'التخزين',
};

export function showLimitModal({ limit_type, current, max, plan, upgrade_url }) {
  const label = LIMIT_LABELS[limit_type] || limit_type;

  document.getElementById('limit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'limit-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card upgrade-modal-card" role="dialog" aria-modal="true">
      <div class="upgrade-icon">⛔</div>
      <h3 class="upgrade-title">وصلت للحد الأقصى</h3>
      <p class="upgrade-sub">
        استخدمت <strong>${current}</strong> من <strong>${max}</strong> في <strong>${esc(label)}</strong>
        <br>
        عشان تضيف المزيد، رقّي باقتك
      </p>

      <div class="upgrade-actions">
        <a href="${upgrade_url || '/pricing'}"
           class="btn btn-primary btn-block"
           style="text-decoration:none;text-align:center">
          💎 عرض الباقات
        </a>
        <button class="btn btn-ghost btn-block" data-action="close-limit">إلغاء</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-limit' || e.target === modal) {
      closeLimitModal();
    }
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeLimitModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeLimitModal() {
  const modal = document.getElementById('limit-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  }
}

// ============================================================
// 🆕 Trial Banner
// ============================================================
export function showTrialBanner(daysLeft, plan = 'free') {
  const existing = document.getElementById('trial-banner');
  if (existing) existing.remove();

  if (plan !== 'free' && plan !== 'trial') return;
  if (daysLeft > 7 && plan !== 'trial') return;

  const banner = document.createElement('div');
  banner.id = 'trial-banner';
  banner.className = 'trial-banner';
  banner.innerHTML = `
    <span class="trial-banner-text">
      ⏳ باقي ${daysLeft} يوم على انتهاء التجربة — ترقّي للباقة المدفوعة
    </span>
    <button class="btn btn-sm btn-primary" data-action="goto-subscription">ترقية</button>
    <button class="trial-banner-close" data-action="close-banner">×</button>
  `;

  const app = document.getElementById('app');
  if (app) app.prepend(banner);

  banner.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close-banner') {
      banner.remove();
    } else if (action === 'goto-subscription') {
      document.dispatchEvent(new CustomEvent('mowakkil:goto-subscription'));
    }
  });
} 
