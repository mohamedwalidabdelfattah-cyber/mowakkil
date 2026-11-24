// web/js/views/agenda.js
// التقويم الفعلي — Toast UI Calendar

import { apiJson, api } from '../api.js';
import { openWhatsAppComposer } from '../whatsapp.js';
import { esc, toast, empty, fmtMoney, skeleton } from '../ui.js';

let calendar = null;
let currentTypeFilter = ''; // '' | 'session' | 'task' | 'fee'

export async function render(host) {
  host.innerHTML = `
    <div class="app-top">
      <h2>📅 التقويم</h2>
      <div class="calendar-actions">
        <button class="btn btn-ghost btn-sm" id="cal-today">اليوم</button>
        <button class="btn btn-ghost btn-sm" data-cal-view="month">شهري</button>
        <button class="btn btn-ghost btn-sm" data-cal-view="week">أسبوعي</button>
        <button class="btn btn-ghost btn-sm" data-cal-view="day">يومي</button>
        <button class="btn btn-primary btn-sm" id="cal-add">➕ إضافة</button>
      </div>
    </div>

    <!-- شريط الفلاتر -->
    <div class="filter-bar" style="margin-bottom:12px">
      <div class="filter-bar-inner">
        <div class="filter-item">
          <select class="filter-input" id="filter-type">
            <option value="">كل الأنواع</option>
            <option value="session" ${currentTypeFilter === 'session' ? 'selected' : ''}>⚖️ جلسات</option>
            <option value="task"    ${currentTypeFilter === 'task' ? 'selected' : ''}>✅ مهام</option>
            <option value="fee"     ${currentTypeFilter === 'fee' ? 'selected' : ''}>💰 أتعاب</option>
          </select>
        </div>
        <button class="btn btn-ghost filter-reset" id="filter-reset">🔄 مسح</button>
      </div>
    </div>

    <div class="calendar-legends">
      <div class="cal-legend"><span class="dot" style="background:#0F172A"></span> جلسات</div>
      <div class="cal-legend"><span class="dot" style="background:#12B76A"></span> مهام</div>
      <div class="cal-legend"><span class="dot" style="background:#D4AF37"></span> أتعاب</div>
    </div>

    <div id="calendar-host" class="calendar-host">
      ${skeleton(6, 'list')}
    </div>
  `;

  // تحميل Toast UI Calendar من CDN
  await loadCalendarLib();

  // نجهّز التقويم
  initCalendar(host);

  // أزرار التحكم
  host.querySelector('#cal-today')?.addEventListener('click', () => {
    calendar?.today();
  });

  host.querySelectorAll('[data-cal-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      calendar?.changeView(btn.dataset.calView, true);
    });
  });

  host.querySelector('#cal-add')?.addEventListener('click', () => {
    showAddModal(host);
  });

  // فلتر النوع
  host.querySelector('#filter-type')?.addEventListener('change', (e) => {
    currentTypeFilter = e.target.value;
    loadEvents();
  });

  host.querySelector('#filter-reset')?.addEventListener('click', () => {
    currentTypeFilter = '';
    host.querySelector('#filter-type').value = '';
    loadEvents();
  });
}

// ============================================================
// تحميل Toast UI Calendar (CSS + JS من CDN)
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

