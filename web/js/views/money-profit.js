// web/js/views/money-profit.js
// ربحية القضايا والمحامين (الاحترافية وفوق): اللي اتحصّل − مصاريف المكتب على القضية

import { apiJson } from '../api.js';
import { esc, empty, skeleton, fmtMoney, cur, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { toExcel } from '../exporter.js';

let range = 'month';

function rangeDates() {
  const now = new Date();
  if (range === 'quarter') return { from: localISO(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: localISO(now), label: 'آخر 3 شهور' };
  if (range === 'year') return { from: `${now.getFullYear()}-01-01`, to: localISO(now), label: `سنة ${now.getFullYear()}` };
  if (range === 'last') { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { from: monthStartISO(d), to: monthEndISO(d), label: 'الشهر اللي فات' }; }
  return { from: monthStartISO(now), to: localISO(now), label: 'الشهر ده' };
}

export async function renderProfit(host) {
  const r = rangeDates();
  host.innerHTML = `<div class="card">${skeleton(4)}</div>`;
  let d;
  try { d = await apiJson(`/api/fees/profitability?from=${r.from}&to=${r.to}`, { skipCache: true }); }
  catch (e) { host.innerHTML = `<div class="card">${empty('خطأ: ' + e.message, '⚠️')}</div>`; return; }
  if (!host.isConnected) return;

  const sum = (k) => d.cases.reduce((s, c) => s + (c[k] || 0), 0);
  host.innerHTML = `
    <div class="ms-top">
      <div><h2>📈 ربحية القضايا والمحامين</h2><div class="meta">اللي اتحصّل فعلاً − مصاريف المكتب على القضية (المصاريف اللي على الموكل مش محسوبة)</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${[['month', 'الشهر ده'], ['last', 'الشهر اللي فات'], ['quarter', '3 شهور'], ['year', 'السنة']].map(([k, l]) =>
          `<button class="ag-view ${range === k ? 'active' : ''}" data-range="${k}">${l}</button>`).join('')}
        <button class="btn btn-ghost btn-sm" id="pf-export">⬇️ Excel</button>
      </div>
    </div>
    <div class="ms-cards">
      <div class="ms-card in"><span>💵 اتحصّل على قضايا</span><strong>${fmtMoney(sum('collected'))} ${cur()}</strong><small>${d.unlinked_collected ? `+ ${fmtMoney(d.unlinked_collected)} مش مربوطة بقضية` : '&nbsp;'}</small></div>
      <div class="ms-card out"><span>💸 مصاريف المكتب على القضايا</span><strong>${fmtMoney(sum('office_expenses'))} ${cur()}</strong><small>${d.general_expenses ? `+ ${fmtMoney(d.general_expenses)} مصاريف عامة على المكتب` : '&nbsp;'}</small></div>
      <div class="ms-card net pos"><span>✅ صافي القضايا</span><strong>${fmtMoney(sum('net'))} ${cur()}</strong><small>${esc(r.label)}</small></div>
    </div>

    <div class="card">
      <h3>⚖️ القضايا</h3>
      ${d.cases.length ? `<div class="st-table-wrap"><table class="st-table">
        <thead><tr><th>القضية</th><th>الموكل</th><th>اتفقت</th><th>اتحصّل</th><th>مصاريف المكتب</th><th>على الموكل</th><th>الصافي</th></tr></thead>
        <tbody>${d.cases.map(c => `<tr>
          <td>${esc(c.case_number || '#' + c.case_id)}<div class="meta">${esc(c.case_type || '')}</div></td>
          <td>${esc(c.client_name || '—')}</td>
          <td class="mono">${c.agreed ? fmtMoney(c.agreed) : ''}</td>
          <td class="mono ok">${fmtMoney(c.collected)}</td>
          <td class="mono">${c.office_expenses ? fmtMoney(c.office_expenses) : ''}</td>
          <td class="mono">${c.client_expenses ? fmtMoney(c.client_expenses) : ''}</td>
          <td class="mono" style="font-weight:800;color:${c.net < 0 ? 'var(--c-danger, #d92d20)' : 'inherit'}">${fmtMoney(c.net)}</td>
        </tr>`).join('')}</tbody></table></div>` : empty('مفيش حركة على قضايا في الفترة دي', '📭')}
    </div>

    <div class="card">
      <h3>👥 المحامين</h3>
      <div class="meta" style="margin-bottom:8px">نصيب كل محامي = القضايا اللي في فريقها، مقسومة بالتساوي على أعضاء الفريق.${d.unassigned_cases ? ` (${d.unassigned_cases} قضية من غير فريق)` : ''}</div>
      ${d.lawyers.length ? `<div class="st-table-wrap"><table class="st-table">
        <thead><tr><th>المحامي</th><th>عدد القضايا</th><th>اتحصّل (نصيبه)</th><th>مصاريف (نصيبه)</th><th>الصافي</th></tr></thead>
        <tbody>${d.lawyers.map(l => `<tr><td>${esc(l.name)}</td><td class="mono">${l.cases}</td><td class="mono ok">${fmtMoney(l.collected)}</td><td class="mono">${fmtMoney(l.office_expenses)}</td><td class="mono" style="font-weight:800">${fmtMoney(l.net)}</td></tr>`).join('')}</tbody>
      </table></div>` : empty('مفيش فرق قضايا متسجلة — ضيف المحامين لفريق كل قضية من ملف القضية', '👥')}
    </div>`;

  host.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { range = b.dataset.range; renderProfit(host); }));
  host.querySelector('#pf-export').addEventListener('click', () => toExcel({
    title: `ربحية القضايا — ${r.from} إلى ${r.to}`,
    blocks: [
      { type: 'table', heading: 'القضايا', columns: [
        { key: 'case_number', label: 'القضية' }, { key: 'client_name', label: 'الموكل' }, { key: 'agreed', label: 'اتفقت', type: 'money' },
        { key: 'collected', label: 'اتحصّل', type: 'money' }, { key: 'office_expenses', label: 'مصاريف المكتب', type: 'money' },
        { key: 'client_expenses', label: 'على الموكل', type: 'money' }, { key: 'net', label: 'الصافي', type: 'money' }], rows: d.cases },
      { type: 'table', heading: 'المحامين', columns: [
        { key: 'name', label: 'المحامي' }, { key: 'cases', label: 'القضايا', type: 'number' }, { key: 'collected', label: 'اتحصّل', type: 'money' },
        { key: 'office_expenses', label: 'مصاريف', type: 'money' }, { key: 'net', label: 'الصافي', type: 'money' }], rows: d.lawyers },
    ],
  }, 'ربحية القضايا'));
}
