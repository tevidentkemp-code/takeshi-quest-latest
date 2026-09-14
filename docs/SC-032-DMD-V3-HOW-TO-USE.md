# SC-032 — DMD V3 Phase 0 / HOW TO USE

## Purpose

This visual lab exists to compare two next-generation Shateki Quest DMD rendering densities before any V3 renderer is adopted by the live game.

It is intentionally isolated from production. Nothing under `src/live-game/dmd/v3/` is imported by the game at this stage.

## Branch

Use:

`sc032-dmd-v3-phase0`

Do not merge this branch into production while SC-030 is still being completed/released.

## Run locally

From the repository root:

```bash
python3 -m http.server 8125 --bind 127.0.0.1
```

Then open:

`http://127.0.0.1:8125/tools/dmd-v3-lab/index.html`

The lab loads the existing Last Dart Hero, Desmond and Voldy artwork from the legacy DMD source for prototype comparison only. It does not modify those assets.

## What you are comparing

### Candidate A — 256 × 64 logical surface

- logical scene: 256×64;
- physical dot treatment: 128×32;
- visible output: 640×160 in the lab;
- closest to traditional DMD density while retaining smoother authored content.

### Candidate B — 320 × 80 logical surface

- logical scene: 320×80;
- physical dot treatment: 160×40;
- visible output: 640×160 in the lab;
- denser / smoother digital presentation while retaining visible dot structure.

Both candidates use the same scene model, timings, artwork and output size. The resolution/dot density is therefore the controlled variable.

## Lab controls

Scene buttons switch between the Phase 0 fixtures:

- PLAYER UP
- SINGLE
- TREBLE
- BULLSEYE
- MISS
- PERSONAL BEST
- LAST DART HERO
- DESMOND
- VOLDY

`Replay scene` restarts the current animation.

`Reduced motion` renders the same information hierarchy without large radial movement, image jitter or unnecessary spatial animation.

`Run benchmark` repeatedly renders all Phase 0 fixtures through both candidates and reports median/p95/max render cost in the current browser.

## What to judge visually

Prioritise these questions in this order:

1. Is the content immediately readable while actually playing darts?
2. Does it feel materially smoother and more digital than DMD V2?
3. Does it still unmistakably look like a dot-matrix display?
4. Does it visually belong with the Beta Live Game UI?
5. Are ordinary hit scenes fast and clean rather than busy?
6. Do Last Dart Hero / Desmond / Voldy look integrated into the DMD rather than pasted on top?
7. Is 320×80 meaningfully better than 256×64 at real phone size, or merely denser?

Do not choose a candidate because larger numbers sound better. The winning renderer must justify its density visually and in performance evidence.

## Automated acceptance

Pure deterministic scene checks:

```bash
node tools/ui-smoke/verify-sc032-dmd-v3-units.mjs
```

Browser acceptance requires the UI-smoke dependencies and Chromium, then:

```bash
SQ_DMD_V3_LAB_URL=http://127.0.0.1:8125/tools/dmd-v3-lab/index.html \
node tools/ui-smoke/verify-sc032-dmd-v3-lab.js
```

The GitHub workflow `.github/workflows/sc032-dmd-v3-phase0.yml` runs the full Phase 0 gate automatically on this branch.

## Release boundary

This lab is not a release candidate.

A Phase 0 visual winner only authorises the next implementation phase. Production adoption still requires:

- final SC-030 production baseline;
- V3 feature flag;
- controller/backend compatibility;
- full source and built-`dist` regression;
- performance acceptance;
- reduced-motion acceptance;
- physical iPhone Safari smoke;
- explicit RELEASE approval.
