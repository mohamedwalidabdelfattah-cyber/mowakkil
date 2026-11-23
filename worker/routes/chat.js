// worker/routes/chat.js
import { ok, fail, cors } from '../lib/response.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { checkAiQuota } from '../lib/ai-quota.js';
import { chatWithAgent } from '../services/agent.js';

export const routes = [
  { method: 'POST',   path: '/api/chat',                          handler: chatHandler },
  { method: 'GET',    path: '/api/chat/sessions',                 handler: listSessions },
  { method: 'GET',    path: /^\/api\/chat\/sessions\/(\d+)$/,     handler: getSession },
  { method: 'DELETE', path: /^\/api\/chat\/sessions\/(\d+)$/,     handler: deleteSession },
];

const MAX_MSG_CHARS = 4000;       // الرسايل القديمة
const MAX_LAST_MSG_CHARS = 12000; // آخر رسالة (ممكن فيها ملف مرفق)

// ============================================================
// POST /api/chat
// ============================================================
async function chatHandler({ request, env, officeId, userId }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return cors(gate, env, request);

  const quota = await checkAiQuota(env, officeId);
  if (quota) return cors(quota, env, request);

  let b;
  try {
    b = await request.json();
  } catch {
    return cors(fail(env, 'JSON غير صالح', 400), env, request);
  }

  if (!b || !Array.isArray(b.messages) || b.messages.length === 0) {
    return cors(fail(env, 'messages مطلوبة', 400), env, request);
  }

  const filtered = b.messages.filter(
    m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );
  const validMessages = filtered.map((m, i) => ({
    role: m.role,
    content: m.content.slice(0, i === filtered.length - 1 ? MAX_LAST_MSG_CHARS : MAX_MSG_CHARS),
  }));

  if (validMessages.length === 0) {
    return cors(fail(env, 'مفيش رسايل صالحة', 400), env, request);
  }

  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.role !== 'user') {
    return cors(fail(env, 'آخر رسالة لازم تكون من المستخدم', 400), env, request);
  }

  const attachmentText = b.attachment_text ? String(b.attachment_text).slice(0, 8000) : null;

  // ✅ لو فيه session_id لازم تكون تبع نفس المكتب
  let sessionId = b.session_id ? Number(b.session_id) : null;
  if (sessionId) {
    const s = await env.DB.prepare(
      `SELECT id FROM chat_sessions WHERE id = ? AND office_id = ?`
    ).bind(sessionId, officeId).first();
    if (!s) sessionId = null;
  }

  let result;
  try {
    result = await chatWithAgent(env, validMessages, officeId, attachmentText);
  } catch (e) {
    console.error('chat error:', e.message);
    return cors(fail(env, e.message || 'فشل الشات', 503), env, request);
  }

  try {
    if (!sessionId) {
      const title = lastMessage.content.split('\n---\n')[0].slice(0, 60) || 'محادثة';
      const ins = await env.DB.prepare(
        `INSERT INTO chat_sessions (office_id, user_id, title) VALUES (?, ?, ?)`
      ).bind(officeId, userId, title).run();
      sessionId = ins.meta.last_row_id;
    }
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)`)
        .bind(sessionId, lastMessage.content),
      env.DB.prepare(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)`)
        .bind(sessionId, result.answer),
      env.DB.prepare(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ? AND office_id = ?`)
        .bind(sessionId, officeId),
    ]);
  } catch (e) {
    console.warn('Save chat failed:', e.message);
  }

  return cors(ok(env, {
    answer: result.answer,
    usedTools: result.usedTools,
    provider: result.provider,
    session_id: sessionId,
  }), env, request);
}

// ============================================================
// GET /api/chat/sessions
// ============================================================
async function listSessions({ env, officeId, request }) {
  const r = await env.DB.prepare(
    `SELECT id, title, created_at, updated_at FROM chat_sessions
     WHERE office_id = ? ORDER BY updated_at DESC LIMIT 50`
  ).bind(officeId).all();
  return cors(ok(env, { items: r.results || [] }), env, request);
}

// ============================================================
// GET /api/chat/sessions/:id
// ============================================================
async function getSession({ env, officeId, params, request }) {
  const id = Number(params[0]);
  const session = await env.DB.prepare(
    `SELECT * FROM chat_sessions WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!session) return cors(fail(env, 'المحادثة مش موجودة', 404), env, request);

  const msgs = await env.DB.prepare(
    `SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC`
  ).bind(id).all();

  return cors(ok(env, { session, messages: msgs.results || [] }), env, request);
}

// ============================================================
// DELETE /api/chat/sessions/:id
// ============================================================
async function deleteSession({ env, officeId, params, request }) {
  const id = Number(params[0]);
  const s = await env.DB.prepare(
    `SELECT id FROM chat_sessions WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!s) return cors(fail(env, 'المحادثة مش موجودة', 404), env, request);

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM chat_messages WHERE session_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM chat_sessions WHERE id = ? AND office_id = ?`).bind(id, officeId),
  ]);
  return cors(ok(env, { deleted: true }), env, request);
}
