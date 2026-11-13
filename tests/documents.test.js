// tests/documents.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from './setup.js';

const SETUP_KEY = 'test-setup-key';

beforeEach(async () => {
  env.SETUP_KEY = SETUP_KEY;
  env.JWT_SECRET = 'test-jwt-secret';
  await env.DB.exec('DELETE FROM users; DELETE FROM offices; DELETE FROM documents;');
});

async function bootstrap() {
  await SELF.fetch('https://x/api/auth/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
    body: JSON.stringify({ office_name: 'O', email: 'a@a.com', password: 'password123' }),
  });
  const r = await SELF.fetch('https://x/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@a.com', password: 'password123' }),
  });
  return (await r.json()).token;
}

describe('document upload', () => {
  it('rejects files > 25MB', async () => {
    const token = await bootstrap();
    const big = new Uint8Array(26 * 1024 * 1024);
    const fd = new FormData();
    fd.append('file', new File([big], 'big.pdf', { type: 'application/pdf' }));
    const res = await SELF.fetch('https://x/api/documents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
      body: fd,
    });
    expect(res.status).toBe(413);
  });

  it('rejects disallowed extensions', async () => {
    const token = await bootstrap();
    const fd = new FormData();
    fd.append('file', new File(['x'], 'malware.exe', { type: 'application/octet-stream' }));
    const res = await SELF.fetch('https://x/api/documents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
      body: fd,
    });
    expect(res.status).toBe(415);
  });
});