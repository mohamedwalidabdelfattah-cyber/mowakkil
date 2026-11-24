// web/js/whatsapp.js
// رسايل واتساب جاهزة (تذكير جلسة / تذكير أتعاب / تحديث قضية / رسالة عامة)
// بتفتح واتساب برسالة مكتوبة — المحامي بيراجعها ويدوس إرسال بنفسه (wa.me، من غير أي API مدفوع).

import { apiJson, hasFeature } from './api.js';
import { esc, toast, showUpgradeModal } from './ui.js';
import { normalizePhone } from './phone.js';

export const WA_KINDS = {
  session: 'تذكير بجلسة',
  fee: 'تذكير بالأتعاب',
  update: 'تحديث عن القضية',
  general: 'رسالة عامة',
};

export const WA_PLACEHOLDERS = {
  '{client}': 'اسم الموكل',
  '{case}': 'رقم القضية',
  '{court}': 'المحكمة',
  '{date}': 'تاريخ الجلسة',
  '{amount}': 'المبلغ المتبقي',
  '{due}': 'ميعاد الاستحقاق',
  '{office}': 'اسم المكتب',
};

export const WA_DEFAULTS = {
  session:
`أستاذ/ة {client}، تحية طيبة 🌿
نفكّر حضرتك بجلسة القضية رقم {case} يوم {date}
أمام {court}.
لو عندك أي استفسار أو مستندات محتاجين نجهزها، تواصل معانا.
{office}`,
  fee:
`أستاذ/ة {client}، تحية طيبة
نحب نفكّر حضرتك إن المتبقي من الأتعاب {amount} جنيه
عن القضية رقم {case}
ميعاد الاستحقاق: {due}
شكراً لتعاونك.
{office}`,
  update:
`أستاذ/ة {client}، تحية طيبة
تحديث بخصوص القضية رقم {case}:
الجلسة الجاية يوم {date} أمام {court}.

{office}`,
  general:
`أستاذ/ة {client}، تحية طيبة

{office}`,
};

// ============================================================
// تحويل الرقم لصيغة دولية (مصر افتراضياً)
// ============================================================
// تحويل الأرقام في مكان واحد (web/js/phone.js)
export { normalizePhone };

