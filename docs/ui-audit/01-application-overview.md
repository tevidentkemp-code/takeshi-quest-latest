# 01 — Application Overview

**Audit date:** 2026-07-15
**Repository:** `tevidentkemp-code/takeshi-quest-latest`
**Audit branch:** `claude/ui-architecture-audit-bhc59x`

Evidence levels used throughout this audit:

| Tag | Meaning |
|---|---|
| **[CODE]** | Confirmed by reading the source code (line numbers refer to `index.html`) |
| **[RUNTIME]** | Confirmed by running the app in a real (Playwright-driven Chromium) browser |
| **[INFERRED]** | Inferred from code but *not* verified at runtime |
| **[UNVERIFIED]** | Could not be reached/verified in this environment (reason recorded) |

---

## 1. What the application is

**SHATEKI-QUEST** is a darts scoring/arcade web app ("Shateki" = Japanese shooting-gallery). Players play rounds
targeting numbers 10–20, then Doubles, Triples and Bull (15 rounds total — **[CODE]** `ROUNDS` at line 16136).
It supports Match Play (1–6 players, Classic or Turbo variant), Practice (solo, Vs Shadow), a beta knockout
Tournament mode, leagues/rankings, per-player statistics, and an admin toolset. Scores are persisted to a
**Supabase** cloud backend; `localStorage` is used as a UI cache and for in-progress match recovery.

## 2. Repository layout

The entire application is a **single 2.3 MB, 54,465-line `index.html`** file. There is no build system, no
package manifest, no test suite.

| File | Size | Role |
|---|---|---|
| `index.html` | 2,365,559 B / 54,465 lines | The complete application: markup, ~50 `<style>` blocks, ~44 `<script>` blocks |
| `index.txt` | 114 B | Plain-text snapshot of old home-screen labels ("SHATEKI-QUEST / New game ▶ / Resume game ▶ / High Scores / Shotgun Leaderboard / Player Stats / Enter / Checking cloud…"). Matches **no current runtime UI** — orphaned/obsolete. **[RUNTIME]** |
| `assets/start-arcade-hero-hd.png` | image | Home-screen hero art (referenced by `sq-home-arcade-start-hero-css`, lines 53954–54119) **[CODE+RUNTIME]** |
| `assets/game-complete-celebration-hd.png` | image | Game-complete celebration art (referenced by `sq-game-complete-arcade-css`, lines 54123–54461) **[CODE+RUNTIME]** |

## 3. Architecture: "patch-layer" single file

The file is explicitly maintained as a **layered patch archive**. Its own header (lines 1–56) declares
"CANONICAL BASE … Patch from this file only". Development history is embedded as **515 `PATCH:* START/END`
marker pairs** and dozens of versioned fix blocks (`sq-fix16` … `sq-fix172`), each adding a `<style>` and/or
`<script>` block near the end of the file. **[CODE]**

Consequences (all verified at runtime):

1. **Later script blocks override earlier ones** by re-assigning `window.*` functions.
   E.g. `window.openTop50ScoresDialog` is defined 4 times (lines 46908, 49847, 50067, 51853) — only the last
   definition is live. **[CODE+RUNTIME]**
2. **Static DOM is rewritten at boot.** The home screen in the HTML (`#questBtn "New game ▶"`,
   `#tournamentBtn`, `#resumeBtn`, `#latestScoresBtn "PLAYER HUB"`) is dismantled by `arrangeStartActions()`
   (line 31889), which builds the actual runtime home menu (`#startGameBtn "START GAME"`, `#playerHubBtn`,
   `#playerStatsBtn "STATS"`, `#leagueRankingsBtn "LEAGUE"`, `#adminCodeBtn "ADMIN"`). **[RUNTIME]**
3. **Polling patchers** mutate live DOM: e.g. `patchLeaderboardActions()` runs on a 500 ms `setInterval`
   (line 53659) to re-skin the leaderboard buttons. **[CODE+RUNTIME]**

## 4. Entry points

| Entry point | Details |
|---|---|
| Page load | `index.html` — only entry point. `<body data-page="details">` boots to the Home screen (**[RUNTIME]**) after a boot splash (`#bootSplash`, line 657) |
| `DOMContentLoaded` handlers | multiple; key ones: line 13405 (round-score observer, top-row wiring, setup steppers), plus per-fix-block boot IIFEs |
| Supabase | `https://vvfqumgtasuacpggdmxx.supabase.co` with embedded anon key (line 13757). Client created at line 14134 |
| CDN | `@supabase/supabase-js@2` from jsDelivr (line 1237) — the **only external script** |
| Recovery | `resumeBtn` shown only when `localStorage['shateki_quest_scorer_v6']` holds a recoverable match (`getSavedState()`, line 17792) **[CODE]**; hidden at runtime with empty storage **[RUNTIME]** |

## 5. Screens and routing

