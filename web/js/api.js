// web/js/api.js
import { STORAGE_KEYS, API_BASE } from './config.js';
import { onAuthExpired, onTrialExpired, showUpgradeModal, showLimitModal } from './ui.js';

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
async function handle(res) {
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

  if (res.status === 403) {
    const cloned = res.clone();
    try {
      const body = await cloned.json();

      if (body?.code === 'UPGRADE_REQUIRED') {
        showUpgradeModal(body.feature, body.required_plan);
        throw new Error(body.error || 'الميزة دي محتاجة ترقية');
      }

      if (body?.code === 'LIMIT_REACHED') {
        showLimitModal(body);
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

  const res = await fetch(API_BASE + path, { ...opts, headers });
  // أي تعديل (إضافة/تعديل/حذف) ناجح → نمسح كاش القراءة عشان القوايم تتحدث فوراً
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET' && res.ok) clearCache();
  return handle(res);
}

export async function apiJson(path, opts = {}) {
  const isGet = !opts.method || opts.method === 'GET';

  if (isGet && !opts.skipCache) {
    const cached = getCached(path);
    if (cached !== null) return cached;
  }

  const res = await api(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();

  if (isGet) setCache(path, data);

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
    throw new Error(err.error || `HTTP ${res.status}`);
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

  const res = await fetch(`${API_BASE}/api/documents?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file, // الملف يمر عبر Worker (10 ميجا كحد أقصى)
  });

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