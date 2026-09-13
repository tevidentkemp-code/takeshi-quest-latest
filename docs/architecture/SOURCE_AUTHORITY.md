# SC-031 source authority contract

Status: SOURCE-FIRST BUILD CONTRACT — branch migration only. Production and `main` remain unchanged until separately approved.

## Authority

For HTML/runtime assembly, committed split source is the engineering authority:

- `src/shell/index.template.html`
- `src/shell/source-contract.json`
- the ordered HTML fragments named by that contract

`index.html` is a generated compatibility runtime. It remains committed while GitHub Pages still serves the static repository root, but it must not be edited as the primary source after this checkpoint.

The historical `src/shell/shell-manifest.json` and per-component promotion manifests remain provenance evidence from the index-first migration. They are not the mutable build authority after inversion.

## Builder

`scripts/render-index-from-source.mjs`:

1. reads the source contract, or bootstraps it once from the verified historical shell manifest;
2. requires canonical repository-relative paths and unique ordered source tokens;
3. verifies every protected DOM ID remains in its owned fragment;
4. renders the template from current fragment contents;
5. computes fresh SHA-256/byte evidence from the current source tree; and
6. writes only an explicitly requested generated candidate/evidence path.

The builder does not silently edit `index.html`.

## Automatic generated-runtime gate

`.github/workflows/sc031-source-authority.yml` is the only automatic HTML source→runtime writer on the SC-031 branch.

Its read-only verification job:

- confirms production ancestry;
- bootstraps `source-contract.json` only at the verified inversion checkpoint;
- generates a fresh compatibility `index.html` candidate from split source;
- requires bootstrap byte parity with the pre-inversion runtime;
- runs the full browser regression suite against the generated candidate; and
- packages the exact generated write set.

Only after that job succeeds does a separate `contents: write` job:

- prove the branch has not advanced;
- validate the exact three-file artifact payload;
- verify artifact hashes against build evidence;
- copy only `index.html` and `src/shell/source-contract.json` into the checkout;
- reject every unexpected changed path; and
- commit only when those generated compatibility files actually changed.

## Independent QA

The normal Setup regression workflow materializes `index.html` from split source before browser tests. This prevents a stale committed compatibility runtime from hiding a source regression.

## Retired index-first writers

The former automatic modular migration and shell-generation workflows are retained only as manual read-only provenance audits. They must not regenerate semantic source from `index.html` or write source automatically after authority inversion.

## Compatibility layers still to migrate

HTML source authority does not by itself complete SC-031. Remaining work includes:

- invert the 27-domain core CSS contract so semantic CSS generates the legacy compatibility stylesheet;
- continue bounded ownership/runtime-path migration of remaining standalone legacy JS/CSS while preserving exact execution/cascade semantics;
- promote remaining inline static DOM still held in the shell template where useful;
- prove Vite/build parity only after source-first compatibility generation is stable;
- prove deployment parity while preserving the current static Pages route as rollback;
- complete accessibility/performance/regression hardening;
- resolve the separate Supabase public-release security gate; and
- obtain explicit Thomas release authority before merging/deploying.

## Non-goals

This contract does not change scoring, game rules, modes, Supabase schema/data/RLS/auth, rankings, achievements, XP or player-visible behaviour.
