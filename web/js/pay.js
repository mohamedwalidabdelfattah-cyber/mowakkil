// web/js/pay.js
// صفحة الدفع اليدوي

import { API_BASE, STORAGE_KEYS } from './config.js';
import { apiJson } from './api.js';

(function checkAuth() {
  const t = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!t) {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan') || '';
    window.location.replace(plan ? `/signup?plan=${plan}` : '/signup');
  }
})();

let paymentInfo = null;
let selectedPlan = null;
let selectedMethod = null;
let token = null;

document.addEventListener('DOMContentLoaded', async () => {
  token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return;

  try {
    const data = await apiJson('/api/payment-requests/info');
    paymentInfo = data.data || data;
    renderPlans();
    renderMethods();
    await loadMyRequests();

    const urlParams = new URLSearchParams(window.location.search);
    const planFromUrl = urlParams.get('plan');
    if (planFromUrl && paymentInfo.plans[planFromUrl]) {
      const radio = document.querySelector(`input[name="plan"][value="${planFromUrl}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
    }
  } catch (e) {
    showStatus('⚠️ ' + e.message, 'bad');
  }
});

// ============================================================
// Render plans
// ============================================================
function renderPlans() {
  const el = document.getElementById('plan-options');
  const plans = paymentInfo.plans || {};

  el.innerHTML = Object.entries(plans).map(([key, p]) => {
    const isLifetime = p.type === 'lifetime';
    return `
      <label class="pay-option" data-plan="${key}">
        <input type="radio" name="plan" value="${key}">
        <div class="pay-option-body">
          <div class="pay-option-title">${p.name} ${isLifetime ? '💎' : ''}</div>
          <div class="pay-option-price">${p.price} ج / ${isLifetime ? 'مرة واحدة' : 'شهر'}</div>
        </div>
      </label>
    `;
  }).join('');

  el.querySelectorAll('input[name="plan"]').forEach(input => {
    input.addEventListener('change', () => {
      selectedPlan = input.value;
      el.querySelectorAll('.pay-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.plan === selectedPlan);
      });
      updateInfoBox();
    });
  });
}

// ============================================================
// Render methods
// ============================================================
function renderMethods() {
  const el = document.getElementById('method-options');
  const methods = [
    { key: 'vodafone_cash', label: '📱 فودافون كاش', enabled: paymentInfo.vodafone_cash?.enabled },
    { key: 'instapay',      label: '⚡ إنستاباي',     enabled: paymentInfo.instapay?.enabled },
  ];

  el.innerHTML = methods.filter(m => m.enabled).map(m => `
    <label class="pay-option" data-method="${m.key}">
      <input type="radio" name="method" value="${m.key}">
      <div class="pay-option-body">
        <div class="pay-option-title">${m.label}</div>
      </div>
    </label>
  `).join('');

  el.querySelectorAll('input[name="method"]').forEach(input => {
    input.addEventListener('change', () => {
      selectedMethod = input.value;
      el.querySelectorAll('.pay-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.method === selectedMethod);
      });
      updateInfoBox();
    });
  });
}

// ============================================================
// Update info box
// ============================================================
function updateInfoBox() {
  const box = document.getElementById('payment-info-box');
  const numEl = document.getElementById('pay-number');
  const nameEl = document.getElementById('pay-name');

  if (selectedPlan && selectedMethod) {
    const info = paymentInfo[selectedMethod];
    if (info) {
      numEl.textContent = info.number;
      nameEl.textContent = info.name ? '— ' + info.name : '';
      box.style.display = 'block';
    }
  } else {
    box.style.display = 'none';
  }
}

// ============================================================
// Copy number
// ============================================================
document.getElementById('copy-number')?.addEventListener('click', () => {
  const num = document.getElementById('pay-number').textContent;
  navigator.clipboard.writeText(num).then(() => {
    showStatus('✅ اتنسخ', 'ok');
    setTimeout(() => showStatus(''), 1500);
  });
});

// ============================================================
// Submit
// ============================================================
document.getElementById('pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedPlan) return showStatus('⚠️ اختار الباقة', 'bad');
  if (!selectedMethod) return showStatus('⚠️ اختار طريقة الدفع', 'bad');

  const sender_phone = document.getElementById('sender_phone').value.trim();
  const sender_name  = document.getElementById('sender_name').value.trim();
  const transfer_ref = document.getElementById('transfer_ref').value.trim();
  const notes        = document.getElementById('notes').value.trim();

  if (!sender_phone) return showStatus('⚠️ اكتب رقم اللي حوّل', 'bad');

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'جاري الإرسال...';

  try {
    const res = await fetch(API_BASE + '/api/payment-requests', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        plan: selectedPlan,
        method: selectedMethod,
        sender_phone,
        sender_name: sender_name || null,
        transfer_ref: transfer_ref || null,
        notes: notes || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الإرسال');

    document.getElementById('pay-form').style.display = 'none';
    document.getElementById('success-box').style.display = 'block';
    await loadMyRequests();

  } catch (err) {
    showStatus('⚠️ ' + err.message, 'bad');
    btn.disabled = false;
    btn.textContent = '📤 إرسال الطلب';
  }
});

// ============================================================
// Load my requests
// ============================================================
async function loadMyRequests() {
  const el = document.getElementById('my-requests');
  try {
    const list = await apiJson('/api/payment-requests/my');

    if (!list.length) {
      el.innerHTML = '<div class="empty">مفيش طلبات سابقة</div>';
      return;
    }

    const planNames = {
      starter: 'الأساسية', pro: 'الاحترافية', plus: 'المتقدمة',
      lifetime_basic: 'التأسيس (مدى الحياة)', lifetime_pro: 'المكتب المتكامل (مدى الحياة)'
    };
    const methodNames = { vodafone_cash: '📱 فودافون كاش', instapay: '⚡ إنستاباي' };
    const statusLabels = {
      pending:  '⏳ قيد المراجعة',
      approved: '✅ مقبول',
      rejected: '❌ مرفوض',
    };

    el.innerHTML = list.map(r => `
      <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
        <div class="top">
          <span class="name">${planNames[r.plan] || r.plan} — ${r.amount_egp} ج</span>
          <span class="badge ${r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'suspended' : 'trial'}">
            ${statusLabels[r.status] || r.status}
          </span>
        </div>
        <div class="meta" style="font-size:12.5px">
          ${methodNames[r.method] || r.method} · ${r.created_at?.slice(0, 16) || ''}
        </div>
        ${r.rejection_reason ? `
          <div style="font-size:12px;color:var(--danger);margin-top:4px">
            السبب: ${r.rejection_reason}
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

// ============================================================
// Helpers
// ============================================================
function showStatus(msg, type = '') {
  const el = document.getElementById('pay-status');
  el.textContent = msg;
  el.className = 'status ' + type;
}