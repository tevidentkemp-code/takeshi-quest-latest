# SC-032 — DMD V3 / Beta-quality digital display

Status: **PHASE 0 PROTOTYPE / ISOLATED** — runtime prototype exists only on `sc032-dmd-v3-phase0`. It is not imported by the production Live Game and must remain isolated while SC-030 is being completed/released.

Original design baseline: SC-030 release-candidate commit `34adef8aa8097aa57cb0bb5fc9afca22cf437266`.

## TASK

Build the next-generation Shateki Quest Dot Matrix Display to the same visual quality bar as the Beta Live Game UI while retaining a recognisable arcade/pinball identity.

Locked design line:

> **Beta visual quality, DMD personality.**

Target balance:

- approximately 65% modern digital / 35% retro arcade;
- smooth, high-density scene authoring;
- dot-matrix texture remains visible, but dots are an output treatment rather than the design limitation;
- fast, controlled Beta-style motion rather than stepped/juddering animation;
- 60 Hz-capable timestamp-based animation using `requestAnimationFrame`;
- Shateki amber/orange, dark negative space and restrained semantic colour;
- no sci-fi HUD clutter;
- no invented scoring mechanics, bonuses, momentum or fake gameplay systems;
- no changes to scoring, rules, persistence, Supabase, auth or mode routing;
- DMD animation must never block the Throwpad or delay the next throw;
- reduced motion is mandatory from first implementation;
- iPhone Safari is a first-class eventual release target.

---

# WHY V3 EXISTS

SC-030 gives the DMD the correct presentation boundary: explicit event priority, controlled queueing/pre-emption, stale-scene handling and separation from scoring/game rules.

The remaining weakness is primarily the renderer and visual language.

The existing DMD:

- already uses a **640×160 native buffer specifically for smoother DMD text**;
- runs through `requestAnimationFrame` but historically advances some motion at a deliberately stepped cadence;
- renders content, thresholds it toward amber and applies a round-dot mask;
- still carries legacy renderer ownership, image loaders, historical patch layers and special-case scene code;
- uses CSS `image-rendering: pixelated` in the old path;
- treats special artwork differently from normal authored scenes;
- has character but can feel visually coarse beside the Beta Live Game UI.

V3 therefore keeps the good high-density authoring idea and replaces the backend with a dedicated scene/treatment architecture.

A key Phase-0 discovery corrected an early assumption: **lowering the authored scene to 256×64 or 320×80 made the prototype visibly more retro/chunky, which conflicts with the requested product direction.**

The corrected V3 rule is:

```text
640×160 smooth authored scene
        -> selectable physical dot treatment
        -> glow / glass treatment
        -> visible DMD
```

---

# EXTERNAL ENGINEERING RESEARCH

The design borrows principles from established pinball/display systems without importing heavyweight frameworks.

## Mission Pinball Framework

Useful principles:

- displays are separate from gameplay logic;
- slides/scenes have priority and transitions;
- reusable widgets compose into scenes;
- text/images/shapes are first-class objects;
- animations can be named and reused.

Adopt:

- declarative scenes;
- reusable layers;
- reusable motion primitives;
- explicit presentation priority.

Do not adopt:

- framework/config complexity that does not suit this web app.

## FlexDMD

Useful principles:

- Stage -> Actors -> Actions;
- scene elements are objects rather than renderer special cases;
- actions compose into sequences;
- renderer configuration is separate from gameplay logic.

Adopt:

- small scene graph;
- composable timeline actions;
- clean render boundary.

## DMD Extensions / modern virtual-DMD tooling

Useful principles:

- logical source content is separate from physical/virtual output treatment;
- high-resolution rendering and scaling are output concerns;
- colour/treatment can be transformed after scene composition.

Adopt:

- **scene content -> frame -> DMD treatment -> output**.

## Web platform

Use `requestAnimationFrame` timestamps for time-based animation.

Requirements:

- progress is based on timestamps, not frame counting;
- hidden/background pages suspend rendering;
- no layout work in the hot render loop;
- main-thread render cost stays bounded and measured;
- OffscreenCanvas/worker rendering may be investigated later but is not required for the first releasable iPhone-safe implementation.

