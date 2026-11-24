// web/js/views/clients.js
import { apiJson } from '../api.js';
import { esc, empty, waLink, toast, fmtMoney, fmtDate, skeleton, bindPanels, cur, curName, localISO, monthStartISO, monthEndISO } from '../ui.js';
import { setClients } from '../state.js';
import { openWhatsAppComposer } from '../whatsapp.js';
import { waLinkFor } from '../phone.js';
import { mountExportMenu, filterMeta } from '../exporter.js';

// حالة الفلاتر
let currentFilters = {
  search: '',
  has_account: '', // '' | 'yes' | 'no'
};

export async function render(host) {
  // Skeleton احترافي
  host.innerHTML = `
    <div class="card">${skeleton(2, 'card')}</div>
    <div class="card">${skeleton(4, 'list')}</div>
  `;

  const loadAndRender = async () => {
    // بناء الـ query string
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    const qs = params.toString();
    const query = qs ? `?${qs}` : '';

    const list = await apiJson(`/api/clients${query}`);
    setClients(list);

    // حالة حساب البوابة جاية مع القايمة نفسها (account_status) — طلب واحد بدل طلب لكل موكل
    const statusMap = {};
    const missing = [];
    list.forEach(c => { if (c.account_status) statusMap[c.id] = c.account_status; else missing.push(c); });
    if (missing.length) {
      // توافق مع سيرفر قديم ما بيرجعش account_status
      const results = await Promise.all(missing.map(c =>
        apiJson(`/api/clients/account-status?client_id=${c.id}`)
          .then(s => ({ id: c.id, status: s }))
          .catch(() => ({ id: c.id, status: { has_account: false } }))));
      results.forEach(r => { statusMap[r.id] = r.status; });
    }

    // فلترة بالحساب (client-side filter)
    const filtered = list.filter(c => {
      if (currentFilters.has_account === '') return true;
      const has = statusMap[c.id]?.has_account;
      if (currentFilters.has_account === 'yes') return has;
      if (currentFilters.has_account === 'no') return !has;
      return true;
    });

    host.innerHTML = `
      <div class="app-top">
        <div>
          <h2>الموكلين</h2>
          <div class="meta" style="margin:2px 0 0">${list.length} موكل</div>
        </div>
        <button class="btn btn-primary" data-toggle-panel="client-panel">➕ موكل جديد</button>
      </div>

      <div class="card" id="client-panel" hidden>
        <h3>👥 إضافة موكل جديد</h3>
        <div class="row">
          <div><label>الاسم</label><input id="cl-name" placeholder="أحمد السيد"></div>
          <div><label>رقم الهاتف</label><input id="cl-phone" placeholder="01xxxxxxxxx"></div>
        </div>
        <label>الرقم القومي (اختياري)</label><input id="cl-national">
        <button class="primary" style="margin-top:10px" id="add-client">حفظ الموكل</button>
      </div>

      <!-- شريط الفلاتر -->
      <div class="filter-bar">
        <div class="filter-bar-inner">
          <div class="filter-item">
            <input type="text" class="filter-input" id="filter-search" 
                   placeholder="🔍 بحث بالاسم أو الهاتف..." 
                   value="${esc(currentFilters.search)}">
          </div>
          <div class="filter-item">
            <select class="filter-input" id="filter-has-account">
              <option value="">كل الموكلين</option>
              <option value="yes" ${currentFilters.has_account === 'yes' ? 'selected' : ''}>✅ عندهم حساب</option>
              <option value="no"  ${currentFilters.has_account === 'no' ? 'selected' : ''}>❌ مفيش حساب</option>
            </select>
          </div>
          <button class="btn btn-ghost filter-reset" id="filter-reset">🔄 مسح</button>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="meta" style="margin:0">${filtered.length} نتيجة</span>
        <div id="clients-export"></div>
      </div>

      <div id="clients-list">
        ${filtered.length 
          ? filtered.map(c => clientItem(c, statusMap[c.id])).join('') 
          : empty(
              currentFilters.search || currentFilters.has_account
                ? 'مفيش نتايج مطابقة للفلاتر'
                : 'مفيش موكلين لحد الآن',
              '👥'
            )
        }
      </div>
    `;

    bindPanels(host);

    // التصدير (القايمة بعد الفلترة)
    const accountLabel = s => !s?.has_account ? 'لا يوجد'
      : (!s.has_password && s.invite_pending) ? 'دعوة معلقة'
      : (!s.has_password && s.invite_expired) ? 'دعوة منتهية'
      : (s.has_password && s.active) ? 'مفعّل' : 'معلّق';
    mountExportMenu(host.querySelector('#clients-export'), () => ({
      title: 'قائمة الموكلين',
      meta: filterMeta([
        ['بحث', currentFilters.search],
        ['الحساب', { yes: 'عندهم حساب', no: 'بدون حساب' }[currentFilters.has_account]],
      ]),
      blocks: [{
        type: 'table',
        columns: [
          { label: 'الاسم', key: 'name' },
          { label: 'الهاتف', key: 'phone' },
          { label: 'الرقم القومي', key: 'national_id' },
          { label: 'حساب البوابة', value: c => accountLabel(statusMap[c.id]) },
          { label: 'تاريخ الإضافة', key: 'created_at', type: 'date' },
        ],
        rows: filtered,
      }],
    }), { filename: 'الموكلين' });

    // ربط أحداث الفلاتر
    let searchTimeout;
    host.querySelector('#filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        loadAndRender();
      }, 500);
    });

    host.querySelector('#filter-has-account')?.addEventListener('change', (e) => {
      currentFilters.has_account = e.target.value;
      loadAndRender();
    });

    host.querySelector('#filter-reset')?.addEventListener('click', () => {
      currentFilters = { search: '', has_account: '' };
      loadAndRender();
    });

    // ربط أحداث إضافة الموكل
    host.querySelector('#add-client')?.addEventListener('click', () => addClient(host));

    // ربط أحداث كل موكل
    host.querySelector('#clients-list').addEventListener('click', async e => {
      const view = e.target.closest('[data-view-client]');
      const del  = e.target.closest('[data-del-client]');
      const inv  = e.target.closest('[data-invite-client]');
      const can  = e.target.closest('[data-cancel-invite]');
      const tog  = e.target.closest('[data-toggle-active]');
      const res  = e.target.closest('[data-resend-invite]');
      const dacc = e.target.closest('[data-delete-account]');

      const wa = e.target.closest('[data-wa-client]');
      if (wa) return openWhatsAppComposer({ kind: 'general', phone: wa.dataset.waPhone, client_name: wa.dataset.waName });
      if (view) return showProfile(view.dataset.viewClient);
      if (del) {
        if (!confirm('متأكد من حذف الموكل؟')) return;
        await apiJson(`/api/clients/${del.dataset.delClient}`, { method: 'DELETE' });
        toast('اتحذف', 'ok');
        loadAndRender();
      }
      if (inv)  return sendInvite(host, Number(inv.dataset.inviteClient));
      if (can)  return cancelInvite(host, Number(can.dataset.cancelInvite));
      if (tog)  return toggleActive(host, Number(tog.dataset.toggleActive));
      if (res)  return resendInvite(host, Number(res.dataset.resendInvite));
      if (dacc) return deleteAccount(host, Number(dacc.dataset.deleteAccount));
    });
  };

  await loadAndRender();
}

