// web/js/views/superadmin.js
// لوحة مسؤول المنصة

import { API_BASE } from '../config.js';
import { saApiJson, setSAToken, clearSAToken } from '../api.js';
import { esc, toast, fmtMoney, fmtDate } from '../ui.js';

let currentFilter = { search: '', plan: '', status: '' };
let currentOfficeId = null;
let currentPRStatus = 'pending';

// ============================================================
// Gate toggle
// ============================================================
export function toggleGate() {
  const lawyerCard = document.getElementById('lawyer-login-card');
  const saGate = document.getElementById('sa-gate');
  const saBody = document.getElementById('sa-body');

  if (!saGate) return console.error('❌ sa-gate مش موجود');
  if (!lawyerCard) return console.error('❌ lawyer-login-card مش موجود');

  const saOpen = !saGate.hidden;

  if (saOpen) {
    saGate.hidden = true;
    lawyerCard.hidden = false;
    if (saBody) saBody.hidden = true;
  } else {
    lawyerCard.hidden = true;
    saGate.hidden = false;
    if (saBody) saBody.hidden = true;
    setTimeout(() => document.getElementById('sa-email')?.focus(), 100);
  }
}

// ============================================================
// Login
// ============================================================
export async function doLogin() {
  const st = document.getElementById('sa-status');
  const email = document.getElementById('sa-email').value.trim();
  const password = document.getElementById('sa-pass').value;
  st.textContent = 'جاري الدخول...';
  st.className = 'status';

  try {
    const r = await fetch(API_BASE + '/api/superadmin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) {
      st.textContent = d.error || 'خطأ';
      st.className = 'status bad';
      return;
    }

    const token = d.token || d.data?.token;
    if (!token) {
      st.textContent = 'لم يتم استلام توكن';
      st.className = 'status bad';
      return;
    }

    setSAToken(token);
    document.getElementById('sa-gate').hidden = true;
    document.getElementById('sa-body').hidden = false;
    document.getElementById('landing-view').hidden = true;
    document.getElementById('login-gate-view').hidden = true;
    document.getElementById('app-body').hidden = false;

    await renderSABody();
  } catch (err) {
    console.error('SA login error:', err);
    st.textContent = 'مش قادر يتصل بالـ API';
    st.className = 'status bad';
  }
}

export function doLogout() {
  clearSAToken();
  document.getElementById('sa-body').hidden = true;
  document.getElementById('sa-gate').hidden = true;
  document.getElementById('landing-view').hidden = false;
  document.getElementById('login-gate-view').hidden = true;
  document.getElementById('app-body').hidden = true;
}

