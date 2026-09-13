# SC-031 Residual Compatibility Boundary

## Purpose

SC-031 removes the single-file codebase as the editing authority without forcing a risky rewrite of every historical patch. This document defines the remaining compatibility layer after HTML, core CSS and core JavaScript became source-first.

## Current boundary

### HTML

- `index.html` is generated compatibility output.
- Authoritative structure is `src/shell/index.template.html` plus the 17 fragments in `src/shell/source-contract.json`.

### Core CSS

- `src/legacy/styles/inline-002.css` is generated compatibility output.
- Authoritative core styling is the 27 semantic files declared by `src/styles/core-source-contract.json`.
- Ten additional standalone stylesheet blocks already run from semantic `src/styles/...` paths under the runtime-adoption manifest.
- **40 historical standalone stylesheet blocks remain in the compatibility layer.** Their existing cascade positions and bytes remain protected until a bounded feature slice justifies promotion.

### Core JavaScript

- `src/legacy/scripts/inline-005.js` is generated compatibility output.
- Authoritative core JavaScript is the ten semantic domains declared by `src/core-js-source-contract.json`.

### Standalone JavaScript

- **46 historical standalone scripts remain under `src/legacy/scripts/`.**
- Their analysis/ownership evidence is recorded in `src/legacy/standalone-js-ownership.json`.
- Current owner totals include live-game, league, player-stats, tournament, practice, setup and review-required code.
- A substantial portion is medium/high risk because it depends on global names, script ordering, DOM hooks or persistent-data paths.

## Engineering rule

`legacy` does not mean "safe to delete" and does not mean "must be rewritten before release". It means the file remains a compatibility runtime unit whose order and behaviour are protected.

A compatibility file may be promoted only when all of the following are true:

1. a concrete owner and purpose are confirmed;
2. public/global dependencies are known;
3. Supabase/data-path dependencies are verified where relevant;
4. the move can preserve bytes or has an explicitly reviewed semantic change;
5. load/cascade order remains correct;
6. relevant mode and browser regressions pass;
7. there is a simple rollback route.

High-risk files must not be moved simply to make the repository look cleaner.

## Source edit policy

For new work after SC-031:

- edit the semantic HTML/CSS/core-JS source when that area is already source-owned;
- do not hand-edit generated `index.html`, `src/legacy/styles/inline-002.css` or `src/legacy/scripts/inline-005.js`;
- if a feature still lives in a standalone compatibility file, either make the smallest change in place with regression evidence or promote that specific feature in a separate bounded migration;
- never bulk-convert the remaining compatibility layer during unrelated feature work.

## Release acceptance

The residual compatibility boundary is acceptable for SC-031 signoff when:

- all remaining files are inventoried/owned or explicitly `review-required`;
- generated core artifacts cannot become accidental source authority again;
- the full application builds from source and passes regression tests;
- no unresolved compatibility file is known to violate product rules or data/security requirements;
- the boundary and rollback are documented in HANDOVER.

This approach intentionally favours verified behaviour and maintainable ownership over a cosmetic zero-`legacy` target.
