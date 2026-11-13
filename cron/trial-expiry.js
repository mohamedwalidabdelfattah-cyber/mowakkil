// cron/trial-expiry.js
// يتنادى من worker/index.js لما request.url يجي بـ /__cron/trial-expiry

import { audit } from '../worker/lib/audit.js';

/**
 * المهمة:
 * 1) تفحص المكاتب اللي trial_ends_at خلص
 * 2) تحوّلهم من 'trial' لـ 'suspended'
 * 3) تسجّل cron run
 * 4) ترجّع stats
 */
export async function runTrialExpiry(env) {
  const startedAt = new Date().toISOString();
  let runId = null;
  let processed = 0;
  let failed = 0;

  try {
    const ins = await env.DB.prepare(
      `INSERT INTO cron_runs (job, started_at) VALUES ('trial-expiry', datetime('now'))`
    ).run();
    runId = ins.meta.last_row_id;
  } catch (e) {
    console.error('cron_runs insert failed', e);
  }

  try {
    // المكاتب اللي لسه trial و وقتها خلص
    const { results } = await env.DB.prepare(
      `SELECT id, name, trial_ends_at
       FROM offices
       WHERE status = 'trial'
         AND trial_ends_at IS NOT NULL
         AND datetime(trial_ends_at) < datetime('now')`
    ).all();

    for (const office of results) {
      try {
        await env.DB.prepare(
          `UPDATE offices
             SET status = 'suspended',
                 suspended_reason = 'انتهت التجربة المجانية'
           WHERE id = ? AND status = 'trial'`
        ).bind(office.id).run();

        // سجّل الحدث
        const fakeRequest = {
          headers: {
            get: (k) => (k === 'cf-connecting-ip' ? 'cron' : k === 'user-agent' ? 'cron: trial-expiry' : null),
          },
        };
        await audit(env, {
          office_id: office.id,
          action: 'trial_expired',
          entity: 'office',
          entity_id: office.id,
          metadata: { trial_ends_at: office.trial_ends_at },
          request: fakeRequest,
        });

        processed++;
      } catch (e) {
        console.error('trial expiry failed for office', office.id, e);
        failed++;
      }
    }
  } catch (e) {
    console.error('cron trial-expiry failed', e);
    failed++;
  }

  try {
    if (runId) {
      await env.DB.prepare(
        `UPDATE cron_runs
           SET finished_at = datetime('now'), processed = ?, failed = ?
         WHERE id = ?`
      ).bind(processed, failed, runId).run();
    }
  } catch {}

  return {
    job: 'trial-expiry',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    processed,
    failed,
  };
}