// web/js/support-fab.js
// زرار واتساب عائم للدعم الفني — بيظهر في كل الصفحات (الموقع، الدخول، النظام، الباقات، التسجيل، الدفع).
// سكربت مستقل (مش module) عشان يشتغل في أي صفحة من غير ما يعتمد على باقي الكود.
(function () {
  if (window.__supportFab) return;
  window.__supportFab = true;

  var SUPPORT_PHONE = '201013917789'; // 01013917789
  var LABEL = 'الدعم الفني';

  function pageName() {
    var p = location.pathname;
    if (/pricing/.test(p)) return 'صفحة الباقات';
    if (/signup/.test(p)) return 'التسجيل';
    if (/pay/.test(p)) return 'الدفع';
    var h = (location.hash || '').replace('#', '');
    if (!h || h === 'login') return localStorage.getItem('mowakkil_token') ? 'النظام' : 'الموقع';
    return 'النظام';
  }

  function link() {
    var text = 'مرحباً فريق مُوكِّل 👋\nمحتاج مساعدة (' + pageName() + '):\n';
    return 'https://wa.me/' + SUPPORT_PHONE + '?text=' + encodeURIComponent(text);
  }

  var css = '' +
    '.support-fab{position:fixed;inset-inline-end:20px;bottom:20px;z-index:140;display:flex;align-items:center;gap:0;' +
    'height:56px;min-width:56px;padding:0 15px;border-radius:999px;background:#1fa855;color:#fff !important;text-decoration:none !important;' +
    'box-shadow:0 10px 24px -6px rgba(16,120,60,.55),0 2px 6px rgba(0,0,0,.15);font:700 14.5px "Tajawal","Cairo",system-ui,sans-serif;' +
    'transition:bottom .25s ease,gap .25s ease,background .2s ease,transform .2s ease;-webkit-tap-highlight-color:transparent}' +
    '.support-fab:hover{background:#178a45;transform:translateY(-2px)}' +
    '.support-fab:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px #1fa855}' +
    '.support-fab svg{width:26px;height:26px;flex-shrink:0}' +
    '.support-fab .sf-label{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .3s ease}' +
    '.support-fab:hover .sf-label,.support-fab:focus-visible .sf-label,.support-fab.sf-intro .sf-label{max-width:140px}' +
    '.support-fab:hover,.support-fab:focus-visible,.support-fab.sf-intro{gap:8px}' +
    '.support-fab::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 0 rgba(31,168,85,.5);animation:sf-pulse 2.4s ease-out 3}' +
    '@keyframes sf-pulse{0%{box-shadow:0 0 0 0 rgba(31,168,85,.45)}100%{box-shadow:0 0 0 16px rgba(31,168,85,0)}}' +
    '@media (prefers-reduced-motion:reduce){.support-fab,.support-fab .sf-label{transition:none}.support-fab::after{animation:none}}' +
    '@media (max-width:768px){.support-fab{inset-inline-end:14px;height:52px;min-width:52px;padding:0 13px}}' +
    '@media print{.support-fab{display:none !important}}';

  var icon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.19 4.23-9.41 9.43-9.41 2.52 0 4.88.98 6.66 2.76a9.35 9.35 0 0 1 2.76 6.66c0 5.2-4.23 9.41-9.43 9.41zm8.02-17.43A11.27 11.27 0 0 0 12.05.75C5.8.75.72 5.83.72 12.08c0 2 .52 3.95 1.52 5.67L.62 23.25l5.64-1.48a11.3 11.3 0 0 0 5.78 1.48h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.31-8.01z"/></svg>';

  function mount() {
    if (document.querySelector('.support-fab')) return;
    var st = document.createElement('style');
    st.id = 'support-fab-css';
    st.textContent = css;
    document.head.appendChild(st);

    var a = document.createElement('a');
    a.className = 'support-fab';
    a.href = link();
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'تواصل مع الدعم الفني على واتساب');
    a.title = 'تواصل مع الدعم الفني على واتساب';
    a.innerHTML = icon + '<span class="sf-label">' + LABEL + '</span>';
    // الرسالة بتتحدّث حسب الصفحة وقت الضغط
    a.addEventListener('click', function () { a.href = link(); });
    document.body.appendChild(a);

    // أول مرة: الكلمة بتظهر شوية وبعدين تتقفل
    try {
      if (!sessionStorage.getItem('sf_intro')) {
        a.classList.add('sf-intro');
        setTimeout(function () { a.classList.remove('sf-intro'); }, 4000);
        sessionStorage.setItem('sf_intro', '1');
      }
    } catch (e) { /* مش مهم */ }

    // نطلع فوق شريط التنقل السفلي (موبايل) وشريط «من غير إنترنت» لو ظاهرين
    function visibleHeight(el) {
      if (!el) return 0;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      var r = el.getBoundingClientRect();
      if (!r.height || r.top >= innerHeight) return 0;
      return Math.max(0, innerHeight - r.top);
    }
    function place() {
      var lift = Math.max(
        visibleHeight(document.querySelector('.bottom-nav')),
        visibleHeight(document.getElementById('offline-banner'))
      );
      a.style.bottom = (lift ? lift + 12 : (innerWidth <= 768 ? 16 : 20)) + 'px';
      // نخبيه لما نافذة التثبيت أو البحث مفتوحة
      var cover = document.querySelector('.install-sheet.show, .search-modal');
      a.style.display = cover ? 'none' : '';
    }
    place();
    addEventListener('resize', place);
    setInterval(place, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
