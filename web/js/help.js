// web/js/help.js
// زرار «شرح» عائم (فوق زرار واتساب الدعم) في كل صفحات النظام: جولة تفاعلية + فيديو اليوتيوب بتاع الصفحة.
// أول مرة المستخدم يفتح الصفحة بيظهرله تلميح صغير (مرة واحدة بس لكل صفحة).

import { startTour, tourFor, isTourRunning } from './tour.js';
import { VIDEOS, CHANNEL } from './tour-videos.js';
import { isSaudi } from './country.js';

// نصوص القايمة والتلميح (مصري / فصحى للسعودية)
const T = () => isSaudi() ? {
  need: 'تحتاج مساعدة؟', tour: 'جولة سريعة في الصفحة', tourSub: 'أسهم تشير إلى كل زر وتشرحه',
  video: 'فيديو الشرح', videoSub: 'دقيقة أو دقيقتان على يوتيوب', channel: 'قناة الشرح على يوتيوب', channelSub: 'جميع فيديوهات شرح النظام', wa: 'تواصل معنا عبر واتساب', waSub: 'سيرد عليك فريق الدعم',
  waMsg: 'أحتاج مساعدة في نظام مُوكِّل', hiTitle: 'أول مرة هنا؟ 👋', hiBody: 'شاهد شرح الصفحة في أقل من دقيقة.', go: 'ابدأ الشرح', later: 'لاحقًا',
} : {
  need: 'محتاج مساعدة؟', tour: 'جولة سريعة في الصفحة', tourSub: 'أسهم بتشاور على كل زرار وتشرحه',
  video: 'فيديو الشرح', videoSub: 'دقيقة أو اتنين على يوتيوب', channel: 'قناة الشرح على يوتيوب', channelSub: 'كل فيديوهات شرح النظام', wa: 'كلّمنا على واتساب', waSub: 'فريق الدعم هيرد عليك',
  waMsg: 'محتاج مساعدة في نظام مُوكِّل', hiTitle: 'أول مرة هنا؟ 👋', hiBody: 'اتفرّج على شرح الصفحة في أقل من دقيقة.', go: 'ابدأ الشرح', later: 'بعدين',
};

const SUPPORT_PHONE = '201013917789';
const SEEN_KEY = v => `mowakkil_tour_seen_${v}`;
let current = null;

const seen = v => { try { return localStorage.getItem(SEEN_KEY(v)) === '1'; } catch { return true; } };
const markSeen = v => { try { localStorage.setItem(SEEN_KEY(v), '1'); } catch {} };
// صفحة الفيديو بتشغّل الجولة لوحدها (?tour=autoplay) → من غير تلميحات
const recording = () => /[?&]tour=autoplay/.test(location.search);

function closeMenu() { document.querySelector('.help-menu')?.remove(); }
function closeHint() { document.querySelector('.help-hint')?.remove(); }

function youtubeId(v) {
  const s = String(v || '').trim();
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(s) ? s : null);
}

function openVideo(view) {
  const id = youtubeId(VIDEOS[view]);
  if (!id) return;
  closeMenu();
  const bd = document.createElement('div');
  bd.className = 'help-video-backdrop';
  bd.innerHTML = `
    <div class="help-video" role="dialog" aria-label="فيديو الشرح">
      <button class="help-video-x" aria-label="إغلاق">✕</button>
      <div class="help-video-frame">
        <iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&hl=ar" title="فيديو الشرح"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
      </div>
    </div>`;
  const close = () => { bd.remove(); window.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  bd.addEventListener('click', e => { if (e.target === bd) close(); });
  bd.querySelector('.help-video-x').onclick = close;
  window.addEventListener('keydown', onKey);
  document.body.appendChild(bd);
}

function runTour(view) {
  closeMenu(); closeHint(); markSeen(view);
  startTour(view);
}

function openMenu(btn) {
  if (document.querySelector('.help-menu')) return closeMenu();
  closeHint();
  const tour = tourFor(current);
  const hasVideo = !!youtubeId(VIDEOS[current]);
  const r = btn.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'help-menu';
  m.setAttribute('data-no-msa', '');
  const t = T();
  m.innerHTML = `
    <div class="help-menu-title">${t.need}</div>
    ${tour ? `<button data-h="tour"><span>▶️</span><div><b>${t.tour}</b><small>${t.tourSub}</small></div></button>` : ''}
    ${hasVideo ? `<button data-h="video"><span>🎬</span><div><b>${t.video}</b><small>${t.videoSub}</small></div></button>`
      : CHANNEL ? `<a data-h="channel" target="_blank" rel="noopener" href="${CHANNEL}"><span>🎬</span><div><b>${t.channel}</b><small>${t.channelSub}</small></div></a>` : ''}
    `;
  // القايمة بتفتح فوق الزرار
  m.style.bottom = (window.innerHeight - r.top + 10) + 'px';
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 288)) + 'px';
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    if (b.dataset.h === 'tour') runTour(current);
    else if (b.dataset.h === 'video') openVideo(current);
    else closeMenu();
  });
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!e.target.closest('.help-menu, #help-btn')) { closeMenu(); document.removeEventListener('click', off); }
  }), 0);
}

