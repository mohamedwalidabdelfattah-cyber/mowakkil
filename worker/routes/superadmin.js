// worker/routes/superadmin.js
// لوحة مسؤول المنصة

import { ok, fail } from '../lib/response.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { signJWT } from '../lib/jwt.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { audit } from '../lib/audit.js';
import { isValidEmail, isStr, toInt, safeJson } from '../lib/validation.js';
import { getSubscription } from '../middleware/feature-gate.js';
import { providersHealth } from '../services/llm.js';

// ============================================================
// AI: فحص المزودين + إعادة فهرسة المواد القانونية في Vectorize
// ============================================================
async function aiHealth({ env }) {
  const providers = await providersHealth(env);
  let vectorize = null;
  try {
    const d = await env.VECTORIZE.describe();
    vectorize = { dimensions: d.dimensions ?? d.config?.dimensions, count: d.vectorCount ?? d.vectorsCount ?? null };
  } catch (e) {
    vectorize = { error: e.message };
  }
  const articles = await env.DB.prepare(`SELECT COUNT(*) AS c FROM law_articles`).first();
  return ok(env, {
    providers,
    vectorize,
    law_articles: articles?.c || 0,
    tavily: String(env.TAVILY_API_KEY || '').trim().length >= 20,
  });
}

// بيفهرس دفعة واحدة كل مرة (افتراضي 25 مادة) عشان يفضل جوه حدود الخطة المجانية للـ Worker.
// الواجهة بتنادي الـ endpoint ده مرة ورا مرة لحد ما done = true.
async function reindexLaws({ request, env }) {
  const b = (await safeJson(request)) || {};
  const after = Math.max(0, toInt(b.after_id) || 0);
  const limit = Math.min(50, Math.max(5, toInt(b.limit) || 25));
  // country (اختياري): فهرسة مواد دولة واحدة بس (مثلاً الأنظمة السعودية الجديدة من غير ما نعيد المصري)
  const country = ['EG', 'SA'].includes(b.country) ? b.country : null;

  const { results } = await env.DB.prepare(
    `SELECT id, law_name, article_number, article_text, country FROM law_articles
     WHERE id > ? ${country ? 'AND country = ?' : ''} ORDER BY id ASC LIMIT ?`
  ).bind(...(country ? [after, country, limit] : [after, limit])).all();

  if (!results?.length) return ok(env, { done: true, indexed: 0, last_id: after });

  const texts = results.map(a => `${a.law_name} - ${a.article_number}: ${a.article_text}`.slice(0, 2000));
  let emb;
  try {
    emb = await env.AI.run('@cf/baai/bge-m3', { text: texts });
  } catch (e) {
    return fail(env, 'فشل توليد الـ embeddings (ممكن الحصة المجانية اليومية خلصت — كمل بكرة): ' + e.message, 503);
  }

  const vectors = results.map((a, i) => ({
    id: String(a.id),
    values: emb.data[i],
    metadata: { law_name: String(a.law_name || '').slice(0, 200), article_number: String(a.article_number || '').slice(0, 100), country: a.country || 'EG' },
  }));
  await env.VECTORIZE.upsert(vectors);

  const total = await env.DB.prepare(`SELECT COUNT(*) AS c FROM law_articles`).first();
  const doneCount = await env.DB.prepare(`SELECT COUNT(*) AS c FROM law_articles WHERE id <= ?`)
    .bind(results[results.length - 1].id).first();

  return ok(env, {
    done: results.length < limit,
    indexed: results.length,
    last_id: results[results.length - 1].id,
    progress: doneCount?.c || 0,
    total: total?.c || 0,
  });
}

export const publicRoutes = [
  { method: 'POST', path: '/api/superadmin/setup', handler: setup },
  { method: 'POST', path: '/api/superadmin/login', handler: login },
];

