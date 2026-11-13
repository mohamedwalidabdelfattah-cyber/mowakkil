// worker/routes/chat.js
import { ok, fail, cors } from '../lib/response.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { chatWithAgent } from '../services/agent.js';

export const routes = [
  { method: 'OPTIONS', path: '/api/chat', handler: handleOptions },
  { method: 'POST', path: '/api/chat', handler: chatHandler },
];

async function handleOptions({ env, request }) {
  return cors(new Response(null, { status: 204 }), env, request);
}

async function chatHandler({ request, env, officeId }) {
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

  // نتحقق إن كل الرسايل شكلها صح
  const validMessages = b.messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (validMessages.length === 0) {
    return cors(fail(env, 'مفيش رسايل صالحة', 400), env, request);
  }

  // نحدد آخر رسالة (لازم تكون من المستخدم)
  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.role !== 'user') {
    return cors(fail(env, 'آخر رسالة لازم تكون من المستخدم', 400), env, request);
  }

  try {
    const result = await chatWithAgent(env, validMessages, officeId);
    return cors(ok(env, {
      answer: result.answer,
      usedTools: result.usedTools,
      iterations: result.iterations,
    }), env, request);
  } catch (e) {
    console.error('chat error:', e.message);
    return cors(fail(env, 'فشل الشات: ' + e.message, 500), env, request);
  }
}