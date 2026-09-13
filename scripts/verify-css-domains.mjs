import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'styles', 'domain-manifest.json');
if (!fs.existsSync(manifestPath)) fail('Missing src/styles/domain-manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.schemaVersion === 1, 'Unexpected CSS domain manifest schema');
assert(manifest.generatedBy === 'scripts/promote-css-domains.mjs', 'Unexpected CSS domain manifest generator');
assert(manifest.stage === 'source-ownership-only', 'Unexpected CSS migration stage');
assert(manifest.runtimeChanged === false, 'CSS source promotion must not claim a runtime change');
assert(manifest.protectedCascadeOrder === true, 'Cascade-order protection flag is required');
assert(Array.isArray(manifest.entries) && manifest.entries.length > 0, 'CSS domain manifest must contain entries');

const destinations = new Set();
let previousOrder = -1;
for (const entry of manifest.entries) {
  assert(Number.isInteger(entry.order) && entry.order > previousOrder, `CSS source order is not strictly increasing at ${entry.destination}`);
  previousOrder = entry.order;
  assert(typeof entry.owner === 'string' && entry.owner.length > 0, `Missing owner for ${entry.destination}`);
  assert(typeof entry.sourceId === 'string' && entry.sourceId.length > 0, `Missing source id for ${entry.destination}`);
  assert(!destinations.has(entry.destination), `Duplicate CSS destination: ${entry.destination}`);
  destinations.add(entry.destination);

  const sourcePath = safePath(entry.source, 'src/legacy/styles/');
  const destinationPath = safePath(entry.destination, 'src/styles/');
  assert(fs.existsSync(sourcePath), `Missing CSS source: ${entry.source}`);
  assert(fs.existsSync(destinationPath), `Missing semantic CSS source: ${entry.destination}`);

  const source = fs.readFileSync(sourcePath);
  const destination = fs.readFileSync(destinationPath);
  assert(source.equals(destination), `Semantic CSS differs from protected source: ${entry.destination}`);
  assert(entry.bytes === source.byteLength, `Byte count mismatch: ${entry.destination}`);
  assert(entry.sha256 === sha256(source), `SHA-256 mismatch: ${entry.destination}`);
  postcss.parse(destination.toString('utf8'), { from: entry.destination });
}

console.log(`SC-031 CSS domain verification PASS: ${manifest.entries.length} owned source files are byte-identical to their protected cascade sources.`);

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
  console.error(`SC-031 CSS domain verification FAIL: ${message}`);
  process.exit(1);
}
