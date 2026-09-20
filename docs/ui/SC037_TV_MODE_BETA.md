# SC-037 — Landscape TV Mode Beta

## Scope

Provisional live implementation of the approved 1920×1080 Figma direction (file `xbbUHNsSWbvH8ijDKwNyau`, node `3:2`).

This release is deliberately presentation-only. It reads the existing live game `state` and does not own scoring, match progression, rankings, XP, records or Supabase writes.

## Beta contract

- Entry: **Game Menu → TV Mode (Beta)**.
- Supported initially: Classic Match Play, 2–6 players.
- Layout: 16:9 big-screen view with DMD-style current-turn banner, player cards, six-row score window, live game race, current-player averages and three-dart rail.
- Exit: **EXIT TV MODE** returns to the unchanged normal live game.
- Game completion: TV overlay closes so the existing Game Complete flow remains authoritative.
- Practice, Training and Turbo are intentionally blocked in this provisional version.
- No persistent preference is stored; each TV session is explicitly entered.

## Protected behaviours

Normal portrait gameplay, Throw Order, scoring, skip/catch-up, match wins, Game Complete, player identity, Supabase writes and all existing mode isolation remain owned by their current implementations.

## Rollback

Remove the SC-037 stylesheet/script includes from the shell template, revert the Game Menu row, and delete `src/live-game/tv-mode.js` / `src/styles/live-game/tv-mode.css`. No data rollback is required.

## Candidate verification note

A documentation-only refresh was added after the original SC-034/036 built-dist GitHub Actions runner remained in-progress after the source-runtime pass. Runtime TV Mode code was not changed by this refresh; the new exact head is used to obtain a clean hosted CI result before release.
