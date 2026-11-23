// worker/lib/doc-categories.js
// تصنيفات المستندات (لازم تتطابق مع web/js/attachments.js)
// folder = اسم الفولدر في التخزين (Backblaze) عشان الملفات تبقى مترتبة

export const DOC_CATEGORIES = [
  { label: 'توكيل',                folder: 'power-of-attorney' },
  { label: 'صحيفة دعوى',           folder: 'pleadings' },
  { label: 'مذكرة دفاع',           folder: 'memos' },
  { label: 'حكم / قرار',           folder: 'judgments' },
  { label: 'محضر',                 folder: 'reports' },
  { label: 'عقد',                  folder: 'contracts' },
  { label: 'إنذار / إعلان',        folder: 'notices' },
  { label: 'مستند ملكية',          folder: 'ownership' },
  { label: 'تقرير خبير / طبي',     folder: 'expert-reports' },
  { label: 'مستندات شخصية',        folder: 'identity' },
  { label: 'إيصال / فاتورة',       folder: 'receipts' },
  { label: 'مراسلات',              folder: 'correspondence' },
  { label: 'صور وأدلة',            folder: 'evidence' },
  { label: 'أخرى',                 folder: 'other' },
];

const BY_LABEL = new Map(DOC_CATEGORIES.map(c => [c.label, c]));

export function normalizeDocType(t) {
  const s = String(t || '').trim();
  return BY_LABEL.has(s) ? s : 'أخرى';
}

export function folderFor(docType) {
  return (BY_LABEL.get(docType) || BY_LABEL.get('أخرى')).folder;
}
