// web/js/offline.js
// النظام كله يشتغل من غير إنترنت:
//
//   1) قراءة: أي شاشة اتفتحت (أو اتحمّلت مسبقاً) بتتحفظ على الجهاز (IndexedDB)، ولو النت قاطع
//      بنعرض آخر نسخة. بيتحمّل مسبقاً: الأجندة + كل القوايم (كل 15 دقيقة) + ملفات القضايا
//      والموكلين والمهام (مرة في اليوم).
//   2) كتابة: أي إضافة/تعديل/حذف من غير نت بتتحفظ في "صندوق صادر" على الجهاز، وبتبان فوراً
//      في القوايم، وبتتبعت لوحدها أول ما النت يرجع — بالترتيب.
//      الإضافات بتاخد رقم مؤقت (سالب)، ولو عملية بعدها بتشاور عليه (قضية لموكل جديد مثلاً)
//      بنبدّله بالرقم الحقيقي وقت الإرسال.
//   3) رفع المستندات من غير نت: الملف نفسه بيتحفظ على الجهاز ويترفع لما النت يرجع.
//
// اللي لازم يكون فيه نت: الذكاء الاصطناعي، الدفع والاشتراك، دعوات بوابة الموكل، إدارة الفريق.
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
const getKey = (store, key) => tx(store, 'readonly', s => reqP(s.get(key)));
const putKey = (store, key, val) => tx(store, 'readwrite', s => s.put(val, key));
async function allResponseKeys() { return tx('responses', 'readonly', s => reqP(s.getAllKeys())); }
const meta = { get: k => getKey('meta', k).catch(() => null), set: (k, v) => putKey('meta', k, v).catch(() => {}) };

// ---------------- القراءة ----------------
// أي GET على الـ API بيتحفظ، ماعدا: تحميل ملفات، الذكاء الاصطناعي، بوابة الموكل، الدخول
const NOT_CACHEABLE = /\/download$|^\/api\/(analyze|chat|legal-search|generate-doc|client-portal|superadmin|auth)\b|\/analyses$/;
export const isCacheable = path => path.startsWith('/api/') && !NOT_CACHEABLE.test(path);

export async function saveResponse(path, data) {
  if (!isCacheable(path)) return;
  try {
    await putKey('responses', path, { data, at: Date.now() });
    await meta.set('last_sync', Date.now());
  } catch {}
}

export async function readResponse(path) {
  try {
    const hit = await getKey('responses', path);
    if (hit) return hit.data;
    if (path.startsWith('/api/calendar/events')) return await calendarFromWide(path);
    // ملف قضية/موكل/مهمة اتعمل من غير نت أو ما اتفتحش قبل كده → نبنيه من القوايم المحفوظة
    const synth = await synthesize(path);
    if (synth) return synth;
    // نفس القايمة بفلاتر تانية → القايمة من غير فلاتر (أحسن من مفيش)
    const base = path.split('?')[0];
    if (base !== path) {
      const b = await getKey('responses', base);
      if (b) return b.data;
    }
  } catch {}
  return null;
}

async function calendarFromWide(path) {
  const wide = await getKey('responses', WIDE_KEY);
  if (!wide) return null;
  const q = new URL(path, 'http://x').searchParams;
  const from = q.get('from') || '0000';
  const to = q.get('to') || '9999';
  const type = q.get('type');
  return (wide.data || []).filter(e => {
    const d = String(e.start).slice(0, 10);
    const kindOk = !type || e.category === type || (type.startsWith('ev:') && e.category === 'event' && e.raw?.kind === type.slice(3));
    return d >= from && d <= to && kindOk;
  });
}

const listOf = async key => { const h = await getKey('responses', key); return Array.isArray(h?.data) ? h.data : []; };

