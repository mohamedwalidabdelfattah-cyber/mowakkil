// web/js/views/cases.js
import { apiJson, api, uploadDocument, downloadDocument } from '../api.js';
import { esc, empty, toast, skeleton, fmtMoney, fmtDate, cur, curName, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { getClients, setCases } from '../state.js';
import { caseTypeOptions, degreeOptions, caseTypeGroups, degreeGroups, clientRoles, clientRoleOptions } from '../case-types.js';
import { renderAttachments, DOC_CATEGORIES } from '../attachments.js';
import { mountExportMenu, filterMeta } from '../exporter.js';
import { bindPanels } from '../ui.js';
import { openModal } from '../modal.js';
import { hasFeature as hasFeatureFn } from '../api.js';
import { can } from '../access.js';
import { openWhatsAppComposer, localDateStr } from '../whatsapp.js';
import { mountAiMeter } from '../ai-usage.js';
import { isSaudi } from '../country.js';
import { sessionActionsHTML, bindSessionActions } from '../session-edit.js';
import { editFee, canEditFee } from '../fee-edit.js';

let currentFilters = {
  archived: false,
  search: '',
  type: '',
  court: '',
};

export async function render(host) {
  // skeleton احترافي
  host.innerHTML = `
    <div class="card">${skeleton(3, 'card')}</div>
    <div class="card">${skeleton(3, 'list')}</div>
  `;

  const loadAndRender = async () => {
    reloadCases = loadAndRender; // ملف القضية (النافذة) بيستخدمها عشان القايمة تتحدّث بعد أي تعديل
    // بناء الـ query string
    const params = new URLSearchParams();
    params.append('archived', currentFilters.archived ? '1' : '0');
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.type)   params.append('type', currentFilters.type);
    if (currentFilters.court)  params.append('court', currentFilters.court);

    const [cases, clients] = await Promise.all([
      apiJson(`/api/cases?${params.toString()}`),
      getClients().length ? Promise.resolve(getClients()) : apiJson('/api/clients'),
    ]);
    setCases(cases);

    const clientOpts = clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const caseOpts   = cases.map(c => `<option value="${c.id}">${esc(c.case_number || c.id)}</option>`).join('');

    host.innerHTML = `
      <div class="app-top">
        <div>
          <h2>القضايا</h2>
          <div class="meta" style="margin:2px 0 0">${cases.length} ${currentFilters.archived ? 'قضية مؤرشفة' : 'قضية مفتوحة'}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-toggle-panel="session-panel">📅 جلسة جديدة</button>
          <button class="btn btn-primary" data-toggle-panel="case-panel">➕ قضية جديدة</button>
        </div>
      </div>

      <div class="card" id="case-panel" hidden>
        <h3>إضافة قضية جديدة</h3>
        <div class="row">
          <div><label>الموكل</label>
            <select id="c-client"><option value="">— بدون تحديد —</option>${clientOpts}</select></div>
          <div><label>${isSaudi() ? 'رقم القضية (ناجز)' : 'رقم القضية'}</label><input id="c-num" placeholder="${isSaudi() ? '4470123456' : '1234 لسنة 2026'}"></div>
        </div>
        <div class="row">
          <div><label>${isSaudi() ? 'المحكمة والدائرة' : 'المحكمة'}</label><input id="c-court" placeholder="${isSaudi() ? 'المحكمة العامة بالرياض — الدائرة 12' : 'محكمة شمال القاهرة'}"></div>
          <div><label>${isSaudi() ? 'نوع المحكمة / الدرجة' : 'الدرجة'}</label>
            <select id="c-degree">${degreeOptions()}</select>
          </div>
          <div><label>النوع</label>
            <select id="c-type">
              <option value="">— اختر —</option>
              ${caseTypeOptions()}
            </select>
          </div>
          <div id="c-branch-wrap" hidden><label>الفرع</label>
            <select id="c-branch"><option value="">— من غير فرع —</option></select>
          </div>
        </div>
        <div class="row">
          <div><label>الخصم (اختياري)</label><input id="c-opponent" placeholder="اسم الخصم"></div>
          <div><label>صفة الموكل (اختياري)</label><select id="c-role">${clientRoleOptions()}</select></div>
        </div>
        <label>موضوع الدعوى (اختياري)</label>
        <textarea id="c-subject" rows="2" placeholder="مثلاً: تعويض عن فسخ عقد توريد"></textarea>
        <label>قيمة الدعوى (اختياري)</label>
        <input id="c-claim" type="number" min="0" step="any" inputmode="decimal" placeholder="المبلغ المطالب بيه">
        <button class="primary" style="margin-top:10px" id="add-case">حفظ القضية</button>
      </div>

      <div class="card" id="session-panel" hidden>
        <h3>إضافة جلسة لقضية</h3>
        <div class="row">
          <div><label>القضية</label><select id="sx-case">${caseOpts}</select></div>
          <div><label>تاريخ الجلسة</label><input id="sx-date" type="date"></div>
          <div><label>الساعة (الرول — اختياري)</label><input id="sx-time" type="time"></div>
        </div>
        <input id="sx-note" placeholder="ملاحظة (اختياري)">
        <button class="primary" style="margin-top:10px" id="add-session">حفظ الجلسة</button>
      </div>

      <!-- شريط الفلاتر -->
      <div class="filter-bar">
        <div class="filter-bar-inner">
          <div class="filter-item">
            <input type="text" class="filter-input" id="filter-search" 
                   placeholder="🔍 بحث برقم القضية أو الموكل أو الخصم..." 
                   value="${esc(currentFilters.search)}">
          </div>
          <div class="filter-item">
            <select class="filter-input" id="filter-type">
              <option value="">كل الأنواع</option>
              ${caseTypeOptions(currentFilters.type)}
            </select>
          </div>
          <div class="filter-item">
            <input type="text" class="filter-input" id="filter-court" 
                   placeholder="🏛️ بحث بالمحكمة" 
                   value="${esc(currentFilters.court)}">
          </div>
          <button class="btn btn-ghost filter-reset" id="filter-reset">🔄 مسح</button>
        </div>
      </div>

      <!-- التبويبات: المفتوحة / الأرشيف + التصدير -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <div class="filter-tabs">
        <button data-archived="0" class="${!currentFilters.archived ? 'active' : ''}">📂 القضايا المفتوحة</button>
        <button data-archived="1" class="${currentFilters.archived ? 'active' : ''}">🗄️ الأرشيف</button>
      </div>
      <div id="cases-export"></div>
      </div>

      <div id="cases-list">
        ${cases.length
          ? cases.map(c => caseItem(c)).join('')
          : empty(
              Object.values(currentFilters).some(v => v) && typeof currentFilters.search === 'string'
                ? 'مفيش نتايج مطابقة للفلاتر' 
                : 'مفيش قضايا لحد الآن',
              '⚖️'
            )
        }
      </div>
    `;

    bindPanels(host);

    // === التصدير (القايمة الحالية بعد الفلترة) ===
    mountExportMenu(host.querySelector('#cases-export'), () => ({
      title: currentFilters.archived ? 'القضايا المؤرشفة' : 'القضايا المفتوحة',
      landscape: true,
      meta: filterMeta([
        ['بحث', currentFilters.search], ['النوع', currentFilters.type], ['المحكمة', currentFilters.court],
      ]),
      blocks: [{
        type: 'table',
        columns: [
          { label: 'رقم القضية', key: 'case_number' },
          { label: 'الموكل', key: 'client_name' },
          { label: 'المحكمة', key: 'court' },
          { label: 'الدرجة', key: 'degree' },
          { label: 'النوع', key: 'case_type' },
          { label: 'الحالة', key: 'status' },
          { label: 'تاريخ الإضافة', key: 'created_at', type: 'date' },
        ],
        rows: cases,
      }],
    }), { filename: 'القضايا' });

    // === ربط أحداث الفلاتر ===

    let searchTimeout;
    host.querySelector('#filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        loadAndRender();
      }, 500);
    });

    host.querySelector('#filter-type')?.addEventListener('change', (e) => {
      currentFilters.type = e.target.value;
      loadAndRender();
    });

    host.querySelector('#filter-court')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.court = e.target.value.trim();
        loadAndRender();
      }, 500);
    });

    host.querySelector('#filter-reset')?.addEventListener('click', () => {
      currentFilters.search = '';
      currentFilters.type = '';
      currentFilters.court = '';
      loadAndRender();
    });

    host.querySelectorAll('[data-archived]').forEach(b => b.addEventListener('click', () => {
      currentFilters.archived = b.dataset.archived === '1';
      loadAndRender();
    }));

    // الفروع (المتقدمة): بتظهر بس لو المكتب عامل فروع
    fillBranchSelect(host.querySelector('#c-branch'), host.querySelector('#c-branch-wrap'));

    // === الأحداث القديمة ===
    host.querySelector('#add-case')?.addEventListener('click', async () => {
      const body = {
        client_id: host.querySelector('#c-client').value || null,
        case_number: host.querySelector('#c-num').value.trim(),
        court: host.querySelector('#c-court').value.trim(),
        degree: host.querySelector('#c-degree').value,
        case_type: host.querySelector('#c-type').value || null,
        branch_id: host.querySelector('#c-branch')?.value || null,
        opponent_name: host.querySelector('#c-opponent').value.trim() || null,
        client_role: host.querySelector('#c-role').value || null,
        subject: host.querySelector('#c-subject').value.trim() || null,
        claim_amount: host.querySelector('#c-claim').value || null,
      };
      if (!body.case_number && !body.court) return toast('اكتب رقم القضية أو المحكمة', 'bad');
      await apiJson('/api/cases', { method: 'POST', body: JSON.stringify(body) });
      toast('اتحفظت القضية', 'ok');
      loadAndRender();
    });

    host.querySelector('#add-session')?.addEventListener('click', async () => {
      const case_id = host.querySelector('#sx-case').value;
      const session_date = host.querySelector('#sx-date').value;
      if (!case_id || !session_date) return toast('اختار قضية وتاريخ', 'bad');
      await apiJson('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ case_id, session_date, session_time: host.querySelector('#sx-time').value || null, notes: host.querySelector('#sx-note').value.trim() }),
      });
      toast('اتسجلت الجلسة', 'ok');
      // نفضّي الفورم ونحدّث القايمة (عشان «الجلسة الجاية» تظهر على طول)
      ['#sx-date', '#sx-time', '#sx-note'].forEach(s => { const el = host.querySelector(s); if (el) el.value = ''; });
      loadAndRender();
    });

    // أزرار كل قضية
    host.querySelector('#cases-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-case-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.caseAction;

      if (action === 'view')     return showCaseDetail(id);
      if (action === 'ai')       return showCaseDetail(id, 'ai');
      if (action === 'edit') {
        try { const d = await apiJson(`/api/cases/${id}/profile`, { skipCache: true }); return editCaseInfo(d.case, loadAndRender); }
        catch (err) { return toast(err.message, 'bad'); }
      }
      if (action === 'archive')  { await apiJson(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'مؤرشفة' }) }); loadAndRender(); }
      if (action === 'restore')  { await apiJson(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'مفتوحة' }) }); loadAndRender(); }
      if (action === 'delete')   { if (confirm('متأكد من الحذف؟')) { await apiJson(`/api/cases/${id}`, { method: 'DELETE' }); loadAndRender(); toast('اتحذفت', 'ok'); } }
    });
  };

  await loadAndRender();
}

