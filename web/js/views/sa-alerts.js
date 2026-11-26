// web/js/views/sa-alerts.js
// تاب «🚨 التنبيهات» في لوحة السوبر أدمن: قنوات التنبيه + آخر التنبيهات + زرار تنبيه تجريبي.
import { saApiJson } from '../api.js';
import { esc, toast } from '../ui.js';

const fmt = iso => { try { return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

export async function mountAlerts(host) {
  host.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  let d;
  try { d = await saApiJson('/api/superadmin/alerts'); }
  catch (e) { host.innerHTML = `<div class="empty">تعذر تحميل التنبيهات: ${esc(e.message)}</div>`; return; }
  const ch = d.channels || {};
  const anyCh = ch.telegram || ch.ntfy;
  const list = d.alerts || [];
  host.innerHTML = `
    <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <h3 style="margin:0">🚨 تنبيهات النظام</h3>
      <button class="btn btn-ghost" data-act="test" ${anyCh ? '' : 'disabled'}>📨 ابعت تنبيه تجريبي</button>
    </div>
    <p class="meta" style="line-height:1.8;margin:6px 0 14px">
      النظام بيبعتلك تنبيه لوحده لو: <b>قاعدة البيانات وقفت</b> (زي ما الحصة اليومية تخلص)، أو <b>الأخطاء زادت فجأة</b>، أو <b>الذكاء الاصطناعي فشل في كل النماذج</b>.
      وفيه فحص أوتوماتيك كل نص ساعة. التنبيه مفيهوش أي بيانات موكلين.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <span class="badge ${ch.telegram ? 'badge-success' : ''}" style="padding:6px 12px">${ch.telegram ? '✅' : '⚪'} Telegram</span>
      <span class="badge ${ch.ntfy ? 'badge-success' : ''}" style="padding:6px 12px">${ch.ntfy ? '✅' : '⚪'} ntfy</span>
    </div>
    ${anyCh ? '' : `<div class="card" style="background:var(--c-warning-bg);border-color:var(--c-warning-bd);margin-bottom:16px;line-height:1.8">
      ⚠️ <b>مفيش قناة تنبيهات متظبطة</b> — التنبيهات بتتسجل هنا بس. عشان توصلك على الموبايل ظبّط Telegram أو ntfy (الخطوات في ملف التسجيل، قسم التنبيهات).
    </div>`}
    <h4 style="margin:0 0 8px">آخر التنبيهات</h4>
    ${list.length ? list.map(a => `
      <div class="item" style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <strong>${esc(a.title)}</strong>
          <span class="meta">${esc(fmt(a.at))}</span>
        </div>
        ${a.body ? `<div class="meta" style="margin-top:4px;line-height:1.7">${esc(a.body)}</div>` : ''}
        <div class="meta" style="margin-top:4px;font-size:12px">
          ${a.sent?.length ? `اتبعت على: ${esc(a.sent.join('، '))}` : 'مااتبعتش لأي قناة'}${a.failed?.length ? ` · فشل: ${esc(a.failed.join('، '))}` : ''}
        </div>
      </div>`).join('') : '<div class="empty">مفيش تنبيهات — كله تمام ✅</div>'}`;
  host.querySelector('[data-act="test"]')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const r = await saApiJson('/api/superadmin/alerts/test', { method: 'POST' });
      toast(`اتبعت على: ${(r.sent || []).join('، ')}`, 'ok');
      mountAlerts(host);
    } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
  });
}
