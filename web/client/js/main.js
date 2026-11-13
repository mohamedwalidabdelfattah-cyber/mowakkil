// web/client/js/main.js
// بوابة الموكل — نقطة الدخول

import { initPortal } from './portal.js?v=6';

const url = new URL(window.location.href);
const inviteCode = url.searchParams.get('code');
const isQuick = url.searchParams.get('quick') === '1';

// لو دخل برابط quick=1، جرب quick-login مباشرة
if (inviteCode && isQuick) {
  initPortal.quickLoginDirect(inviteCode);
} else if (inviteCode) {
  initPortal.showInviteGate(inviteCode);
} else {
  const token = localStorage.getItem('mowakkil_client_token');
  if (token) {
    initPortal.tryShowDashboard();
  } else {
    initPortal.showLoginGate();
  }
}

initPortal.bindEvents(); 
