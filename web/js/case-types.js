// web/js/case-types.js
// أنواع القضايا (لازم تتطابق مع CASE_TYPES في worker/services/legal-skills.js) + درجات التقاضي
import { esc } from './ui.js';

export const CASE_TYPE_GROUPS = [
  { group: 'مدني', types: ['مدني', 'تعويضات', 'عقود (فسخ/تنفيذ/صحة ونفاذ)', 'صحة توقيع', 'ملكية وحيازة', 'طرد للغصب وريع', 'قسمة', 'إيجارات', 'نزع ملكية للمنفعة العامة'] },
  { group: 'جنائي', types: ['جنائي', 'جنح', 'جنايات', 'مخدرات', 'شيكات وإيصالات أمانة', 'تبديد وخيانة أمانة', 'سب وقذف', 'ضرب وإصابة', 'سرقة', 'نصب واحتيال', 'تزوير', 'قتل', 'أموال عامة', 'جنح مرور', 'جرائم إلكترونية'] },
  { group: 'أحوال شخصية', types: ['أحوال شخصية', 'أسرة', 'نفقات', 'طلاق وخلع', 'حضانة ورؤية', 'تمكين من مسكن الزوجية', 'إثبات نسب', 'مواريث ووصايا', 'ولاية على المال', 'أحوال شخصية لغير المسلمين'] },
  { group: 'تجاري واقتصادي', types: ['تجاري', 'اقتصادي', 'شركات', 'بنوك وقروض', 'أوراق تجارية', 'إفلاس وصلح واقٍ', 'حماية المستهلك', 'ملكية فكرية وعلامات تجارية'] },
  { group: 'عمالي', types: ['عمالي', 'فصل تعسفي', 'تأمينات اجتماعية'] },
  { group: 'إداري (مجلس الدولة)', types: ['إداري', 'إلغاء قرار إداري', 'عقود إدارية', 'تسويات ومستحقات وظيفية', 'تأديب ووظيفة عامة', 'ضرائب', 'جمارك'] },
  { group: 'أخرى', types: ['تنفيذ وإشكالات', 'أوامر أداء وعرائض', 'تحكيم', 'دستوري', 'صلح وتسوية ودية', 'أخرى'] },
];

// درجات / مراحل التقاضي
export const DEGREE_GROUPS = [
  { group: 'مدني وتجاري', items: ['جزئي', 'ابتدائي', 'استئناف', 'نقض', 'التماس إعادة النظر'] },
  { group: 'جنائي', items: ['تحقيقات النيابة', 'جنح', 'جنح مستأنفة', 'جنايات', 'جنايات مستأنفة', 'نقض جنائي', 'إعادة نظر'] },
  { group: 'محاكم متخصصة', items: ['محكمة الأسرة', 'استئناف الأسرة', 'اقتصادية ابتدائية', 'اقتصادية استئنافية', 'محكمة عمالية'] },
  { group: 'مجلس الدولة', items: ['هيئة مفوضي الدولة', 'محكمة إدارية', 'قضاء إداري', 'إدارية عليا', 'محكمة تأديبية'] },
  { group: 'أخرى', items: ['دستورية عليا', 'قاضي التنفيذ', 'تحكيم', 'صلح / ما قبل التقاضي', 'أخرى'] },
];

export function caseTypeOptions(selected = '') {
  const known = CASE_TYPE_GROUPS.some(g => g.types.includes(selected));
  return (selected && !known ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : '') +
    CASE_TYPE_GROUPS.map(g => `
      <optgroup label="${esc(g.group)}">
        ${g.types.map(t => `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </optgroup>`).join('');
}

export function degreeOptions(selected = 'ابتدائي') {
  const known = DEGREE_GROUPS.some(g => g.items.includes(selected));
  return (selected && !known ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : '') +
    DEGREE_GROUPS.map(g => `
      <optgroup label="${esc(g.group)}">
        ${g.items.map(t => `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </optgroup>`).join('');
}
