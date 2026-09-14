# SC-032 — DMD V3 / BUILD LOG

This document is the operational control for the DMD V3 workstream.

---

# TASK

## Objective

Build the next-generation Shateki Quest Dot Matrix Display to the visual quality level of the Beta Live Game UI while retaining clear DMD / arcade character.

Locked product line:

**Beta visual quality, DMD personality.**

Target balance:

- ~65% modern digital;
- ~35% retro arcade/DMD.

## Phase 0 objective

Before touching production integration, compare two **physical dot-treatment densities** under identical conditions while keeping the authored scene at the existing smooth **640×160** density:

- Candidate A / Balanced: 640×160 authored scene -> 256×64 dot grid;
- Candidate B / Digital: 640×160 authored scene -> 320×80 dot grid.

The comparison must hold constant:

- 640×160 authored scene;
- visible output size;
- scene content;
- timings;
- palette;
- typography rules;
- special artwork;
- DMD treatment pipeline;
- benchmark method.

Only the physical dot density changes.

## Phase 0 required fixtures

- PLAYER UP
- SINGLE
- TREBLE
- BULLSEYE
- MISS
- PERSONAL BEST
- LAST DART HERO
- DESMOND
- VOLDY

## Non-negotiable architecture rules

- no scoring/game-rule ownership in V3;
- no persistence/Supabase dependency for ordinary scenes;
- no production import during Phase 0;
- deterministic timestamp-based scene sampling;
- requestAnimationFrame-compatible engine;
- reusable motion primitives;
- stable/cached dot treatment;
- smooth 640×160 authoring retained;
- dot grid is an output treatment, not the authoring resolution;
- no CSS `image-rendering: pixelated` dependency for V3;
- no per-frame rebuilding of the physical dot grid;
- special-art preprocessing must be cached rather than repeated per frame;
- reduced-motion path from the beginning;
- iPhone Safari remains a first-class eventual release target.

## Phase 0 acceptance

Phase 0 passes only if:

- modules parse cleanly;
- all scene frames are deterministic at fixed timestamps;
- both candidates retain identical 640×160 authoring;
- Balanced candidate uses 256×64 physical dots;
- Digital candidate uses 320×80 physical dots;
- all three special assets decode;
- special scenes map to distinct artwork;
- reduced-motion output is materially different where motion is non-essential;
- visual canvases retain 4:1 geometry;
- realistic 390px phone-scale evidence is captured;
- paced post-warmup renderer p95 < 8 ms;
- paced renderer p99 < 16.67 ms;
- no renderer-attributed call reaches 50 ms;
- rendering both lab candidates together remains <16.67 ms at p95;
- existing Vite production build still succeeds unchanged;
- visual evidence is captured for all fixtures.

Phase 0 does **not** select a production renderer automatically. Human visual review + measured performance decides the preferred dot density.

---

# BUILD LOG

## 2026-09-14 — Discovery / architecture

Completed:

- created isolated SC-032 design workstream from frozen SC-030 release candidate;
- audited SC-030 DMD controller and legacy renderer ownership;
- researched Mission Pinball Framework display/slide/widget/animation architecture;
- researched FlexDMD Stage / Actor / Action architecture;
- researched DMD Extensions logical-vs-output scaling model;
- reviewed current browser requestAnimationFrame guidance and OffscreenCanvas/browser rendering options;
- rejected strict 128×32 retro recreation as the target product direction;
- locked the visual direction to smoother Beta-quality digital DMD;
- defined modular scene engine, treatment pipeline, performance, reduced-motion and release boundaries in `SC-032-DMD-V3-DESIGN.md`.

## 2026-09-14 — Phase 0 foundation

Completed:

- created implementation-isolated branch `sc032-dmd-v3-phase0`;
- added deterministic motion primitives:
  - easing;
  - time segments;
  - fades;
  - scale-in;
  - translate-in;
  - number tween;
  - bounded deterministic jitter;
- added pure scene registry for all nine Phase 0 fixtures;
- added logical Canvas2D renderer with reusable text, number, line, ring, cross and image layers;
- added high-density DMD treatment pipeline:
  - stable cached dot mask;
  - smoothed authored-scene rendering;
  - masked physical dots;
  - restrained glow;
  - subtle glass/scan treatment;
- added timestamp-driven V3 engine with deterministic `renderAt()` and requestAnimationFrame `play()` paths;
- added lab-only loader for the existing Last Dart Hero / Desmond / Voldy artwork;
- added visual lab UI showing both candidates simultaneously;
- added synchronized playback so both dot densities are judged at identical animation timestamps;
- added reduced-motion comparison control;
- added deterministic pure-module unit acceptance;
- added Playwright browser acceptance;
- added isolated GitHub Actions Phase 0 workflow;
- added HOW TO USE documentation.

## 2026-09-14 — QA hardening / performance investigation

Completed:

