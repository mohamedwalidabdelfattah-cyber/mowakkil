// web/js/statement.js
// كشف حساب الموكل: اللي عليه، اللي دفعه، الباقي — طباعة/PDF وواتساب وتسجيل دفعة على الحساب

import { apiJson } from './api.js';
import { esc, toast, fmtMoney, cur, curName, localISO } from './ui.js';
import { openModal } from './modal.js';
import { openWhatsAppComposer } from './whatsapp.js';

const KIND = { fee: 'أتعاب', invoice: 'فاتورة', tax: 'ضريبة', expense: 'مصاريف', payment: 'دفعة' };

export async function openStatement(clientId) {
  document.getElementById('statement-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'statement-modal';
  m.className = 'modal-overlay show';
  m.innerHTML = `<div class="modal-card st-card" role="dialog" aria-modal="true" aria-labelledby="st-title"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.addEventListener('click', (e) => { if (e.target === m) close(); });

  let s;
  try { s = await apiJson(`/api/clients/${clientId}/statement`, { skipCache: true }); }
  catch (e) { m.querySelector('.st-card').innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`; return; }

  const { client, lines, totals } = s;
  const bal = totals.balance;
  const card = m.querySelector('.st-card');
  card.innerHTML = `
    <div class="st-head">
      <div>
        <div class="meta">كشف حساب</div>
        <h3 id="st-title">${esc(client.name)}</h3>
      </div>
      <button class="icon-btn" data-st="close" aria-label="إغلاق">✕</button>
    </div>
    <div class="st-totals">
      <div><span>عليه</span><strong>${fmtMoney(totals.charged)} ${cur()}</strong></div>
      <div><span>دفع</span><strong class="ok">${fmtMoney(totals.paid)} ${cur()}</strong></div>
      <div class="${bal > 0 ? 'due' : 'clear'}"><span>${bal > 0 ? 'الباقي عليه' : bal < 0 ? 'ليه عند المكتب' : 'الحساب خالص'}</span><strong>${fmtMoney(Math.abs(bal))} ${cur()}</strong></div>
    </div>
    <div class="st-table-wrap">
      ${lines.length ? `
      <table class="st-table">
        <thead><tr><th>التاريخ</th><th>البيان</th><th>عليه</th><th>دفع</th><th>الرصيد</th></tr></thead>
        <tbody>
          ${lines.map(l => `
            <tr class="${l.kind}">
              <td class="mono">${esc(l.date)}</td>
              <td><span class="st-kind ${l.kind}">${KIND[l.kind] || ''}</span> ${esc(l.description)}</td>
              <td class="mono">${l.charge ? fmtMoney(l.charge) : ''}</td>
              <td class="mono ok">${l.paid ? fmtMoney(l.paid) : ''}</td>
              <td class="mono">${fmtMoney(l.balance)}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<div class="empty" style="padding:24px">مفيش حركات على الموكل ده لسه</div>'}
    </div>
    <div class="st-actions">
      <button class="btn btn-primary btn-sm" data-st="pay">💵 تسجيل دفعة على الحساب</button>
      ${client.phone ? '<button class="btn wa-send btn-sm" data-st="wa">💬 ابعته على واتساب</button>' : ''}
      <button class="btn btn-ghost btn-sm" data-st="print">🖨 طباعة / PDF</button>
    </div>`;

  card.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-st]')?.dataset.st;
    if (a === 'close') return close();
    if (a === 'print') return printStatement(s);
    if (a === 'wa') {
      const last = lines.filter(l => l.paid).slice(-1)[0];
      const text = [
        `أستاذ/ة ${client.name}، تحية طيبة`,
        `ملخص حسابك مع المكتب حتى ${localISO()}:`,
        `• إجمالي المستحق: ${fmtMoney(totals.charged)} ${curName()}`,
        `• المدفوع: ${fmtMoney(totals.paid)} ${curName()}`,
        bal > 0 ? `• الباقي: ${fmtMoney(bal)} ${curName()}` : bal < 0 ? `• ليك عندنا: ${fmtMoney(-bal)} ${curName()}` : '• الحساب خالص ✅',
        last ? `آخر دفعة: ${fmtMoney(last.paid)} ${curName()} بتاريخ ${last.date}` : '',
        'لو محتاج الكشف بالتفصيل بلّغنا ونبعتهولك.',
      ].filter(Boolean).join('\n');
      return openWhatsAppComposer({ kind: 'general', phone: client.phone, client_name: client.name, presetText: text });
    }
    if (a === 'pay') {
      const res = await openModal({
        title: '💵 دفعة على حساب الموكل',
        submitText: 'تسجيل',
        initialData: { amount: bal > 0 ? bal : '', payment_date: localISO(), method: 'نقدي' },
        fields: [
          { name: 'amount', label: `المبلغ (${cur()})`, type: 'number', required: true },
          { name: 'payment_date', label: 'التاريخ', type: 'date', required: true },
          { name: 'method', label: 'طريقة الدفع', type: 'select', options: ['نقدي', 'تحويل بنكي', 'إنستاباي', 'فودافون كاش', 'شيك'] },
          { name: 'notes', label: 'ملاحظات', type: 'textarea' },
        ],
        onSubmit: async (d) => {
          if (!(Number(d.amount) > 0)) throw new Error('اكتب المبلغ');
          await apiJson('/api/payments', { method: 'POST', body: JSON.stringify({ client_id: client.id, amount: Number(d.amount), payment_date: d.payment_date, method: d.method, notes: d.notes || 'على الحساب' }) });
        },
      });
      if (res) { toast('✓ اتسجلت الدفعة', 'ok'); close(); openStatement(clientId); }
    }
  });
}

