-- SC-048 executable rollback.
-- Exact pre-SC-048 production behaviour captured from Shateki-Quest on 22 Sep 2026.
-- Revert the SC-048 client release before applying.
begin;
set local lock_timeout = '5s';

create or replace view public.v_player_misfires as
select player_id,
       code,
       count(*) as cnt
from public.v_misfire_events
group by player_id, code;

create or replace view public.v_player_misfire_xp as
with per_game as (
  select e.player_id,
         e.game_id,
         greatest(-5, min(e.penalty))::bigint as penalty
  from public.v_misfire_penalty_events e
  group by e.player_id, e.game_id
)
select player_id,
       coalesce(sum(penalty), 0)::bigint as misfire_xp
from per_game
group by player_id;

drop view if exists public.v_volde_misfire_penalty_events;
drop view if exists public.v_volde_misfire_events;

commit;
