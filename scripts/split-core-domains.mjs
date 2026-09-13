import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const RUNTIME = 'src/legacy/scripts/inline-005.js';
const DOMAIN_MANIFEST = 'src/core-domain-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';

const DOMAINS = [
  { marker: '@SEC:JS:BOOT', file: 'src/app/boot.js', owner: 'app/boot' },
  { marker: '@SEC:JS:UTIL', file: 'src/app/util.js', owner: 'app/util' },
  { marker: '@SEC:JS:STATE', file: 'src/app/state.js', owner: 'app/state' },
  { marker: '@SEC:JS:UI:ROUTER', file: 'src/app/router-ui.js', owner: 'app/router-ui' },
  { marker: '@SEC:JS:GAME:LIVEV2', file: 'src/live-game/live-v2.js', owner: 'live-game' },
  { marker: '@SEC:JS:GAME:ENGINE', file: 'src/game/engine.js', owner: 'game/engine' },
  { marker: '@SEC:JS:CLOUD', file: 'src/services/cloud.js', owner: 'services/cloud' },
  { marker: '@SEC:JS:LEGACY:QUARANTINE', occurrence: 1, file: 'src/legacy/quarantine/core-pre-modals.js', owner: 'legacy/quarantine' },
  { marker: '@SEC:JS:MODALS', file: 'src/ui/modals.js', owner: 'ui/modals' },
  { marker: '@SEC:JS:LEGACY:QUARANTINE', occurrence: 2, file: 'src/legacy/quarantine/core-post-modals.js', owner: 'legacy/quarantine' },
];

const abs = (p) => path.join(ROOT, p);
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const bytes = (text) => Buffer.byteLength(text, 'utf8');
const lines = (text) => (text.length === 0 ? 0 : text.split('\n').length);

function fail(message) {
  console.error(`FAIL core-domain split: ${message}`);
  process.exit(1);
}

function readText(file) {
  if (!fs.existsSync(abs(file))) fail(`missing required file ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
}

function allLineStartsForToken(source, token) {
  const starts = [];
  let from = 0;
  while (true) {
    const pos = source.indexOf(token, from);
    if (pos === -1) break;
    const lineStart = source.lastIndexOf('\n', pos - 1) + 1;
    const lineEndRaw = source.indexOf('\n', pos);
    const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw;
    const line = source.slice(lineStart, lineEnd);
    if (line.includes(token)) starts.push(lineStart);
    from = pos + token.length;
  }
  return [...new Set(starts)];
}

function locateBoundaries(source) {
  const cache = new Map();
  const resolved = DOMAINS.map((domain) => {
    if (!cache.has(domain.marker)) cache.set(domain.marker, allLineStartsForToken(source, domain.marker));
    const matches = cache.get(domain.marker);
    const expectedCount = domain.marker === '@SEC:JS:LEGACY:QUARANTINE' ? 2 : 1;
    if (matches.length !== expectedCount) {
      fail(`${domain.marker} expected ${expectedCount} marker line(s), found ${matches.length}`);
    }
    const occurrence = domain.occurrence || 1;
    return { ...domain, start: matches[occurrence - 1] };
  });

  for (let i = 1; i < resolved.length; i += 1) {
    if (resolved[i].start <= resolved[i - 1].start) {
      fail(`section order invalid at ${resolved[i - 1].marker} -> ${resolved[i].marker}`);
    }
  }

  // Preserve any leading bytes before the first marker in boot.js.
  resolved[0].start = 0;
  return resolved;
}

function syntaxCheck(file) {
  try {
    execFileSync(process.execPath, ['--check', abs(file)], { stdio: 'pipe' });
  } catch (error) {
    const detail = error?.stderr?.toString?.() || error?.message || String(error);
    fail(`JavaScript syntax check failed for ${file}:\n${detail}`);
  }
}

function updateMigrationRuntimeHash(runtimeText) {
  const manifest = JSON.parse(readText(MIGRATION_MANIFEST));
  const entry = (manifest.scripts || []).find((item) => item.file === RUNTIME);
  if (!entry) fail(`runtime ${RUNTIME} not found in migration manifest`);
  entry.sha256 = sha256(runtimeText);
  fs.writeFileSync(abs(MIGRATION_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeDomainManifest(domainTexts, runtimeText) {
  const manifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/split-core-domains.mjs',
    strategy: 'semantic-source-byte-identical-classic-runtime',
    runtimeTarget: RUNTIME,
    runtimeSha256: sha256(runtimeText),
    runtimeBytes: bytes(runtimeText),
    domains: DOMAINS.map((domain, index) => ({
      order: index + 1,
      marker: domain.marker,
      occurrence: domain.occurrence || 1,
      owner: domain.owner,
      file: domain.file,
      sha256: sha256(domainTexts[index]),
      bytes: bytes(domainTexts[index]),
      lines: lines(domainTexts[index]),
    })),
  };
  fs.writeFileSync(abs(DOMAIN_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

const domainPresence = DOMAINS.map((domain) => fs.existsSync(abs(domain.file)));
const hasDomainManifest = fs.existsSync(abs(DOMAIN_MANIFEST));
let domainTexts;
let runtimeText;

if (!hasDomainManifest && domainPresence.every((present) => !present)) {
  // Bootstrap: split the verified legacy runtime at canonical top-level section markers.
  runtimeText = readText(RUNTIME);
  const boundaries = locateBoundaries(runtimeText);
  domainTexts = boundaries.map((boundary, index) => {
    const end = index + 1 < boundaries.length ? boundaries[index + 1].start : runtimeText.length;
    return runtimeText.slice(boundary.start, end);
  });

  const recombined = domainTexts.join('');
  if (recombined !== runtimeText) fail('bootstrap recombination is not byte-identical to legacy runtime');

  DOMAINS.forEach((domain, index) => {
    ensureParent(domain.file);
    fs.writeFileSync(abs(domain.file), domainTexts[index], 'utf8');
  });
} else {
  if (!hasDomainManifest) fail('semantic domain files exist without src/core-domain-manifest.json');
  if (!domainPresence.every(Boolean)) {
    const missing = DOMAINS.filter((_, index) => !domainPresence[index]).map((domain) => domain.file);
    fail(`semantic source set is incomplete: ${missing.join(', ')}`);
  }

  const prior = JSON.parse(readText(DOMAIN_MANIFEST));
  const priorFiles = (prior.domains || []).map((item) => item.file);
  const expectedFiles = DOMAINS.map((domain) => domain.file);
  if (JSON.stringify(priorFiles) !== JSON.stringify(expectedFiles)) {
    fail('domain manifest order does not match the canonical SC-031 domain order');
  }

  domainTexts = DOMAINS.map((domain) => readText(domain.file));
  runtimeText = domainTexts.join('');
  fs.writeFileSync(abs(RUNTIME), runtimeText, 'utf8');
}

DOMAINS.forEach((domain, index) => {
  const text = domainTexts[index];
  const markerCount = text.split(domain.marker).length - 1;
  if (markerCount < 1) fail(`${domain.file} no longer contains ${domain.marker}`);
  syntaxCheck(domain.file);
});

const finalRuntime = domainTexts.join('');
fs.writeFileSync(abs(RUNTIME), finalRuntime, 'utf8');
syntaxCheck(RUNTIME);
updateMigrationRuntimeHash(finalRuntime);
writeDomainManifest(domainTexts, finalRuntime);

console.log(`PASS core-domain split: ${DOMAINS.length} semantic sources -> ${RUNTIME}`);
console.log(`runtime sha256 ${sha256(finalRuntime)} (${bytes(finalRuntime)} bytes)`);
