// web/js/views/sa-followup.js
// لوحة مسؤول المنصة ← متابعة الفترة التجريبية
// النظام بيقول مين محتاج رسالة النهارده والرسالة جاهزة باسمه — والإرسال من واتساب المسؤول نفسه.
// الرسايل قوالب المسؤول بيعدّلها من هنا (المتغيرات بين {} بتتملى لوحدها).

import { saApiJson } from '../api.js';
import { esc, toast } from '../ui.js';
import { waLinkFor } from '../phone.js';

const SEG_META = {
  not_started: { label: 'مبدأش', icon: '🔴', hint: 'سجّل وماضافش ولا قضية ولا موكل' },
  stalled:     { label: 'بدأ ووقف', icon: '🟡', hint: 'ضاف حاجة ومفيش حركة من 3 أيام أو أكتر' },
  active:      { label: 'نشيط', icon: '🟢', hint: 'بيستخدم البرنامج' },
  ending:      { label: 'التجربة بتخلص', icon: '⏰', hint: 'فاضل 3 أيام أو أقل' },
  expired:     { label: 'التجربة خلصت', icon: '⌛', hint: 'خلصت من أقل من 30 يوم' },
};
export const PLACEHOLDERS = [
  ['{الاسم}', 'اسم صاحب المكتب'],
  ['{المكتب}', 'اسم المكتب'],
  ['{القضايا}', 'عدد القضايا'],
  ['{الموكلين}', 'عدد الموكلين'],
  ['{الأيام_المتبقية}', 'الأيام الفاضلة في التجربة'],
  ['{رابط_الموقع}', 'لينك الدخول للبرنامج'],
  ['{رابط_الباقات}', 'لينك صفحة الباقات'],
];

let state = { filter: 'due', data: null };

export function fillTemplate(body, o) {
  const origin = location.origin;
  const vals = {
    'الاسم': (o.owner_name || '').trim() || 'حضرتك',
    'المكتب': o.office_name || '',
    'القضايا': String(o.cases_count ?? 0),
    'الموكلين': String(o.clients_count ?? 0),
    'الأيام_المتبقية': String(Math.max(0, o.days_left ?? 0)),
    'رابط_الموقع': origin + '/',
    'رابط_الباقات': origin + '/pricing.html',
  };
  let text = String(body || '');
  // "مكتب {المكتب}" واسم المكتب أصلاً بيبدأ بـ"مكتب" → متتكررش الكلمة
  if (/^\s*مكتب\s/.test(vals['المكتب'])) text = text.replace(/مكتب\s+\{المكتب\}/g, '{المكتب}');
  return text.replace(/\{([^{}]+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}

const SAMPLE = { owner_name: 'محمد أحمد', office_name: 'مكتب الأستاذ محمد للمحاماة', cases_count: 4, clients_count: 3, days_left: 9 };

function fmtAgo(s) {
  if (!s) return 'مفيش حركة';
  const d = new Date(/[zZ]$/.test(s) ? s : String(s).replace(' ', 'T') + 'Z');
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return 'النهارده';
  if (days === 1) return 'امبارح';
  return `من ${days} يوم`;
}

// ============================================================
export async function mountFollowup(host) {
  host.innerHTML = `
    <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">📣 متابعة الفترة التجريبية</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-fu="templates">✏️ الرسايل</button>
        <button class="btn btn-ghost btn-sm" data-fu="reload">↻ تحديث</button>
      </div>
    </div>
    <div class="meta" style="margin:4px 0 10px">النظام بيختار لكل مكتب الرسالة المناسبة النهارده حسب استخدامه. اضغط «ابعت» يفتح واتساب برقمك والرسالة جاهزة، ويتسجل إنها اتبعتت.</div>
    <div id="fu-chips" class="fu-chips"></div>
    <div id="fu-list"><div class="skeleton"></div><div class="skeleton"></div></div>
  `;
  host.querySelector('[data-fu="templates"]').addEventListener('click', () => openTemplates(() => load(host)));
  host.querySelector('[data-fu="reload"]').addEventListener('click', () => load(host));
  await load(host);
}

async function load(host) {
  const list = host.querySelector('#fu-list');
  try { state.data = await saApiJson('/api/superadmin/followups'); }
  catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  renderChips(host); renderList(host);
  // الرقم اللي على تاب "متابعة التجربة"
  const badge = document.querySelector('[data-badge="followup"]');
  if (badge) { badge.textContent = state.data.due_today || 0; badge.hidden = !state.data.due_today; }
}

function renderChips(host) {
  const d = state.data;
  const chip = (key, label, n) => `<button class="fu-chip ${state.filter === key ? 'active' : ''}" data-filter="${key}">${label} <b>${n}</b></button>`;
  host.querySelector('#fu-chips').innerHTML =
    chip('due', '📬 مستني رسالة النهارده', d.due_today)
    + Object.entries(SEG_META).map(([k, m]) => chip(k, `${m.icon} ${m.label}`, d.counts[k] || 0)).join('')
    + chip('all', 'الكل', d.items.length);
  host.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderChips(host); renderList(host); }));
}

