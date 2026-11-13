// worker/routes/documents.js
// المستندات — مخزّنة في D1 مؤقتًا

import { ok, fail, cors } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt } from '../lib/validation.js';

const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5 ميجا (حد D1)
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt'];

// ============================================================
// Helper: Uint8Array → base64
// ============================================================
function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================
// Routes
// ============================================================
export const routes = [
  { method: 'POST',   path: '/api/documents',                             handler: upload },
  { method: 'GET',    path: '/api/documents',                             handler: list },
  { method: 'GET',    path: /^\/api\/documents\/(\d+)\/download$/,        handler: download },
  { method: 'DELETE', path: /^\/api\/documents\/(\d+)$/,                  handler: remove },
];

async function upload({ request, env, authUser, officeId }) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return fail(env, 'مفيش ملف مرفق', 400);
  if (file.size > MAX_FILE_SIZE) {
    return fail(env, `الملف أكبر من ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)} ميجا — جرّب ملف أصغر`, 413);
  }

  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXT.some(ext => lower.endsWith(ext))) {
    return fail(env, 'نوع الملف غير مسموح', 415);
  }

  const case_id = toInt(form.get('case_id'));
  const task_id = toInt(form.get('task_id'));
  const doc_type = String(form.get('doc_type') || 'أخرى').slice(0, 50);

  if (case_id) {
    const c = await env.DB.prepare(
      `SELECT id FROM cases WHERE id = ? AND office_id = ?`
    ).bind(case_id, officeId).first();
    if (!c) return fail(env, 'القضية مش موجودة', 400);
  }
  if (task_id) {
    const t = await env.DB.prepare(
      `SELECT id FROM tasks WHERE id = ? AND office_id = ?`
    ).bind(task_id, officeId).first();
    if (!t) return fail(env, 'المهمة مش موجودة', 400);
  }

  // نقرا الملف كـ ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // نحوّله base64
  let base64;
  try {
    base64 = bytesToBase64(bytes);
  } catch (e) {
    console.error('base64 encode failed', e);
    return fail(env, 'فشل معالجة الملف', 500);
  }

  // نخزّنه في D1
  try {
    const r = await env.DB.prepare(
      `INSERT INTO documents
        (office_id, case_id, task_id, doc_type, file_name, r2_key, uploaded_by, file_data, file_size, mime_type)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      officeId, case_id, task_id, doc_type,
      file.name.slice(0, 200),
      `d1_${Date.now()}`,  // r2_key وهمي (للتوافق)
      authUser.user_id,
      base64,
      file.size,
      file.type || 'application/octet-stream'
    ).run();

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'create', entity: 'document', entity_id: r.meta.last_row_id, request,
    });

    return ok(env, {
      id: r.meta.last_row_id,
      file_name: file.name,
      file_size: file.size,
    }, 201);

  } catch (e) {
    console.error('D1 insert failed', e);
    return fail(env, 'فشل تخزين الملف — ممكن يكون كبير على D1', 500);
  }
}

async function list({ env, officeId, url }) {
  const caseId = toInt(url.searchParams.get('case_id'));
  const taskId = toInt(url.searchParams.get('task_id'));

  // مش بنرجّع file_data (ضخم)
  let q = `SELECT id, office_id, case_id, task_id, doc_type, file_name,
                  r2_key, uploaded_by, created_at, deleted_at, file_size, mime_type
           FROM documents WHERE office_id = ? AND deleted_at IS NULL`;
  const binds = [officeId];
  if (caseId) { q += ` AND case_id = ?`; binds.push(caseId); }
  if (taskId) { q += ` AND task_id = ?`; binds.push(taskId); }
  q += ` ORDER BY created_at DESC`;

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results);
}

async function download({ env, officeId, params }) {
  const id = toInt(params[0]);
  const doc = await env.DB.prepare(
    `SELECT * FROM documents WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(id, officeId).first();
  if (!doc) return fail(env, 'not found', 404);
  if (!doc.file_data) return fail(env, 'الملف مش موجود في التخزين', 404);

  let bytes;
  try {
    bytes = base64ToBytes(doc.file_data);
  } catch (e) {
    console.error('base64 decode failed', e);
    return fail(env, 'فشل قراءة الملف', 500);
  }

  return cors(new Response(bytes, {
    headers: {
      'content-type': doc.mime_type || 'application/octet-stream',
      'content-disposition': `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
      'content-length': String(bytes.length),
    },
  }), env);
}

async function remove({ env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const doc = await env.DB.prepare(
    `SELECT * FROM documents WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!doc) return fail(env, 'not found', 404);

  // نمسح file_data الأول (عشان يفضي مساحة)، بعدها نعمل soft delete
  await env.DB.prepare(
    `UPDATE documents
     SET deleted_at = datetime('now'), file_data = NULL
     WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'document', entity_id: id,
  });
  return ok(env, { deleted: true });
}