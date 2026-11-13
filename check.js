// check.js
// ملف فحص شامل للمشروع

import fs from 'fs';
import path from 'path';

const CHECK_FILES = [
  'web/index.html',
  'web/assets/styles.css',
  'web/js/main.js',
  'web/js/router.js',
  'web/js/drawer.js',
  'web/js/config.js',
  'web/js/api.js',
  'web/js/ui.js',
  'web/js/state.js',
  'web/js/views/login.js',
  'web/js/views/dashboard.js',
  'web/js/views/cases.js',
  'web/js/views/clients.js',
  'web/js/views/lawyers.js',
  'web/js/views/fees.js',
  'web/js/views/tasks.js',
  'web/js/views/reports.js',
  'web/js/views/calc.js',
  'web/js/views/search.js',
  'web/js/views/account.js',
  'web/js/views/agenda.js',
  'web/js/views/superadmin.js',
  'worker/index.js',
  'wrangler.toml',
  'package.json',
];

const CHECK_CONTENT = [
  { file: 'web/index.html',      search: 'topbar',           label: 'Topbar في HTML' },
  { file: 'web/index.html',      search: 'menu-btn',         label: 'زرار ☰ في HTML' },
  { file: 'web/index.html',      search: 'drawer',           label: 'Drawer في HTML' },
  { file: 'web/index.html',      search: 'view-host',        label: 'view-host في HTML' },
  { file: 'web/assets/styles.css', search: '.topbar',        label: 'CSS: .topbar' },
  { file: 'web/assets/styles.css', search: '.drawer',        label: 'CSS: .drawer' },
  { file: 'web/assets/styles.css', search: '.menu-btn',      label: 'CSS: .menu-btn' },
  { file: 'web/js/main.js',      search: 'initDrawer',       label: 'main.js: initDrawer' },
  { file: 'web/js/main.js',      search: 'import * as searchView', label: 'main.js: searchView' },
  { file: 'web/js/drawer.js',    search: 'MENU',             label: 'drawer.js: MENU' },
  { file: 'web/js/drawer.js',    search: 'export function initDrawer', label: 'drawer.js: initDrawer' },
  { file: 'web/js/router.js',    search: 'view-changed',     label: 'router.js: view-changed event' },
  { file: 'web/js/views/login.js', search: 'updateDrawerUser', label: 'login.js: updateDrawerUser' },
  { file: 'web/js/views/search.js', search: 'GOV_LINKS',     label: 'search.js: GOV_LINKS' },
  { file: 'web/js/views/search.js', search: 'gov-links-grid', label: 'search.js: gov-links-grid' },
  { file: 'web/js/views/search.js', search: 'generate-doc',  label: 'search.js: generate-doc' },
  { file: 'worker/services/legal-search.js', search: 'env.AI', label: 'legal-search.js: env.AI' },
  { file: 'worker/services/legal-search.js', search: 'buildTemplateDocument', label: 'legal-search.js: template fallback' },
  { file: 'wrangler.toml',       search: '[ai]',             label: 'wrangler.toml: AI binding' },
  { file: 'wrangler.toml',       search: 'mowakkil-db-v2',   label: 'wrangler.toml: D1 binding' },
];

let okCount = 0;
let failCount = 0;

console.log('\n═══════════════════════════════════════════════');
console.log('  فحص المشروع الشامل');
console.log('═══════════════════════════════════════════════\n');

// 1) فحص وجود الملفات
console.log('📁 فحص وجود الملفات:\n');
for (const f of CHECK_FILES) {
  if (fs.existsSync(f)) {
    const size = fs.statSync(f).size;
    console.log(`  ✅ ${f.padEnd(42)} ${(size/1024).toFixed(1)} KB`);
    okCount++;
  } else {
    console.log(`  ❌ ${f.padEnd(42)} غير موجود!`);
    failCount++;
  }
}

// 2) فحص المحتوى
console.log('\n📝 فحص محتوى الملفات:\n');
for (const c of CHECK_CONTENT) {
  if (!fs.existsSync(c.file)) {
    console.log(`  ⊘ ${c.label.padEnd(50)} (الملف غير موجود)`);
    continue;
  }
  const content = fs.readFileSync(c.file, 'utf8');
  if (content.includes(c.search)) {
    console.log(`  ✅ ${c.label}`);
    okCount++;
  } else {
    console.log(`  ❌ ${c.label.padEnd(50)} ← ناقص!`);
    failCount++;
  }
}

// 3) فحص الـ imports
console.log('\n🔗 فحص الـ imports:\n');
const mainJs = fs.existsSync('web/js/main.js') ? fs.readFileSync('web/js/main.js', 'utf8') : '';
const expectedImports = [
  './views/login.js',
  './views/dashboard.js',
  './views/cases.js',
  './views/clients.js',
  './views/lawyers.js',
  './views/fees.js',
  './views/tasks.js',
  './views/reports.js',
  './views/calc.js',
  './views/search.js',
  './views/account.js',
  './views/agenda.js',
  './views/superadmin.js',
  './drawer.js',
];

for (const imp of expectedImports) {
  if (mainJs.includes(imp)) {
    console.log(`  ✅ ${imp}`);
    okCount++;
  } else {
    console.log(`  ❌ ${imp.padEnd(40)} ← ناقص!`);
    failCount++;
  }
}

// 4) ملخص
console.log('\n═══════════════════════════════════════════════');
console.log(`  ✅ نجح: ${okCount}`);
console.log(`  ❌ فشل: ${failCount}`);
console.log('═══════════════════════════════════════════════\n');

if (failCount === 0) {
  console.log('🎉 المشروع كامل! جاهز للنشر.\n');
} else {
  console.log('⚠️  فيه نواقص — راجع اللي فوق.\n');
  process.exit(1);
}