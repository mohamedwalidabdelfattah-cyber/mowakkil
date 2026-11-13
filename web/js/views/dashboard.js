// web/js/views/dashboard.js
// لوحة التحكم Premium

import { apiJson } from '../api.js';
import { esc, empty, fmtMoney, skeleton } from '../ui.js';

let charts = {};

let currentFilters = {
  period: 'month', // '7d' | '30d' | 'month' | '3m' | 'year'
};

export async function render(host) {
  // Skeleton احترافي
  host.innerHTML = `
    <div class="card">${skeleton(2, 'card')}</div>
    <div class="card">${skeleton(1, 'chart')}</div>
  `;

  const loadAndRender = async () => {
    // 1) نجرب نجيب ملخص الشهر الأول — لو 403، يبقى الباقة مش فيها finance
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
      if (e.message?.includes('🔒') || e.message?.includes('ترقية')) {
        hasFinance = false;
      } else {
        console.error('Dashboard finance error:', e);
      }
    }

    // 2) البيانات الأساسية
    const promises = [
      apiJson(`/api/dashboard?period=${currentFilters.period}`).catch(() => ({})),
      apiJson('/api/agenda?days=7').catch(() => []),
    ];

    if (hasFinance) {
      const monthsForChart = currentFilters.period === 'year' ? 12 : currentFilters.period === '3m' ? 3 : currentFilters.period === '30d' ? 1 : 1;
      promises.push(apiJson(`/api/reports/monthly-trend?months=${monthsForChart}`).catch(() => []));
    }

    const [dashboard, sessions, trendData] = await Promise.all(promises);

    let monthlyData = { months: [], revenues: [], expenses: [] };
    if (hasFinance && trendData && trendData.length) {
      monthlyData = {
        months: trendData.map(t => t.label),
        revenues: trendData.map(t => t.revenue),
        expenses: trendData.map(t => t.expenses),
      };
    }

    const netDue = (summary.revenue || 0) - (summary.expenses || 0);
    const isProfit = netDue >= 0;

    Object.values(charts).forEach(c => c?.destroy?.());
    charts = {};

    const userName = localStorage.getItem('mowakkil_name') || 'مسؤول';
    const now = new Date();
    const greeting = now.getHours() < 12 ? 'صباح الخير' : now.getHours() < 18 ? 'مساء الخير' : 'مساء النور';

    host.innerHTML = `
      <!-- Welcome Hero (Premium) -->
      <div class="welcome-hero" style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px;">
        <div>
          <div class="welcome-label" style="color: #D4AF37; font-weight: 700;">${greeting} 👋</div>
          <div class="welcome-title" style="font-size: 32px; font-weight: 900; margin-top: 4px;">${esc(userName)}</div>
          <div class="welcome-sub" style="opacity: 0.8;">${esc(now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</div>
        </div>
        ${hasFinance ? `
          <div class="welcome-badge" style="background: rgba(217, 119, 6, 0.15); border: 1px solid rgba(217, 119, 6, 0.3);">
            <div class="badge-label" style="color: #D4AF37;">${isProfit ? 'صافي الربح' : 'صافي الخسارة'}</div>
            <div class="badge-value" style="color: #D4AF37;">${fmtMoney(Math.abs(netDue))} ج</div>
          </div>
        ` : `
          <div class="welcome-badge" style="background: rgba(255,255,255,0.1);">
            <div class="badge-label">الباقة الحالية</div>
            <div class="badge-value" style="font-size: 16px;">المجانية 🎁</div>
          </div>
        `}
      </div>

      <!-- فلتر الفترة الزمنية -->
      <div class="filter-bar" style="margin-bottom: 20px;">
        <div class="filter-bar-inner">
          <div class="filter-item" style="flex: 0 0 auto;">
            <label class="filter-label">📅 الفترة الزمنية</label>
            <div style="display: flex; gap: 6px;">
              <button class="period-btn ${currentFilters.period === '7d' ? 'active' : ''}" data-period="7d">7 أيام</button>
              <button class="period-btn ${currentFilters.period === '30d' ? 'active' : ''}" data-period="30d">30 يوم</button>
              <button class="period-btn ${currentFilters.period === 'month' ? 'active' : ''}" data-period="month">الشهر</button>
              <button class="period-btn ${currentFilters.period === '3m' ? 'active' : ''}" data-period="3m">3 شهور</button>
              <button class="period-btn ${currentFilters.period === 'year' ? 'active' : ''}" data-period="year">السنة</button>
            </div>
          </div>
        </div>
      </div>

      <!-- كروت إحصائيات Premium -->
      <div class="stats">
        <div class="stat" style="border-right: 4px solid #0F172A;">
          <div class="stat-icon" style="background: #F1F5F9; color: #0F172A;">⚖️</div>
          <div class="stat-body">
            <div class="l">القضايا النشطة</div>
            <div class="n primary">${dashboard.total_cases || 0}</div>
          </div>
        </div>

        <div class="stat" style="border-right: 4px solid #10B981;">
          <div class="stat-icon" style="background: #ECFDF5; color: #10B981;">👥</div>
          <div class="stat-body">
            <div class="l">الموكلين</div>
            <div class="n success">${dashboard.total_clients || 0}</div>
          </div>
        </div>

        <div class="stat" style="border-right: 4px solid #D4AF37;">
          <div class="stat-icon" style="background: #FFFBEB; color: #D4AF37;">📅</div>
          <div class="stat-body">
            <div class="l">جلسات النهاردة</div>
            <div class="n warning">${(dashboard.sessions_today || []).length}</div>
          </div>
        </div>

        <div class="stat" style="border-right: 4px solid #EF4444;">
          <div class="stat-icon" style="background: #FEF2F2; color: #EF4444;">✅</div>
          <div class="stat-body">
            <div class="l">مهام مفتوحة</div>
            <div class="n danger">${(dashboard.open_tasks || []).length}</div>
          </div>
        </div>
      </div>

      ${hasFinance ? `
        <!-- Chart: الأداء المالي -->
        <div class="chart-card" style="border-radius: 20px; border: 1px solid #E2E8F0;">
          <h3 style="font-size: 18px; font-weight: 800; color: #0F172A;">
            📊 الأداء المالي
            <span style="font-size: 12px; color: #64748B; font-weight: 500;">إيرادات vs مصاريف</span>
          </h3>
          <div class="chart-wrapper lg">
            <canvas id="chart-monthly"></canvas>
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-card" style="border-radius: 20px; border: 1px solid #E2E8F0;">
            <h3 style="font-size: 16px; font-weight: 800; color: #0F172A;">📈 توزيع المصاريف</h3>
            <div class="chart-wrapper sm">
              <canvas id="chart-expenses"></canvas>
            </div>
          </div>

          <div class="chart-card" style="border-radius: 20px; border: 1px solid #E2E8F0;">
            <h3 style="font-size: 16px; font-weight: 800; color: #0F172A;">💵 مصادر الدخل</h3>
            <div class="chart-wrapper sm">
              <canvas id="chart-revenue"></canvas>
            </div>
          </div>
        </div>
      ` : `
        <div class="card upgrade-banner" style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border: 1px solid #FDE68A; border-radius: 20px;">
          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div style="font-size: 48px;">📊</div>
            <div style="flex: 1; min-width: 200px;">
              <h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 800; color: #92400E;">التقارير المالية والرسوم البيانية</h3>
              <p style="margin: 0; font-size: 14px; color: #B8860B;">
                متاحة في الباقة الأساسية — شوف إيراداتك ومصاريفك وربحك بشكل تفاعلي
              </p>
            </div>
            <button class="btn btn-primary" data-goto="subscription" style="background: #0F172A; color: white;">🚀 ترقية الآن</button>
          </div>
        </div>
      `}

      <!-- Quick Actions -->
      <div class="card" style="border-radius: 20px;">
        <h3 style="font-size: 16px; font-weight: 800; color: #0F172A; margin-bottom: 16px;">⚡ إجراءات سريعة</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
          <button class="quick-action-btn" data-goto="cases" style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: white; border: none; padding: 20px; border-radius: 16px; cursor: pointer; text-align: center; font-weight: 700; font-size: 14px; transition: transform 0.2s;">
            <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
            إضافة قضية
          </button>
          <button class="quick-action-btn" data-goto="clients" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: none; padding: 20px; border-radius: 16px; cursor: pointer; text-align: center; font-weight: 700; font-size: 14px; transition: transform 0.2s;">
            <div style="font-size: 28px; margin-bottom: 8px;">👥</div>
            إضافة موكل
          </button>
          <button class="quick-action-btn" data-goto="money-invoices" style="background: #0F172A; color: white; border: none; padding: 20px; border-radius: 16px; cursor: pointer; text-align: center; font-weight: 700; font-size: 14px; transition: transform 0.2s;">
            <div style="font-size: 28px; margin-bottom: 8px;">📄</div>
            فاتورة جديدة
          </button>
          <button class="quick-action-btn" data-goto="tasks" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; border: none; padding: 20px; border-radius: 16px; cursor: pointer; text-align: center; font-weight: 700; font-size: 14px; transition: transform 0.2s;">
            <div style="font-size: 28px; margin-bottom: 8px;">✅</div>
            إضافة مهمة
          </button>
        </div>
      </div>

      <!-- الجلسات القادمة -->
      <div class="card" style="border-radius: 20px;">
        <div class="section-header">
          <h3 style="font-size: 16px; font-weight: 800;">📅 الجلسات القادمة</h3>
          <button class="btn btn-ghost" data-goto="agenda">عرض الكل</button>
        </div>
        ${sessions.length ? sessions.slice(0, 5).map(s => `
          <div class="item" style="border-radius: 12px;">
            <div class="top">
              <span class="name">${esc(s.case_number || '—')}</span>
              <span class="num mono" style="color: #0F172A; font-weight: 700;">${esc(s.session_date)}</span>
            </div>
            <div class="meta">🏛️ ${esc(s.court || '')}${s.client_name ? ' · ' + esc(s.client_name) : ''}</div>
          </div>
        `).join('') : empty('مفيش جلسات قادمة', '📅')}
      </div>

      <!-- المهام المفتوحة -->
      <div class="card" style="border-radius: 20px;">
        <div class="section-header">
          <h3 style="font-size: 16px; font-weight: 800;">✅ مهام مفتوحة</h3>
          <button class="btn btn-ghost" data-goto="tasks">عرض الكل</button>
        </div>
        ${(dashboard.open_tasks || []).length ? dashboard.open_tasks.slice(0, 5).map(t => `
          <div class="item" style="border-radius: 12px;">
            <div class="top">
              <span class="name">${esc(t.title)}</span>
              <span class="badge trial">مفتوحة</span>
            </div>
            <div class="meta">${t.lawyer_name ? '👤 ' + esc(t.lawyer_name) + ' · ' : ''}${esc(t.due_date || '')}</div>
          </div>
        `).join('') : empty('مفيش مهام مفتوحة', '✅')}
      </div>
    `;

    // الأحداث
    host.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', async () => {
      const { showView } = await import('../router.js');
      showView(b.dataset.goto);
    }));

    // فلتر الفترة
    host.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
      currentFilters.period = b.dataset.period;
      loadAndRender();
    }));

    // رسم الرسوم
    if (hasFinance) {
      setTimeout(() => {
        drawMonthlyChart(monthlyData);
        drawExpensesChart(pl.expense_groups || {});
        drawRevenueChart(pl.revenues || []);
      }, 100);
    }
  };

  await loadAndRender();
}

