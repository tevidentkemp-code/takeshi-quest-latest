# SC-032 — Production DMD ownership / sequencing audit

Status: **BUILD/FIX — RELEASE BLOCKED**

Production baseline audited: `07c7e6d37230d2a017c99a0bde4dfb676039832f`

This document records the live production DMD ownership found during SC-032. It is descriptive engineering authority for this build, not new product canon. Current Shateki Game Rules continue to own game mechanics and scoring.

## 1. Scope

SC-032 is a presentation-only reliability and polish task.

In scope:

- DMD trigger ownership;
- visible text and artwork sequencing;
- queue/timer cancellation;
- Miss / Miss xN / Undo / Skip feedback;
- normal hit and combo presentation;
- round-end / next-player presentation;
- special artwork isolation and restoration;
- source/dist/mobile visual regression.

Out of scope:

- scoring values or rules;
- throw order or roster rules;
- mode classification;
- persistence / Supabase;
- XP, rankings or achievements criteria;
- renderer rewrite;
- the preserved Pixi/Canvas experiments.

## 2. Production ownership map

| Event / surface | Current primary owner | Renderer / fallback | SC-032 treatment |
| --- | --- | --- | --- |
| Ordinary S / D / T / Bull / Miss after `recordThrow` | `src/game/engine.js` | `inline-007.js` via `sqDmdShowZones` | Preserve current copy/logic; prevent competing legacy writers |
| Throw combinations / special phrases | `src/game/engine.js` | `inline-007.js` | Preserve current rules/copy; verify deterministic sequencing |
| Desmond / Last Dart Hero / Voldy artwork | `src/game/engine.js` | `inline-007.js` named artwork types | Preserve; verify full-width identity and clean restoration |
| End-of-visit `ROUND SCORE` / `NEXT UP` sequence | `src/game/engine.js` | `inline-007.js` | Ownership-gate every delayed frame so new input/Undo cancels stale output |
| Generic Undo | `src/live-game/live-v2.js` + modular controller | transient channel / legacy fallback | Controller-owned; no old compatibility DMD writer |
| Generic Skip | `src/live-game/live-v2.js` + modular controller | transient channel / legacy fallback | Controller-owned `TURN SKIPPED`; engine must not start competing Stage-3 sequence |
| Miss xN | `src/live-game/live-v2.js` | `inline-007.js` | Preserve current X-sequence and flow-token cancellation |
| DMD backend / queue / hard-clear token | `src/legacy/scripts/inline-007.js` | canvas renderer | Preserve API and renderer; use existing flow token as cancellation boundary |
| Pad button press animation | `inline-003.js` / `inline-004.js` | CSS | Preserve visual pulse only; remove duplicate DMD ownership |
| Vs Shadow DMD | `src/app/router-ui.js` mode-specific path | existing DMD renderer | Preserve independently; do not force generic ownership into mode-specific logic |
| Decider DMD | `src/app/state.js` mode-specific path | existing DMD renderer | Preserve independently; do not broaden SC-032 into Decider rules |
| Turbo bulk-miss suppression | current Turbo/live path via `__sqDmdBulkMiss` | engine / renderer | Preserve exactly |

### Historical-document correction

The SC-030 release document states that ordinary throw presentation was adopted into the modular controller. Live production source shows a hybrid architecture: the modular controller owns selected transients such as generic Undo/Skip, while ordinary hit/combo/round-end presentation remains in `engine.js` and renders through the released backend. SC-032 therefore treats live source as implementation authority and does **not** rewrite production merely to match historical wording.

## 3. Current production message / special matrix

The following is the currently implemented presentation matrix observed in live source. These strings are not redefined by SC-032.

| Trigger | Current visible treatment |
| --- | --- |
| Ordinary miss | `MISS` |
| Third miss after two triples or two doubles | `Boooooo!!` |
| First triple in visit | `TRIPLE!` |
| Second triple in visit | `TREBLE TROUBLE` |
| Third triple in visit | `MAXI MAYHEM` |
| First double in visit | `DOUBLE!` |
| Second double in visit | `DOUBLE LOCK` |
| Third double in visit | `DOUBLE DEVIL` |
| Bull | player prefix where available + `INNER BULL!` / `OUTER BULL!` |
| Three singles | deterministic `STEADY HAND` / `DOING THE BASICS` / `SLOW AND STEADY` |
| Mixed low-scoring completed visit (existing criteria) | `UGLY BUT IT COUNTS` |
| High-value dart under existing threshold logic | player prefix where available + `POWER DART` |
| Shanghai under current engine criteria | `SHANGHAI` |
| Two misses then scoring third dart | `LAST DART HERO`; named artwork for D/T/Bull rescue, text-only for single rescue |
| Current Desmond criteria | `DESMOND DELIGHT` + `desmondImg` |
| Current low-sector D/T Voldy criteria | `HAHA HA HAH!` + `voldyImg` |
| Generic Undo | modular `THROW UNDONE` |
| Generic Skip | modular `TURN SKIPPED` |
| End of normal visit | `ROUND SCORE` then next-player sequence, unless invalidated by newer input/Undo |
| End of completed table round | `ROUND <target>` / `COMPLETE` → `NEXT UP.. <target>` → next player / `TO THROW FIRST`, unless invalidated |