---

# TARGET ARCHITECTURE

```text
existing gameplay state/events
          |
          v
SC-030 controller / priority scheduler
          |
          v
DMD V3 semantic scene adapter
          |
          v
scene registry + deterministic timeline
          |
          v
640×160 logical Canvas2D scene
          |
          v
selectable physical dot treatment
          |
          v
restrained glow / glass
          |
          v
visible output canvas
```

## Preserve from SC-030

- explicit priorities;
- equal/higher-priority pre-emption;
- bounded queue;
- stale low-priority eviction;
- idle baseline restoration;
- visibility suspension;
- reduced-motion contract;
- presentation-only ownership.

## V3 owns

- scene composition;
- scene timelines;
- typography;
- graphics/sprites;
- semantic palette treatment;
- motion primitives;
- logical frame rendering;
- dot/glow/glass output treatment;
- V3 visual QA hooks.

## V3 never owns

- scoring;
- current player/dart/round truth;
- mode semantics;
- persistence;
- cloud state;
- Supabase writes;
- navigation/game completion rules.

Legacy DMD APIs remain available through a compatibility/rollback path until V3 parity is proven.

---

# RENDERING MODEL

## Authored scene resolution

**Locked Phase-0 authoring surface: 640×160 (4:1).**

Why:

- it preserves the existing high-density text advantage;
- it supports smooth Beta-style typography and number motion;
- it prevents the dot grid from dictating scene design;
- it maps directly to the existing DMD geometry;
- it is still a tiny Canvas2D surface by modern UI standards.

The authored scene resolution is **not** what Phase 0 is choosing anymore.

## Phase-0 dot treatments

Both candidates receive the exact same 640×160 authored frame.

### Candidate A — Balanced

- authored scene: 640×160;
- dot grid: **256×64**;
- stronger visible physical-dot identity;
- intended to test the best balance of modern content and obvious DMD texture.

### Candidate B — Digital

- authored scene: 640×160;
- dot grid: **320×80**;
- finer dot texture;
- intended to test the smoother/more digital end of the requested direction.

No candidate wins automatically because it has more dots.

The selected treatment must be judged at **actual phone CSS size**, not only enlarged desktop screenshots.

## Luminance / alpha

Do not binary-threshold normal V3 scene content before treatment.

Preserve luminance and alpha through the logical frame so V3 can provide:

- smooth text edges;
- controlled fades;
- brightness gradients;
- number tweening;
- better artwork processing;
- smooth digital motion.

The physical-dot layer supplies DMD character afterward.

## Dot treatment

Requirements:

- stable dot grid;
- cached/precomputed mask;
- no per-frame construction of thousands of gradients;
- authored content moves underneath a stationary physical display grid;
- dot size/spacing scales from controlled treatment parameters;
- restrained glow after primary dot composition;
- glass/scan treatment must remain subtle and never lower readability.

## Special-art processing

Last Dart Hero / Desmond / Voldy must not be re-filtered from full source artwork on every animation frame.

Prototype requirement already adopted:

- decode image once;
- preprocess contrast/tint once per image+treatment;
- cache result;
- animate crop/scale/position only during frames.

Production assets should eventually move out of legacy source-code blobs into explicit owned assets/manifests.

## Output scaling

- retain 4:1 aspect ratio;
- canvas must remain DPR-aware when integrated;
- no dependency on CSS `image-rendering: pixelated` in V3;
- never non-uniformly stretch typography to fill the shell;
- keep the accepted SC-030 shell footprint unless product review proves a shell change is necessary.

---

# SCENE ENGINE

V3 uses a deliberately small declarative scene system.

## Scene

A scene defines:

- id;
- duration;
- controller priority class;
- layers;
- deterministic timeline;
- optional reduced-motion variant;
- completion/restoration behaviour.

## Initial layer primitives

- `text`
- `number`
- `line/shape`
- `ring`
- `image`
- later bounded `sprite/group` support only if required.

Do not build a general particle engine.

## Initial motion primitives

