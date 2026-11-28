// web/js/views/sa-laws.js
// تاب «📚 القوانين» في لوحة السوبر أدمن:
//   ➕ إضافة قانون: ملف (PDF/Word/صورة — والمتصوّر بيتقري OCR) أو لصق نص أو ويكي مصدر
//      ← تقسيم لمواد + معاينة وتحذيرات (نص ملخص «…» / مواد ناقصة) ← إضافة على دفعات ← فهرسة الجديد بس
//   📋 القوانين الموجودة (عند الطلب) وتغيير حالة أي قانون (ساري / يُراجع / ملغى / غير رسمي)
import { saApiJson } from '../api.js';
import { esc, toast } from '../ui.js';
import { splitArticles } from '../law-splitter.js';
import { extractLawText, aiReadPdf } from '../law-extract.js';

const STATUS = {
  active: ['✅', 'ساري'], review: ['🔄', 'يُراجع'], repealed: ['⛔', 'ملغى'], unofficial: ['🚫', 'غير رسمي'], mixed: ['➖', 'مختلط'],
};
const CHUNK = 100;           // مواد في كل طلب إضافة (السيرفر بيقبل لحد 150)
const REINDEX_BATCH = 50;    // مواد في كل دفعة فهرسة
const WS_API = 'https://ar.wikisource.org/w/api.php';
const RESUME_KEY = 'mowakkil_law_reindex';

