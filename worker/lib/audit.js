export async function audit(env, {
  office_id, user_id, action, entity, entity_id, metadata, request,
}) {
  try {
    const ip = request?.headers?.get('cf-connecting-ip') || null;
    const ua = (request?.headers?.get('user-agent') || '').slice(0, 200) || null;
    await env.DB.prepare(
      `INSERT INTO audit_log (office_id, user_id, action, entity, entity_id, metadata, ip, user_agent)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(
      office_id ?? null,
      user_id   ?? null,
      action,
      entity    ?? null,
      entity_id ?? null,
      metadata  ? JSON.stringify(metadata) : null,
      ip, ua
    ).run();
  } catch (e) {
    console.error('audit failed', e);
  }
}