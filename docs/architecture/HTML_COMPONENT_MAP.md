# SC-031 Static HTML / Component Ownership Map

> Engineering migration evidence only. This document does not define Shateki Quest product rules. Current gameplay, scoring, modes, IDs, global hooks and Supabase contracts remain authoritative through their existing sources until separately migrated and verified.

## Purpose

The Phase 1 extraction reduced `index.html` from the historical 2.57 MB monolith to an approximately 85 KB application shell, but the remaining HTML still owns multiple screens, fixed gameplay UI, modal banks and the compatibility-loader sequence. This map defines the next behaviour-neutral extraction boundaries before any markup is moved.

## Migration contract

1. Preserve every existing DOM `id`, input/button name, ARIA relationship and CSS hook unless a separate authorised product/UX change explicitly requires otherwise.
2. Preserve screen/router identity: `details`, `players`, `game`, `leaderboard` and `data-page` behaviour must not change during structural extraction.
3. Preserve the fixed Throwpad outside the `.wrap` screen container and preserve its relationship with `#gameScrollGate`, `#liveV2Panel`, `#padBar` and `#pad`.
4. Preserve classic-script execution order while the compatibility runtime exists. HTML extraction must not convert scripts to modules as a side effect.
5. Preserve modal IDs and current Back/Close wiring. Modal-stack modernisation is a separate behaviour change and is out of scope for structural extraction.
6. Preserve Supabase/cloud-status elements and current boot order. Service extraction must precede any removal of compatibility globals.
7. Source extraction must be byte/content neutral at the boundary being moved, with a generated compatibility `index.html` until Vite/build parity is proven.
8. Full setup/scoring/Classic-DMD/Training/Progression/Player Stats regressions are required after each material HTML-runtime adoption slice.

## Current shell ownership

| Order | Current region | Protected anchors | Proposed source owner | Initial migration risk |
|---:|---|---|---|---|
| 1 | Document/head, preconnect, external Supabase loader, stylesheet/script compatibility links | `html`, `head`, `body[data-page]`, Supabase CDN ordering | `src/app/shell/` | HIGH — load/cascade/order sensitive |
| 2 | Home / Game Details screen | `#details`, `#appTitle`, `#questBtn`, `#tournamentBtn`, `#resumeBtn`, Home navigation controls | `src/ui/screens/home/` | LOW-MODERATE |
| 3 | Player / Match Setup screen | `#players`, `#msModeLabel`, `#msPlayersList`, `#msRosterCount`, `#msMinHint`, `#startMatchBtn`, `#startScreenBtn` | `src/ui/screens/match-setup/` | MODERATE — setup flow IDs protected |
| 4 | Live Game screen shell | `#game`, `#floatHead`, `#sqDmdTopBar`, `#sqDmdWrap`, `#sqDmdCanvas`, `#gameTopRow`, `#gameScrollGate`, `#liveV2Panel`, `#scoreWrap`, `#thead`, `#tbody`, stats tables, `#endBanner` | `src/live-game/view/` | HIGH — shared gameplay/runtime hooks |
| 5 | Match Leaderboard screen | `#leaderboard`, `#leaderboardTopRow`, `#lbTable`, `#gameScoresBtn`, `#highScoresMenuBtnLB`, `#nextGameBtn`, `#newMatchBtn` | `src/ui/screens/leaderboard/` | MODERATE-HIGH — end-game/tournament hooks |
| 6 | Fixed Throwpad / gameplay chrome | `#padBar`, `#padHint`, `#pad`, `#gifOverlay` | `src/live-game/throwpad/` | HIGH — gameplay and viewport coupling |
| 7 | Player/setup modal bank | `#addPlayerModal`, `#selectPlayerModal`, `#startGameModal`, `#matchLengthModal` and all current child control IDs | `src/ui/modals/setup/` | MODERATE |
| 8 | Admin/data modal bank | Admin Hub, data/chart, all-games, league-low-scores, saved-player-admin, PB/GR and related modal IDs | `src/ui/modals/admin/` | MODERATE-HIGH — data/admin wiring |
| 9 | Cloud status shell | `#cloudStatus`, `#cloudStatusText` | `src/services/cloud/status-view/` | MODERATE — boot/service coupling |
| 10 | Compatibility script/style loader tail | all current `<script src>` and late `<link>` positions/IDs | generated compatibility shell | HIGH — execution/cascade order sensitive |

## Screen boundaries

### Home / `#details`

Own only Home markup and Home navigation controls. Keep route identity `details` unchanged. Existing buttons remain bound through current global/event wiring while the compatibility runtime exists.

Target source boundary:

```text
src/ui/screens/home/
  home.html
```

Do not move Home reset/menu JavaScript (`inline-030.js`) merely because it touches this screen. The standalone-JS analysis classifies that script as deceptively low static risk but it owns restart/end-game/tournament runtime hooks and therefore remains quarantined.

