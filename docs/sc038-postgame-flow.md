# SC-038 — Post-game flow polish

Scope: presentation-only changes around completed games. Existing scoring, persistence, XP calculation, records and match advancement remain authoritative.

## Accepted presentation flow

1. Result hero
   - Current dark/orange in-game styling retained.
   - Winner first + last name on the main line.
   - Nickname underneath at a smaller size.
   - Final Score.
   - Best Round as round number / round score.
   - Average.
   - Rank Movement unchanged.
2. NEXT → Game Scorecard
   - All players.
   - Name, Score, Avg, Best Round.
   - PB / WR badges only when a new official-game PB / world-best total is detected from the verified Supabase ranking view.
   - Only NEXT remains as the normal continuation action.
3. NEXT → XP
   - Existing XP / rewards renderer reused.
   - Existing mode isolation retained.
   - Final action is NEXT GAME while the match continues, or FINISH MATCH when complete.
4. Throwpad
   - Outer Bull green.
   - Inner Bull red.
   - No scoring change.

## Protected behaviour

- 14-round scoring remains unchanged.
- Outer Bull remains 25; Inner Bull remains 50.
- Supabase save path unchanged.
- XP calculation unchanged.
- Practice / Turbo / Training / Vs Shadow XP isolation unchanged.
- Decider flow retained.
- Existing match advancement handler retained.

## Acceptance evidence

- `tools/ui-smoke/verify-sc038-postgame-flow.mjs`
- `tools/ui-smoke/verify-sc038-ui.js`
- Setup regression QA includes both tests and stores runtime screenshots as workflow artifacts.
