// worker/services/chart-of-accounts.js
// دليل الحسابات الافتراضي لمكتب محاماة

export const DEFAULT_CHART = [
  // ============ الأصول (1000-1999) ============
  { code: '1000', name: 'الأصول', name_en: 'Assets', type: 'asset', category: 'header', is_system: 1 },

  { code: '1100', name: 'الأصول المتداولة', name_en: 'Current Assets', type: 'asset', category: 'header', parent_code: '1000', is_system: 1 },
  { code: '1101', name: 'النقدية بالصندوق', name_en: 'Cash on Hand', type: 'asset', category: 'current_asset', parent_code: '1100', is_system: 1 },
  { code: '1102', name: 'النقدية بالبنك', name_en: 'Cash at Bank', type: 'asset', category: 'current_asset', parent_code: '1100', is_system: 1 },
  { code: '1103', name: 'العملاء (الموكلون)', name_en: 'Accounts Receivable', type: 'asset', category: 'current_asset', parent_code: '1100', is_system: 1 },
  { code: '1104', name: 'أتعاب مستحقة', name_en: 'Accrued Fees', type: 'asset', category: 'current_asset', parent_code: '1100', is_system: 1 },
  { code: '1105', name: 'مصاريف مدفوعة مقدمًا', name_en: 'Prepaid Expenses', type: 'asset', category: 'current_asset', parent_code: '1100', is_system: 1 },
  { code: '1106', name: 'حساب الأمانة - الموكلون', name_en: 'Client Trust Account', type: 'asset', category: 'current_asset', parent_code: '1100', is_system: 1 },

  { code: '1200', name: 'الأصول الثابتة', name_en: 'Fixed Assets', type: 'asset', category: 'header', parent_code: '1000', is_system: 1 },
  { code: '1201', name: 'أثاث ومفروشات', name_en: 'Furniture', type: 'asset', category: 'fixed_asset', parent_code: '1200', is_system: 1 },
  { code: '1202', name: 'أجهزة كمبيوتر', name_en: 'Computers', type: 'asset', category: 'fixed_asset', parent_code: '1200', is_system: 1 },
  { code: '1203', name: 'سيارات', name_en: 'Vehicles', type: 'asset', category: 'fixed_asset', parent_code: '1200', is_system: 1 },
  { code: '1204', name: 'مكتبة قانونية', name_en: 'Legal Library', type: 'asset', category: 'fixed_asset', parent_code: '1200', is_system: 1 },
  { code: '1210', name: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'asset', category: 'contra_asset', parent_code: '1200', is_system: 1 },

  // ============ الالتزامات (2000-2999) ============
  { code: '2000', name: 'الالتزامات', name_en: 'Liabilities', type: 'liability', category: 'header', is_system: 1 },

  { code: '2100', name: 'الالتزامات المتداولة', name_en: 'Current Liabilities', type: 'liability', category: 'header', parent_code: '2000', is_system: 1 },
  { code: '2101', name: 'الموردون (الدائنون)', name_en: 'Accounts Payable', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },
  { code: '2102', name: 'مرتبات مستحقة', name_en: 'Accrued Salaries', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },
  { code: '2103', name: 'إيجار مستحق', name_en: 'Accrued Rent', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },
  { code: '2104', name: 'ضرائب مستحقة', name_en: 'Accrued Taxes', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },
  { code: '2105', name: 'تأمينات اجتماعية', name_en: 'Social Insurance', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },
  { code: '2106', name: 'إيرادات مؤجلة (دفعات مقدمة)', name_en: 'Deferred Revenue', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },
  { code: '2107', name: 'أمانات الموكلين (مقدم مصاريف)', name_en: 'Client Trust Deposits', type: 'liability', category: 'current_liability', parent_code: '2100', is_system: 1 },

  // ============ حقوق الملكية (3000-3999) ============
  { code: '3000', name: 'حقوق الملكية', name_en: 'Equity', type: 'equity', category: 'header', is_system: 1 },
  { code: '3101', name: 'رأس المال', name_en: 'Capital', type: 'equity', category: 'equity', parent_code: '3000', is_system: 1 },
  { code: '3102', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', category: 'equity', parent_code: '3000', is_system: 1 },
  { code: '3103', name: 'المسحوبات الشخصية', name_en: 'Owner Drawings', type: 'equity', category: 'contra_equity', parent_code: '3000', is_system: 1 },

  // ============ الإيرادات (4000-4999) ============
  { code: '4000', name: 'الإيرادات', name_en: 'Revenue', type: 'revenue', category: 'header', is_system: 1 },
  { code: '4101', name: 'أتعاب القضايا', name_en: 'Legal Fees', type: 'revenue', category: 'revenue', parent_code: '4000', is_system: 1 },
  { code: '4102', name: 'استشارات قانونية', name_en: 'Consultations', type: 'revenue', category: 'revenue', parent_code: '4000', is_system: 1 },
  { code: '4103', name: 'صياغة عقود', name_en: 'Contract Drafting', type: 'revenue', category: 'revenue', parent_code: '4000', is_system: 1 },
  { code: '4104', name: 'توثيق', name_en: 'Notarization', type: 'revenue', category: 'revenue', parent_code: '4000', is_system: 1 },
  { code: '4105', name: 'تحكيم', name_en: 'Arbitration', type: 'revenue', category: 'revenue', parent_code: '4000', is_system: 1 },
  { code: '4106', name: 'إيرادات أخرى', name_en: 'Other Revenue', type: 'revenue', category: 'revenue', parent_code: '4000', is_system: 1 },

  // ============ المصاريف (5000-5999) ============
  { code: '5000', name: 'المصاريف', name_en: 'Expenses', type: 'expense', category: 'header', is_system: 1 },

  // 5.1 المرتبات
  { code: '5100', name: 'المرتبات والأجور', name_en: 'Salaries', type: 'expense', category: 'header', parent_code: '5000', is_system: 1 },
  { code: '5101', name: 'مرتبات المحامين', name_en: 'Lawyer Salaries', type: 'expense', category: 'expense', parent_code: '5100', is_system: 1 },
  { code: '5102', name: 'مرتبات الموظفين', name_en: 'Staff Salaries', type: 'expense', category: 'expense', parent_code: '5100', is_system: 1 },
  { code: '5103', name: 'مكافآت وحوافز', name_en: 'Bonuses', type: 'expense', category: 'expense', parent_code: '5100', is_system: 1 },
  { code: '5104', name: 'تأمينات اجتماعية', name_en: 'Social Insurance', type: 'expense', category: 'expense', parent_code: '5100', is_system: 1 },

  // 5.2 مصاريف المكتب
  { code: '5200', name: 'مصاريف المكتب', name_en: 'Office Expenses', type: 'expense', category: 'header', parent_code: '5000', is_system: 1 },
  { code: '5201', name: 'إيجار المكتب', name_en: 'Office Rent', type: 'expense', category: 'expense', parent_code: '5200', is_system: 1 },
  { code: '5202', name: 'كهرباء وماء وغاز', name_en: 'Utilities', type: 'expense', category: 'expense', parent_code: '5200', is_system: 1 },
  { code: '5203', name: 'إنترنت وتليفون', name_en: 'Internet & Phone', type: 'expense', category: 'expense', parent_code: '5200', is_system: 1 },
  { code: '5204', name: 'نظافة وصيانة', name_en: 'Cleaning & Maintenance', type: 'expense', category: 'expense', parent_code: '5200', is_system: 1 },
  { code: '5205', name: 'قرطاسية ومستلزمات', name_en: 'Stationery', type: 'expense', category: 'expense', parent_code: '5200', is_system: 1 },
  { code: '5206', name: 'ضيافة', name_en: 'Entertainment', type: 'expense', category: 'expense', parent_code: '5200', is_system: 1 },

  // 5.3 مصاريف القضايا
  { code: '5300', name: 'مصاريف القضايا', name_en: 'Case Expenses', type: 'expense', category: 'header', parent_code: '5000', is_system: 1 },
  { code: '5301', name: 'رسوم قضائية', name_en: 'Court Fees', type: 'expense', category: 'expense', parent_code: '5300', is_system: 1 },
  { code: '5302', name: 'دمغات', name_en: 'Stamps', type: 'expense', category: 'expense', parent_code: '5300', is_system: 1 },
  { code: '5303', name: 'انتقالات', name_en: 'Transportation', type: 'expense', category: 'expense', parent_code: '5300', is_system: 1 },
  { code: '5304', name: 'تصوير وطباعة', name_en: 'Photocopying', type: 'expense', category: 'expense', parent_code: '5300', is_system: 1 },
  { code: '5305', name: 'رسوم خبراء', name_en: 'Expert Fees', type: 'expense', category: 'expense', parent_code: '5300', is_system: 1 },
  { code: '5306', name: 'رسوم محضرين', name_en: 'Bailiff Fees', type: 'expense', category: 'expense', parent_code: '5300', is_system: 1 },

  // 5.4 مصاريف إدارية
  { code: '5400', name: 'مصاريف إدارية', name_en: 'Administrative', type: 'expense', category: 'header', parent_code: '5000', is_system: 1 },
  { code: '5401', name: 'رسوم بنكية', name_en: 'Bank Charges', type: 'expense', category: 'expense', parent_code: '5400', is_system: 1 },
  { code: '5402', name: 'مصاريف قانونية', name_en: 'Legal Fees', type: 'expense', category: 'expense', parent_code: '5400', is_system: 1 },
  { code: '5403', name: 'تسويق وإعلان', name_en: 'Marketing', type: 'expense', category: 'expense', parent_code: '5400', is_system: 1 },
  { code: '5404', name: 'اشتراكات', name_en: 'Subscriptions', type: 'expense', category: 'expense', parent_code: '5400', is_system: 1 },
  { code: '5405', name: 'تدريب وتطوير', name_en: 'Training', type: 'expense', category: 'expense', parent_code: '5400', is_system: 1 },
  { code: '5406', name: 'مصاريف أخرى', name_en: 'Other Expenses', type: 'expense', category: 'expense', parent_code: '5400', is_system: 1 },
];

// ============================================================
// دالة لتهيئة الحسابات لمكتب جديد
// ============================================================
export async function initializeChartOfAccounts(env, officeId) {
  // نتحقق لو المكتب عنده حسابات بالفعل
  const existing = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM accounts WHERE office_id = ?`
  ).bind(officeId).first();

  if (existing?.count > 0) return { initialized: false, message: 'الحسابات موجودة بالفعل' };

  // نضيف الحسابات بالترتيب، ونربط الأبناء بالآباء
  const codeToId = {};

  for (const acc of DEFAULT_CHART) {
    const parentId = acc.parent_code ? codeToId[acc.parent_code] : null;

    const result = await env.DB.prepare(
      `INSERT INTO accounts
        (office_id, code, name, name_en, type, category, parent_id, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      officeId,
      acc.code,
      acc.name,
      acc.name_en || null,
      acc.type,
      acc.category || null,
      parentId,
      acc.is_system || 0
    ).run();

    codeToId[acc.code] = result.meta.last_row_id;
  }

  return { initialized: true, count: DEFAULT_CHART.length };
}

// ============================================================
// دالة لجلب الحسابات
// ============================================================
export async function getAccounts(env, officeId, type = null) {
  let q = `SELECT * FROM accounts WHERE office_id = ? AND is_active = 1`;
  const binds = [officeId];

  if (type) {
    q += ` AND type = ?`;
    binds.push(type);
  }

  q += ` ORDER BY code`;

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return results || [];
}