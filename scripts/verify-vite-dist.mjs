import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const sourceIndex = path.join(root, 'index.html');
const distRoot = path.join(root, 'dist');
const distIndex = path.join(distRoot, 'index.html');

function fail(message) {
  console.error(`SC-031 Vite parity verification FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

assert(fs.existsSync(sourceIndex), 'source index.html missing');
assert(fs.existsSync(distIndex), 'dist/index.html missing');
assert(fs.existsSync(path.join(distRoot, '.nojekyll')), 'dist/.nojekyll missing');

const sourceHtml = fs.readFileSync(sourceIndex, 'utf8');
const distHtml = fs.readFileSync(distIndex, 'utf8');
assert(/<!doctype html>/i.test(distHtml), 'dist/index.html lost doctype');
assert(/id=["']details["']/.test(distHtml), 'dist/index.html lost start screen');
assert(/id=["']game["']/.test(distHtml), 'dist/index.html lost live game screen');
assert(/id=["']pad["']/.test(distHtml), 'dist/index.html lost throwpad');
assert(/id=["']leaderboard["']/.test(distHtml), 'dist/index.html lost leaderboard');

const scriptRefs = extractRefs(distHtml, 'script', 'src');
for (const ref of scriptRefs) assertLocalRefExists(ref, 'script');
const styleRefs = extractStylesheetRefs(distHtml);
for (const ref of styleRefs) assertLocalRefExists(ref, 'stylesheet');

const sourceClassicScripts = extractRefs(sourceHtml, 'script', 'src')
  .filter(isLocalRuntimeRef);
const distClassicScripts = scriptRefs.filter(isLocalRuntimeRef);
assert(
  JSON.stringify(distClassicScripts) === JSON.stringify(sourceClassicScripts),
  `classic script load order/path drifted in Vite output\nsource=${JSON.stringify(sourceClassicScripts)}\ndist=${JSON.stringify(distClassicScripts)}`
);

const evidence = {
  schemaVersion: 1,
  buildSystem: 'vite',
  sourceIndexSha256: sha256(Buffer.from(sourceHtml)),
  distIndexSha256: sha256(Buffer.from(distHtml)),
  distIndexBytes: Buffer.byteLength(distHtml, 'utf8'),
  localScriptRefs: distClassicScripts.length,
  stylesheetRefs: styleRefs.length,
  relativeBase: true,
};
fs.writeFileSync(path.join(root, 'sc031-vite-build-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));

function extractRefs(html, tag, attr) {
  const tagRe = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, 'gi');
  const refs = [];
  let match;
  while ((match = tagRe.exec(html))) refs.push(match[1]);
  return refs;
}

function extractStylesheetRefs(html) {
  const linkRe = /<link\b([^>]+)>/gi;
  const refs = [];
  let match;
  while ((match = linkRe.exec(html))) {
    const attrs = match[1];
    if (!/\brel=["'][^"']*stylesheet[^"']*["']/i.test(attrs)) continue;
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) refs.push(href);
  }
  return refs;
}

function isLocalRuntimeRef(ref) {
  return ref.startsWith('./src/') || ref.startsWith('src/');
}

function assertLocalRefExists(ref, label) {
  if (/^(?:https?:|data:|blob:|\/\/|#)/i.test(ref)) return;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return;
  const absolute = path.resolve(distRoot, clean);
  const prefix = `${path.resolve(distRoot)}${path.sep}`;
  assert(absolute.startsWith(prefix), `${label} reference escapes dist: ${ref}`);
  assert(fs.existsSync(absolute), `${label} reference missing from dist: ${ref}`);
}
