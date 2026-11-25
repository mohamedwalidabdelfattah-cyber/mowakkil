// web/js/notifications.js
// الإشعارات في الشريط العلوي: الجرس + العدد + القايمة
// - على الكمبيوتر: قايمة تحت الجرس. على الموبايل: لوحة من تحت.
// - تبويب الكل / غير المقروء، تجميع بالأيام، تعليم مقروء/مش مقروء، إخفاء، تحميل المزيد
// - إشعارات الجهاز (اختياري من الإعدادات) + صوت خفيف

import { apiJson } from './api.js';
import { esc, toast } from './ui.js';
import { openLink } from './nav-links.js';
import { dateLocale, fmtDay } from './country.js';

const POLL_MS = 45000;
const DEVICE_KEY = 'mowakkil_notif_device'; // '1' = إشعارات الجهاز شغالة
const SOUND_KEY = 'mowakkil_notif_sound';   // '0' = من غير صوت
const SEEN_KEY = 'mowakkil_notif_seen';     // آخر id اتعرض كإشعار جهاز

let pollingInterval = null;
let lastUnread = null;
let panelState = { filter: 'all', items: [], more: false, loading: false };

const CAT = {
  session: { label: 'جلسة',   color: '#0F172A', icon: 'landmark' },
  event:   { label: 'موعد',   color: '#2E90FA', icon: 'calendar' },
  task:    { label: 'مهمة',   color: '#12B76A', icon: 'check' },
  fee:     { label: 'أتعاب',  color: '#D4AF37', icon: 'money' },
  payment: { label: 'تحصيل',  color: '#039855', icon: 'money' },
  case:    { label: 'قضية',   color: '#6172F3', icon: 'file' },
  client:  { label: 'موكل',   color: '#7A5AF8', icon: 'user' },
  system:  { label: 'النظام', color: '#667085', icon: 'bell' },
};
const ICON_SVG = {
  landmark: '<path d="M3 21h18M5 21V10m4 11V10m6 11V10m4 11V10M2 10l10-6 10 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
};
const svg = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_SVG[name] || ICON_SVG.bell}</svg>`;

// ============================================================
// Polling + العدّاد
// ============================================================
export function startNotifications() {
  if (pollingInterval) return;
  updateBadge(true);
  pollingInterval = setInterval(() => { if (!document.hidden || deviceEnabled()) updateBadge(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateBadge(); });
  window.addEventListener('online', () => updateBadge());
}

export function stopNotifications() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

export async function updateBadge(first = false) {
  if (!navigator.onLine) return;
  let unread;
  try {
    const r = await apiJson('/api/notifications/count', { skipCache: true });
    unread = r.unread || 0;
  } catch { return; }

  if (!first && lastUnread !== null && unread > lastUnread) onNewNotifications(unread - lastUnread);
  lastUnread = unread;

  const btn = document.getElementById('notif-btn');
  if (!btn) return;
  btn.querySelector('.notif-badge')?.remove();
  btn.setAttribute('aria-label', unread ? `الإشعارات — ${unread} مش مقروء` : 'الإشعارات');
  if (unread > 0) {
    const badge = document.createElement('span');
    badge.className = 'notif-badge';
    badge.textContent = unread > 99 ? '99+' : String(unread);
    btn.appendChild(badge);
    btn.style.position = 'relative';
  }
  // لو القايمة مفتوحة، حدّث عدد التبويب
  const c = document.querySelector('#notif-dropdown .np-unread-count');
  if (c) c.textContent = unread ? String(unread) : '';
}

async function onNewNotifications(n) {
  // نجيب الجديد عشان نعرض عنوانه
  let latest = [];
  try { latest = (await apiJson('/api/notifications?filter=unread&limit=' + Math.min(n, 3), { skipCache: true })).items || []; } catch {}
  const top = latest[0];
  if (document.hidden && deviceEnabled() && 'Notification' in window && Notification.permission === 'granted') {
    const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
    for (const it of latest.filter(x => x.id > seen).reverse()) {
      try {
        const nt = new Notification(stripEmoji(it.title), { body: it.body || '', tag: 'mowakkil-' + it.id, icon: '/assets/logos/logo-md.png', lang: 'ar', dir: 'rtl' });
        nt.onclick = () => { window.focus(); openLink(it.link || '', it.reference_type || ''); nt.close(); };
      } catch {}
    }
    if (latest[0]) localStorage.setItem(SEEN_KEY, String(latest[0].id));
  } else {
    toast(top ? `🔔 ${stripEmoji(top.title)}` : `🔔 عندك ${n} إشعار جديد`, 'ok');
  }
  if (soundEnabled()) beep();
  if (document.getElementById('notif-dropdown')) loadPanel(true);
}

// ============================================================
// إعدادات الجهاز (بتتعرض في الإعدادات)
// ============================================================
export function deviceEnabled() {
  try { return localStorage.getItem(DEVICE_KEY) === '1'; } catch { return false; }
}
export function soundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
}
export async function setDeviceEnabled(on) {
  if (on) {
    if (!('Notification' in window)) throw new Error('المتصفح ده مش بيدعم إشعارات الجهاز');
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('المتصفح رافض الإشعارات — اسمح بيها من علامة القفل جنب عنوان الموقع');
  }
  try { localStorage.setItem(DEVICE_KEY, on ? '1' : '0'); } catch {}
}
export function setSoundEnabled(on) {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch {}
}
export function deviceSupport() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // default | granted | denied
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36);
    setTimeout(() => ctx.close?.(), 600);
  } catch {}
}

// ============================================================
// القايمة
// ============================================================
export async function openNotifications() {
  const existing = document.getElementById('notif-dropdown');
  if (existing) { closePanel(); return; }

  const btn = document.getElementById('notif-btn');
  const panel = document.createElement('div');
  panel.id = 'notif-dropdown';
  panel.className = 'np';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'الإشعارات');
  panel.innerHTML = `
    <div class="np-head">
      <div class="np-title">الإشعارات <span class="np-unread-count">${lastUnread || ''}</span></div>
      <div class="np-head-actions">
        <button class="np-link" data-np="mark-all" title="تعليم الكل كمقروء">تعليم الكل كمقروء</button>
        <button class="np-icon-btn" data-np="settings" title="إعدادات الإشعارات" aria-label="إعدادات الإشعارات">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button class="np-icon-btn np-close" data-np="close" aria-label="إغلاق">✕</button>
      </div>
    </div>
    <div class="np-tabs" role="tablist">
      <button class="np-tab ${panelState.filter === 'all' ? 'active' : ''}" data-filter="all" role="tab">الكل</button>
      <button class="np-tab ${panelState.filter === 'unread' ? 'active' : ''}" data-filter="unread" role="tab">مش مقروء</button>
    </div>
    <div class="np-list" id="np-list" tabindex="-1"></div>
    <div class="np-foot">
      <button class="np-link danger" data-np="clear-all">مسح الكل من عندي</button>
    </div>`;
  document.body.appendChild(panel);
  const backdrop = document.createElement('div');
  backdrop.className = 'np-backdrop';
  document.body.appendChild(backdrop);
  btn?.setAttribute('aria-expanded', 'true');
  position(panel, btn);
  requestAnimationFrame(() => { panel.classList.add('open'); backdrop.classList.add('open'); });

  const onDocClick = (e) => {
    if (!panel.contains(e.target) && !btn?.contains(e.target)) closePanel();
  };
  const onKey = (e) => { if (e.key === 'Escape') { closePanel(); btn?.focus(); } };
  const onResize = () => position(panel, btn);
  setTimeout(() => document.addEventListener('click', onDocClick), 0);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  panel._cleanup = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    backdrop.remove();
    btn?.setAttribute('aria-expanded', 'false');
  };
  backdrop.addEventListener('click', closePanel);

  panel.addEventListener('click', onPanelClick);
  await loadPanel(true);
  panel.querySelector('.np-list')?.focus({ preventScroll: true });
}

function closePanel() {
  const p = document.getElementById('notif-dropdown');
  if (!p) return;
  p._cleanup?.();
  p.classList.remove('open');
  setTimeout(() => p.remove(), 150);
}

function position(panel, btn) {
  if (innerWidth <= 640 || !btn) { panel.classList.add('sheet'); panel.style.cssText = ''; return; }
  panel.classList.remove('sheet');
  const r = btn.getBoundingClientRect();
  const w = Math.min(420, innerWidth - 24);
  // الجرس في الشمال (RTL) → القايمة تبدأ من عنده وتفرد يمين
  let left = r.left + r.width / 2 - 40;
  left = Math.max(12, Math.min(left, innerWidth - w - 12));
  panel.style.cssText = `top:${Math.round(r.bottom + 10)}px;left:${Math.round(left)}px;width:${w}px;`;
  panel.style.setProperty('--arrow-x', `${Math.round(r.left + r.width / 2 - left)}px`);
}

async function loadPanel(reset = false) {
  const list = document.getElementById('np-list');
  if (!list || panelState.loading) return;
  panelState.loading = true;
  if (reset) {
    panelState.items = [];
    list.innerHTML = `<div class="np-skel">${'<div class="np-skel-row"><span></span><div><i></i><i></i></div></div>'.repeat(4)}</div>`;
  }
  try {
    const before = !reset && panelState.items.length ? `&before=${panelState.items.at(-1).id}` : '';
    const r = await apiJson(`/api/notifications?limit=20&filter=${panelState.filter}${before}`, { skipCache: true });
    const items = Array.isArray(r) ? r : (r.items || []);
    panelState.items = reset ? items : panelState.items.concat(items);
    panelState.more = !!r.more;
    renderList();
  } catch (e) {
    list.innerHTML = `<div class="np-empty"><div class="np-empty-ic">⚠️</div><div>${navigator.onLine ? 'مقدرناش نحمّل الإشعارات' : 'الإشعارات محتاجة إنترنت'}</div><button class="np-link" data-np="retry">حاول تاني</button></div>`;
  } finally {
    panelState.loading = false;
  }
}

function groupOf(dateStr) {
  const d = parseDate(dateStr);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff <= 0) return 'النهارده';
  if (diff === 1) return 'امبارح';
  if (diff < 7) return 'الأسبوع ده';
  return 'أقدم';
}

function renderList() {
  const list = document.getElementById('np-list');
  if (!list) return;
  const items = panelState.items;
  if (!items.length) {
    list.innerHTML = `
      <div class="np-empty">
        <div class="np-empty-ic">${svg('bell', 28)}</div>
        <div class="np-empty-title">${panelState.filter === 'unread' ? 'مفيش إشعارات مش مقروءة' : 'مفيش إشعارات'}</div>
        <div class="np-empty-sub">هنبلّغك بالجلسات والمواعيد والمهام والأتعاب أول بأول.</div>
      </div>`;
    return;
  }
  let html = '', lastGroup = '';
  for (const n of items) {
    const g = groupOf(n.created_at);
    if (g !== lastGroup) { html += `<div class="np-group">${g}</div>`; lastGroup = g; }
    const c = CAT[n.category] || CAT.system;
    const pr = n.priority === 'urgent' ? 'urgent' : n.priority === 'high' ? 'high' : '';
    html += `
      <div class="np-item ${n.is_read ? 'read' : 'unread'} ${pr}" data-id="${n.id}" role="button" tabindex="0" style="--c:${c.color}">
        <div class="np-ic">${svg(c.icon)}</div>
        <div class="np-body">
          <div class="np-item-title">${esc(stripEmoji(n.title))}</div>
          ${n.body ? `<div class="np-item-text">${esc(stripEmoji(n.body))}</div>` : ''}
          <div class="np-meta">
            <span class="np-chip">${c.label}</span>
            ${pr === 'urgent' ? '<span class="np-chip urgent">عاجل</span>' : ''}
            <span>${formatTime(n.created_at)}</span>
          </div>
        </div>
        <div class="np-actions">
          ${n.is_read ? '' : '<span class="np-dot" aria-label="مش مقروء"></span>'}
          <button class="np-act" data-act="${n.is_read ? 'unread' : 'read'}" title="${n.is_read ? 'تعليم كمش مقروء' : 'تعليم كمقروء'}" aria-label="${n.is_read ? 'تعليم كمش مقروء' : 'تعليم كمقروء'}">${n.is_read ? '●' : '✓'}</button>
          <button class="np-act" data-act="hide" title="إخفاء" aria-label="إخفاء">✕</button>
        </div>
      </div>`;
  }
  if (panelState.more) html += `<button class="np-more" data-np="more">عرض أقدم</button>`;
  list.innerHTML = html;
}

async function onPanelClick(e) {
  const panel = document.getElementById('notif-dropdown');
  const np = e.target.closest('[data-np]')?.dataset.np;
  if (np === 'close') return closePanel();
  if (np === 'retry') return loadPanel(true);
  if (np === 'more') return loadPanel(false);
  if (np === 'settings') {
    closePanel();
    try { sessionStorage.setItem('mowakkil_settings_tab', 'notifications'); } catch {}
    const { showView } = await import('./router.js');
    showView('settings');
    return;
  }
  if (np === 'mark-all') {
    try {
      await apiJson('/api/notifications/mark-all-read', { method: 'POST' });
      panelState.items = panelState.items.map(n => ({ ...n, is_read: 1 }));
      if (panelState.filter === 'unread') panelState.items = [];
      renderList(); updateBadge();
    } catch (err) { toast('⚠️ ' + err.message, 'bad'); }
    return;
  }
  if (np === 'clear-all') {
    if (!confirm('تمسح كل الإشعارات من عندك؟ (مش هتتمسح عند باقي الفريق)')) return;
    try {
      await apiJson('/api/notifications/clear-all', { method: 'DELETE' });
      panelState.items = []; renderList(); updateBadge();
    } catch (err) { toast('⚠️ ' + err.message, 'bad'); }
    return;
  }
  const tab = e.target.closest('.np-tab');
  if (tab) {
    panelState.filter = tab.dataset.filter;
    panel.querySelectorAll('.np-tab').forEach(t => t.classList.toggle('active', t === tab));
    return loadPanel(true);
  }

  const itemEl = e.target.closest('.np-item');
  if (!itemEl) return;
  const id = Number(itemEl.dataset.id);
  const n = panelState.items.find(x => x.id === id);
  if (!n) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  try {
    if (act === 'hide') {
      await apiJson(`/api/notifications/${id}`, { method: 'DELETE' });
      panelState.items = panelState.items.filter(x => x.id !== id);
      renderList(); updateBadge(); return;
    }
    if (act === 'read' || act === 'unread') {
      await apiJson(`/api/notifications/${id}/${act}`, { method: 'PATCH' });
      n.is_read = act === 'read' ? 1 : 0;
      if (panelState.filter === 'unread' && n.is_read) panelState.items = panelState.items.filter(x => x.id !== id);
      renderList(); updateBadge(); return;
    }
    // فتح الإشعار
    if (!n.is_read) { apiJson(`/api/notifications/${id}/read`, { method: 'PATCH' }).then(() => updateBadge()).catch(() => {}); }
    if (n.link) { closePanel(); openLink(n.link, n.reference_type || ''); }
    else { n.is_read = 1; renderList(); }
  } catch (err) {
    toast('⚠️ ' + err.message, 'bad');
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target?.classList?.contains('np-item')) { e.preventDefault(); e.target.click(); }
});

// ============================================================
// Helpers
// ============================================================
function stripEmoji(s) {
  return String(s || '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').replace(/\n[\p{Extended_Pictographic}️]+\s?/gu, '\n');
}
function parseDate(s) {
  // created_at من SQLite بتوقيت UTC ومن غير Z
  if (!s) return new Date();
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : String(s).replace(' ', 'T') + 'Z');
}
function formatTime(dateStr) {
  const date = parseDate(dateStr);
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return 'دلوقتي';
  if (diff < 3600) return `من ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `من ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return date.toLocaleDateString(dateLocale(), { weekday: 'long' }) + ' ' + date.toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}
