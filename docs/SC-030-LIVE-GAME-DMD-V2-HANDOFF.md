# SC-030 — Live Game / DMD V2 build handoff

Status: BUILD PREP COMPLETE — isolated module + regression contract created; production integration intentionally not attempted from the chat connector because `index.html` is a 2.57 MB monolith and cannot be safely round-tripped here.

Baseline inspected: `main` at `05b7e8b040edc0c92a3d7b0d8ac7f9ca1c1055b2`.
Branch: `sc030-live-game-dmd-v2`.

## Scope locked by Thomas

- Upgrade the Live Game toward a more interactive arcade/pinball feel while preserving simple scoring.
- Major upgrade to the existing dot-matrix display (DMD): text, visuals, priority and event handling.
- Preserve current scoring/game rules and mode isolation.
- DO NOT add Throwpad point sublabels such as `17 / 34 / 51` under S/D/T.
- Investigate haptic feedback.

## Haptics decision

Browser vibration is capability-safe but is not available on the primary iPhone/Safari target. The module therefore includes an optional `navigator.vibrate()` adapter that fails closed and is **disabled by default**. It is suitable for Android/other supporting browsers if later enabled. True iPhone haptics are parked for the native/App Store phase using Apple Core Haptics or an equivalent native bridge.

Do not add fake iPhone haptic claims to the current web app.

## What is already implemented on this branch

`assets/js/dmd-v2.js`:
- DMD event priorities: idle, throw, visit, competitive, achievement, record, game.
- Pre-emption and stale-timer protection: newer equal/higher-priority events replace older ones.
- Bounded pending queue (default 2) so rapid throws cannot create seconds of stale commentary.
- Concise message catalogue for player up, single/double/treble, bull, miss/scratch, visit complete, new leader, level scores, special rounds, undo/skip, PB/record, achievements, game/match win.
- Existing Shateki easter-egg image types preserved: `lastDartImg`, `desmondImg`, `voldyImg`.
- Capability-safe vibration adapter, disabled by default.
- Reduced-motion-aware DMD shell polish using the existing `#v2InfoDmd` / `#sqDmdCanvas`; it does not change DMD height.
- Backend adapter for existing `sqDmdShowZones`, `__sqDmdHardClearQueue`/`sqDmdStop`, and `sqDmdSetIdle`.

`tools/ui-smoke/verify-sc030-dmd-v2.js`:
- copy contract
- special-round labels
- legacy image mapping
- priority pre-emption
- stale timer cancellation
- bounded queue
- unsupported-haptic fail-closed behaviour
- fixed-footprint/reduced-motion CSS contract

Local pure-module result before commit: `SC-030 DMD V2 MODULE: ALL PASS`.

## Minimal Codex integration work

Fresh-read current `main` before touching code. If `main` has advanced, rebase/refresh this branch first.

### 1. Load the module

Add one script include for `assets/js/dmd-v2.js` after the existing DMD implementation is available (or before closing `body` with installation deferred until boot). Do not rewrite the DMD canvas engine.

### 2. Install against the existing backend

After `sqDmdShowZones`, `__sqDmdHardClearQueue`/`sqDmdStop`, and `sqDmdSetIdle` exist:

```js
window.__sqDmdV2 = window.SQDmdV2.install({
  host: window,
  visualShell: true,
  hapticsEnabled: false,
  maxQueue: 2
});
```

If the timing of the existing DMD globals makes this unsafe, bind explicitly after `SQ_DMD_TOPBAR_JS_V1` instead. Preserve existing public DMD functions and IDs.

### 3. Route existing DMD calls through the controller at confirmed game events

Patch the final live definitions only. Do not alter scoring calculations.

Target event points to inspect and wire:
- `recordThrow()` / final score-entry path
- normal single / double / treble completion
- Bull inner/outer result path
- MISS
- MISS×3 / scratch
- visit completion
- player change
- round change, especially Doubles / Trebles / Bull
- UNDO
- SKIP
- confirmed PB / Shateki record only where current truth is already known
- confirmed achievement unlock only after the canonical achievement result exists
- game complete / match complete

