import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RELEASE_METADATA, PUBLIC_VERSION } from '../../src/release/release-metadata.mjs';

assert.equal(RELEASE_METADATA.scheme, 'CalVer YYYY.MM.DD.N');
assert.equal(PUBLIC_VERSION, '2026.09.21.1');
assert.equal(RELEASE_METADATA.current, RELEASE_METADATA.releases[0].version);
assert.equal(RELEASE_METADATA.releases[0].date, '2026-09-21');
assert(RELEASE_METADATA.releases[0].notes.some(x => /Volde-D’eux/i.test(x)));
assert(RELEASE_METADATA.releases[0].notes.some(x => /DMD commentary/i.test(x)));
assert(RELEASE_METADATA.releases[0].notes.some(x => /Release Notes/i.test(x)));

const ui = fs.readFileSync('src/home/release-info.mjs','utf8');
for (const needle of [
  "import { RELEASE_METADATA, PUBLIC_VERSION } from '../release/release-metadata.mjs';",
  "badge.dataset.version = PUBLIC_VERSION",
  "role','dialog'",
  "aria-modal','true'",
  "sq-release-body",
  "overflow-y:auto",
  "Back",
  "Close",
]) assert(ui.includes(needle), `release UI missing contract: ${needle}`);

for (const path of ['index.html','src/shell/index.template.html']) {
  const source = fs.readFileSync(path,'utf8');
  const matches = source.match(/src\/home\/release-info\.mjs/g) || [];
  assert.equal(matches.length,1,`${path} must load release info exactly once`);
}

const doc = fs.readFileSync('docs/release/SC050_PUBLIC_RELEASE_METADATA.md','utf8');
assert(doc.includes('Every future production release must:'));
assert(doc.includes('must not be closed if its displayed version and canonical metadata disagree'));

console.log('SC-050 public release metadata static acceptance PASS');
