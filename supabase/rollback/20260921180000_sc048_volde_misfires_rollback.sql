-- SC-048 executable rollback snapshot captured from production before the Volde migration.
-- Baseline 21/09/2026: v_misfire_events=2998; v_misfire_penalty_events=244;
-- total v_player_misfire_xp=-196; fingerprint=0d7d4f4da2e346dd69cb3244891eef64.
-- Restore all three views together, then revert the SC-048 client/release commit.
create or replace view public.v_misfire_events as
WITH off_games AS (
         SELECT g.id,
            g.match_id,
            g.game_number,
            g.created_at,
            g.totals
           FROM games g
          WHERE g.finished = true AND COALESCE(g.is_practice, false) = false AND COALESCE(g.is_tiebreak, false) = false AND (COALESCE(NULLIF(lower(TRIM(BOTH FROM g.mode)), ''::text), NULLIF(lower(TRIM(BOTH FROM COALESCE(g.state ->> 'gameMode'::text, g.state ->> 'mode'::text, ''::text))), ''::text), 'legacy'::text) = ANY (ARRAY['legacy'::text, 'official'::text])) AND cardinality(g.totals) >= 2
        ), r AS (
         SELECT ar.game_id,
            ar.match_id,
            ar.is_tiebreak,
            ar.pidx,
            ar.player_id,
            ar.ridx,
            ar.target,
            ar.rmax,
            ar.rtot,
            ar.trebles,
            ar.doubles,
            ar.singles,
            ar.bull50,
            ar.misses,
            ar.ndarts,
            ar.bull_any
           FROM v_ach_rounds ar
             JOIN off_games g ON g.id = ar.game_id
        ), gp AS (
         SELECT r.game_id,
            r.player_id,
            sum(r.rtot)::integer AS g_total,
            count(*) FILTER (WHERE r.ridx >= 0 AND r.ridx <= 2 AND r.rtot = 0) AS first3_zero,
            bool_or(r.ridx = 11 AND r.rtot = 0) AS d_zero,
            bool_or(r.ridx = 12 AND r.rtot = 0) AS t_zero,
            bool_or(r.ridx = 13 AND r.rtot = 0) AS b_zero
           FROM r
          GROUP BY r.game_id, r.player_id
        ), z0 AS (
         SELECT r.game_id,
            r.player_id,
            r.ridx,
            r.rtot = 0 AS z,
            r.ridx - row_number() OVER (PARTITION BY r.game_id, r.player_id, (r.rtot = 0) ORDER BY r.ridx) AS grp
           FROM r
        ), zruns AS (
         SELECT q.game_id,
            q.player_id,
            max(q.run_len)::integer AS best_zero
           FROM ( SELECT z0.game_id,
                    z0.player_id,
                    z0.grp,
                    count(*) AS run_len
                   FROM z0
                  WHERE z0.z
                  GROUP BY z0.game_id, z0.player_id, z0.grp) q
          GROUP BY q.game_id, q.player_id
        ), gs0 AS (
         SELECT gp.game_id,
            gp.player_id,
            gp.g_total,
            gp.first3_zero,
            gp.d_zero,
            gp.t_zero,
            gp.b_zero,
            g.created_at,
            g.game_number,
            min(gp.g_total) OVER (PARTITION BY gp.game_id) AS min_total
           FROM gp
             JOIN off_games g ON g.id = gp.game_id
        ), gs AS (
         SELECT gs0.game_id,
            gs0.player_id,
            gs0.g_total,
            gs0.first3_zero,
            gs0.d_zero,
            gs0.t_zero,
            gs0.b_zero,
            gs0.created_at,
            gs0.game_number,
            gs0.min_total,
            count(*) FILTER (WHERE gs0.g_total = gs0.min_total) OVER (PARTITION BY gs0.game_id) AS bottom_ties
           FROM gs0
        ), seq0 AS (
         SELECT gs.game_id,
            gs.player_id,
            gs.g_total,
            gs.first3_zero,
            gs.d_zero,
            gs.t_zero,
            gs.b_zero,
            gs.created_at,
            gs.game_number,
            gs.min_total,
            gs.bottom_ties,
            gs.g_total < 100 AS drought,
            gs.g_total = gs.min_total AND gs.bottom_ties = 1 AS last_place,
            row_number() OVER (PARTITION BY gs.player_id ORDER BY gs.created_at, gs.game_number, gs.game_id) AS rn,
            row_number() OVER (PARTITION BY gs.player_id, (gs.g_total < 100) ORDER BY gs.created_at, gs.game_number, gs.game_id) AS rn_d,
            row_number() OVER (PARTITION BY gs.player_id, (gs.g_total = gs.min_total AND gs.bottom_ties = 1) ORDER BY gs.created_at, gs.game_number, gs.game_id) AS rn_l
           FROM gs
        ), seq AS (
         SELECT seq0.game_id,
            seq0.player_id,
            seq0.g_total,
            seq0.first3_zero,
            seq0.d_zero,
            seq0.t_zero,
            seq0.b_zero,
            seq0.created_at,
            seq0.game_number,
            seq0.min_total,
            seq0.bottom_ties,
            seq0.drought,
            seq0.last_place,
            seq0.rn,
            seq0.rn_d,
            seq0.rn_l,
            seq0.rn - seq0.rn_d AS drought_grp,
            seq0.rn - seq0.rn_l AS last_grp
           FROM seq0
        ), drought_events AS (
         SELECT q.game_id,
            q.player_id,
            q.created_at AS event_at,
            'century_drought'::text AS code,
            - 2 AS penalty
           FROM ( SELECT seq.game_id,
                    seq.player_id,
                    seq.g_total,
                    seq.first3_zero,
                    seq.d_zero,
                    seq.t_zero,
                    seq.b_zero,
                    seq.created_at,
                    seq.game_number,
                    seq.min_total,
                    seq.bottom_ties,
                    seq.drought,
                    seq.last_place,
                    seq.rn,
                    seq.rn_d,
                    seq.rn_l,
                    seq.drought_grp,
                    seq.last_grp,
                    row_number() OVER (PARTITION BY seq.player_id, seq.drought_grp ORDER BY seq.created_at, seq.game_number, seq.game_id) AS run_pos
                   FROM seq
                  WHERE seq.drought) q
          WHERE q.run_pos = 5
        ), last_events AS (
         SELECT q.game_id,
            q.player_id,
            q.created_at AS event_at,
            'wooden_spoon'::text AS code,
            - 3 AS penalty
           FROM ( SELECT seq.game_id,
                    seq.player_id,
                    seq.g_total,
                    seq.first3_zero,
                    seq.d_zero,
                    seq.t_zero,
                    seq.b_zero,
                    seq.created_at,
                    seq.game_number,
                    seq.min_total,
                    seq.bottom_ties,
                    seq.drought,
                    seq.last_place,
                    seq.rn,
                    seq.rn_d,
                    seq.rn_l,
                    seq.drought_grp,
                    seq.last_grp,
                    row_number() OVER (PARTITION BY seq.player_id, seq.last_grp ORDER BY seq.created_at, seq.game_number, seq.game_id) AS run_pos
                   FROM seq
                  WHERE seq.last_place) q
          WHERE q.run_pos = 5
        )
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'cold_start'::text AS code,
    - 1 AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.first3_zero = 3
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'ghost_town'::text AS code,
    '-2'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
     JOIN zruns z USING (game_id, player_id)
  WHERE z.best_zero >= 3
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'deep_freeze'::text AS code,
    '-3'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
     JOIN zruns z USING (game_id, player_id)
  WHERE z.best_zero >= 5
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'sub_ton'::text AS code,
    '-2'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.g_total < 100
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'special_delivery_failed'::text AS code,
    '-2'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.d_zero AND gp.t_zero AND gp.b_zero
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'bull_blind'::text AS code,
    '-1'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.b_zero
