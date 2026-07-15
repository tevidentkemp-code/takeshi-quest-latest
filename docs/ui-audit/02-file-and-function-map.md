# 02 — File and Function Map

All line numbers refer to `index.html` (the only application file). Status legend:
**ACTIVE** (live at runtime), **OVERRIDDEN** (later definition wins — dead), **LEGACY/QUARANTINED**
(kept but not on the active path), **ORPHANED** (nothing calls it / not reachable), **[RUNTIME]** =
behaviour confirmed in the live browser.

## 1. File structure map

| Lines | Content |
|---|---|
| 1–56 | Header comments: canonical-base rules, patch tags |
| 57–327 | `<head>` start, critical CSS (`#sq-critical-css`) |
| 328–594 | Early boot script: `--sqVh` viewport fix, **Admin keypad gate** (`showAdminKeypad`, code `4936`), admin click interceptor |
| 595–1236 | TOC comments, dependency index, system inventory (screens/flows/Supabase views, lines 707–898) |
| 1237 | External `<script>`: supabase-js v2 (jsDelivr) |
| 1240–8602 | Main CSS (two large blocks): tokens, home, game, modals |
| 8605–9220 | Early fix blocks (CSS+JS): DMD layout, pad FX, race chart geometry |
| 9223–9851 | `<body>`: 4 static sections (`#details` 9230, `#players` 9299, `#game` 9338, `#leaderboard` 9412), throw pad `#padBar` 9459, static modals 9474–9845, cloud chip 9848 |
| 9852–43884 | **Main application script** (~34k lines): boot/globals, state, cloud, engine, UI builders, dialog builders |
| 43885–54465 | ~40 versioned fix/patch blocks (`sq-fix40` → `sq-fix172`, arcade hero & game-complete CSS) |

### Script blocks (44)
Anchor ids where present: `sq-fix16-b3-dots-race-padfx-js`, `sq-fix17-padfx-stronger-js`,
`sq-fix76-turbo-20sec-timer-js`, `sq-fix77-turbo-timer-race-rows-js`, `sq-fix83-tournament-bracket-js`,
`sq-fix78-turbo-hs-startrows-js`, `sq-fix90-tournament-ui-js`, `sq-fix95-missx3-js`,
`sq-fix97-league-ranks-turbo-tabs-js`, `sq-fix99-top50-practice-js`, `sq-fix100-league-ranks-format-js`,
`sq-fix106-home-menu-stats-reset-js`, `sq-fix120/126/129/132/136/146/153`, `sq-fix167-gameplay-perf-mot-js`,
`sq-fix168-mode-classification-turbo-guard-js`, `sq-rankings-turbo-routing-fix-js`,
`sq-start-tournament-route-blocker-guard-v2`, `sq-fix169-power-rankings-current-clean-source-js`,
`sq-fix170-decider-leaderboard-confirm-js` + ~20 anonymous blocks.

### Style blocks (50)
Notable: 2 anonymous main sheets (1240–7893, 7895–8602), and ~45 fix sheets. Several fix sheets
re-style the same components (see `09-visual-inconsistencies.md`, duplicate-styling section).

## 2. Boot & routing

| Function | Line | Purpose / calls / status |
|---|---|---|
| `show(id)` | 16025 | **The router.** Hides/shows the four sections, sets `body[data-page]`, rebuilds pad (`buildPad`), syncs turbo visuals, triggers per-page hooks (`buildStartTicker` on details, `ensureGameBuilt`+`updateUI` on game). Called by every navigation action. **ACTIVE [RUNTIME]** |
| `show(...)` (2nd) | 45086 | Different local helper inside a fix IIFE (scoped). Name collision only. |
| `_showPageSafe(id)` | 13412 | Fallback router used by top-row/compat wiring; prefers `window.showPage` which is **never defined** → first branch dead. **ACTIVE (fallback path)** |
| `navigateToStartScreen()` | 13427 | `_showPageSafe('details')`. Called by admin gate, end-match, Main-Menu "End Match". **ACTIVE [RUNTIME]** |
| `showLeaderboard()` | 27340 | Builds leaderboard table then `show('leaderboard')`. Called by `awardAndShowLeaderboard`, `doEndGame`, fix170 wrapper (line 53646 re-wraps it via 500 ms poller). **ACTIVE [RUNTIME]** |
| `arrangeStartActions()` | 31889 | **Rebuilds the Home screen DOM** (creates `#startGameBtn`, footer nav squares, admin link; builds `#startGameModalBody` options MATCH PLAY/TOURNAMENT/PRACTICE/TRAINING; wires all their handlers). Re-run as "back" action from Start-Game-modal submenus. **ACTIVE [RUNTIME]** |
| `setupStartMenuButtons()` | 17804 | Wires resume/tournament/league/stats home buttons; Tournament placeholder toast here is **OVERRIDDEN** by `arrangeStartActions`'s stepped-setup binding. Partially active. |
| `wireTopRowButtons()` | 13454 | Compat wiring for legacy top-row ids (`startScreenBtnGame/LB`, `restartGameBtnGame/LB`, `statsHubBtnFinal`). Buttons exist but are **hidden at runtime** (`.sq-hidden-top`, leaderboard re-skin). **LEGACY** |
| `boot splash` | 657/665 | `#bootSplash` (page load) & `#gameLoadOverlay` ("Preparing Live Game"/"Resuming Game", via `__sqShowGameLoadOverlay`). **ACTIVE [RUNTIME]** |

