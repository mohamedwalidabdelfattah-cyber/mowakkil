// diagnose-password.cjs
// تشخيص مشكلة password في بوابة الموكل

const { execSync } = require('child_process');

const DB_NAME = 'mowakkil-db-v2';

function runSQL(sql) {
  // ✅ نشيل الـ newlines والمسافات الزيادة
  const cleanSQL = sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  
  try {
    const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --command="${cleanSQL}" --json`;
    const result = execSync(cmd, { encoding: 'utf8', cwd: __dirname });
    
    // wrangler بيرجع output فيه كلام زيادة أحياناً — نستخرج الـ JSON
    const jsonStart = result.indexOf('[');
    const jsonEnd = result.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('❌ الـ output مش JSON صالح:', result.substring(0, 200));
      return null;
    }
    
    const jsonStr = result.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('SQL Error:', e.message);
    if (e.stdout) console.error('STDOUT:', e.stdout.toString());
    if (e.stderr) console.error('STDERR:', e.stderr.toString());
    return null;
  }
}

console.log('🔍 تشخيص مشكلة Password في بوابة الموكل\n');
console.log('='.repeat(60) + '\n');

// ============================================================
// 1. شوف كل client_users
// ============================================================
console.log('📋 [1] بيانات client_users:\n');

const result = runSQL(`
  SELECT id, client_id, phone, email, password_hash, salt, invite_code, invite_expires_at, active
  FROM client_users
  ORDER BY id DESC
  LIMIT 20
`);

if (!result || !result[0] || !result[0].results) {
  console.error('❌ مفيش بيانات أو في خطأ');
  process.exit(1);
}

const users = result[0].results;

if (users.length === 0) {
  console.log('⚠️ مفيش client_users في الداتابيز!');
  process.exit(0);
}

users.forEach(u => {
  console.log(`\n👤 ID: ${u.id} | client_id: ${u.client_id}`);
  console.log(`   📱 Phone: ${u.phone || '—'}`);
  console.log(`   📧 Email: ${u.email || '—'}`);
  console.log(`   🔑 password_hash: ${u.password_hash ? u.password_hash.substring(0, 40) + '...' : 'PENDING'}`);
  console.log(`   🧂 salt: ${u.salt ? u.salt.substring(0, 20) + '...' : '(مفيش)'}`);
  console.log(`   🎫 invite_code: ${u.invite_code || '—'}`);
  console.log(`   ⏰ expires: ${u.invite_expires_at || '—'}`);
  console.log(`   ✅ active: ${u.active}`);
  
  // تشخيص
  if (u.password_hash === 'PENDING' || !u.password_hash) {
    console.log('   ⚠️ المشكلة: مفيش باسورد (PENDING)');
  } else if (u.password_hash.length < 30) {
    console.log('   ⚠️ المشكلة: password_hash قصير جداً — ممكن يكون plaintext مش hash!');
  } else if (!u.salt) {
    console.log('   ⚠️ المشكلة: فيه hash بس مفيش salt');
  } else {
    console.log('   ✅ الباسورد محفوظ صح (hash + salt)');
  }
});

// ============================================================
// 2. اقتراحات الحل
// ============================================================
console.log('\n\n' + '='.repeat(60));
console.log('🎯 التشخيص:\n');

const pendingUsers = users.filter(u => u.password_hash === 'PENDING' || !u.password_hash);
const shortHashUsers = users.filter(u => u.password_hash && u.password_hash !== 'PENDING' && u.password_hash.length < 30);
const noSaltUsers = users.filter(u => u.password_hash && u.password_hash !== 'PENDING' && u.password_hash.length >= 30 && !u.salt);

if (pendingUsers.length > 0) {
  console.log(`❌ فيه ${pendingUsers.length} مستخدم لسه PENDING (مفيش باسورد).`);
  console.log('   ده معناه إن set-password مش بيشتغل صح، أو إنه مش اتنفذ.');
  console.log('   الحل: استخدم quick login، وبعدها اضغط "إعداد باسورد" من الإعدادات.');
}

if (shortHashUsers.length > 0) {
  console.log(`❌ فيه ${shortHashUsers.length} مستخدم password_hash قصير (ممكن plaintext).`);
  console.log('   ده معناه إن set-password بيحفظ الباسورد كنص عادي مش hash.');
}

if (noSaltUsers.length > 0) {
  console.log(`❌ فيه ${noSaltUsers.length} مستخدم عنده hash بس مفيش salt.`);
}

if (pendingUsers.length === 0 && shortHashUsers.length === 0 && noSaltUsers.length === 0) {
  console.log('✅ الباسوردات محفوظة صح — المشكلة في login (verifyPassword).');
}

// ============================================================
// 3. اختبار verifyPassword
// ============================================================
console.log('\n\n' + '='.repeat(60));
console.log('💡 الخطوة الجاية:\n');

if (pendingUsers.length > 0) {
  console.log('1. جرب quick login للـ ID اللي عايز تختبره');
  console.log('2. بعدين اضغط "إعداد باسورد" من الإعدادات');
  console.log('3. بعد ما تحفظ، شغل السكريبت ده تاني عشان نتأكد إن الباسورد اتحفظ');
} else if (shortHashUsers.length > 0) {
  console.log('⚠️ المشكلة في set-password — بيحفظ plaintext.');
  console.log('محتاج أشوف كود hashPassword في lib/crypto.js');
} else {
  console.log('الباسوردات محفوظة صح. لو لسه login مش شغال، محتاج أشوف كود verifyPassword في lib/crypto.js');
}

console.log('\n' + '='.repeat(60));