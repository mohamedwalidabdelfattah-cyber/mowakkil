// web/js/doc-studio.js
// تاب «المستندات» في قسم الذكاء الاصطناعي:
//   📚 قوالب جاهزة (فورية، من غير ذكاء اصطناعي) · ✨ توليد بالذكاء الاصطناعي (للحالات الخاصة) · 💾 المحفوظة
// أي مستند (من قالب أو توليد) يتعدّل ويتنسخ ويتصدّر Word/PDF ويتحفظ في ملف القضية.
import { apiJson } from './api.js';
import { esc, toast, skeleton } from './ui.js';
import { openModal } from './modal.js';
import { mountExportMenu } from './exporter.js';
import { isSaudi } from './country.js';
import { mountTemplates } from './doc-templates.js';

const DOC_TYPES_EG = ['مذكرة دفاع', 'صحيفة دعوى', 'صحيفة استئناف', 'إنذار على يد محضر', 'إنذار رسمي بفسخ عقد', 'عقد',
  'اتفاق صلح', 'بلاغ للنيابة العامة', 'شكوى إدارية', 'إخطار بإنهاء علاقة عمل', 'توكيل خاص'];
const DOC_TYPES_SA = ['لائحة دعوى', 'مذكرة جوابية', 'لائحة اعتراضية', 'عقد', 'اتفاق صلح', 'بلاغ للنيابة العامة',
  'إنذار', 'شكوى إدارية', 'إخطار بإنهاء علاقة عمل', 'صيغة وكالة'];
const OTHER = '__other__';

let casesCache = null;
async function getCasesList() {
  if (!casesCache) { try { casesCache = await apiJson('/api/cases'); } catch { casesCache = []; } }
  return casesCache;
}
const caseLabel = c => [c.case_number, c.client_name, c.court].filter(Boolean).join(' — ') || 'قضية #' + c.id;

/** نافذة «حفظ في القضية»: العنوان + القضية (اختياري) */
export async function saveDocDialog({ title, body, source = 'ai', template_id = null, case_id = null }) {
  const cases = await getCasesList();
  let savedId = null;
  const res = await openModal({
    title: '💾 حفظ المستند',
    submitText: 'حفظ',
    fields: [
      { name: 'title', label: 'اسم المستند', required: true },
      { name: 'case_id', label: 'القضية', type: 'select', options: [{ value: '', label: '— من غير قضية (محفوظات المكتب) —' }, ...cases.map(c => ({ value: String(c.id), label: esc(caseLabel(c)) }))] },
    ],
    initialData: { title, case_id: case_id ? String(case_id) : '' },
    onSubmit: async d => {
      const r = await apiJson('/api/documents/generated', {
        method: 'POST', body: JSON.stringify({ title: d.title, body, source, template_id, case_id: d.case_id || null }),
      });
      savedId = r.id;
    },
  });
  if (res) toast('💾 اتحفظ' + (res.case_id ? ' في ملف القضية' : ''), 'ok');
  return savedId;
}

