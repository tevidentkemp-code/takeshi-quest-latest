import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'parse5';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const migrationManifestPath = path.join(root, 'src', 'legacy', 'migration-manifest.json');
const domainManifestPath = path.join(root, 'src', 'styles', 'domain-manifest.json');
const adoptionManifestPath = path.join(root, 'src', 'styles', 'runtime-adoption-manifest.json');

for (const required of [indexPath, migrationManifestPath, domainManifestPath, adoptionManifestPath]) {
  if (!fs.existsSync(required)) fail(`Missing required file: ${path.relative(root, required)}`);
}

const html = fs.readFileSync(indexPath, 'utf8');
const migration = JSON.parse(fs.readFileSync(migrationManifestPath, 'utf8'));
const domains = JSON.parse(fs.readFileSync(domainManifestPath, 'utf8'));
const adoption = JSON.parse(fs.readFileSync(adoptionManifestPath, 'utf8'));

assert(adoption.schemaVersion === 1, 'Unexpected runtime adoption manifest schema');
assert(adoption.generatedBy === 'scripts/adopt-css-domain-paths.mjs', 'Unexpected runtime adoption manifest generator');
assert(adoption.contentChanged === false, 'Runtime adoption must preserve CSS content');
assert(adoption.cascadeOrderChanged === false, 'Runtime adoption must preserve cascade order');
assert(sha256(html) === adoption.indexSha256AfterAdoption, 'index.html hash differs from verified runtime-adoption hash');

const domainBySource = new Map(domains.entries.map(entry => [entry.source, entry]));
assert(domainBySource.size === domains.entries.length, 'Duplicate CSS domain source entries');

const expected = migration.styles.map(entry => {
  const promoted = domainBySource.get(entry.file);
  return {
    order: entry.order,
    file: promoted?.destination || entry.file,
    sha256: entry.sha256,
    promoted: Boolean(promoted)
  };
});

const document = parse(html, { sourceCodeLocationInfo: true });
const hrefs = collectStylesheetHrefs(document).filter(href =>
  href.startsWith('./src/legacy/styles/inline-') || href.startsWith('./src/styles/')
);
const expectedHrefs = expected.map(entry => `./${entry.file}`);

assert(hrefs.length === expectedHrefs.length,
  `Stylesheet runtime count mismatch: ${hrefs.length} vs ${expectedHrefs.length}`);
for (let i = 0; i < expectedHrefs.length; i += 1) {
  assert(hrefs[i] === expectedHrefs[i],
    `Cascade/load-order mismatch at stylesheet ${i + 1}: expected ${expectedHrefs[i]}, got ${hrefs[i]}`);
}

for (const entry of expected) {
  const absolute = safePath(entry.file, entry.promoted ? 'src/styles/' : 'src/legacy/styles/');
  assert(fs.existsSync(absolute), `Missing runtime stylesheet: ${entry.file}`);
  const content = fs.readFileSync(absolute);
  assert(sha256(content) === entry.sha256, `Runtime stylesheet hash mismatch: ${entry.file}`);
}

for (const entry of adoption.entries) {
  assert(!hrefs.includes(`./${entry.source}`), `Legacy href still active after adoption: ${entry.source}`);
  assert(hrefs.includes(`./${entry.destination}`), `Semantic href not active after adoption: ${entry.destination}`);
  const source = fs.readFileSync(safePath(entry.source, 'src/legacy/styles/'));
  const destination = fs.readFileSync(safePath(entry.destination, 'src/styles/'));
  assert(source.equals(destination), `Adopted CSS bytes differ from protected source: ${entry.destination}`);
  assert(sha256(destination) === entry.sha256, `Adopted CSS hash differs from manifest: ${entry.destination}`);
}

console.log(`SC-031 CSS runtime verification PASS: ${expected.length} stylesheet positions preserved; ${adoption.entries.length} semantic paths active with identical bytes.`);

function collectStylesheetHrefs(node) {
  const result = [];
  const visit = current => {
    if (!current || typeof current !== 'object') return;
    const isElement = current.namespaceURI === HTML_NS && typeof current.tagName === 'string';
    if (isElement && current.tagName === 'link') {
      const rel = String(getNodeAttr(current, 'rel') || '').toLowerCase().split(/\s+/);
      const href = getNodeAttr(current, 'href');
      if (rel.includes('stylesheet') && href) result.push(href);
    }
    for (const child of current.childNodes || []) visit(child);
  };
  visit(node);
  return result;
}

function getNodeAttr(node, name) {
  const attr = (node.attrs || []).find(item => String(item.name).toLowerCase() === name.toLowerCase());
  return attr ? attr.value : null;
}

function safePath(relativePath, prefix) {
  assert(typeof relativePath === 'string' && relativePath.startsWith(prefix), `Unexpected path outside ${prefix}: ${String(relativePath)}`);
  const absolute = path.resolve(root, relativePath);
  const allowed = path.resolve(root, prefix);
  assert(absolute.startsWith(`${allowed}${path.sep}`), `Path escapes ${prefix}: ${relativePath}`);
  return absolute;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`SC-031 CSS runtime verification FAIL: ${message}`);
  process.exit(1);
}
