# SC-032 — DMD V3 / Beta-quality digital display

Status: **DESIGN / RESEARCH ONLY** — isolated from SC-030 implementation work. No runtime code changes are authorised on this branch while SC-030 is still being completed/released.

Baseline used for design research: SC-030 release-candidate commit `34adef8aa8097aa57cb0bb5fc9afca22cf437266`.

## TASK

Design the next-generation Shateki Quest Dot Matrix Display so it reaches the same visual quality bar as the Beta Live Game UI while retaining a recognisable arcade/pinball identity.

The target is **modern digital display first, retro DMD character second**.

Locked product direction:

- approximately 65% modern digital / 35% retro arcade;
- smoother, higher-density presentation than the current DMD;
- dot-matrix texture remains visible, but dots are a display treatment rather than the design limitation;
- motion should feel like the Beta UI: fast, clean, controlled and responsive;
- 60 Hz-capable animation path using requestAnimationFrame timing, not deliberately stepped 30 fps motion;
- selective Shateki orange/amber, dark negative space and restrained secondary colour;
- no sci-fi HUD clutter;
- no invented scoring mechanics, bonuses, momentum, PB pace or random gameplay systems;
- no changes to scoring, game rules, persistence, Supabase, auth or mode routing;
- the DMD must never delay the next throw or block the Throwpad;
- reduced-motion support is mandatory from first implementation;
- iPhone Safari is a first-class release target.

## WHY V3 EXISTS

SC-030 successfully separates presentation sequencing from scoring/game rules and gives the DMD a controlled priority/queue model. That architecture should be preserved.

The remaining weakness is the renderer itself. The existing legacy renderer is capable but visually mixed-generation:

- native buffer is 640x160;
- the animation loop uses requestAnimationFrame but intentionally advances DMD motion at a 30 fps-style cadence;
- text is rendered to a canvas, thresholded into amber pixels and then passed through a round-dot mask;
- output CSS explicitly uses `image-rendering: pixelated`;
- special artwork lives inside the legacy renderer and is treated differently from normal text scenes;
- the renderer contains historical patch layers, queue handling, audio hooks, image loaders, text layout and visual effects in one large ownership area;
- the current dot mask is rebuilt procedurally on resize;
- the result has character, but transitions can feel coarse and the display does not visually match the smoother Beta Live Game modules.

V3 should therefore **retain SC-030 event sequencing while replacing the visual backend with a dedicated scene renderer**.

## EXTERNAL ENGINEERING RESEARCH

The architecture direction is informed by current pinball/display systems rather than copied literally.

### Mission Pinball Framework

Useful ideas:

- displays are separate from gameplay logic;
- slides/scenes have priorities and transitions;
- reusable widgets are composed into scenes;
- text, images, shapes and sub-displays are first-class elements;
- widget properties can be animated;
- animations can be named/reused.

Adopt: declarative scenes, reusable layers/components, named motion primitives, explicit priorities.

Do not adopt: heavyweight framework/config complexity inappropriate for this web app.

### FlexDMD

Useful ideas:

- Stage -> Actors -> Actions model;
- labels/images/groups are scene objects rather than special-case renderer branches;
- actions compose into sequences;
- render configuration is separate from game logic;
- rendering can target different output modes.

Adopt: small scene graph, composable actions/timelines, clean renderer boundary.

### DMD Extensions / modern virtual DMD tooling

Useful ideas:

- logical source frames are separated from the physical/virtual output treatment;
- high-resolution display rendering, shaders and scaling are output concerns;
- colourisation can be a transformation layer rather than content logic;
- frame pipelines can feed multiple output types.

Adopt: scene content -> frame -> DMD treatment -> output.

### Web platform performance

Use requestAnimationFrame timestamps for time-based animation. Target a steady 60 fps presentation where hardware permits. Background/hidden pages must suspend rendering. Avoid geometry/layout work during every animation frame. Keep the main-thread render budget bounded and measurable.

OffscreenCanvas/worker rendering may be investigated as an optimisation, but it is **not a hard architectural dependency**. The first releasable V3 must have a strong main-thread Canvas2D path on iPhone Safari.

## TARGET ARCHITECTURE

```text
existing gameplay state/events
          |
          v
SC-030 controller / priority scheduler
          |
          v
DMD V3 scene adapter
          |
          v
scene registry + timeline
          |
          v
logical scene canvas
          |
          v
DMD treatment pipeline
          |
          v
visible output canvas
```

