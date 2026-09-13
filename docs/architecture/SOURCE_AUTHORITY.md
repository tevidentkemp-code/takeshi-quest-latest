# SC-031 source authority contract

Status: CANDIDATE — verification only. Production and `main` remain unchanged.

## Purpose

Establish the committed split source as a deterministic, testable candidate for runtime authority before any Vite/build or deployment adoption.

The current production-compatible runtime remains `index.html`. This checkpoint does not invert authority or change deployed behaviour. It proves that the owned HTML source can reconstruct the existing runtime byte-for-byte and can pass the complete behaviour regression suite when that reconstructed output is used as the test runtime.

## Inputs

- `src/shell/index.template.html`
- `src/shell/shell-manifest.json`
- the 17 HTML source fragments pinned by that manifest

## Renderer

`scripts/render-index-from-source.mjs` fails closed unless all of the following are true:

1. the shell manifest is the expected pre-inversion schema/stage;
2. template bytes and SHA-256 match pinned evidence;
3. every manifest fragment has exactly one source token;
4. source-token order matches the manifest;
5. no fragment path escapes the repository or uses a non-canonical path;
6. each fragment matches its pinned byte count and SHA-256;
7. every protected DOM ID remains present in its owned fragment;
8. no source tokens remain after rendering;
9. the rendered runtime matches the pinned runtime bytes/hash; and
10. the rendered runtime is byte-identical to the current branch `index.html`.

Writing directly to `index.html` is refused during the candidate stage unless an explicit runtime-write flag is supplied. CI writes the candidate to a temporary file and then uses an identical copy for browser regression testing.

## CI contract

`.github/workflows/sc031-source-authority.yml` is read-only. It:

- verifies the branch still descends from production `main`;
- renders the runtime from committed split source;
- proves byte identity with current `index.html`;
- tests the generated candidate as the runtime;
- runs Setup, full scoring, Classic/DMD, Training, Progression, Player Stats and admin modal regressions; and
- stores evidence without writing repository contents.

## Promotion gate

Source authority must not be inverted until this candidate gate is fully green. The next checkpoint after green evidence is a separate guarded change that makes source-template/fragments authoritative and treats `index.html` as generated compatibility output. That change must retain:

- a read-only verification job;
- a separate minimal write job only after successful regressions;
- a branch-advance guard;
- generated-file scope guards;
- exact rollback to the pre-inversion branch commit; and
- the existing static GitHub Pages path until Vite/build parity is separately proven.

## Explicit non-goals

This checkpoint does not:

- change scoring or game rules;
- change Official, Turbo, Practice, Vs Shadow or Training behaviour;
- change Supabase schema/data/RLS/auth;
- convert classic scripts to ES modules;
- introduce Vite;
- change GitHub Pages deployment; or
- release anything to production.