// تلميح أول زيارة: صغير جنب الأيقونة، ومش بيوقّف الشغل
function maybeHint(view) {
  closeHint();
  if (!tourFor(view) || seen(view) || recording() || isTourRunning()) return;
  const btn = document.getElementById('help-btn');
  if (!btn || btn.hidden) return;
  setTimeout(() => {
    if (current !== view || seen(view) || isTourRunning()) return;
    const r = btn.getBoundingClientRect();
    if (!r.width) return;
    const h = document.createElement('div');
    h.className = 'help-hint help-hint-up';
    h.setAttribute('data-no-msa', '');
    const t = T();
    h.innerHTML = `<div><b>${t.hiTitle}</b><br>${t.hiBody}</div>
      <div class="help-hint-btns"><button class="btn btn-primary" data-h="go">${t.go}</button><button class="btn btn-ghost" data-h="no">${t.later}</button></div>`;
    h.style.bottom = (window.innerHeight - r.top + 14) + 'px';
    h.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 272)) + 'px';
    h.addEventListener('click', e => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      if (b.dataset.h === 'go') runTour(view);
      else { markSeen(view); closeHint(); }
    });
    document.body.appendChild(h);
  }, 1400);
}

// الزرار العائم: نفس ركن زرار واتساب، وفوقه على طول
function mountFab() {
  let btn = document.getElementById('help-btn');
  if (btn) return btn;
  btn = document.createElement('button');
  btn.id = 'help-btn';
  btn.className = 'help-fab';
  btn.type = 'button';
  btn.hidden = true;
  btn.setAttribute('data-no-msa', '');
  btn.setAttribute('aria-label', 'شرح الصفحة');
  btn.title = 'شرح الصفحة';
  btn.innerHTML = `<span class="help-fab-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/></svg></span><span class="help-fab-label">شرح</span>`;
  document.body.appendChild(btn);
  try {
    if (!sessionStorage.getItem('help_fab_intro')) { btn.classList.add('help-fab-intro'); sessionStorage.setItem('help_fab_intro', '1'); }
  } catch {}
  // المكان والظهور: جوه النظام بس، فوق زرار واتساب، ويختفي وقت الجولة أو أي نافذة فيديو/بحث
  const place = () => {
    const inApp = !document.getElementById('app-body')?.hidden;
    const cover = isTourRunning() || recording() || document.querySelector('.help-video-backdrop, .search-modal, .install-sheet.show');
    btn.hidden = !inApp || !!cover;
    if (btn.hidden) { closeMenu(); return; }
    const wa = document.querySelector('.support-fab');
    const wr = wa && wa.style.display !== 'none' ? wa.getBoundingClientRect() : null;
    btn.style.bottom = (wr && wr.height ? (window.innerHeight - wr.top + 12) : 20) + 'px';
  };
  place();
  window.addEventListener('resize', place);
  document.addEventListener('mowakkil:tour-ended', place);
  setInterval(place, 600);
  return btn;
}

export function initHelp() {
  const btn = mountFab();
  if (btn.dataset.ready) return;
  btn.dataset.ready = '1';
  btn.addEventListener('click', () => openMenu(btn));
  document.addEventListener('mowakkil:view-changed', e => {
    current = e.detail?.subView || e.detail?.name;
    closeMenu(); closeHint();
    btn.classList.toggle('has-tour', !!tourFor(current));
    maybeHint(current);
  });
}
