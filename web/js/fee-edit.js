// web/js/fee-edit.js
// تعديل الأتعاب (المبلغ وتاريخ الاستحقاق والملاحظات) — مشترك بين صفحة الأتعاب وملف القضية.
// السيرفر بيعيد قيد الأتعاب في الحسابات بنفس تاريخه، ومش بيسمح بمبلغ أقل من اللي اتدفع.
import { apiJson } from './api.js';
import { openModal } from './modal.js';
import { toast, cur } from './ui.js';
import { can } from './access.js';

export const canEditFee = () => can('fees.edit');

export async function editFee(f, onDone) {
  const saved = await openModal({
    title: '✏️ تعديل الأتعاب',
    submitText: 'حفظ التعديل',
    fields: [
      { name: 'amount_due', label: `المبلغ المتفق عليه (${cur()})`, type: 'number', required: true },
      { name: 'due_date', label: 'تاريخ الاستحقاق', type: 'date' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
    initialData: { amount_due: f.amount_due, due_date: String(f.due_date || '').slice(0, 10), notes: f.notes || '' },
    onSubmit: async (d) => {
      await apiJson(`/api/fees/${f.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amount_due: Number(d.amount_due), due_date: d.due_date || null, notes: d.notes || null }),
      });
    },
  });
  if (saved) { toast('✅ اتعدّلت الأتعاب', 'ok'); await onDone?.(); }
}