- fade;
- translate;
- scale;
- reveal/wipe;
- number tween;
- brightness pulse;
- bounded short jitter/glitch;
- radial/ring pulse;
- scan/sweep.

All motion is timestamp-based and deterministic.

## Easing

Default movement uses clean ease-out/cubic/quint curves comparable with the Beta UI.

Avoid:

- bouncy/cartoon easing;
- repeated wobble;
- large shake;
- slow cinematic transitions;
- anything that makes the game feel locked behind animation.

---

# VISUAL LANGUAGE

Design line: **Beta visual quality, DMD personality**.

## Palette

Primary:

- Shateki amber/orange.

Rare semantic accents:

- warm white / pale amber for highest-intensity numerics;
- existing Beta green for genuinely positive/record states;
- restrained red for miss/error states.

No rainbow/RGB default treatment.

## Typography

- Beta UI is the quality reference;
- score/number is the strongest object in ordinary hit scenes;
- labels are short and secondary;
- no long all-caps sentence when a short two-beat scene works better;
- no new remote-font runtime dependency;
- text must remain legible at the narrowest supported phone width.

## Motion principles

1. Immediate acknowledgement.
2. Ordinary scenes settle in roughly 180–550ms.
3. No input lock.
4. 60 Hz-capable timestamp motion.
5. Larger motion reserved for genuinely larger events.
6. Reduced motion preserves information while removing unnecessary spatial motion.
7. Idle state remains calm.

---

# PHASE-0 SCENE CATALOGUE

The prototype currently authors these nine representative scenes:

- PLAYER UP;
- SINGLE;
- TREBLE;
- BULLSEYE;
- MISS;
- PERSONAL BEST;
- LAST DART HERO;
- DESMOND;
- VOLDY.

These are deliberately representative rather than the complete eventual production catalogue.

## PLAYER UP

- player identity primary;
- target secondary;
- calm baseline composition;
- no perpetual marquee.

## SINGLE

- large points number;
- short `SINGLE` label;
- visit/total secondary;
- target 220–320ms.

## TREBLE

- large points number;
- focused radial pulse;
- visit total can tween;
- smooth rather than explosive;
- target 320–450ms.

## BULLSEYE

- `50` primary;
- controlled ring language;
- highest ordinary-hit intensity;
- target 420–550ms.

## MISS

- quick digital X/error cue;
- concise `MISS`;
- restrained red;
- target 180–260ms.

## PERSONAL BEST

- score first;
- premium restrained green/amber treatment;
- number tween where appropriate;
- target 850–1100ms.

## Special scenes

Last Dart Hero, Desmond and Voldy are retained as product identity moments.

Common treatment:

1. real decoded source image;
2. intentional crop;
3. contrast/brightness mapping;
4. cached tint/preprocessing;
5. same physical dot treatment as all other V3 scenes;
6. controlled reveal/pan/zoom;
7. minimal supporting copy.

### Last Dart Hero

- hero reveal;
- subtle forward resolve;
- no violent judder.

### Desmond

- face/image resolves through dots;
- comedic timing from reveal, not visual mess.

### Voldy

- darker/meaner treatment;
- small bounded jitter may remain;
- audio is best-effort only and never required for scene correctness.

---

# EVENTUAL PRODUCTION SCENE CATALOGUE

Phase 1–3 must expand the engine to include:

- DOUBLE;
- OUTER BULL;
- SCRATCH / MISS X3;
- UNDO;
- SKIP;
- VISIT COMPLETE where useful;
- numbered round intro;
- DOUBLES / TREBLES / BULL round intro;
- NEW LEADER;
- LEVEL;
- SHATEKI RECORD;
- GAME WON;
- MATCH WON;
- calm idle/attract states.

Copy rules:

- default to 1–4 words;
- score/number before explanation where useful;
- avoid repeating information already obvious elsewhere in Live Game;
- do not scroll normal gameplay copy if it can be fitted/rephrased;
- humour belongs in named Shateki moments, not every dart.

---

# PERFORMANCE BUDGET

V3 is a mobile gameplay component, not a desktop animation demo.

## Runtime principles

