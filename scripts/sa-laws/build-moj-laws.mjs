// scripts/sa-laws/build-moj-laws.mjs
// بيجيب الأنظمة واللوائح العدلية من البوابة القانونية لوزارة العدل (laws.moj.gov.sa) — نفس الـ API اللي الموقع نفسه بيستخدمه —
// ويحوّلها لمواد في law_articles (country = 'SA'). بياخد النص الساري بس (المواد الملغاة بتتشال).
// الاستخدام: node build-moj-laws.mjs <ملف قائمة: serial,title في كل سطر> <ملف SQL الناتج> <ملف أسماء موجودة قبل كده (سطر لكل اسم)>
import fs from 'node:fs';
import { articleNumber } from './ordinal.mjs';

const [listFile, outSql, skipFile] = process.argv.slice(2);
if (!listFile || !outSql) { console.error('usage: node build-moj-laws.mjs list.csv out.sql [skip.txt]'); process.exit(1); }
const API = 'https://laws-gateway.moj.gov.sa/apis/legislations/v1/statute/get-Statute-gateway-Detail?identityNumber=&Serial=';
const norm = s => String(s).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim();
const SKIP = new Set((skipFile && fs.existsSync(skipFile) ? fs.readFileSync(skipFile, 'utf8').split(/\r?\n/) : []).filter(Boolean).map(norm));

const items = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).filter(Boolean).map(l => {
  const i = l.indexOf(','); return { serial: l.slice(0, i).trim(), title: l.slice(i + 1).trim() };
}).filter(x => /^[A-Za-z0-9_-]{10,}$/.test(x.serial));

function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
}
function toText(html) {
  const t = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return decode(t).replace(/\r/g, '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url, tries = 3) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (t >= tries) throw e; await sleep(2000 * t); }
  }
}
// الهيكل متداخل (أبواب ← فصول ← مواد) — بنفرده
function flatten(list, out = []) {
  for (const x of list || []) {
    // type 1 = مادة/قاعدة/بند لائحة (زي ١/٣)، و 3 = باب/فصل
    if (String(x.type) === '1' && String(x.sequence || '').trim() && toText(x.text) && !x.isCancelled) out.push(x);
    if (Array.isArray(x.items) && x.items.length) flatten(x.items, out);
  }
  return out;
}
const hijri = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}/${+m[2]}/${m[1]}هـ` : ''; };
const esc = s => String(s).replace(/'/g, "''");

const sql = [], summary = [];
const seenNames = new Set();
let total = 0;
for (const it of items) {
  try {
    const j = await getJson(API + encodeURIComponent(it.serial));
    const m = j?.model;
    if (!m?.name) { summary.push({ ...it, why: 'empty' }); continue; }
    const name = m.name.replace(/[.\s]+$/, '').trim();
    if (m.legalStatus && m.legalStatus !== 'Active') { summary.push({ name, why: 'not active: ' + m.legalStatueName }); continue; }
    if (SKIP.has(norm(name)) || seenNames.has(norm(name))) { summary.push({ name, why: 'already have it' }); continue; }
    const arts = flatten(m.statuteStructure);
    if (!arts.length) { summary.push({ name, why: 'no articles' }); continue; }
    seenNames.add(norm(name));
    const number = m.issuanceDate ? `صدر بتاريخ ${hijri(m.issuanceDate)}` : '';
    const url = `https://laws.moj.gov.sa/ar/legislation/${it.serial}`;
    const labels = new Set();
    let seq = true;
    arts.forEach((a, i) => {
      const head = String(a.sequence).replace(/[:：]\s*$/, '').replace(/\s+/g, ' ').trim();
      // بنود اللوائح (١/٣) بتفضل زي ما هي
      const n = /\//.test(head) ? null : articleNumber(head);
      if (n !== i + 1) seq = false;
      let label = n != null ? `المادة ${n}` : (/^(المادة|القاعدة|البند)/.test(head) ? head : `المادة ${head}`);
      while (labels.has(label)) label += ' مكرر';
      labels.add(label);
      sql.push(`INSERT INTO law_articles (law_name, law_number, article_number, article_text, source_url, country) VALUES ('${esc(name)}', '${esc(number)}', '${esc(label)}', '${esc(toText(a.text))}', '${url}', 'SA');`);
    });
    total += arts.length;
    summary.push({ name, articles: arts.length, sequential: seq });
  } catch (e) {
    summary.push({ ...it, why: String(e.message || e) });
  }
  await sleep(500);
}
fs.writeFileSync(outSql, sql.join('\n') + '\n');
fs.writeFileSync(outSql.replace(/\.sql$/, '') + '-summary.json', JSON.stringify(summary, null, 1));
const laws = summary.filter(s => s.articles);
console.log(`laws: ${laws.length}, articles: ${total}, non-sequential: ${laws.filter(s => !s.sequential).length}, skipped: ${summary.length - laws.length}`);
