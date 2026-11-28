// web/js/law-splitter.js
// تقسيم نص قانون لمواد: «مادة 1» / «المادة (1)» / «مادة 12 مكرر (أ)» / «(مادة 5)» / «المادة الأولى» (مواد الإصدار).
// العنوان لازم يبقى في أول السطر، وبنقبله لو: السطر قصير، أو بعده فاصل (: - –)، أو رقمه المتوقع (اللي بعد السابق)
// — عشان «مادة 5 من هذا القانون» في نص سطر ملفوف متتحسبش مادة جديدة.

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatin = s => String(s).replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
const normalize = t => String(t || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\[\s*(?:عدل|تعديل|edit)\s*\]/gi, '')          // روابط التعديل في ويكي مصدر
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

  const push = () => { if (cur) { cur.article_text = cur.lines.join('\n').trim(); delete cur.lines; if (cur.article_text) out.push(cur); } };

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
