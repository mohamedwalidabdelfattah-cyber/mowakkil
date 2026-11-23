// web/js/views/tasks.js
import { apiJson, api, uploadDocument, downloadDocument } from '../api.js';
import { renderAttachments } from '../attachments.js';
import { mountExportMenu, filterMeta } from '../exporter.js';
import { esc, empty, toast, waLink, fmtMoney, skeleton, bindPanels } from '../ui.js';
import { getLawyers, getCases } from '../state.js';

// حالة الفلاتر
let currentFilters = {
  search: '',
  status: '',
  due: '',
};

export async function render(host) {
  // Skeleton احترافي
  host.innerHTML = `
    <div class="card">${skeleton(2, 'card')}</div>
    <div class="card">${skeleton(4, 'list')}</div>
  `;

  const loadAndRender = async () => {
    // بناء الـ query string
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.due)    params.append('due', currentFilters.due);
    const qs = params.toString();
    const query = qs ? `?${qs}` : '';

    const [tasks, lawyers, cases] = await Promise.all([
      apiJson(`/api/tasks${query}`),
      getLawyers().length ? Promise.resolve(getLawyers()) : apiJson('/api/lawyers').catch(() => []),
      getCases().length ? Promise.resolve(getCases()) : apiJson('/api/cases').catch(() => []),
    ]);

    const lawyerOpts = lawyers.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    const caseOpts   = cases.map(c => `<option value="${c.id}">${esc(c.case_number || c.id)}</option>`).join('');

    host.innerHTML = `
      <div class="app-top">
        <div>
          <h2>المهام</h2>
          <div class="meta" style="margin:2px 0 0">${tasks.filter(t => t.status !== 'منجزة').length} مهمة مفتوحة من ${tasks.length}</div>
        </div>
        <button class="btn btn-primary" data-toggle-panel="task-panel">➕ مهمة جديدة</button>
      </div>

      <div class="card" id="task-panel" hidden>
        <h3>➕ مهمة جديدة</h3>
        <div class="row">
          <div><label>عنوان المهمة</label><input id="t-title" placeholder="مثال: تقديم مذكرة"></div>
          <div><label>الموعد</label><input id="t-date" type="date"></div>
        </div>
        <div class="row">
          <div><label>المحامي</label><select id="t-lawyer"><option value="">— بدون —</option>${lawyerOpts}</select></div>
          <div><label>القضية (اختياري)</label><select id="t-case"><option value="">— بدون قضية —</option>${caseOpts}</select></div>
        </div>
        <button class="primary" style="margin-top:10px" id="add-task">حفظ</button>
      </div>

      <!-- شريط الفلاتر -->
      <div class="filter-bar">
        <div class="filter-bar-inner">
          <div class="filter-item">
            <input type="text" class="filter-input" id="filter-search" 
                   placeholder="🔍 بحث بعنوان المهمة..." 
                   value="${esc(currentFilters.search)}">
          </div>
          <div class="filter-item">
            <select class="filter-input" id="filter-status">
              <option value="">كل الحالات</option>
              <option value="قيد التنفيذ" ${currentFilters.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
              <option value="منجزة" ${currentFilters.status === 'منجزة' ? 'selected' : ''}>منجزة</option>
              <option value="ملغية" ${currentFilters.status === 'ملغية' ? 'selected' : ''}>ملغية</option>
            </select>
          </div>
          <div class="filter-item">
            <select class="filter-input" id="filter-due">
              <option value="">كل المواعيد</option>
              <option value="overdue" ${currentFilters.due === 'overdue' ? 'selected' : ''}>⏰ متأخرة</option>
              <option value="today"   ${currentFilters.due === 'today' ? 'selected' : ''}>📅 اليوم</option>
              <option value="week"    ${currentFilters.due === 'week' ? 'selected' : ''}>📆 هذا الأسبوع</option>
            </select>
          </div>
          <button class="btn btn-ghost filter-reset" id="filter-reset">🔄 مسح</button>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="meta" style="margin:0">${tasks.length} نتيجة</span>
        <div id="tasks-export"></div>
      </div>

      <div id="tasks-list">
        ${tasks.length 
          ? tasks.map(t => renderTaskItem(t)).join('') 
          : empty(
              Object.values(currentFilters).some(v => v)
                ? 'مفيش نتايج مطابقة للفلاتر'
                : 'مفيش مهام لحد الآن',
              '✅',
              !Object.values(currentFilters).some(v => v)
                ? { text: '+ إضافة أول مهمة', onClick: () => document.getElementById('t-title')?.focus() }
                : null
            )
        }
      </div>
    `;

    bindPanels(host);

    // === التصدير (القايمة بعد الفلترة) ===
    mountExportMenu(host.querySelector('#tasks-export'), () => ({
      title: 'قائمة المهام',
      landscape: true,
      meta: filterMeta([
        ['بحث', currentFilters.search],
        ['الحالة', currentFilters.status],
        ['الموعد', { overdue: 'متأخرة', today: 'اليوم', week: 'هذا الأسبوع' }[currentFilters.due]],
      ]),
      blocks: [{
        type: 'table',
        columns: [
          { label: 'المهمة', key: 'title' },
          { label: 'المحامي', key: 'lawyer_name' },
          { label: 'القضية', key: 'case_number' },
          { label: 'الموعد', key: 'due_date', type: 'date' },
          { label: 'الحالة', value: t => (t.status !== 'منجزة' && t.due_date && new Date(t.due_date) < new Date() ? `${t.status || ''} (متأخرة)` : t.status) },
        ],
        rows: tasks,
      }],
    }), { filename: 'المهام' });

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

    host.querySelector('#filter-due')?.addEventListener('change', (e) => {
      currentFilters.due = e.target.value;
      loadAndRender();
    });

    host.querySelector('#filter-reset')?.addEventListener('click', () => {
      currentFilters = { search: '', status: '', due: '' };
      loadAndRender();
    });

    // === ربط أحداث إضافة المهمة ===
    host.querySelector('#add-task')?.addEventListener('click', async () => {
      const title = host.querySelector('#t-title').value.trim();
      if (!title) return toast('اكتب عنوان المهمة', 'bad');
      await apiJson('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          due_date: host.querySelector('#t-date').value || null,
          lawyer_id: host.querySelector('#t-lawyer').value || null,
          case_id: host.querySelector('#t-case').value || null,
        }),
      });
      toast('اتحفظ', 'ok');
      loadAndRender();
    });

    // === ربط أحداث كل مهمة ===
    host.querySelector('#tasks-list').addEventListener('click', async e => {
      const openBtn = e.target.closest('[data-open-task]');
      const editBtn = e.target.closest('[data-edit-task]');
      const doneBtn = e.target.closest('[data-done-task]');
      const delBtn  = e.target.closest('[data-del-task]');
      
      if (openBtn) showTaskModal(openBtn.dataset.openTask);
      if (editBtn) showEditTaskModal(editBtn.dataset.editTask, lawyers, cases, host, loadAndRender);
      if (doneBtn) { 
        await apiJson(`/api/tasks/${doneBtn.dataset.doneTask}/done`, { method: 'PATCH' }); 
        loadAndRender(); 
        toast('✅ تمّت', 'ok');
      }
      if (delBtn) {
        if (!confirm('متأكد من حذف المهمة؟')) return;
        try {
          await apiJson(`/api/tasks/${delBtn.dataset.delTask}`, { method: 'DELETE' });
          toast('اتحذفت', 'ok');
          loadAndRender();
        } catch (err) {
          toast(err.message, 'bad');
        }
      }
    });
  };

  await loadAndRender();
}

