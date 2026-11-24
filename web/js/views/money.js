// web/js/views/money.js
// الإدارة المالية المبسّطة

import { apiJson, hasFeature } from '../api.js';
import { renderSimple } from './money-simple.js';
import { renderProfit } from './money-profit.js';
import { esc, toast, empty, skeleton, fmtMoney, cur, curName, localISO, monthStartISO, monthEndISO, defaultVat } from '../ui.js';
import { openModal } from '../modal.js';

let currentSub = 'money';
let moneyCharts = {};

export async function render(host, options = {}) {
  currentSub = options.subView || 'money';

  Object.values(moneyCharts).forEach(c => c?.destroy?.());
  moneyCharts = {};

  // skeleton احترافي للصفحة كلها
  host.innerHTML = `
    <div class="card">
      ${skeleton(3, 'card')}
    </div>
    <div class="card">
      ${skeleton(1, 'chart')}
    </div>
  `;

  try {
    switch (currentSub) {
      case 'money-expenses': return await renderExpenses(host);
      case 'money-income':   return await renderIncome(host);
      case 'money-reports':  return await renderSimple(host);
      case 'money-profit':   return await renderProfit(host);
      case 'money-invoices': return await renderInvoices(host);
      default:               return await renderSimple(host); // الوضع المبسط (الفلوس اللي دخلت وخرجت فعلاً)
    }
  } catch (e) {
    host.innerHTML = `<div class="card">${empty('خطأ: ' + e.message, '⚠️')}</div>`;
  }
}

// ============================================================
// 1) اللوحة المالية المبسّطة
// ============================================================
async function renderDashboard(host) {
  const now = new Date();
  const from = monthStartISO(now);
  const to = localISO(now);

  const [summary, pl, invStats] = await Promise.all([
    apiJson(`/api/reports/accounting-summary?from=${from}&to=${to}`),
    apiJson(`/api/reports/profit-loss?from=${from}&to=${to}`),
    apiJson(`/api/invoices/stats`).catch(() => ({ totals: {}, remaining: 0 })),
  ]);

  const isProfit = summary.is_profit;

  host.innerHTML = `
    <div class="welcome-hero">
      <div>
        <div class="welcome-label">${esc(monthName(now))}</div>
        <div class="welcome-title">${isProfit ? 'مكتبك ربحان ✅' : 'المكتب خسران ⚠️'}</div>
        <div class="welcome-sub">صافي ${isProfit ? 'الربح' : 'الخسارة'} للشهر الحالي</div>
      </div>
      <div class="welcome-badge">
        <div class="badge-label">الصافي</div>
        <div class="badge-value">${fmtMoney(Math.abs(summary.net_profit))} ${cur()}</div>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="l">💰 دخلت</div>
        <div class="n success">${fmtMoney(summary.revenue)}</div>
      </div>
      <div class="stat">
        <div class="l">💸 صرفت</div>
        <div class="n danger">${fmtMoney(summary.expenses)}</div>
      </div>
      <div class="stat">
        <div class="l">💵 النقدية</div>
        <div class="n primary">${fmtMoney(summary.cash_balance)}</div>
      </div>
      <div class="stat">
        <div class="l">🏦 البنك</div>
        <div class="n">${fmtMoney(summary.bank_balance)}</div>
      </div>
    </div>

    <!-- Chart: إيرادات vs مصاريف -->
    <div class="chart-card">
      <h3>📊 إيرادات vs مصاريف (آخر 6 شهور)</h3>
      <div class="chart-wrapper">
        <canvas id="chart-money-overview"></canvas>
      </div>
    </div>

    ${invStats.totals?.total_invoices > 0 ? `
      <div class="card">
        <div class="section-header">
          <h3>📄 الفواتير</h3>
          <button class="btn btn-ghost" data-goto="money-invoices">عرض الكل</button>
        </div>
        <div class="stats" style="margin-bottom:0">
          <div class="stat">
            <div class="l">إجمالي الفواتير</div>
            <div class="n">${fmtMoney(invStats.totals.total_amount)}</div>
          </div>
          <div class="stat">
            <div class="l">مدفوع</div>
            <div class="n success">${fmtMoney(invStats.totals.paid_amount)}</div>
          </div>
          <div class="stat">
            <div class="l">متبقي</div>
            <div class="n danger">${fmtMoney(invStats.remaining)}</div>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="card">
      <h3>💰 مصادر الدخل</h3>
      ${pl.revenues.length ? pl.revenues.map(r => `
        <div class="report-row">
          <span>${esc(r.name)}</span>
          <span style="color:var(--success);font-weight:700">${fmtMoney(r.amount)} ${cur()}</span>
        </div>
      `).join('') : empty('مفيش دخل الشهر ده', '💰')}
      ${pl.revenues.length ? `
        <div class="report-row total">
          <span>الإجمالي</span>
          <span>${fmtMoney(pl.total_revenue)} ${cur()}</span>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <h3>💸 أهم المصاريف</h3>
      ${renderExpenseBreakdown(pl.expense_groups)}
    </div>

    <div class="card">
      <h3>⚡ إجراءات سريعة</h3>
      <div class="quick-actions">
        <button class="quick-btn quick-expense" data-goto="money-expenses">
          <span class="quick-icon">💸</span>
          <span class="quick-label">إضافة مصروف</span>
        </button>
        <button class="quick-btn quick-invoice" data-goto="money-invoices">
          <span class="quick-icon">📄</span>
          <span class="quick-label">فاتورة جديدة</span>
        </button>
      </div>
    </div>

    <div class="warn">
      💡 <strong>للتفاصيل المحاسبية الكاملة</strong> — روح لـ "دفتر اليومية" أو "قائمة الدخل" من قايمة المحاسبة.
    </div>
  `;

  host.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', async () => {
    const { showView } = await import('../router.js');
    showView(b.dataset.goto);
  }));

  setTimeout(() => drawMoneyOverviewChart(), 100);
}