## 3. State & persistence

| Function | Line | Notes |
|---|---|---|
| `FLAGS` | 8858 | `LIVE_V2:true`, legacy UI/home disabled. **ACTIVE** |
| `STORAGE_KEY` | 14247 | `'shateki_quest_scorer_v6'` — saved match state. |
| `getSavedState()` | 17792 | Reads/validates saved match; clears unrecoverable saves. Drives Resume button. **[RUNTIME]** (hidden with no save) |
| `save()` / `baseState` | ~14250 ff | Serialize `state` to localStorage after every throw/menu action. **ACTIVE** |
| `getSavedPlayers()` / `setSavedPlayers()` | 48123/48124 (final override) | Read/write `shateki_players` display cache; earlier definition at 20508 **OVERRIDDEN**. Cloud sync at 48125 (`__sqSyncPlayerCacheFromCloud`, kicked 800 ms after load). **[RUNTIME]** (cache retained when cloud fails) |

## 4. Cloud layer (Supabase)

| Function | Line | Notes |
|---|---|---|
| `SUPABASE_URL/ANON` | 13757 ff | Embedded credentials. |
| client init | 14132–14134 | `window.supabase.createClient(...)` → `sb`. Egress-debug wrapper (13950–14052) can wrap `createClient` for logging. |
| `cloudFetchAllGamesAsLocal()` etc. | @JS:CLOUD:GAMES section | Game fetch/normalize. **[UNVERIFIED — cloud blocked]** |
| `upsertMatchToSupabase()` | called at 27116 | Match row upsert before award. |
| `recordFullGameToSupabase()` | called at 27140/27183 | Full game write; Vs Shadow path fails closed, match-play path is best-effort ("Game saved to local only (cloud failed)" toast — **[RUNTIME]** observed). |
| `recordGameToHighScores()` | 27187 | High-score rows. |
| `cloudListPlayers()` | used by hub gate 45868, cache sync | Players table read. |
| Cloud status chip | 9848 (`#cloudStatus`) | "Checking cloud…" — element is **removed/replaced at runtime** by ticker patches; `#cloudStatusText` not found in live DOM. **LEGACY-ish [RUNTIME]** |

## 5. Game engine & Live Game UI