// ============================================================
// شكل المهمة
// ============================================================
function renderTaskItem(t) {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'منجزة';
  const statusClass = t.status === 'منجزة' ? 'active' : isOverdue ? 'suspended' : 'trial';

  return `
    <div class="item">
      <div class="top">
        <span class="name">${esc(t.title)}</span>
        <span class="badge ${statusClass}">${esc(t.status)}</span>
      </div>
      <div class="meta">
        ${t.lawyer_name ? '👤 ' + esc(t.lawyer_name) + ' · ' : ''}
        ${t.case_number ? '📁 قضية ' + esc(t.case_number) + ' · ' : ''}
        📅 ${esc(t.due_date || '—')}
        ${isOverdue ? ' · <span style="color:var(--danger);font-weight:700">⚠️ متأخرة</span>' : ''}
      </div>
      <div class="acts">
        <button class="ghost" data-open-task="${t.id}" style="color:var(--primary);font-weight:700">👁 تفاصيل</button>
        <button class="ghost" data-edit-task="${t.id}" style="color:var(--warning)">✏️ تعديل</button>
        ${t.status !== 'منجزة' ? `<button class="ghost" data-done-task="${t.id}" style="color:var(--success)">✅ تمّت</button>` : ''}
        <button class="ghost" data-del-task="${t.id}" style="color:var(--danger)">🗑 حذف</button>
      </div>
    </div>`;
}