/** محرر مستند: نص قابل للتعديل + أدوات الذكاء الاصطناعي + نسخ/تصدير/حفظ */
function mountEditor(box, { title, body, source = 'ai', template_id = null, case_id = null, savedId = null, onChange } = {}) {
  box.innerHTML = `
    <div class="doc-tools" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <span style="font-size:12.5px;color:var(--ink-soft);align-self:center">✨ حسّن المسودة:</span>
      <button class="ghost" data-refine="stronger" style="padding:5px 10px;font-size:12.5px">💪 صياغة أقوى</button>
      <button class="ghost" data-refine="shorter" style="padding:5px 10px;font-size:12.5px">✂️ اختصر</button>
      <button class="ghost" data-refine="formal" style="padding:5px 10px;font-size:12.5px">🎩 فصحى رسمية</button>
      <button class="ghost" data-refine="clause" style="padding:5px 10px;font-size:12.5px">➕ أضف بند</button>
      <button class="ghost" data-refine="custom" style="padding:5px 10px;font-size:12.5px">✏️ تعديل بطلب</button>
    </div>
    <div class="doc-ask" hidden style="display:flex;gap:6px;margin-bottom:8px">
      <input class="doc-ask-input" style="flex:1" placeholder="">
      <button class="primary doc-ask-go">تنفيذ</button>
    </div>
    <textarea class="doc-text doc-output" style="width:100%;min-height:380px;white-space:pre-wrap;line-height:1.9;font-size:13.5px;background:#fff;color:#111"></textarea>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="ghost doc-copy">📋 نسخ</button>
      <div class="doc-export"></div>
      <button class="primary doc-save">${savedId ? '💾 حفظ التعديلات' : '💾 حفظ في القضية'}</button>
    </div>`;
  const ta = box.querySelector('.doc-text');
  ta.value = body;
  ta.addEventListener('input', () => onChange?.(ta.value));
  let pending = null; // clause / custom

  const run = async (action, instruction = '') => {
    const before = ta.value;
    box.querySelectorAll('[data-refine], .doc-ask-go').forEach(b => { b.disabled = true; });
    ta.style.opacity = '.5';
    try {
      const r = await apiJson('/api/generate-doc/refine', { method: 'POST', body: JSON.stringify({ text: before, action, instruction }) });
      ta.value = r.document; onChange?.(ta.value);
      toast('✅ اتعدّلت المسودة — راجعها', 'ok');
      box.querySelector('.doc-ask').hidden = true;
    } catch (e) { toast(e.message, 'bad'); }
    finally { ta.style.opacity = ''; box.querySelectorAll('[data-refine], .doc-ask-go').forEach(b => { b.disabled = false; }); }
  };
  box.querySelectorAll('[data-refine]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.refine;
    if (a === 'clause' || a === 'custom') {
      pending = a;
      const ask = box.querySelector('.doc-ask'); ask.hidden = false; ask.style.display = 'flex';
      const inp = box.querySelector('.doc-ask-input');
      inp.placeholder = a === 'clause' ? 'مثلاً: بند شرط جزائي 10% من قيمة العقد عند التأخير' : 'مثلاً: خلّي مدة الإنذار 7 أيام وأضف طلب التعويض';
      inp.focus();
      return;
    }
    run(a);
  }));
  const go = () => { const v = box.querySelector('.doc-ask-input').value.trim(); if (!v) return toast('اكتب المطلوب', 'bad'); run(pending, v); };
  box.querySelector('.doc-ask-go').addEventListener('click', go);
  box.querySelector('.doc-ask-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });

  box.querySelector('.doc-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ta.value); toast('📋 اتنسخ', 'ok'); } catch { toast('انسخ يدوي', 'bad'); }
  });
  mountExportMenu(box.querySelector('.doc-export'), () => ({ title, meta: [], blocks: [{ type: 'text', text: ta.value }] }),
    { formats: ['word', 'pdf'], label: '⬇️ Word / طباعة', filename: title });
  box.querySelector('.doc-save').addEventListener('click', async () => {
    if (savedId) {
      try { await apiJson(`/api/documents/generated/${savedId}`, { method: 'PATCH', body: JSON.stringify({ body: ta.value }) }); toast('💾 اتحفظت التعديلات', 'ok'); }
      catch (e) { toast(e.message, 'bad'); }
      return;
    }
    const id = await saveDocDialog({ title, body: ta.value, source, template_id, case_id });
    if (id) { savedId = id; box.querySelector('.doc-save').textContent = '💾 حفظ التعديلات'; }
  });
}