- timestamp-based `requestAnimationFrame`;
- no fixed 30fps stepping in normal mode;
- no DOM layout reads/writes in the active render loop;
- stable cached dot mask;
- cached special-art preprocessing;
- avoid high-frequency allocation storms;
- no network fetch required for ordinary scoring scenes;
- hidden document suspends rendering;
- V3 must not degrade Throwpad response.

## Phase-0 automated render gate

Benchmark methodology:

1. preload/decode all special assets;
2. warm every scene/artwork path;
3. take one render sample per `requestAnimationFrame` boundary;
4. alternate candidate order to remove first/second bias;
5. attribute worst samples back to scene/time.

Acceptance:

- each candidate renderer p95 < **8ms**;
- each candidate renderer p99 < **16.67ms**;
- no renderer-attributed call >= **50ms**;
- at most one isolated >16.67ms call in the paced fixture;
- rendering **both** comparison candidates in the same lab frame remains <16.67ms at p95.

The last comparison-pair rule is intentionally harsher than production, where only one backend would render.

Physical iPhone Safari remains mandatory before release adoption.

---

# ACCESSIBILITY / REDUCED MOTION

Reduced motion is a first-class scene variant.

Remove/reduce:

- shake;
- large translation;
- zoom;
- repeated radial movement;
- unnecessary flashes.

Preserve:

- score/state information;
- hierarchy;
- semantic colour;
- short opacity/brightness response;
- essential feedback.

---

# SOURCE / ASSET OWNERSHIP

Current Phase-0 module shape:

```text
src/live-game/dmd/v3/
  engine.mjs
  scene-registry.mjs
  renderer.mjs
  treatment.mjs
  primitives.mjs

tools/dmd-v3-lab/
  index.html
  styles.css
  lab.mjs
  legacy-assets.mjs
```

Likely production expansion:

```text
src/live-game/dmd/v3/
  adapter.mjs
  typography.mjs
  palette.mjs
  assets.mjs
```

Do not put new V3 scenes back into `src/legacy/scripts/inline-007.js`.

The Phase-0 legacy asset extractor is lab-only and must not become the production asset architecture.

---

# MIGRATION STRATEGY

## Phase 0 — isolated visual lab

Current work.

Compare:

- same 640×160 authored scene;
- Balanced 256×64-dot treatment;
- Digital 320×80-dot treatment;
- same nine representative scenes;
- desktop and 390px phone-scale visual evidence;
- deterministic output;
- reduced motion;
- paced performance data.

Decision gate:

**visual review + measured performance**.

No production import.

## Phase 1 — renderer foundation after SC-030 stable main

Rebase/recreate implementation work from the actual final production main.

Deliver behind a `DMD_V3` feature/backend flag:

- selected dot treatment;
- owned assets;
- typography;
- text/number/shape/image layers;
- timestamp timeline;
- reduced motion;
- baseline + Single / Double / Treble / Bull / Miss;
- V2 backend retained as rollback.

## Phase 2 — competitive/control scenes

Add:

- round intros;
- visit complete;
- New Leader / Level;
- Undo / Skip;
- special scenes.

## Phase 3 — records/completion/polish

Add:

- PB;
- Shateki Record;
- Game Won / Match Won;
- idle/attract polish;
- final performance tuning;
- remove obsolete legacy scene branches only after parity proof and stabilisation.

---

# RELEASE / ROLLBACK

V3 must be feature/backend gated during adoption.

Required contract:

- V3 and V2 selectable without changing scoring/game state;
- QA can run the same interaction journeys against both;
- rollback is a backend switch or bounded release revert;
- do not delete V2 until V3 has passed release and a stabilisation window.

---

# AUTOMATED ACCEPTANCE

Permanent production V3 tests must eventually cover:

## Controller boundary

- priority/pre-emption unchanged;
- queue bounds unchanged;
- stale event handling unchanged;
- visibility handling unchanged;
- no scoring ownership imported into V3.

## Scene identity

For each registered event:

- correct scene id;
- expected duration;
- required information visible;
- no stale scene after completion/pre-emption.

## Determinism

At fixed timestamps, output is deterministic.

A test-only clock must support exact milestones such as 0 / 100 / 250 / 500ms.

## Visual regression