function monthName(date) {
  return date.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long' });
}

function renderExpenseBreakdown(groups) {
  const items = [
    { label: 'مرتبات الفريق', value: groups.salaries || 0, icon: '👨‍💼' },
    { label: 'مصاريف المكتب', value: groups.office || 0, icon: '🏢' },
    { label: 'مصاريف القضايا', value: groups.cases || 0, icon: '⚖️' },
    { label: 'مصاريف إدارية', value: groups.admin || 0, icon: '📋' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return empty('مفيش مصاريف الشهر ده', '💸');

  return items.map(r => {
    const percent = (r.value / total) * 100;
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13.5px">
          <span>${r.icon} ${r.label}</span>
          <span style="font-weight:700">${fmtMoney(r.value)} ${cur()}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// Chart: إيرادات vs مصاريف (آخر 6 شهور)
// ============================================================
async function drawMoneyOverviewChart() {
  const ctx = document.getElementById('chart-money-overview');
  if (!ctx) return;

  if (typeof Chart === 'undefined') {
    ctx.parentElement.innerHTML = empty('Chart.js مش محمّل', '📉');
    return;
  }

  try {
    const now = new Date();
    const months = [];
    const revenues = [];
    const expenses = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = localISO(d);
      const to = monthEndISO(d);

      months.push(d.toLocaleDateString('ar-EG-u-nu-latn', { month: 'short' }));

      try {
        const summary = await apiJson(`/api/reports/accounting-summary?from=${from}&to=${to}`);
        revenues.push(summary.revenue || 0);
        expenses.push(summary.expenses || 0);
      } catch {
        revenues.push(0);
        expenses.push(0);
      }
    }

    window.Chart?.getChart?.(ctx)?.destroy();

    moneyCharts.overview = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'إيرادات',
            data: revenues,
            borderColor: '#D4AF37',
            backgroundColor: 'rgba(212, 175, 55, 0.12)',
            fill: true,
          },
          {
            label: 'مصاريف',
            data: expenses,
            borderColor: '#2A3654',
            backgroundColor: 'transparent',
            borderDash: [5, 4],
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'IBM Plex Sans Arabic', size: 12, weight: '600' },
              usePointStyle: true,
              padding: 16,
              boxWidth: 8,
              boxHeight: 8,
            },
          },
          tooltip: {
            backgroundColor: '#0B1222',
            titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
            bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${Number(c.parsed.y).toLocaleString('en-US')} ${cur()}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'IBM Plex Sans Arabic', size: 11 }, color: '#9CA3AF' },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#F3F4F6', drawBorder: false },
            ticks: {
              font: { family: 'IBM Plex Mono', size: 10 },
              color: '#9CA3AF',
              callback: (v) => Number(v).toLocaleString('en-US'),
            },
          },
        },
      },
    });
  } catch (e) {
    console.error('chart error:', e);
    ctx.parentElement.innerHTML = empty('مش قادر يحمّل الـ chart', '📉');
  }
}

