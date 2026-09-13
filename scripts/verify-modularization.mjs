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
const intentionalPatchesPath = path.join(root, 'src', 'legacy', 'intentional-patches.json');
const domainManifestPath = path.join(root, 'src', 'styles', 'domain-manifest.json');
const adoptionManifestPath = path.join(root, 'src', 'styles', 'runtime-adoption-manifest.json');
const htmlSourceContractPath = path.join(root, 'src', 'shell', 'source-contract.json');
const cssSourceContractPath = path.join(root, 'src', 'styles', 'core-source-contract.json');
const jsSourceContractPath = path.join(root, 'src', 'core-js-source-contract.json');

if (!fs.existsSync(migrationManifestPath)) fail('Missing src/legacy/migration-manifest.json');
if (!fs.existsSync(indexPath)) fail('Missing index.html');

const html = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(migrationManifestPath, 'utf8'));
const intentionalPatches = fs.existsSync(intentionalPatchesPath)
  ? JSON.parse(fs.readFileSync(intentionalPatchesPath, 'utf8'))
  : { patches: [] };
const domains = fs.existsSync(domainManifestPath)
  ? JSON.parse(fs.readFileSync(domainManifestPath, 'utf8'))
  : { entries: [] };
const adoption = fs.existsSync(adoptionManifestPath)
  ? JSON.parse(fs.readFileSync(adoptionManifestPath, 'utf8'))
  : null;

assert(manifest.schemaVersion === 2, 'Unexpected migration manifest schema');
assert(manifest.parser === 'parse5@8.0.1', 'Unexpected migration parser/version');
assert(manifest.source === 'index.html', 'Unexpected migration source');
assert(Array.isArray(manifest.styles), 'Manifest styles must be an array');
assert(Array.isArray(manifest.scripts), 'Manifest scripts must be an array');
assert(manifest.styles.length === manifest.extractedStyleBlocks, 'Style count does not match manifest');
assert(manifest.scripts.length === manifest.extractedScriptBlocks, 'Script count does not match manifest');

const htmlAuthority = verifyHtmlAuthority(html);
const cssAuthority = verifyCoreCssAuthority();
const jsAuthority = verifyCoreJsAuthority();

assert(intentionalPatches.schemaVersion === undefined || intentionalPatches.schemaVersion === 1,
  'Unexpected intentional legacy patch manifest schema');
assert(intentionalPatches.stage === undefined || intentionalPatches.stage === 'intentional-legacy-patch-evidence',
  'Unexpected intentional legacy patch stage');
assert(intentionalPatches.originalExtractionManifest === undefined
  || intentionalPatches.originalExtractionManifest === 'src/legacy/migration-manifest.json',
'Unexpected original extraction manifest reference');
assert(Array.isArray(intentionalPatches.patches), 'Intentional legacy patches must be an array');

if (adoption) {
  assert(adoption.schemaVersion === 1, 'Unexpected CSS runtime adoption manifest schema');
  assert(adoption.generatedBy === 'scripts/adopt-css-domain-paths.mjs', 'Unexpected CSS runtime adoption generator');
  assert(adoption.contentChanged === false, 'CSS runtime adoption must preserve content');
  assert(adoption.cascadeOrderChanged === false, 'CSS runtime adoption must preserve cascade order');
  if (!htmlAuthority.active) {
    assert(sha256(html) === adoption.indexSha256AfterAdoption, 'index.html hash differs from CSS runtime-adoption manifest');
  }
} else if (!htmlAuthority.active) {
  assert(sha256(html) === manifest.indexSha256AfterMigration, 'index.html hash differs from migration manifest');
}

const document = parse(html, { sourceCodeLocationInfo: true });
const parsed = collectRelevantNodes(document);
assert(parsed.inlineStyles.length === 0, `Expected 0 parsed inline style elements, found ${parsed.inlineStyles.length}`);
assert(parsed.inlineScripts.length === 0, `Expected 0 parsed eligible inline JS elements, found ${parsed.inlineScripts.length}`);

