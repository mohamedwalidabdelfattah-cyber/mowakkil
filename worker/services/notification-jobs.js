// worker/services/notification-jobs.js
// مهام التذكيرات التلقائية + فحص الحدود

import { createNotification, getOfficePrefs } from '../routes/notifications.js';
import { cairoDay } from '../lib/ai-quota.js';
import { getLimits, getUsage } from '../middleware/feature-gate.js';

// ============================================================
// مساعدات التاريخ (توقيت القاهرة)
// ============================================================
function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
function whenLabel(n) {
  return n === 0 ? 'النهارده' : n === 1 ? 'بكرة' : n === 2 ? 'بعد يومين' : `بعد ${n} أيام`;
}
function fmt12(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
}

// ============================================================
// تذكيرات الجلسات القادمة (قبلها بعدد الأيام اللي المكتب اختاره، افتراضي يوم)
// ============================================================
export async function checkUpcomingSessions(env) {
  try {
    const today = cairoDay();
    const { results: sessions } = await env.DB.prepare(
      `SELECT s.id, s.session_date, s.session_time, s.notes,
              c.id as case_id, c.case_number, c.court,
              cl.name as client_name,
              c.office_id
       FROM sessions s
       JOIN cases c ON c.id = s.case_id
       LEFT JOIN clients cl ON cl.id = c.client_id
       WHERE c.office_id IS NOT NULL
         AND c.deleted_at IS NULL
         AND date(s.session_date) BETWEEN date(?) AND date(?)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.reference_type = 'session'
             AND n.reference_id = s.id
             AND n.type = 'session_reminder'
         )`
    ).bind(today, addDays(today, 7)).all();

    let made = 0;
    for (const s of (sessions || [])) {
      const prefs = await getOfficePrefs(env, s.office_id);
      const lead = Math.min(Math.max(Number(prefs.session_reminder_days) || 1, 0), 7);
      const left = daysBetween(today, String(s.session_date).slice(0, 10));
      if (left > lead) continue; // لسه بدري
      const ok = await createNotification(env, {
        officeId: s.office_id,
        type: 'session_reminder',
        title: `جلسة ${whenLabel(left)} — ${s.client_name || 'موكل'}`,
        body: `قضية ${s.case_number || '—'}${s.court ? ' · ' + s.court : ''}${s.session_time ? '\nالساعة ' + fmt12(s.session_time) : ''}${s.notes ? '\n' + s.notes : ''}`,
        link: `#case-${s.case_id}`,
        icon: '⚖️',
        priority: left <= 1 ? 'high' : 'normal',
        referenceType: 'session',
        referenceId: s.id,
        dueAt: s.session_date,
      });
      if (ok) made++;
    }
    return made;
  } catch (e) {
    console.error('checkUpcomingSessions failed:', e.message);
    return 0;
  }
}

// ============================================================
// تذكيرات المهام المستحقة (النهارده)
// ============================================================
export async function checkDueTasks(env) {
  try {
    const today = cairoDay();

    const { results: tasks } = await env.DB.prepare(
      `SELECT t.id, t.title, t.due_date, t.office_id, t.case_id,
              l.name as lawyer_name, c.case_number
       FROM tasks t
       LEFT JOIN lawyers l ON l.id = t.lawyer_id
       LEFT JOIN cases c ON c.id = t.case_id
       WHERE t.status = 'مفتوحة'
         AND date(t.due_date) = date(?)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.reference_type = 'task'
             AND n.reference_id = t.id
             AND n.type = 'task_due'
         )`
    ).bind(today).all();

    let made = 0;
    for (const t of (tasks || [])) {
      const ok = await createNotification(env, {
        officeId: t.office_id,
        type: 'task_due',
        title: `مهمة مستحقة النهارده`,
        body: `${t.title}${t.case_number ? '\n📁 ' + t.case_number : ''}${t.lawyer_name ? '\n👤 ' + t.lawyer_name : ''}`,
        link: `#task-${t.id}`,
        icon: '✅',
        priority: 'high',
        referenceType: 'task',
        referenceId: t.id,
        dueAt: t.due_date,
      });
      if (ok) made++;
    }
    return made;
  } catch (e) {
    console.error('checkDueTasks failed:', e.message);
    return 0;
  }
}