### Preserve

Keep the SC-030 controller concepts:

- explicit priorities;
- equal/higher-priority pre-emption;
- bounded queue;
- stale low-priority eviction;
- idle baseline restoration;
- visibility suspension;
- reduced-motion contract;
- presentation-only ownership.

### Replace / retire incrementally

The legacy renderer should stop being the place where new V3 scenes are authored.

V3 should own:

- scene composition;
- scene timelines;
- DMD typography;
- graphics/sprites;
- per-scene colour treatment;
- modern motion primitives;
- frame rendering;
- dot/glow/glass treatment;
- V3 visual QA hooks.

Legacy DMD APIs stay available behind a compatibility adapter until every required scene is migrated and parity-proven.

## RENDERING MODEL

### Logical scene resolution

Initial engineering target: **320 x 80 logical pixels (4:1)**.

Why:

- materially denser than a classic 128x32 DMD;
- enough resolution for smoother Beta-quality typography and graphic motion;
- maps efficiently to current mobile widths;
- keeps the scene buffer small enough for reliable mobile Canvas2D performance;
- preserves a genuine DMD texture when the output dot mask is applied.

Do not hard-lock this until the prototype comparison includes 256x64 vs 320x80. The chosen resolution must be selected by visual evidence + performance data, not nostalgia.

### Important change from V2

Do **not** binary-threshold every normal scene into hard on/off pixels before output.

Preserve luminance/alpha levels through the logical scene and let the DMD output layer produce the individual illuminated dots. This enables:

- smoother text edges;
- softer fades;
- controlled brightness gradients;
- more polished score-count animations;
- better photographic/sprite treatment;
- modern digital motion without losing the dot matrix.

### Dot treatment

Use a cached/repeating dot mask or equivalent precomputed output treatment.

Requirements:

- no per-frame construction of thousands of radial gradients;
- dot grid remains stable during animation;
- dot size/spacing scales with DPR/output dimensions;
- source animation moves behind/through a stable physical display grid;
- optional low-strength persistence/glow is composited after the primary frame;
- scanlines/glass are subtle; they must not lower readability.

### Output scaling

- logical content should retain its aspect ratio;
- visible canvas should be DPR aware;
- remove the dependence on CSS `image-rendering: pixelated` for the modern path;
- the dot treatment itself provides the pixel/DMD character;
- never stretch typography non-uniformly merely to fill the shell.

## SCENE ENGINE

Create a small declarative scene system, not a general game engine.

Recommended concepts:

### Scene

A scene defines:

- id;
- duration;
- priority class inherited from controller;
- background treatment;
- layers;
- timeline;
- optional reduced-motion variant;
- optional completion/restoration behaviour.

### Layer types

Keep the first implementation intentionally small:

- `text`
- `number`
- `shape`
- `image`
- `sprite`
- `group`

Do not build an unconstrained particle engine. Any burst/ripple effect should be a bounded reusable primitive.

### Motion primitives

First releasable set:

- fade
- translate
- scale
- reveal/wipe
- number tween/count
- brightness pulse
- short shake/glitch (rare, amplitude-limited)
- radial/ring pulse
- scan/sweep

Every primitive must be timestamp-based and deterministic.

### Easing

Default visual motion should use clean ease-out / cubic curves similar to the Beta Live Game UI.

Avoid:

- bouncy/cartoon easing;
- repeated wobble;
- large shake;
- slow cinematic transitions;
- anything which makes input feel locked while a scene completes.

## VISUAL LANGUAGE

Design line: **Beta visual quality, DMD personality**.

### Palette

Primary:

- Shateki amber/orange for active DMD illumination.

Supporting colours should be rare and semantic:

- warm white / pale amber for highest-intensity numerics;
- existing Beta green for strongly positive/confirmed states where useful;
- restrained red for miss/error states;
- no rainbow/RGB arcade treatment by default.

The display should still read as one coherent machine, not a miniature LCD dashboard.

### Typography

- use the Beta UI as the quality reference;
- large numeric score should be the strongest object in hit scenes;
- labels should be short and secondary;
- avoid long all-caps sentences where a two-beat scene works better;
- use a locally available/bundled font path — no new runtime dependency on a remote font service;
- evaluate a clean condensed/digital face against the existing Beta numeric language;
- text must remain legible at the narrowest supported phone width.

### Shell

