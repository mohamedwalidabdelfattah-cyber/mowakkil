import { b64url, b64urlToBuf, strToBuf, bufToStr } from './crypto.js';

const TTL_SECONDS = 60 * 60 * 24 * 14;

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + TTL_SECONDS };

  const unsigned =
    b64url(strToBuf(JSON.stringify(header))) + '.' +
    b64url(strToBuf(JSON.stringify(body)));

  const key = await crypto.subtle.importKey(
    'raw', strToBuf(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, strToBuf(unsigned));
  return unsigned + '.' + b64url(sig);
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;

    const key = await crypto.subtle.importKey(
      'raw', strToBuf(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, b64urlToBuf(s), strToBuf(h + '.' + p)
    );
    if (!valid) return null;

    const payload = JSON.parse(bufToStr(b64urlToBuf(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}