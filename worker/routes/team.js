// worker/routes/team.js
// الفريق والصلاحيات: أعضاء المكتب وأدوارهم، الأدوار المخصصة (الباقة المتقدمة)، وفريق كل قضية.
import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson, toInt, isStr, isValidEmail } from '../lib/validation.js';
import { hashPassword } from '../lib/crypto.js';
import { requireLimit, getSubscription } from '../middleware/feature-gate.js';
import {
  ROLES, CATALOG, ACTION_LABELS, ALL_PERMISSIONS, planAccess, rolesForPlan, clearAccessCache, canAccessCase,
} from '../lib/permissions.js';

export const routes = [
  { method: 'GET',    path: '/api/team/me',                         handler: me },
  { method: 'GET',    path: '/api/team/directory',                  handler: directory },
  { method: 'GET',    path: '/api/team',                            handler: list },
  { method: 'POST',   path: '/api/team',                            handler: create },
  { method: 'PATCH',  path: /^\/api\/team\/(\d+)$/,                 handler: update },
  { method: 'POST',   path: /^\/api\/team\/(\d+)\/password$/,       handler: resetPassword },
  { method: 'GET',    path: '/api/team/roles',                      handler: listRoles },
  { method: 'POST',   path: '/api/team/roles',                      handler: createRole },
  { method: 'PATCH',  path: /^\/api\/team\/roles\/(\d+)$/,          handler: updateRole },
  { method: 'DELETE', path: /^\/api\/team\/roles\/(\d+)$/,          handler: deleteRole },
  { method: 'GET',    path: /^\/api\/cases\/(\d+)\/members$/,       handler: getCaseMembers },
  { method: 'PUT',    path: /^\/api\/cases\/(\d+)\/members$/,       handler: setCaseMembers },
];

async function planOf(env, officeId) {
  const sub = await getSubscription(env, officeId);
  return sub?.plan || 'starter';
}

// ============================================================
// صلاحياتي (الواجهة بتستخدمها تخفي الأقسام والأزرار)
// ============================================================
async function me({ env, access, authUser }) {
  return ok(env, {
    user_id: authUser.user_id,
    role: access.role,
    role_label: access.roleLabel,
    permissions: [...access.permissions],
    scope: access.scope,
    plan: access.plan,
    downgraded: access.downgraded,
  });
}

// أسماء أعضاء المكتب النشطين بس (لاختيار فريق القضية) — من غير إيميلات ولا تليفونات
async function directory({ env, officeId }) {
  const { results } = await env.DB.prepare(
    `SELECT id, full_name, role FROM users WHERE office_id = ? AND active = 1 ORDER BY full_name`
  ).bind(officeId).all();
  return ok(env, (results || []).map(u => ({ id: u.id, full_name: u.full_name, role_label: ROLES[u.role]?.label || 'دور مخصص' })));
}

// ============================================================
// قايمة الفريق + الأدوار المتاحة في الباقة
// ============================================================
async function list({ env, officeId }) {
  const plan = await planOf(env, officeId);
  const pa = planAccess(plan);
  const { results: users } = await env.DB.prepare(
    `SELECT id, full_name, email, phone, role, scope, custom_role_id, active, last_login_at, created_at
     FROM users WHERE office_id = ? ORDER BY (role = 'admin') DESC, active DESC, id ASC`
  ).bind(officeId).all();
  let customRoles = [];
  try {
    const r = await env.DB.prepare(`SELECT id, name, permissions FROM office_roles WHERE office_id = ? ORDER BY id`).bind(officeId).all();
    customRoles = (r.results || []).map(x => ({ id: x.id, name: x.name, permissions: safeParse(x.permissions) }));
  } catch {}
  return ok(env, {
    plan,
    users: users || [],
    roles: rolesForPlan(plan),
    can_assign_scope: pa.assignedScope,
    can_custom_roles: pa.customRoles,
    custom_roles: customRoles,
    catalog: CATALOG.map(m => ({ ...m, actions: m.actions.map(a => ({ id: `${m.module}.${a}`, label: ACTION_LABELS[a] })) })),
    presets: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.permissions])),
  });
}