Keep the accepted SC-030 machine bezel footprint unless a later visual review proves a shell change is necessary.

V3 should improve the content inside the DMD before changing the entire Live Game layout again.

## MOTION PRINCIPLES

1. **Immediate response** — visual acknowledgement begins within the same interaction frame whenever possible.
2. **Short scenes** — ordinary throws should settle in roughly 200-550 ms.
3. **No input lock** — the user may continue throwing while low-priority animation finishes; controller pre-emption owns scene replacement.
4. **60 Hz-capable** — motion is timestamp based and visually smooth.
5. **Meaningful hierarchy** — bigger motion is reserved for Bull / achievements / records / game win.
6. **Reduced motion** — preserve information, remove unnecessary spatial/flash motion.
7. **No perpetual noise** — idle state should be alive but calm.

## EVENT / SCENE CATALOGUE

These are the first required authored scenes.

### Idle / baseline

#### PLAYER UP

Visual:

- player name/code resolves cleanly;
- current target shown as secondary information;
- subtle low-frequency scan/sweep or breathing intensity only;
- no continuous marquee unless content genuinely cannot fit.

Duration: persistent baseline.

#### TARGET CHANGE / ROUND INTRO

For standard numbered rounds:

- target numeral takes focus;
- concise `ROUND` context;
- short lateral/reveal transition.

For Doubles / Trebles / Bull:

- stronger authored intro;
- target symbol/word + round label;
- 450-700 ms;
- must not block immediate scoring input.

### Ordinary scoring

#### SINGLE

- large points number;
- small `SINGLE` label;
- brief brightness resolve;
- visit total updates underneath or as secondary numeric.

Target: 220-320 ms.

#### DOUBLE

- large points number;
- short two-beat ring/pulse;
- `DOUBLE` secondary label;
- stronger than Single, still fast.

Target: 280-380 ms.

#### TREBLE

- large points number;
- focused radial pulse / sweep;
- `TREBLE` secondary label;
- visit total tween/update;
- smooth, not explosive.

Target: 320-450 ms.

#### OUTER BULL

- `25` large;
- circular/ring language;
- `OUTER BULL` secondary.

Target: 360-460 ms.

#### BULLSEYE

- `50` large;
- controlled circular pulse;
- `BULLSEYE` resolve;
- highest ordinary-hit intensity.

Target: 420-550 ms.

### Miss / control actions

#### MISS

- quick digital X / short error-line or micro-glitch;
- `MISS` appears briefly;
- next dart state follows immediately;
- avoid a giant full-screen flashing red card.

Target: 180-260 ms.

#### SCRATCH / MISS X3

- three compact X marks or progressive strike treatment;
- `SCRATCH` / `NO SCORE`;
- slightly stronger than ordinary Miss.

Target: 320-480 ms.

#### UNDO

- score/mark reverses or retracts cleanly;
- `UNDONE` / `RESTORED` secondary copy;
- restored authoritative state becomes visible immediately.

Target: 220-320 ms.

#### SKIP

- fast forward/sweep treatment;
- `TURN SKIPPED`;
- next player appears without waiting for scene completion.

Target: 240-360 ms.

### Visit / competitive scenes

#### VISIT COMPLETE

Only show when useful. Do not make every third dart feel slower.

- visit score large;
- optional total beneath;
- transition straight into next player baseline.

Target: 350-500 ms.

#### NEW LEADER

- leader name/code;
- lead margin;
- stronger highlight sweep;
- no confetti.

Target: 500-700 ms.

#### LEVEL

- symmetrical / centred presentation;
- scoreline secondary.

Target: 450-650 ms.

### Achievement / record

#### PERSONAL BEST

- score first;
- `PERSONAL BEST` resolves after/beneath;
- premium but restrained brightness/pulse treatment.

Target: 850-1100 ms.

#### SHATEKI RECORD

- highest record treatment;
- score + `NEW SHATEKI RECORD`;
- use full display confidently but keep copy readable.

Target: 1000-1300 ms.

#### GAME WON / MATCH WON

- winner first;
- final score secondary;
- strongest clean completion scene;
- no unnecessary prolonged lockout.

Target: 1100-1500 ms.

## SPECIAL SHATEKI SCENES

Last Dart Hero, Desmond and Voldy remain part of the product identity.

V3 treatment should stop thinking of these as raw photos placed into the DMD.

Preferred pipeline:

