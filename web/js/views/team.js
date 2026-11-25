// web/js/views/team.js
// الفريق والصلاحيات: أعضاء المكتب، أدوارهم، "القضايا المكلّف بيها بس"، والأدوار المخصصة (الباقة المتقدمة).
import { apiJson } from '../api.js';
import { esc, toast } from '../ui.js';
import { countryInfo } from '../country.js';
import { loadAccess } from '../access.js';

const PLAN_LABEL = { starter: 'الأساسية', pro: 'الاحترافية', plus: 'المتقدمة', lifetime_basic: 'مدى الحياة — أساسية', lifetime_pro: 'مدى الحياة — احترافية' };
const ROLE_ICON = { admin: '👑', partner: '🤝', lawyer: '⚖️', secretary: '📋', accountant: '💰', trainee: '🎓', custom: '🧩' };

let data = null;
let myId = null;

export async function render(host) {
  host.innerHTML = '<div class="card"><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    const [d, me] = await Promise.all([
      apiJson('/api/team', { skipCache: true }),
      apiJson('/api/team/me', { skipCache: true }).catch(() => null),
    ]);
    data = d;
    myId = me?.user_id || null;
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`;
    return;
  }
  draw(host);
}

function roleName(u) {
  if (u.role === 'custom') return data.custom_roles.find(r => r.id === u.custom_role_id)?.name || 'دور مخصص';
  return data.roles.find(r => r.id === u.role)?.label || u.role;
}

function roleOptions(selected, selectedCustom) {
  const pre = data.roles.map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''} ${r.available ? '' : 'disabled'}>
      ${r.icon} ${esc(r.label)}${r.available ? '' : ' — الباقة الاحترافية'}</option>`).join('');
  const custom = data.can_custom_roles && data.custom_roles.length
    ? `<optgroup label="أدوار مخصصة">${data.custom_roles.map(r =>
        `<option value="custom:${r.id}" ${selected === 'custom' && selectedCustom === r.id ? 'selected' : ''}>🧩 ${esc(r.name)}</option>`).join('')}</optgroup>`
    : '';
  return pre + custom;
}

function draw(host) {
  const active = data.users.filter(u => u.active);
  host.innerHTML = `
    <div class="app-top">
      <div>
        <h2>👥 الفريق والصلاحيات</h2>
        <div class="meta" style="margin:2px 0 0">باقتك: <strong>${esc(PLAN_LABEL[data.plan] || data.plan)}</strong> · ${active.length} عضو نشط</div>
      </div>
      <button class="btn btn-primary" id="tm-add-toggle">➕ عضو جديد</button>
    </div>

    <div class="card" id="tm-add" hidden>
      <h3>➕ إضافة عضو للمكتب</h3>
      <div class="row">
        <div><label>الاسم</label><input id="tm-name" placeholder="أحمد السيد"></div>
        <div><label>الدور</label><select id="tm-role">${roleOptions('lawyer')}</select></div>
      </div>
      <div class="row">
        <div><label>الإيميل (للدخول)</label><input id="tm-email" type="email" placeholder="name@office.com"></div>
        <div><label>أو رقم الموبايل</label><input id="tm-phone" inputmode="numeric" placeholder="${countryInfo().phonePlaceholder}"></div>
      </div>
      <div class="row">
        <div><label>كلمة السر (8 حروف على الأقل)</label><input id="tm-pass" type="password" autocomplete="new-password"></div>
        <div><label>القضايا اللي يشوفها</label>
          <select id="tm-scope" ${data.can_assign_scope ? '' : 'disabled'}>
            <option value="all">كل قضايا المكتب</option>
            <option value="assigned">المكلّف بيها بس</option>
          </select>
          ${data.can_assign_scope ? '' : '<div class="meta" style="font-size:12px">متاحة من الباقة الاحترافية</div>'}
        </div>
      </div>
      <button class="btn btn-primary" id="tm-save" style="margin-top:10px">حفظ العضو</button>
      <div id="tm-status" class="status"></div>
    </div>

    <div class="card">
      <h3>الأعضاء</h3>
      <div class="team-list">
        ${data.users.map(u => memberRow(u)).join('')}
      </div>
    </div>

    ${rolesMatrix()}
    ${customRolesSection()}
  `;
  bind(host);
}

