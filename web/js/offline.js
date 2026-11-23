// web/js/offline.js
// الشغل من غير إنترنت:
//   1) قراءة: آخر نسخة من الأجندة/القضايا/الموكلين/المهام بتتحفظ على الجهاز (IndexedDB)
//      ولو النت قاطع بنعرضها. الأجندة بتتحمّل مسبقاً (شهرين ورا + 4 شهور قدام).
//   2) كتابة: تسجيل جلسة/تأجيل/مهمة من غير نت بيتحفظ في "صندوق صادر" على الجهاز،
//      وبيتبعت للسيرفر لوحده أول ما النت يرجع.
// ⚠️ البيانات دي على جهاز المستخدم بس، وبتتمسح لما يعمل تسجيل خروج.
import { API_BASE, STORAGE_KEYS } from './config.js';

const DB_NAME = 'mowakkil-offline';
const DB_VERSION = 1;
const WIDE_KEY = 'agenda:wide';

// ---------------- IndexedDB صغير ----------------
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('responses')) d.createObjectStore('responses');
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// ---------------- إيه اللي بيتحفظ للقراءة من غير نت ----------------
const CACHEABLE = /^\/api\/(calendar\/events|agenda|dashboard|cases|clients|tasks|team\/me|settings$|office$|lawyers|sessions)/;
export const isCacheable = path => CACHEABLE.test(path) && !/\/analy[sz]e/.test(path);

export async function saveResponse(path, data) {
  if (!isCacheable(path)) return;
  try {
    await tx('responses', 'readwrite', s => s.put({ data, at: Date.now() }, path));
    await tx('meta', 'readwrite', s => s.put(Date.now(), 'last_sync'));
  } catch {}
}

export async function readResponse(path) {
  try {
    const hit = await tx('responses', 'readonly', s => reqP(s.get(path)));
    if (hit) return hit.data;
    // الأجندة: أي فترة مش متحفوظة بالظبط → نفلترها من النسخة الواسعة
    if (path.startsWith('/api/calendar/events')) return await calendarFromWide(path);
  } catch {}
  return null;
}

async function calendarFromWide(path) {
  const wide = await tx('responses', 'readonly', s => reqP(s.get(WIDE_KEY)));
  if (!wide) return null;
  const q = new URL(path, 'http://x').searchParams;
  const from = q.get('from') || '0000';
  const to = q.get('to') || '9999';
  const type = q.get('type');
  return (wide.data || []).filter(e => {
    const d = String(e.start).slice(0, 10);
    return d >= from && d <= to && (!type || e.category === type);
  });
}

export async function lastSync() {
  try { return await tx('meta', 'readonly', s => reqP(s.get('last_sync'))); } catch { return null; }
}

// ---------------- تحميل مسبق للأجندة ----------------
const iso = d => d.toISOString().slice(0, 10);
export async function prefetchAgenda(fetchJson) {
  if (!navigator.onLine) return;
  const now = Date.now();
  const from = iso(new Date(now - 60 * 86400000));
  const to = iso(new Date(now + 120 * 86400000));
  try {
    const events = await fetchJson(`/api/calendar/events?from=${from}&to=${to}`, { skipCache: true });
    await tx('responses', 'readwrite', s => s.put({ data: Array.isArray(events) ? events : [], at: Date.now() }, WIDE_KEY));
    // الحاجات اللي بنحتاجها عشان نسجّل جلسة من غير نت (أسماء القضايا)
    await Promise.allSettled([
      fetchJson('/api/cases', { skipCache: true }),
      fetchJson('/api/agenda?days=14', { skipCache: true }),
      fetchJson('/api/dashboard', { skipCache: true }),
      fetchJson('/api/tasks', { skipCache: true }),
    ]);
    await tx('meta', 'readwrite', s => s.put(Date.now(), 'last_sync'));
    updateBanner();
  } catch {}
}

// ---------------- صندوق الصادر (كتابة من غير نت) ----------------
// العمليات اللي ينفع تتعمل من غير نت (من غير حذف — الحذف محتاج نت)
const QUEUEABLE = [
  ['POST', /^\/api\/sessions$/, 'تسجيل جلسة'],
  ['PATCH', /^\/api\/calendar\/events\/\w+\/\d+$/, 'تغيير موعد'],
  ['POST', /^\/api\/calendar\/events$/, 'حدث جديد في الأجندة'],
  ['POST', /^\/api\/tasks$/, 'مهمة جديدة'],
  ['PATCH', /^\/api\/tasks\/\d+(\/done)?$/, 'تحديث مهمة'],
];
export function queueLabel(method, path) {
  const q = QUEUEABLE.find(([m, re]) => m === method && re.test(path));
  return q ? q[2] : null;
}

export async function enqueue(method, path, body) {
  const label = queueLabel(method, path);
  const item = { method, path, body: body ?? null, label, created_at: new Date().toISOString() };
  await tx('outbox', 'readwrite', s => s.add(item));
  await applyLocally(method, path, body);
  updateBanner();
  return item;
}

export async function pendingCount() {
  try { return await tx('outbox', 'readonly', s => reqP(s.count())); } catch { return 0; }
}

