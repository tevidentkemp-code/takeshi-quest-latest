import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error('Usage: node verify-release-metadata-policy.mjs <base-sha> <head-sha>');
  process.exit(2);
}

const changed = execFileSync('git', ['diff', '--name-only', base, head], { encoding:'utf8' })
  .split(/\r?\n/)
  .map((value)=>value.trim())
  .filter(Boolean);

const metadataPath = 'assets/release-metadata.json';
const runtimePatterns = [
  /^index\.html$/,
  /^src\//,
  /^assets\/(?!release-metadata\.json$)/,
  /^supabase\/migrations\//,
  /^supabase\/functions\//,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^vite\.config\./
];

const runtimeChanges = changed.filter((file)=>runtimePatterns.some((pattern)=>pattern.test(file)));
if (!runtimeChanges.length) {
  console.log('Release metadata policy PASS: no production-runtime changes in this PR.');
  process.exit(0);
}

assert(
  changed.includes(metadataPath),
  'Production-runtime changes require assets/release-metadata.json to change in the same PR.'
);

const meta = JSON.parse(fs.readFileSync(metadataPath,'utf8'));
assert.equal(meta.schemaVersion,1);
assert.match(meta.currentVersion,/^\d+\.\d+\.\d+$/);
assert(Array.isArray(meta.releases) && meta.releases.length > 0);
assert.equal(meta.releases[0].version,meta.currentVersion,'currentVersion must equal newest release entry version');
assert.equal(meta.releases[0].releaseId,meta.currentReleaseId,'currentReleaseId must equal newest release entry ID');

console.log(
  'Release metadata policy PASS:',
  runtimeChanges.length,
  'runtime file(s); current public release',
  'v'+meta.currentVersion,
  meta.currentReleaseId
);