function printStatement(s) {
  const { client, lines, totals, office } = s;
  const w = window.open('', '_blank');
  if (!w) return toast('المتصفح منع فتح نافذة الطباعة', 'bad');
  const officeName = office?.name_ar || office?.name || '';
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب — ${esc(client.name)}</title>
  <style>
    body{font-family:'Cairo','Tajawal',Tahoma,sans-serif;color:#111;margin:32px}
    h1{font-size:20px;margin:0 0 4px} .muted{color:#667085;font-size:13px}
    .totals{display:flex;gap:12px;margin:18px 0}.totals div{flex:1;border:1px solid #d0d5dd;border-radius:10px;padding:10px 12px}
    .totals span{display:block;font-size:12px;color:#667085}.totals strong{font-size:18px}
    table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #eaecf0;padding:8px 6px;text-align:right}
    th{background:#f2f4f7}td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
    tr.payment td{color:#027a48}
    @media print{body{margin:12mm}}
  </style></head><body>
  <h1>كشف حساب: ${esc(client.name)}</h1>
  <div class="muted">${esc(officeName)} · بتاريخ ${localISO()}</div>
  <div class="totals">
    <div><span>إجمالي المستحق</span><strong>${fmtMoney(totals.charged)} ${cur()}</strong></div>
    <div><span>المدفوع</span><strong>${fmtMoney(totals.paid)} ${cur()}</strong></div>
    <div><span>${totals.balance >= 0 ? 'الباقي' : 'رصيد للموكل'}</span><strong>${fmtMoney(Math.abs(totals.balance))} ${cur()}</strong></div>
  </div>
  <table><thead><tr><th>التاريخ</th><th>البيان</th><th>عليه</th><th>دفع</th><th>الرصيد</th></tr></thead><tbody>
  ${lines.map(l => `<tr class="${l.kind}"><td class="n">${esc(l.date)}</td><td>${esc(l.description)}</td><td class="n">${l.charge ? fmtMoney(l.charge) : ''}</td><td class="n">${l.paid ? fmtMoney(l.paid) : ''}</td><td class="n">${fmtMoney(l.balance)}</td></tr>`).join('')}
  </tbody></table>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
  </body></html>`);
  w.document.close();
}
