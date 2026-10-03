-- Restricted-safe recovery. Execute only through the owner-controlled SQL route.
-- The broad anonymous policies/grants are never restored. Credential lifetime is
-- paused for controllers valid when held; accepted games/receipts are untouched.
BEGIN;
SELECT public.sq_sc004_set_hold(true);
-- These checks fail if either clients regained write authority or an unchecked
-- RPC/view bypass appeared while the operational rollback was being performed.
DO $check$
DECLARE r text; x record;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOR x IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND (c.relkind='r' OR c.relname='v_games_visible') LOOP
      IF has_table_privilege(r,x.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN RAISE EXCEPTION 'SC004 restricted recovery blocked by client mutation: %.%',r,x.relname; END IF;
    END LOOP;
    IF has_function_privilege(r,'public.sq_sc004_command(text,text,jsonb,text,uuid,uuid)','EXECUTE')
       OR has_function_privilege(r,'public.log_player_go(uuid,uuid,integer,integer,timestamp with time zone,timestamp with time zone)','EXECUTE')
       OR has_function_privilege(r,'public.sq_sc004_admin(jsonb,uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'SC004 restricted recovery blocked by RPC bypass'; END IF;
  END LOOP;
END $check$;
COMMIT;
-- Then serve the last verified compatible secure app+Edge anchor. Retain the
-- capability registry, private slots, training scopes, pending queues and receipts.
-- After Auth/Edge/PostgREST/Realtime positive+negative checks pass, release hold:
-- SELECT public.sq_sc004_set_hold(false);
-- Resume the same credentials; do not adopt a public ID/name or replace history.