function caseItem(c) {
  return `
    <div class="item">
      <div class="top">
        <span class="name">${esc(c.client_name || '—')}</span>
        <span class="num mono">${esc(c.case_number || '—')}</span>
      </div>
      <div class="meta">${esc(c.court || '—')} · ${esc(c.degree || '')}${c.case_type ? ' · ' + esc(c.case_type) : ''}</div>
      ${c.opponent_name ? `<div class="meta">⚔️ ضد: ${esc(c.opponent_name)}${c.client_role ? ' · الموكل ' + esc(c.client_role) : ''}</div>` : ''}
      ${c.next_session ? `<div class="meta" style="color:var(--primary);font-weight:600">📅 الجلسة الجاية: ${esc(c.next_session)}</div>` : ''}
      <div class="acts">
        <button class="ghost" data-case-action="view" data-id="${c.id}" style="color:var(--primary);font-weight:700">👁 تفاصيل</button>
        <button class="ghost" data-case-action="ai" data-id="${c.id}" style="font-weight:700">🤖 تحليل ذكي</button>
        ${can('cases.edit') ? `<button class="ghost" data-case-action="edit" data-id="${c.id}">✏️ تعديل</button>` : ''}
        ${c.status === 'مؤرشفة'
          ? `<button class="ghost" data-case-action="restore" data-id="${c.id}">استرجاع</button>`
          : `<button class="ghost" data-case-action="archive" data-id="${c.id}">أرشفة</button>`}
        <button class="ghost" data-case-action="delete" data-id="${c.id}" style="color:var(--danger)">حذف</button>
      </div>
    </div>`;
}

// ============================================================
// تفاصيل القضية (Modal شامل)
// ============================================================
// فتح قضية من البحث أو الإشعارات
document.addEventListener('mowakkil:open-case', (e) => { if (e.detail?.id) showCaseDetail(Number(e.detail.id)); });

// إعادة تحميل قايمة القضايا (بتتظبط في render)
let reloadCases = null;

