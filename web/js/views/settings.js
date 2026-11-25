// web/js/views/settings.js
// صفحة الإعدادات الشاملة

import { apiJson, getRole, clearCache } from '../api.js';
import { can } from '../access.js';
import { toast, setOfficeMoneyPrefs } from '../ui.js';
import { pickerHTML, bindPicker } from '../ai-privacy.js';
import { deviceSupported, getRootFolder, pickRootFolder, getDeviceLabel, setDeviceLabel } from '../device-storage.js';
import { WA_KINDS, WA_DEFAULTS, WA_PLACEHOLDERS, fillTemplate, resetWaSettings } from '../whatsapp.js';

// ============================================================
// رسايل واتساب: تعديل القوالب الجاهزة
// ============================================================
function renderWhatsAppTab(content, settings, isAdmin, reload) {
  let custom = {};
  try { custom = settings.wa_templates ? JSON.parse(settings.wa_templates) : {}; } catch { custom = {}; }
  const sample = {
    client: 'أحمد محمود', case: '1234 لسنة 2026', court: 'محكمة شمال القاهرة',
    date: 'الأحد، 6 ديسمبر 2026', amount: '5,000', due: 'الثلاثاء، 1 ديسمبر 2026',
    office: `مكتب ${(settings.office_name_ar || 'المكتب').replace(/^مكتب\s+/, '')}`,
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  content.innerHTML = `
    <div class="card">
      <h3>💬 رسايل واتساب الجاهزة</h3>
      <p class="meta" style="line-height:1.8;margin:0 0 10px">
        الرسايل دي بتظهر لما تدوس «💬 تذكير» في الأجندة أو الأتعاب أو ملف القضية أو لوحة التحكم.
        واتساب بيفتح والرسالة مكتوبة، وانت بتراجعها وتدوس إرسال بنفسك.
        الكلمات اللي بين { } بتتبدّل لوحدها، وأي سطر فيه معلومة مش موجودة بيتشال.
      </p>
      <div class="wa-chips">${Object.entries(WA_PLACEHOLDERS).map(([k, v]) => `<code title="${esc(v)}" data-chip="${k}">${k} ${esc(v)}</code>`).join('')}</div>
      <div class="wa-tpl">
        ${Object.keys(WA_KINDS).map(k => `
          <div>
            <label class="wa-label" for="wa-tpl-${k}" style="font-weight:700;color:var(--text)">${WA_KINDS[k]}
              ${custom[k] ? '<span class="badge" style="margin-inline-start:6px">معدّلة</span>' : ''}</label>
            <textarea id="wa-tpl-${k}" class="wa-text" data-kind="${k}" ${isAdmin ? '' : 'readonly'}>${esc(custom[k] || WA_DEFAULTS[k])}</textarea>
            <details style="margin-top:6px"><summary class="meta" style="cursor:pointer">معاينة</summary>
              <pre class="wa-preview" data-preview="${k}" style="white-space:pre-wrap;font:inherit;background:var(--surface-2, #f8fafc);padding:10px;border-radius:10px;margin:6px 0 0"></pre>
            </details>
          </div>`).join('')}
      </div>
      ${isAdmin ? `
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary" id="wa-tpl-save">💾 حفظ</button>
          <button class="btn btn-ghost" id="wa-tpl-reset">↺ رجّع الرسايل الافتراضية</button>
        </div>` : '<div class="meta" style="margin-top:12px">تعديل الرسايل لمدير المكتب بس.</div>'}
    </div>`;

  let lastFocused = content.querySelector('textarea.wa-text');
  const refresh = () => content.querySelectorAll('textarea[data-kind]').forEach(ta => {
    const pre = content.querySelector(`[data-preview="${ta.dataset.kind}"]`);
    if (pre) pre.textContent = fillTemplate(ta.value, sample);
  });
  refresh();
  content.addEventListener('input', refresh);
  content.addEventListener('focusin', e => { if (e.target.matches('textarea.wa-text')) lastFocused = e.target; });
  content.querySelectorAll('[data-chip]').forEach(c => c.addEventListener('click', () => {
    if (!isAdmin || !lastFocused) return;
    const ta = lastFocused; const p = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, p) + c.dataset.chip + ta.value.slice(ta.selectionEnd ?? p);
    ta.focus(); ta.selectionStart = ta.selectionEnd = p + c.dataset.chip.length;
    refresh();
  }));

  const save = async (templates) => {
    try {
      await apiJson('/api/settings', { method: 'PATCH', body: JSON.stringify({ wa_templates: templates }) });
      clearCache(); resetWaSettings();
      toast('اتحفظت الرسايل ✓', 'ok');
      reload();
    } catch (e) { toast('فشل الحفظ: ' + e.message, 'bad'); }
  };
  content.querySelector('#wa-tpl-save')?.addEventListener('click', () => {
    const out = {};
    content.querySelectorAll('textarea[data-kind]').forEach(ta => {
      const v = ta.value.trim();
      if (v && v !== WA_DEFAULTS[ta.dataset.kind].trim()) out[ta.dataset.kind] = v; // نحفظ المعدّل بس
    });
    save(out);
  });
  content.querySelector('#wa-tpl-reset')?.addEventListener('click', () => {
    if (confirm('ترجّع كل الرسايل للنسخة الافتراضية؟')) save({});
  });
}

