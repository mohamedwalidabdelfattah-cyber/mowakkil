// web/js/law-splitter.js
// تقسيم نص قانون لمواد: «مادة 1» / «المادة (1)» / «مادة 12 مكرر (أ)» / «(مادة 5)» / «المادة الأولى» (مواد الإصدار).
// العنوان لازم يبقى في أول السطر، وبنقبله لو: السطر قصير، أو بعده فاصل (: - –)، أو رقمه المتوقع (اللي بعد السابق)
// — عشان «مادة 5 من هذا القانون» في نص سطر ملفوف متتحسبش مادة جديدة.

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatin = s => String(s).replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
const normalize = t => String(t || '')
  // ملفات PDF كتير بتطلّع «أشكال العرض» (ﻗﺎﻧﻮن) بدل الحروف العادية (قانون) — NFKC بيرجّعها
  .normalize('NFKC')
  .replace(/[ھہ]/g, 'ه')                         // ھ / ہ (هاء فارسية/أردية) ← ه
  .replace(/[یے]/g, 'ي')                         // ی / ے ← ي
  .replace(/ک/g, 'ك')                                 // ک ← ك
  .replace(/\r\n?/g, '\n')
  .replace(/\[\s*(?:عدل|تعديل|edit)\s*\]/gi, '')          // روابط التعديل في ويكي مصدر
  .replace(/^\s*[-_ـ=]{5,}\s*$/gm, '')                    // خطوط فاصلة بين المواد
  .replace(/^\s*(?:الجريدة الرسمية|الوقائع المصرية)\s*[-–—]?\s*(?:ال)?عدد.*$/gm, '') // ترويسة كل صفحة في الجريدة
  .replace(/\*\*|__|^#+\s*/gm, '')                         // تنسيق markdown لو القراءة بالذكاء الاصطناعي حطته
  .replace(/^\s*\d+(?:\.\d+)+\s+.*$/gm, '')                  // سطور الفهرس (4.3.3 المادة ٧١)
  .replace(/ـ/g, '')                    // تطويل
  .replace(/[ً-ْ]/g, '')           // تشكيل
  .replace(/[ \t ]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n');

// مادة + رقم (+ مكرر + حرف اختياري)
const NUM_HEAD = /^\s*[(\[]?\s*(?:ال)?مادة\s*[(\[]?\s*([0-9٠-٩]+)\s*[)\]]?\s*((?:مكرر(?:اً|ا|ة)?)(?:\s*[(\[]?\s*[أ-ي]\s*[)\]]?)?)?\s*[)\]]?\s*([:\-–—.]?)\s*(.*)$/;
// مادة + ترتيب بالحروف (مواد الإصدار): المادة الأولى / الثانية عشرة / الخامسة بعد المائة
const WORD_HEAD = /^\s*[(\[]?\s*(?:ال)?مادة\s+(ال[أ-ي]+(?:\s+(?:و?ال[أ-ي]+|عشرة?|بعد\s+ال[أ-ي]+))*)\s*[)\]]?\s*([:\-–—.]?)\s*(.*)$/;

export function splitArticles(rawText) {
  const lines = normalize(rawText).split('\n');
  const out = [];
  const warnings = [];
  let cur = null;
  let lastNum = 0;
  let preamble = [];

  const push = () => {
    if (!cur) return;
    // النسخ المجمّعة (زي ملفات الهيئة العامة للرقابة المالية) بتحط بعد المادة المعدلة «نص المادة قبل التعديل: …»
    // — النص القديم ده لازم يتشال عشان المساعد ميعتبروش ساري. ملاحظة التعديل نفسها بتفضل.
    cur.article_text = cur.lines.join('\n').replace(/\s*[,،]?\s*نص (?:المادة|الفقرة|البند) قبل (?:التعديل|الإلغاء|الالغاء)\s*:[\s\S]*$/, '').trim();
    delete cur.lines;
    // «مكرر» اتقطع من العنوان وفضل منه «م» في أول النص
    if (/^م\s/.test(cur.article_text) && !/مكرر/.test(cur.article_number)) {
      cur.article_number += ' مكرر';
      cur.article_text = cur.article_text.replace(/^م\s+/, '');
    }
    // بعض الملفات بتكتب «إصدار» في أول نص مادة الإصدار
    if (/^إصدار\s/.test(cur.article_text)) {
      cur.article_text = cur.article_text.replace(/^إصدار\s+/, '');
      if (!cur.article_number.includes('مواد الإصدار')) cur.article_number += ' (مواد الإصدار)';
    }
    if (cur.article_text) out.push(cur);
  };

  for (const line of lines) {
    let m = line.match(NUM_HEAD);
    if (m) {
      const num = Number(toLatin(m[1]));
      const bis = m[2] ? ' ' + m[2].replace(/\s+/g, ' ').replace(/[\[\]]/g, '').trim() : '';
      const rest = m[4] || '';
      const sep = !!m[3];
      // «مادة 5 من القانون…» في أول سطر ملفوف = إشارة لمادة، مش عنوان
      const refLike = /^(من|في|بشأن|وفق|طبق|المشار|الواردة|السابق|اللاحق|المذكور|المنصوص|بعد|قبل|و\s|أو\s)/.test(rest);
      const sequential = num === lastNum + 1 || num === 1 || (bis && num === lastNum);
      // عنوان حقيقي: لوحده في السطر، أو بعده فاصل، أو الرقم المتوقع — بشرط ميكونش إشارة
      const isHead = rest.length < 3 || (!refLike && (sep || sequential));
      if (isHead) {
        push();
        if (num < lastNum && num !== 1 && !bis) warnings.push(`ترتيب غريب: المادة ${num} بعد ${lastNum}`);
        if (num > lastNum + 1 && !bis && lastNum) warnings.push(`فيه مواد ناقصة بين ${lastNum} و${num}`);
        cur = { article_number: `المادة ${num}${bis}`, lines: rest ? [rest] : [] };
        if (!bis) lastNum = num;
        continue;
      }
    }
    m = line.match(WORD_HEAD);
    if (m && (m[3] || '').length < 200) {
      push();
      cur = { article_number: `المادة ${m[1].trim()} (مواد الإصدار)`, lines: m[3] ? [m[3]] : [] };
      continue;
    }
    if (cur) cur.lines.push(line);
    else if (line.trim()) preamble.push(line.trim());
  }
  push();

  // الترقيم رجع لـ 1 مرة واحدة = اللي قبله «مواد الإصدار» (ملفات كتير بترقّمها 1، 2، 3 زي مواد القانون)
  const restarts = out.map((a, i) => (i > 0 && a.article_number === 'المادة 1' ? i : -1)).filter(i => i > 0);
  if (restarts.length === 1 && restarts[0] <= 40) {
    for (let i = 0; i < restarts[0]; i++) {
      if (!out[i].article_number.includes('مواد الإصدار')) out[i].article_number += ' (مواد الإصدار)';
    }
  }
  {
    // مواد الإصدار متداخلة مع مواد القانون بنفس الأرقام: مادة الإصدار هي اللي بتتكلم عن «القانون المرافق»
    const byNum = new Map();
    out.forEach((a, i) => { if (!byNum.has(a.article_number)) byNum.set(a.article_number, []); byNum.get(a.article_number).push(i); });
    for (const idxs of byNum.values()) {
      if (idxs.length !== 2) continue;
      const iss = idxs.filter(i => /القانون المرافق|المرافق لهذا القانون|ينشر هذا القانون في الجريدة الرسمية|يبصم هذا القانون/.test(out[i].article_text));
      if (iss.length === 1) out[iss[0]].article_number += ' (مواد الإصدار)';
    }
  }

  // نفس رقم المادة اتكرر (غالباً قانون إصدار + قانون أو نسختين متلزقين)
  const seen = new Map();
  for (const a of out) seen.set(a.article_number, (seen.get(a.article_number) || 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dups.length) warnings.push(`مواد متكررة: ${dups.slice(0, 5).join('، ')}${dups.length > 5 ? '…' : ''}`);
  const long = out.filter(a => a.article_text.length > 6000).length;
  if (long) warnings.push(`${long} مادة طويلة جداً — ممكن عناوين مواد بعدها مااتعرفتش`);

  // النص المختصر (…) مش النص الرسمي: نسخ كتير على النت ملخّصة ومتسابة فيها نقط
  const abridged = out.filter(a => /…|\.\.\.|\(\s*\.\s*\.\s*\.\s*\)/.test(a.article_text)).length;
  const severe = [];
  if (abridged && abridged / Math.max(1, out.length) >= 0.03) {
    severe.push(`النص فيه اختصارات (…) في ${abridged} مادة من ${out.length} — غالباً ده ملخص مش النص الرسمي الكامل`);
  }
  const gaps = warnings.filter(w => w.startsWith('فيه مواد ناقصة'));
  if (gaps.length >= 2) severe.push(`فيه ${gaps.length} فجوات في ترقيم المواد — النسخة ناقصة`);

  return { articles: out, warnings, severe, preamble: preamble.join('\n').slice(0, 1500) };
}
