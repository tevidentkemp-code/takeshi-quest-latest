# 11 — Prioritised Implementation Plan (ui-audit-fixes)

**Branch:** `ui-audit-fixes` (from audit commit `7cd9320`)
**Status:** PLANNED — no application changes made yet.
Finding references: N/M/A/D/S/X-x = `10-refactoring-recommendations.md`, V-x = `09-visual-inconsistencies.md`,
INT-xxx = `04-interaction-map.csv`, BB-xx = `08-back-button-audit.csv`.

Each work item will receive an **Implementation status** note (`PLANNED → IN PROGRESS → DONE (commit) → VERIFIED (evidence)`)
here and a matching verification note in the source audit record. Audit files are otherwise frozen.

## Ground rules for every item

- All verification runs against a **local server with `*.supabase.co` blocked at the network layer**
  (the audit's Playwright harness). Production data can never be touched by test runs.
- The destructive admin flow ("Remove Duplicate High Scores") and cloud-write paths (SAVE PLAYER)
  are never exercised; their code is only modified where a finding explicitly requires it.
- One concern per commit; before/after screenshots for anything visual; the P0 smoke suite must
  pass before and after every phase.
- `index.html` is patch-layered (later blocks override earlier ones). Every edit must be made in
  the **final live definition**, not the first match found.

---

## P0 — Safety net first (blocks everything else)

| # | Item | Findings | Verification | Risk |
|---|---|---|---|---|
| P0.1 | Convert the audit Playwright harness into a repeatable smoke suite: boot → Select Game Mode tree → Match Card (2 guests) → Match Length → Throw Order → full game → game-complete → leaderboard → Game Scores → End Match → Home. Assert `body[data-page]` transitions, modal open/close, and zero console errors. Store under `tools/ui-smoke/` (new dir, not an audit file). | enables all | Suite green on unmodified `ui-audit-fixes` HEAD (baseline). | Low |
| P0.2 | Add a DOM-snapshot helper (serialise visible structure per screen) so refactors can be diffed against baseline. | enables P2–P5 | Baseline snapshots committed. | Low |

## P1 — Critical/High behavioural defects

| # | Item | Findings | Approach | Verification | Risk |
|---|---|---|---|---|---|
| P1.1 | Give the GAME/MATCH COMPLETE overlay an explicit dismiss control | N-2, V-8, INT-061 | Add a visible close (✕) and/or "CONTINUE" affordance to `.gc-arcade-shell` (built at `openGameCompleteDialog`, line 14960) that triggers the same path as backdrop-click. | Playwright: complete a game, click new control, assert overlay gone and "Finish Game → Leaderboard" pad state reachable. Screenshot before/after. | Low — additive |
| P1.2 | Unify the two contradictory game-completion exits | N-1, INT-059 vs INT-062 | Make `completeGameAndAdvanceMatch` (15164) route through the leaderboard when the match is complete (replace `endMatchToClubhouse()` short-circuit with `awardAndShowLeaderboard()` + leaderboard END MATCH flow), so overlay-advance and pad-Finish converge. Keep END MATCH → Home behaviour on the leaderboard itself. | Playwright: 1-game match — overlay advance lands on leaderboard; 2-game match — advance starts game 2; END MATCH returns Home. Re-verify INT-059/062/063/065. | **Medium — core flow; needs both match lengths tested** |
| P1.3 | Timeout + error state for cloud-backed dialogs stuck on "Loading…" | N-3, V-14, STATE-LOADING-LEAGUE | Wrap the league/stats fetch call sites (Power Rankings 51232/53283, Premier League 51452, HS League, Streak, Round HS, Top 50 51853, Latest Scores 37067) with a shared `withCloudTimeout(promise, ms)` helper rendering a "Cloud unavailable — retry" state. | Playwright with Supabase blocked: each dialog shows the error state (not eternal "Loading…"); retry button re-attempts. | Low-Medium — read-path only |

## P2 — Back/Close semantics, duplicate controls, dead leaderboard controls

| # | Item | Findings | Approach | Verification | Risk |
|---|---|---|---|---|---|
| P2.1 | Codify semantics: **Back = one level up, Close = exit to parent screen**; document in this file; implement shared CSS classes `sq-back` (footer bar, from `.ms2-back` baseline) and `sq-icon-back`/`sq-icon-close` (38×38, 10px radius, from `.icon-btn` baseline) plus tiny JS factories. | V-1, V-2, D-2, BB-01..BB-18 | New CSS block + helper functions; no behaviour change yet. | Style-capture script shows the new classes render identically to the chosen baselines. | Low |
| P2.2 | Migrate all back/close controls to the shared classes: `np-back`/`np-close` (BB-07/BB-15), `ml-back` (BB-06), league `sq132-back/close` pills (BB-10), six admin `.btn` Backs (BB-11/12), Main Menu `sq-menu106-x` (V-10). Normalise glyphs (`←` header back, `✕` header close) and font-weight drift in the `ms2-back` family (BB-02). | V-1, V-2, V-10, D-2 | Class swap per dialog, one commit per family. | Re-run style capture: single set of computed values; visual screenshots per dialog; smoke suite green. | Medium — many touch points, mechanical |
| P2.3 | Remove redundant duplicate controls per dialog: Match Length header ← **or** footer BACK (keep one — recommend footer, matching sibling modals); New Player ← vs × (keep × only, since both just close); Admin Hub ← vs ✕ (keep ✕ only, or make ← genuinely step back to keypad-less Home — recommend keep ✕). | D-3, BB-05/06/07/08, INT-022/023/031/032/101 | Delete the redundant element + wiring. | Playwright: remaining control closes correctly; DOM snapshot diff shows only intended removals. | Low-Medium — product-visible; flag in PR |
| P2.4 | Leaderboard dead controls: **decision needed** — (a) restore STATS and HIGH SCORES as rows in the fix170 action stack, or (b) delete the hidden top row + its wiring. Recommend (a) for STATS (feature loss otherwise) and (b) for the rest (Start Screen/Restart already live in Main Menu). | N-4, INT-067/068/069, X-2 | Modify fix170 re-skin block (53569) once; remove `.sq-hidden-top` corpses. | Playwright: leaderboard shows working STATS entry; hidden buttons gone from DOM. | Medium |

## P3 — Visual consolidation (tokens)

| # | Item | Findings | Approach | Verification | Risk |
|---|---|---|---|---|---|
| P3.1 | Introduce design tokens (`--sq-primary`, `--sq-panel`, `--sq-border`, `--sq-radius-*`) in `:root`; re-point the measured duplicates (`rgba(255,106,0,.68)` + `rgb(255,189,134)` etc.) at them. | S-2, V-3 | CSS-only; values identical. | Style capture byte-identical computed values. | Low |
| P3.2 | Collapse the four primary-button families (`ms-primary`, `sp2-confirm`, `to-start practice-cta`, `np-save`) onto one class; align radius/weight with the Home primary or the setup funnel (pick one — recommend the 8px funnel style everywhere except the Home hero button). | V-3, 07-component rows | Class consolidation. | Screenshots of all 6 primary buttons; smoke suite. | Medium — visible restyle |
| P3.3 | Merge `navAmber`→`navOrange`; unify tab/chip systems (league pills vs `sp2-chip`) onto one `sq-tab` class. | V-4, V-6, M-5 | CSS + class swap. | Style capture + screenshots. | Low |

## P4 — Naming and accessibility

| # | Item | Findings | Approach | Verification | Risk |
|---|---|---|---|---|---|
| P4.1 | User-visible wording: leaderboard "NEXT ROUND >" → "NEXT GAME ▶" (fix170 block); "START DECIDER SHOUTOUT" → "SHOOTOUT". | M-1, M-4, V-7 | String edits in the live patch blocks. | Screenshots; smoke suite asserts new labels. | Low |
| P4.2 | A11y batch: `role="dialog"` + `aria-modal` + focus-to-modal + document-level Escape in the shared back/close factory work (extends P2.1); `aria-live="polite"` on toast; `aria-label` on `sq-menu106-x`, pad ☰, carousel NEXT; restore accessible cloud-status text (visually-hidden label next to the dot); `<label for>` on New Player fields. | A-1..A-5, V-12 | Incremental, alongside P2 migrations. | Playwright a11y probes (roles/names present); axe-core pass on each screen. | Low-Medium |
| P4.3 | Internal identifier renames (`closeStartGameModalBtn`, `cancelSelectPlayerBtn`, recycled `questBtn`, alias exports): **documentation-only** — record canonical names in 02; do NOT rename in code this round (high regression risk in a patch-layered file for zero user value). | M-2, M-3, M-6 | Doc note only. | n/a | none |

## P5 — Structural refactors (highest effort; only after P1–P4 are green)

| # | Item | Findings | Approach | Verification | Risk |
|---|---|---|---|---|---|
| P5.1 | Shared modal factory (`sqModal({title, onBack, onClose, body})`) providing shell, header, semantics, backdrop/Escape, focus trap, and a modal **stack manager** (fixes stacking bug N-5). Migrate the `menu-modal` family first (Admin/Stats/League/Main Menu — already near-uniform), then league dialogs, then the rest incrementally. | D-1, N-5, N-7, A-1 | New helper + per-family migration commits. | Smoke suite + per-dialog open/close/stack tests; DOM snapshot diffs. | **High — largest change; strictly incremental** |
| P5.2 | Replace native `confirm()` in `doEndGame` (50377) with the styled confirm used by End Match. | N-9, V-9, INT-046 | Reuse fix170 confirm builder. | Playwright: End Game shows styled confirm; cancel/confirm paths work. | Low |
| P5.3 | Dead-code removal, in verified batches: (a) shadowed duplicate definitions (`openTop50ScoresDialog` ×3 dead, `openHighScoreLeagueDialog` ×3, `openPlayerProgressionDialog` ×2, etc. — D-5); (b) quarantined/orphaned blocks (`#roundHighScoresModal`, `#settingsMenuGame/LB`, hidden top-row buttons after P2.4, `openStartHighScoresMenu`, `openModeChooser`, orphaned DTB/TDH/Sprint dialogs — X-1..X-5); (c) `index.txt` (X-6). Each batch: delete → full smoke suite + DOM snapshot diff → commit separately for easy revert. | D-5, X-1..X-6, S-1 (partial) | Mechanical deletion with the P0 net. | Runtime `window` function census before/after (only dead names disappear); smoke suite; snapshots identical. | Medium — bulk but guarded |
| P5.4 | Stylesheet flattening: merge superseded fix sheets into their final effective rules (start with the 5-sheet practice-PB chain fix112→120). | S-1, S-3, S-4 | Per-chain merge; computed-style capture as oracle. | Style capture identical on affected components. | Medium |

## P6 — Deferred (needs product decision; not scheduled)

- **N-6** Browser-history integration (`pushState`/`popstate`) — behaviour change for all users; decide desired back-button UX first.
- **N-10 / V-15** Stats hub offline fallback to the local player cache — contradicts the code's "cloud is stats authority" policy comments; needs owner sign-off.
- **File split** (recommendation §8.7) — large mechanical change; best done after P5 shrinks the file.
- **D-4** Removing the legacy text-password admin gate — confirm nothing external depends on `ADMIN_PASSWORD` first.
- Tournament/Vs Shadow flows — under-verified in the audit (cloud-dependent); fix work there should wait for an environment with a test Supabase instance.

## Suggested execution order & checkpoints

1. **P0.1–P0.2** (baseline green) →
2. **P1.1, P1.3, P1.2** (behavioural fixes; P1.2 last as riskiest) →
3. **P2.1 → P2.2 → P2.3 → P2.4** (back/close system; product sign-off on P2.3/P2.4 choices) →
4. **P3.1–P3.3** (tokens) →
5. **P4.1–P4.2** (labels + a11y) →
6. **P5.2 → P5.1 → P5.3 → P5.4** (structural, each behind the smoke suite).

Decision points requiring owner input before implementation:
- **P1.2**: confirm the desired final-game destination is the leaderboard (audit assumed yes).
- **P2.3**: which duplicate control to keep per dialog.
- **P2.4**: restore vs delete the leaderboard STATS/HIGH SCORES features.
- **P3.2**: which primary-button style wins.

## Implementation status log

| Item | Status | Commit | Verification evidence |
|---|---|---|---|
| (all) | PLANNED | — | — |
