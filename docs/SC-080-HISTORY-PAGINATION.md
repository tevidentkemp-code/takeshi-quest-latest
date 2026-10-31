# SC-080: complete saved-game history

## Problem and source

Reported on 30 October 2026 against production `b5254847e2fc3876fec1a252778929197e1a34f4` / v0.16.0: Premier League Today, Yesterday and This Week were empty; recent players were absent from October; a new personal best was absent from LIVE UPDATES.

The shared `cloudFetchAllGamesAsLocal()` owner is `src/app/router-ui.js`. It requested `public.games` in ascending creation order without pagination. The recent LIVE UPDATES result list uses a separate newest-first request, while Premier League and derived personal-best events consume the shared history loader. This explains why recent scores could appear in one surface and disappear from the others.

Read-only database inspection established 1,022 saved rows. Chronological row 1,000 was created on 20 October at 01:05:54 UTC. The reported Official personal-best game was row 1,015, after that boundary. The saved scores and persistent player identities exist; no data reconstruction or database mutation is necessary.

Direct read-only API verification on 31 October returned `Content-Range: 0-999/1022` for the unpaginated query and omitted that PB. Requesting offset 1,000 returned `1000-1021/1022`, all remaining 22 rows, including the PB. The live response limit is therefore corroborated independently of the SQL count and offline fixture.

Supabase documents the default 1,000-row response limit and range pagination: <https://supabase.com/docs/reference/javascript/range>. An offline browser reproduction applies that limit to 1,108 rows and the original production loader returns only 1,000.

## Bounded change

- Fetch ascending history in inclusive 500-row pages, below Supabase's documented default 1,000-row response limit.
- Order by both `created_at` and `id` so timestamp ties do not move between page boundaries.
- Populate the shared cache only after every page succeeds. A later-page failure rejects the request and does not publish partial history.
- Preserve the existing five-minute TTL, shared in-flight request, invalidation generation, row mapper and per-caller array copy.
- Regenerate the compatibility runtime from semantic source. Candidate public version: v0.16.1 / `SC-080-COMPLETE-GAME-HISTORY`.

No scoring, eligibility, saved-player identity, PB comparison, mode, date-filter, schema, RLS, authentication, persistence or dependency rule changes are included. Existing Premier League aggregation and existing GAME PB semantics remain with their current owners. This patch adds neither a second ranking pipeline nor a local-storage fallback.

## Regression evidence

`tools/ui-smoke/verify-history-pagination.mjs` runs the actual mapper/cache/loader against a capped offline transport. Fourteen cases cover more than 1,000 rows, empty and exact-page boundaries, timestamp ties, mapping, failure on a later page, retries, concurrent consumers, array copies, TTL/force and invalidation during pagination. The original source fails the >1,000-row case; the repaired source passes.

`tools/ui-smoke/verify-history-pagination-browser.js` uses the real Supabase JavaScript client and actual application loader, mode classification, Premier League and LIVE UPDATES, with all external traffic blocked or fulfilled by fixtures. It checks:

- 1,108 rows fetched exactly once in pages of 500, 500 and 108;
- October, Today, Yesterday and This Week counts, averages and best scores;
- the 681-point PB derived once and present in the actual feed buffer;
- Official isolation from Turbo, Practice and archived games;
- the 390 x 844 footer and Back/Close navigation;
- no mutation requests or uncaught browser exceptions.

Both source and built output passed the focused Chromium checks. The browser fixture explicitly uses Europe/London time, including the post-BST October date; the execution host's unrelated timezone must not redefine the fixture's Today boundary. The corresponding source/dist WebKit checks and regression script are wired into existing Core release QA.

Other local checks passed: semantic/runtime parity, materialization, Vite build and dist verification, existing Home scheduling/cache regression, record-integrity contract, release metadata/history and Halloween alias/expiry preservation. Standard Vite warnings about the intentionally retained classic-script compatibility boundary are unchanged.

These automated browser runs are not physical iPhone acceptance or representative live-use soak. Exact-head CI and production release state must be recorded in the owning PR and existing Coding TASK / BUILD LOG / HANDOVER before release.

## Operation and recovery

After an authorised release, refresh until the Home version reads v0.16.1 or later. Open League > Premier League and select the relevant date/month. LIVE UPDATES derives valid PBs from the complete saved history. Existing qualification thresholds still apply; appearing in a month and qualifying for its ranked positions are distinct.

No scores need re-entry, and there is no new setting. Before release, recovery is to leave this branch unmerged. After release, use a scoped forward correction/revert of this loader and regenerated output under the next valid version, preserving intervening releases. No database rollback is required.

Feature Registry impact checked: no new feature or product rule; existing cloud-history, Premier League and LIVE UPDATES owners retained.
