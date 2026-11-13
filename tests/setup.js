// tests/setup.js
import { env, SELF } from 'cloudflare:test';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  // شغّل الـ schema الأساسي
  const schema = await import('fs').then(fs =>
    fs.readFileSync('./schema.sql', 'utf8')
  );
  const migrations = await import('fs').then(fs =>
    fs.readFileSync('./migration_007_security.sql', 'utf8')
  );

  for (const sql of [schema, migrations]) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const s of stmts) {
      try { await env.DB.prepare(s).run(); } catch (e) { /* ignore duplicate */ }
    }
  }
});

export { env, SELF };