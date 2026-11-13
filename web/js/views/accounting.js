// web/js/views/accounting.js
// المحاسبة الاحترافية — للمحاسب

import { apiJson } from '../api.js';
import { esc, toast, empty, skeleton, fmtMoney } from '../ui.js';
import { openModal } from '../modal.js';

export async function render(host, options = {}) {
  const subView = options.subView || 'accounting';

  host.innerHTML = '<div class="card">' + skeleton(6) + '</div>';

  try {
    switch (subView) {
      case 'accounting-journal':   return await renderJournal(host);
      case 'accounting-accounts':  return await renderAccounts(host);
      case 'accounting-pl':        return await renderPL(host);
      case 'accounting-bs':        return await renderBS(host);
      case 'accounting-cf':        return await renderCF(host);
      default:                     return await renderAccountingHome(host);
    }
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="empty">خطأ: ${esc(e.message)}</div></div>`;
  }
}

// ============================================================
// الصفحة الرئيسية للمحاسبة
// ============================================================
async function renderAccountingHome(host) {
  host.innerHTML = `
    <div class="card">
      <h3>📊 المحاسبة الاحترافية</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
        الأدوات المحاسبية الكاملة — مخصصة للمحاسبين
      </p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button class="card" style="cursor:pointer;text-align:center;padding:20px" data-goto="accounting-journal">
        <div style="font-size:32px">📖</div>
        <div style="font-weight:700;margin-top:6px">دفتر اليومية</div>
      </button>
      <button class="card" style="cursor:pointer;text-align:center;padding:20px" data-goto="accounting-accounts">
        <div style="font-size:32px">🌳</div>
        <div style="font-weight:700;margin-top:6px">دليل الحسابات</div>
      </button>
      <button class="card" style="cursor:pointer;text-align:center;padding:20px" data-goto="accounting-pl">
        <div style="font-size:32px">📊</div>
        <div style="font-weight:700;margin-top:6px">قائمة الدخل</div>
      </button>
      <button class="card" style="cursor:pointer;text-align:center;padding:20px" data-goto="accounting-bs">
        <div style="font-size:32px">⚖️</div>
        <div style="font-weight:700;margin-top:6px">المركز المالي</div>
      </button>
    </div>
  `;

  host.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', async () => {
    const { showView } = await import('../router.js');
    showView(b.dataset.goto);
  }));
}

// ============================================================
// دفتر اليومية
// ============================================================
async function renderJournal(host) {
  const entries = await apiJson('/api/journal?limit=100');

  host.innerHTML = `
    <div class="card">
      <h3>📖 دفتر اليومية (${entries.length})</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
        اضغط على أي قيد لعرض التفاصيل
      </p>
    </div>

    <div id="journal-list">
      ${entries.length ? entries.map(e => `
        <div class="item" data-open-entry="${e.id}" style="cursor:pointer">
          <div class="top">
            <span class="name">${esc(e.entry_number)}</span>
            <span class="num mono">${fmtMoney(e.total_debit)} ج</span>
          </div>
          <div class="meta">${esc(e.entry_date)} · ${esc(e.description || '—')}</div>
          <div class="meta">
            <span class="badge ${getRefBadge(e.reference_type)}">${esc(getRefLabel(e.reference_type))}</span>
          </div>
        </div>
      `).join('') : empty('مفيش قيود')}
    </div>
  `;

  host.querySelectorAll('[data-open-entry]').forEach(b => b.addEventListener('click', () => {
    showEntryDetail(b.dataset.openEntry);
  }));
}

function getRefLabel(type) {
  const labels = {
    'manual': 'يدوي', 'payment': 'دفعة', 'fee': 'أتعاب',
    'expense': 'مصروف', 'revenue': 'إيراد',
  };
  return labels[type] || type || '—';
}

function getRefBadge(type) {
  const badges = {
    'manual': 'trial', 'payment': 'active', 'fee': 'active',
    'expense': 'suspended', 'revenue': 'active',
  };
  return badges[type] || 'trial';
}

async function showEntryDetail(entryId) {
  const entry = await apiJson(`/api/journal/${entryId}`);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:600px">
      <div class="modal-header">
        <h3>📖 ${esc(entry.entry_number)}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="info-grid">
          <div class="info-item"><div class="info-label">التاريخ</div><div class="info-value">${esc(entry.entry_date)}</div></div>
          <div class="info-item"><div class="info-label">النوع</div><div class="info-value">${esc(getRefLabel(entry.reference_type))}</div></div>
        </div>
        ${entry.description ? `<div class="meta" style="margin:10px 0">${esc(entry.description)}</div>` : ''}

        <h4 style="margin:14px 0 8px;font-size:13px">السطور</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--paper)">
              <th style="padding:8px;text-align:right;border-bottom:1px solid var(--line)">الحساب</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--line)">مدين</th>
              <th style="padding:8px;text-align:left;border-bottom:1px solid var(--line)">دائن</th>
            </tr>
          </thead>
          <tbody>
            ${entry.lines.map(l => `
              <tr>
                <td style="padding:8px;text-align:right;border-bottom:1px dashed var(--line)">
                  ${esc(l.account_code)} — ${esc(l.account_name)}
                </td>
                <td style="padding:8px;text-align:left;border-bottom:1px dashed var(--line);color:${l.debit > 0 ? 'var(--ok)' : 'inherit'};font-weight:${l.debit > 0 ? '700' : '400'}">
                  ${l.debit > 0 ? fmtMoney(l.debit) : '—'}
                </td>
                <td style="padding:8px;text-align:left;border-bottom:1px dashed var(--line);color:${l.credit > 0 ? 'var(--bad)' : 'inherit'};font-weight:${l.credit > 0 ? '700' : '400'}">
                  ${l.credit > 0 ? fmtMoney(l.credit) : '—'}
                </td>
              </tr>
            `).join('')}
            <tr style="background:var(--paper);font-weight:900">
              <td style="padding:8px;text-align:right">الإجمالي</td>
              <td style="padding:8px;text-align:left">${fmtMoney(entry.total_debit)}</td>
              <td style="padding:8px;text-align:left">${fmtMoney(entry.total_credit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="ghost" id="close-modal">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('#close-modal').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
}

// ============================================================
// دليل الحسابات
// ============================================================
async function renderAccounts(host) {
  const accounts = await apiJson('/api/accounts?tree=1');

  host.innerHTML = `
    <div class="card">
      <h3>🌳 دليل الحسابات</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
        الشجرة الكاملة للحسابات المحاسبية
      </p>
    </div>

    <div id="accounts-tree">
      ${accounts.length ? accounts.map(a => renderAccountNode(a, 0)).join('') : empty('مفيش حسابات')}
    </div>
  `;
}

function renderAccountNode(account, depth) {
  const typeColors = {
    asset: 'var(--ok)', liability: 'var(--bad)',
    equity: 'var(--brass-deep)', revenue: '#2f6b4f', expense: '#a13d2f',
  };
  const typeLabels = {
    asset: 'أصول', liability: 'التزامات',
    equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصاريف',
  };

  const isHeader = account.category === 'header';
  const padding = depth * 16;

  return `
    <div style="margin-right:${padding}px;${isHeader ? 'background:var(--paper);border-radius:6px;padding:8px 12px;margin-bottom:6px;border-right:3px solid ' + (typeColors[account.type] || 'var(--line)') : 'padding:6px 12px;margin-bottom:2px'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:${isHeader ? '700' : '500'};font-size:${isHeader ? '14px' : '13px'}">
          ${esc(account.code)} — ${esc(account.name)}
        </span>
        ${isHeader ? `<span class="badge trial" style="font-size:10px">${typeLabels[account.type] || ''}</span>` : ''}
      </div>
    </div>
    ${(account.children || []).map(c => renderAccountNode(c, depth + 1)).join('')}
  `;
}

// ============================================================
// قائمة الدخل
// ============================================================
async function renderPL(host) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  const pl = await apiJson(`/api/reports/profit-loss?from=${from}&to=${to}`);

  host.innerHTML = `
    <div class="card">
      <h3>📊 قائمة الدخل</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
        من ${esc(pl.period.from)} إلى ${esc(pl.period.to)}
      </p>
    </div>

    <div class="card">
      <h3 style="color:var(--ok)">💰 الإيرادات</h3>
      ${pl.revenues.length ? pl.revenues.map(r => `
        <div class="report-row">
          <span>${esc(r.name)} (${esc(r.code)})</span>
          <span>${fmtMoney(r.amount)} ج</span>
        </div>
      `).join('') : '<div class="empty">مفيش إيرادات</div>'}
      <div class="report-row total">
        <span>إجمالي الإيرادات</span>
        <span>${fmtMoney(pl.total_revenue)} ج</span>
      </div>
    </div>

    <div class="card">
      <h3 style="color:var(--bad)">💸 المصاريف</h3>
      ${pl.expenses.length ? pl.expenses.map(e => `
        <div class="report-row">
          <span>${esc(e.name)} (${esc(e.code)})</span>
          <span>${fmtMoney(e.amount)} ج</span>
        </div>
      `).join('') : '<div class="empty">مفيش مصاريف</div>'}
      <div class="report-row total">
        <span>إجمالي المصاريف</span>
        <span>${fmtMoney(pl.total_expenses)} ج</span>
      </div>
    </div>

    <div class="card" style="background:${pl.is_profit ? '#dcecdf' : '#f6e2dc'}">
      <div class="report-row total" style="border:none;padding:0">
        <span style="font-size:17px">${pl.is_profit ? '✅ صافي الربح' : '⚠️ صافي الخسارة'}</span>
        <span style="font-size:24px;color:${pl.is_profit ? 'var(--ok)' : 'var(--bad)'}">
          ${fmtMoney(Math.abs(pl.net_profit))} ج
        </span>
      </div>
      ${pl.total_revenue > 0 ? `
        <div style="text-align:center;margin-top:8px;font-size:13px;color:var(--ink-soft)">
          هامش الربح: ${pl.profit_margin.toFixed(1)}%
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================
// المركز المالي
// ============================================================
async function renderBS(host) {
  const now = new Date().toISOString().slice(0, 10);
  const bs = await apiJson(`/api/reports/balance-sheet?as_of=${now}`);

  host.innerHTML = `
    <div class="card">
      <h3>⚖️ قائمة المركز المالي</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
        بتاريخ ${esc(bs.as_of)}
      </p>
      ${bs.is_balanced ? '<div class="status ok" style="margin-top:6px">✅ القائمة متوازنة</div>' : '<div class="status bad" style="margin-top:6px">⚠️ مش متوازنة</div>'}
    </div>

    <div class="card">
      <h3 style="color:var(--ok)">📈 الأصول</h3>
      ${bs.assets.length ? bs.assets.map(a => `
        <div class="report-row">
          <span>${esc(a.name)}</span>
          <span>${fmtMoney(a.balance)} ج</span>
        </div>
      `).join('') : '<div class="empty">مفيش أصول</div>'}
      <div class="report-row total">
        <span>إجمالي الأصول</span>
        <span>${fmtMoney(bs.total_assets)} ج</span>
      </div>
    </div>

    <div class="card">
      <h3 style="color:var(--bad)">📉 الالتزامات</h3>
      ${bs.liabilities.length ? bs.liabilities.map(l => `
        <div class="report-row">
          <span>${esc(l.name)}</span>
          <span>${fmtMoney(l.balance)} ج</span>
        </div>
      `).join('') : '<div class="empty">مفيش التزامات 🎉</div>'}
      <div class="report-row total">
        <span>إجمالي الالتزامات</span>
        <span>${fmtMoney(bs.total_liabilities)} ج</span>
      </div>
    </div>

    <div class="card">
      <h3 style="color:var(--brass-deep)">💎 حقوق الملكية</h3>
      ${bs.equity.length ? bs.equity.map(e => `
        <div class="report-row">
          <span>${esc(e.name)}</span>
          <span>${fmtMoney(e.balance)} ج</span>
        </div>
      `).join('') : ''}
      <div class="report-row">
        <span>صافي الربح المحتجز</span>
        <span>${fmtMoney(bs.net_profit)} ج</span>
      </div>
      <div class="report-row total">
        <span>إجمالي حقوق الملكية</span>
        <span>${fmtMoney(bs.total_equity)} ج</span>
      </div>
    </div>
  `;
}

// ============================================================
// التدفقات النقدية
// ============================================================
async function renderCF(host) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  const cf = await apiJson(`/api/reports/cash-flow?from=${from}&to=${to}`);

  host.innerHTML = `
    <div class="card">
      <h3>💵 قائمة التدفقات النقدية</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
        من ${esc(cf.period.from)} إلى ${esc(cf.period.to)}
      </p>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="n" style="color:var(--ok)">${fmtMoney(cf.inflow)}</div>
        <div class="l">⬇️ دخل</div>
      </div>
      <div class="stat">
        <div class="n" style="color:var(--bad)">${fmtMoney(cf.outflow)}</div>
        <div class="l">⬆️ خرج</div>
      </div>
      <div class="stat">
        <div class="n" style="color:${cf.net_cash_flow >= 0 ? 'var(--ok)' : 'var(--bad)'}">
          ${fmtMoney(cf.net_cash_flow)}
        </div>
        <div class="l">📊 صافي</div>
      </div>
    </div>

    <div class="card">
      <h3>⬇️ التدفقات الداخلة (${cf.inflow_details.length})</h3>
      ${cf.inflow_details.length ? cf.inflow_details.map(m => `
        <div class="report-row">
          <span>${esc(m.description || m.entry_number)}</span>
          <span style="color:var(--ok)">+${fmtMoney(m.amount)} ج</span>
        </div>
      `).join('') : '<div class="empty">مفيش تدفقات داخلة</div>'}
    </div>

    <div class="card">
      <h3>⬆️ التدفقات الخارجة (${cf.outflow_details.length})</h3>
      ${cf.outflow_details.length ? cf.outflow_details.map(m => `
        <div class="report-row">
          <span>${esc(m.description || m.entry_number)}</span>
          <span style="color:var(--bad)">-${fmtMoney(m.amount)} ج</span>
        </div>
      `).join('') : '<div class="empty">مفيش تدفقات خارجة</div>'}
    </div>
  `;
}