UNION ALL
 SELECT drought_events.game_id,
    drought_events.player_id,
    drought_events.event_at,
    drought_events.code,
    drought_events.penalty
   FROM drought_events
UNION ALL
 SELECT last_events.game_id,
    last_events.player_id,
    last_events.event_at,
    last_events.code,
    last_events.penalty
   FROM last_events;

create or replace view public.v_misfire_penalty_events as
WITH off_games AS MATERIALIZED (
         SELECT g.id,
            g.match_id,
            g.game_number,
            g.created_at,
            g.totals,
            g.state
           FROM games g
          WHERE g.finished = true AND g.created_at >= '2026-09-05 20:13:15+00'::timestamp with time zone AND COALESCE(g.is_practice, false) = false AND COALESCE(g.is_tiebreak, false) = false AND (COALESCE(NULLIF(lower(TRIM(BOTH FROM g.mode)), ''::text), NULLIF(lower(TRIM(BOTH FROM COALESCE(g.state ->> 'gameMode'::text, g.state ->> 'mode'::text, ''::text))), ''::text), 'legacy'::text) = ANY (ARRAY['legacy'::text, 'official'::text])) AND cardinality(g.totals) >= 2
        ), r AS MATERIALIZED (
         SELECT g.id AS game_id,
            res.player_id,
            (rnd.ord - 1)::integer AS ridx,
            COALESCE((rnd.val ->> 'roundTotal'::text)::integer, 0) AS rtot
           FROM off_games g
             CROSS JOIN LATERAL jsonb_array_elements(g.state -> 'board'::text) WITH ORDINALITY pl(val, ord)
             CROSS JOIN LATERAL jsonb_array_elements(pl.val) WITH ORDINALITY rnd(val, ord)
             JOIN v_name_resolver res ON res.nm = lower(TRIM(BOTH FROM ((g.state -> 'players'::text) -> (pl.ord - 1)::integer) ->> 'name'::text))
        ), gp AS (
         SELECT r.game_id,
            r.player_id,
            sum(r.rtot)::integer AS g_total,
            count(*) FILTER (WHERE r.ridx >= 0 AND r.ridx <= 2 AND r.rtot = 0) AS first3_zero,
            bool_or(r.ridx = 11 AND r.rtot = 0) AS d_zero,
            bool_or(r.ridx = 12 AND r.rtot = 0) AS t_zero,
            bool_or(r.ridx = 13 AND r.rtot = 0) AS b_zero
           FROM r
          GROUP BY r.game_id, r.player_id
        ), z0 AS (
         SELECT r.game_id,
            r.player_id,
            r.ridx,
            r.rtot = 0 AS z,
            r.ridx - row_number() OVER (PARTITION BY r.game_id, r.player_id, (r.rtot = 0) ORDER BY r.ridx) AS grp
           FROM r
        ), zruns AS (
         SELECT q.game_id,
            q.player_id,
            max(q.run_len)::integer AS best_zero
           FROM ( SELECT z0.game_id,
                    z0.player_id,
                    z0.grp,
                    count(*) AS run_len
                   FROM z0
                  WHERE z0.z
                  GROUP BY z0.game_id, z0.player_id, z0.grp) q
          GROUP BY q.game_id, q.player_id
        ), gs0 AS (
         SELECT gp.game_id,
            gp.player_id,
            gp.g_total,
            gp.first3_zero,
            gp.d_zero,
            gp.t_zero,
            gp.b_zero,
            g.created_at,
            g.game_number,
            min(gp.g_total) OVER (PARTITION BY gp.game_id) AS min_total
           FROM gp
             JOIN off_games g ON g.id = gp.game_id
        ), gs AS (
         SELECT gs0.game_id,
            gs0.player_id,
            gs0.g_total,
            gs0.first3_zero,
            gs0.d_zero,
            gs0.t_zero,
            gs0.b_zero,
            gs0.created_at,
            gs0.game_number,
            gs0.min_total,
            count(*) FILTER (WHERE gs0.g_total = gs0.min_total) OVER (PARTITION BY gs0.game_id) AS bottom_ties
           FROM gs0
        ), seq0 AS (
         SELECT gs.game_id,
            gs.player_id,
            gs.g_total,
            gs.first3_zero,
            gs.d_zero,
            gs.t_zero,
            gs.b_zero,
            gs.created_at,
            gs.game_number,
            gs.min_total,
            gs.bottom_ties,
            gs.g_total < 100 AS drought,
            gs.g_total = gs.min_total AND gs.bottom_ties = 1 AS last_place,
            row_number() OVER (PARTITION BY gs.player_id ORDER BY gs.created_at, gs.game_number, gs.game_id) AS rn,
            row_number() OVER (PARTITION BY gs.player_id, (gs.g_total < 100) ORDER BY gs.created_at, gs.game_number, gs.game_id) AS rn_d,
            row_number() OVER (PARTITION BY gs.player_id, (gs.g_total = gs.min_total AND gs.bottom_ties = 1) ORDER BY gs.created_at, gs.game_number, gs.game_id) AS rn_l
           FROM gs
        ), seq AS (
         SELECT seq0.game_id,
            seq0.player_id,
            seq0.g_total,
            seq0.first3_zero,
            seq0.d_zero,
            seq0.t_zero,
            seq0.b_zero,
            seq0.created_at,
            seq0.game_number,
            seq0.min_total,
            seq0.bottom_ties,
            seq0.drought,
            seq0.last_place,
            seq0.rn,
            seq0.rn_d,
            seq0.rn_l,
            seq0.rn - seq0.rn_d AS drought_grp,
            seq0.rn - seq0.rn_l AS last_grp
           FROM seq0
        ), drought_events AS (
         SELECT q.game_id,
            q.player_id,
            q.created_at AS event_at,
            'century_drought'::text AS code,
            '-2'::integer AS penalty
           FROM ( SELECT seq.game_id,
                    seq.player_id,
                    seq.g_total,
                    seq.first3_zero,
                    seq.d_zero,
                    seq.t_zero,
                    seq.b_zero,
                    seq.created_at,
                    seq.game_number,
                    seq.min_total,
                    seq.bottom_ties,
                    seq.drought,
                    seq.last_place,
                    seq.rn,
                    seq.rn_d,
                    seq.rn_l,
                    seq.drought_grp,
                    seq.last_grp,
                    row_number() OVER (PARTITION BY seq.player_id, seq.drought_grp ORDER BY seq.created_at, seq.game_number, seq.game_id) AS run_pos
                   FROM seq
                  WHERE seq.drought) q
          WHERE q.run_pos = 5
        ), last_events AS (
         SELECT q.game_id,
            q.player_id,
            q.created_at AS event_at,
            'wooden_spoon'::text AS code,
            '-3'::integer AS penalty
           FROM ( SELECT seq.game_id,
                    seq.player_id,
                    seq.g_total,
                    seq.first3_zero,
                    seq.d_zero,
                    seq.t_zero,
                    seq.b_zero,
                    seq.created_at,
                    seq.game_number,
                    seq.min_total,
                    seq.bottom_ties,
                    seq.drought,
                    seq.last_place,
                    seq.rn,
                    seq.rn_d,
                    seq.rn_l,
                    seq.drought_grp,
                    seq.last_grp,
                    row_number() OVER (PARTITION BY seq.player_id, seq.last_grp ORDER BY seq.created_at, seq.game_number, seq.game_id) AS run_pos
                   FROM seq
                  WHERE seq.last_place) q
          WHERE q.run_pos = 5
        )
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'cold_start'::text AS code,
    '-1'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.first3_zero = 3
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'ghost_town'::text AS code,
    '-2'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
     JOIN zruns z USING (game_id, player_id)
  WHERE z.best_zero >= 3
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'deep_freeze'::text AS code,
    '-3'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
     JOIN zruns z USING (game_id, player_id)
  WHERE z.best_zero >= 5
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'sub_ton'::text AS code,
    '-2'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.g_total < 100
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'special_delivery_failed'::text AS code,
    '-2'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.d_zero AND gp.t_zero AND gp.b_zero
UNION ALL
 SELECT gp.game_id,
    gp.player_id,
    g.created_at AS event_at,
    'bull_blind'::text AS code,
    '-1'::integer AS penalty
   FROM gp
     JOIN off_games g ON g.id = gp.game_id
  WHERE gp.b_zero
UNION ALL
 SELECT drought_events.game_id,
    drought_events.player_id,
    drought_events.event_at,
    drought_events.code,
    drought_events.penalty
   FROM drought_events
UNION ALL
 SELECT last_events.game_id,
    last_events.player_id,
    last_events.event_at,
    last_events.code,
    last_events.penalty
   FROM last_events;

create or replace view public.v_player_misfire_xp as
WITH per_game AS (
         SELECT e.player_id,
            e.game_id,
            GREATEST('-5'::integer, min(e.penalty))::bigint AS penalty
           FROM v_misfire_penalty_events e
          GROUP BY e.player_id, e.game_id
        )
 SELECT player_id,
    COALESCE(sum(penalty), 0::numeric)::bigint AS misfire_xp
   FROM per_game
  GROUP BY player_id;
