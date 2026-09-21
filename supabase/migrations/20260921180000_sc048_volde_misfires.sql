-- SC-048: Volde-D’eux / Volde-Trois Misfires.
-- Official/Classic only. Historical counts backfill; negative XP remains launch-forward.
-- Ordinary Misfires keep worst-only / -5 XP per game. Volde stacks at -2 XP per qualifying dart.

create or replace view public.v_misfire_events as
with off_games as (
  select g.id,g.match_id,g.game_number,g.created_at,g.totals,g.state
  from public.games g
  where g.finished=true and coalesce(g.is_practice,false)=false and coalesce(g.is_tiebreak,false)=false
    and coalesce(nullif(lower(trim(g.mode)),''),nullif(lower(trim(coalesce(g.state->>'gameMode',g.state->>'mode',''))),''),'legacy') in ('legacy','official')
    and cardinality(g.totals)>=2
), r as (
  select ar.* from public.v_ach_rounds ar join off_games g on g.id=ar.game_id
), gp as (
  select r.game_id,r.player_id,sum(r.rtot)::integer g_total,
    count(*) filter(where r.ridx between 0 and 2 and r.rtot=0) first3_zero,
    bool_or(r.ridx=11 and r.rtot=0) d_zero,bool_or(r.ridx=12 and r.rtot=0) t_zero,bool_or(r.ridx=13 and r.rtot=0) b_zero
  from r group by r.game_id,r.player_id
), z0 as (
  select r.game_id,r.player_id,r.ridx,(r.rtot=0) z,
    r.ridx-row_number() over(partition by r.game_id,r.player_id,(r.rtot=0) order by r.ridx) grp from r
), zruns as (
  select q.game_id,q.player_id,max(q.run_len)::integer best_zero
  from (select z0.game_id,z0.player_id,z0.grp,count(*) run_len from z0 where z0.z group by z0.game_id,z0.player_id,z0.grp) q
  group by q.game_id,q.player_id
), gs0 as (
  select gp.*,g.created_at,g.game_number,min(gp.g_total) over(partition by gp.game_id) min_total from gp join off_games g on g.id=gp.game_id
), gs as (
  select gs0.*,count(*) filter(where gs0.g_total=gs0.min_total) over(partition by gs0.game_id) bottom_ties from gs0
), seq0 as (
  select gs.*,(gs.g_total<100) drought,(gs.g_total=gs.min_total and gs.bottom_ties=1) last_place,
    row_number() over(partition by gs.player_id order by gs.created_at,gs.game_number,gs.game_id) rn,
    row_number() over(partition by gs.player_id,(gs.g_total<100) order by gs.created_at,gs.game_number,gs.game_id) rn_d,
    row_number() over(partition by gs.player_id,(gs.g_total=gs.min_total and gs.bottom_ties=1) order by gs.created_at,gs.game_number,gs.game_id) rn_l
  from gs
), seq as (
  select seq0.*,seq0.rn-seq0.rn_d drought_grp,seq0.rn-seq0.rn_l last_grp from seq0
), drought_events as (
  select q.game_id,q.player_id,q.created_at event_at,'century_drought'::text code,-2 penalty
  from (select seq.*,row_number() over(partition by seq.player_id,seq.drought_grp order by seq.created_at,seq.game_number,seq.game_id) run_pos from seq where seq.drought) q
  where q.run_pos=5
), last_events as (
  select q.game_id,q.player_id,q.created_at event_at,'wooden_spoon'::text code,-3 penalty
  from (select seq.*,row_number() over(partition by seq.player_id,seq.last_grp order by seq.created_at,seq.game_number,seq.game_id) run_pos from seq where seq.last_place) q
  where q.run_pos=5
), volde_events as (
  select g.id game_id,res.player_id,g.created_at event_at,
    case when rnd.ord=12 then 'volde_deux'::text else 'volde_trois'::text end code,-2 penalty
  from off_games g
  cross join lateral jsonb_array_elements(g.state->'board') with ordinality pl(val,ord)
  cross join lateral jsonb_array_elements(pl.val) with ordinality rnd(val,ord)
  cross join lateral jsonb_array_elements(coalesce(rnd.val->'darts','[]'::jsonb)) dart(val)
  join public.v_name_resolver res on res.nm=lower(trim(((g.state->'players')->((pl.ord-1)::integer))->>'name'))
  where (rnd.ord=12 and dart.val->>'kind'='Double' and case when coalesce(dart.val->>'sector','') ~ '^[0-9]+$' then (dart.val->>'sector')::integer end between 1 and 5)
     or (rnd.ord=13 and dart.val->>'kind'='Triple' and case when coalesce(dart.val->>'sector','') ~ '^[0-9]+$' then (dart.val->>'sector')::integer end between 1 and 5)
)
select gp.game_id,gp.player_id,g.created_at event_at,'cold_start'::text code,-1 penalty from gp join off_games g on g.id=gp.game_id where gp.first3_zero=3
union all select gp.game_id,gp.player_id,g.created_at,'ghost_town',-2 from gp join off_games g on g.id=gp.game_id join zruns z using(game_id,player_id) where z.best_zero>=3
union all select gp.game_id,gp.player_id,g.created_at,'deep_freeze',-3 from gp join off_games g on g.id=gp.game_id join zruns z using(game_id,player_id) where z.best_zero>=5
union all select gp.game_id,gp.player_id,g.created_at,'sub_ton',-2 from gp join off_games g on g.id=gp.game_id where gp.g_total<100
union all select gp.game_id,gp.player_id,g.created_at,'special_delivery_failed',-2 from gp join off_games g on g.id=gp.game_id where gp.d_zero and gp.t_zero and gp.b_zero
union all select gp.game_id,gp.player_id,g.created_at,'bull_blind',-1 from gp join off_games g on g.id=gp.game_id where gp.b_zero
union all select game_id,player_id,event_at,code,penalty from drought_events
union all select game_id,player_id,event_at,code,penalty from last_events
union all select game_id,player_id,event_at,code,penalty from volde_events;

