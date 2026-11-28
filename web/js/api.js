// web/js/api.js
import { STORAGE_KEYS, API_BASE } from './config.js';
import { onAuthExpired, onTrialExpired, showUpgradeModal, showLimitModal, toast } from './ui.js';
import { enqueue, enqueueUpload, queueLabel, readResponse, saveResponse, isCacheable, updateBanner, clearOffline } from './offline.js';

export function getToken()   { return localStorage.getItem(STORAGE_KEYS.TOKEN) || ''; }
export function getSAToken() { return localStorage.getItem(STORAGE_KEYS.SA_TOKEN) || ''; }

export function getRole()    { return localStorage.getItem(STORAGE_KEYS.ROLE) || ''; }

export function setSession({ token, role, office_id }) {
  if (token)     localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  if (role)      localStorage.setItem(STORAGE_KEYS.ROLE, role);
  if (office_id) localStorage.setItem(STORAGE_KEYS.OFFICE, String(office_id));
}
export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ROLE);
  localStorage.removeItem(STORAGE_KEYS.OFFICE);
  localStorage.removeItem('mowakkil_access'); // صلاحيات المستخدم اللي خرج (web/js/access.js)
  // دولة وعملة وضريبة المكتب اللي خرج (اللي هيدخل بعده ممكن يكون مكتب في دولة تانية)
  ['mowakkil_country', 'mowakkil_currency', 'mowakkil_vat', 'mowakkil_date_mode'].forEach(k => localStorage.removeItem(k));
  clearOffline(); // بيانات الشغل من غير نت على الجهاز
}
export function setSAToken(t)  { localStorage.setItem(STORAGE_KEYS.SA_TOKEN, t); }
export function clearSAToken() { localStorage.removeItem(STORAGE_KEYS.SA_TOKEN); }

// ============================================================
// استخراج بيانات المستخدم من التوكن مباشرة (UTF-8 Safe)
// ============================================================
export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';

    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = JSON.parse(new TextDecoder().decode(bytes));

    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      user_id: decoded.user_id,
      office_id: decoded.office_id,
      role: decoded.role,
      name: decoded.name,
      client_user: decoded.client_user || false,
    };
  } catch (e) {
    console.error('Failed to parse JWT:', e);
    return null;
  }
}

export function getRoleFromToken() {
  const user = getCurrentUser();
  return user?.role || '';
}

export function getNameFromToken() {
  const user = getCurrentUser();
  return user?.name || localStorage.getItem('mowakkil_name') || '';
}

// ============================================================
// Simple cache (10 ثواني)
// ============================================================
const _cache = new Map();
const CACHE_TTL = 10 * 1000;

function getCached(key) {
  const item = _cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL) {
    _cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  _cache.set(key, { data, time: Date.now() });
}

export function clearCache() {
  _cache.clear();
}

// ============================================================
// HTTP helpers
// ============================================================
// silent: طلبات الخلفية (التحميل المسبق) متطلّعش نوافذ ترقية/حدود في وش المستخدم
async function handle(res, silent = false) {
  if (res.status === 401) { onAuthExpired(); throw new Error('انتهت الجلسة'); }
  if (res.status === 402) { onTrialExpired(); throw new Error('انتهت التجربة'); }

  // أول استخدام للذكاء الاصطناعي على بيانات موكلين → نافذة اختيار الخصوصية والموافقة
  if (res.status === 412) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.code === 'AI_CONSENT_REQUIRED') {
      import('./ai-privacy.js').then(m => m.showAiConsentModal()).catch(() => {});
      throw new Error(body.error || 'محتاج موافقة على خصوصية الذكاء الاصطناعي');
    }
  }

  // رصيد الذكاء الاصطناعي خلص (شهري حسب الباقة أو يومي)
  if (res.status === 429) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.code === 'AI_MONTHLY_LIMIT' || body?.code === 'AI_DAILY_LIMIT') {
      import('./ai-usage.js').then(m => m.showAiLimitModal(body)).catch(() => {});
      throw new Error(body.error || 'رصيد الذكاء الاصطناعي خلص');
    }
  }

  if (res.status === 403) {
    const cloned = res.clone();
    try {
      const body = await cloned.json();

      if (body?.code === 'UPGRADE_REQUIRED') {
        if (!silent) showUpgradeModal(body.feature, body.required_plan);
        throw new Error(body.error || 'الميزة دي محتاجة ترقية');
      }

      if (body?.code === 'LIMIT_REACHED') {
        if (!silent) showLimitModal(body);
        throw new Error(body.error || 'وصلت للحد الأقصى');
      }
    } catch (e) {
      if (e.message?.includes('ترقية') || e.message?.includes('الحد')) throw e;
    }
  }

  return res;
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (getToken()) headers.authorization = 'Bearer ' + getToken();
  if (opts.body && !(opts.body instanceof FormData) && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  const method = (opts.method || 'GET').toUpperCase();

  // من غير نت: العمليات المسموحة (تسجيل جلسة/تأجيل/مهمة) بتتحفظ على الجهاز وتتبعت لما النت يرجع
  // من غير نت: أي إضافة/تعديل/حذف بتتحفظ على الجهاز وتتبعت لما النت يرجع (web/js/offline.js)
  const queueOffline = async () => {
    const q = await enqueue(method, path, opts.body);
    clearCache();
    toast('📴 اتحفظ على الجهاز — هيتبعت لوحده أول ما النت يرجع', 'ok');
    // الإضافات بترجع رقم مؤقت زي السيرفر بالظبط (الشاشة تقدر تكمّل عليه)
    return new Response(JSON.stringify({ queued: true, id: q.id }),
      { status: 202, headers: { 'content-type': 'application/json' } });
  };
  const needsInternet = () => new Error('📴 العملية دي محتاجة إنترنت (ذكاء اصطناعي / دفع / دعوات / الفريق) — جرّب لما النت يرجع');
  if (method !== 'GET' && !navigator.onLine) {
    if (queueLabel(method, path)) return queueOffline();
    throw needsInternet();
  }

  let res;
  try {
    res = await fetch(API_BASE + path, { ...opts, headers });
  } catch (e) {
    // الشبكة وقعت أثناء الطلب
    if (method !== 'GET' && queueLabel(method, path)) return queueOffline();
    if (method !== 'GET') throw needsInternet();
    throw e;
  }
  // أي تعديل (إضافة/تعديل/حذف) ناجح → نمسح كاش القراءة عشان القوايم تتحدث فوراً
  if (method !== 'GET' && res.ok) clearCache();
  return handle(res, !!opts.silent);
}

