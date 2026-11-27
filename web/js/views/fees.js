// web/js/views/fees.js
import { apiJson } from '../api.js';
import { esc, empty, toast, fmtMoney, skeleton, cur, curName, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { openModal } from '../modal.js';
import { openWhatsAppComposer } from '../whatsapp.js';
import { editFee, canEditFee } from '../fee-edit.js';
import { getClients, getCases } from '../state.js';
import { mountExportMenu, filterMeta } from '../exporter.js';

let charts = {};
let currentFilters = {
  search: '',
  status: '',
  from: '',
  to: '',
};

export async function render(host) {
  // تدمير الرسوم القديمة
  Object.values(charts).forEach(c => c?.destroy?.());
  charts = {};

  const loadAndRender = async () => {
    // Skeleton احترافي
    host.innerHTML = `
      <div class="card">${skeleton(4, 'card')}</div>
      <div class="card">${skeleton(1, 'chart')}</div>
    `;

    // بناء الـ query
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.from)   params.append('from', currentFilters.from);
    if (currentFilters.to)     params.append('to', currentFilters.to);
    const qs = params.toString();
    const query = qs ? `?${qs}` : '';

    let fees, payments, stats, clients, cases;
    try {
      [fees, payments, stats, clients, cases] = await Promise.all([
        apiJson(`/api/fees${query}`),
        apiJson('/api/payments'),
        apiJson('/api/payments/stats'),
        getClients().length ? Promise.resolve(getClients()) : apiJson('/api/clients'),
        getCases().length ? Promise.resolve(getCases()) : apiJson('/api/cases'),
      ]);
    } catch (e) {
      host.innerHTML = `<div class="card">${empty('خطأ: ' + e.message, '⚠️')}</div>`;
      return;
    }

    // الإحصائيات من البيانات المفلترة (كل الفواتير مش المفلترة — للزرار "الكل" بنجيبها كده)
    // لكن بنعمل حساب الإحصائيات من الـ fees اللي راجعة
    const totalDue = fees.reduce((s, f) => s + (f.amount_due || 0), 0);
    const totalPaid = fees.reduce((s, f) => s + (f.amount_paid || 0), 0);
    const totalRemaining = totalDue - totalPaid;
    const collectedThisMonth = stats.totals?.total_collected || 0;

    const paidFees = fees.filter(f => f.status === 'مدفوع بالكامل');
    const pendingFees = fees.filter(f => f.status !== 'مدفوع بالكامل');
    const lateFees = pendingFees.filter(f => f.due_date && new Date(f.due_date) < new Date());

    host.innerHTML = `
      <!-- Welcome Hero -->
      <div class="welcome-hero">
        <div>
          <div class="welcome-label">💰 التحصيل</div>
          <div class="welcome-title">${fmtMoney(totalPaid)} ${cur()}</div>
          <div class="welcome-sub">من إجمالي ${fmtMoney(totalDue)} ${cur()}</div>
        </div>
        <div class="welcome-badge">
          <div class="badge-label">المتبقي</div>
          <div class="badge-value">${fmtMoney(totalRemaining)} ${cur()}</div>
        </div>
      </div>

      <!-- الإحصائيات -->
      <div class="stats">
        <div class="stat">
          <div class="l">💰 إجمالي الأتعاب</div>
          <div class="n">${fmtMoney(totalDue)}</div>
        </div>
        <div class="stat">
          <div class="l">✅ المحصّل</div>
          <div class="n success">${fmtMoney(totalPaid)}</div>
        </div>
        <div class="stat">
          <div class="l">⏳ المتبقي</div>
          <div class="n danger">${fmtMoney(totalRemaining)}</div>
        </div>
        <div class="stat">
          <div class="l">📅 تحصيل الشهر</div>
          <div class="n primary">${fmtMoney(collectedThisMonth)}</div>
        </div>
      </div>

      <!-- Chart: حالة الأتعاب -->
      <div class="charts-grid">
        <div class="chart-card">
          <h3>📊 حالة الأتعاب</h3>
          <div class="chart-wrapper sm">
            <canvas id="chart-fees-status"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3>💵 التحصيل الشهري</h3>
          <div class="chart-wrapper sm">
            <canvas id="chart-collection"></canvas>
          </div>
        </div>
      </div>

      <!-- الفلاتر -->
      <div class="card">
        <div class="section-header">
          <h3>💰 الأتعاب (${fees.length})</h3>
          <div style="display:flex;gap:8px;align-items:center">
            <div id="fees-export"></div>
            <button class="btn btn-primary" id="add-fee">+ أتعاب جديدة</button>
          </div>
        </div>

        <div class="filter-bar" style="margin-top:12px">
          <div class="filter-bar-inner">
            <div class="filter-item">
              <input type="text" class="filter-input" id="filter-search" 
                     placeholder="🔍 بحث بالاسم أو الملاحظات..." 
                     value="${esc(currentFilters.search)}">
            </div>
            <div class="filter-item">
              <select class="filter-input" id="filter-status">
                <option value="">كل الحالات</option>
                <option value="pending" ${currentFilters.status === 'pending' ? 'selected' : ''}>⏳ مستحق (${pendingFees.length})</option>
                <option value="late"    ${currentFilters.status === 'late' ? 'selected' : ''}>⚠️ متأخر (${lateFees.length})</option>
                <option value="paid"    ${currentFilters.status === 'paid' ? 'selected' : ''}>✅ مدفوع (${paidFees.length})</option>
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
      </div>

      <!-- قايمة الأتعاب -->
      <div id="fees-list">
        ${fees.length 
          ? fees.map(f => renderFeeItem(f)).join('') 
          : empty(
              Object.values(currentFilters).some(v => v)
                ? 'مفيش نتايج مطابقة للفلاتر'
                : 'مفيش أتعاب',
              '💰',
              !Object.values(currentFilters).some(v => v)
                ? { text: '+ إضافة أول أتعاب', onClick: () => document.getElementById('add-fee')?.click() }
                : null
            )
        }
      </div>

      <!-- آخر الدفعات -->
      <div class="card">
        <div class="section-header">
          <h3>💳 آخر الدفعات</h3>
          <button class="btn btn-ghost" id="view-all-payments">عرض الكل</button>
        </div>
        <div id="payments-list">
          ${payments.length
            ? payments.slice(0, 5).map(p => renderPaymentItem(p)).join('')
            : empty('مفيش دفعات مسجلة', '💳')}
        </div>
      </div>
    `;

    // === التصدير (الأتعاب بعد الفلترة + إجمالي) ===
    mountExportMenu(host.querySelector('#fees-export'), () => ({
      title: 'كشف الأتعاب',
      landscape: true,
      meta: filterMeta([
        ['بحث', currentFilters.search],
        ['الحالة', { pending: 'مستحق', late: 'متأخر', paid: 'مدفوع' }[currentFilters.status]],
        ['من', currentFilters.from], ['إلى', currentFilters.to],
      ]),
      blocks: [
        { type: 'kv', heading: 'الملخص', pairs: [
          ['إجمالي الأتعاب', totalDue, 'money'],
          ['المحصّل', totalPaid, 'money'],
          ['المتبقي', totalRemaining, 'money'],
        ] },
        { type: 'table', heading: 'التفاصيل',
          columns: [
            { label: 'الموكل / البيان', value: f => f.client_name || f.notes || `أتعاب #${f.id}` },
            { label: 'القضية', value: f => (cases || []).find(c => c.id === f.case_id)?.case_number || '' },
            { label: 'الإجمالي', key: 'amount_due', type: 'money' },
            { label: 'المدفوع', key: 'amount_paid', type: 'money' },
            { label: 'المتبقي', key: 'remaining', type: 'money', value: f => (f.amount_due || 0) - (f.amount_paid || 0) },
            { label: 'تاريخ الاستحقاق', key: 'due_date', type: 'date' },
            { label: 'الحالة', key: 'status' },
          ],
          rows: fees,
          totals: { amount_due: totalDue, amount_paid: totalPaid, remaining: totalRemaining },
        },
      ],
    }), { filename: 'الأتعاب' });

    // === ربط أحداث الفلاتر ===
    let searchTimeout;
    host.querySelector('#filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        loadAndRender();
      }, 500);
    });

    host.querySelector('#filter-status')?.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      loadAndRender();
    });

    host.querySelector('#filter-from')?.addEventListener('change', (e) => {
      currentFilters.from = e.target.value;
      loadAndRender();
    });
    host.querySelector('#filter-to')?.addEventListener('change', (e) => {
      currentFilters.to = e.target.value;
      loadAndRender();
    });

    host.querySelector('#filter-reset')?.addEventListener('click', () => {
      currentFilters = { search: '', status: '', from: '', to: '' };
      loadAndRender();
    });

    // === الأحداث القديمة ===
    host.querySelector('#add-fee')?.addEventListener('click', () => openAddFeeModal(host, clients, cases, loadAndRender));

    host.querySelector('#view-all-payments')?.addEventListener('click', () => {
      renderAllPayments(host, payments);
    });

    attachFeeEvents(host, fees, loadAndRender);
    attachPaymentEvents(host, payments);

    // رسم الرسوم
    setTimeout(() => {
      drawFeesStatusChart(paidFees.length, pendingFees.length, lateFees.length);
      drawCollectionChart(stats.daily || []);
    }, 100);
  };

  await loadAndRender();
}

