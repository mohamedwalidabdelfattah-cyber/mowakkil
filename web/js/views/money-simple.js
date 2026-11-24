// web/js/views/money-simple.js
// الوضع المبسط للإدارة المالية: الفلوس اللي دخلت وخرجت فعلاً، اللي معاك، ومين عليه فلوس
// (من غير مصطلحات محاسبية — "وضع المحاسب" بزرار)

import { apiJson, hasFeature } from '../api.js';
import { esc, toast, empty, skeleton, fmtMoney, cur, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { openModal } from '../modal.js';
import { can } from '../access.js';
import { openStatement } from '../statement.js';
import { openWhatsAppComposer } from '../whatsapp.js';

const ACC_KEY = 'mowakkil_acc_mode';
export function accountantMode() {
  try {
    if (localStorage.getItem(ACC_KEY) === '1') return true;
  } catch {}
  return false;
}
export function setAccountantMode(on) {
  try { localStorage.setItem(ACC_KEY, on ? '1' : '0'); } catch {}
  document.dispatchEvent(new CustomEvent('mowakkil:access-changed')); // القايمة الجانبية تتبني تاني
}

let monthOffset = 0;

export async function renderSimple(host) {
  const base = new Date();
  const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const from = monthStartISO(d);
  const to = monthOffset === 0 ? localISO(base) : monthEndISO(d);
  const monthLabel = d.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });

  host.innerHTML = `<div class="card">${skeleton(3, 'card')}</div>`;
  let s;
  try { s = await apiJson(`/api/fees/cash-summary?from=${from}&to=${to}`, { skipCache: true }); }
  catch (e) { host.innerHTML = `<div class="card">${empty('خطأ: ' + e.message, '⚠️')}</div>`; return; }
  if (!host.isConnected) return;

  const spent = s.spent_office + s.spent_for_clients;
  const accOn = accountantMode();
  host.innerHTML = `
    <div class="ms-top">
      <div>
        <h2>💼 فلوس المكتب</h2>
        <div class="ms-month">
          <button class="btn btn-ghost btn-sm" data-ms="prev" aria-label="الشهر اللي قبل">›</button>
          <strong>${esc(monthLabel)}</strong>
          <button class="btn btn-ghost btn-sm" data-ms="next" aria-label="الشهر اللي بعد" ${monthOffset >= 0 ? 'disabled' : ''}>‹</button>
        </div>
      </div>
      ${hasFeature('accounting') ? `<label class="ms-acc" title="يظهر دفتر اليومية ودليل الحسابات والقوائم المالية في القايمة">
        <input type="checkbox" id="ms-acc" ${accOn ? 'checked' : ''}> وضع المحاسب
      </label>` : `<a class="ms-acc" href="/pricing" target="_blank" rel="noopener" title="القيود والقوائم المالية في الباقة الاحترافية">🔒 المحاسبة الكاملة في الاحترافية</a>`}
    </div>

    <div class="ms-cards">
      <div class="ms-card in">
        <span>💵 اتحصّل من الموكلين</span>
        <strong>${fmtMoney(s.collected)} ${cur()}</strong>
        <small>نقدي ${fmtMoney(s.collected_cash)} · بنك/محافظ ${fmtMoney(s.collected_bank)} · ${s.payments_count} دفعة</small>
      </div>
      <div class="ms-card out">
        <span>💸 اتصرف</span>
        <strong>${fmtMoney(spent)} ${cur()}</strong>
        <small>على المكتب ${fmtMoney(s.spent_office)}${s.spent_for_clients ? ` · عن الموكلين ${fmtMoney(s.spent_for_clients)} (هتسترده)` : ''}</small>
      </div>
      <div class="ms-card net ${s.net >= 0 ? 'pos' : 'neg'}">
        <span>${s.net >= 0 ? '✅ اللي فضل' : '⚠️ صرفت أكتر من اللي دخل'}</span>
        <strong>${fmtMoney(Math.abs(s.net))} ${cur()}</strong>
        <small>اللي دخل − اللي اتصرف (فلوس حقيقية)</small>
      </div>
    </div>

    <div class="ms-row">
      <div class="card ms-have">
        <h3>👛 الفلوس اللي معاك دلوقتي</h3>
        <div class="ms-have-grid">
          <div><span>الصندوق (كاش)</span><strong>${fmtMoney(s.cash_box)} ${cur()}</strong></div>
          <div><span>البنك والمحافظ</span><strong>${fmtMoney(s.bank)} ${cur()}</strong></div>
        </div>
        <div class="meta">اتفقت الشهر ده على أتعاب بـ ${fmtMoney(s.agreed_fees)} ${cur()} (${s.agreed_count} اتفاق) — بتتحسب لما تتحصّل.</div>
      </div>
      <div class="card ms-quick">
        <h3>⚡ سجّل بسرعة</h3>
        <div class="ms-quick-grid">
          ${can('fees.create') ? '<button class="btn btn-primary" data-ms="pay">💵 دفعة من موكل</button>' : ''}
          ${can('expenses.create') ? '<button class="btn btn-ghost" data-ms="expense">💸 مصروف</button>' : ''}
          ${can('fees.create') ? '<button class="btn btn-ghost" data-ms="fee">🤝 أتعاب جديدة</button>' : ''}
          ${can('invoices.create') ? '<button class="btn btn-ghost" data-ms="invoice">📄 فاتورة</button>' : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3>🧾 فلوس عند الموكلين: ${fmtMoney(s.receivable_total)} ${cur()}</h3>
      </div>
      ${s.debtors.length ? `<div class="ms-debtors">${s.debtors.map(c => `
        <div class="ms-debtor">
          <div class="ms-debtor-info"><strong>${esc(c.name)}</strong><span class="meta">${c.phone ? esc(c.phone) : 'من غير رقم'}</span></div>
          <div class="ms-debtor-amt">${fmtMoney(c.balance)} ${cur()}</div>
          <div class="ms-debtor-acts">
            <button class="btn btn-ghost btn-sm" data-st-client="${c.client_id}">📄 كشف حساب</button>
            ${c.phone ? `<button class="btn btn-ghost btn-sm wa-ghost" data-wa-client="${c.client_id}">💬 تذكير</button>` : ''}
          </div>
        </div>`).join('')}</div>` : empty('مفيش موكل عليه فلوس 🎉', '✅')}
      ${s.credit_clients?.length ? `<div class="meta" style="margin-top:10px">موكلين ليهم رصيد عندك (دفعوا مقدم): ${s.credit_clients.map(c => `${esc(c.name)} ${fmtMoney(-c.balance)}`).join('، ')}</div>` : ''}
    </div>
  `;

  host.querySelector('[data-ms="prev"]').addEventListener('click', () => { monthOffset--; renderSimple(host); });
  host.querySelector('[data-ms="next"]')?.addEventListener('click', () => { if (monthOffset < 0) { monthOffset++; renderSimple(host); } });
  host.querySelector('#ms-acc')?.addEventListener('change', (e) => {
    setAccountantMode(e.target.checked);
    toast(e.target.checked ? 'وضع المحاسب اتفعّل — القيود والقوائم المالية ظهرت في القايمة' : 'رجعنا للوضع المبسط', 'ok');
  });
  host.querySelectorAll('[data-st-client]').forEach(b => b.addEventListener('click', () => openStatement(b.dataset.stClient)));
  host.querySelectorAll('[data-wa-client]').forEach(b => b.addEventListener('click', () => {
    const c = s.debtors.find(x => String(x.client_id) === b.dataset.waClient);
    if (c) openWhatsAppComposer({ kind: 'fee', kinds: ['fee', 'general'], phone: c.phone, client_name: c.name, remaining: c.balance });
  }));
  const goto = async (v) => { const { showView } = await import('../router.js'); showView(v); };
  host.querySelector('[data-ms="expense"]')?.addEventListener('click', () => goto('money-expenses'));
  host.querySelector('[data-ms="fee"]')?.addEventListener('click', () => goto('fees'));
  host.querySelector('[data-ms="invoice"]')?.addEventListener('click', () => goto('money-invoices'));
  host.querySelector('[data-ms="pay"]')?.addEventListener('click', () => quickPayment(() => renderSimple(host)));
}

