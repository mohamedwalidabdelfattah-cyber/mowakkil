// worker/lib/permissions.js
// نظام الصلاحيات: أدوار جاهزة + أدوار مخصصة، ومتربطة بالباقات.
//
// الصلاحية = "قسم.إجراء" (مثلاً cases.delete). السيرفر بيتحقق منها في كل طلب (index.js)
// والواجهة بتخفي اللي مش مسموح (web/js/access.js) — بس الحماية الحقيقية هنا.

// ---------------- كتالوج الصلاحيات (للواجهة: محرر الأدوار المخصصة) ----------------
export const CATALOG = [
  { module: 'cases',        label: 'القضايا',            actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'clients',      label: 'الموكلين',           actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'agenda',       label: 'الأجندة والجلسات',   actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'tasks',        label: 'المهام',             actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'documents',    label: 'المستندات',          actions: ['view', 'create', 'delete'] },
  { module: 'fees',         label: 'الأتعاب والتحصيل',   actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'invoices',     label: 'الفواتير',           actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'expenses',     label: 'المصروفات',          actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'accounting',   label: 'المحاسبة والقيود',   actions: ['view', 'edit'] },
  { module: 'reports',      label: 'التقارير',           actions: ['view'] },
  { module: 'ai',           label: 'الذكاء الاصطناعي',   actions: ['use'] },
  { module: 'portal',       label: 'بوابة الموكل (دعوات)', actions: ['manage'] },
  { module: 'lawyers',      label: 'المحامين (بيانات الموظفين)', actions: ['view', 'manage'] },
  { module: 'export',       label: 'التصدير والطباعة',   actions: ['use'] },
  { module: 'settings',     label: 'إعدادات المكتب',     actions: ['manage'] },
  { module: 'team',         label: 'الفريق والصلاحيات',  actions: ['manage'] },
  { module: 'subscription', label: 'الاشتراك والدفع',    actions: ['manage'] },
];
export const ACTION_LABELS = { view: 'عرض', create: 'إضافة', edit: 'تعديل', delete: 'حذف', use: 'استخدام', manage: 'إدارة' };
export const ALL_PERMISSIONS = CATALOG.flatMap(m => m.actions.map(a => `${m.module}.${a}`));

const all = mod => CATALOG.find(m => m.module === mod).actions.map(a => `${mod}.${a}`);

// ---------------- الأدوار الجاهزة ----------------
export const ROLES = {
  admin: {
    label: 'مالك المكتب', icon: '👑',
    description: 'كل الصلاحيات، بما فيها الفريق والاشتراك.',
    permissions: ALL_PERMISSIONS,
  },
  partner: {
    label: 'شريك', icon: '🤝',
    description: 'كل حاجة ماعدا إدارة الفريق والاشتراك.',
    permissions: ALL_PERMISSIONS.filter(p => !p.startsWith('team.') && !p.startsWith('subscription.')),
  },
  lawyer: {
    label: 'محامي', icon: '⚖️',
    description: 'القضايا والموكلين والجلسات والمهام والمستندات والذكاء الاصطناعي — من غير الحسابات ولا حذف القضايا والموكلين.',
    permissions: [
      'cases.view', 'cases.create', 'cases.edit',
      'clients.view', 'clients.create', 'clients.edit',
      ...all('agenda'), ...all('tasks'),
      'documents.view', 'documents.create',
      'ai.use', 'portal.manage', 'lawyers.view', 'export.use',
    ],
  },
  secretary: {
    label: 'سكرتير', icon: '📋',
    description: 'الموكلين والجلسات والمهام ورفع المستندات — من غير الحسابات ولا الحذف.',
    permissions: [
      'cases.view', 'clients.view', 'clients.create', 'clients.edit',
      'agenda.view', 'agenda.create', 'agenda.edit',
      'tasks.view', 'tasks.create', 'tasks.edit',
      'documents.view', 'documents.create', 'portal.manage', 'lawyers.view',
    ],
  },
  accountant: {
    label: 'محاسب', icon: '💰',
    description: 'الأتعاب والفواتير والمصروفات والمحاسبة والتقارير — والقضايا والموكلين عرض بس.',
    permissions: [
      ...all('fees'), ...all('invoices'), ...all('expenses'), ...all('accounting'), 'reports.view',
      'cases.view', 'clients.view', 'lawyers.view', 'export.use',
    ],
  },
  trainee: {
    label: 'متدرب', icon: '🎓',
    description: 'يشوف القضايا المكلّف بيها بس، ويسجّل نتيجة الجلسة ويحدّث المهام.',
    permissions: ['cases.view', 'clients.view', 'agenda.view', 'agenda.create', 'agenda.edit', 'tasks.view', 'tasks.edit', 'documents.view'],
    forceAssigned: true,
  },
};