Copy differences such as `TRIPLE!` versus `TREBLE ...` are preserved because SC-032 has no product authority to rename live phrases without an explicit product decision.

## 4. Confirmed defects

### DMD-032-A — duplicate legacy pad writers

`inline-003.js` and `inline-004.js` were historical pad-feedback layers but still emitted their own Miss/Undo DMD scenes. `inline-004.js` also hard-cleared the renderer and ran delayed Miss timers. These competed with the current engine/Live-V2/controller paths.

Fix:

- retain only the visual button pulse/retrigger behaviour in those compatibility files;
- remove their direct DMD writes, queue clearing and delayed DMD timers;
- bind both intentional legacy edits to exact hash/byte evidence;
- keep the renderer backend, engine presentation and mode-specific paths unchanged.

### DMD-032-B — stale third-dart Stage-3 timers

The end-of-visit sequence in `engine.js` used raw delayed callbacks. A new throw could hard-clear the current renderer queue but could not cancel already scheduled JavaScript callbacks, so old `ROUND SCORE`, `NEXT UP` or `TO THROW FIRST` frames could repaint after newer input.

The same sequence also started during generic Skip, underneath the controller-owned `TURN SKIPPED` transient.

Red-before-green evidence captured before the fix:

- Skip advanced correctly;
- controller emitted `TURN SKIPPED`;
- delayed engine callbacks then leaked `ROUND SCORE 0` and `NEXT UP`.

Fix:

- generic Skip no longer schedules the competing Stage-3 visit banner;
- Stage-3 captures the existing renderer `__sqDmdFlowToken` and expected completed-visit history length;
- the outer callback and all six delayed follow-up callbacks revalidate ownership before rendering;
- a new throw invalidates the sequence through the existing flow-token increment;
- Undo invalidates the sequence because the completed-visit history length no longer exists;
- scoring/state writes are untouched.

## 5. Protected behaviour

The following must not change in SC-032:

- score calculation and `recordThrow` state writes;
- S/D/T multipliers and Bull scoring;
- Miss = one dart, Miss xN and Skip state semantics;
- Undo game-state restoration;
- current player/round progression;
- Official / Turbo / Practice / Vs Shadow / Training classification;
- saved-game or Supabase paths;
- PB/WR, ranking, XP or achievement criteria;
- Throwpad tap availability and speed;
- existing named special artwork identity;
- portrait Live Game layout and current mobile target-cell behaviour;
- mode-specific Vs Shadow / Decider presentation contracts.

## 6. Acceptance gates

SC-032 may not release unless the same final candidate SHA passes:

1. bounded static ownership contract;
2. intentional-legacy-patch / modular architecture verification;
3. semantic source materialisation;
4. fresh Vite production build + `verify:dist`;
5. focused DMD runtime ownership test against both source and built `dist` proving:
   - Skip does not leak Stage-3 frames;
   - rapid next-player input cancels old Stage-3 frames;
   - generic Undo remains controller-owned;
   - third-dart Undo cancels the old completed-visit sequence;
6. full existing setup/scoring/browser regression;
7. synthetic cloud-failure source/dist regression;
8. DMD artwork / Classic visual-fit regression at mobile size;
9. physical iPhone Safari smoke of real DMD messages/specials;
10. explicit RELEASE approval before merge/deployment.

## 7. Visual standard

SC-032 follows the approved Shateki DMD direction:

- dark arcade / pinball display;
- amber/orange readable feedback;
- short, punchy messages;
- minimal layout movement;
- no aggressive flicker;
- animation must never delay or block scoring input;
- Throwpad usability and fast interaction take precedence over decoration.

## 8. Rollback

Before release: close/abandon PR #40 and production remains `07c7e6d37230d2a017c99a0bde4dfb676039832f`.

After an authorised release: revert the SC-032 squash/merge commit only. SC-032 contains no Supabase/schema/data write, so no database rollback is expected.

## 9. Release state

The branch/PR remains BUILD/FIX and must stay unmerged until all final exact-head automated gates and the physical iPhone acceptance are green, followed by explicit RELEASE approval.