// تعديل بيانات القضية: الموكل والرقم والمحكمة والدرجة والنوع
async function editCaseInfo(c, onDone) {
  let clients = [];
  try { const r = await apiJson('/api/clients'); clients = Array.isArray(r) ? r : (r.items || r.clients || []); } catch {}
  const types = caseTypeGroups().flatMap(g => g.types);
  const degrees = degreeGroups().flatMap(g => g.items);
  const withCur = (list, v) => (v && !list.includes(v) ? [v, ...list] : list);
  const opt = v => ({ value: esc(v), label: esc(v) });
  const saved = await openModal({
    title: '✏️ تعديل بيانات القضية',
    submitText: 'حفظ التعديل',
    fields: [
      { name: 'client_id', label: 'الموكل', type: 'select', options: [{ value: '', label: '— بدون تحديد —' }, ...clients.map(x => ({ value: String(x.id), label: esc(x.name) }))] },
      { name: 'case_number', label: isSaudi() ? 'رقم القضية (ناجز)' : 'رقم القضية' },
      { name: 'court', label: isSaudi() ? 'المحكمة والدائرة' : 'المحكمة' },
      { name: 'degree', label: isSaudi() ? 'نوع المحكمة / الدرجة' : 'الدرجة', type: 'select', options: withCur(degrees, c.degree).map(opt) },
      { name: 'case_type', label: 'النوع', type: 'select', options: [{ value: '', label: '— اختر —' }, ...withCur(types, c.case_type).map(opt)] },
      { name: 'opponent_name', label: 'الخصم' },
      { name: 'client_role', label: 'صفة الموكل', type: 'select', options: [{ value: '', label: '— اختر —' }, ...withCur(clientRoles(), c.client_role).map(opt)] },
      { name: 'subject', label: 'موضوع الدعوى', type: 'textarea' },
      { name: 'claim_amount', label: `قيمة الدعوى (${cur()})`, type: 'number' },
    ],
    initialData: { client_id: String(c.client_id || ''), case_number: c.case_number || '', court: c.court || '', degree: c.degree || '', case_type: c.case_type || '',
      opponent_name: c.opponent_name || '', client_role: c.client_role || '', subject: c.subject || '', claim_amount: c.claim_amount ?? '' },
    onSubmit: async (d) => {
      await apiJson(`/api/cases/${c.id}`, { method: 'PATCH', body: JSON.stringify({ ...d, client_id: d.client_id || null }) });
    },
  });
  if (saved) { toast('✅ اتعدّلت بيانات القضية', 'ok'); await onDone?.(); }
}

