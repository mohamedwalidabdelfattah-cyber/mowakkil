// web/js/attribution.js
// مصدر الزيارة (إعلان فيسبوك/إنستجرام/جوجل…) — بيتحفظ أول ما الزائر يفتح أي صفحة عامة،
// وبيتبعت مع التسجيل عشان نعرف أنهي إعلان بيجيب ناس بتستخدم البرنامج وتشترك فعلاً.
// لينك الإعلان المقترح في Meta:
//   ?utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
(function () {
  var KEY = 'mowakkil_attr';
  var TTL = 30 * 86400000; // بعد 30 يوم من غير تسجيل بنعتبر الزيارة قديمة

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && Date.now() - (v.at || 0) < TTL) return v;
    } catch (e) {}
    return null;
  }
  function clip(s) { return s ? String(s).slice(0, 120) : null; }

  try {
    var q = new URLSearchParams(location.search);
    var utm = {
      source: clip(q.get('utm_source')), medium: clip(q.get('utm_medium')),
      campaign: clip(q.get('utm_campaign')), content: clip(q.get('utm_content')), term: clip(q.get('utm_term')),
    };
    var click = q.get('fbclid') ? 'meta' : (q.get('gclid') || q.get('gbraid') || q.get('wbraid')) ? 'google' : null;
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    if (ref === location.hostname) ref = ''; // تنقّل جوه الموقع مش مصدر

    var fromAd = utm.source || utm.campaign || click;
    var existing = read();
    // آخر زيارة جاية من إعلان بتكسب، وغير كده أول مصدر خارجي بيفضل
    if (fromAd || (!existing && ref)) {
      localStorage.setItem(KEY, JSON.stringify({
        source: utm.source, medium: utm.medium, campaign: utm.campaign, content: utm.content, term: utm.term,
        click: click, referrer: clip(ref), landing: clip(location.pathname), at: Date.now(),
      }));
    }
  } catch (e) {}

  window.mowakkilAttribution = function () { return read(); };
})();
