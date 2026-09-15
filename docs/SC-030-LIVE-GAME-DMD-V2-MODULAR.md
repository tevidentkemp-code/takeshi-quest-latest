# SC-030 — Live Game / DMD V2 modular restart

Status: **FOLLOW-UP RELEASE CANDIDATE** — SC-030 was released through PR #34 as squash commit `31c02a2cb7a0cf684e976cda4d14bef9d866e54f`. The corrected current-round score-cell layout remains isolated until its exact-head QA and release approval are complete.

Production baseline at restart: `f641c60002b9dc86ed98e156724200f2af57e2d1`, tree-identical to the SC-031 production release tree.

Superseded build-prep branch/PR: `sc030-live-game-dmd-v2` / PR #32. It is evidence only and must not be merged onto the modular app.

## TASK

Deliver the Live Game/DMD V2 upgrade on top of the SC-031 modular architecture while preserving scoring, game rules, persistence and backend security boundaries.

Locked product direction:

- dark arcade / pinball / pub-league identity;
- mobile portrait first;
- selective Shateki orange rather than constant glow;
- DMD remains a fixed-footprint retro display with short readable messages;
- Throwpad speed, reachability and scoring clarity beat decoration;
- no scoring multipliers, random bonuses, loot, invented streak or PB-pace mechanics;
- no per-dart Supabase traffic;
- no security weakening;
- no Throwpad S/D/T point sublabels;
- true iPhone haptics remain native/App-Store work unless WebKit exposes a supported web API.

Source authority used:

- SHATEKI QUEST — CANONICAL SOURCE MAP;
- CURRENT_Shateki_Quest_Working_Rules;
- CLAUDE.md;
- CURRENT_Shateki_Quest_Game_Rules;
- current production GitHub source after SC-031;
- current theming/layout direction, UI references, palette, component guide and visual decision log.

## BUILD LOG

Completed delivery:

1. Added the modular DMD presentation controller with explicit event priority for idle, throw, visit, competitive, achievement, record and game scenes.
2. Added equal/higher-priority pre-emption, timer-generation protection, a bounded pending queue and stale low-priority throw/visit eviction.
3. Kept idle/player-up state as a baseline rather than an indefinitely active transient scene.
4. Corrected visibility lifecycle handling to `document.visibilitychange`.
5. Kept optional vibration capability-safe and disabled by default.
6. Added the source-authoritative DMD bootstrap and integrated the controller into the live runtime after the legacy renderer is available.
7. Adopted ordinary throw, Miss, visit, player, round, Undo and Skip presentation hooks without changing scoring semantics.
8. Preserved the existing Last Dart Hero, Desmond and Voldy special-scene mappings.
9. Made Skip immediate and made Undo feedback truthful while preserving the restored DMD/player state.
10. Moved DMD cabinet styling into semantic Live Game CSS ownership rather than runtime-injected visual CSS.
11. Added reduced-motion behaviour and dedicated unit/runtime regression coverage.
12. Added action-responsiveness and rapid-interaction regression coverage.
13. Final visual convergence:
    - Last Dart Hero / Desmond / Voldy artwork now preserves aspect ratio while filling the usable DMD width, with centred vertical canvas cropping rather than narrow `contain` presentation;
    - removed the redundant outer Live V2 cabinet so the inner player/shot/round modules receive the reclaimed horizontal space;
    - removed the redundant DMD host card while retaining one meaningful `.sq-dmd` machine bezel;
    - removed unnecessary DMD wrapper horizontal padding so the bezel uses the available width.