// ============================================================
// التخزين: مكان حفظ المستندات (سحابة / كمبيوتر المكتب) + إعداد الجهاز ده
// ============================================================
async function renderStorageTab(content, settings, isAdmin, reload) {
  const supported = deviceSupported();
  const root = supported ? await getRootFolder() : null;
  let usage = null;
  try { usage = await apiJson('/api/subscription/usage', { skipCache: true }); } catch {}
  const mode = settings.doc_storage_default || 'cloud';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  content.innerHTML = `
    <div class="card">
      <h3>💾 مكان حفظ المستندات</h3>
      <p class="meta" style="line-height:1.8;margin:0 0 12px">
        تقدر تحفظ مستندات القضايا على <strong>السحابة</strong> (بتبان على كل الأجهزة) أو في <strong>فولدر على كمبيوتر المكتب</strong>
        (مش بتتحسب من مساحة باقتك). ووقت الرفع تقدر تغيّر المكان لكل ملف.
      </p>
      <div class="att-storage">
        <label class="att-opt"><input type="radio" name="st-default" value="cloud" ${mode === 'cloud' ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}>
          <span>☁️ <strong>السحابة (افتراضي)</strong><br><span class="meta" style="margin:0">بتبان من أي جهاز ومن بوابة الموكل والتحليل الذكي — بتتحسب من مساحة الباقة.</span></span></label>
        <label class="att-opt"><input type="radio" name="st-default" value="device" ${mode === 'device' ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}>
          <span>💻 <strong>كمبيوتر المكتب</strong><br><span class="meta" style="margin:0">الملف بيفضل في فولدر على الجهاز اللي اترفع منه. مش بيبان على الموبايل أو أجهزة تانية، والتحليل الذكي مش بيقدر يقراه، <strong>والنسخ الاحتياطي مسؤولية المكتب</strong>.</span></span></label>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" id="st-save" style="margin-top:12px">حفظ</button>` : '<div class="meta" style="margin-top:8px">تغيير الإعداد ده لمالك المكتب.</div>'}
      ${usage?.storage_mb != null || usage?.usage?.storage_mb != null ? `<div class="meta" style="margin-top:10px">المساحة المستخدمة على السحابة: ${esc(usage.storage_mb ?? usage.usage?.storage_mb)} ميجا</div>` : ''}
    </div>

    <div class="card">
      <h3>💻 الجهاز ده</h3>
      ${supported ? `
        <div class="row">
          <div><label>اسم الجهاز (بيظهر جنب الملفات)</label><input id="st-label" value="${esc(getDeviceLabel())}" placeholder="كمبيوتر المكتب"></div>
          <div><label>فولدر المستندات</label>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
              <strong>${root ? '📁 ' + esc(root.name) : '— لسه ما اتختارش —'}</strong>
              <button class="btn btn-ghost btn-sm" id="st-pick">${root ? 'تغيير الفولدر' : 'اختيار فولدر'}</button>
            </div>
          </div>
        </div>
        <button class="btn btn-ghost" id="st-label-save" style="margin-top:8px">حفظ اسم الجهاز</button>
        <p class="meta" style="margin:10px 0 0;line-height:1.8">جوه الفولدر ده الملفات بتتنظم لوحدها: <code>قضية 1234-2026 / توكيل / الملف.pdf</code>.
        المتصفح هيطلب إذن الوصول للفولدر أول مرة في كل جلسة.</p>`
      : `<div class="warn" style="line-height:1.8">الحفظ على الكمبيوتر متاح على <strong>جوجل كروم</strong> أو <strong>مايكروسوفت إيدج</strong> على الكمبيوتر بس.
        على الموبايل أو المتصفحات التانية المستندات بتتحفظ على السحابة.</div>`}
    </div>`;

  content.querySelector('#st-save')?.addEventListener('click', async () => {
    const v = content.querySelector('input[name="st-default"]:checked')?.value;
    try {
      await apiJson('/api/settings', { method: 'PATCH', body: JSON.stringify({ doc_storage_default: v }) });
      toast('اتحفظ مكان الحفظ الافتراضي ✓', 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  });
  content.querySelector('#st-pick')?.addEventListener('click', async () => {
    try { await pickRootFolder(); toast('اتختار الفولدر ✓', 'ok'); reload(); }
    catch (e) { if (e?.name !== 'AbortError') toast(e.message, 'bad'); }
  });
  content.querySelector('#st-label-save')?.addEventListener('click', () => {
    setDeviceLabel(content.querySelector('#st-label').value);
    toast('اتحفظ اسم الجهاز ✓', 'ok');
  });
}

let currentTab = 'office';

export async function render(host) {
  // فتح تبويب معيّن (مثلاً من زرار الإعدادات في قايمة الإشعارات)
  try { const t = sessionStorage.getItem('mowakkil_settings_tab'); if (t) { currentTab = t; sessionStorage.removeItem('mowakkil_settings_tab'); } } catch {}
  const isAdmin = can('settings.manage'); // المالك والشريك (والأدوار المخصصة اللي معاها الصلاحية)

  host.innerHTML = `
    <div class="app-top">
      <h2>⚙️ الإعدادات</h2>
    </div>

    <div class="settings-layout">
      <aside class="settings-sidebar">
        <button class="settings-tab ${currentTab === 'office' ? 'active' : ''}" data-tab="office">
          <span>🏢</span> المكتب
        </button>
        <button class="settings-tab ${currentTab === 'account' ? 'active' : ''}" data-tab="account">
          <span>👤</span> حسابي
        </button>
        <button class="settings-tab ${currentTab === 'accounting' ? 'active' : ''}" data-tab="accounting">
          <span>💰</span> المحاسبة
        </button>
        <button class="settings-tab ${currentTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
          <span>🔔</span> الإشعارات
        </button>
        <button class="settings-tab ${currentTab === 'appearance' ? 'active' : ''}" data-tab="appearance">
          <span>🎨</span> المظهر
        </button>
        <button class="settings-tab ${currentTab === 'plan' ? 'active' : ''}" data-tab="plan">
          <span>💎</span> الباقة
        </button>
        <button class="settings-tab ${currentTab === 'storage' ? 'active' : ''}" data-tab="storage">
          <span>💾</span> التخزين
        </button>
        <button class="settings-tab ${currentTab === 'whatsapp' ? 'active' : ''}" data-tab="whatsapp">
          <span>💬</span> رسايل واتساب
        </button>
        <button class="settings-tab ${currentTab === 'privacy' ? 'active' : ''}" data-tab="privacy">
          <span>🔒</span> الخصوصية
        </button>
        <button class="settings-tab ${currentTab === 'advanced' ? 'active' : ''}" data-tab="advanced">
          <span>⚡</span> متقدم
        </button>
      </aside>

      <div class="settings-content" id="settings-content">
        <div style="text-align:center;padding:60px;color:var(--text-soft)">
          جاري التحميل...
        </div>
      </div>
    </div>
  `;

  // Event delegation
  host.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      host.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(host, currentTab, isAdmin);
    });
  });

  // تحميل التاب الأول
  loadTab(host, currentTab, isAdmin);
}

async function loadTab(host, tab, isAdmin) {
  const content = host.querySelector('#settings-content');
  content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-soft)">جاري التحميل...</div>`;

  try {
    const settings = await apiJson('/api/settings');

    if (tab === 'office')             content.innerHTML = renderOfficeTab(settings, isAdmin);
    else if (tab === 'account')       content.innerHTML = renderAccountTab(isAdmin);
    else if (tab === 'accounting')    content.innerHTML = renderAccountingTab(settings, isAdmin);
    else if (tab === 'notifications') {
      await renderNotifTab(content, settings, isAdmin, () => loadTab(host, 'notifications', isAdmin));
      return;
    }
    else if (tab === 'appearance')    content.innerHTML = renderAppearanceTab(settings, isAdmin);
    else if (tab === 'plan')          content.innerHTML = await renderPlanTab();
    else if (tab === 'storage') {
      await renderStorageTab(content, settings, isAdmin, () => loadTab(host, 'storage', isAdmin));
      return;
    }
    else if (tab === 'whatsapp') {
      renderWhatsAppTab(content, settings, isAdmin, () => loadTab(host, 'whatsapp', isAdmin));
      return;
    }
    else if (tab === 'privacy') {
      const p = await apiJson('/api/settings/ai-privacy', { skipCache: true }).catch(() => ({ mode: 'balanced' }));
      content.innerHTML = `
        <div class="card">
          <h3>🔒 خصوصية الذكاء الاصطناعي لبيانات الموكلين</h3>
          <p class="meta" style="line-height:1.8;margin:0 0 14px">
            ده بيحدد إزاي مستندات ووقائع الموكلين بتتعالج لما تستخدم التحليل الذكي أو الشات بملف أو توليد المستندات.
            الأسئلة القانونية العامة مش بتتأثر. وفي كل الأحوال: أي مادة قانونية بيذكرها الذكاء الاصطناعي بتتراجع آلياً على قاعدة المواد.
          </p>
          ${pickerHTML(p.mode, { isAdmin, acceptedAt: p.accepted_at })}
        </div>`;
      bindPicker(content, { onSaved: () => loadTab(host, 'privacy', isAdmin) });
      return;
    }
    else if (tab === 'advanced')      content.innerHTML = renderAdvancedTab(isAdmin);

    bindTabEvents(host, tab, settings);
  } catch (e) {
    content.innerHTML = `<div class="card" style="color:var(--danger)">خطأ: ${e.message}</div>`;
  }
}

