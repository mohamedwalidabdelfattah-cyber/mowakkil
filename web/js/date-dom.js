// web/js/date-dom.js
// عرض التواريخ بالهجري في كل الشاشات (حسب إعداد المكتب: هجري / ميلادي / الاتنين)
// - أي تاريخ YYYY-MM-DD ظاهر في الصفحة (القوايم، التفاصيل، الجداول…) بيتعرض بالهجري
// - تحت كل خانة إدخال تاريخ بيظهر التاريخ الهجري المقابل وانت بتختار
// التخزين في الداتابيز بيفضل ميلادي زي ما هو — ده عرض بس.

import { dateMode, fmtDay, hijriDate } from './country.js';

const ISO = /(?<![\d/-])((?:19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:[ T]([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?Z?)?(?![\d/-])/g;
// أماكن منلمسهاش: الكتابة، الكود، الشات، وخانات التقويم (ليها عرض هجري خاص)
const SKIP = 'script,style,textarea,input,select,[contenteditable],[data-raw-date],code,pre,.chat-messages,.chat-message,.calendar-host,.fu-preview,#fu-text';

function convertText(s) {
  if (!s || s.indexOf('-') < 0) return s;
  ISO.lastIndex = 0;
  if (!ISO.test(s)) return s;
  ISO.lastIndex = 0;
  return s.replace(ISO, (m, y, mo, d, hh, mm) => {
    const label = fmtDay(`${y}-${mo}-${d}`, 'short');
    return hh ? `${label} ${hh}:${mm}` : label;
  });
}

function fixText(node) {
  const p = node.parentElement;
  if (!p || p.closest(SKIP)) return;
  const v = node.nodeValue;
  const t = convertText(v);
  if (t !== v) node.nodeValue = t;
}

// ===== خانات إدخال التاريخ: الهجري المقابل تحتها
function hintFor(input) {
  let h = input.nextElementSibling;
  if (!h || !h.classList?.contains('hijri-hint')) {
    h = document.createElement('small');
    h.className = 'hijri-hint';
    h.setAttribute('aria-live', 'polite');
    input.insertAdjacentElement('afterend', h);
  }
  return h;
}
function updateHint(input) {
  const v = String(input.value || '').slice(0, 10);
  const h = hintFor(input);
  h.textContent = /^\d{4}-\d{2}-\d{2}$/.test(v) ? '🌙 ' + hijriDate(v, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
}
function wireDateInput(input) {
  if (input.dataset.hijriWired) return;
  input.dataset.hijriWired = '1';
  ['input', 'change', 'blur'].forEach(ev => input.addEventListener(ev, () => updateHint(input)));
  updateHint(input);
  setTimeout(() => updateHint(input), 300); // القيمة ساعات بتتحط بالكود بعد الإضافة
}

function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1) return;
  if (root.matches?.('input[type="date"],input[type="datetime-local"]')) return wireDateInput(root);
  root.querySelectorAll?.('input[type="date"],input[type="datetime-local"]').forEach(wireDateInput);
  if (root.closest?.(SKIP)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = tw.nextNode();
  while (n) { fixText(n); n = tw.nextNode(); }
}

let observer = null;
export function startDateDom() {
  stopDateDom();
  if (dateMode() === 'gregorian') return;
  walk(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') fixText(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}
export function stopDateDom() {
  observer?.disconnect(); observer = null;
  document.querySelectorAll('.hijri-hint').forEach(h => h.remove());
  document.querySelectorAll('[data-hijri-wired]').forEach(i => delete i.dataset.hijriWired);
}