create or replace view public.v_misfire_penalty_events as
with off_games as materialized (
  select g.id,g.match_id,g.game_number,g.created_at,g.totals,g.state
  from public.games g
  where g.finished=true and g.created_at>='2026-09-05 20:13:15+00'::timestamptz
    and coalesce(g.is_practice,false)=false and coalesce(g.is_tiebreak,false)=false
    and coalesce(nullif(lower(trim(g.mode)),''),nullif(lower(trim(coalesce(g.state->>'gameMode',g.state->>'mode',''))),''),'legacy') in ('legacy','official')
    and cardinality(g.totals)>=2
), r as materialized (
  select g.id game_id,res.player_id,(rnd.ord-1)::integer ridx,coalesce((rnd.val->>'roundTotal')::integer,0) rtot
  from off_games g
  cross join lateral jsonb_array_elements(g.state->'board') with ordinality pl(val,ord)
  cross join lateral jsonb_array_elements(pl.val) with ordinality rnd(val,ord)
  join public.v_name_resolver res on res.nm=lower(trim(((g.state->'players')->((pl.ord-1)::integer))->>'name'))
), gp as (
  select r.game_id,r.player_id,sum(r.rtot)::integer g_total,
    count(*) filter(where r.ridx between 0 and 2 and r.rtot=0) first3_zero,
    bool_or(r.ridx=11 and r.rtot=0) d_zero,bool_or(r.ridx=12 and r.rtot=0) t_zero,bool_or(r.ridx=13 and r.rtot=0) b_zero
  from r group by r.game_id,r.player_id
), z0 as (
  select r.game_id,r.player_id,r.ridx,(r.rtot=0) z,r.ridx-row_number() over(partition by r.game_id,r.player_id,(r.rtot=0) order by r.ridx) grp from r
), zruns as (
  select q.game_id,q.player_id,max(q.run_len)::integer best_zero
  from (select z0.game_id,z0.player_id,z0.grp,count(*) run_len from z0 where z0.z group by z0.game_id,z0.player_id,z0.grp) q group by q.game_id,q.player_id
), gs0 as (
  select gp.*,g.created_at,g.game_number,min(gp.g_total) over(partition by gp.game_id) min_total from gp join off_games g on g.id=gp.game_id
), gs as (
  select gs0.*,count(*) filter(where gs0.g_total=gs0.min_total) over(partition by gs0.game_id) bottom_ties from gs0
), seq0 as (
  select gs.*,(gs.g_total<100) drought,(gs.g_total=gs.min_total and gs.bottom_ties=1) last_place,
    row_number() over(partition by gs.player_id order by gs.created_at,gs.game_number,gs.game_id) rn,
    row_number() over(partition by gs.player_id,(gs.g_total<100) order by gs.created_at,gs.game_number,gs.game_id) rn_d,
    row_number() over(partition by gs.player_id,(gs.g_total=gs.min_total and gs.bottom_ties=1) order by gs.created_at,gs.game_number,gs.game_id) rn_l from gs
), seq as (
  select seq0.*,seq0.rn-seq0.rn_d drought_grp,seq0.rn-seq0.rn_l last_grp from seq0
), drought_events as (
  select q.game_id,q.player_id,q.created_at event_at,'century_drought'::text code,-2 penalty
  from (select seq.*,row_number() over(partition by seq.player_id,seq.drought_grp order by seq.created_at,seq.game_number,seq.game_id) run_pos from seq where seq.drought) q where q.run_pos=5
), last_events as (
  select q.game_id,q.player_id,q.created_at event_at,'wooden_spoon'::text code,-3 penalty
  from (select seq.*,row_number() over(partition by seq.player_id,seq.last_grp order by seq.created_at,seq.game_number,seq.game_id) run_pos from seq where seq.last_place) q where q.run_pos=5
), volde_events as (
  select g.id game_id,res.player_id,g.created_at event_at,case when rnd.ord=12 then 'volde_deux'::text else 'volde_trois'::text end code,-2 penalty
  from off_games g
  cross join lateral jsonb_array_elements(g.state->'board') with ordinality pl(val,ord)
  cross join lateral jsonb_array_elements(pl.val) with ordinality rnd(val,ord)
  cross join lateral jsonb_array_elements(coalesce(rnd.val->'darts','[]'::jsonb)) dart(val)
  join public.v_name_resolver res on res.nm=lower(trim(((g.state->'players')->((pl.ord-1)::integer))->>'name'))
  where (rnd.ord=12 and dart.val->>'kind'='Double' and case when coalesce(dart.val->>'sector','') ~ '^[0-9]+$' then (dart.val->>'sector')::integer end between 1 and 5)
     or (rnd.ord=13 and dart.val->>'kind'='Triple' and case when coalesce(dart.val->>'sector','') ~ '^[0-9]+$' then (dart.val->>'sector')::integer end between 1 and 5)
)
select gp.game_id,gp.player_id,g.created_at event_at,'cold_start'::text code,-1 penalty from gp join off_games g on g.id=gp.game_id where gp.first3_zero=3
union all select gp.game_id,gp.player_id,g.created_at,'ghost_town',-2 from gp join off_games g on g.id=gp.game_id join zruns z using(game_id,player_id) where z.best_zero>=3
union all select gp.game_id,gp.player_id,g.created_at,'deep_freeze',-3 from gp join off_games g on g.id=gp.game_id join zruns z using(game_id,player_id) where z.best_zero>=5
union all select gp.game_id,gp.player_id,g.created_at,'sub_ton',-2 from gp join off_games g on g.id=gp.game_id where gp.g_total<100
union all select gp.game_id,gp.player_id,g.created_at,'special_delivery_failed',-2 from gp join off_games g on g.id=gp.game_id where gp.d_zero and gp.t_zero and gp.b_zero
union all select gp.game_id,gp.player_id,g.created_at,'bull_blind',-1 from gp join off_games g on g.id=gp.game_id where gp.b_zero
union all select game_id,player_id,event_at,code,penalty from drought_events
union all select game_id,player_id,event_at,code,penalty from last_events
union all select game_id,player_id,event_at,code,penalty from volde_events;

create or replace view public.v_player_misfire_xp as
with per_game as (
  select e.player_id,e.game_id,
    (greatest(-5,coalesce(min(e.penalty) filter(where e.code NOT IN ('volde_deux','volde_trois')),0))
     + coalesce(sum(e.penalty) FILTER (where e.code in ('volde_deux','volde_trois')),0))::bigint penalty
  from public.v_misfire_penalty_events e group by e.player_id,e.game_id
)
select player_id,coalesce(sum(penalty),0)::bigint misfire_xp from per_game group by player_id;