function memberRow(u) {
  const isMe = u.id === myId;
  const forced = data.roles.find(r => r.id === u.role)?.forceAssigned;
  const login = [u.email, u.phone].filter(Boolean).join(' · ');
  return `
    <div class="team-row ${u.active ? '' : 'inactive'}" data-user="${u.id}">
      <div class="team-avatar">${esc((u.full_name || '؟').charAt(0))}</div>
      <div class="team-info">
        <div class="team-name">${esc(u.full_name || '—')} ${isMe ? '<span class="badge active">أنت</span>' : ''} ${u.active ? '' : '<span class="badge suspended">موقوف</span>'}</div>
        <div class="meta" style="margin:0">${esc(login)}${u.last_login_at ? ` · آخر دخول ${esc(String(u.last_login_at).slice(0, 10))}` : ''}</div>
      </div>
      <div class="team-controls">
        <select data-role ${isMe ? 'disabled title="مينفعش تغيّر دورك بنفسك"' : ''}>${roleOptions(u.role, u.custom_role_id)}</select>
        <select data-scope ${!data.can_assign_scope || forced || u.role === 'admin' ? 'disabled' : ''} title="القضايا اللي يشوفها">
          <option value="all" ${u.scope !== 'assigned' && !forced ? 'selected' : ''}>كل القضايا</option>
          <option value="assigned" ${u.scope === 'assigned' || forced ? 'selected' : ''}>المكلّف بيها بس</option>
        </select>
        ${isMe ? '' : `<button class="btn btn-ghost btn-sm" data-active="${u.active ? 0 : 1}">${u.active ? '⏸ إيقاف' : '▶️ تفعيل'}</button>
        <button class="btn btn-ghost btn-sm" data-reset>🔑 كلمة سر</button>`}
      </div>
    </div>`;
}