Router: `show(id)` at line 16025 — toggles `.hidden` on the four static `<section>`s and sets
`document.body.dataset.page`. A defensive fallback `_showPageSafe(id)` exists at line 13412 (prefers a
`window.showPage` that is **never defined** — the preferred branch is dead **[CODE]**).

| `data-page` | Section id | Canonical name | Verified |
|---|---|---|---|
| `details` | `#details` | **Home / Clubhouse** | **[RUNTIME]** |
| `players` | `#players` | **Match Card (player setup)** | **[RUNTIME]** |
| `game` | `#game` | **Live Game** (Live V2 panel + DMD + throw pad) | **[RUNTIME]** |
| `leaderboard` | `#leaderboard` | **Match Leaderboard** | **[RUNTIME]** |

All other UI is **modal/overlay** (13 static `.modal-backdrop` elements in the HTML plus ~40 dynamically
created dialog builders). See `03-screen-inventory.csv`.

Primary flows (file's own map at lines 707–716, confirmed at runtime):

1. `details → (SELECT GAME MODE modal tree) → players → (MATCH LENGTH → THROW ORDER) → game → (MATCH COMPLETE overlay) → leaderboard → details`
2. `details → Player Hub / Stats / League & Ranks → modal(s) → close → details`
3. `game → ☰ Main Menu → modal(s) → back/close → game`

## 6. State & data

| Store | Key(s) | Purpose |
|---|---|---|
| In-memory | global `state` (players, score board, match, history…), `FLAGS` (line 8858: `LIVE_V2:true`, `ENABLE_LEGACY_UI:false`, `ENABLE_LEGACY_HOME:false`) | Gameplay engine |
| localStorage | `shateki_quest_scorer_v6` | In-progress match save/recovery |
| localStorage | `shateki_players` | **Display-only cache** of the Supabase `players` table (policy comment lines 30431, 48132) |
| localStorage | `sq_saved_match_ids`, `sq_device_id`, `sq_daily_logons`, `sq_livev3_sound`, `SQ_PSTICKER_CACHE_V1`, `SQ_PLAYER_ALIASES`, `SQ_DEBUG`, `sq_cloud_logons_disabled` | Misc caches/telemetry/flags |
| localStorage | `sq_playerhub_passwords` | **Deprecated** (self-documented "retire after checking current path", line 30434) |
| Supabase | `games`, `matches`, `players`, `high_scores`, `high_scores_sp` + ~20 views (`v_power_rankings_*`, `v_top50_scores_*`, `v_player_target_*`, …) | Authoritative stats/leagues. Full inventory embedded in file at lines 718–898 |

## 7. Authentication / role gating

- **Admin**: UI-only numeric keypad gate, local code `4936` (line 353, comment admits "UI gate only. Real
  write authority must remain with Supabase/RLS"). A second, older password gate (`hownowbrowncow`, line
  13508) is overridden at boot — `window.openAdminPasswordModal = showAdminKeypad` (line 538). **[CODE+RUNTIME]**
- **Player Hub**: player-select gate (`__sqOpenPlayerHubGate`, line 46099); an older per-player password era is
  deprecated. With no players available it shows only a "No saved players" toast. **[RUNTIME]**
- No real authentication exists; the Supabase anon key is embedded in the page (expected for this app type,
  but worth noting: **all writes are protected only by RLS**, and the local admin gates are cosmetic).

## 8. Runtime verification environment (limits)

- App served locally (`http-server`), driven by Playwright Chromium at **390×844 (primary mobile)** and
  **1280×800 (desktop)** viewports; screenshots in `docs/ui-audit/screenshots/`.
- The sandbox **blocks all outbound network** to `*.supabase.co` (and the jsDelivr CDN — the supabase-js
  library was served locally via request interception). Therefore:
  - **No production data could be read or written** — cloud writes were impossible by construction
    (all Supabase requests were aborted at the network layer; only `GET` attempts were observed).
  - Every cloud-backed view (Power Rankings rows, Premier League, Top 50, Latest Scores, Level Ladder,
    player stats details, admin data lists) was verified only to its **loading / empty / unavailable state**.
    These are recorded as **[UNVERIFIED — cloud data required]** in the inventories.
- Test data used: two **guest players** (`TESTA`, `TESTB`, local-only) and a seeded `shateki_players`
  display cache. No production or user data was touched.

## 9. Headline numbers (details in later documents)

| Metric | Count |
|---|---|
| Static screens (router pages) | 4 |
| Distinct popups/modals/menus/overlays/toasts identified | 67 (plus 6 partial-screen/state entries; 35 fully runtime-verified, 28 partially — shell verified, data cloud-blocked, 9 not verifiable, 5 legacy/unreachable) |
| Named JS functions | ~1,280 unique names (1,713 declarations — 125 names declared 2+ times) |
| `addEventListener` calls | 321 |
| `.onclick =` assignments | 329 |
| `<script>` blocks | 44 |
| `<style>` blocks | 50 |
| PATCH markers | 515 |
| Element `id`s | 262 unique |
