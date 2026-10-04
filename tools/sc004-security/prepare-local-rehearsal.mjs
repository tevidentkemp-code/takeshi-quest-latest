/** Prepare isolated SQL files only; never connects to or mutates a database. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const [evidenceDir] = process.argv.slice(2);
if (!evidenceDir) throw new Error('Usage: node prepare-local-rehearsal.mjs AUDIT_BUILD_DIR');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(root, 'docs/backend/sc004-build');
const adaptation = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'local-preflight-adaptation.json'), 'utf8'));
const inspectedChanges = [
  ['public.player_round_win_by_window_v', '36d0cd443069f1a2a1e9917a8f30fd13', '40652f6d46dbeeecbf3faf44253e83e9'],
  ['public.v_misfire_events', 'a9a70f6a0358573cbf154f2be9703bba', '1d723ea0f5812e2c963489551642a386'],
];
if (adaptation.changes.length !== inspectedChanges.length || adaptation.changes.some((c, i) =>
    [c.view, c.production_md5, c.local_md5].join(',') !== inspectedChanges[i].join(','))) {
  throw new Error('Only the two previously inspected local PostgreSQL deparser equivalents are allowed.');
}
function localGuard(sql) {
  const start = sql.indexOf('$catalog$') + '$catalog$'.length;
  const end = sql.indexOf('$catalog$', start);
  const expected = JSON.parse(sql.slice(start, end));
  for (const [qualifiedName, productionHash, localHash] of inspectedChanges) {
    const found = expected.views.find(v => v.schema + '.' + v.name === qualifiedName);
    if (!found || found.definition_md5 !== productionHash) throw new Error('Production view hash changed: ' + qualifiedName);
    if (sql.split(productionHash).length !== 2) throw new Error('View hash is not unique: ' + qualifiedName);
    sql = sql.replace(productionHash, localHash);
  }
  return '-- LOCAL REHEARSAL ONLY: two inspected deparser equivalents; production guard unchanged.\n' + sql;
}
const hash = value => createHash('sha256').update(value).digest('hex');
const migrations = [
  { file: '20261003161850_sc004_scoped_authority_additive.sql', output: 'local-additive-rehearsal.sql',
    sources: ['preflight.sql', 'gameplay.sql', 'lifecycle.sql', 'admin-command.sql', 'commentary-authority.sql'] },
  { file: '20261003161851_sc004_close_legacy_mutation.sql', output: 'local-closure-rehearsal.sql',
    sources: ['closure-preflight.sql', 'closure.sql'] },
];
const receipts = [];
for (const migration of migrations) {
  const original = fs.readFileSync(path.join(root, 'supabase/migrations', migration.file), 'utf8');
  const expected = 'BEGIN;\n' + migration.sources.map(f => fs.readFileSync(path.join(sourceDir, f), 'utf8')).join('\n') + '\nCOMMIT;\n';
  if (original !== expected) throw new Error('CLI migration differs from reviewed sources: ' + migration.file);
  const local = localGuard(original);
  fs.writeFileSync(path.join(evidenceDir, migration.output), local);
  receipts.push({ migration: migration.file, production_sha256: hash(original),
    localFile: migration.output, local_sha256: hash(local), viewHashSubstitutions: inspectedChanges });
}
fs.writeFileSync(path.join(evidenceDir, 'local-preflight.sql'),
  localGuard(fs.readFileSync(path.join(sourceDir, 'preflight.sql'), 'utf8')));
fs.writeFileSync(path.join(evidenceDir, 'local-migration-rehearsal-manifest.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), productionFilesModified: false, receipts }, null, 2) + '\n');
console.log(JSON.stringify({ target: 'isolated SC004 local stack only', databaseConnections: 0,
  productionGuardsChanged: false, localViewAdaptations: inspectedChanges.length }));