| Function | Line | Notes |
|---|---|---|
| `ROUNDS` / `MAX_ROUNDS` | 16136/16145 | 11 number rounds (10–20) + doubles + triples + bull = 15. |
| `startNewGame()` | (multiple wrappers; core in engine section) | Resets per-game state, `show('game')`, chunked build. **[RUNTIME]** |
| `buildEverything()/buildEverythingChunked()` | window API | Build scoreboard DOM (thead/tbody, stats tables). Delegates to `buildScoreHeader/buildScoreBody/buildStatsHeader/buildStatsBody/buildMatchStatsHeader/buildMatchStatsBody/buildFloatingHeader` (all window-exported builders); `buildRecordPaceSeries` feeds the record-pace chart. **[RUNTIME]** |
| `buildPad()` | called from `show` | Builds throw pad per round type: number rounds → S/D/T + MISS×3/MISS/UNDO/SKIP + ☰; finished game → "Finish Game → Leaderboard" button (24115). **[RUNTIME]** |
| `recordThrow` pipeline | @ "function recordThrow" | Throw → score board update → DMD FX → autosave. **[RUNTIME]** (S clicks scored 10s) |
| `pressMissN/missGo/undo` | 24090 ff | Miss/skip/undo actions. **[RUNTIME]** |
| DMD (`sqDmdShow`, `sqDmdSetIdle`, `sqDmdStop`, `sqDmdShowZones`, `sqDmdSetPlayerMeta`) | doc at 636, impl `SQ_DMD_TOPBAR_JS_V1` | Pinball dot-matrix canvas `#sqDmdCanvas`; shows round intro ("10"), MISS X3, "TESTA TO THROW FIRST" etc. **[RUNTIME]** |
| Live V2 panel | `#liveV2Panel` 9376, LIVEV2 section | 2-player live score cards (`v2Rows`, PB/WR edging). **[RUNTIME]** (visible in game) |
| Legacy gameplay containers | `#floatWrap #turnBar #scoreWrap #roundBar #roundSeamBar` (622) | Hidden when LiveV2 eligible. **LEGACY** |
| `openGameCompleteDialog()` | 14960 | **MATCH COMPLETE / GAME COMPLETE arcade carousel** (`.sq-gamecomplete-backdrop`), 3 pages (dots), winner panel, VIEW BREAKDOWN, advance-match button; decider button on draw. Closable only via backdrop click. **[RUNTIME]** |
| `completeGameAndAdvanceMatch()` | 15164 | award → if match done `endMatchToClubhouse()` (→ details!) else `startNewGame()`. **[CODE]** |
| `awardAndShowLeaderboard()` | 27089 | Double-award guard, win tally, cloud writes (best-effort), `showLeaderboard()`. **[RUNTIME]** |
| `openDeciderShootoutDialog()` | 15395 | Draw resolution mini-game ("START DECIDER SHOUTOUT" [sic]). **[RUNTIME]** (draw produced it) |
| `openShootoutCompleteDialog()` | 15882 | Decider result. **[INFERRED]** |
| Turbo timer | fix76 48683 | 20-second strict turn timer for Turbo variant. **[UNVERIFIED — turbo match not played]** |

## 6. Home-side dialog builders (all dynamic `.modal-backdrop` creators)

