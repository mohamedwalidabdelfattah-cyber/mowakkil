// worker/lib/crypto.js

export function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function b64urlToBuf(str) {
  if (!str) return null;
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

export const strToBuf = s => new TextEncoder().encode(s);
export const bufToStr = b => new TextDecoder().decode(b);

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ✅ hashPassword — مبسّط وموثوق
export async function hashPassword(password, saltB64 = null, iterations = 100000) {
  // نولّد salt جديد لو مش موجود
  let saltBytes;
  if (saltB64 && saltB64.length > 0) {
    saltBytes = b64urlToBuf(saltB64);
    if (!saltBytes) {
      saltBytes = crypto.getRandomValues(new Uint8Array(16));
    }
  } else {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
  }

  // نستورد الباسورد كـ key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    strToBuf(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // نحسب الـ hash
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    hash: b64url(bits),
    salt: b64url(saltBytes),
  };
}

// ✅ verifyPassword — يقارن بشكل موثوق
export async function verifyPassword(password, hash, salt) {
  if (!hash || hash === 'PENDING' || !salt) return false;
  
  try {
    const r = await hashPassword(password, salt, 100000);
    return timingSafeEqual(r.hash, hash);
  } catch (e) {
    console.error('verifyPassword error:', e.message);
    return false;
  }
}