// ============================================================
// شكل الموكل مع حالة الحساب
// ============================================================
function clientItem(c, status) {
  const hasAccount = status?.has_account;
  const isActive = status?.active;
  const hasPassword = status?.has_password;
  const pending = status?.invite_pending;

  let accountBadge = '';
  if (hasAccount) {
    if (!isActive) {
      accountBadge = `<span class="badge suspended">🚫 معطّل</span>`;
    } else if (!hasPassword && pending) {
      accountBadge = `<span class="badge trial">⏳ دعوة معلقة</span>`;
    } else if (!hasPassword && status?.invite_expired) {
      accountBadge = `<span class="badge suspended">⌛ دعوة منتهية</span>`;
    } else if (hasPassword) {
      accountBadge = `<span class="badge active">✅ مفعّل</span>`;
    } else if (!hasPassword && !pending) {
      accountBadge = `<span class="badge suspended">✖ الدعوة اتلغت</span>`;
    }
  }
  // دعوة اتلغت وما اتعملش باسورد → نسمح بدعوة جديدة (قبل كده كان الموكل بيفضل من غير أي زرار)
  const cancelledInvite = hasAccount && !hasPassword && !pending && isActive;

  return `
    <div class="item">
      <div class="top">
        <span class="name">${esc(c.name)}</span>
        <span class="num mono">${esc(c.phone || '')}</span>
      </div>
      ${accountBadge ? `<div style="margin-top:6px">${accountBadge}</div>` : ''}
      <div class="acts">
        ${c.phone ? `<button class="ghost wa-ghost" data-wa-client="${c.id}" data-wa-phone="${esc(c.phone)}" data-wa-name="${esc(c.name)}">💬 واتساب</button>` : ''}
        ${!hasAccount || cancelledInvite ? `
          <button class="ghost" data-invite-client="${c.id}" style="color:var(--ok)">📱 إرسال دعوة</button>
        ` : ''}
        ${hasAccount && isActive && !hasPassword && pending ? `
          <button class="ghost" data-resend-invite="${c.id}" style="color:var(--ok)">🔄 إعادة الدعوة</button>
          <button class="ghost" data-cancel-invite="${c.id}" style="color:var(--bad)">❌ إلغاء الدعوة</button>
        ` : ''}
        ${hasAccount ? `
          <button class="ghost" data-toggle-active="${c.id}" style="color:${isActive ? 'var(--bad)' : 'var(--ok)'}">
            ${isActive ? '🚫 تعطيل الحساب' : '✅ تفعيل الحساب'}
          </button>
        ` : ''}
        ${hasAccount && hasPassword && isActive ? `
          <button class="ghost" data-resend-invite="${c.id}" style="color:var(--brass-deep)">🔄 إعادة تعيين</button>
        ` : ''}
        ${hasAccount && !isActive ? `
          <button class="ghost" data-delete-account="${c.id}" style="color:var(--bad)">🗑 حذف الحساب</button>
        ` : ''}
        <button class="ghost" data-view-client="${c.id}" style="color:var(--primary);font-weight:700">👁 ملف</button>
        <button class="ghost" data-del-client="${c.id}" style="color:var(--bad)">🗑 حذف الموكل</button>
      </div>
    </div>`;
}