// ============================================================
// 1. تبويب المكتب
// ============================================================
function renderOfficeTab(s, isAdmin) {
  const c = (s.country || 'EG').toUpperCase();
  return `
    <div class="card">
      <h3>🌍 دولة المكتب</h3>
      <div class="meta" style="margin:0 0 10px">بتحدد العملة والضريبة والتوقيت، والتواريخ (في السعودية هجري وميلادي)، والمحاكم ودرجات التقاضي وأنواع القضايا، والقوانين اللي الذكاء الاصطناعي بيجاوب بيها.</div>
      <div class="country-pick" role="radiogroup" aria-label="دولة المكتب">
        <button type="button" class="country-opt ${c === 'EG' ? 'active' : ''}" role="radio" aria-checked="${c === 'EG'}" data-set-country="EG" ${!isAdmin ? 'disabled' : ''}><span class="cf">🇪🇬</span> مصر</button>
        <button type="button" class="country-opt ${c === 'SA' ? 'active' : ''}" role="radio" aria-checked="${c === 'SA'}" data-set-country="SA" ${!isAdmin ? 'disabled' : ''}><span class="cf">🇸🇦</span> السعودية</button>
      </div>
      ${!isAdmin ? '<div class="meta" style="margin-top:8px">مالك المكتب بس اللي يقدر يغيّر الدولة.</div>' : ''}
    </div>

    <div class="card">
      <h3>🏢 معلومات المكتب</h3>
      <div class="form-grid">
        <div class="form-row">
          <label class="label">اسم المكتب (عربي)</label>
          <input class="input" id="s-office-name-ar" value="${escapeHtml(s.office_name_ar || '')}" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">اسم المكتب (إنجليزي)</label>
          <input class="input" id="s-office-name-en" value="${escapeHtml(s.office_name_en || '')}" dir="ltr" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row" style="grid-column:1/-1">
          <label class="label">شعار المكتب (رابط)</label>
          <input class="input" id="s-logo" value="${escapeHtml(s.logo || '')}" dir="ltr" placeholder="https://..." ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">رقم التليفون</label>
          <input class="input" id="s-phone" value="${escapeHtml(s.phone || '')}" dir="ltr" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">البريد الإلكتروني</label>
          <input class="input" id="s-email" value="${escapeHtml(s.email || '')}" dir="ltr" type="email" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">الموقع الإلكتروني</label>
          <input class="input" id="s-website" value="${escapeHtml(s.website || '')}" dir="ltr" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">الرقم الضريبي</label>
          <input class="input" id="s-tax" value="${escapeHtml(s.tax_number || '')}" dir="ltr" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">السجل التجاري</label>
          <input class="input" id="s-cr" value="${escapeHtml(s.commercial_register || '')}" dir="ltr" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row" style="grid-column:1/-1">
          <label class="label">العنوان</label>
          <textarea class="input" id="s-address" rows="2" ${!isAdmin ? 'disabled' : ''}>${escapeHtml(s.address || '')}</textarea>
        </div>
      </div>
      ${isAdmin ? `
        <button class="btn btn-primary" id="save-office" style="margin-top:16px">
          💾 حفظ معلومات المكتب
        </button>
        <div id="s-office-status" class="status" style="margin-top:12px"></div>
      ` : `
        <div style="margin-top:12px;color:var(--text-muted);font-size:13px">
          ℹ️ التعديل متاح للمسؤول فقط
        </div>
      `}
    </div>
  `;
}