async function synthesize(path) {
  let m = path.match(/^\/api\/cases\/(-?\d+)\/profile$/);
  if (m) {
    const id = Number(m[1]);
    const c = [...await listOf('/api/cases'), ...await listOf('/api/cases?archived=1')].find(x => x.id === id);
    if (!c) return null;
    return { case: c, sessions: [], expenses: [], fees: [], documents: [], tasks: [],
      stats: { total_fees: 0, total_paid: 0, total_remaining: 0, total_expenses: 0, sessions_count: 0, tasks_count: 0, documents_count: 0 } };
  }
  m = path.match(/^\/api\/clients\/(-?\d+)\/profile$/);
  if (m) {
    const id = Number(m[1]);
    const client = (await listOf('/api/clients')).find(x => x.id === id);
    if (!client) return null;
    const cases = (await listOf('/api/cases')).filter(c => c.client_id === id);
    return { client, cases, fees: [], payments: [], sessions: [], invoices: [], upcoming_sessions: [],
      stats: { total_cases: cases.length, total_fees: 0, total_paid: 0, total_remaining: 0, total_invoices: 0, total_invoices_paid: 0, total_invoices_remaining: 0, sessions_count: 0, upcoming_count: 0 } };
  }
  // مستندات قضية/مهمة ملهاش نسخة (اتعملت من غير نت) → من ملفها، أو قايمة فاضية
  m = path.match(/^\/api\/documents\?(case|task)_id=(-?\d+)$/);
  if (m) {
    const prof = await getKey('responses', `/api/${m[1]}s/${m[2]}/profile`);
    if (prof?.data?.documents) return prof.data.documents;
    const exists = (await listOf(`/api/${m[1]}s`)).some(x => x.id === Number(m[2]));
    return exists ? [] : null;
  }
  m = path.match(/^\/api\/tasks\/(-?\d+)\/profile$/);
  if (m) {
    const task = (await listOf('/api/tasks')).find(x => x.id === Number(m[1]));
    if (!task) return null;
    return { task, sessions: [], task_expenses: [], session_expenses: [], documents: [], totals: { task_expenses: 0, session_expenses: 0, all: 0 } };
  }
  return null;
}

export async function lastSync() { return meta.get('last_sync'); }

// ---------------- التحميل المسبق ----------------
const iso = d => d.toISOString().slice(0, 10);
const LISTS = [
  '/api/dashboard', '/api/cases', '/api/cases?archived=1', '/api/clients', '/api/tasks',
  '/api/fees', '/api/payments', '/api/invoices', '/api/expenses', '/api/lawyers',
  '/api/accounts', '/api/journal', '/api/notifications', '/api/settings', '/api/office',
  '/api/team', '/api/team/me', '/api/team/directory', '/api/subscription/me', '/api/agenda?days=14',
  '/api/documents/categories', '/api/invoices/stats', '/api/payments/stats', '/api/reports/accounting-summary',
];
const PROFILE_TTL = 24 * 60 * 60 * 1000;

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => {
    while (queue.length) { const it = queue.shift(); try { await fn(it); } catch {} }
  }));
}

let prefetching = false;
/** يحمّل كل حاجة على الجهاز: الأجندة + القوايم (كل مرة) + ملفات القضايا/الموكلين/المهام (مرة في اليوم) */
export async function prefetchAll(fetchJson, { force = false } = {}) {
  if (!navigator.onLine || prefetching) return;
  prefetching = true;
  try {
    const now = Date.now();
    const from = iso(new Date(now - 60 * 86400000));
    const to = iso(new Date(now + 120 * 86400000));
    try {
      const events = await fetchJson(`/api/calendar/events?from=${from}&to=${to}`, { skipCache: true });
      await putKey('responses', WIDE_KEY, { data: Array.isArray(events) ? events : [], at: Date.now() });
    } catch {}
    // القوايم (اللي مش مسموحة للدور ده بترجع 403 وبتتجاهل) + التقرير الشهري للشهر ده واللي قبله
    const ym = d => d.toISOString().slice(0, 7);
    const thisMonth = new Date(); const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const reports = [ym(thisMonth), ym(lastMonth)].map(m => `/api/reports/monthly?month=${m}`);
    await pool([...LISTS, ...reports], 4, p => fetchJson(p, { skipCache: true }));

    // ملفات القضايا والموكلين والمهام — مرة في اليوم عشان منتقلش على السيرفر
    const last = await meta.get('profiles_at');
    if (force || !last || now - last > PROFILE_TTL) {
      const cases = (await listOf('/api/cases')).slice(0, 200).map(c => `/api/cases/${c.id}/profile`);
      const clients = (await listOf('/api/clients')).slice(0, 300).map(c => `/api/clients/${c.id}/profile`);
      const tasks = (await listOf('/api/tasks')).filter(t => t.status !== 'منجزة').slice(0, 150).map(t => `/api/tasks/${t.id}/profile`);
      await pool([...cases, ...clients, ...tasks], 3, p => fetchJson(p, { skipCache: true }));
      await meta.set('profiles_at', Date.now());
    }
    await meta.set('last_sync', Date.now());
  } finally {
    prefetching = false;
    updateBanner();
  }
}
// اسم قديم (الأجندة كانت أول حاجة)
export const prefetchAgenda = prefetchAll;

