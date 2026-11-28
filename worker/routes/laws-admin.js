// worker/routes/laws-admin.js
// إدارة قاعدة المواد القانونية من لوحة السوبر أدمن:
//   - قايمة القوانين بعدد موادها وحالتها (عند الطلب بس — بتقرا مواد الدولة كلها مرة)
//   - إضافة قانون (مواد متقسّمة من الواجهة) على دفعات صغيرة، ومعاه «يلغي قانون كذا» لو بيحل محله
//   - تغيير حالة قانون كامل (ساري / يُراجع / ملغى / غير رسمي)
// ⚠️ حصص D1 المجانية: 5 مليون قراءة و100 ألف كتابة في اليوم — مفيش هنا أي COUNT(*) على الجدول في كل دفعة،
//    والإضافة بحد أقصى 150 مادة في الطلب، والفهرسة بعدها للمواد الجديدة بس (reindex-laws بـ after_id).
import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { safeJson } from '../lib/validation.js';
import { resetCitationIndex } from '../lib/citations.js';

export const routes = [
  { method: 'GET',   path: '/api/superadmin/laws',        handler: listLaws },
  { method: 'POST',  path: '/api/superadmin/laws/import', handler: importLaw },
  { method: 'PATCH', path: '/api/superadmin/laws/status', handler: setLawStatus },
  { method: 'POST',  path: '/api/superadmin/laws/ocr',    handler: ocrPage },
];

// ============================================================
// قراءة صفحة قانون متصوّرة بـ Gemini (أدق بكتير من Tesseract في العربي)
// نصوص قوانين عامة — مفيش بيانات موكلين. صفحة واحدة في الطلب، والواجهة بتمشي بالراحة عشان الحصة المجانية.
// ============================================================
const OCR_PROMPT = `هذه صورة صفحة من نص قانوني رسمي (الجريدة الرسمية أو ما يماثلها).
انسخ النص العربي الموجود في الصفحة حرفياً كما هو تماماً، سطراً بسطر وبنفس الترتيب.
- لا تلخّص ولا تصحّح ولا تعيد الصياغة ولا تضف أي كلمة من عندك.
- احتفظ بعناوين المواد كما هي (مثل: مادة (١) أو المادة الأولى) وبالأرقام كما هي.
- تجاهل العلامة المائية والشعارات والأختام وأرقام الصفحات وترويسة الجريدة (اسم الجريدة والعدد والتاريخ أعلى الصفحة).
- لو الصفحة فاضية أو غلاف بلا نص قانوني اكتب: [صفحة بدون نص]
اكتب النص فقط بدون أي مقدمة أو تعليق.`;

async function ocrPage({ request, env }) {
  const key = String(env.GEMINI_API_KEY || '').trim();
  if (key.length < 20) return fail(env, 'مفتاح Gemini مش متظبط', 503);
  const b = await safeJson(request);
  const image = String(b?.image || '');
  const mime = /^image\/(jpeg|png|webp)$/.test(b?.mime) ? b.mime : 'image/jpeg';
  if (image.length < 1000) return fail(env, 'مفيش صورة', 400);
  if (image.length > 6_000_000) return fail(env, 'الصورة كبيرة — قلل الدقة', 400);

  // Flash-Lite الأول (حصته المجانية أكبر)، وبعدين Flash
  const models = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
  let lastErr = '';
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mime, data: image } }, { text: OCR_PROMPT }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429 || res.status === 503) {
        lastErr = res.status === 429 ? 'quota' : 'busy';
        continue; // نجرب النموذج التاني
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { lastErr = `${res.status}: ${JSON.stringify(data).slice(0, 160)}`; continue; }
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (!text) { lastErr = 'رد فاضي'; continue; }
      return ok(env, { text, model });
    } catch (e) { lastErr = e.message; }
  }
  if (lastErr === 'quota') return fail(env, 'حصة Gemini المجانية خلصت مؤقتاً — كمّل بعد شوية (التقدم محفوظ)', 429);
  if (lastErr === 'busy') return fail(env, 'Gemini عليه ضغط دلوقتي — كمّل بعد دقيقة (التقدم محفوظ)', 503);
  return fail(env, 'مقدرتش أقرا الصفحة: ' + lastErr, 502);
}

const STATUSES = ['active', 'review', 'repealed', 'unofficial'];
const MAX_PER_REQUEST = 150;
const clean = (v, max) => String(v ?? '').replace(/ـ/g, '').trim().slice(0, max);
const countryOf = c => (c === 'SA' ? 'SA' : 'EG');

