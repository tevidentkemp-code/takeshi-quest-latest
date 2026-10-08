-- SC-063 rounds source: forward; only public.v_ach_rounds is replaced.
-- Captured PG17 source SHA-256: be18c389f58aadad4c32e1d8911be6741dd66dbc3f1450003e398ca32ccbd80d.
-- Recovery: supabase/rollbacks/sc063_rounds_single_expansion.sql.
-- Guarded transaction; no data, grants, RLS, helper, role-timeout or client changes.
-- The candidate canonical hash was locally deparsed and must match PG17 exactly;
-- an unexpected server canonical form aborts the whole transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public, pg_temp;

-- Acquire the view's compatible read lock without evaluating history rows.
-- Hold it across validation/replacement to exclude concurrent view DDL.
SELECT 1 FROM public.v_ach_rounds WHERE false;

DO $sc063_rounds$
DECLARE
  before_object jsonb;
  after_object jsonb;
  observed_hash text;
  changed_metadata jsonb;
  expected_contract constant jsonb := '{"relkind":"v","owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","reloptions":["security_invoker=true"],"relrowsecurity":false,"relforcerowsecurity":false,"columns":[{"acl":null,"name":"game_id","type":"uuid"},{"acl":null,"name":"match_id","type":"uuid"},{"acl":null,"name":"is_tiebreak","type":"boolean"},{"acl":null,"name":"pidx","type":"integer"},{"acl":null,"name":"player_id","type":"uuid"},{"acl":null,"name":"ridx","type":"integer"},{"acl":null,"name":"target","type":"integer"},{"acl":null,"name":"rmax","type":"integer"},{"acl":null,"name":"rtot","type":"integer"},{"acl":null,"name":"trebles","type":"integer"},{"acl":null,"name":"doubles","type":"integer"},{"acl":null,"name":"singles","type":"integer"},{"acl":null,"name":"bull50","type":"integer"},{"acl":null,"name":"misses","type":"integer"},{"acl":null,"name":"ndarts","type":"integer"},{"acl":null,"name":"bull_any","type":"integer"}]}'::jsonb;
BEGIN
  SELECT jsonb_build_object(
      'oid', c.oid,
      'relkind', c.relkind,
      'owner', pg_get_userbyid(c.relowner),
      'relacl', c.relacl::text,
      'reloptions', c.reloptions,
      'relrowsecurity', c.relrowsecurity,
      'relforcerowsecurity', c.relforcerowsecurity,
      'columns', (SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
          'acl', a.attacl::text) ORDER BY a.attnum)
        FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
      'column_attributes', (SELECT jsonb_agg(jsonb_build_object(
          'num', a.attnum, 'not_null', a.attnotnull, 'identity', a.attidentity,
          'generated', a.attgenerated, 'collation', a.attcollation) ORDER BY a.attnum)
        FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
      'relation_dependencies', (SELECT jsonb_agg(jsonb_build_object(
          'relation', d.refobjid, 'column', d.refobjsubid, 'kind', d.deptype)
          ORDER BY d.refobjid, d.refobjsubid, d.deptype)
        FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid
        WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
          AND r.ev_class = c.oid AND d.refobjid <> c.oid))
    INTO before_object
    FROM pg_class c WHERE c.oid = 'public.v_ach_rounds'::regclass;

  IF (before_object - ARRAY['oid', 'column_attributes', 'relation_dependencies'])
       IS DISTINCT FROM expected_contract
     OR encode(sha256(convert_to(pg_get_viewdef('public.v_ach_rounds'::regclass, true), 'UTF8')), 'hex')
       IS DISTINCT FROM 'be18c389f58aadad4c32e1d8911be6741dd66dbc3f1450003e398ca32ccbd80d' THEN
    RAISE EXCEPTION 'SC063 rounds forward refused: definition or security/column contract drift';
  END IF;

  EXECUTE $sc063_view$CREATE OR REPLACE VIEW public.v_ach_rounds WITH (security_invoker=true) AS
