// web/js/config.js
// إعدادات عامة + مفاتيح التخزين

export const STORAGE_KEYS = {
  TOKEN:  'mowakkil_token',
  ROLE:   'mowakkil_role',
  OFFICE: 'mowakkil_office',
  SA_TOKEN: 'mowakkil_sa_token',
  LOGO_PENDING: 'mowakkil_logo_pending',
  SUBSCRIPTION: 'mowakkil_subscription',
};

export const API_BASE = 'https://mowakkil-api.mohamed-walid-abdelfattah.workers.dev';

export const DEFAULT_TRIAL_DAYS = 15;

export const FEATURE_KEYS = {
  FINANCE: 'finance',
  INVOICES: 'invoices',
  AI: 'ai',
  ADVANCED_REPORTS: 'advanced_reports',
  WHATSAPP: 'whatsapp',
  MULTI_OFFICE: 'multi_office',
  API: 'api',
};

export const PLAN_LABELS = {
  free: 'المجانية',
  starter: 'الأساسية',
  pro: 'الاحترافية',
  plus: 'المتقدمة',
};

export const PLAN_PRICES = {
  free: 0,
  starter: 199,
  pro: 399,
  plus: 799,
};