// ============================================================
// 2) المصاريف (عام + جلسات + مهام)
// ============================================================
async function renderExpenses(host) {
  const [expenses, accounts] = await Promise.all([
    apiJson('/api/expenses'),
    apiJson('/api/accounts?type=expense'),
  ]);

  const expenseAccounts = accounts.filter(a => a.category === 'expense');
  const now = new Date();
  const monthExpenses = expenses.filter(e => (e.date || '').startsWith(localISO(now).slice(0, 7)));
  const monthTotal = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  host.innerHTML = `
    <div class="card">
      <h3>💸 المصاريف — ${esc(monthName(now))}</h3>
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:32px;font-weight:900;color:var(--danger)">${fmtMoney(monthTotal)} ${cur()}</div>
        <div style="font-size:12px;color:var(--text-soft);margin-top:4px">إجمالي الشهر</div>
      </div>
      <button class="btn btn-primary btn-block" id="add-expense">
        ➕ إضافة مصروف جديد
      </button>
      ${hasFeature('accounting') ? '<button class="btn btn-ghost btn-block" id="payroll-btn" style="margin-top:8px">💼 صرف مرتبات الشهر</button>' : ''}
    </div>

    <div id="expenses-list">
      ${expenses.length ? expenses.map(e => `
        <div class="item">
          <div class="top">
            <span class="name">${esc(e.description)}</span>
            <span class="num mono" style="color:var(--danger);font-weight:700">${fmtMoney(e.amount)} ${cur()}</span>
          </div>
          <div class="meta">
            ${e.source === 'session' ? '⚖️ مصروف جلسة' : e.source === 'task' ? '✅ مصروف مهمة' : (e.case_number ? '📁 مصروف قضية' : '🏢 مصروف عام')}
            · <span class="exp-who ${e.from_trust ? 'client' : e.on_client ? 'client' : 'office'}">${e.from_trust ? 'من أمانة الموكل' : e.on_client ? 'على الموكل' : 'على المكتب'}</span>
            ${e.is_recurring ? ` · 🔁 ${({ monthly: 'شهري', quarterly: 'كل 3 شهور', yearly: 'سنوي' })[e.recurring_frequency] || 'متكرر'}` : ''}
            ${e.account_name ? ' · ' + esc(e.account_name) : ''}
            · 📅 ${esc(e.date || '')}
            ${e.case_number ? ' · 📁 ' + esc(e.case_number) : ''}
          </div>
          <div class="acts">
            ${e.is_recurring ? `<button class="btn btn-ghost" data-stop-recurring="${e.id}">⏹ إيقاف التكرار</button>` : ''}
            <button class="btn btn-ghost" data-del-expense="${e.id}" data-source="${e.source || 'general'}" style="color:var(--danger)">🗑 حذف</button>
          </div>
        </div>
      `).join('') : empty('مفيش مصاريف مسجلة', '💸')}
    </div>
  `;

  host.querySelector('#add-expense').addEventListener('click', async () => {
    let casesList = [];
    try { const cs = await apiJson('/api/cases'); casesList = Array.isArray(cs) ? cs : (cs.items || []); } catch {}
    const accountOpts = expenseAccounts.map(a => ({ value: a.id, label: a.name }));
    const result = await openModal({
      title: '➕ إضافة مصروف',
      submitText: 'حفظ',
      initialData: { expense_date: localISO() },
      fields: [
        { name: 'expense_date', label: '📅 تاريخ المصروف', type: 'date', required: true },
        { name: 'description', label: '📝 وصف المصروف', required: true, placeholder: 'إيجار المكتب - أكتوبر' },
        { name: 'account_id', label: '🗂️ نوع المصروف', type: 'select',
          options: [{ value: '', label: '— اختر النوع —' }, ...accountOpts] },
        { name: 'amount', label: `💰 المبلغ (${cur()})`, type: 'number', required: true, placeholder: '5000' },
        { name: 'payment_method', label: '💳 طريقة الدفع', type: 'datalist',
          placeholder: 'نقدي',
          options: ['نقدي', 'تحويل بنكي', 'شيك', 'فودافون كاش', 'إنستاباي'] },
        { name: 'case_id', label: '📁 القضية (لو المصروف خاص بقضية)', type: 'select', options: [{ value: '', label: '— مصروف عام على المكتب —' }, ...casesList.map(c => ({ value: c.id, label: (c.case_number || 'قضية #' + c.id) + (c.client_name ? ' — ' + c.client_name : '') }))] },
        { name: 'is_reimbursable', label: '👤 مين هيتحمّله؟', type: 'select', options: [{ value: '0', label: 'المكتب (مصروف على المكتب)' }, { value: '1', label: 'الموكل (يتضاف لحسابه وكشف حسابه)' },
          ...(hasFeature('accounting') ? [{ value: '2', label: 'من أمانة الموكل (مقدم المصاريف اللي دفعه)' }] : [])] },
        ...(hasFeature('accounting') ? [{ name: 'recurring_frequency', label: '🔁 يتكرر؟', type: 'select', options: [{ value: '', label: 'لأ، مرة واحدة' }, { value: 'monthly', label: 'كل شهر (إيجار، اشتراكات…)' }, { value: 'quarterly', label: 'كل 3 شهور' }, { value: 'yearly', label: 'كل سنة' }] }] : []),
        { name: 'vendor', label: '🏢 الجهة / المورد', placeholder: 'مالك العقار' },
        { name: 'notes', label: '📝 ملاحظات', type: 'textarea' },
      ],
      onSubmit: async (d) => {
        if ((d.is_reimbursable === '1' || d.is_reimbursable === '2') && !d.case_id) throw new Error('اختار القضية عشان نعرف الموكل');
        await apiJson('/api/expenses', { method: 'POST', body: JSON.stringify({ ...d, case_id: d.case_id || null,
          is_reimbursable: d.is_reimbursable === '1' ? 1 : 0, paid_from_trust: d.is_reimbursable === '2' ? 1 : 0,
          is_recurring: d.recurring_frequency ? 1 : 0, recurring_frequency: d.recurring_frequency || null }) });
      },
    });
    if (result) { toast('اتحفظ ✓', 'ok'); render(host, { subView: 'money-expenses' }); }
  });

  host.querySelectorAll('[data-stop-recurring]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('توقف تكرار المصروف ده؟ (اللي اتسجل قبل كده هيفضل)')) return;
    try { await apiJson(`/api/expenses/${b.dataset.stopRecurring}`, { method: 'PATCH', body: JSON.stringify({ is_recurring: 0 }) }); toast('اتوقف التكرار', 'ok'); render(host, { subView: 'money-expenses' }); }
    catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  }));
  host.querySelector('#payroll-btn')?.addEventListener('click', () => openPayroll(() => render(host, { subView: 'money-expenses' })));

  host.querySelectorAll('[data-del-expense]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('متأكد من الحذف؟')) return;
    const id = b.dataset.delExpense;
    const source = b.dataset.source || 'general';
    await apiJson(`/api/expenses/${id}?source=${source}`, { method: 'DELETE' });
    toast('اتحذف', 'ok');
    render(host, { subView: 'money-expenses' });
  }));
}