// ============================================================
// رسم حالة الأتعاب (Doughnut)
// ============================================================
function drawFeesStatusChart(paid, pending, late) {
  const ctx = document.getElementById('chart-fees-status');
  if (!ctx) return;

  const total = paid + pending + late;
  if (total === 0) {
    ctx.parentElement.innerHTML = '<div class="empty">مفيش أتعاب</div>';
    return;
  }

  window.Chart?.getChart?.(ctx)?.destroy();

  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['مدفوع', 'مستحق', 'متأخر'],
      datasets: [{
        data: [paid, pending - late, late],
        backgroundColor: ['#12B76A', '#D4AF37', '#F04438'],
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
          backgroundColor: '#0B1222',
          titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
          bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
          padding: 12,
          cornerRadius: 8,
        },
      },
    },
  });
}

// ============================================================
// رسم التحصيل الشهري (Line)
// ============================================================
function drawCollectionChart(daily) {
  const ctx = document.getElementById('chart-collection');
  if (!ctx) return;

  if (!daily.length) {
    ctx.parentElement.innerHTML = '<div class="empty">مفيش تحصيلات</div>';
    return;
  }

  const data = daily.slice(0, 15).reverse();

  window.Chart?.getChart?.(ctx)?.destroy();

  charts.collection = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.payment_date?.slice(5) || ''),
      datasets: [{
        label: 'التحصيل',
        data: data.map(d => d.total),
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0B1222',
          titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
          bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (c) => ` ${Number(c.parsed.y).toLocaleString('en-US')} ${cur()}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'IBM Plex Mono', size: 10 },
            color: '#9CA3AF',
          },
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
}

// ============================================================
// عنصر أتعاب
// ============================================================
function renderFeeItem(f) {
  const remaining = (f.amount_due || 0) - (f.amount_paid || 0);
  const isLate = f.status !== 'مدفوع بالكامل' && f.due_date && new Date(f.due_date) < new Date();
  const percent = f.amount_due ? Math.min(100, Math.round((f.amount_paid / f.amount_due) * 100)) : 0;

  return `
    <div class="item">
      <div class="top">
        <span class="name">${esc(f.client_name || f.notes || 'أتعاب #' + f.id)}</span>
        <span class="badge ${f.status === 'مدفوع بالكامل' ? 'active' : isLate ? 'suspended' : 'trial'}">${esc(f.status)}</span>
      </div>

      <div class="meta">
        إجمالي: <strong>${fmtMoney(f.amount_due)} ${cur()}</strong>
        · مدفوع: <strong style="color:var(--success)">${fmtMoney(f.amount_paid)} ${cur()}</strong>
        · باقي: <strong style="color:var(--danger)">${fmtMoney(remaining)} ${cur()}</strong>
      </div>

      ${f.due_date ? `<div class="meta">📅 ${esc(f.due_date)}</div>` : ''}

      <div class="progress-bar">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>

      ${f.notes ? `<div class="meta">📝 ${esc(f.notes)}</div>` : ''}

      <div class="acts">
        ${f.status !== 'مدفوع بالكامل'
          ? `<button class="btn btn-success btn-sm" data-add-payment="${f.id}">💵 إضافة دفعة</button>`
          : ''}
        ${f.status !== 'مدفوع بالكامل' && remaining > 0 && f.client_name
          ? `<button class="btn btn-ghost wa-ghost" data-wa-fee="${f.id}" title="تذكير الموكل على واتساب">💬 تذكير</button>`
          : ''}
        <button class="btn btn-ghost" data-view-payments="${f.id}">📋 الدفعات</button>
        ${canEditFee() ? `<button class="btn btn-ghost" data-edit-fee="${f.id}">✏️ تعديل</button>` : ''}
        <button class="btn btn-ghost" data-del-fee="${f.id}" style="color:var(--danger)">🗑 حذف</button>
      </div>
    </div>
  `;
}

function renderPaymentItem(p) {
  return `
    <div class="item">
      <div class="top">
        <span class="name">${fmtMoney(p.amount)} ${cur()}</span>
        <span class="num mono">${esc(p.receipt_number || '')}</span>
      </div>
      <div class="meta">
        ${esc(p.client_name || '—')}
        ${p.method ? ' · ' + esc(p.method) : ''}
        · ${esc(p.payment_date)}
      </div>
      ${p.notes ? `<div class="meta">📝 ${esc(p.notes)}</div>` : ''}
    </div>
  `;
}

// ============================================================
// Modal إضافة أتعاب
// ============================================================
function openAddFeeModal(host, clients, cases, onDone) {
  const clientOpts = clients.map(c => ({ value: c.id, label: c.name }));
  const caseOpts = cases.map(c => ({ value: c.id, label: c.case_number || '#' + c.id }));

  openModal({
    title: '➕ إضافة أتعاب جديدة',
    submitText: 'حفظ',
    fields: [
      { name: 'client_id', label: 'الموكل', type: 'select',
        options: [{ value: '', label: '— بدون —' }, ...clientOpts], required: true },
      { name: 'case_id', label: 'القضية (اختياري)', type: 'select',
        options: [{ value: '', label: '— بدون —' }, ...caseOpts] },
      { name: 'amount_due', label: `المبلغ المستحق (${cur()})`, type: 'number', required: true, placeholder: '15000' },
      { name: 'due_date', label: 'تاريخ الاستحقاق', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', placeholder: 'تفاصيل الأتعاب...' },
    ],
    onSubmit: async (d) => {
      await apiJson('/api/fees', {
        method: 'POST',
        body: JSON.stringify({
          client_id: d.client_id || null,
          case_id: d.case_id || null,
          amount_due: d.amount_due,
          due_date: d.due_date || null,
          notes: d.notes || null,
        }),
      });
    },
  }).then(result => {
    if (result) { toast('اتحفظت ✓', 'ok'); onDone ? onDone() : render(host); }
  });
}

// ============================================================
// أحداث الأتعاب
// ============================================================
function attachFeeEvents(host, fees, onDone) {
  host.querySelectorAll('[data-edit-fee]').forEach(b => b.addEventListener('click', () => {
    const f = fees.find(x => x.id === Number(b.dataset.editFee));
    if (f) editFee(f, () => (onDone ? onDone() : render(host)));
  }));
  host.querySelectorAll('[data-wa-fee]').forEach(b => b.addEventListener('click', () => {
    const f = fees.find(x => x.id === Number(b.dataset.waFee));
    if (!f) return;
    openWhatsAppComposer({
      kind: 'fee', kinds: ['fee', 'general'],
      phone: f.client_phone, client_name: f.client_name, case_number: f.case_number,
      remaining: (f.amount_due || 0) - (f.amount_paid || 0), due_date: f.due_date,
    });
  }));
  host.querySelectorAll('[data-add-payment]').forEach(b => b.addEventListener('click', async () => {
    const feeId = Number(b.dataset.addPayment);
    const fee = fees.find(f => f.id === feeId);
    const remaining = (fee.amount_due || 0) - (fee.amount_paid || 0);

    const result = await openModal({
      title: '💵 إضافة دفعة',
      submitText: 'تسجيل',
      initialData: { amount: remaining },
      fields: [
        { name: 'amount', label: `المبلغ (${cur()})`, type: 'number', required: true },
        { name: 'payment_date', label: 'تاريخ الدفعة', type: 'date', required: true,
          default: localISO() },
        { name: 'method', label: 'طريقة الدفع', type: 'datalist',
          placeholder: 'نقدي',
          options: ['نقدي', 'تحويل بنكي', 'شيك', 'فودافون كاش', 'إنستاباي'] },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
      ],
      onSubmit: async (d) => {
        await apiJson('/api/payments', {
          method: 'POST',
          body: JSON.stringify({
            fee_id: feeId,
            amount: d.amount,
            payment_date: d.payment_date,
            method: d.method,
            notes: d.notes,
          }),
        });
      },
    });

    if (result) {
      toast('اتسجلت الدفعة ✓', 'ok');
      const payments = await apiJson(`/api/fees/${feeId}/payments`);
      if (payments.payments.length) {
        const last = payments.payments[0];
        showReceipt(host, last, fee);
      }
      onDone ? onDone() : render(host);
    }
  }));

  host.querySelectorAll('[data-view-payments]').forEach(b => b.addEventListener('click', async () => {
    const feeId = Number(b.dataset.viewPayments);
    const data = await apiJson(`/api/fees/${feeId}/payments`);
    showFeePaymentsModal(data);
  }));

  host.querySelectorAll('[data-del-fee]').forEach(b => b.addEventListener('click', async () => {
    const feeId = Number(b.dataset.delFee);
    if (!confirm('⚠️ متأكد من حذف الأتعاب؟\n\nهيتم حذف كل المدفوعات والقيود المحاسبية المرتبطة بها. الإجراء ده لا يمكن التراجع عنه.')) return;

    try {
      await apiJson(`/api/fees/${feeId}`, { method: 'DELETE' });
      toast('✅ اتحذفت', 'ok');
      onDone ? onDone() : render(host);
    } catch (err) {
      toast('❌ ' + err.message, 'bad');
    }
  }));
}

// ============================================================
// Modal دفعات أتعاب
// ============================================================
function showFeePaymentsModal(data) {
  const { fee, payments, total_paid, remaining } = data;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <h3>📋 دفعات: ${esc(fee.notes || 'أتعاب #' + fee.id)}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="info-grid">
          <div class="info-item"><div class="info-label">إجمالي</div><div class="info-value">${fmtMoney(fee.amount_due)} ${cur()}</div></div>
          <div class="info-item"><div class="info-label">مدفوع</div><div class="info-value" style="color:var(--success)">${fmtMoney(total_paid)} ${cur()}</div></div>
          <div class="info-item"><div class="info-label">باقي</div><div class="info-value" style="color:var(--danger)">${fmtMoney(remaining)} ${cur()}</div></div>
        </div>

        <h4 style="margin:14px 0 8px; font-size:13px">الدفعات (${payments.length})</h4>
        ${payments.length ? payments.map(p => `
          <div class="item">
            <div class="top">
              <span class="name">${fmtMoney(p.amount)} ${cur()}</span>
              <span class="num mono">${esc(p.receipt_number || '')}</span>
            </div>
            <div class="meta">${esc(p.payment_date)}${p.method ? ' · ' + esc(p.method) : ''}</div>
            ${p.notes ? `<div class="meta">📝 ${esc(p.notes)}</div>` : ''}
            <div class="acts">
              <button class="btn btn-ghost" data-print="${p.id}">🖨 طباعة إيصال</button>
              <button class="btn btn-ghost" data-edit-payment="${p.id}">✏️ تعديل</button>
              <button class="btn btn-ghost" data-del-payment="${p.id}" style="color:var(--danger)">🗑 حذف</button>
            </div>
          </div>
        `).join('') : '<div class="empty">مفيش دفعات</div>'}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="close-modal">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('#close-modal').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  backdrop.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => {
    const p = payments.find(x => x.id == b.dataset.print);
    if (p) showReceipt(null, p, fee);
  }));

  backdrop.querySelectorAll('[data-edit-payment]').forEach(b => b.addEventListener('click', async () => {
    const p = payments.find(x => x.id == b.dataset.editPayment);
    if (!p) return;
    const saved = await openModal({
      title: '✏️ تعديل الدفعة',
      submitText: 'حفظ التعديل',
      initialData: { amount: p.amount, payment_date: String(p.payment_date || '').slice(0, 10), method: p.method || '', notes: p.notes || '' },
      fields: [
        { name: 'amount', label: `المبلغ (${cur()})`, type: 'number', required: true },
        { name: 'payment_date', label: 'تاريخ الدفعة', type: 'date', required: true },
        { name: 'method', label: 'طريقة الدفع', type: 'datalist', placeholder: 'نقدي',
          options: ['نقدي', 'تحويل بنكي', 'شيك', 'فودافون كاش', 'إنستاباي'] },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
      ],
      onSubmit: async (d) => {
        await apiJson(`/api/payments/${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ amount: d.amount, payment_date: d.payment_date, method: d.method, notes: d.notes }),
        });
      },
    });
    if (!saved) return;
    toast('✅ اتعدّلت الدفعة', 'ok');
    close();
    const host = document.getElementById('view-host');
    if (host) render(host);
  }));

  backdrop.querySelectorAll('[data-del-payment]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('متأكد من حذف الدفعة؟')) return;
    await apiJson(`/api/payments/${b.dataset.delPayment}`, { method: 'DELETE' });
    toast('اتحذفت', 'ok');
    close();
    const host = document.getElementById('view-host');
    if (host) render(host);
  }));
}

