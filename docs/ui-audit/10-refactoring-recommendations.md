# 10 — Findings & Refactoring Recommendations

> **Implementation status (branch `ui-audit-fixes`):** the following findings are now FIXED and
> browser-verified — N-1 (P1.2), N-2 (P1.1), N-3 (P1.3), N-4 (P2.4), D-3 (P2.3), M-1/M-4 (P4.1),
> A-4 (P4.2), S-2/V-3 partial (P3.1 tokens). A-2 was already satisfied in current code. See
> `11-implementation-plan.md` for the per-item verification log and what remains (P3.2/P3.3 visual
> restyle, P5 structural refactors). This document itself is unchanged below.

Ranked Critical / High / Medium / Low.
References: V-x = `09-visual-inconsistencies.md`, BB-x = `08-back-button-audit.csv`,
INT-xxx = `04-interaction-map.csv`.

---

## 1. Navigation / behavioural defects

| # | Sev | Finding | Evidence |
|---|---|---|---|
| N-1 | **High** | **1-game (or final-game) match skips the leaderboard** when the player uses the MATCH COMPLETE overlay's advance button: `completeGameAndAdvanceMatch` → `endMatchToClubhouse()` → Home. The leaderboard (with GAME SCORES etc.) is only reachable via the pad's "Finish Game → Leaderboard" *after dismissing the overlay by clicking the backdrop* — which nothing signposts. Two exits, two different destinations for the same completed game. | code 15164–15214, 24115; [RUNTIME] |
| N-2 | **High** | **GAME/MATCH COMPLETE overlay has no visible close control** — backdrop-click only (V-8). Users on small screens may see no dismiss affordance at all. | [RUNTIME] |
| N-3 | **High** | **League "Loading…" never resolves to an error state** when the cloud is unreachable (V-14). Dead-end state. | [RUNTIME] |
| N-4 | Medium | **Dead controls left in the leaderboard DOM**: `#statsHubBtnFinal`, `#highScoresMenuBtnLB`, `#settingsBtnLB`, `#startScreenBtnLB`, `#restartGameBtnLB` are wired but permanently hidden by the fix170 re-skin (INT-067..069). Stats/High-Scores functionality is silently lost from that screen. | [RUNTIME] |
| N-5 | Medium | **Modal stacking**: rapidly switching admin tools can leave two `.modal-backdrop`s open (ADMIN HUB + High Scores Admin observed simultaneously). No central modal manager/z-index policy. | [RUNTIME tour7] |
| N-6 | Medium | **`show('players')` history loss**: browser Back button is not handled at all (no history API usage) — any hardware/browser back exits the app. | [CODE — no pushState anywhere] |
| N-7 | Medium | **Escape/backdrop close is per-dialog** and inconsistent (BB-16/17); GAME COMPLETE, keypad and some admin modals behave differently. | [RUNTIME] |
| N-8 | Low | `#resumeBtn` flow can silently clear an unrecoverable save (`getSavedState` → `safeClear`) with no user message. | code 17797 |
| N-9 | Low | Main Menu → End Game uses native `confirm()` (V-9) — also not styleable/consistent with the rest of the flow. | code 50377; [RUNTIME] |
| N-10 | Low | Stats hub ignores the local player cache (V-15) so the entire stats tree is unusable offline even for display. | [RUNTIME] |

## 2. Naming inconsistencies

| # | Sev | Finding |
|---|---|---|
| M-1 | Medium | Same UI concept, many code names: Home is `details`/"start screen"/"clubhouse"; leaderboard advance is static "NEXT GAME ▶" but runtime "NEXT ROUND >" (wrong domain term — rounds ≠ games). |
| M-2 | Medium | Back controls named `closeStartGameModalBtn`, `cancelSelectPlayerBtn`, `startScreenBtn` — all render "BACK" (BB-01/02/04). |
| M-3 | Medium | `#questBtn` id is recycled: legacy home "New game ▶" button vs runtime "MATCH PLAY" option card inside the modal (INT-007). |
| M-4 | Low | "START DECIDER **SHOUTOUT**" — typo for "shootout" (functions are named `…ShootoutDialog`). |
| M-5 | Low | `navAmber` vs `navOrange` duplicate accent classes (V-4). |
| M-6 | Low | `openPlayerStatsLookupDialog` defined twice back-to-back (17858/17974); `openRoundHighScoresDialog` has `_v82`/`_v85` sibling names retained. |

## 3. Visual inconsistencies
See `09-visual-inconsistencies.md` V-1 … V-15 (7+ back-button variants, 4 primary-button families,
3 tab systems, 7 modal shells, glyph drift, inline-styled keypad, lost cloud label).

## 4. Accessibility issues