export async function apiJson(path, opts = {}) {
  const isGet = !opts.method || opts.method === 'GET';

  if (isGet && !opts.skipCache) {
    const cached = getCached(path);
    if (cached !== null) return cached;
  }

  // من غير نت: آخر نسخة محفوظة على الجهاز
  const fromDevice = async () => {
    const saved = await readResponse(path);
    if (saved != null) { updateBanner(); return saved; }
    throw new Error('📴 مفيش إنترنت، والصفحة دي مش محفوظة على الجهاز — افتحها مرة وانت متصل');
  };
  if (isGet && !navigator.onLine && isCacheable(path)) return fromDevice();

  let res;
  try {
    res = await api(path, opts);
  } catch (e) {
    if (isGet && e instanceof TypeError && isCacheable(path)) return fromDevice();
    throw e;
  }
  // السيرفر واقع (5xx) → النسخة اللي على الجهاز أحسن من رسالة خطأ
  if (!res.ok && isGet && res.status >= 500 && isCacheable(path)) {
    try { return await fromDevice(); } catch {}
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // الرسالة زي ما هي + الكود والبيانات (عشان الشاشة تفرّق مثلاً بين "موكل مكرر" وأي خطأ تاني)
    const e = new Error(err.error || `HTTP ${res.status}`);
    e.status = res.status; e.code = err.code; e.data = err;
    throw e;
  }

  const data = await res.json();

  // طلب ذكاء اصطناعي نجح → العدّاد ينقص
  if (!isGet && /^\/api\/(chat|legal-search|generate-doc|analyze\/(contract|case|document)|cases\/\d+\/analyze)$/.test(path.split('?')[0])) {
    import('./ai-usage.js').then(m => m.notifyAiUsed()).catch(() => {});
  }

  if (isGet) {
    setCache(path, data);
    saveResponse(path, data); // نسخة للشغل من غير نت
  }

  return data;
}

export async function saApi(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (getSAToken()) headers.authorization = 'Bearer ' + getSAToken();
  if (opts.body && !headers['content-type']) headers['content-type'] = 'application/json';
  return fetch(API_BASE + path, { ...opts, headers });
}

export async function saApiJson(path, opts = {}) {
  const res = await saApi(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || `HTTP ${res.status}`);
    e.status = res.status; e.data = err;
    throw e;
  }
  return res.json();
}

// ============================================================
// رفع مستندات — مباشرة إلى Worker (بدون Presigned URL)
// ============================================================
export async function uploadDocument(file, { caseId = null, taskId = null, docType = null, notes = null } = {}) {
  if (!file) throw new Error('مفيش ملف');

  const params = new URLSearchParams();
  if (caseId) params.set('case_id', caseId);
  if (taskId) params.set('task_id', taskId);
  if (docType) params.set('doc_type', docType);
  if (notes) params.set('notes', String(notes).slice(0, 500));
  params.set('file_name', file.name);
  const path = `/api/documents?${params.toString()}`;

  // من غير نت: الملف بيتحفظ على الجهاز ويترفع أول ما النت يرجع
  const queueUpload = async () => {
    const q = await enqueueUpload(path, file, file.type || 'application/octet-stream');
    clearCache();
    toast(`📴 «${file.name}» اتحفظ على الجهاز — هيترفع أول ما النت يرجع`, 'ok');
    return { queued: true, id: q.id };
  };
  if (!navigator.onLine) return queueUpload();

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file, // الملف يمر عبر Worker (10 ميجا كحد أقصى)
    });
  } catch {
    return queueUpload();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `فشل الرفع (${res.status})`);
  }

  return res.json();
}

// ============================================================
// تحميل مستند — fetch على الـ API مع التوكن ثم تنزيل الـ blob
// ============================================================
export async function downloadDocument(id, name) {
  const res = await fetch(`${API_BASE}/api/documents/${id}/download`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });

  if (res.status === 401) { onAuthExpired(); throw new Error('انتهت الجلسة'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `فشل تحميل الملف (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// Subscription API
// ============================================================
let _subscriptionCache = null;

export async function fetchSubscription(force = false) {
  if (_subscriptionCache && !force) return _subscriptionCache;
  try {
    const data = await apiJson('/api/subscription/me', { skipCache: true });
    _subscriptionCache = data.data || data;
    return _subscriptionCache;
  } catch (e) {
    return null;
  }
}

export function getSubscriptionCache() {
  return _subscriptionCache;
}

export function clearSubscriptionCache() {
  _subscriptionCache = null;
}

export function hasFeature(feature) {
  if (!_subscriptionCache) return true;
  return _subscriptionCache.features?.[feature] === true;
}

export async function fetchPlans() {
  const data = await apiJson('/api/subscription/plans');
  return data.data || data;
}