// ============================================================
// Modal تعديل المهمة
// ============================================================
async function showEditTaskModal(id, lawyers, cases, host, onDone) {
  const task = await apiJson(`/api/tasks/${id}/profile`).then(d => d.task).catch(() => null);
  if (!task) return toast('المهمة مش موجودة', 'bad');

  const lawyerOpts = lawyers.map(l => 
    `<option value="${l.id}" ${l.id == task.lawyer_id ? 'selected' : ''}>${esc(l.name)}</option>`
  ).join('');
  const caseOpts = cases.map(c => 
    `<option value="${c.id}" ${c.id == task.case_id ? 'selected' : ''}>${esc(c.case_number || c.id)}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">✏️ تعديل المهمة</h3>
        <button class="icon-btn" data-action="close">✕</button>
      </div>

      <label class="label">عنوان المهمة</label>
      <input id="edit-title" class="input" value="${esc(task.title)}">

      <label class="label" style="margin-top:10px">الموعد</label>
      <input id="edit-date" class="input" type="date" value="${task.due_date || ''}">

      <label class="label" style="margin-top:10px">المحامي</label>
      <select id="edit-lawyer" class="input">
        <option value="">— بدون —</option>
        ${lawyerOpts}
      </select>

      <label class="label" style="margin-top:10px">القضية (اختياري)</label>
      <select id="edit-case" class="input">
        <option value="">— بدون قضية —</option>
        ${caseOpts}
      </select>

      <label class="label" style="margin-top:10px">الحالة</label>
      <select id="edit-status" class="input">
        <option value="قيد التنفيذ" ${task.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
        <option value="منجزة" ${task.status === 'منجزة' ? 'selected' : ''}>منجزة</option>
        <option value="ملغية" ${task.status === 'ملغية' ? 'selected' : ''}>ملغية</option>
      </select>

      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn btn-ghost" style="flex:1" data-action="cancel">إلغاء</button>
        <button class="btn btn-primary" style="flex:1" data-action="save">💾 حفظ التعديلات</button>
      </div>
      <div id="edit-status-msg" class="status" style="margin-top:8px"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', async (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]') || e.target.closest('[data-action="cancel"]')) {
      modal.remove();
      return;
    }
    if (e.target.closest('[data-action="save"]')) {
      const title = modal.querySelector('#edit-title').value.trim();
      const due_date = modal.querySelector('#edit-date').value || null;
      const lawyer_id = modal.querySelector('#edit-lawyer').value || null;
      const case_id = modal.querySelector('#edit-case').value || null;
      const status = modal.querySelector('#edit-status').value;
      const msg = modal.querySelector('#edit-status-msg');

      if (!title) {
        msg.textContent = '⚠️ عنوان المهمة مطلوب';
        msg.className = 'status bad';
        return;
      }

      msg.textContent = '⏳ جاري الحفظ...';
      msg.className = 'status';

      try {
        await apiJson(`/api/tasks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, due_date, lawyer_id, case_id, status }),
        });
        toast('✅ اتعدلت', 'ok');
        modal.remove();
        onDone ? onDone() : render(host);
      } catch (err) {
        msg.textContent = '⚠️ ' + err.message;
        msg.className = 'status bad';
      }
    }
  });
}

