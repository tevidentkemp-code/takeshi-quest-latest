-- SC-059 — Bounce Out Misfire / historical backfill
-- Product authority: CURRENT_Shateki_Quest_Game_Rules §5.2 and §15.3–15.4 + Thomas instruction 01/10/2026.
-- Bounce Out remains a zero-score dart. It is a normal Misfire worth -1 XP.
-- Historical occurrence counts are derived only from explicit saved
-- dart.bounceOut=true markers. Ordinary MISS darts are never inferred.
-- Negative XP remains launch-forward from the existing Misfire boundary:
-- 2026-09-05 20:13:15+00.
-- Normal Misfire aggregation is unchanged: one worst normal penalty per game,
-- capped at -5. Bounce Out is NOT a Volde-style stacking exception.
--
-- No historical game row is rewritten by this migration. Backfill is view-driven.
-- Rollback: supabase/rollbacks/sc059_bounce_out_misfire.sql.

create or replace view private.v_bounce_out_misfire_events as
with off_games as materialized (
  select
    g.id,
    g.created_at,
    g.state
  from public.v_games_official_clean g
  where g.finished = true
    and coalesce(g.is_tiebreak, false) = false
    and coalesce(g.player_count, 0) >= 2
    and g.state ? 'board'
),
darts as materialized (
  select
    g.id as game_id,
    g.created_at as event_at,
    res.player_id,
    (pl.ord - 1)::integer as player_index,
    (rnd.ord - 1)::integer as round_index,
    (d.ord - 1)::integer as dart_index,
    d.val
  from off_games g
  cross join lateral jsonb_array_elements(g.state->'board') with ordinality pl(val, ord)
  cross join lateral jsonb_array_elements(pl.val) with ordinality rnd(val, ord)
  cross join lateral jsonb_array_elements(coalesce(rnd.val->'darts', '[]'::jsonb)) with ordinality d(val, ord)
  join public.v_name_resolver res
    on res.nm = lower(trim((g.state->'players'->((pl.ord - 1)::integer))->>'name'))
)
select
  game_id,
  player_id,
  event_at,
  'bounce_out'::text as code,
  (-1)::integer as penalty
from darts
where val->>'bounceOut' = 'true';

comment on view private.v_bounce_out_misfire_events is
  'SC-059 historical Official/Classic Bounce Out Misfire events derived only from explicit saved bounceOut=true dart markers.';

-- This helper is intentionally internal. Public clients continue to use the
-- established v_player_misfires / v_player_xp contracts.
revoke all on private.v_bounce_out_misfire_events from PUBLIC, anon, authenticated;

-- History/catalogue truth: existing normal Misfires + Volde + explicit Bounce Out.
create or replace view public.v_player_misfires as
with all_events as (
  select player_id, code from public.v_misfire_events
  union all
  select player_id, code from public.v_volde_misfire_events
  union all
  select player_id, code from private.v_bounce_out_misfire_events
)
select
  player_id,
  code,
  count(*) as cnt
from all_events
group by player_id, code;

-- XP truth:
--   normal Misfires (including Bounce Out) = one worst event per game, capped -5
--   Volde events                            = every qualifying dart, additive
-- Bounce Out penalty events are filtered to the existing Misfire XP launch
-- boundary while historical occurrence counts remain all-time.
create or replace view public.v_player_misfire_xp as
with normal_events as (
  select game_id, player_id, event_at, code, penalty
  from public.v_misfire_penalty_events
  union all
  select game_id, player_id, event_at, code, penalty
  from private.v_bounce_out_misfire_events
  where event_at >= timestamptz '2026-09-05 20:13:15+00'
),
normal_per_game as (
  select
    e.player_id,
    e.game_id,
    greatest(-5, min(e.penalty))::bigint as penalty
  from normal_events e
  group by e.player_id, e.game_id
),
volde_per_game as (
  select
    e.player_id,
    e.game_id,
    sum(e.penalty)::bigint as penalty
  from public.v_volde_misfire_penalty_events e
  group by e.player_id, e.game_id
),
combined as (
  select player_id, game_id, penalty from normal_per_game
  union all
  select player_id, game_id, penalty from volde_per_game
)
select
  player_id,
  coalesce(sum(penalty), 0)::bigint as misfire_xp
from combined
group by player_id;
