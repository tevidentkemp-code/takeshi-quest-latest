# SC-050 — Public Release Metadata

Status: BUILD CANDIDATE

## Public version scheme

Shateki Quest public releases use CalVer:

`YYYY.MM.DD.N`

- `YYYY.MM.DD` = production release date.
- `N` = sequential production release number for that date, starting at 1.
- Display form is prefixed with `v`, for example `v2026.09.21.1`.

This avoids assigning maturity semantics such as "1.0" to a product that did not previously have an approved public version sequence.

## Canonical source

`src/release/release-metadata.mjs`

This is the only production source for:
- the current public version;
- release date;
- release title;
- user-facing Release Notes history.

The Home badge and Release Notes modal must read this module. Do not duplicate version text in UI files.

## Release contract

Every future production release must:
1. update `current`;
2. prepend a matching release entry;
3. keep previous entries;
4. pass SC-050 source + built-dist verification;
5. prove the displayed badge/modal version equals the canonical metadata;
6. deploy the same verified commit.

A production release must not be closed if its displayed version and canonical metadata disagree.

## First versioned release

`v2026.09.21.1`

Public Release Notes begin here. Earlier deployments remain unversioned rather than being assigned invented historical version numbers.

## UI

- Small version badge is visible on the Home hero.
- Tapping the badge opens an accessible, scrollable Release Notes modal.
- Newest release appears first.
- Back and Close both return to Home.
- Mobile widths 320 / 390 / 430 must fit without horizontal overflow.
- Start Game and Resume remain unchanged.

## Rollback

Revert the SC-050 merge. No Supabase rollback is required.