const domainBySource = new Map((domains.entries || []).map(entry => [entry.source, entry]));
const adoptedSources = new Set((adoption?.entries || []).map(entry => entry.source));
const adoptedBySource = new Map((adoption?.entries || []).map(entry => [entry.source, entry]));
const patchByFile = new Map();
for (const patch of intentionalPatches.patches) {
  assert(patch && typeof patch.file === 'string', 'Intentional patch is missing file');
  assert(!patchByFile.has(patch.file), `Duplicate intentional patch entry: ${patch.file}`);
  assertSafeGeneratedPath(patch.file, 'src/legacy/scripts/');
  assert(typeof patch.originalSha256 === 'string' && /^[a-f0-9]{64}$/.test(patch.originalSha256),
    `Invalid original hash for intentional patch ${patch.file}`);
  assert(typeof patch.sha256 === 'string' && /^[a-f0-9]{64}$/.test(patch.sha256),
    `Invalid current hash for intentional patch ${patch.file}`);
  assert(Number.isInteger(patch.bytes) && patch.bytes >= 0, `Invalid byte count for intentional patch ${patch.file}`);
  assert(typeof patch.task === 'string' && patch.task.trim(), `Missing task for intentional patch ${patch.file}`);
  assert(typeof patch.reason === 'string' && patch.reason.trim(), `Missing reason for intentional patch ${patch.file}`);
  patchByFile.set(patch.file, patch);
}

const scriptManifestByFile = new Map(manifest.scripts.map(entry => [entry.file, entry]));
for (const [file, patch] of patchByFile) {
  const original = scriptManifestByFile.get(file);
  assert(original, `Intentional patch does not map to an extracted script: ${file}`);
  assert(original.sha256 === patch.originalSha256,
    `Intentional patch original hash does not match extraction manifest: ${file}`);
}

const expectedStyles = manifest.styles.map(entry => {
  const domain = domainBySource.get(entry.file);
  const useSemantic = domain && adoptedSources.has(entry.file);
  const adopted = adoptedBySource.get(entry.file);
  const file = useSemantic ? domain.destination : entry.file;
  let expectedHash = adopted?.sha256 || entry.sha256;
  let sourceAuthority = 'historical-provenance';
  if (cssAuthority.active && entry.file === cssAuthority.runtimeTarget) {
    expectedHash = cssAuthority.runtimeSha256;
    sourceAuthority = 'semantic-css-source';
  } else if (useSemantic) {
    sourceAuthority = 'promoted-semantic-css';
  }
  return {
    source: entry.file,
    file,
    sha256: expectedHash,
    semantic: Boolean(useSemantic),
    sourceAuthority,
  };
});

const expectedScripts = manifest.scripts.map(entry => {
  const patch = patchByFile.get(entry.file);
  let expectedHash = patch ? patch.sha256 : entry.sha256;
  let sourceAuthority = patch ? 'declared-legacy-patch' : 'historical-provenance';
  if (jsAuthority.active && entry.file === jsAuthority.runtimeTarget) {
    expectedHash = jsAuthority.runtimeSha256;
    sourceAuthority = 'semantic-js-source';
  }
  return { ...entry, expectedHash, sourceAuthority };
});

const expectedStyleHrefs = expectedStyles.map(entry => `./${entry.file}`);
const expectedScriptSrcs = expectedScripts.map(entry => `./${entry.file}`);

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
  const absolute = path.join(root, entry.file);
  assert(fs.existsSync(absolute), `Missing stylesheet ${entry.file}`);
  const body = fs.readFileSync(absolute, 'utf8');
  assert(sha256(body) === entry.sha256, `Stylesheet hash mismatch: ${entry.file}`);
}