// ============================================================
// تهيئة التقويم
// ============================================================
function initCalendar(host) {
  const Calendar = window.tui?.Calendar;
  if (!Calendar) {
    host.querySelector('#calendar-host').innerHTML = '<div class="empty">فشل تحميل التقويم — حاول تاني</div>';
    return;
  }

  const calHost = host.querySelector('#calendar-host');
  calHost.innerHTML = '';

  calendar = new Calendar(calHost, {
    defaultView: 'month',
    usageStatistics: false,
    useFormPopup: false,
    useDetailPopup: false,
    isReadOnly: false,
    calendars: [
      {
        id: 'sessions',
        name: 'جلسات',
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
        color: '#ffffff',
      },
      {
        id: 'tasks',
        name: 'مهام',
        backgroundColor: '#12B76A',
        borderColor: '#12B76A',
        color: '#ffffff',
      },
      {
        id: 'fees',
        name: 'أتعاب',
        backgroundColor: '#D4AF37',
        borderColor: '#D4AF37',
        color: '#0B1222',
      },
    ],
    month: {
      startDayOfWeek: 6,
      dayNames: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      visibleWeeksCount: 6,
      isAlways6Weeks: false,
    },
    week: {
      startDayOfWeek: 6,
      dayNames: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      hourStart: 8,
      hourEnd: 20,
    },
    timezone: {
      zones: [{
        timezoneName: 'Africa/Cairo',
        displayLabel: 'القاهرة',
      }],
    },
    template: {
      time(event) {
        return `<span>${esc(event.start?.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }))}</span>`;
      },
      allday(event) {
        return `<span>${esc(event.title)}</span>`;
      },
    },
  });

  loadEvents();

  calendar.on('clickDayName', () => {
    setTimeout(loadEvents, 100);
  });

  calendar.on('clickEvent', ({ event }) => {
    showEventDetails(event);
  });

  calendar.on('beforeUpdateEvent', async ({ event, changes }) => {
    const newDate = changes.start?.toDate?.() || changes.start;
    if (!newDate) return;

    const [type, id] = event.id.split('-');
    const dateStr = formatDate(newDate);

    try {
      const res = await api(`/api/calendar/events/${type}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ date: dateStr }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل التعديل');
      }

      calendar.updateEvent(event.id, event.calendarId, {
        start: dateStr,
        end: dateStr,
      });

      toast('✅ تم تعديل الموعد', 'ok');
    } catch (e) {
      toast('⚠️ ' + e.message, 'bad');
      calendar.updateEvent(event.id, event.calendarId, {
        start: event.start,
        end: event.end,
      });
    }
  });

  setTimeout(loadEvents, 100);
}

// ============================================================
// تحميل الأحداث من الـ API
// ============================================================
async function loadEvents() {
  if (!calendar) return;

  const start = calendar.getDateRangeStart().toDate();
  const end = calendar.getDateRangeEnd().toDate();

  const from = formatDate(start);
  const to = formatDate(end);

  const params = new URLSearchParams({ from, to });
  if (currentTypeFilter) params.append('type', currentTypeFilter);

  try {
    const events = await apiJson(`/api/calendar/events?${params.toString()}`);

    calendar.clear();
    // Toast UI بيختار قالب رسم العنوان حسب category، ولازم تكون allday/time/task/milestone.
    // قيمنا (session/task/fee) كانت بتخلي العنوان يترسم فاضي — فبنحفظ النوع في raw.kind.
    const list = Array.isArray(events) ? events : (events?.items || []);
    calendar.createEvents(list.map(e => ({
      ...e,
      category: e.isAllDay === false ? 'time' : 'allday',
      raw: { ...(e.raw || {}), kind: e.category, pending: !!e._pending },
    })));

    if (events.length === 0) {
      const calHost = document.getElementById('calendar-host');
      if (calHost && calHost.querySelector('.tui-calendar-container')) {
        // التقويم شغال بس مفيش أحداث
      }
    }
  } catch (e) {
    console.error('loadEvents failed:', e);
  }
}

// ============================================================
// عرض تفاصيل الحدث
// ============================================================
function showEventDetails(event) {
  document.getElementById('calendar-event-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'calendar-event-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:480px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
        <div>
          <div style="font-size:12px;color:var(--text-soft);margin-bottom:4px">
            ${(() => { const k = event.raw?.kind || event.category; return k === 'session' ? '⚖️ جلسة' : k === 'task' ? '✅ مهمة' : '💰 أتعاب'; })()}
            ${event.raw?.pending ? ' · ⏳ مستني النت عشان يتبعت' : ''}
          </div>
          <h3 style="margin:0;font-size:18px">${esc(event.title)}</h3>
        </div>
        <button class="icon-btn" data-action="close">✕</button>
      </div>

      ${event.body ? `
        <div style="background:var(--gray-50);padding:14px;border-radius:10px;margin-bottom:16px;font-size:13.5px;line-height:1.7;white-space:pre-line">
          ${esc(event.body)}
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:13.5px">
        <span style="color:var(--text-soft)">📅 التاريخ:</span>
        <strong>${esc(formatDateAr(event.start?.toDate?.() || new Date()))}</strong>
      </div>

      ${(() => {
        const k = event.raw?.kind || event.category;
        if ((k !== 'session' && k !== 'fee') || event.raw?.pending) return '';
        return `<button class="btn wa-send" data-action="wa" style="width:100%;margin-bottom:8px">💬 ${k === 'session' ? 'تذكير الموكل بالجلسة' : 'تذكير الموكل بالأتعاب'} على واتساب</button>`;
      })()}
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" data-action="close" style="flex:1">إغلاق</button>
        <button class="btn btn-danger" data-action="delete" style="flex:1">🗑 حذف</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', async (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]')) {
      modal.remove();
      return;
    }

    if (e.target.closest('[data-action="wa"]')) {
      const r = event.raw || {};
      const isSession = (r.kind || event.category) === 'session';
      modal.remove();
      openWhatsAppComposer({
        kind: isSession ? 'session' : 'fee',
        kinds: isSession ? ['session', 'update', 'general'] : ['fee', 'general'],
        phone: r.client_phone, client_name: r.client_name, case_number: r.case_number, court: r.court,
        session_date: isSession ? r.date : null,
        remaining: isSession ? null : (r.amount_due || 0) - (r.amount_paid || 0),
        due_date: isSession ? null : r.date,
      });
      return;
    }

    if (e.target.closest('[data-action="delete"]')) {
      if (!confirm('متأكد من حذف الحدث؟')) return;

      const [type, id] = event.id.split('-');

      try {
        const res = await api(`/api/calendar/events/${type}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('فشل الحذف');

        calendar?.deleteEvent(event.id, event.calendarId);
        toast('✅ اتحذف', 'ok');
        modal.remove();
      } catch (e) {
        toast('⚠️ ' + e.message, 'bad');
      }
    }
  });
}

// ============================================================
// Modal إضافة حدث
// ============================================================
function showAddModal(host) {
  document.getElementById('calendar-add-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'calendar-add-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <h3 style="margin:0 0 16px;font-size:18px">➕ إضافة حدث</h3>

      <label class="label">النوع</label>
      <select id="cal-add-type" class="select">
        <option value="task">✅ مهمة</option>
        <option value="session" disabled>⚖️ جلسة (من صفحة القضية)</option>
        <option value="fee" disabled>💰 أتعاب (من صفحة الأتعاب)</option>
      </select>

      <label class="label" style="margin-top:10px">العنوان</label>
      <input id="cal-add-title" class="input" placeholder="مثال: مراجعة عقد">

      <label class="label" style="margin-top:10px">التاريخ</label>
      <input id="cal-add-date" class="input" type="date" value="${new Date().toISOString().slice(0, 10)}">

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-ghost" data-action="cancel" style="flex:1">إلغاء</button>
        <button class="btn btn-primary" data-action="save" style="flex:1">حفظ</button>
      </div>

      <div id="cal-add-status" class="status" style="margin-top:8px"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', async (e) => {
    if (e.target === modal || e.target.closest('[data-action="cancel"]')) {
      modal.remove();
      return;
    }

    if (e.target.closest('[data-action="save"]')) {
      const type = modal.querySelector('#cal-add-type').value;
      const title = modal.querySelector('#cal-add-title').value.trim();
      const date = modal.querySelector('#cal-add-date').value;
      const st = modal.querySelector('#cal-add-status');

      if (!title) {
        st.textContent = '⚠️ اكتب العنوان';
        st.className = 'status bad';
        return;
      }
      if (!date) {
        st.textContent = '⚠️ اختار التاريخ';
        st.className = 'status bad';
        return;
      }

      st.textContent = '⏳ جاري الحفظ...';
      st.className = 'status';

      try {
        const res = await api('/api/calendar/events', {
          method: 'POST',
          body: JSON.stringify({ type, title, date }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'فشل الحفظ');
        }

        toast('✅ اتحفظ', 'ok');
        modal.remove();
        loadEvents();
      } catch (e) {
        st.textContent = '⚠️ ' + e.message;
        st.className = 'status bad';
      }
    }
  });
}

// ============================================================
// Helpers
// ============================================================
function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateAr(date) {
  try {
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return '';
  }
} 
