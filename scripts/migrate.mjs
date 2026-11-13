// scripts/migrate.mjs
// الاستخدام:
//   node scripts/migrate.mjs migration_007_security.sql mowakkil-db --remote
//   node scripts/migrate.mjs migration_007_security.sql mowakkil-db          (local)

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const file = process.argv[2];
const dbName = process.argv[3] || 'mowakkil-db';
const isRemote = process.argv.includes('--remote');

if (!file) {
  console.error('Usage: node scripts/migrate.mjs <sql-file> [db-name] [--remote]');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');
const statements = sql
  .split(/;\s*(?:\r?\n|$)/)
  .map(s => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean);

const remoteFlag = isRemote ? '--remote' : '--local';
let applied = 0, skipped = 0, failed = 0;

for (const stmt of statements) {
  const tmp = path.join(os.tmpdir(), `mowakkil-mig-${Date.now()}-${Math.random()}.sql`);
  fs.writeFileSync(tmp, stmt + ';');
  try {
    execSync(`wrangler d1 execute ${dbName} ${remoteFlag} --file=${tmp}`, { stdio: 'pipe' });
    console.log('✓', stmt.slice(0, 70).replace(/\s+/g, ' '));
    applied++;
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    if (/duplicate column name|already exists|duplicate key/i.test(out)) {
      console.log('⊘', stmt.slice(0, 70).replace(/\s+/g, ' '));
      skipped++;
    } else {
      console.error('✗', stmt.slice(0, 70).replace(/\s+/g, ' '));
      console.error('  ' + out.split('\n').slice(0, 4).join('\n  '));
      failed++;
    }
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

console.log(`\n— applied=${applied} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);