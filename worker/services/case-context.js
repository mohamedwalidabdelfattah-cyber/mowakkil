// worker/services/case-context.js
// سياق قضية للمساعد القانوني: بياناتها + الجلسات + المهام + مقتطفات من مستنداتها + آخر التحليلات + المستندات المحفوظة.
// بيرجّع كمان أسماء الأطراف عشان الـ masker يخفيها قبل ما توصل لأي مزود ذكاء اصطناعي.
import { getCaseDocumentsText } from './doc-text.js';

const DOCS_BUDGET = 6000;   // مقتطفات المستندات (الشات محتاج مساحة للأسئلة والإجابات)
const clip = (s, n) => { s = String(s || '').replace(/\s+\n/g, '\n').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

export async function buildCaseContext(env, officeId, caseId) {
  const c = await env.DB.prepare(
    `SELECT c.*, cl.name AS client_name FROM cases c LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ? AND c.office_id = ? AND c.deleted_at IS NULL`
  ).bind(caseId, officeId).first();
  if (!c) return null;

  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then(r => r.results || []).catch(() => []);
  const [sessions, tasks, analyses, saved] = await Promise.all([
    q(`SELECT session_date, notes FROM sessions WHERE case_id = ? ORDER BY session_date DESC LIMIT 12`, caseId),
    q(`SELECT title, status, due_date FROM tasks WHERE case_id = ? AND office_id = ? ORDER BY id DESC LIMIT 12`, caseId, officeId),
    q(`SELECT type, title, result_json, created_at FROM analyses WHERE office_id = ? AND (case_id = ? OR (type = 'case_ai' AND file_name = ?)) ORDER BY id DESC LIMIT 3`, officeId, caseId, `case:${caseId}`),
    q(`SELECT title, created_at FROM generated_documents WHERE office_id = ? AND case_id = ? ORDER BY id DESC LIMIT 8`, officeId, caseId),
  ]);

  let docsText = '';
  try {
    const docs = (await getCaseDocumentsText(env, { officeId, caseId, max: 4 })).filter(d => d.text);
    const per = docs.length ? Math.floor(DOCS_BUDGET / docs.length) : 0;
    docsText = docs.map(d => `• ${d.file_name}${d.doc_type ? ' (' + d.doc_type + ')' : ''}:\n${clip(d.text, per)}`).join('\n\n');
  } catch (e) { console.warn('case context docs failed:', e.message); }

  const analysesText = analyses.map(a => {
    let r = {}; try { r = JSON.parse(a.result_json || '{}'); } catch {}
    const bits = [r.summary, r.success_probability && `فرص النجاح: ${r.success_probability}`,
      Array.isArray(r.next_steps) && r.next_steps.length && `الخطوات: ${r.next_steps.slice(0, 4).join('؛ ')}`].filter(Boolean);
    return `• ${a.title || a.type} (${String(a.created_at || '').slice(0, 10)}): ${clip(bits.join(' — '), 700)}`;
  }).join('\n');

  const lines = [
    `رقم القضية: ${c.case_number || '—'} · المحكمة: ${c.court || '—'}${c.degree ? ' · الدرجة: ' + c.degree : ''}`,
    `النوع: ${c.case_type || '—'} · الحالة: ${c.status || '—'}`,
    `الموكل: ${c.client_name || '—'}${c.client_role ? ' (صفته: ' + c.client_role + ')' : ''} · الخصم: ${c.opponent_name || '—'}`,
    c.subject && `موضوع الدعوى: ${clip(c.subject, 600)}`,
    c.claim_amount && `قيمة الدعوى: ${c.claim_amount}`,
  ].filter(Boolean);

  const text = `===== القضية اللي المحامي بيسأل عنها =====
${lines.join('\n')}
${sessions.length ? `\nالجلسات (الأحدث أولاً):\n${sessions.map(s => `- ${s.session_date}${s.notes ? ': ' + clip(s.notes, 300) : ''}`).join('\n')}` : ''}
${tasks.length ? `\nالمهام:\n${tasks.map(t => `- ${t.title} (${t.status || '—'}${t.due_date ? '، موعدها ' + t.due_date : ''})`).join('\n')}` : ''}
${analysesText ? `\nتحليلات سابقة:\n${analysesText}` : ''}
${saved.length ? `\nمستندات اتكتبت للقضية: ${saved.map(s => s.title).join('، ')}` : ''}
${docsText ? `\nمقتطفات من مستندات القضية:\n${docsText}` : ''}
===== نهاية بيانات القضية =====
استخدم بيانات القضية دي في إجابتك، ووضّح لو المعلومة مش موجودة في الملف بدل ما تفترضها.`;

  return { text: text.replace(/\n{3,}/g, '\n\n'), names: [c.client_name, c.opponent_name].filter(Boolean), caseNumber: c.case_number };
}
