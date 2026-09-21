import fs from 'node:fs';
import assert from 'node:assert/strict';

const meta = JSON.parse(fs.readFileSync('assets/release-metadata.json','utf8'));
const core = fs.readFileSync('src/legacy/quarantine/core-pre-modals.js','utf8');
const css = fs.readFileSync('src/styles/home/start-hero.css','utf8');

assert.equal(meta.schemaVersion,1);
assert.match(meta.currentVersion,/^\d+\.\d+\.\d+$/);
assert(meta.currentReleaseId,'currentReleaseId required');
const sc050 = meta.releases.find((row)=>row.releaseId === 'SC-050');
assert(sc050,'SC-050 foundation release must remain in history');
assert.equal(sc050.version,'0.1.0','SC-050 must remain the first public v0.1.0 release');
assert(Array.isArray(meta.releases) && meta.releases.length >= 20);
assert.equal(meta.releases[0].version,meta.currentVersion);
assert.equal(meta.releases[0].releaseId,meta.currentReleaseId);

const ids = meta.releases.map((r)=>r.releaseId);
assert.equal(new Set(ids).size,ids.length,'release identifiers must be unique');
for (let i=0;i<meta.releases.length;i++){
  const row=meta.releases[i];
  assert(row.releaseId && row.date && row.title);
  assert(Array.isArray(row.changes) && row.changes.length > 0);
  if (i>0){
    assert(meta.releases[i-1].date >= row.date,'release notes must be newest first');
  }
}

assert(core.includes("./assets/release-metadata.json"));
assert(core.includes("sqReleaseVersionBtn"));
assert(core.includes("__sqOpenReleaseNotes"));
assert(core.includes("window.sqModal"));
assert(core.includes("onBack: function(){}"));
assert(css.includes(".sq-release-version"));
assert(css.includes(".sq-release-notes-body"));
assert(css.includes("overflow-y:auto"));
assert(css.includes(".sq-release-entry.is-current"));

console.log('Release metadata/static contract PASS:', meta.currentVersion, meta.currentReleaseId, meta.releases.length, 'entries');
