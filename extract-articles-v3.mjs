// extract-articles-v3.mjs — نسخة بجمل INSERT صغيرة (مادة واحدة لكل جملة)
import fs from 'node:fs';
import path from 'node:path';

const TEXT_DIR = 'C:\\Users\\hi\\mowakkil\\laws-text';
const OUT_SQL = 'C:\\Users\\hi\\mowakkil\\laws-articles-v3.sql';

const ARTICLE_PATTERNS = [
  /(?:^|\n)\s*\(?\s*المادة\s*\(?\s*([٠-٩0-9]+|[أ-ي]+)\s*\)?\s*[:\-–—]?\s*/g,
  /(?:^|\n)\s*الماده\s*\(?\s*([٠-٩0-9]+|[أ-ي]+)\s*\)?\s*[:\-–—]?\s*/g,
  /(?:^|\n)\s*مادة\s*\(?\s*([٠-٩0-9]+|[أ-ي]+)\s*\)?\s*[:\-–—]?\s*/g,
];

function normalizeNumber(s) {
  const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  return s.split('').map(c => map[c] || c).join('');
}

function extractArticles(text, lawName) {
  const articles = [];
  let matches = [];
  for (const pattern of ARTICLE_PATTERNS) {
    const m = [...text.matchAll(pattern)];
    if (m.length > matches.length) matches = m;
  }
  if (matches.length === 0) return articles;
  matches.sort((a, b) => a.index - b.index);

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const articleNum = normalizeNumber(current[1]);
    const startIdx = current.index + current[0].length;
    const endIdx = next ? next.index : text.length;
    let content = text.slice(startIdx, endIdx).trim();
    content = content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    if (content.length < 20) continue;
    if (content.length > 5000) content = content.slice(0, 5000) + '...';
    articles.push({
      law_name: lawName,
      article_number: `المادة ${articleNum}`,
      article_text: content,
      source: 'flashsa-lawyers',
    });
  }
  return articles;
}

function lawNameFromFile(filename) {
  return filename.replace(/\.txt$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeSql(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// ============ التشغيل ============

if (!fs.existsSync(TEXT_DIR)) {
  console.error('❌ الفولدر مش موجود:', TEXT_DIR);
  process.exit(1);
}

const files = fs.readdirSync(TEXT_DIR).filter(f => f.endsWith('.txt'));
console.log(`📂 بدء الاستخراج من ${files.length} ملف...\n`);

const allArticles = [];

for (const file of files) {
  const text = fs.readFileSync(path.join(TEXT_DIR, file), 'utf8');
  const lawName = lawNameFromFile(file);
  const articles = extractArticles(text, lawName);
  console.log(`${file}: ${articles.length} مادة`);
  allArticles.push(...articles);
}

console.log(`\n📊 إجمالي: ${allArticles.length} مادة من ${files.length} ملف`);

// ============ نطلع SQL — مادة واحدة لكل جملة ============

let sql = `-- Law articles (v3 - one row per INSERT)\n-- Generated: ${new Date().toISOString()}\n-- Total: ${allArticles.length}\n\n`;
sql += `DELETE FROM law_articles WHERE source_url = 'flashsa-lawyers';\n\n`;

let maxStatementLength = 0;

for (const a of allArticles) {
  const stmt = `INSERT INTO law_articles (law_name, article_number, article_text, source_url) VALUES (${escapeSql(a.law_name)}, ${escapeSql(a.article_number)}, ${escapeSql(a.article_text)}, ${escapeSql(a.source)});\n`;
  if (stmt.length > maxStatementLength) maxStatementLength = stmt.length;
  sql += stmt;
}

fs.writeFileSync(OUT_SQL, sql, 'utf8');

console.log(`\n✅ SQL اتحفظ: ${OUT_SQL}`);
console.log(`   الحجم: ${(sql.length / 1024).toFixed(0)} KB`);
console.log(`   عدد الجمل: ${allArticles.length}`);
console.log(`   أطول جملة: ${(maxStatementLength / 1024).toFixed(1)} KB`);

if (maxStatementLength > 95 * 1024) {
  console.log(`\n⚠️ تحذير: فيه جملة ${(maxStatementLength/1024).toFixed(1)} KB — قريبة من الحد (100 KB)`);
  console.log('   ممكن تحتاج نقسم النص الطويل أو نعمل استثناءات');
} else {
  console.log(`\n✅ كل الجمل تحت الحد (100 KB) — آمنة للاستيراد`);
}