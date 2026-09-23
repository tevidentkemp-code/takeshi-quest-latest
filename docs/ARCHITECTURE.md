# Shateki Quest Architecture Orientation

Status: **DERIVED ORIENTATION — NON-CANONICAL**

Verified against commit: `69e14553beee376f28af63c7faf905bbd9c03228`

Verified: 2026-09-23 (Europe/London)

This map accelerates navigation. Live implementation and current Project authorities remain stronger. Re-verify every boundary before changing it.

## Authority links

- Repository engineering gate: [`docs/architecture/PUBLIC_RELEASE_ENGINEERING_STANDARD.md`](architecture/PUBLIC_RELEASE_ENGINEERING_STANDARD.md)
- HTML ownership: [`docs/architecture/HTML_COMPONENT_MAP.md`](architecture/HTML_COMPONENT_MAP.md)
- JavaScript ownership: [`docs/architecture/JS_SOURCE_AUTHORITY.md`](architecture/JS_SOURCE_AUTHORITY.md)
- CSS ownership: [`docs/architecture/CSS_SOURCE_AUTHORITY.md`](architecture/CSS_SOURCE_AUTHORITY.md)
- Materialisation boundary: [`docs/architecture/SOURCE_AUTHORITY.md`](architecture/SOURCE_AUTHORITY.md) and [`docs/architecture/BUILD_SYSTEM.md`](architecture/BUILD_SYSTEM.md)
- Current Drive Working Rules: [Google Doc `19Bps656J9DjJzXRRpWbUhjoetJDD-h76o5D0f4-WqwI`](https://docs.google.com/document/d/19Bps656J9DjJzXRRpWbUhjoetJDD-h76o5D0f4-WqwI/edit)
- Current Drive Source Map: [Google Sheet `1932-U8az9yyxwFAVIsdWGeQT6OAADI46dYHdnZ4TVhg`](https://docs.google.com/spreadsheets/d/1932-U8az9yyxwFAVIsdWGeQT6OAADI46dYHdnZ4TVhg/edit)

## System map

| Concern | Current owner | Boundary |
|---|---|---|
| App shell and screen markup | `src/app/router-ui.js`, `src/ui/*` | Semantic source; materialised into generated runtime output |
| Canonical game mutation | `src/game/engine.js` | Owns scoring state transitions, history, aggregates, advancement |
| Live Game controller/presentation | `src/live-game/live-v2.js` | Adapts controls and renders current state; must not become a second scoring engine |
| DMD presentation | `src/live-game/dmd/*` plus owned integrations | Derived visual/commentary output; may be cancelled, must not mutate scoring |
| Services and cloud I/O | `src/services/*` and owned engine completion paths | Supabase persistent truth; local storage is cache/recovery only |
| Styling | `src/styles/*` | Semantic CSS source; generated compatibility CSS is output only |
| Build/materialisation | `scripts/materialize-runtime.mjs`, Vite | Regenerates `index.html`, legacy bundles, and `dist` |

## Accepted dart event

1. A Live Game handler in `src/live-game/live-v2.js` converts one user action into one canonical `recordThrow(spec)` call. Quick entry retains one-by-one canonical calls.
2. `src/game/engine.js::recordThrow(spec)` validates the active cursor, calculates the dart, writes the dart to the active entry, recomputes the round total, records undo history, updates aggregates, advances the dart/player/round cursor, and invokes `updateUI()`.
3. `src/live-game/live-v2.js::updateUI()` renders from current state, rebuilds the input pad, refreshes Live V2/V3 presentation, and calls `save()` for local recovery/cache behaviour.
4. DMD/commentary reads the already-written throw. Delayed scenes use flow/history guards so later input or Undo can invalidate stale presentation.
5. Completed-game persistence uses `recordFullGameToSupabase()` and service paths. It is not an independent per-dart UI truth.

## Safe placement rule

A purely visual-response defect normally belongs in `src/live-game/live-v2.js`, `src/live-game/dmd/*`, or the owning `src/styles/*` file. Change `src/game/engine.js` only when evidence proves a canonical state defect. Never fix presentation by adding a second `recordThrow()` call, inventing a parallel state shape, or editing `src/legacy/scripts/inline-005.js` directly.

## Generated boundary

The following are generated compatibility outputs, not editable authorities:

- `index.html`
- `src/legacy/scripts/inline-005.js`
- `src/legacy/styles/inline-002.css`
- `dist/*`

Use `npm run materialize`, `npm run build`, and `npm run verify:dist`. A generated-file difference must be explained by its semantic source.

## Verification matrix

| Change | Minimum checks |
|---|---|
| Presentation/controller | Syntax/static check, materialisation parity, build/dist verification, source and `dist` browser paths, rapid/repeated input, DMD cancellation/restoration |
| Scoring/state | All presentation checks plus score entry, Undo, Skip, round/player advancement, mode isolation, state/presentation parity |
| Persistence/service | Local recovery versus Supabase boundary, completed-game write path, offline/failure behaviour, no duplicate write |
| UI/style | 320/390/430 widths, 44×44 targets, accessible names/state, keyboard focus, overflow, reduced motion |

## Unknowns and refresh rule

This document does not define deployment ownership, current release approval, database policy state, or future sequencing. Retrieve those live. To refresh this map, compare the Drive Source Map and Working Rules with the current `main` SHA, the ownership maps above, and the named live functions; record any mismatch instead of silently reconciling it.