// ---------------- ربط الأدوار بالباقات ----------------
const PLAN_ACCESS = {
  starter:        { roles: ['admin', 'lawyer', 'secretary'], assignedScope: false, customRoles: false },
  lifetime_basic: { roles: ['admin', 'lawyer', 'secretary'], assignedScope: false, customRoles: false },
  pro:            { roles: Object.keys(ROLES), assignedScope: true, customRoles: false },
  lifetime_pro:   { roles: Object.keys(ROLES), assignedScope: true, customRoles: false },
  plus:           { roles: Object.keys(ROLES), assignedScope: true, customRoles: true },
};
export function planAccess(plan) {
  return PLAN_ACCESS[plan] || PLAN_ACCESS.starter;
}

// ---------------- الصلاحيات الفعلية لمستخدم ----------------
const cache = new Map(); // userId → { exp, value }

/**
 * @returns {{ role, roleLabel, permissions: Set<string>, scope: 'all'|'assigned', plan, downgraded: boolean }}
 */
export async function getAccess(env, authUser) {
  const hit = cache.get(authUser.user_id);
  if (hit && hit.exp > Date.now()) return hit.value;

  let row = null;
  try {
    row = await env.DB.prepare(
      `SELECT u.role, u.scope, u.custom_role_id, r.name AS custom_name, r.permissions AS custom_perms, s.plan
       FROM users u
       LEFT JOIN office_roles r ON r.id = u.custom_role_id AND r.office_id = u.office_id
       LEFT JOIN subscriptions s ON s.office_id = u.office_id
       WHERE u.id = ? AND u.office_id = ?`
    ).bind(authUser.user_id, authUser.office_id).first();
  } catch (e) {
    // الأعمدة الجديدة لسه مش موجودة (migration 028) → السلوك القديم: admin كل حاجة، غيره محامي
    console.warn('access lookup failed:', e.message);
  }

  const plan = row?.plan || 'starter';
  const pa = planAccess(plan);
  let role = row?.role || authUser.role || 'lawyer';
  let permissions;
  let roleLabel;
  let downgraded = false;

  if (role === 'custom') {
    if (pa.customRoles && row?.custom_perms) {
      let list = [];
      try { list = JSON.parse(row.custom_perms); } catch {}
      // ممنوع دور مخصص ياخد إدارة الفريق أو الاشتراك (دول للمالك بس)
      permissions = new Set(list.filter(p => ALL_PERMISSIONS.includes(p) && !p.startsWith('team.') && !p.startsWith('subscription.')));
      roleLabel = row.custom_name || 'دور مخصص';
    } else {
      downgraded = true; role = 'lawyer';
    }
  }
  if (!permissions) {
    if (!ROLES[role]) role = 'lawyer';
    // الباقة نزلت والدور مبقاش متاح → صلاحيات محامي (والمالك دايماً مالك)
    if (role !== 'admin' && !pa.roles.includes(role)) { downgraded = true; role = 'lawyer'; }
    permissions = new Set(ROLES[role].permissions);
    roleLabel = ROLES[role].label;
  }

  let scope = row?.scope === 'assigned' ? 'assigned' : 'all';
  if (ROLES[role]?.forceAssigned) scope = 'assigned';
  if (role === 'admin' || !pa.assignedScope) scope = role === 'trainee' ? 'assigned' : 'all';

  const value = { role, roleLabel, permissions, scope, plan, downgraded };
  if (cache.size > 1000) cache.clear();
  cache.set(authUser.user_id, { exp: Date.now() + 20_000, value });
  return value;
}

export function clearAccessCache(userId) {
  if (userId) cache.delete(userId); else cache.clear();
}

export const can = (access, perm) => !!access?.permissions?.has(perm);

// ---------------- صلاحية كل طلب API ----------------
// [نمط المسار, { METHOD: صلاحية }] — '*' لأي method. null = مفيش فحص (متاح لأي مستخدم مسجّل).
const METHOD_ACTION = { GET: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };
const crud = mod => m => `${mod}.${METHOD_ACTION[m] || 'view'}`;

