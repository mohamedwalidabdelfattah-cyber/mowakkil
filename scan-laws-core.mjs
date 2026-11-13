// scan-laws-core.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين\\القوانين';

if (!fs.existsSync(ROOT)) {
  console.error('❌ الفولدر مش موجود:', ROOT);
  process.exit(1);
}

console.log('📂 استكشاف:', ROOT, '\n');

function walk(dir, depth = 0) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const pad = '  '.repeat(depth);
    if (ent.isDirectory()) {
      console.log(`${pad}📁 ${ent.name}/`);
      if (depth < 2) walk(full, depth + 1);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (['.doc', '.docx', '.pdf'].includes(ext)) {
        const size = (fs.statSync(full).size / 1024).toFixed(0);
        console.log(`${pad}📄 ${ent.name} (${size} KB)`);
      }
    }
  }
}

walk(ROOT);