| # | Sev | Finding |
|---|---|---|
| A-1 | **High** | Dynamic dialogs (~30) lack `role="dialog"`, `aria-modal`, and focus trapping; only the static New Player modal is correct. |
| A-2 | Medium | Icon-only buttons without accessible names (Main Menu `×` `sq-menu106-x`, pad `☰`, carousel NEXT pager). |
| A-3 | Medium | Cloud status conveyed by colour-only dot (V-12); no `aria-live` region. |
| A-4 | Medium | Toasts not announced (`aria-live` missing). |
| A-5 | Low | Form labels in New Player modal are `div`s, not `<label for>`; Select Player search relies on placeholder only. |
| A-6 | Low | `aria-disabled="true"` options remain fully clickable by design (TRAINING/VS AI) — acceptable pattern but they should also expose the coming-soon state to AT. |

## 5. Duplicate components

| # | Sev | Finding |
|---|---|---|
| D-1 | **High** | ≥30 hand-rolled modal builders (`createElement('div'); className='modal-backdrop'…`) each with its own close/Escape/backdrop wiring. `openModal/closeModal` exist (31878) and `openModalShell` (50342) exists, but almost nothing uses them. |
| D-2 | **High** | Back/Close buttons re-implemented per dialog (18 rows in `08-back-button-audit.csv`). |
| D-3 | Medium | Duplicate *controls in one dialog*: Match Length has header ← **and** footer BACK; New Player has ← **and** ×; Admin Hub header ← **and** ✕ behave identically. |
| D-4 | Medium | Two admin gates (keypad `4936` + legacy text password `hownowbrowncow`) — one overridden but both maintained. |
| D-5 | Medium | Duplicated function definitions where the last wins: `openTop50ScoresDialog` ×4, `openHighScoreLeagueDialog` ×4, `openPlayerProgressionDialog` ×3, `openPlayerTargetHitDialog` ×2, `openPlayerTargetPointsDialog` ×2, `openPlayerSummaryStatsDialog` ×2, `openAdminHub` export ×2, `closeToHub` ×2, `closeAll` ×2, `buildModal` ×2 (125 duplicated names total). |
| D-6 | Low | ≥11 `esc`/escapeHtml helpers; ~10 `rowsForPlayer`, 9 `parseMs`, 7 `playersOf` copies across IIFEs (header comment itself warns about this at line 699). |

## 6. Duplicate styling

| # | Sev | Finding |
|---|---|---|
| S-1 | **High** | 50 `<style>` blocks; ~45 are append-only fix sheets that re-style earlier rules (e.g. practice PB styling has 5 successive sheets: fix112 → 114 → 115 → 118 → 120 "force-style"). Specificity wars are resolved by adding stronger selectors rather than editing the original rule. |
| S-2 | Medium | The same orange primary is redefined in `ms-primary`, `sp2-confirm`, `to-start/practice-cta`, `ms2-add-saved` (measured identical `rgba(255,106,0,.68)` + `rgb(255,189,134)` border). |
| S-3 | Medium | `sq-critical-css` (60) duplicates rules later repeated in the main sheets. |
| S-4 | Low | Inline styles in JS (admin keypad, arrangeStartActions row styling, many dialog builders) bypass the stylesheet entirely. |

## 7. Dead or unreachable code

| # | Sev | Finding |
|---|---|---|
| X-1 | Medium | `#roundHighScoresModal` static modal — self-quarantined (9815). |
| X-2 | Medium | `#settingsMenuGame` (empty) and `#settingsMenuLB` + its two items; hidden top-row buttons on game & leaderboard (`.sq-hidden-top`). |
| X-3 | Medium | `openStartHighScoresMenu` + `hsMainBtn` wiring — opener never exists at runtime. `openModeChooser` superseded. |
| X-4 | Medium | Shadowed earlier definitions listed in D-5 are dead weight (~thousands of lines). |
| X-5 | Low | `window.showPage` branch in `_showPageSafe` can never run; `restartGameSafe` probes 4 function names of which several don't exist. |
| X-6 | Low | `index.txt` is an obsolete text snapshot. |
| X-7 | Low | `sq_playerhub_passwords` localStorage path deprecated by own comment (30434); `v_power_rank_last56_ranked` view unreferenced (777). |

## 8. Refactoring opportunities (priority order)

1. **Introduce one modal system** (Critical for maintainability): a single factory providing shell,
   title bar, Back vs Close semantics, backdrop/Escape handling, focus trap, `role="dialog"`,
   and a modal stack manager. Migrate dialogs incrementally (start with the league/menu-modal family,
   which is already the most uniform pattern — `menu-row` lists).
2. **One shared BackButton / CloseButton component** with two fixed variants (header icon, footer bar)
   and documented semantics: *Back = one level up, Close = exit to parent screen*. Kill the
   redundant duplicate-pair controls (D-3).
3. **Design tokens**: extract the orange primary, dark panel, border and radius values into CSS
   variables (a `:root` token block already partially exists) and collapse the four primary-button
   families (V-3) and duplicate accent classes (V-4).
