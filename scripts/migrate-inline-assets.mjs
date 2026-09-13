import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const legacyRoot = path.join(root, 'src', 'legacy');
const styleDir = path.join(legacyRoot, 'styles');
const scriptDir = path.join(legacyRoot, 'scripts');
const manifestPath = path.join(legacyRoot, 'migration-manifest.json');

const html = fs.readFileSync(indexPath, 'utf8');
const originalSha = sha256(html);

fs.rmSync(legacyRoot, { recursive: true, force: true });
fs.mkdirSync(styleDir, { recursive: true });
fs.mkdirSync(scriptDir, { recursive: true });

let styleNo = 0;
let scriptNo = 0;
const styles = [];
const scripts = [];

const tagPattern = /<style\b([^>]*)>([\s\S]*?)<\/style>|<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

const migrated = html.replace(tagPattern, (full, styleAttrs = '', styleBody = '', scriptAttrs = '', scriptBody = '') => {
  if (full.slice(0, 6).toLowerCase() === '<style') {
    styleNo += 1;
    const file = `inline-${String(styleNo).padStart(3, '0')}.css`;
    const rel = `./src/legacy/styles/${file}`;
    const rewritten = rewriteCssUrls(styleBody, '../../../');
    fs.writeFileSync(path.join(styleDir, file), rewritten, 'utf8');
    styles.push({
      order: styleNo,
      file: `src/legacy/styles/${file}`,
      sha256: sha256(rewritten),
      originalAttributes: styleAttrs.trim()
    });
    return `<link rel="stylesheet" href="${rel}"${copyStyleAttributes(styleAttrs)}>`;
  }

  const attrs = scriptAttrs || '';
  if (hasAttr(attrs, 'src') || !isExecutableJavascript(attrs)) return full;

  scriptNo += 1;
  const file = `inline-${String(scriptNo).padStart(3, '0')}.js`;
  const rel = `./src/legacy/scripts/${file}`;
  fs.writeFileSync(path.join(scriptDir, file), scriptBody, 'utf8');
  scripts.push({
    order: scriptNo,
    file: `src/legacy/scripts/${file}`,
    sha256: sha256(scriptBody),
    originalAttributes: attrs.trim()
  });
  return `<script src="${rel}"${copyScriptAttributes(attrs)}></script>`;
});

const postInlineStyles = (migrated.match(/<style\b/gi) || []).length;
const postEligibleInlineScripts = [...migrated.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !hasAttr(attrs, 'src') && isExecutableJavascript(attrs)).length;

if (!styles.length && !scripts.length) {
  console.log('SC-031 migration: no eligible inline assets remain; nothing to change.');
  process.exit(0);
}
if (postInlineStyles !== 0) {
  throw new Error(`Expected zero inline <style> tags after migration; found ${postInlineStyles}`);
}
if (postEligibleInlineScripts !== 0) {
  throw new Error(`Expected zero eligible inline JavaScript blocks after migration; found ${postEligibleInlineScripts}`);
}

fs.writeFileSync(indexPath, migrated, 'utf8');
const manifest = {
  schemaVersion: 1,
  generatedBy: 'scripts/migrate-inline-assets.mjs',
  source: 'index.html',
  sourceSha256BeforeMigration: originalSha,
  indexSha256AfterMigration: sha256(migrated),
  extractedStyleBlocks: styles.length,
  extractedScriptBlocks: scripts.length,
  styles,
  scripts
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`SC-031 migration complete: ${styles.length} style blocks + ${scripts.length} JavaScript blocks extracted.`);

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

function copyStyleAttributes(attrs) {
  const cleaned = attrs
    .replace(/\s+scoped(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    .trim();
  return cleaned ? ` ${cleaned}` : '';
}

function copyScriptAttributes(attrs) {
  // async/defer are ignored on inline classic scripts but alter execution once src is added.
  // Strip them so parser-blocking execution remains identical to the original inline location.
  const cleaned = attrs
    .replace(/\s+async(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    .replace(/\s+defer(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    .trim();
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
