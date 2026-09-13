import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifestRel = 'src/shell/shell-manifest.json';
const manifestPath = path.join(root, manifestRel);
const runtimeRel = 'index.html';
const runtimePath = path.join(root, runtimeRel);

function fail(message) {
  console.error(`SC-031 source-authority candidate FAILED: ${message}`);
  process.exit(1);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function byteLength(text) {
  return Buffer.byteLength(text, 'utf8');
}

function readText(rel) {
  const abs = path.resolve(root, rel);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (abs !== path.resolve(root) && !abs.startsWith(rootPrefix)) {
    fail(`path escapes repository root: ${rel}`);
  }
  if (!fs.existsSync(abs)) fail(`required source is missing: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const at = text.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + needle.length;
  }
}

function hasProtectedId(text, id) {
  return text.includes(`id="${id}"`) || text.includes(`id='${id}'`);
}

function parseArgs(argv) {
  const args = { output: null, allowRuntimeWrite: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail('--output requires a repository-relative path');
      args.output = value;
      i += 1;
    } else if (arg === '--allow-runtime-write') {
      args.allowRuntimeWrite = true;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return args;
}

if (!fs.existsSync(manifestPath)) fail(`${manifestRel} is required`);
if (!fs.existsSync(runtimePath)) fail(`${runtimeRel} is required`);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`cannot parse ${manifestRel}: ${error.message}`);
}

if (manifest.schemaVersion !== 1) fail(`unsupported shell manifest schemaVersion: ${manifest.schemaVersion}`);
if (manifest.stage !== 'source-promotion-only') fail(`unexpected shell stage: ${manifest.stage}`);
if (manifest.runtimeChanged !== false || manifest.sourceAuthorityChanged !== false) {
  fail('candidate verifier requires the pre-inversion source-promotion checkpoint');
}
if (manifest.currentRuntime !== runtimeRel) fail(`unexpected current runtime: ${manifest.currentRuntime}`);
if (manifest.template !== 'src/shell/index.template.html') fail(`unexpected template path: ${manifest.template}`);
if (!Array.isArray(manifest.fragments) || manifest.fragments.length === 0) fail('shell manifest has no fragments');
if (manifest.fragmentCount !== manifest.fragments.length) fail('fragmentCount does not match fragments array');

const template = readText(manifest.template);
if (byteLength(template) !== manifest.templateEvidence?.bytes) fail('template byte count differs from pinned evidence');
if (sha256(template) !== manifest.templateEvidence?.sha256) fail('template hash differs from pinned evidence');

const tokenRegex = /<!-- @SQ:SOURCE ([^>]+?) -->/g;
const templateTokens = [...template.matchAll(tokenRegex)].map(match => match[0]);
const expectedTokens = manifest.fragments.map(fragment => fragment.token);

if (templateTokens.length !== manifest.fragments.length) {
  fail(`template contains ${templateTokens.length} source tokens; manifest expects ${manifest.fragments.length}`);
}
if (new Set(templateTokens).size !== templateTokens.length) fail('template contains duplicate source tokens');
if (new Set(expectedTokens).size !== expectedTokens.length) fail('manifest contains duplicate source tokens');

for (let i = 0; i < expectedTokens.length; i += 1) {
  if (templateTokens[i] !== expectedTokens[i]) {
    fail(`template token order differs from manifest at position ${i + 1}`);
  }
}

let candidate = template;
const seenFiles = new Set();
for (const [index, fragment] of manifest.fragments.entries()) {
  if (!fragment || typeof fragment.file !== 'string' || !fragment.file) fail(`fragment ${index + 1} has no file`);
  if (seenFiles.has(fragment.file)) fail(`fragment file is duplicated: ${fragment.file}`);
  seenFiles.add(fragment.file);

  const normalized = path.posix.normalize(fragment.file);
  if (normalized !== fragment.file || normalized.startsWith('../') || normalized.startsWith('/')) {
    fail(`unsafe or non-canonical fragment path: ${fragment.file}`);
  }
  const expectedToken = `<!-- @SQ:SOURCE ${fragment.file} -->`;
  if (fragment.token !== expectedToken) fail(`token/file mismatch for ${fragment.file}`);
  if (countOccurrences(template, fragment.token) !== 1) fail(`token must occur exactly once: ${fragment.file}`);

  const source = readText(fragment.file);
  if (byteLength(source) !== fragment.bytes) fail(`byte count differs from pinned evidence: ${fragment.file}`);
  if (sha256(source) !== fragment.sha256) fail(`hash differs from pinned evidence: ${fragment.file}`);

  for (const id of fragment.protectedIds || []) {
    if (!hasProtectedId(source, id)) fail(`protected id ${id} missing from ${fragment.file}`);
  }

  candidate = candidate.replace(fragment.token, source);
}

if (tokenRegex.test(candidate)) fail('rendered candidate still contains source tokens');

const candidateBytes = byteLength(candidate);
const candidateHash = sha256(candidate);
if (candidateBytes !== manifest.index?.bytes) fail(`rendered byte count ${candidateBytes} differs from pinned runtime ${manifest.index?.bytes}`);
if (candidateHash !== manifest.index?.sha256) fail(`rendered hash ${candidateHash} differs from pinned runtime ${manifest.index?.sha256}`);

const currentRuntime = fs.readFileSync(runtimePath, 'utf8');
if (candidate !== currentRuntime) fail('rendered split source is not byte-identical to current index.html');

const args = parseArgs(process.argv.slice(2));
if (args.output) {
  const outputRel = path.posix.normalize(args.output.replaceAll('\\', '/'));
  if (outputRel.startsWith('../') || outputRel.startsWith('/')) fail(`unsafe output path: ${args.output}`);
  if (outputRel === runtimeRel && !args.allowRuntimeWrite) {
    fail('refusing to write index.html in candidate stage without --allow-runtime-write');
  }
  const outputPath = path.resolve(root, outputRel);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (!outputPath.startsWith(rootPrefix)) fail(`output escapes repository root: ${args.output}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, candidate);
}

console.log(JSON.stringify({
  ok: true,
  stage: 'source-authority-candidate',
  runtimeChanged: false,
  sourceAuthorityChanged: false,
  template: manifest.template,
  fragments: manifest.fragments.length,
  renderedBytes: candidateBytes,
  renderedSha256: candidateHash,
  byteIdenticalToCurrentRuntime: true,
  output: args.output || null
}, null, 2));