const RULES = [
  // الذكاء الاصطناعي
  [/^\/api\/cases\/\d+\/analyze$/, () => 'ai.use'],
  [/^\/api\/cases\/\d+\/analyses$/, () => 'cases.view'],
  [/^\/api\/analyze\//, () => 'ai.use'],
  [/^\/api\/chat/, () => 'ai.use'],
  [/^\/api\/generate-doc(\/refine)?$/, () => 'ai.use'],
  [/^\/api\/legal-search$/, () => 'ai.use'],
  // فريق القضية
  [/^\/api\/cases\/\d+\/members$/, m => (m === 'GET' ? 'cases.view' : 'cases.edit')],
  [/^\/api\/cases/, crud('cases')],
  // بوابة الموكل
  [/^\/api\/clients\/(invite|cancel-invite|toggle-active|resend-invite|delete-account)$/, () => 'portal.manage'],
  [/^\/api\/clients/, crud('clients')],
  // الأجندة
  [/^\/api\/agenda/, () => 'agenda.view'],
  [/^\/api\/calendar\//, crud('agenda')],
  [/^\/api\/sessions/, crud('agenda')],
  [/^\/api\/session-expenses/, crud('expenses')],
  // المهام
  [/^\/api\/tasks\/\d+\/done$/, () => 'tasks.edit'],
  [/^\/api\/tasks\/\d+\/expense$/, () => 'expenses.create'],
  [/^\/api\/task-expenses/, () => 'expenses.delete'],
  [/^\/api\/tasks/, crud('tasks')],
  // المستندات (تعديل التصنيف/الملاحظة = نفس صلاحية الرفع)
  [/^\/api\/documents/, m => (m === 'GET' ? 'documents.view' : m === 'DELETE' ? 'documents.delete' : 'documents.create')],
  // الماليات
  [/^\/api\/(fees|payments)/, crud('fees')],
  [/^\/api\/invoices/, crud('invoices')],
  [/^\/api\/expenses/, crud('expenses')],
  [/^\/api\/(accounts|journal)/, m => (m === 'GET' ? 'accounting.view' : 'accounting.edit')],
  [/^\/api\/reports\/(monthly|monthly-trend)$/, () => 'reports.view'],
  [/^\/api\/reports\//, () => 'accounting.view'],
  // المحامين (بيانات الموظفين)
  [/^\/api\/lawyers/, m => (m === 'GET' ? 'lawyers.view' : 'lawyers.manage')],
  // الإدارة
  [/^\/api\/team\/me$/, () => null],
  [/^\/api\/team\/directory$/, () => 'cases.view'], // أسماء الفريق لاختيار فريق القضية
  [/^\/api\/team/, () => 'team.manage'],
  [/^\/api\/auth\/users$/, () => 'team.manage'],
  [/^\/api\/office$/, m => (m === 'GET' ? null : 'settings.manage')],
  [/^\/api\/settings\/ai-privacy$/, m => (m === 'GET' ? null : 'settings.manage')],
  [/^\/api\/settings$/, m => (m === 'GET' ? null : 'settings.manage')],
  [/^\/api\/subscription\/change$/, () => 'subscription.manage'],
  [/^\/api\/payment-requests$/, m => (m === 'POST' ? 'subscription.manage' : null)],
];

/** الصلاحية المطلوبة لطلب، أو null لو متاح لأي مستخدم مسجّل (لوحة التحكم، الإشعارات، حسابي...). */
export function permissionFor(method, path) {
  for (const [re, fn] of RULES) if (re.test(path)) return fn(method);
  return null;
}

// ---------------- "القضايا المكلّف بيها بس" ----------------
/** شرط SQL يتضاف على أي استعلام فيه عمود case id. */
export function caseScope(access, authUser, column = 'c.id') {
  if (access?.scope !== 'assigned') return { sql: '', binds: [] };
  return {
    sql: ` AND ${column} IN (SELECT case_id FROM case_members WHERE user_id = ? AND office_id = ?)`,
    binds: [authUser.user_id, authUser.office_id],
  };
}

/** هل المستخدم يقدر يوصل للقضية دي؟ (للمسارات اللي بتاخد case id) */
export async function canAccessCase(env, access, authUser, caseId) {
  if (access?.scope !== 'assigned' || !caseId) return true;
  const r = await env.DB.prepare(
    `SELECT 1 FROM case_members WHERE case_id = ? AND user_id = ? AND office_id = ?`
  ).bind(caseId, authUser.user_id, authUser.office_id).first();
  return !!r;
}

/** للواجهة: الأدوار المتاحة في الباقة */
export function rolesForPlan(plan) {
  const pa = planAccess(plan);
  return Object.entries(ROLES).map(([id, r]) => ({
    id, label: r.label, icon: r.icon, description: r.description,
    available: id === 'admin' || pa.roles.includes(id),
    forceAssigned: !!r.forceAssigned,
  }));
}