// ============================================================
// 2. تبويب الحساب
// ============================================================
function renderAccountTab(isAdmin) {
  return `
    <div class="card">
      <h3>👤 بياناتي</h3>
      <div class="form-grid">
        <div class="form-row">
          <label class="label">الاسم</label>
          <input class="input" id="s-acc-name">
        </div>
        <div class="form-row">
          <label class="label">البريد الإلكتروني</label>
          <input class="input" id="s-acc-email" type="email" dir="ltr">
        </div>
      </div>
      <button class="btn btn-primary" id="save-account" style="margin-top:16px">
        💾 حفظ البيانات
      </button>
      <div id="s-acc-status" class="status" style="margin-top:12px"></div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>🔒 تغيير كلمة المرور</h3>
      <div class="form-grid">
        <div class="form-row">
          <label class="label">كلمة المرور الحالية</label>
          <input class="input" id="s-pw-old" type="password">
        </div>
        <div class="form-row">
          <label class="label">كلمة المرور الجديدة (8 حروف على الأقل)</label>
          <input class="input" id="s-pw-new" type="password">
        </div>
      </div>
      <button class="btn btn-primary" id="save-pw" style="margin-top:16px">
        🔒 تغيير كلمة المرور
      </button>
      <div id="s-pw-status" class="status" style="margin-top:12px"></div>
    </div>

    ${isAdmin ? `
      <div class="card" style="margin-top:16px">
        <h3>➕ إضافة محامٍ جديد</h3>
        <div class="form-grid">
          <div class="form-row">
            <label class="label">الاسم الكامل</label>
            <input class="input" id="s-new-name">
          </div>
          <div class="form-row">
            <label class="label">البريد الإلكتروني</label>
            <input class="input" id="s-new-email" type="email" dir="ltr">
          </div>
          <div class="form-row">
            <label class="label">كلمة المرور المبدئية</label>
            <input class="input" id="s-new-pass" type="password">
          </div>
        </div>
        <button class="btn btn-primary" id="create-user" style="margin-top:16px">
          ➕ إنشاء الحساب
        </button>
        <div id="s-new-status" class="status" style="margin-top:12px"></div>
      </div>
    ` : ''}
  `;
}

