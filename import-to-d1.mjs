// import-to-d1.mjs — يستورد laws-articles-v3.sql
import fs from 'node:fs';
import crypto from 'node:crypto';

const ACCOUNT_ID = 'd3f7ae78663e16e3c1544a67ae48ebd8';
const DATABASE_ID = '22344b60-cf0c-40b1-9783-13ea9db6916a';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // من متغير بيئة — متكتبش التوكن في الكود
const SQL_FILE = 'C:\\Users\\hi\\mowakkil\\laws-articles-v3.sql';

if (!process.env.CLOUDFLARE_API_TOKEN) { console.error("حط التوكن الأول في PowerShell: $env:CLOUDFLARE_API_TOKEN = \"...\""); process.exit(1); }

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/import`;
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_TOKEN}`,
};

async function importSQL() {
  // نضيف سطر عشوائي عشان نغير الـ etag كل مرة
  const sql = fs.readFileSync(SQL_FILE, 'utf8') + '\n-- run ' + Date.now() + '\n';
  const etag = crypto.createHash('md5').update(sql).digest('hex');
  let filename = crypto.randomUUID();

  console.log(`📄 الملف: ${(sql.length / 1024).toFixed(0)} KB`);
  console.log(`🔑 ETag: ${etag}`);
  console.log(`📝 Filename: ${filename}`);

  // ============ 1. INIT ============
  console.log('\n🔄 1/4 بدء الرفع...');
  let res = await fetch(D1_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'init', etag, filename }),
  });
  let data = await res.json();
  if (!data.success) {
    console.error('❌ init failed:', JSON.stringify(data.errors, null, 2));
    process.exit(1);
  }
  
  const uploadUrl = data.result?.upload_url;
  if (data.result?.filename) filename = data.result.filename;
  console.log(`✅ تم (filename: ${filename})`);

  // ============ 2. UPLOAD ============
  if (uploadUrl) {
    console.log('🔄 2/4 رفع الملف...');
    res = await fetch(uploadUrl, {
      method: 'PUT',
      body: sql,
      headers: { 'Content-Type': 'application/sql' },
    });
    if (!res.ok) {
      console.error(`❌ Upload failed: ${res.status} ${res.statusText}`);
      const errText = await res.text();
      console.error(errText);
      process.exit(1);
    }
    console.log('✅ تم');
  } else {
    console.log('⚠️ 2/4 الملف موجود بالفعل — تخطي الرفع');
  }

  // ============ 3. INGEST ============
  console.log('🔄 3/4 بدء الاستيعاب...');
  res = await fetch(D1_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'ingest', etag, filename }),
  });
  data = await res.json();
  
  if (!data.success) {
    console.error('❌ ingest failed:');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  
  if (data.result?.status === 'error') {
    console.error('❌ ingest error:', JSON.stringify(data.result?.error || data.result, null, 2));
    process.exit(1);
  }
  
  const ingestBookmark = data.result?.at_bookmark || data.result?.current_bookmark;
  if (!ingestBookmark) {
    console.error('❌ مش لاقي bookmark في رد ingest:');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log(`✅ تم (bookmark: ${ingestBookmark})`);

  // ============ 4. POLL ============
  console.log('🔄 4/4 متابعة الحالة...');
  let attempts = 0;
  const maxAttempts = 150; // 5 دقايق
  let lastStatus = null;

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    res = await fetch(D1_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        action: 'poll', 
        current_bookmark: ingestBookmark 
      }),
    });
    data = await res.json();

    if (!data.success) {
      console.error('❌ poll failed:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    const status = data.result?.status || 'unknown';
    
    if (status !== lastStatus) {
      console.log(`   [${attempts}/${maxAttempts}] الحالة: ${status}`);
      lastStatus = status;
    }

    if (status === 'complete') {
      console.log('\n🎉 تم الاستيراد بنجاح!');
      return;
    }
    if (status === 'error') {
      console.error('\n❌ الاستيراد فشل:');
      console.error(JSON.stringify(data.result, null, 2));
      process.exit(1);
    }
  }

  // لو الحالة فضلت unknown — نتحقق من الداتابيز مباشرة
  console.error(`\n⚠️ استنينا ${maxAttempts * 2} ثانية — الحالة مش "complete" لسه`);
  console.error('   بنتحقق من الداتابيز مباشرة...\n');
  
  // نتحقق من العدد
  const checkRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql: 'SELECT COUNT(*) as c FROM law_articles' }),
    }
  );
  const checkData = await checkRes.json();
  if (checkData.success && checkData.result?.[0]?.results?.[0]) {
    const count = checkData.result[0].results[0].c;
    console.log(`📊 عدد المواد في law_articles: ${count}`);
    if (count > 101) {
      console.log('✅ الاستيراد نجح! (رغم إن الـ poll معلق)');
      return;
    }
  }
  
  console.error('❌ الاستيراد ممكن يكون فشل — راجع الداتابيز');
}

importSQL().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});