// ============================================================
// 3) الإيرادات
// ============================================================
async function renderIncome(host) {
  const now = new Date();
  const from = monthStartISO(now);
  const to = localISO(now);

  const pl = hasFeature('accounting')
    ? await apiJson(`/api/reports/profit-loss?from=${from}&to=${to}`).catch(() => ({ revenues: [] }))
    : { revenues: [], hidden: true };
  const payments = await apiJson('/api/payments');

  const monthPayments = payments.filter(p => p.payment_date?.startsWith(localISO(now).slice(0, 7)));
  const monthTotal = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);

  host.innerHTML = `
    <div class="card">
      <h3>💰 اللي اتحصّل فعلاً — ${esc(monthName(now))}</h3>
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:32px;font-weight:900;color:var(--success)">${fmtMoney(monthTotal)} ${cur()}</div>
        <div style="font-size:12px;color:var(--text-soft);margin-top:4px">إجمالي الشهر</div>
      </div>
    </div>

    ${pl.hidden ? '' : `<div class="card">
      <h3>📊 الأتعاب والإيرادات المسجلة</h3>
      <div class="meta" style="margin:-4px 0 8px">ده إجمالي اللي اتفقت عليه أو فوترته الشهر ده — مش كله اتحصّل. اللي اتحصّل فعلاً فوق.</div>
      ${pl.revenues.length ? pl.revenues.map(r => `
        <div class="report-row">
          <span>💵 ${esc(r.name)}</span>
          <span style="color:var(--success);font-weight:700">${fmtMoney(r.amount)} ${cur()}</span>
        </div>
      `).join('') : empty('مفيش إيرادات الشهر ده', '💰')}
    </div>`}

    <div class="card">
      <h3>📋 آخر التحصيلات</h3>
      ${monthPayments.length ? monthPayments.slice(0, 20).map(p => `
        <div class="item">
          <div class="top">
            <span class="name">${esc(p.client_name || 'موكل')}</span>
            <span class="num mono" style="color:var(--success);font-weight:700">${fmtMoney(p.amount)} ${cur()}</span>
          </div>
          <div class="meta">📅 ${esc(p.payment_date)}${p.method ? ' · 💳 ' + esc(p.method) : ''}</div>
        </div>
      `).join('') : empty('مفيش تحصيلات الشهر ده', '📋')}
    </div>
  `;
}

// ============================================================
// 4) التقارير المبسّطة
// ============================================================
async function renderSimpleReports(host) {
  const now = new Date();
  const from = monthStartISO(now);
  const to = localISO(now);

  const [summary, pl] = await Promise.all([
    apiJson(`/api/reports/accounting-summary?from=${from}&to=${to}`),
    apiJson(`/api/reports/profit-loss?from=${from}&to=${to}`),
  ]);

  const isProfit = summary.is_profit;

  host.innerHTML = `
    <div class="card">
      <h3>📈 التقارير المبسّطة — ${esc(monthName(now))}</h3>
    </div>

    <div class="card" style="background:${isProfit ? 'var(--success-50)' : 'var(--danger-50)'}">
      <h3>${isProfit ? '✅ ربح' : '⚠️ خسارة'}</h3>
      <div style="font-size:32px;font-weight:900;color:${isProfit ? 'var(--success)' : 'var(--danger)'};text-align:center;margin:14px 0">
        ${fmtMoney(Math.abs(summary.net_profit))} ${cur()}
      </div>
      <p style="font-size:13px;text-align:center;color:var(--text-soft);margin:0">
        ${isProfit ? 'مبروك! الشهر ده ربحان' : 'للأسف، الشهر ده خسران'}
      </p>
    </div>

    <div class="card">
      <h3>📊 ملخص الشهر</h3>
      <div class="report-row">
        <span>💰 إجمالي الدخل</span>
        <span style="color:var(--success);font-weight:700">+${fmtMoney(summary.revenue)} ${cur()}</span>
      </div>
      <div class="report-row">
        <span>💸 إجمالي المصاريف</span>
        <span style="color:var(--danger);font-weight:700">-${fmtMoney(summary.expenses)} ${cur()}</span>
      </div>
      <div class="report-row total">
        <span>صافي الربح</span>
        <span style="color:${isProfit ? 'var(--success)' : 'var(--danger)'}">
          ${isProfit ? '+' : '-'}${fmtMoney(Math.abs(summary.net_profit))} ${cur()}
        </span>
      </div>
    </div>

    <div class="card">
      <h3>💵 الوضع الحالي</h3>
      <div class="report-row">
        <span>💵 النقدية في الصندوق</span>
        <span style="font-weight:700">${fmtMoney(summary.cash_balance)} ${cur()}</span>
      </div>
      <div class="report-row">
        <span>🏦 البنك</span>
        <span style="font-weight:700">${fmtMoney(summary.bank_balance)} ${cur()}</span>
      </div>
      <div class="report-row total">
        <span>إجمالي السيولة</span>
        <span>${fmtMoney(summary.cash_balance + summary.bank_balance)} ${cur()}</span>
      </div>
    </div>

    <div class="card">
      <h3>💸 توزيع المصاريف</h3>
      ${renderExpenseBreakdown(pl.expense_groups)}
    </div>
  `;
}

