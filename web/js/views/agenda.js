// web/js/views/agenda.js
// الأجندة — Toast UI Calendar
// كل أنواع المواعيد: جلسات، مهام، أتعاب، ومواعيد حرة (اجتماع، استشارة، موعد نهائي، إجراء، تذكير، شخصي، أخرى)

import { apiJson, api, hasFeature } from '../api.js';
import { openWhatsAppComposer } from '../whatsapp.js';
import { esc, toast, skeleton } from '../ui.js';
import { can } from '../access.js';

// ============================================================
// الأنواع
// ============================================================
// cal = calendarId في التقويم، create = الصلاحية المطلوبة للإضافة
export const AGENDA_KINDS = [
  { key: 'session',      cal: 'sessions',         label: 'جلسة',                 icon: '⚖️', bg: '#0F172A', fg: '#ffffff', create: 'agenda.create' },
  { key: 'task',         cal: 'tasks',            label: 'مهمة',                 icon: '✅', bg: '#12B76A', fg: '#ffffff', create: 'tasks.create' },
  { key: 'meeting',      cal: 'ev-meeting',       label: 'اجتماع / مقابلة موكل', icon: '🤝', bg: '#2E90FA', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'consultation', cal: 'ev-consultation',  label: 'استشارة',              icon: '💬', bg: '#7A5AF8', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'deadline',     cal: 'ev-deadline',      label: 'موعد نهائي / طعن',     icon: '⏰', bg: '#D92D20', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'procedure',    cal: 'ev-procedure',     label: 'إجراء (إعلان، شهر عقاري…)', icon: '📋', bg: '#DC6803', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'reminder',     cal: 'ev-reminder',      label: 'تذكير',                icon: '🔔', bg: '#0BA5EC', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'personal',     cal: 'ev-personal',      label: 'شخصي',                 icon: '🙂', bg: '#DD2590', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'other',        cal: 'ev-other',         label: 'أخرى',                 icon: '📌', bg: '#667085', fg: '#ffffff', create: 'agenda.create', ev: true },
  { key: 'fee',          cal: 'fees',             label: 'أتعاب مستحقة',         icon: '💰', bg: '#D4AF37', fg: '#0B1222', create: 'fees.create' },
];
const KIND_BY_KEY = Object.fromEntries(AGENDA_KINDS.map(k => [k.key, k]));
const KIND_BY_CAL = Object.fromEntries(AGENDA_KINDS.map(k => [k.cal, k]));

const HIDDEN_KEY = 'mowakkil_agenda_hidden';
const VIEW_KEY = 'mowakkil_agenda_view';
const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

let calendar = null;
let hostEl = null;
let currentView = 'month'; // month | week | day | list
let hidden = new Set();
let lastList = [];
let renderSeq = 0; // لو الصفحة اترسمت مرتين ورا بعض، الرسمة القديمة متربطش أزرار

function loadPrefs() {
  try { hidden = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch { hidden = new Set(); }
  try { const v = localStorage.getItem(VIEW_KEY); if (['month', 'week', 'day', 'list'].includes(v)) currentView = v; } catch {}
  if (innerWidth <= 640 && currentView === 'week') currentView = 'list';
}
function savePrefs() {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
    localStorage.setItem(VIEW_KEY, currentView);
  } catch {}
}

// نوع الحدث من بيانات التقويم
function kindOf(ev) {
  const r = ev.raw || {};
  if (r.cat === 'event' || ev.calendarId?.startsWith?.('ev-')) return KIND_BY_KEY[r.kind] || KIND_BY_CAL[ev.calendarId] || KIND_BY_KEY.other;
  return KIND_BY_KEY[r.cat] || KIND_BY_CAL[ev.calendarId] || KIND_BY_KEY.task;
}
function catOf(ev) {
  const k = kindOf(ev);
  return k.ev ? 'event' : k.key;
}