1. load/source artwork as a real asset rather than another renderer code blob where practical;
2. crop intentionally for the scene;
3. map contrast/brightness for DMD readability;
4. pass it through the same physical dot treatment as every other V3 scene;
5. use controlled pan/zoom/reveal rather than large random shake;
6. preserve recognition of the source artwork;
7. apply only minimal supporting text.

### Last Dart Hero

- fast hero reveal;
- subtle forward zoom / highlight sweep;
- `LAST DART HERO` secondary if needed;
- no violent judder.

### Desmond

- image resolves through dots;
- short lateral/brightness reveal;
- `DESMOND DELIGHT` as supporting copy;
- comedic timing comes from reveal, not visual mess.

### Voldy

- darker contrast / reveal treatment;
- controlled short shake or glitch may be retained;
- audio remains best-effort and must never block rendering/gameplay;
- no remote-audio requirement for scene correctness.

## COPY PRINCIPLES

- default to 1-4 words;
- score/number before explanation where useful;
- avoid repeating information already obvious elsewhere in Live Game;
- never scroll ordinary gameplay copy if it can be fitted/rephrased;
- reserve marquee behaviour for attract/idle or genuinely exceptional content;
- keep humour in named Shateki moments, not every normal dart.

## PERFORMANCE BUDGET

The V3 renderer must be designed and tested as a mobile UI component, not a desktop demo.

Release targets:

- animation path capable of 60 fps on supported devices;
- no fixed 30 fps stepping in normal mode;
- frame progress derived from requestAnimationFrame timestamps;
- no DOM layout reads/writes inside the hot render loop except unavoidable canvas size/device checks outside active frames;
- logical scene frame reuse where content is static;
- dot mask/glass/persistence resources cached;
- no dynamic allocation storm per frame;
- no renderer-owned network fetch required for a scoring scene;
- rendering suspends while document is hidden;
- reduced-motion rendering uses materially less motion/work;
- V3 must not degrade Throwpad response time.

Synthetic QA budget:

- no DMD-triggered long task >= 50 ms during the standard interaction sequence in the automated environment;
- collect frame interval/render-cost telemetry during a deterministic animation fixture;
- investigate any p95 interval materially above a 60 Hz frame budget;
- physical iPhone Safari smoke remains mandatory before release.

## ACCESSIBILITY / REDUCED MOTION

Reduced-motion is a first-class scene variant.

For reduced motion:

- remove shake, large translation, zoom and repeated pulses;
- retain information hierarchy and colour changes;
- allow short opacity/brightness transitions where safe;
- number/state changes can update directly;
- never remove essential feedback.

## SOURCE / ASSET OWNERSHIP

Target module shape after implementation begins:

```text
src/live-game/dmd/
  controller.mjs          # priority/scheduling authority
  bootstrap.mjs
  motion.mjs
  v3/
    engine.mjs            # frame/timeline engine
    scene-registry.mjs    # semantic scene catalogue
    renderer.mjs          # logical canvas render
    treatment.mjs         # dot/glow/glass output
    typography.mjs
    palette.mjs
    primitives.mjs        # bounded reusable motion primitives
    assets.mjs            # owned asset manifest / preload
```

Exact filenames may change, but ownership boundaries must remain clear.

Do not put V3 scene definitions back into `src/legacy/scripts/inline-007.js`.

## MIGRATION STRATEGY

### Phase 0 — prototype / comparison

Build an isolated visual lab, not production adoption.

Compare:

- current SC-030 renderer;
- 256x64 V3 prototype;
- 320x80 V3 prototype.

Use the same fixtures:

- PLAYER UP / target;
- Single;
- Treble;
- Bullseye;
- Miss;
- Last Dart Hero;
- Desmond;
- Voldy;
- PB / record.

Decision gate: visual review + performance data.

### Phase 1 — renderer foundation

Deliver:

- logical surface;
- treatment pipeline;
- typography;
- text/number/shape/image layers;
- timestamp timeline;
- reduced motion;
- baseline + Single / Double / Treble / Bull / Miss.

Keep legacy backend available as rollback.

### Phase 2 — competitive / control scenes

Add:

- round intros;
- visit complete;
- New Leader / Level;
- Undo / Skip;
- special scenes.

### Phase 3 — record / completion / polish

Add:

- PB;
- Shateki Record;
- Game Won / Match Won;
- idle/attract polish;
- final performance tuning;
- remove obsolete V3-replaced legacy scene branches only after parity proof.