for (const entry of expectedScripts) {
  assertSafeGeneratedPath(entry.file, 'src/legacy/scripts/');
  assert(['classic', 'module'].includes(entry.scriptMode), `Unknown script mode for ${entry.file}`);
  const absolute = path.join(root, entry.file);
  assert(fs.existsSync(absolute), `Missing extracted script ${entry.file}`);
  const body = fs.readFileSync(absolute, 'utf8');
  assert(sha256(body) === entry.expectedHash, `Script hash mismatch: ${entry.file}`);
  const patch = patchByFile.get(entry.file);
  if (patch) {
    assert(Buffer.byteLength(body, 'utf8') === patch.bytes,
      `Intentional patch byte-count mismatch: ${entry.file}`);
  }
  syntaxCheck(entry, absolute, body);
}

console.log(
  `SC-031 structure verification PASS: ${manifest.styles.length} parsed styles, `
  + `${manifest.scripts.length} parsed scripts, 0 eligible inline JS, 0 parsed inline styles, `
  + `${adoption?.entries?.length || 0} semantic CSS runtime paths, `
  + `${patchByFile.size} declared legacy patch override(s), `
  + `HTML authority=${htmlAuthority.label}, CSS core authority=${cssAuthority.label}, JS core authority=${jsAuthority.label}.`
);

function verifyHtmlAuthority(currentHtml) {
  if (!fs.existsSync(htmlSourceContractPath)) return { active: false, label: 'historical-provenance' };
  const contract = JSON.parse(fs.readFileSync(htmlSourceContractPath, 'utf8'));
  assert(contract.schemaVersion === 1, 'Unexpected HTML source contract schema');
  assert(contract.authority === 'split-source', 'Unexpected HTML source authority');
  assert(contract.generatedBy === 'scripts/render-index-from-source.mjs', 'Unexpected HTML source generator');
  assert(contract.generatedRuntime === 'index.html', 'Unexpected HTML generated runtime');
  assert(typeof contract.template === 'string', 'HTML source contract template missing');
  assert(Array.isArray(contract.fragments) && contract.fragments.length === contract.fragmentCount,
    'HTML source contract fragment count mismatch');
  assertSafeRepoPath(contract.template, 'src/shell/');
  let rebuilt = readRepoText(contract.template);
  const seenTokens = new Set();
  for (const fragment of contract.fragments) {
    assert(fragment && typeof fragment.file === 'string' && typeof fragment.token === 'string',
      'HTML source contract fragment malformed');
    assertSafeRepoPath(fragment.file, 'src/');
    assert(!seenTokens.has(fragment.token), `Duplicate HTML source token: ${fragment.token}`);
    seenTokens.add(fragment.token);
    const count = rebuilt.split(fragment.token).length - 1;
    assert(count === 1, `HTML source token must occur exactly once: ${fragment.token} (${count})`);
    const body = readRepoText(fragment.file);
    for (const protectedId of fragment.protectedIds || []) {
      assert(body.includes(`id="${protectedId}"`) || body.includes(`id='${protectedId}'`),
        `${fragment.file} lost protected id ${protectedId}`);
    }
    rebuilt = rebuilt.replace(fragment.token, body);
  }
  assert(!rebuilt.includes('<!-- @SQ:SOURCE '), 'Unresolved HTML source token remains after reconstruction');
  assert(rebuilt === currentHtml, 'split HTML source does not reconstruct current index.html');
  return { active: true, label: 'split-source' };
}

