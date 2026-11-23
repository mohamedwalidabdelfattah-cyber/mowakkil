// worker/services/doc-text.js
// استخراج نص مستندات القضية (المرفوعة على B2 أو القديمة المحفوظة base64 في D1)
// باستخدام Workers AI toMarkdown (مجاني لـ PDF/Word/Excel/HTML — الصور بتستهلك من الحصة المجانية).
// النص بيتخزن في documents.extracted_text (migration 025) عشان منستخرجوش كل مرة.
import { b2Get } from '../lib/b2.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 30000;

function base64ToBytes(b64) {
  const bin = atob(String(b64).replace(/^data:[^,]+,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function guessMime(doc) {
  if (doc.mime_type) return doc.mime_type;
  const ext = String(doc.file_name || '').split('.').pop().toLowerCase();
  return {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  }[ext] || 'application/octet-stream';
}

async function loadBytes(env, doc) {
  if (doc.file_data) return base64ToBytes(doc.file_data);
  const res = await b2Get(env, doc.r2_key);
  if (!res.ok) throw new Error(`تعذر تحميل الملف (${res.status})`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function cleanText(t) {
  return String(t || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function extractOne(env, doc) {
  if ((doc.file_size || 0) > MAX_FILE_BYTES) return { text: '', error: 'الملف أكبر من 10 ميجا' };
  const mime = guessMime(doc);
  if (mime === 'application/msword') return { text: '', error: 'صيغة .doc القديمة غير مدعومة — احفظه PDF أو DOCX' };

  const bytes = await loadBytes(env, doc);
  if (mime.startsWith('text/')) return { text: cleanText(new TextDecoder('utf-8').decode(bytes)) };

  if (!env.AI?.toMarkdown) return { text: '', error: 'خدمة استخراج النص مش متاحة' };
  const [res] = await env.AI.toMarkdown([
    { name: doc.file_name || 'file', blob: new Blob([bytes], { type: mime }) },
  ]);
  if (!res || res.format === 'error') {
    return { text: '', error: res?.error || 'تعذر استخراج النص' };
  }
  const text = cleanText(res.data);
  if (text.replace(/\s/g, '').length < 20) {
    return { text: '', error: 'الملف مفيهوش نص مقروء (غالباً صورة ممسوحة ضوئياً)' };
  }
  return { text };
}

/**
 * بيرجع نص مستندات القضية المختارة.
 * @returns {Promise<Array<{id, file_name, doc_type, text, error?, cached?}>>}
 */
export async function getCaseDocumentsText(env, { officeId, caseId, ids = null, max = 6 }) {
  let rows;
  try {
    rows = (await env.DB.prepare(
      `SELECT id, file_name, doc_type, r2_key, file_data, file_size, mime_type, extracted_text
       FROM documents WHERE case_id = ? AND office_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`
    ).bind(caseId, officeId).all()).results || [];
  } catch {
    // عمود extracted_text لسه مش موجود (migration 025 ما اتطبقتش)
    rows = (await env.DB.prepare(
      `SELECT id, file_name, doc_type, r2_key, file_data, file_size, mime_type
       FROM documents WHERE case_id = ? AND office_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`
    ).bind(caseId, officeId).all()).results || [];
  }

  if (Array.isArray(ids)) {
    const want = new Set(ids.map(Number));
    rows = rows.filter(r => want.has(r.id));
  }
  rows = rows.slice(0, max);

  const out = [];
  for (const doc of rows) {
    if (doc.extracted_text) {
      out.push({ id: doc.id, file_name: doc.file_name, doc_type: doc.doc_type, text: doc.extracted_text, cached: true });
      continue;
    }
    try {
      const { text, error } = await extractOne(env, doc);
      out.push({ id: doc.id, file_name: doc.file_name, doc_type: doc.doc_type, text, error });
      if (text) {
        try {
          await env.DB.prepare(`UPDATE documents SET extracted_text = ? WHERE id = ? AND office_id = ?`)
            .bind(text, doc.id, officeId).run();
        } catch { /* العمود مش موجود — عادي */ }
      }
    } catch (e) {
      console.warn('doc extract failed:', doc.id, e.message);
      out.push({ id: doc.id, file_name: doc.file_name, doc_type: doc.doc_type, text: '', error: e.message });
    }
  }
  return out;
}
