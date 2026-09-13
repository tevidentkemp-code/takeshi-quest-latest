import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const ROOT = process.cwd();
const CONTRACT = 'src/styles/core-source-contract.json';
const BOOTSTRAP = 'src/styles/core-source-manifest.json';
const EXPECTED_DOMAINS = 27;
const MAX_DOMAIN_BYTES = 60000;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const byteLength = value => Buffer.byteLength(value, 'utf8');
const abs = rel => path.resolve(ROOT, rel);

function fail(message) {
  console.error(`SC-031 core CSS verification FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) { if (!condition) fail(message); }
function read(rel) {
  const resolved = abs(rel);
  const prefix = `${path.resolve(ROOT)}${path.sep}`;
  assert(resolved.startsWith(prefix), `path escapes repository root: ${rel}`);
  assert(fs.existsSync(resolved), `missing required file ${rel}`);
  return fs.readFileSync(resolved, 'utf8');
}
function parseCss(text, file) {
  try { postcss.parse(text, { from: file }); }
  catch (error) { fail(`CSS parse failed for ${file}: ${error?.message || error}`); }
}
function safeDomainPath(file) {
  assert(typeof file === 'string' && file.startsWith('src/styles/'), `unexpected semantic CSS path ${String(file)}`);
  const resolved = abs(file);
  const allowed = `${abs('src/styles')}${path.sep}`;
  assert(resolved.startsWith(allowed), `semantic CSS path escapes src/styles: ${file}`);
}

const sourceFirst = fs.existsSync(abs(CONTRACT));
const manifest = JSON.parse(read(sourceFirst ? CONTRACT : BOOTSTRAP));

let runtimeTarget;
let domains;
if (sourceFirst) {
  assert(manifest.schemaVersion === 1, `unexpected source contract schema ${manifest.schemaVersion}`);
  assert(manifest.authority === 'semantic-css-source', `unexpected CSS authority ${manifest.authority}`);
  assert(manifest.generatedBy === 'scripts/build-core-styles-from-source.mjs', 'unexpected CSS source generator');
  runtimeTarget = manifest.runtimeTarget;
  domains = manifest.domains;
} else {
  assert(manifest.schemaVersion === 2, `unexpected bootstrap manifest schema ${manifest.schemaVersion}`);
  assert(manifest.generatedBy === 'scripts/split-core-styles-v2.mjs', 'unexpected bootstrap manifest generator');
  assert(manifest.strategy === '27-semantic-sources-byte-identical-compatibility-runtime', 'unexpected bootstrap CSS strategy');
  assert(manifest.stage === 'semantic-source-ownership', 'unexpected bootstrap CSS stage');
  runtimeTarget = manifest.runtimeTarget;
  domains = manifest.domains;
}

assert(Array.isArray(domains) && domains.length === EXPECTED_DOMAINS,
  `expected ${EXPECTED_DOMAINS} CSS domains, got ${Array.isArray(domains) ? domains.length : 'invalid'}`);
assert(manifest.domainCount === EXPECTED_DOMAINS, `manifest domainCount must be ${EXPECTED_DOMAINS}`);
assert(typeof runtimeTarget === 'string' && runtimeTarget === 'src/legacy/styles/inline-002.css',
  `unexpected compatibility runtime ${runtimeTarget}`);

const seen = new Set();
const parts = [];
for (let index = 0; index < domains.length; index += 1) {
  const domain = domains[index];
  assert(domain.order === index + 1, `non-contiguous domain order at ${domain.file}`);
  assert(typeof domain.owner === 'string' && domain.owner, `missing owner for ${domain.file}`);
  safeDomainPath(domain.file);
  assert(!seen.has(domain.file), `duplicate semantic CSS path ${domain.file}`);
  seen.add(domain.file);

  const text = read(domain.file);
  const size = byteLength(text);
  assert(size > 0, `empty semantic CSS source ${domain.file}`);
  assert(size <= MAX_DOMAIN_BYTES, `${domain.file} exceeds ${MAX_DOMAIN_BYTES}-byte domain budget (${size})`);
  if (domain.anchor !== null) {
    assert(typeof domain.anchor === 'string' && domain.anchor.startsWith('/*'), `invalid anchor for ${domain.file}`);
    assert(text.startsWith(domain.anchor), `${domain.file} no longer begins at its protected anchor`);
  } else {
    assert(index === 0, 'only the first CSS domain may omit an anchor');
  }
  parseCss(text, domain.file);

  if (!sourceFirst) {
    assert(size === domain.bytes, `bootstrap byte mismatch for ${domain.file}`);
    assert(sha256(text) === domain.sha256, `bootstrap hash mismatch for ${domain.file}`);
  }
  parts.push(text);
}

const rebuilt = parts.join('');
const runtime = read(runtimeTarget);
assert(rebuilt === runtime, 'semantic CSS source does not reconstruct compatibility runtime exactly');
parseCss(runtime, runtimeTarget);

if (!sourceFirst) {
  assert(byteLength(runtime) === manifest.runtimeBytes, 'bootstrap runtime byte contract changed');
  assert(sha256(runtime) === manifest.runtimeSha256, 'bootstrap runtime hash contract changed');
}

const largest = domains
  .map(domain => ({ file: domain.file, bytes: byteLength(read(domain.file)) }))
  .sort((a, b) => b.bytes - a.bytes)[0];

console.log(`SC-031 core CSS verification PASS: ${EXPECTED_DOMAINS} ordered semantic domains reconstruct ${byteLength(runtime)} bytes exactly.`);
console.log(`authority ${sourceFirst ? 'semantic-css-source' : 'bootstrap-provenance'}`);
console.log(`runtime sha256 ${sha256(runtime)}`);
console.log(`largest domain ${largest.file}: ${largest.bytes} bytes (budget ${MAX_DOMAIN_BYTES})`);
