// web/js/ai-privacy.js
// اختيار "خصوصية الذكاء الاصطناعي" لبيانات الموكلين + موافقة مسؤول المكتب.
// بيظهر لوحده أول مرة الذكاء الاصطناعي يحتاج يقرا بيانات موكل (السيرفر بيرجع 412 AI_CONSENT_REQUIRED)،
// وموجود كمان في الإعدادات ← الخصوصية.
import { apiJson, getRole } from './api.js';
import { esc, toast } from './ui.js';
import { can } from './access.js';

const MODES = [
  {
    id: 'strict', icon: '🔒', title: 'سري — Cloudflare بس',
    body: 'مستندات ووقائع الموكلين بتتعالج على نماذج Cloudflare بس، وCloudflare مش بيدرّب نماذجه على بيانات العملاء. والأسماء والأرقام بتتخفي برضه.',
    note: 'الحصة المجانية اليومية لنماذج Cloudflare محدودة ومشتركة، فممكن التحليل يقف لحد تاني يوم، والجودة أقل شوية من Gemini.',
  },
  {
    id: 'balanced', icon: '⚖️', title: 'متوازن — إخفاء البيانات الشخصية',
    body: 'الأسماء المعروفة والرقم القومي والتليفونات والإيميلات بتتخفي قبل الإرسال وبترجع في الرد، وبعدين النص بيروح لأفضل نموذج مجاني (Gemini).',
    note: 'الوقائع نفسها بتوصل للمزوّد مجهّلة، والخدمة المجانية من Google ممكن تستخدم النص لتحسين خدماتها. OpenRouter مستبعد دايماً لبيانات الموكلين.',
  },
  {
    id: 'off', icon: '⛔', title: 'إيقاف لبيانات الموكلين',
    body: 'مفيش أي تحليل بالذكاء الاصطناعي لمستندات أو وقائع موكلين. البحث القانوني والأسئلة العامة بس اللي شغالين.',
    note: '',
  },
];

export function pickerHTML(current = 'balanced', { isAdmin = can('settings.manage'), acceptedAt = null } = {}) {
  return `
    <div class="ai-privacy-picker">
      ${MODES.map(m => `
        <label class="aip-option ${m.id === current ? 'selected' : ''}">
          <input type="radio" name="aip-mode" value="${m.id}" ${m.id === current ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}>
          <div>
            <div class="aip-title">${m.icon} ${esc(m.title)}</div>
            <div class="aip-body">${esc(m.body)}</div>
            ${m.note ? `<div class="aip-note">${esc(m.note)}</div>` : ''}
          </div>
        </label>`).join('')}
      ${isAdmin ? `
        <label class="aip-consent">
          <input type="checkbox" id="aip-accept">
          <span>أنا مسؤول المكتب، وفهمت إزاي بيانات الموكلين بتتعالج في الاختيار ده، وموافق عليه نيابةً عن المكتب.
          وعارف إن نتايج الذكاء الاصطناعي مساعدة بس، ولازم تتراجع من محامي قبل الاعتماد عليها.</span>
        </label>
        <button class="btn btn-primary btn-block" id="aip-save">حفظ والموافقة</button>
        <div id="aip-status" class="status"></div>`
      : `<div class="aip-note" style="margin-top:10px">تغيير الإعداد ده لمسؤول المكتب بس.</div>`}
      ${acceptedAt ? `<div class="meta" style="margin-top:8px;font-size:12px">آخر موافقة: ${esc(String(acceptedAt).slice(0, 16).replace('T', ' '))}</div>` : ''}
    </div>`;
}

export function bindPicker(root, { onSaved } = {}) {
  root.querySelectorAll('input[name="aip-mode"]').forEach(r => r.addEventListener('change', () => {
    root.querySelectorAll('.aip-option').forEach(o => o.classList.toggle('selected', o.contains(r) && r.checked));
  }));
  root.querySelector('#aip-save')?.addEventListener('click', async () => {
    const mode = root.querySelector('input[name="aip-mode"]:checked')?.value;
    const accept = root.querySelector('#aip-accept')?.checked;
    const st = root.querySelector('#aip-status');
    if (!mode) { st.textContent = 'اختار مستوى الخصوصية'; st.className = 'status bad'; return; }
    if (!accept) { st.textContent = 'علّم على الموافقة الأول'; st.className = 'status bad'; return; }
    st.textContent = '⏳ جاري الحفظ...'; st.className = 'status';
    try {
      await apiJson('/api/settings/ai-privacy', { method: 'POST', body: JSON.stringify({ mode, accept: true }) });
      st.textContent = '✓ اتحفظ'; st.className = 'status ok';
      toast('تم حفظ إعداد خصوصية الذكاء الاصطناعي', 'ok');
      onSaved?.(mode);
    } catch (e) {
      st.textContent = e.message; st.className = 'status bad';
    }
  });
}

let open = false;
export async function showAiConsentModal() {
  if (open) return;
  open = true;
  let current = 'balanced';
  try { current = (await apiJson('/api/settings/ai-privacy', { skipCache: true })).mode || current; } catch {}
  const isAdmin = can('settings.manage');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.id = 'ai-consent-modal';
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="max-width:560px;text-align:right">
      <h3 style="margin:0 0 6px">🔒 خصوصية الذكاء الاصطناعي لبيانات الموكلين</h3>
      <p class="meta" style="margin:0 0 14px;line-height:1.8">
        ${isAdmin
          ? 'قبل ما الذكاء الاصطناعي يقرا مستندات أو وقائع موكلينك لأول مرة، اختار إزاي تحب نتعامل مع البيانات. تقدر تغيّره بعدين من الإعدادات ← الخصوصية.'
          : 'الميزة دي محتاجة موافقة مسؤول المكتب الأول على طريقة معالجة بيانات الموكلين. اطلب منه يفتح الإعدادات ← الخصوصية.'}
      </p>
      ${pickerHTML(current, { isAdmin })}
      <button class="btn btn-ghost btn-block" data-close style="margin-top:8px">${isAdmin ? 'لاحقاً' : 'تمام'}</button>
    </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.remove(); open = false; };
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) close(); });
  bindPicker(modal, { onSaved: () => { close(); toast('تمام — جرّب تاني دلوقتي', 'ok'); } });
}