// ============================================================
// تذكيرات مواعيد الأجندة (اجتماع، استشارة، موعد نهائي…)
//   موعد نهائي: قبله بـ 3 أيام + يوم + يومها
//   اجتماع / استشارة / إجراء: قبله بيوم + يومها
//   تذكير / شخصي / أخرى: يومها
// ============================================================
const EVENT_LEADS = { deadline: [3, 1, 0], meeting: [1, 0], consultation: [1, 0], procedure: [1, 0] };
const EVENT_LABELS = { deadline: 'موعد نهائي', meeting: 'اجتماع', consultation: 'استشارة', procedure: 'إجراء', reminder: 'تذكير', personal: 'موعد شخصي', other: 'موعد' };
const EVENT_ICONS = { deadline: '⏰', meeting: '🤝', consultation: '💬', procedure: '📋', reminder: '🔔', personal: '🙂', other: '📌' };

export async function checkAgendaEvents(env) {
  try {
    const today = cairoDay();
    const { results } = await env.DB.prepare(
      `SELECT e.id, e.office_id, e.user_id, e.kind, e.title, e.start_date, e.start_time, e.location,
              c.case_number, cl.name as client_name
       FROM agenda_events e
       LEFT JOIN cases c ON c.id = e.case_id
       LEFT JOIN clients cl ON cl.id = e.client_id
       WHERE e.done = 0 AND e.start_date BETWEEN ? AND ?
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.type = 'event_reminder' AND n.reference_type = 'event'
             AND n.reference_id = e.id AND date(n.created_at) = date('now')
         )`
    ).bind(today, addDays(today, 3)).all();

    let made = 0;
    for (const e of (results || [])) {
      const left = daysBetween(today, e.start_date);
      if (!(EVENT_LEADS[e.kind] || [0]).includes(left)) continue;
      // المواعيد الشخصية لصاحبها بس
      const personal = e.kind === 'personal' || e.kind === 'reminder';
      const ok = await createNotification(env, {
        officeId: e.office_id,
        userId: personal ? e.user_id : null,
        type: 'event_reminder',
        title: `${EVENT_LABELS[e.kind] || 'موعد'} ${whenLabel(left)} — ${e.title}`,
        body: [e.start_time ? 'الساعة ' + fmt12(e.start_time) : '', e.location ? '📍 ' + e.location : '',
          e.case_number ? '📁 ' + e.case_number : '', e.client_name ? '👤 ' + e.client_name : ''].filter(Boolean).join('\n') || null,
        link: '#agenda',
        icon: EVENT_ICONS[e.kind] || '📌',
        priority: e.kind === 'deadline' ? (left <= 1 ? 'urgent' : 'high') : (left === 0 ? 'high' : 'normal'),
        referenceType: 'event',
        referenceId: e.id,
        dueAt: e.start_date,
      });
      if (ok) made++;
    }
    return made;
  } catch (e) {
    console.error('checkAgendaEvents failed:', e.message);
    return 0;
  }
}

// ============================================================
// تذكيرات الأتعاب المتأخرة
// ============================================================
export async function checkOverdueFees(env) {
  try {
    const today = cairoDay();

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
        body: `متبقي: ${remaining.toLocaleString('en-US')} ج\n${f.case_number ? '📁 قضية ' + f.case_number : ''}`,
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
  const [sessions, tasks, fees, limits, events] = await Promise.all([
    checkUpcomingSessions(env),
    checkDueTasks(env),
    checkOverdueFees(env),
    checkUsageLimits(env),
    checkAgendaEvents(env),
  ]);
  console.log(`✅ Created notifications: sessions=${sessions}, tasks=${tasks}, fees=${fees}, limits=${limits}, events=${events}`);
  return { sessions, tasks, fees, limits, events };
}