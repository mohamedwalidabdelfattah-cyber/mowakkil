// web/js/views/case-detail.js
// صفحة تفاصيل القضية الكاملة

import { apiJson, uploadDocument, downloadDocument } from './api.js';
import { esc, toast, empty, skeleton, fmtMoney, waLink } from '../ui.js';
import { openModal } from '../modal.js';

export async function renderCaseDetail(host, caseId) {
  host.innerHTML = '<div class="card">' + skeleton(6) + '</div>';

  let data;
  try {
    data = await apiJson(`/api/cases/${caseId}`);
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="empty">خطأ: ${esc(e.message)}</div></div>`;
    return;
  }

  const c = data.case;
  const t = data.totals;

  host.innerHTML = `
    <button class="ghost" id="back-btn" style="margin-bottom:14px">← رجوع للقضايا</button>

    <!-- بيانات القضية -->
    <div class="card">
      <div class="section-header">
        <h3>
          ⚖️ ${esc(c.case_number || 'قضية #' + c.id)}
          <span class="badge ${c.status === 'مؤرشفة' ? 'suspended' : 'active'}" style="margin-right:8px">${esc(c.status)}</span>
        </h3>
        <button class="ghost" id="edit-case">✏️ تعديل</button>
      </div>

      <div class="info-grid">
        <div class="info-item"><div class="info-label">المحكمة</div><div class="info-value">${esc(c.court || '—')}</div></div>
        <div class="info-item"><div class="info-label">الدرجة</div><div class="info-value">${esc(c.degree || '—')}</div></div>
        <div class="info-item"><div class="info-label">نوع القضية</div><div class="info-value">${esc(c.case_type || '—')}</div></div>
        <div class="info-item"><div class="info-label">تاريخ الفتح</div><div class="info-value">${esc((c.created_at || '').slice(0, 10))}</div></div>
      </div>

      <div class="acts-row">
        ${c.status === 'مؤرشفة'
          ? `<button class="ghost" id="restore-case">♻️ استرجاع</button>`
          : `<button class="ghost" id="archive-case">📦 أرشفة</button>`}
        <button class="ghost" id="delete-case" style="color:var(--bad)">🗑 حذف</button>
      </div>
    </div>

    <!-- الموكل -->
    <div class="card">
      <h3>👤 الموكل</h3>
      ${c.client_id ? `
        <div class="info-grid">
          <div class="info-item"><div class="info-label">الاسم</div><div class="info-value">${esc(c.client_name || '—')}</div></div>
          <div class="info-item"><div class="info-label">رقم الهاتف</div><div class="info-value">${esc(c.client_phone || '—')}</div></div>
        </div>
        <div class="acts-row">
          ${c.client_phone ? `<a class="wa" href="${waLink(c.client_phone)}" target="_blank" rel="noopener">💬 واتساب</a>` : ''}
        </div>
      ` : '<div class="empty">مفيش موكل مرتبط</div>'}
    </div>

    <!-- الملخص المالي -->
    <div class="stats">
      <div class="stat"><div class="n">${fmtMoney(t.total_due)}</div><div class="l">إجمالي الأتعاب</div></div>
      <div class="stat"><div class="n" style="color:var(--ok)">${fmtMoney(t.total_paid)}</div><div class="l">المدفوع</div></div>
      <div class="stat"><div class="n" style="color:var(--bad)">${fmtMoney(t.total_remaining)}</div><div class="l">المتبقي</div></div>
      <div class="stat"><div class="n">${fmtMoney(t.total_expenses)}</div><div class="l">المصاريف</div></div>
    </div>

    <!-- الجلسات -->
    <div class="card">
      <div class="section-header">
        <h3>📅 الجلسات (${data.sessions.length})</h3>
        <button class="ghost" id="add-session">+ إضافة</button>
      </div>
      <div id="sessions-list">
        ${data.sessions.length
          ? data.sessions.map(s => `
            <div class="item">
              <div class="top">
                <span class="name">${esc(s.session_date)}</span>
              </div>
              ${s.notes ? `<div class="meta">${esc(s.notes)}</div>` : ''}
            </div>`).join('')
          : empty('مفيش جلسات مسجلة')}
      </div>
    </div>

    <!-- الأتعاب -->
    <div class="card">
      <div class="section-header">
        <h3>💰 الأتعاب (${data.fees.length})</h3>
        <button class="ghost" id="add-fee">+ إضافة</button>
      </div>
      <div id="fees-list">
        ${data.fees.length
          ? data.fees.map(f => `
            <div class="item">
              <div class="top">
                <span class="name">${fmtMoney(f.amount_due)} ج</span>
                <span class="badge ${f.status === 'مدفوع بالكامل' ? 'active' : 'trial'}">${esc(f.status)}</span>
              </div>
              <div class="meta">مدفوع: ${fmtMoney(f.amount_paid)} · ${esc(f.due_date || '')}</div>
              ${f.notes ? `<div class="meta">${esc(f.notes)}</div>` : ''}
            </div>`).join('')
          : empty('مفيش أتعاب مسجلة')}
      </div>
    </div>

    <!-- المهام -->
    <div class="card">
      <div class="section-header">
        <h3>✅ المهام (${data.tasks.length})</h3>
        <button class="ghost" id="add-task">+ إضافة</button>
      </div>
      <div id="tasks-list">
        ${data.tasks.length
          ? data.tasks.map(x => `
            <div class="item">
              <div class="top">
                <span class="name">${esc(x.title)}</span>
                <span class="badge ${x.status === 'منجزة' ? 'active' : 'trial'}">${esc(x.status)}</span>
              </div>
              <div class="meta">${x.lawyer_name ? esc(x.lawyer_name) + ' · ' : ''}${esc(x.due_date || '')}</div>
            </div>`).join('')
          : empty('مفيش مهام')}
      </div>
    </div>

    <!-- المستندات -->
    <div class="card">
      <div class="section-header">
        <h3>📄 المستندات (${data.documents.length})</h3>
        <button class="ghost" id="upload-doc-btn">+ رفع</button>
      </div>
      <div id="docs-list">
        ${data.documents.length
          ? data.documents.map(d => `
            <div class="item">
              <div class="top">
                <span class="name">${esc(d.file_name)}</span>
                <span class="num mono">${esc(d.doc_type)}</span>
              </div>
              <div class="acts">
                <button class="ghost" data-doc-download="${d.id}">⬇️ تحميل</button>
                <button class="ghost" data-doc-delete="${d.id}" style="color:var(--bad)">🗑 حذف</button>
              </div>
            </div>`).join('')
          : empty('مفيش مستندات')}
      </div>
    </div>

    <!-- المصاريف -->
    <div class="card">
      <div class="section-header">
        <h3>💸 مصاريف الجلسات (${data.expenses.length})</h3>
      </div>
      <div id="expenses-list">
        ${data.expenses.length
          ? data.expenses.map(x => `
            <div class="item">
              <div class="top">
                <span class="name">${esc(x.description || 'مصروف')}</span>
                <span class="num mono">${fmtMoney(x.amount)} ج</span>
              </div>
            </div>`).join('')
          : empty('مفيش مصاريف')}
      </div>
    </div>
  `;

  const refresh = () => renderCaseDetail(host, caseId);

  // رجوع
  host.querySelector('#back-btn').addEventListener('click', () => {
    import('../router.js').then(m => m.showView('cases'));
  });

  // تعديل القضية
  host.querySelector('#edit-case').addEventListener('click', async () => {
    const clients = await apiJson('/api/clients');
    const result = await openModal({
      title: 'تعديل القضية',
      initialData: c,
      fields: [
        { name: 'case_number', label: 'رقم القضية' },
        { name: 'court', label: 'المحكمة' },
        { name: 'degree', label: 'الدرجة', type: 'select', options: ['جزئي', 'ابتدائي', 'استئناف', 'نقض'] },
        { name: 'case_type', label: 'نوع القضية' },
        { name: 'client_id', label: 'الموكل', type: 'select',
          options: [{ value: '', label: '— بدون —' }, ...clients.map(cl => ({ value: cl.id, label: cl.name }))] },
      ],
      onSubmit: async (d) => {
        await apiJson(`/api/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(d) });
      },
    });
    if (result) { toast('اتحفظ', 'ok'); refresh(); }
  });

  // أرشفة
  host.querySelector('#archive-case')?.addEventListener('click', async () => {
    await apiJson(`/api/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify({ status: 'مؤرشفة' }) });
    toast('اتأرشفت', 'ok'); refresh();
  });

  host.querySelector('#restore-case')?.addEventListener('click', async () => {
    await apiJson(`/api/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify({ status: 'مفتوحة' }) });
    toast('اترجعت', 'ok'); refresh();
  });

  host.querySelector('#delete-case')?.addEventListener('click', async () => {
    if (!confirm('متأكد من الحذف؟')) return;
    await apiJson(`/api/cases/${caseId}`, { method: 'DELETE' });
    toast('اتحذفت', 'ok');
    import('../router.js').then(m => m.showView('cases'));
  });

  // إضافة جلسة
  host.querySelector('#add-session').addEventListener('click', async () => {
    const result = await openModal({
      title: 'إضافة جلسة',
      fields: [
        { name: 'session_date', label: 'تاريخ الجلسة', type: 'date', required: true },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
      ],
      onSubmit: async (d) => {
        await apiJson('/api/sessions', {
          method: 'POST',
          body: JSON.stringify({ case_id: caseId, session_date: d.session_date, notes: d.notes }),
        });
      },
    });
    if (result) { toast('اتسجلت', 'ok'); refresh(); }
  });

  // إضافة أتعاب
  host.querySelector('#add-fee').addEventListener('click', async () => {
    const result = await openModal({
      title: 'إضافة أتعاب',
      fields: [
        { name: 'amount_due', label: 'المبلغ المستحق (ج)', type: 'number', required: true },
        { name: 'due_date', label: 'تاريخ الاستحقاق', type: 'date' },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
      ],
      onSubmit: async (d) => {
        await apiJson('/api/fees', {
          method: 'POST',
          body: JSON.stringify({
            case_id: caseId,
            client_id: c.client_id,
            amount_due: d.amount_due,
            due_date: d.due_date,
            notes: d.notes,
          }),
        });
      },
    });
    if (result) { toast('اتحفظ', 'ok'); refresh(); }
  });

  // إضافة مهمة
  host.querySelector('#add-task').addEventListener('click', async () => {
    const result = await openModal({
      title: 'إضافة مهمة',
      fields: [
        { name: 'title', label: 'عنوان المهمة', required: true },
        { name: 'due_date', label: 'الموعد', type: 'date' },
      ],
      onSubmit: async (d) => {
        await apiJson('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ case_id: caseId, title: d.title, due_date: d.due_date }),
        });
      },
    });
    if (result) { toast('اتحفظ', 'ok'); refresh(); }
  });

  // رفع مستند
  host.querySelector('#upload-doc-btn').addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const docType = prompt('نوع المستند (توكيل / مذكرة / حكم / أخرى):') || 'أخرى';
      try {
        await uploadDocument(file, { caseId, docType });
        toast('اترفع', 'ok');
        refresh();
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
    fileInput.click();
  });

  // تحميل مستند
  host.querySelectorAll('[data-doc-download]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.docDownload;
    const doc = data.documents.find(x => x.id == id);
    try {
      await downloadDocument(id, doc?.file_name || 'download');
    } catch (e) {
      toast(e.message || 'فشل التحميل', 'bad');
    }
  }));

  // حذف مستند
  host.querySelectorAll('[data-doc-delete]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('متأكد؟')) return;
    await apiJson(`/api/documents/${b.dataset.docDelete}`, { method: 'DELETE' });
    refresh();
  }));
}