// ---------------- صندوق الصادر ----------------
// اللي مينفعش من غير نت (بيحتاج السيرفر في لحظتها)
const NOT_QUEUEABLE = /^\/api\/(analyze|chat|legal-search|generate-doc|fee-calc|auth|team|subscription|payment-requests|superadmin|settings\/ai-privacy|client-portal)\b|^\/api\/clients\/(invite|cancel-invite|resend-invite|toggle-active|delete-account)$|\/analyze$/;

const NOUNS = {
  clients: 'موكل', cases: 'قضية', sessions: 'جلسة', tasks: 'مهمة', fees: 'أتعاب', payments: 'دفعة',
  invoices: 'فاتورة', expenses: 'مصروف', documents: 'مستند', lawyers: 'محامي', calendar: 'موعد',
  accounts: 'حساب', journal: 'قيد', notifications: 'إشعار', settings: 'إعدادات', office: 'بيانات المكتب',
  'task-expenses': 'مصروف مهمة', 'session-expenses': 'مصروف جلسة',
};
export function queueLabel(method, path) {
  if (method === 'GET' || NOT_QUEUEABLE.test(path)) return null;
  const res = (path.match(/^\/api\/([a-z-]+)/) || [])[1];
  if (!res) return null;
  const noun = NOUNS[res] || res;
  if (/\/done$/.test(path)) return `إنهاء ${noun}`;
  if (res === 'calendar' && method === 'PATCH') return 'تغيير موعد';
  return `${{ POST: 'إضافة', PUT: 'تعديل', PATCH: 'تعديل', DELETE: 'حذف' }[method] || method} ${noun}`;
}

const isCreate = (method, path) => method === 'POST' && /^\/api\/[a-z-]+(\?.*)?$/.test(path);

async function nextTempId() {
  const n = ((await meta.get('temp_seq')) || 0) + 1;
  await meta.set('temp_seq', n);
  return -n; // الأرقام المؤقتة سالبة عشان متتلخبطش مع الحقيقية
}

const parseBody = body => { if (body == null) return {}; if (typeof body === 'string') { try { return JSON.parse(body); } catch { return {}; } } return body; };

/** يحط العملية في صندوق الصادر ويعدّل النسخة المحفوظة. بيرجّع { id } للإضافات (رقم مؤقت) */
export async function enqueue(method, path, body) {
  const label = queueLabel(method, path);
  const tempId = isCreate(method, path) ? await nextTempId() : null;
  const item = { kind: 'json', method, path, body: body ?? null, label, tempId, created_at: new Date().toISOString() };
  await tx('outbox', 'readwrite', s => s.add(item));
  try { await applyLocally(method, path, parseBody(body), tempId); } catch (e) { console.warn('offline apply failed', e); }
  updateBanner();
  return { queued: true, id: tempId };
}

/** رفع مستند من غير نت: الملف نفسه بيتحفظ على الجهاز */
export async function enqueueUpload(path, file, contentType, display = {}) {
  const tempId = await nextTempId();
  const item = { kind: 'upload', method: 'POST', path, blob: file, contentType, label: `رفع مستند: ${file.name}`, tempId, created_at: new Date().toISOString() };
  await tx('outbox', 'readwrite', s => s.add(item));
  const q = new URL(path, 'http://x').searchParams;
  const doc = { id: tempId, file_name: file.name, file_size: file.size, mime_type: contentType, doc_type: q.get('doc_type'), notes: q.get('notes'),
    case_id: Number(q.get('case_id')) || null, task_id: Number(q.get('task_id')) || null, created_at: new Date().toISOString(), storage: 'cloud', _pending: true, ...display };
  try {
    const listKey = doc.case_id ? `/api/documents?case_id=${doc.case_id}` : doc.task_id ? `/api/documents?task_id=${doc.task_id}` : null;
    if (listKey && !(await getKey('responses', listKey))) await putKey('responses', listKey, { data: [], at: Date.now() });
    await editKeys(k => k.startsWith('/api/documents?') && (!doc.case_id || k.includes(`case_id=${doc.case_id}`)) && (!doc.task_id || k.includes(`task_id=${doc.task_id}`)), arr => [doc, ...arr]);
    if (doc.case_id) await editObj(`/api/cases/${doc.case_id}/profile`, p => ({ ...p, documents: [doc, ...(p.documents || [])] }));
  } catch {}
  updateBanner();
  return { queued: true, id: tempId };
}