// دفعة سريعة: موكل → (أتعاب لو فيه) → المبلغ
async function quickPayment(onDone) {
  let clients = [], fees = [];
  try {
    const [c, f] = await Promise.all([apiJson('/api/clients'), apiJson('/api/fees', { skipCache: true })]);
    clients = Array.isArray(c) ? c : (c.items || []);
    fees = (Array.isArray(f) ? f : (f.items || [])).filter(x => (x.amount_due || 0) > (x.amount_paid || 0));
  } catch (e) { return toast('⚠️ ' + e.message, 'bad'); }
  const res = await openModal({
    title: '💵 دفعة من موكل',
    submitText: 'تسجيل',
    initialData: { payment_date: localISO(), method: 'نقدي' },
    fields: [
      { name: 'client_id', label: 'الموكل', type: 'select', required: true, options: [{ value: '', label: '— اختار الموكل —' }, ...clients.map(c => ({ value: c.id, label: c.name }))] },
      { name: 'fee_id', label: 'عن أتعاب معيّنة؟ (اختياري)', type: 'select', options: [{ value: '', label: '— على الحساب عموماً —' }, ...fees.map(f => ({ value: f.id, label: `${f.client_name || ''} — ${f.case_number ? 'قضية ' + f.case_number : (f.notes || 'أتعاب')} (باقي ${fmtMoney((f.amount_due || 0) - (f.amount_paid || 0))})` }))] },
      { name: 'amount', label: `المبلغ (${cur()})`, type: 'number', required: true },
      { name: 'payment_date', label: 'التاريخ', type: 'date', required: true },
      { name: 'method', label: 'طريقة الدفع', type: 'select', options: ['نقدي', 'تحويل بنكي', 'إنستاباي', 'فودافون كاش', 'شيك'] },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
    onSubmit: async (d) => {
      if (!(Number(d.amount) > 0)) throw new Error('اكتب المبلغ');
      const fee = fees.find(f => String(f.id) === String(d.fee_id));
      if (fee && String(fee.client_id) !== String(d.client_id)) throw new Error('الأتعاب دي لموكل تاني');
      await apiJson('/api/payments', { method: 'POST', body: JSON.stringify({
        client_id: Number(d.client_id), fee_id: d.fee_id ? Number(d.fee_id) : null,
        amount: Number(d.amount), payment_date: d.payment_date, method: d.method, notes: d.notes || null,
      }) });
    },
  });
  if (res) { toast('✓ اتسجلت الدفعة', 'ok'); onDone?.(); }
}
