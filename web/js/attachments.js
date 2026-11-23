// web/js/attachments.js
// إدارة المرفقات (للقضايا والمهام): رفع مع تصنيف، تجميع حسب النوع، بحث، تحميل، تعديل، حذف.
// التصنيفات لازم تتطابق مع worker/lib/doc-categories.js
import { apiJson, uploadDocument, downloadDocument } from './api.js';
import { esc, toast } from './ui.js';

export const DOC_CATEGORIES = [
  { label: 'توكيل',            icon: '📜' },
  { label: 'صحيفة دعوى',       icon: '📑' },
  { label: 'مذكرة دفاع',       icon: '🖋️' },
  { label: 'حكم / قرار',       icon: '⚖️' },
  { label: 'محضر',             icon: '🗒️' },
  { label: 'عقد',              icon: '🤝' },
  { label: 'إنذار / إعلان',    icon: '📨' },
  { label: 'مستند ملكية',      icon: '🏠' },
  { label: 'تقرير خبير / طبي', icon: '🩺' },
  { label: 'مستندات شخصية',    icon: '🪪' },
  { label: 'إيصال / فاتورة',   icon: '🧾' },
  { label: 'مراسلات',          icon: '✉️' },
  { label: 'صور وأدلة',        icon: '📷' },
  { label: 'أخرى',             icon: '📁' },
];
const KNOWN = new Set(DOC_CATEGORIES.map(c => c.label));
const catOf = t => (KNOWN.has(t) ? t : 'أخرى');
const iconOf = t => DOC_CATEGORIES.find(c => c.label === catOf(t))?.icon || '📁';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt';

