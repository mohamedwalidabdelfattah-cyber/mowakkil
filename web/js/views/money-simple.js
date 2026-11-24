// web/js/views/money-simple.js
// الوضع المبسط للإدارة المالية: الفلوس اللي دخلت وخرجت فعلاً، اللي معاك، ومين عليه فلوس
// (من غير مصطلحات محاسبية — "وضع المحاسب" بزرار)

import { apiJson, hasFeature } from '../api.js';
import { esc, toast, empty, skeleton, fmtMoney, cur, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { openModal } from '../modal.js';
import { can } from '../access.js';
import { openStatement } from '../statement.js';
import { openWhatsAppComposer } from '../whatsapp.js';
import { toExcel } from '../exporter.js';

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
        ${s.trust_held > 0 ? `<div class="meta" style="margin-bottom:6px">💼 منها أمانات للموكلين (مقدم مصاريف): <strong>${fmtMoney(s.trust_held)} ${cur()}</strong> — مش فلوسك لحد ما تتصرف عليهم.</div>` : ''}
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

    ${hasFeature('finance_advanced') && can('settings.manage') ? `
    <div class="card ms-adv">
      <h3>🗂️ أدوات المكاتب الكبيرة</h3>
      <div class="ms-adv-row">
        <div>
          <strong>🔒 قفل الفترات</strong>
          <div class="meta">${s.lock_before ? `مقفول: مفيش إضافة أو تعديل لأي حركة قبل <strong>${esc(s.lock_before)}</strong>` : 'مفيش قفل — أي شهر قديم ممكن يتعدّل'}</div>
        </div>
        <div class="ms-adv-acts">
          <input type="month" id="lock-month" class="input" value="${localISO(s.lock_before ? new Date(new Date(s.lock_before + 'T00:00:00').setDate(0)) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)).slice(0, 7)}" aria-label="اقفل لحد آخر الشهر ده">
          <button class="btn btn-ghost btn-sm" data-ms="lock">اقفل لحد آخره</button>
          ${s.lock_before ? '<button class="btn btn-ghost btn-sm" data-ms="unlock">فتح القفل</button>' : ''}
        </div>
      </div>
      <div class="ms-adv-row">
        <div><strong>📤 تصدير للمحاسب الخارجي</strong><div class="meta">ملف Excel فيه الدفعات والمصروفات والفواتير والأتعاب والأمانات للشهر ده.</div></div>
        <div class="ms-adv-acts"><button class="btn btn-ghost btn-sm" data-ms="export">⬇️ تصدير ${esc(monthLabel)}</button></div>
      </div>
      <div class="ms-adv-row">
        <div><strong>✋ موافقة المدير على المصروفات الكبيرة</strong><div class="meta">أي مصروف يسجّله حد من الفريق فوق المبلغ ده بيستنى موافقتك قبل ما يتخصم من الخزنة. سيبه فاضي لو مش عاوز موافقات.</div></div>
        <div class="ms-adv-acts">
          <input type="number" id="appr-limit" class="input" min="0" step="1" placeholder="مثلاً 2000" style="max-width:130px" aria-label="حد الموافقة">
          <button class="btn btn-ghost btn-sm" data-ms="appr-save">حفظ</button>
        </div>
      </div>
      <div class="ms-adv-row ms-branches-row">
        <div style="flex:1;min-width:0">
          <strong>🏢 الفروع (مراكز التكلفة)</strong>
          <div class="meta">اربط كل قضية ومصروف بفرع، وشوف ربح كل فرع لوحده في صفحة الربحية.</div>
          <div id="ms-branches" class="ms-branches"><span class="meta">جاري التحميل…</span></div>
        </div>
        <div class="ms-adv-acts">
          <input type="text" id="branch-name" class="input" maxlength="80" placeholder="اسم الفرع" style="max-width:160px" aria-label="اسم الفرع الجديد">
          <button class="btn btn-ghost btn-sm" data-ms="branch-add">➕ إضافة فرع</button>
        </div>
      </div>
    </div>` : ''}

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
  host.querySelector('[data-ms="lock"]')?.addEventListener('click', async () => {
    const mv = host.querySelector('#lock-month').value; // YYYY-MM
    if (!mv) return;
    const [y, mo] = mv.split('-').map(Number);
    const lockBefore = localISO(new Date(y, mo, 1)); // أول الشهر اللي بعده
    if (!confirm(`هتقفل كل الحركات لحد آخر ${mv} — محدش هيقدر يضيف أو يعدّل أو يحذف حاجة قبل ${lockBefore}. متأكد؟`)) return;
    try { await apiJson('/api/fees/lock', { method: 'POST', body: JSON.stringify({ lock_before: lockBefore }) }); toast('🔒 اتقفلت الفترة', 'ok'); renderSimple(host); }
    catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  });
  host.querySelector('[data-ms="unlock"]')?.addEventListener('click', async () => {
    if (!confirm('تفتح القفل؟ أي حد عنده صلاحية هيقدر يعدّل الشهور القديمة.')) return;
    try { await apiJson('/api/fees/lock', { method: 'POST', body: JSON.stringify({ lock_before: null }) }); toast('اتفتح القفل', 'ok'); renderSimple(host); }
    catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  });
  host.querySelector('[data-ms="export"]')?.addEventListener('click', () => exportForAccountant(from, to, monthLabel));
  if (host.querySelector('#ms-branches')) wireAdvanced(host);

  const goto = async (v) => { const { showView } = await import('../router.js'); showView(v); };
  host.querySelector('[data-ms="expense"]')?.addEventListener('click', () => goto('money-expenses'));
  host.querySelector('[data-ms="fee"]')?.addEventListener('click', () => goto('fees'));
  host.querySelector('[data-ms="invoice"]')?.addEventListener('click', () => goto('money-invoices'));
  host.querySelector('[data-ms="pay"]')?.addEventListener('click', () => quickPayment(() => renderSimple(host)));
}

