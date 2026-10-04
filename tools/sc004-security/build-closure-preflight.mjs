/** Build the exact pre-closure guard from reviewed production and additive metadata. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [publicManifestPath, privateManifestPath] = process.argv.slice(2);
if (!publicManifestPath || !privateManifestPath) {
  throw new Error('Usage: node build-closure-preflight.mjs public-functions.json private-manifest.json');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'docs/backend/sc004-build');
const publicManifest = JSON.parse(fs.readFileSync(publicManifestPath, 'utf8'));
const privateManifest = JSON.parse(fs.readFileSync(privateManifestPath, 'utf8'));
const expectedPublicNames = [
  'sq_sc004_admin', 'sq_sc004_authorize_game', 'sq_sc004_command',
  'sq_sc004_commentary_claim', 'sq_sc004_commentary_commit',
  'sq_sc004_prune_expired_empty', 'sq_sc004_set_hold',
];
if (!Array.isArray(publicManifest) || publicManifest.length !== expectedPublicNames.length ||
    publicManifest.map(f => f.name).sort().join(',') !== expectedPublicNames.sort().join(',')) {
  throw new Error('The seven reviewed public authority functions must match exactly.');
}
const expectedTables = [
  'sc004_admin_audit', 'sc004_admin_requests', 'sc004_admins', 'sc004_commentary_claims',
  'sc004_controllers', 'sc004_public_requests', 'sc004_requests', 'sc004_slots',
  'sc004_training_controls', 'sc004_write_control',
];
if (privateManifest.relations.filter(r => r.kind === 'r').map(r => r.name).sort().join(',') !==
    expectedTables.sort().join(',')) {
  throw new Error('Private authority table set differs from the reviewed additive schema.');
}
const expectedPrivateFunctions = [
  'sc004_append_event', 'sc004_assert_controller', 'sc004_controller_now',
  'sc004_ensure_scores', 'sc004_rename_json', 'sc004_rename_player',
  'sc004_training', 'sc004_validate_rules',
];
if (privateManifest.functions.length !== expectedPrivateFunctions.length ||
    privateManifest.functions.map(f => f.name).sort().join(',') !== expectedPrivateFunctions.sort().join(',') ||
    privateManifest.relations.length !== expectedTables.length + 1 ||
    privateManifest.sequences.length !== 1 || privateManifest.sequences[0].name !== 'sc004_admin_audit_id_seq') {
  throw new Error('Private function or sequence set differs from the reviewed additive schema.');
}
if (privateManifest.sequences.some(s => ['start', 'increment', 'min', 'max', 'cache']
    .some(k => typeof s[k] !== 'string' || !/^-?\d+$/.test(s[k])))) {
  throw new Error('Sequence settings must be lossless integer strings from the reviewed capture query.');
}
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'catalog-expected.json'), 'utf8'));
expected.functions.push(...publicManifest);
let sql = fs.readFileSync(path.join(dir, 'preflight.sql'), 'utf8');
const start = sql.indexOf('$catalog$') + '$catalog$'.length;
const end = sql.indexOf('$catalog$', start);
sql = sql.slice(0, start) + JSON.stringify(expected) + sql.slice(end);
sql = sql.replace('-- Must run before additive gameplay/admin definitions. Fails closed on drift.',
  '-- Run after additive app, Edge, admin and controller proof, immediately before closure.\n' +
  '-- Original production objects and the exact reviewed new public/private authorities must match.');
const capture = fs.readFileSync(path.join(root, 'tools/sc004-security/capture-private-manifest.sql'), 'utf8');
const query = capture.slice(capture.indexOf('SELECT jsonb_build_object(')).trim().replace(/;$/, '');
sql += `\nDO $private_preflight$\nDECLARE expected jsonb := $private_catalog$${JSON.stringify(privateManifest)}$private_catalog$::jsonb; actual jsonb;\nBEGIN\n`;
sql += `  SELECT q.manifest INTO actual FROM (${query}) AS q(manifest);\n`;
sql += `  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'SC004 private authority definition drift'; END IF;\n`;
sql += `  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace\n` +
  `    WHERE n.nspname='private' AND left(c.relname,6)='sc004_' AND c.relkind='r'\n` +
  `      AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')\n` +
  `        OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')))\n` +
  `    THEN RAISE EXCEPTION 'SC004 private authority ACL drift'; END IF;\n`;
sql += `  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace\n` +
  `    WHERE n.nspname='private' AND left(p.proname,6)='sc004_'\n` +
  `      AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')))\n` +
  `    THEN RAISE EXCEPTION 'SC004 private helper ACL drift'; END IF;\n`;
sql += `  IF has_schema_privilege('anon','private','USAGE') OR has_schema_privilege('authenticated','private','USAGE')\n` +
  `    THEN RAISE EXCEPTION 'SC004 private schema ACL drift'; END IF;\nEND $private_preflight$;\n`;
fs.writeFileSync(path.join(dir, 'closure-preflight.sql'), sql);
fs.writeFileSync(path.join(dir, 'new-public-function-expected.json'), JSON.stringify(publicManifest, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'new-private-authority-expected.json'), JSON.stringify(privateManifest, null, 2) + '\n');
console.log(JSON.stringify({ publicFunctions: publicManifest.length, privateTables: expectedTables.length,
  privateFunctions: privateManifest.functions.length }));
