import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'src', 'legacy', 'migration-manifest.json');

if (!fs.existsSync(manifestPath)) fail('Missing src/legacy/migration-manifest.json');

const html = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert(manifest.schemaVersion === 1, 'Unexpected migration manifest schema');
assert(manifest.source === 'index.html', 'Unexpected migration source');
assert(sha256(html) === manifest.indexSha256AfterMigration, 'index.html hash differs from migration manifest');

const inlineStyleCount = (html.match(/<style\b/gi) || []).length;
assert(inlineStyleCount === 0, `Expected 0 inline style tags, found ${inlineStyleCount}`);

const inlineExecutableScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !hasAttr(attrs, 'src') && isExecutableJavascript(attrs));
assert(inlineExecutableScripts.length === 0, `Expected 0 eligible inline JS blocks, found ${inlineExecutableScripts.length}`);

assert(manifest.styles.length === manifest.extractedStyleBlocks, 'Style count does not match manifest');
assert(manifest.scripts.length === manifest.extractedScriptBlocks, 'Script count does not match manifest');

for (const entry of manifest.styles) {
  const abs = path.join(root, entry.file);
  assert(fs.existsSync(abs), `Missing extracted stylesheet ${entry.file}`);
  const body = fs.readFileSync(abs, 'utf8');
  assert(sha256(body) === entry.sha256, `Stylesheet hash mismatch: ${entry.file}`);
  const href = `./${entry.file}`;
  assert(html.includes(`href="${href}"`), `index.html does not reference ${entry.file}`);
}

for (const entry of manifest.scripts) {
  const abs = path.join(root, entry.file);
  assert(fs.existsSync(abs), `Missing extracted script ${entry.file}`);
  const body = fs.readFileSync(abs, 'utf8');
  assert(sha256(body) === entry.sha256, `Script hash mismatch: ${entry.file}`);
  const src = `./${entry.file}`;
  assert(html.includes(`src="${src}"`), `index.html does not reference ${entry.file}`);

  const syntax = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    fail(`JavaScript syntax check failed for ${entry.file}\n${syntax.stderr || syntax.stdout}`);
  }
}

const styleRefs = (html.match(/href="\.\/src\/legacy\/styles\/inline-\d+\.css"/g) || []).length;
const scriptRefs = (html.match(/src="\.\/src\/legacy\/scripts\/inline-\d+\.js"/g) || []).length;
assert(styleRefs === manifest.styles.length, `index stylesheet reference count mismatch: ${styleRefs} vs ${manifest.styles.length}`);
assert(scriptRefs === manifest.scripts.length, `index script reference count mismatch: ${scriptRefs} vs ${manifest.scripts.length}`);

console.log(`SC-031 structure verification PASS: ${manifest.styles.length} styles, ${manifest.scripts.length} scripts, 0 executable inline JS, 0 inline style tags.`);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hasAttr(attrs, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, 'i').test(attrs);
}

function getAttr(attrs, name) {
  const match = attrs.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function isExecutableJavascript(attrs) {
  const type = (getAttr(attrs, 'type') || '').trim().toLowerCase();
  if (!type) return true;
  return [
    'text/javascript',
    'application/javascript',
    'application/ecmascript',
    'text/ecmascript',
    'module'
  ].includes(type);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`SC-031 structure verification FAIL: ${message}`);
  process.exit(1);
}
