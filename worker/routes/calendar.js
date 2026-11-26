// worker/routes/calendar.js
// التقويم — كل الأحداث في مكان واحد

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { caseScope, can, canAccessCase } from '../lib/permissions.js';

// أنواع المواعيد الحرة في الأجندة (غير الجلسات والمهام والأتعاب)
export const EVENT_KINDS = {
  meeting:      'اجتماع / مقابلة موكل',
  consultation: 'استشارة',
  deadline:     'موعد نهائي / ميعاد طعن',
  procedure:    'إجراء (إعلان، شهر عقاري، تنفيذ…)',
  reminder:     'تذكير',
  personal:     'شخصي',
  other:        'أخرى',
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cleanTime = v => (TIME_RE.test(String(v || '')) ? String(v) : null);

export const routes = [
  { method: 'GET',   path: '/api/calendar/events',                        handler: listEvents },
  { method: 'POST',  path: '/api/calendar/events',                        handler: createEvent },
  { method: 'PATCH', path: /^\/api\/calendar\/events\/(\w+)\/(\d+)$/,     handler: updateEvent },
  { method: 'DELETE',path: /^\/api\/calendar\/events\/(\w+)\/(\d+)$/,     handler: deleteEvent },
];

// ============================================================
// 1) قائمة الأحداث (من from → to)
// ============================================================
async function listEvents({ env, officeId, url, access, authUser }) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  let type = url.searchParams.get('type'); // 'session' | 'task' | 'fee' | '' (الكل)

  if (!from || !to) return fail(env, 'from و to مطلوبين', 400);

  // الصلاحيات: "المكلّف بيها بس" بتفلتر الجلسات والمهام والأتعاب، واللي مش شايف الأتعاب ميشوفهاش في الأجندة
  const sc = caseScope(access, authUser, 'c.id');
  const taskSc = access?.scope === 'assigned'
    ? { sql: ' AND (t.case_id IS NULL OR t.case_id IN (SELECT case_id FROM case_members WHERE user_id = ? AND office_id = ?))', binds: sc.binds }
    : { sql: '', binds: [] };
  const showFees = can(access, 'fees.view');
  if (type === 'fee' && !showFees) type = 'none';
  const canTasks = can(access, 'tasks.view');
  if (type === 'task' && !canTasks) type = 'none';

  const promises = [];

  // جلسات (لو مفيش فلتر أو الفلتر = session)
  if (!type || type === 'session') {
    promises.push(
      env.DB.prepare(
        `SELECT s.id, s.session_date as date, s.session_time as time, s.notes,
                c.id as case_id, c.case_number, c.court, c.degree,
                cl.name as client_name, cl.phone as client_phone
         FROM sessions s
         JOIN cases c ON c.id = s.case_id
         LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.office_id = ? AND c.deleted_at IS NULL
           AND s.session_date BETWEEN ? AND ?${sc.sql}
         ORDER BY s.session_date`
      ).bind(officeId, from, to, ...sc.binds).all().then(r => ({ type: 'session', rows: r.results || [] }))
    );
  }

  // مهام
  if ((!type && canTasks) || type === 'task') {
    promises.push(
      env.DB.prepare(
        `SELECT t.id, t.title, t.due_date as date, t.status,
                c.case_number,
                l.name as lawyer_name
         FROM tasks t
         LEFT JOIN cases c ON c.id = t.case_id
         LEFT JOIN lawyers l ON l.id = t.lawyer_id
         WHERE t.office_id = ?
           AND t.due_date BETWEEN ? AND ?
           AND t.status != 'منجزة'${taskSc.sql}
         ORDER BY t.due_date`
      ).bind(officeId, from, to, ...taskSc.binds).all().then(r => ({ type: 'task', rows: r.results || [] }))
    );
  }

  // أتعاب
  if ((!type && showFees) || type === 'fee') {
    const feeSc = access?.scope === 'assigned'
      ? { sql: ' AND f.case_id IN (SELECT case_id FROM case_members WHERE user_id = ? AND office_id = ?)', binds: sc.binds }
      : { sql: '', binds: [] };
    promises.push(
      env.DB.prepare(
        `SELECT f.id, f.amount_due, f.amount_paid, f.due_date as date, f.status,
                cl.name as client_name, cl.phone as client_phone, c.case_number
         FROM fees f
         LEFT JOIN clients cl ON cl.id = f.client_id
         LEFT JOIN cases c ON c.id = f.case_id
         WHERE f.office_id = ?
           AND f.due_date BETWEEN ? AND ?
           AND f.status != 'مدفوع بالكامل'${feeSc.sql}
         ORDER BY f.due_date`
      ).bind(officeId, from, to, ...feeSc.binds).all().then(r => ({ type: 'fee', rows: r.results || [] }))
    );
  }

  // مواعيد حرة (اجتماعات، استشارات، مواعيد نهائية…)
  const evKind = type && type.startsWith('ev:') ? type.slice(3) : '';
  if (!type || type === 'event' || evKind) {
    const evSc = access?.scope === 'assigned'
      ? { sql: ' AND (e.user_id = ? OR (e.case_id IS NOT NULL AND e.case_id IN (SELECT case_id FROM case_members WHERE user_id = ? AND office_id = ?)))', binds: [authUser.user_id, ...sc.binds] }
      : { sql: '', binds: [] };
    promises.push(
      env.DB.prepare(
        `SELECT e.id, e.kind, e.title, e.start_date as date, e.start_time as time, e.end_time,
                e.location, e.notes, e.done, e.case_id, e.client_id,
                c.case_number, c.court, COALESCE(cl.name, ccl.name) as client_name, COALESCE(cl.phone, ccl.phone) as client_phone
         FROM agenda_events e
         LEFT JOIN cases c ON c.id = e.case_id
         LEFT JOIN clients cl ON cl.id = e.client_id
         LEFT JOIN clients ccl ON ccl.id = c.client_id
         WHERE e.office_id = ? AND e.start_date BETWEEN ? AND ?${evKind ? ' AND e.kind = ?' : ''}${evSc.sql}
         ORDER BY e.start_date, e.start_time`
      ).bind(officeId, from, to, ...(evKind ? [evKind] : []), ...evSc.binds).all()
        .then(r => ({ type: 'event', rows: r.results || [] }))
        .catch(() => ({ type: 'event', rows: [] })) // قبل تطبيق migration 032
    );
  }

  const results = await Promise.all(promises);
  const events = [];

  for (const { type: t, rows } of results) {
    if (t === 'session') {
      for (const s of rows) {
        events.push({
          id: `session-${s.id}`,
          calendarId: 'sessions',
          title: `⚖️ ${s.client_name || 'موكل'} — ${s.case_number || ''}`,
          body: `${s.court || ''}${s.degree ? ' · ' + s.degree : ''}${s.notes ? '\n' + s.notes : ''}`,
          start: s.time ? `${s.date}T${s.time}:00` : s.date,
          end: s.time ? `${s.date}T${addHour(s.time)}:00` : s.date,
          isAllDay: !s.time,
          category: 'session',
          raw: s,
        });
      }
    } else if (t === 'task') {
      for (const x of rows) {
        events.push({
          id: `task-${x.id}`,
          calendarId: 'tasks',
          title: `✅ ${x.title}`,
          body: `${x.lawyer_name ? '👤 ' + x.lawyer_name : ''}${x.case_number ? '\n📁 ' + x.case_number : ''}`,
          start: x.date,
          end: x.date,
          isAllDay: true,
          category: 'task',
          raw: x,
        });
      }
    } else if (t === 'fee') {
      for (const f of rows) {
        const remaining = (f.amount_due || 0) - (f.amount_paid || 0);
        events.push({
          id: `fee-${f.id}`,
          calendarId: 'fees',
          title: `💰 ${f.client_name || 'موكل'} — ${remaining.toLocaleString('ar-EG')} ج`,
          body: `متبقي: ${remaining.toLocaleString('ar-EG')} ج${f.case_number ? '\n📁 ' + f.case_number : ''}`,
          start: f.date,
          end: f.date,
          isAllDay: true,
          category: 'fee',
          raw: f,
        });
      }
    }
  }

  for (const { type: t, rows } of results) {
    if (t !== 'event') continue;
    for (const e of rows) {
      events.push({
        id: `event-${e.id}`,
        calendarId: `ev-${EVENT_KINDS[e.kind] ? e.kind : 'other'}`,
        title: `${e.done ? '✔️ ' : ''}${e.title}`,
        body: [e.location ? '📍 ' + e.location : '', e.case_number ? '📁 ' + e.case_number : '', e.client_name ? '👤 ' + e.client_name : '', e.notes || ''].filter(Boolean).join('\n'),
        location: e.location || '',
        start: e.time ? `${e.date}T${e.time}:00` : e.date,
        end: e.time ? `${e.date}T${e.end_time && e.end_time > e.time ? e.end_time : addHour(e.time)}:00` : e.date,
        isAllDay: !e.time,
        category: 'event',
        raw: { ...e, kind_label: EVENT_KINDS[e.kind] || EVENT_KINDS.other },
      });
    }
  }

  return ok(env, events);
}

