import { cors, fail, json, preflight } from './lib/response.js';
import { getAuthUser } from './lib/auth.js';
import { matchRoute } from './lib/router.js';
import { checkSubscription } from './middleware/subscription.js';

// ---- route modules ----
import * as authRoutes            from './routes/auth.js';
import * as signupRoutes          from './routes/signup.js';
import * as superadminRoutes      from './routes/superadmin.js';
import * as officeRoutes          from './routes/office.js';
import * as clientsRoutes         from './routes/clients.js';
import * as casesRoutes           from './routes/cases.js';
import * as lawyersRoutes         from './routes/lawyers.js';
import * as feesRoutes            from './routes/fees.js';
import * as paymentsRoutes        from './routes/payments.js';
import * as sessionsRoutes        from './routes/sessions.js';
import * as tasksRoutes           from './routes/tasks.js';
import * as documentsRoutes       from './routes/documents.js';
import * as reportsRoutes         from './routes/reports.js';
import * as toolsRoutes           from './routes/tools.js';
import * as accountsRoutes        from './routes/accounts.js';
import * as journalRoutes         from './routes/journal.js';
import * as expensesRoutes        from './routes/expenses.js';
import * as invoicesRoutes        from './routes/invoices.js';
import * as clientPortalRoutes    from './routes/client-portal.js';
import * as subscriptionRoutes    from './routes/subscription.js';
import * as paymentRequestsRoutes from './routes/payment-requests.js';
import * as notificationsRoutes   from './routes/notifications.js';
import * as calendarRoutes        from './routes/calendar.js';
import * as settingsRoutes        from './routes/settings.js';
import * as analyzeRoutes         from './routes/analyze.js';
import * as chatRoutes            from './routes/chat.js';  // ✅ جديد
import * as teamRoutes            from './routes/team.js';
import { getAccess, permissionFor, can, canAccessCase } from './lib/permissions.js';
import { isAiRequest, checkAiQuota, recordAiUse } from './lib/ai-quota.js';

const PUBLIC_ROUTES = [
  ...authRoutes.publicRoutes,
  ...signupRoutes.publicRoutes,
  ...superadminRoutes.publicRoutes,
  ...clientPortalRoutes.publicRoutes,
  ...subscriptionRoutes.publicRoutes,
  ...paymentRequestsRoutes.publicRoutes,
];

const SUPERADMIN_ROUTES = [
  ...superadminRoutes.protectedRoutes,
  ...paymentRequestsRoutes.superadminRoutes,
];

const CLIENT_PORTAL_ROUTES = [
  ...clientPortalRoutes.protectedRoutes,
];

const OFFICE_ROUTES = [
  ...authRoutes.protectedRoutes,
  ...officeRoutes.routes,
  ...clientsRoutes.routes,
  ...casesRoutes.routes,
  ...lawyersRoutes.routes,
  ...feesRoutes.routes,
  ...paymentsRoutes.routes,
  ...sessionsRoutes.routes,
  ...tasksRoutes.routes,
  ...documentsRoutes.routes,
  ...reportsRoutes.routes,
  ...toolsRoutes.routes,
  ...accountsRoutes.routes,
  ...journalRoutes.routes,
  ...expensesRoutes.routes,
  ...invoicesRoutes.routes,
  ...subscriptionRoutes.routes,
  ...paymentRequestsRoutes.officeRoutes,
  ...notificationsRoutes.routes,
  ...calendarRoutes.routes,
  ...settingsRoutes.routes,
  ...analyzeRoutes.routes,
  ...chatRoutes.routes,  // ✅ جديد
  ...teamRoutes.routes,
];