export const protectedRoutes = [
  { method: 'GET',    path: '/api/superadmin/stats',                             handler: getStats },
  { method: 'GET',    path: '/api/superadmin/offices',                           handler: listOffices },
  { method: 'GET',    path: /^\/api\/superadmin\/offices\/(\d+)$/,               handler: getOffice },
  { method: 'PATCH',  path: /^\/api\/superadmin\/offices\/(\d+)$/,               handler: updateOffice },
  { method: 'DELETE', path: /^\/api\/superadmin\/offices\/(\d+)$/,               handler: deleteOffice },
  { method: 'POST',   path: /^\/api\/superadmin\/offices\/(\d+)\/change-plan$/,  handler: changePlan },
  { method: 'GET',    path: /^\/api\/superadmin\/offices\/(\d+)\/users$/,        handler: getOfficeUsers },
  { method: 'PATCH',  path: /^\/api\/superadmin\/users\/(\d+)\/reset-password$/, handler: resetUserPassword },
  // ✅ أدوات الذكاء الاصطناعي
  { method: 'GET',    path: '/api/superadmin/ai/health',                         handler: aiHealth },
  { method: 'POST',   path: '/api/superadmin/ai/reindex-laws',                   handler: reindexLaws },
];

// ============================================================
// Setup / Login
// ============================================================
async function setup({ request, env }) {
  if (request.headers.get('x-setup-key') !== env.SETUP_KEY) {
    return fail(env, 'setup key غلط', 403);
  }
  const count = await env.DB.prepare(`SELECT COUNT(*) as c FROM super_admins`).first();
  if ((count?.c || 0) > 0) return fail(env, 'setup مقفول', 403);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!isValidEmail(b.email)) return fail(env, 'صيغة الإيميل غلط', 400);
  if (!isStr(b.password, 200) || b.password.length < 8) {
    return fail(env, 'كلمة السر قصيرة', 400);
  }

  const { hash, salt } = await hashPassword(b.password);
  const r = await env.DB.prepare(
    `INSERT INTO super_admins (email, password_hash, salt, full_name) VALUES (?,?,?,?)`
  ).bind(b.email, hash, salt, b.full_name || null).run();

  await audit(env, {
    action: 'super_admin_setup', entity: 'super_admin',
    entity_id: r.meta.last_row_id, request,
  });
  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function login({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await checkRateLimit(env, `sa_login:${ip}`, 10, 60))) {
    return fail(env, 'حاول تاني بعد دقيقة', 429);
  }

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const sa = await env.DB.prepare(`SELECT * FROM super_admins WHERE email = ?`).bind(b.email).first();
  if (!sa || !(await verifyPassword(b.password || '', sa.password_hash, sa.salt))) {
    return fail(env, 'بيانات الدخول غلط', 401);
  }
  if (sa.active === 0) return fail(env, 'الحساب موقوف', 403);

  const token = await signJWT({ super: true, admin_id: sa.id, name: sa.full_name }, env.JWT_SECRET);
  await env.DB.prepare(`UPDATE super_admins SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(sa.id).run();

  return ok(env, { token, name: sa.full_name });
}

// ============================================================
// Stats
// ============================================================
async function getStats({ env }) {
  const [offices, subs, users, cases, clients] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as c FROM offices`).first(),
    env.DB.prepare(
      `SELECT plan, status, COUNT(*) as c FROM subscriptions GROUP BY plan, status`
    ).all(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM users`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM cases WHERE deleted_at IS NULL`).first(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM clients WHERE deleted_at IS NULL`).first(),
  ]);

  const byPlan = { free: 0, starter: 0, pro: 0, plus: 0 };
  const byStatus = { trial: 0, active: 0, expired: 0, cancelled: 0 };
  (subs.results || []).forEach(s => {
    byPlan[s.plan] = (byPlan[s.plan] || 0) + s.c;
    byStatus[s.status] = (byStatus[s.status] || 0) + s.c;
  });

  const planPrices = { free: 0, starter: 199, pro: 399, plus: 799 };
  let mrr = 0;
  (subs.results || []).forEach(s => {
    if (s.status === 'active') mrr += (planPrices[s.plan] || 0) * s.c;
  });

  return ok(env, {
    total_offices: offices?.c || 0,
    total_users: users?.c || 0,
    total_cases: cases?.c || 0,
    total_clients: clients?.c || 0,
    by_plan: byPlan,
    by_status: byStatus,
    mrr_egp: mrr,
    arr_egp: mrr * 12,
  });
}

// ============================================================
// List offices
// ============================================================
async function listOffices({ env, url }) {
  const search = (url.searchParams.get('search') || '').trim();
  const plan = url.searchParams.get('plan');
  const status = url.searchParams.get('status');

  let q = `SELECT o.*,
             (SELECT full_name FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1) as owner_name,
             (SELECT phone FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1) as owner_phone,
             (SELECT email FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1) as owner_email,
             (SELECT COUNT(*) FROM users u WHERE u.office_id = o.id) as users_count,
             (SELECT COUNT(*) FROM cases c WHERE c.office_id = o.id AND c.deleted_at IS NULL) as cases_count,
             (SELECT COUNT(*) FROM clients cl WHERE cl.office_id = o.id AND cl.deleted_at IS NULL) as clients_count,
             s.plan as sub_plan, s.status as sub_status,
             s.trial_ends_at as sub_trial_ends_at, s.expires_at as sub_expires_at
           FROM offices o
           LEFT JOIN subscriptions s ON s.office_id = o.id
           WHERE 1=1`;
  const binds = [];

  if (search) {
    q += ` AND (o.name LIKE ? OR o.name_ar LIKE ?)`;
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (plan)   { q += ` AND s.plan = ?`;   binds.push(plan); }
  if (status) { q += ` AND s.status = ?`; binds.push(status); }

  q += ` ORDER BY o.created_at DESC`;

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results || []);
}

// ============================================================
// Get office details
// ============================================================
async function getOffice({ env, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const office = await env.DB.prepare(
    `SELECT o.*,
            (SELECT full_name FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1) as owner_name,
            (SELECT phone FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1) as owner_phone,
            (SELECT email FROM users u WHERE u.office_id = o.id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1) as owner_email,
            (SELECT COUNT(*) FROM users u WHERE u.office_id = o.id) as users_count,
            (SELECT COUNT(*) FROM cases c WHERE c.office_id = o.id AND c.deleted_at IS NULL) as cases_count,
            (SELECT COUNT(*) FROM clients cl WHERE cl.office_id = o.id AND cl.deleted_at IS NULL) as clients_count
     FROM offices o WHERE o.id = ?`
  ).bind(id).first();

  if (!office) return fail(env, 'المكتب مش موجود', 404);

  const sub = await getSubscription(env, id);
  const { results: history } = await env.DB.prepare(
    `SELECT * FROM subscription_history WHERE office_id = ? ORDER BY id DESC LIMIT 10`
  ).bind(id).all();

  return ok(env, { office, subscription: sub, history: history || [] });
}

// ============================================================
// Get office users
// ============================================================
async function getOfficeUsers({ env, params }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const { results } = await env.DB.prepare(
    `SELECT id, full_name, email, phone, role, active, created_at, last_login_at
     FROM users WHERE office_id = ? ORDER BY role DESC, id ASC`
  ).bind(id).all();

  return ok(env, results || []);
}

// ============================================================
// Update office (status + extend_days)
// ============================================================
async function updateOffice({ request, env, params, superAdmin }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  if (b.status && ['trial', 'active', 'suspended'].includes(b.status)) {
    await env.DB.prepare(`UPDATE offices SET status = ? WHERE id = ?`).bind(b.status, id).run();
    await audit(env, {
      office_id: id, user_id: superAdmin.admin_id,
      action: 'status_change', entity: 'office',
      entity_id: id, metadata: { status: b.status }, request,
    });
  }

  if (b.extend_days) {
    const office = await env.DB.prepare(`SELECT trial_ends_at FROM offices WHERE id = ?`).bind(id).first();
    const base = office?.trial_ends_at ? new Date(office.trial_ends_at) : new Date();
    const newEnd = new Date(base.getTime() + b.extend_days * 86400000).toISOString();
    await env.DB.prepare(`UPDATE offices SET trial_ends_at = ? WHERE id = ?`).bind(newEnd, id).run();
    await env.DB.prepare(`UPDATE subscriptions SET trial_ends_at = ? WHERE office_id = ?`).bind(newEnd, id).run();
  }

  return ok(env, { updated: true });
}

// ============================================================
// Delete office (كامل مع كل الجداول المرتبطة)
// ============================================================
async function deleteOffice({ env, params, superAdmin, request }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  if (id === 1) return fail(env, 'مينفعش تحذف المكتب الأساسي', 403);

  const office = await env.DB.prepare(`SELECT id FROM offices WHERE id = ?`).bind(id).first();
  if (!office) return fail(env, 'المكتب مش موجود', 404);

  try {
    await env.DB.prepare(`DELETE FROM notifications WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM subscription_history WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM payment_requests WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM subscriptions WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(
      `DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE office_id = ?)`
    ).bind(id).run();
    await env.DB.prepare(`DELETE FROM journal_entries WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM accounts WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM accounting_settings WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(
      `DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE office_id = ?)`
    ).bind(id).run();
    await env.DB.prepare(`DELETE FROM invoices WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM task_expenses WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM expenses WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(
      `DELETE FROM session_expenses WHERE session_id IN (SELECT s.id FROM sessions s JOIN cases c ON c.id = s.case_id WHERE c.office_id = ?)`
    ).bind(id).run();
    await env.DB.prepare(`DELETE FROM payments WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM fees WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM documents WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM tasks WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(
      `DELETE FROM sessions WHERE case_id IN (SELECT id FROM cases WHERE office_id = ?)`
    ).bind(id).run();
    await env.DB.prepare(`DELETE FROM cases WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM clients WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM lawyers WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM client_users WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM users WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM office_settings WHERE office_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM offices WHERE id = ?`).bind(id).run();
  } catch (e) {
    console.error('deleteOffice DB error:', e.message);
    return fail(env, 'فشل الحذف: ' + e.message, 500);
  }

  await audit(env, {
    action: 'delete_office', entity: 'office', entity_id: id, request,
    metadata: { by: superAdmin.admin_id },
  });

  return ok(env, { deleted: true });
}

// ============================================================
// Change plan
// ============================================================
async function changePlan({ request, env, params, superAdmin }) {
  const id = toInt(params[0]);
  if (!id) return fail(env, 'id غلط', 400);

  const b = await safeJson(request);
  if (!b || !b.plan) return fail(env, 'plan مطلوب', 400);

  const validPlans = ['free', 'starter', 'pro', 'plus', 'lifetime_basic', 'lifetime_pro'];
  if (!validPlans.includes(b.plan)) return fail(env, 'الباقة غلط', 400);

  const sub = await getSubscription(env, id);
  if (!sub) return fail(env, 'مفيش اشتراك للمكتب ده', 404);

  const status = b.status || 'active';
  const days = b.days || 30;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  await env.DB.prepare(
    `UPDATE subscriptions
     SET plan = ?, status = ?, expires_at = ?, updated_at = datetime('now')
     WHERE office_id = ?`
  ).bind(b.plan, status, expiresAt, id).run();

  await env.DB.prepare(
    `INSERT INTO subscription_history
      (office_id, old_plan, new_plan, old_status, new_status, changed_by, reason)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(
    id, sub.plan, b.plan, sub.status, status,
    superAdmin.admin_id, b.reason || 'تغيير من Superadmin'
  ).run();

  await audit(env, {
    office_id: id, action: 'plan_change', entity: 'subscription',
    entity_id: id, metadata: { from: sub.plan, to: b.plan }, request,
  });

  return ok(env, { plan: b.plan, status, expires_at: expiresAt });
}

// ============================================================
// Reset user password
// ============================================================
async function resetUserPassword({ request, env, params }) {
  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b || !isStr(b.new_password, 200) || b.new_password.length < 8) {
    return fail(env, 'كلمة السر لازم 8 حروف على الأقل', 400);
  }
  const { hash, salt } = await hashPassword(b.new_password);
  await env.DB.prepare(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?`)
    .bind(hash, salt, id).run();
  await audit(env, {
    action: 'password_reset_by_super', entity: 'user', entity_id: id, request,
  });
  return ok(env, { updated: true });
}