function renderList(host) {
  const d = state.data;
  const tpl = Object.fromEntries(d.templates.map(t => [t.key, t]));
  let items = d.items;
  if (state.filter === 'due') items = items.filter(i => i.status === 'due' && i.owner_phone);
  else if (state.filter !== 'all') items = items.filter(i => i.segment === state.filter);
  const el = host.querySelector('#fu-list');
  if (!items.length) {
    el.innerHTML = `<div class="empty">${state.filter === 'due' ? '✅ مفيش حد مستني رسالة النهارده' : 'مفيش مكاتب هنا'}</div>`;
    return;
  }
  el.innerHTML = items.map(i => {
    const m = SEG_META[i.segment] || {};
    const next = i.due_key ? tpl[i.due_key] : null;
    const statusLine = i.stopped ? '⏸ المتابعة متوقفة'
      : i.status === 'cooldown' ? `⏳ اتبعتله ${fmtAgo(i.last_sent_at)} — الرسالة الجاية بعد يومين من آخر رسالة`
      : i.status === 'done' ? '✔️ خلصت الرسايل المناسبة له دلوقتي'
      : next ? `📨 الرسالة الجاية: <strong>${esc(next.title)}</strong>` : '';
    return `
      <div class="item fu-item" data-office="${i.office_id}">
        <div class="top">
          <span class="name">${esc(i.office_name || 'مكتب #' + i.office_id)}</span>
          <span class="fu-seg fu-${i.segment}" title="${esc(m.hint || '')}">${m.icon || ''} ${esc(m.label || i.segment)}</span>
        </div>
        <div class="meta">
          👤 ${esc(i.owner_name || '—')}${i.owner_phone ? ' · 📱 ' + esc(i.owner_phone) : ' · ⚠️ من غير رقم'}
          · 📅 يوم ${i.days_since} من التجربة${i.days_left != null ? (i.days_left > 0 ? ` (فاضل ${i.days_left})` : ' (خلصت)') : ''}
        </div>
        ${i.source_label ? `<div class="meta">📣 جه من: <strong>${esc(i.source_label)}</strong>${i.campaign ? ` · ${esc(i.campaign)}` : ""}</div>` : ""}
        <div class="meta">📁 ${i.cases_count} قضية · 👥 ${i.clients_count} موكل · آخر حركة: ${fmtAgo(i.last_activity_at)} · 📨 اتبعتله ${i.sent_count} رسالة</div>
        <div class="meta">${statusLine}</div>
        ${i.note ? `<div class="meta fu-note">📝 ${esc(i.note)}</div>` : ''}
        <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${i.owner_phone && !i.stopped ? `<button class="btn btn-primary btn-sm" data-send="${i.office_id}">💬 ${next ? 'ابعت' : 'ابعت رسالة'}</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-note="${i.office_id}">📝 ملاحظة</button>
          <button class="btn btn-ghost btn-sm" data-stop="${i.office_id}">${i.stopped ? '▶️ رجّع المتابعة' : '⏸ وقّف المتابعة'}</button>
        </div>
      </div>`;
  }).join('');

  const find = id => d.items.find(x => String(x.office_id) === String(id));
  el.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', () => openSend(find(b.dataset.send), () => load(host))));
  el.querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', async () => {
    const o = find(b.dataset.note);
    const note = prompt('ملاحظة على المكتب ده (مثلاً: طلب مكالمة، مهتم بالباقة المتقدمة…)', o.note || '');
    if (note === null) return;
    try { await saApiJson(`/api/superadmin/followups/${o.office_id}`, { method: 'PATCH', body: JSON.stringify({ note }) }); load(host); }
    catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  }));
  el.querySelectorAll('[data-stop]').forEach(b => b.addEventListener('click', async () => {
    const o = find(b.dataset.stop);
    if (!o.stopped && !confirm(`توقّف الرسايل لمكتب "${o.office_name}"؟ (مثلاً لو طلب ميتبعتلوش أو مش مهتم)`)) return;
    try { await saApiJson(`/api/superadmin/followups/${o.office_id}`, { method: 'PATCH', body: JSON.stringify({ stopped: !o.stopped }) }); load(host); }
    catch (e) { toast('⚠️ ' + e.message, 'bad'); }
  }));
}

// ============================================================
// إرسال: معاينة الرسالة (وتعديلها للمكتب ده بس) قبل ما يفتح واتساب
// ============================================================
function openSend(o, onDone) {
  const d = state.data;
  const active = d.templates.filter(t => t.active);
  let key = o.due_key || active[0]?.key;
  const modal = overlay(`
    <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">💬 رسالة لـ ${esc(o.owner_name || o.office_name)}</h3>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <label class="meta" style="display:block;margin-bottom:4px">الرسالة</label>
    <select id="fu-tpl" class="select" style="width:100%;margin-bottom:10px">
      ${active.map(t => `<option value="${esc(t.key)}" ${t.key === key ? 'selected' : ''}>${esc(t.title)}${(o.sent_keys || []).includes(t.key) ? ' (اتبعتت قبل كده)' : ''}${t.key === o.due_key ? ' ⭐ المقترحة' : ''}</option>`).join('')}
    </select>
    <textarea id="fu-text" class="input" rows="11" style="width:100%;font-family:inherit;line-height:1.6"></textarea>
    <div class="meta" style="margin:6px 0 12px">التعديل هنا للمكتب ده بس. عشان تغيّر الرسالة لكل المكاتب استخدم «✏️ الرسايل».</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-ghost" data-close>إلغاء</button>
      <button class="btn btn-primary" data-go>💬 افتح واتساب وابعت</button>
    </div>`);
  const text = modal.querySelector('#fu-text');
  const fill = () => { const t = d.templates.find(x => x.key === key); text.value = fillTemplate(t?.body || '', o); };
  fill();
  modal.querySelector('#fu-tpl').addEventListener('change', (e) => { key = e.target.value; fill(); });
  modal.querySelector('[data-go]').addEventListener('click', async () => {
    const url = waLinkFor(o.owner_phone, text.value.trim());
    if (!url) return toast('رقم الموبايل مش صالح لواتساب', 'bad');
    window.open(url, '_blank', 'noopener');
    try {
      await saApiJson(`/api/superadmin/followups/${o.office_id}/sent`, { method: 'POST', body: JSON.stringify({ template_key: key }) });
      toast('✅ اتسجلت إنها اتبعتت', 'ok');
    } catch (e) { toast('⚠️ ' + e.message, 'bad'); }
    modal.remove(); onDone();
  });
}

// ============================================================
// تعديل الرسايل (القوالب)
// ============================================================
async function openTemplates(onDone) {
  let data;
  try { data = await saApiJson('/api/superadmin/followup-templates'); }
  catch (e) { return toast('⚠️ ' + e.message, 'bad'); }
  const modal = overlay(`
    <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">✏️ رسايل المتابعة</h3>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="meta" style="margin-bottom:10px">النظام بيختار أول رسالة (بالترتيب) تناسب مجموعة المكتب وعدّى على تسجيله عدد الأيام المكتوب، ومتبعتتلوش قبل كده. بين كل رسالتين يومين على الأقل.</div>
    <div id="fu-tpls"></div>
    <button class="btn btn-ghost btn-block" data-add style="margin-top:10px">➕ رسالة جديدة</button>`, 760);
  const box = modal.querySelector('#fu-tpls');
  const draw = () => {
    box.innerHTML = data.templates.map(t => tplCard(t)).join('');
    data.templates.forEach(t => wireCard(box.querySelector(`[data-tpl="${t.id}"]`), t));
  };
  const wireCard = (card, t) => {
    const body = card.querySelector('[name="body"]');
    const prev = card.querySelector('.fu-preview');
    const upd = () => { prev.textContent = fillTemplate(body.value, SAMPLE); card.querySelector('.fu-len').textContent = body.value.length; };
    body.addEventListener('input', upd); upd();
    card.querySelectorAll('[data-ph]').forEach(b => b.addEventListener('click', () => {
      const s = body.selectionStart ?? body.value.length, e = body.selectionEnd ?? s;
      body.value = body.value.slice(0, s) + b.dataset.ph + body.value.slice(e);
      body.focus(); body.selectionStart = body.selectionEnd = s + b.dataset.ph.length; upd();
    }));
    card.querySelector('[data-save]').addEventListener('click', async () => {
      const segs = [...card.querySelectorAll('[name="seg"]:checked')].map(x => x.value);
      const payload = {
        title: card.querySelector('[name="title"]').value, body: body.value,
        segments: segs.length ? segs : ['any'], min_day: card.querySelector('[name="min_day"]').value,
        active: card.querySelector('[name="active"]').checked, sort: card.querySelector('[name="sort"]').value,
      };
      try {
        if (t.id) await saApiJson(`/api/superadmin/followup-templates/${t.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else await saApiJson('/api/superadmin/followup-templates', { method: 'POST', body: JSON.stringify(payload) });
        toast('✅ اتحفظت الرسالة', 'ok');
        data = await saApiJson('/api/superadmin/followup-templates'); draw(); onDone();
      } catch (e) { toast('⚠️ ' + e.message, 'bad'); }
    });
    card.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!confirm(`تحذف رسالة "${t.title}"؟`)) return;
      try { await saApiJson(`/api/superadmin/followup-templates/${t.id}`, { method: 'DELETE' }); data = await saApiJson('/api/superadmin/followup-templates'); draw(); onDone(); }
      catch (e) { toast('⚠️ ' + e.message, 'bad'); }
    });
  };
  modal.querySelector('[data-add]').addEventListener('click', () => {
    if (box.querySelector('[data-tpl="new"]')) return;
    const t = { id: null, title: '', body: 'أهلاً أ/ {الاسم} 👋\n', segments: 'not_started', min_day: 2, active: 1, sort: (Math.max(0, ...data.templates.map(x => x.sort)) + 10) };
    box.insertAdjacentHTML('beforeend', tplCard(t));
    const card = box.querySelector('[data-tpl="new"]');
    wireCard(card, t); card.scrollIntoView({ behavior: 'smooth' }); card.querySelector('[name="title"]').focus();
  });
  draw();
}