| Function | Line(s) | Status |
|---|---|---|
| `openMainMenuDialog()` | 10138 | fix106 **Main Menu** (in-game ☰/settings): New Layout toggle, Restart Game, End Game, End Match, Remove Player, Stats, RESUME row when off-game. **ACTIVE [RUNTIME]** (`.sq-menu106-bd`) |
| `openStatsHubDialog()` | 24131 | In-game stats hub → Game Race / Game Stats / Match Stats / High Scores (Official) / Low Scores (Official). **ACTIVE [RUNTIME]** |
| `openGameRaceDialog()` | 27942 | Race chart. **[RUNTIME]** |
| `openGameStatsDialog()` | 24189 | Current-game breakdown. **[RUNTIME]** |
| `openMatchStatsDialog()` | 24316 | Match totals. **[RUNTIME]** |
| `openHighScoresDialog()` | 24565 / `openLowScoresDialog()` 24723 | Official tables (cloud). Opened; content **[UNVERIFIED — cloud]** (Low Scores rendered no modal shell at runtime) |
| `openPlayerStatsHub()` | 38667 | Home **PLAYER STATS** hub (9 rows + header player picker). Header reads **cloud players only** — ignores local cache ("No saved players found." with seeded cache) **[RUNTIME]** |
| `openPlayerStatsDialog()` | 37842 | Player profile (Quick Stats, Targets card…). **[UNVERIFIED — cloud]** |
| `openXpLeaderboard()` | 38609 | Level Ladder. Shell opens **[RUNTIME]**, rows cloud-dependent |
| `openPlayerLatestMatchesDialog()` | 39359, `openPlayerHighScoresDialog()` 39640, `openPlayerProgressionDialog()` 39781 (final of 3 defs — 13020, 30985 **OVERRIDDEN**), `openPlayerTargetHitDialog()` 52227 (final; 41019 **OVERRIDDEN**), `openPlayerTargetPointsDialog()` 52513 (final; 41084 **OVERRIDDEN**), `openPlayerH2HDialog()` 47921, `openPlayerSpiderDialog()` 43250, `openPlayerProgressHitDialog()` 43433 | Stats sub-dialogs. Shells open from hub **[RUNTIME]**; data **[UNVERIFIED — cloud]** |
| `openLeagueRankingsDialog()` | final override 53184 (`sq-rankings-turbo-routing-fix-js`); base 34947 **OVERRIDDEN** | **LEAGUE / RANKINGS** menu (7 rows). **ACTIVE [RUNTIME]** |
| `openPowerRankingsDialog()` | fix132 51232 + fix169 source override 53283 | Power Rankings w/ Official/Turbo/Practice tabs. **[RUNTIME]** shell+tabs |
| `openPremierLeagueDialog()` | final 51452 (fix136); 35898 **OVERRIDDEN** | Premier League. **[RUNTIME]** shell |
| `openHighScoreLeagueDialog()` | final 50162-region wrapper; 34744, 46846, 49271 **OVERRIDDEN** (4 defs) | High Score League. **[RUNTIME]** shell |
| `openStreakLeagueDialog()` | 35186 | Streak League. **[RUNTIME]** shell |
| `openRoundHighScoresDialog()` | 29281 base + `_v82` 45322 + `_v85` 45724 (versioned copies retained) | Round High Scores. Active path is "Fix102 wrapper → Fix97 dynamic modal" (comment 9815). **[RUNTIME]** shell |
| `openTop50ScoresDialog()` | final 51853 (fix146 canonical); 46908, 49847, 50067 **OVERRIDDEN** (4 defs) | Top 50 Scores w/ tabs. **[RUNTIME]** shell |
| `openLatestScoresDialog()` | 37067 | Latest Scores (Official/Practice). **[RUNTIME]** shell |
| `openPlayerHubGate` / hub | 46099 / 45900-region | PLAYER HUB gate (select player) → hub. Empty-player path = toast only. **[RUNTIME]** |
| `openStartHighScoresMenu()` | 31797 | Home high-scores chooser (Match/Round). Reachable only via `hsMainBtn` which **does not exist in runtime DOM** → **ORPHANED [RUNTIME]** |
| `openModeChooser()` | 17576 | Older mode chooser modal. Superseded by `startGameModal` options built by `arrangeStartActions`. **LEGACY/ORPHANED** |
| `openPlayerStatsLookupDialog()` | 17858 & 17974 (immediate redefinition) | Name-only stats picker; superseded by `openPlayerStatsHub` (still fallback in `arrangeStartActions` chain). **LEGACY (fallback only)** |
| `openPlayerStatsSelectDialog()` (11138) / `openPlayerStatsModePicker()` (41426) | fallback chain (10147, 31983, 11261; mode-picker back-target at 17738/17779) | Legacy stats selection/mode-picker dialogs — reachable only through fallback chains when the hub is missing. **LEGACY** |
| `showTenorOnce()` | window export (warn at 26881) | Celebration GIF overlay in `#gifOverlay` (line 9471), fired by in-game celebration triggers (e.g. triple-hat scan in `show('game')` path). **ACTIVE [INFERRED — celebration not triggered during audit]** |
| `openTournamentSteppedSetup()` | 48296 | TOURNAMENT (BETA) stepped setup (players → type). Re-bound as canonical by `START_TOURNAMENT_ROUTE_RESTORE_V1` (32150) and guarded by `sq-start-tournament-route-blocker-guard-v2` (53244). **[RUNTIME]** |
| `openTournament()/openTree()` | 53250 / 48911 | Tournament bracket/tree views. **[UNVERIFIED — full tournament not played]** |
| `openEndMatchConfirm()` | 53578 (fix170) | END MATCH confirmation on leaderboard. **[RUNTIME]** |
| `openGameScoresDialog()` | 27407 | Leaderboard GAME SCORES popup. **[RUNTIME]** |
| `openScoreSheetFromHistory()` 14398, `openSingleGameScoreSheet()` 28532, `openScoreSheetFromHighScore` | Score-sheet views from history/high-score rows. **[UNVERIFIED — needs cloud rows]** |
| `openPracticeVsShadowOpponentDialog()` | 20250 | VS SHADOW opponent/score picker. **[UNVERIFIED — needs cloud high scores]** |

## 7. Admin

| Function | Line | Notes |
|---|---|---|
| `showAdminKeypad()` | 375 | Numeric gate (`4936`), assigned to `window.openAdminPasswordModal` (538). **ACTIVE [RUNTIME]** |
| `openAdminPasswordModal()` (text password) | 13540 | Older prompt (`hownowbrowncow`), exported at 13603 then **OVERRIDDEN** by keypad export at 538 (earlier block, but re-enforced by admin-password-enforce patch 44070). Runtime shows **keypad**. **[RUNTIME]** |
| `openAdminHub()` | 10855 (+ guard wrapper 44082, dup export 13619/44082) | `#adminHubModal` — 9 tool rows. **ACTIVE [RUNTIME]** |
| `openAllGamesDialog()` | 29000 | `#allGamesModal`. **[RUNTIME]** shell |
| `openAllScoresDialog()` | 10988 | All Scores admin (remove player from game). **[RUNTIME]** shell |
| `openHighScoresAdminDialog()` | 28779 | League/Practice HS admin (two labels share one dialog titled "High Scores — Admin (…)"). **[RUNTIME]** |
| `openLeagueLowsAdminDialog()` | 28871 | `#leagueLowsAdminModal`. **[RUNTIME]** (stacking issue observed — see 09) |
| `openSavedPlayersAdminDialog()` | 11325 | `#savedPlayersAdminModal`. **[RUNTIME]** |
| `openPBGRAdminDialog()` | 11266 | `#pbgrAdminModal` (PB/GR tools). **[RUNTIME]** |
| DATA modals | `#dataAdminModal` 9743, `#dataChartModal` 9763 | Metrics + canvas chart (Daily/Weekly/Monthly/Yearly ranges). **[RUNTIME]** shells. Note: stray `</div>` at 9784 nests these oddly. |
| `fixDuplicatesBtn` | 9725 | **Destructive** cleanup helper — intentionally NOT exercised in this audit. **[UNVERIFIED — destructive]** |