const safeParse = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// يتحقق إن الدور/النطاق مسموحين في الباقة
async function validateRole(env, officeId, plan, { role, scope, custom_role_id }) {
  const pa = planAccess(plan);
  if (role === 'custom') {
    if (!pa.customRoles) return 'الأدوار المخصصة متاحة في الباقة المتقدمة بس';
    const r = await env.DB.prepare(`SELECT id FROM office_roles WHERE id = ? AND office_id = ?`).bind(toInt(custom_role_id), officeId).first();
    if (!r) return 'اختار دور مخصص صحيح';
  } else {
    if (!ROLES[role]) return 'دور غير معروف';
    if (role !== 'admin' && !pa.roles.includes(role)) return `دور "${ROLES[role].label}" مش متاح في باقتك — رقّي الباقة`;
  }
  if (scope === 'assigned' && !pa.assignedScope) return 'خاصية "القضايا المكلّف بيها بس" متاحة من الباقة الاحترافية';
  return null;
}

// ============================================================
// إضافة عضو
// ============================================================
async function create({ request, env, authUser, officeId }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const fullName = String(b.full_name || '').trim();
  const email = String(b.email || '').trim().toLowerCase() || null;
  const phone = String(b.phone || '').replace(/[\s-]/g, '') || null;
  if (!isStr(fullName, 120) || fullName.length < 2) return fail(env, 'اكتب اسم العضو', 400);
  if (!email && !phone) return fail(env, 'لازم إيميل أو رقم موبايل للدخول', 400);
  if (email && !isValidEmail(email)) return fail(env, 'صيغة الإيميل غلط', 400);
  if (phone && !/^(\+?20)?0?1[0125]\d{8}$/.test(phone)) return fail(env, 'رقم الموبايل غلط', 400);
  if (!isStr(b.password, 200) || b.password.length < 8) return fail(env, 'كلمة السر لازم 8 حروف على الأقل', 400);

  const role = String(b.role || 'lawyer');
  const scope = b.scope === 'assigned' ? 'assigned' : 'all';
  const plan = await planOf(env, officeId);
  const roleErr = await validateRole(env, officeId, plan, { role, scope, custom_role_id: b.custom_role_id });
  if (roleErr) return fail(env, roleErr, 400, { code: 'ROLE_NOT_IN_PLAN' });

  const counts = await env.DB.prepare(
    `SELECT COUNT(*) AS c, SUM(role = 'admin') AS admins FROM users WHERE office_id = ? AND active = 1`
  ).bind(officeId).first();
  const limitFail = await requireLimit(env, officeId, 'max_users', counts?.c || 0, { excludeAdmins: counts?.admins || 0 });
  if (limitFail) return limitFail;

  if (email) {
    const dup = await env.DB.prepare(`SELECT id FROM users WHERE LOWER(email) = ?`).bind(email).first();
    if (dup) return fail(env, 'الإيميل ده مستخدم بالفعل', 409);
  }
  if (phone) {
    const dup = await env.DB.prepare(`SELECT id FROM users WHERE phone = ?`).bind(phone).first();
    if (dup) return fail(env, 'رقم الموبايل ده مستخدم بالفعل', 409);
  }

  const { hash, salt } = await hashPassword(b.password);
  const r = await env.DB.prepare(
    `INSERT INTO users (office_id, email, phone, password_hash, salt, full_name, role, scope, custom_role_id)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(officeId, email, phone, hash, salt, fullName, role, scope, role === 'custom' ? toInt(b.custom_role_id) : null).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'user',
    entity_id: r.meta.last_row_id, request, metadata: { role, scope },
  });
  return ok(env, { id: r.meta.last_row_id }, 201);
}

// ============================================================
// تعديل عضو (الدور / النطاق / التفعيل / الاسم)
// ============================================================
async function update({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ? AND office_id = ?`).bind(id, officeId).first();
  if (!user) return fail(env, 'العضو مش موجود', 404);

  const role = b.role !== undefined ? String(b.role) : user.role;
  const scope = b.scope !== undefined ? (b.scope === 'assigned' ? 'assigned' : 'all') : (user.scope || 'all');
  const active = b.active !== undefined ? (b.active ? 1 : 0) : user.active;
  const customRoleId = role === 'custom' ? toInt(b.custom_role_id ?? user.custom_role_id) : null;
  const fullName = b.full_name !== undefined ? String(b.full_name).trim().slice(0, 120) : user.full_name;

  // حماية من قفل المكتب
  if (id === authUser.user_id && (role !== user.role || active !== user.active)) {
    return fail(env, 'مينفعش تغيّر دورك أو توقف حسابك بنفسك', 400);
  }
  if (user.role === 'admin' && (role !== 'admin' || !active)) {
    const admins = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM users WHERE office_id = ? AND role = 'admin' AND active = 1`
    ).bind(officeId).first();
    if ((admins?.c || 0) <= 1) return fail(env, 'لازم يفضل مالك واحد على الأقل للمكتب', 400);
  }

  if (b.role !== undefined || b.scope !== undefined || b.custom_role_id !== undefined) {
    const plan = await planOf(env, officeId);
    const roleErr = await validateRole(env, officeId, plan, { role, scope, custom_role_id: customRoleId });
    if (roleErr) return fail(env, roleErr, 400, { code: 'ROLE_NOT_IN_PLAN' });
  }
  // إعادة تفعيل عضو = بيحسب من حد المستخدمين
  if (active && !user.active && role !== 'admin') {
    const counts = await env.DB.prepare(
      `SELECT COUNT(*) AS c, SUM(role = 'admin') AS admins FROM users WHERE office_id = ? AND active = 1`
    ).bind(officeId).first();
    const limitFail = await requireLimit(env, officeId, 'max_users', counts?.c || 0, { excludeAdmins: counts?.admins || 0 });
    if (limitFail) return limitFail;
  }

  await env.DB.prepare(
    `UPDATE users SET role = ?, scope = ?, custom_role_id = ?, active = ?, full_name = ? WHERE id = ? AND office_id = ?`
  ).bind(role, scope, customRoleId, active, fullName, id, officeId).run();
  clearAccessCache(id);

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'user', entity_id: id, request,
    metadata: { from: { role: user.role, scope: user.scope, active: user.active }, to: { role, scope, active } },
  });
  return ok(env, { updated: true });
}

async function resetPassword({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b || !isStr(b.password, 200) || b.password.length < 8) return fail(env, 'كلمة السر لازم 8 حروف على الأقل', 400);
  const user = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND office_id = ?`).bind(id, officeId).first();
  if (!user) return fail(env, 'العضو مش موجود', 404);
  const { hash, salt } = await hashPassword(b.password);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, salt = ?, failed_logins = 0, locked_until = NULL WHERE id = ? AND office_id = ?`
  ).bind(hash, salt, id, officeId).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'reset_password', entity: 'user', entity_id: id, request });
  return ok(env, { updated: true });
}

// ============================================================
// الأدوار المخصصة (الباقة المتقدمة)
// ============================================================
async function requireCustomRoles(env, officeId) {
  const plan = await planOf(env, officeId);
  if (!planAccess(plan).customRoles) {
    return fail(env, 'الأدوار المخصصة متاحة في الباقة المتقدمة', 403, { code: 'UPGRADE_REQUIRED', feature: 'custom_roles', required_plan: 'plus' });
  }
  return null;
}

const cleanPerms = list => [...new Set((Array.isArray(list) ? list : [])
  .filter(p => ALL_PERMISSIONS.includes(p) && !p.startsWith('team.') && !p.startsWith('subscription.')))];

async function listRoles({ env, officeId }) {
  const { results } = await env.DB.prepare(`SELECT id, name, permissions FROM office_roles WHERE office_id = ? ORDER BY id`).bind(officeId).all();
  return ok(env, (results || []).map(r => ({ id: r.id, name: r.name, permissions: safeParse(r.permissions) })));
}

async function createRole({ request, env, authUser, officeId }) {
  const gate = await requireCustomRoles(env, officeId);
  if (gate) return gate;
  const b = await safeJson(request);
  const name = String(b?.name || '').trim();
  if (name.length < 2 || name.length > 60) return fail(env, 'اكتب اسم الدور', 400);
  const perms = cleanPerms(b.permissions);
  if (!perms.length) return fail(env, 'اختار صلاحية واحدة على الأقل', 400);
  const r = await env.DB.prepare(`INSERT INTO office_roles (office_id, name, permissions) VALUES (?,?,?)`)
    .bind(officeId, name, JSON.stringify(perms)).run();
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'role', entity_id: r.meta.last_row_id, request, metadata: { name, perms } });
  return ok(env, { id: r.meta.last_row_id }, 201);
}

async function updateRole({ request, env, authUser, officeId, params }) {
  const gate = await requireCustomRoles(env, officeId);
  if (gate) return gate;
  const id = toInt(params[0]);
  const b = await safeJson(request);
  const role = await env.DB.prepare(`SELECT * FROM office_roles WHERE id = ? AND office_id = ?`).bind(id, officeId).first();
  if (!role) return fail(env, 'الدور مش موجود', 404);
  const name = b?.name !== undefined ? String(b.name).trim().slice(0, 60) : role.name;
  const perms = b?.permissions !== undefined ? cleanPerms(b.permissions) : safeParse(role.permissions);
  if (!perms.length) return fail(env, 'اختار صلاحية واحدة على الأقل', 400);
  await env.DB.prepare(`UPDATE office_roles SET name = ?, permissions = ?, updated_at = datetime('now') WHERE id = ? AND office_id = ?`)
    .bind(name, JSON.stringify(perms), id, officeId).run();
  clearAccessCache(); // كل اللي ماسكين الدور ده
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'role', entity_id: id, request, metadata: { name, perms } });
  return ok(env, { updated: true });
}

async function deleteRole({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const used = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users WHERE office_id = ? AND role = 'custom' AND custom_role_id = ?`).bind(officeId, id).first();
  if ((used?.c || 0) > 0) return fail(env, `الدور ده مستخدم مع ${used.c} عضو — غيّر أدوارهم الأول`, 400);
  const r = await env.DB.prepare(`DELETE FROM office_roles WHERE id = ? AND office_id = ?`).bind(id, officeId).run();
  if (!r.meta.changes) return fail(env, 'الدور مش موجود', 404);
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'delete', entity: 'role', entity_id: id });
  return ok(env, { deleted: true });
}