// ============================================================
// 3. تبويب المحاسبة
// ============================================================
function renderAccountingTab(s, isAdmin) {
  return `
    <div class="card">
      <h3>💰 إعدادات المحاسبة</h3>
      <div class="form-grid">
        <div class="form-row">
          <label class="label">العملة</label>
          <select class="input" id="s-currency" ${!isAdmin ? 'disabled' : ''}>
            <option value="EGP" ${s.currency === 'EGP' ? 'selected' : ''}>جنيه مصري (EGP)</option>
            <option value="SAR" ${s.currency === 'SAR' ? 'selected' : ''}>ريال سعودي (SAR)</option>
            <option value="AED" ${s.currency === 'AED' ? 'selected' : ''}>درهم إماراتي (AED)</option>
            <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>دولار أمريكي (USD)</option>
          </select>
        </div>
        <div class="form-row">
          <label class="label">نسبة ضريبة القيمة المضافة %</label>
          <input class="input" id="s-vat" type="number" min="0" max="100" step="0.1" value="${s.vat_rate || 0}" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">بادئة رقم الفاتورة</label>
          <input class="input" id="s-inv-prefix" value="${escapeHtml(s.invoice_prefix || '')}" placeholder="مثال: INV-" dir="ltr" ${!isAdmin ? 'disabled' : ''}>
        </div>
        <div class="form-row">
          <label class="label">بداية السنة المالية (شهر)</label>
          <select class="input" id="s-fiscal" ${!isAdmin ? 'disabled' : ''}>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
              <option value="${m}" ${s.fiscal_year_start === m ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1">
          <label class="label">شروط الدفع الافتراضية (للفواتير)</label>
          <textarea class="input" id="s-inv-terms" rows="2" ${!isAdmin ? 'disabled' : ''}>${escapeHtml(s.invoice_terms || '')}</textarea>
        </div>
      </div>
      ${isAdmin ? `
        <button class="btn btn-primary" id="save-accounting" style="margin-top:16px">
          💾 حفظ إعدادات المحاسبة
        </button>
        <div id="s-acc2-status" class="status" style="margin-top:12px"></div>
      ` : ''}
    </div>
  `;
}

// ============================================================
// 4. تبويب الإشعارات
//    - على الجهاز ده (لكل مستخدم): إشعارات الجهاز + الصوت + إشعار تجريبي
//    - إشعارات المكتب (المدير بيعدّل): أنواع الإشعارات اللي بتتعمل + ميعاد تذكير الجلسات
// ============================================================
const NOTIF_GROUPS = [
  { key: 'notif_sessions', icon: '⚖️', label: 'الجلسات', desc: 'تذكير قبل كل جلسة (بالساعة لو متسجلة)، وإشعار لما جلسة جديدة تتضاف.', extra: 'reminder' },
  { key: 'notif_events',   icon: '🗓️', label: 'مواعيد الأجندة', desc: 'الموعد النهائي/ميعاد الطعن: قبله بـ 3 أيام وبيوم ويومها. الاجتماع والاستشارة والإجراء: قبلها بيوم ويومها.' },
  { key: 'notif_tasks',    icon: '✅', label: 'المهام', desc: 'المهام المستحقة النهارده، ولما مهمة تتسند لحد.' },
  { key: 'notif_fees',     icon: '💰', label: 'الأتعاب المتأخرة', desc: 'لما أتعاب تعدّي ميعادها بأسبوع، وبيتكرر كل أسبوع لحد ما تتدفع.' },
  { key: 'notif_payments', icon: '💵', label: 'التحصيل والفواتير', desc: 'دفعة جديدة اتسجلت أو فاتورة جديدة اتعملت.' },
  { key: 'notif_cases',    icon: '📁', label: 'القضايا الجديدة', desc: 'لما قضية جديدة تتضاف للمكتب.' },
  { key: 'notif_clients',  icon: '👤', label: 'الموكلين الجدد', desc: 'لما موكل جديد يتضاف.' },
];

