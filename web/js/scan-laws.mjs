// scan-laws.mjs — يستكشف فولدر القوانين ويطلع تقرير
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين';

if (!fs.existsSync(ROOT)) {
  console.error('❌ الفولدر مش موجود:', ROOT);
  process.exit(1);
}

const stats = {
  total: 0,
  byExt: {},          // عدد الملفات لكل امتداد
  bySize: { small: 0, medium: 0, large: 0, huge: 0 },
  biggest: [],        // أكبر 10 ملفات
  folders: new Set(),
  wordFiles: [],
  pdfFiles: [],
  otherFiles: [],
};

function walk(dir, depth = 0) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn('⚠️ مش قادر أقرأ:', dir, '—', e.message);
    return;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      stats.folders.add(full);
      if (depth < 3) walk(full, depth + 1); // ما ينزلش أكتر من 3 مستويات
    } else if (ent.isFile()) {
      let size = 0;
      try { size = fs.statSync(full).size; } catch {}

      stats.total++;
      const ext = path.extname(ent.name).toLowerCase() || '(no-ext)';
      stats.byExt[ext] = (stats.byExt[ext] || 0) + 1;

      if (size < 100 * 1024) stats.bySize.small++;
      else if (size < 1024 * 1024) stats.bySize.medium++;
      else if (size < 10 * 1024 * 1024) stats.bySize.large++;
      else stats.bySize.huge++;

      stats.biggest.push({ name: full, size });
      if (stats.biggest.length > 10) {
        stats.biggest.sort((a, b) => b.size - a.size);
        stats.biggest.length = 10;
      }

      if (ext === '.doc' || ext === '.docx') stats.wordFiles.push(full);
      else if (ext === '.pdf') stats.pdfFiles.push(full);
      else stats.otherFiles.push(full);
    }
  }
}

walk(ROOT);

// ============ التقرير ============
console.log('\n📊 تقرير الفولدر\n' + '='.repeat(60));
console.log('📁 المسار:', ROOT);
console.log('📄 إجمالي الملفات:', stats.total);
console.log('📂 عدد الفولدرات:', stats.folders.size);

console.log('\n📌 حسب الامتداد:');
Object.entries(stats.byExt)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ext, n]) => console.log(`   ${ext.padEnd(10)} → ${n} ملف`));

console.log('\n📌 حسب الحجم:');
console.log(`   صغير (<100KB)   → ${stats.bySize.small}`);
console.log(`   متوسط (<1MB)    → ${stats.bySize.medium}`);
console.log(`   كبير (<10MB)    → ${stats.bySize.large}`);
console.log(`   ضخم (>10MB)     → ${stats.bySize.huge}`);

console.log('\n📌 أكبر 10 ملفات:');
stats.biggest.forEach((f, i) => {
  const mb = (f.size / 1024 / 1024).toFixed(2);
  console.log(`   ${i + 1}. ${mb} MB — ${f.name}`);
});

console.log('\n📌 Word:', stats.wordFiles.length, 'ملف');
stats.wordFiles.slice(0, 5).forEach(f => console.log('   •', f));
if (stats.wordFiles.length > 5) console.log(`   ... و${stats.wordFiles.length - 5} ملف تاني`);

console.log('\n📌 PDF:', stats.pdfFiles.length, 'ملف');
stats.pdfFiles.slice(0, 5).forEach(f => console.log('   •', f));
if (stats.pdfFiles.length > 5) console.log(`   ... و${stats.pdfFiles.length - 5} ملف تاني`);

console.log('\n📌 ملفات تانية:', stats.otherFiles.length);

// نخزن النتيجة في ملف عشان نستخدمها بعدين
const out = {
  scanned_at: new Date().toISOString(),
  root: ROOT,
  total: stats.total,
  byExt: stats.byExt,
  wordFiles: stats.wordFiles,
  pdfFiles: stats.pdfFiles,
  otherFiles: stats.otherFiles.slice(0, 50),
};
fs.writeFileSync('laws-scan-report.json', JSON.stringify(out, null, 2), 'utf8');
console.log('\n✅ التقرير الكامل اتحفظ في: laws-scan-report.json');