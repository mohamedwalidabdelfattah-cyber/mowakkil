// service-worker.js — مُوكِّل
//
// ⚠️ مش محتاج تغيّر أي رقم إصدار يدوي بعد كل تعديل:
//  - الكود (HTML / JS / CSS / manifest): من الشبكة الأول دايماً، والنسخة المحفوظة بس لو مفيش إنترنت.
//    → أي deploy جديد بيوصل للمستخدم من أول تحميل للصفحة.
//  - الصور والخطوط: من المحفوظ فوراً، وبتتحدث في الخلفية (stale-while-revalidate).
//  - مفيش إعادة تحميل تلقائية للصفحة، ومفيش تحميل مسبق لملفات تقيلة.
//
// غيّر CACHE_PREFIX بس لو غيّرت طريقة التخزين نفسها (نادر جداً).

const CACHE_PREFIX = 'mowakkil-v2';
const CODE_CACHE = `${CACHE_PREFIX}-code`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // نخزن الصفحة الرئيسية بس عشان التطبيق يفتح أوفلاين
  event.waitUntil(caches.open(CODE_CACHE).then(c => c.add('/').catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isCode = (url, req) =>
  req.mode === 'navigate' || /\.(html|js|mjs|css|webmanifest|json)$/.test(url.pathname) || url.pathname === '/';
const isAsset = url => /\.(png|jpe?g|webp|svg|ico|gif|woff2?|ttf)$/.test(url.pathname);

function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : null));
    const timer = setTimeout(async () => {
      const cached = await fromCache();
      if (cached && !settled) { settled = true; resolve(cached); }
    }, NETWORK_TIMEOUT_MS);

    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CODE_CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(async () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve((await fromCache()) || new Response('أنت غير متصل بالإنترنت', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }));
    });
  });
}

function staleWhileRevalidate(req) {
  return caches.open(ASSET_CACHE).then(cache => cache.match(req).then(cached => {
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API، ملف الـ APK، ملفات التحقق، وأي دومين خارجي (CDN) → المتصفح يتصرف عادي
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/downloads/') || url.pathname.startsWith('/.well-known/')) return;

  if (isAsset(url)) { event.respondWith(staleWhileRevalidate(req)); return; }
  if (isCode(url, req)) { event.respondWith(networkFirst(req)); return; }
});
