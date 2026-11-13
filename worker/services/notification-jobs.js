// worker/services/notification-jobs.js
// مهام التذكيرات التلقائية + فحص الحدود

import { createNotification } from '../routes/notifications.js';
import { getLimits, getUsage } from '../middleware/feature-gate.js';

// ============================================================
// تذكيرات الجلسات القادمة (قبل 24 ساعة)
// ============================================================
export async function checkUpcomingSessions(env) {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { results: sessions } = await env.DB.prepare(
      `SELECT s.id, s.session_date, s.notes,
              c.id as case_id, c.case_number, c.court,
              cl.name as client_name,
              c.office_id
       FROM sessions s
       JOIN cases c ON c.id = s.case_id
       LEFT JOIN clients cl ON cl.id = c.client_id
       WHERE c.office_id IS NOT NULL
         AND c.deleted_at IS NULL
         AND date(s.session_date) = date(?)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.reference_type = 'session'
             AND n.reference_id = s.id
             AND n.type = 'session_reminder'
         )`
    ).bind(tomorrow.toISOString().slice(0, 10)).all();

    for (const s of (sessions || [])) {
      await createNotification(env, {
        officeId: s.office_id,
        type: 'session_reminder',
        title: `⚖️ جلسة غدًا — ${s.client_name || 'موكل'}`,
        body: `قضية ${s.case_number || '—'} · ${s.court || ''}\n${s.notes || ''}`,
        link: `#case-${s.case_id}`,
        icon: '⚖️',
        priority: 'high',
        referenceType: 'session',
        referenceId: s.id,
        dueAt: s.session_date,
      });
    }

    return sessions?.length || 0;
  } catch (e) {
    console.error('checkUpcomingSessions failed:', e.message);
    return 0;
  }
}

// ============================================================
// تذكيرات المهام المستحقة (اليوم)
// ============================================================
export async function checkDueTasks(env) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { results: tasks } = await env.DB.prepare(
      `SELECT t.id, t.title, t.due_date, t.office_id,
              l.name as lawyer_name
       FROM tasks t
       LEFT JOIN lawyers l ON l.id = t.lawyer_id
       WHERE t.status = 'مفتوحة'
         AND date(t.due_date) = date(?)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.reference_type = 'task'
             AND n.reference_id = t.id
             AND n.type = 'task_due'
         )`
    ).bind(today).all();

    for (const t of (tasks || [])) {
      await createNotification(env, {
        officeId: t.office_id,
        type: 'task_due',
        title: `✅ مهمة مستحقة اليوم`,
        body: `${t.title}${t.lawyer_name ? '\n👤 ' + t.lawyer_name : ''}`,
        link: `#task-${t.id}`,
        icon: '✅',
        priority: 'high',
        referenceType: 'task',
        referenceId: t.id,
        dueAt: t.due_date,
      });
    }

    return tasks?.length || 0;
  } catch (e) {
    console.error('checkDueTasks failed:', e.message);
    return 0;
  }
}

// ============================================================
// تذكيرات الأتعاب المتأخرة
// ============================================================
export async function checkOverdueFees(env) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { results: fees } = await env.DB.prepare(
      `SELECT f.id, f.amount_due, f.amount_paid, f.due_date, f.office_id,
              cl.name as client_name, c.case_number
       FROM fees f
       LEFT JOIN clients cl ON cl.id = f.client_id
       LEFT JOIN cases c ON c.id = f.case_id
       WHERE f.status != 'مدفوع بالكامل'
         AND f.due_date < ?
         AND (julianday(?) - julianday(f.due_date)) >= 7
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.reference_type = 'fee'
             AND n.reference_id = f.id
             AND n.type = 'fee_overdue'
             AND date(n.created_at) >= date('now', '-7 days')
         )`
    ).bind(today, today).all();

    for (const f of (fees || [])) {
      const remaining = (f.amount_due || 0) - (f.amount_paid || 0);
      await createNotification(env, {
        officeId: f.office_id,
        type: 'fee_overdue',
        title: `💰 أتعاب متأخرة — ${f.client_name || 'موكل'}`,
        body: `متبقي: ${remaining.toLocaleString('ar-EG')} ج\n${f.case_number ? '📁 قضية ' + f.case_number : ''}`,
        link: '#fees',
        icon: '💰',
        priority: 'urgent',
        referenceType: 'fee',
        referenceId: f.id,
        dueAt: f.due_date,
      });
    }

    return fees?.length || 0;
  } catch (e) {
    console.error('checkOverdueFees failed:', e.message);
    return 0;
  }
}

