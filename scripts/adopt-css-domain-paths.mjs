import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const migrationManifestPath = path.join(root, 'src', 'legacy', 'migration-manifest.json');
const domainManifestPath = path.join(root, 'src', 'styles', 'domain-manifest.json');
const adoptionManifestPath = path.join(root, 'src', 'styles', 'runtime-adoption-manifest.json');

requireFile(indexPath);
requireFile(migrationManifestPath);
requireFile(domainManifestPath);

const migration = JSON.parse(fs.readFileSync(migrationManifestPath, 'utf8'));
const domains = JSON.parse(fs.readFileSync(domainManifestPath, 'utf8'));
let html = fs.readFileSync(indexPath, 'utf8');

assert(migration.schemaVersion === 2, 'Unexpected migration manifest schema');
assert(domains.schemaVersion === 1, 'Unexpected CSS domain manifest schema');
assert(domains.stage === 'source-ownership-only', 'CSS domains are not at the expected ownership stage');
assert(domains.runtimeChanged === false, 'CSS domain source promotion must remain content-only before runtime adoption');
assert(Array.isArray(domains.entries) && domains.entries.length > 0, 'No CSS domains available for runtime adoption');

if (fs.existsSync(adoptionManifestPath)) {
  const existing = JSON.parse(fs.readFileSync(adoptionManifestPath, 'utf8'));
  verifyExistingAdoption(existing, html, domains.entries);
  console.log(`SC-031 CSS runtime adoption already present: ${domains.entries.length} semantic stylesheet paths verified.`);
  process.exit(0);
}

const migrationByFile = new Map(migration.styles.map(entry => [entry.file, entry]));
const beforeSha = sha256(html);
const adopted = [];

for (const entry of domains.entries) {
  const legacy = migrationByFile.get(entry.source);
  assert(legacy, `Domain source is missing from migration manifest: ${entry.source}`);
  assert(legacy.order === entry.order, `CSS source order mismatch for ${entry.source}`);
  assert(legacy.sha256 === entry.sha256, `CSS source hash mismatch for ${entry.source}`);

  const sourcePath = safePath(entry.source, 'src/legacy/styles/');
  const destinationPath = safePath(entry.destination, 'src/styles/');
  requireFile(sourcePath);
  requireFile(destinationPath);
  const source = fs.readFileSync(sourcePath);
  const destination = fs.readFileSync(destinationPath);
  assert(source.equals(destination), `Semantic CSS content differs before adoption: ${entry.destination}`);
  assert(sha256(destination) === entry.sha256, `Semantic CSS hash mismatch before adoption: ${entry.destination}`);

  const oldToken = `href="./${entry.source}"`;
  const newToken = `href="./${entry.destination}"`;
  const oldCount = countOccurrences(html, oldToken);
  const newCount = countOccurrences(html, newToken);
  assert(oldCount === 1, `Expected exactly one legacy runtime href for ${entry.source}; found ${oldCount}`);
  assert(newCount === 0, `Semantic runtime href already exists unexpectedly for ${entry.destination}`);
  html = html.replace(oldToken, newToken);

  adopted.push({
    order: entry.order,
    owner: entry.owner,
    sourceId: entry.sourceId,
    source: entry.source,
    destination: entry.destination,
    sha256: entry.sha256,
    bytes: entry.bytes
  });
}

const afterSha = sha256(html);
assert(afterSha !== beforeSha, 'Runtime adoption did not change index.html references');
fs.writeFileSync(indexPath, html, 'utf8');

const manifest = {
  schemaVersion: 1,
  generatedBy: 'scripts/adopt-css-domain-paths.mjs',
  source: 'index.html',
  contentChanged: false,
  cascadeOrderChanged: false,
  indexSha256BeforeAdoption: beforeSha,
  indexSha256AfterAdoption: afterSha,
  entries: adopted
};
fs.writeFileSync(adoptionManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`SC-031 CSS runtime adoption PASS: ${adopted.length} semantic stylesheet paths adopted with identical bytes and cascade order.`);

function verifyExistingAdoption(existing, currentHtml, entries) {
  assert(existing.schemaVersion === 1, 'Unexpected runtime adoption manifest schema');
  assert(existing.generatedBy === 'scripts/adopt-css-domain-paths.mjs', 'Unexpected runtime adoption manifest generator');
  assert(existing.source === 'index.html', 'Unexpected runtime adoption source');
  assert(existing.contentChanged === false, 'Runtime adoption must not change stylesheet content');
  assert(existing.cascadeOrderChanged === false, 'Runtime adoption must not change stylesheet cascade order');
  assert(sha256(currentHtml) === existing.indexSha256AfterAdoption, 'Current index.html differs from verified runtime-adoption hash');
  assert(Array.isArray(existing.entries) && existing.entries.length === entries.length, 'Runtime adoption entry count mismatch');
  for (const entry of entries) {
    assert(countOccurrences(currentHtml, `href="./${entry.source}"`) === 0, `Legacy runtime href returned for ${entry.source}`);
    assert(countOccurrences(currentHtml, `href="./${entry.destination}"`) === 1, `Semantic runtime href missing/duplicated for ${entry.destination}`);
  }
}

function countOccurrences(value, token) {
  return value.split(token).length - 1;
}

function safePath(relativePath, prefix) {
  assert(typeof relativePath === 'string' && relativePath.startsWith(prefix), `Unexpected path outside ${prefix}: ${String(relativePath)}`);
  const absolute = path.resolve(root, relativePath);
  const allowed = path.resolve(root, prefix);
  assert(absolute.startsWith(`${allowed}${path.sep}`), `Path escapes ${prefix}: ${relativePath}`);
  return absolute;
}

function requireFile(file) {
  assert(fs.existsSync(file), `Missing required file: ${path.relative(root, file)}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`SC-031 CSS runtime adoption FAIL: ${message}`);
  process.exit(1);
}
