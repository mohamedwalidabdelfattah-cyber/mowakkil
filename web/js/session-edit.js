// web/js/session-edit.js
// تعديل / حذف جلسة — مشترك بين ملف القضية (النافذة والصفحة) والأجندة.
import { apiJson } from './api.js';
import { openModal } from './modal.js';
import { toast, esc } from './ui.js';
import { can } from './access.js';

export const canEditSession = () => can('agenda.edit');
export const canDeleteSession = () => can('agenda.delete');

/** أزرار تعديل/حذف لجلسة جوه أي قايمة (بتتربط بـ bindSessionActions) */
export function sessionActionsHTML(s) {
  const edit = canEditSession() ? `<button class="btn btn-ghost btn-sm" data-session-edit="${s.id}">✏️ تعديل</button>` : '';
  const del = canDeleteSession() ? `<button class="btn btn-ghost btn-sm" data-session-del="${s.id}" style="color:var(--danger)">🗑 حذف</button>` : '';
  return edit || del ? `<div class="session-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${edit}${del}</div>` : '';
}

/** يربط أزرار القايمة: sessions = نفس الداتا اللي اترسمت، onDone = إعادة التحميل */
export function bindSessionActions(root, sessions, onDone) {
  const find = id => sessions.find(x => String(x.id) === String(id));
  root.querySelectorAll('[data-session-edit]').forEach(b => b.addEventListener('click', () => {
    const s = find(b.dataset.sessionEdit); if (s) editSession(s, onDone);
  }));
  root.querySelectorAll('[data-session-del]').forEach(b => b.addEventListener('click', () => {
    const s = find(b.dataset.sessionDel); if (s) deleteSession(s, onDone);
  }));
}

export async function editSession(s, onDone) {
  const saved = await openModal({
    title: '✏️ تعديل الجلسة',
    submitText: 'حفظ التعديل',
    fields: [
      { name: 'session_date', label: 'تاريخ الجلسة', type: 'date', required: true },
      { name: 'session_time', label: 'الساعة (الرول)', type: 'time' },
      { name: 'notes', label: 'ملاحظات / قرار الجلسة', type: 'textarea' },
    ],
    initialData: {
      session_date: String(s.session_date || s.date || '').slice(0, 10),
      session_time: s.session_time || s.time || '',
      notes: s.notes || '',
    },
    onSubmit: async (d) => {
      await apiJson(`/api/sessions/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ session_date: d.session_date, session_time: d.session_time || null, notes: d.notes || null }),
      });
    },
  });
  if (saved) { toast('✅ اتعدّلت الجلسة', 'ok'); await onDone?.(); }
}

export async function deleteSession(s, onDone) {
  const day = String(s.session_date || s.date || '').slice(0, 10);
  if (!confirm(`متأكد إنك عاوز تحذف جلسة ${day}؟\nمش هتقدر ترجّعها.`)) return;
  try {
    await apiJson(`/api/sessions/${s.id}`, { method: 'DELETE' });
    toast('✅ اتحذفت الجلسة', 'ok');
    await onDone?.();
  } catch (e) {
    toast(esc(e.message), 'bad');
  }
}