## 8. Shared/duplicated primitives

- `openModal(id)/closeModal(id)` — global at 31878/31882 (`window.openModal = window.openModal || …`) plus
  an independent pair at 42483/42487; most dialogs **do not use them** and hand-roll
  `document.createElement('div'); overlay.className='modal-backdrop'` + own close/Escape wiring
  (30+ separate implementations — see 10-refactoring-recommendations.md).
- `openModalShell()` (50342) — a later attempt at a shared modal factory; used only by nearby fix blocks.
- `toast(msg)` — global toast; ("Coming soon!", "Game saved to local only (cloud failed)", "No saved players"). **[RUNTIME]**
- `esc()/escapeHtml` — ≥11 separate escape helpers (self-acknowledged in header comment line 699).
- Back/close button construction is duplicated per-dialog (see `08-back-button-audit.csv`).

## 9. Orphaned / obsolete inventory (summary)

| Item | Evidence |
|---|---|
| `index.txt` | Text matches no current UI. |
| `#roundHighScoresModal` static modal (9820) | Self-labelled "LEGACY … QUARANTINED" (9815). |
| `#settingsMenuGame` (9364, empty) & `#settingsMenuLB` items (9427) | Runtime uses fix106 Main Menu instead; LB menu buttons hidden by re-skin. |
| `#startScreenBtnGame/#restartGameBtnGame/#startScreenBtnLB/#restartGameBtnLB` | `.sq-hidden-top`, invisible at runtime; only reachable through legacy settings menus that no longer open. |
| `#statsHubBtnFinal`, `#highScoresMenuBtnLB`, `#nextGameBtn`* | Present in DOM; hidden/re-skinned by fix170 leaderboard patch (*`#nextGameBtn` reused as "NEXT ROUND >"). |
| `hsMainBtn` wiring (17849) & `openStartHighScoresMenu` | Button never exists at runtime. |
| `openModeChooser()` | Superseded by Start-Game modal options. |
| `questBtn` "New game ▶" static markup | Removed and recreated as a *modal option* button (MATCH PLAY) by `arrangeStartActions` — same id, different role. |
| 3 extra defs of `openTop50ScoresDialog`, 2 of `openPlayerTargetHit/PointsDialog`, 2 of `openPlayerSummaryStatsDialog`, 2 of `openPlayerProgressionDialog` (plus 1 more), 3 of `openHighScoreLeagueDialog` | Shadowed by final overrides. |
| `window.showPage` preferred branch in `_showPageSafe` | Function never defined. |
| `openPlayerDTBDialog` (window export), `openPlayerGamesDialog` (24460), `openTDHDialog` (17747), `openTargetHitRateDialog` (17601) | Defined/exported but **no call sites** in the file — ORPHANED. |
| `openPlayerDTBPctDialog` (41096) / `openPlayerDTBCombinedPctDialog` (41190) | Referenced only in documentation comments (973/1069/1078); no live call sites found — ORPHANED (D/T/B Hit % feature unwired). |
| `openSprintLeagueDialog` (17176) | Wrapper that calls `openPowerLeagueDialog`; only self-references — ORPHANED. `openPowerLeagueDialog` (35347) survives as its target and legacy alias of Power Rankings. |
| `openPremierLeaguePopup`, `openTargetPctDialog` (=`openPlayerTargetPctDialog`, 52306), `openPlayerTargetPointsPctDialog` | Alias exports kept for compatibility; canonical entry points are `openPremierLeagueDialog` / `openPlayerTargetHitDialog` / `openPlayerTargetPointsDialog`. |
| `v_power_rank_last56_ranked` view | File's own inventory: "not referenced in this file" (777). |
| `sq_playerhub_passwords` localStorage | Deprecated by own comment (30434). |
