-- Exact pre-SC-063 helper definition captured from live Supabase.
create or replace view private.v_bounce_out_misfire_events as
 WITH off_games AS MATERIALIZED (
         SELECT g.id,
            g.created_at,
            g.state
           FROM v_games_official_clean g
          WHERE g.finished = true AND COALESCE(g.is_tiebreak, false) = false AND COALESCE(g.player_count, 0) >= 2 AND g.state ? 'board'::text
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

-- Exact classifier helper captured read-only from live Supabase 2026-10-02.
CREATE OR REPLACE FUNCTION public.sq_game_is_legacy_turbo_board(p_state jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  st jsonb := coalesce(p_state, '{}'::jsonb);
  board jsonb;
  board_len integer := 0;
  player_len integer := 0;
  player_board jsonb;
  round_json jsonb;
  player_entry jsonb;
  round_idx integer;
  early_played boolean := false;
  late_played boolean := false;
  player_major boolean := false;
begin
  board := coalesce(st->'board', st->'score', '[]'::jsonb);

  if jsonb_typeof(board) <> 'array' then
    return false;
  end if;

  board_len := public.sq_jsonb_array_length_safe(board);
  player_len := public.sq_jsonb_array_length_safe(st->'players');

  if board_len = 0 then
    return false;
  end if;

  player_major := (player_len > 0 and board_len = player_len) or board_len < 14;

  if player_major then
    for player_board in
      select value
      from jsonb_array_elements(board)
    loop
      if jsonb_typeof(player_board) <> 'array' then
        continue;
      end if;

      for round_idx in 0..13 loop
        round_json := player_board->round_idx;

        if public.sq_round_json_played(round_json) then
          if round_idx between 0 and 6 then
            early_played := true;
          elsif round_idx between 7 and 13 then
            late_played := true;
          end if;
        end if;
      end loop;
    end loop;
  else
    for round_idx in 0..13 loop
      round_json := board->round_idx;

      if jsonb_typeof(round_json) = 'array' then
        for player_entry in
          select value
          from jsonb_array_elements(round_json)
        loop
          if public.sq_round_json_played(player_entry) then
            if round_idx between 0 and 6 then
              early_played := true;
            elsif round_idx between 7 and 13 then
              late_played := true;
            end if;
          end if;
        end loop;
      else
        if public.sq_round_json_played(round_json) then
          if round_idx between 0 and 6 then
            early_played := true;
          elsif round_idx between 7 and 13 then
            late_played := true;
          end if;
        end if;
      end if;
    end loop;
  end if;

  return late_played and not early_played;
exception when others then
  return false;
end;
$function$;
