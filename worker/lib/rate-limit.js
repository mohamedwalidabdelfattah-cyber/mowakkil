export async function checkRateLimit(env, key, max, windowSec) {
  if (!env.RATE_LIMIT_KV) return true;

  const now = Math.floor(Date.now() / 1000);
  const bucket = `rl:${key}:${Math.floor(now / windowSec)}`;

  const current = parseInt((await env.RATE_LIMIT_KV.get(bucket)) || '0', 10);
  if (current >= max) return false;

  await env.RATE_LIMIT_KV.put(bucket, String(current + 1), { expirationTtl: windowSec });
  return true;
}