export function waUrl(phone, text = '') {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

// ============================================================
// إعدادات المكتب (اسم المكتب + القوالب المعدّلة)
// ============================================================
let _settings = null;
export async function getWaSettings(force = false) {
  if (_settings && !force) return _settings;
  let s = {};
  try { s = await apiJson('/api/settings'); } catch { /* من غير نت ومفيش نسخة: القوالب الافتراضية */ }
  let custom = {};
  try { custom = s?.wa_templates ? JSON.parse(s.wa_templates) : {}; } catch { custom = {}; }
  _settings = {
    office: s?.office_name_ar || document.getElementById('topbar-title')?.textContent?.trim() || '',
    templates: { ...WA_DEFAULTS, ...custom },
    custom,
  };
  return _settings;
}
export function resetWaSettings() { _settings = null; }

// ============================================================
// تجهيز النص
// ============================================================
export function fmtDateAr(d) {
  if (!d) return '';
  const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtAmount(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// أي سطر فيه متغير قيمته فاضية بيتشال (مثلاً قضية من غير محكمة)
export function fillTemplate(tpl, vars) {
  const lines = String(tpl || '').split('\n');
  const out = [];
  for (const line of lines) {
    let missing = false;
    const filled = line.replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      const v = vars[k];
      if (v === null || v === undefined || String(v).trim() === '') { missing = true; return ''; }
      return String(v);
    });
    if (!missing) out.push(filled);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function varsFor(ctx, office) {
  return {
    client: ctx.client_name || '',
    case: ctx.case_number || '',
    court: ctx.court || '',
    date: fmtDateAr(ctx.session_date),
    amount: ctx.remaining != null ? fmtAmount(ctx.remaining) : '',
    due: fmtDateAr(ctx.due_date),
    office: office ? `مكتب ${office.replace(/^مكتب\s+/, '')}` : '',
  };
}

// ============================================================
// نافذة المراجعة قبل الإرسال
// ctx: { kind, phone, client_name, case_number, court, session_date, remaining, due_date, kinds? }
// ============================================================
export async function openWhatsAppComposer(ctx = {}) {
  if (!hasFeature('whatsapp')) {
    showUpgradeModal('whatsapp', 'pro');
    return;
  }
  const st = await getWaSettings();
  const kinds = (ctx.kinds || [ctx.kind || 'general']).filter(k => WA_KINDS[k]);
  let kind = kinds[0] || 'general';
  const phoneOk = normalizePhone(ctx.phone);

  document.getElementById('wa-composer')?.remove();
  const m = document.createElement('div');
  m.id = 'wa-composer';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal-card wa-card" role="dialog" aria-modal="true" aria-labelledby="wa-title">
      <div class="wa-head">
        <div>
          <h3 id="wa-title" style="margin:0">💬 رسالة واتساب</h3>
          <div class="meta">${esc(ctx.client_name || 'موكل')}${ctx.phone ? ` · <span class="mono" dir="ltr">${esc(ctx.phone)}</span>` : ''}</div>
        </div>
        <button class="icon-btn" data-wa="close" aria-label="إغلاق">✕</button>
      </div>
      ${kinds.length > 1 ? `
        <div class="wa-kinds" role="tablist">
          ${kinds.map(k => `<button type="button" class="wa-kind ${k === kind ? 'active' : ''}" data-kind="${k}">${WA_KINDS[k]}</button>`).join('')}
        </div>` : ''}
      ${phoneOk ? '' : `<div class="wa-warn">⚠️ ${ctx.phone ? 'رقم الموكل مش مظبوط' : 'مفيش رقم موبايل للموكل'} — تقدر تنسخ الرسالة وتبعتها بنفسك.</div>`}
      <label class="wa-label" for="wa-text">الرسالة (تقدر تعدّلها قبل الإرسال)</label>
      <textarea id="wa-text" class="wa-text" rows="8" dir="rtl"></textarea>
      <div class="wa-foot">
        <span class="meta">بيفتح واتساب والرسالة مكتوبة، وانت اللي بتدوس إرسال.</span>
        <div class="wa-btns">
          <button type="button" class="btn btn-ghost" data-wa="copy">📋 نسخ</button>
          ${phoneOk ? `<button type="button" class="btn wa-send" data-wa="send">💬 افتح واتساب</button>` : ''}
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);

  const ta = m.querySelector('#wa-text');
  const fill = () => { ta.value = fillTemplate(st.templates[kind], varsFor(ctx, st.office)); };
  fill();
  setTimeout(() => ta.focus(), 50);

  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  m.addEventListener('click', async (e) => {
    if (e.target === m || e.target.closest('[data-wa="close"]')) return close();
    const kb = e.target.closest('[data-kind]');
    if (kb) {
      kind = kb.dataset.kind;
      m.querySelectorAll('.wa-kind').forEach(b => b.classList.toggle('active', b === kb));
      fill();
      return;
    }
    if (e.target.closest('[data-wa="copy"]')) {
      try { await navigator.clipboard.writeText(ta.value); toast('اتنسخت الرسالة ✓', 'ok'); }
      catch { ta.select(); toast('حدد الرسالة وانسخها'); }
      return;
    }
    if (e.target.closest('[data-wa="send"]')) {
      const url = waUrl(ctx.phone, ta.value.trim());
      if (!url) return;
      window.open(url, '_blank', 'noopener');
      ctx.onSent?.();
      close();
    }
  });
}

// ============================================================
// تذكير موكلين جلسات بكرة (قايمة، كل واحد بزرار)
// ============================================================
const SENT_KEY = 'mowakkil_wa_sent';
function sentMap() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch { return {}; }
}
function markSent(key) {
  try {
    const m = sentMap();
    m[key] = Date.now();
    const cutoff = Date.now() - 14 * 86400000; // نشيل اللي عدّى عليه أسبوعين
    for (const k of Object.keys(m)) if (m[k] < cutoff) delete m[k];
    localStorage.setItem(SENT_KEY, JSON.stringify(m));
  } catch { /* مش مهم */ }
}

export function localDateStr(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export async function openTomorrowReminders(sessions = null) {
  if (!hasFeature('whatsapp')) { showUpgradeModal('whatsapp', 'pro'); return; }
  const t = new Date(); t.setDate(t.getDate() + 1);
  const tomorrow = localDateStr(t);
  // دايماً نسخة جديدة (عشان أي جلسة اتضافت من شوية تظهر)، ولو فشل نرجع للقايمة اللي معانا
  let list;
  try { list = await apiJson('/api/agenda?days=2', { skipCache: true }); }
  catch (e) {
    if (!sessions) { toast('مقدرناش نجيب الجلسات: ' + e.message, 'bad'); return; }
    list = sessions;
  }
  list = (Array.isArray(list) ? list : []).filter(s => String(s.session_date).slice(0, 10) === tomorrow);

  document.getElementById('wa-tomorrow')?.remove();
  const m = document.createElement('div');
  m.id = 'wa-tomorrow';
  m.className = 'modal-overlay show';
  const render = () => {
    const sent = sentMap();
    m.innerHTML = `
      <div class="modal-card wa-card" role="dialog" aria-modal="true" aria-labelledby="wa-tm-title">
        <div class="wa-head">
          <div>
            <h3 id="wa-tm-title" style="margin:0">💬 تذكير موكلين جلسات بكرة</h3>
            <div class="meta">${esc(fmtDateAr(tomorrow))} · ${list.length} جلسة</div>
          </div>
          <button class="icon-btn" data-wa="close" aria-label="إغلاق">✕</button>
        </div>
        ${list.length ? `<div class="wa-list">
          ${list.map((s, i) => {
            const done = sent[`s${s.id}`];
            const ok = normalizePhone(s.client_phone);
            return `
              <div class="wa-row ${done ? 'done' : ''}">
                <div class="wa-row-info">
                  <strong>${esc(s.client_name || 'موكل')}</strong>
                  <span class="meta">${esc(s.case_number || '—')}${s.court ? ' · ' + esc(s.court) : ''}</span>
                </div>
                ${ok
                  ? `<button type="button" class="btn btn-sm ${done ? 'btn-ghost' : 'wa-send'}" data-row="${i}">${done ? '✓ اتبعت · تاني' : '💬 إرسال'}</button>`
                  : `<span class="meta">مفيش رقم</span>`}
              </div>`;
          }).join('')}
        </div>` : '<div class="empty" style="padding:24px">مفيش جلسات بكرة 🎉</div>'}
        <div class="meta" style="margin-top:12px">كل زرار بيفتح واتساب برسالة التذكير، تراجعها وتدوس إرسال. اللي اتبعت بيتعلّم عليه.</div>
      </div>`;
  };
  render();
  document.body.appendChild(m);
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-wa="close"]')) { m.remove(); return; }
    const b = e.target.closest('[data-row]');
    if (!b) return;
    const s = list[Number(b.dataset.row)];
    openWhatsAppComposer({
      kind: 'session', phone: s.client_phone, client_name: s.client_name,
      case_number: s.case_number, court: s.court, session_date: s.session_date,
      onSent: () => { markSent(`s${s.id}`); render(); },
    });
  });
}