// ============================================================
// Main SA body
// ============================================================
async function renderSABody() {
  const host = document.getElementById('sa-body');
  host.innerHTML = `
    <div class="app-top">
      <h2>🎛️ لوحة مسؤول المنصة</h2>
      <button class="btn btn-ghost" data-action="sa-logout">خروج</button>
    </div>

    <div id="sa-stats" class="stats"></div>

    <!-- 🤖 أدوات الذكاء الاصطناعي -->
    <div class="card" style="margin-bottom:20px">
      <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <h3 style="margin:0">🤖 الذكاء الاصطناعي (نماذج مجانية)</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-action="ai-health">🩺 فحص النماذج</button>
          <button class="btn btn-primary" data-action="ai-reindex">📚 فهرسة المواد القانونية</button>
        </div>
      </div>
      <div id="sa-ai-out" style="font-size:13.5px;margin-top:10px;color:var(--text-soft)">
        افحص النماذج للتأكد إن مفاتيح Groq وGemini شغالة. الفهرسة مطلوبة مرة واحدة عشان البحث الدلالي في المواد القانونية يشتغل.
      </div>
    </div>

    <!-- 💳 طلبات الدفع -->
    <div class="card" style="margin-bottom:20px">
      <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <h3 style="margin:0">💳 طلبات الدفع</h3>
        <select id="sa-pr-status" class="select" style="max-width:180px">
          <option value="pending" selected>⏳ قيد المراجعة</option>
          <option value="approved">✅ مقبولة</option>
          <option value="rejected">❌ مرفوضة</option>
          <option value="all">الكل</option>
        </select>
      </div>
      <div id="sa-payment-requests"></div>
    </div>

    <!-- 🏢 المكاتب -->
    <div class="card">
      <div class="section-header" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
        <h3 style="margin:0">🏢 المكاتب</h3>
        <input id="sa-search" class="input" placeholder="ابحث باسم المكتب..." style="max-width:240px">
        <select id="sa-filter-plan" class="select" style="max-width:180px">
          <option value="">كل الباقات</option>
          <option value="starter">أساسية</option>
          <option value="pro">احترافية</option>
          <option value="plus">متقدمة</option>
          <option value="lifetime_basic">تأسيس (مدى الحياة)</option>
          <option value="lifetime_pro">متكامل (مدى الحياة)</option>
        </select>
        <select id="sa-filter-status" class="select" style="max-width:140px">
          <option value="">كل الحالات</option>
          <option value="trial">تجربة</option>
          <option value="active">نشط</option>
          <option value="expired">منتهي</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>
      <div id="sa-offices-list"></div>
    </div>
  `;

  host.querySelector('[data-action="sa-logout"]').addEventListener('click', doLogout);
  host.querySelector('[data-action="ai-health"]').addEventListener('click', runAiHealth);
  host.querySelector('[data-action="ai-reindex"]').addEventListener('click', runReindex);

  const searchInput = host.querySelector('#sa-search');
  const planSelect = host.querySelector('#sa-filter-plan');
  const statusSelect = host.querySelector('#sa-filter-status');

  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentFilter.search = searchInput.value.trim();
      loadOffices();
    }, 300);
  });
  planSelect.addEventListener('change', () => {
    currentFilter.plan = planSelect.value;
    loadOffices();
  });
  statusSelect.addEventListener('change', () => {
    currentFilter.status = statusSelect.value;
    loadOffices();
  });

  host.querySelector('#sa-pr-status').addEventListener('change', (e) => {
    currentPRStatus = e.target.value;
    loadPaymentRequests();
  });

  await Promise.all([loadStats(), loadOffices(), loadPaymentRequests()]);
}

// ============================================================
// AI tools
// ============================================================
async function runAiHealth() {
  const out = document.getElementById('sa-ai-out');
  out.textContent = '⏳ جاري فحص النماذج...';
  try {
    const d = await saApiJson('/api/superadmin/ai/health');
    const rows = (d.providers || []).map(p => `
      <div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-soft)">
        <span>${p.ok ? '✅' : '❌'} <strong>${esc(p.provider)}</strong> <span class="mono" style="font-size:12px">${esc(p.model || '')}</span></span>
        <span style="font-size:12px">${p.ok ? esc(p.ms + 'ms') : esc(p.error || '')}</span>
      </div>`).join('');
    const v = d.vectorize || {};
    out.innerHTML = `${rows}
      <div style="margin-top:8px">📚 المواد في الداتابيز: <strong>${esc(d.law_articles)}</strong> ·
        المفهرس في Vectorize: <strong>${esc(v.count ?? (v.error ? 'خطأ' : '—'))}</strong> ·
        بحث الويب (Tavily): ${d.tavily ? '✅' : '❌'}</div>`;
  } catch (e) {
    out.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span>`;
  }
}

async function runReindex() {
  const out = document.getElementById('sa-ai-out');
  if (!confirm('هيتم فهرسة كل المواد القانونية على دفعات (ممكن ياخد كام دقيقة). نكمل؟')) return;
  let after = 0;
  let total = 0;
  try {
    for (;;) {
      const d = await saApiJson('/api/superadmin/ai/reindex-laws', {
        method: 'POST',
        body: JSON.stringify({ after_id: after, limit: 25 }),
      });
      after = d.last_id;
      total = d.total || total;
      out.textContent = `⏳ تم فهرسة ${d.progress || 0} من ${total} مادة...`;
      if (d.done) break;
    }
    out.textContent = `✅ خلصت الفهرسة (${total} مادة). ممكن الأرقام في Vectorize تاخد دقيقة عشان تتحدث.`;
  } catch (e) {
    out.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span> — اضغط الزرار تاني عشان تكمل.`;
  }
}