function verifyCoreCssAuthority() {
  if (!fs.existsSync(cssSourceContractPath)) {
    return { active: false, label: 'historical-provenance', runtimeTarget: null, runtimeSha256: null };
  }
  const contract = JSON.parse(fs.readFileSync(cssSourceContractPath, 'utf8'));
  assert(contract.schemaVersion === 1, 'Unexpected CSS source contract schema');
  assert(contract.authority === 'semantic-css-source', 'Unexpected CSS source authority');
  assert(contract.generatedBy === 'scripts/build-core-styles-from-source.mjs', 'Unexpected CSS source generator');
  assert(Array.isArray(contract.domains) && contract.domains.length === contract.domainCount,
    'CSS source contract domain count mismatch');
  assertSafeRepoPath(contract.runtimeTarget, 'src/legacy/styles/');
  const ordered = [...contract.domains].sort((a, b) => a.order - b.order);
  const seen = new Set();
  const parts = ordered.map((domain, index) => {
    assert(domain.order === index + 1, `Non-contiguous CSS source order at ${domain.file}`);
    assertSafeRepoPath(domain.file, 'src/styles/');
    assert(!seen.has(domain.file), `Duplicate CSS source domain ${domain.file}`);
    seen.add(domain.file);
    const body = readRepoText(domain.file);
    if (domain.anchor) assert(body.startsWith(domain.anchor), `CSS source lost protected anchor: ${domain.file}`);
    return body;
  });
  const rebuilt = parts.join('');
  const runtime = readRepoText(contract.runtimeTarget);
  assert(rebuilt === runtime, `semantic CSS source does not reconstruct ${contract.runtimeTarget}`);
  return {
    active: true,
    label: 'semantic-css-source',
    runtimeTarget: contract.runtimeTarget,
    runtimeSha256: sha256(runtime),
  };
}

function verifyCoreJsAuthority() {
  if (!fs.existsSync(jsSourceContractPath)) {
    return { active: false, label: 'historical-provenance', runtimeTarget: null, runtimeSha256: null };
  }
  const contract = JSON.parse(fs.readFileSync(jsSourceContractPath, 'utf8'));
  assert(contract.schemaVersion === 1, 'Unexpected JS source contract schema');
  assert(contract.authority === 'semantic-js-source', 'Unexpected JS source authority');
  assert(contract.generatedBy === 'scripts/build-core-js-from-source.mjs', 'Unexpected JS source generator');
  assert(Array.isArray(contract.domains) && contract.domains.length === contract.domainCount,
    'JS source contract domain count mismatch');
  assertSafeRepoPath(contract.runtimeTarget, 'src/legacy/scripts/');
  const ordered = [...contract.domains].sort((a, b) => a.order - b.order);
  const seen = new Set();
  const parts = ordered.map((domain, index) => {
    assert(domain.order === index + 1, `Non-contiguous JS source order at ${domain.file}`);
    assertSafeRepoPath(domain.file, 'src/');
    assert(!seen.has(domain.file), `Duplicate JS source domain ${domain.file}`);
    seen.add(domain.file);
    const body = readRepoText(domain.file);
    assert(typeof domain.marker === 'string' && body.includes(domain.marker),
      `JS source lost protected marker ${domain.marker}: ${domain.file}`);
    return body;
  });
  const rebuilt = parts.join('');
  const runtime = readRepoText(contract.runtimeTarget);
  assert(rebuilt === runtime, `semantic JS source does not reconstruct ${contract.runtimeTarget}`);
  return {
    active: true,
    label: 'semantic-js-source',
    runtimeTarget: contract.runtimeTarget,
    runtimeSha256: sha256(runtime),
  };
}

function readRepoText(file) {
  const absolute = path.resolve(root, file);
  assert(absolute === root || absolute.startsWith(`${root}${path.sep}`), `Path escapes repository root: ${file}`);
  assert(fs.existsSync(absolute), `Missing required source file ${file}`);
  return fs.readFileSync(absolute, 'utf8');
}

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

function syntaxCheck(entry, absolute, body) {
  let checkPath = absolute;
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
  assertSafeRepoPath(file, prefix);
}

function assertSafeRepoPath(file, prefix) {
  assert(typeof file === 'string' && file.startsWith(prefix), `Unexpected path outside ${prefix}: ${String(file)}`);
  const resolved = path.resolve(root, file);
  const allowed = path.resolve(root, prefix);
  assert(resolved.startsWith(`${allowed}${path.sep}`), `Path escapes expected directory: ${file}`);
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
