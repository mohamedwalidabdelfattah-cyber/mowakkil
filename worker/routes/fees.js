import { ok, fail } from '../lib/response.js';
import { assertOpen } from '../lib/period-lock.js';
import { recordTrust, trustLedger, profitability, lockDate } from '../services/finance-advanced.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson } from '../lib/validation.js';
import { autoEntryFeeCreated, recordPayment, deleteEntriesFor, REF, syncInvoiceEntry } from '../services/accounting.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { cashSummary } from '../services/client-statement.js';

export const routes = [
  { method: 'GET',    path: '/api/fees/cash-summary', handler: cashSummaryRoute },
  { method: 'GET',    path: /^\/api\/fees\/trust\/(\d+)$/, handler: trustGet },
  { method: 'POST',   path: '/api/fees/trust', handler: trustPost },
  { method: 'GET',    path: '/api/fees/profitability', handler: profitRoute },
  { method: 'POST',   path: '/api/fees/lock', handler: lockRoute, adminOnly: true },
  { method: 'GET',    path: '/api/fees',                handler: list },
  { method: 'POST',   path: '/api/fees',                handler: create },
  { method: 'PATCH',  path: /^\/api\/fees\/(\d+)$/,     handler: markPaid },
  { method: 'DELETE', path: /^\/api\/fees\/(\d+)$/,     handler: removeFee },
];

