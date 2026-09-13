import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DOMAIN_MANIFEST = 'src/core-domain-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';
const INDEX = 'index.html';

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

const domainManifest = JSON.parse(readText(DOMAIN_MANIFEST));
if (domainManifest.schemaVersion !== 1) fail(`unsupported domain manifest schema ${domainManifest.schemaVersion}`);
if (domainManifest.strategy !== 'semantic-source-byte-identical-classic-runtime') fail('unexpected domain strategy');
if (!Array.isArray(domainManifest.domains) || domainManifest.domains.length !== 10) fail('expected exactly 10 semantic core domains');

const ordered = [...domainManifest.domains].sort((a, b) => a.order - b.order);
ordered.forEach((domain, index) => {
  if (domain.order !== index + 1) fail(`non-contiguous domain order at ${domain.file}`);
  const text = readText(domain.file);
  if (!text.includes(domain.marker)) fail(`${domain.file} missing canonical marker ${domain.marker}`);
  if (sha256(text) !== domain.sha256) fail(`${domain.file} hash differs from domain manifest; rerun split-core-domains.mjs`);
  syntaxCheck(domain.file);
});

const runtime = readText(domainManifest.runtimeTarget);
const assembled = ordered.map((domain) => readText(domain.file)).join('');
if (assembled !== runtime) fail('semantic domains do not concatenate byte-for-byte to the generated classic runtime');
if (sha256(runtime) !== domainManifest.runtimeSha256) fail('runtime hash differs from domain manifest');
syntaxCheck(domainManifest.runtimeTarget);

const migration = JSON.parse(readText(MIGRATION_MANIFEST));
const migrationEntry = (migration.scripts || []).find((item) => item.file === domainManifest.runtimeTarget);
if (!migrationEntry) fail('generated runtime missing from legacy migration manifest');
if (migrationEntry.sha256 !== sha256(runtime)) fail('legacy migration manifest runtime hash is stale');

const index = readText(INDEX);
const escaped = domainManifest.runtimeTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refs = index.match(new RegExp(escaped, 'g')) || [];
if (refs.length !== 1) fail(`index.html must reference ${domainManifest.runtimeTarget} exactly once; found ${refs.length}`);

console.log(`PASS core-domain verification: ${ordered.length} source domains, byte-identical runtime ${domainManifest.runtimeTarget}`);
console.log(`runtime sha256 ${sha256(runtime)}`);
