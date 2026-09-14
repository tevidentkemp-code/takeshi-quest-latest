# SC-032 — DMD V3 Phase 0 / HOW TO USE

## Purpose

This visual lab exists to compare two next-generation Shateki Quest DMD **dot-treatment densities** before any V3 renderer is adopted by the live game.

It is intentionally isolated from production. Nothing under `src/live-game/dmd/v3/` is imported by the game at this stage.

The key product rule is now explicit:

**Both candidates are authored at 640×160.**

The comparison is no longer low-resolution scene authoring. The smooth digital scene stays constant and only the visible dot treatment changes.

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

### Candidate A — Balanced

- authored scene: **640×160**;
- physical dot treatment: **256×64**;
- visible output: 640×160 in the lab;
- stronger visible DMD texture while retaining smooth high-density typography and animation.

### Candidate B — Digital

- authored scene: **640×160**;
- physical dot treatment: **320×80**;
- visible output: 640×160 in the lab;
- finer dot texture and the smoother / more digital presentation closest to the Beta Live Game direction.

Both candidates use the same authored pixels, scene model, timings, artwork, palette, typography and visible output size. **Dot density is the controlled variable.**

This correction matters because the existing DMD already uses a 640×160 native buffer specifically to improve text smoothness. Reducing V3 authoring to 256×64 or 320×80 would have made the redesign more retro/chunky, which conflicts with the requested product direction.

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

`Run benchmark` warms every scene/artwork path and then measures one render sample per `requestAnimationFrame`, matching the scheduling boundary used by the real animation engine. It reports median, p95, p99 and maximum renderer cost.

## What to judge visually

Prioritise these questions in this order:

1. Is the content immediately readable while actually playing darts?
2. Does it feel materially smoother and more digital than DMD V2?
3. Does it still unmistakably look like a dot-matrix display rather than a normal OLED panel?
4. Does it visually belong with the Beta Live Game UI?
5. Are ordinary hit scenes fast and clean rather than busy?
6. Do Last Dart Hero / Desmond / Voldy look integrated into the DMD rather than pasted on top?
7. Does 320×80 dot treatment produce a worthwhile improvement over 256×64 at **real phone display size**, or does it make the dot character too subtle?

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

The browser suite captures both desktop comparison frames and phone-scale evidence at a 390px CSS viewport.

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