// ============================================================
// الصفحة
// ============================================================
export async function render(host) {
  const seq = ++renderSeq;
  hostEl = host;
  loadPrefs();
  const canFees = can('fees.view') && hasFeature('finance');
  const kinds = AGENDA_KINDS.filter(k => k.key !== 'fee' || canFees).filter(k => k.key !== 'task' || can('tasks.view'));

  host.innerHTML = `
    <div class="ag-top">
      <div class="ag-title">
        <h2>📅 الأجندة</h2>
        <div class="ag-range" id="ag-range" aria-live="polite"></div>
      </div>
      <div class="ag-controls">
        <div class="ag-nav" role="group" aria-label="التنقل">
          <button class="btn btn-ghost btn-sm" id="ag-prev" aria-label="اللي قبل">›</button>
          <button class="btn btn-ghost btn-sm" id="ag-today">النهارده</button>
          <button class="btn btn-ghost btn-sm" id="ag-next" aria-label="اللي بعد">‹</button>
        </div>
        <div class="ag-views" role="tablist" aria-label="طريقة العرض">
          ${[['month', 'شهر'], ['week', 'أسبوع'], ['day', 'يوم'], ['list', 'قائمة']].map(([v, l]) =>
            `<button class="ag-view ${currentView === v ? 'active' : ''}" data-view="${v}" role="tab" aria-selected="${currentView === v}">${l}</button>`).join('')}
        </div>
        ${AGENDA_KINDS.some(k => can(k.create)) ? '<button class="btn btn-primary btn-sm" id="ag-add">➕ إضافة</button>' : ''}
      </div>
    </div>

    <div class="ag-chips" role="group" aria-label="إظهار وإخفاء الأنواع">
      ${kinds.map(k => `
        <button class="ag-chip ${hidden.has(k.cal) ? 'off' : ''}" data-cal="${k.cal}" aria-pressed="${!hidden.has(k.cal)}" style="--c:${k.bg}">
          <span class="dot"></span>${k.icon} ${esc(k.label)}
        </button>`).join('')}
      <button class="ag-chip ghost" id="ag-all">الكل</button>
    </div>

    <div id="calendar-host" class="calendar-host" ${currentView === 'list' ? 'hidden' : ''}>${skeleton(6, 'list')}</div>
    <div id="ag-list" class="ag-list" ${currentView === 'list' ? '' : 'hidden'}></div>
  `;

  await loadCalendarLib().catch(() => {});
  if (seq !== renderSeq || !host.isConnected) return;
  initCalendar(host, kinds);

  host.querySelector('#ag-prev').addEventListener('click', () => move(-1));
  host.querySelector('#ag-next').addEventListener('click', () => move(1));
  host.querySelector('#ag-today').addEventListener('click', () => { calendar?.today(); refresh(); });
  host.querySelectorAll('.ag-view').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  host.querySelector('#ag-add')?.addEventListener('click', () => openEventForm({}));

  host.querySelectorAll('.ag-chip[data-cal]').forEach(b => b.addEventListener('click', () => {
    const cal = b.dataset.cal;
    if (hidden.has(cal)) hidden.delete(cal); else hidden.add(cal);
    b.classList.toggle('off', hidden.has(cal));
    b.setAttribute('aria-pressed', String(!hidden.has(cal)));
    calendar?.setCalendarVisibility(cal, !hidden.has(cal));
    savePrefs();
    if (currentView === 'list') renderList(); else fitAlldayPanel();
  }));
  host.querySelector('#ag-all').addEventListener('click', () => {
    hidden.clear(); savePrefs();
    host.querySelectorAll('.ag-chip[data-cal]').forEach(b => { b.classList.remove('off'); b.setAttribute('aria-pressed', 'true'); });
    AGENDA_KINDS.forEach(k => calendar?.setCalendarVisibility(k.cal, true));
    if (currentView === 'list') renderList(); else fitAlldayPanel();
  });
}

function move(dir) {
  if (currentView === 'list') { listOffset += dir * 30; refresh(); return; }
  if (!calendar) return;
  if (dir > 0) calendar.next(); else calendar.prev();
  refresh();
}

function setView(v) {
  currentView = v;
  savePrefs();
  hostEl.querySelectorAll('.ag-view').forEach(b => { b.classList.toggle('active', b.dataset.view === v); b.setAttribute('aria-selected', String(b.dataset.view === v)); });
  const calHost = hostEl.querySelector('#calendar-host');
  const listHost = hostEl.querySelector('#ag-list');
  if (v === 'list') { calHost.hidden = true; listHost.hidden = false; listOffset = 0; }
  else { calHost.hidden = false; listHost.hidden = true; calendar?.changeView(v); }
  refresh();
}

function refresh() {
  updateRangeLabel();
  if (currentView === 'list') loadList(); else loadEvents();
}

