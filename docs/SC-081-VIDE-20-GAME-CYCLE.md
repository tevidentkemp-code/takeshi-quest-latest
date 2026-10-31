# SC-081 — LIVE UPDATES twenty-game cycle and PB-label audit

Date: 31 October 2026. Mode: bounded BUILD/FIX, T2 shared public Home read path. Release: **NOT AUTHORISED**; v0.16.2 is a draft candidate only. Game Rules v11 / Shateki Operations retain authority over what counts as a PB.

## Report and verified cause
The v0.16.1 screenshot shows numerous Turbo ROUND PB and ROUND WR announcements. The live persisted games and actual source show:
- Official and Turbo round record comparisons are intentionally isolated. Previous Official games are not a Turbo baseline.
- First positive score in a player's Turbo round is currently compared against 0 and labelled a personal best. That can flood the feed during a player's first Turbo session, even if they played many Official games. It is existing behaviour, not an accidental mode crossover.
- Real examples: on 30 October 2026 Michael scored 140 on 20s versus the prior Turbo global record of 120; Liam's 19s 76 versus previous Turbo 38, Rik's 19s 38 versus previous Turbo 19 are genuine Turbo improvements.
- Thomas subsequently authorised a VIDE-only announcement gate: a player must have five earlier completed same-mode games before GAME/ROUND PBs appear. World records bypass the gate. The underlying record baselines, Official/Turbo isolation, saved scores, rankings and XP remain unchanged.

Separate UI defect: the VIDE printer previously fetched up to 30 saved games and truncated the **formatted text output** to 30 lines. Date headers, mode headings, match results, ROUND PB/WR lines and alerts consumed lines, so the cycle could repeat before showing many game results.

## Exact bounded change
Owner: `src/legacy/quarantine/core-pre-modals.js` (generated compatibility mirror: `src/legacy/scripts/inline-005.js`).
- Retain the existing newest-30 shared game fetch, then select the newest 20 for the display cycle. The other Home ticker also uses the cached fetch and must not be shortened by this change.
- Select those 20 game items, their cloud-backed completed-match results and timestamp-associated record announcements. Preserve separate 30-day NEW PLAYER announcements regardless of the 20-game cutoff.
- Apply a VIDE-only personal-best announcement threshold of five **earlier** games for this player in Official, Turbo or Practice; a sixth game can announce a PB. A new game or round world record remains immediately visible. All games continue updating record baselines.
- Build mode/date headers and compact PB grouping as before.
- Do not truncate that fully constructed cycle to 30 formatted lines. The physical 15-row printer, scheduler, animation, 15-second source polling, PAUSE, caches, transient injection queue and the existing empty-source fallback are unchanged.
- The version candidate is v0.16.2 with prior release-history objects preserved.

## Validation and acceptance
1. Existing original-source and generated-source parity; `npm run build`, exact-head Core release QA, and all relevant specialists.
2. Regression in `verify-sc063-home-scheduling.mjs`: 25 fixture games plus context beyond 30 formatted lines, retaining 20 game results and preserving 15 visible rows with shared fetch still at 30; dynamic PB cases show five earlier same-mode games required, 0-point games counting, Practice/archives excluded and immediate WRs.
3. Existing SC-047 source/dist Chromium + WebKit LIVE UPDATES tests: pause, one-second scroll scheduling, 15-row geometry, mobile 320/390/430px, date/mode grouping, Practice isolation and legitimate PB/WR semantics.
4. Read-only public verification **after a separately authorised release**: 20 saved games per repeat cycle; no player PBs before five earlier same-mode games and WRs still immediate; zero production writes; physical iPhone acceptance remains separately required for STABLE.

## User clarification and release gate
Thomas initially clarified that the noisy PBs came from Turbo results. He then explicitly authorised the new VIDE-only threshold of five **previous** completed same-mode games, with WRs always visible. No record, score, ranking or XP calculation changes. Obtain separate approval for any v0.16.2 production release after full QA.

## Recovery
Before release, leave the PR draft/unmerged. After release, a scoped forward correction/revert of this Home window selection and generated mirror under the next valid public version; preserve SC-080 pagination and all later releases. No database/schema/RLS/score changes, so no database rollback.

Owning records: Coding TASK86, BUILD LOG308, HANDOVER40 and family Pipeline SC-081 row65. Feature Registry impact: no ownership/status change.