14. Added `tools/ui-smoke/verify-sc030-final-convergence.js` to enforce the shell simplification at 320 / 390 / 430 widths.
15. Updated Classic visual-fit acceptance so named DMD artwork must genuinely fill the display width.
16. Extended the final release-candidate workflow so the convergence regression runs against both source runtime and Vite `dist` runtime.
17. Removed all one-shot SC-030 writer/generator workflows and scripts from the delivery surface after use.
18. Hardened the semantic Live V2/DMD shell selectors so later compatibility and Turbo styles cannot recreate the removed outer cabinets; the preserved legacy styles remain untouched and semantic Live Game CSS is authoritative.
19. Closed a release-evidence false-positive: added `tools/ui-smoke/verify-sc030-artwork-isolation.js`, which hard-isolates Last Dart Hero / Desmond / Voldy scenes, proves three distinct artwork sources, verifies repeated full-width frames and rejects stale artwork leaking into the following text-only scene. The release-candidate workflow runs this acceptance against both source and built `dist`.
20. Applied the bounded responsive Live Game patch: the narrowest mobile viewport shows two historic rows so the live score stays above the graph and Throwpad; standard mobile retains three historic rows; the gameplay rows remain in their original position below the player cards and averages.
21. Reworked the current-round score cells so each player has three original square target dots in the lower half of that player's own cell, with the score above them and the left-hand round-label gutter preserved. Historic rows contain scores only; the standalone target strip and duplicate indicators are removed.
22. The live renderer derives each player's target state from `state.score[i][currentRound].darts` and the gameplay cursor. When the round advances, the new current-round cells immediately reset to orange idle/next dots without delaying or mutating gameplay.
23. Extended `tools/ui-smoke/verify-sc030-responsive-runtime.js` and the Classic visual-fit regression in both source and built-`dist` release stages. They assert row counts, score/graph/Throwpad geometry, current-cell ownership, square target geometry, absence of repeated names and standalone strips, immediate next-round reset, state immutability and live parity through darts, Miss, Undo, Skip and handover.

## Release-candidate acceptance

The final gate is `.github/workflows/sc030-release-candidate-qa.yml`.

It must pass, at the same candidate head:

- production ancestry and clean delivery-surface checks;
- DMD controller and reduced-motion unit contracts;
- modular source-authority verification;
- deterministic HTML reconstruction;
- Vite build and dist-parity verification;
- source-runtime DMD, convergence, actions, Undo, setup, smoke, Classic visual fit, isolated artwork identity/stale-scene, training, progression, player-stats and admin regressions;
- the same runtime suite against built `dist`;
- synthetic cloud-failure resilience against source and dist;
- generated screenshot/evidence capture for final product inspection.
- final responsive Live Game acceptance at 320 / 390 / 430px against source and built `dist`, including current-round square targets and immediate reset on round advance.

No green result from an older head authorises release after a subsequent candidate change.

Final release evidence must identify the exact candidate SHA and successful RC workflow run. To avoid invalidating that exact-head evidence with a documentation-only commit, the immutable run/SHA evidence and final rollback packet are recorded on the release PR after the gate finishes, while this file defines the acceptance contract.

## HANDOVER

Current engineering state:

- SC-031 modular architecture is already production baseline.
- SC-030 shipped through PR #34; this responsive correction remains isolated from `main` pending its release gate.
- The DMD controller, bootstrap, event adoption, reduced motion, interaction responsiveness, Undo/Skip behaviour, semantic CSS ownership, final visual convergence and isolated artwork acceptance are implemented.
- The final responsive Live Game correction is implemented: two historic rows at 320px, three at 390px and 430px, and three square current-round target cells embedded in each player's live score cell above the round scores and backed by existing score/cursor state.
- The old Phase-1-only wording is superseded by this document.
- The parked pre-SC-031 PR #32 remains non-mergeable evidence only.
- The original SC-030 release is on `main`; the follow-up correction has not been released.

Remaining steps:

1. Final release-candidate QA must finish green at the corrected follow-up candidate head, including isolated artwork and responsive acceptance against source and `dist`.
2. Inspect the generated 320 / 390 / 430 screenshots plus isolated Last Dart Hero / Desmond / Voldy / text-only evidence for product fit.
3. Complete one real-device iPhone-sized visual smoke test of the final candidate, with no scoring/persistence mutation beyond ordinary disposable test play.
4. If visual evidence is below the locked direction, make only a bounded convergence fix and rerun the same full gate.
5. Record the follow-up candidate SHA, workflow run, production delta, risks and rollback packet on its release PR.
6. Merge the follow-up after the explicit release approval already recorded for this candidate.
7. After SC-030 is closed, handle Shateki Engineering Hardening separately: path-specific agent instructions, enforceable dangerous-operation gates/hooks and a formal acceptance-criteria convergence gate. Do not mix that work into SC-030.

## Security boundary

SC-030 does not alter Supabase permissions/auth. The known Auth-backed destructive-admin/RLS hardening remains a separate security change and must not be mixed into this visual/gameplay release.

## Rollback

The released SC-030 baseline can be rolled back by reverting PR #34's squash commit. Before the follow-up release, abandon or close its branch/PR; after release, revert only its squash merge commit. No Supabase rollback should be required.
