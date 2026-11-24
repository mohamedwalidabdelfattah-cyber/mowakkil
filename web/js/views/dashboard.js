// web/js/views/dashboard.js
// لوحة التحكم — تصميم v7

import { apiJson, hasFeature, fetchSubscription, getToken, getRole } from '../api.js';
import { esc, empty, fmtMoney, skeleton, cur, curName, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { icon } from '../icons.js';
import { openWhatsAppComposer, openTomorrowReminders } from '../whatsapp.js';
import { PALETTE, SERIES, areaGradient } from '../chart-theme.js';

let charts = {};

let currentFilters = {
  period: 'month', // '7d' | '30d' | 'month' | '3m' | 'year'
};

const PERIODS = [
  ['7d', '7 أيام'], ['30d', '30 يوم'], ['month', 'الشهر'], ['3m', '3 شهور'], ['year', 'السنة'],
];

// آخر بيانات اتعرضت لكل فترة: الرجوع للرئيسية بيظهر فوراً (بالرسوم) وبعدين بيتحدث في الخلفية
// (قبل كده كانت بتستنى 3 طلبات ورا بعض كل مرة — ثانيتين لـ 4 على السيرفر الحقيقي والرسوم مختفية)
const lastData = new Map();
const cacheKey = (period) => `${getToken().slice(-16)}|${period}`;

// كل الطلبات مرة واحدة مع بعض
async function fetchAll(period) {
  await fetchSubscription().catch(() => {}); // متخزنة بعد أول مرة، فمش بتأخّر
  let hasFinance = hasFeature('finance');
  const withAccounting = hasFinance && hasFeature('accounting');
  const range = getRangeForFilter(period);
  const months = period === 'year' ? 12 : period === '3m' ? 3 : 6;
  const locked = (e) => e?.message?.includes('🔒') || e?.message?.includes('ترقية');
  let financeLocked = false;
  const fin = (p, o) => apiJson(p, o).catch(e => { if (locked(e)) financeLocked = true; else console.error('Dashboard finance error:', e); return null; });

  const [dashboard, sessions, trendData, summary, pl, cash] = await Promise.all([
    apiJson(`/api/dashboard?period=${period}`).catch(() => ({})),
    apiJson('/api/agenda?days=7').catch(() => []),
    hasFinance ? apiJson(`/api/reports/monthly-trend?months=${months}`).catch(() => []) : [],
    withAccounting ? fin(`/api/reports/accounting-summary?from=${range.from}&to=${range.to}`, { silent: true }) : null,
    withAccounting ? fin(`/api/reports/profit-loss?from=${range.from}&to=${range.to}`, { silent: true }) : null,
    hasFinance ? apiJson(`/api/fees/cash-summary?from=${range.from}&to=${range.to}`, { skipCache: true, silent: true }).catch(() => null) : null,
  ]);
  if (financeLocked) hasFinance = false;
  return { hasFinance, dashboard: dashboard || {}, sessions: sessions || [], trendData: trendData || [], summary: summary || {}, pl: pl || {}, cash };
}

export async function render(host) {
  let seq = 0;
  const loadAndRender = async () => {
    const my = ++seq;
    const period = currentFilters.period;
    const key = cacheKey(period);
    const cached = lastData.get(key);
    if (cached) paint(host, cached, loadAndRender);
    else host.innerHTML = `
      <div class="card">${skeleton(2, 'card')}</div>
      <div class="card">${skeleton(1, 'chart')}</div>
    `;
    const data = await fetchAll(period);
    if (my !== seq || !host.isConnected) return; // المستخدم غيّر الفترة أو راح لشاشة تانية
    lastData.set(key, data);
    // نرسم تاني بس لو حاجة اتغيرت (عشان الصفحة متترعشش)
    if (!cached || JSON.stringify(cached) !== JSON.stringify(data)) paint(host, data, loadAndRender);
  };

  await loadAndRender();
}

function paint(host, data, reload) {
    const { hasFinance, dashboard, sessions, trendData, summary, pl, cash } = data;
    const monthlyData = {
      months: (trendData || []).map(t => t.label),
      revenues: (trendData || []).map(t => t.revenue),
      expenses: (trendData || []).map(t => t.expenses),
    };

    const revenue = summary.revenue || 0;
    const expenses = summary.expenses || 0;
    // الرقم اللي فوق: الفلوس اللي دخلت فعلاً ناقص اللي اتصرف (زي الوضع المبسط) — مش الأتعاب المتفق عليها
    const net = cash && cash.net != null ? cash.net : revenue - expenses;

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
          <div class="welcome-sub">${esc(now.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;position:relative;z-index:1">
          ${hasFinance ? `
            <div class="welcome-badge">
              <div class="badge-label">${net >= 0 ? 'اللي فضل معاك' : 'صرفت أكتر من اللي دخل'} · ${PERIODS.find(p => p[0] === currentFilters.period)?.[1]}</div>
              <div class="badge-value">${fmtMoney(Math.abs(net))} <span style="font-size:13px;font-weight:500">${cur()}</span></div>
            </div>` : ''}
          <div class="welcome-badge">
            <div class="badge-label">جلسات النهارده</div>
            <div class="badge-value">${today.length}</div>
          </div>
        </div>
      </div>

      <div id="onb-slot"></div>

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
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm wa-ghost" id="wa-tomorrow-btn" title="تذكير موكلين جلسات بكرة على واتساب">💬 تذكير جلسات بكرة</button>
                <button class="btn btn-ghost btn-sm" data-goto="agenda">عرض الكل</button>
              </div>
            </div>
            ${sessions.length ? sessions.slice(0, 5).map(s => `
              <div class="item">
                <div class="top">
                  <span class="name">${esc(s.case_number || '—')}</span>
                  <span class="badge">${esc(fmtShortDate(s.session_date))}</span>
                </div>
                <div class="meta">${icon('landmark')} ${esc(s.court || '—')}${s.client_name ? ' · ' + esc(s.client_name) : ''}</div>
                ${s.client_name ? `<button class="btn btn-ghost btn-sm wa-ghost" data-wa-session="${s.id}" style="margin-top:6px">💬 تذكير الموكل</button>` : ''}
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

    mountOnboarding(host.querySelector('#onb-slot'));
    host.querySelector('#wa-tomorrow-btn')?.addEventListener('click', () => openTomorrowReminders(sessions));
    host.querySelectorAll('[data-wa-session]').forEach(b => b.addEventListener('click', () => {
      const s = sessions.find(x => String(x.id) === b.dataset.waSession);
      if (!s) return;
      openWhatsAppComposer({
        kind: 'session', kinds: ['session', 'update', 'general'],
        phone: s.client_phone, client_name: s.client_name, case_number: s.case_number,
        court: s.court, session_date: s.session_date,
      });
    }));
    host.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', async () => {
      const { showView } = await import('../router.js');
      showView(b.dataset.goto);
    }));
    host.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
      currentFilters.period = b.dataset.period;
      reload();
    }));

    if (hasFinance) {
      const canvas = host.querySelector('#chart-monthly');
      whenChartReady(() => {
        // لو الصفحة اترسمت تاني أو المستخدم مشي، الرسمة دي مبقتش ليها لازمة
        if (!canvas.isConnected) return;
        drawMonthlyChart(monthlyData);
        drawExpensesChart(pl.expense_groups || {});
        drawRevenueChart(pl.revenues || []);
      });
    }
}

// مكتبة الرسوم بتتحمل من النت: لو لسه موصلتش نستناها بدل ما الرسوم متظهرش خالص
function whenChartReady(fn, tries = 0) {
  if (typeof window.Chart !== 'undefined') return requestAnimationFrame(fn);
  if (tries > 60) return; // 15 ثانية
  setTimeout(() => whenChartReady(fn, tries + 1), 250);
}

function fmtShortDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ============================================================
// خطوات البداية: كارت لمالك المكتب الجديد لحد ما يضيف أول موكل وقضية وجلسة وأتعاب
// (كتير بيسجّلوا ومبيعرفوش يبدأوا منين — الكارت بيفتحله الفورم على طول)
// ============================================================
const ONB_STEPS = [
  { key: 'client',  title: 'ضيف أول موكل', hint: 'الاسم ورقم الموبايل بس', view: 'clients', open: '[data-toggle-panel="client-panel"]' },
  { key: 'case',    title: 'ضيف أول قضية', hint: 'رقم القضية والمحكمة واختار الموكل', view: 'cases', open: '[data-toggle-panel="case-panel"]' },
  { key: 'session', title: 'سجّل ميعاد الجلسة الجاية', hint: 'هتنزل في الأجندة ويجيلك تذكير قبلها', view: 'cases', open: '[data-toggle-panel="session-panel"]' },
  { key: 'fee',     title: 'سجّل الأتعاب المتفق عليها', hint: 'وتابع اللي اتدفع واللي فاضل على الموكل', view: 'fees', open: '#add-fee', feature: 'finance' },
  // الدعوة بتتبعت للموكل على واتساب على طول — فبنوريله الزرار بس ومبنضغطوش بداله
  { key: 'portal',  title: 'ادعي موكل لبوابة الموكل', hint: 'يتابع قضيته وجلساته من موبايله من غير ما يتصل بيك', view: 'clients', open: '[data-invite-client]', highlight: true, feature: 'portal', needs: 'client' },
  { key: 'ai',      title: 'اسأل المساعد القانوني بالذكاء الاصطناعي', hint: 'اكتب أي سؤال قانوني وهيرد عليك بالمواد والأحكام', view: 'search', open: '#chat-input', focus: true, feature: 'ai' },
];
const onbKey = () => 'mowakkil_onb_hidden_' + getToken().slice(-12);
const onbGet = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const onbSet = (k) => { try { localStorage.setItem(k, '1'); } catch {} };

async function mountOnboarding(slot) {
  if (!slot || getRole() !== 'admin' || onbGet(onbKey())) return;
  let d;
  try { d = await apiJson('/api/office/onboarding', { silent: true }); } catch { return; }
  if (!slot.isConnected) return;
  const steps = ONB_STEPS.filter(s => !s.feature || hasFeature(s.feature));
  const done = steps.filter(s => d.steps?.[s.key]).length;
  const allDone = done === steps.length;
  // اللي خلّص كل الخطوات: نهنّيه مرة في أول شهر، والمكاتب القديمة مش محتاجة الكارت أصلاً
  if (allDone) {
    const created = d.created_at ? new Date(String(d.created_at).replace(' ', 'T') + 'Z') : null;
    if (onbGet(onbKey() + '_done') || !created || (Date.now() - created) / 86400000 > 30) return;
  }
  const pct = Math.round((done / steps.length) * 100);
  const nextIdx = steps.findIndex(s => !d.steps?.[s.key]);
  slot.innerHTML = `
    <div class="card onb-card">
      <div class="onb-head">
        <div>
          <h3 style="margin:0">${allDone ? '🎉 مكتبك جاهز!' : '🚀 ابدأ مع مُوكِّل خطوة بخطوة'}</h3>
          <div class="meta" style="margin:4px 0 0">${allDone
            ? 'كده انت شغّال على مُوكِّل. الجلسات هتفكّرك لوحدها، وتقدر تبعت للموكل تذكير على واتساب من الأجندة.'
            : `خلّصت ${done} من ${steps.length} — كل خطوة بتفتحلك الفورم على طول`}</div>
        </div>
        <button class="icon-btn" data-onb="hide" title="إخفاء" aria-label="إخفاء خطوات البداية">✕</button>
      </div>
      <div class="onb-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <div class="onb-steps">
        ${steps.map((s, i) => {
          const ok = !!d.steps?.[s.key];
          return `<div class="onb-step ${ok ? 'done' : ''} ${i === nextIdx ? 'next' : ''}">
            <span class="onb-check">${ok ? '✓' : i + 1}</span>
            <div class="onb-text"><strong>${s.title}</strong><span>${s.hint}</span></div>
            ${ok ? '' : `<button class="btn ${i === nextIdx ? 'btn-primary' : 'btn-ghost'} btn-sm" data-onb-go="${s.key}">${i === nextIdx ? 'ابدأ' : 'افتح'}</button>`}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  slot.querySelector('[data-onb="hide"]').addEventListener('click', () => {
    onbSet(onbKey()); if (allDone) onbSet(onbKey() + '_done');
    slot.innerHTML = '';
  });
  slot.querySelectorAll('[data-onb-go]').forEach(b => b.addEventListener('click', async () => {
    const s = steps.find(x => x.key === b.dataset.onbGo);
    if (s.needs && !d.steps?.[s.needs]) {
      const { toast } = await import('../ui.js');
      return toast('ضيف موكل الأول عشان تقدر تبعتله دعوة', 'bad');
    }
    const { showView } = await import('../router.js');
    await showView(s.view);
    // نستنى الشاشة تترسم ونفتح فورم الإضافة (أو نوريله الزرار)
    for (let i = 0; i < 40; i++) {
      const el = document.querySelector('#view-host ' + s.open);
      if (el) {
        if (s.highlight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('onb-pulse');
          setTimeout(() => el.classList.remove('onb-pulse'), 6000);
        } else if (s.focus) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        } else {
          const panel = el.dataset.togglePanel && document.getElementById(el.dataset.togglePanel);
          if (!panel || panel.hidden) el.click();
        }
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }));
}

// ============================================================
// الفترة الزمنية
// ============================================================
function getRangeForFilter(period) {
  const now = new Date();
  const today = localISO(now);
  switch (period) {
    case '7d':  return { from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to: today };
    case '30d': return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today };
    case '3m':  return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: today };
    case 'year': return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: today };
    default:    return { from: monthStartISO(now), to: today };
  }
}

// ============================================================
// Charts — الألوان والخطوط من chart-theme.js
// ============================================================
const money = v => `${Number(v || 0).toLocaleString('en-US')} ${cur()}`;

function drawMonthlyChart(data) {
  const ctx = document.getElementById('chart-monthly');
  if (!ctx || typeof Chart === 'undefined') return;
  if (!data.months.length) {
    ctx.parentElement.innerHTML = empty('مفيش بيانات كفاية للرسم في الفترة دي', '📈');
    return;
  }
  const c2d = ctx.getContext('2d');
  window.Chart?.getChart?.(ctx)?.destroy();
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
        y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('en-US') } },
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
  window.Chart?.getChart?.(ctx)?.destroy();
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
  window.Chart?.getChart?.(ctx)?.destroy();
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
        y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('en-US') } },
      },
    },
  });
}
