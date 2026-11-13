import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson } from '../lib/validation.js';
import { createNotification } from './notifications.js';
import { requireLimit } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',    path: '/api/cases',                    handler: list },
  { method: 'POST',   path: '/api/cases',                    handler: create },
  { method: 'GET',    path: /^\/api\/cases\/(\d+)\/profile$/, handler: profile },
  { method: 'PATCH',  path: /^\/api\/cases\/(\d+)$/,          handler: updateStatus },
  { method: 'DELETE', path: /^\/api\/cases\/(\d+)$/,          handler: remove },
];

async function list({ env, officeId, url }) {
  const archived = url.searchParams.get('archived') === '1';
  const search   = url.searchParams.get('search');
  const type     = url.searchParams.get('type');
  const court    = url.searchParams.get('court');

  const cond = archived ? `= 'مؤرشفة'` : `!= 'مؤرشفة'`;

  let query = `SELECT c.*, cl.name as client_name
               FROM cases c
               LEFT JOIN clients cl ON cl.id = c.client_id
               WHERE c.office_id = ? AND c.status ${cond} AND c.deleted_at IS NULL`;
  const binds = [officeId];

  if (search) {
    query += ' AND (c.case_number LIKE ? OR c.court LIKE ? OR cl.name LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (type) {
    query += ' AND c.case_type = ?';
    binds.push(type);
  }

  if (court) {
    query += ' AND c.court LIKE ?';
    binds.push(`%${court}%`);
  }

  query += ' ORDER BY c.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return ok(env, results || []);
}

async function create({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const casesCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM cases WHERE office_id = ? AND deleted_at IS NULL`
  ).bind(officeId).first();

  const limitFail = await requireLimit(env, officeId, 'max_cases', casesCount?.c || 0);
  if (limitFail) return limitFail;

  if (b.client_id) {
    const c = await env.DB.prepare(
      `SELECT id FROM clients WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
    ).bind(b.client_id, officeId).first();
    if (!c) return fail(env, 'الموكل مش موجود', 400);
  }

  const r = await env.DB.prepare(
    `INSERT INTO cases (office_id, client_id, case_number, court, degree, case_type)
     VALUES (?,?,?,?,?,?)`
  ).bind(
    officeId,
    b.client_id ?? null,
    b.case_number ?? null,
    b.court ?? null,
    b.degree ?? null,
    b.case_type ?? null
  ).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'case', entity_id: r.meta.last_row_id, request,
  });

  const caseNumber = b.case_number || `#${r.meta.last_row_id}`;
  await createNotification(env, {
    officeId,
    userId: null,
    type: 'case_created',
    title: '⚖️ قضية جديدة',
    body: `تم إنشاء قضية ${caseNumber}${b.court ? ' · ' + b.court : ''}`,
    link: `#case-${r.meta.last_row_id}`,
    icon: '⚖️',
    priority: 'normal',
    referenceType: 'case',
    referenceId: r.meta.last_row_id,
  });

  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function profile({ env, officeId, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const caseRow = await env.DB.prepare(
    `SELECT c.*, cl.name as client_name, cl.phone as client_phone,
            cl.national_id as client_national_id
     FROM cases c
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ? AND c.office_id = ? AND c.deleted_at IS NULL`
  ).bind(id, officeId).first();

  if (!caseRow) return fail(env, 'القضية مش موجودة', 404);

  const { results: sessions } = await env.DB.prepare(
    `SELECT * FROM sessions WHERE case_id = ? ORDER BY session_date DESC`
  ).bind(id).all();

  const { results: expenses } = await env.DB.prepare(
    `SELECT se.*, s.session_date
     FROM session_expenses se
     JOIN sessions s ON s.id = se.session_id
     WHERE s.case_id = ?
     ORDER BY se.created_at DESC`
  ).bind(id).all();

  const { results: fees } = await env.DB.prepare(
    `SELECT * FROM fees WHERE case_id = ? AND office_id = ? ORDER BY created_at DESC`
  ).bind(id, officeId).all();

  const { results: documents } = await env.DB.prepare(
    `SELECT id, doc_type, file_name, r2_key, created_at
     FROM documents
     WHERE case_id = ? AND office_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(id, officeId).all();

  const { results: tasks } = await env.DB.prepare(
    `SELECT t.*, l.name as lawyer_name
     FROM tasks t
     LEFT JOIN lawyers l ON l.id = t.lawyer_id
     WHERE t.case_id = ? AND t.office_id = ?
     ORDER BY t.created_at DESC`
  ).bind(id, officeId).all();

  const totalFees = (fees || []).reduce((s, f) => s + (f.amount_due || 0), 0);
  const totalPaid = (fees || []).reduce((s, f) => s + (f.amount_paid || 0), 0);
  const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);

  return ok(env, {
    case: caseRow,
    sessions: sessions || [],
    expenses: expenses || [],
    fees: fees || [],
    documents: documents || [],
    tasks: tasks || [],
    stats: {
      total_fees: totalFees,
      total_paid: totalPaid,
      total_remaining: totalFees - totalPaid,
      total_expenses: totalExpenses,
      sessions_count: (sessions || []).length,
      tasks_count: (tasks || []).length,
      documents_count: (documents || []).length,
    },
  });
}

async function updateStatus({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b || !b.status) return fail(env, 'status مطلوب', 400);

  const r = await env.DB.prepare(
    `UPDATE cases SET status = ? WHERE id = ? AND office_id = ?`
  ).bind(b.status, id, officeId).run();

  if (r.meta.changes === 0) return fail(env, 'not found', 404);
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'case', entity_id: id,
    metadata: { status: b.status }, request,
  });
  return ok(env, { updated: true });
}

async function remove({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const c = await env.DB.prepare(
    `SELECT id FROM cases WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!c) return fail(env, 'not found', 404);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE cases SET deleted_at = datetime('now') WHERE id = ? AND office_id = ?`
    ).bind(id, officeId),
    env.DB.prepare(
      `UPDATE sessions SET notes = COALESCE(notes,'') || ' [محذوفة]' WHERE case_id = ?`
    ).bind(id),
  ]);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'case', entity_id: id, request,
  });
  return ok(env, { deleted: true });
}