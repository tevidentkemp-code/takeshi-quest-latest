-- SC-059 — Bounce Out Misfire
-- Product authority: CURRENT_Shateki_Quest_Game_Rules §5.2 and §15.3–15.4.
-- Bounce Out is a normal Misfire worth -1 XP when explicitly recorded.
-- Historical occurrences are derived from saved Official/Classic game state only;
-- ordinary Miss darts are never inferred to be Bounce Outs.
-- Negative XP still respects the existing Misfire launch boundary and normal
-- single-worst / -5-per-game rule. Volde exceptions remain unchanged.
--
-- No historical game rows are mutated. Backfill is view-derived and reversible.

create or replace view public.v_bounce_out_misfire_events
with (security_invoker = true)
as
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
    ((rnd.ord - 1))::integer as ridx,
    ((d.ord - 1))::integer as didx,
    d.value as dart
  from off_games g
  cross join lateral jsonb_array_elements(g.state->'board') with ordinality pl(val, ord)
  cross join lateral jsonb_array_elements(pl.val) with ordinality rnd(val, ord)
  cross join lateral jsonb_array_elements(coalesce(rnd.val->'darts', '[]'::jsonb)) with ordinality d(value, ord)
  join public.v_name_resolver res
    on res.nm = lower(trim((g.state->'players'->((pl.ord - 1)::integer))->>'name'))
)
select
  game_id,
  player_id,
  event_at,
  ridx,
  didx,
  'bounce_out'::text as code,
  (-1)::integer as penalty
from darts
where lower(coalesce(dart->>'bounceOut', 'false')) = 'true';

comment on view public.v_bounce_out_misfire_events is
  'SC-059 historical Official/Classic Bounce Out Misfire events derived only from explicit saved dart bounceOut markers.';

create or replace view public.v_bounce_out_misfire_penalty_events
with (security_invoker = true)
as
select
  game_id,
  player_id,
  event_at,
  code,
  penalty
from public.v_bounce_out_misfire_events
where event_at >= timestamptz '2026-09-05 20:13:15+00';

comment on view public.v_bounce_out_misfire_penalty_events is
  'SC-059 Bounce Out Misfire events eligible for negative XP from the existing Misfire XP launch boundary onward.';

create or replace view public.v_player_misfires as
with all_events as (
  select player_id, code from public.v_misfire_events
  union all
  select player_id, code from public.v_volde_misfire_events
  union all
  select player_id, code from public.v_bounce_out_misfire_events
)
select
  player_id,
  code,
  count(*) as cnt
from all_events
group by player_id, code;

create or replace view public.v_player_misfire_xp as
with normal_events as (
  select game_id, player_id, penalty from public.v_misfire_penalty_events
  union all
  select game_id, player_id, penalty from public.v_bounce_out_misfire_penalty_events
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

revoke all on public.v_bounce_out_misfire_events from anon, authenticated;
revoke all on public.v_bounce_out_misfire_penalty_events from anon, authenticated;
grant select on public.v_bounce_out_misfire_events to service_role;
grant select on public.v_bounce_out_misfire_penalty_events to service_role;