// ============================================================
// إضافة موكل
// ============================================================
async function addClient(host) {
  const name = document.getElementById('cl-name').value.trim();
  if (!name) return toast('اكتب اسم الموكل', 'bad');
  await apiJson('/api/clients', {
    method: 'POST',
    body: JSON.stringify({
      name,
      phone: document.getElementById('cl-phone').value.trim(),
      national_id: document.getElementById('cl-national').value.trim(),
    }),
  });
  toast('اتحفظ ✓', 'ok');
  render(host);
}

// ============================================================
// إرسال دعوة
// ============================================================
async function sendInvite(host, clientId) {
  try {
    const invite = await apiJson('/api/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId }),
    });

    const officeName = document.getElementById('topbar-title')?.textContent || 'المكتب';
    const message = buildMessage(invite, officeName);

    const clients = await apiJson('/api/clients');
    const client = clients.find(c => c.id === clientId);

    if (!client || !client.phone) {
      navigator.clipboard.writeText(message);
      toast('تم نسخ الرسالة ✓', 'ok');
      showInviteModal(invite, message, host);
      return;
    }

    const waUrl = waLinkFor(client.phone, message);
    if (!waUrl) { navigator.clipboard.writeText(message).catch(() => {}); toast('رقم الموكل مش مظبوط — اتنسخت الرسالة', 'bad'); showInviteModal(invite, message, host); return; }
    window.open(waUrl, '_blank');

    toast('تم فتح WhatsApp ✓', 'ok');
    showInviteModal(invite, message, host);
  } catch (e) {
    toast('فشل: ' + e.message, 'bad');
  }
}