- first CI attempt exposed a missing `scripts` dependency before the production-build parity check; workflow repaired by installing deterministic architecture tooling explicitly;
- deterministic unit contracts, production Vite build and `verify:dist` subsequently passed;
- initial tight-loop canvas benchmark reported excellent median/p95 (~2–3 ms) but two ~80–107 ms pauses on **both** candidates;
- did not weaken the 50 ms gate;
- removed avoidable per-frame special-art filtering/tinting by preprocessing each image/tint once and caching the result in a `WeakMap`;
- identified the remaining symmetric long pauses as an invalid benchmark methodology risk: 360 synchronous back-to-back canvas renders manufacture GC/scheduler pressure unlike the timestamp-driven production renderer;
- replaced the tight-loop benchmark with a post-warmup, one-sample-per-`requestAnimationFrame` benchmark;
- added median / p95 / p99 / max / >16.67ms / >=50ms evidence plus worst-scene attribution;
- retained hard acceptance thresholds rather than simply raising the allowed maximum.

## 2026-09-14 — Product-direction correction before selection

During visual inspection of the first screenshot set, the initial 256×64 and 320×80 **authoring** candidates were visibly more retro/chunky than requested.

A direct audit then confirmed the existing DMD already uses a **640×160 native buffer specifically for smoother DMD text**.

Action taken:

- rejected the lower-authoring-resolution experiment before product selection;
- kept 640×160 as the V3 authored scene resolution;
- reframed Phase 0 as a controlled dot-treatment comparison only:
  - Balanced = 256×64 physical dot grid;
  - Digital = 320×80 physical dot grid;
- updated deterministic contracts and lab labels;
- added 390px phone-scale evidence to prevent selecting a density from oversized desktop screenshots.

This correction is intentional evidence of the release process working: the prototype is allowed to disprove an early architecture assumption before it enters the game.

Current state:

**Revised Phase 0 exact-head QA pending. No V3 production integration exists.**

## Next actions

1. Allow `.github/workflows/sc032-dmd-v3-phase0.yml` to execute on the revised exact Phase 0 head.
2. Fix only genuine Phase 0 test/renderer defects if the gate fails.
3. Pull final desktop + phone-scale screenshot and benchmark evidence from the green run.
4. Perform human side-by-side review of Balanced 256×64-dot vs Digital 320×80-dot treatment.
5. Select a dot treatment — or reject both if neither clears the visual bar.
6. Record the selected treatment and Phase 0 evidence here.
7. Do not begin production adoption until SC-030 has reached stable `main`.

---

# HANDOVER

## Current workstream

Project: **SC-032 — DMD V3**

Active Phase 0 branch:

`sc032-dmd-v3-phase0`

Design branch:

`sc032-dmd-v3-design`

The Phase 0 branch is isolated from SC-030. It must not be merged into production in its current form.

## Architectural state

The intended production architecture is:

```text
existing gameplay event/state
        -> SC-030 priority/controller boundary
        -> DMD V3 semantic scene adapter
        -> deterministic scene registry/timeline
        -> 640×160 smooth Canvas2D scene
        -> stable selectable DMD dot treatment
        -> visible DMD canvas
```

The V3 renderer does not own scoring, current player, current dart, round state, persistence or cloud state.

## Important implementation files

```text
src/live-game/dmd/v3/primitives.mjs
src/live-game/dmd/v3/scene-registry.mjs
src/live-game/dmd/v3/renderer.mjs
src/live-game/dmd/v3/treatment.mjs
src/live-game/dmd/v3/engine.mjs

tools/dmd-v3-lab/index.html
tools/dmd-v3-lab/styles.css
tools/dmd-v3-lab/lab.mjs
tools/dmd-v3-lab/legacy-assets.mjs

tools/ui-smoke/verify-sc032-dmd-v3-units.mjs
tools/ui-smoke/verify-sc032-dmd-v3-lab.js

.github/workflows/sc032-dmd-v3-phase0.yml
```

## Critical design decisions already made

Do not casually reverse these without explicit product review:

- V3 is smoother digital DMD, not strict retro emulation;
- **640×160 is the authored scene density for both Phase 0 candidates**;
- the dot grid is an output treatment, not the authoring resolution;
- normal scene luminance/alpha is preserved before dot treatment;
- physical dot grid is stable while authored content moves underneath it;
- ordinary hit scenes remain short;
- user input is never locked behind animation completion;
- special artwork is treated as DMD content, not a floating image thumbnail;
- special-art preprocessing is cached;
- no uncontrolled particle system;
- no sci-fi HUD clutter;
- reduced motion is a real scene variant;
- V2 remains the eventual rollback backend during adoption.

## What the next AI/engineer must not do

- do not import V3 into production Live Game before Phase 0 selection and SC-030 production stability;
- do not edit SC-030 from this branch;
- do not rewrite the SC-030 controller merely because V3 exists;
- do not add game mechanics to make DMD scenes more exciting;
- do not duplicate gameplay state inside the renderer;
- do not use network-loaded fonts/assets as a scoring-scene dependency;
- do not reduce the V3 authoring surface back to 256×64/320×80 without explicit product review;
- do not choose the denser dot treatment simply because its number is larger;
- do not delete V2 during initial V3 adoption.

## Handover success condition

A new engineer or AI should be able to:

1. read `SC-032-DMD-V3-DESIGN.md`;
2. read this BUILD LOG;
3. run the HOW TO USE procedure;
4. reproduce the Phase 0 evidence;
5. understand why the two candidates share 640×160 authoring and differ only in dot density;
6. continue from the visual-selection gate without touching gameplay semantics.