async function list({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status'); // 'paid' | 'pending' | 'late'
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = `SELECT f.*, cl.name as client_name, cl.phone as client_phone, c.case_number FROM fees f
               LEFT JOIN cases c ON c.id = f.case_id
               LEFT JOIN clients cl ON cl.id = f.client_id
               WHERE f.office_id = ?`;
  const binds = [officeId];

  if (search) {
    query += ' AND (cl.name LIKE ? OR f.notes LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`);
  }

  if (status === 'paid') {
    query += ` AND f.status = 'مدفوع بالكامل'`;
  } else if (status === 'pending') {
    query += ` AND f.status != 'مدفوع بالكامل'`;
  } else if (status === 'late') {
    query += ` AND f.status != 'مدفوع بالكامل' AND f.due_date < date('now')`;
  }

  if (from) { query += ' AND f.due_date >= ?'; binds.push(from); }
  if (to)   { query += ' AND f.due_date <= ?'; binds.push(to); }

  query += ' ORDER BY f.created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return ok(env, results || []);
}

async function create({ request, env, authUser, officeId }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b || !(Number(b.amount_due) > 0)) return fail(env, 'اكتب المبلغ', 400);

  const r = await env.DB.prepare(
    `INSERT INTO fees (office_id, case_id, client_id, amount_due, amount_paid, due_date, notes)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(
    officeId,
    b.case_id ?? null,
    b.client_id ?? null,
    b.amount_due,
    b.amount_paid ?? 0,
    b.due_date ?? null,
    b.notes ?? null
  ).run();

  try {
    await autoEntryFeeCreated(env, {
      officeId,
      feeId: r.meta.last_row_id,
      amount: Number(b.amount_due),
      date: new Date().toISOString().slice(0, 10),
      description: b.notes || `أتعاب جديدة${b.case_id ? ' - قضية #' + b.case_id : ''}`,
      userId: authUser.user_id,
    });
  } catch (e) {
    console.error('auto journal entry failed:', e.message);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'fee', entity_id: r.meta.last_row_id, request,
  });
  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function markPaid({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b || b.amount_paid == null) return fail(env, 'amount_paid مطلوب', 400);

  // "المدفوع" بيتحسب من الدفعات — الزيادة بتتسجل كدفعة حقيقية (بتدخل الصندوق/البنك وبيطلعلها إيصال)
  const fee = await env.DB.prepare('SELECT * FROM fees WHERE id = ? AND office_id = ?').bind(id, officeId).first();
  if (!fee) return fail(env, 'not found', 404);
  const target = Number(b.amount_paid) || 0;
  const current = Number(fee.amount_paid) || 0;
  if (target + 0.01 < current) return fail(env, 'لتقليل المدفوع احذف الدفعة من سجل الدفعات', 400);
  if (target - current > 0.009) {
    try {
      await recordPayment(env, { officeId, userId: authUser.user_id, amount: target - current, method: b.method || 'نقدي',
        date: b.payment_date || new Date().toISOString().slice(0, 10), feeId: id });
    } catch (e) { return fail(env, e.message, 400); }
  }
  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'fee', entity_id: id, request,
  });
  return ok(env, { updated: true });
}

async function removeFee({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;

  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const fee = await env.DB.prepare(
    `SELECT * FROM fees WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!fee) return fail(env, 'الأتعاب مش موجودة', 404);

  try {
    const { results: payments } = await env.DB.prepare(
      `SELECT id FROM payments WHERE fee_id = ? AND office_id = ? AND invoice_id IS NULL`
    ).bind(id, officeId).all();

    for (const p of payments || []) {
      try {
        await env.DB.prepare(
          `DELETE FROM journal_lines WHERE entry_id IN
            (SELECT id FROM journal_entries WHERE reference_type = 'payment' AND reference_id = ? AND office_id = ?)`
        ).bind(p.id, officeId).run();
        await env.DB.prepare(
          `DELETE FROM journal_entries WHERE reference_type = 'payment' AND reference_id = ? AND office_id = ?`
        ).bind(p.id, officeId).run();
      } catch (e) {
        console.error('delete payment journal failed:', e.message);
      }
    }

    await env.DB.prepare(
      `DELETE FROM payments WHERE fee_id = ? AND office_id = ? AND invoice_id IS NULL`
    ).bind(id, officeId).run();

    try {
      await env.DB.prepare(
        `DELETE FROM journal_lines WHERE entry_id IN
          (SELECT id FROM journal_entries WHERE reference_type = 'fee' AND reference_id = ? AND office_id = ?)`
      ).bind(id, officeId).run();
      await env.DB.prepare(
        `DELETE FROM journal_entries WHERE reference_type = 'fee' AND reference_id = ? AND office_id = ?`
      ).bind(id, officeId).run();
    } catch (e) {
      console.error('delete fee journal failed:', e.message);
    }

    // الفواتير اللي كانت مربوطة بالأتعاب دي بتبقى فواتير مستقلة (وقيدها بيتظبط)
    const { results: linkedInv } = await env.DB.prepare('SELECT id FROM invoices WHERE fee_id = ? AND office_id = ?').bind(id, officeId).all();
    await env.DB.prepare('UPDATE invoices SET fee_id = NULL WHERE fee_id = ? AND office_id = ?').bind(id, officeId).run();
    await env.DB.prepare('UPDATE payments SET fee_id = NULL WHERE fee_id = ? AND office_id = ? AND invoice_id IS NOT NULL').bind(id, officeId).run();

    await env.DB.prepare(
      `DELETE FROM fees WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).run();
    for (const li of linkedInv || []) await syncInvoiceEntry(env, officeId, li.id, authUser.user_id).catch(() => {});

  } catch (e) {
    console.error('remove fee failed:', e.message);
    return fail(env, 'فشل الحذف: ' + e.message, 500);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'fee', entity_id: id,
    metadata: { amount_due: fee.amount_due, notes: fee.notes }, request,
  });

  return ok(env, { deleted: true });
}

// ============================================================
// الوضع المبسط: اللي دخل واللي خرج فعلاً + مين عليه فلوس
// ============================================================
async function cashSummaryRoute({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'finance');
  if (gate) return gate;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) return fail(env, 'from و to مطلوبين', 400);
  return ok(env, await cashSummary(env, officeId, from, to));
}


// ============================================================
// أمانات الموكلين (الاحترافية وفوق)
// ============================================================
async function trustGet({ env, officeId, params }) {
  const g = await requireFeature(env, officeId, 'accounting'); if (g) return g;
  return ok(env, await trustLedger(env, officeId, Number(params[0])));
}
async function trustPost({ request, env, officeId, authUser }) {
  const g = await requireFeature(env, officeId, 'accounting'); if (g) return g;
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  try {
    const r = await recordTrust(env, { officeId, userId: authUser.user_id, clientId: Number(b.client_id), caseId: b.case_id ? Number(b.case_id) : null,
      kind: b.kind, amount: b.amount, method: b.method, date: b.date, description: b.description || null });
    await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'trust', entity_id: r.id, metadata: { kind: b.kind, amount: b.amount }, request });
    return ok(env, r, 201);
  } catch (e) { return fail(env, e.message, e.status || 400); }
}

// ============================================================
// ربحية القضايا والمحامين (الاحترافية وفوق)
// ============================================================
async function profitRoute({ env, officeId, url }) {
  const g = await requireFeature(env, officeId, 'accounting'); if (g) return g;
  const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) return fail(env, 'from و to مطلوبين', 400);
  return ok(env, await profitability(env, officeId, from, to));
}

// ============================================================
// قفل الفترات (المتقدمة) — المدير بس
// ============================================================
async function lockRoute({ request, env, officeId, authUser }) {
  const g = await requireFeature(env, officeId, 'finance_advanced'); if (g) return g;
  const b = await safeJson(request);
  const v = b?.lock_before || null;
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(env, 'التاريخ غلط', 400);
  await env.DB.prepare('UPDATE office_settings SET lock_before = ? WHERE office_id = ?').bind(v, officeId).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'period_lock', metadata: { lock_before: v }, request });
  return ok(env, { lock_before: v });
}
