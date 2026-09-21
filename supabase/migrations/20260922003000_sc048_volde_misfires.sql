-- SC-048 — Volde-D'eux / Volde-Trois Misfires
-- Product authority: CURRENT_Shateki_Quest_Game_Rules §15.3 / §15.4.
-- Historical counts are backfilled from saved Official/Classic game state.
-- Negative XP remains launch-forward from the existing Misfire boundary:
-- 2026-09-05 20:13:15+00.
--
-- Volde-D'eux: each D1-D5 dart in round index 11 = -2 XP.
-- Volde-Trois: each T1-T5 dart in round index 12 = -2 XP.
-- These penalties stack per qualifying dart and are additional to the normal
-- per-game Misfire penalty (worst normal event, capped at -5).
--
-- Rollback route: supabase/rollbacks/sc048_volde_misfires.sql restores the
-- exact pre-change public views and drops both SC-048 helper views.

create or replace view public.v_volde_misfire_events as
with off_games as materialized (
  select
    g.id,
    g.created_at,
    g.state
  from public.games g
  where g.finished = true
    and coalesce(g.is_practice, false) = false
    and coalesce(g.is_tiebreak, false) = false
    and coalesce(
      nullif(lower(trim(g.mode)), ''),
      nullif(lower(trim(coalesce(g.state->>'gameMode', g.state->>'mode', ''))), ''),
      'legacy'
    ) in ('legacy', 'official')
    and g.state ? 'board'
),
darts as materialized (
  select
    g.id as game_id,
    g.created_at as event_at,
    res.player_id,
    (rnd.ord - 1)::integer as ridx,
    lower(coalesce(d.value->>'kind', '')) as kind,
    case
      when coalesce(d.value->>'sector', '') ~ '^[0-9]+$'
        then (d.value->>'sector')::integer
      else 0
    end as sector
  from off_games g
  cross join lateral jsonb_array_elements(g.state->'board') with ordinality pl(val, ord)
  cross join lateral jsonb_array_elements(pl.val) with ordinality rnd(val, ord)
  cross join lateral jsonb_array_elements(coalesce(rnd.val->'darts', '[]'::jsonb)) d(value)
  join public.v_name_resolver res
    on res.nm = lower(trim((g.state->'players'->((pl.ord - 1)::integer))->>'name'))
)
select
  game_id,
  player_id,
  event_at,
  'volde_deux'::text as code,
  (-2)::integer as penalty
from darts
where ridx = 11
  and kind in ('d', 'double')
  and sector between 1 and 5
union all
select
  game_id,
  player_id,
  event_at,
  'volde_trois'::text as code,
  (-2)::integer as penalty
from darts
where ridx = 12
  and kind in ('t', 'triple')
  and sector between 1 and 5;

comment on view public.v_volde_misfire_events is
  'SC-048 historical Official/Classic Volde-D''eux and Volde-Trois dart-level Misfire events.';

create or replace view public.v_volde_misfire_penalty_events as
select
  game_id,
  player_id,
  event_at,
  code,
  penalty
from public.v_volde_misfire_events
where event_at >= timestamptz '2026-09-05 20:13:15+00';

comment on view public.v_volde_misfire_penalty_events is
  'SC-048 launch-forward Volde penalty events; each qualifying dart remains independently -2 XP.';

-- History/catalogue truth: normal Misfires plus every qualifying Volde dart.
create or replace view public.v_player_misfires as
with all_events as (
  select player_id, code from public.v_misfire_events
  union all
  select player_id, code from public.v_volde_misfire_events
)
select
  player_id,
  code,
  count(*) as cnt
from all_events
group by player_id, code;

-- XP truth:
--   normal Misfires = one worst event per game, capped at -5
--   Volde events    = every qualifying dart, -2 each, uncapped and additive
create or replace view public.v_player_misfire_xp as
with normal_per_game as (
  select
    e.player_id,
    e.game_id,
    greatest(-5, min(e.penalty))::bigint as penalty
  from public.v_misfire_penalty_events e
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

-- Keep helper views internal; the public UI continues to read the established
-- v_player_misfires / v_player_xp contracts.
revoke all on public.v_volde_misfire_events from anon, authenticated;
revoke all on public.v_volde_misfire_penalty_events from anon, authenticated;
grant select on public.v_volde_misfire_events to service_role;
grant select on public.v_volde_misfire_penalty_events to service_role;