export function mountLaws(host) {
  let laws = null;   // قايمة القوانين (بتتحمل عند الطلب)
  let parsed = null; // نتيجة التقسيم
  host.innerHTML = `
    <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h3 style="margin:0">📚 قاعدة المواد القانونية</h3>
    </div>
    <p style="font-size:12.5px;color:var(--text-soft);margin:6px 0 14px;line-height:1.8">
      أضف القوانين الناقصة من <b>نسخة رسمية كاملة</b> (الجريدة الرسمية، أو PDF رسمي من الجهة المختصة).
      النسخ الملخصة على النت (فيها «…» أو مواد ناقصة) بتتكشف وبتتمنع إلا لو أكدت بنفسك.
    </p>
    <div id="laws-resume"></div>

    <div class="card" style="background:var(--gray-50);margin-bottom:12px">
      <h4 style="margin:0 0 10px">➕ إضافة قانون</h4>
      <div class="law-src" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <button class="primary" data-src="file">📄 ملف (PDF / Word / صورة)</button>
        <button class="ghost" data-src="paste">📋 لصق نص</button>
        <button class="ghost" data-src="wiki">🌐 ويكي مصدر</button>
      </div>
      <div data-srcpane="file"><input type="file" id="law-file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"></div>
      <div data-srcpane="paste" hidden><textarea id="law-paste" rows="6" placeholder="الصق نص القانون كامل (بعناوين المواد: مادة 1 / المادة (1) …)"></textarea></div>
      <div data-srcpane="wiki" hidden>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><select id="law-wiki" style="flex:1;min-width:240px"><option value="">⏳ جاري تحميل القايمة…</option></select>
        <button class="ghost" id="law-wiki-load">جلب النص</button></div>
        <div style="font-size:12px;color:var(--text-soft);margin-top:4px">⚠️ بعض نسخ ويكي مصدر ملخصة — المعاينة هتقولك.</div>
      </div>
      <div id="law-extract-status" style="font-size:12.5px;margin:8px 0;color:var(--text-soft)"></div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:6px">
        <div><label>اسم القانون *</label><input id="law-name" placeholder="قانون العمل"></div>
        <div><label>الرقم والسنة</label><input id="law-number" placeholder="14 لسنة 2025"></div>
        <div><label>الدولة</label><select id="law-country"><option value="EG">🇪🇬 مصر</option><option value="SA">🇸🇦 السعودية</option></select></div>
        <div><label>المصدر الرسمي</label><input id="law-official" placeholder="الجريدة الرسمية العدد 18 بتاريخ 3/5/2025"></div>
        <div><label>رابط المصدر</label><input id="law-url" placeholder="https://…"></div>
        <div><label>بيلغي قانون موجود؟</label><select id="law-replaces"><option value="">— لا —</option></select>
          <button class="ghost" id="law-load-names" style="padding:2px 8px;font-size:12px;margin-top:4px">تحميل أسماء القوانين</button></div>
      </div>
      <button class="ghost" id="law-split" style="margin-top:10px">🔍 قسّم المواد وراجع</button>
      <div id="law-preview" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <h4 style="margin:0">📋 القوانين الموجودة</h4>
        <div style="display:flex;gap:6px"><select id="laws-country"><option value="EG">🇪🇬 مصر</option><option value="SA">🇸🇦 السعودية</option></select>
          <button class="ghost" id="laws-load">عرض القوانين</button></div>
      </div>
      <div style="font-size:12px;color:var(--text-soft);margin-top:4px">العرض بيقرا كل مواد الدولة مرة (آلاف الصفوف) — عشان كده مش بيتحمل لوحده.</div>
      <div id="laws-list" style="margin-top:10px"></div>
    </div>`;

  const $ = s => host.querySelector(s);
  const status = msg => { $('#law-extract-status').textContent = msg || ''; };
  let rawText = '';

  // ---------- مصدر النص ----------
  host.querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', () => {
    host.querySelectorAll('[data-src]').forEach(x => { const on = x === b; x.classList.toggle('primary', on); x.classList.toggle('ghost', !on); });
    host.querySelectorAll('[data-srcpane]').forEach(p => { p.hidden = p.dataset.srcpane !== b.dataset.src; });
    if (b.dataset.src === 'wiki') loadWikiList();
  }));

  const done = r => {
    rawText = r.text;
    status(`✅ اتقرا ${rawText.length.toLocaleString('en-US')} حرف${r.ai ? ' بالذكاء الاصطناعي — راجع العينة في المعاينة' : r.ocr ? ' بالـ OCR — راجع النص كويس (الـ OCR بيغلط في بعض الحروف)' : ''}${r.quality === 'broken' ? ' ⚠️ النص طالع حروف متقطعة — جرّب نسخة Word أو انسخ النص والصقه' : ''}`);
    if (!$('#law-name').value) $('#law-name').value = guessName(rawText);
  };
  $('#law-file').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    e.target.value = ''; // عشان اختيار نفس الملف تاني يشتغل (استكمال)
    try {
      const r = await extractLawText(f, status, { ocr: 'none' });
      if (!r.needsOcr) return done(r);
      // ملف متصوّر (أو خطوطه بايظة): نخيّر — الذكاء الاصطناعي أدق بكتير في العربي
      const mins = Math.ceil(r.pages * 4.5 / 60);
      $('#law-extract-status').innerHTML = `📄 الملف ${r.garbled ? 'خطوطه مش مقروءة' : 'متصوّر (صور مش نص)'} — ${r.pages} صفحة. اختار طريقة القراءة:
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button class="primary" id="law-read-ai">📸 قراءة بالذكاء الاصطناعي (أدق — حوالي ${mins} دقيقة)</button>
          <button class="ghost" id="law-read-ocr">🔤 OCR عادي (أسرع — أخطاء كتير في العربي)</button>
        </div>`;
      // القراءة بتتحفظ صفحة صفحة؛ لو وقفت (الحصة) بيظهر «كمّل القراءة» بنفس الملف
      const readAi = async () => {
        try {
          done(await aiReadPdf(f, async b64 => (await saApiJson('/api/superadmin/laws/ocr', { method: 'POST', body: JSON.stringify({ image: b64, mime: 'image/jpeg' }) })).text, status));
        } catch (err) {
          $('#law-extract-status').innerHTML = `⏸️ ${esc(err.message)} <button class="ghost" id="law-read-continue" style="padding:2px 10px;margin-inline-start:6px">▶️ كمّل القراءة</button>`;
          $('#law-read-continue').addEventListener('click', readAi);
        }
      };
      $('#law-read-ai').addEventListener('click', readAi);
      $('#law-read-ocr').addEventListener('click', async () => {
        try { done(await extractLawText(f, status)); } catch (err) { status('⚠️ ' + err.message); }
      });
    } catch (err) { status('⚠️ ' + err.message); }
  });

  let wikiLoaded = false;
  async function loadWikiList() {
    if (wikiLoaded) return;
    wikiLoaded = true;
    try {
      const titles = [];
      let cont = '';
      for (let i = 0; i < 4; i++) {
        const r = await fetch(`${WS_API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent('تصنيف:قوانين مصر')}&cmlimit=500&cmnamespace=0&format=json&origin=*${cont}`).then(x => x.json());
        titles.push(...(r.query?.categorymembers || []).map(m => m.title).filter(t => !t.includes('/')));
        if (!r.continue) break;
        cont = '&cmcontinue=' + encodeURIComponent(r.continue.cmcontinue);
      }
      $('#law-wiki').innerHTML = '<option value="">— اختار قانون —</option>' + titles.map(t => `<option>${esc(t)}</option>`).join('');
    } catch { $('#law-wiki').innerHTML = '<option value="">مقدرتش أوصل لويكي مصدر</option>'; wikiLoaded = false; }
  }
  $('#law-wiki-load').addEventListener('click', async () => {
    const title = $('#law-wiki').value;
    if (!title) return toast('اختار قانون', 'bad');
    status('⏳ جلب النص من ويكي مصدر…');
    try {
      const r = await fetch(`${WS_API}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&origin=*`).then(x => x.json());
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px';
      div.innerHTML = r.parse?.text || '';
      div.querySelectorAll('style, script, .mw-editsection, #toc, .toc, sup.reference').forEach(x => x.remove());
      document.body.appendChild(div);
      rawText = div.innerText;
      div.remove();
      $('#law-url').value = `https://ar.wikisource.org/wiki/${encodeURIComponent(title)}`;
      if (!$('#law-name').value) $('#law-name').value = title.replace(/\s*[-–(].*$/, '').trim();
      if (!$('#law-official').value) $('#law-official').value = 'ويكي مصدر (غير رسمي — يُطابق على الجريدة الرسمية)';
      status(`✅ اتجاب ${rawText.length.toLocaleString('en-US')} حرف`);
    } catch (e) { status('⚠️ ' + e.message); }
  });

  // ---------- أسماء القوانين (للإلغاء) ----------
  async function loadLaws(country) {
    laws = await saApiJson(`/api/superadmin/laws?country=${country}`);
    return laws;
  }
  $('#law-load-names').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      const list = await loadLaws($('#law-country').value);
      $('#law-replaces').innerHTML = '<option value="">— لا —</option>' + list.map(l => `<option value="${esc(l.law_name)}">${esc(l.law_name)} (${l.articles} مادة)</option>`).join('');
      toast('✅ اتحملت', 'ok');
    } catch (err) { toast(err.message, 'bad'); } finally { e.target.disabled = false; }
  });

  // ---------- تقسيم ومعاينة ----------
  $('#law-split').addEventListener('click', () => {
    const src = host.querySelector('[data-src].primary')?.dataset.src;
    const text = src === 'paste' ? $('#law-paste').value : rawText;
    if (!text || text.trim().length < 50) return toast('مفيش نص — اختار ملف أو الصق النص', 'bad');
    parsed = splitArticles(text);
    renderPreview();
  });

  function renderPreview() {
    const box = $('#law-preview');
    const { articles, warnings, severe } = parsed;
    if (!articles.length) { box.innerHTML = '<div class="warn">مالقيتش عناوين مواد (مادة 1 / المادة (1)…) — اتأكد من النص.</div>'; return; }
    const sample = [...articles.slice(0, 3), ...(articles.length > 6 ? articles.slice(-3) : articles.slice(3))];
    box.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">لقيت ${articles.length} مادة</div>
      ${severe.length ? `<div class="warn" style="border-color:var(--c-danger-bd);background:var(--c-danger-bg);color:var(--c-danger)">⛔ ${severe.map(esc).join('<br>⛔ ')}</div>` : ''}
      ${warnings.length ? `<div class="warn">⚠️ ${warnings.slice(0, 6).map(esc).join('<br>⚠️ ')}</div>` : ''}
      <details style="margin:8px 0"><summary style="cursor:pointer;font-size:13px">عرض عينة (أول 3 وآخر 3 مواد)</summary>
        ${sample.map(a => `<div style="border-bottom:1px dashed var(--border-soft);padding:6px 0"><b>${esc(a.article_number)}</b><div style="font-size:13px;white-space:pre-wrap">${esc(a.article_text.slice(0, 600))}${a.article_text.length > 600 ? '…' : ''}</div></div>`).join('')}
      </details>
      <details style="margin:8px 0"><summary style="cursor:pointer;font-size:13px">قايمة كل أرقام المواد</summary>
        <div style="font-size:12px;line-height:1.9">${articles.map(a => esc(a.article_number.replace('المادة ', ''))).join(' · ')}</div></details>
      ${severe.length ? `<label style="display:flex;gap:6px;align-items:center;font-size:13px;margin:6px 0"><input type="checkbox" id="law-force" style="width:auto"> متأكد إن النص ده رسمي وكامل رغم التحذيرات</label>` : ''}
      <button class="primary" id="law-import">➕ أضف ${articles.length} مادة للقاعدة</button>
      <div id="law-import-status" style="font-size:12.5px;margin-top:8px"></div>`;
    $('#law-import').addEventListener('click', doImport);
  }

  async function doImport() {
    const name = $('#law-name').value.trim();
    if (!name) return toast('اكتب اسم القانون', 'bad');
    if (parsed.severe.length && !$('#law-force')?.checked) return toast('النص عليه تحذيرات خطيرة — أكّد إنه رسمي وكامل الأول', 'bad');
    const replaces = $('#law-replaces').value;
    if (!confirm(`هتتضاف ${parsed.articles.length} مادة باسم «${name}»${replaces ? ` وهيتعلّم «${replaces}» ملغى` : ''}. تكمّل؟`)) return;
    const btn = $('#law-import'); btn.disabled = true;
    const st = $('#law-import-status');
    const meta = {
      law_name: name, law_number: $('#law-number').value.trim(), country: $('#law-country').value,
      official_source: $('#law-official').value.trim(), source_url: $('#law-url').value.trim(),
      replaces: replaces ? [replaces] : [],
    };
    let firstId = null, lastId = null, done = 0;
    try {
      for (let i = 0; i < parsed.articles.length; i += CHUNK) {
        const chunk = parsed.articles.slice(i, i + CHUNK);
        st.textContent = `⏳ إضافة المواد… ${done} من ${parsed.articles.length}`;
        const r = await saApiJson('/api/superadmin/laws/import', { method: 'POST', body: JSON.stringify({
          ...meta, articles: chunk, first: i === 0, last: i + CHUNK >= parsed.articles.length,
        }) });
        if (firstId === null) firstId = r.first_id;
        lastId = r.last_id;
        done += r.inserted;
      }
    } catch (e) { st.innerHTML = `<span style="color:var(--danger)">⚠️ ${esc(e.message)} — اتضاف ${done} مادة قبل الخطأ.</span>`; btn.disabled = false; return; }
    st.textContent = `✅ اتضاف ${done} مادة. ⏳ الفهرسة الذكية…`;
    await reindex(firstId - 1, lastId, meta.country, st);
    toast('✅ القانون اتضاف', 'ok');
  }

  // فهرسة المواد الجديدة بس (بالـ id) — ولو الحصة خلصت بنحفظ مكان التوقف ونكمل بعدين
  async function reindex(afterId, lastId, country, st) {
    let after = afterId, count = 0;
    try {
      for (;;) {
        const d = await saApiJson('/api/superadmin/ai/reindex-laws', { method: 'POST', body: JSON.stringify({ after_id: after, limit: REINDEX_BATCH, country }) });
        after = d.last_id; count += d.indexed || 0;
        st.textContent = `⏳ الفهرسة الذكية… ${count} مادة`;
        if (d.done || after >= lastId) break;
      }
      try { localStorage.removeItem(RESUME_KEY); } catch {}
      st.textContent = `✅ اتضاف واتفهرس — المساعد هيلاقي المواد الجديدة في البحث.`;
    } catch (e) {
      try { localStorage.setItem(RESUME_KEY, JSON.stringify({ after, lastId, country })); } catch {}
      st.innerHTML = `⚠️ المواد اتضافت وبتتلاقي بالبحث النصي، بس الفهرسة الذكية وقفت (${esc(e.message)}). كمّلها من زرار «كمّل الفهرسة» فوق (غالباً بكرة لو الحصة خلصت).`;
      showResume();
    }
  }

  function showResume() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); } catch {}
    const box = $('#laws-resume');
    if (!saved) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="warn" style="margin-bottom:10px">⏸️ فيه فهرسة متوقفة من بعد المادة رقم ${esc(String(saved.after))}. <button class="ghost" id="laws-resume-btn" style="padding:2px 10px">كمّل الفهرسة</button></div>`;
    box.querySelector('#laws-resume-btn').addEventListener('click', e => {
      e.target.disabled = true;
      reindex(saved.after, saved.lastId, saved.country, box.querySelector('.warn'));
    });
  }
  showResume();

  // ---------- القوانين الموجودة + الحالة ----------
  $('#laws-load').addEventListener('click', async e => {
    e.target.disabled = true;
    try { await loadLaws($('#laws-country').value); renderLaws(); }
    catch (err) { toast(err.message, 'bad'); } finally { e.target.disabled = false; }
  });

  function renderLaws() {
    const box = $('#laws-list');
    if (!laws?.length) { box.innerHTML = '<div class="empty">مفيش قوانين</div>'; return; }
    box.innerHTML = `
      <div style="font-size:12.5px;color:var(--text-soft);margin-bottom:6px">${laws.length} قانون — ${laws.reduce((s, l) => s + l.articles, 0).toLocaleString('en-US')} مادة</div>
      ${laws.map((l, i) => `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--border-soft)">
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700">${STATUS[l.status]?.[0] || ''} ${esc(l.law_name)} ${l.law_number ? `<span style="font-weight:400;color:var(--text-soft)">(${esc(l.law_number)})</span>` : ''}</div>
            <div style="font-size:12px;color:var(--text-soft)">${l.articles} مادة · ${esc(STATUS[l.status]?.[1] || l.status)}${l.note ? ' · ' + esc(l.note) : ''}${l.official_source ? ' · المصدر: ' + esc(l.official_source) : ''}</div>
          </div>
          ${['active', 'review', 'mixed'].includes(l.status) && l.min_id ? `<button class="ghost" data-law-index="${i}" title="فهرسة مواد القانون ده في البحث الذكي (لو اتضاف من برة الأداة أو الفهرسة وقفت)" style="padding:4px 10px;font-size:12px">🔍 فهرسة</button>` : ''}
          <select data-law-status="${i}" style="width:auto">
            <option value="">تغيير الحالة…</option>
            ${Object.entries(STATUS).filter(([k]) => k !== 'mixed').map(([k, [ic, lb]]) => `<option value="${k}">${ic} ${lb}</option>`).join('')}
          </select>
        </div>`).join('')}`;
    // فهرسة قانون واحد (من أول مادة ليه لآخر مادة) — بالـ id، من غير ما نلمس باقي القاعدة
    box.querySelectorAll('[data-law-index]').forEach(btn => btn.addEventListener('click', async () => {
      const l = laws[Number(btn.dataset.lawIndex)];
      if (!confirm(`فهرسة ${l.articles} مادة من «${l.law_name}» في البحث الذكي؟`)) return;
      btn.disabled = true;
      const st = document.createElement('div');
      st.style.cssText = 'width:100%;font-size:12px';
      btn.closest('div').appendChild(st);
      await reindex(l.min_id - 1, l.max_id, $('#laws-country').value, st);
      btn.disabled = false;
    }));
    box.querySelectorAll('[data-law-status]').forEach(sel => sel.addEventListener('change', async () => {
      const l = laws[Number(sel.dataset.lawStatus)];
      const st = sel.value;
      if (!st) return;
      const note = st === 'active' ? '' : prompt(`سبب «${STATUS[st][1]}» (بيظهر للمحامي جنب الاستشهاد):`, st === 'repealed' ? 'ملغى — حل محله …' : st === 'review' ? 'يُراجع: …' : '');
      if (note === null) { sel.value = ''; return; }
      try {
        const r = await saApiJson('/api/superadmin/laws/status', { method: 'PATCH', body: JSON.stringify({ country: $('#laws-country').value, law_name: l.law_name, status: st, note }) });
        l.status = st; l.note = note;
        toast(`✅ اتحدث ${r.updated} مادة`, 'ok');
        renderLaws();
      } catch (e) { toast(e.message, 'bad'); sel.value = ''; }
    }));
  }
}

// اسم القانون من أول النص (أول سطر فيه «قانون»)
function guessName(text) {
  const line = String(text).split('\n').map(s => s.trim()).find(s => /^(قانون|القانون|نظام)/.test(s) && s.length < 120);
  return line ? line.replace(/\s+/g, ' ') : '';
}
