# SC-052 — DMD Brutal Commentary

Status: BUILD CANDIDATE

## Purpose
Turn the live DMD into a stateful, sarcastic British crime-caper/pub commentator that reacts to the actual darts story without becoming a scoring engine.

## Authority boundary
SC-052 is presentation-only. It may read canonical live state, chronological throw history, completed match-game history, and the existing clean Official game-score view. It must never write or reinterpret scoring, rankings, XP, achievements, match state, Supabase data, RLS, or persistence.

## Story sequence
1. **Per dart** — short reaction only when a meaningful narrative is active.
2. **End of go** — verdict after dart 3, after the canonical ROUND SCORE frame.
3. **End of round** — once all scheduled players complete the round, a wider game-state punchline may appear before NEXT UP.

A new throw invalidates unfinished commentary timers. Scoring input is never blocked by commentary.

## Protected DMD priority
Canonical/major authored scenes outrank banter:
- Shanghai
- Desmond Delight
- Last Dart Hero
- Voldy
- Bull/Bullseye
- doubles/trebles authored sequences
- record / achievement / game-complete ownership

Commentary may own ordinary MISS/SINGLE presentation and major miss-streak milestones.

## Gap mocking
- **0–49 points behind:** no gap-based mocking.
- **50+ behind:** gap mocking becomes eligible.
- Escalation bands: 50+, 75+, 100+, 125+.
- A good visit while still 50+ behind can trigger a false-comeback response.
- End-of-round comparison uses the same 50-point floor.

## Miss escalation
Trailing chronological misses for the same player:
- 6
- 9
- 12
- 15
- 18+ (three-dart escalation)

Skip Go and active catch-up are excluded from commentary so synthetic absence state is not treated as thrown misses.

## Recurring visit patterns
- repeated zero visits
- exactly one scoring dart per visit, escalating from the third consecutive occurrence
- runaway leader
- 50+ deficit
- false comeback
- historical opponent dominance

## End-of-round stories
Eligible round verdicts include:
- all-zero / group humiliation
- lead change
- collapsing lead
- 50+ player deficit
- 50+ runaway leader margin
- late close game / choke zone
- one-player round domination

## History memory
SC-052 reuses existing truth:
- current match `state.match.history`
- read-only `v_player_game_scores_official_clean` for recent historical H2H context

History is warmed once and reused. No SC-052 database table or alternative history truth is permitted. Practice/Shadow/Training do not use the Official historical memory feed.

## Modes
Runtime API supports:
- `off`
- `banter`
- `brutal`

Current SC-052 default: **brutal**.

Mode is presentation preference only and may be persisted locally. It cannot alter gameplay.

## Acceptance
- 49 behind does not trigger gap mock.
- 50 behind does.
- 6/9/12 miss escalation works from chronological real throws.
- one-hit visit streak is recognised.
- end-of-go verdict occurs after ROUND SCORE.
- end-of-round punchline occurs before NEXT UP.
- repeated historical opponent dominance can create a callback.
- score/history structures are not mutated by commentary.
- existing DMD/runtime regression remains green.
