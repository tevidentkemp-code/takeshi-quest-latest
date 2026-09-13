# SC-031 JavaScript Source Authority

## Status

The ten semantic core JavaScript domains under `src/` are the authoritative source for the classic compatibility runtime `src/legacy/scripts/inline-005.js`.

The compatibility runtime remains in the repository only because the existing application still loads classic scripts in the historical order. It is generated output and must not be edited directly.

## Authoritative sources

The stable source order is recorded in `src/core-js-source-contract.json` and currently contains:

1. `src/app/boot.js`
2. `src/app/util.js`
3. `src/app/state.js`
4. `src/app/router-ui.js`
5. `src/live-game/live-v2.js`
6. `src/game/engine.js`
7. `src/services/cloud.js`
8. `src/legacy/quarantine/core-pre-modals.js`
9. `src/ui/modals.js`
10. `src/legacy/quarantine/core-post-modals.js`

The two quarantine files remain explicitly quarantined because their internal ownership is not yet safe to split further. Their presence does not make the generated runtime authoritative.

## Build contract

`scripts/build-core-js-from-source.mjs`:

- bootstraps the active source contract once from the verified historical `src/core-domain-manifest.json`;
- validates canonical source order, paths and section markers;
- syntax-checks every source file and the assembled runtime;
- concatenates semantic sources byte-for-byte in the protected historical order;
- emits SHA-256 build evidence;
- can verify parity with the committed compatibility runtime.

`scripts/verify-core-domains.mjs` verifies the active source contract once it exists. Historical per-file hashes are used only during the one-time authority transition.

The old runtime-first splitter `scripts/split-core-domains.mjs` is retired and fails closed.

## CI

`.github/workflows/sc031-js-authority.yml` separates verification from repository write permission.

The read-only job:

- confirms production ancestry;
- builds the compatibility runtime from semantic source;
- requires exact bootstrap parity on the first transition;
- materializes source-generated HTML and CSS as well;
- runs the full browser regression suite;
- publishes an exact, hashed write artifact.

Only after that succeeeds does the minimal write job commit the generated runtime and source contract. The write job rejects unexpected files and refuses to write if the branch head has moved.

`setup-qa.yml` independently regenerates HTML, core JavaScript and core CSS from source before running scoring/setup regressions, so stale committed compatibility files cannot hide a source regression.

## Non-goals

This step does not:

- convert the app to ES modules;
- rename public globals or protected functions;
- alter scoring, modes, rankings, persistence or Supabase behaviour;
- refactor quarantined legacy logic;
- release or deploy production.

Those changes require separate bounded work and their own evidence.
