-- Rollback SC-059 — Bounce Out Misfire / historical backfill
-- Restores the exact pre-SC-059 public aggregate views and removes the
-- internal Bounce Out helper. No historical game rows are mutated.

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

drop view if exists public.v_bounce_out_misfire_penalty_events;
drop view if exists public.v_bounce_out_misfire_events;