function tplCard(t) {
  const segs = String(t.segments || 'any').split(',');
  const any = segs.includes('any');
  return `
    <div class="card fu-tpl" data-tpl="${t.id || 'new'}">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input name="title" class="input" value="${esc(t.title)}" placeholder="اسم الرسالة (مثلاً: ترحيب)" style="flex:1;min-width:160px">
        <label class="meta" style="display:flex;align-items:center;gap:4px">بعد <input name="min_day" type="number" min="0" max="60" class="input" value="${t.min_day || 0}" style="width:64px"> يوم من التسجيل</label>
        <label class="meta" style="display:flex;align-items:center;gap:4px">الترتيب <input name="sort" type="number" class="input" value="${t.sort || 0}" style="width:64px"></label>
        <label class="meta" style="display:flex;align-items:center;gap:4px"><input name="active" type="checkbox" ${t.active ? 'checked' : ''}> شغّالة</label>
      </div>
      <div class="fu-segs">
        <span class="meta">تتبعت لـ:</span>
        ${Object.entries(SEG_META).map(([k, m]) => `<label><input type="checkbox" name="seg" value="${k}" ${!any && segs.includes(k) ? 'checked' : ''}> ${m.icon} ${m.label}</label>`).join('')}
        <span class="meta">(لو مختارتش حاجة = للكل)</span>
      </div>
      <div class="fu-ph">${PLACEHOLDERS.map(([p, h]) => `<button type="button" class="fu-chip" data-ph="${p}" title="${h}">${p}</button>`).join('')}</div>
      <div class="fu-edit">
        <div><textarea name="body" class="input" rows="9" style="width:100%;font-family:inherit;line-height:1.6">${esc(t.body)}</textarea><div class="meta"><span class="fu-len">0</span> حرف</div></div>
        <div><div class="meta" style="margin-bottom:4px">شكلها عند المحامي (مثال):</div><div class="fu-preview"></div></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        ${t.id ? '<button class="btn btn-ghost btn-sm" data-del style="color:var(--danger)">🗑 حذف</button>' : ''}
        <button class="btn btn-primary btn-sm" data-save>💾 حفظ</button>
      </div>
    </div>`;
}

function overlay(inner, maxWidth = 560) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay show fu-modal';
  modal.innerHTML = `<div class="modal-card" style="max-width:${maxWidth}px;max-height:90vh;overflow:auto">${inner}</div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) modal.remove(); });
  return modal;
}