4. **Flatten the patch layers**: for each `window.*` function with multiple definitions, delete all
   but the final override; merge the 45 fix stylesheets into the main sheets; remove quarantined/
   orphaned blocks (X-1..X-6). This alone likely removes several thousand lines with zero behaviour
   change (verify by diffing runtime DOM before/after).
5. **Unify the game-completion exit** (N-1): make the overlay's advance button and the pad's Finish
   button converge on one flow (award → leaderboard → NEXT GAME/END MATCH), and give the overlay an
   explicit close/continue control (N-2).
6. **Error states for cloud fetches** (N-3): wrap Supabase calls with a timeout + retry + visible
   "cloud unavailable" state; let stats/hub fall back to the local `shateki_players` cache for
   display (N-10).
7. **Split the file**: even keeping a no-build philosophy, `index.html` can load `app.css`, `app.js`,
   `patches.js` (or ES modules) — enabling diff-able reviews and ending the append-only patch style.
   The embedded self-documentation (screen/view inventory) should move to `docs/`.
8. **History integration** (N-6): `pushState` per screen + popstate → `show(id)` so hardware back
   works.
9. **Accessibility pass** (A-1..A-6) rolled into the modal factory work.
10. **Remove the dead admin text-password gate** (D-4) and document the keypad code's UI-only nature
    (as the code comment already does); confirm Supabase RLS actually enforces admin writes.

---

## Summary counts

| Metric | Count |
|---|---|
| Screens found (router pages) | **4** |
| Popups/modals/menus/overlays/toasts inventoried | **67** distinct (03-screen-inventory.csv; plus 6 partial-screen/state entries = 77 rows total) |
| Interactions mapped | **110** (04-interaction-map.csv: 82 runtime-verified, 18 partial, 10 unverified) |
| Back/return controls found | **18** distinct control groups (~30 physical instances; 08-back-button-audit.csv) |
| Inconsistent component instances flagged | **23** rows marked not/partially consistent in 07-component-inventory.csv |
| Unverified / partially verified UI states | **9** unverifiable + **28** shell-only (cloud data blocked) + **5** legacy/unreachable (03-screen-inventory.csv) |
| Unreachable / orphaned areas | **7** clusters (X-1..X-7) |

## Second verification pass (coverage check)

Before closing the audit, all 94 runtime-exported `open*/show*/build*/close*` window functions
(enumerated in the live browser) were cross-checked against the audit records:

- **69/94** were already covered by the inventories/maps.
- **25 gaps** were found and resolved: 8 internal DOM builders (documented under
  `buildEverything` in 02), 6 alias exports, and 11 legacy/orphaned dialog functions
  (`openPlayerDTBDialog`, `openPlayerDTBPctDialog`, `openPlayerDTBCombinedPctDialog`,
  `openPlayerGamesDialog`, `openTDHDialog`, `openTargetHitRateDialog`, `openSprintLeagueDialog`,
  `openPowerLeagueDialog`, `openPlayerStatsModePicker`, `openPlayerStatsSelectDialog`,
  `showTenorOnce`/#gifOverlay) — now recorded in 02 §9 and appended to 03/04
  (rows OVL-GIF-CELEBRATION, MOD-DTB-PCT, MOD-SPRINT-LEAGUE, MOD-STATS-MODE-PICKER,
  INT-111, INT-112).
- The 321 `addEventListener` / 329 `.onclick` sites were classified: user-facing handlers map to
  INT-001…INT-112; the remainder are non-interactive plumbing (resize/scroll/visibility observers,
  DMD animation, autoscroll, per-dialog Escape/backdrop wiring — the latter covered generically by
  INT-104/INT-105).

## Ten highest-priority findings

1. **N-1** Match-complete overlay's advance skips the leaderboard on the final game while the pad button goes to it — two contradictory exits (High).
2. **N-2 / V-8** MATCH COMPLETE overlay has no visible dismiss control — backdrop-only (High).
3. **N-3 / V-14** Cloud failure leaves permanent "Loading…" dead ends in every league dialog (High).
4. **D-1** 30+ hand-rolled modal implementations — the root cause of most inconsistencies (High).
5. **V-1 / D-2** Seven+ visual/behavioural variants of the Back control (High).
6. **A-1** No `role="dialog"`/focus management on ~30 dynamic dialogs (High).
7. **N-4** Leaderboard's STATS/HIGH SCORES/settings are permanently hidden dead controls — feature loss (Medium).
8. **D-5 / S-1** 125 duplicated function names + 45 append-only fix stylesheets: last-write-wins architecture makes every change risky (Medium, huge maintainability impact).
9. **V-3** Four competing primary-button families + third style introduced by fix170 (Medium).
10. **N-10 / V-15** Stats hub unusable without cloud despite a local player cache designed for display fallback (Medium).
