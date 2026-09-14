# SC-030 — Live Game / DMD V2 modular restart

Status: RELEASE CANDIDATE — runtime integration and final visual convergence implemented on the isolated SC-030 branch. Production release remains unauthorised until explicit release approval.

Production baseline at restart: `f641c60002b9dc86ed98e156724200f2af57e2d1` (tree-identical to the SC-031 release tree `e19596c3946da680b24fd4fb990dbe1b9f078cd4`; the two intervening commits only added and immediately removed an accidental documentation marker).

Branch: `sc030-dmd-v2-modular`.

Superseded build-prep branch/PR: `sc030-live-game-dmd-v2` / PR #32. Reuse evidence and intent only; do not merge it onto the modular app.

## Source authority used

- SHATEKI QUEST — CANONICAL SOURCE MAP
- CURRENT_Shateki_Quest_Working_Rules
- CLAUDE.md
- CURRENT_Shateki_Quest_Game_Rules
- current production GitHub source after SC-031
- Theming & Layout: theme direction, UI reference notes, colour palette, component guide and visual decision log

## Locked visual/product direction

- dark arcade / pinball / pub-league identity;
- mobile portrait first;
- Shateki orange used selectively, not as constant glow;
- DMD remains a fixed-footprint retro display with short readable messages;
- Throwpad speed, reachability and scoring clarity beat decoration;
- no scoring multipliers, random bonuses, loot, invented streak or PB-pace mechanics;
- no per-dart Supabase traffic;
- no security weakening;
- no Throwpad S/D/T point sublabels;
- true iPhone haptics remain native/App-Store work unless WebKit exposes a supported web API.

## Phase 1 owned boundary

`src/live-game/dmd/controller.mjs`

Owns presentation sequencing only:

- event priority: idle, throw, visit, competitive, achievement, record, game;
- equal/higher priority pre-emption;
- timer-generation protection;
- bounded pending queue;
- stale low-priority throw/visit eviction after 900 ms by default;
- idle baseline separated from transient scenes;
- document-level visibility lifecycle;
- capability-safe optional vibration adapter, disabled by default;
- concise approved message catalogue;
- existing Last Dart Hero / Desmond / Voldy image type mapping;
- visual-shell CSS for the actual top-bar DMD `#sqDmdWrap` / `#sqDmdCanvas`.

The controller now loads through the source-authoritative DMD bootstrap. Runtime adoption, action responsiveness, Undo/Skip behaviour, semantic CSS ownership and reduced-motion handling are implemented and covered by dedicated regressions.

## Corrections versus parked PR #32

1. Visibility handling now binds to `document.visibilitychange`, not `window`.
2. Low-priority queued throw/visit messages expire instead of replaying after a long record/achievement/game scene.
3. Idle/player-up state is a baseline, not an indefinitely active transient message.
4. Visual shell targets the real top-bar DMD and explicitly excludes `#v2InfoDmd` (Game Race canvas).
5. Haptics are opt-in/off by default.

## Phase 1 acceptance

`tools/ui-smoke/verify-sc030-dmd-v2.mjs` verifies:

- copy catalogue and special-round labels;
- existing image mappings;
- priority pre-emption and stale timer cancellation;
- stale low-priority queue eviction;
- idle/transient separation;
- `document.visibilitychange` bind/unbind;
- haptic capability safety and default-off state;
- fixed-footprint visual CSS contract;
- no Game Race selector contamination;
- no rainbow palette.

Dedicated workflow: `.github/workflows/sc030-dmd-v2-modular.yml`.

## Next implementation slice after Phase 1 green

1. Inspect the final production DMD backend (`src/legacy/scripts/inline-007.js`) and current scoring event owners (`src/game/engine.js`, `src/live-game/live-v2.js`).
2. Add the smallest source-authoritative bootstrap after the existing DMD backend is available.
3. Integrate ordinary throw/Miss/visit/player/round/Undo/Skip events at verified hooks without changing scoring semantics.
4. Preserve existing named combo/easter-egg animations until each has explicit controller parity.
5. Move visual-shell declarations into the semantic Live Game CSS source before release; do not leave production visual CSS hidden inside a JS injector if a normal CSS owner is available.
6. Run full setup/scoring/saved-player/Classic/Turbo/Practice/Vs Shadow/Training regressions and 320/390/430 mobile fit before any release request.

## Security boundary

SC-030 does not touch Supabase permissions/auth. The known Auth-backed destructive-admin/RLS work is separately deferred to the next security session and must not be mixed into this visual build.

## Rollback

Before release: abandon/close the SC-030 branch/PR.
After a future SC-030 release: revert only its merge commit. No Supabase rollback should be required.
