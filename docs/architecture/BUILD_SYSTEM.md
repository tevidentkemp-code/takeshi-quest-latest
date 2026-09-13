# SC-031 Build System Candidate

## Status

Vite 8.3.0 is introduced during SC-031 as a **parity-tested build candidate only**. It is not yet the production deployment authority and it does not replace the current static GitHub Pages rollback path.

## Source-first build order

The application must first materialize its compatibility runtime from authoritative source:

1. split HTML source -> `index.html`
2. semantic core CSS -> `src/legacy/styles/inline-002.css`
3. semantic core JavaScript -> `src/legacy/scripts/inline-005.js`
4. source-authority/structure verification
5. Vite static build -> `dist/`
6. full browser/scoring regression against `dist/`

`scripts/materialize-runtime.mjs` performs steps 1–4. `npm run build` then invokes Vite.

## Compatibility strategy

SC-031 deliberately preserves classic script load order and global behaviour. Vite is not being used to convert the legacy classic scripts into ES modules as part of this migration.

`vite.config.mjs` uses a relative `base: './'` so the candidate build is portable between GitHub Pages repository paths and a future custom-domain deployment. During this compatibility phase the build also copies the legacy runtime tree, semantic styles and static assets into `dist` so any deliberately unbundled classic paths remain available.

Minification is disabled during parity proving to make failures easier to diagnose. Source maps are enabled. Optimisation can be considered only after behavioural parity is established.

## Verification

`.github/workflows/sc031-vite-parity.yml`:

- confirms `main` remains an ancestor of the migration branch;
- rebuilds HTML/CSS/JS from source authority;
- pins and installs Vite 8.3.0;
- builds `dist`;
- verifies local output references and classic script order;
- serves `dist` rather than the repository root;
- runs the full Shateki browser/scoring/mode regression suite;
- writes the generated npm lockfile only after the build and regressions pass;
- uses an exact artifact allowlist, branch-head guard and exact repository write allowlist.

A passing candidate build does **not** authorise deployment. Production remains unchanged until a separate RELEASE decision.

## Rollback

Before release migration, rollback is simply the existing static runtime on `main`. The Vite files can be reverted without any database changes.

## Later optimisation

Once parity is proven, individual semantic modules may be moved under native Vite ownership in bounded slices. Do not bundle or rewrite high-risk compatibility scripts merely for tidiness; every move must preserve public globals, ordering, mode isolation and Supabase behaviour and must pass the relevant regression suite.
