// tests/auth.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from './setup.js';

const SETUP_KEY = 'test-setup-key';

beforeEach(async () => {
  env.SETUP_KEY = SETUP_KEY;
  env.JWT_SECRET = 'test-jwt-secret';
  await env.DB.exec('DELETE FROM users; DELETE FROM offices; DELETE FROM super_admins;');
});

describe('auth flow', () => {
  it('setup creates office + admin', async () => {
    const res = await SELF.fetch('https://x/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
      body: JSON.stringify({
        office_name: 'Test Office',
        email: 'admin@test.com',
        password: 'password123',
        full_name: 'Admin',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.office_id).toBeGreaterThan(0);
    expect(body.user_id).toBeGreaterThan(0);
  });

  it('setup locked after first office', async () => {
    await SELF.fetch('https://x/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
      body: JSON.stringify({ office_name: 'O1', email: 'a@a.com', password: 'password123' }),
    });
    const res2 = await SELF.fetch('https://x/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
      body: JSON.stringify({ office_name: 'O2', email: 'b@b.com', password: 'password123' }),
    });
    expect(res2.status).toBe(403);
  });

  it('login returns token', async () => {
    await SELF.fetch('https://x/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
      body: JSON.stringify({ office_name: 'O1', email: 'a@a.com', password: 'password123' }),
    });
    const res = await SELF.fetch('https://x/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@a.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBe('admin');
  });

  it('wrong password returns 401', async () => {
    await SELF.fetch('https://x/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
      body: JSON.stringify({ office_name: 'O1', email: 'a@a.com', password: 'password123' }),
    });
    const res = await SELF.fetch('https://x/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@a.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});