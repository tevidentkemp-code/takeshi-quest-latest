-- Restricted-safe recovery. Execute only through the owner-controlled SQL route.
-- Commit the hold before checking authority. A failed check must leave writes held.
-- Controller lifetime pauses without changing accepted games or receipts.
BEGIN;
SELECT public.sq_sc004_set_hold(true);
COMMIT;
BEGIN;
DO $check$
DECLARE r text; x record;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOR x IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND (c.relkind='r' OR c.relname='v_games_visible') LOOP
      IF has_table_privilege(r,x.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN
        RAISE EXCEPTION 'SC004 restricted recovery blocked by client mutation: %.%',r,x.relname;
      END IF;
    END LOOP;
    FOR x IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('players_archive_id_seq','high_scores_id_seq','high_scores_sp_id_seq','game_events_id_seq') LOOP
      IF has_sequence_privilege(r,x.oid,'USAGE,UPDATE') THEN
        RAISE EXCEPTION 'SC004 restricted recovery blocked by sequence authority: %.%',r,x.relname;
      END IF;
    END LOOP;
    FOR x IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN (
        'check_pin','log_player_go','merge_player_name_everywhere','refresh_stat_matviews','rename_player_merge',
        'sq_admin_archive_game','sq_admin_authorize','sq_admin_delete_high_score','sq_admin_game_maintenance',
        'sq_admin_log_action','sq_admin_login','sq_admin_logout','sq_admin_purge_game','sq_admin_reinstate_game',
        'fn_push_high_scores','match_players_autolink','players_rename_merge_trigger',
        'sq_sc004_admin','sq_sc004_authorize_game','sq_sc004_command','sq_sc004_commentary_claim',
        'sq_sc004_commentary_commit','sq_sc004_prune_expired_empty','sq_sc004_set_hold') LOOP
      IF has_function_privilege(r,x.oid,'EXECUTE') THEN
        RAISE EXCEPTION 'SC004 restricted recovery blocked by RPC authority: %.%',r,x.proname;
      END IF;
    END LOOP;
    IF has_schema_privilege(r,'private','USAGE') THEN
      RAISE EXCEPTION 'SC004 restricted recovery blocked by private schema authority: %',r;
    END IF;
    FOR x IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='private' AND left(c.relname,6)='sc004_' AND c.relkind='r' LOOP
      IF has_table_privilege(r,x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN
        RAISE EXCEPTION 'SC004 restricted recovery blocked by private authority: %.%',r,x.relname;
      END IF;
    END LOOP;
  END LOOP;
  IF to_regprocedure('public.log_player_go(uuid,uuid,integer,integer,uuid,timestamp with time zone,timestamp with time zone,text,boolean,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'SC004 restricted recovery blocked by retired RPC';
  END IF;
END $check$;
COMMIT;
-- Then serve the last verified compatible secure app and Edge anchor. Retain the
-- capability registry, private slots, training scopes, pending queues and receipts.
-- After Auth/Edge/PostgREST/Realtime positive and negative checks pass, release hold:
-- SELECT public.sq_sc004_set_hold(false);
-- Resume the same credentials; do not adopt a public ID/name or replace history.
