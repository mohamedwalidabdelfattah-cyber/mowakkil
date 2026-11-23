// web/js/case-types.js
// أنواع القضايا (لازم تتطابق مع CASE_TYPES في worker/services/legal-skills.js)
import { esc } from './ui.js';

export const CASE_TYPE_GROUPS = [
  { group: 'مدني', types: ['مدني', 'تعويضات', 'عقود (فسخ/تنفيذ/صحة ونفاذ)', 'ملكية وحيازة', 'قسمة', 'إيجارات'] },
  { group: 'جنائي', types: ['جنائي', 'جنح', 'جنايات', 'مخدرات', 'شيكات وإيصالات أمانة', 'جرائم إلكترونية'] },
  { group: 'أحوال شخصية', types: ['أحوال شخصية', 'أسرة', 'نفقات', 'طلاق وخلع', 'حضانة ورؤية', 'مواريث ووصايا'] },
  { group: 'تجاري واقتصادي', types: ['تجاري', 'اقتصادي', 'شركات', 'إفلاس وصلح واقٍ', 'ملكية فكرية وعلامات تجارية'] },
  { group: 'عمالي', types: ['عمالي', 'تأمينات اجتماعية'] },
  { group: 'إداري (مجلس الدولة)', types: ['إداري', 'إلغاء قرار إداري', 'تأديب ووظيفة عامة', 'ضرائب'] },
  { group: 'أخرى', types: ['تنفيذ وإشكالات', 'تحكيم', 'أخرى'] },
];

export function caseTypeOptions(selected = '') {
  const known = CASE_TYPE_GROUPS.some(g => g.types.includes(selected));
  return (selected && !known ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : '') +
    CASE_TYPE_GROUPS.map(g => `
      <optgroup label="${esc(g.group)}">
        ${g.types.map(t => `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </optgroup>`).join('');
}