// ============================================================
// فريق القضية
// ============================================================
async function getCaseMembers({ env, access, authUser, officeId, params }) {
  const caseId = toInt(params[0]);
  if (!(await canAccessCase(env, access, authUser, caseId))) return fail(env, 'القضية مش موجودة', 404);
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.full_name, u.role FROM case_members m JOIN users u ON u.id = m.user_id
     WHERE m.case_id = ? AND m.office_id = ? ORDER BY u.full_name`
  ).bind(caseId, officeId).all();
  return ok(env, results || []);
}

async function setCaseMembers({ request, env, access, authUser, officeId, params }) {
  const caseId = toInt(params[0]);
  if (!(await canAccessCase(env, access, authUser, caseId))) return fail(env, 'القضية مش موجودة', 404);
  const c = await env.DB.prepare(`SELECT id FROM cases WHERE id = ? AND office_id = ? AND deleted_at IS NULL`).bind(caseId, officeId).first();
  if (!c) return fail(env, 'القضية مش موجودة', 404);
  const b = await safeJson(request);
  const ids = [...new Set((Array.isArray(b?.user_ids) ? b.user_ids : []).map(toInt).filter(Boolean))].slice(0, 50);
  // نتأكد إن كل الأعضاء من نفس المكتب
  let valid = [];
  if (ids.length) {
    const { results } = await env.DB.prepare(
      `SELECT id FROM users WHERE office_id = ? AND id IN (${ids.map(() => '?').join(',')})`
    ).bind(officeId, ...ids).all();
    valid = (results || []).map(r => r.id);
  }
  // اللي شايف "المكلّف بيها بس" مينفعش يشيل نفسه (كان هيخسر الوصول للقضية)
  if (access.scope === 'assigned' && !valid.includes(authUser.user_id)) valid.push(authUser.user_id);

  const stmts = [env.DB.prepare(`DELETE FROM case_members WHERE case_id = ? AND office_id = ?`).bind(caseId, officeId)];
  for (const uid of valid) {
    stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO case_members (office_id, case_id, user_id) VALUES (?,?,?)`).bind(officeId, caseId, uid));
  }
  await env.DB.batch(stmts);
  await audit(env, { office_id: officeId, user_id: authUser.user_id, action: 'update', entity: 'case_members', entity_id: caseId, request, metadata: { user_ids: valid } });
  return ok(env, { user_ids: valid });
}