### Match setup / `#players`

Own the selected-player roster and start-match surface. The canonical player-count/product rules are not defined here; this slice only preserves existing rendered controls.

Target source boundary:

```text
src/ui/screens/match-setup/
  match-setup.html
```

Protected setup anchors include `#msPlayersList`, `#msRosterCount`, `#msMinHint`, `#startMatchBtn` and `#startScreenBtn`.

### Live Game / `#game`

Treat the Live Game shell as a high-risk component boundary, not as generic page markup. It contains the DMD, floating player header, score tables, Live V2 mount point and scroll gate consumed by multiple current runtime patches.

Target source boundary:

```text
src/live-game/view/
  live-game-shell.html
  scoreboard.html
  stats-hosts.html
```

The following must remain stable during structural extraction:

- `#sqDmdTopBar`, `#sqDmdWrap`, `#sqDmdCanvas`
- `#floatHead`, `#floatThead`, `#turnBar`
- `#gameScrollGate`, `#liveV2Panel`
- `#scoreWrap`, `#roundBar`, `#roundSeamBar`, `#thead`, `#tbody`
- `#statsWrap`, `#statsThead`, `#statsTbody`
- `#mstatsWrap`, `#mstatsThead`, `#mstatsTbody`
- `#endBanner`

No DMD redesign, race redesign, scoring change or Throwpad behaviour change belongs in this migration slice.

### Leaderboard / `#leaderboard`

Target source boundary:

```text
src/ui/screens/leaderboard/
  leaderboard.html
```

Keep `#nextGameBtn` / `#newMatchBtn` semantics and tournament/end-match hooks unchanged. Do not consolidate tournament leaderboard patches into this component until their standalone-JS dependencies are explicitly resolved.

### Fixed Throwpad

The fixed Throwpad lives outside the `.wrap` screen group and must stay structurally independent from Live Game scrolling. This is intentional architecture, not stray markup.

Target source boundary:

```text
src/live-game/throwpad/
  throwpad.html
```

Protected anchors: `#padBar`, `#padHint`, `#pad`, `#gifOverlay`.

## Modal ownership

### Setup/player modals

Proposed owner `src/ui/modals/setup/`:

- Add Player
- Select Player
- Start Game / mode selection
- Match Length

Do not change Back/Close semantics, player cache rules or game-mode routing while extracting markup.

### Admin/data modals

Proposed owner `src/ui/modals/admin/`:

- Admin Hub and Saved Players Admin
- Data/chart modal
- All Games
- League Low Scores Admin
- PB / GR Admin
- other existing admin/data overlays found in the shell

These components may display data but do not become data authorities. Supabase remains the source of truth.

## Compatibility-loader boundary

The late script/style sequence is currently a compatibility runtime. Preserve exact order until each script has an owned source boundary and explicit dependency proof. The architecture target is not to rename every historical patch; it is to make `index.html` generated from owned sources and then retire the compatibility layer under the Vite build.

Current policy:

- Core JS: semantic source domains already generate/verify the compatibility runtime.
- Core CSS: 27 semantic source domains already reconstruct the protected compatibility runtime exactly.
- Standalone JS: first five infrastructure-only files have semantic source ownership; behaviourally important mode/tournament/Live Game patches remain quarantined.
- Remaining legacy CSS/JS paths may remain in the compatibility shell until their ownership is proven.

## Planned HTML migration sequence

1. **Map and hash** the remaining shell regions without runtime changes.
2. Promote **Home** and **Match Setup** markup as source-only exact fragments first.
3. Promote **setup/player modal** markup as source-only exact fragments.
4. Promote **Leaderboard** only with end-game/tournament regression coverage.
5. Promote **Live Game + Throwpad** only after DOM-hook dependency checks pass.
6. Promote **admin/data modal bank** alongside verified service ownership.
7. Introduce a deterministic shell generator that reconstructs the current `index.html` from owned HTML + verified compatibility asset ordering.
8. Only then introduce Vite as the build/dev/deploy layer and prove GitHub Pages parity.

## Acceptance criteria for the first HTML source slice

- Generated `index.html` remains structurally equivalent.
- No protected DOM IDs are added, removed or duplicated.
- Screen order remains `details` → `players` → `game` → `leaderboard` in the document.
- Fixed Throwpad remains outside the screen `.wrap` and preserves viewport clearance.
- Script/style order is unchanged.
- No Supabase/schema/data write change.
- Existing setup and full scoring journey passes.
- Classic/DMD, Training, Progression and Player Stats regressions pass.
- 320/390 px mobile fit remains green where covered by current tests.

## Explicit non-goals

- No React/Next migration.
- No game-rule changes.
- No scoring refactor.
- No mode reclassification.
- No tournament-flow redesign.
- No DMD V2 integration (SC-030 remains parked).
- No Supabase schema/RLS change.
- No production deployment or release.