// ============================================================
// Modal تفاصيل المهمة
// ============================================================
async function showTaskModal(id) {
  document.getElementById('task-detail-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'task-detail-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:720px;max-height:85vh;overflow:auto">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">✅ تفاصيل المهمة</h3>
        <button class="icon-btn" data-action="close">✕</button>
      </div>
      <div id="task-detail-content">
        ${skeleton(3, 'text')}
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
    const d = await apiJson(`/api/tasks/${id}/profile`);
    const t = d.task || {};
    const totalExpenses = (d.totals?.all) || 0;

    const tabsHtml = `
      <div class="case-tabs" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border-soft);overflow-x:auto">
        <button class="case-tab active" data-tab="overview">📋 نظرة عامة</button>
        <button class="case-tab" data-tab="expenses">💸 المصاريف (${(d.task_expenses || []).length})</button>
        <button class="case-tab" data-tab="docs">📎 المرفقات (${(d.documents || []).length})</button>
        ${(d.sessions || []).length ? `<button class="case-tab" data-tab="sessions">📅 الجلسات (${d.sessions.length})</button>` : ''}
      </div>
    `;

    document.getElementById('task-detail-content').innerHTML = `
      <div style="text-align:center;padding:8px 0 16px;border-bottom:1px solid var(--border-soft);margin-bottom:16px">
        <div style="font-size:20px;font-weight:800">${esc(t.title || '')}</div>
        <div style="font-size:13px;color:var(--text-soft);margin-top:4px">
          ${t.lawyer_name ? '👤 ' + esc(t.lawyer_name) : ''} 
          ${t.lawyer_phone ? `<a class="wa" href="${waLink(t.lawyer_phone)}" target="_blank" rel="noopener">واتساب</a>` : ''}
        </div>
        <span class="badge ${t.status === 'منجزة' ? 'active' : 'trial'}" style="margin-top:8px;display:inline-block">
          ${esc(t.status || 'قيد التنفيذ')}
        </span>
      </div>

      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><div class="l">📅 الموعد</div><div class="n" style="font-size:16px">${esc(t.due_date || '—')}</div></div>
        <div class="stat"><div class="l">💸 إجمالي المصاريف</div><div class="n danger">${fmtMoney(totalExpenses)}</div></div>
        <div class="stat"><div class="l">📎 مرفقات</div><div class="n primary">${(d.documents || []).length}</div></div>
      </div>

      ${t.case_number ? `
        <div class="card" style="background:var(--gray-50);margin-bottom:16px">
          <div style="font-size:13px;color:var(--text-soft);margin-bottom:6px">⚖️ القضية المرتبطة</div>
          <div style="font-weight:700">${esc(t.case_number)} ${t.court ? '· ' + esc(t.court) : ''}</div>
        </div>
      ` : ''}

      ${tabsHtml}

      <div id="task-tab-content"></div>
    `;

    const renderTab = (tab) => {
      const el = document.getElementById('task-tab-content');

      if (tab === 'overview') {
        el.innerHTML = `
          <div class="card" style="background:var(--gray-50)">
            <h4 style="margin:0 0 12px;font-size:14px">📋 تفاصيل</h4>
            <div style="display:flex;justify-content:space-between;font-size:13.5px">
              <span>الحالة:</span><strong>${esc(t.status || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>الموعد:</span><strong>${esc(t.due_date || '—')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
              <span>المحامي:</span><strong>${esc(t.lawyer_name || '—')}</strong>
            </div>
            ${t.notes ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-soft);font-size:13.5px"><strong>📝 ملاحظات:</strong><br>${esc(t.notes)}</div>` : ''}
          </div>
        `;
      }

      if (tab === 'expenses') {
        const expHtml = (d.task_expenses || []).length
          ? d.task_expenses.map(x => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(x.description || 'مصروف')}</span>
                  <span class="num mono" style="color:var(--danger);font-weight:700">${fmtMoney(x.amount)} ج</span>
                </div>
                <div class="meta" style="font-size:12px">
                  📅 ${esc((x.created_at || '').slice(0, 10))}
                  <button class="ghost" data-del-task-expense="${x.id}" style="color:var(--danger);margin-inline-start:8px;padding:2px 6px;font-size:11px">حذف</button>
                </div>
              </div>
            `).join('')
          : empty('مفيش مصاريف للمهمة.', '💸');

        el.innerHTML = `
          ${expHtml}
          <button class="btn btn-primary" id="add-expense-btn" style="width:100%;margin-top:12px;background:linear-gradient(135deg,#EF4444 0%,#DC2626 100%);border:none">
            💸 إضافة مصروف للمهمة
          </button>
        `;

        el.querySelector('#add-expense-btn')?.addEventListener('click', () => openExpenseModal(id, modal));

        el.querySelectorAll('[data-del-task-expense]').forEach(b => {
          b.addEventListener('click', async () => {
            if (!confirm('متأكد من حذف المصروف؟')) return;
            try {
              await apiJson(`/api/task-expenses/${b.dataset.delTaskExpense}`, { method: 'DELETE' });
              toast('اتحذف', 'ok');
              modal.remove();
              showTaskModal(id);
            } catch (e) {
              toast(e.message, 'bad');
            }
          });
        });
      }

      if (tab === 'docs') {
        renderAttachments(el, {
          taskId: id,
          onChange: docs => {
            d.documents = docs;
            const t = modal.querySelector('.case-tab[data-tab="docs"]');
            if (t) t.textContent = `📎 المرفقات (${docs.length})`;
          },
        });
      }

      if (tab === 'sessions') {
        el.innerHTML = (d.sessions || []).length
          ? d.sessions.map(s => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="name">${esc(s.session_date)}</div>
                <div class="meta">${esc(s.notes || '')}</div>
              </div>
            `).join('')
          : empty('مفيش جلسات.', '📅');
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
    document.getElementById('task-detail-content').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// Modal إضافة مصروف
// ============================================================
function openExpenseModal(taskId, parentModal) {
  const expModal = document.createElement('div');
  expModal.className = 'modal-overlay show';
  expModal.style.zIndex = '2000';
  expModal.innerHTML = `
    <div class="modal-card" style="max-width:400px">
      <h3 style="margin:0 0 16px">💸 إضافة مصروف للمهمة</h3>
      <label class="label">الوصف</label>
      <input id="exp-desc" class="input" placeholder="مثال: رسوم تحرير محضر">
      <label class="label" style="margin-top:10px">المبلغ (ج)</label>
      <input id="exp-amount" class="input" type="number" placeholder="500" min="1">
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-ghost" style="flex:1" data-action="cancel">إلغاء</button>
        <button class="btn btn-primary" style="flex:1" data-action="save">حفظ</button>
      </div>
      <div id="exp-status" class="status" style="margin-top:8px"></div>
    </div>
  `;
  document.body.appendChild(expModal);

  expModal.addEventListener('click', async (e) => {
    if (e.target === expModal || e.target.closest('[data-action="cancel"]')) {
      expModal.remove();
      return;
    }
    if (e.target.closest('[data-action="save"]')) {
      const desc = expModal.querySelector('#exp-desc').value.trim();
      const amount = Number(expModal.querySelector('#exp-amount').value);
      const st = expModal.querySelector('#exp-status');

      if (!amount || amount <= 0) {
        st.textContent = '⚠️ اكتب مبلغ صحيح';
        st.className = 'status bad';
        return;
      }

      st.textContent = '⏳ جاري الحفظ...';
      st.className = 'status';

      try {
        await apiJson(`/api/tasks/${taskId}/expense`, {
          method: 'POST',
          body: JSON.stringify({ amount, description: desc || null }),
        });
        toast('✅ اتحفظ المصروف', 'ok');
        expModal.remove();
        parentModal.remove();
        showTaskModal(taskId);
      } catch (err) {
        st.textContent = '⚠️ ' + err.message;
        st.className = 'status bad';
      }
    }
  });
}