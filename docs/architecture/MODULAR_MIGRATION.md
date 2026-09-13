# Shateki Quest Modular Architecture Migration

## Status

SC-031 is a behaviour-preserving architecture programme. It exists to move the production app from a 2.57 MB single-file `index.html` into a maintainable public-release codebase without rewriting working gameplay.

Production remains `main` until a migration slice has passed the existing regression suite and receives separate release approval.

## Non-negotiable constraints

- No game-rule, scoring, ranking, XP, achievement, mode or Supabase schema changes are part of SC-031.
- Preserve existing IDs, public/global function names and CSS hooks until callers are migrated and verified.
- Preserve Official/Classic, Turbo, Practice, Vs Shadow and Training isolation.
- Preserve the current GitHub Pages public URL and rollback path until a replacement deployment is independently proven.
- Keep Supabase as persistent source of truth; local storage remains cache/intentionally local state only.
- No production release from this branch without explicit approval.

## Migration strategy

The migration uses a strangler approach rather than a rewrite.

### Phase 1 — mechanical split

Goal: remove executable inline JavaScript and inline CSS from `index.html` without changing runtime behaviour.

- Extract each inline `<style>` block into `src/legacy/styles/`.
- Extract each executable inline `<script>` block into `src/legacy/scripts/`.
- Keep each replacement tag in the exact original document position.
- Keep extracted scripts as classic parser-blocking scripts so global scope and execution order are preserved.
- Rewrite relative CSS asset URLs only as required to preserve the original document-relative target.
- Leave non-JavaScript script payloads such as JSON/templates inline.
- Generate a checksum manifest and syntax-verify every extracted script.

This phase intentionally creates mechanically named legacy files. They are a temporary compatibility layer, not the final module layout.

### Phase 2 — domain consolidation

After Phase 1 regression proof, classify and consolidate legacy fragments into owned domains while preserving public hooks:

```text
src/
  app/
    bootstrap.js
    router.js
    state.js
  config/
    constants.js
    modes.js
    supabase.js
  services/
    games.js
    players.js
    rankings.js
    achievements.js
  game/
    engine.js
    scoring.js
    rounds.js
    persistence.js
  modes/
    classic.js
    turbo.js
    practice.js
    training.js
    vs-shadow.js
  live-game/
    live-game.js
    throwpad.js
    player-hud.js
    race-chart.js
    averages.js
    dmd/
      controller.js
      messages.js
      renderer.js
      effects.js
      haptics.js
  player-stats/
    hub.js
    achievements.js
    progression.js
    targets.js
  league/
    high-scores.js
    power-rankings.js
    premier-league.js
  ui/
    modal.js
    navigation.js
    toast.js
  styles/
    tokens.css
    base.css
    components.css
    live-game.css
    player-stats.css
    league.css
```

No domain is moved merely because its code is adjacent. Dependencies and mode impact must be identified first.

### Phase 3 — module/runtime boundary

Once domains are isolated and tests prove their contracts:

- Convert suitable classic scripts to ES modules.
- Introduce a single application bootstrap.
- Centralise shared state access behind explicit APIs.
- Replace polling with explicit lifecycle/render hooks where verified.
- Move Supabase access behind service functions without changing verified table/view/RPC contracts.
- Keep compatibility shims only until all verified callers are migrated.

### Phase 4 — professional build pipeline

Only after behavioural parity is proven on the split source:

- Introduce Vite as the build/dev server and production bundler.
- Add root-level `package.json` scripts for development, validation, test and production build.
- Build to a deterministic `dist/` artifact.
- Deploy GitHub Pages from the built artifact rather than source files.
- Add bundle-size and source-map review.
- Keep the previous static deployment route available as a rollback until the new Pages pipeline is verified.

Framework migration is explicitly out of scope unless there is a measured reason. Vanilla JS modules are the preferred first professional target because they minimise behavioural rewrite risk.

## Public-release quality bar

Before SC-031 can be considered release-ready:

- app boots with no uncaught console errors;
- refresh/resume works;
- 2–6 player setup remains valid;
- score entry, miss, undo and skip remain correct;
- all 14 rounds and game completion remain correct;
- Classic, Turbo, Practice, Vs Shadow and Training mode isolation passes;
- Turbo visit timer/perimeter behaviour passes;
- race chart and DMD remain within mobile bounds;
- game save/complete uses verified Supabase fields;
- Player Stats, achievements, rankings and progression regressions pass;
- Back/Close/modal behaviour passes;
- 320px, 390px and 430px mobile widths remain usable;
- no duplicate or partial local state is introduced;
- current production data truth remains unchanged;
- generated production build is reproducible;
- rollback is a single Git revert / prior Pages artifact, with no database rollback required for architecture-only slices.

## SC-030 dependency

The parked DMD V2 work in PR #32 must not be integrated into the monolith. After SC-031 establishes the modular Live Game/DMD boundary, reusable SC-030 controller/tests may be rebased or cherry-picked into the new `src/live-game/dmd/` structure and then re-verified.

## Feature Registry impact

Architecture only. No player-visible feature or product-rule change is intended by SC-031. Feature Registry impact checked: no change unless a migration slice introduces user-visible behaviour, in which case it must be handled as a separate task/change.
