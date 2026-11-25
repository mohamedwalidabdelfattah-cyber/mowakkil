// scripts/sa-laws/fetch-boe-wayback.mjs
// بينزّل صفحات الأنظمة الرسمية من هيئة الخبراء (laws.boe.gov.sa) من نسخة أرشيف الإنترنت (web.archive.org)
// لأن موقع الهيئة مقفول برا السعودية. الصفحة المحفوظة هي نفس الصفحة الرسمية بالظبط.
// الاستخدام: node fetch-boe-wayback.mjs <ملف قائمة: id,title في كل سطر> <فولدر الحفظ>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [listFile, outDir] = process.argv.slice(2);
if (!listFile || !outDir) { console.error('usage: node fetch-boe-wayback.mjs list.csv outDir'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const items = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).filter(Boolean).map(l => {
  const i = l.indexOf(',');
  return { id: l.slice(0, i).trim(), title: l.slice(i + 1).trim() };
}).filter(x => /^[0-9a-f-]{36}$/.test(x.id));

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'law-archive-reader/1.0' }, signal: AbortSignal.timeout(60000) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) {
      if (t === tries) throw e;
      await sleep(3000 * t);
    }
  }
}

const report = [];
let done = 0;
async function one(it) {
  const file = path.join(outDir, it.id + '.html');
  if (fs.existsSync(file) && fs.statSync(file).size > 20000) { report.push({ ...it, ok: true, cached: true }); return; }
  const target = `https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/${it.id}/1`;
  try {
    const av = await (await get(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}`)).json();
    const snap = av?.archived_snapshots?.closest;
    if (!snap?.available) { report.push({ ...it, ok: false, why: 'no snapshot' }); return; }
    const raw = snap.url.replace(/^http:/, 'https:').replace(/\/web\/(\d+)\//, '/web/$1id_/');
    const r = await get(raw);
    let buf = Buffer.from(await r.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf); // الأرشيف أحياناً بيرجّعها مضغوطة
    const html = buf.toString('utf8');
    if (!html.includes('article_item')) { report.push({ ...it, ok: false, why: 'no articles in snapshot', ts: snap.timestamp }); return; }
    fs.writeFileSync(file, html);
    report.push({ ...it, ok: true, ts: snap.timestamp });
  } catch (e) {
    report.push({ ...it, ok: false, why: String(e.message || e) });
  } finally {
    if (++done % 20 === 0) console.log(`${done}/${items.length}`);
  }
}

// 3 في نفس الوقت — الأرشيف بيبطّأ لو زودنا
const queue = [...items];
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) { await one(queue.shift()); await sleep(800); } }));
fs.writeFileSync(path.join(outDir, '_report.json'), JSON.stringify(report, null, 1));
const bad = report.filter(x => !x.ok);
console.log(`done: ${report.length - bad.length} ok, ${bad.length} failed`);
bad.forEach(b => console.log('  ✗', b.title, '—', b.why));