function addHour(t) {
  const [h, m] = String(t).split(':').map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

// قراءة وتنضيف بيانات موعد حر
async function readEventBody(env, officeId, access, authUser, b, partial = false) {
  const out = {};
  if (!partial || b.kind !== undefined) {
    if (!EVENT_KINDS[b.kind]) return { error: 'نوع الموعد مش معروف' };
    out.kind = b.kind;
  }
  if (!partial || b.title !== undefined) {
    if (!isStr(b.title, 300) || !String(b.title).trim()) return { error: 'اكتب عنوان الموعد' };
    out.title = String(b.title).trim();
  }
  const date = b.start_date ?? b.date;
  if (!partial || date !== undefined) {
    if (!DATE_RE.test(String(date || ''))) return { error: 'اختار التاريخ' };
    out.start_date = date;
  }
  if (b.start_time !== undefined || !partial) out.start_time = cleanTime(b.start_time);
  if (b.end_time !== undefined || !partial) out.end_time = cleanTime(b.end_time);
  if (b.location !== undefined || !partial) out.location = b.location ? String(b.location).slice(0, 300) : null;
  if (b.notes !== undefined || !partial) out.notes = b.notes ? String(b.notes).slice(0, 3000) : null;
  if (b.done !== undefined) out.done = b.done ? 1 : 0;
  if (b.case_id !== undefined || !partial) {
    const cid = toInt(b.case_id) || null;
    if (cid) {
      const c = await env.DB.prepare('SELECT id FROM cases WHERE id = ? AND office_id = ? AND deleted_at IS NULL').bind(cid, officeId).first();
      if (!c || !(await canAccessCase(env, access, authUser, cid))) return { error: 'القضية مش موجودة' };
    }
    out.case_id = cid;
  }
  if (b.client_id !== undefined || !partial) {
    const clid = toInt(b.client_id) || null;
    if (clid) {
      const c = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND office_id = ?').bind(clid, officeId).first();
      if (!c) return { error: 'الموكل مش موجود' };
    }
    out.client_id = clid;
  }
  return { data: out };
}

async function findEvent(env, officeId, access, authUser, id) {
  const e = await env.DB.prepare('SELECT * FROM agenda_events WHERE id = ? AND office_id = ?').bind(id, officeId).first();
  if (!e) return null;
  // "المكلّف بيها بس": مواعيده هو أو مواعيد قضاياه
  if (access?.scope === 'assigned' && e.user_id !== authUser.user_id &&
      !(e.case_id && await canAccessCase(env, access, authUser, e.case_id))) return null;
  return e;
}

// ============================================================
// 2) إضافة حدث سريع
// ============================================================
async function createEvent({ request, env, authUser, officeId, access }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const type = b.type;
  const date = b.date;
  const title = b.title;

  if (!type || !date) return fail(env, 'النوع والتاريخ مطلوبين', 400);

  if (type === 'task') {
    if (!isStr(title, 300)) return fail(env, 'اكتب عنوان المهمة', 400);

    const r = await env.DB.prepare(
      `INSERT INTO tasks (office_id, title, due_date) VALUES (?,?,?)`
    ).bind(officeId, title, date).run();

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'create', entity: 'task', entity_id: r.meta.last_row_id, request,
    });

    return ok(env, { id: r.meta.last_row_id, type: 'task' }, 201);
  }

  if (type === 'event') {
    const r0 = await readEventBody(env, officeId, access, authUser, { ...b, title, start_date: b.start_date || date });
    if (r0.error) return fail(env, r0.error, 400);
    const d = r0.data;
    const r = await env.DB.prepare(
      `INSERT INTO agenda_events (office_id, user_id, kind, title, start_date, start_time, end_time, location, notes, case_id, client_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(officeId, authUser.user_id, d.kind, d.title, d.start_date, d.start_time, d.end_time, d.location, d.notes, d.case_id, d.client_id).run();
    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'create', entity: 'agenda_event', entity_id: r.meta.last_row_id, request,
    });
    return ok(env, { id: r.meta.last_row_id, type: 'event' }, 201);
  }

  return fail(env, 'النوع مش مدعوم', 400);
}

// ============================================================
// 3) تعديل حدث (drag & drop)
// ============================================================
async function updateEvent({ request, env, authUser, officeId, params, access }) {
  const type = params[0];
  const id = toInt(params[1]);
  if (!type || !id) return fail(env, 'بيانات ناقصة', 400);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  if (type === 'event') {
    const e = await findEvent(env, officeId, access, authUser, id);
    if (!e) return fail(env, 'الموعد مش موجود', 404);
    const r0 = await readEventBody(env, officeId, access, authUser, b, true);
    if (r0.error) return fail(env, r0.error, 400);
    const keys = Object.keys(r0.data);
    if (!keys.length) return fail(env, 'مفيش تغييرات', 400);
    await env.DB.prepare(
      `UPDATE agenda_events SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ? AND office_id = ?`
    ).bind(...keys.map(k => r0.data[k]), id, officeId).run();
    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'update', entity: 'agenda_event', entity_id: id, request,
    });
    return ok(env, { updated: true });
  }

  const newDate = b.date;
  if (!newDate || !DATE_RE.test(String(newDate))) return fail(env, 'التاريخ مطلوب', 400);

  if (type === 'session') {
    const s = await env.DB.prepare(
      `SELECT s.id FROM sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE s.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!s) return fail(env, 'الجلسة مش موجودة', 404);

    if (b.time !== undefined) {
      await env.DB.prepare(
        `UPDATE sessions SET session_date = ?, session_time = ? WHERE id = ?`
      ).bind(newDate, cleanTime(b.time), id).run();
    } else {
      await env.DB.prepare(
        `UPDATE sessions SET session_date = ? WHERE id = ?`
      ).bind(newDate, id).run();
    }

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'update', entity: 'session', entity_id: id, request,
      metadata: { new_date: newDate },
    });

    return ok(env, { updated: true });
  }

  if (type === 'task') {
    const t = await env.DB.prepare(
      `SELECT id FROM tasks WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();
    if (!t) return fail(env, 'المهمة مش موجودة', 404);

    await env.DB.prepare(
      `UPDATE tasks SET due_date = ? WHERE id = ?`
    ).bind(newDate, id).run();

    return ok(env, { updated: true });
  }

  if (type === 'fee') {
    const f = await env.DB.prepare(
      `SELECT id FROM fees WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();
    if (!f) return fail(env, 'الأتعاب مش موجودة', 404);

    await env.DB.prepare(
      `UPDATE fees SET due_date = ? WHERE id = ?`
    ).bind(newDate, id).run();

    return ok(env, { updated: true });
  }

  return fail(env, 'النوع مش مدعوم', 400);
}

