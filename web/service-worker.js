// service-worker.js
// النسخة المحسنة: Cache First للملفات الثابتة + Network First للـ HTML

const CACHE_NAME = 'mowakkil-cache-v75';

// الملفات الأساسية اللي بنعملها كاش عشان التطبيق يشتغل أوفلاين
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/pricing.html',
  '/signup.html',
  '/pay.html',
  '/assets/styles.css',
  '/assets/design-system.css',
  '/assets/landing.css',
  '/assets/pricing.css',
  '/assets/fonts.css',
  '/assets/brand-theme.css',
  '/assets/styles.clean.css',
  '/js/main.js',
  '/js/api.js',
  '/js/ui.js',
  '/assets/app-icon.png',
  '/assets/logo.png',
  '/assets/logos/logo-md.png',
  '/assets/logos/logo-lg.png',
  '/assets/logos/icon-192.png',
  '/assets/logos/icon-512.png'
];

// 1. التثبيت: بنعمل كاش للملفات الأساسية
self.addEventListener('install', (event) => {
  self.skipWaiting(); // عشان الـ SW الجديد يشتغل فوراً
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('Precache failed for some assets:', err);
      });
    })
  );
});

// 2. التفعيل: بنمسح الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. الجلب (Fetch): استراتيجية مختلطة
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات الـ API (مش بنعملها كاش)
  if (url.pathname.includes('/api/')) {
    return;
  }

  // ملف التطبيق (APK) وملفات التحقق — دايماً من الشبكة ومن غير كاش
  if (url.pathname.startsWith('/downloads/') || url.pathname.startsWith('/.well-known/')) {
    return;
  }

  // تجاهل طلبات غير الـ GET
  if (event.request.method !== 'GET') {
    return;
  }

  // استراتيجية Cache First للملفات الثابتة (CSS, JS, Fonts, Images)
  if (url.pathname.match(/\.(css|js|woff2|woff|ttf|png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => null);

        // stale-while-revalidate: ارجع بالكاش فوراً وحدث في الخلفية
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // استراتيجية Network First لصفحات HTML
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// الاستماع لرسائل من الصفحة (عشان نقدر نعمل skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});