function updateRangeLabel() {
  const el = hostEl?.querySelector('#ag-range');
  if (!el) return;
  const fmt = (d, o) => d.toLocaleDateString('ar-EG-u-nu-latn', o);
  if (currentView === 'list') {
    const s = new Date(); s.setDate(s.getDate() + listOffset);
    const e = new Date(s); e.setDate(e.getDate() + 30);
    el.textContent = `${fmt(s, { day: 'numeric', month: 'long' })} – ${fmt(e, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    return;
  }
  if (!calendar) return;
  const cur = calendar.getDate().toDate();
  if (currentView === 'month') el.textContent = fmt(cur, { month: 'long', year: 'numeric' });
  else if (currentView === 'day') el.textContent = fmt(cur, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  else {
    const s = calendar.getDateRangeStart().toDate(), e = calendar.getDateRangeEnd().toDate();
    el.textContent = `${fmt(s, { day: 'numeric', month: 'long' })} – ${fmt(e, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
}

// ============================================================
// مكتبة التقويم
// ============================================================
async function loadCalendarLib() {
  if (window.tui?.Calendar) return;
  if (!document.getElementById('tui-calendar-css')) {
    const link = document.createElement('link');
    link.id = 'tui-calendar-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@toast-ui/calendar@2.1.3/dist/toastui-calendar.min.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('tui-calendar-js')) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'tui-calendar-js';
      script.src = 'https://cdn.jsdelivr.net/npm/@toast-ui/calendar@2.1.3/dist/toastui-calendar.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  await new Promise(r => setTimeout(r, 100));
}

function initCalendar(host, kinds) {
  const Calendar = window.tui?.Calendar;
  const calHost = host.querySelector('#calendar-host');
  if (!Calendar) {
    calHost.innerHTML = '<div class="empty">فشل تحميل التقويم — جرّب عرض «قائمة» أو حدّث الصفحة</div>';
    calendar = null;
    if (currentView === 'list') refresh();
    return;
  }
  calHost.innerHTML = '';

  calendar = new Calendar(calHost, {
    defaultView: currentView === 'list' ? 'month' : currentView,
    usageStatistics: false,
    useFormPopup: false,
    useDetailPopup: false,
    isReadOnly: false,
    calendars: AGENDA_KINDS.map(k => ({
      id: k.cal, name: k.label, backgroundColor: k.bg, borderColor: k.bg, dragBackgroundColor: k.bg, color: k.fg,
      isVisible: !hidden.has(k.cal),
    })),
    month: { startDayOfWeek: 6, dayNames: DAY_NAMES, isAlways6Weeks: false, visibleEventCount: 4 },
    week: { startDayOfWeek: 6, dayNames: DAY_NAMES, hourStart: 7, hourEnd: 23, taskView: false, eventView: ['allday', 'time'] },
    template: {
      time(ev) {
        const t = ev.start?.toDate?.();
        const hm = t ? t.toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' }) : '';
        return `<span class="ag-ev-time">${esc(hm)}</span> <span>${esc(ev.title)}</span>`;
      },
      allday(ev) { return `<span>${esc(ev.title)}</span>`; },
      monthMoreTitleDate(more) { return `<span>${esc(String(more.date))}</span>`; },
      monthMore() { return 'المزيد'; },
      monthGridHeaderExceed(n) { return `<span class="ag-more">+${n} كمان</span>`; },
      weekGridFooterExceed(n) { return `+${n} كمان`; },
      alldayTitle() { return '<span class="ag-allday-title">طول اليوم</span>'; },
      timegridDisplayPrimaryTime({ time }) {
        const d = time.toDate ? time.toDate() : new Date(time);
        return d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric' });
      },
    },
  });

  calendar.on('clickEvent', ({ event }) => showEventDetails(event));

  // الضغط على يوم فاضي (أو سحب على ساعات) → إضافة بنفس التاريخ/الوقت
  calendar.on('selectDateTime', (info) => {
    calendar.clearGridSelections();
    if (!AGENDA_KINDS.some(k => can(k.create))) return;
    const s = info.start?.toDate ? info.start.toDate() : new Date(info.start);
    const e = info.end?.toDate ? info.end.toDate() : new Date(info.end);
    const init = { date: formatDate(s) };
    if (!info.isAllday && currentView !== 'month') { init.start_time = hm(s); init.end_time = hm(e); }
    openEventForm(init);
  });

  calendar.on('beforeUpdateEvent', async ({ event, changes }) => {
    const start = changes.start?.toDate?.() || (changes.start ? new Date(changes.start) : null);
    const end = changes.end?.toDate?.() || (changes.end ? new Date(changes.end) : null);
    if (!start) return;
    const cat = catOf(event);
    const [, id] = String(event.id).split('-');
    if (!/^\d+$/.test(id || '')) return toast('الموعد ده لسه ما اتبعتش للسيرفر', 'bad');
    const body = { date: formatDate(start) };
    if (!event.isAllday && !event.isAllDay) {
      if (cat === 'session') body.time = hm(start);
      if (cat === 'event') { body.start_time = hm(start); if (end) body.end_time = hm(end); }
    }
    try {
      await apiJson(`/api/calendar/events/${cat}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      calendar.updateEvent(event.id, event.calendarId, changes);
      toast('✅ اتغيّر الميعاد', 'ok');
    } catch (e) {
      toast('⚠️ ' + e.message, 'bad');
    }
  });

  if (currentView !== 'list') calendar.changeView(currentView);
  refresh();
}

// ============================================================
// تحميل الأحداث
// ============================================================
function prepare(list) {
  return (Array.isArray(list) ? list : (list?.items || [])).map(e => ({
    ...e,
    // Toast UI بيرسم العنوان حسب category (allday/time) — فبنحفظ نوعنا في raw.cat
    category: e.isAllDay === false ? 'time' : 'allday',
    raw: { ...(e.raw || {}), cat: e.category, pending: !!e._pending },
    isReadOnly: !!e._pending,
  }));
}

async function loadEvents() {
  if (!calendar) return;
  const from = formatDate(calendar.getDateRangeStart().toDate());
  const to = formatDate(calendar.getDateRangeEnd().toDate());
  try {
    const events = await apiJson(`/api/calendar/events?from=${from}&to=${to}`, { skipCache: true });
    const prepared = prepare(events);
    calendar.clear();
    calendar.createEvents(prepared);
    lastPrepared = prepared; fitAlldayPanel(prepared);
  } catch (e) {
    console.error('loadEvents failed:', e);
  }
}

// عرض الأسبوع/اليوم: خانة "طول اليوم" بتكبر على قد أزحم يوم، عشان "+N" ميتطبعش فوق موعد
const ALLDAY_ROW = 24;   // ارتفاع الموعد في المكتبة
const ALLDAY_MAX_ROWS = 8; // بعد كده بيظهر "+N" ولما تدوس عليه يفتح الباقي
let lastPrepared = [];
function fitAlldayPanel(list = lastPrepared) {
  if (!calendar || (currentView !== 'week' && currentView !== 'day')) return;
  try {
    const start = calendar.getDateRangeStart().toDate(); start.setHours(0, 0, 0, 0);
    const end = calendar.getDateRangeEnd().toDate(); end.setHours(23, 59, 59, 999);
    const perDay = new Map();
    for (const e of list) {
      if (e.category !== 'allday' || hidden.has(e.calendarId)) continue;
      const s = new Date(String(e.start).length <= 10 ? e.start + 'T00:00:00' : e.start);
      const f = e.end ? new Date(String(e.end).length <= 10 ? e.end + 'T00:00:00' : e.end) : s;
      for (let d = new Date(Math.max(s, start)); d <= f && d <= end; d.setDate(d.getDate() + 1)) {
        const k = d.toDateString(); perDay.set(k, (perDay.get(k) || 0) + 1);
        d.setHours(0, 0, 0, 0);
      }
    }
    const most = Math.max(0, ...perDay.values());
    const rows = Math.min(Math.max(most, 3), ALLDAY_MAX_ROWS);
    // لو فيه زيادة عن الحد، صف فاضي زيادة عشان "+N" يبقى لوحده
    const height = (most > ALLDAY_MAX_ROWS ? rows + 1 : rows) * ALLDAY_ROW;
    calendar.getStoreDispatchers('weekViewLayout')?.updateDayGridRowHeight({ rowName: 'allday', height });
  } catch (err) { console.warn('fitAlldayPanel', err); }
}

let listOffset = 0;
async function loadList() {
  const el = hostEl?.querySelector('#ag-list');
  if (!el) return;
  el.innerHTML = skeleton(5, 'list');
  const s = new Date(); s.setDate(s.getDate() + listOffset);
  const e = new Date(s); e.setDate(e.getDate() + 30);
  try {
    lastList = prepare(await apiJson(`/api/calendar/events?from=${formatDate(s)}&to=${formatDate(e)}`, { skipCache: true }));
  } catch (err) {
    el.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`;
    return;
  }
  renderList();
}

function renderList() {
  const el = hostEl?.querySelector('#ag-list');
  if (!el) return;
  const items = lastList
    .filter(ev => !hidden.has(ev.calendarId))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  if (!items.length) {
    el.innerHTML = `<div class="ag-empty"><div style="font-size:34px">📭</div><div>مفيش مواعيد في الفترة دي</div>
      ${AGENDA_KINDS.some(k => can(k.create)) ? '<button class="btn btn-primary btn-sm" data-add>➕ إضافة موعد</button>' : ''}</div>`;
    el.querySelector('[data-add]')?.addEventListener('click', () => openEventForm({}));
    return;
  }
  const today = formatDate(new Date());
  const groups = new Map();
  for (const ev of items) {
    const d = String(ev.start).slice(0, 10);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(ev);
  }
  el.innerHTML = [...groups.entries()].map(([d, evs]) => {
    const dt = new Date(d + 'T00:00:00');
    return `
      <section class="ag-day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">
        <div class="ag-day-head">
          <span class="ag-day-num">${dt.getDate()}</span>
          <span class="ag-day-name">${esc(dt.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', month: 'long', year: 'numeric' }))}</span>
          ${d === today ? '<span class="badge active">النهارده</span>' : ''}
        </div>
        ${evs.map(ev => {
          const k = kindOf(ev);
          const t = String(ev.start).length > 10 ? String(ev.start).slice(11, 16) : '';
          return `
            <button class="ag-item ${ev.raw?.done ? 'done' : ''}" data-id="${esc(ev.id)}" style="--c:${k.bg}">
              <span class="ag-item-time">${t ? esc(fmt12(t)) : 'طول اليوم'}</span>
              <span class="ag-item-main">
                <span class="ag-item-kind">${k.icon} ${esc(k.label)}${ev.raw?.pending ? ' · ⏳ مستني النت' : ''}${ev.raw?.done ? ' · تم' : ''}</span>
                <span class="ag-item-title">${esc(ev.title)}</span>
                ${ev.body ? `<span class="ag-item-body">${esc(String(ev.body).split('\n').filter(Boolean).slice(0, 2).join(' · '))}</span>` : ''}
              </span>
            </button>`;
        }).join('')}
      </section>`;
  }).join('');
  el.querySelectorAll('.ag-item').forEach(b => b.addEventListener('click', () => {
    const ev = lastList.find(x => String(x.id) === b.dataset.id);
    if (ev) showEventDetails(ev);
  }));
}

// ============================================================
// تفاصيل الحدث
// ============================================================
function showEventDetails(event) {
  document.getElementById('calendar-event-modal')?.remove();
  const r = event.raw || {};
  const k = kindOf(event);
  const cat = catOf(event);
  const [, idStr] = String(event.id).split('-');
  const realId = /^\d+$/.test(idStr || '') ? idStr : null;
  const startD = event.start?.toDate ? event.start.toDate() : new Date(String(event.start).length <= 10 ? event.start + 'T00:00:00' : event.start);
  const date = formatDate(startD);
  const allDay = event.isAllday ?? event.isAllDay ?? String(event.start).length <= 10;
  const time = allDay ? '' : hm(startD);
  const endD = event.end?.toDate ? event.end.toDate() : (event.end ? new Date(event.end) : null);
  const canEdit = realId && !r.pending && (cat === 'event' || cat === 'session' || cat === 'task' || cat === 'fee') && can(cat === 'fee' ? 'fees.edit' : cat === 'task' ? 'tasks.edit' : 'agenda.edit');
  const canDel = realId && !r.pending && cat !== 'fee' && can(cat === 'task' ? 'tasks.delete' : 'agenda.delete');
  const hasClient = !!(r.client_name || r.client_phone);

  const rows = [
    ['📅 التاريخ', `${formatDateAr(startD)}${time ? ` · ${fmt12(time)}${endD && cat === 'event' && r.end_time ? ' – ' + fmt12(hm(endD)) : ''}` : ' · طول اليوم'}`],
    r.location && ['📍 المكان', r.location],
    r.case_number && ['📁 القضية', `${r.case_number}${r.court ? ' · ' + r.court : ''}`],
    r.client_name && ['👤 الموكل', r.client_name],
    cat === 'fee' && ['💰 المتبقي', `${((r.amount_due || 0) - (r.amount_paid || 0)).toLocaleString('en-US')} ج`],
    r.lawyer_name && ['👤 المسؤول', r.lawyer_name],
  ].filter(Boolean);
  const notes = cat === 'event' ? r.notes : (cat === 'session' ? r.notes : '');

  const modal = document.createElement('div');
  modal.id = 'calendar-event-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card ag-detail" role="dialog" aria-modal="true" aria-labelledby="ag-d-title" style="--c:${k.bg}">
      <div class="ag-detail-head">
        <div>
          <div class="ag-detail-kind"><span class="dot"></span>${k.icon} ${esc(r.kind_label || k.label)}${r.pending ? ' · ⏳ مستني النت عشان يتبعت' : ''}${r.done ? ' · ✔️ تم' : ''}</div>
          <h3 id="ag-d-title">${esc(event.title)}</h3>
        </div>
        <button class="icon-btn" data-action="close" aria-label="إغلاق">✕</button>
      </div>
      <div class="ag-detail-rows">
        ${rows.map(([l, v]) => `<div class="ag-detail-row"><span>${l}</span><strong>${esc(v)}</strong></div>`).join('')}
      </div>
      ${notes ? `<div class="ag-detail-notes">${esc(notes)}</div>` : ''}

      ${canEdit && cat !== 'event' ? `
        <details class="ag-resched">
          <summary>🕑 تغيير الميعاد</summary>
          <div class="ag-resched-row">
            <input type="date" id="ag-rs-date" class="input" value="${esc(date)}">
            ${cat === 'session' ? `<input type="time" id="ag-rs-time" class="input" value="${esc(time)}" aria-label="الساعة">` : ''}
            <button class="btn btn-primary btn-sm" data-action="resched">حفظ</button>
          </div>
        </details>` : ''}

      <div class="ag-detail-actions">
        ${(cat === 'session' || cat === 'fee' || (cat === 'event' && hasClient)) && !r.pending
          ? `<button class="btn wa-send btn-sm" data-action="wa">💬 رسالة للموكل</button>` : ''}
        ${cat === 'event' && canEdit ? `<button class="btn btn-ghost btn-sm" data-action="done">${r.done ? '↩️ لسه ما اتعملش' : '✔️ تم'}</button>` : ''}
        ${cat === 'event' && canEdit ? `<button class="btn btn-ghost btn-sm" data-action="edit">✏️ تعديل</button>` : ''}
        ${canDel ? `<button class="btn btn-ghost btn-sm" data-action="delete" style="color:var(--danger)">🗑 حذف</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  modal.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (e.target === modal || a === 'close') return close();
    if (!a) return;
    try {
      if (a === 'wa') {
        close();
        if (cat === 'session') {
          return openWhatsAppComposer({ kind: 'session', kinds: ['session', 'update', 'general'],
            phone: r.client_phone, client_name: r.client_name, case_number: r.case_number, court: r.court, session_date: date });
        }
        if (cat === 'fee') {
          return openWhatsAppComposer({ kind: 'fee', kinds: ['fee', 'general'], phone: r.client_phone, client_name: r.client_name,
            case_number: r.case_number, remaining: (r.amount_due || 0) - (r.amount_paid || 0), due_date: date });
        }
        return openWhatsAppComposer({ kind: 'general', kinds: ['general', 'update'], phone: r.client_phone, client_name: r.client_name,
          case_number: r.case_number, court: r.court });
      }
      if (a === 'resched') {
        const d = modal.querySelector('#ag-rs-date').value;
        if (!d) return toast('اختار التاريخ', 'bad');
        const body = { date: d };
        if (cat === 'session') body.time = modal.querySelector('#ag-rs-time').value || null;
        await apiJson(`/api/calendar/events/${cat}/${realId}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast('✅ اتغيّر الميعاد', 'ok'); close(); refresh();
      }
      if (a === 'done') {
        await apiJson(`/api/calendar/events/event/${realId}`, { method: 'PATCH', body: JSON.stringify({ done: !r.done }) });
        toast(r.done ? 'اترجّع' : '✔️ تمام', 'ok'); close(); refresh();
      }
      if (a === 'edit') {
        close();
        openEventForm({
          id: realId, kind: r.kind, title: r.title, date, start_time: r.time || '', end_time: r.end_time || '',
          location: r.location || '', notes: r.notes || '', case_id: r.case_id || '', client_id: r.client_id || '',
        });
      }
      if (a === 'delete') {
        if (!confirm(`متأكد من حذف «${event.title}»؟`)) return;
        const res = await api(`/api/calendar/events/${cat}/${realId}`, { method: 'DELETE' });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'فشل الحذف'); }
        toast('✅ اتحذف', 'ok'); close(); refresh();
      }
    } catch (err) {
      toast('⚠️ ' + err.message, 'bad');
    }
  });
}

// ============================================================
// نافذة الإضافة / التعديل
// ============================================================
let _casesCache = null, _clientsCache = null, _lawyersCache = null;
async function loadRefs() {
  const [cases, clients, lawyers] = await Promise.all([
    _casesCache || apiJson('/api/cases').catch(() => []),
    _clientsCache || apiJson('/api/clients').catch(() => []),
    _lawyersCache || (can('tasks.create') ? apiJson('/api/lawyers').catch(() => []) : []),
  ]);
  const arr = x => (Array.isArray(x) ? x : (x?.items || x?.data || []));
  _casesCache = arr(cases); _clientsCache = arr(clients); _lawyersCache = arr(lawyers);
  setTimeout(() => { _casesCache = _clientsCache = _lawyersCache = null; }, 60000);
  return { cases: _casesCache, clients: _clientsCache, lawyers: _lawyersCache };
}

async function openEventForm(init = {}) {
  document.getElementById('calendar-add-modal')?.remove();
  const editing = !!init.id;
  const finance = hasFeature('finance');
  const allowed = AGENDA_KINDS.filter(k => (editing ? k.ev : true) && can(k.create) && (k.key !== 'fee' || finance));
  if (!allowed.length) return toast('مش عندك صلاحية تضيف مواعيد', 'bad');
  let kind = init.kind && allowed.some(k => k.key === init.kind) ? init.kind : (allowed.find(k => k.key === 'meeting') || allowed[0]).key;

  const modal = document.createElement('div');
  modal.id = 'calendar-add-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card ag-form" role="dialog" aria-modal="true" aria-labelledby="ag-f-title">
      <div class="ag-detail-head">
        <h3 id="ag-f-title" style="margin:0">${editing ? '✏️ تعديل الموعد' : '➕ إضافة للأجندة'}</h3>
        <button class="icon-btn" data-action="cancel" aria-label="إغلاق">✕</button>
      </div>
      <div class="ag-kinds" role="radiogroup" aria-label="النوع">
        ${allowed.map(k => `
          <button type="button" class="ag-kind ${k.key === kind ? 'active' : ''}" data-kind="${k.key}" role="radio" aria-checked="${k.key === kind}" style="--c:${k.bg}">
            <span class="ag-kind-ic">${k.icon}</span><span>${esc(k.label)}</span>
          </button>`).join('')}
      </div>
      <form id="ag-form" class="ag-fields" novalidate>
        <div class="loading-refs meta">جاري التحميل…</div>
      </form>
      <div id="cal-add-status" class="status" role="alert"></div>
      <div class="ag-form-actions">
        <button class="btn btn-ghost" data-action="cancel">إلغاء</button>
        <button class="btn btn-primary" data-action="save">${editing ? 'حفظ التعديل' : 'حفظ'}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const refs = await loadRefs();
  const form = modal.querySelector('#ag-form');
  const values = { date: formatDate(new Date()), ...init };

  const caseOpts = (sel, required) => `
    <option value="">${required ? '— اختار القضية —' : '— من غير قضية —'}</option>
    ${refs.cases.map(c => `<option value="${c.id}" ${String(c.id) === String(sel) ? 'selected' : ''}>${esc(c.case_number || 'قضية #' + c.id)}${c.client_name ? ' — ' + esc(c.client_name) : ''}${c.court ? ' · ' + esc(c.court) : ''}</option>`).join('')}`;
  const clientOpts = (sel) => `
    <option value="">— من غير موكل —</option>
    ${refs.clients.map(c => `<option value="${c.id}" ${String(c.id) === String(sel) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;

  const collect = () => {
    const fd = {};
    form.querySelectorAll('[name]').forEach(el => { fd[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return fd;
  };

  // الساعة: لو المستخدم ما لمسهاش، كل نوع ياخد الافتراضي بتاعه (اجتماع بساعة، موعد نهائي طول اليوم)
  let timeTouched = !!(init.start_time || init.end_time);
  const touch = e => { if (e.isTrusted && /^(start_time|end_time|all_day)$/.test(e.target.name || '')) timeTouched = true; };
  form.addEventListener('input', touch);
  form.addEventListener('change', touch);
  const resetTimeIfUntouched = () => {
    if (timeTouched) return;
    delete values.all_day;
    values.start_time = '';
    values.end_time = '';
  };

  const draw = (skipCollect = false) => {
    if (!skipCollect) Object.assign(values, collect());
    const k = KIND_BY_KEY[kind];
    const isEv = !!k.ev;
    // الاجتماعات والاستشارات غالباً بساعة، الباقي طول اليوم — إلا لو المستخدم اختار
    const defTimed = kind === 'meeting' || kind === 'consultation';
    const timed = isEv && (values.all_day === undefined ? (!!values.start_time || defTimed) : !values.all_day);
    form.innerHTML = `
      ${kind === 'session' ? `
        <label class="ag-field"><span>القضية *</span><select name="case_id" class="input" required>${caseOpts(values.case_id, true)}</select></label>
      ` : kind === 'fee' ? `
        <label class="ag-field"><span>القضية</span><select name="case_id" class="input">${caseOpts(values.case_id)}</select></label>
        <label class="ag-field"><span>أو الموكل</span><select name="client_id" class="input">${clientOpts(values.client_id)}</select></label>
        <label class="ag-field"><span>المبلغ (ج) *</span><input name="amount_due" type="number" min="1" step="any" class="input" value="${esc(values.amount_due || '')}" required></label>
      ` : `
        <label class="ag-field ag-wide"><span>العنوان *</span><input name="title" class="input" value="${esc(values.title || '')}" placeholder="${esc(placeholderFor(kind))}" required maxlength="300"></label>
      `}

      <label class="ag-field"><span>${kind === 'fee' ? 'ميعاد الاستحقاق *' : 'التاريخ *'}</span><input name="date" type="date" class="input" value="${esc(values.date || '')}" required></label>

      ${kind === 'session' ? `<label class="ag-field"><span>الساعة (الرول)</span><input name="start_time" type="time" class="input" value="${esc(values.start_time || '')}"></label>` : ''}

      ${isEv ? `
        <label class="ag-check ag-wide"><input type="checkbox" name="all_day" ${timed ? '' : 'checked'}> طول اليوم (من غير ساعة)</label>
        ${timed ? `
          <label class="ag-field"><span>من</span><input name="start_time" type="time" class="input" value="${esc(values.start_time || '10:00')}"></label>
          <label class="ag-field"><span>لحد</span><input name="end_time" type="time" class="input" value="${esc(values.end_time || '')}"></label>` : ''}
        <label class="ag-field ag-wide"><span>المكان</span><input name="location" class="input" value="${esc(values.location || '')}" placeholder="المكتب، المحكمة، أونلاين…" maxlength="300"></label>
        <label class="ag-field"><span>القضية</span><select name="case_id" class="input">${caseOpts(values.case_id)}</select></label>
        <label class="ag-field"><span>الموكل</span><select name="client_id" class="input">${clientOpts(values.client_id)}</select></label>
      ` : ''}

      ${kind === 'task' ? `
        <label class="ag-field"><span>القضية</span><select name="case_id" class="input">${caseOpts(values.case_id)}</select></label>
        ${refs.lawyers.length ? `<label class="ag-field"><span>المسؤول</span><select name="lawyer_id" class="input"><option value="">— —</option>${refs.lawyers.map(l => `<option value="${l.id}" ${String(l.id) === String(values.lawyer_id) ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>` : ''}
      ` : ''}

      ${kind !== 'task' ? `<label class="ag-field ag-wide"><span>ملاحظات</span><textarea name="notes" class="input" rows="2" maxlength="3000">${esc(values.notes || '')}</textarea></label>` : ''}
    `;
    form.querySelector('[name="all_day"]')?.addEventListener('change', () => {
      Object.assign(values, collect());
      timeTouched = true;
      if (values.all_day) { values.start_time = ''; values.end_time = ''; }
      else if (!values.start_time) values.start_time = '10:00';
      draw(true);
    });
    form.querySelector('input[name="title"], select[name="case_id"]')?.focus();
  };
  draw();

  modal.querySelectorAll('.ag-kind').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.kind === kind) return;
    Object.assign(values, collect());
    kind = b.dataset.kind;
    resetTimeIfUntouched();
    modal.querySelectorAll('.ag-kind').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-checked', String(x === b)); });
    draw(true);
  }));
  form.addEventListener('submit', e => { e.preventDefault(); modal.querySelector('[data-action="save"]').click(); });

  modal.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (e.target === modal || a === 'cancel') return close();
    if (a !== 'save') return;
    const st = modal.querySelector('#cal-add-status');
    const v = { ...values, ...collect() };
    const bad = (m) => { st.textContent = '⚠️ ' + m; st.className = 'status bad'; };
    if (!v.date) return bad('اختار التاريخ');
    const k = KIND_BY_KEY[kind];
    let path, body, method = 'POST';
    if (kind === 'session') {
      if (!v.case_id) return bad('اختار القضية');
      path = '/api/sessions';
      body = { case_id: Number(v.case_id), session_date: v.date, session_time: v.start_time || null, notes: v.notes || null };
    } else if (kind === 'task') {
      if (!String(v.title || '').trim()) return bad('اكتب العنوان');
      path = '/api/tasks';
      body = { title: v.title.trim(), due_date: v.date, case_id: v.case_id ? Number(v.case_id) : null, lawyer_id: v.lawyer_id ? Number(v.lawyer_id) : null };
    } else if (kind === 'fee') {
      if (!(Number(v.amount_due) > 0)) return bad('اكتب المبلغ');
      let clientId = v.client_id ? Number(v.client_id) : null;
      if (!clientId && v.case_id) clientId = refs.cases.find(c => String(c.id) === String(v.case_id))?.client_id || null;
      if (!clientId && !v.case_id) return bad('اختار القضية أو الموكل');
      path = '/api/fees';
      body = { case_id: v.case_id ? Number(v.case_id) : null, client_id: clientId, amount_due: Number(v.amount_due), amount_paid: 0, due_date: v.date, notes: v.notes || null };
    } else {
      if (!String(v.title || '').trim()) return bad('اكتب العنوان');
      const timed = !v.all_day && v.start_time;
      if (timed && v.end_time && v.end_time <= v.start_time) return bad('ساعة النهاية لازم تبقى بعد البداية');
      body = {
        type: 'event', kind: k.key, title: v.title.trim(), date: v.date,
        start_time: timed ? v.start_time : null, end_time: timed && v.end_time ? v.end_time : null,
        location: v.location || null, notes: v.notes || null,
        case_id: v.case_id ? Number(v.case_id) : null, client_id: v.client_id ? Number(v.client_id) : null,
      };
      if (editing) { path = `/api/calendar/events/event/${init.id}`; method = 'PATCH'; }
      else path = '/api/calendar/events';
    }
    st.textContent = '⏳ جاري الحفظ...'; st.className = 'status';
    try {
      const r = await apiJson(path, { method, body: JSON.stringify(body) });
      toast(r?.queued ? '⏳ اتحفظ على الجهاز وهيتبعت أول ما النت يرجع' : '✅ اتحفظ', 'ok');
      close();
      // لو النوع ده مخفي في الفلتر نظهره عشان المستخدم يشوف اللي ضافه
      if (hidden.has(k.cal)) hostEl?.querySelector(`.ag-chip[data-cal="${k.cal}"]`)?.click();
      if (calendar && currentView !== 'list') calendar.setDate(new Date(v.date + 'T00:00:00'));
      refresh();
    } catch (err) {
      bad(err.message);
    }
  });
}

function placeholderFor(kind) {
  return ({
    task: 'مثال: تجهيز مذكرة دفاع',
    meeting: 'مثال: مقابلة الموكل لمراجعة المستندات',
    consultation: 'مثال: استشارة بخصوص عقد إيجار',
    deadline: 'مثال: آخر ميعاد للاستئناف',
    procedure: 'مثال: إعلان صحيفة الدعوى',
    reminder: 'مثال: تجديد التوكيل',
    personal: 'مثال: إجازة',
    other: 'اكتب العنوان',
  })[kind] || '';
}

// ============================================================
// Helpers
// ============================================================
function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hm(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmt12(t) {
  const [h, m] = String(t).split(':').map(Number);
  const suffix = h < 12 ? 'ص' : 'م';
  const hh = h % 12 || 12;
  return `${hh}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}
function formatDateAr(date) {
  try {
    return date.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
}