// ============================================================
// إلغاء الدعوة
// ============================================================
async function cancelInvite(host, clientId) {
  if (!confirm('متأكد من إلغاء الدعوة؟')) return;
  try {
    await apiJson('/api/clients/cancel-invite', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId }),
    });
    toast('اتلغت الدعوة', 'ok');
    render(host);
  } catch (e) {
    toast('فشل: ' + e.message, 'bad');
  }
}

// ============================================================
// تعطيل/تفعيل
// ============================================================
async function toggleActive(host, clientId) {
  try {
    const r = await apiJson('/api/clients/toggle-active', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId }),
    });
    toast(r.active ? '✅ تم التفعيل' : '🚫 تم التعطيل', 'ok');
    render(host);
  } catch (e) {
    toast('فشل: ' + e.message, 'bad');
  }
}

// ============================================================
// إعادة إرسال الدعوة (Reset Password)
// ============================================================
async function resendInvite(host, clientId) {
  if (!confirm('هيتم إنشاء كود جديد، والباسورد القديم يبقى مش شغال. متأكد؟')) return;
  try {
    const invite = await apiJson('/api/clients/resend-invite', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId }),
    });

    const officeName = document.getElementById('topbar-title')?.textContent || 'المكتب';
    const message = buildMessage(invite, officeName);

    if (invite.phone) {
      const waUrl = waLinkFor(invite.phone, message);
      if (waUrl) window.open(waUrl, '_blank');
      else navigator.clipboard.writeText(message).catch(() => {});
    } else {
      navigator.clipboard.writeText(message);
    }

    toast('تم إنشاء دعوة جديدة ✓', 'ok');
    showInviteModal(invite, message, host);
  } catch (e) {
    toast('فشل: ' + e.message, 'bad');
  }
}

// ============================================================
// حذف الحساب
// ============================================================
async function deleteAccount(host, clientId) {
  if (!confirm('⚠️ هيتم حذف حساب بوابة الموكل نهائيًا. متأكد؟')) return;
  try {
    await apiJson('/api/clients/delete-account', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId }),
    });
    toast('اتحذف الحساب', 'ok');
    render(host);
  } catch (e) {
    toast('فشل: ' + e.message, 'bad');
  }
}

// ============================================================
// بناء رسالة الدعوة
// ============================================================
function buildMessage(invite, officeName) {
  return `السلام عليكم ${invite.client_name}،

تم تفعيل بوابة الموكل لمكتب ${officeName}.

اضغط على الرابط ده عشان تدخل على طول:
${invite.invite_link}

هتشوف فيه: قضاياك، مواعيدك، وأتعابك.

لو محتاج أي مساعدة، كلمنا.`;
}

// ============================================================
// Modal الدعوة
// ============================================================
function showInviteModal(invite, message, host) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>📱 دعوة ${esc(invite.client_name)}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div style="background:var(--paper);padding:14px;border-radius:8px;margin-bottom:14px">
          <div style="margin-bottom:6px">
            <strong>كود الدعوة:</strong>
            <span class="mono" style="background:var(--ink);color:var(--brass);padding:4px 10px;border-radius:4px;font-size:14px;font-weight:700;letter-spacing:2px">
              ${esc(invite.invite_code)}
            </span>
          </div>
          ${invite.expires_at ? `<div style="font-size:12.5px;color:var(--ink-soft);margin-top:8px">
            ⏰ صالح حتى: ${esc(invite.expires_at.slice(0, 10))}
          </div>` : ''}
        </div>

        <label style="font-size:13px;color:var(--ink-soft)">📋 نص الرسالة:</label>
        <textarea id="invite-message-text" rows="8" readonly
          style="width:100%;padding:12px;border:1px solid var(--line);border-radius:6px;font-family:'Tajawal',sans-serif;font-size:13px;background:var(--paper);color:var(--ink);line-height:1.7;margin-top:6px">${esc(message)}</textarea>
      </div>
      <div class="modal-footer">
        <button class="ghost" id="copy-invite">📋 نسخ الرسالة</button>
        <button class="primary" id="close-invite">تم</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.remove();
    if (host) render(host);
  };

  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.querySelector('#close-invite').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  backdrop.querySelector('#copy-invite').addEventListener('click', () => {
    navigator.clipboard.writeText(message);
    toast('اتنسخت ✓', 'ok');
  });
}

