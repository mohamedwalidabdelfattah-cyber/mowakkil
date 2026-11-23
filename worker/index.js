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

    if (hit.route.adminOnly && authUser.role !== 'admin') {
      return fail(env, 'غير مصرح — للمسؤول فقط', 403, {}, request);
    }

    return await hit.route.handler({
      request, env, url, path, method,
      params: hit.params,
      authUser,
      userId: authUser.user_id,
      officeId,
    });
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

    ctx.waitUntil(runTrialExpiry(env));
    ctx.waitUntil(runNotificationJobs(env));
  },
};