export async function pendingCount() {
  try { return await tx('outbox', 'readonly', s => reqP(s.count())); } catch { return 0; }
}
export async function pendingItems() {
  try { return await tx('outbox', 'readonly', s => reqP(s.getAll())); } catch { return []; }
}

// ---------------- تعديل النسخة المحفوظة فوراً ----------------
async function editKeys(match, fn) {
  const keys = (await allResponseKeys()).filter(k => typeof k === 'string' && match(k));
  for (const k of keys) {
    const h = await getKey('responses', k);
    if (h && Array.isArray(h.data)) await putKey('responses', k, { ...h, data: fn([...h.data]) });
  }
}
async function editObj(key, fn) {
  // ملف قضية/موكل/مهمة لسه مش محفوظ (اتعمل من غير نت) → نبنيه من القوايم الأول
  if (!(await getKey('responses', key))) {
    const s = await synthesize(key);
    if (s) await putKey('responses', key, { data: s, at: Date.now() });
  }
  const h = await getKey('responses', key);
  if (h && h.data && typeof h.data === 'object' && !Array.isArray(h.data)) await putKey('responses', key, { ...h, data: fn({ ...h.data }) });
}
const listKeyFor = res => k => k === `/api/${res}` || k.startsWith(`/api/${res}?`);
const activeListKeyFor = res => k => listKeyFor(res)(k) && !/archived=1/.test(k);
const nowIso = () => new Date().toISOString();

