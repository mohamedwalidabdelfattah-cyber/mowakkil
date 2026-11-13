// extract-laws.mjs
// بيدور على الملفات القانونية في كل الفولدرات ويستخرج النص
import fs from 'node:fs';
import path from 'node:path';
import WordExtractor from 'word-extractor';

const ROOT = 'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين';
const OUT_DIR = 'C:\\Users\\hi\\mowakkil\\laws-text';

// الملفات اللي عايزين نستخرجها (بأسمائها)
const TARGETS = [
  'قانون_العقوبات_المصري.doc',
  'قانون_العمل_الموحد.doc',
  'قانون_المخدرات.doc',
  'قانون_المرافعات.doc',
  'قانون_الخلع.doc',
  'كود القانون المدنى.doc',
  'كود قانون الأجراءات الجنائية.doc',
  'القانون المدني.doc',
  'قانون الإثبات.doc',
  'قانون الاحوال الشخصية.doc',
  'قانون الايجارات  136 لسنة 1981.doc',
  'قانون_التجارة.doc',
  'قانون_التحكيم.doc',
  'قانون المحاماة.doc',
  'قانون الطفل وتعديلاته 2008.doc',
  'قانون_المحكمة_الدستورية.doc',
  'قانون_الخدمة_العسكرية.doc',
  'قانون_الجمعيات_الأهلية.doc',
  'قانون_حماية_المؤلف_المصري.doc',
  'قانون_مجلس_الدولة.doc',
  'قوانين_الأحوال_الشخصية.doc',
  // وأيضاً نسخ docx
  'القانون المدني.docx',
  'قانون المرافعات المدنية و التجارية.docx',
  'قانون المرافعات.docx',
  'قانون الاجراءات.docx',
  'قانون العمل الموحد رقم12لسنة2003.docx',
  'قانون الايجارات.docx',
  'الاثبات.docx',
  'قانون الاحوال الشخصية.docx',
];

// نتأكد إن فولدر الخروج موجود
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ندور على كل ملف في كل الفولدرات
function findFile(dir, targetName, depth = 0) {
  if (depth > 6) return null;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return null; }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const found = findFile(full, targetName, depth + 1);
      if (found) return found;
    } else if (ent.isFile() && ent.name === targetName) {
      return full;
    }
  }
  return null;
}

const extractor = new WordExtractor();
const results = { success: [], failed: [], notFound: [] };

console.log('🔍 بدء البحث والاستخراج...\n');

for (const target of TARGETS) {
  const filePath = findFile(ROOT, target);
  
  if (!filePath) {
    console.log(`❌ مش لاقي: ${target}`);
    results.notFound.push(target);
    continue;
  }

  try {
    const doc = await extractor.extract(filePath);
    const text = doc.getBody();
    
    if (!text || text.trim().length < 100) {
      console.log(`⚠️ فاضي/صغير: ${target} (${text.length} حرف)`);
      results.failed.push({ name: target, reason: 'empty or too small' });
      continue;
    }

    // نكتب النص في ملف
    const outName = target.replace(/\.(doc|docx)$/i, '.txt');
    const outPath = path.join(OUT_DIR, outName);
    fs.writeFileSync(outPath, text, 'utf8');
    
    console.log(`✅ ${target} → ${text.length} حرف`);
    results.success.push({ name: target, size: text.length, out: outName });
  } catch (e) {
    console.log(`❌ فشل: ${target} — ${e.message}`);
    results.failed.push({ name: target, reason: e.message });
  }
}

// تقرير نهائي
console.log('\n' + '='.repeat(60));
console.log('📊 التقرير النهائي\n');
console.log(`✅ نجح:     ${results.success.length}`);
console.log(`❌ فشل:     ${results.failed.length}`);
console.log(`⚠️ مش موجود: ${results.notFound.length}`);

if (results.success.length > 0) {
  console.log('\n✅ الملفات اللي اتحولت:');
  results.success.forEach(r => console.log(`   • ${r.name} — ${r.size} حرف`));
}
if (results.failed.length > 0) {
  console.log('\n❌ اللي فشل:');
  results.failed.forEach(r => console.log(`   • ${r.name} — ${r.reason}`));
}
if (results.notFound.length > 0) {
  console.log('\n⚠️ مش موجود:');
  results.notFound.forEach(n => console.log(`   • ${n}`));
}

// نحفظ التقرير JSON
fs.writeFileSync(
  path.join(OUT_DIR, '_report.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);

console.log('\n📂 النصوص في:', OUT_DIR);
console.log('📄 التقرير في:', path.join(OUT_DIR, '_report.json'));