// web/js/ai-usage.js
// عدّاد رصيد الذكاء الاصطناعي (الشهري حسب الباقة) + نافذة "الرصيد خلص"
import { apiJson } from './api.js';
import { esc } from './ui.js';
import { dateLocale, fmtDay } from './country.js';

const AI_PATH = /^\/api\/(chat|legal-search|generate-doc|analyze\/(contract|case|document)|cases\/\d+\/analyze)$/;
export function isAiPath(path) {
  return AI_PATH.test(String(path || '').split('?')[0]);
}

let _usage = null;
let _pending = null;
export async function getAiUsage(force = false) {
  if (_usage && !force) return _usage;
  if (_pending) return _pending;
  _pending = apiJson('/api/ai/usage', { skipCache: true })
    .then(u => (_usage = u))
    .catch(() => _usage)
    .finally(() => { _pending = null; });
  return _pending;
}

// بعد أي طلب ذكاء اصطناعي ناجح (api.js بيبعت الحدث)
export function notifyAiUsed() {
  if (_usage) { _usage = { ..._usage, used_month: _usage.used_month + 1, used_today: _usage.used_today + 1, remaining: Math.max(0, _usage.remaining - 1) }; }
  window.dispatchEvent(new CustomEvent('ai-usage-changed'));
}

function fmtReset(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }); }
  catch { return d; }
}

function meterHTML(u, compact) {
  if (!u || !u.monthly_limit) return '';
  const pct = Math.min(100, Math.round((u.used_month / u.monthly_limit) * 100));
  const tone = u.remaining === 0 ? 'out' : pct >= 80 ? 'low' : '';
  const label = u.trial ? 'رصيد التجربة' : 'رصيد الشهر';
  return `
    <div class="ai-meter ${tone} ${compact ? 'compact' : ''}" role="status" aria-live="polite"
         title="${esc(`اتستخدم ${u.used_month} من ${u.monthly_limit}${u.trial ? '' : ` · بيتجدد ${fmtReset(u.resets_at)}`}`)}">
      <span class="ai-meter-ic" aria-hidden="true">🤖</span>
      <span class="ai-meter-txt">${label}: <strong>${u.remaining}</strong> من ${u.monthly_limit}</span>
      <span class="ai-meter-bar" aria-hidden="true"><span style="width:${100 - pct}%"></span></span>
      ${compact ? '' : `<span class="ai-meter-sub">${u.trial ? 'خلال الفترة التجريبية' : `بيتجدد ${esc(fmtReset(u.resets_at))}`}</span>`}
    </div>`;
}

// يحط العدّاد جوه العنصر ويحدّثه لوحده بعد كل استخدام
export async function mountAiMeter(el, { compact = false } = {}) {
  if (!el) return;
  const draw = (u) => { if (el.isConnected) el.innerHTML = meterHTML(u, compact); };
  draw(await getAiUsage());
  const onChange = () => {
    if (!el.isConnected) { window.removeEventListener('ai-usage-changed', onChange); return; }
    draw(_usage);
    // نتأكد من السيرفر بعد شوية (لو الطلب ما اتحسبش مثلاً)
    clearTimeout(el._aiT);
    el._aiT = setTimeout(() => getAiUsage(true).then(draw), 1500);
  };
  window.addEventListener('ai-usage-changed', onChange);
}

// نافذة لما الرصيد يخلص
export function showAiLimitModal(body = {}) {
  _usage = body.monthly_limit ? { ..._usage, ...body, remaining: 0 } : _usage;
  window.dispatchEvent(new CustomEvent('ai-usage-changed'));
  document.getElementById('ai-limit-modal')?.remove();
  const daily = body.code === 'AI_DAILY_LIMIT';
  const m = document.createElement('div');
  m.id = 'ai-limit-modal';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal-card upgrade-modal-card" role="dialog" aria-modal="true" aria-labelledby="ai-limit-title">
      <div class="upgrade-icon">🤖</div>
      <h3 class="upgrade-title" id="ai-limit-title">${daily ? 'وصلت للحد اليومي' : 'رصيد الذكاء الاصطناعي خلص'}</h3>
      <p class="upgrade-sub" style="line-height:1.9">
        ${daily
          ? `استخدمت ${esc(body.daily_limit)} طلب النهارده. الرصيد بيرجع بكرة.`
          : body.trial
            ? `استخدمت الـ ${esc(body.monthly_limit)} طلب المتاحين في الفترة التجريبية. اشترك عشان الرصيد يزيد.`
            : `استخدمت ${esc(body.monthly_limit)} طلب الشهر ده. الرصيد بيتجدد ${esc(fmtReset(body.resets_at))}، أو تقدر ترقّي باقتك لرصيد أكبر.`}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px">
        ${daily ? '' : `<a class="btn btn-primary" href="/pricing" target="_blank" rel="noopener">💎 شوف الباقات</a>`}
        <button class="btn btn-ghost" data-close>تمام</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
}
