// worker/routes/documents.js
// المستندات — Worker يرفع الملف إلى B2 مباشرة (aws4fetch)

import { ok, fail, cors } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt } from '../lib/validation.js';
import { b2Put, b2Get, b2Delete } from '../lib/b2.js';
import { requireStorage } from '../middleware/feature-gate.js';
import { normalizeDocType, folderFor, DOC_CATEGORIES } from '../lib/doc-categories.js';
import { safeJson } from '../lib/validation.js';
import { canAccessCase } from '../lib/permissions.js';

const DEVICE_PREFIX = 'device:';
const isDevice = doc => String(doc?.r2_key || '').startsWith(DEVICE_PREFIX);

// ============================================================
// ملف متخزن على كمبيوتر المكتب: السيرفر بيسجّل بياناته بس (الاسم/النوع/المكان)
// والملف نفسه مش بيوصلنا ومش بيتحسب من مساحة الباقة
// ============================================================
async function registerDeviceFile({ request, env, authUser, officeId, access }) {
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  const case_id = toInt(b.case_id) || null;
  const task_id = toInt(b.task_id) || null;
  const file_name = String(b.file_name || '').trim().slice(0, 200);
  const device_path = String(b.device_path || '').trim().slice(0, 500);
  const device_label = String(b.device_label || 'كمبيوتر المكتب').trim().slice(0, 60);
  if (!file_name || !device_path) return fail(env, 'بيانات الملف ناقصة', 400);
  if (device_path.includes('..')) return fail(env, 'مسار غلط', 400);

  if (case_id) {
    const c = await env.DB.prepare(`SELECT id FROM cases WHERE id = ? AND office_id = ? AND deleted_at IS NULL`).bind(case_id, officeId).first();
    if (!c || !(await canAccessCase(env, access, authUser, case_id))) return fail(env, 'القضية مش موجودة', 400);
  }
  if (task_id) {
    const t = await env.DB.prepare(`SELECT id FROM tasks WHERE id = ? AND office_id = ?`).bind(task_id, officeId).first();
    if (!t) return fail(env, 'المهمة مش موجودة', 400);
  }

  const doc_type = normalizeDocType(b.doc_type);
  const notes = String(b.notes || '').trim().slice(0, 500) || null;
  const file_size = Math.max(0, toInt(b.file_size) || 0);
  const mime_type = String(b.mime_type || 'application/octet-stream').slice(0, 100);
  const r = await env.DB.prepare(
    `INSERT INTO documents (office_id, case_id, task_id, doc_type, file_name, r2_key, uploaded_by, file_size, mime_type, notes, storage, device_label)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'device', ?)`
  ).bind(officeId, case_id, task_id, doc_type, file_name, DEVICE_PREFIX + device_path, authUser.user_id, file_size, mime_type, notes, device_label).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id, action: 'create', entity: 'document',
    entity_id: r.meta.last_row_id, request, metadata: { file_name, storage: 'device', device_label },
  });
  return ok(env, { id: r.meta.last_row_id, storage: 'device' }, 201);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 ميجا
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt'];

export const routes = [
  { method: 'POST',   path: '/api/documents',                      handler: upload },
  { method: 'POST',   path: '/api/documents/device',               handler: registerDeviceFile },
  { method: 'GET',    path: '/api/documents',                      handler: list },
  { method: 'GET',    path: '/api/documents/categories',           handler: categories },
  { method: 'GET',    path: /^\/api\/documents\/(\d+)\/download$/, handler: download },
  { method: 'PATCH',  path: /^\/api\/documents\/(\d+)$/,           handler: update },
  { method: 'DELETE', path: /^\/api\/documents\/(\d+)$/,           handler: remove },
];

async function categories({ env }) {
  return ok(env, DOC_CATEGORIES.map(c => c.label));
}

// مفتاح التخزين مترتب: office_X/cases/<id>/<نوع المستند>/... أو tasks/<id>/... أو general/...
function storageKey(officeId, { caseId, taskId, docType, fileName }) {
  const owner = caseId ? `cases/${caseId}` : taskId ? `tasks/${taskId}` : 'general';
  const dot = fileName.lastIndexOf('.');
  const ext = dot > -1 ? fileName.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const base = (dot > -1 ? fileName.slice(0, dot) : fileName)
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return `office_${officeId}/${owner}/${folderFor(docType)}/${Date.now()}_${base}${ext}`;
}