export function mountDocStudio(host) {
  const sa = isSaudi();
  host.innerHTML = `
    <div class="doc-subtabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <button class="primary" data-sub="templates">📚 قوالب جاهزة</button>
      <button class="ghost" data-sub="ai">✨ توليد بالذكاء الاصطناعي</button>
      <button class="ghost" data-sub="saved">💾 المحفوظة</button>
    </div>
    <div data-pane="templates"></div>
    <div data-pane="ai" hidden></div>
    <div data-pane="saved" hidden></div>`;
  const panes = Object.fromEntries([...host.querySelectorAll('[data-pane]')].map(p => [p.dataset.pane, p]));
  const loaded = new Set();
  const show = k => {
    host.querySelectorAll('[data-sub]').forEach(b => { const on = b.dataset.sub === k; b.classList.toggle('primary', on); b.classList.toggle('ghost', !on); });
    Object.entries(panes).forEach(([n, p]) => { p.hidden = n !== k; });
    if (k === 'saved') renderSaved(panes.saved); // دايماً أحدث نسخة
    else if (!loaded.has(k)) { loaded.add(k); k === 'templates' ? mountTemplates(panes.templates, { onSave: saveDocDialog }) : renderAi(panes.ai); }
  };
  host.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => show(b.dataset.sub)));
  show('templates');

  // ---------------- ✨ توليد بالذكاء الاصطناعي ----------------
  async function renderAi(box) {
    const types = sa ? DOC_TYPES_SA : DOC_TYPES_EG;
    box.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0">✨ توليد مستند خاص بالذكاء الاصطناعي</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">للمستندات اللي مالهاش قالب أو محتاجة صياغة خاصة جداً. بيدوّر في المواد القانونية الأول ويبني عليها.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
          <div><label>نوع المستند</label>
            <select id="doc-type">${types.map(t => `<option>${esc(t)}</option>`).join('')}<option value="${OTHER}">✍️ نوع تاني…</option></select>
            <input id="doc-type-other" placeholder="اكتب نوع المستند (مثلاً: عقد امتياز تجاري)" hidden style="margin-top:6px"></div>
          <div><label>⚡ مربوط بقضية (اختياري)</label><select id="doc-case"><option value="">— من غير —</option></select></div>
        </div>
        <label style="margin-top:10px">الأطراف (اختياري)</label>
        <input id="doc-parties" placeholder="مثال: أحمد السيد (موكل) ضد شركة النيل (خصم)">
        <label style="margin-top:10px">الوقائع والمطلوب *</label>
        <textarea id="doc-facts" placeholder="اكتب ملخص الوقائع: إيه اللي حصل، امتى، وإيه المطالب… كل ما تفاصيلك أكتر المسودة أدق" style="min-height:120px"></textarea>
        <label style="margin-top:10px">تفاصيل إضافية (اختياري)</label>
        <input id="doc-extra" placeholder="مبالغ، تواريخ، شروط خاصة…">
        <button class="primary" style="margin-top:10px" id="gen-btn">✍️ توليد المسودة</button>
        <div id="doc-out" style="margin-top:14px"></div>
        <div class="warn">⚠️ المسودات أولية — محتاجة مراجعة محامٍ قبل التقديم الرسمي.</div>
      </div>`;
    const typeSel = box.querySelector('#doc-type'), other = box.querySelector('#doc-type-other');
    typeSel.addEventListener('change', () => { other.hidden = typeSel.value !== OTHER; if (!other.hidden) other.focus(); });
    const caseSel = box.querySelector('#doc-case');
    getCasesList().then(cs => { caseSel.innerHTML += cs.map(c => `<option value="${c.id}">${esc(caseLabel(c))}</option>`).join(''); });

    box.querySelector('#gen-btn').addEventListener('click', async () => {
      const doc_type = typeSel.value === OTHER ? other.value.trim() : typeSel.value;
      const facts = box.querySelector('#doc-facts').value.trim();
      const parties = box.querySelector('#doc-parties').value.trim();
      const extra = box.querySelector('#doc-extra').value.trim();
      const case_id = caseSel.value || null;
      const out = box.querySelector('#doc-out');
      if (!doc_type) return toast('اكتب نوع المستند', 'bad');
      if (facts.length < 10) return toast('اكتب الوقائع بوضوح', 'bad');
      const btn = box.querySelector('#gen-btn'); btn.disabled = true;
      out.innerHTML = '<div class="answer">' + skeleton(5) + '<div style="font-size:12.5px;color:var(--ink-soft);margin-top:8px">⏳ بيدوّر في المواد القانونية ويكتب المسودة… ممكن ياخد دقيقة.</div></div>';
      try {
        const data = await apiJson('/api/generate-doc', { method: 'POST', body: JSON.stringify({ doc_type, facts, parties, extra, case_id }) });
        if (data.error) { out.innerHTML = `<div class="warn">${esc(data.error)}</div>`; return; }
        mountEditor(out, { title: doc_type, body: data.document, source: 'ai', case_id });
        if (data.note) out.insertAdjacentHTML('afterbegin', `<div class="warn" style="margin-bottom:8px">${esc(data.note)}</div>`);
      } catch (e) {
        out.innerHTML = `<div class="warn">${esc(e.message)}</div>`;
      } finally { btn.disabled = false; }
    });
  }

  // ---------------- 💾 المحفوظة ----------------
  async function renderSaved(box) {
    box.innerHTML = `<div class="card">${skeleton(3)}</div>`;
    let items = [];
    try { items = await apiJson('/api/documents/generated'); } catch (e) { box.innerHTML = `<div class="card"><div class="warn">${esc(e.message)}</div></div>`; return; }
    box.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0">💾 المستندات المحفوظة (${items.length})</h3>
        ${items.length ? items.map(d => `
          <div class="item" data-doc="${d.id}" style="cursor:pointer">
            <div class="top"><span class="name">${d.source === 'template' ? '📚' : '✨'} ${esc(d.title)}</span>
              <span class="num">${esc(String(d.updated_at || d.created_at || '').slice(0, 10))}</span></div>
            <div class="meta">${d.case_number ? '📁 قضية ' + esc(d.case_number) + ' · ' : ''}${esc(d.created_by_name || '')}</div>
            <div class="meta" style="opacity:.75">${esc(String(d.preview || '').replace(/\s+/g, ' ').slice(0, 120))}…</div>
          </div>`).join('') : '<div class="empty">لسه مفيش مستندات محفوظة — اعمل مستند من قالب أو بالتوليد واضغط «💾 حفظ في القضية».</div>'}
        <div id="saved-open" style="margin-top:14px"></div>
      </div>`;
    box.querySelectorAll('[data-doc]').forEach(el => el.addEventListener('click', async () => {
      const target = box.querySelector('#saved-open');
      target.innerHTML = skeleton(4);
      try {
        const d = await apiJson(`/api/documents/generated/${el.dataset.doc}`);
        target.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
            <h4 style="margin:0">${esc(d.title)}</h4>
            <button class="ghost" data-del style="color:var(--danger);padding:5px 10px">🗑 حذف</button></div><div class="saved-ed"></div>`;
        mountEditor(target.querySelector('.saved-ed'), { title: d.title, body: d.body, source: d.source, savedId: d.id, case_id: d.case_id });
        target.querySelector('[data-del]').addEventListener('click', async () => {
          if (!confirm('تحذف المستند ده نهائياً؟')) return;
          try { await apiJson(`/api/documents/generated/${d.id}`, { method: 'DELETE' }); toast('اتحذف', 'ok'); renderSaved(box); }
          catch (e) { toast(e.message, 'bad'); }
        });
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { target.innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
    }));
  }
}