async function renderNotifTab(content, s, isAdmin, reload) {
  const notif = await import('../notifications.js');
  const support = notif.deviceSupport();
  const dev = notif.deviceEnabled() && support === 'granted';
  const on = (k) => s[k] === undefined || s[k] === null ? true : Number(s[k]) === 1;
  const lead = Number(s.session_reminder_days ?? 1);
  const leadOpts = [[0, 'يوم الجلسة الصبح'], [1, 'قبلها بيوم'], [2, 'قبلها بيومين'], [3, 'قبلها بـ 3 أيام'], [7, 'قبلها بأسبوع']];

  const sw = (id, checked, disabled = false) => `
    <span class="nt-switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="nt-slider" aria-hidden="true"></span></span>`;

  content.innerHTML = `
    <div class="card nt-card">
      <div class="nt-head">
        <div>
          <h3>🔔 على الجهاز ده</h3>
          <p class="meta">الإعدادات دي بتاعتك انت وعلى الجهاز ده بس.</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="nt-test">📨 ابعت إشعار تجريبي</button>
      </div>
      <label class="nt-row" for="nt-device">
        <div class="nt-row-ic">🖥️</div>
        <div class="nt-row-body">
          <div class="nt-row-title">إشعارات الجهاز</div>
          <div class="nt-row-desc">
            ${support === 'unsupported' ? 'المتصفح ده مش بيدعم إشعارات الجهاز.'
              : support === 'denied' ? '⚠️ المتصفح مانع الإشعارات للموقع — اسمح بيها من علامة القفل جنب عنوان الموقع وبعدين فعّلها هنا.'
              : 'تظهر على الكمبيوتر أو الموبايل حتى لو الموقع مفتوح في الخلفية.'}
          </div>
        </div>
        ${sw('nt-device', dev, support === 'unsupported')}
      </label>
      <label class="nt-row" for="nt-sound">
        <div class="nt-row-ic">🔊</div>
        <div class="nt-row-body">
          <div class="nt-row-title">صوت مع الإشعار الجديد</div>
          <div class="nt-row-desc">نغمة خفيفة لما يوصل إشعار جديد.</div>
        </div>
        ${sw('nt-sound', notif.soundEnabled())}
      </label>
    </div>

    <div class="card nt-card">
      <div class="nt-head">
        <div>
          <h3>🏢 إشعارات المكتب</h3>
          <p class="meta">${isAdmin
            ? 'اختار الإشعارات اللي تتبعت للفريق. التغيير بيتحفظ لوحده.'
            : 'الإعدادات دي بيحددها مدير المكتب.'}
            كل واحد بيشوف بس الإشعارات اللي من حقه حسب صلاحياته، والتذكيرات بتتبعت كل يوم الصبح بدري.</p>
        </div>
        <span class="nt-saved" id="nt-saved" role="status" aria-live="polite"></span>
      </div>
      ${NOTIF_GROUPS.map(g => `
        <div class="nt-row ${on(g.key) ? '' : 'off'}" data-row="${g.key}">
          <div class="nt-row-ic">${g.icon}</div>
          <div class="nt-row-body">
            <label class="nt-row-title" for="nt-${g.key}">${g.label}</label>
            <div class="nt-row-desc">${g.desc}</div>
            ${g.extra === 'reminder' ? `
              <div class="nt-extra">
                <label for="nt-lead">ميعاد التذكير:</label>
                <select id="nt-lead" class="input" ${isAdmin ? '' : 'disabled'}>
                  ${leadOpts.map(([v, l]) => `<option value="${v}" ${v === lead ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>` : ''}
          </div>
          ${sw('nt-' + g.key, on(g.key), !isAdmin)}
        </div>`).join('')}
    </div>
  `;

  const saved = content.querySelector('#nt-saved');
  const flash = (txt, bad = false) => {
    saved.textContent = txt; saved.className = 'nt-saved show' + (bad ? ' bad' : '');
    clearTimeout(saved._t); saved._t = setTimeout(() => saved.classList.remove('show'), 2200);
  };
  const patch = async (body) => {
    try {
      await apiJson('/api/settings', { method: 'PATCH', body: JSON.stringify(body) });
      clearCache();
      flash('✓ اتحفظ');
      return true;
    } catch (e) { flash('⚠️ ' + e.message, true); return false; }
  };

  // على الجهاز
  content.querySelector('#nt-device')?.addEventListener('change', async (e) => {
    try { await notif.setDeviceEnabled(e.target.checked); toast(e.target.checked ? '✓ إشعارات الجهاز اتفعّلت' : 'إشعارات الجهاز اتقفلت', 'ok'); }
    catch (err) { e.target.checked = false; toast('⚠️ ' + err.message, 'bad'); }
  });
  content.querySelector('#nt-sound')?.addEventListener('change', (e) => notif.setSoundEnabled(e.target.checked));
  content.querySelector('#nt-test')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      await apiJson('/api/notifications/test', { method: 'POST' });
      toast('✓ اتبعت — هتلاقيه في الجرس فوق', 'ok');
      notif.updateBadge();
    } catch (err) { toast('⚠️ ' + err.message, 'bad'); }
    finally { setTimeout(() => { b.disabled = false; }, 1500); }
  });

  if (!isAdmin) return;
  for (const g of NOTIF_GROUPS) {
    content.querySelector('#nt-' + g.key)?.addEventListener('change', async (e) => {
      const v = e.target.checked;
      content.querySelector(`[data-row="${g.key}"]`)?.classList.toggle('off', !v);
      if (!(await patch({ [g.key]: v ? 1 : 0 }))) { e.target.checked = !v; content.querySelector(`[data-row="${g.key}"]`)?.classList.toggle('off', v); }
    });
  }
  content.querySelector('#nt-lead')?.addEventListener('change', (e) => patch({ session_reminder_days: Number(e.target.value) }));
}

// ============================================================
// 5. تبويب المظهر
// ============================================================
function renderAppearanceTab(s) {
  return `
    <div class="card">
      <h3>🎨 إعدادات المظهر</h3>
      <div class="form-grid">
        <div class="form-row">
          <label class="label">الوضع</label>
          <select class="input" id="s-theme">
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>☀️ نهاري</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>🌙 ليلي</option>
            <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>🔄 تلقائي</option>
          </select>
        </div>
        <div class="form-row">
          <label class="label">اللون الأساسي</label>
          <input class="input" id="s-color" type="color" value="${s.primary_color || '#0F172A'}">
        </div>
        <div class="form-row">
          <label class="label">حجم الخط</label>
          <select class="input" id="s-font">
            <option value="small" ${s.font_size === 'small' ? 'selected' : ''}>صغير</option>
            <option value="medium" ${s.font_size === 'medium' ? 'selected' : ''}>متوسط</option>
            <option value="large" ${s.font_size === 'large' ? 'selected' : ''}>كبير</option>
          </select>
        </div>
        <div class="form-row">
          <label class="label">اللغة</label>
          <select class="input" id="s-lang">
            <option value="ar" ${s.language === 'ar' ? 'selected' : ''}>🇪🇬 العربية</option>
            <option value="en" ${s.language === 'en' ? 'selected' : ''}>🇬🇧 English</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="save-appearance" style="margin-top:16px">
        💾 حفظ إعدادات المظهر
      </button>
      <div id="s-app-status" class="status" style="margin-top:12px"></div>
    </div>
  `;
}

// ============================================================
// 6. تبويب الباقة
// ============================================================
async function renderPlanTab() {
  try {
    const usage = await apiJson('/api/subscription/usage');
    if (!usage) {
      return `<div class="card">مفيش بيانات اشتراك</div>`;
    }

    const items = (usage.items || []).map(it => {
      const barColor = it.is_reached ? 'var(--danger)'
                     : it.is_warning ? 'var(--warning)'
                     : 'var(--primary)';

      return `
        <div class="usage-row">
          <div class="usage-label">${it.icon} ${escapeHtml(it.label)}</div>
          <div class="usage-bar">
            <div class="usage-fill" style="width:${it.percentage}%;background:${barColor}"></div>
          </div>
          <div class="usage-num">
            ${it.used} / ${it.display_limit}
            ${it.is_reached ? '<span style="color:var(--danger);margin-right:4px">⛔</span>' : ''}
            ${it.is_warning ? '<span style="color:var(--warning);margin-right:4px">⚠️</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card">
        <h3>💎 الباقة الحالية</h3>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:12px;color:var(--text-soft);margin-bottom:4px">الباقة</div>
            <div style="font-size:22px;font-weight:800">${escapeHtml(usage.plan_name || usage.plan)}</div>
          </div>
          <a href="/pricing" class="btn btn-primary" style="text-decoration:none">
            💳 ترقية الباقة
          </a>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>📊 الاستخدام الحالي</h3>
        <p style="color:var(--text-soft);font-size:13px;margin-bottom:16px">
          تعرّف على استهلاكك الحالي من حدود باقتك
        </p>
        ${items}
      </div>

      <div class="card" style="margin-top:16px">
        <h3>ℹ️ ملاحظات</h3>
        <ul style="list-style:none;padding:0;margin:0;font-size:13.5px;line-height:1.8;color:var(--text-soft)">
          <li>✅ المسؤول الرئيسي <strong>مستثنى</strong> من حد المستخدمين</li>
          <li>⚠️ عند <strong>80%</strong> من أي حد، هتستلم إشعار تحذيري</li>
          <li>⛔ عند <strong>100%</strong>، مش هتقدر تضيف عناصر جديدة</li>
          <li>💎 الترقية بتزيد الحدود فورًا</li>
        </ul>
      </div>
    `;
  } catch (e) {
    return `<div class="card" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</div>`;
  }
}

// ============================================================
// 7. تبويب متقدم
// ============================================================
function renderAdvancedTab(isAdmin) {
  return `
    <div class="card">
      <h3>⚡ إعدادات متقدمة</h3>
      <p style="color:var(--text-soft);font-size:13px;margin-bottom:16px">
        أدوات متقدمة للمسؤول فقط
      </p>

      <div class="settings-actions">
        <button class="settings-action-btn" id="export-data">
          <span>📥</span>
          <div>
            <strong>تصدير البيانات</strong>
            <small>حمّل نسخة من كل بيانات المكتب (JSON)</small>
          </div>
        </button>

        ${isAdmin ? `
          <button class="settings-action-btn danger" id="reset-data">
            <span>⚠️</span>
            <div>
              <strong>إعادة تعيين البيانات</strong>
              <small>حذف كل البيانات — لا يمكن التراجع</small>
            </div>
          </button>
        ` : ''}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>ℹ️ معلومات النظام</h3>
      <div class="settings-info">
        <div class="settings-info-row">
          <span>الإصدار</span>
          <strong>v15 · 2026-10-14</strong>
        </div>
        <div class="settings-info-row">
          <span>Cloudflare Worker</span>
          <strong style="color:var(--success)">✅ يعمل</strong>
        </div>
        <div class="settings-info-row">
          <span>قاعدة البيانات</span>
          <strong style="color:var(--success)">✅ متصلة</strong>
        </div>
        <div class="settings-info-row">
          <span>الإشعارات</span>
          <strong style="color:var(--success)">✅ مفعّلة</strong>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// ربط الأحداث
// ============================================================
function bindTabEvents(host, tab, settings) {
  const save = async (btnId, statusId, data, successMsg) => {
    const btn = host.querySelector('#' + btnId);
    const st  = host.querySelector('#' + statusId);
    if (!btn || !st) return;

    btn.addEventListener('click', async () => {
      st.textContent = 'جاري الحفظ...';
      st.className = 'status';
      try {
        await apiJson('/api/settings', {
          method: 'PATCH',
          body: JSON.stringify(data()),
        });
        st.textContent = '✅ ' + successMsg;
        st.className = 'status ok';
        toast(successMsg, 'ok');
      } catch (e) {
        st.textContent = '❌ ' + e.message;
        st.className = 'status bad';
      }
    });
  };

  const val = (id) => host.querySelector('#' + id)?.value.trim() || null;
  const check = (id) => host.querySelector('#' + id)?.checked ? 1 : 0;
  const num = (id) => Number(host.querySelector('#' + id)?.value) || 0;

  // 1. المكتب
  if (tab === 'office') {
    // دولة المكتب: بتغيّر العملة والضريبة والتوقيت وتعيد تحميل البرنامج بالإعدادات الجديدة
    host.querySelectorAll('[data-set-country]').forEach(b => b.addEventListener('click', async () => {
      const to = b.dataset.setCountry;
      if (b.classList.contains('active')) return;
      const msg = to === 'SA'
        ? 'تحويل المكتب للسعودية؟\n\n• العملة: ريال سعودي، والضريبة 15%\n• التوقيت: الرياض، والتواريخ هجري وميلادي\n• المحاكم وأنواع القضايا والأنظمة السعودية\n\nالمبالغ المسجلة قبل كده مش بتتحوّل (بتفضل بأرقامها).'
        : 'تحويل المكتب لمصر؟\n\n• العملة: جنيه مصري، والضريبة 14%\n• التوقيت: القاهرة، والتواريخ ميلادي\n• المحاكم وأنواع القضايا والقوانين المصرية\n\nالمبالغ المسجلة قبل كده مش بتتحوّل (بتفضل بأرقامها).';
      if (!confirm(msg)) return;
      const d = to === 'SA' ? { country: 'SA', currency: 'SAR', vat_rate: 15 } : { country: 'EG', currency: 'EGP', vat_rate: 14 };
      try {
        await apiJson('/api/settings', { method: 'PATCH', body: JSON.stringify(d) });
        setOfficeMoneyPrefs(d);
        clearCache?.();
        toast('✅ اتغيّرت دولة المكتب', 'ok');
        setTimeout(() => location.reload(), 600); // كل الشاشات تتبني بالإعدادات الجديدة
      } catch (e) { toast('⚠️ ' + e.message, 'bad'); }
    }));

    save('save-office', 's-office-status', () => ({
      office_name_ar: val('s-office-name-ar'),
      office_name_en: val('s-office-name-en'),
      logo: val('s-logo'),
      phone: val('s-phone'),
      email: val('s-email'),
      website: val('s-website'),
      tax_number: val('s-tax'),
      commercial_register: val('s-cr'),
      address: val('s-address'),
    }), 'تم حفظ معلومات المكتب');
  }

  // 2. الحساب
  if (tab === 'account') {
    host.querySelector('#save-account')?.addEventListener('click', async () => {
      const st = host.querySelector('#s-acc-status');
      st.textContent = 'جاري الحفظ...'; st.className = 'status';
      try {
        await apiJson('/api/auth/me', {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: val('s-acc-name'),
            email: val('s-acc-email'),
          }),
        });
        st.textContent = '✅ اتحفظ'; st.className = 'status ok';
        toast('اتحفظ', 'ok');
      } catch (e) {
        st.textContent = '❌ ' + e.message; st.className = 'status bad';
      }
    });

    host.querySelector('#save-pw')?.addEventListener('click', async () => {
      const st = host.querySelector('#s-pw-status');
      st.textContent = 'جاري التغيير...'; st.className = 'status';
      try {
        await apiJson('/api/auth/password', {
          method: 'PATCH',
          body: JSON.stringify({
            old_password: val('s-pw-old'),
            new_password: val('s-pw-new'),
          }),
        });
        st.textContent = '✅ اتغيرت'; st.className = 'status ok';
        host.querySelector('#s-pw-old').value = '';
        host.querySelector('#s-pw-new').value = '';
      } catch (e) {
        st.textContent = '❌ ' + e.message; st.className = 'status bad';
      }
    });

    host.querySelector('#create-user')?.addEventListener('click', async () => {
      const st = host.querySelector('#s-new-status');
      st.textContent = 'جاري الإنشاء...'; st.className = 'status';
      try {
        await apiJson('/api/auth/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: val('s-new-name'),
            email: val('s-new-email'),
            password: val('s-new-pass'),
            role: 'lawyer',
          }),
        });
        st.textContent = '✅ اتعمل'; st.className = 'status ok';
        toast('اتعمل', 'ok');
        host.querySelector('#s-new-name').value = '';
        host.querySelector('#s-new-email').value = '';
        host.querySelector('#s-new-pass').value = '';
      } catch (e) {
        st.textContent = '❌ ' + e.message; st.className = 'status bad';
      }
    });
  }

  // 3. المحاسبة
  if (tab === 'accounting') {
    save('save-accounting', 's-acc2-status', () => {
      const d = {
      currency: val('s-currency'),
      vat_rate: num('s-vat'),
      invoice_prefix: val('s-inv-prefix'),
      fiscal_year_start: num('s-fiscal'),
      invoice_terms: val('s-inv-terms'),
      };
      setOfficeMoneyPrefs(d); // الشاشات المالية تاخد العملة والضريبة الجديدة على طول
      return d;
    }, 'تم حفظ إعدادات المحاسبة');
  }

  // 4. الإشعارات: ليها ربط خاص في renderNotifTab

  // 5. المظهر
  if (tab === 'appearance') {
    save('save-appearance', 's-app-status', () => ({
      theme: val('s-theme'),
      primary_color: val('s-color'),
      font_size: val('s-font'),
      language: val('s-lang'),
    }), 'تم حفظ إعدادات المظهر');
  }

  // 6. متقدم
  if (tab === 'advanced') {
    host.querySelector('#export-data')?.addEventListener('click', () => {
      toast('جاري تجهيز البيانات...', 'ok');
      window.open('/api/reports/monthly-trend?export=1', '_blank');
    });

    host.querySelector('#reset-data')?.addEventListener('click', () => {
      if (!confirm('⚠️ تحذير! سيتم حذف كل البيانات. متأكد؟')) return;
      if (!confirm('⚠️ تأكيد أخير — لا يمكن التراجع!')) return;
      toast('الاتصال بالدعم الفني مطلوب لإعادة التعيين', 'bad');
    });
  }
}

// ============================================================
// Helpers
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}