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
  it('rejects files > 10MB', async () => {
    const token = await bootstrap();
    const big = new Uint8Array(11 * 1024 * 1024);
    const res = await SELF.fetch('https://x/api/documents?file_name=big.pdf', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/pdf',
      },
      body: big,
    });
    expect(res.status).toBe(413);
  });

  it('rejects disallowed extensions', async () => {
    const token = await bootstrap();
    const res = await SELF.fetch('https://x/api/documents?file_name=malware.exe', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/octet-stream',
      },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(415);
  });
});