// جدول يوضح كل دور يقدر يعمل إيه
function rolesMatrix() {
  const roles = data.roles;
  const rows = data.catalog.map(m => `
    <tr><th>${esc(m.label)}</th>${roles.map(r => {
      const perms = data.presets[r.id] || [];
      const acts = m.actions.filter(a => perms.includes(a.id)).map(a => a.label);
      return `<td class="${acts.length ? '' : 'none'}">${acts.length === m.actions.length ? '✓ كامل' : acts.length ? esc(acts.join('، ')) : '—'}</td>`;
    }).join('')}</tr>`).join('');
  return `
    <div class="card">
      <h3>🔐 الأدوار وصلاحياتها</h3>
      <div class="role-cards">
        ${roles.map(r => `<div class="role-card ${r.available ? '' : 'locked'}">
          <div class="role-title">${r.icon} ${esc(r.label)} ${r.available ? '' : '<span class="badge trial">الاحترافية</span>'}</div>
          <div class="meta" style="margin:4px 0 0;font-size:12.5px">${esc(r.description)}</div></div>`).join('')}
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <table class="perm-matrix">
          <thead><tr><th>القسم</th>${roles.map(r => `<th>${r.icon} ${esc(r.label)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function customRolesSection() {
  if (!data.can_custom_roles) {
    return `<div class="card upsell"><h3>🧩 أدوار مخصصة</h3>
      <p class="meta" style="margin:0">في الباقة المتقدمة تقدر تعمل دور بنفسك وتحدد صلاحياته واحدة واحدة (مثلاً «محامي أول» يقدر يحذف قضايا، أو «سكرتير مالي» يسجّل دفعات بس).</p></div>`;
  }
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">🧩 أدوار مخصصة</h3>
        <button class="btn btn-ghost" id="cr-new">➕ دور جديد</button>
      </div>
      <div id="cr-list" style="margin-top:10px">
        ${data.custom_roles.length ? data.custom_roles.map(r => `
          <div class="team-row" data-crole="${r.id}">
            <div class="team-info"><div class="team-name">🧩 ${esc(r.name)}</div>
            <div class="meta" style="margin:0">${r.permissions.length} صلاحية</div></div>
            <div class="team-controls">
              <button class="btn btn-ghost btn-sm" data-cr-edit>✏️ تعديل</button>
              <button class="btn btn-ghost btn-sm" data-cr-del style="color:var(--bad)">🗑 حذف</button>
            </div>
          </div>`).join('') : '<div class="meta">مفيش أدوار مخصصة لسه.</div>'}
      </div>
      <div id="cr-editor"></div>
    </div>`;
}

function roleEditor(role = null) {
  const perms = new Set(role?.permissions || []);
  // الفريق والاشتراك للمالك بس — مش بيظهروا في المحرر
  const modules = data.catalog.filter(m => m.module !== 'team' && m.module !== 'subscription');
  return `
    <div class="cr-editor">
      <label>اسم الدور</label><input id="cr-name" value="${esc(role?.name || '')}" placeholder="مثلاً: محامي أول">
      <div class="meta" style="margin:8px 0">ابدأ من دور جاهز:
        ${data.roles.filter(r => r.id !== 'admin').map(r => `<button class="btn btn-ghost btn-sm" data-cr-preset="${r.id}">${r.icon} ${esc(r.label)}</button>`).join(' ')}
      </div>
      <table class="perm-matrix editable">
        ${modules.map(m => `<tr><th>${esc(m.label)}</th><td>${m.actions.map(a => `
          <label class="perm-check"><input type="checkbox" value="${a.id}" ${perms.has(a.id) ? 'checked' : ''}> ${esc(a.label)}</label>`).join('')}</td></tr>`).join('')}
      </table>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" id="cr-save" data-id="${role?.id || ''}">حفظ الدور</button>
        <button class="btn btn-ghost" id="cr-cancel">إلغاء</button>
      </div>
      <div id="cr-status" class="status"></div>
    </div>`;
}

async function patchUser(id, body, host) {
  try {
    await apiJson(`/api/team/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    toast('اتحفظ ✓', 'ok');
  } catch (e) {
    toast(e.message, 'bad');
  }
  await render(host);
}

function bind(host) {
  host.querySelector('#tm-add-toggle').addEventListener('click', () => {
    const p = host.querySelector('#tm-add'); p.hidden = !p.hidden;
  });
  // المتدرب دايماً "المكلّف بيها بس"
  host.querySelector('#tm-role').addEventListener('change', e => {
    const forced = data.roles.find(r => r.id === e.target.value)?.forceAssigned;
    if (forced) host.querySelector('#tm-scope').value = 'assigned';
  });
  host.querySelector('#tm-save').addEventListener('click', async () => {
    const st = host.querySelector('#tm-status');
    const rv = host.querySelector('#tm-role').value;
    const [role, customId] = rv.startsWith('custom:') ? ['custom', Number(rv.split(':')[1])] : [rv, null];
    st.textContent = '⏳'; st.className = 'status';
    try {
      await apiJson('/api/team', { method: 'POST', body: JSON.stringify({
        full_name: host.querySelector('#tm-name').value.trim(),
        email: host.querySelector('#tm-email').value.trim(),
        phone: host.querySelector('#tm-phone').value.trim(),
        password: host.querySelector('#tm-pass').value,
        role, custom_role_id: customId,
        scope: host.querySelector('#tm-scope').value,
      }) });
      toast('اتضاف العضو ✓ — ابعتله بيانات الدخول', 'ok');
      await render(host);
    } catch (e) {
      st.textContent = e.message; st.className = 'status bad';
    }
  });

  host.querySelectorAll('.team-row[data-user]').forEach(row => {
    const id = Number(row.dataset.user);
    row.querySelector('[data-role]')?.addEventListener('change', e => {
      const v = e.target.value;
      const body = v.startsWith('custom:') ? { role: 'custom', custom_role_id: Number(v.split(':')[1]) } : { role: v };
      if (data.roles.find(r => r.id === v)?.forceAssigned) body.scope = 'assigned';
      if (v === 'admin' && !confirm('المالك بياخد كل الصلاحيات بما فيها الفريق والاشتراك. متأكد؟')) { render(host); return; }
      patchUser(id, body, host);
    });
    row.querySelector('[data-scope]')?.addEventListener('change', e => patchUser(id, { scope: e.target.value }, host));
    row.querySelector('[data-active]')?.addEventListener('click', e => {
      const activate = e.target.dataset.active === '1';
      if (!activate && !confirm('العضو ده مش هيقدر يدخل لحد ما تفعّله تاني. متأكد؟')) return;
      patchUser(id, { active: activate }, host);
    });
    row.querySelector('[data-reset]')?.addEventListener('click', async () => {
      const pass = prompt('كلمة السر الجديدة للعضو (8 حروف على الأقل):');
      if (!pass) return;
      try {
        await apiJson(`/api/team/${id}/password`, { method: 'POST', body: JSON.stringify({ password: pass }) });
        toast('اتغيّرت كلمة السر ✓ — ابعتهاله', 'ok');
      } catch (e) { toast(e.message, 'bad'); }
    });
  });

  // الأدوار المخصصة
  const editor = host.querySelector('#cr-editor');
  const openEditor = role => {
    editor.innerHTML = roleEditor(role);
    editor.querySelectorAll('[data-cr-preset]').forEach(b => b.addEventListener('click', () => {
      const preset = new Set(data.presets[b.dataset.crPreset] || []);
      editor.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = preset.has(cb.value); });
    }));
    editor.querySelector('#cr-cancel').addEventListener('click', () => { editor.innerHTML = ''; });
    editor.querySelector('#cr-save').addEventListener('click', async e => {
      const id = e.target.dataset.id;
      const body = {
        name: editor.querySelector('#cr-name').value.trim(),
        permissions: [...editor.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value),
      };
      try {
        await apiJson(id ? `/api/team/roles/${id}` : '/api/team/roles', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
        toast('اتحفظ الدور ✓', 'ok');
        await render(host);
      } catch (err) {
        const st = editor.querySelector('#cr-status'); st.textContent = err.message; st.className = 'status bad';
      }
    });
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  host.querySelector('#cr-new')?.addEventListener('click', () => openEditor(null));
  host.querySelectorAll('[data-crole]').forEach(row => {
    const role = data.custom_roles.find(r => r.id === Number(row.dataset.crole));
    row.querySelector('[data-cr-edit]').addEventListener('click', () => openEditor(role));
    row.querySelector('[data-cr-del]').addEventListener('click', async () => {
      if (!confirm(`حذف الدور «${role.name}»؟`)) return;
      try { await apiJson(`/api/team/roles/${role.id}`, { method: 'DELETE' }); toast('اتحذف', 'ok'); await render(host); }
      catch (e) { toast(e.message, 'bad'); }
    });
  });

  loadAccess(); // لو المالك غيّر حاجة تخصّه
}
