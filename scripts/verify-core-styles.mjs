import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const ROOT = process.cwd();
const STYLE_MANIFEST = 'src/core-style-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';
const INDEX = 'index.html';

const abs = (p) => path.join(ROOT, p);
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const fail = (message) => { console.error(`FAIL core-style verification: ${message}`); process.exit(1); };
const readText = (file) => {
  if (!fs.existsSync(abs(file))) fail(`missing ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
};

function parseCss(text, file) {
  try {
    postcss.parse(text, { from: file });
  } catch (error) {
    fail(`CSS parse failed for ${file}: ${error?.message || error}`);
  }
}

const manifest = JSON.parse(readText(STYLE_MANIFEST));
if (manifest.schemaVersion !== 1) fail(`unsupported style manifest schema ${manifest.schemaVersion}`);
if (manifest.strategy !== 'semantic-source-byte-identical-classic-runtime') fail('unexpected style strategy');
if (!Array.isArray(manifest.domains) || manifest.domains.length !== 3) fail('expected exactly 3 semantic core style domains');

const ordered = [...manifest.domains].sort((a, b) => a.order - b.order);
ordered.forEach((domain, index) => {
  if (domain.order !== index + 1) fail(`non-contiguous style order at ${domain.file}`);
  const text = readText(domain.file);
  if (!text.includes(domain.marker)) fail(`${domain.file} missing canonical marker ${domain.marker}`);
  if (sha256(text) !== domain.sha256) fail(`${domain.file} hash differs from style manifest; rerun split-core-styles.mjs`);
  parseCss(text, domain.file);
});

const runtime = readText(manifest.runtimeTarget);
const assembled = ordered.map((domain) => readText(domain.file)).join('');
if (assembled !== runtime) fail('semantic style domains do not concatenate byte-for-byte to runtime stylesheet');
if (sha256(runtime) !== manifest.runtimeSha256) fail('style runtime hash differs from style manifest');
parseCss(runtime, manifest.runtimeTarget);

const migration = JSON.parse(readText(MIGRATION_MANIFEST));
const entry = (migration.styles || []).find((item) => item.file === manifest.runtimeTarget);
if (!entry) fail('generated style runtime missing from legacy migration manifest');
if (entry.sha256 !== sha256(runtime)) fail('legacy migration manifest style runtime hash is stale');

const index = readText(INDEX);
const escaped = manifest.runtimeTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refs = index.match(new RegExp(escaped, 'g')) || [];
if (refs.length !== 1) fail(`index.html must reference ${manifest.runtimeTarget} exactly once; found ${refs.length}`);

console.log(`PASS core-style verification: ${ordered.length} source domains, byte-identical runtime ${manifest.runtimeTarget}`);
console.log(`runtime sha256 ${sha256(runtime)}`);
