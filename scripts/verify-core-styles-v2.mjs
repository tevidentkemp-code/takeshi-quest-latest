import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const ROOT = process.cwd();
const MANIFEST = 'src/styles/core-source-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';
const EXPECTED_DOMAIN_COUNT = 27;
const MAX_DOMAIN_BYTES = 60000;
const EXPECTED_RUNTIME_SHA256 = '8e1e1fc4716c47d5207784100e235f80ae5b8e7f18caecac322deda5f9ce5ada';
const EXPECTED_RUNTIME_BYTES = 284342;

const abs = (p) => path.join(ROOT, p);
const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const byteLength = (value) => Buffer.byteLength(value, 'utf8');

function fail(message){
  console.error(`SC-031 core CSS verification FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message){ if(!condition) fail(message); }
function read(file){
  if(!fs.existsSync(abs(file))) fail(`missing required file ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
}
function parseCss(text, file){
  try { postcss.parse(text, {from:file}); }
  catch(error){ fail(`CSS parse failed for ${file}: ${error?.message || error}`); }
}
function safeSemanticPath(file){
  assert(typeof file === 'string' && file.startsWith('src/styles/'), `unexpected semantic CSS path ${String(file)}`);
  const resolved = path.resolve(ROOT, file);
  const allowed = path.resolve(ROOT, 'src/styles');
  assert(resolved.startsWith(`${allowed}${path.sep}`), `semantic CSS path escapes src/styles: ${file}`);
}

const manifest = JSON.parse(read(MANIFEST));
assert(manifest.schemaVersion === 2, `unexpected manifest schema ${manifest.schemaVersion}`);
assert(manifest.generatedBy === 'scripts/split-core-styles-v2.mjs', 'unexpected manifest generator');
assert(manifest.strategy === '27-semantic-sources-byte-identical-compatibility-runtime', 'unexpected CSS split strategy');
assert(manifest.stage === 'semantic-source-ownership', 'unexpected CSS migration stage');
assert(manifest.runtimeBytes === EXPECTED_RUNTIME_BYTES, 'runtime byte contract changed');
assert(manifest.runtimeSha256 === EXPECTED_RUNTIME_SHA256, 'runtime hash contract changed');
assert(manifest.domainCount === EXPECTED_DOMAIN_COUNT, `expected ${EXPECTED_DOMAIN_COUNT} domains, got ${manifest.domainCount}`);
assert(Array.isArray(manifest.domains) && manifest.domains.length === EXPECTED_DOMAIN_COUNT,
  `manifest must contain exactly ${EXPECTED_DOMAIN_COUNT} domains`);

const seenFiles = new Set();
const parts = [];
let expectedStart = 0;
for(let index=0; index<manifest.domains.length; index+=1){
  const domain = manifest.domains[index];
  assert(domain.order === index + 1, `non-contiguous domain order at ${domain.file}`);
  assert(typeof domain.owner === 'string' && domain.owner.length > 0, `missing owner for ${domain.file}`);
  safeSemanticPath(domain.file);
  assert(!seenFiles.has(domain.file), `duplicate semantic CSS path ${domain.file}`);
  seenFiles.add(domain.file);
  assert(domain.startOffset === expectedStart, `offset gap/overlap before ${domain.file}`);
  assert(Number.isInteger(domain.endOffset) && domain.endOffset > domain.startOffset, `invalid end offset for ${domain.file}`);

  const text = read(domain.file);
  const bytes = byteLength(text);
  assert(bytes === domain.bytes, `byte count mismatch for ${domain.file}: ${bytes} vs ${domain.bytes}`);
  assert(bytes <= MAX_DOMAIN_BYTES, `${domain.file} exceeds ${MAX_DOMAIN_BYTES}-byte domain budget (${bytes})`);
  assert(sha256(text) === domain.sha256, `hash mismatch for ${domain.file}`);
  if(domain.anchor !== null){
    assert(typeof domain.anchor === 'string' && domain.anchor.startsWith('/*'), `invalid anchor for ${domain.file}`);
    assert(text.startsWith(domain.anchor), `${domain.file} no longer begins at its protected anchor`);
  } else {
    assert(index === 0, 'only the first domain may omit an anchor');
  }
  parseCss(text, domain.file);
  parts.push(text);
  expectedStart = domain.endOffset;
}

const runtime = read(manifest.runtimeTarget);
assert(expectedStart === runtime.length, `domain offsets end at ${expectedStart}, runtime length is ${runtime.length}`);
const rebuilt = parts.join('');
assert(rebuilt === runtime, 'semantic CSS source does not reconstruct runtime exactly');
assert(byteLength(runtime) === EXPECTED_RUNTIME_BYTES, `runtime byte count mismatch: ${byteLength(runtime)}`);
assert(sha256(runtime) === EXPECTED_RUNTIME_SHA256, `runtime hash mismatch: ${sha256(runtime)}`);
parseCss(runtime, manifest.runtimeTarget);

const migration = JSON.parse(read(MIGRATION_MANIFEST));
const migrationEntry = (migration.styles || []).find(entry => entry.file === manifest.runtimeTarget);
assert(migrationEntry, `runtime ${manifest.runtimeTarget} missing from migration manifest`);
assert(migrationEntry.sha256 === EXPECTED_RUNTIME_SHA256, 'migration manifest runtime hash is stale');

const largest = [...manifest.domains].sort((a,b) => b.bytes - a.bytes)[0];
console.log(`SC-031 core CSS verification PASS: ${EXPECTED_DOMAIN_COUNT} ordered semantic domains reconstruct ${EXPECTED_RUNTIME_BYTES} bytes exactly.`);
console.log(`runtime sha256 ${EXPECTED_RUNTIME_SHA256}`);
console.log(`largest domain ${largest.file}: ${largest.bytes} bytes (budget ${MAX_DOMAIN_BYTES})`);
