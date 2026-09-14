# SC-030 — Live Game / DMD V2 modular restart

Status: **RELEASE CANDIDATE** — implementation and final visual convergence are complete on the isolated `sc030-dmd-v2-modular` branch. Production release is not authorised until explicit release approval.

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

## Release-candidate acceptance

The final gate is `.github/workflows/sc030-release-candidate-qa.yml`.

It must pass, at the same candidate head:

- production ancestry and clean delivery-surface checks;
- DMD controller and reduced-motion unit contracts;
- modular source-authority verification;
- deterministic HTML reconstruction;
- Vite build and dist-parity verification;
- source-runtime DMD, convergence, actions, Undo, setup, smoke, Classic visual fit, training, progression, player-stats and admin regressions;
- the same runtime suite against built `dist`;
- synthetic cloud-failure resilience against source and dist;
- generated screenshot/evidence capture for final product inspection.

No green result from an older head authorises release after a subsequent candidate change.

## HANDOVER

Current engineering state:

- SC-031 modular architecture is already production baseline.
- SC-030 remains isolated on `sc030-dmd-v2-modular`.
- The DMD controller, bootstrap, event adoption, reduced motion, interaction responsiveness, Undo/Skip behaviour, semantic CSS ownership and final visual convergence are implemented.
- The old Phase-1-only wording is superseded by this document.
- The parked pre-SC-031 PR #32 remains non-mergeable evidence only.
- No SC-030 production release has been performed.

Remaining steps:

1. Final release-candidate QA must finish green at the current candidate head.
2. Inspect the generated 320 / 390 / 430 screenshots plus Last Dart Hero / Desmond / Voldy evidence for product fit.
3. If visual evidence is below the locked direction, make only a bounded convergence fix and rerun the same full gate.
4. When evidence is accepted, open the SC-030 release PR for explicit approval.
5. Merge/release only after that approval.
6. After SC-030 is closed, handle Shateki Engineering Hardening separately: path-specific agent instructions, enforceable dangerous-operation gates/hooks and a formal acceptance-criteria convergence gate. Do not mix that work into SC-030.

## Security boundary

SC-030 does not alter Supabase permissions/auth. The known Auth-backed destructive-admin/RLS hardening remains a separate security change and must not be mixed into this visual/gameplay release.

## Rollback

Before release: abandon/close the SC-030 branch/PR.

After a future SC-030 release: revert only its merge commit. No Supabase rollback should be required.