// ============================================================
// ⚠️ فحص حدود الباقة (80% / 100%)
// ============================================================
export async function checkUsageLimits(env) {
  try {
    const { results: subs } = await env.DB.prepare(
      `SELECT office_id, plan, status
       FROM subscriptions
       WHERE status IN ('trial', 'active')`
    ).all();

    let count = 0;

    for (const sub of (subs || [])) {
      const limits = getLimits(sub.plan);
      const usage = await getUsage(env, sub.office_id);

      const checks = [
        { key: 'users',   used: usage.users,      limit: limits.max_users,      icon: '👥', label: 'المستخدمين' },
        { key: 'cases',   used: usage.cases,      limit: limits.max_cases,      icon: '⚖️', label: 'القضايا' },
        { key: 'clients', used: usage.clients,    limit: limits.max_clients,    icon: '👤', label: 'الموكلين' },
        { key: 'storage', used: usage.storage_mb, limit: limits.max_storage_mb, icon: '💾', label: 'التخزين' },
      ];

      for (const c of checks) {
        if (c.limit === -1) continue;
        const pct = c.used / c.limit;

        // ⛔ 100% — إشعار يومي بدون تكرار
        if (c.used >= c.limit) {
          const exists = await env.DB.prepare(
            `SELECT 1 FROM notifications
             WHERE office_id = ? AND type = 'limit_reached'
               AND reference_type = 'limit' AND reference_id = ?
               AND date(created_at) = date('now')`
          ).bind(sub.office_id, c.key).first();

          if (!exists) {
            await createNotification(env, {
              officeId: sub.office_id,
              type: 'limit_reached',
              title: `⛔ وصلت للحد الأقصى — ${c.label}`,
              body: `${c.used} / ${c.limit} — ترقّي باقتك لزيادة الحد`,
              link: '#subscription',
              icon: '⛔',
              priority: 'urgent',
              referenceType: 'limit',
              referenceId: c.key,
            });
            count++;
          }
        }
        // ⚠️ 80% — تحذير كل 3 أيام
        else if (pct >= 0.8) {
          const exists = await env.DB.prepare(
            `SELECT 1 FROM notifications
             WHERE office_id = ? AND type = 'limit_warning'
               AND reference_type = 'limit' AND reference_id = ?
               AND created_at >= datetime('now', '-3 days')`
          ).bind(sub.office_id, c.key).first();

          if (!exists) {
            await createNotification(env, {
              officeId: sub.office_id,
              type: 'limit_warning',
              title: `⚠️ اقتربت من الحد — ${c.label}`,
              body: `استخدمت ${c.used} من ${c.limit} (${Math.round(pct * 100)}%)`,
              link: '#subscription',
              icon: '⚠️',
              priority: 'high',
              referenceType: 'limit',
              referenceId: c.key,
            });
            count++;
          }
        }
      }
    }

    return count;
  } catch (e) {
    console.error('checkUsageLimits failed:', e.message);
    return 0;
  }
}

// ============================================================
// تشغيل كل المهام
// ============================================================
export async function runNotificationJobs(env) {
  console.log('=== Running notification jobs ===');
  const [sessions, tasks, fees, limits] = await Promise.all([
    checkUpcomingSessions(env),
    checkDueTasks(env),
    checkOverdueFees(env),
    checkUsageLimits(env),
  ]);
  console.log(`✅ Created notifications: sessions=${sessions}, tasks=${tasks}, fees=${fees}, limits=${limits}`);
  return { sessions, tasks, fees, limits };
}