// ============================================================
// Upload
// ============================================================
async function upload({ request, env, authUser, officeId }) {
  const url = new URL(request.url);
  const case_id = toInt(url.searchParams.get('case_id'));
  const task_id = toInt(url.searchParams.get('task_id'));
  const doc_type = normalizeDocType(url.searchParams.get('doc_type'));
  const notes = String(url.searchParams.get('notes') || '').trim().slice(0, 500) || null;
  const file_name = (url.searchParams.get('file_name') || 'unknown').trim().slice(0, 200);
  const content_type = request.headers.get('content-type') || 'application/octet-stream';

  const lower = file_name.toLowerCase();
  if (!ALLOWED_EXT.some(ext => lower.endsWith(ext))) {
    return fail(env, 'نوع الملف غير مسموح', 415);
  }

  if (case_id) {
    const c = await env.DB.prepare(
      `SELECT id FROM cases WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
    ).bind(case_id, officeId).first();
    if (!c) return fail(env, 'القضية مش موجودة', 400);
  }
  if (task_id) {
    const t = await env.DB.prepare(
      `SELECT id FROM tasks WHERE id = ? AND office_id = ?`
    ).bind(task_id, officeId).first();
    if (!t) return fail(env, 'المهمة مش موجودة', 400);
  }

  let buffer;
  try {
    buffer = await request.arrayBuffer();
  } catch (e) {
    console.error('read request body failed:', e);
    return fail(env, 'فشل قراءة الملف', 400);
  }

  const fileSize = buffer.byteLength;
  if (fileSize === 0) return fail(env, 'الملف فاضي', 400);
  if (fileSize > MAX_FILE_SIZE) {
    return fail(env, `الملف أكبر من ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)} ميجا`, 413);
  }

  const storageErr = await requireStorage(env, officeId, fileSize);
  if (storageErr) return storageErr;

  const r2_key = storageKey(officeId, { caseId: case_id, taskId: task_id, docType: doc_type, fileName: file_name });

  try {
    await b2Put(env, r2_key, buffer, content_type);
  } catch (e) {
    console.error('B2 upload failed:', e);
    return fail(env, `فشل رفع الملف للتخزين: ${e.message || 'unknown'}`, 500);
  }

  try {
    const binds = [officeId, case_id, task_id, doc_type, file_name, r2_key, authUser.user_id, fileSize, content_type];
    let r;
    try {
      r = await env.DB.prepare(
        `INSERT INTO documents
          (office_id, case_id, task_id, doc_type, file_name, r2_key, uploaded_by, file_size, mime_type, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(...binds, notes).run();
    } catch (e) {
      if (!/notes/.test(e.message)) throw e;
      // عمود notes لسه مش موجود (migration 026)
      r = await env.DB.prepare(
        `INSERT INTO documents
          (office_id, case_id, task_id, doc_type, file_name, r2_key, uploaded_by, file_size, mime_type)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(...binds).run();
    }

    await audit(env, {
      office_id: officeId, user_id: authUser.user_id,
      action: 'create', entity: 'document', entity_id: r.meta.last_row_id, request,
    });

    return ok(env, {
      id: r.meta.last_row_id,
      file_name,
      file_size: fileSize,
      doc_type,
    }, 201);

  } catch (e) {
    console.error('D1 insert failed', e);
    // ما يفضلش ملف يتيم في B2
    try { await b2Delete(env, r2_key); } catch (_) {}
    return fail(env, 'فشل حفظ بيانات الملف', 500);
  }
}

// ============================================================
// List
// ============================================================
async function list({ env, officeId, url }) {
  const caseId = toInt(url.searchParams.get('case_id'));
  const taskId = toInt(url.searchParams.get('task_id'));

  const build = withNotes => {
    let q = `SELECT d.id, d.case_id, d.task_id, d.doc_type, d.file_name, d.uploaded_by,
                    d.created_at, d.file_size, d.mime_type${withNotes ? ', d.notes, d.device_label' : ''},
                    CASE WHEN d.r2_key LIKE 'device:%' THEN 'device' ELSE 'cloud' END AS storage,
                    CASE WHEN d.r2_key LIKE 'device:%' THEN SUBSTR(d.r2_key, 8) ELSE NULL END AS device_path,
                    u.full_name AS uploaded_by_name
             FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
             WHERE d.office_id = ? AND d.deleted_at IS NULL`;
    const binds = [officeId];
    if (caseId) { q += ` AND d.case_id = ?`; binds.push(caseId); }
    if (taskId) { q += ` AND d.task_id = ?`; binds.push(taskId); }
    q += ` ORDER BY d.created_at DESC`;
    return env.DB.prepare(q).bind(...binds);
  };

  let results;
  try {
    ({ results } = await build(true).all());
  } catch {
    ({ results } = await build(false).all());
  }
  return ok(env, results || []);
}

// ============================================================
// Update (تغيير النوع / الاسم / الملاحظة) — البيانات بس، الملف نفسه مش بيتغير
// ============================================================
async function update({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const doc = await env.DB.prepare(
    `SELECT id FROM documents WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(id, officeId).first();
  if (!doc) return fail(env, 'المستند مش موجود', 404);

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const sets = [];
  const binds = [];
  if (b.doc_type !== undefined) { sets.push('doc_type = ?'); binds.push(normalizeDocType(b.doc_type)); }
  if (b.file_name !== undefined) {
    const name = String(b.file_name).trim().slice(0, 200);
    if (!name) return fail(env, 'اسم الملف مطلوب', 400);
    sets.push('file_name = ?'); binds.push(name);
  }
  const wantNotes = b.notes !== undefined;
  if (!sets.length && !wantNotes) return fail(env, 'مفيش تغييرات', 400);

  if (sets.length) {
    await env.DB.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ? AND office_id = ?`)
      .bind(...binds, id, officeId).run();
  }
  if (wantNotes) {
    try {
      await env.DB.prepare(`UPDATE documents SET notes = ? WHERE id = ? AND office_id = ?`)
        .bind(String(b.notes || '').trim().slice(0, 500) || null, id, officeId).run();
    } catch (e) {
      console.warn('notes update skipped (migration 026 not applied):', e.message);
    }
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'document', entity_id: id, request,
  });
  return ok(env, { updated: true });
}

// ============================================================
// Download
// ============================================================
async function download({ env, officeId, params }) {
  const id = toInt(params[0]);
  const doc = await env.DB.prepare(
    `SELECT * FROM documents WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(id, officeId).first();
  if (!doc) return fail(env, 'not found', 404);

  // ملف على كمبيوتر المكتب: السيرفر معندوش الملف — الواجهة بتفتحه من الفولدر لو على نفس الجهاز
  if (isDevice(doc)) {
    return fail(env, `الملف ده متخزن على «${doc.device_label || 'كمبيوتر المكتب'}» — افتحه من الجهاز ده`, 409,
      { code: 'DEVICE_FILE', device_label: doc.device_label, device_path: doc.r2_key.slice(DEVICE_PREFIX.length) });
  }

  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`;

  // ملفات قديمة متخزنة base64 جوه D1
  if (doc.file_data) {
    const bin = atob(String(doc.file_data).replace(/^data:[^,]+,/, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return cors(new Response(bytes, {
      headers: { 'content-type': doc.mime_type || 'application/octet-stream', 'content-disposition': disposition },
    }), env);
  }
  if (!doc.r2_key) return fail(env, 'الملف مش موجود في التخزين', 404);

  try {
    const obj = await b2Get(env, doc.r2_key);
    if (!obj.ok) {
      console.error('B2 download status:', obj.status);
      return fail(env, 'الملف مش موجود في التخزين', obj.status === 404 ? 404 : 500);
    }

    return cors(new Response(obj.body, {
      headers: {
        'content-type': doc.mime_type || 'application/octet-stream',
        'content-disposition': disposition,
        ...(doc.file_size ? { 'content-length': String(doc.file_size) } : {}),
      },
    }), env);

  } catch (e) {
    console.error('B2 download exception:', e);
    return fail(env, 'فشل تحميل الملف', 500);
  }
}

// ============================================================
// Remove
// ============================================================
async function remove({ request, env, authUser, officeId, params }) {
  const id = toInt(params[0]);
  const doc = await env.DB.prepare(
    `SELECT id, r2_key, uploaded_by, file_name FROM documents
     WHERE id = ? AND office_id = ? AND deleted_at IS NULL`
  ).bind(id, officeId).first();
  if (!doc) return fail(env, 'المستند مش موجود', 404);

  // الحذف لمسؤول المكتب أو اللي رفع الملف بس
  if (authUser.role !== 'admin' && doc.uploaded_by !== authUser.user_id) {
    return fail(env, 'الحذف مسموح لمسؤول المكتب أو اللي رفع الملف بس', 403);
  }

  // الملفات القديمة المحفوظة في D1 (d1_...) مش موجودة في B2
  if (doc.r2_key && !doc.r2_key.startsWith('d1_') && !isDevice(doc)) {
    try {
      await b2Delete(env, doc.r2_key);
    } catch (e) {
      console.error('B2 delete exception:', e);
      return fail(env, 'فشل حذف الملف من التخزين، جرب تاني', 502);
    }
  }

  // soft delete + نفضي البيانات التقيلة (الملف القديم base64 لو موجود)
  await env.DB.prepare(
    `UPDATE documents SET deleted_at = datetime('now'), file_data = NULL WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).run();

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'delete', entity: 'document', entity_id: id, request,
    metadata: { file_name: doc.file_name },
  });
  return ok(env, { deleted: true });
}