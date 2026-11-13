// web/client/js/main.js
// بوابة الموكل — نقطة الدخول

import { initPortal } from './portal.js?v=7';

async function boot() {
  // 1. نربط الأحداث الأول (عشان الصفحة تكون جاهزة لأي حاجة)
  initPortal.bindEvents();

  // 2. نقرأ الـ URL
  const url = new URL(window.location.href);
  const inviteCode = url.searchParams.get('code');
  const isQuick = url.searchParams.get('quick') === '1';

  // 3. نقرر هنعمل إيه
  if (inviteCode && isQuick) {
    // ✅ Quick Login (من الرابط اللي فيه quick=1)
    console.log('Quick Login Mode: code =', inviteCode);
    await initPortal.quickLoginDirect(inviteCode);
  } else if (inviteCode) {
    // دخول عادي بالكود (عرض شاشة الدعوة)
    initPortal.showInviteGate(inviteCode);
  } else {
    // مفيش كود، نشوف لو فيه توكن محفوظ
    const token = localStorage.getItem('mowakkil_client_token');
    if (token) {
      await initPortal.tryShowDashboard();
    } else {
      initPortal.showLoginGate();
    }
  }
}

// ✅ ننتظر لحد ما الصفحة تحمل، وبعدين نشغل
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}