## RELEASE / ROLLBACK ARCHITECTURE

V3 must be feature-gated during adoption.

Recommended contract:

- `DMD_V3` off by default in production during development;
- V3 and V2 backend selectable without changing scoring/game state;
- QA can run identical interaction journeys against both backends;
- rollback is a feature/backend switch or a single bounded release revert, not a gameplay rollback.

Do not remove the proven V2 backend until V3 has passed release and a stabilisation window.

## AUTOMATED ACCEPTANCE

Permanent V3 tests must cover:

### Controller contract

- priority/pre-emption unchanged;
- queue bounds unchanged;
- stale event handling unchanged;
- visibility handling unchanged;
- no scoring ownership imported into V3 renderer.

### Scene identity

For every registered event:

- correct scene id;
- correct priority class;
- expected duration range;
- required text/data visible;
- no stale scene after completion/pre-emption.

### Determinism

At fixed timestamps, scene output must be deterministic.

Provide a test-only clock so frame snapshots can be generated at exact milestones such as 0 / 100 / 250 / 500 ms.

### Visual regression

Capture deterministic frame/screenshot evidence at representative phone widths.

Must include at least:

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

### Interaction regression

Rapid input fixture:

- Dart 1 -> Dart 2 -> Dart 3;
- Miss;
- Undo;
- Skip;
- immediate next-player transition;
- high-priority scene interrupting lower-priority animation.

DMD animation must never corrupt scoring state or delay the Throwpad contract.

### Source / dist parity

All release acceptance must run against:

- source runtime;
- fresh production build (`dist`).

### Cloud failure

DMD V3 must continue working if external/cloud calls fail.

No ordinary DMD scene may depend on Supabase availability.

## HUMAN ACCEPTANCE

Mandatory physical-device review before release:

- current iPhone Safari;
- ordinary fast scoring sequence;
- 3 rapid darts;
- Miss / Undo / Skip;
- player handover;
- special scene;
- reduced-motion setting;
- background/foreground resume;
- no flashing artefacts;
- no visible frame hitch that interferes with scoring.

## DEFINITION OF DONE

DMD V3 is release-ready only when:

- it looks materially smoother and more digital than V2;
- it visually belongs to the Beta Live Game UI;
- dot-matrix identity remains obvious;
- ordinary scoring feedback is faster/cleaner, not busier;
- all required semantic scenes exist;
- special Shateki scenes are upgraded and distinct;
- V3 uses modular source ownership, not legacy inline renderer expansion;
- controller/gameplay boundaries remain intact;
- reduced motion is complete;
- source + dist regression suites are green at the exact candidate SHA;
- deterministic visual evidence is accepted;
- performance instrumentation is within the agreed budget;
- physical iPhone Safari smoke passes;
- explicit RELEASE approval is given.

## BUILD LOG

### 2026-09-14 — Design discovery

Completed:

- isolated `sc032-dmd-v3-design` branch created from the frozen SC-030 candidate;
- current SC-030 controller/renderer direction audited;
- Mission Pinball Framework display/scene architecture researched;
- FlexDMD Stage/Actor/Action model researched;
- DMD Extensions / frame-pipeline and high-resolution output concepts researched;
- web animation / requestAnimationFrame / visibility / Canvas performance guidance reviewed;
- product direction changed from strict retro 128x32 emulation to smoother Beta-quality digital DMD;
- initial logical-resolution recommendation set at 320x80, subject to direct 256x64 comparison;
- migration, performance, scene, QA and rollback contracts defined.

Not started:

- runtime prototype;
- production integration;
- V3 feature flag;
- scene artwork production;
- release PR.

## HANDOVER

SC-032 is intentionally **design-only** while SC-030 is still active.

Do not merge this design branch into production and do not modify the SC-030 implementation branch from this workstream.

Next authorised sequence after SC-030 reaches production/stable main:

1. rebase/recreate SC-032 implementation branch from the final production main;
2. build the isolated DMD V3 visual lab;
3. compare 256x64 and 320x80 on the exact same fixtures;
4. choose logical resolution using product review + measured performance;
5. implement Phase 1 behind `DMD_V3` feature gate;
6. run source/dist + physical iPhone acceptance;
7. expand scenes only after Phase 1 is green.

The central design rule is fixed unless explicitly changed: **Beta visual quality, DMD personality — smoother digital presentation, not clunky retro imitation.**
