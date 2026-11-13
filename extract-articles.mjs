// extract-articles.mjs
// يقرأ ملفات .txt ويستخرج كل "مادة" ويطلع SQL
import fs from 'node:fs';
import path from 'node:path';

const TEXT_DIR = 'C:\\Users\\hi\\mowakkil\\laws-text';
const OUT_SQL = 'C:\\Users\\hi\\mowakkil\\laws-articles.sql';

// أنماط البحث عن "المادة"
const ARTICLE_PATTERNS = [
  /(?:^|\n)\s*\(?\s*المادة\s*\(?\s*([٠-٩0-9]+|[أ-ي]+)\s*\)?\s*[:\-–—]?\s*/g,
  /(?:^|\n)\s*الماده\s*\(?\s*([٠-٩0-9]+|[أ-ي]+)\s*\)?\s*[:\-–—]?\s*/g,
  /(?:^|\n)\s*مادة\s*\(?\s*([٠-٩0-9]+|[أ-ي]+)\s*\)?\s*[:\-–—]?\s*/g,
];

// تحويل الأرقام العربية لإنجليزية
function normalizeNumber(s) {
  const arabicToEnglish = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4',
    '٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
  };
  return s.split('').map(c => arabicToEnglish[c] || c).join('');
}

// نستخرج المواد من نص
function extractArticles(text, lawName) {
  const articles = [];
  
  // نجرب كل نمط
  let matches = [];
  for (const pattern of ARTICLE_PATTERNS) {
    const m = [...text.matchAll(pattern)];
    if (m.length > matches.length) matches = m;
  }
  
  if (matches.length === 0) return articles;
  
  // نرتب الماتشات حسب الموقع
  matches.sort((a, b) => a.index - b.index);
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    const articleNum = normalizeNumber(current[1]);
    const startIdx = current.index + current[0].length;
    const endIdx = next ? next.index : text.length;
    
    let content = text.slice(startIdx, endIdx).trim();
    
    // ننضف النص
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    
    // نتجاهل المواد الفاضية أو القصيرة جداً
    if (content.length < 20) continue;
    
    // نحدد طول أقصى (5000 حرف)
    if (content.length > 5000) {
      content = content.slice(0, 5000) + '...';
    }
    
    articles.push({
      law_name: lawName,
      article_number: `المادة ${articleNum}`,
      article_text: content,
      source: 'flasha-lawyers',
    });
  }
  
  return articles;
}

// نستخرج اسم القانون من اسم الملف
function lawNameFromFile(filename) {
  return filename
    .replace(/\.txt$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ التشغيل ============

if (!fs.existsSync(TEXT_DIR)) {
  console.error('❌ الفولدر مش موجود:', TEXT_DIR);
  process.exit(1);
}

const files = fs.readdirSync(TEXT_DIR).filter(f => f.endsWith('.txt'));
console.log(`📂 بدء استخراج المواد من ${files.length} ملف...\n`);

const allArticles = [];
const stats = [];

for (const file of files) {
  const filePath = path.join(TEXT_DIR, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lawName = lawNameFromFile(file);
  
  const articles = extractArticles(text, lawName);
  
  console.log(`${file}`);
  console.log(`  القانون: ${lawName}`);
  console.log(`  النص: ${text.length} حرف → المواد: ${articles.length}`);
  
  if (articles.length > 0) {
    allArticles.push(...articles);
    stats.push({ file, lawName, count: articles.length });
  }
  console.log('');
}

// ============ نطلع SQL ============

console.log('='.repeat(60));
console.log('📊 التقرير النهائي\n');
console.log(`📚 إجمالي القوانين: ${stats.length}`);
console.log(`📄 إجمالي المواد: ${allArticles.length}`);

console.log('\n📋 حسب القانون:');
stats
  .sort((a, b) => b.count - a.count)
  .forEach(s => console.log(`   ${s.count.toString().padStart(4)} مادة — ${s.lawName}`));

// نطلع SQL
let sql = `-- Law articles extracted from Flasha Lawyers\n-- Generated: ${new Date().toISOString()}\n-- Total: ${allArticles.length} articles from ${stats.length} laws\n\n`;

sql += `DELETE FROM law_articles WHERE source = 'flashsa-lawyers';\n\n`;

// نطلع INSERT batches (كل 50 مادة)
const BATCH = 50;
for (let i = 0; i < allArticles.length; i += BATCH) {
  const batch = allArticles.slice(i, i + BATCH);
  sql += `INSERT INTO law_articles (law_name, article_number, article_text, source_url) VALUES\n`;
  sql += batch.map(a => 
    `  (${escapeSql(a.law_name)}, ${escapeSql(a.article_number)}, ${escapeSql(a.article_text)}, ${escapeSql(a.source)})`
  ).join(',\n');
  sql += `;\n\n`;
}

fs.writeFileSync(OUT_SQL, sql, 'utf8');

console.log(`\n✅ SQL اتحفظ في: ${OUT_SQL}`);
console.log(`   الحجم: ${(sql.length / 1024).toFixed(0)} KB`);

// نطلع تقرير JSON
fs.writeFileSync(
  path.join(TEXT_DIR, '_articles-report.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), total: allArticles.length, laws: stats }, null, 2),
  'utf8'
);

function escapeSql(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}