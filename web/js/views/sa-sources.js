// web/js/views/sa-sources.js
// لوحة مسؤول المنصة ← مصادر التسجيل: أنهي إعلان/حملة بيجيب ناس بتستخدم البرنامج وتشترك فعلاً

import { saApiJson } from '../api.js';
import { esc, toast } from '../ui.js';

const ICON = { facebook: '📘', instagram: '📸', messenger: '💬', audience_network: '🌐', google: '🔎', whatsapp: '🟢', tiktok: '🎵', youtube: '▶️', twitter: '𝕏', linkedin: '💼', referral: '🔗', direct: '⌨️', untracked: '❔' };
const PERIODS = [['7', '7 أيام'], ['30', '30 يوم'], ['90', '3 شهور'], ['all', 'الكل']];
let period = '30';

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export async function mountSources(host) {
  host.innerHTML = `
    <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">📊 مصادر التسجيل</h3>
      <div class="fu-chips" id="src-periods" style="margin:0"></div>
    </div>
    <div class="meta" style="margin:4px 0 10px">كل مصدر وحملة جابوا كام تسجيل، وكام منهم <strong>بدأ يستخدم</strong> (ضاف قضية أو موكل)، وكام <strong>اشترك ودفع فعلاً</strong>. الإعلان الشاطر هو اللي بيجيب ناس بتشترك، مش بس بتسجّل.</div>
    <div id="src-body"><div class="skeleton"></div></div>
    <details class="src-help">
      <summary>🔗 إزاي أخلّي إعلاناتي تتسجّل صح؟</summary>
      <div class="meta" style="margin:8px 0">في Meta Ads Manager، في خانة <strong>URL parameters</strong> بتاعة الإعلان (تحت Tracking)، حط السطر ده كما هو. فيسبوك بيملى الأقواس لوحده باسم المنصة (فيسبوك أو إنستجرام) والحملة والإعلان:</div>
      <div class="src-code" id="src-utm">utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}</div>
      <button class="btn btn-ghost btn-sm" data-copy-utm style="margin-top:6px">📋 نسخ</button>
      <div class="meta" style="margin-top:8px">ولو بتحط اللينك بإيدك في بوست أو جروب، استخدم مثلاً: <span class="src-code" style="display:inline-block;padding:2px 8px">${esc(location.origin)}/signup?utm_source=facebook&utm_medium=organic&utm_campaign=lawyers-group</span></div>
      <div class="meta" style="margin-top:6px">حتى من غير اللينكات دي، النظام بيحاول يعرف المصدر من الموقع اللي الزائر جه منه، بس أسماء الحملات والإعلانات مش هتبان.</div>
    </details>`;
  host.querySelector('[data-copy-utm]').addEventListener('click', () => {
    navigator.clipboard.writeText(host.querySelector('#src-utm').textContent).then(() => toast('اتنسخ ✓', 'ok')).catch(() => toast('انسخه بإيدك', 'bad'));
  });
  drawPeriods(host);
  await load(host);
}

function drawPeriods(host) {
  const el = host.querySelector('#src-periods');
  el.innerHTML = PERIODS.map(([k, l]) => `<button class="fu-chip ${period === k ? 'active' : ''}" data-period="${k}">${l}</button>`).join('');
  el.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => { period = b.dataset.period; drawPeriods(host); load(host); }));
}

async function load(host) {
  const body = host.querySelector('#src-body');
  body.innerHTML = '<div class="skeleton"></div>';
  let d;
  try { d = await saApiJson('/api/superadmin/signup-sources?days=' + period); }
  catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!d.total) { body.innerHTML = '<div class="empty">مفيش تسجيلات في الفترة دي</div>'; return; }
  const max = Math.max(...d.by_source.map(r => r.signups));
  const row = (r, name) => `<tr>
      <td>${name}</td>
      <td class="mono"><div class="src-bar"><span style="width:${pct(r.signups, max)}%"></span></div>${r.signups}</td>
      <td class="mono">${r.started} <span class="meta">(${pct(r.started, r.signups)}%)</span></td>
      <td class="mono"><strong>${r.paid}</strong> <span class="meta">(${pct(r.paid, r.signups)}%)</span></td>
    </tr>`;
  body.innerHTML = `
    <div class="st-table-wrap"><table class="st-table src-table">
      <thead><tr><th>المصدر</th><th>سجّلوا</th><th>بدأوا يستخدموا</th><th>اشتركوا</th></tr></thead>
      <tbody>${d.by_source.map(r => row(r, `${ICON[r.source] || '•'} ${esc(r.label)}`)).join('')}</tbody>
      <tfoot><tr><td>الإجمالي</td><td class="mono">${d.total}</td><td class="mono">${d.by_source.reduce((s, r) => s + r.started, 0)}</td><td class="mono">${d.by_source.reduce((s, r) => s + r.paid, 0)}</td></tr></tfoot>
    </table></div>
    ${d.by_campaign.length ? `
      <h4 style="margin:16px 0 6px">الحملات والإعلانات</h4>
      <div class="st-table-wrap"><table class="st-table src-table">
        <thead><tr><th>الحملة / الإعلان</th><th>سجّلوا</th><th>بدأوا يستخدموا</th><th>اشتركوا</th></tr></thead>
        <tbody>${d.by_campaign.map(r => row(r, `${ICON[r.source] || '•'} <strong>${esc(r.campaign || '—')}</strong>${r.content ? `<div class="meta" style="margin:0">${esc(r.content)}</div>` : ''}`)).join('')}</tbody>
      </table></div>` : `<div class="meta" style="margin-top:10px">لسه مفيش تسجيلات جاية من لينكات فيها اسم حملة. ظبط لينكات الإعلانات من الشرح اللي تحت، والحملات هتبان هنا.</div>`}`;
}
