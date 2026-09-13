import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const ROOT = process.cwd();
const RUNTIME = 'src/legacy/styles/inline-002.css';
const STYLE_MANIFEST = 'src/core-style-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';

const DOMAINS = [
  { marker: '@SEC:CSS:TOKENS', file: 'src/styles/core-tokens.css', owner: 'styles/tokens-base' },
  { marker: '@SEC:CSS:HOME', file: 'src/styles/home.css', owner: 'styles/home' },
  { marker: '@SEC:CSS:GAME', file: 'src/styles/game.css', owner: 'styles/game' },
];

const abs = (p) => path.join(ROOT, p);
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const bytes = (text) => Buffer.byteLength(text, 'utf8');
const lines = (text) => (text.length === 0 ? 0 : text.split('\n').length);

function fail(message) {
  console.error(`FAIL core-style split: ${message}`);
  process.exit(1);
}

function readText(file) {
  if (!fs.existsSync(abs(file))) fail(`missing required file ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
}

function lineStartForSingleMarker(source, marker) {
  const positions = [];
  let from = 0;
  while (true) {
    const pos = source.indexOf(marker, from);
    if (pos === -1) break;
    positions.push(pos);
    from = pos + marker.length;
  }
  if (positions.length !== 1) fail(`${marker} expected exactly once, found ${positions.length}`);
  return source.lastIndexOf('\n', positions[0] - 1) + 1;
}

function parseCss(text, file) {
  try {
    postcss.parse(text, { from: file });
  } catch (error) {
    fail(`CSS parse failed for ${file}: ${error?.message || error}`);
  }
}

function updateMigrationRuntimeHash(runtimeText) {
  const manifest = JSON.parse(readText(MIGRATION_MANIFEST));
  const entry = (manifest.styles || []).find((item) => item.file === RUNTIME);
  if (!entry) fail(`runtime ${RUNTIME} not found in migration manifest`);
  entry.sha256 = sha256(runtimeText);
  fs.writeFileSync(abs(MIGRATION_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeStyleManifest(domainTexts, runtimeText) {
  const manifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/split-core-styles.mjs',
    strategy: 'semantic-source-byte-identical-classic-runtime',
    runtimeTarget: RUNTIME,
    runtimeSha256: sha256(runtimeText),
    runtimeBytes: bytes(runtimeText),
    domains: DOMAINS.map((domain, index) => ({
      order: index + 1,
      marker: domain.marker,
      owner: domain.owner,
      file: domain.file,
      sha256: sha256(domainTexts[index]),
      bytes: bytes(domainTexts[index]),
      lines: lines(domainTexts[index]),
    })),
  };
  fs.writeFileSync(abs(STYLE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

const domainPresence = DOMAINS.map((domain) => fs.existsSync(abs(domain.file)));
const hasStyleManifest = fs.existsSync(abs(STYLE_MANIFEST));
let domainTexts;

if (!hasStyleManifest && domainPresence.every((present) => !present)) {
  const runtime = readText(RUNTIME);
  const starts = DOMAINS.map((domain) => lineStartForSingleMarker(runtime, domain.marker));
  for (let i = 1; i < starts.length; i += 1) {
    if (starts[i] <= starts[i - 1]) fail(`style section order invalid at ${DOMAINS[i].marker}`);
  }
  starts[0] = 0;
  domainTexts = DOMAINS.map((domain, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : runtime.length;
    return runtime.slice(starts[index], end);
  });
  if (domainTexts.join('') !== runtime) fail('bootstrap recombination is not byte-identical to core stylesheet runtime');
  DOMAINS.forEach((domain, index) => {
    ensureParent(domain.file);
    fs.writeFileSync(abs(domain.file), domainTexts[index], 'utf8');
  });
} else {
  if (!hasStyleManifest) fail('semantic style files exist without src/core-style-manifest.json');
  if (!domainPresence.every(Boolean)) {
    const missing = DOMAINS.filter((_, index) => !domainPresence[index]).map((domain) => domain.file);
    fail(`semantic style source set is incomplete: ${missing.join(', ')}`);
  }
  const prior = JSON.parse(readText(STYLE_MANIFEST));
  const priorFiles = (prior.domains || []).map((item) => item.file);
  const expectedFiles = DOMAINS.map((domain) => domain.file);
  if (JSON.stringify(priorFiles) !== JSON.stringify(expectedFiles)) fail('style manifest order differs from canonical SC-031 style order');
  domainTexts = DOMAINS.map((domain) => readText(domain.file));
}

DOMAINS.forEach((domain, index) => {
  const text = domainTexts[index];
  if (!text.includes(domain.marker)) fail(`${domain.file} no longer contains ${domain.marker}`);
  parseCss(text, domain.file);
});

const runtimeText = domainTexts.join('');
parseCss(runtimeText, RUNTIME);
fs.writeFileSync(abs(RUNTIME), runtimeText, 'utf8');
updateMigrationRuntimeHash(runtimeText);
writeStyleManifest(domainTexts, runtimeText);

console.log(`PASS core-style split: ${DOMAINS.length} semantic sources -> ${RUNTIME}`);
console.log(`runtime sha256 ${sha256(runtimeText)} (${bytes(runtimeText)} bytes)`);
