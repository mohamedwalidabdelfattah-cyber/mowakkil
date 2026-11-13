// filter-audit.cjs
// فحص شامل للفلاتر في النظام

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WEB_VIEWS = path.join(ROOT, 'web', 'js', 'views');
const WORKER_ROUTES = path.join(ROOT, 'worker', 'routes');

// الإعدادات المتوقعة لكل صفحة
const EXPECTED_FILTERS = {
  'cases.js': {
    label: 'القضايا',
    filters: ['الحالة (status)', 'النوع (type)', 'المحامي (lawyer_id)', 'المحكمة (court)', 'البحث (search)'],
    api: 'cases.js'
  },
  'clients.js': {
    label: 'الموكلين',
    filters: ['النوع (individual/company)', 'البحث بالاسم/الهاتف', 'تاريخ الإضافة'],
    api: 'clients.js'
  },
  'money.js': {
    label: 'الفواتير',
    filters: ['الحالة (draft/sent/paid/late)', 'الموكل (client_id)', 'الفترة الزمنية (from/to)', 'البحث (search)'],
    api: 'invoices.js'
  },
  'tasks.js': {
    label: 'المهام',
    filters: ['الحالة (open/done)', 'الأولوية (high/normal)', 'تاريخ الاستحقاق (due)'],
    api: 'tasks.js'
  },
  'fees.js': {
    label: 'الأتعاب',
    filters: ['الحالة (paid/due/late)', 'الفترة الزمنية'],
    api: 'fees.js'
  },
  'lawyers.js': {
    label: 'المحامين',
    filters: ['الحالة (active/inactive)', 'البحث بالاسم'],
    api: 'lawyers.js'
  },
  'agenda.js': {
    label: 'الأجندة',
    filters: ['الفترة الزمنية', 'النوع (session/task/fee)'],
    api: 'sessions.js'
  }
};

// ============================================================
// دوال مساعدة
// ============================================================
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function hasFilterInCode(content) {
  if (!content) return false;
  const indicators = [
    'renderFilterBar',
    'filter-bar',
    'filter-tabs',
    'data-filter',
    'filter-input',
    'selected filter',
    'selectedFilter'
  ];
  return indicators.some(ind => content.toLowerCase().includes(ind.toLowerCase()));
}

function extractApiCalls(content) {
  if (!content) return [];
  const matches = content.match(/apiJson\(`[^`]+`\)/g) || [];
  return matches.map(m => m.replace(/apiJson\(`|`\)/g, ''));
}

function apiSupportsFilters(content) {
  if (!content) return false;
  // نتأكد إن الـ API بيقرأ من req.query أو searchParams
  return /req\.query|searchParams|url\.searchParams/i.test(content);
}

// ============================================================
// الفحص الرئيسي
// ============================================================
console.log('🔍 فحص شامل لنظام الفلاتر في مُوكِّل...\n');
console.log('='.repeat(70));

let totalPages = 0;
let pagesWithFilters = 0;
let pagesNeedingFilters = 0;
const report = [];

for (const [file, info] of Object.entries(EXPECTED_FILTERS)) {
  const viewPath = path.join(WEB_VIEWS, file);
  const apiPath = path.join(WORKER_ROUTES, info.api);

  const viewContent = readFileSafe(viewPath);
  const apiContent = readFileSafe(apiPath);

  if (!viewContent) {
    console.log(`⚠️  ${info.label.padEnd(15)} — الملف مش موجود (${file})`);
    continue;
  }

  totalPages++;
  const hasUiFilter = hasFilterInCode(viewContent);
  const hasApiFilter = apiSupportsFilters(apiContent);
  const apiCalls = extractApiCalls(viewContent);

  let statusIcon = '';
  let statusText = '';

  if (hasUiFilter && hasApiFilter) {
    statusIcon = '✅';
    statusText = 'فلاتر شغالة بالكامل';
    pagesWithFilters++;
  } else if (hasUiFilter && !hasApiFilter) {
    statusIcon = '⚠️';
    statusText = 'فلاتر UI موجودة بس الباك مش بيدعمها';
  } else if (!hasUiFilter && hasApiFilter) {
    statusIcon = '🟡';
    statusText = 'الباك جاهز بس محتاج UI';
  } else {
    statusIcon = '❌';
    statusText = 'محتاج فلاتر كاملة';
    pagesNeedingFilters++;
  }

  console.log(`\n${statusIcon} ${info.label.padEnd(15)} (${file})`);
  console.log(`   الحالة: ${statusText}`);
  console.log(`   الـ API: ${info.api} ${hasApiFilter ? '(يدعم query)' : '(لا يدعم query)'}`);

  if (apiCalls.length > 0) {
    console.log(`   API calls: ${apiCalls.slice(0, 3).join(', ')}${apiCalls.length > 3 ? '...' : ''}`);
  }

  console.log(`   الفلاتر المطلوبة:`);
  info.filters.forEach(f => console.log(`     - ${f}`));

  report.push({
    page: info.label,
    file,
    api: info.api,
    hasUiFilter,
    hasApiFilter,
    status: statusText,
    requiredFilters: info.filters
  });
}

// ============================================================
// التقرير النهائي
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('📊 ملخص الفحص:');
console.log('='.repeat(70));
console.log(`   إجمالي الصفحات المفحوصة: ${totalPages}`);
console.log(`   ✅ صفحات فيها فلاتر: ${pagesWithFilters}`);
console.log(`   ❌ صفحات محتاجة فلاتر: ${pagesNeedingFilters}`);
console.log(`   ⚠️ صفحات فيها مشكلة: ${totalPages - pagesWithFilters - pagesNeedingFilters}`);

// ============================================================
// اقتراح خطة التنفيذ
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('🎯 خطة التنفيذ المقترحة (بترتيب الأولوية):');
console.log('='.repeat(70));

const priorityOrder = ['cases.js', 'clients.js', 'money.js', 'tasks.js', 'fees.js', 'lawyers.js', 'agenda.js'];
const priorityReport = report
  .filter(r => priorityOrder.includes(r.file))
  .sort((a, b) => priorityOrder.indexOf(a.file) - priorityOrder.indexOf(b.file));

priorityReport.forEach((r, i) => {
  if (r.status !== 'فلاتر شغالة بالكامل') {
    console.log(`\n${i + 1}. ${r.page} — ${r.status}`);
    console.log(`   ملفات مطلوبة: web/js/views/${r.file}, worker/routes/${r.api}`);
  }
});

if (priorityReport.every(r => r.status === 'فلاتر شغالة بالكامل')) {
  console.log('\n🎉 كل الصفحات فيها فلاتر شغالة!');
}

// ============================================================
// تصدير التقرير (اختياري)
// ============================================================
const reportPath = path.join(ROOT, 'filter-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 التقرير الكامل محفوظ في: filter-report.json`);