// ============================================================
// ✅ ملف الموكل الكامل — Modal شامل
// ============================================================
// فتح موكل من البحث أو الإشعارات
document.addEventListener('mowakkil:open-client', (e) => { if (e.detail?.id) showProfile(Number(e.detail.id)); });

async function showProfile(id) {
  document.getElementById('client-profile-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'client-profile-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:720px;max-height:85vh;overflow:auto">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">👤 ملف الموكل</h3>
        <button class="icon-btn" data-action="close">✕</button>
      </div>
      <div id="client-profile-content">
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-action="close"]')) {
      modal.remove();
    }
  });

  try {
    const d = await apiJson(`/api/clients/${id}/profile`);
    const { client, cases, fees, payments, sessions, invoices, stats } = d;

    const tabsHtml = `
      <div class="case-tabs" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border-soft);overflow-x:auto">
        <button class="case-tab active" data-tab="overview">📋 نظرة عامة</button>
        <button class="case-tab" data-tab="cases">📁 القضايا (${cases.length})</button>
        <button class="case-tab" data-tab="fees">💰 الأتعاب (${fees.length})</button>
        <button class="case-tab" data-tab="payments">💵 الدفعات (${payments.length})</button>
        <button class="case-tab" data-tab="sessions">📅 الجلسات (${sessions.length})</button>
        ${invoices.length ? `<button class="case-tab" data-tab="invoices">📄 الفواتير (${invoices.length})</button>` : ''}
      </div>
    `;

    document.getElementById('client-profile-content').innerHTML = `
      <div style="text-align:center;padding:8px 0 16px;border-bottom:1px solid var(--border-soft);margin-bottom:16px">
        <div style="font-size:22px;font-weight:800">${esc(client.name)}</div>
        ${client.phone ? `<div style="font-size:13.5px;color:var(--text-soft);margin-top:6px;font-family:var(--font-mono)">📱 ${esc(client.phone)}</div>` : ''}
        ${client.national_id ? `<div style="font-size:12.5px;color:var(--text-soft);margin-top:4px">🆔 ${esc(client.national_id)}</div>` : ''}
      </div>

      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><div class="l">📁 قضايا</div><div class="n primary">${stats.total_cases}</div></div>
        <div class="stat"><div class="l">💰 إجمالي الأتعاب</div><div class="n">${fmtMoney(stats.total_fees)}</div></div>
        <div class="stat"><div class="l">✅ مدفوع</div><div class="n success">${fmtMoney(stats.total_paid)}</div></div>
        <div class="stat"><div class="l">⚠️ متبقي</div><div class="n danger">${fmtMoney(stats.total_remaining)}</div></div>
      </div>

      ${tabsHtml}
      <div id="client-tab-content"></div>
    `;

    const renderTab = (tab) => {
      const el = document.getElementById('client-tab-content');

      if (tab === 'overview') {
        el.innerHTML = `
          <div class="card" style="background:var(--gray-50)">
            <h4 style="margin:0 0 12px;font-size:14px">📊 ملخص</h4>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
              <span>عدد القضايا:</span><strong>${stats.total_cases}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
              <span>إجمالي الأتعاب:</span><strong>${fmtMoney(stats.total_fees)} ${cur()}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
              <span>المدفوع:</span><strong style="color:var(--success)">${fmtMoney(stats.total_paid)} ${cur()}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
              <span>المتبقي:</span><strong style="color:var(--danger)">${fmtMoney(stats.total_remaining)} ${cur()}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px;padding-top:8px;border-top:1px solid var(--border)">
              <span>جلسات قادمة:</span><strong>${stats.upcoming_count}</strong>
            </div>
            ${stats.total_invoices > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
                <span>فواتير:</span><strong>${fmtMoney(stats.total_invoices)} ${cur()}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:6px">
                <span>متبقي فواتير:</span><strong style="color:var(--danger)">${fmtMoney(stats.total_invoices_remaining)} ${cur()}</strong>
              </div>
            ` : ''}
          </div>
        `;
      }

      if (tab === 'cases') {
        el.innerHTML = cases.length
          ? cases.map(c => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(c.case_number || 'قضية #' + c.id)}</span>
                  <span class="badge ${c.status === 'مؤرشفة' ? 'suspended' : 'active'}">${esc(c.status)}</span>
                </div>
                <div class="meta">🏛️ ${esc(c.court || '—')} ${c.degree ? '· ' + esc(c.degree) : ''}</div>
              </div>
            `).join('')
          : empty('مفيش قضايا', '📁');
      }

      if (tab === 'fees') {
        el.innerHTML = fees.length
          ? fees.map(f => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${f.case_number ? '📁 ' + esc(f.case_number) : 'أتعاب'}</span>
                  <span class="badge ${f.status === 'مدفوع بالكامل' ? 'active' : f.status === 'متأخر' ? 'suspended' : 'trial'}">${esc(f.status)}</span>
                </div>
                <div class="meta">مستحق: ${fmtMoney(f.amount_due)} ${cur()} · مدفوع: ${fmtMoney(f.amount_paid)} ${cur()}</div>
                ${f.due_date ? `<div class="meta" style="font-size:12px">📅 ${esc(f.due_date)}</div>` : ''}
              </div>
            `).join('')
          : empty('مفيش أتعاب', '💰');
      }

      if (tab === 'payments') {
        el.innerHTML = payments.length
          ? payments.map(p => `
              <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                <div class="top">
                  <span class="name">${esc(p.receipt_number || 'دفعة')}</span>
                  <span class="num mono" style="color:var(--success);font-weight:700">${fmtMoney(p.amount)} ${cur()}</span>
                </div>
                <div class="meta">📅 ${esc(p.payment_date)} ${p.method ? '· 💳 ' + esc(p.method) : ''}</div>
              </div>
            `).join('')
          : empty('مفيش دفعات', '💵');
      }

      if (tab === 'sessions') {
        el.innerHTML = sessions.length
          ? sessions.map(s => {
              const isUpcoming = new Date(s.session_date) >= new Date();
              return `
                <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                  <div class="top">
                    <span class="name">${esc(s.case_number || '—')}</span>
                    <span class="badge ${isUpcoming ? 'active' : 'trial'}">${isUpcoming ? 'قادمة' : 'منتهية'}</span>
                  </div>
                  <div class="meta">📅 ${esc(s.session_date)} · 🏛️ ${esc(s.court || '—')}</div>
                  ${s.notes ? `<div class="meta">📝 ${esc(s.notes)}</div>` : ''}
                </div>
              `;
            }).join('')
          : empty('مفيش جلسات', '📅');
      }

      if (tab === 'invoices') {
        el.innerHTML = invoices.length
          ? invoices.map(inv => {
              const remaining = (inv.total || 0) - (inv.paid_amount || 0);
              return `
                <div class="item" style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
                  <div class="top">
                    <span class="name">فاتورة ${esc(inv.invoice_number)}</span>
                    <span class="badge ${inv.status === 'مدفوعة' ? 'active' : inv.status === 'متأخرة' ? 'suspended' : 'trial'}">${esc(inv.status)}</span>
                  </div>
                  <div class="meta">📅 ${esc(inv.issue_date)} ${inv.case_number ? '· 📁 ' + esc(inv.case_number) : ''}</div>
                  <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:13.5px">
                    <span style="font-weight:700;color:var(--primary)">${fmtMoney(inv.total)} ${cur()}</span>
                    ${remaining > 0 ? `<span style="color:var(--danger)">متبقي: ${fmtMoney(remaining)} ${cur()}</span>` : '<span style="color:var(--success)">✅ مدفوعة</span>'}
                  </div>
                </div>
              `;
            }).join('')
          : empty('مفيش فواتير', '📄');
      }
    };

    renderTab('overview');

    modal.querySelectorAll('.case-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.case-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTab(btn.dataset.tab);
      });
    });

  } catch (e) {
    document.getElementById('client-profile-content').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}