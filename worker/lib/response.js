export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ============================================================
// CORS — مع دعم preflight caching
// ============================================================
export function cors(resp, env, request) {
  const allowed = (env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // نجيب الـ Origin من الطلب
  const origin = request?.headers?.get('origin') || '';

  // نحدد الـ origin المسموح — بيقبل نجمة للنطاقات الفرعية (https://*.mowakkil-2026.pages.dev = روابط المعاينة)
  // origin مش مسموح → بنرجّع أول واحد في القايمة، والمتصفح بيرفض الرد (من غير ما نكسر الطلبات اللي مفيهاش Origin)
  const matches = (pat) => {
    if (pat === origin) return true;
    const m = pat.match(/^(https?:\/\/)\*\.(.+)$/);
    return !!(m && origin.startsWith(m[1]) && origin.endsWith('.' + m[2]) && !origin.slice(m[1].length).includes('/'));
  };
  let allowOrigin = '*';
  if (allowed.length === 0 || allowed.includes('*')) {
    allowOrigin = origin || '*';
  } else if (origin && allowed.some(matches)) {
    allowOrigin = origin;
  } else {
    allowOrigin = allowed[0];
  }

  resp.headers.set('access-control-allow-origin', allowOrigin);
  resp.headers.set('access-control-allow-headers', 'content-type,authorization');
  resp.headers.set('access-control-allow-methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  resp.headers.set('access-control-max-age', '86400'); // 24 ساعة
  resp.headers.set('vary', 'Origin');

  return resp;
}

// ============================================================
// Preflight helper — للـ OPTIONS
// ============================================================
export function preflight(env, request) {
  const resp = new Response(null, { status: 204 });
  return cors(resp, env, request);
}

// ============================================================
// Helpers
// ============================================================
export const ok   = (env, data, status = 200, request = null) =>
  cors(json(data, status), env, request);

export const fail = (env, msg, status = 400, extra = {}, request = null) =>
  cors(json({ error: msg, ...extra }, status), env, request);