async function applyLocally(method, path, b, tempId) {
  const clean = path.split('?')[0];
  const [, res, idStr, sub] = clean.match(/^\/api\/([a-z-]+)(?:\/(-?\d+|\w+))?(?:\/(.+))?$/) || [];
  if (!res) return;
  const id = idStr != null && /^-?\d+$/.test(idStr) ? Number(idStr) : null;

  // ----- الأجندة -----
  if (res === 'calendar') {
    const cm = clean.match(/^\/api\/calendar\/events\/(\w+)\/(-?\d+)$/);
    const editWide = async fn => { const w = await getKey('responses', WIDE_KEY); if (w) await putKey('responses', WIDE_KEY, { ...w, data: fn([...(w.data || [])]) }); };
    if (method === 'PATCH' && cm && b.date) await editWide(l => l.map(e => (e.id === `${cm[1]}-${cm[2]}` ? { ...e, start: b.date, end: b.date, _pending: true } : e)));
    if (method === 'DELETE' && cm) await editWide(l => l.filter(e => e.id !== `${cm[1]}-${cm[2]}`));
    if (method === 'POST' && !cm && b.date) {
      const isEv = b.type === 'event';
      const st = isEv && b.start_time ? `${b.date}T${b.start_time}:00` : b.date;
      await editWide(l => l.concat({ id: `pending-${tempId}`, calendarId: isEv ? `ev-${b.kind || 'other'}` : (b.type === 'task' ? 'tasks' : 'sessions'), category: b.type || 'task', isAllDay: !(isEv && b.start_time),
        title: `⏳ ${b.title || ''}`, body: '(مستني النت عشان يتبعت)', start: st, end: st, _pending: true, raw: isEv ? { kind: b.kind, title: b.title, location: b.location, notes: b.notes } : {} }));
    }
    return;
  }

  // ----- جلسة جديدة: الأجندة + ملف القضية -----
  if (res === 'sessions' && method === 'POST' && b.case_id && b.session_date) {
    const cases = await listOf('/api/cases');
    const c = cases.find(x => x.id === Number(b.case_id)) || {};
    const w = await getKey('responses', WIDE_KEY);
    if (w) {
      await putKey('responses', WIDE_KEY, { ...w, data: [...(w.data || []), {
        id: `pending-${tempId}`, calendarId: 'sessions', category: 'session', isAllDay: true,
        title: `⏳ ${c.client_name || 'موكل'} — ${c.case_number || ''}`,
        body: `${c.court || ''}${b.notes ? '\n' + b.notes : ''}\n(مستني النت عشان يتبعت)`,
        start: b.session_date, end: b.session_date, _pending: true }] });
    }
    await editObj(`/api/cases/${b.case_id}/profile`, p => ({ ...p, sessions: [{ id: tempId, session_date: b.session_date, notes: b.notes || null, _pending: true }, ...(p.sessions || [])] }));
    return;
  }

  // ----- إضافة -----
  if (method === 'POST' && id == null && !sub) {
    const item = { ...b, id: tempId, created_at: nowIso(), _pending: true };
    if (res === 'cases') {
      const cl = (await listOf('/api/clients')).find(x => x.id === Number(b.client_id));
      Object.assign(item, { status: 'مفتوحة', client_name: cl?.name || null });
    }
    if (res === 'clients') item.account_status = { has_account: false };
    if (res === 'tasks') item.status = item.status || 'مفتوحة';
    if (res === 'fees') Object.assign(item, { amount_paid: Number(b.amount_paid) || 0, status: b.status || 'مستحق' });
    await editKeys(activeListKeyFor(res), arr => [item, ...arr]);
    // يبان في ملف القضية كمان
    if (b.case_id && ['tasks', 'fees'].includes(res)) {
      await editObj(`/api/cases/${b.case_id}/profile`, p => ({ ...p, [res]: [item, ...(p[res] || [])] }));
    }
    if (res === 'cases' && b.client_id) {
      await editObj(`/api/clients/${b.client_id}/profile`, p => ({ ...p, cases: [item, ...(p.cases || [])] }));
    }
    return;
  }

  // ----- تعديل -----
  if ((method === 'PATCH' || method === 'PUT') && id != null) {
    const patch = sub === 'done' ? { status: 'منجزة' } : (sub ? null : b);
    if (!patch) return;
    await editKeys(listKeyFor(res), arr => arr.map(x => (x.id === id ? { ...x, ...patch, _pending: true } : x)));
    const single = { cases: 'case', clients: 'client', tasks: 'task' }[res];
    if (single) await editObj(`/api/${res}/${id}/profile`, p => ({ ...p, [single]: { ...(p[single] || {}), ...patch } }));
    return;
  }

  // ----- حذف -----
  if (method === 'DELETE' && id != null) {
    await editKeys(listKeyFor(res), arr => arr.filter(x => x.id !== id));
    // من ملفات القضايا كمان (مستند/مهمة/أتعاب اتمسحت)
    const prof = (await allResponseKeys()).filter(k => /^\/api\/cases\/-?\d+\/profile$/.test(k));
    const field = { documents: 'documents', tasks: 'tasks', fees: 'fees' }[res];
    if (field) for (const k of prof) await editObj(k, p => ({ ...p, [field]: (p[field] || []).filter(x => x.id !== id) }));
  }
}

// ---------------- الإرسال لما النت يرجع ----------------
// الأرقام المؤقتة (سالبة) بتتبدّل بالحقيقية: في المسار، والـ query، والـ body
function resolveIds(item, idMap) {
  const missing = new Set();
  // الأرقام المؤقتة بتظهر بس في حقول id أو ..._id (أو مصفوفات زي user_ids)
  const isIdKey = k => k === 'id' || /_ids?$/.test(k);
  const swapId = v => {
    if (typeof v !== 'number' || v >= 0) return v;
    if (idMap[v] != null) return idMap[v];
    missing.add(v);
    return v;
  };
  const deep = (v, key = '') => {
    if (Array.isArray(v)) return v.map(x => deep(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x, k)]));
    return isIdKey(key) ? swapId(v) : v;
  };
  const path = item.path.replace(/([/=])(-\d+)(?=$|[/?&])/g, (m, pre, n) => {
    const real = idMap[Number(n)];
    if (real == null) { missing.add(Number(n)); return m; }
    return pre + real;
  });
  let body = item.body;
  if (item.kind === 'json' && body != null) body = JSON.stringify(deep(parseBody(body)));
  return { path, body, missing: [...missing] };
}

