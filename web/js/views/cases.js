// web/js/views/cases.js
import { apiJson, api } from '../api.js';
import { esc, empty, toast, skeleton, fmtMoney, fmtDate } from '../ui.js';
import { getClients, setCases } from '../state.js';

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
      <div class="card">
        <h3>إضافة قضية جديدة</h3>
        <div class="row">
          <div><label>الموكل</label>
            <select id="c-client"><option value="">— بدون تحديد —</option>${clientOpts}</select></div>
          <div><label>رقم القضية</label><input id="c-num" placeholder="1234 لسنة 2026"></div>
        </div>
        <div class="row">
          <div><label>المحكمة</label><input id="c-court" placeholder="محكمة شمال القاهرة"></div>
          <div><label>الدرجة</label>
            <select id="c-degree"><option>جزئي</option><option selected>ابتدائي</option><option>استئناف</option></select>
          </div>
          <div><label>النوع</label>
            <select id="c-type">
              <option value="">— اختر —</option>
              <option>مدني</option>
              <option>جنائي</option>
              <option>تجاري</option>
              <option>أسرة</option>
              <option>إداري</option>
            </select>
          </div>
        </div>
        <button class="primary" style="margin-top:10px" id="add-case">حفظ القضية</button>
      </div>

      <div class="card">
        <h3>إضافة جلسة لقضية</h3>
        <div class="row">
          <div><label>القضية</label><select id="sx-case">${caseOpts}</select></div>
          <div><label>تاريخ الجلسة</label><input id="sx-date" type="date"></div>
        </div>
        <input id="sx-note" placeholder="ملاحظة (اختياري)">
        <button class="primary" style="margin-top:10px" id="add-session">حفظ الجلسة</button>
      </div>

      <!-- شريط الفلاتر -->
      <div class="filter-bar">
        <div class="filter-bar-inner">
          <div class="filter-item">
            <input type="text" class="filter-input" id="filter-search" 
                   placeholder="🔍 بحث برقم القضية أو اسم الموكل..." 
                   value="${esc(currentFilters.search)}">
          </div>
          <div class="filter-item">
            <select class="filter-input" id="filter-type">
              <option value="">كل الأنواع</option>
              <option value="مدني"   ${currentFilters.type === 'مدني' ? 'selected' : ''}>مدني</option>
              <option value="جنائي"  ${currentFilters.type === 'جنائي' ? 'selected' : ''}>جنائي</option>
              <option value="تجاري"  ${currentFilters.type === 'تجاري' ? 'selected' : ''}>تجاري</option>
              <option value="أسرة"   ${currentFilters.type === 'أسرة' ? 'selected' : ''}>أسرة</option>
              <option value="إداري"  ${currentFilters.type === 'إداري' ? 'selected' : ''}>إداري</option>
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

      <!-- التبويبات: المفتوحة / الأرشيف -->
      <div class="filter-tabs" style="margin-bottom:12px">
        <button data-archived="0" class="${!currentFilters.archived ? 'active' : ''}">📂 القضايا المفتوحة</button>
        <button data-archived="1" class="${currentFilters.archived ? 'active' : ''}">🗄️ الأرشيف</button>
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

    // === الأحداث القديمة ===
    host.querySelector('#add-case')?.addEventListener('click', async () => {
      const body = {
        client_id: host.querySelector('#c-client').value || null,
        case_number: host.querySelector('#c-num').value.trim(),
        court: host.querySelector('#c-court').value.trim(),
        degree: host.querySelector('#c-degree').value,
        case_type: host.querySelector('#c-type').value || null,
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
        body: JSON.stringify({ case_id, session_date, notes: host.querySelector('#sx-note').value.trim() }),
      });
      toast('اتسجلت الجلسة', 'ok');
    });

    // أزرار كل قضية
    host.querySelector('#cases-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-case-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.caseAction;

      if (action === 'view')     return showCaseDetail(id);
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
      <div class="acts">
        <button class="ghost" data-case-action="view" data-id="${c.id}" style="color:var(--primary);font-weight:700">👁 تفاصيل</button>
        ${c.status === 'مؤرشفة'
          ? `<button class="ghost" data-case-action="restore" data-id="${c.id}">استرجاع</button>`
          : `<button class="ghost" data-case-action="archive" data-id="${c.id}">أرشفة</button>`}
        <button class="ghost" data-case-action="delete" data-id="${c.id}" style="color:var(--danger)">حذف</button>
      </div>
    </div>`;
}

// ============================================================
// تفاصيل القضية (Modal شامل) — لم يتغير
// ============================================================
async function showCaseDetail(id) {
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

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]')) {
      modal.remove();
    }
  });

  try {
    const d = await apiJson(`/api/cases/${id}/profile`);
    const { case: c, sessions, expenses, fees, documents, tasks, stats } = d;

    const tabsHtml = `
      <div class="case-tabs" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border-soft);overflow-x:auto">
        <button class="case-tab active" data-tab="overview">📋 نظرة عامة</button>
        <button class="case-tab" data-tab="sessions">📅 الجلسات (${sessions.length})</button>
        <button class="case-tab" data-tab="fees">💰 الأتعاب (${fees.length})</button>
        <button class="case-tab" data-tab="expenses">💸 المصاريف (${expenses.length})</button>
        <button class="case-tab" data-tab="docs">📎 المستندات (${documents.length})</button>
        <button class="case-tab" data-tab="tasks">✅ المهام (${tasks.length})</button>
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
        <div class="stat"><div class="l">💰 إجمالي الأتعاب</div><div class="n">${fmtMoney(stats.total_fees)}</div></div>
        <div class="stat"><div class="l">✅ مدفوع</div><div class="n success">${fmtMoney(stats.total_paid)}</div></div>
        <div class="stat"><div class="l">⚠️ متبقي</div><div class="n danger">${fmtMoney(stats.total_remaining)}</div></div>
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
          </div>
          <div class="card" style="background:var(--gray-50)">
            <h4 style="margin:0 0 12px;font-size:14px">📁 بيانات القضية</h4>
            <div style="display:flex;justify-content:space-between;font-size:13.5px">
              <span>المحكمة:</span><strong>${esc(c.court || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>الدرجة:</span><strong>${esc(c.degree || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>النوع:</span><strong>${esc(c.case_type || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>الحالة:</span><strong>${esc(c.status)}</strong>
            </div>
          </div>
        `;
      }

      if (tab === 'sessions') {
        el.innerHTML = sessions.length
          ? sessions.map(s => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(s.session_date)}</span>
                  <span class="badge ${new Date(s.session_date) >= new Date() ? 'active' : 'trial'}">
                    ${new Date(s.session_date) >= new Date() ? 'قادمة' : 'منتهية'}
                  </span>
                </div>
                ${s.notes ? `<div class="meta">📝 ${esc(s.notes)}</div>` : ''}
              </div>
            `).join('')
          : empty('مفيش جلسات', '📅');
      }

      if (tab === 'fees') {
        el.innerHTML = fees.length
          ? fees.map(f => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${fmtMoney(f.amount_due)} ج</span>
                  <span class="badge ${f.status === 'مدفوع بالكامل' ? 'active' : f.status === 'متأخر' ? 'suspended' : 'trial'}">${esc(f.status)}</span>
                </div>
                <div class="meta">مدفوع: ${fmtMoney(f.amount_paid)} ج · ${esc(f.due_date || '')}</div>
                ${f.notes ? `<div class="meta">📝 ${esc(f.notes)}</div>` : ''}
              </div>
            `).join('')
          : empty('مفيش أتعاب', '💰');
      }

      if (tab === 'expenses') {
        el.innerHTML = expenses.length
          ? expenses.map(x => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(x.description || 'مصروف')}</span>
                  <span class="num mono" style="color:var(--danger)">${fmtMoney(x.amount)} ج</span>
                </div>
                <div class="meta">📅 ${esc(x.session_date || x.created_at?.slice(0,10) || '')}</div>
              </div>
            `).join('')
          : empty('مفيش مصاريف', '💸');
      }

      if (tab === 'docs') {
        el.innerHTML = documents.length
          ? documents.map(doc => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(doc.file_name)}</span>
                  <span class="num mono">${esc(doc.doc_type || '')}</span>
                </div>
                <div class="acts" style="margin-top:6px">
                  <a class="ghost" href="/api/documents/${doc.id}/download" target="_blank" style="text-decoration:none">تحميل</a>
                </div>
              </div>
            `).join('')
          : empty('مفيش مستندات', '📎');
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
              </div>
            `).join('')
          : empty('مفيش مهام', '✅');
      }
    };

    renderTab('overview');

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
