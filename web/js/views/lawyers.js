// web/js/views/lawyers.js
import { apiJson } from '../api.js';
import { esc, empty, waLink, toast, fmtMoney, skeleton, bindPanels, curName } from '../ui.js';
import { countryInfo } from '../country.js';
import { setLawyers } from '../state.js';

// حالة الفلاتر
let currentFilters = {
  search: '',
  includeInactive: false,
};

export async function render(host) {
  // Skeleton احترافي
  host.innerHTML = `
    <div class="card">${skeleton(2, 'card')}</div>
    <div class="card">${skeleton(3, 'list')}</div>
  `;

  const loadAndRender = async () => {
    // بناء الـ query
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.includeInactive) params.append('include_inactive', '1');
    const qs = params.toString();
    const query = qs ? `?${qs}` : '';

    const list = await apiJson(`/api/lawyers${query}`);
    setLawyers(list);

    host.innerHTML = `
      <div class="app-top">
        <div>
          <h2>المحامين</h2>
          <div class="meta" style="margin:2px 0 0">${list.length} محامٍ</div>
        </div>
        <button class="btn btn-primary" data-toggle-panel="lawyer-panel">➕ محامٍ جديد</button>
      </div>

      <div class="card" id="lawyer-panel" hidden>
        <h3>➕ إضافة محامٍ</h3>
        <div class="row">
          <div><label>الاسم</label><input id="l-name" placeholder="مثال: كريم عادل"></div>
          <div><label>الدرجة</label><input id="l-grade" placeholder="شريك / محامي أول"></div>
        </div>
        <div class="row">
          <div><label>المرتب (${curName()})</label><input id="l-salary" type="number" placeholder="8000"></div>
          <div><label>رقم واتساب</label><input id="l-phone" placeholder="${countryInfo().phonePlaceholder}"></div>
        </div>
        <button class="primary" style="margin-top:10px" id="add-lawyer">حفظ</button>
      </div>

      <!-- شريط الفلاتر -->
      <div class="filter-bar">
        <div class="filter-bar-inner">
          <div class="filter-item">
            <input type="text" class="filter-input" id="filter-search" 
                   placeholder="🔍 بحث بالاسم أو الهاتف أو الدرجة..." 
                   value="${esc(currentFilters.search)}">
          </div>
          <div class="filter-item">
            <label class="filter-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:20px">
              <input type="checkbox" id="filter-inactive" ${currentFilters.includeInactive ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
              <span>عرض غير النشطين</span>
            </label>
          </div>
          <button class="btn btn-ghost filter-reset" id="filter-reset">🔄 مسح</button>
        </div>
      </div>

      <div id="lawyers-list">
        ${list.length 
          ? list.map(l => renderLawyerItem(l)).join('') 
          : empty(
              currentFilters.search || currentFilters.includeInactive
                ? 'مفيش نتايج مطابقة للفلاتر'
                : 'مفيش محامين لحد الآن',
              '👨‍⚖️',
              !currentFilters.search && !currentFilters.includeInactive
                ? { text: '+ إضافة أول محامي', onClick: () => document.getElementById('l-name')?.focus() }
                : null
            )
        }
      </div>
    `;

    bindPanels(host);

    // === ربط أحداث الفلاتر ===
    let searchTimeout;
    host.querySelector('#filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        loadAndRender();
      }, 500);
    });

    host.querySelector('#filter-inactive')?.addEventListener('change', (e) => {
      currentFilters.includeInactive = e.target.checked;
      loadAndRender();
    });

    host.querySelector('#filter-reset')?.addEventListener('click', () => {
      currentFilters = { search: '', includeInactive: false };
      loadAndRender();
    });

    // === ربط أحداث إضافة محامي ===
    host.querySelector('#add-lawyer')?.addEventListener('click', async () => {
      const name = host.querySelector('#l-name').value.trim();
      if (!name) return toast('اكتب اسم المحامي', 'bad');
      await apiJson('/api/lawyers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          grade: host.querySelector('#l-grade').value.trim(),
          salary: parseFloat(host.querySelector('#l-salary').value) || null,
          phone: host.querySelector('#l-phone').value.trim(),
        }),
      });
      toast('اتحفظ', 'ok');
      loadAndRender();
    });

    // === ربط أحداث كل محامي ===
    host.querySelector('#lawyers-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-del-lawyer]');
      if (!btn) return;
      if (!confirm('متأكد من حذف المحامي؟ (هيتم فك ارتباطه بالمهام)')) return;
      await apiJson(`/api/lawyers/${btn.dataset.delLawyer}`, { method: 'DELETE' });
      toast('اتحذف', 'ok');
      loadAndRender();
    });
  };

  await loadAndRender();
}

// ============================================================
// شكل المحامي
// ============================================================
function renderLawyerItem(l) {
  return `
    <div class="item">
      <div class="top">
        <span class="name">${esc(l.name)}</span>
        <span class="num mono">${esc(l.grade || '')}</span>
      </div>
      <div class="meta">
        💰 المرتب: ${l.salary ? fmtMoney(l.salary) + ' جنيه' : '—'}
        ${l.phone ? ' · 📱 ' + esc(l.phone) : ''}
      </div>
      <div class="acts">
        ${l.phone ? `<a class="wa" href="${waLink(l.phone)}" target="_blank" rel="noopener">💬 واتساب</a>` : ''}
        <button class="ghost" data-del-lawyer="${l.id}" style="color:var(--danger)">🗑 حذف</button>
      </div>
    </div>`;
} 