// ============================================================
// إيصال قابل للطباعة
// ============================================================
function showReceipt(host, payment, fee) {
  const officeName = document.getElementById('topbar-title')?.textContent || 'مُوكِّل';
  const win = window.open('', '_blank', 'width=600,height=800');

  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>إيصال - ${payment.receipt_number}</title>
      <link href="${location.origin}/assets/fonts.css" rel="stylesheet">
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; margin: 0; padding: 40px; background: #F9FAFB; color: #111827; }
        .receipt { max-width: 520px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { text-align: center; border-bottom: 3px double #0F172A; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { margin: 0; color: #0F172A; font-size: 26px; }
        .header .subtitle { color: #1E293B; font-size: 13px; margin-top: 4px; }
        .receipt-number { background: #F1F5F9; padding: 10px 16px; border-radius: 8px; text-align: center; margin-bottom: 20px; font-weight: 700; color: #0F172A; font-size: 14px; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #E5E7EB; font-size: 14px; }
        .info-row .label { color: #6B7280; }
        .info-row .value { font-weight: 700; }
        .amount-box { background: linear-gradient(135deg, #0F172A, #1E293B); color: #fff; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0; }
        .amount-box .label { font-size: 13px; opacity: 0.9; margin-bottom: 6px; }
        .amount-box .amount { font-size: 36px; font-weight: 900; }
        .amount-box .currency { font-size: 18px; opacity: 0.9; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #1E293B; }
        .signature { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
        .signature div { text-align: center; font-size: 13px; }
        .signature .line { border-top: 1px solid #111827; padding-top: 8px; margin-top: 40px; min-width: 140px; }
        @media print { body { background: #fff; padding: 0; } .receipt { box-shadow: none; padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>${officeName}</h1>
          <div class="subtitle">إيصال استلام دفعة</div>
        </div>

        <div class="receipt-number">رقم الإيصال: ${esc(payment.receipt_number || '—')}</div>

        <div class="info-row"><span class="label">التاريخ</span><span class="value">${esc(payment.payment_date)}</span></div>
        <div class="info-row"><span class="label">الموكل</span><span class="value">${esc(payment.client_name || '—')}</span></div>
        ${payment.case_number ? `<div class="info-row"><span class="label">القضية</span><span class="value">${esc(payment.case_number)}</span></div>` : ''}
        ${fee ? `<div class="info-row"><span class="label">إجمالي الأتعاب</span><span class="value">${fmtMoney(fee.amount_due)} ${cur()}</span></div>` : ''}
        ${fee ? `<div class="info-row"><span class="label">الباقي بعد الدفعة</span><span class="value">${fmtMoney((fee.amount_due||0) - (fee.amount_paid||0))} ${cur()}</span></div>` : ''}
        ${payment.method ? `<div class="info-row"><span class="label">طريقة الدفع</span><span class="value">${esc(payment.method)}</span></div>` : ''}

        <div class="amount-box">
          <div class="label">المبلغ المدفوع</div>
          <div class="amount">${fmtMoney(payment.amount)} <span class="currency">${curName()}</span></div>
        </div>

        ${payment.notes ? `<div class="info-row"><span class="label">ملاحظات</span><span class="value">${esc(payment.notes)}</span></div>` : ''}

        <div class="signature">
          <div><div class="line"></div>توقيع الموكل</div>
          <div><div class="line"></div>توقيع المكتب</div>
        </div>

        <div class="footer">
          شكراً لتعاملكم معنا · ${officeName}
        </div>
      </div>

      <script>window.onload = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 300));</script>
    </body>
    </html>
  `);
  win.document.close();
}

// ============================================================
// كل الدفعات
// ============================================================
function renderAllPayments(host, payments) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h3>💳 كل الدفعات (${payments.length})</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        ${payments.length ? payments.map(p => `
          <div class="item">
            <div class="top">
              <span class="name">${fmtMoney(p.amount)} ${cur()}</span>
              <span class="num mono">${esc(p.receipt_number || '')}</span>
            </div>
            <div class="meta">${esc(p.client_name || '—')} · ${esc(p.payment_date)}${p.method ? ' · ' + esc(p.method) : ''}</div>
          </div>
        `).join('') : '<div class="empty">مفيش دفعات</div>'}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="close-modal">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('#close-modal').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
}

function attachPaymentEvents(host, payments) {
  host.querySelectorAll('[data-payment-receipt]').forEach(b => b.addEventListener('click', () => {
    const p = payments.find(x => x.id == b.dataset.paymentReceipt);
    if (p) showReceipt(host, p, null);
  }));
} 
