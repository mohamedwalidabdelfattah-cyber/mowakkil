// worker/routes/journal.js
// دفتر اليومية + التقارير المالية

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson } from '../lib/validation.js';
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getAccountBalance,
  getTrialBalance,
  getGeneralLedger,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getAccountingSummary,
} from '../services/accounting.js';
import { requireFeature } from '../middleware/feature-gate.js';

export const routes = [
  { method: 'GET',    path: '/api/journal',                                    handler: list },
  { method: 'POST',   path: '/api/journal',                                    handler: create },
  { method: 'GET',    path: /^\/api\/journal\/(\d+)$/,                         handler: get },
  { method: 'DELETE', path: /^\/api\/journal\/(\d+)$/,                         handler: remove, adminOnly: true },
  { method: 'GET',    path: /^\/api\/accounts\/(\d+)\/balance$/,               handler: balance },
  { method: 'GET',    path: /^\/api\/accounts\/(\d+)\/ledger$/,                handler: ledger },
  { method: 'GET',    path: '/api/reports/trial-balance',                      handler: trialBalance },
  { method: 'GET',    path: '/api/reports/profit-loss',                        handler: profitLoss },
  { method: 'GET',    path: '/api/reports/balance-sheet',                      handler: balanceSheet },
  { method: 'GET',    path: '/api/reports/cash-flow',                          handler: cashFlow },
  { method: 'GET',    path: '/api/reports/accounting-summary',                 handler: accountingSummary },
];

async function list({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');
  const refType = url.searchParams.get('ref_type');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

  let q = `SELECT je.*, u.full_name as created_by_name
           FROM journal_entries je
           LEFT JOIN users u ON u.id = je.created_by
           WHERE je.office_id = ?`;
  const binds = [officeId];

  if (fromDate) { q += ` AND je.entry_date >= ?`; binds.push(fromDate); }
  if (toDate)   { q += ` AND je.entry_date <= ?`; binds.push(toDate); }
  if (refType)  { q += ` AND je.reference_type = ?`; binds.push(refType); }

  q += ` ORDER BY je.entry_date DESC, je.id DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results || []);
}

async function get({ env, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  const entry = await getJournalEntry(env, officeId, id);
  if (!entry) return fail(env, 'not found', 404);
  return ok(env, entry);
}

async function create({ request, env, authUser, officeId }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!b.entry_date) return fail(env, 'اكتب تاريخ القيد', 400);
  if (!Array.isArray(b.lines) || b.lines.length < 2) {
    return fail(env, 'القيد لازم يكون فيه سطرين على الأقل', 400);
  }

  try {
    const result = await createJournalEntry(env, {
      officeId, date: b.entry_date,
      description: b.description || null,
      lines: b.lines,
      referenceType: 'manual',
      userId: authUser.user_id,
    });

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'create', entity: 'journal_entry', entity_id: result.id,
      metadata: { entry_number: result.entry_number }, request,
    });

    return ok(env, result, 201);
  } catch (e) {
    return fail(env, e.message, 400);
  }
}

async function remove({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  try {
    await deleteJournalEntry(env, officeId, id);
    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'delete', entity: 'journal_entry', entity_id: id, request,
    });
    return ok(env, { deleted: true });
  } catch (e) {
    return fail(env, e.message, 400);
  }
}

async function balance({ env, officeId, params, url }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  const asOf = url.searchParams.get('as_of');
  const result = await getAccountBalance(env, officeId, id, asOf);
  return ok(env, result);
}

async function ledger({ env, officeId, params, url }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const id = toInt(params[0]);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const result = await getGeneralLedger(env, officeId, id, from, to);
  if (!result) return fail(env, 'not found', 404);
  return ok(env, result);
}

async function trialBalance({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const result = await getTrialBalance(env, officeId, from, to);
  return ok(env, result);
}

async function profitLoss({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const now = new Date();
  const from = url.searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || now.toISOString().slice(0, 10);
  const result = await getProfitAndLoss(env, officeId, from, to);
  return ok(env, result);
}

async function balanceSheet({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'advanced_reports');
  if (gate) return gate;

  const asOf = url.searchParams.get('as_of') || new Date().toISOString().slice(0, 10);
  const result = await getBalanceSheet(env, officeId, asOf);
  return ok(env, result);
}

async function cashFlow({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'advanced_reports');
  if (gate) return gate;

  const now = new Date();
  const from = url.searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || now.toISOString().slice(0, 10);
  const result = await getCashFlow(env, officeId, from, to);
  return ok(env, result);
}

async function accountingSummary({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'accounting');
  if (gate) return gate;

  const now = new Date();
  const from = url.searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || now.toISOString().slice(0, 10);
  const result = await getAccountingSummary(env, officeId, from, to);
  return ok(env, result);
}