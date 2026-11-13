// service-worker.js
// الاستراتيجية: Network First (بيجيب من النت الأول، ولو فشل يجيب من الكاش)
// ده عشان أي تحديث يظهر فوراً بدون ما نغير رقم الإصدار يدوياً.

const CACHE_NAME = 'mowakkil-cache-v6';

// الملفات الأساسية اللي بنعملها كاش عشان التطبيق يشتغل أوفلاين
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/assets/styles.css',
  '/assets/design-system.css',
  '/assets/landing.css',
  '/assets/fonts.css',
  '/js/main.js',
  '/assets/app-icon.png',
  '/assets/logo.png'
];

// 1. التثبيت: بنعمل كاش للملفات الأساسية
self.addEventListener('install', (event) => {
  self.skipWaiting(); // عشان الـ SW الجديد يشتغل فوراً
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
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

// 3. الجلب (Fetch): Network First strategy
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات الـ API (مش بنعملها كاش)
  if (event.request.url.includes('/api/')) {
    return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // لو الطلب نجح، بنحدث الكاش بالنسخة الجديدة
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // لو النت قطع، بنجيب من الكاش
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
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