WITH base AS (
         SELECT g.id AS game_id,
            g.match_id,
            COALESCE(g.is_tiebreak, false) AS is_tiebreak,
            (pl.ord - 1)::integer AS pidx,
            (rnd.ord - 1)::integer AS ridx,
            rnd.val AS rj,
            lower(TRIM(BOTH FROM ((g.state -> 'players'::text) -> (pl.ord - 1)::integer) ->> 'name'::text)) AS pname
           FROM games g
             CROSS JOIN LATERAL jsonb_array_elements(g.state -> 'board'::text) WITH ORDINALITY pl(val, ord)
             CROSS JOIN LATERAL jsonb_array_elements(pl.val) WITH ORDINALITY rnd(val, ord)
          WHERE g.finished = true AND COALESCE(g.is_practice, false) = false AND (COALESCE(g.state ->> 'gameMode'::text, g.state ->> 'mode'::text, ''::text) <> ALL (ARRAY['turbo'::text, 'practice'::text])) AND g.state ? 'board'::text
        )
 SELECT b.game_id,
    b.match_id,
    b.is_tiebreak,
    b.pidx,
    res.player_id,
    b.ridx,
        CASE
            WHEN b.ridx <= 10 THEN 10 + b.ridx
            ELSE NULL::integer
        END AS target,
        CASE
            WHEN b.ridx <= 10 THEN 9 * (10 + b.ridx)
            WHEN b.ridx = 11 THEN 120
            WHEN b.ridx = 12 THEN 180
            WHEN b.ridx = 13 THEN 150
            ELSE NULL::integer
        END AS rmax,
    stats.rtot,
    stats.trebles,
    stats.doubles,
    stats.singles,
    stats.bull50,
    stats.misses,
    stats.ndarts,
    stats.bull_any
   FROM base b
     JOIN v_name_resolver res ON res.nm = b.pname
     CROSS JOIN LATERAL (
 WITH darts AS MATERIALIZED (
     SELECT d.value
       FROM jsonb_array_elements(b.rj -> 'darts'::text) d(value)
 )
 SELECT
    COALESCE((b.rj ->> 'roundTotal'::text)::integer, 0) AS rtot,
    (( SELECT count(*) AS count
           FROM darts d
          WHERE (d.value ->> 'kind'::text) = ANY (ARRAY['T'::text, 'Triple'::text])))::integer AS trebles,
    (( SELECT count(*) AS count
           FROM darts d
          WHERE (d.value ->> 'kind'::text) = ANY (ARRAY['D'::text, 'Double'::text])))::integer AS doubles,
    (( SELECT count(*) AS count
           FROM darts d
          WHERE (d.value ->> 'kind'::text) = 'S'::text))::integer AS singles,
    (( SELECT count(*) AS count
           FROM darts d
          WHERE ((d.value ->> 'kind'::text) = ANY (ARRAY['B'::text, 'Bull'::text])) AND ((d.value ->> 'points'::text)::integer) = 50))::integer AS bull50,
    (( SELECT count(*) AS count
           FROM darts d
          WHERE COALESCE(d.value ->> 'kind'::text, 'Miss'::text) = 'Miss'::text OR COALESCE((d.value ->> 'points'::text)::integer, 0) = 0))::integer AS misses,
    (( SELECT count(*) AS count
           FROM darts d))::integer AS ndarts,
    (( SELECT count(*) AS count
           FROM darts d
          WHERE (d.value ->> 'kind'::text) = ANY (ARRAY['B'::text, 'Bull'::text])))::integer AS bull_any
     ) stats;
$sc063_view$;

  SELECT jsonb_build_object(
      'oid', c.oid,
      'relkind', c.relkind,
      'owner', pg_get_userbyid(c.relowner),
      'relacl', c.relacl::text,
      'reloptions', c.reloptions,
      'relrowsecurity', c.relrowsecurity,
      'relforcerowsecurity', c.relforcerowsecurity,
      'columns', (SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
          'acl', a.attacl::text) ORDER BY a.attnum)
        FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
      'column_attributes', (SELECT jsonb_agg(jsonb_build_object(
          'num', a.attnum, 'not_null', a.attnotnull, 'identity', a.attidentity,
          'generated', a.attgenerated, 'collation', a.attcollation) ORDER BY a.attnum)
        FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
      'relation_dependencies', (SELECT jsonb_agg(jsonb_build_object(
          'relation', d.refobjid, 'column', d.refobjsubid, 'kind', d.deptype)
          ORDER BY d.refobjid, d.refobjsubid, d.deptype)
        FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid
        WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
          AND r.ev_class = c.oid AND d.refobjid <> c.oid))
    INTO after_object
    FROM pg_class c WHERE c.oid = 'public.v_ach_rounds'::regclass;

  observed_hash := encode(sha256(convert_to(pg_get_viewdef('public.v_ach_rounds'::regclass, true), 'UTF8')), 'hex');
  SELECT COALESCE(jsonb_object_agg(COALESCE(b.key, a.key), jsonb_build_object('expected', b.value, 'observed', a.value)), '{}'::jsonb)
    INTO changed_metadata
    FROM jsonb_each(before_object) b FULL JOIN jsonb_each(after_object) a USING (key)
    WHERE b.value IS DISTINCT FROM a.value;

  IF after_object IS DISTINCT FROM before_object
     OR observed_hash IS DISTINCT FROM '341c072314ec410da7e898caca61271601596ca57e9a6d4466154de3871d41e2' THEN
    RAISE EXCEPTION 'SC063 rounds forward refused: post-replacement definition, identity, permissions or dependencies differ'
      USING DETAIL = format('expected_definition_sha256=%s observed_definition_sha256=%s changed_metadata=%s',
        '341c072314ec410da7e898caca61271601596ca57e9a6d4466154de3871d41e2', observed_hash, changed_metadata);
  END IF;
END
$sc063_rounds$;
COMMIT;