let syncing = false;
/** يبعت كل اللي في صندوق الصادر بالترتيب. بيرجع { sent, failed: [{label, error}] } */
export async function syncOutbox() {
  if (syncing || !navigator.onLine) return { sent: 0, failed: [] };
  syncing = true;
  const result = { sent: 0, failed: [] };
  const idMap = (await meta.get('id_map')) || {};
  try {
    const items = await tx('outbox', 'readonly', s => reqP(s.getAll()));
    // عمليات اتأجلت (السيرفر رفضها مؤقتاً) — اللي بيعتمد عليها بيستناها، والباقي بيكمّل عادي
    const held = new Set();
    for (const it of items) {
      const { path, body, missing } = resolveIds(it, idMap);
      if (missing.length) {
        if (missing.every(t => held.has(t))) {
          // معتمدة على عملية لسه مستنية → تستنى معاها
          if (it.tempId != null) held.add(it.tempId);
          continue;
        }
        // معتمدة على إضافة فشلت نهائياً
        await tx('outbox', 'readwrite', s => s.delete(it.id));
        result.failed.push({ label: it.label, error: 'اتلغت لأن العملية اللي قبلها (اللي بتعتمد عليها) ما اتبعتتش' });
        continue;
      }
      let res;
      try {
        const headers = { authorization: 'Bearer ' + (localStorage.getItem(STORAGE_KEYS.TOKEN) || '') };
        if (it.kind === 'upload') headers['content-type'] = it.contentType || 'application/octet-stream';
        else headers['content-type'] = 'application/json';
        res = await fetch(API_BASE + path, { method: it.method, headers, body: it.kind === 'upload' ? it.blob : (body ?? undefined) });
      } catch {
        break; // النت لسه مش ثابت — نكمّل بعدين
      }
      if (res.ok) {
        if (it.tempId != null) {
          const j = await res.json().catch(() => ({}));
          const realId = j?.data?.id ?? j?.id;
          if (realId != null) { idMap[it.tempId] = realId; await meta.set('id_map', idMap); }
        }
        await tx('outbox', 'readwrite', s => s.delete(it.id));
        result.sent++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
        // مرفوضة (صلاحيات/بيانات/اتمسحت من حد تاني) — نشيلها ونبلّغ
        const err = await res.json().catch(() => ({}));
        await tx('outbox', 'readwrite', s => s.delete(it.id));
        result.failed.push({ label: it.label, error: err.error || `HTTP ${res.status}` });
      } else {
        // سيرفر/جلسة — نحاول تاني بعدين. بعد 5 محاولات فاشلة بنشيلها عشان متوقفش الطابور للأبد
        const attempts = (it.attempts || 0) + 1;
        if (attempts >= 5 && res.status !== 401) {
          await tx('outbox', 'readwrite', s => s.delete(it.id));
          result.failed.push({ label: it.label, error: `السيرفر رفضها ${attempts} مرات (HTTP ${res.status})` });
          continue;
        }
        await tx('outbox', 'readwrite', s => s.put({ ...it, attempts }));
        if (res.status === 401) break; // الجلسة خلصت — مفيش فايدة نكمّل
        // نكمّل باقي العمليات المستقلة، واللي بيعتمد على دي يستناها
        if (it.tempId != null) held.add(it.tempId);
      }
    }
    if (!(await pendingCount())) await meta.set('id_map', {});
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
  // أكتر من تحديث في نفس الوقت → آخر واحد بس هو اللي يتطبق
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
    ? `📴 من غير إنترنت — شغّال على النسخة اللي على جهازك (آخر مزامنة ${time})${pending ? ` · ⏳ ${pending} عملية هتتبعت لما النت يرجع` : ''}`
    : `⏳ ${pending} عملية مستنية تتبعت… <button type="button" data-sync-now>ابعت دلوقتي</button>`;
  el.querySelector('[data-sync-now]')?.addEventListener('click', () => syncOutbox());
}

/** تشغيل: مزامنة لما النت يرجع + تحميل مسبق كل 15 دقيقة */
export function startOffline(fetchJson) {
  window.addEventListener('online', async () => {
    const r = await syncOutbox();
    // بعد الإرسال نحمّل كل حاجة من جديد (الأرقام المؤقتة بقت حقيقية)
    prefetchAll(fetchJson, { force: r.sent > 0 });
  });
  window.addEventListener('offline', updateBanner);
  syncOutbox().then(() => prefetchAll(fetchJson));
  setInterval(() => { if (navigator.onLine) prefetchAll(fetchJson); }, 15 * 60 * 1000);
  updateBanner();
}
