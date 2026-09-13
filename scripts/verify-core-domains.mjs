import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CONTRACT_REL = 'src/core-js-source-contract.json';
const BOOTSTRAP_REL = 'src/core-domain-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';
const INDEX = 'index.html';
const EXPECTED_DOMAINS = 10;
const RUNTIME_REL = 'src/legacy/scripts/inline-005.js';

const abs = (p) => path.join(ROOT, p);
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const fail = (message) => { console.error(`FAIL core-domain verification: ${message}`); process.exit(1); };
const readText = (file) => {
  if (!fs.existsSync(abs(file))) fail(`missing ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
};

function syntaxCheck(file) {
  try {
    execFileSync(process.execPath, ['--check', abs(file)], { stdio: 'pipe' });
  } catch (error) {
    const detail = error?.stderr?.toString?.() || error?.message || String(error);
    fail(`JavaScript syntax check failed for ${file}:\n${detail}`);
  }
}

function safeRel(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} path is missing`);
  const unix = value.replaceAll('\\', '/');
  const normalized = path.posix.normalize(unix);
  if (normalized !== unix || normalized.startsWith('../') || normalized.startsWith('/')) {
    fail(`${label} path is unsafe or non-canonical: ${value}`);
  }
  return normalized;
}

function validateDomainShape(domain, index, seen) {
  if (!domain || domain.order !== index + 1) fail(`non-contiguous domain order at position ${index + 1}`);
  if (typeof domain.owner !== 'string' || !domain.owner) fail(`missing domain owner at position ${index + 1}`);
  if (typeof domain.marker !== 'string' || !domain.marker.startsWith('@SEC:JS:')) {
    fail(`invalid domain marker at position ${index + 1}`);
  }
  if (!Number.isInteger(domain.occurrence) || domain.occurrence < 1) {
    fail(`invalid marker occurrence at position ${index + 1}`);
  }
  const file = safeRel(domain.file, 'domain');
  if (!file.startsWith('src/')) fail(`domain must remain under src/: ${file}`);
  const allowed = [
    'src/app/',
    'src/live-game/',
    'src/game/',
    'src/services/',
    'src/ui/',
    'src/legacy/quarantine/',
  ];
  if (!allowed.some((prefix) => file.startsWith(prefix))) fail(`domain is outside approved source roots: ${file}`);
  if (seen.has(file)) fail(`duplicate domain file: ${file}`);
  seen.add(file);
}

function verifyActiveContract() {
  const contract = JSON.parse(readText(CONTRACT_REL));
  if (contract.schemaVersion !== 1) fail(`unsupported source contract schema ${contract.schemaVersion}`);
  if (contract.authority !== 'semantic-js-source') fail(`unexpected JS source authority ${contract.authority}`);
  if (contract.generatedBy !== 'scripts/build-core-js-from-source.mjs') fail('unexpected JS source generator');
  if (safeRel(contract.runtimeTarget, 'runtimeTarget') !== RUNTIME_REL) fail('unexpected JS compatibility runtime');
  if (!Array.isArray(contract.domains) || contract.domains.length !== EXPECTED_DOMAINS) {
    fail(`expected exactly ${EXPECTED_DOMAINS} semantic core domains`);
  }
  if (contract.domainCount !== contract.domains.length) fail('source contract domainCount mismatch');

  const seen = new Set();
  const ordered = [...contract.domains].sort((a, b) => a.order - b.order);
  ordered.forEach((domain, index) => {
    validateDomainShape(domain, index, seen);
    const text = readText(domain.file);
    if (!text.includes(domain.marker)) fail(`${domain.file} missing canonical marker ${domain.marker}`);
    syntaxCheck(domain.file);
  });

  const runtime = readText(contract.runtimeTarget);
  const assembled = ordered.map((domain) => readText(domain.file)).join('');
  if (assembled !== runtime) fail('semantic JS domains do not concatenate byte-for-byte to the generated classic runtime');
  syntaxCheck(contract.runtimeTarget);

  const migration = JSON.parse(readText(MIGRATION_MANIFEST));
  const migrationEntry = (migration.scripts || []).find((item) => item.file === contract.runtimeTarget);
  if (!migrationEntry) fail('generated JS runtime missing from legacy migration provenance manifest');

  const index = readText(INDEX);
  const escaped = contract.runtimeTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refs = index.match(new RegExp(escaped, 'g')) || [];
  if (refs.length !== 1) fail(`index.html must reference ${contract.runtimeTarget} exactly once; found ${refs.length}`);

  console.log(`PASS core-domain verification: ${ordered.length} semantic JS sources own generated runtime ${contract.runtimeTarget}`);
  console.log(`runtime sha256 ${sha256(runtime)}`);
}

function verifyBootstrapManifest() {
  const manifest = JSON.parse(readText(BOOTSTRAP_REL));
  if (manifest.schemaVersion !== 1) fail(`unsupported domain manifest schema ${manifest.schemaVersion}`);
  if (manifest.generatedBy !== 'scripts/split-core-domains.mjs') fail('unexpected bootstrap domain generator');
  if (manifest.strategy !== 'semantic-source-byte-identical-classic-runtime') fail('unexpected domain strategy');
  if (!Array.isArray(manifest.domains) || manifest.domains.length !== EXPECTED_DOMAINS) {
    fail(`expected exactly ${EXPECTED_DOMAINS} semantic core domains`);
  }

  const seen = new Set();
  const ordered = [...manifest.domains].sort((a, b) => a.order - b.order);
  ordered.forEach((domain, index) => {
    validateDomainShape(domain, index, seen);
    const text = readText(domain.file);
    if (!text.includes(domain.marker)) fail(`${domain.file} missing canonical marker ${domain.marker}`);
    if (sha256(text) !== domain.sha256) fail(`${domain.file} differs from bootstrap evidence`);
    syntaxCheck(domain.file);
  });

  const runtime = readText(manifest.runtimeTarget);
  const assembled = ordered.map((domain) => readText(domain.file)).join('');
  if (assembled !== runtime) fail('bootstrap semantic domains do not concatenate byte-for-byte to classic runtime');
  if (sha256(runtime) !== manifest.runtimeSha256) fail('bootstrap runtime hash differs from manifest');
  syntaxCheck(manifest.runtimeTarget);

  const migration = JSON.parse(readText(MIGRATION_MANIFEST));
  const migrationEntry = (migration.scripts || []).find((item) => item.file === manifest.runtimeTarget);
  if (!migrationEntry) fail('bootstrap runtime missing from legacy migration manifest');
  if (migrationEntry.sha256 !== sha256(runtime)) fail('legacy migration manifest runtime hash is stale at bootstrap');

  const index = readText(INDEX);
  const escaped = manifest.runtimeTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refs = index.match(new RegExp(escaped, 'g')) || [];
  if (refs.length !== 1) fail(`index.html must reference ${manifest.runtimeTarget} exactly once; found ${refs.length}`);

  console.log(`PASS core-domain bootstrap verification: ${ordered.length} source domains, byte-identical runtime ${manifest.runtimeTarget}`);
  console.log(`runtime sha256 ${sha256(runtime)}`);
}

if (fs.existsSync(abs(CONTRACT_REL))) {
  verifyActiveContract();
} else {
  verifyBootstrapManifest();
}