async function showCaseDetail(id, initialTab = 'overview') {
  document.getElementById('case-detail-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'case-detail-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:720px;max-height:85vh;overflow:auto">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">📁 تفاصيل القضية</h3>
        <button class="icon-btn" data-action="close">✕</button>
      </div>
      <div id="case-detail-content">
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let waCtx = null; // بيتملى بعد ما ملف القضية يتحمّل
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]')) {
      modal.remove();
      return;
    }
    const wb = e.target.closest('[data-wa]');
    if (wb && waCtx) waCtx(wb.dataset.wa, wb.dataset.waId);
  });

  try {
    const d = await apiJson(`/api/cases/${id}/profile`);
    const { case: c, sessions, expenses, fees, documents, tasks, stats } = d;
    const hideFees = d.hidden?.fees || !can('fees.view');
    const hideExp = d.hidden?.expenses || !can('expenses.view');
    const todayStr = localDateStr();
    const nextSession = sessions
      .filter(s => String(s.session_date).slice(0, 10) >= todayStr)
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))[0];
    waCtx = (what, rowId) => {
      const base = { phone: c.client_phone, client_name: c.client_name, case_number: c.case_number, court: c.court };
      if (what === 'session') {
        const s = sessions.find(x => String(x.id) === String(rowId)) || nextSession;
        return openWhatsAppComposer({ ...base, kind: 'session', kinds: ['session', 'update', 'general'], session_date: s?.session_date });
      }
      if (what === 'fee') {
        const f = fees.find(x => String(x.id) === String(rowId));
        if (!f) return;
        return openWhatsAppComposer({ ...base, kind: 'fee', kinds: ['fee', 'general'],
          remaining: (f.amount_due || 0) - (f.amount_paid || 0), due_date: f.due_date });
      }
      const kinds = nextSession ? ['update', 'session', 'general'] : ['general'];
      return openWhatsAppComposer({ ...base, kind: kinds[0], kinds, session_date: nextSession?.session_date });
    };

    const tabsHtml = `
      <div class="case-tabs" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border-soft);overflow-x:auto">
        <button class="case-tab ${initialTab === 'overview' ? 'active' : ''}" data-tab="overview">📋 نظرة عامة</button>
        ${can('ai.use') ? `<button class="case-tab ${initialTab === 'ai' ? 'active' : ''}" data-tab="ai">🤖 تحليل ذكي</button>` : ''}
        <button class="case-tab" data-tab="sessions">📅 الجلسات (${sessions.length})</button>
        ${hideFees ? '' : `<button class="case-tab" data-tab="fees">💰 الأتعاب (${fees.length})</button>`}
        ${hideExp ? '' : `<button class="case-tab" data-tab="expenses">💸 المصاريف (${expenses.length})</button>`}
        ${can('documents.view') ? `<button class="case-tab" data-tab="docs">📎 المستندات (${documents.length})</button>` : ''}
        ${can('tasks.view') ? `<button class="case-tab" data-tab="tasks">✅ المهام (${tasks.length})</button>` : ''}
      </div>
    `;

    document.getElementById('case-detail-content').innerHTML = `
      <div style="text-align:center;padding:8px 0 16px;border-bottom:1px solid var(--border-soft);margin-bottom:16px">
        <div style="font-size:20px;font-weight:800">${esc(c.case_number || 'قضية #' + c.id)}</div>
        <div style="font-size:13px;color:var(--text-soft);margin-top:4px">
          ${esc(c.court || '—')} ${c.degree ? '· ' + esc(c.degree) : ''}
        </div>
        <span class="badge ${c.status === 'مؤرشفة' ? 'suspended' : 'active'}" style="margin-top:8px;display:inline-block">
          ${esc(c.status)}
        </span>
      </div>

      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><div class="l">📅 جلسات</div><div class="n primary">${stats.sessions_count}</div></div>
        ${hideFees ? `
        <div class="stat"><div class="l">✅ مهام</div><div class="n">${stats.tasks_count}</div></div>
        <div class="stat"><div class="l">📎 مستندات</div><div class="n">${stats.documents_count}</div></div>` : `
        <div class="stat"><div class="l">💰 إجمالي الأتعاب</div><div class="n">${fmtMoney(stats.total_fees)}</div></div>
        <div class="stat"><div class="l">✅ مدفوع</div><div class="n success">${fmtMoney(stats.total_paid)}</div></div>
        <div class="stat"><div class="l">⚠️ متبقي</div><div class="n danger">${fmtMoney(stats.total_remaining)}</div></div>`}
      </div>

      ${tabsHtml}

      <div id="case-tab-content"></div>
    `;

    const renderTab = (tab) => {
      const el = document.getElementById('case-tab-content');

      if (tab === 'overview') {
        el.innerHTML = `
          <div class="card" style="background:var(--gray-50)">
            <h4 style="margin:0 0 12px;font-size:14px">👤 الموكل</h4>
            <div style="display:flex;justify-content:space-between;font-size:13.5px">
              <span>الاسم:</span>
              <strong>${esc(c.client_name || '—')}</strong>
            </div>
            ${c.client_phone ? `
              <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
                <span>الهاتف:</span>
                <strong style="font-family:var(--font-mono)">${esc(c.client_phone)}</strong>
              </div>
            ` : ''}
            ${c.client_id ? `<button class="btn btn-sm wa-send" data-wa="client" style="margin-top:10px">💬 رسالة واتساب للموكل</button>` : ''}
          </div>
          <div class="card" style="background:var(--gray-50)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 12px">
              <h4 style="margin:0;font-size:14px">📁 بيانات القضية</h4>
              ${can('cases.edit') ? `<button class="btn btn-ghost btn-sm" data-edit-case>✏️ تعديل البيانات</button>` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px">
              <span>المحكمة:</span><strong>${esc(c.court || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>الدرجة:</span><strong>${esc(c.degree || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>النوع:</span><strong>${esc(c.case_type || '—')}</strong>
            </div>
            ${c.opponent_name ? `<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>الخصم:</span><strong>${esc(c.opponent_name)}</strong>
            </div>` : ''}
            ${c.client_role ? `<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>صفة الموكل:</span><strong>${esc(c.client_role)}</strong>
            </div>` : ''}
            ${c.claim_amount ? `<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>قيمة الدعوى:</span><strong>${fmtMoney(c.claim_amount)} ${cur()}</strong>
            </div>` : ''}
            ${c.subject ? `<div style="font-size:13.5px;margin-top:8px;line-height:1.7"><span>موضوع الدعوى:</span> <strong style="font-weight:600">${esc(c.subject)}</strong></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>الحالة:</span><strong>${esc(c.status)}</strong>
            </div>
            <div id="cp-branch-wrap" style="display:none;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px;margin-top:6px">
              <span>الفرع:</span>
              ${can('cases.edit') ? '<select id="cp-branch" style="max-width:180px;padding:4px 8px"><option value="">— من غير فرع —</option></select>' : '<strong id="cp-branch-name">—</strong>'}
            </div>
          </div>
          <div class="card" style="background:var(--gray-50)" id="case-team-card">
            <h4 style="margin:0 0 8px;font-size:14px">👥 فريق القضية</h4>
            <div class="meta">جاري التحميل...</div>
          </div>
        `;
        renderCaseTeam(document.getElementById('case-team-card'), c.id);
        fillCaseBranch(el, c);
        el.querySelector('[data-edit-case]')?.addEventListener('click', () =>
          editCaseInfo(c, () => { reloadCases?.(); showCaseDetail(id, 'overview'); }));
      }

      if (tab === 'sessions') {
        el.innerHTML = sessions.length
          ? sessions.map(s => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(s.session_date)}</span>
                  <span class="badge ${String(s.session_date).slice(0, 10) >= todayStr ? 'active' : 'trial'}">
                    ${String(s.session_date).slice(0, 10) >= todayStr ? 'قادمة' : 'منتهية'}
                  </span>
                </div>
                ${s.notes ? `<div class="meta">📝 ${esc(s.notes)}</div>` : ''}
                ${s.session_time ? `<div class="meta">🕘 ${esc(s.session_time)}</div>` : ''}
                ${c.client_id && String(s.session_date).slice(0, 10) >= todayStr
                  ? `<button class="btn btn-ghost btn-sm wa-ghost" data-wa="session" data-wa-id="${s.id}" style="margin-top:6px">💬 تذكير الموكل</button>` : ''}
                ${sessionActionsHTML(s)}
              </div>
            `).join('')
          : empty('مفيش جلسات', '📅');
        // تعديل/حذف → نعيد فتح ملف القضية على تاب الجلسات بالبيانات الجديدة
        bindSessionActions(el, sessions, () => showCaseDetail(id, 'sessions'));
        // إضافة جلسة من جوه ملف القضية
        if (can('agenda.create')) {
          el.insertAdjacentHTML('afterbegin', '<button class="btn btn-primary btn-sm" data-add-case-session style="margin-bottom:10px">➕ جلسة جديدة</button>');
          el.querySelector('[data-add-case-session]').addEventListener('click', async () => {
            const saved = await openModal({
              title: '📅 جلسة جديدة', submitText: 'حفظ الجلسة',
              fields: [
                { name: 'session_date', label: 'تاريخ الجلسة', type: 'date', required: true },
                { name: 'session_time', label: 'الساعة (الرول — اختياري)', type: 'time' },
                { name: 'notes', label: 'ملاحظة (اختياري)', type: 'textarea' },
              ],
              onSubmit: async (d) => {
                await apiJson('/api/sessions', { method: 'POST', body: JSON.stringify({ case_id: id, session_date: d.session_date, session_time: d.session_time || null, notes: d.notes || null }) });
              },
            });
            if (saved) { toast('✅ اتسجلت الجلسة', 'ok'); reloadCases?.(); showCaseDetail(id, 'sessions'); }
          });
        }
      }

      if (tab === 'fees') {
        el.innerHTML = fees.length
          ? fees.map(f => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${fmtMoney(f.amount_due)} ${cur()}</span>
                  <span class="badge ${f.status === 'مدفوع بالكامل' ? 'active' : f.status === 'متأخر' ? 'suspended' : 'trial'}">${esc(f.status)}</span>
                </div>
                <div class="meta">مدفوع: ${fmtMoney(f.amount_paid)} ${cur()} · ${esc(f.due_date || '')}</div>
                ${f.notes ? `<div class="meta">📝 ${esc(f.notes)}</div>` : ''}
                ${c.client_id && f.status !== 'مدفوع بالكامل' && (f.amount_due || 0) > (f.amount_paid || 0)
                  ? `<button class="btn btn-ghost btn-sm wa-ghost" data-wa="fee" data-wa-id="${f.id}" style="margin-top:6px">💬 تذكير بالأتعاب</button>` : ''}
                ${canEditFee() ? `<button class="btn btn-ghost btn-sm" data-edit-fee="${f.id}" style="margin-top:6px">✏️ تعديل</button>` : ''}
              </div>
            `).join('')
          : empty('مفيش أتعاب', '💰');
        el.querySelectorAll('[data-edit-fee]').forEach(b => b.addEventListener('click', () => {
          const f = fees.find(x => String(x.id) === b.dataset.editFee);
          if (f) editFee(f, () => showCaseDetail(id, 'fees'));
        }));
      }

      if (tab === 'expenses') {
        const SRC = { session: 'جلسة', task: 'مهمة', general: 'مصروف' };
        const onClient = expenses.filter(x => x.billable).reduce((s, x) => s + (Number(x.amount) || 0), 0);
        el.innerHTML = `
          ${can('expenses.create') ? `<button class="btn btn-primary btn-sm" data-add-case-expense style="margin-bottom:10px">➕ مصروف على القضية</button>` : ''}
          ${onClient ? `<div class="meta" style="margin-bottom:8px">على حساب الموكل: <strong>${fmtMoney(onClient)} ${cur()}</strong> (بتظهر في كشف حسابه)</div>` : ''}
          ${expenses.length ? expenses.map(x => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(x.description || 'مصروف')}</span>
                  <span class="num mono" style="color:var(--danger)">${fmtMoney(x.amount)} ${cur()}</span>
                </div>
                <div class="meta">📅 ${esc(x.session_date || x.date || '')} · ${SRC[x.source] || ''} · <span class="exp-who ${x.billable ? 'client' : 'office'}">${x.billable ? 'على الموكل' : 'على المكتب'}</span></div>
                ${can('expenses.delete') ? `<button class="btn btn-ghost btn-sm" data-del-case-exp="${x.source}:${x.id}" style="color:var(--danger);margin-top:6px">🗑 حذف</button>` : ''}
              </div>
            `).join('') : empty('مفيش مصاريف', '💸')}`;
        // حذف مصروف (جلسة / مهمة / عام) — كل نوع ليه مساره، والقيد في الحسابات بيتمسح معاه
        el.querySelectorAll('[data-del-case-exp]').forEach(b => b.addEventListener('click', async () => {
          const [src, xid] = b.dataset.delCaseExp.split(':');
          if (!confirm('متأكد من حذف المصروف ده؟ القيد بتاعه في الحسابات هيتمسح كمان.')) return;
          const path = `/api/expenses/${xid}?source=${src}`; // نفس حذف صفحة المصاريف (جلسة / مهمة / عام)
          try { await apiJson(path, { method: 'DELETE' }); toast('✅ اتحذف المصروف', 'ok'); showCaseDetail(id, 'expenses'); }
          catch (err) { toast(err.message, 'bad'); }
        }));
        el.querySelector('[data-add-case-expense]')?.addEventListener('click', async () => {
          const res = await openModal({
            title: '➕ مصروف على القضية',
            submitText: 'حفظ',
            initialData: { expense_date: localISO(), is_reimbursable: c.client_id ? '1' : '0', payment_method: 'نقدي' },
            fields: [
              { name: 'description', label: 'الوصف', required: true, placeholder: 'رسوم قيد الدعوى / دمغات / انتقالات' },
              { name: 'amount', label: `المبلغ (${cur()})`, type: 'number', required: true },
              { name: 'expense_date', label: 'التاريخ', type: 'date', required: true },
              { name: 'is_reimbursable', label: 'مين هيتحمّله؟', type: 'select', options: [
                ...(c.client_id ? [{ value: '1', label: 'الموكل (يتضاف لحسابه وكشف حسابه)' }] : []),
                ...(c.client_id && hasFeatureFn('accounting') ? [{ value: '2', label: 'من أمانة الموكل (مقدم المصاريف)' }] : []),
                { value: '0', label: 'المكتب' }] },
              { name: 'payment_method', label: 'اتدفع إزاي', type: 'select', options: ['نقدي', 'تحويل بنكي', 'إنستاباي', 'فودافون كاش', 'شيك'] },
            ],
            onSubmit: async (d) => {
              await apiJson('/api/expenses', { method: 'POST', body: JSON.stringify({ ...d, amount: Number(d.amount), case_id: c.id, client_id: c.client_id || null, is_reimbursable: d.is_reimbursable === '1' ? 1 : 0, paid_from_trust: d.is_reimbursable === '2' ? 1 : 0 }) });
            },
          });
          if (res) { toast('✓ اتسجل المصروف', 'ok'); showCaseDetail(c.id, 'expenses'); }
        });
      }

      if (tab === 'docs') {
        renderAttachments(el, {
          caseId: id,
          caseLabel: c.case_number, // اسم فولدر القضية لو الحفظ على كمبيوتر المكتب
          onChange: docs => {
            documents.splice(0, documents.length, ...docs);
            const t = modal.querySelector('.case-tab[data-tab="docs"]');
            if (t) t.textContent = `📎 المستندات (${docs.length})`;
          },
        });
      }

      if (tab === 'ai') {
        renderAiTab(el, c, documents);
      }

      if (tab === 'tasks') {
        el.innerHTML = tasks.length
          ? tasks.map(t => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(t.title)}</span>
                  <span class="badge ${t.status === 'منجزة' ? 'active' : 'trial'}">${esc(t.status)}</span>
                </div>
                <div class="meta">${t.lawyer_name ? '👤 ' + esc(t.lawyer_name) + ' · ' : ''}📅 ${esc(t.due_date || '—')}</div>
                ${t.notes ? `<div class="meta">📝 ${esc(t.notes)}</div>` : ''}
              </div>
            `).join('')
          : empty('مفيش مهام', '✅');
        // إضافة مهمة للقضية من جوه ملفها
        if (can('tasks.create')) {
          el.insertAdjacentHTML('afterbegin', '<button class="btn btn-primary btn-sm" data-add-case-task style="margin-bottom:10px">➕ مهمة جديدة</button>');
          el.querySelector('[data-add-case-task]').addEventListener('click', async () => {
            const saved = await openModal({
              title: '✅ مهمة جديدة للقضية', submitText: 'حفظ المهمة',
              fields: [
                { name: 'title', label: 'المطلوب', required: true },
                { name: 'due_date', label: 'الموعد', type: 'date' },
                { name: 'notes', label: 'التفاصيل (اختياري)', type: 'textarea' },
              ],
              onSubmit: async (d) => {
                await apiJson('/api/tasks', { method: 'POST', body: JSON.stringify({ case_id: id, title: d.title, due_date: d.due_date || null, notes: d.notes || null }) });
              },
            });
            if (saved) { toast('✅ اتسجلت المهمة', 'ok'); showCaseDetail(id, 'tasks'); }
          });
        }
      }
    };

    renderTab(initialTab);
    modal.querySelectorAll('.case-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === initialTab));

    modal.querySelectorAll('.case-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.case-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTab(btn.dataset.tab);
      });
    });

  } catch (e) {
    document.getElementById('case-detail-content').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// تبويب "تحليل ذكي" — تحليل القضية بالذكاء الاصطناعي + المهارات القانونية
// ============================================================
const AI_DRAFT_KEY = id => `mw-case-ai-draft-${id}`;

function renderAiTab(el, c, documents = []) {
  let draft = {};
  try { draft = JSON.parse(localStorage.getItem(AI_DRAFT_KEY(c.id)) || '{}'); } catch {}

  const docsList = documents.length
    ? documents.map(d => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.5px;cursor:pointer">
          <input type="checkbox" class="ai-doc" value="${d.id}" checked style="width:auto">
          <span>📄 ${esc(d.file_name)}</span>
          ${d.doc_type ? `<span class="meta">${esc(d.doc_type)}</span>` : ''}
        </label>`).join('')
    : '<div class="meta">مفيش مرفقات للقضية لسه — ارفع ملف القضية من هنا.</div>';

  el.innerHTML = `
    <div class="ai-meter-slot" style="margin-bottom:10px"></div>
    <div class="card" style="background:var(--gray-50)">
      <div style="font-size:13px;color:var(--text-soft);margin-bottom:10px">
        التحليل بيقرا <strong>مرفقات القضية</strong> وبياناتها وجلساتها تلقائياً، ويستخدم مهارة قانونية حسب نوع القضية ومواد من قاعدة البيانات القانونية.
        الوقائع اختيارية — اكتبها لو عايز تضيف تفاصيل مش موجودة في المستندات.
      </div>

      <h4 style="margin:0 0 6px;font-size:14px">📎 مستندات القضية اللي هتتحلل</h4>
      <div id="ai-docs">${docsList}</div>
      <input type="file" id="ai-upload-file" style="display:none" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png">
      <div style="display:flex;gap:8px;margin:8px 0 12px;flex-wrap:wrap">
        <select id="ai-upload-type" style="flex:1;min-width:150px">
          <option value="">— نوع المستند —</option>
          ${DOC_CATEGORIES.map(c => `<option value="${esc(c.label)}">${c.icon} ${esc(c.label)}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" id="ai-upload-btn" style="flex:1;min-width:150px">⬆️ رفع مستند جديد للقضية</button>
      </div>
      <div id="ai-upload-status" class="status"></div>

      <div class="row">
        <div><label>نوع القضية</label>
          <select id="ai-type"><option value="">— غير محدد —</option>${caseTypeOptions(c.case_type || '')}</select></div>
        <div><label>صفة الموكل</label>
          <select id="ai-role">
            ${['', 'مدعي', 'مدعى عليه', 'متهم', 'مجني عليه / مدعي بالحق المدني', 'طاعن', 'مطعون ضده', 'مستأنف', 'مستأنف ضده']
              .map(r => `<option value="${esc(r)}" ${draft.client_role === r ? 'selected' : ''}>${r ? esc(r) : '— اختر —'}</option>`).join('')}
          </select></div>
      </div>
      <label>الخصم</label>
      <input id="ai-opponent" placeholder="اسم الخصم وصفته (اختياري)" value="${esc(draft.opponent || '')}">
      <label style="margin-top:8px">وقائع إضافية (اختياري)</label>
      <textarea id="ai-facts" rows="4" placeholder="أي تفاصيل مش موجودة في المستندات: موقف الخصم، اللي حصل في الجلسات، اللي الموكل حكاه...">${esc(draft.facts || '')}</textarea>
      <label style="margin-top:8px">الطلبات</label>
      <textarea id="ai-requests" rows="2" placeholder="الطلبات في الدعوى أو اللي الموكل عايزه (اختياري)">${esc(draft.requests || '')}</textarea>
      <details style="margin-top:8px">
        <summary style="cursor:pointer;font-size:13px">📄 لصق نص مستند من القضية (اختياري)</summary>
        <textarea id="ai-doc" rows="5" placeholder="الصق نص صحيفة الدعوى أو العقد أو المحضر...">${esc(draft.document_text || '')}</textarea>
      </details>
      <button class="btn btn-primary" id="ai-run" style="width:100%;margin-top:12px">🤖 حلل القضية</button>
    </div>
    <div id="ai-result"></div>
    <div id="ai-history" style="margin-top:12px"></div>
  `;
  mountAiMeter(el.querySelector('.ai-meter-slot'), { compact: true });

  const val = sel => el.querySelector(sel).value.trim();
  const collect = () => ({
    case_type: val('#ai-type'),
    client_role: val('#ai-role'),
    opponent: val('#ai-opponent'),
    facts: val('#ai-facts'),
    requests: val('#ai-requests'),
    document_text: val('#ai-doc'),
  });
  el.querySelectorAll('textarea, input, select').forEach(i => i.addEventListener('input', () => {
    try { localStorage.setItem(AI_DRAFT_KEY(c.id), JSON.stringify(collect())); } catch {}
  }));

  // ⬆️ رفع مستند جديد للقضية من نفس التبويب
  const upFile = el.querySelector('#ai-upload-file');
  const upStatus = el.querySelector('#ai-upload-status');
  el.querySelector('#ai-upload-btn').addEventListener('click', () => {
    if (!el.querySelector('#ai-upload-type').value) {
      upStatus.textContent = '⚠️ اختار نوع المستند الأول';
      upStatus.className = 'status bad';
      return;
    }
    upFile.click();
  });
  upFile.addEventListener('change', async () => {
    const file = upFile.files[0];
    if (!file) return;
    const upType = el.querySelector('#ai-upload-type').value || 'أخرى';
    if (file.size > 10 * 1024 * 1024) {
      upStatus.textContent = '⚠️ الملف أكبر من 10 ميجا';
      upStatus.className = 'status bad';
      return;
    }
    upStatus.textContent = '⏳ جاري الرفع...';
    upStatus.className = 'status';
    try {
      const d = await uploadDocument(file, { caseId: c.id, docType: upType });
      const newId = d?.id ?? d?.document?.id;
      const box = el.querySelector('#ai-docs');
      if (!documents.length) box.innerHTML = '';
      documents.unshift({ id: newId, file_name: file.name, doc_type: upType });
      box.insertAdjacentHTML('afterbegin', `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.5px;cursor:pointer">
          <input type="checkbox" class="ai-doc" value="${esc(newId ?? '')}" checked style="width:auto">
          <span>📄 ${esc(file.name)}</span><span class="meta">${esc(upType)} · جديد</span>
        </label>`);
      upStatus.textContent = '✅ اترفع واتضاف للتحليل';
      upStatus.className = 'status ok';
    } catch (e) {
      upStatus.textContent = '⚠️ ' + e.message;
      upStatus.className = 'status bad';
    } finally {
      upFile.value = '';
    }
  });

  const out = el.querySelector('#ai-result');
  const btn = el.querySelector('#ai-run');
  btn.addEventListener('click', async () => {
    const body = collect();
    const checked = [...el.querySelectorAll('.ai-doc:checked')].map(i => Number(i.value)).filter(Boolean);
    body.document_ids = checked;
    if (!checked.length && body.facts.length < 30 && body.document_text.length < 30) {
      return toast('اختار مستند من مرفقات القضية أو اكتب الوقائع', 'bad');
    }
    btn.disabled = true;
    btn.textContent = checked.length
      ? `⏳ جاري قراءة ${checked.length} مستند وتحليل القضية (ممكن ياخد دقيقة)...`
      : '⏳ جاري التحليل (ممكن ياخد دقيقة)...';
    out.innerHTML = skeleton(5);
    try {
      const d = await apiJson(`/api/cases/${c.id}/analyze`, { method: 'POST', body: JSON.stringify(body) });
      out.innerHTML = renderCaseAnalysis(d.result, d.provider);
      mountAnalysisExport(out, d.result, c);
      loadCaseAnalyses(el, c.id);
    } catch (e) {
      out.innerHTML = `<div class="warn">${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 حلل القضية';
    }
  });

  loadCaseAnalyses(el, c.id);
}

