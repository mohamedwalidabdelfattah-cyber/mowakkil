// worker/routes/calendar.js
// التقويم — كل الأحداث في مكان واحد

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { caseScope, can } from '../lib/permissions.js';

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
        `SELECT s.id, s.session_date as date, s.notes,
                c.id as case_id, c.case_number, c.court, c.degree,
                cl.name as client_name
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
                cl.name as client_name, c.case_number
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
          start: s.date,
          end: s.date,
          isAllDay: true,
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

  return ok(env, events);
}

// ============================================================
// 2) إضافة حدث سريع
// ============================================================
async function createEvent({ request, env, authUser, officeId }) {
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

  return fail(env, 'النوع مش مدعوم', 400);
}

// ============================================================
// 3) تعديل حدث (drag & drop)
// ============================================================
async function updateEvent({ request, env, authUser, officeId, params }) {
  const type = params[0];
  const id = toInt(params[1]);
  if (!type || !id) return fail(env, 'بيانات ناقصة', 400);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const newDate = b.date;
  if (!newDate) return fail(env, 'التاريخ مطلوب', 400);

  if (type === 'session') {
    const s = await env.DB.prepare(
      `SELECT s.id FROM sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE s.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!s) return fail(env, 'الجلسة مش موجودة', 404);

    await env.DB.prepare(
      `UPDATE sessions SET session_date = ? WHERE id = ?`
    ).bind(newDate, id).run();

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
async function deleteEvent({ env, authUser, officeId, params, request }) {
  const type = params[0];
  const id = toInt(params[1]);
  if (!type || !id) return fail(env, 'بيانات ناقصة', 400);

  if (type === 'session') {
    const s = await env.DB.prepare(
      `SELECT s.id FROM sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE s.id = ? AND c.office_id = ?`
    ).bind(id, officeId).first();
    if (!s) return fail(env, 'الجلسة مش موجودة', 404);

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