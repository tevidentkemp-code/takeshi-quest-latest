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

Before touching production integration, compare two logical rendering densities under identical conditions:

- 256×64 logical / 128×32 dot grid;
- 320×80 logical / 160×40 dot grid.

The comparison must use the same:

- output size;
- scene content;
- timings;
- palette;
- typography rules;
- special artwork;
- DMD treatment pipeline;
- benchmark method.

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
- no CSS `image-rendering: pixelated` dependency for V3;
- no per-frame rebuilding of the physical dot grid;
- reduced-motion path from the beginning;
- iPhone Safari remains a first-class eventual release target.

## Phase 0 acceptance

Phase 0 passes only if:

- modules parse cleanly;
- all scene frames are deterministic at fixed timestamps;
- 256 and 320 candidates use the correct logical and dot-grid dimensions;
- all three special assets decode;
- special scenes map to distinct artwork;
- reduced-motion output is materially different where motion is non-essential;
- visual canvases retain 4:1 geometry;
- synthetic render benchmark records no >=50 ms render iteration;
- existing Vite production build still succeeds unchanged;
- visual evidence is captured for all fixtures.

Phase 0 does **not** select a production renderer automatically. Human visual review + measured performance decides the preferred density.

---

# BUILD LOG

## 2026-09-14 — Discovery / architecture

Completed:

- created isolated SC-032 design workstream from frozen SC-030 release candidate;
- audited SC-030 DMD controller and legacy renderer ownership;
- researched Mission Pinball Framework display/slide/widget/animation architecture;
- researched FlexDMD Stage / Actor / Action architecture;
- researched DMD Extensions logical-vs-output scaling model including 256×64 high-resolution DMD output;
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
- added controlled resolution profiles:
  - 256×64 -> 128×32 dot grid;
  - 320×80 -> 160×40 dot grid;
- added logical Canvas2D renderer with reusable text, number, line, ring, cross and image layers;
- added high-density DMD treatment pipeline:
  - stable cached dot mask;
  - smoothed logical-scene scaling;
  - masked physical dots;
  - restrained glow;
  - subtle glass/scan treatment;
- added timestamp-driven V3 engine with deterministic `renderAt()` and requestAnimationFrame `play()` paths;
- added lab-only loader for the existing Last Dart Hero / Desmond / Voldy artwork;
- added visual lab UI showing both candidates simultaneously;
- added synchronized playback so both densities are judged at identical animation timestamps;
- added reduced-motion comparison control;
- added in-browser render benchmark;
- added deterministic pure-module unit acceptance;
- added Playwright browser acceptance for:
  - scene catalogue;
  - asset decoding;
  - candidate geometry;
  - deterministic frame output;
  - distinct density output;
  - reduced-motion output;
  - synthetic render cost;
  - screenshot evidence;
- added isolated GitHub Actions Phase 0 workflow;
- added HOW TO USE documentation.

Current state:

**Phase 0 code complete; automated workflow result pending.**

## Next actions

1. Allow `.github/workflows/sc032-dmd-v3-phase0.yml` to execute on the exact Phase 0 head.
2. Fix only genuine Phase 0 test/renderer defects if the gate fails.
3. Pull final screenshot/benchmark evidence from the green run.
4. Perform human side-by-side visual review at realistic phone widths.
5. Select 256×64 or 320×80 — or reject both if neither clears the visual bar.
6. Do not begin production adoption until SC-030 has reached stable `main`.

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
        -> logical Canvas2D scene
        -> stable DMD dot treatment
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
- the dot grid is an output treatment, not the authoring resolution;
- normal scene luminance/alpha is preserved before dot treatment;
- physical dot grid is stable while authored content moves underneath it;
- ordinary hit scenes remain short;
- user input is never locked behind animation completion;
- special artwork is treated as DMD content, not a floating image thumbnail;
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
- do not choose 320×80 simply because it is numerically larger;
- do not delete V2 during initial V3 adoption.

## Handover success condition

A new engineer or AI should be able to:

1. read `SC-032-DMD-V3-DESIGN.md`;
2. read this BUILD LOG;
3. run the HOW TO USE procedure;
4. reproduce the Phase 0 evidence;
5. understand why the two candidate resolutions exist;
6. continue from the visual-selection gate without touching gameplay semantics.