// ============================================================
// 5) الفواتير (مع فلاتر متقدمة)
// ============================================================
async function renderInvoices(host) {
  // حالة الفلاتر الحالية
  let currentFilters = {
    status: '',
    client_id: '',
    from: '',
    to: '',
    search: '',
  };

  const loadAndRender = async () => {
    // Skeleton احترافي
    host.innerHTML = `
      <div class="card">${skeleton(4, 'card')}</div>
      <div class="card">${skeleton(5, 'list')}</div>
    `;

    // بناء الـ query string
    const params = new URLSearchParams();
    Object.entries(currentFilters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    const qs = params.toString();
    const query = qs ? `?${qs}` : '';

    // جلب البيانات من الـ API
    const [invoices, stats, clients, cases] = await Promise.all([
      apiJson(`/api/invoices${query}`),
      apiJson(`/api/invoices/stats`),
      apiJson('/api/clients').catch(() => []),
      apiJson('/api/cases').catch(() => []),
    ]);

    host.innerHTML = `
      <div class="stats">
        <div class="stat">
          <div class="l">إجمالي الفواتير</div>
          <div class="n">${fmtMoney(stats.totals?.total_amount || 0)}</div>
        </div>
        <div class="stat">
          <div class="l">المحصّل</div>
          <div class="n success">${fmtMoney(stats.totals?.paid_amount || 0)}</div>
        </div>
        <div class="stat">
          <div class="l">المتبقي</div>
          <div class="n danger">${fmtMoney(stats.remaining || 0)}</div>
        </div>
        <div class="stat">
          <div class="l">عدد الفواتير</div>
          <div class="n primary">${stats.totals?.total_invoices || 0}</div>
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <h3>📄 الفواتير</h3>
          <button class="btn btn-primary" id="new-invoice">+ فاتورة جديدة</button>
        </div>

        <!-- شريط الفلاتر المتقدم -->
        <div class="filter-bar" style="margin-top:12px">
          <div class="filter-bar-inner">
            <div class="filter-item">
              <input type="text" class="filter-input" id="filter-search" 
                     placeholder="🔍 ابحث برقم الفاتورة أو اسم الموكل..." 
                     value="${esc(currentFilters.search)}">
            </div>
            <div class="filter-item">
              <select class="filter-input" id="filter-client">
                <option value="">كل الموكلين</option>
                ${clients.map(c => `
                  <option value="${c.id}" ${String(currentFilters.client_id) === String(c.id) ? 'selected' : ''}>
                    ${esc(c.name)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="filter-item">
              <label class="filter-label">من تاريخ</label>
              <input type="date" class="filter-input" id="filter-from" 
                     value="${esc(currentFilters.from)}">
            </div>
            <div class="filter-item">
              <label class="filter-label">إلى تاريخ</label>
              <input type="date" class="filter-input" id="filter-to" 
                     value="${esc(currentFilters.to)}">
            </div>
            <button class="btn btn-ghost filter-reset" id="filter-reset">🔄 مسح</button>
          </div>
        </div>

        <!-- تبويبات سريعة -->
        <div class="filter-tabs" style="margin-top:12px">
          <button data-status="" class="${currentFilters.status === '' ? 'active' : ''}">الكل</button>
          <button data-status="مسودة" class="${currentFilters.status === 'مسودة' ? 'active' : ''}">مسودة</button>
          <button data-status="مرسلة" class="${currentFilters.status === 'مرسلة' ? 'active' : ''}">مرسلة</button>
          <button data-status="مدفوعة" class="${currentFilters.status === 'مدفوعة' ? 'active' : ''}">مدفوعة</button>
          <button data-status="متأخرة" class="${currentFilters.status === 'متأخرة' ? 'active' : ''}">متأخرة</button>
        </div>
      </div>

      <div id="invoices-list">
        ${invoices.length 
          ? invoices.map(inv => renderInvoiceItem(inv)).join('') 
          : empty(
              Object.values(currentFilters).some(v => v)
                ? 'مفيش نتايج مطابقة للفلاتر'
                : 'مفيش فواتير لحد الآن', 
              '📄', 
              !Object.values(currentFilters).some(v => v)
                ? { text: '+ إضافة أول فاتورة', onClick: () => document.getElementById('new-invoice')?.click() }
                : null
            )
        }
      </div>
    `;

    // === ربط أحداث الفلاتر ===

    // بحث نصي (Debounce)
    let searchTimeout;
    host.querySelector('#filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        loadAndRender();
      }, 500);
    });

    // فلترة بالموكل
    host.querySelector('#filter-client')?.addEventListener('change', (e) => {
      currentFilters.client_id = e.target.value;
      loadAndRender();
    });

    // فلترة بتاريخ
    host.querySelector('#filter-from')?.addEventListener('change', (e) => {
      currentFilters.from = e.target.value;
      loadAndRender();
    });
    host.querySelector('#filter-to')?.addEventListener('change', (e) => {
      currentFilters.to = e.target.value;
      loadAndRender();
    });

    // مسح الفلاتر
    host.querySelector('#filter-reset')?.addEventListener('click', () => {
      currentFilters = { status: '', client_id: '', from: '', to: '', search: '' };
      loadAndRender();
    });

    // التبويبات السريعة (الحالة)
    host.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => {
      currentFilters.status = b.dataset.status;
      loadAndRender();
    }));

    // === الأحداث القديمة ===
    host.querySelector('#new-invoice').addEventListener('click', () => {
      openInvoiceModal(host, clients, cases, loadAndRender);
    });

    host.querySelectorAll('[data-open-invoice]').forEach(b => b.addEventListener('click', async () => {
      const { showInvoiceDetail } = await import('./invoice-detail.js');
      showInvoiceDetail(b.dataset.openInvoice, loadAndRender);
    }));

    host.querySelectorAll('[data-del-invoice]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('متأكد من حذف الفاتورة؟')) return;
      try {
        await apiJson(`/api/invoices/${b.dataset.delInvoice}`, { method: 'DELETE' });
        toast('اتحذفت', 'ok');
        loadAndRender();
      } catch (err) {
        toast('فشل الحذف: ' + err.message, 'bad');
      }
    }));
  };

  await loadAndRender();
}

function renderInvoiceItem(inv) {
  const statusColors = {
    'مسودة': 'trial',
    'مرسلة': 'active',
    'مدفوعة': 'active',
    'متأخرة': 'suspended',
  };
  const badge = statusColors[inv.status] || 'trial';
  const remaining = (inv.total || 0) - (inv.paid_amount || 0);

  return `
    <div class="item" data-open-invoice="${inv.id}" style="cursor:pointer">
      <div class="top">
        <span class="name">${esc(inv.invoice_number)}</span>
        <span class="badge ${badge}">${esc(inv.status)}</span>
      </div>
      <div class="meta">
        ${esc(inv.client_name || '— بدون موكل —')}
        ${inv.case_number ? ' · ' + esc(inv.case_number) : ''}
        · 📅 ${esc(inv.issue_date)}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;align-items:center">
        <span style="font-weight:900;font-size:16px;color:var(--primary)">${fmtMoney(inv.total)} ${cur()}</span>
        ${remaining > 0 ? `<span style="font-size:12px;color:var(--danger)">متبقي: ${fmtMoney(remaining)} ${cur()}</span>` : '<span style="font-size:12px;color:var(--success)">✅ مدفوعة</span>'}
      </div>
      <div class="acts" onclick="event.stopPropagation()">
        <button class="btn btn-ghost" data-del-invoice="${inv.id}" style="color:var(--danger);font-size:11px;padding:4px 8px">🗑 حذف</button>
      </div>
    </div>
  `;
}

// ============================================================
// Modal إنشاء فاتورة
// ============================================================
function openInvoiceModal(host, clients, cases, onDone) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';

  const lines = [{ description: '', quantity: 1, rate: 0 }];

  const renderLines = () => `
    <div id="lines-container">
      ${lines.map((l, i) => `
        <div style="background:var(--gray-50);padding:12px;border-radius:var(--radius);margin-bottom:8px;border:1px solid var(--border-soft)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:13px">بند ${i + 1}</strong>
            ${lines.length > 1 ? `<button type="button" class="btn btn-ghost" data-remove-line="${i}" style="color:var(--danger);font-size:11px;padding:4px 8px">حذف</button>` : ''}
          </div>
          <label class="label">الوصف</label>
          <input class="input" type="text" data-line-desc="${i}" value="${esc(l.description)}" placeholder="أتعاب قضية 1234" required>
          <div style="display:flex;gap:8px;margin-top:8px">
            <div style="flex:1">
              <label class="label">الكمية</label>
              <input class="input" type="number" data-line-qty="${i}" value="${l.quantity}" min="1" step="1">
            </div>
            <div style="flex:2">
              <label class="label">السعر</label>
              <input class="input" type="number" data-line-rate="${i}" value="${l.rate}" min="0" step="0.01" placeholder="0">
            </div>
            <div style="flex:1">
              <label class="label">الإجمالي</label>
              <input class="input" type="text" data-line-amount="${i}" value="${fmtMoney((l.quantity || 0) * (l.rate || 0))}" readonly style="background:var(--gray-100)">
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <button type="button" class="btn btn-ghost btn-block" id="add-line" style="margin-top:8px">+ إضافة بند</button>
  `;

  const updateTotals = () => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.rate || 0)), 0);
    const taxRate = parseFloat(backdrop.querySelector('#tax-rate')?.value || 0);
    const discount = parseFloat(backdrop.querySelector('#discount')?.value || 0);
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const total = subtotal - discount + taxAmount;

    backdrop.querySelector('#sum-subtotal').textContent = fmtMoney(subtotal) + ' ' + cur();
    backdrop.querySelector('#sum-tax').textContent = fmtMoney(taxAmount) + ' ' + cur();
    backdrop.querySelector('#sum-total').textContent = fmtMoney(total) + ' ' + cur();

    lines.forEach((l, i) => {
      const amountEl = backdrop.querySelector(`[data-line-amount="${i}"]`);
      if (amountEl) amountEl.value = fmtMoney((Number(l.quantity || 0) * Number(l.rate || 0)));
    });
  };

  const clientOpts = clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  backdrop.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="modal-header">
        <h3>📄 فاتورة جديدة</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label class="label">📅 تاريخ الإصدار *</label>
            <input class="input" type="date" id="issue-date" value="${localISO()}" required>
          </div>
          <div>
            <label class="label">📅 تاريخ الاستحقاق</label>
            <input class="input" type="date" id="due-date">
          </div>
        </div>

        <label class="label" style="margin-top:12px">👤 الموكل *</label>
        <select class="select" id="client-id" required>
          <option value="">— اختر الموكل —</option>
          ${clientOpts}
        </select>

        <label class="label" style="margin-top:12px">📁 القضية (اختياري)</label>
        <select class="select" id="case-id">
          <option value="">— بدون قضية —</option>
        </select>

        <div class="inv-fee-link" id="fee-link-box" hidden>
          <label class="label" style="margin-top:12px">🔗 الفاتورة دي عن أتعاب متسجلة؟</label>
          <select class="select" id="fee-id">
            <option value="">— لأ، فاتورة لشغل جديد —</option>
          </select>
          <div class="meta" style="margin-top:6px;line-height:1.7">لو اخترت الأتعاب، الفاتورة بتتربط بيها: الإيراد ميتحسبش مرتين، وأي دفعة على الأتعاب أو الفاتورة بتظهر في الاتنين.</div>
        </div>

        <div style="margin-top:16px">
          <h4 style="font-size:14px;margin:0 0 10px">📋 البنود</h4>
          ${renderLines()}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">
          <div>
            <label class="label">💰 نسبة الضريبة %</label>
            <input class="input" type="number" id="tax-rate" value="${defaultVat()}" min="0" max="100" step="0.01">
          </div>
          <div>
            <label class="label">🏷️ الخصم (${cur()})</label>
            <input class="input" type="number" id="discount" value="0" min="0" step="0.01">
          </div>
        </div>

        <label class="label" style="margin-top:12px">📝 ملاحظات</label>
        <textarea class="textarea" id="notes" rows="2" placeholder="ملاحظات تظهر على الفاتورة"></textarea>

        <label class="label" style="margin-top:12px">📋 شروط السداد</label>
        <input class="input" type="text" id="terms" placeholder="السداد خلال 30 يوم" value="السداد خلال 30 يوم">

        <div style="background:var(--gray-50);padding:16px;border-radius:var(--radius);margin-top:16px;border:1px solid var(--border-soft)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
            <span>المجموع الفرعي</span>
            <span id="sum-subtotal">0 ج</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
            <span>الضريبة</span>
            <span id="sum-tax">0 ج</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:2px solid var(--primary);font-weight:900;font-size:16px">
            <span>الإجمالي</span>
            <span id="sum-total" style="color:var(--primary)">0 ج</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancel-btn">إلغاء</button>
        <button class="btn btn-primary" id="save-btn">حفظ الفاتورة</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 200);
  };

  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('#cancel-btn').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  const updateCases = () => {
    const clientId = backdrop.querySelector('#client-id').value;
    const caseSelect = backdrop.querySelector('#case-id');
    const filtered = clientId ? cases.filter(c => String(c.client_id) === String(clientId)) : [];
    caseSelect.innerHTML = '<option value="">— بدون قضية —</option>' +
      filtered.map(c => `<option value="${c.id}">${esc(c.case_number || 'قضية #' + c.id)} — ${esc(c.court || '')}</option>`).join('');
  };
  backdrop.querySelector('#client-id').addEventListener('change', () => { updateCases(); updateFees(); });

  // الأتعاب المتسجلة للموكل (والقضية لو اختارها) — للربط
  let feesCache = null;
  const updateFees = async () => {
    const box = backdrop.querySelector('#fee-link-box');
    const sel = backdrop.querySelector('#fee-id');
    const clientId = backdrop.querySelector('#client-id').value;
    const caseId = backdrop.querySelector('#case-id').value;
    if (!clientId) { box.hidden = true; sel.value = ''; return; }
    if (!feesCache) {
      try { const r = await apiJson('/api/fees', { skipCache: true }); feesCache = Array.isArray(r) ? r : (r.items || []); } catch { feesCache = []; }
    }
    const list = feesCache.filter(f => String(f.client_id) === String(clientId) && (!caseId || String(f.case_id) === String(caseId)));
    box.hidden = !list.length;
    sel.innerHTML = '<option value="">— لأ، فاتورة لشغل جديد —</option>' + list.map(f =>
      `<option value="${f.id}">${esc(f.case_number ? 'قضية ' + f.case_number : (f.notes || 'أتعاب #' + f.id))} — ${fmtMoney(f.amount_due)} ${cur()}${f.amount_paid ? ' (اتدفع ' + fmtMoney(f.amount_paid) + ')' : ''}</option>`).join('');
  };
  backdrop.querySelector('#case-id').addEventListener('change', updateFees);
  backdrop.querySelector('#fee-id').addEventListener('change', () => {
    const f = (feesCache || []).find(x => String(x.id) === backdrop.querySelector('#fee-id').value);
    if (!f) return;
    // البند = الأتعاب
    lines.splice(0, lines.length, { description: f.case_number ? `أتعاب قضية ${f.case_number}` : (f.notes || 'أتعاب'), quantity: 1, rate: Number(f.amount_due) || 0 });
    if (f.case_id) backdrop.querySelector('#case-id').value = String(f.case_id);
    backdrop.querySelector('#lines-container').outerHTML = renderLines();
    bindLineEvents(); rebindAddLine(); updateTotals();
  });

  const bindLineEvents = () => {
    backdrop.querySelectorAll('[data-line-desc]').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = parseInt(inp.dataset.lineDesc);
        lines[i].description = inp.value;
      });
    });
    backdrop.querySelectorAll('[data-line-qty]').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = parseInt(inp.dataset.lineQty);
        lines[i].quantity = parseFloat(inp.value) || 0;
        updateTotals();
      });
    });
    backdrop.querySelectorAll('[data-line-rate]').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = parseInt(inp.dataset.lineRate);
        lines[i].rate = parseFloat(inp.value) || 0;
        updateTotals();
      });
    });
    backdrop.querySelectorAll('[data-remove-line]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.removeLine);
        lines.splice(i, 1);
        backdrop.querySelector('#lines-container').outerHTML = renderLines();
        bindLineEvents();
        rebindAddLine();
        updateTotals();
      });
    });
  };

  const rebindAddLine = () => {
    backdrop.querySelector('#add-line')?.addEventListener('click', () => {
      lines.push({ description: '', quantity: 1, rate: 0 });
      backdrop.querySelector('#lines-container').outerHTML = renderLines();
      bindLineEvents();
      rebindAddLine();
      updateTotals();
    });
  };

  bindLineEvents();
  rebindAddLine();

  backdrop.querySelector('#tax-rate').addEventListener('input', updateTotals);
  backdrop.querySelector('#discount').addEventListener('input', updateTotals);

  backdrop.querySelector('#save-btn').addEventListener('click', async () => {
    const issueDate = backdrop.querySelector('#issue-date').value;
    const clientId = backdrop.querySelector('#client-id').value;
    if (!issueDate) return alert('اكتب تاريخ الإصدار');
    if (!clientId) return alert('اختر الموكل');

    const validLines = lines
      .filter(l => l.description && (l.quantity > 0) && (l.rate >= 0))
      .map(l => ({
        description: l.description,
        quantity: Number(l.quantity) || 1,
        rate: Number(l.rate) || 0,
        amount: (Number(l.quantity) || 1) * (Number(l.rate) || 0),
      }));

    if (validLines.length === 0) return alert('لازم يكون فيه بند واحد على الأقل بوصف وسعر');

    const body = {
      issue_date: issueDate,
      due_date: backdrop.querySelector('#due-date').value || null,
      client_id: clientId,
      case_id: backdrop.querySelector('#case-id').value || null,
      fee_id: backdrop.querySelector('#fee-id').value || null,
      tax_rate: parseFloat(backdrop.querySelector('#tax-rate').value) || 0,
      discount: parseFloat(backdrop.querySelector('#discount').value) || 0,
      notes: backdrop.querySelector('#notes').value.trim() || null,
      terms: backdrop.querySelector('#terms').value.trim() || null,
      lines: validLines,
    };

    try {
      const r = await apiJson('/api/invoices', { method: 'POST', body: JSON.stringify(body) });
      toast(`الفاتورة ${r.invoice_number} اتحفظت ✓`, 'ok');
      close();
      onDone && onDone();
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  });

  updateTotals();
} 


