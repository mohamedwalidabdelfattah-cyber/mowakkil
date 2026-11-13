// web/js/views/subscription.js
// صفحة "اشتراكي" — عرض الباقة الحالية + إمكانية الترقية

import { fetchSubscription, fetchPlans, apiJson } from '../api.js';
import { esc, fmtMoney, fmtDate, toast, skeleton, empty } from '../ui.js';

export async function render(host) {
  host.innerHTML = '<div class="card">' + skeleton(5) + '</div>';

  try {
    const [sub, plans] = await Promise.all([
      fetchSubscription(true),
      fetchPlans(),
    ]);

    if (!sub) {
      host.innerHTML = `<div class="card">${empty('مفيش اشتراك — تواصل مع الدعم')}</div>`;
      return;
    }

    host.innerHTML = `
      <div class="app-top">
        <h2>💎 اشتراكي</h2>
      </div>

      ${renderCurrentPlan(sub)}
      ${renderPlansGrid(plans, sub.plan)}
      ${renderUsage(sub)}
    `;

    // Event delegation
    host.addEventListener('click', handleClick);

  } catch (err) {
    host.innerHTML = `<div class="card">${empty('خطأ: ' + err.message)}</div>`;
  }
}

// ============================================================
// الباقة الحالية
// ============================================================
function renderCurrentPlan(sub) {
  const planNames = {
    free: 'المجانية', starter: 'الأساسية',
    pro: 'الاحترافية', plus: 'المتقدمة',
  };
  const statusLabels = {
    trial: '🎁 تجربة مجانية',
    active: '✅ نشط',
    expired: '⛔ منتهي',
    cancelled: '❌ ملغي',
  };

  const daysLeft = sub.days_remaining ?? '—';
  const targetDate = sub.status === 'trial' ? sub.trial_ends_at : sub.expires_at;

  return `
    <div class="card current-plan-card">
      <div class="current-plan-head">
        <div>
          <div class="current-plan-label">الباقة الحالية</div>
          <div class="current-plan-name">${esc(planNames[sub.plan] || sub.plan)}</div>
        </div>
        <div class="current-plan-status ${sub.status}">
          ${esc(statusLabels[sub.status] || sub.status)}
        </div>
      </div>

      ${targetDate ? `
        <div class="current-plan-meta">
          📅 ${sub.status === 'trial' ? 'تنتهي التجربة' : 'يتجدد'}: 
          <strong>${esc(fmtDate(targetDate))}</strong>
          ${daysLeft !== null ? ` · باقي <strong>${daysLeft}</strong> يوم` : ''}
        </div>
      ` : ''}

      ${sub.plan !== 'free' ? `
        <div class="current-plan-actions">
          <a href="/pay" class="btn btn-primary">💳 تجديد الاشتراك</a>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================
// شبكة الباقات
// ============================================================
function renderPlansGrid(plans, currentPlan) {
  return `
    <div class="plans-grid">
      ${plans.map(p => renderPlanCard(p, currentPlan)).join('')}
    </div>
  `;
}

function renderPlanCard(plan, currentPlan) {
  const isCurrent = plan.plan === currentPlan;
  const isPopular = plan.plan === 'pro';

  const featureLabels = {
    cases: 'إدارة القضايا', clients: 'إدارة الموكلين',
    agenda: 'الأجندة', portal: 'بوابة الموكل',
    finance: 'الإدارة المالية', invoices: 'الفواتير',
    ai: 'الذكاء الاصطناعي', advanced_reports: 'تقارير متقدمة',
    whatsapp: 'تكامل واتساب', multi_office: 'مكاتب متعددة',
    api: 'API Access',
  };

  const includedFeatures = Object.entries(plan.features || {})
    .filter(([_, v]) => v === true)
    .map(([k]) => featureLabels[k] || k)
    .slice(0, 6);

  const limits = plan.limits || {};
  const maxUsers = limits.max_users === -1 ? '∞' : limits.max_users;
  const maxCases = limits.max_cases === -1 ? '∞' : limits.max_cases;
  const maxClients = limits.max_clients === -1 ? '∞' : limits.max_clients;

  return `
    <div class="plan-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''}">
      ${isPopular ? '<div class="plan-badge">الأكثر شعبية</div>' : ''}
      ${isCurrent ? '<div class="plan-badge current-badge"> باقتك الحالية</div>' : ''}

      <div class="plan-name">${esc(plan.display_name)}</div>
      <div class="plan-price">
        <span class="plan-price-num">${plan.price_egp}</span>
        <span class="plan-price-cur">ج / شهر</span>
      </div>

      <ul class="plan-features-list">
        ${includedFeatures.map(f => `<li>✅ ${esc(f)}</li>`).join('')}
      </ul>

      <div class="plan-limits">
        <div>👥 ${maxUsers} مستخدم</div>
        <div>📁 ${maxCases} قضية</div>
        <div>👤 ${maxClients} موكل</div>
      </div>

      ${isCurrent ? `
        <button class="btn btn-ghost btn-block" disabled>باقتك الحالية</button>
      ` : plan.price_egp === 0 ? `
        <button class="btn btn-ghost btn-block" disabled>الباقة المجانية</button>
      ` : `
        <a href="/pay?plan=${plan.plan}" class="btn btn-primary btn-block" style="text-decoration:none;display:block;text-align:center">
          💳 ترقية الآن
        </a>
      `}
    </div>
  `;
}

// ============================================================
// الاستخدام
// ============================================================
function renderUsage(sub) {
  const u = sub.usage || {};
  const l = sub.limits || {};
  const pct = (cur, max) => max === -1 ? 0 : Math.min(100, (cur / max) * 100);

  return `
    <div class="card">
      <h3 class="card-title">📊 الاستخدام الحالي</h3>

      <div class="usage-row">
        <div class="usage-label">المستخدمين</div>
        <div class="usage-bar">
          <div class="usage-fill" style="width:${pct(u.users, l.max_users)}%"></div>
        </div>
        <div class="usage-num">${u.users || 0} / ${l.max_users === -1 ? '∞' : l.max_users}</div>
      </div>

      <div class="usage-row">
        <div class="usage-label">القضايا</div>
        <div class="usage-bar">
          <div class="usage-fill" style="width:${pct(u.cases, l.max_cases)}%"></div>
        </div>
        <div class="usage-num">${u.cases || 0} / ${l.max_cases === -1 ? '∞' : l.max_cases}</div>
      </div>

      <div class="usage-row">
        <div class="usage-label">الموكلين</div>
        <div class="usage-bar">
          <div class="usage-fill" style="width:${pct(u.clients, l.max_clients)}%"></div>
        </div>
        <div class="usage-num">${u.clients || 0} / ${l.max_clients === -1 ? '∞' : l.max_clients}</div>
      </div>
    </div>
  `;
}

// ============================================================
// Click Handler
// ============================================================
function handleClick(e) {
  // الأزرار دلوقتي روابط مباشرة لـ /pay — مفيش حاجة هنا
}