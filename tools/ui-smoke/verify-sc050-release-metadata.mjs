import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RELEASE_METADATA } from '../../src/release/release-metadata.mjs';

assert.equal(RELEASE_METADATA.schemaVersion, 1);
assert.equal(RELEASE_METADATA.versionScheme, 'semver');
assert.match(RELEASE_METADATA.currentVersion, /^\d+\.\d+\.\d+$/);
assert(Array.isArray(RELEASE_METADATA.releases) && RELEASE_METADATA.releases.length >= 2);
assert.equal(RELEASE_METADATA.releases[0].version, RELEASE_METADATA.currentVersion);
assert.equal(RELEASE_METADATA.releases[0].date, RELEASE_METADATA.releasedAt);
assert.equal(new Set(RELEASE_METADATA.releases.map(x => x.version)).size, RELEASE_METADATA.releases.length);
for (const release of RELEASE_METADATA.releases) {
  assert.match(release.version, /^\d+\.\d+\.\d+$/);
  assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
  assert(release.title && Array.isArray(release.changes) && release.changes.length > 0);
}
const home = fs.readFileSync(new URL('../../src/ui/screens/home/home.html', import.meta.url), 'utf8');
assert(home.includes('id="sqReleaseVersionBtn"'));
assert(!home.includes('./src/release/release-ui.mjs'), 'Home must not create a second Vite module entry');
assert(!home.includes('v1.1.0'), 'Home must not duplicate canonical version truth');
const bootstrap = fs.readFileSync(new URL('../../src/live-game/dmd/bootstrap.mjs', import.meta.url), 'utf8');
assert(bootstrap.includes("import '../../release/release-ui.mjs'"), 'Release UI must ride the existing module entry');
const ui = fs.readFileSync(new URL('../../src/release/release-ui.mjs', import.meta.url), 'utf8');
assert(ui.includes("import { RELEASE_METADATA } from './release-metadata.mjs'"));
assert(ui.includes('data-release-action="back"'));
assert(ui.includes('data-release-action="close"'));
const css = fs.readFileSync(new URL('../../src/styles/release/release-notes.css', import.meta.url), 'utf8');
assert(css.includes('min-height:44px'));
assert(css.includes('overflow-y:auto'));
console.log('SC-050 release metadata contract PASS');
