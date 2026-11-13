// tests/tenancy.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from './setup.js';

const SETUP_KEY = 'test-setup-key';

async function makeOffice(name, email) {
  await env.DB.exec('DELETE FROM users; DELETE FROM offices;');
  const r = await SELF.fetch('https://x/api/auth/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-setup-key': SETUP_KEY },
    body: JSON.stringify({ office_name: name, email, password: 'password123' }),
  });
  const d = await r.json();
  const login = await SELF.fetch('https://x/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const { token } = await login.json();
  return { office_id: d.office_id, token };
}

beforeEach(async () => {
  env.SETUP_KEY = SETUP_KEY;
  env.JWT_SECRET = 'test-jwt-secret';
});

describe('multi-tenancy isolation', () => {
  it('office A cannot see office B clients', async () => {
    const a = await makeOffice('A', 'a@a.com');

    // A ينشئ client
    await SELF.fetch('https://x/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + a.token },
      body: JSON.stringify({ name: 'Client A' }),
    });

    // نعمل office B يدويًا (بعد ما نمسح setup lock)
    await env.DB.prepare(`INSERT INTO offices (name, status) VALUES ('B', 'active')`).run();
    const offB = await env.DB.prepare(`SELECT id FROM offices WHERE name='B'`).first();
    const { hashPassword } = await import('../worker/lib/crypto.js');
    const { hash, salt } = await hashPassword('password123');
    await env.DB.prepare(
      `INSERT INTO users (office_id, email, password_hash, salt, role) VALUES (?,?,?,?,?)`
    ).bind(offB.id, 'b@b.com', hash, salt, 'admin').run();

    const loginB = await SELF.fetch('https://x/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'b@b.com', password: 'password123' }),
    });
    const { token: tokenB } = await loginB.json();

    // B يشوف القائمة — لازم تكون فاضية
    const listB = await SELF.fetch('https://x/api/clients', {
      headers: { authorization: 'Bearer ' + tokenB },
    });
    const list = await listB.json();
    expect(list).toEqual([]);
  });

  it('office A cannot delete office B client', async () => {
    const a = await makeOffice('A', 'a@a.com');

    // create client for A
    const cr = await SELF.fetch('https://x/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + a.token },
      body: JSON.stringify({ name: 'Client A' }),
    });
    const { id: clientA } = await cr.json();

    // create office B user
    await env.DB.prepare(`INSERT INTO offices (name, status) VALUES ('B', 'active')`).run();
    const offB = await env.DB.prepare(`SELECT id FROM offices WHERE name='B'`).first();
    const { hashPassword } = await import('../worker/lib/crypto.js');
    const { hash, salt } = await hashPassword('password123');
    await env.DB.prepare(
      `INSERT INTO users (office_id, email, password_hash, salt, role) VALUES (?,?,?,?,?)`
    ).bind(offB.id, 'b2@b.com', hash, salt, 'admin').run();
    const loginB = await SELF.fetch('https://x/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'b2@b.com', password: 'password123' }),
    });
    const { token: tokenB } = await loginB.json();

    // B يحاول يمسح client A
    const del = await SELF.fetch(`https://x/api/clients/${clientA}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + tokenB },
    });
    expect(del.status).toBe(404); // ← مش 200

    // A لسه شايفه
    const listA = await SELF.fetch('https://x/api/clients', {
      headers: { authorization: 'Bearer ' + a.token },
    });
    const list = await listA.json();
    expect(list.length).toBe(1);
  });

  it('office_id in body is ignored — always uses JWT', async () => {
    const a = await makeOffice('A', 'a@a.com');
    const cr = await SELF.fetch('https://x/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + a.token },
      body: JSON.stringify({ name: 'Injected', office_id: 999 }),
    });
    const { id } = await cr.json();

    // الدور على الـ DB مباشرة
    const row = await env.DB.prepare(`SELECT office_id FROM clients WHERE id = ?`).bind(id).first();
    expect(row.office_id).toBe(a.office_id);
  });
});