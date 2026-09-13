-- SC-031 security hardening: active application views proven under anon role
-- in transactional dry runs with security_invoker=true.
-- Scope is intentionally limited to current app-facing views.

begin;

alter view public.v_player_games_union_visible set (security_invoker=true);
alter view public.v_pb_by_player_round_clean_app set (security_invoker=true);
alter view public.v_wr_by_round_clean_app set (security_invoker=true);
alter view public.v_round_high_scores_modal set (security_invoker=true);
alter view public.v_top50_scores_official set (security_invoker=true);
alter view public.v_power_rankings_last56_official_clean set (security_invoker=true);

alter view public.v_player_game_scores_official_clean set (security_invoker=true);
alter view public.v_round_high_scores_turbo_clean_app set (security_invoker=true);
alter view public.v_round_high_scores_official_clean_app set (security_invoker=true);
alter view public.v_games_mode_classified set (security_invoker=true);
alter view public.v_training_player_summary set (security_invoker=true);
alter view public.v_player_last30_target_rates set (security_invoker=true);

alter view public.v_player_achievements set (security_invoker=true);
alter view public.v_player_base_xp set (security_invoker=true);
alter view public.v_ach_rounds set (security_invoker=true);
alter view public.v_player_xp set (security_invoker=true);
alter view public.v_ach_base set (security_invoker=true);
alter view public.v_ach_david_goliath set (security_invoker=true);
alter view public.v_top50_scores_practice set (security_invoker=true);

commit;