Example calls:

```js
__sqDmdV2.emit({kind:'HIT_TREBLE', points, total});
__sqDmdV2.emit({kind:'MISS', dart:state.currentDart + 1});
__sqDmdV2.emit({kind:'VISIT_COMPLETE', visitPoints, total});
__sqDmdV2.emit({kind:'ROUND_BULL'});
__sqDmdV2.emit({kind:'UNDO'});
```

Use actual verified variables from the current source. Do not invent field names.

### 4. Preserve current named/easter-egg DMD events

Where current code triggers Last Dart Hero / Desmond / Voldy graphics, route those events through:

```js
__sqDmdV2.emit({kind:'LAST_DART_HERO', total});
__sqDmdV2.emit({kind:'DESMOND_DELIGHT', total});
__sqDmdV2.emit({kind:'VOLDY', total});
```

Do not allow normal throw feedback to immediately wipe a named animation. The controller priority should own that sequencing.

### 5. DMD renderer visual upgrade still inside `index.html`

The isolated module provides the shell only. Codex should make the smallest renderer patch needed to improve the existing canvas itself:
- preserve fixed canvas/display footprint;
- retain faint unlit-dot field;
- implement 3–4 amber intensity levels rather than one flat lit-dot colour;
- controlled amber bloom only;
- no rainbow palette;
- no routine long scrolling during active scoring;
- 120–200 ms transitions where useful;
- stop/reduce animation while document is hidden;
- honour reduced motion;
- never block scoring input.

This must be a bounded patch to the final live DMD renderer, not a replacement of the canvas subsystem.

## Parked for separate Codex work

These are not bundled into the DMD integration commit:

1. **3–6 player Live Game visual parity.** Current modern Live V2 presentation is strongest for 2-player. Design active-player hero + compact opponent rail for 3–6, then regression-test every canonical player count.
2. **Supabase `matches` HTTP 400 audit.** Pre-existing runtime defect observed during SC-021; diagnose request/schema path separately before patching.
3. **True iPhone haptics.** Native/App Store phase only unless WebKit adds a supported web haptics API later.
4. **Optional sound engine.** Add only after DMD V2 is stable; preserve one-tap mute and never await audio in scoring.
5. **Live Game structural flattening.** Later cleanup of final effective Live Game/DMD CSS+JS patches after behaviour is green; no broad monolith refactor during SC-030.

## Explicitly rejected / not in scope

- Throwpad S/D/T point sublabels (`17 / 34 / 51` etc.)
- score multipliers, random bonuses, loot/spin mechanics
- invented momentum/hot-streak formulas
- PB/record pace messaging unless product authority explicitly defines it
- per-dart Supabase round trips
- weakening RLS/auth/security
- broad scoring or mode rewrites

## Acceptance gate before release

Run at minimum:
- existing setup regression
- full scoring journey
- saved-player flow
- current Classic visual-fit / SC-020/021/022/023 protections
- Practice, resumed Practice, Turbo, Vs Shadow, Training mode-isolation checks
- new SC-030 DMD module test
- rapid sequence: Hit → Hit → Undo → Treble → Miss → Skip; stale DMD text must never overwrite the newest event
- Last Dart Hero / Desmond / Voldy graphics remain in bounds
- 320×844, 390×844, 430×932; no horizontal overflow and Throwpad position unchanged
- reduced-motion path
- no new uncaught console errors
- no scoring, PB/record, achievements, XP, match save or Supabase truth change

Production RELEASE remains separately gated unless Thomas explicitly authorises it.

## Rollback

SC-030 should remain one bounded integration PR. Rollback is revert that merge commit only. No Supabase rollback should be required because this build must not change schema/data/RLS.