// ============================================================
// 4) حذف حدث
// ============================================================
async function deleteEvent({ env, authUser, officeId, params, request, access }) {
  const type = params[0];
  const id = toInt(params[1]);
  if (!type || !id) return fail(env, 'بيانات ناقصة', 400);

  if (type === 'event') {
    const e = await findEvent(env, officeId, access, authUser, id);
    if (!e) return fail(env, 'الموعد مش موجود', 404);
    await env.DB.prepare('DELETE FROM agenda_events WHERE id = ? AND office_id = ?').bind(id, officeId).run();
    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'delete', entity: 'agenda_event', entity_id: id, request,
    });
    return ok(env, { deleted: true });
  }

  if (type === 'session') {
    const s = await env.DB.prepare(
      `SELECT s.id FROM sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE s.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!s) return fail(env, 'الجلسة مش موجودة', 404);
    // مصاريف الجلسة ليها قيود في الحسابات → متتمسحش الجلسة وتسيبهم يتامى
    const exp = await env.DB.prepare(`SELECT COUNT(*) AS n FROM session_expenses WHERE session_id = ?`).bind(id).first();
    if (exp?.n) return fail(env, `الجلسة دي عليها ${exp.n} مصروف متسجل — امسح المصاريف الأول، وبعدين امسح الجلسة`, 409);

    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
    return ok(env, { deleted: true });
  }

  if (type === 'task') {
    const t = await env.DB.prepare(
      `SELECT id FROM tasks WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();
    if (!t) return fail(env, 'المهمة مش موجودة', 404);

    await env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
    return ok(env, { deleted: true });
  }

  return fail(env, 'النوع مش مدعوم', 400);
}