async function loadCaseAnalyses(el, caseId) {
  const box = el.querySelector('#ai-history');
  if (!box) return;
  try {
    const d = await apiJson(`/api/cases/${caseId}/analyses`, { skipCache: true });
    const items = d.items || [];
    if (!items.length) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <h4 style="margin:8px 0;font-size:14px">🗂️ تحليلات سابقة</h4>
      ${items.map(i => `
        <div class="item" style="cursor:pointer" data-analysis="${i.id}">
          <div class="name">${esc(i.title || 'تحليل')}</div>
          <div class="meta">${esc(i.created_at || '')}</div>
        </div>`).join('')}`;
    box.querySelectorAll('[data-analysis]').forEach(it => it.addEventListener('click', async () => {
      try {
        const r = await apiJson(`/api/analyze/history/${it.dataset.analysis}`);
        el.querySelector('#ai-result').innerHTML = renderCaseAnalysis(r.result);
        mountAnalysisExport(el.querySelector('#ai-result'), r.result, { case_number: r.title?.replace('تحليل قضية ', '') });
        el.querySelector('#ai-result').scrollIntoView({ behavior: 'smooth' });
      } catch (e) { toast(e.message, 'bad'); }
    }));
  } catch {
    box.innerHTML = '';
  }
}

// تصدير التحليل (Word / PDF) — بيتحط فوق نتيجة التحليل
function mountAnalysisExport(out, r = {}, c = {}) {
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;justify-content:flex-end;margin-top:12px';
  out.prepend(bar);
  const str = x => (typeof x === 'string' ? x : '');
  const fmtList = (arr, f) => (Array.isArray(arr) ? arr.map(x => (typeof x === 'string' ? x : f(x))).filter(Boolean) : []);
  mountExportMenu(bar, () => ({
    title: `التحليل القانوني للقضية ${c.case_number || ''}`.trim(),
    subtitle: [c.court, c.case_type].filter(Boolean).join(' · '),
    meta: filterMeta([['الموكل', c.client_name], ['تقييم فرص النجاح', r.success_probability]]),
    blocks: [
      { type: 'text', heading: 'الملخص', text: str(r.summary) },
      { type: 'kv', heading: 'التكييف والاختصاص', pairs: [['التكييف القانوني', r.classification || '—'], ['المحكمة المختصة', r.competent_court || '—'], ['فرص النجاح', `${r.success_probability || '—'} — ${r.success_reasoning || ''}`]] },
      { type: 'list', heading: 'القوانين والمواد المنطبقة', items: fmtList(r.applicable_laws, x => `${x.law || ''}${x.articles ? ' — ' + x.articles : ''}${x.relevance ? ': ' + x.relevance : ''}`) },
      { type: 'list', heading: 'نقاط القوة', items: fmtList(r.strengths, String) },
      { type: 'list', heading: 'نقاط الضعف', items: fmtList(r.weaknesses, String) },
      { type: 'list', heading: 'الدفوع الشكلية', items: fmtList(r.formal_defenses, x => `${x.defense || ''}${x.applies ? ' (' + x.applies + ')' : ''}${x.basis ? ' — السند: ' + x.basis : ''}`) },
      { type: 'list', heading: 'الدفاع الموضوعي', items: fmtList(r.substantive_defenses, x => `${x.defense || ''}${x.basis ? ' — السند: ' + x.basis : ''}`) },
      { type: 'list', heading: 'دفاع الخصم المتوقع والرد عليه', items: fmtList(r.opponent_arguments, x => `${x.argument || ''} ← الرد: ${x.response || ''}`) },
      { type: 'list', heading: 'المواعيد الحرجة', items: fmtList(r.deadlines, x => `${x.item || ''}: ${x.period || ''}${x.note ? ' (' + x.note + ')' : ''}`) },
      { type: 'list', heading: 'الأدلة والمستندات المطلوبة', items: fmtList(r.evidence_needed, String) },
      { type: 'list', heading: 'الخطوات التالية', items: fmtList(r.next_steps, String) },
      { type: 'list', heading: 'المخاطر', items: fmtList(r.risks, String) },
      { type: 'list', heading: 'معلومات ناقصة', items: fmtList(r.missing_info, String) },
      { type: 'text', heading: 'تنبيه', text: 'تحليل مساعد بالذكاء الاصطناعي — يجب مراجعته من محامٍ قبل الاعتماد عليه، وأي ميعاد أو رقم مادة يُراجع على النص الرسمي.' },
    ],
  }), { formats: ['word', 'pdf'], filename: `تحليل_قضية_${c.case_number || ''}` });
}

// ============================================================
// فريق القضية (مين مكلّف بيها) — اللي دوره "المكلّف بيها بس" بيشوف القضايا دي بس
// ============================================================
async function renderCaseTeam(el, caseId) {
  if (!el) return;
  let members = [], directory = [];
  try {
    [members, directory] = await Promise.all([
      apiJson(`/api/cases/${caseId}/members`, { skipCache: true }),
      can('cases.edit') ? apiJson('/api/team/directory') : Promise.resolve([]),
    ]);
  } catch (e) {
    el.innerHTML = `<h4 style="margin:0 0 8px;font-size:14px">👥 فريق القضية</h4><div class="meta">${esc(e.message)}</div>`;
    return;
  }
  const ids = new Set(members.map(m => m.id));
  const show = () => {
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h4 style="margin:0;font-size:14px">👥 فريق القضية</h4>
        ${can('cases.edit') ? '<button class="btn btn-ghost btn-sm" data-team-edit>✏️ تعديل</button>' : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        ${members.length ? members.map(m => `<span class="badge active">${esc(m.full_name || '—')}</span>`).join('')
          : '<span class="meta">محدش متكلّف بالقضية دي لسه.</span>'}
      </div>`;
    el.querySelector('[data-team-edit]')?.addEventListener('click', edit);
  };
  const edit = () => {
    el.innerHTML = `
      <h4 style="margin:0 0 8px;font-size:14px">👥 مين مكلّف بالقضية دي؟</h4>
      <div style="display:grid;gap:6px">
        ${directory.map(u => `<label class="perm-check"><input type="checkbox" value="${u.id}" ${ids.has(u.id) ? 'checked' : ''}>
          ${esc(u.full_name || '—')} <span class="meta" style="margin:0">(${esc(u.role_label)})</span></label>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary btn-sm" data-team-save>حفظ</button>
        <button class="btn btn-ghost btn-sm" data-team-cancel>إلغاء</button>
      </div>`;
    el.querySelector('[data-team-cancel]').addEventListener('click', show);
    el.querySelector('[data-team-save]').addEventListener('click', async () => {
      const user_ids = [...el.querySelectorAll('input:checked')].map(i => Number(i.value));
      try {
        await apiJson(`/api/cases/${caseId}/members`, { method: 'PUT', body: JSON.stringify({ user_ids }) });
        toast('اتحفظ فريق القضية ✓', 'ok');
        renderCaseTeam(el, caseId);
      } catch (e) { toast(e.message, 'bad'); }
    });
  };
  show();
}

// مراجعة الأسانيد آلياً (من السيرفر: verified / not_found / law_unknown)
function citeBadge(status) {
  if (status === 'verified') return '<span class="cite-badge ok">✓ متحقق</span>';
  if (status === 'not_found') return '<span class="cite-badge warn">⚠️ غير متحقق</span>';
  if (status === 'law_unknown') return '<span class="cite-badge info">ℹ️ يُراجع يدوياً</span>';
  return '';
}

function citationsSection(c) {
  if (!c || !c.checked) return '';
  const items = (c.items || []).map(i => `<li>${esc(i.citation)} ${citeBadge(i.status)}</li>`).join('');
  return `
    <div class="card cite-check" style="margin-bottom:10px">
      <h4 style="margin:0 0 6px;font-size:14px">🔎 مراجعة الأسانيد آلياً</h4>
      <div><span class="cite-ok">${esc(c.verified || 0)} متحقق</span> من ${esc(c.checked)} استشهاد في قاعدة المواد
        ${c.not_found ? ` · <span class="cite-warn">${esc(c.not_found)} غير متحقق</span>` : ''}
        ${c.law_unknown ? ` · ${esc(c.law_unknown)} بقوانين مش في القاعدة` : ''}</div>
      ${items ? `<ul style="margin:8px 0 0;padding-inline-start:20px">${items}</ul>` : ''}
      <div class="meta" style="font-size:12px;margin-top:6px">«غير متحقق» معناها إن المادة مش موجودة في قاعدة المواد عندنا — ممكن تكون غلط أو القاعدة ناقصة. راجعها على النص الرسمي قبل التقديم.</div>
    </div>`;
}

function renderCaseAnalysis(r = {}, provider = '') {
  if (r._raw) {
    return `<div class="card"><h4>📝 التحليل</h4><div style="white-space:pre-wrap">${esc(r.summary || '')}</div></div>`;
  }
  const list = (arr, fmt = x => esc(typeof x === 'string' ? x : JSON.stringify(x))) =>
    Array.isArray(arr) && arr.length ? `<ul style="margin:0;padding-inline-start:20px">${arr.map(x => `<li style="margin-bottom:6px">${fmt(x)}</li>`).join('')}</ul>` : '<div class="meta">—</div>';
  const section = (icon, title, html) => `
    <div class="card" style="margin-bottom:10px">
      <h4 style="margin:0 0 8px;font-size:14px">${icon} ${title}</h4>
      ${html}
    </div>`;
  const prob = String(r.success_probability || '');
  const probColor = prob.includes('عالي') ? 'var(--success)' : prob.includes('منخفض') ? 'var(--danger)' : 'var(--warning, #B8860B)';
  const meta = r._meta || {};

  return `
    <div style="margin-top:12px">
      ${section('📌', 'الملخص', `<div>${esc(r.summary || '—')}</div>
        ${r.classification ? `<div class="meta" style="margin-top:6px">⚖️ التكييف: ${esc(r.classification)}</div>` : ''}
        ${r.competent_court ? `<div class="meta">🏛️ المحكمة المختصة: ${esc(r.competent_court)}</div>` : ''}`)}
      ${prob ? section('🎯', 'تقييم فرص النجاح', `<strong style="color:${probColor}">${esc(prob)}</strong>
        <div class="meta" style="margin-top:4px">${esc(r.success_reasoning || '')}</div>`) : ''}
      ${section('📚', 'القوانين والمواد المنطبقة', list(r.applicable_laws, x => typeof x === 'string' ? esc(x)
        : `<strong>${esc(x.law || '')}</strong>${x.articles ? ` — ${esc(x.articles)}` : ''}${citeBadge(x.verification)}<div class="meta">${esc(x.relevance || '')}</div>`))}
      ${citationsSection(meta.citations)}
      ${section('💪', 'نقاط القوة', list(r.strengths))}
      ${section('⚠️', 'نقاط الضعف', list(r.weaknesses))}
      ${section('📋', 'الدفوع الشكلية', list(r.formal_defenses, x => typeof x === 'string' ? esc(x)
        : `<strong>${esc(x.defense || '')}</strong>${x.applies ? ` <span class="meta">(${esc(x.applies)})</span>` : ''}<div class="meta">${esc(x.basis || '')}</div>`))}
      ${section('⚖️', 'الدفاع الموضوعي', list(r.substantive_defenses, x => typeof x === 'string' ? esc(x)
        : `<strong>${esc(x.defense || '')}</strong><div class="meta">${esc(x.basis || '')}</div>`))}
      ${section('🥊', 'دفاع الخصم المتوقع والرد عليه', list(r.opponent_arguments, x => typeof x === 'string' ? esc(x)
        : `<strong>${esc(x.argument || '')}</strong><div class="meta">↩️ ${esc(x.response || '')}</div>`))}
      ${section('⏰', 'المواعيد الحرجة', list(r.deadlines, x => typeof x === 'string' ? esc(x)
        : `<strong>${esc(x.item || '')}</strong>: ${esc(x.period || '')}${x.note ? `<div class="meta">${esc(x.note)}</div>` : ''}`))}
      ${section('🗂️', 'الأدلة والمستندات المطلوبة', list(r.evidence_needed))}
      ${section('➡️', 'الخطوات التالية', list(r.next_steps))}
      ${section('🚨', 'المخاطر', list(r.risks))}
      ${section('❓', 'معلومات ناقصة', list(r.missing_info))}
      ${Array.isArray(meta.documents) && meta.documents.length ? `
        <div class="meta" style="font-size:12px;margin-top:6px">📎 المستندات المقروءة:
          ${meta.documents.map(d => d.read
            ? `✅ ${esc(d.file_name)}`
            : `⚠️ ${esc(d.file_name)} (${esc(d.error || 'مفيش نص')})`).join(' · ')}
        </div>` : ''}
      <div class="meta" style="font-size:12px;margin-top:6px">
        ${meta.skill ? `🧠 المهارة المستخدمة: ${esc(meta.skill)} · ` : ''}📚 مواد من الداتابيز: ${esc(meta.articles_found ?? 0)}
        ${provider ? ` · 🤖 ${esc(provider)}` : ''}
        ${meta.privacy ? ` · 🔒 ${esc({ strict: 'وضع سري', balanced: 'وضع متوازن', off: 'موقوف' }[meta.privacy.mode] || meta.privacy.mode)}${meta.privacy.masked ? ` (اتخفى ${esc(meta.privacy.masked)} بيان شخصي)` : ''}` : ''}
        <br>⚠️ تحليل مساعد بالذكاء الاصطناعي — لازم مراجعته من محامٍ قبل الاعتماد عليه، وأي ميعاد أو رقم مادة يُراجع على النص الرسمي.
      </div>
    </div>`;
}
// ============================================================
// الفروع (الباقة المتقدمة)
// ============================================================
async function loadBranches() {
  if (!hasFeatureFn('finance_advanced')) return [];
  try { const l = await apiJson('/api/branches', { silent: true }); return (l || []).filter(b => b.active); } catch { return []; }
}
async function fillBranchSelect(sel, wrap) {
  if (!sel) return;
  const list = await loadBranches();
  if (!list.length || !sel.isConnected) return;
  sel.insertAdjacentHTML('beforeend', list.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join(''));
  if (wrap) wrap.hidden = false;
}
async function fillCaseBranch(root, c) {
  const wrap = root.querySelector('#cp-branch-wrap');
  if (!wrap) return;
  const list = await loadBranches();
  if (!list.length || !wrap.isConnected) return;
  wrap.style.display = 'flex';
  const sel = root.querySelector('#cp-branch');
  if (!sel) { const n = root.querySelector('#cp-branch-name'); if (n) n.textContent = list.find(b => b.id === c.branch_id)?.name || '—'; return; }
  sel.insertAdjacentHTML('beforeend', list.map(b => `<option value="${b.id}" ${b.id === c.branch_id ? 'selected' : ''}>${esc(b.name)}</option>`).join(''));
  sel.addEventListener('change', async () => {
    try {
      await apiJson(`/api/cases/${c.id}`, { method: 'PATCH', body: JSON.stringify({ branch_id: sel.value || null }) });
      c.branch_id = sel.value ? Number(sel.value) : null;
      toast('✅ اتغيّر الفرع', 'ok');
    } catch (e) { toast('⚠️ ' + e.message, 'bad'); sel.value = c.branch_id || ''; }
  });
}
