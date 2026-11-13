// seed-vectorize.mjs — يطلع vectors.ndjson باستخدام bge-m3 (متعدد اللغات)
// ⚠️ لازم الـ index يكون 1024 بُعد (law-articles-m3)
import fs from 'node:fs';

const ACCOUNT_ID = 'd3f7ae78663e16e3c1544a67ae48ebd8';
const DATABASE_ID = '22344b60-cf0c-40b1-9783-13ea9db6916a';

const D1_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // من متغير بيئة — متكتبش التوكن في الكود
const AI_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // من متغير بيئة — متكتبش التوكن في الكود

if (!process.env.CLOUDFLARE_API_TOKEN) { console.error("حط التوكن الأول في PowerShell: $env:CLOUDFLARE_API_TOKEN = \"...\""); process.exit(1); }

const D1_QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`;

const d1Headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${D1_TOKEN}`,
};
const aiHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AI_TOKEN}`,
};

const OUT_FILE = 'C:\\Users\\hi\\mowakkil\\vectors-m3.ndjson';

async function main() {
  // ============ 1. جلب المواد من D1 ============
  console.log('📥 جلب المواد من D1...');
  let allArticles = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(D1_QUERY_URL, {
      method: 'POST',
      headers: d1Headers,
      body: JSON.stringify({
        sql: `SELECT id, law_name, article_number, article_text FROM law_articles LIMIT ${limit} OFFSET ${offset}`
      }),
    });
    const data = await res.json();
    if (!data.success) {
      console.error('❌ D1 error:', JSON.stringify(data.errors));
      process.exit(1);
    }
    const rows = data.result[0].results;
    if (!rows.length) break;
    allArticles.push(...rows);
    offset += limit;
    console.log(`   تم جلب ${allArticles.length} مادة...`);
  }
  console.log(`✅ إجمالي: ${allArticles.length} مادة\n`);

  // ============ 2. نجهز ملف NDJSON جديد ============
  if (fs.existsSync(OUT_FILE)) {
    fs.unlinkSync(OUT_FILE);
  }
  fs.writeFileSync(OUT_FILE, '', 'utf8');

  // ============ 3. Embeddings + كتابة NDJSON (دفعات 50 — أقل بسبب 1024 بُعد) ============
  const BATCH = 50;
  const totalBatches = Math.ceil(allArticles.length / BATCH);
  let successCount = 0;

  for (let i = 0; i < allArticles.length; i += BATCH) {
    const batch = allArticles.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    console.log(`🔄 دفعة ${batchNum}/${totalBatches} (${batch.length} مادة)...`);

    // --- 3a. Embeddings ---
    const texts = batch.map(a =>
      `${a.law_name} - ${a.article_number}: ${a.article_text}`.slice(0, 1024)
    );

    let aiData;
    try {
      const aiRes = await fetch(AI_URL, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ text: texts }),
      });
      aiData = await aiRes.json();
    } catch (e) {
      console.error(`   ❌ فشل الاتصال بـ AI: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000));
      const aiRes = await fetch(AI_URL, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify({ text: texts }),
      });
      aiData = await aiRes.json();
    }

    if (!aiData.success) {
      console.error(`   ❌ AI error:`, JSON.stringify(aiData.errors));
      console.error(`   فشل في الدفعة ${batchNum} — هنوقف هنا`);
      process.exit(1);
    }
    const embeddings = aiData.result.data;

    // --- 3b. نكتب NDJSON ---
    const lines = batch.map((a, idx) => JSON.stringify({
      id: String(a.id),
      values: embeddings[idx],
      metadata: {
        law_name: a.law_name,
        article_number: a.article_number,
      },
    }));

    fs.appendFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');

    successCount += batch.length;
    console.log(`   ✅ تم (${batch.length} مادة) — إجمالي: ${successCount}/${allArticles.length}`);

    await new Promise(r => setTimeout(r, 300));
  }

  // ============ 4. تقرير نهائي ============
  const fileSize = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`\n🎉 خلصت التغذية (bge-m3)!`);
  console.log(`   ${successCount} مادة اتحولت لـ embeddings (1024 بُعد)`);
  console.log(`   الملف: ${OUT_FILE}`);
  console.log(`   الحجم: ${fileSize} MB`);
  console.log(`\n📋 الخطوة الجاية:`);
  console.log(`   1. npx wrangler vectorize insert law-articles-m3 --file=vectors-m3.ndjson`);
  console.log(`   2. غير wrangler.toml: index_name = "law-articles-m3"`);
  console.log(`   3. غير legal-search.js: bge-m3`);
  console.log(`   4. npx wrangler deploy`);
}

main().catch(e => {
  console.error('❌', e);
  process.exit(1);
});