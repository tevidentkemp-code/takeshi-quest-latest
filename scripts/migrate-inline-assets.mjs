import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'parse5';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const legacyRoot = path.join(root, 'src', 'legacy');
const styleDir = path.join(legacyRoot, 'styles');
const scriptDir = path.join(legacyRoot, 'scripts');
const manifestPath = path.join(legacyRoot, 'migration-manifest.json');

const html = fs.readFileSync(indexPath, 'utf8');
const originalSha = sha256(html);
const document = parse(html, { sourceCodeLocationInfo: true });
const targets = collectExtractionTargets(document, html);

if (!targets.length) {
  console.log('SC-031 migration: no eligible parsed inline assets remain; nothing to change.');
  process.exit(0);
}

// Only clear generated output after we have positively identified real parsed targets.
fs.rmSync(legacyRoot, { recursive: true, force: true });
fs.mkdirSync(styleDir, { recursive: true });
fs.mkdirSync(scriptDir, { recursive: true });

let styleNo = 0;
let scriptNo = 0;
const styles = [];
const scripts = [];
const replacements = [];

for (const target of targets) {
  if (target.kind === 'style') {
    styleNo += 1;
    const file = `inline-${String(styleNo).padStart(3, '0')}.css`;
    const repoFile = `src/legacy/styles/${file}`;
    const rel = `./${repoFile}`;
    const rewritten = rewriteCssUrls(target.body, '../../../');
    fs.writeFileSync(path.join(styleDir, file), rewritten, 'utf8');

    styles.push({
      order: styleNo,
      file: repoFile,
      sha256: sha256(rewritten),
      originalAttributes: target.attributeSource.trim(),
      source: locationSummary(target.location)
    });
    replacements.push({
      startOffset: target.location.startOffset,
      endOffset: target.location.endOffset,
      value: `<link rel="stylesheet" href="${rel}"${copyStyleAttributes(target.attributeSource)}>`
    });
    continue;
  }

  scriptNo += 1;
  const file = `inline-${String(scriptNo).padStart(3, '0')}.js`;
  const repoFile = `src/legacy/scripts/${file}`;
  const rel = `./${repoFile}`;
  fs.writeFileSync(path.join(scriptDir, file), target.body, 'utf8');

  scripts.push({
    order: scriptNo,
    file: repoFile,
    sha256: sha256(target.body),
    scriptMode: target.scriptMode,
    originalAttributes: target.attributeSource.trim(),
    source: locationSummary(target.location)
  });
  replacements.push({
    startOffset: target.location.startOffset,
    endOffset: target.location.endOffset,
    value: `<script src="${rel}"${copyScriptAttributes(target.attributeSource, target.scriptMode)}></script>`
  });
}

// Reverse-order source replacement is deliberately byte-preserving everywhere outside
// the exact parsed elements being extracted.
replacements.sort((a, b) => b.startOffset - a.startOffset);
let migrated = html;
for (const replacement of replacements) {
  migrated = migrated.slice(0, replacement.startOffset)
    + replacement.value
    + migrated.slice(replacement.endOffset);
}

const migratedDocument = parse(migrated, { sourceCodeLocationInfo: true });
const remaining = collectExtractionTargets(migratedDocument, migrated);
if (remaining.length !== 0) {
  throw new Error(`Expected zero parsed eligible inline assets after migration; found ${remaining.length}`);
}

fs.writeFileSync(indexPath, migrated, 'utf8');
const manifest = {
  schemaVersion: 2,
  generatedBy: 'scripts/migrate-inline-assets.mjs',
  parser: 'parse5@8.0.1',
  source: 'index.html',
  sourceSha256BeforeMigration: originalSha,
  indexSha256AfterMigration: sha256(migrated),
  extractedStyleBlocks: styles.length,
  extractedScriptBlocks: scripts.length,
  styles,
  scripts
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`SC-031 migration complete: ${styles.length} parsed style blocks + ${scripts.length} parsed JavaScript blocks extracted.`);

function collectExtractionTargets(rootNode, source) {
  const found = [];

  const visit = node => {
    if (!node || typeof node !== 'object') return;

    const isHtmlElement = node.namespaceURI === HTML_NS && typeof node.tagName === 'string';
    if (isHtmlElement && (node.tagName === 'style' || node.tagName === 'script')) {
      const location = node.sourceCodeLocation;
      if (location?.startTag && location?.endTag) {
        if (node.tagName === 'style') {
          found.push(buildTarget('style', node, location, source));
        } else if (!getNodeAttr(node, 'src') && isExecutableJavascriptNode(node)) {
          found.push(buildTarget('script', node, location, source));
        }
      }
    }

    // parse5 stores <template> descendants under node.content rather than childNodes.
    // Intentionally do not traverse template content in Phase 1: it is inert markup and
    // externalising scripts/styles inside it could change later cloning semantics.
    for (const child of node.childNodes || []) visit(child);
  };

  visit(rootNode);
  return found.sort((a, b) => a.location.startOffset - b.location.startOffset);
}

function buildTarget(kind, node, location, source) {
  const startTag = source.slice(location.startTag.startOffset, location.startTag.endOffset);
  const attributeSource = extractRawAttributeSource(startTag);
  const body = source.slice(location.startTag.endOffset, location.endTag.startOffset);
  return {
    kind,
    body,
    attributeSource,
    scriptMode: kind === 'script' && isModuleNode(node) ? 'module' : 'classic',
    location
  };
}

function extractRawAttributeSource(startTag) {
  const match = startTag.match(/^<\s*[^\s/>]+([\s\S]*?)>$/);
  if (!match) throw new Error(`Could not preserve attributes from parsed start tag: ${startTag.slice(0, 120)}`);
  return match[1] || '';
}

function getNodeAttr(node, name) {
  const attr = (node.attrs || []).find(item => String(item.name).toLowerCase() === name.toLowerCase());
  return attr ? attr.value : null;
}

function isModuleNode(node) {
  return String(getNodeAttr(node, 'type') || '').trim().toLowerCase() === 'module';
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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function copyStyleAttributes(attributeSource) {
  const cleaned = attributeSource
    .replace(/\s+scoped(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    .trim();
  return cleaned ? ` ${cleaned}` : '';
}

function copyScriptAttributes(attributeSource, scriptMode) {
  let cleaned = attributeSource;
  if (scriptMode === 'classic') {
    // async/defer have no effect on an inline classic script but would change execution
    // after adding src. Strip them so the replacement remains parser-blocking in place.
    cleaned = cleaned
      .replace(/\s+async(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
      .replace(/\s+defer(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
  }
  cleaned = cleaned.trim();
  return cleaned ? ` ${cleaned}` : '';
}

function rewriteCssUrls(css, prefix) {
  const withUrls = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote, raw) => {
    const value = raw.trim();
    if (isAbsoluteCssReference(value)) return full;
    const normalized = value.replace(/^\.\//, '');
    const q = quote || '';
    return `url(${q}${prefix}${normalized}${q})`;
  });

  return withUrls.replace(/@import\s+(["'])([^"']+)\1/gi, (full, quote, raw) => {
    const value = raw.trim();
    if (isAbsoluteCssReference(value)) return full;
    const normalized = value.replace(/^\.\//, '');
    return `@import ${quote}${prefix}${normalized}${quote}`;
  });
}

function isAbsoluteCssReference(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|var\()/i.test(value);
}

function locationSummary(location) {
  return {
    startLine: location.startLine,
    startCol: location.startCol,
    endLine: location.endLine,
    endCol: location.endCol
  };
}