// ============================================================
// صرف مرتبات الشهر (من بيانات المحامين)
// ============================================================
async function openPayroll(onDone) {
  const month = localISO().slice(0, 7);
  let p;
  try { p = await apiJson(`/api/expenses/payroll?month=${month}`, { skipCache: true }); }
  catch (e) { return toast('⚠️ ' + e.message, 'bad'); }
  const due = p.lawyers.filter(l => !l.already_paid);
  const total = due.reduce((s, l) => s + l.salary, 0);
  document.getElementById('payroll-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'payroll-modal';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal-card" style="max-width:480px;width:calc(100vw - 32px)" role="dialog" aria-modal="true">
      <div class="st-head"><h3 style="margin:0">💼 مرتبات ${esc(month)}</h3><button class="icon-btn" data-pr="close" aria-label="إغلاق">✕</button></div>
      ${p.lawyers.length ? `
        <div class="st-table-wrap" style="max-height:45vh"><table class="st-table"><thead><tr><th>المحامي</th><th>المرتب</th><th></th></tr></thead><tbody>
          ${p.lawyers.map(l => `<tr><td>${esc(l.name)}</td><td class="mono">${fmtMoney(l.salary)}</td><td>${l.already_paid ? '<span class="meta">✓ اتصرف</span>' : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
          <label class="meta">اتصرفت إزاي:</label>
          <select id="pr-method" class="input" style="width:auto"><option>تحويل بنكي</option><option>نقدي</option><option>إنستاباي</option><option>فودافون كاش</option></select>
        </div>
        <div class="st-actions">
          ${due.length ? `<button class="btn btn-primary" data-pr="run">صرف ${due.length} مرتب — ${fmtMoney(total)} ${cur()}</button>` : '<span class="meta">كل مرتبات الشهر ده اتصرفت ✓</span>'}
        </div>` : '<div class="empty">مفيش محامين ليهم مرتب — ضيف المرتب من صفحة المحامين</div>'}
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-pr]')?.dataset.pr;
    if (e.target === m || a === 'close') return m.remove();
    if (a === 'run') {
      try {
        const r = await apiJson('/api/expenses/payroll', { method: 'POST', body: JSON.stringify({ month, method: m.querySelector('#pr-method').value }) });
        toast(`✓ اتسجل ${r.created} مرتب (${fmtMoney(r.total)} ${cur()})`, 'ok');
        m.remove(); onDone?.();
      } catch (err) { toast('⚠️ ' + err.message, 'bad'); }
    }
  });
}