async function handleFetch(request, env) {
  if (request.method === 'OPTIONS') {
    return preflight(env, request);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/' && method === 'GET') {
      return cors(json({ status: 'ok', service: 'mowakkil-api', version: 2 }), env, request);
    }

    const pubHit = matchRoute(PUBLIC_ROUTES, method, path);
    if (pubHit) {
      return await pubHit.route.handler({
        request, env, url, path, method, params: pubHit.params,
      });
    }

    if (path.startsWith('/api/client-portal/')) {
      const hit = matchRoute(CLIENT_PORTAL_ROUTES, method, path);
      if (!hit) return fail(env, 'not found', 404, {}, request);
      return await hit.route.handler({
        request, env, url, path, method, params: hit.params,
      });
    }

    if (path.startsWith('/api/superadmin/')) {
      const sa = await getAuthUser(request, env);
      if (!sa || !sa.super) return fail(env, 'غير مصرح', 403, {}, request);
      const hit = matchRoute(SUPERADMIN_ROUTES, method, path);
      if (hit) {
        return await hit.route.handler({
          request, env, url, path, method, params: hit.params, superAdmin: sa,
        });
      }
      return fail(env, 'not found', 404, {}, request);
    }

    const authUser = await getAuthUser(request, env);
    if (!authUser || authUser.super) return fail(env, 'محتاج تسجيل دخول', 401, {}, request);

    const officeId = authUser.office_id;

    const subFail = await checkSubscription(env, officeId);
    if (subFail) return subFail;

    const hit = matchRoute(OFFICE_ROUTES, method, path);
    if (!hit) return fail(env, 'not found', 404, {}, request);

    // الصلاحيات: كل طلب ليه صلاحية مطلوبة حسب القسم والإجراء (lib/permissions.js)
    const access = await getAccess(env, authUser);
    const perm = permissionFor(method, path);
    if (perm && !can(access, perm)) {
      return fail(env, 'مش عندك صلاحية للإجراء ده — كلّم مالك المكتب', 403,
        { code: 'PERMISSION_DENIED', permission: perm }, request);
    }
    if (!perm && hit.route.adminOnly && access.role !== 'admin') {
      return fail(env, 'غير مصرح — لمالك المكتب فقط', 403, { code: 'PERMISSION_DENIED' }, request);
    }
    // "القضايا المكلّف بيها بس": أي طلب على قضية معيّنة (في المسار أو ?case_id=) لازم تكون من قضاياه
    if (access.scope === 'assigned') {
      const caseId = Number((path.match(/^\/api\/cases\/(\d+)/) || [])[1] || url.searchParams.get('case_id') || 0);
      if (caseId && !(await canAccessCase(env, access, authUser, caseId))) {
        return fail(env, 'القضية مش موجودة', 404, {}, request);
      }
    }

    // رصيد الذكاء الاصطناعي: نتحقق قبل الطلب، ونعدّ بعده لو نجح بس
    const aiReq = isAiRequest(method, path);
    if (aiReq) {
      const quota = await checkAiQuota(env, officeId);
      if (quota) return cors(quota, env, request);
    }

    const res = await hit.route.handler({
      request, env, url, path, method,
      params: hit.params,
      authUser,
      access,
      userId: authUser.user_id,
      officeId,
    });
    if (aiReq && res && res.status < 400) await recordAiUse(env, officeId);
    return res;
  } catch (err) {
    console.error('unhandled error', err);
    return fail(env, 'حصل خطأ في السيرفر، جرب تاني', 500, {}, request);
  }
}

export default {
  async fetch(request, env) {
    return handleFetch(request, env);
  },
  async scheduled(event, env, ctx) {
    const { runTrialExpiry } = await import('../cron/trial-expiry.js');
    const { runNotificationJobs } = await import('./services/notification-jobs.js');

    const { refreshModels } = await import('./services/model-discovery.js');

    ctx.waitUntil(runTrialExpiry(env));
    ctx.waitUntil(runNotificationJobs(env));
    // اكتشاف النماذج المجانية المتاحة النهارده (أسماؤها بتتغير من وقت للتاني)
    ctx.waitUntil(refreshModels(env).catch(e => console.warn('model discovery failed', e.message)));
  },
};
