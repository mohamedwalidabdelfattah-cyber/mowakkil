// scripts/sa-laws/build-sa-laws.mjs
// يحوّل صفحات الأنظمة السعودية من جريدة أم القرى (الجريدة الرسمية) لمواد في law_articles (country = 'SA')
// فحص صارم: أرقام المواد لازم تكون متسلسلة من 1 لآخر مادة من غير نقص ولا تكرار، ومفيش حروف بايظة.
// الاستخدام: node build-sa-laws.mjs <فولدر صفحات HTML> <ملف SQL الناتج>
import fs from 'node:fs';
import path from 'node:path';

const [srcDir = 'laws-sa', outSql = 'laws-sa/sa-laws.sql'] = process.argv.slice(2);

// الأنظمة (ومصدرها في الجريدة الرسمية)
const LAWS = [
  { p: 18818, name: 'نظام الإثبات', number: 'م/43 بتاريخ 26/5/1443هـ', expected: 129 },
  { p: 23125, name: 'نظام المعاملات المدنية', number: 'م/191 بتاريخ 29/11/1444هـ', expected: 721 },
  { p: 19139, name: 'نظام الأحوال الشخصية', number: 'م/73 بتاريخ 6/8/1443هـ', expected: 252 },
  { p: 19697, name: 'نظام الشركات', number: 'م/132 بتاريخ 1/12/1443هـ', expected: 281 },
  { p: 20767, name: 'الأدلة الإجرائية لنظام الإثبات', number: 'نُشرت بتاريخ 3/4/1444هـ', expected: 135 },
  { p: 27013, name: 'لائحة نظام الأحوال الشخصية', number: 'نُشرت بتاريخ 22/8/1446هـ', expected: 41 },
];

import { ordinalToNumber } from '../../worker/lib/ordinal.js';

// ============ صفحة → نص ============
function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
}
function pageText(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  t = decode(t).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n');
  const start = t.indexOf('المادة الأولى');
  const end = t.indexOf('{{', start);
  return start < 0 ? '' : t.slice(start, end > 0 ? end : undefined).trim();
}

// ============ نص → مواد (بالتسلسل) ============
function splitArticles(text) {
  // في بعض الصفحات المواد ورا بعض في نفس السطر — فالعنوان ممكن ييجي في أي مكان،
  // والتسلسل (لازم المادة اللي بعدها بالظبط) + فحص العدد بيمنعوا الخلط بالإشارات جوه النص
  const heads = [...text.matchAll(/(^|\n|\s)المادة\s+([^\n:()]{3,50}?)\s*:/g)];
  const out = [];
  let expected = 1;
  for (let i = 0; i < heads.length; i++) {
    const n = ordinalToNumber(heads[i][2]);
    if (n !== expected) continue; // عنوان مكرر أو إشارة لمادة جوه نص مادة تانية → جزء من المادة اللي قبله
    const startText = heads[i].index + heads[i][0].length;
    // نهاية المادة = عنوان المادة اللي بعدها بالترتيب
    let endIdx = text.length;
    for (let j = i + 1; j < heads.length; j++) if (ordinalToNumber(heads[j][2]) === expected + 1) { endIdx = heads[j].index; break; }
    let body = text.slice(startText, endIdx).trim();
    // عناوين الأبواب والفصول اللي في آخر المادة بتاعة الباب اللي بعدها مش جزء منها
    // (عنوان قصير من غير نقط في آخر المادة = عنوان الباب/الفصل اللي بعدها)
    body = body.replace(/\s*\((?:الباب|الفصل|الفرع|القسم|الكتاب)\s[^)]{2,40}\)[^.؛:]{0,250}$/u, '').trim();
    body = body.replace(/\s*(?:الباب|الفصل|الفرع|القسم|الكتاب)\s+(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر)[^.؛:]{0,200}$/u, '').trim();
    // "الفرع الأول: …" / "الفصل الأول: …" في آخر المادة = عنوان القسم اللي بعدها
    const ORD = '(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر|السادس عشر|السابع عشر|الثامن عشر|التاسع عشر|العشرون)';
    for (let k = 0; k < 4; k++) {
      const before = body;
      body = body.replace(new RegExp(`\\s(?:الباب|الفصل|الفرع|القسم|الكتاب)\\s+${ORD}\\s*:[^.؛]*$`, 'u'), '').trim();
      // عنوان بين قوسين بعد آخر نقطة في المادة: "... معتمد. (الإقرار)"
      body = body.replace(/([.؛:])\s*\([^()\n]{2,45}\)\s*$/u, '$1').trim();
      if (body === before) break;
    }
    body = body.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/ {2,}/g, ' ');
    out.push({ n, text: body });
    expected++;
  }
  return out;
}

// ============ فحص الجودة ============
function check(law, arts) {
  const problems = [];
  if (arts.length !== law.expected) problems.push(`عدد المواد ${arts.length} والمتوقع ${law.expected}`);
  arts.forEach((a, i) => {
    if (a.n !== i + 1) problems.push(`تسلسل مكسور عند ${a.n}`);
    if (!a.text || a.text.length < 8) problems.push(`المادة ${a.n} فاضية/قصيرة`);
    if (/[�]|\{\{|<\/?[a-z]/i.test(a.text)) problems.push(`المادة ${a.n} فيها حروف أو أكواد غريبة`);
    if (/المادة\s+[^\n:]{3,50}:\s*$/.test(a.text)) problems.push(`المادة ${a.n} بتنتهي بعنوان مادة`);
  });
  return problems;
}

const esc = (s) => String(s).replace(/'/g, "''");
const sql = [];
let total = 0, ok = true;
for (const law of LAWS) {
  const file = path.join(srcDir, `uqn-${law.p}.html`);
  const html = fs.readFileSync(file, 'utf8');
  const arts = splitArticles(pageText(html));
  const problems = check(law, arts);
  const url = `https://www.uqn.gov.sa/details?p=${law.p}`;
  console.log(`${problems.length ? '❌' : '✅'} ${law.name}: ${arts.length} مادة` + (problems.length ? ' — ' + problems.slice(0, 5).join(' | ') : ''));
  if (problems.length) { ok = false; continue; }
  total += arts.length;
  for (const a of arts) {
    sql.push(`INSERT INTO law_articles (law_name, law_number, article_number, article_text, source_url, country) VALUES ('${esc(law.name)}', '${esc(law.number)}', 'المادة ${a.n}', '${esc(a.text)}', '${url}', 'SA');`);
  }
  fs.writeFileSync(path.join(srcDir, `sample-${law.p}.txt`), arts.slice(0, 3).concat(arts.slice(-2)).map(a => `[المادة ${a.n}]\n${a.text}`).join('\n\n'));
}
if (!ok) { console.error('في أنظمة فيها مشاكل — مفيش ملف SQL'); process.exit(1); }
fs.writeFileSync(outSql, sql.join('\n') + '\n');
console.log(`المجموع: ${total} مادة → ${outSql}`);