// نعدّل النسخة المحفوظة عشان التغيير يبان فوراً حتى لو قفلت وفتحت من غير نت
async function applyLocally(method, path, body) {
  let b = {};
  try { b = typeof body === 'string' ? JSON.parse(body) : (body || {}); } catch {}
  const editWide = async fn => {
    const wide = await tx('responses', 'readonly', s => reqP(s.get(WIDE_KEY)));
    if (!wide) return;
    const data = fn([...(wide.data || [])]);
    await tx('responses', 'readwrite', s => s.put({ ...wide, data }, WIDE_KEY));
  };
  // تغيير موعد (تأجيل جلسة / مهمة)
  const m = path.match(/^\/api\/calendar\/events\/(\w+)\/(\d+)$/);
  if (method === 'PATCH' && m && b.date) {
    await editWide(list => list.map(e => (e.id === `${m[1]}-${m[2]}` ? { ...e, start: b.date, end: b.date, _pending: true } : e)));
  }
  // جلسة جديدة على قضية
  if (method === 'POST' && path === '/api/sessions' && b.case_id && b.session_date) {
    const cases = (await readResponse('/api/cases')) || [];
    const c = cases.find(x => x.id === Number(b.case_id)) || {};
    await editWide(list => list.concat({
      id: `pending-${Date.now()}`, calendarId: 'sessions', category: 'session', isAllDay: true,
      title: `⏳ ${c.client_name || 'موكل'} — ${c.case_number || ''}`,
      body: `${c.court || ''}${b.notes ? '\n' + b.notes : ''}\n(مستني النت عشان يتبعت)`,
      start: b.session_date, end: b.session_date, _pending: true,
    }));
  }
  if (method === 'POST' && path === '/api/calendar/events' && b.date) {
    await editWide(list => list.concat({
      id: `pending-${Date.now()}`, calendarId: b.type === 'task' ? 'tasks' : 'sessions', category: b.type || 'task', isAllDay: true,
      title: `⏳ ${b.title || ''}`, body: '(مستني النت عشان يتبعت)', start: b.date, end: b.date, _pending: true,
    }));
  }
}

let syncing = false;
/** يبعت كل اللي في صندوق الصادر بالترتيب. بيرجع { sent, failed: [{label, error}] } */
export async function syncOutbox() {
  if (syncing || !navigator.onLine) return { sent: 0, failed: [] };
  syncing = true;
  const result = { sent: 0, failed: [] };
  try {
    const items = await tx('outbox', 'readonly', s => reqP(s.getAll()));
    for (const it of items) {
      let res;
      try {
        res = await fetch(API_BASE + it.path, {
          method: it.method,
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (localStorage.getItem(STORAGE_KEYS.TOKEN) || '') },
          body: it.body == null ? undefined : (typeof it.body === 'string' ? it.body : JSON.stringify(it.body)),
        });
      } catch {
        break; // النت لسه مش ثابت — نكمّل بعدين
      }
      if (res.ok) {
        await tx('outbox', 'readwrite', s => s.delete(it.id));
        result.sent++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
        // مرفوضة (صلاحيات/بيانات) — نشيلها ونبلّغ المستخدم بدل ما تفضل تتعاد للأبد
        const err = await res.json().catch(() => ({}));
        await tx('outbox', 'readwrite', s => s.delete(it.id));
        result.failed.push({ label: it.label, error: err.error || `HTTP ${res.status}` });
      } else {
        break; // سيرفر/جلسة — نحاول تاني بعدين
      }
    }
  } finally {
    syncing = false;
  }
  if (result.sent || result.failed.length) {
    document.dispatchEvent(new CustomEvent('mowakkil:synced', { detail: result }));
  }
  updateBanner();
  return result;
}

export async function clearOffline() {
  try {
    await tx('responses', 'readwrite', s => s.clear());
    await tx('outbox', 'readwrite', s => s.clear());
    await tx('meta', 'readwrite', s => s.clear());
  } catch {}
}

// ---------------- شريط الحالة ----------------
let bannerSeq = 0;
export async function updateBanner() {
  // أكتر من تحديث في نفس الوقت → آخر واحد بس هو اللي يتطبق (عشان الشريط ميفضلش بعد المزامنة)
  const seq = ++bannerSeq;
  const pending = await pendingCount();
  const ls = await lastSync();
  if (seq !== bannerSeq) return;
  let el = document.getElementById('offline-banner');
  const offline = !navigator.onLine;
  if (!offline && !pending) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'offline-banner';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  const time = ls ? new Date(ls).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';
  el.className = offline ? 'offline' : 'pending';
  el.innerHTML = offline
    ? `📴 من غير إنترنت — بتشوف آخر نسخة (آخر مزامنة ${time})${pending ? ` · ⏳ ${pending} عملية مستنية النت` : ''}`
    : `⏳ ${pending} عملية مستنية تتبعت… <button type="button" data-sync-now>ابعت دلوقتي</button>`;
  el.querySelector('[data-sync-now]')?.addEventListener('click', () => syncOutbox());
}

/** تشغيل: مزامنة لما النت يرجع + تحميل مسبق للأجندة كل 15 دقيقة */
export function startOffline(fetchJson) {
  window.addEventListener('online', async () => { await syncOutbox(); prefetchAgenda(fetchJson); });
  window.addEventListener('offline', updateBanner);
  syncOutbox().then(() => prefetchAgenda(fetchJson));
  setInterval(() => { if (navigator.onLine) prefetchAgenda(fetchJson); }, 15 * 60 * 1000);
  updateBanner();
}
