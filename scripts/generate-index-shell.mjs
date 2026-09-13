import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) fail('index.html is required');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const manifestPaths = [
  'src/ui/screens/html-source-manifest.json',
  'src/live-game/view/html-source-manifest.json',
  'src/live-game/throwpad/html-source-manifest.json',
  'src/ui/modals/setup/html-source-manifest.json',
  'src/ui/modals/admin/html-source-manifest.json',
  'src/ui/status/html-source-manifest.json'
];

const fragments = [];
for (const manifestPath of manifestPaths) {
  const manifest = readJson(manifestPath);
  assert(manifest.runtimeChanged === false, `${manifestPath} must remain runtimeChanged=false before shell generation`);
  assert(manifest.indexChanged === false, `${manifestPath} must remain indexChanged=false before shell generation`);
  for (const fragment of manifest.fragments || []) {
    fragments.push({ ...fragment, manifestPath });
  }
}

assert(fragments.length >= 1, 'No owned HTML fragments found');
fragments.sort((a, b) => Number(a.startOffset) - Number(b.startOffset));

let previousEnd = 0;
for (const fragment of fragments) {
  const start = Number(fragment.startOffset);
  const end = Number(fragment.endOffset);
  assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start, `Invalid offsets for ${fragment.file}`);
  assert(start >= previousEnd, `Owned HTML fragments overlap before ${fragment.file}`);
  const source = readText(fragment.file);
  const current = indexHtml.slice(start, end);
  assert(current === source, `${fragment.file} no longer matches index.html at its protected offsets`);
  assert(Buffer.byteLength(source) === Number(fragment.bytes), `${fragment.file} byte count differs from manifest`);
  assert(sha256(source) === fragment.sha256, `${fragment.file} hash differs from manifest`);
  previousEnd = end;
}

let cursor = 0;
let template = '';
const entries = [];
for (const fragment of fragments) {
  const start = Number(fragment.startOffset);
  const end = Number(fragment.endOffset);
  const token = `<!-- @SQ:SOURCE ${fragment.file} -->`;
  assert(!indexHtml.includes(token), `Shell token already exists in index.html: ${token}`);
  template += indexHtml.slice(cursor, start);
  const tokenOffset = template.length;
  template += token;
  entries.push({
    file: fragment.file,
    manifestPath: fragment.manifestPath,
    token,
    sourceStartOffset: start,
    sourceEndOffset: end,
    templateTokenOffset: tokenOffset,
    bytes: fragment.bytes,
    sha256: fragment.sha256,
    protectedIds: fragment.protectedIds || []
  });
  cursor = end;
}
template += indexHtml.slice(cursor);

const templatePath = path.join(root, 'src', 'shell', 'index.template.html');
fs.mkdirSync(path.dirname(templatePath), { recursive: true });
fs.writeFileSync(templatePath, template, 'utf8');

let reconstructed = template;
for (const entry of entries) {
  const count = occurrences(reconstructed, entry.token);
  assert(count === 1, `Shell token for ${entry.file} occurs ${count} times`);
  reconstructed = reconstructed.replace(entry.token, readText(entry.file));
}
assert(reconstructed === indexHtml, 'Deterministic shell reconstruction is not byte-identical to index.html');

const manifest = {
  schemaVersion: 1,
  generatedBy: 'scripts/generate-index-shell.mjs',
  stage: 'source-promotion-only',
  runtimeChanged: false,
  indexChanged: false,
  sourceAuthorityChanged: false,
  currentRuntime: 'index.html',
  template: 'src/shell/index.template.html',
  index: {
    bytes: Buffer.byteLength(indexHtml),
    sha256: sha256(indexHtml)
  },
  templateEvidence: {
    bytes: Buffer.byteLength(template),
    sha256: sha256(template)
  },
  fragmentCount: entries.length,
  manifestPaths,
  fragments: entries
};
writeJson(path.join(root, 'src', 'shell', 'shell-manifest.json'), manifest);

console.log(`SC-031 deterministic shell PASS: ${entries.length} owned fragments reconstruct index.html byte-identically`);

function readText(relativePath) {
  const full = path.join(root, relativePath);
  assert(fs.existsSync(full), `Missing source file: ${relativePath}`);
  return fs.readFileSync(full, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function occurrences(body, needle) {
  let count = 0;
  let at = 0;
  while ((at = body.indexOf(needle, at)) >= 0) {
    count += 1;
    at += needle.length;
  }
  return count;
}

function writeJson(outPath, value) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`SC-031 deterministic shell FAIL: ${message}`);
  process.exit(1);
}