Capture representative phone-width evidence for:

- baseline;
- Single;
- Treble;
- Bull;
- Miss;
- Undo;
- Skip;
- PB;
- Last Dart Hero;
- Desmond;
- Voldy;
- reduced-motion variants.

## Interaction regression

Rapid fixture:

- Dart 1 -> Dart 2 -> Dart 3;
- Miss;
- Undo;
- Skip;
- immediate next-player transition;
- high-priority interruption of low-priority animation.

DMD animation must never corrupt scoring or delay the Throwpad.

## Source / dist parity

All release acceptance runs against:

- source runtime;
- fresh production `dist`.

## Cloud failure

Ordinary V3 scenes must remain functional if external/cloud calls fail.

---

# HUMAN ACCEPTANCE

Mandatory before release:

- current physical iPhone Safari;
- ordinary fast scoring;
- three rapid darts;
- Miss / Undo / Skip;
- player handover;
- special scene;
- reduced-motion setting;
- background/foreground resume;
- no flashing artefacts;
- no visible hitch that interferes with scoring.

---

# DEFINITION OF DONE

DMD V3 is release-ready only when:

- materially smoother/more digital than V2;
- visually belongs to Beta Live Game;
- DMD identity remains obvious;
- ordinary feedback is faster/cleaner, not busier;
- required semantic scenes exist;
- special scenes are upgraded and distinct;
- modular V3 source owns the renderer;
- gameplay/controller boundaries remain intact;
- reduced motion is complete;
- source + fresh `dist` regression suites are green at exact candidate SHA;
- deterministic visual evidence is accepted;
- performance is inside budget;
- physical iPhone Safari smoke passes;
- explicit `RELEASE` approval is given.

---

# BUILD LOG

## 2026-09-14 — Design discovery

Completed:

- isolated `sc032-dmd-v3-design` workstream created;
- current controller/renderer direction audited;
- MPF / FlexDMD / modern DMD pipeline concepts researched;
- web animation / Canvas performance guidance reviewed;
- strict retro 128×32 direction rejected;
- product line locked: **Beta visual quality, DMD personality**.

## 2026-09-14 — Phase 0 implementation

Completed on `sc032-dmd-v3-phase0`:

- deterministic scene model;
- reusable motion primitives;
- Canvas2D logical renderer;
- stable dot-treatment renderer;
- timestamp engine;
- reduced-motion scene variants;
- legacy special-art lab loader;
- nine-scene side-by-side visual lab;
- deterministic unit QA;
- browser screenshot/performance QA;
- CI workflow;
- HOW TO USE + BUILD LOG controls.

Early prototype result:

- low authored resolutions (256×64 / 320×80) were visually too chunky relative to requested direction;
- existing renderer audit confirmed 640×160 smooth authoring was worth preserving;
- Phase 0 corrected to 640×160 authoring with **256×64 vs 320×80 dot treatment only**;
- special-art preprocessing cached;
- benchmark changed from invalid tight synchronous loop to paced post-warmup rAF methodology.

Current status:

**Revised Phase-0 exact-head acceptance pending. No production integration.**

---

# HANDOVER

Active prototype branch:

`sc032-dmd-v3-phase0`

Design branch:

`sc032-dmd-v3-design`

The prototype branch must remain isolated from SC-030 and production.

Central engineering rule:

> **Author smooth at 640×160; apply DMD character as a selectable physical-dot output treatment.**

Next sequence:

1. get revised Phase-0 exact-head CI green;
2. inspect desktop + phone-scale evidence;
3. select Balanced 256×64-dot or Digital 320×80-dot treatment, or reject both;
4. wait for stable SC-030 production main;
5. recreate/rebase production implementation from that real main;
6. integrate V3 behind feature/backend flag with V2 rollback;
7. expand scene catalogue under source/dist/iPhone acceptance;
8. release only after explicit approval.

Do not:

- merge Phase 0 directly to `main`;
- modify SC-030 from this branch;
- import gameplay state ownership into V3;
- revert to low authored resolutions merely for nostalgia;
- choose the denser treatment because its number is larger;
- remove V2 during first V3 adoption.
