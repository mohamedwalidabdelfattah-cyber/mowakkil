// web/js/search.js
// البحث الذكي الشامل + Live Search

import { apiJson } from './api.js';
import { showView } from './router.js';

const HISTORY_KEY = 'mowakkil-search-history';
const MAX_HISTORY = 8;

let modal = null;
let input = null;
let resultsEl = null;
let selectedIndex = 0;
let currentResults = [];
let debounceTimer = null;

// ============================================================
// فتح / إغلاق المودال
// ============================================================
export function openSearch() {
  if (modal) return; // مفتوح بالفعل

  createModal();
  input.focus();
}

export function closeSearch() {
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => {
    modal.remove();
    modal = null;
    input = null;
    resultsEl = null;
    currentResults = [];
    selectedIndex = 0;
  }, 200);
}

// ============================================================
// إنشاء المودال
// ============================================================
function createModal() {
  const history = getHistory();

  const html = `
    <div class="search-modal" id="search-modal">
      <div class="search-backdrop" id="search-backdrop"></div>
      <div class="search-panel">
        <div class="search-header">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            class="search-input"
            id="search-input"
            placeholder="ابحث في القضايا، الموكلين، الأتعاب، الفواتير..."
            autocomplete="off"
            spellcheck="false"
          >
          <kbd class="search-kbd">ESC</kbd>
        </div>

        <div class="search-results" id="search-results">
          ${history.length ? renderHistory(history) : renderQuickLinks()}
        </div>

        <div class="search-footer">
          <div class="search-footer-item">
            <kbd>↑↓</kbd> <span>تنقّل</span>
          </div>
          <div class="search-footer-item">
            <kbd>↵</kbd> <span>فتح</span>
          </div>
          <div class="search-footer-item">
            <kbd>ESC</kbd> <span>إغلاق</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  modal = document.getElementById('search-modal');
  input = document.getElementById('search-input');
  resultsEl = document.getElementById('search-results');

  requestAnimationFrame(() => modal.classList.add('show'));

  // Events
  document.getElementById('search-backdrop')?.addEventListener('click', closeSearch);
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  modal.addEventListener('click', onResultClick);
}

// ============================================================
// آخر عمليات البحث
// ============================================================
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function addToHistory(query) {
  if (!query || query.length < 2) return;
  const history = getHistory().filter(h => h !== query);
  history.unshift(query);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// ============================================================
// عرض الـ History
// ============================================================
function renderHistory(history) {
  return `
    <div class="search-section">
      <div class="search-section-head">
        <span class="search-section-title">آخر عمليات البحث</span>
        <button class="search-section-action" id="clear-history">مسح</button>
      </div>
      <div class="search-items">
        ${history.map(q => `
          <button class="search-history-item" data-history="${escapeAttr(q)}">
            <span class="search-item-icon">🕐</span>
            <span class="search-item-title">${escapeHtml(q)}</span>
          </button>
        `).join('')}
      </div>
    </div>
    ${renderQuickLinks()}
  `;
}

// ============================================================
// روابط سريعة
// ============================================================
function renderQuickLinks() {
  const links = [
    { icon: '🏠', title: 'لوحة التحكم', view: 'dashboard' },
    { icon: '⚖️', title: 'القضايا',     view: 'cases' },
    { icon: '👥', title: 'الموكلون',   view: 'clients' },
    { icon: '💰', title: 'التحصيل',     view: 'fees' },
    { icon: '✅', title: 'المهام',      view: 'tasks' },
    { icon: '📅', title: 'الأجندة',     view: 'agenda' },
  ];

  return `
    <div class="search-section">
      <div class="search-section-head">
        <span class="search-section-title">روابط سريعة</span>
      </div>
      <div class="search-items">
        ${links.map(l => `
          <button class="search-quick-item" data-view="${l.view}">
            <span class="search-item-icon">${l.icon}</span>
            <span class="search-item-title">${l.title}</span>
            <span class="search-item-arrow">←</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// لما المستخدم يكتب
// ============================================================
function onInput(e) {
  const q = e.target.value.trim();
  selectedIndex = 0;

  clearTimeout(debounceTimer);

  if (!q || q.length < 2) {
    const history = getHistory();
    resultsEl.innerHTML = history.length ? renderHistory(history) : renderQuickLinks();
    return;
  }

  // Loading indicator فوري
  resultsEl.innerHTML = `
    <div class="search-loading">
      <div class="search-spinner"></div>
      <span>جاري البحث...</span>
    </div>
  `;

  // Debounce 300ms
  debounceTimer = setTimeout(() => doSearch(q), 300);
}

// ============================================================
// البحث الفعلي
// ============================================================
async function doSearch(q) {
  try {
    const res = await apiJson(`/api/settings/search?q=${encodeURIComponent(q)}`);
    const results = res?.results || [];
    currentResults = results;
    selectedIndex = 0;
    renderResults(results, q);
  } catch (err) {
    console.error('Search failed:', err);
    resultsEl.innerHTML = `
      <div class="search-empty">
        <div class="search-empty-icon">⚠️</div>
        <div class="search-empty-title">حصل خطأ في البحث</div>
        <div class="search-empty-sub">${escapeHtml(err.message || 'حاول تاني')}</div>
      </div>
    `;
  }
}

// ============================================================
// عرض النتائج
// ============================================================
function renderResults(results, query) {
  if (!results.length) {
    resultsEl.innerHTML = `
      <div class="search-empty">
        <div class="search-empty-icon">🔍</div>
        <div class="search-empty-title">مفيش نتائج لـ "${escapeHtml(query)}"</div>
        <div class="search-empty-sub">جرّب كلمات تانية أو تحقق من الإملاء</div>
      </div>
    `;
    return;
  }

  // تجميع حسب النوع
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });

  const typeLabels = {
    case:     '⚖️ القضايا',
    client:   '👥 الموكلون',
    fee:      '💰 الأتعاب',
    payment:  '💵 الدفعات',
    invoice:  '📄 الفواتير',
    session:  '📅 الجلسات',
    task:     '✅ المهام',
    lawyer:   '👨‍⚖️ المحامون',
  };

  let html = '';
  let globalIndex = 0;

  Object.entries(grouped).forEach(([type, items]) => {
    html += `
      <div class="search-section">
        <div class="search-section-head">
          <span class="search-section-title">${typeLabels[type] || type}</span>
          <span class="search-section-count">${items.length}</span>
        </div>
        <div class="search-items">
          ${items.map(item => {
            const idx = globalIndex++;
            return `
              <button class="search-result-item ${idx === 0 ? 'selected' : ''}"
                      data-result-index="${idx}"
                      data-link="${escapeAttr(item.link || '')}">
                <span class="search-item-icon">${item.icon || '📌'}</span>
                <div class="search-item-body">
                  <div class="search-item-title">${highlight(item.title, query)}</div>
                  ${item.subtitle ? `<div class="search-item-sub">${highlight(item.subtitle, query)}</div>` : ''}
                </div>
                <span class="search-item-arrow">←</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  resultsEl.innerHTML = html;
}

// ============================================================
// تمييز الكلمة المبحوث عنها
// ============================================================
function highlight(text, query) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escaped.replace(regex, '<mark class="search-mark">$1</mark>');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

// ============================================================
// Keyboard Navigation
// ============================================================
function onKeyDown(e) {
  const items = resultsEl.querySelectorAll('.search-result-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!items.length) return;
    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
    updateSelection(items);
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection(items);
  }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const selected = items[selectedIndex];
    if (selected) selected.click();
  }
  else if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
  }
}

function updateSelection(items) {
  items.forEach((it, i) => {
    it.classList.toggle('selected', i === selectedIndex);
    if (i === selectedIndex) {
      it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

// ============================================================
// لما المستخدم يدوس على نتيجة
// ============================================================
function onResultClick(e) {
  // مسح الـ history
  if (e.target.closest('#clear-history')) {
    clearHistory();
    resultsEl.innerHTML = renderQuickLinks();
    return;
  }

  // نتيجة من الـ history
  const histBtn = e.target.closest('[data-history]');
  if (histBtn) {
    const q = histBtn.dataset.history;
    input.value = q;
    input.dispatchEvent(new Event('input'));
    return;
  }

  // رابط سريع
  const quickBtn = e.target.closest('[data-view]');
  if (quickBtn) {
    closeSearch();
    showView(quickBtn.dataset.view);
    return;
  }

  // نتيجة بحث
  const resultBtn = e.target.closest('[data-result-index]');
  if (resultBtn) {
    const idx = parseInt(resultBtn.dataset.resultIndex, 10);
    const item = currentResults[idx];
    if (!item) return;

    // احفظ في الـ history
    addToHistory(input.value.trim());

    closeSearch();

    // فتح الصفحة المناسبة
    handleResultNavigation(item);
  }
}

// ============================================================
// التنقل حسب نوع النتيجة
// ============================================================
function handleResultNavigation(item) {
  const link = item.link || '';

  // case-123 → افتح القضية
  if (link.startsWith('#case-')) {
    const id = link.replace('#case-', '');
    showView('cases');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('mowakkil:open-case', { detail: { id } }));
    }, 100);
    return;
  }

  // client-123 → افتح الموكل
  if (link.startsWith('#client-')) {
    const id = link.replace('#client-', '');
    showView('clients');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('mowakkil:open-client', { detail: { id } }));
    }, 100);
    return;
  }

  // task-123 → افتح المهمة
  if (link.startsWith('#task-')) {
    const id = link.replace('#task-', '');
    showView('tasks');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('mowakkil:open-task', { detail: { id } }));
    }, 100);
    return;
  }

  // invoice-123 → افتح الفاتورة
  if (link.startsWith('#invoice-')) {
    const id = link.replace('#invoice-', '');
    showView('money-invoices');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('mowakkil:open-invoice', { detail: { id } }));
    }, 100);
    return;
  }

  // fallback: افتح حسب النوع
  const typeViews = {
    case:     'cases',
    client:   'clients',
    fee:      'fees',
    payment:  'money',
    invoice:  'money-invoices',
    session:  'agenda',
    task:     'tasks',
    lawyer:   'lawyers',
  };

  if (typeViews[item.type]) {
    showView(typeViews[item.type]);
  }
}

// ============================================================
// Global Shortcuts
// ============================================================
export function initSearch() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K أو Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    // Ctrl+/ كـ اختيار بديل
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      openSearch();
    }
  });
}