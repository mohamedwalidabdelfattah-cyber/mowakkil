// web/js/views/dashboard.js
// لوحة التحكم — تصميم v7

import { apiJson } from '../api.js';
import { esc, empty, fmtMoney, skeleton } from '../ui.js';
import { icon } from '../icons.js';
import { PALETTE, SERIES, areaGradient } from '../chart-theme.js';

let charts = {};

let currentFilters = {
  period: 'month', // '7d' | '30d' | 'month' | '3m' | 'year'
};

const PERIODS = [
  ['7d', '7 أيام'], ['30d', '30 يوم'], ['month', 'الشهر'], ['3m', '3 شهور'], ['year', 'السنة'],
];

export async function render(host) {
  host.innerHTML = `
    <div class="card">${skeleton(2, 'card')}</div>
    <div class="card">${skeleton(1, 'chart')}</div>
  `;

  const loadAndRender = async () => {
    // 1) ملخص مالي — لو 403 يبقى الباقة مش فيها finance
    let hasFinance = true;
    let summary = {};
    let pl = {};
    const range = getRangeForFilter(currentFilters.period);

    try {
      [summary, pl] = await Promise.all([
        apiJson(`/api/reports/accounting-summary?from=${range.from}&to=${range.to}`),
        apiJson(`/api/reports/profit-loss?from=${range.from}&to=${range.to}`),
      ]);
    } catch (e) {
      if (e.message?.includes('🔒') || e.message?.includes('ترقية')) hasFinance = false;
      else console.error('Dashboard finance error:', e);
    }

    // 2) البيانات الأساسية
    const promises = [
      apiJson(`/api/dashboard?period=${currentFilters.period}`).catch(() => ({})),
      apiJson('/api/agenda?days=7').catch(() => []),
    ];
    if (hasFinance) {
      const months = currentFilters.period === 'year' ? 12 : currentFilters.period === '3m' ? 3 : 6;
      promises.push(apiJson(`/api/reports/monthly-trend?months=${months}`).catch(() => []));
    }
    const [dashboard, sessions, trendData] = await Promise.all(promises);

    const monthlyData = {
      months: (trendData || []).map(t => t.label),
      revenues: (trendData || []).map(t => t.revenue),
      expenses: (trendData || []).map(t => t.expenses),
    };

    const revenue = summary.revenue || 0;
    const expenses = summary.expenses || 0;
    const net = revenue - expenses;

    Object.values(charts).forEach(c => c?.destroy?.());
    charts = {};

    const userName = localStorage.getItem('mowakkil_name') || 'مسؤول';
    const now = new Date();
    const greeting = now.getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
    const openTasks = dashboard.open_tasks || [];
    const today = dashboard.sessions_today || [];

    const kpi = (ic, label, value, hint = '', tone = '') => `
      <div class="stat">
        <div class="stat-icon ${tone}">${icon(ic)}</div>
        <div class="stat-body">
          <div class="l">${label}</div>
          <div class="n">${value}</div>
          ${hint ? `<div class="meta" style="margin:0;font-size:12px">${hint}</div>` : ''}
        </div>
      </div>`;

    host.innerHTML = `
      <div class="welcome-hero">
        <div style="position:relative;z-index:1">
          <div class="welcome-label">${greeting}</div>
          <div class="welcome-title">${esc(userName)}</div>
          <div class="welcome-sub">${esc(now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;position:relative;z-index:1">
          ${hasFinance ? `
            <div class="welcome-badge">
              <div class="badge-label">${net >= 0 ? 'صافي الربح' : 'صافي الخسارة'} · ${PERIODS.find(p => p[0] === currentFilters.period)?.[1]}</div>
              <div class="badge-value">${fmtMoney(Math.abs(net))} <span style="font-size:13px;font-weight:500">ج.م</span></div>
            </div>` : ''}
          <div class="welcome-badge">
            <div class="badge-label">جلسات النهارده</div>
            <div class="badge-value">${today.length}</div>
          </div>
        </div>
      </div>

      <div class="section-header" style="margin-bottom:12px">
        <h3 style="margin:0">${icon('chart')} نظرة عامة</h3>
        <div class="filter-tabs" role="tablist">
          ${PERIODS.map(([k, l]) => `<button data-period="${k}" class="${currentFilters.period === k ? 'active' : ''}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="stats">
        ${kpi('scale', 'القضايا النشطة', dashboard.total_cases || 0)}
        ${kpi('users', 'الموكلين', dashboard.total_clients || 0)}
        ${kpi('calendar', 'جلسات النهارده', today.length, today[0] ? esc(today[0].court || '') : '')}
        ${kpi('check', 'مهام مفتوحة', openTasks.length,
              openTasks.filter(t => t.due_date && new Date(t.due_date) < now).length
                ? `<span style="color:var(--c-danger)">${openTasks.filter(t => t.due_date && new Date(t.due_date) < now).length} متأخرة</span>` : '')}
      </div>

      <div class="dash-grid">
        <div>
          ${hasFinance ? `
            <div class="chart-card">
              <div class="section-header" style="margin-bottom:6px">
                <h3 style="margin:0">${icon('trendUp')} الأداء المالي</h3>
                <div style="display:flex;gap:16px;font-size:13px">
                  <span><span class="meta" style="margin:0">الإيرادات</span> <strong style="color:var(--text)">${fmtMoney(revenue)}</strong></span>
                  <span><span class="meta" style="margin:0">المصاريف</span> <strong style="color:var(--text)">${fmtMoney(expenses)}</strong></span>
                </div>
              </div>
              <div class="chart-wrapper lg"><canvas id="chart-monthly"></canvas></div>
            </div>
            <div class="charts-grid">
              <div class="chart-card">
                <h3>${icon('receipt')} توزيع المصاريف</h3>
                <div class="chart-wrapper sm"><canvas id="chart-expenses"></canvas></div>
              </div>
              <div class="chart-card">
                <h3>${icon('banknote')} مصادر الدخل</h3>
                <div class="chart-wrapper sm"><canvas id="chart-revenue"></canvas></div>
              </div>
            </div>
          ` : `
            <div class="card" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--gold-50) !important;border-color:var(--gold-100) !important">
              <div class="stat-icon">${icon('chart')}</div>
              <div style="flex:1;min-width:200px">
                <h3 style="margin:0 0 4px">التقارير المالية والرسوم البيانية</h3>
                <div class="meta" style="margin:0">متاحة في الباقة الأساسية — تابع إيراداتك ومصاريفك وربحك بشكل تفاعلي</div>
              </div>
              <button class="btn btn-gold" data-goto="subscription">${icon('gem')} ترقية الباقة</button>
            </div>
          `}
        </div>

        <div>
          <div class="card">
            <h3>${icon('zap')} إجراءات سريعة</h3>
            <div class="quick-actions">
              <button class="quick-action-btn" data-goto="cases"><span class="qa-icon">${icon('folder')}</span>قضية جديدة</button>
              <button class="quick-action-btn" data-goto="clients"><span class="qa-icon">${icon('users')}</span>موكل جديد</button>
              <button class="quick-action-btn" data-goto="tasks"><span class="qa-icon">${icon('check')}</span>مهمة جديدة</button>
              <button class="quick-action-btn" data-goto="money-invoices"><span class="qa-icon">${icon('file')}</span>فاتورة جديدة</button>
            </div>
          </div>

          <div class="card">
            <div class="section-header">
              <h3>${icon('calendar')} الجلسات القادمة</h3>
              <button class="btn btn-ghost btn-sm" data-goto="agenda">عرض الكل</button>
            </div>
            ${sessions.length ? sessions.slice(0, 5).map(s => `
              <div class="item">
                <div class="top">
                  <span class="name">${esc(s.case_number || '—')}</span>
                  <span class="badge">${esc(fmtShortDate(s.session_date))}</span>
                </div>
                <div class="meta">${icon('landmark')} ${esc(s.court || '—')}${s.client_name ? ' · ' + esc(s.client_name) : ''}</div>
              </div>`).join('') : empty('مفيش جلسات خلال الأسبوع الجاي', '📅')}
          </div>

          <div class="card">
            <div class="section-header">
              <h3>${icon('check')} مهام مفتوحة</h3>
              <button class="btn btn-ghost btn-sm" data-goto="tasks">عرض الكل</button>
            </div>
            ${openTasks.length ? openTasks.slice(0, 5).map(t => {
              const late = t.due_date && new Date(t.due_date) < now;
              return `
              <div class="item">
                <div class="top">
                  <span class="name">${esc(t.title)}</span>
                  <span class="badge ${late ? 'suspended' : 'trial'}">${late ? 'متأخرة' : 'مفتوحة'}</span>
                </div>
                <div class="meta">${t.lawyer_name ? icon('user') + ' ' + esc(t.lawyer_name) + ' · ' : ''}${icon('clock')} ${esc(t.due_date || 'بدون موعد')}</div>
              </div>`;
            }).join('') : empty('مفيش مهام مفتوحة', '✅')}
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', async () => {
      const { showView } = await import('../router.js');
      showView(b.dataset.goto);
    }));
    host.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
      currentFilters.period = b.dataset.period;
      loadAndRender();
    }));

    if (hasFinance) {
      requestAnimationFrame(() => {
        drawMonthlyChart(monthlyData);
        drawExpensesChart(pl.expense_groups || {});
        drawRevenueChart(pl.revenues || []);
      });
    }
  };

  await loadAndRender();
}

function fmtShortDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ============================================================
// الفترة الزمنية
// ============================================================
function getRangeForFilter(period) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (period) {
    case '7d':  return { from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to: today };
    case '30d': return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today };
    case '3m':  return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: today };
    case 'year': return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: today };
    default:    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today };
  }
}

// ============================================================
// Charts — الألوان والخطوط من chart-theme.js
// ============================================================
const money = v => `${Number(v || 0).toLocaleString('ar-EG')} ج`;

function drawMonthlyChart(data) {
  const ctx = document.getElementById('chart-monthly');
  if (!ctx || typeof Chart === 'undefined') return;
  if (!data.months.length) {
    ctx.parentElement.innerHTML = empty('مفيش بيانات كفاية للرسم في الفترة دي', '📈');
    return;
  }
  const c2d = ctx.getContext('2d');
  charts.monthly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: [
        { label: 'الإيرادات', data: data.revenues, borderColor: PALETTE.gold, backgroundColor: areaGradient(c2d, '#D4AF37'), fill: true },
        { label: 'المصاريف', data: data.expenses, borderColor: PALETTE.navy2, backgroundColor: 'transparent', borderDash: [5, 4], fill: false },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'start' },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('ar-EG') } },
      },
    },
  });
}

function drawExpensesChart(groups) {
  const ctx = document.getElementById('chart-expenses');
  if (!ctx || typeof Chart === 'undefined') return;
  const data = [
    ['مرتبات', groups.salaries], ['مكتب', groups.office], ['قضايا', groups.cases], ['إدارية', groups.admin],
  ].map(([label, value]) => ({ label, value: value || 0 })).filter(d => d.value > 0);

  if (!data.length) {
    ctx.parentElement.innerHTML = empty('مفيش مصاريف في الفترة دي', '💸');
    return;
  }
  charts.expenses = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.label),
      datasets: [{ data: data.map(d => d.value), backgroundColor: data.map((_, i) => SERIES[i % SERIES.length]), hoverOffset: 6 }],
    },
    options: {
      cutout: '70%',
      plugins: { tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.parsed)}` } } },
    },
  });
}

function drawRevenueChart(revenues) {
  const ctx = document.getElementById('chart-revenue');
  if (!ctx || typeof Chart === 'undefined') return;
  if (!revenues.length) {
    ctx.parentElement.innerHTML = empty('مفيش إيرادات في الفترة دي', '💰');
    return;
  }
  charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: revenues.map(r => r.name),
      datasets: [{
        data: revenues.map(r => r.amount),
        backgroundColor: revenues.map((_, i) => (i === 0 ? PALETTE.gold : SERIES[(i + 1) % SERIES.length])),
        maxBarThickness: 38,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${money(c.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('ar-EG') } },
      },
    },
  });
}
