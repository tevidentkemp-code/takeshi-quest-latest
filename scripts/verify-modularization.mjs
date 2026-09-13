import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'parse5';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const migrationManifestPath = path.join(root, 'src', 'legacy', 'migration-manifest.json');
const domainManifestPath = path.join(root, 'src', 'styles', 'domain-manifest.json');
const adoptionManifestPath = path.join(root, 'src', 'styles', 'runtime-adoption-manifest.json');

if (!fs.existsSync(migrationManifestPath)) fail('Missing src/legacy/migration-manifest.json');

const html = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(migrationManifestPath, 'utf8'));
const domains = fs.existsSync(domainManifestPath)
  ? JSON.parse(fs.readFileSync(domainManifestPath, 'utf8'))
  : { entries: [] };
const adoption = fs.existsSync(adoptionManifestPath)
  ? JSON.parse(fs.readFileSync(adoptionManifestPath, 'utf8'))
  : null;
const document = parse(html, { sourceCodeLocationInfo: true });

assert(manifest.schemaVersion === 2, 'Unexpected migration manifest schema');
assert(manifest.parser === 'parse5@8.0.1', 'Unexpected migration parser/version');
assert(manifest.source === 'index.html', 'Unexpected migration source');

if (adoption) {
  assert(adoption.schemaVersion === 1, 'Unexpected CSS runtime adoption manifest schema');
  assert(adoption.generatedBy === 'scripts/adopt-css-domain-paths.mjs', 'Unexpected CSS runtime adoption generator');
  assert(sha256(html) === adoption.indexSha256AfterAdoption, 'index.html hash differs from CSS runtime-adoption manifest');
} else {
  assert(sha256(html) === manifest.indexSha256AfterMigration, 'index.html hash differs from migration manifest');
}

const parsed = collectRelevantNodes(document);
assert(parsed.inlineStyles.length === 0, `Expected 0 parsed inline style elements, found ${parsed.inlineStyles.length}`);
assert(parsed.inlineScripts.length === 0, `Expected 0 parsed eligible inline JS elements, found ${parsed.inlineScripts.length}`);

assert(Array.isArray(manifest.styles), 'Manifest styles must be an array');
assert(Array.isArray(manifest.scripts), 'Manifest scripts must be an array');
assert(manifest.styles.length === manifest.extractedStyleBlocks, 'Style count does not match manifest');
assert(manifest.scripts.length === manifest.extractedScriptBlocks, 'Script count does not match manifest');

const domainBySource = new Map((domains.entries || []).map(entry => [entry.source, entry]));
const adoptedSources = new Set((adoption?.entries || []).map(entry => entry.source));
const expectedStyles = manifest.styles.map(entry => {
  const domain = domainBySource.get(entry.file);
  const useSemantic = domain && adoptedSources.has(entry.file);
  return {
    source: entry.file,
    file: useSemantic ? domain.destination : entry.file,
    sha256: entry.sha256,
    semantic: Boolean(useSemantic)
  };
});
const expectedStyleHrefs = expectedStyles.map(entry => `./${entry.file}`);
const expectedScriptSrcs = manifest.scripts.map(entry => `./${entry.file}`);

const actualStyleHrefs = parsed.stylesheetRefs
  .map(node => getNodeAttr(node, 'href'))
  .filter(href => expectedStyleHrefs.includes(href));
const actualScriptSrcs = parsed.scriptRefs
  .map(node => getNodeAttr(node, 'src'))
  .filter(src => expectedScriptSrcs.includes(src));

assert(actualStyleHrefs.length === expectedStyleHrefs.length,
  `Parsed stylesheet reference count mismatch: ${actualStyleHrefs.length} vs ${expectedStyleHrefs.length}`);
assert(actualScriptSrcs.length === expectedScriptSrcs.length,
  `Parsed script reference count mismatch: ${actualScriptSrcs.length} vs ${expectedScriptSrcs.length}`);
assertSameOrder(actualStyleHrefs, expectedStyleHrefs, 'stylesheet');
assertSameOrder(actualScriptSrcs, expectedScriptSrcs, 'script');

for (const entry of expectedStyles) {
  assertSafeGeneratedPath(entry.file, entry.semantic ? 'src/styles/' : 'src/legacy/styles/');
  const abs = path.join(root, entry.file);
  assert(fs.existsSync(abs), `Missing stylesheet ${entry.file}`);
  const body = fs.readFileSync(abs, 'utf8');
  assert(sha256(body) === entry.sha256, `Stylesheet hash mismatch: ${entry.file}`);
}

