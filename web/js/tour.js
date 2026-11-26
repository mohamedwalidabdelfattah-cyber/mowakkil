// web/js/tour.js
// جولة الشرح التفاعلية: الصفحة بتغمق ونور على الزرار المقصود + سهم بيتحرك + فقاعة شرح.
// - تفاعلي (من أيقونة ❓): المستخدم بيتنقل بـ "التالي / السابق".
// - تلقائي (autoplay): للفيديوهات — بيمشي لوحده، ومؤشر ماوس وهمي بيدوس ويكتب بيانات تجريبية.
// النص مكتوب بالمصري، وطبقة الفصحى (msa.js) بتحوّله لوحدها للمكاتب السعودية.

import { TOURS } from './tours.js';
import { TOURS_MSA } from './tours-msa.js';
import { isSaudi } from './country.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let active = null; // { stop() }

const tourKey = view => (TOURS[view] ? view : String(view || '').replace(/-.*$/, ''));
export function tourFor(view) {
  return TOURS[tourKey(view)] || null;
}
// نص الخطوة: فصحى مكتوبة جاهزة للسعودية (لو عدد الخطوات متطابق)، وإلا المصري
function stepText(view, steps, i) {
  const msa = isSaudi() ? TOURS_MSA[tourKey(view)] : null;
  if (msa && msa.length === steps.length) return { title: msa[i][0], body: msa[i][1], msa: true };
  return { title: steps[i].title || '', body: steps[i].body || '', msa: false };
}
export const isTourRunning = () => !!active;

// ---------- الوصول للعنصر ----------
// el: 'css selector'  أو  { text: 'قضية جديدة', in: 'button', within: '#cases-list' }
function visible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none';
}
function findOnce(spec) {
  if (!spec) return null;
  if (typeof spec === 'string') {
    for (const s of spec.split('||')) {
      const el = [...document.querySelectorAll(s.trim())].find(visible);
      if (el) return el;
    }
    return null;
  }
  const root = spec.within ? document.querySelector(spec.within) : document;
  if (!root) return null;
  const want = Array.isArray(spec.text) ? spec.text : [spec.text];
  return [...root.querySelectorAll(spec.in || 'button, a')]
    .find(e => visible(e) && want.some(t => (e.innerText || e.value || '').replace(/\s+/g, ' ').includes(t))) || null;
}
// النوافذ بتفتح بحركة (تكبير/انزلاق) → نستنى مكان العنصر يثبت قبل ما نرسم النور عليه
async function settle(el, maxMs = 900) {
  let prev = null, same = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await new Promise(r => requestAnimationFrame(r));
    const r = el.getBoundingClientRect();
    const k = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
    same = k === prev ? same + 1 : 0;
    if (same >= 3) return;
    prev = k;
  }
}
async function find(spec, timeout = 1800) {
  const t0 = Date.now();
  for (;;) {
    const el = findOnce(spec);
    if (el || Date.now() - t0 > timeout) return el;
    await sleep(120);
  }
}

// ---------- الرسم ----------
function buildUI() {
  const root = document.createElement('div');
  root.className = 'tour-root';
  root.setAttribute('data-tour-ui', '');
  root.innerHTML = `
    <div class="tour-block"></div>
    <div class="tour-spot"></div>
    <svg class="tour-arrow" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4 L32 46 M14 30 L32 50 L50 30" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="tour-bubble" role="dialog" aria-live="polite">
      <div class="tour-head">
        <span class="tour-count"></span>
        <button class="tour-x" aria-label="إنهاء الشرح">✕</button>
      </div>
      <h4 class="tour-title"></h4>
      <div class="tour-body"></div>
      <div class="tour-nav">
        <button class="tour-prev btn btn-ghost">→ السابق</button>
        <button class="tour-next btn btn-primary">التالي ←</button>
      </div>
      <div class="tour-progress"><i></i></div>
    </div>
    <div class="tour-cursor" hidden><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`;
  document.body.appendChild(root);
  return root;
}