// الفروع وحد الموافقة (الباقة المتقدمة)
async function wireAdvanced(host) {
  const box = host.querySelector('#ms-branches');
  const limitIn = host.querySelector('#appr-limit');
  apiJson('/api/settings', { silent: true, skipCache: true }).then(st => {
    const v = (st && (st.settings || st))?.expense_approval_limit;
    if (v != null && limitIn) limitIn.value = v;
  }).catch(() => {});
  host.querySelector('[data-ms="appr-save"]')?.addEventListener('click', async () => {
    const raw = limitIn.value.trim();
    try {
      await apiJson('/api/settings', { method: 'PATCH', body: JSON.stringify({ expense_approval_limit: raw === '' ? null : Number(raw) }) });
      toast(raw === '' ? 'اتلغت الموافقات — كل المصروفات بتتسجل على طول' : `✅ أي مصروف فوق ${fmtMoney(Number(raw))} ${cur()} هيستنى موافقتك`, 'ok');
    } catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  });

  const load = async () => {
    let list = [];
    try { list = await apiJson('/api/branches', { skipCache: true }); } catch (e) { box.innerHTML = `<span class="meta">⚠️ ${esc(e.message)}</span>`; return; }
    box.innerHTML = list.length ? list.map(b => `
      <span class="ms-branch">
        <span>${esc(b.name)}</span><span class="meta">${b.cases_count} قضية</span>
        <button class="icon-btn" data-br-ren="${b.id}" title="تغيير الاسم" aria-label="تغيير اسم ${esc(b.name)}">✏️</button>
        <button class="icon-btn" data-br-del="${b.id}" title="حذف" aria-label="حذف ${esc(b.name)}">🗑️</button>
      </span>`).join('') : '<span class="meta">لسه مفيش فروع</span>';
    box.querySelectorAll('[data-br-ren]').forEach(btn => btn.addEventListener('click', async () => {
      const b = list.find(x => String(x.id) === btn.dataset.brRen);
      const name = prompt('الاسم الجديد للفرع', b?.name || '');
      if (!name || name.trim() === b?.name) return;
      try { await apiJson(`/api/branches/${b.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }); load(); }
      catch (e) { toast('⚠️ ' + e.message, 'bad'); }
    }));
    box.querySelectorAll('[data-br-del]').forEach(btn => btn.addEventListener('click', async () => {
      const b = list.find(x => String(x.id) === btn.dataset.brDel);
      if (!confirm(`تحذف فرع "${b?.name}"؟ القضايا والمصروفات بتاعته هتفضل موجودة بس من غير فرع.`)) return;
      try { await apiJson(`/api/branches/${b.id}`, { method: 'DELETE' }); toast('اتحذف الفرع', 'ok'); load(); }
      catch (e) { toast('⚠️ ' + e.message, 'bad'); }
    }));
  };
  const nameIn = host.querySelector('#branch-name');
  const add = async () => {
    const name = nameIn.value.trim();
    if (name.length < 2) return toast('اكتب اسم الفرع', 'bad');
    try { await apiJson('/api/branches', { method: 'POST', body: JSON.stringify({ name }) }); nameIn.value = ''; toast('✅ اتضاف الفرع', 'ok'); load(); }
    catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  };
  host.querySelector('[data-ms="branch-add"]')?.addEventListener('click', add);
  nameIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  load();
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


// ============================================================
// تصدير للمحاسب الخارجي (Excel بشيتات)
// ============================================================
async function exportForAccountant(from, to, label) {
  toast('⏳ بنجهّز الملف…');
  try {
    const arr = (x) => (Array.isArray(x) ? x : (x?.items || x?.data || []));
    const inRange = (d) => { const s = String(d || '').slice(0, 10); return s >= from && s <= to; };
    const [pays, exps, invs, fees] = await Promise.all([
      apiJson(`/api/payments?from=${from}&to=${to}`, { skipCache: true }).then(arr),
      apiJson(`/api/expenses?from=${from}&to=${to}&limit=1000`, { skipCache: true }).then(arr),
      apiJson('/api/invoices', { skipCache: true }).then(arr).catch(() => []),
      apiJson('/api/fees', { skipCache: true }).then(arr),
    ]);
    const s = await apiJson(`/api/fees/cash-summary?from=${from}&to=${to}`, { skipCache: true });
    await toExcel({
      title: `مُوكِّل — ${label}`,
      blocks: [
        { type: 'kv', heading: 'ملخص', pairs: [['من', from], ['إلى', to], ['اتحصّل', s.collected, 'money'], ['منه نقدي', s.collected_cash, 'money'], ['منه بنك/محافظ', s.collected_bank, 'money'],
          ['مصروفات على المكتب', s.spent_office, 'money'], ['مصروفات عن الموكلين', s.spent_for_clients, 'money'], ['الصافي', s.net, 'money'],
          ['رصيد الصندوق', s.cash_box, 'money'], ['رصيد البنك', s.bank, 'money'], ['أمانات الموكلين', s.trust_held, 'money'], ['مديونيات الموكلين', s.receivable_total, 'money']] },
        { type: 'table', heading: 'الدفعات', columns: [{ key: 'payment_date', label: 'التاريخ', type: 'date' }, { key: 'receipt_number', label: 'الإيصال' }, { key: 'client_name', label: 'الموكل' }, { key: 'case_number', label: 'القضية' }, { key: 'method', label: 'الطريقة' }, { key: 'amount', label: 'المبلغ', type: 'money' }, { key: 'notes', label: 'ملاحظات' }], rows: pays },
        { type: 'table', heading: 'المصروفات', columns: [{ key: 'date', label: 'التاريخ', type: 'date' }, { key: 'description', label: 'البيان' }, { key: 'account_name', label: 'النوع' }, { key: 'case_number', label: 'القضية' }, { key: 'who', label: 'مين اتحمّله', value: e => e.from_trust ? 'أمانة الموكل' : e.on_client ? 'الموكل' : 'المكتب' }, { key: 'payment_method', label: 'الطريقة' }, { key: 'amount', label: 'المبلغ', type: 'money' }], rows: exps },
        { type: 'table', heading: 'الفواتير', columns: [{ key: 'issue_date', label: 'التاريخ', type: 'date' }, { key: 'invoice_number', label: 'الرقم' }, { key: 'client_name', label: 'الموكل' }, { key: 'status', label: 'الحالة' }, { key: 'subtotal', label: 'قبل الضريبة', type: 'money' }, { key: 'tax_amount', label: 'الضريبة', type: 'money' }, { key: 'total', label: 'الإجمالي', type: 'money' }, { key: 'paid_amount', label: 'المدفوع', type: 'money' }], rows: invs.filter(i => inRange(i.issue_date)) },
        { type: 'table', heading: 'الأتعاب', columns: [{ key: 'created_at', label: 'التاريخ', type: 'date' }, { key: 'client_name', label: 'الموكل' }, { key: 'case_number', label: 'القضية' }, { key: 'amount_due', label: 'المتفق', type: 'money' }, { key: 'amount_paid', label: 'المدفوع', type: 'money' }, { key: 'status', label: 'الحالة' }], rows: fees.filter(f => inRange(f.created_at)) },
      ],
    }, `للمحاسب ${from}_${to}`);
  } catch (e) { toast('⚠️ ' + e.message, 'bad'); }
}
