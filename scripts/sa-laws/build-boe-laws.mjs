// scripts/sa-laws/build-boe-laws.mjs
// يحوّل صفحات هيئة الخبراء (المحفوظة من أرشيف الإنترنت — fetch-boe-wayback.mjs) لمواد في law_articles (country = 'SA')
// بياخد النص الساري لكل مادة بس (التعديلات القديمة اللي في نافذة "تعديلات المادة" بتتشال).
// الاستخدام: node build-boe-laws.mjs <فولدر الصفحات> <ملف SQL الناتج> [أسماء أنظمة موجودة قبل كده، مفصولة بـ |]
import fs from 'node:fs';
import path from 'node:path';
import { articleNumber } from '../../worker/lib/ordinal.js';

const [srcDir, outSql, skipNames = ''] = process.argv.slice(2);
if (!srcDir || !outSql) { console.error('usage: node build-boe-laws.mjs pagesDir out.sql [skip|names]'); process.exit(1); }
const norm = s => String(s).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const SKIP = new Set(skipNames.split('|').filter(Boolean).map(norm));

function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
}
function toText(html) {
  let t = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return decode(t).replace(/\r/g, '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}
// يشيل كل <div ...> يطابق الشرط مع كل اللي جوّاه (موازنة الـ div)
function removeDivs(html, test) {
  let out = '', i = 0;
  const re = /<div\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!test(m[0])) continue;
    out += html.slice(i, m.index);
    let depth = 1, j = re.lastIndex;
    const tag = /<\/?div\b[^>]*>/gi; tag.lastIndex = j;
    let t;
    while (depth && (t = tag.exec(html))) depth += t[0][1] === '/' ? -1 : 1;
    i = t ? tag.lastIndex : html.length;
    re.lastIndex = i;
  }
  return out + html.slice(i);
}
function meta(html) {
  const text = toText(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')).replace(/\s+/g, ' ');
  const name = (html.match(/<h1 class="system_title">([\s\S]*?)<\/h1>/) || [])[1];
  const decree = text.match(/مرسوم ملكي رقم\s*([^\s]+)\s*بتاريخ\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  const cabinet = text.match(/قرار مجلس الوزراء رقم\s*(\d+)\s*بتاريخ\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  const issued = text.match(/تاريخ الإصدار\s*(\d{4})\/(\d{2})\/(\d{2})/);
  let number = '';
  if (decree) number = `مرسوم ملكي ${decree[1]} بتاريخ ${+decree[2]}/${+decree[3]}/${decree[4]}هـ`;
  else if (cabinet) number = `قرار مجلس الوزراء ${cabinet[1]} بتاريخ ${+cabinet[2]}/${+cabinet[3]}/${cabinet[4]}هـ`;
  else if (issued) number = `صدر بتاريخ ${+issued[3]}/${+issued[2]}/${issued[1]}هـ`;
  return { name: name ? toText(name) : '', number };
}
function articles(html) {
  const parts = html.split(/<div class="article_item\b[^"]*"\s*>/).slice(1);
  const res = [];
  for (let raw of parts) {
    // آخر مادة: نقطع عند نهاية المحتوى
    raw = raw.split(/<footer|<div class="system_footer|id="lawAttachments"/)[0];
    raw = removeDivs(raw, tag => /popup-list|article_btns|article_item_popup|hidden-print/.test(tag));
    raw = raw.replace(/<a\b[\s\S]*?<\/a>/gi, '');
    const heads = [...raw.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m => toText(m[1]));
    const head = heads.find(h => /^المادة/.test(h));
    if (!head) continue;
    const body = raw.slice(raw.indexOf(head.slice(0, 6)) >= 0 ? 0 : 0).replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, '');
    const text = toText(body);
    if (!text) continue;
    const label = head.replace(/[:：]\s*$/, '').replace(/\s+/g, ' ').trim();
    const n = articleNumber(label);
    res.push({ n, label, text });
  }
  return res;
}

const esc = s => String(s).replace(/'/g, "''");
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));
const sql = [];
const summary = [];
let total = 0;
for (const f of files) {
  const id = f.replace(/\.html$/, '');
  const html = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const { name, number } = meta(html);
  if (!name) { summary.push({ id, why: 'no title' }); continue; }
  if (SKIP.has(norm(name))) { summary.push({ name, why: 'already in DB' }); continue; }
  const arts = articles(html);
  if (!arts.length) { summary.push({ name, why: 'no articles' }); continue; }
  // فحص: الأرقام متسلسلة؟ (لو لأ بنسجّلها بس — بعض الأنظمة فيها مواد مكررة "مكرر")
  const nums = arts.map(a => a.n).filter(n => n != null);
  const gaps = nums.length === arts.length && nums.every((n, i) => n === i + 1) ? 0 : 1;
  const url = `https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/${id}/1`;
  const seen = new Set();
  for (const a of arts) {
    let label = a.n != null ? `المادة ${a.n}` : a.label;
    while (seen.has(label)) label += ' مكرر';
    seen.add(label);
    sql.push(`INSERT INTO law_articles (law_name, law_number, article_number, article_text, source_url, country) VALUES ('${esc(name)}', '${esc(number)}', '${esc(label)}', '${esc(a.text)}', '${url}', 'SA');`);
  }
  total += arts.length;
  summary.push({ name, articles: arts.length, sequential: !gaps });
}
fs.writeFileSync(outSql, sql.join('\n') + '\n');
fs.writeFileSync(outSql.replace(/\.sql$/, '') + '-summary.json', JSON.stringify(summary, null, 1));
const laws = summary.filter(s => s.articles);
console.log(`laws: ${laws.length}, articles: ${total}, non-sequential: ${laws.filter(s => !s.sequential).length}, skipped: ${summary.length - laws.length}`);