// ============================================================
// Stats
// ============================================================
async function loadStats() {
  const el = document.getElementById('sa-stats');
  el.innerHTML = '<div class="stat"><div class="n">—</div><div class="l">جاري التحميل</div></div>';

  try {
    const s = await saApiJson('/api/superadmin/stats');
    el.innerHTML = `
      <div class="stat"><div class="l">🏢 المكاتب</div><div class="n primary">${s.total_offices}</div></div>
      <div class="stat"><div class="l">👥 المستخدمين</div><div class="n">${s.total_users}</div></div>
      <div class="stat"><div class="l">✅ اشتراكات نشطة</div><div class="n success">${s.by_status.active || 0}</div></div>
      <div class="stat"><div class="l">🎁 تجارب</div><div class="n warning">${s.by_status.trial || 0}</div></div>
      <div class="stat"><div class="l">💰 MRR (شهري)</div><div class="n">${fmtMoney(s.mrr_egp)} ج</div></div>
      <div class="stat"><div class="l">📈 ARR (سنوي)</div><div class="n success">${fmtMoney(s.arr_egp)} ج</div></div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// Payment Requests
// ============================================================
async function loadPaymentRequests() {
  const el = document.getElementById('sa-payment-requests');
  if (!el) return;
  el.innerHTML = '<div class="skeleton"></div>';

  try {
    const list = await saApiJson(`/api/superadmin/payment-requests?status=${currentPRStatus}`);
    if (!list.length) {
      el.innerHTML = '<div class="empty">مفيش طلبات في القسم ده</div>';
      return;
    }

    const planNames = {
      starter: 'الأساسية', pro: 'الاحترافية', plus: 'المتقدمة',
      lifetime_basic: 'تأسيس (مدى الحياة)', lifetime_pro: 'متكامل (مدى الحياة)'
    };
    const methodNames = { vodafone_cash: '📱 فودافون كاش', instapay: '⚡ إنستاباي' };
    const statusLabels = {
      pending:  { label: '⏳ قيد المراجعة', cls: 'trial' },
      approved: { label: '✅ مقبول',       cls: 'active' },
      rejected: { label: '❌ مرفوض',       cls: 'suspended' },
    };

    el.innerHTML = list.map(r => {
      const st = statusLabels[r.status] || { label: r.status, cls: 'trial' };
      return `
        <div class="item" data-pr-id="${r.id}" style="cursor:pointer">
          <div class="top">
            <span class="name">${esc(r.office_name_ar || r.office_name || 'مكتب #' + r.office_id)}</span>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          <div class="meta">💎 ${planNames[r.plan] || r.plan} · 💰 ${fmtMoney(r.amount_egp)} ج</div>
          <div class="meta" style="font-size:12.5px">
            ${methodNames[r.method] || r.method} · 📱 ${esc(r.sender_phone || '—')} · 📅 ${esc(fmtDate(r.created_at))}
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-pr-id]').forEach(item => {
      item.addEventListener('click', () => openPRModal(Number(item.dataset.prId)));
    });

  } catch (e) {
    el.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// PR Modal
// ============================================================
async function openPRModal(prId) {
  document.getElementById('sa-pr-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'sa-pr-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:480px">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">💳 تفاصيل طلب الدفع</h3>
        <button class="icon-btn" data-action="close">✕</button>
      </div>
      <div id="sa-pr-content"><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]')) {
      modal.remove();
    }
  });

  try {
    const r = await saApiJson(`/api/superadmin/payment-requests/${prId}`);
    const planNames = {
      starter: 'الأساسية', pro: 'الاحترافية', plus: 'المتقدمة',
      lifetime_basic: 'تأسيس (مدى الحياة)', lifetime_pro: 'متكامل (مدى الحياة)'
    };
    const methodNames = { vodafone_cash: '📱 فودافون كاش', instapay: '⚡ إنستاباي' };
    const statusLabels = { pending: '⏳ قيد المراجعة', approved: '✅ مقبول', rejected: '❌ مرفوض' };
    const isPending = r.status === 'pending';

    document.getElementById('sa-pr-content').innerHTML = `
      <div style="text-align:center;padding:8px 0 16px;border-bottom:1px solid var(--border-soft);margin-bottom:16px">
        <div style="font-size:18px;font-weight:800">${esc(r.office_name_ar || r.office_name || 'مكتب #' + r.office_id)}</div>
        <div style="font-size:12.5px;color:var(--text-soft);margin-top:4px">طلب #${r.id} · ${esc(fmtDate(r.created_at))}</div>
      </div>

      <div class="card" style="margin-bottom:16px;background:var(--gray-50)">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px">
          <span>الباقة:</span><strong>${planNames[r.plan] || r.plan}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px">
          <span>المبلغ:</span><strong style="color:var(--primary)">${fmtMoney(r.amount_egp)} ج</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px">
          <span>طريقة الدفع:</span><strong>${methodNames[r.method] || r.method}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px">
          <span>رقم اللي حوّل:</span><strong style="font-family:var(--font-mono)">${esc(r.sender_phone || '—')}</strong>
        </div>
        ${r.sender_name ? `<div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px"><span>اسم اللي حوّل:</span><strong>${esc(r.sender_name)}</strong></div>` : ''}
        ${r.transfer_ref ? `<div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px"><span>رقم العملية:</span><strong style="font-family:var(--font-mono)">${esc(r.transfer_ref)}</strong></div>` : ''}
        ${r.notes ? `<div style="padding-top:10px;border-top:1px solid var(--border);font-size:13px"><strong>ملاحظات:</strong> ${esc(r.notes)}</div>` : ''}
      </div>

      <div style="text-align:center;margin-bottom:12px;font-size:14px;font-weight:700;color:var(--text-soft)">
        الحالة: ${statusLabels[r.status] || r.status}
      </div>

      ${isPending ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="label">مدة الاشتراك بعد الموافقة (يوم)</label>
          <input id="sa-pr-days" class="input" type="number" value="30" min="1" max="365">
          <button class="btn btn-primary btn-block" data-action="approve" style="margin-top:8px">✅ موافقة وتفعيل الاشتراك</button>
          <label class="label" style="margin-top:8px">سبب الرفض (لو هترفض)</label>
          <input id="sa-pr-reason" class="input" type="text" placeholder="مثلاً: لم يصل المبلغ">
          <button class="btn btn-ghost btn-block" data-action="reject" style="color:var(--danger)">❌ رفض الطلب</button>
        </div>
      ` : `
        ${r.rejection_reason ? `
          <div class="card" style="background:var(--danger-50,#FEF2F2);border:1px solid #FCA5A5">
            <div style="font-size:13px;color:#991B1B"><strong>سبب الرفض:</strong> ${esc(r.rejection_reason)}</div>
          </div>
        ` : ''}
      `}
    `;

    if (isPending) {
      modal.querySelector('[data-action="approve"]').addEventListener('click', async () => {
        const days = Number(document.getElementById('sa-pr-days').value) || 30;
        if (!confirm(`متأكد من الموافقة؟\nهيتم تفعيل الاشتراك لمدة ${days} يوم.`)) return;
        try {
          await saApiJson(`/api/superadmin/payment-requests/${prId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ days }),
          });
          toast('✅ تم التفعيل', 'ok');
          modal.remove();
          await Promise.all([loadStats(), loadOffices(), loadPaymentRequests()]);
        } catch (e) { toast(e.message, 'bad'); }
      });

      modal.querySelector('[data-action="reject"]').addEventListener('click', async () => {
        const reason = document.getElementById('sa-pr-reason').value.trim();
        if (!reason) return toast('اكتب سبب الرفض', 'bad');
        if (!confirm('متأكد من الرفض؟')) return;
        try {
          await saApiJson(`/api/superadmin/payment-requests/${prId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          });
          toast('❌ تم الرفض', 'ok');
          modal.remove();
          await loadPaymentRequests();
        } catch (e) { toast(e.message, 'bad'); }
      });
    }
  } catch (e) {
    document.getElementById('sa-pr-content').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// Offices list
// ============================================================
async function loadOffices() {
  const el = document.getElementById('sa-offices-list');
  el.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';

  try {
    const params = new URLSearchParams();
    if (currentFilter.search) params.set('search', currentFilter.search);
    if (currentFilter.plan)   params.set('plan', currentFilter.plan);
    if (currentFilter.status) params.set('status', currentFilter.status);

    const list = await saApiJson('/api/superadmin/offices?' + params.toString());
    if (!list.length) {
      el.innerHTML = '<div class="empty">مفيش مكاتب مطابقة</div>';
      return;
    }

    el.innerHTML = list.map(o => {
      const planLabels = {
        free: 'مجانية', starter: 'أساسية', pro: 'احترافية', plus: 'متقدمة',
        lifetime_basic: 'تأسيس (مدى الحياة)', lifetime_pro: 'متكامل (مدى الحياة)'
      };
      const statusLabels = { trial: '🎁 تجربة', active: '✅ نشط', expired: '⏰ منتهي', cancelled: '❌ ملغي' };

      let waUrl = '';
      if (o.owner_phone) {
        const cleanPhone = String(o.owner_phone).replace(/\D/g, '');
        const prefixed = cleanPhone.startsWith('20') ? cleanPhone : '2' + cleanPhone;
        const waMessage = encodeURIComponent(`مرحباً ${o.owner_name || ''}، أنا من منصة مُوكِّل. حابب أطمن على تجربتك للمنصة وأجاوب على أي استفسار.`);
        waUrl = `https://wa.me/${prefixed}?text=${waMessage}`;
      }

      return `
        <div class="item" data-office-id="${o.id}" style="cursor:pointer">
          <div class="top">
            <span class="name">${esc(o.name_ar || o.name || 'مكتب #' + o.id)}</span>
            <span class="badge ${o.sub_status === 'active' ? 'active' : o.sub_status === 'trial' ? 'trial' : 'suspended'}">
              ${statusLabels[o.sub_status] || o.sub_status || '—'}
            </span>
          </div>
          <div class="meta">
            💎 ${planLabels[o.sub_plan] || o.sub_plan || '—'}
            · 👥 ${o.users_count} مستخدم · 📁 ${o.cases_count} قضية · 👤 ${o.clients_count} موكل
          </div>
          <div class="meta" style="font-size:12px">
            ${o.owner_name ? `👤 ${esc(o.owner_name)}` : ''}
            ${o.owner_phone ? ` · 📱 ${esc(o.owner_phone)}` : ''}
            ${o.owner_email ? ` · ✉️ ${esc(o.owner_email)}` : ''}
          </div>
          ${o.sub_trial_ends_at || o.sub_expires_at ? `
            <div class="meta" style="font-size:12px">
              📅 ${o.sub_status === 'trial' ? 'تنتهي التجربة' : 'يتجدد'}: ${esc(fmtDate(o.sub_trial_ends_at || o.sub_expires_at))}
            </div>
          ` : ''}
          ${waUrl ? `
            <div style="margin-top:6px">
              <a href="${waUrl}" target="_blank" rel="noopener"
                 onclick="event.stopPropagation()"
                 class="btn btn-ghost btn-sm" style="color:var(--success);font-size:12px;display:inline-flex;align-items:center;gap:4px">
                💬 واتساب
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-office-id]').forEach(item => {
      item.addEventListener('click', () => openOfficeModal(Number(item.dataset.officeId)));
    });
  } catch (e) {
    el.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// Office Modal
// ============================================================
async function openOfficeModal(officeId) {
  currentOfficeId = officeId;
  document.getElementById('sa-office-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'sa-office-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">🏢 تفاصيل المكتب</h3>
        <button class="icon-btn" data-action="close">✕</button>
      </div>
      <div id="sa-office-content"><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]')) {
      modal.remove();
    }
  });

  try {
    const data = await saApiJson(`/api/superadmin/offices/${officeId}`);
    const { office, subscription: sub, history } = data;

    const planLabels = {
      free: 'المجانية', starter: 'الأساسية', pro: 'الاحترافية', plus: 'المتقدمة',
      lifetime_basic: 'التأسيس (مدى الحياة)', lifetime_pro: 'المكتب المتكامل (مدى الحياة)'
    };
    const statusLabels = { trial: '🎁 تجربة', active: '✅ نشط', expired: '⏰ منتهي', cancelled: '❌ ملغي' };

    let waUrl = '';
    if (office.owner_phone) {
      const cleanPhone = String(office.owner_phone).replace(/\D/g, '');
      const prefixed = cleanPhone.startsWith('20') ? cleanPhone : '2' + cleanPhone;
      const waMessage = encodeURIComponent(`مرحباً ${office.owner_name || ''}، أنا من منصة مُوكِّل. حابب أطمن على تجربتك للمنصة وأجاوب على أي استفسار.`);
      waUrl = `https://wa.me/${prefixed}?text=${waMessage}`;
    }

    document.getElementById('sa-office-content').innerHTML = `
      <div style="text-align:center;padding:8px 0 16px;border-bottom:1px solid var(--border-soft);margin-bottom:16px">
        <div style="font-size:20px;font-weight:800">${esc(office.name_ar || office.name)}</div>
        <div style="font-size:12.5px;color:var(--text-soft);margin-top:4px">ID: ${office.id} · اتعمل: ${esc(fmtDate(office.created_at))}</div>
      </div>

      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><div class="l">👥 مستخدمين</div><div class="n">${office.users_count}</div></div>
        <div class="stat"><div class="l">📁 قضايا</div><div class="n">${office.cases_count}</div></div>
        <div class="stat"><div class="l">👤 موكلين</div><div class="n">${office.clients_count}</div></div>
      </div>

      ${office.owner_name || office.owner_phone || office.owner_email ? `
        <div class="card" style="margin-bottom:12px;background:var(--gray-50)">
          <h4 style="margin:0 0 12px;font-size:14px">👤 بيانات صاحب المكتب</h4>
          ${office.owner_name ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13.5px"><span>الاسم:</span><strong>${esc(office.owner_name)}</strong></div>` : ''}
          ${office.owner_phone ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13.5px"><span>الهاتف:</span><strong style="font-family:var(--font-mono)">${esc(office.owner_phone)}</strong></div>` : ''}
          ${office.owner_email ? `<div style="display:flex;justify-content:space-between;font-size:13.5px"><span>الإيميل:</span><strong>${esc(office.owner_email)}</strong></div>` : ''}
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" rel="noopener"
               class="btn btn-primary btn-block" style="margin-top:12px;text-decoration:none;text-align:center;display:block;background:#25D366;border-color:#25D366">
              💬 تواصل واتساب
            </a>
          ` : ''}
        </div>
      ` : ''}

      <div class="card" style="margin-bottom:12px;background:var(--gray-50)">
        <h4 style="margin:0 0 12px;font-size:14px">💎 الاشتراك الحالي</h4>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13.5px"><span>الباقة:</span><strong>${planLabels[sub?.plan] || sub?.plan || '—'}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13.5px"><span>الحالة:</span><strong>${statusLabels[sub?.status] || sub?.status || '—'}</strong></div>
        ${sub?.trial_ends_at || sub?.expires_at ? `
          <div style="display:flex;justify-content:space-between;font-size:13.5px">
            <span>التاريخ:</span><strong>${esc(fmtDate(sub.trial_ends_at || sub.expires_at))}</strong>
          </div>
        ` : ''}
      </div>

      <label class="label">🎛️ تغيير الباقة</label>
      <select id="sa-plan-select" class="select">
        <option value="starter" ${sub?.plan === 'starter' ? 'selected' : ''}>الأساسية (199 ج/شهر)</option>
        <option value="pro" ${sub?.plan === 'pro' ? 'selected' : ''}>الاحترافية (399 ج/شهر)</option>
        <option value="plus" ${sub?.plan === 'plus' ? 'selected' : ''}>المتقدمة (799 ج/شهر)</option>
        <option value="lifetime_basic" ${sub?.plan === 'lifetime_basic' ? 'selected' : ''}>التأسيس (مدى الحياة - 4999 ج)</option>
        <option value="lifetime_pro" ${sub?.plan === 'lifetime_pro' ? 'selected' : ''}>المكتب المتكامل (مدى الحياة - 9999 ج)</option>
      </select>

      <button class="btn btn-primary btn-block" style="margin-top:12px" data-action="change-plan">
        💾 حفظ الباقة
      </button>

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-action="extend" data-days="15">+15 يوم</button>
        <button class="btn btn-ghost" data-action="extend" data-days="30">+30 يوم</button>
        <button class="btn btn-ghost" data-action="suspend" style="color:var(--danger)">⛔ إيقاف</button>
        <button class="btn btn-ghost" data-action="activate" style="color:var(--success)">✅ تفعيل</button>
      </div>

      <button class="btn btn-ghost btn-block" data-action="delete-office" style="color:var(--danger);margin-top:8px;border-color:var(--danger)">
        🗑️ حذف المكتب نهائيًا
      </button>

      ${history?.length ? `
        <details style="margin-top:16px">
          <summary style="cursor:pointer;font-size:13px;color:var(--text-soft)">📜 سجل التغييرات (${history.length})</summary>
          <div style="margin-top:8px;font-size:12.5px">
            ${history.map(h => `
              <div style="padding:6px 0;border-bottom:1px solid var(--border-soft)">
                ${esc(h.old_plan || '—')} → ${esc(h.new_plan)}
                <span style="color:var(--text-soft)"> · ${esc(fmtDate(h.created_at))}</span>
              </div>
            `).join('')}
          </div>
        </details>
      ` : ''}
    `;

    modal.querySelector('[data-action="change-plan"]').addEventListener('click', async () => {
      const plan = document.getElementById('sa-plan-select').value;
      try {
        await saApiJson(`/api/superadmin/offices/${officeId}/change-plan`, {
          method: 'POST',
          body: JSON.stringify({ plan, status: 'active', days: 30 }),
        });
        toast('✅ تم تحديث الباقة', 'ok');
        modal.remove();
        await Promise.all([loadStats(), loadOffices()]);
      } catch (e) { toast(e.message, 'bad'); }
    });

    modal.querySelectorAll('[data-action="extend"]').forEach(b => {
      b.addEventListener('click', async () => {
        try {
          await saApiJson(`/api/superadmin/offices/${officeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ extend_days: Number(b.dataset.days) }),
          });
          toast(`✅ اتمدّد ${b.dataset.days} يوم`, 'ok');
          modal.remove();
          openOfficeModal(officeId);
        } catch (e) { toast(e.message, 'bad'); }
      });
    });

    modal.querySelector('[data-action="suspend"]')?.addEventListener('click', async () => {
      try {
        await saApiJson(`/api/superadmin/offices/${officeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'suspended' }),
        });
        toast('⛔ تم الإيقاف', 'ok');
        modal.remove();
        await Promise.all([loadStats(), loadOffices()]);
      } catch (e) { toast(e.message, 'bad'); }
    });

    modal.querySelector('[data-action="activate"]')?.addEventListener('click', async () => {
      try {
        await saApiJson(`/api/superadmin/offices/${officeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' }),
        });
        toast('✅ تم التفعيل', 'ok');
        modal.remove();
        await Promise.all([loadStats(), loadOffices()]);
      } catch (e) { toast(e.message, 'bad'); }
    });

    modal.querySelector('[data-action="delete-office"]')?.addEventListener('click', async () => {
      if (!confirm('⚠️ متأكد؟ هيتم حذف كل بيانات المكتب:\n- القضايا\n- الموكلين\n- الفواتير\n- المستخدمين\n- الاشتراكات\n\nلا يمكن التراجع!')) return;
      if (!confirm('⚠️ تأكيد أخير — هل أنت متأكد 100%؟')) return;

      try {
        await saApiJson(`/api/superadmin/offices/${officeId}`, { method: 'DELETE' });
        toast('🗑️ تم حذف المكتب', 'ok');
        modal.remove();
        await Promise.all([loadStats(), loadOffices()]);
      } catch (e) {
        toast(e.message, 'bad');
      }
    });

  } catch (e) {
    document.getElementById('sa-office-content').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============================================================
// Render (fallback)
// ============================================================
export function render(host) {
  host.innerHTML = '<div class="card"><div class="empty">المسؤول له لوحة منفصلة — اضغط على "دخول مسؤول المنصة".</div></div>';
}