function place(ui, el, step) {
  const spot = ui.querySelector('.tour-spot');
  const arrow = ui.querySelector('.tour-arrow');
  const bubble = ui.querySelector('.tour-bubble');
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8, gap = 18;
  bubble.style.maxWidth = Math.min(380, vw - 24) + 'px';

  if (!el) {
    // خطوة من غير عنصر (مقدمة/خاتمة) → في النص والصفحة كلها غامقة
    ui.classList.add('tour-center');
    spot.style.cssText = `top:${vh / 2}px;left:${vw / 2}px;width:0;height:0`;
    arrow.style.display = 'none';
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    bubble.style.left = Math.max(12, (vw - bw) / 2) + 'px';
    bubble.style.top = Math.max(12, (vh - bh) / 2) + 'px';
    return;
  }
  ui.classList.remove('tour-center');
  const r = el.getBoundingClientRect();
  spot.style.cssText = `top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;

  const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  const below = vh - r.bottom, above = r.top;
  const side = step.place || (below >= bh + 70 ? 'bottom' : above >= bh + 70 ? 'top' : 'bottom');
  let top = side === 'bottom' ? r.bottom + pad + gap + 40 : r.top - pad - gap - 40 - bh;
  top = Math.min(Math.max(12, top), vh - bh - 12);
  let left = r.left + r.width / 2 - bw / 2;
  left = Math.min(Math.max(12, left), vw - bw - 12);
  bubble.style.left = left + 'px';
  bubble.style.top = top + 'px';

  // السهم بين الفقاعة والعنصر، بيشاور عليه
  arrow.style.display = '';
  const ax = r.left + r.width / 2 - 22;
  if (side === 'bottom') {
    arrow.style.top = (r.bottom + pad + 2) + 'px';
    arrow.style.transform = 'rotate(180deg)';
  } else {
    arrow.style.top = (r.top - pad - 46) + 'px';
    arrow.style.transform = 'rotate(0deg)';
  }
  arrow.style.left = Math.min(Math.max(4, ax), vw - 48) + 'px';
}

async function moveCursor(ui, el) {
  const c = ui.querySelector('.tour-cursor');
  c.hidden = false;
  const r = el.getBoundingClientRect();
  c.style.left = (r.left + Math.min(r.width / 2, 40)) + 'px';
  c.style.top = (r.top + r.height / 2) + 'px';
  await sleep(750);
}
async function clickFx(ui) {
  const c = ui.querySelector('.tour-cursor');
  c.classList.remove('tour-click'); void c.offsetWidth; c.classList.add('tour-click');
  await sleep(280);
}
async function typeInto(el, text, perChar = 70) {
  if (typeof text === 'function') text = text();
  el.focus?.();
  if (el.tagName === 'SELECT') {
    const opt = [...el.options].find(o => o.value && (!text || o.text.includes(text))) || [...el.options].find(o => o.value);
    if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
    return;
  }
  if (el.type === 'date') {
    el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  el.value = '';
  for (const ch of String(text)) {
    el.value += ch;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(perChar);
  }
}

/**
 * startTour(view, { autoplay, onDone })
 * autoplay: true → فيديو (بيمشي لوحده + مؤشر + كتابة تجريبية). false → تفاعلي.
 */
export async function startTour(view, { autoplay = false, startAt = 0 } = {}) {
  const tour = tourFor(view);
  if (!tour) return false;
  active?.stop();

  const ui = buildUI();
  if (autoplay) ui.classList.add('tour-autoplay');
  const steps = tour.steps;
  const sa = stepText(view, steps, 0).msa;
  // النص الفصيح مكتوب جاهز → طبقة التحويل التلقائي متلمسهوش
  if (sa) ui.setAttribute('data-no-msa', '');
  const L = { prev: '→ السابق', next: 'التالي ←', done: sa ? 'حسنًا، فهمت ✓' : 'تمام، فهمت ✓' };
  let i = startAt, stopped = false, resolveNav = null;
  const go = d => { if (resolveNav) { const f = resolveNav; resolveNav = null; f(d); } };

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(follow);
    go(0);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    ui.remove();
    try { await tour.cleanup?.(); } catch {}
    active = null;
    document.dispatchEvent(new CustomEvent('mowakkil:tour-ended', { detail: { view, completed: i >= steps.length } }));
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }   // RTL: الشمال = التالي
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
  };
  let curEl = null, curStep = null;
  const onResize = () => place(ui, curEl, curStep || {});
  // لو الصفحة اتحركت (تحميل بيانات، سكرول جوه نافذة) النور والفقاعة بيفضلوا على العنصر
  let lastKey = '';
  const follow = setInterval(() => {
    if (!curEl || !curEl.isConnected) return;
    const r = curEl.getBoundingClientRect();
    const k = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
    if (k !== lastKey) { lastKey = k; place(ui, curEl, curStep || {}); }
  }, 300);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  ui.querySelector('.tour-x').onclick = stop;
  ui.querySelector('.tour-next').onclick = () => go(1);
  ui.querySelector('.tour-prev').onclick = () => go(-1);
  active = { stop };

  while (!stopped && i >= 0 && i < steps.length) {
    const step = steps[i];
    // تحضير (فتح لوحة/نافذة) قبل الخطوة
    if (step.before) { try { await step.before({ autoplay }); } catch {} await sleep(350); }
    if (stopped) break;
    let el = step.el ? await find(step.el) : null;
    if (step.el && !el && step.optional) { i += 1; continue; }
    if (el) {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: autoplay ? 'smooth' : 'auto' });
      await sleep(autoplay ? 400 : 120);
      await settle(el);
    }
    curEl = el; curStep = step;
    ui.querySelector('.tour-count').textContent = `${i + 1} / ${steps.length}`;
    const txt = stepText(view, steps, i);
    ui.querySelector('.tour-title').textContent = txt.title;
    ui.querySelector('.tour-body').innerHTML = txt.body;
    ui.querySelector('.tour-prev').style.visibility = i === 0 ? 'hidden' : '';
    ui.querySelector('.tour-prev').textContent = L.prev;
    ui.querySelector('.tour-next').textContent = i === steps.length - 1 ? L.done : L.next;
    ui.querySelector('.tour-progress i').style.width = `${((i + 1) / steps.length) * 100}%`;
    place(ui, el, step);

    let dir;
    if (autoplay) {
      if (el && (step.type != null || step.click)) {
        await moveCursor(ui, el);
        if (step.type != null) { await clickFx(ui); await typeInto(el, step.type); }
      } else if (el) {
        await moveCursor(ui, el);
      } else {
        ui.querySelector('.tour-cursor').hidden = true;
      }
      // وقت القراءة: حسب طول النص
      const words = `${txt.title} ${txt.body.replace(/<[^>]+>/g, ' ')}`.trim().split(/\s+/).length;
      await sleep(step.hold ?? Math.max(3200, words * 330));
      if (el && step.click) { await clickFx(ui); }
      dir = 1;
    } else {
      dir = await new Promise(res => { resolveNav = res; });
    }
    if (stopped) break;
    // "اضغط هنا" في الخطوة دي بيفتح اللي بعدها (لوحة/نافذة)
    if (dir === 1 && el && step.click) { try { el.click(); } catch {} await sleep(450); }
    if (dir === 1 && step.after) { try { await step.after({ autoplay }); } catch {} await sleep(300); }
    i += dir;
  }
  if (!stopped) { i = steps.length; await stop(); }
  return true;
}

export function stopTour() { active?.stop(); }
