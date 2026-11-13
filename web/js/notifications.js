// web/js/notifications.js
// نظام الإشعارات في الواجهة

import { apiJson } from './api.js';
import { esc, toast } from './ui.js';

let pollingInterval = null;
let lastUnreadCount = 0;

// ============================================================
// بدء Polling
// ============================================================
export function startNotifications() {
  if (pollingInterval) return;

  // جلب أول مرة
  updateBadge();

  // كل 30 ثانية
  pollingInterval = setInterval(updateBadge, 30000);
}

export function stopNotifications() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// ============================================================
// تحديث Badge
// ============================================================
async function updateBadge() {
  try {
    const r = await apiJson('/api/notifications/count');
    const unread = r.unread || 0;

    // لو زاد العدد → نعرض toast
    if (unread > lastUnreadCount && lastUnreadCount !== 0) {
      const newCount = unread - lastUnreadCount;
      toast(`🔔 عندك ${newCount} إشعار جديد`, 'ok');
    }
    lastUnreadCount = unread;

    const btn = document.getElementById('notif-btn');
    if (!btn) return;

    // شيل أي badge قديم
    btn.querySelector('.notif-badge')?.remove();

    if (unread > 0) {
      const badge = document.createElement('span');
      badge.className = 'notif-badge';
      badge.textContent = unread > 99 ? '99+' : unread;
      btn.appendChild(badge);
      btn.style.position = 'relative';
    }
  } catch (e) {
    // صامت
  }
}

// ============================================================
// فتح Dropdown
// ============================================================
export async function openNotifications() {
  // شيل أي dropdown قديم
  document.getElementById('notif-dropdown')?.remove();

  const dropdown = document.createElement('div');
  dropdown.id = 'notif-dropdown';
  dropdown.className = 'notif-dropdown';
  dropdown.innerHTML = `
    <div class="notif-header">
      <div class="notif-header-title">🔔 الإشعارات</div>
      <div class="notif-header-actions">
        <button class="notif-action-btn" data-action="mark-all">قرأ الكل</button>
        <button class="notif-action-btn danger" data-action="clear-all">مسح</button>
      </div>
    </div>
    <div class="notif-list" id="notif-list">
      <div class="notif-loading">جاري التحميل...</div>
    </div>
  `;

  document.body.appendChild(dropdown);

  // Position
  const btn = document.getElementById('notif-btn');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 8) + 'px';
    dropdown.style.left = (rect.left - 300 + rect.width) + 'px';
  }

  // Close on click outside
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);

  // تحميل الإشعارات
  await loadNotifications(dropdown);

  // Events
  dropdown.querySelector('[data-action="mark-all"]').addEventListener('click', async () => {
    await apiJson('/api/notifications/mark-all-read', { method: 'POST' });
    await loadNotifications(dropdown);
    updateBadge();
  });

  dropdown.querySelector('[data-action="clear-all"]').addEventListener('click', async () => {
    if (!confirm('متأكد من مسح كل الإشعارات؟')) return;
    await apiJson('/api/notifications/clear-all', { method: 'DELETE' });
    await loadNotifications(dropdown);
    updateBadge();
  });
}

// ============================================================
// تحميل قائمة الإشعارات
// ============================================================
async function loadNotifications(dropdown) {
  const list = dropdown.querySelector('#notif-list');
  list.innerHTML = '<div class="notif-loading">جاري التحميل...</div>';

  try {
    const items = await apiJson('/api/notifications?limit=30');
    // apiJson بيرجع data مباشرة (نتيجة ok())
    const notifications = Array.isArray(items) ? items : (items.data || []);

    if (!notifications.length) {
      list.innerHTML = '<div class="notif-empty">🎉 مفيش إشعارات جديدة</div>';
      return;
    }

    list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon" data-priority="${n.priority}">${n.icon || '🔔'}</div>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(n.title)}</div>
          ${n.body ? `<div class="notif-item-text">${esc(n.body)}</div>` : ''}
          <div class="notif-item-time">${formatTime(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<div class="notif-item-dot"></div>' : ''}
      </div>
    `).join('');

    // Click على إشعار
    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        const notif = notifications.find(x => x.id == id);

        // علّم كمقروء
        if (!notif.is_read) {
          try {
            await apiJson(`/api/notifications/${id}/read`, { method: 'PATCH' });
            item.classList.remove('unread');
            item.classList.add('read');
            item.querySelector('.notif-item-dot')?.remove();
            updateBadge();
          } catch (e) {}
        }

        // انتقل للرابط لو موجود
        if (notif.link) {
          dropdown.remove();
          // لو الرابط hash (#case-X)
          if (notif.link.startsWith('#')) {
            const { showView } = await import('./router.js');
            showView('dashboard'); // fallback
            // أو حسب النوع
            if (notif.reference_type === 'case') showView('cases');
            else if (notif.reference_type === 'task') showView('tasks');
            else if (notif.reference_type === 'session') showView('agenda');
            else if (notif.reference_type === 'fee') showView('fees');
          }
        }
      });
    });

  } catch (e) {
    list.innerHTML = `<div class="notif-empty">فشل التحميل: ${esc(e.message)}</div>`;
  }
}

// ============================================================
// Helper: format الوقت
// ============================================================
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // بالثواني

  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;

  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}