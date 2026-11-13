// worker/routes/chat.js
import { ok, fail, cors } from '../lib/response.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { chatWithAgent } from '../services/agent.js';

export const routes = [
  { method: 'OPTIONS', path: '/api/chat', handler: handleOptions },
  { method: 'POST', path: '/api/chat', handler: chatHandler },
  { method: 'GET', path: '/api/chat/sessions', handler: listSessions },
  { method: 'GET', path: '/api/chat/sessions/:id', handler: getSession },
  { method: 'DELETE', path: '/api/chat/sessions/:id', handler: deleteSession },
];

async function handleOptions({ env, request }) {
  return cors(new Response(null, { status: 204 }), env, request);
}

// ============================================================
// POST /api/chat
// ============================================================
async function chatHandler({ request, env, officeId, userId }) {
  const gate = await requireFeature(env, officeId, 'ai');
  if (gate) return cors(gate, env, request);

  let b;
  try {
    b = await request.json();
  } catch (e) {
    return cors(fail(env, 'JSON غير صالح', 400), env, request);
  }

  if (!b || !Array.isArray(b.messages) || b.messages.length === 0) {
    return cors(fail(env, 'messages مطلوبة', 400), env, request);
  }

  const validMessages = b.messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (validMessages.length === 0) {
    return cors(fail(env, 'مفيش رسايل صالحة', 400), env, request);
  }

  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.role !== 'user') {
    return cors(fail(env, 'آخر رسالة لازم تكون من المستخدم', 400), env, request);
  }

  const attachmentText = b.attachment_text ? String(b.attachment_text).slice(0, 5000) : null;
  const sessionId = b.session_id ? Number(b.session_id) : null;

  try {
    const result = await chatWithAgent(env, validMessages, officeId, attachmentText);

    // حفظ في D1
    let savedSessionId = sessionId;
    try {
      if (!savedSessionId) {
        // إنشاء session جديد
        const title = lastMessage.content.slice(0, 60);
        const ins = await env.DB.prepare(
          `INSERT INTO chat_sessions (office_id, user_id, title) VALUES (?, ?, ?)`
        ).bind(officeId, userId, title).run();
        savedSessionId = ins.meta.last_row_id;
      }

      // حفظ رسالة المستخدم
      await env.DB.prepare(
        `INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`
      ).bind(savedSessionId, 'user', lastMessage.content).run();

      // حفظ رد الـ AI
      await env.DB.prepare(
        `INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`
      ).bind(savedSessionId, 'assistant', result.answer).run();

      // تحديث updated_at
      await env.DB.prepare(
        `UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`
      ).bind(savedSessionId).run();
    } catch (e) {
      console.warn('Save chat failed:', e.message);
    }

    return cors(ok(env, {
      answer: result.answer,
      usedTools: result.usedTools,
      provider: result.provider,
      session_id: savedSessionId,
    }), env, request);
  } catch (e) {
    console.error('chat error:', e.message);
    return cors(fail(env, 'فشل الشات: ' + e.message, 500), env, request);
  }
}

// ============================================================
// GET /api/chat/sessions
// ============================================================
async function listSessions({ env, officeId, request }) {
  try {
    const r = await env.DB.prepare(
      `SELECT id, title, created_at, updated_at FROM chat_sessions
       WHERE office_id = ? ORDER BY updated_at DESC LIMIT 50`
    ).bind(officeId).all();
    return cors(ok(env, { items: r.results || [] }), env, request);
  } catch (e) {
    return cors(fail(env, 'فشل جلب المحادثات: ' + e.message, 500), env, request);
  }
}

// ============================================================
// GET /api/chat/sessions/:id
// ============================================================
async function getSession({ env, officeId, params, request }) {
  const id = Number(params.id);
  if (!id) return cors(fail(env, 'id غلط', 400), env, request);

  try {
    const session = await env.DB.prepare(
      `SELECT * FROM chat_sessions WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();

    if (!session) return cors(fail(env, 'الجلسة مش موجودة', 404), env, request);

    const msgs = await env.DB.prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE session_id = ? ORDER BY id ASC`
    ).bind(id).all();

    return cors(ok(env, {
      session,
      messages: msgs.results || [],
    }), env, request);
  } catch (e) {
    return cors(fail(env, 'فشل جلب الجلسة: ' + e.message, 500), env, request);
  }
}

// ============================================================
// DELETE /api/chat/sessions/:id
// ============================================================
async function deleteSession({ env, officeId, params, request }) {
  const id = Number(params.id);
  if (!id) return cors(fail(env, 'id غلط', 400), env, request);

  try {
    await env.DB.prepare(
      `DELETE FROM chat_messages WHERE session_id IN
        (SELECT id FROM chat_sessions WHERE id = ? AND office_id = ?)`
    ).bind(id, officeId).run();

    await env.DB.prepare(
      `DELETE FROM chat_sessions WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).run();

    return cors(ok(env, { deleted: true }), env, request);
  } catch (e) {
    return cors(fail(env, 'فشل الحذف: ' + e.message, 500), env, request);
  }
}