async function listLaws({ env, url }) {
  const country = countryOf(url.searchParams.get('country'));
  const { results } = await env.DB.prepare(
    `SELECT law_name, MAX(law_number) AS law_number, COUNT(*) AS articles,
            MIN(COALESCE(status, 'active')) AS min_status, MAX(COALESCE(status, 'active')) AS max_status,
            MAX(status_note) AS note, MAX(official_source) AS official_source, MAX(verified_at) AS verified_at,
            MAX(source_url) AS source_url, MIN(id) AS min_id, MAX(id) AS max_id
     FROM law_articles WHERE country = ? GROUP BY law_name ORDER BY COUNT(*) DESC`
  ).bind(country).all();
  return ok(env, (results || []).map(r => ({
    ...r,
    // لو كل مواد القانون نفس الحالة بنرجّعها، غير كده «mixed»
    status: r.min_status === r.max_status ? r.min_status : 'mixed',
  })));
}

async function importLaw({ request, env, superAdmin }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const lawName = clean(b.law_name, 200);
  if (!lawName) return fail(env, 'اكتب اسم القانون', 400);
  const country = countryOf(b.country);
  const articles = Array.isArray(b.articles) ? b.articles : [];
  if (!articles.length) return fail(env, 'مفيش مواد', 400);
  if (articles.length > MAX_PER_REQUEST) return fail(env, `أقصى ${MAX_PER_REQUEST} مادة في الطلب الواحد`, 400);

  const rows = articles.map(a => ({ n: clean(a.article_number, 80), t: clean(a.article_text, 20000) }))
    .filter(a => a.n && a.t.length >= 3);
  if (!rows.length) return fail(env, 'المواد فاضية', 400);

  const lawNumber = clean(b.law_number, 80) || null;
  const sourceUrl = clean(b.source_url, 500) || null;
  const official = clean(b.official_source, 300) || null;
  const note = clean(b.note, 300) || null;

  // أول دفعة بس: القوانين اللي القانون ده بيحل محلها تتعلّم «ملغى»
  let repealed = 0;
  if (b.first && Array.isArray(b.replaces) && b.replaces.length) {
    for (const old of b.replaces.slice(0, 5).map(x => clean(x, 200)).filter(Boolean)) {
      if (old === lawName) continue;
      const r = await env.DB.prepare(
        `UPDATE law_articles SET status = 'repealed', status_note = ? WHERE country = ? AND law_name = ? AND COALESCE(status, 'active') != 'repealed'`
      ).bind(`ملغى — حل محله ${lawName}${lawNumber ? ' رقم ' + lawNumber : ''}`, country, old).run();
      repealed += r.meta?.changes || 0;
    }
  }

  const stmt = env.DB.prepare(
    `INSERT INTO law_articles (law_name, law_number, article_number, article_text, source_url, country, status, status_note, verified_at, official_source)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), ?)`
  );
  const res = await env.DB.batch(rows.map(a => stmt.bind(lawName, lawNumber, a.n, a.t, sourceUrl, country, note, official)));
  const ids = res.map(r => r.meta?.last_row_id).filter(Boolean);

  if (b.last || repealed) await resetCitationIndex(env);
  if (b.first) {
    await audit(env, { action: 'law_import', entity: 'law', request, metadata: { by: superAdmin?.admin_id, law: lawName, country, repealed } });
  }
  return ok(env, { inserted: ids.length, first_id: ids.length ? Math.min(...ids) : null, last_id: ids.length ? Math.max(...ids) : null, repealed });
}

async function setLawStatus({ request, env, superAdmin }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const lawName = clean(b.law_name, 200);
  const status = String(b.status || '');
  if (!lawName || !STATUSES.includes(status)) return fail(env, 'بيانات غلط', 400);
  const country = countryOf(b.country);
  const note = clean(b.note, 300) || null;
  const r = await env.DB.prepare(
    `UPDATE law_articles SET status = ?, status_note = ?, verified_at = CASE WHEN ? = 'active' THEN datetime('now') ELSE verified_at END
     WHERE country = ? AND law_name = ?`
  ).bind(status, note, status, country, lawName).run();
  await resetCitationIndex(env);
  await audit(env, { action: 'law_status', entity: 'law', request, metadata: { by: superAdmin?.admin_id, law: lawName, country, status } });
  return ok(env, { updated: r.meta?.changes || 0 });
}