// ============================================================
// Helpers: الفترة الزمنية
// ============================================================
function getRangeForFilter(period) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case '7d':
      return { from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to: today };
    case '30d':
      return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today };
    case '3m':
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: today };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: today };
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today };
  }
}

// ============================================================
// Charts (تحسينات Premium)
// ============================================================
function drawMonthlyChart(data) {
  const ctx = document.getElementById('chart-monthly');
  if (!ctx) return;

  charts.monthly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: [
        {
          label: 'الإيرادات',
          data: data.revenues,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
        {
          label: 'المصاريف',
          data: data.expenses,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#EF4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            font: { family: 'IBM Plex Sans Arabic', size: 13, weight: '600' },
            usePointStyle: true,
            padding: 16,
            boxWidth: 8,
            boxHeight: 8,
          },
        },
        tooltip: {
          backgroundColor: '#111827',
          titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
          bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${Number(c.parsed.y).toLocaleString('ar-EG')} ج`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'IBM Plex Sans Arabic', size: 12 }, color: '#9CA3AF' },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#F3F4F6', drawBorder: false },
          ticks: {
            font: { family: 'IBM Plex Mono', size: 11 },
            color: '#9CA3AF',
            callback: (v) => Number(v).toLocaleString('ar-EG'),
          },
        },
      },
    },
  });
}

function drawExpensesChart(groups) {
  const ctx = document.getElementById('chart-expenses');
  if (!ctx) return;

  const data = [
    { label: 'مرتبات', value: groups.salaries || 0, color: '#0F172A' },
    { label: 'مكتب', value: groups.office || 0, color: '#D4AF37' },
    { label: 'قضايا', value: groups.cases || 0, color: '#10B981' },
    { label: 'إدارية', value: groups.admin || 0, color: '#EF4444' },
  ];

  const hasData = data.some(d => d.value > 0);

  if (!hasData) {
    ctx.parentElement.innerHTML = empty('مفيش مصاريف في الفترة دي', '💸');
    return;
  }

  charts.expenses = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: data.map(d => d.color),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'IBM Plex Sans Arabic', size: 12, weight: '600' },
            usePointStyle: true,
            padding: 12,
            boxWidth: 8,
            boxHeight: 8,
          },
        },
        tooltip: {
          backgroundColor: '#111827',
          titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
          bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (c) => ` ${c.label}: ${Number(c.parsed).toLocaleString('ar-EG')} ج`,
          },
        },
      },
    },
  });
}

function drawRevenueChart(revenues) {
  const ctx = document.getElementById('chart-revenue');
  if (!ctx) return;

  if (!revenues.length) {
    ctx.parentElement.innerHTML = empty('مفيش إيرادات في الفترة دي', '💰');
    return;
  }

  const colors = ['#0F172A', '#10B981', '#D4AF37', '#EF4444', '#D4AF37', '#06B6D4'];

  charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: revenues.map(r => r.name),
      datasets: [{
        data: revenues.map(r => r.amount),
        backgroundColor: revenues.map((_, i) => colors[i % colors.length]),
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
          bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (c) => ` ${Number(c.parsed.y).toLocaleString('ar-EG')} ج`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'IBM Plex Sans Arabic', size: 11 }, color: '#6B7280' },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#F3F4F6', drawBorder: false },
          ticks: { font: { family: 'IBM Plex Mono', size: 10 }, color: '#9CA3AF' },
        },
      },
    },
  });
} 
