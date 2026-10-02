-- SC-063: avoid expanding games with no explicit Bounce Out marker.
-- Live definition captured from Supabase 2026-10-02. Preserve the same
-- clean Official source, player resolution, per-dart markers and permissions.
-- Read-only equivalence: all 16 events / all 188 Misfire count rows unchanged.
-- Rollback: supabase/rollbacks/sc063_achievement_history_performance.sql.
create or replace view private.v_bounce_out_misfire_events as
 WITH off_games AS MATERIALIZED (
         SELECT g.id,
            g.created_at,
            g.state
           FROM v_games_official_clean g
          WHERE g.finished = true AND COALESCE(g.is_tiebreak, false) = false AND COALESCE(g.player_count, 0) >= 2 AND g.state ? 'board'::text AND g.state @? '$.board[*][*].darts[*] ? (@.bounceOut == true || @.bounceOut == "true")'::jsonpath
        ), darts AS MATERIALIZED (
         SELECT g.id AS game_id,
            g.created_at AS event_at,
            res.player_id,
            (pl.ord - 1)::integer AS player_index,
            (rnd.ord - 1)::integer AS round_index,
            (d.ord - 1)::integer AS dart_index,
            d.val AS dart
           FROM off_games g
             CROSS JOIN LATERAL jsonb_array_elements(g.state -> 'board'::text) WITH ORDINALITY pl(val, ord)
             CROSS JOIN LATERAL jsonb_array_elements(pl.val) WITH ORDINALITY rnd(val, ord)
             CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rnd.val -> 'darts'::text, '[]'::jsonb)) WITH ORDINALITY d(val, ord)
             JOIN v_name_resolver res ON res.nm = lower(TRIM(BOTH FROM ((g.state -> 'players'::text) -> (pl.ord - 1)::integer) ->> 'name'::text))
        )
 SELECT game_id,
    player_id,
    event_at,
    'bounce_out'::text AS code,
    '-1'::integer AS penalty
   FROM darts
  WHERE (dart ->> 'bounceOut'::text) = 'true'::text;