function fmtSize(n) {
  if (!n) return '';
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
}
function fileIcon(name = '', mime = '') {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf') || mime.includes('pdf')) return '📕';
  if (/\.(docx?|rtf)$/.test(n) || mime.includes('word')) return '📘';
  if (/\.(jpe?g|png|webp)$/.test(n) || mime.startsWith('image/')) return '🖼️';
  return '📄';
}
const catSelect = (id, selected = '', placeholder = true) => `
  <select id="${id}">
    ${placeholder ? '<option value="">— نوع المستند —</option>' : ''}
    ${DOC_CATEGORIES.map(c => `<option value="${esc(c.label)}" ${c.label === selected ? 'selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}
  </select>`;

/**
 * @param {HTMLElement} el
 * @param {{caseId?: number, taskId?: number, defaultType?: string, onChange?: (docs:any[])=>void}} opts
 */
export async function renderAttachments(el, { caseId = null, taskId = null, defaultType = '', onChange = null } = {}) {
  const state = { docs: [], filter: 'all', q: '', editing: null };
  const qs = caseId ? `case_id=${caseId}` : `task_id=${taskId}`;

  el.innerHTML = `
    <div class="card" style="background:var(--gray-50);margin-bottom:12px">
      <div class="row">
        <div><label>نوع المستند</label>${catSelect('att-type', defaultType)}</div>
        <div><label>ملاحظة (اختياري)</label><input id="att-notes" placeholder="مثال: توكيل عام رقم 123 لسنة 2026"></div>
      </div>
      <div id="att-drop" style="margin-top:10px;border:2px dashed var(--border-soft);border-radius:12px;padding:18px;text-align:center;cursor:pointer">
        <div style="font-size:26px">⬆️</div>
        <div style="font-weight:700">اسحب الملفات هنا أو اضغط للاختيار</div>
        <div class="meta" style="font-size:12px">PDF · Word · صور · نصوص — حتى 10 ميجا للملف، وتقدر تختار أكتر من ملف</div>
      </div>
      <input type="file" id="att-file" multiple accept="${ACCEPT}" style="display:none">
      <div id="att-status" class="status" style="margin-top:8px"></div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <input id="att-search" placeholder="🔍 ابحث باسم الملف أو الملاحظة" style="flex:1;min-width:180px">
    </div>
    <div id="att-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>
    <div id="att-list"></div>
  `;

  const $ = s => el.querySelector(s);
  const status = (msg, cls = '') => { $('#att-status').textContent = msg; $('#att-status').className = 'status ' + cls; };

  async function load() {
    try {
      state.docs = await apiJson(`/api/documents?${qs}`, { skipCache: true });
    } catch (e) {
      $('#att-list').innerHTML = `<div class="warn">${esc(e.message)}</div>`;
      return;
    }
    draw();
    onChange?.(state.docs);
  }

  function draw() {
    // chips
    const counts = {};
    state.docs.forEach(d => { const c = catOf(d.doc_type); counts[c] = (counts[c] || 0) + 1; });
    const chip = (key, label, n) => `
      <button class="ghost" data-chip="${esc(key)}" style="padding:4px 10px;border-radius:999px;font-size:12.5px;${state.filter === key ? 'background:var(--primary);color:#fff' : ''}">
        ${label} <span style="opacity:.75">(${n})</span>
      </button>`;
    $('#att-chips').innerHTML = state.docs.length
      ? chip('all', 'الكل', state.docs.length) +
        DOC_CATEGORIES.filter(c => counts[c.label]).map(c => chip(c.label, `${c.icon} ${esc(c.label)}`, counts[c.label])).join('')
      : '';

    // list
    const q = state.q.toLowerCase();
    const visible = state.docs.filter(d =>
      (state.filter === 'all' || catOf(d.doc_type) === state.filter) &&
      (!q || String(d.file_name).toLowerCase().includes(q) || String(d.notes || '').toLowerCase().includes(q)));

    if (!state.docs.length) {
      $('#att-list').innerHTML = `<div class="empty" style="text-align:center;padding:24px;color:var(--text-soft)">📎 مفيش مرفقات لسه — اختار نوع المستند وارفع الملف</div>`;
      return;
    }
    if (!visible.length) {
      $('#att-list').innerHTML = `<div class="meta" style="text-align:center;padding:16px">مفيش نتايج</div>`;
      return;
    }

    const groups = DOC_CATEGORIES
      .map(c => ({ c, items: visible.filter(d => catOf(d.doc_type) === c.label) }))
      .filter(g => g.items.length);

    $('#att-list').innerHTML = groups.map(({ c, items }) => `
      <div style="margin-bottom:14px">
        <div style="font-weight:800;font-size:13.5px;margin:6px 0;display:flex;gap:6px;align-items:center">
          <span>${c.icon}</span><span>${esc(c.label)}</span><span class="meta">(${items.length})</span>
        </div>
        ${items.map(d => state.editing === d.id ? editRow(d) : row(d)).join('')}
      </div>`).join('');
  }

  const row = d => `
    <div class="item" style="padding:10px 12px;border:1px solid var(--border-soft);border-radius:10px;margin-bottom:6px">
      <div class="top" style="gap:8px">
        <span class="name" style="display:flex;gap:6px;align-items:center;min-width:0">
          <span>${fileIcon(d.file_name, d.mime_type || '')}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.file_name)}</span>
        </span>
      </div>
      <div class="meta" style="font-size:12px;margin-top:2px">
        ${[fmtSize(d.file_size), (d.created_at || '').slice(0, 10), d.uploaded_by_name ? '👤 ' + esc(d.uploaded_by_name) : '']
          .filter(Boolean).join(' · ')}
        ${KNOWN.has(d.doc_type) ? '' : ' · <span title="مستند قديم مش متصنف">غير مصنف</span>'}
      </div>
      ${d.notes ? `<div style="font-size:12.5px;margin-top:4px">📝 ${esc(d.notes)}</div>` : ''}
      <div class="acts" style="margin-top:6px">
        <button class="ghost" data-act="dl" data-id="${d.id}">⬇️ تحميل</button>
        <button class="ghost" data-act="edit" data-id="${d.id}">✏️ تعديل</button>
        <button class="ghost" data-act="del" data-id="${d.id}" style="color:var(--danger)">🗑 حذف</button>
      </div>
    </div>`;

  const editRow = d => `
    <div class="item" style="padding:10px 12px;border:1px solid var(--primary);border-radius:10px;margin-bottom:6px">
      <label>اسم الملف</label><input id="ed-name" value="${esc(d.file_name)}">
      <div class="row">
        <div><label>النوع</label>${catSelect('ed-type', catOf(d.doc_type), false)}</div>
        <div><label>ملاحظة</label><input id="ed-notes" value="${esc(d.notes || '')}"></div>
      </div>
      <div class="acts" style="margin-top:8px">
        <button class="primary" data-act="save" data-id="${d.id}">حفظ</button>
        <button class="ghost" data-act="cancel">إلغاء</button>
      </div>
    </div>`;

  async function uploadFiles(files) {
    const type = $('#att-type').value;
    if (!type) { status('⚠️ اختار نوع المستند الأول (توكيل، صحيفة دعوى، ...)', 'bad'); $('#att-type').focus(); return; }
    const notes = $('#att-notes').value.trim();
    const list = [...files];
    const tooBig = list.filter(f => f.size > MAX_SIZE);
    if (tooBig.length) toast(`⚠️ ${tooBig.map(f => f.name).join('، ')} أكبر من 10 ميجا`, 'bad');
    const ok = list.filter(f => f.size <= MAX_SIZE);
    let done = 0, failed = 0;
    for (const f of ok) {
      status(`⏳ جاري رفع ${done + failed + 1} من ${ok.length}: ${f.name}`);
      try {
        await uploadDocument(f, { caseId, taskId, docType: type, notes });
        done++;
      } catch (e) {
        failed++;
        toast(`${f.name}: ${e.message}`, 'bad');
      }
    }
    if (ok.length) status(failed ? `⚠️ اترفع ${done} وفشل ${failed}` : `✅ اترفع ${done} ملف في "${type}"`, failed ? 'bad' : 'ok');
    $('#att-notes').value = '';
    $('#att-file').value = '';
    await load();
  }

  // events
  const drop = $('#att-drop');
  drop.addEventListener('click', () => $('#att-file').click());
  $('#att-file').addEventListener('change', e => e.target.files.length && uploadFiles(e.target.files));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = 'var(--primary)'; }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = ''; }));
  drop.addEventListener('drop', e => e.dataTransfer?.files?.length && uploadFiles(e.dataTransfer.files));

  $('#att-search').addEventListener('input', e => { state.q = e.target.value.trim(); draw(); });
  $('#att-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-chip]');
    if (b) { state.filter = b.dataset.chip; draw(); }
  });

  $('#att-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = Number(b.dataset.id);
    const d = state.docs.find(x => x.id === id);

    if (b.dataset.act === 'dl') {
      const old = b.textContent; b.disabled = true; b.textContent = '⏳';
      try { await downloadDocument(id, d.file_name); } catch (err) { toast(err.message, 'bad'); }
      finally { b.disabled = false; b.textContent = old; }
    }
    if (b.dataset.act === 'edit') { state.editing = id; draw(); }
    if (b.dataset.act === 'cancel') { state.editing = null; draw(); }
    if (b.dataset.act === 'save') {
      const body = {
        file_name: $('#ed-name').value.trim(),
        doc_type: $('#ed-type').value,
        notes: $('#ed-notes').value.trim(),
      };
      if (!body.file_name) return toast('اكتب اسم الملف', 'bad');
      b.disabled = true;
      try {
        await apiJson(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        state.editing = null;
        toast('✅ اتحفظ', 'ok');
        await load();
      } catch (err) { toast(err.message, 'bad'); b.disabled = false; }
    }
    if (b.dataset.act === 'del') {
      if (!confirm(`حذف "${d.file_name}" نهائياً؟\nالملف هيتمسح من التخزين ومش هينفع يرجع.`)) return;
      b.disabled = true;
      try {
        await apiJson(`/api/documents/${id}`, { method: 'DELETE' });
        toast('🗑 اتحذف', 'ok');
        await load();
      } catch (err) { toast(err.message, 'bad'); b.disabled = false; }
    }
  });

  await load();
}