for (const entry of manifest.scripts) {
  assertSafeGeneratedPath(entry.file, 'src/legacy/scripts/');
  assert(['classic', 'module'].includes(entry.scriptMode), `Unknown script mode for ${entry.file}`);
  const abs = path.join(root, entry.file);
  assert(fs.existsSync(abs), `Missing extracted script ${entry.file}`);
  const body = fs.readFileSync(abs, 'utf8');
  assert(sha256(body) === entry.sha256, `Script hash mismatch: ${entry.file}`);
  syntaxCheck(entry, abs, body);
}

console.log(
  `SC-031 structure verification PASS: ${manifest.styles.length} parsed styles, `
  + `${manifest.scripts.length} parsed scripts, 0 eligible inline JS, 0 parsed inline styles, `
  + `${adoption?.entries?.length || 0} semantic CSS runtime paths.`
);

function collectRelevantNodes(rootNode) {
  const result = {
    inlineStyles: [],
    inlineScripts: [],
    stylesheetRefs: [],
    scriptRefs: []
  };

  const visit = node => {
    if (!node || typeof node !== 'object') return;
    const isHtmlElement = node.namespaceURI === HTML_NS && typeof node.tagName === 'string';

    if (isHtmlElement && node.tagName === 'style' && node.sourceCodeLocation?.startTag) {
      result.inlineStyles.push(node);
    }

    if (isHtmlElement && node.tagName === 'script' && node.sourceCodeLocation?.startTag) {
      const src = getNodeAttr(node, 'src');
      if (!src && isExecutableJavascriptNode(node)) result.inlineScripts.push(node);
      if (src) result.scriptRefs.push(node);
    }

    if (isHtmlElement && node.tagName === 'link') {
      const rel = String(getNodeAttr(node, 'rel') || '').toLowerCase().split(/\s+/);
      const href = getNodeAttr(node, 'href');
      if (rel.includes('stylesheet') && href) result.stylesheetRefs.push(node);
    }

    // As in the migrator, do not traverse inert <template>.content in Phase 1.
    for (const child of node.childNodes || []) visit(child);
  };

  visit(rootNode);
  return result;
}

function getNodeAttr(node, name) {
  const attr = (node.attrs || []).find(item => String(item.name).toLowerCase() === name.toLowerCase());
  return attr ? attr.value : null;
}

function isExecutableJavascriptNode(node) {
  const type = String(getNodeAttr(node, 'type') || '').trim().toLowerCase();
  if (!type) return true;
  return [
    'text/javascript',
    'application/javascript',
    'application/ecmascript',
    'text/ecmascript',
    'module'
  ].includes(type);
}

function syntaxCheck(entry, abs, body) {
  let checkPath = abs;
  let tempPath = null;

  if (entry.scriptMode === 'module') {
    tempPath = path.join(os.tmpdir(), `shateki-sc031-${path.basename(entry.file, '.js')}-${process.pid}.mjs`);
    fs.writeFileSync(tempPath, body, 'utf8');
    checkPath = tempPath;
  }

  try {
    const syntax = spawnSync(process.execPath, ['--check', checkPath], { encoding: 'utf8' });
    if (syntax.status !== 0) {
      fail(`JavaScript syntax check failed for ${entry.file}\n${syntax.stderr || syntax.stdout}`);
    }
  } finally {
    if (tempPath) fs.rmSync(tempPath, { force: true });
  }
}

function assertSameOrder(actual, expected, label) {
  for (let i = 0; i < expected.length; i += 1) {
    assert(actual[i] === expected[i], `${label} load-order mismatch at position ${i + 1}: expected ${expected[i]}, got ${actual[i]}`);
  }
}

function assertSafeGeneratedPath(file, prefix) {
  assert(typeof file === 'string' && file.startsWith(prefix), `Unexpected generated path: ${String(file)}`);
  const resolved = path.resolve(root, file);
  const allowed = path.resolve(root, prefix);
  assert(resolved.startsWith(`${allowed}${path.sep}`), `Generated path escapes expected directory: ${file}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`SC-031 structure verification FAIL: ${message}`);
  process.exit(1);
}
