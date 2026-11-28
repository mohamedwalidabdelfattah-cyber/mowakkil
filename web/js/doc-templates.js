// web/js/doc-templates.js
// مكتبة القوالب الجاهزة جوه تاب «توليد مستندات»:
//   قايمة (بحث + تصنيفات) ← قالب ← خانات بتتملي يدوي أو من القضية/الموكل ← معاينة حية ← نسخ / Word / حفظ في القضية.
// من غير ذكاء اصطناعي: فوري، مش بيصرف من الحصة، ونفس الشكل كل مرة.
import { apiJson } from './api.js';
import { esc, toast, localISO } from './ui.js';
import { mountExportMenu } from './exporter.js';
import { isSaudi } from './country.js';
import { CATEGORIES_EG, TEMPLATES_EG } from './doc-templates-eg.js';

const DOTS = '................';

const officeName = () => {
  try { const o = JSON.parse(localStorage.getItem('mowakkil_office') || '{}'); return o.name_ar || o.name || ''; } catch { return ''; }
};
const fmtDate = v => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]}/${+m[2]}/${m[1]}` : String(v || '');
};

export function templatesFor() {
  if (isSaudi()) return { categories: [], templates: [] }; // الدفعة السعودية جاية
  return { categories: CATEGORIES_EG, templates: TEMPLATES_EG };
}

/** بيملى نص القالب بالقيم — الفاضي بيبقى نقط للكتابة بخط اليد */
export function fillTemplate(tpl, values) {
  const byKey = Object.fromEntries(tpl.fields.map(f => [f.k, f]));
  return tpl.body.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    let v = String(values[k] ?? '').trim();
    if (!v) return DOTS;
    if (byKey[k]?.type === 'date') v = fmtDate(v);
    if (byKey[k]?.type === 'number' && /^\d+(\.\d+)?$/.test(v)) v = Number(v).toLocaleString('en-US');
    return v;
  }).replace(/\n{3,}/g, '\n\n');
}

// قيمة مصدر التعبئة التلقائية من القضية/الموكل المختارين
function sourceValue(src, { kase, client }) {
  switch (src) {
    case 'client.name': return client?.name;
    case 'client.national_id': return client?.national_id;
    case 'client.address': return client?.address;
    case 'client.phone': return client?.phone;
    case 'case.number': return kase?.case_number;
    case 'case.court': return kase?.court;
    case 'case.opponent': return kase?.opponent_name;
    case 'case.subject': return kase?.subject;
    case 'case.degree': return kase?.degree;
    case 'case.claim': return kase?.claim_amount;
    case 'office.name': return officeName();
    case 'today': return localISO();
    default: return '';
  }
}

export function mountTemplates(host, { onSave } = {}) {
  const { categories, templates } = templatesFor();
  if (!templates.length) {
    host.innerHTML = `<div class="card"><div class="empty" style="line-height:1.9">
      📚 قوالب الأنظمة السعودية (لائحة دعوى، مذكرة جوابية، لائحة اعتراضية، عقود…) جاية قريب.<br>
      لحد ما تنزل، استخدم «✨ توليد بالذكاء الاصطناعي» — بيكتب المستند على الصيغة السعودية.</div></div>`;
    return;
  }
  let cat = 'all', q = '';
  let cases = null, clients = null;

  const list = () => {
    const shown = templates.filter(t => (cat === 'all' || t.cat === cat) &&
      (!q || (t.title + ' ' + t.desc).includes(q)));
    host.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <input id="tpl-q" placeholder="🔍 دوّر على قالب… (إيجار، إنذار، مخالصة)" value="${esc(q)}" style="flex:1;min-width:200px">
        </div>
        <div class="tpl-cats" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
          ${[{ id: 'all', label: 'الكل', icon: '📚' }, ...categories].map(c => `
            <button class="${c.id === cat ? 'primary' : 'ghost'}" data-cat="${c.id}" style="padding:6px 12px;font-size:13px">${c.icon} ${esc(c.label)}
              <span style="opacity:.7">(${c.id === 'all' ? templates.length : templates.filter(t => t.cat === c.id).length})</span></button>`).join('')}
        </div>
        <div class="tpl-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">
          ${shown.map(t => `
            <button class="tpl-card" data-tpl="${t.id}" style="text-align:right;padding:14px;border:1px solid var(--border-soft);border-radius:12px;background:var(--surface,#fff);cursor:pointer;font:inherit;color:inherit">
              <div style="font-size:13px;opacity:.75;margin-bottom:4px">${categories.find(c => c.id === t.cat)?.icon || '📄'} ${esc(categories.find(c => c.id === t.cat)?.label || '')}</div>
              <div style="font-weight:700;margin-bottom:6px">${esc(t.title)}</div>
              <div style="font-size:12.5px;color:var(--ink-soft);line-height:1.6">${esc(t.desc)}</div>
            </button>`).join('') || '<div class="empty">مفيش قالب بالاسم ده — جرّب «✨ توليد بالذكاء الاصطناعي»</div>'}
        </div>
        <p style="font-size:12px;color:var(--ink-soft);margin:12px 0 0">💡 مش لاقي اللي محتاجه؟ «✨ توليد بالذكاء الاصطناعي» بيكتب أي مستند خاص من الوقائع.</p>
      </div>`;
    const qi = host.querySelector('#tpl-q');
    qi.addEventListener('input', () => { q = qi.value.trim(); const pos = qi.selectionStart; list(); const n = host.querySelector('#tpl-q'); n.focus(); n.setSelectionRange(pos, pos); });
    host.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { cat = b.dataset.cat; list(); }));
    host.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => open(templates.find(t => t.id === b.dataset.tpl))));
  };

  const loadPickers = async () => {
    if (!cases) { try { cases = await apiJson('/api/cases'); } catch { cases = []; } }
    if (!clients) { try { clients = await apiJson('/api/clients'); } catch { clients = []; } }
  };

  const open = async (tpl) => {
    const values = {};
    const auto = new Set(); // الخانات اللي اتملت تلقائي (بتتحدث لو القضية/الموكل اتغيروا)
    let kase = null, client = null;
    host.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button class="ghost" data-back style="padding:6px 12px">→ كل القوالب</button>
          <span class="badge" title="مكتوب على الصيغ المتعارف عليها — راجع البنود قبل الاستخدام الرسمي" style="background:var(--c-warning-bg,#FEF3C7);color:#92400E;padding:4px 10px;border-radius:999px;font-size:12px">🔍 قالب استرشادي — راجعه قبل التوقيع</span>
        </div>
        <h3 style="margin:0 0 4px">${esc(tpl.title)}</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">${esc(tpl.desc)}</p>
        <div class="row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:10px">
          <div><label>⚡ املا من قضية</label><select id="tpl-case"><option value="">— من غير —</option></select></div>
          <div><label>⚡ أو من موكل</label><select id="tpl-client"><option value="">— من غير —</option></select></div>
        </div>
        <!-- على الشاشة الكبيرة: الخانات بتتمرر جوه صندوقها والمعاينة فاضلة قدامك. على الموبايل: تحت بعض -->
        <style>
          @media (min-width: 760px) {
            .tpl-editor #tpl-fields { max-height: calc(100vh - 230px); overflow: auto; padding-inline-end: 6px; }
            .tpl-editor #tpl-preview { max-height: calc(100vh - 290px) !important; }
          }
        </style>
        <div class="tpl-editor" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;align-items:start">
          <div id="tpl-fields" style="display:grid;gap:8px;align-content:start"></div>
          <div>
            <div id="tpl-preview" class="doc-output" style="white-space:pre-wrap;background:#fff;color:#111;border:1px solid var(--border-soft);border-radius:10px;padding:18px;min-height:300px;max-height:70vh;overflow:auto;font-size:13.5px;line-height:1.9"></div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <button class="ghost" id="tpl-copy">📋 نسخ</button>
              <div id="tpl-export"></div>
              ${onSave ? '<button class="primary" id="tpl-save">💾 حفظ في القضية</button>' : ''}
            </div>
          </div>
        </div>
        <p style="font-size:12px;color:var(--ink-soft);margin:10px 0 0">الخانة الفاضية بتطلع نقط (${DOTS}) عشان تتكتب بخط اليد.</p>
      </div>`;
    host.querySelector('[data-back]').addEventListener('click', list);

    const fieldsBox = host.querySelector('#tpl-fields');
    fieldsBox.innerHTML = tpl.fields.map(f => `
      <div><label for="tf-${f.k}">${esc(f.label)}${f.src ? ' <span title="بتتملي تلقائي من القضية/الموكل" style="opacity:.6">⚡</span>' : ''}</label>
      ${f.type === 'textarea'
        ? `<textarea id="tf-${f.k}" data-k="${f.k}" rows="3" placeholder="${esc(f.placeholder || '')}"></textarea>`
        : `<input id="tf-${f.k}" data-k="${f.k}" type="${f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}" ${f.type === 'number' ? 'inputmode="decimal"' : ''} placeholder="${esc(f.placeholder || '')}">`}
      </div>`).join('');

    const preview = host.querySelector('#tpl-preview');
    const render = () => { preview.textContent = fillTemplate(tpl, values); };
    fieldsBox.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => {
      values[el.dataset.k] = el.value; auto.delete(el.dataset.k); render();
    }));

    const applyAuto = () => {
      for (const f of tpl.fields) {
        if (!f.src) continue;
        const el = fieldsBox.querySelector(`[data-k="${f.k}"]`);
        // منكتبش فوق حاجة المستخدم كتبها بإيده
        if (el.value && !auto.has(f.k)) continue;
        const v = sourceValue(f.src, { kase, client });
        el.value = v == null ? '' : String(v);
        values[f.k] = el.value;
        if (el.value) auto.add(f.k); else auto.delete(f.k);
      }
      render();
    };
    applyAuto(); // التاريخ واسم المكتب

    await loadPickers();
    const caseSel = host.querySelector('#tpl-case'), clientSel = host.querySelector('#tpl-client');
    if (!caseSel) return; // المستخدم رجع للقايمة
    caseSel.innerHTML += (cases || []).map(c => `<option value="${c.id}">${esc([c.case_number, c.client_name, c.court].filter(Boolean).join(' — ') || 'قضية #' + c.id)}</option>`).join('');
    clientSel.innerHTML += (clients || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    caseSel.addEventListener('change', () => {
      kase = (cases || []).find(c => String(c.id) === caseSel.value) || null;
      if (kase?.client_id) { client = (clients || []).find(c => c.id === kase.client_id) || client; clientSel.value = client ? String(client.id) : ''; }
      applyAuto();
    });
    clientSel.addEventListener('change', () => { client = (clients || []).find(c => String(c.id) === clientSel.value) || null; applyAuto(); });

    host.querySelector('#tpl-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(fillTemplate(tpl, values)); toast('📋 اتنسخ', 'ok'); } catch { toast('انسخ يدوي', 'bad'); }
    });
    mountExportMenu(host.querySelector('#tpl-export'), () => ({
      title: tpl.title, meta: [], blocks: [{ type: 'text', text: fillTemplate(tpl, values) }],
    }), { formats: ['word', 'pdf'], label: '⬇️ Word / طباعة', filename: tpl.title });
    host.querySelector('#tpl-save')?.addEventListener('click', () =>
      onSave({ title: tpl.title, body: fillTemplate(tpl, values), source: 'template', template_id: tpl.id, case_id: kase?.id || null }));
  };

  list();
}
