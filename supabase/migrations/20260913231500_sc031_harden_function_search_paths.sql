-- SC-031 security hardening: pin search_path on existing database functions.
-- Behaviour-preserving only: no function bodies, grants, policies or data change.

begin;

alter function api.get_vs(text)
  set search_path = pg_catalog, api, public;

alter function public.fn_push_high_scores()
  set search_path = pg_catalog, public;

alter function public.match_players_autolink()
  set search_path = pg_catalog, public;

alter function public.rename_player_merge(text, text)
  set search_path = pg_catalog, public;

alter function public.merge_player_name_everywhere(text, text)
  set search_path = pg_catalog, public;

alter function public.players_rename_merge_trigger()
  set search_path = pg_catalog, public;

alter function public.sq_rank_score(text, integer)
  set search_path = pg_catalog, public;

alter function public.log_player_go(uuid, uuid, integer, integer, uuid, timestamptz, timestamptz, text, boolean, text)
  set search_path = pg_catalog, public;

alter function public.log_player_go(uuid, uuid, integer, integer, timestamptz, timestamptz)
  set search_path = pg_catalog, public;

alter function public.sq_safe_bool(text)
  set search_path = pg_catalog, public;

alter function public.sq_safe_int(text)
  set search_path = pg_catalog, public;

alter function public.sq_safe_numeric(text)
  set search_path = pg_catalog, public;

alter function public.sq_jsonb_array_length_safe(jsonb)
  set search_path = pg_catalog, public;

alter function public.sq_round_json_played(jsonb)
  set search_path = pg_catalog, public;

alter function public.sq_game_is_legacy_turbo_board(jsonb)
  set search_path = pg_catalog, public;

alter function public.sq_round_json_score(jsonb)
  set search_path = pg_catalog, public;

commit;
