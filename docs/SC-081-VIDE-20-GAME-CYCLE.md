# SC-081 — LIVE UPDATES twenty-game cycle and PB-label audit

Date: 31 October 2026. Mode: bounded BUILD/FIX, T2 shared public Home read path. Release: **NOT AUTHORISED**; v0.16.2 is a draft candidate only. Game Rules v11 / Shateki Operations retain authority over what counts as a PB.

## Report and verified cause
The v0.16.1 screenshot shows numerous Turbo ROUND PB and ROUND WR announcements. The live persisted games and actual source show:
- Official and Turbo round record comparisons are intentionally isolated. Previous Official games are not a Turbo baseline.
- First positive score in a player's Turbo round is currently compared against 0 and labelled a personal best. That can flood the feed during a player's first Turbo session, even if they played many Official games. It is existing behaviour, not an accidental mode crossover.
- Real examples: on 30 October 2026 Michael scored 140 on 20s versus the prior Turbo global record of 120; Liam's 19s 76 versus previous Turbo 38, Rik's 19s 38 versus previous Turbo 19 are genuine Turbo improvements.
- Changing whether first-ever mode/target scores should be announced as PBs requires an explicit Shateki Operations decision. The current draft does **not** change record detection, history, eligibility, or modes.

Separate UI defect: the VIDE printer previously fetched up to 30 saved games and truncated the **formatted text output** to 30 lines. Date headers, mode headings, match results, ROUND PB/WR lines and alerts consumed lines, so the cycle could repeat before showing many game results.

## Exact bounded change
Owner: `src/legacy/quarantine/core-pre-modals.js` (generated compatibility mirror: `src/legacy/scripts/inline-005.js`).
- Request the newest 20 visible saved games, keeping the existing cloud transport.
- Select those 20 game items, their cloud-backed completed-match results and timestamp-associated record announcements. Preserve separate 30-day NEW PLAYER announcements regardless of the 20-game cutoff.
- Build mode/date headers and compact PB grouping as before.
- Do not truncate that fully constructed cycle to 30 formatted lines. The physical 15-row printer, scheduler, animation, 15-second source polling, PAUSE, caches, transient injection queue and the existing empty-source fallback are unchanged.
- The version candidate is v0.16.2 with prior release-history objects preserved.

## Validation and acceptance
1. Existing original-source and generated-source parity; `npm run build`, exact-head Core release QA, and all relevant specialists.
2. Regression in `verify-sc063-home-scheduling.mjs`: 25 newest game fixture rows, 25 contextual records, assert exactly game 0..19 and their associated record 0..19 in a buffer exceeding 30 formatted lines, game 20 and older absent, 15 fixed visible rows, cloud fetch limit 20.
3. Existing SC-047 source/dist Chromium + WebKit LIVE UPDATES tests: pause, one-second scroll scheduling, 15-row geometry, mobile 320/390/430px, date/mode grouping, Practice isolation and legitimate PB/WR semantics.
4. Read-only public verification **after a separately authorised release**: 20 actual saved games per repeat cycle; related announcements visible; no record-label rule changes; zero production writes; physical iPhone acceptance remains separately required for STABLE.

## User clarification and release gate
Thomas clarified later on 31 October that the announcements are Turbo results, withdrew the original PB complaint, and requested no change to record semantics. Keep the existing debut/target PB handling and Official/Turbo isolation unchanged. This work only changes the display cycle. Obtain separate approval for any v0.16.2 production release after QA.

## Recovery
Before release, leave the PR draft/unmerged. After release, a scoped forward correction/revert of this Home window selection and generated mirror under the next valid public version; preserve SC-080 pagination and all later releases. No database/schema/RLS/score changes, so no database rollback.

Owning records: Coding TASK86, BUILD LOG308, HANDOVER40 and family Pipeline SC-081 row65. Feature Registry impact: no ownership/status change.
