# SC-031 Core CSS Source Authority

## Purpose

SC-031 changes the 27 semantic CSS domain files under `src/styles/**` from migration copies into the maintained source for the historical core stylesheet.

This is an architecture-only transition. It does not authorize visual redesign, selector reordering, cascade cleanup, gameplay changes, or deletion of the compatibility stylesheet.

## Authority

After the source-authority contract is established:

- **Edit:** the ordered semantic CSS files listed by `src/styles/core-source-contract.json`.
- **Generate:** `src/legacy/styles/inline-002.css` from those source files with `scripts/build-core-styles-from-source.mjs`.
- **Do not edit as source:** `src/legacy/styles/inline-002.css`.
- `src/styles/core-source-manifest.json` remains historical bootstrap/provenance evidence for the authority transition.

The active contract deliberately pins domain order, owner, source path and protected boundary anchor. It does not pin source content hashes, because legitimate future edits must be made to the source files.

## Build contract

The builder fails closed unless all of the following remain true:

1. exactly 27 ordered semantic domains are declared;
2. every source path is canonical and remains under `src/styles/**`;
3. every protected boundary anchor remains at the start of its domain;
4. every source domain and the rebuilt runtime parse as CSS;
5. no domain exceeds the current 60 KB migration safety budget;
6. the output is produced by concatenating the source domains in the declared order.

At the one-time bootstrap transition, the builder additionally proves that the existing semantic files and existing compatibility runtime match the previously verified historical manifest byte-for-byte before writing the active source contract.

## Continuous verification

`.github/workflows/sc031-css-authority.yml` performs the guarded authority build on the SC-031 branch:

1. confirms the branch still contains production `main` as an ancestor;
2. installs pinned architecture dependencies;
3. builds the compatibility stylesheet from semantic source;
4. verifies exact source-to-runtime reconstruction;
5. materializes the HTML runtime from its split source;
6. runs the full browser regression set against the generated HTML and CSS;
7. packages only the generated compatibility CSS, active contract and hash evidence;
8. uses a separate minimal write-permission job to verify the artifact and commit only the allowed generated files.

The write job refuses unexpected artifact contents, unexpected repository paths, stale branch heads, hash mismatches and whitespace errors.

Independent Setup QA also regenerates HTML and core CSS from source before running the scoring journey. A stale checked-in compatibility file therefore cannot hide a source regression.

## Retired direction

`scripts/split-core-styles-v2.mjs` was the controlled runtime-to-source extraction tool used to establish the 27 domains. That direction is now retired and fails closed. Its historical implementation remains recoverable from Git history and its evidence remains in `src/styles/core-source-manifest.json`.

## Rollback

Until SC-031 is released, production remains `main` and is unchanged. The entire CSS authority transition can be rolled back by reverting the SC-031 branch commits. The historical compatibility runtime and bootstrap manifest provide additional reconstruction evidence.

No database, Supabase policy, game rule, score calculation or player-visible design change is part of this transition.
