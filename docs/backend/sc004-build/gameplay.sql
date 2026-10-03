-- SC-004 deployable additive authority. Apply before closure.sql in one reviewed migration.
-- Fresh preflight belongs first; no production activation is implied by this source.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.sc004_controllers (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  mode text NOT NULL CHECK (mode IN ('official','practice','turbo','vs_shadow')),
  single_game boolean NOT NULL DEFAULT false,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(rules)='object'),
  roster jsonb NOT NULL CHECK (jsonb_typeof(roster) = 'array'),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '24 hours',
  revoked_at timestamptz
);
CREATE TABLE private.sc004_slots (
  game_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES private.sc004_controllers(match_id) ON DELETE CASCADE,
  game_number integer NOT NULL CHECK (game_number BETWEEN 1 AND 99),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cleaned')),
  payload jsonb,
  receipt jsonb,
  UNIQUE(match_id, game_number)
);
CREATE TABLE private.sc004_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  enabled boolean NOT NULL DEFAULT false,
  revoked_at timestamptz
);
CREATE TABLE private.sc004_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  action text NOT NULL,
  object_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.sc004_requests (
  request_id uuid PRIMARY KEY,
  issue_hash text NOT NULL,
  receipt jsonb NOT NULL
);
CREATE TABLE private.sc004_write_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  held boolean NOT NULL DEFAULT true
);
INSERT INTO private.sc004_write_control(singleton,held) VALUES(true,true);
ALTER TABLE private.sc004_controllers ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_write_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.sc004_controllers,private.sc004_slots,private.sc004_admins,
  private.sc004_admin_audit,private.sc004_requests,private.sc004_write_control FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.sc004_admin_audit_id_seq FROM PUBLIC, anon, authenticated;

-- Every gameplay write resolves the registry again and locks the controller.
-- A public match/game/player UUID, public SELECT, or authenticated role is never
-- a controller proof. Unknown, revoked and expired hashes share one denial.
CREATE OR REPLACE FUNCTION private.sc004_assert_controller(p_hash text, p_match uuid)
RETURNS private.sc004_controllers LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private AS $f$
DECLARE c private.sc004_controllers;
BEGIN
  SELECT * INTO c FROM private.sc004_controllers
   WHERE token_hash = p_hash AND match_id = p_match FOR UPDATE;
  IF NOT FOUND OR c.revoked_at IS NOT NULL OR c.expires_at <= private.sc004_controller_now() THEN
    RAISE EXCEPTION 'controller denied' USING ERRCODE = '42501';
  END IF;
  RETURN c;
END $f$;
REVOKE ALL ON FUNCTION private.sc004_assert_controller(text,uuid) FROM PUBLIC, anon, authenticated;

CREATE TABLE private.sc004_public_requests(request_id uuid PRIMARY KEY,action text NOT NULL,body jsonb NOT NULL,receipt jsonb NOT NULL);
CREATE TABLE private.sc004_training_controls(
  training_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),token_hash text UNIQUE NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  player_name text NOT NULL,player_id uuid,mode text NOT NULL,length integer NOT NULL,config jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',revoked_at timestamptz,payload jsonb,receipt jsonb
);
CREATE TABLE private.sc004_commentary_claims(
  game_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('studio_intro','studio_outro')),
  claim_id uuid NOT NULL DEFAULT gen_random_uuid(),actor_hash text,admin_user uuid,admin_session uuid,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',PRIMARY KEY(game_id,kind)
);
ALTER TABLE private.sc004_public_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_training_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sc004_commentary_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.sc004_public_requests,private.sc004_training_controls,private.sc004_commentary_claims FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.sc004_validate_rules(p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $f$
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>8192
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('gameFormat','gameVariant','tournament','tournamentType','tournamentRules','strictTimer','throwLimitSeconds','startTarget'))
    OR (p ? 'gameFormat' AND (jsonb_typeof(p->'gameFormat') IS DISTINCT FROM 'string' OR p->>'gameFormat' NOT IN ('match_play')))
    OR (p ? 'gameVariant' AND (jsonb_typeof(p->'gameVariant') IS DISTINCT FROM 'string' OR p->>'gameVariant' NOT IN ('classic','turbo')))
    OR (p ? 'startTarget' AND (jsonb_typeof(p->'startTarget') NOT IN ('number','string') OR p->>'startTarget' NOT IN ('10','17')))
    OR (p ? 'throwLimitSeconds' AND p->'throwLimitSeconds'<>'null'::jsonb AND p->>'throwLimitSeconds'<>'20')
    OR (p ? 'tournament' AND jsonb_typeof(p->'tournament')<>'boolean')
    OR (p ? 'strictTimer' AND jsonb_typeof(p->'strictTimer')<>'boolean')
    OR (p ? 'tournamentRules' AND jsonb_typeof(p->'tournamentRules')<>'object') THEN
    RAISE EXCEPTION 'invalid rules' USING ERRCODE='22023';
  END IF;
END $f$;
REVOKE ALL ON FUNCTION private.sc004_validate_rules(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.sc004_training(p_action text,p_hash text,p_body jsonb,p_issue text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $f$
<<training>>
DECLARE t private.sc004_training_controls; p jsonb; r jsonb; d jsonb; receipt jsonb; saved public.players;
  n integer; points integer:=0; hits integer:=0; darts integer:=0; row_points integer; row_hits integer; target integer; section text; rid uuid:=(p_body->>'request_id')::uuid;
BEGIN
  IF p_action='create_training' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','player','mode','length','config')) OR coalesce(p_issue,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid training initiation' USING ERRCODE='22023'; END IF;
    SELECT x.receipt INTO receipt FROM private.sc004_requests x WHERE x.request_id=rid AND x.issue_hash=p_issue;
    IF FOUND THEN
      PERFORM 1 FROM private.sc004_training_controls WHERE training_id=(training.receipt->>'training_id')::uuid
        AND token_hash=p_issue AND revoked_at IS NULL AND expires_at>private.sc004_controller_now() FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'training issuance no longer live' USING ERRCODE='42501'; END IF;
      RETURN receipt;
    END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_requests WHERE request_id=rid) THEN RAISE EXCEPTION 'request conflict' USING ERRCODE='23505'; END IF;
    p:=p_body->'player';
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('id','name')) OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(trim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 80
      OR coalesce(p_body->>'mode','') NOT IN ('standard','tdb','select') OR coalesce((p_body->>'length')::integer,-1) NOT IN (0,10,15)
      OR jsonb_typeof(p_body->'config') IS DISTINCT FROM 'object' OR octet_length((p_body->'config')::text)>8192 THEN RAISE EXCEPTION 'invalid training setup' USING ERRCODE='22023'; END IF;
    IF p->>'id' IS NOT NULL THEN SELECT * INTO saved FROM public.players WHERE id=(p->>'id')::uuid AND deleted_at IS NULL; IF NOT FOUND OR saved.name<>p->>'name' THEN RAISE EXCEPTION 'unknown training player' USING ERRCODE='22023'; END IF; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body->'config') k WHERE k<>'targets') THEN RAISE EXCEPTION 'invalid training config' USING ERRCODE='22023'; END IF;
    IF p_body->>'mode'='select' THEN
      IF jsonb_typeof(p_body->'config'->'targets') IS DISTINCT FROM 'array' OR jsonb_array_length(p_body->'config'->'targets') NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid selected targets' USING ERRCODE='22023'; END IF;
      FOR r IN SELECT value FROM jsonb_array_elements(p_body->'config'->'targets') LOOP
        IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT(r ?& ARRAY['kind','req']) OR jsonb_typeof(r->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'req') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('kind','n','req')) OR r->>'kind' NOT IN ('number','bull') OR jsonb_typeof(r->'req') IS DISTINCT FROM 'string' OR r->>'req' NOT IN ('any','single','double','treble','bull') OR (r->>'kind'='number' AND (jsonb_typeof(r->'n') IS DISTINCT FROM 'number' OR coalesce(r->>'n','') !~ '^[0-9]+$' OR (r->>'n')::integer NOT BETWEEN 10 AND 20 OR r->>'req'='bull')) OR (r->>'kind'='bull' AND (r->>'req'<>'bull' OR r ? 'n')) THEN RAISE EXCEPTION 'invalid selected target' USING ERRCODE='22023'; END IF;
      END LOOP;
    ELSIF p_body->'config'<>'{}'::jsonb THEN RAISE EXCEPTION 'unexpected config' USING ERRCODE='22023'; END IF;
    INSERT INTO private.sc004_training_controls(token_hash,player_name,player_id,mode,length,config)
      VALUES(p_issue,trim(p->>'name'),(p->>'id')::uuid,p_body->>'mode',(p_body->>'length')::integer,p_body->'config') RETURNING * INTO t;
    receipt:=jsonb_build_object('ok',true,'training_id',t.training_id,'expires_at',t.expires_at);
    INSERT INTO private.sc004_requests VALUES(rid,p_issue,receipt); RETURN receipt;
  END IF;
  SELECT * INTO t FROM private.sc004_training_controls WHERE training_id=(p_body->>'training_id')::uuid AND token_hash=p_hash FOR UPDATE;
  IF NOT FOUND OR t.revoked_at IS NOT NULL OR t.expires_at<=private.sc004_controller_now() THEN RAISE EXCEPTION 'training controller denied' USING ERRCODE='42501'; END IF;
  IF p_action='resume_training' THEN RETURN jsonb_build_object('ok',true,'training_id',t.training_id,'expires_at',t.expires_at,'receipt',t.receipt); END IF;
  IF p_action='renew_training' THEN UPDATE private.sc004_training_controls SET expires_at=clock_timestamp()+interval '24 hours' WHERE training_id=t.training_id RETURNING * INTO t; RETURN jsonb_build_object('ok',true,'training_id',t.training_id,'expires_at',t.expires_at); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','training_id','payload')) THEN RAISE EXCEPTION 'invalid training envelope' USING ERRCODE='22023'; END IF;
  p:=p_body->'payload';
  IF t.receipt IS NOT NULL THEN IF t.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'training retry conflict' USING ERRCODE='23505'; END IF; RETURN t.receipt; END IF;
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT(p ?& ARRAY['player_name','mode','length','rounds_played','config','results','total_points','total_darts','total_hits','hit_pct']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('player_name','mode','length','rounds_played','config','results','total_points','total_darts','total_hits','hit_pct'))
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['length','rounds_played','total_points','total_darts','total_hits']) k WHERE jsonb_typeof(p->k) IS DISTINCT FROM 'number' OR coalesce(p->>k,'') !~ '^[0-9]+$') OR jsonb_typeof(p->'hit_pct') IS DISTINCT FROM 'number'
    OR p->>'player_name' IS DISTINCT FROM t.player_name OR p->>'mode' IS DISTINCT FROM t.mode OR (p->>'length')::integer IS DISTINCT FROM t.length OR p->'config' IS DISTINCT FROM t.config
    OR jsonb_typeof(p->'results')<>'array' OR jsonb_array_length(p->'results')<1 OR (t.length>0 AND jsonb_array_length(p->'results')>t.length) OR (p->>'rounds_played')::integer IS DISTINCT FROM jsonb_array_length(p->'results') THEN RAISE EXCEPTION 'invalid training scope' USING ERRCODE='22023'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p->'results') LOOP
    IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT(r ?& ARRAY['target','req','darts','hits','points']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('target','req','darts','hits','points')) OR jsonb_typeof(r->'darts')<>'array' OR jsonb_array_length(r->'darts') NOT BETWEEN 1 AND 3 OR jsonb_typeof(r->'req') IS DISTINCT FROM 'string' OR r->>'req' NOT IN ('any','single','double','treble','dt','bull')
      OR (r->>'target'<>'bull' AND (jsonb_typeof(r->'target') IS DISTINCT FROM 'number' OR coalesce(r->>'target','') !~ '^[0-9]+$' OR (r->>'target')::integer NOT BETWEEN 10 AND 20)) OR r->>'target' IS NULL OR jsonb_typeof(r->'points') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'hits') IS DISTINCT FROM 'number' OR (r->>'points')::integer NOT BETWEEN 0 AND 180 OR (r->>'hits')::integer NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'invalid training result' USING ERRCODE='22023'; END IF;
    IF t.mode='select' THEN
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.config->'targets') chosen WHERE chosen->>'req'=r->>'req' AND ((chosen->>'kind'='bull' AND r->>'target'='bull') OR (chosen->>'kind'='number' AND chosen->>'n'=r->>'target'))) THEN RAISE EXCEPTION 'training target not issued' USING ERRCODE='22023'; END IF;
    ELSIF (t.mode='standard' AND (r->>'target'='bull' OR r->>'req'<>'any')) OR (t.mode='tdb' AND ((r->>'target'='bull' AND r->>'req'<>'bull') OR (r->>'target'<>'bull' AND r->>'req'<>'dt'))) THEN RAISE EXCEPTION 'training target mode mismatch' USING ERRCODE='22023'; END IF;
    row_points:=0; row_hits:=0;
    FOR d IN SELECT value FROM jsonb_array_elements(r->'darts') LOOP
      section:=d#>>'{}';
      IF jsonb_typeof(d) IS DISTINCT FROM 'string' OR section NOT IN ('miss','single','double','treble','b25','bull') THEN RAISE EXCEPTION 'invalid training dart' USING ERRCODE='22023'; END IF;
      IF section='miss' THEN CONTINUE; END IF;
      IF r->>'target'='bull' THEN
        IF section NOT IN ('b25','bull') OR r->>'req'<>'bull' THEN RAISE EXCEPTION 'training bull section mismatch' USING ERRCODE='22023'; END IF;
        row_points:=row_points+CASE WHEN section='bull' THEN 50 ELSE 25 END;
      ELSE
        IF section NOT IN ('single','double','treble') OR (r->>'req'='dt' AND section='single') OR (r->>'req' IN ('single','double','treble') AND section<>r->>'req') OR r->>'req'='bull' THEN RAISE EXCEPTION 'training number section mismatch' USING ERRCODE='22023'; END IF;
        target:=(r->>'target')::integer;
        row_points:=row_points+target*CASE section WHEN 'single' THEN 1 WHEN 'double' THEN 2 ELSE 3 END;
      END IF;
      row_hits:=row_hits+1;
    END LOOP;
    -- Check recorded dartScore output; validation never mutates the client scorer.
    IF (r->>'points')::integer IS DISTINCT FROM row_points OR (r->>'hits')::integer IS DISTINCT FROM row_hits THEN RAISE EXCEPTION 'training dart aggregate mismatch' USING ERRCODE='22023'; END IF;
    points:=points+(r->>'points')::integer; hits:=hits+(r->>'hits')::integer; darts:=darts+jsonb_array_length(r->'darts');
  END LOOP;
  -- Every result includes its actual 1–3 recorded darts, including End Early.
  IF (p->>'total_darts')::integer IS DISTINCT FROM darts OR (p->>'total_hits')::integer IS DISTINCT FROM hits OR (p->>'total_points')::integer IS DISTINCT FROM points
    OR (p->>'total_hits')::integer>(p->>'total_darts')::integer OR (p->>'hit_pct')::numeric IS DISTINCT FROM round(100.0*hits/nullif(darts,0),1) THEN RAISE EXCEPTION 'invalid training aggregates' USING ERRCODE='22023'; END IF;
  INSERT INTO public.training_sessions(id,player_name,mode,length,rounds_played,config,results,total_points,total_darts,total_hits,hit_pct)
    VALUES(t.training_id,t.player_name,t.mode,t.length,(p->>'rounds_played')::integer,t.config,p->'results',(p->>'total_points')::integer,(p->>'total_darts')::integer,(p->>'total_hits')::integer,(p->>'hit_pct')::numeric);
  receipt:=jsonb_build_object('ok',true,'training_id',t.training_id,'id',t.training_id);
  UPDATE private.sc004_training_controls SET payload=p,receipt=training.receipt WHERE training_id=t.training_id;
  RETURN receipt;
END $f$;
REVOKE ALL ON FUNCTION private.sc004_training(text,text,jsonb,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.sc004_append_event(c private.sc004_controllers,s private.sc004_slots,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $f$
DECLARE player jsonb; e jsonb:=p->'event'; event_id bigint;
BEGIN
  IF s.status<>'completed' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('request_id','match_id','game_id','event')) OR jsonb_typeof(e)<>'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(e) k WHERE k NOT IN ('player_id','round_index','dart_index')) THEN RAISE EXCEPTION 'invalid event' USING ERRCODE='22023'; END IF;
  SELECT value INTO player FROM jsonb_array_elements(s.payload->'state'->'players') WHERE value->>'id'=e->>'player_id';
  IF player IS NULL OR (e->>'round_index')::integer NOT BETWEEN 0 AND 13 OR (e->>'dart_index')::integer NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'event scope denied' USING ERRCODE='42501'; END IF;
  -- Event points/kind come only from the accepted canonical board, never JSON.
  SELECT x.value INTO e FROM jsonb_array_elements(s.payload->'state'->'players') WITH ORDINALITY x(value,i) WHERE x.value->>'id'=p->'event'->>'player_id';
  e:=s.payload->'state'->'board'->((SELECT i::integer-1 FROM jsonb_array_elements(s.payload->'state'->'players') WITH ORDINALITY x(value,i) WHERE x.value->>'id'=player->>'id'))
    ->((p->'event'->>'round_index')::integer)->'darts'->((p->'event'->>'dart_index')::integer);
  IF e='null'::jsonb OR e IS NULL THEN RAISE EXCEPTION 'event dart absent' USING ERRCODE='22023'; END IF;
  SELECT id INTO event_id FROM public.game_events WHERE game_id=s.game_id AND player_id=player->>'id' AND round_index=(p->'event'->>'round_index')::integer AND dart_index=(p->'event'->>'dart_index')::integer LIMIT 1;
  IF event_id IS NULL THEN INSERT INTO public.game_events(game_id,player_id,player_name,round_index,round_label,dart_index,kind,points,meta) VALUES(s.game_id,player->>'id',player->>'name',(p->'event'->>'round_index')::integer,(ARRAY['10','11','12','13','14','15','16','17','18','19','20','Doubles','Triples','Bull'])[(p->'event'->>'round_index')::integer+1],(p->'event'->>'dart_index')::integer,e->>'kind',(e->>'points')::integer,e-'kind'-'points') RETURNING id INTO event_id; END IF;
  RETURN jsonb_build_object('ok',true,'event_id',event_id);
END $f$;
REVOKE ALL ON FUNCTION private.sc004_append_event(private.sc004_controllers,private.sc004_slots,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sq_sc004_command(
  p_action text, p_token_hash text, p_body jsonb,
  p_issue_hash text DEFAULT NULL, p_admin_user uuid DEFAULT NULL,
  p_admin_session uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private AS $f$
<<cmd>>
DECLARE
  c private.sc004_controllers;
  s private.sc004_slots;
  roster jsonb := '[]'::jsonb;
  item jsonb; row_item jsonb; saved public.players;
  mid uuid; gid uuid; uid uuid;
  n integer; i integer; j integer; sum_total integer;
  totals integer[]; mode text; db_mode text; v_wins jsonb; max_total integer; winners integer[];
  board jsonb; clean_state jsonb; receipt jsonb; action text; dart jsonb; dart_total integer;
  rid uuid;
BEGIN
  IF p_body IS NULL OR jsonb_typeof(p_body) <> 'object' THEN
    RAISE EXCEPTION 'object required' USING ERRCODE = '22023';
  END IF;
  rid := (p_body->>'request_id')::uuid;
  IF rid IS NULL THEN RAISE EXCEPTION 'request id required' USING ERRCODE = '22023'; END IF;
  IF p_action NOT IN ('list_roster','resume','resume_training','admin_action') AND coalesce((SELECT held FROM private.sc004_write_control WHERE singleton),true) THEN
    RAISE EXCEPTION 'writes held' USING ERRCODE = '55000';
  END IF;
  -- Serialize retries before checking either issuance receipt table. This avoids
  -- a concurrent identical request observing no receipt and failing uniqueness.
  IF p_action IN ('create_player','create_match','create_training') THEN
    PERFORM pg_advisory_xact_lock(674004,hashtext(rid::text));
  END IF;
  IF p_action = 'create_player' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','name','initials','first_name','last_name','nickname','avatar_id'))
       OR jsonb_typeof(p_body->'name') IS DISTINCT FROM 'string'
       OR EXISTS(SELECT 1 FROM unnest(ARRAY['initials','first_name','last_name','nickname']) k WHERE p_body ? k AND jsonb_typeof(p_body->k) NOT IN ('string','null'))
       OR (p_body ? 'avatar_id' AND p_body->'avatar_id'<>'null'::jsonb AND (jsonb_typeof(p_body->'avatar_id') IS DISTINCT FROM 'number' OR (p_body->>'avatar_id')::integer NOT BETWEEN 1 AND 32))
       OR length(trim(coalesce(p_body->>'name',''))) NOT BETWEEN 1 AND 80
       OR length(coalesce(p_body->>'initials','')) > 5
       OR length(coalesce(p_body->>'first_name','')) > 80
       OR length(coalesce(p_body->>'last_name','')) > 80
       OR length(coalesce(p_body->>'nickname','')) > 80 THEN
      RAISE EXCEPTION 'invalid player registration' USING ERRCODE = '22023';
    END IF;
    SELECT r.receipt INTO receipt FROM private.sc004_public_requests r WHERE r.request_id=rid AND r.action=p_action AND r.body=p_body-'request_id';
    IF FOUND THEN RETURN receipt; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_public_requests WHERE request_id=rid) THEN RAISE EXCEPTION 'request conflict' USING ERRCODE='23505'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(lower(trim(p_body->>'name'))));
    IF EXISTS(SELECT 1 FROM public.players WHERE lower(name)=lower(trim(p_body->>'name'))) THEN
      RAISE EXCEPTION 'player name already exists' USING ERRCODE='23505';
    END IF;
    -- Deliberately INSERT-only. A name conflict must never overwrite a profile.
    INSERT INTO public.players(name,initials,first_name,last_name,nickname,avatar_id)
    VALUES(trim(p_body->>'name'),p_body->>'initials',p_body->>'first_name',p_body->>'last_name',p_body->>'nickname',(p_body->>'avatar_id')::smallint)
    RETURNING * INTO saved;
    receipt := jsonb_build_object('ok',true,'id',saved.id,'name',saved.name,'initials',saved.initials,'avatar_id',saved.avatar_id);
    INSERT INTO private.sc004_public_requests VALUES(rid,p_action,p_body-'request_id',receipt);
    RETURN receipt;
  END IF;
  IF p_action = 'create_match' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','mode','roster','target_wins','match_format','rules'))
       OR coalesce(p_issue_hash,'') !~ '^[a-f0-9]{64}$'
       OR p_token_hash IS NOT NULL THEN
      RAISE EXCEPTION 'invalid match initiation' USING ERRCODE = '22023';
    END IF;
    SELECT r.receipt INTO receipt FROM private.sc004_requests r WHERE r.request_id=rid AND r.issue_hash=p_issue_hash;
    IF FOUND THEN
      PERFORM 1 FROM private.sc004_controllers WHERE match_id=(receipt->>'match_id')::uuid
        AND token_hash=p_issue_hash AND revoked_at IS NULL AND expires_at>private.sc004_controller_now() FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'match issuance no longer live' USING ERRCODE='42501'; END IF;
      RETURN receipt;
    END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_requests r WHERE r.request_id=rid) THEN
      RAISE EXCEPTION 'match initiation request already consumed' USING ERRCODE = '23505';
    END IF;
    mode := p_body->>'mode';
    IF mode IS NULL OR mode NOT IN ('official','practice','turbo','vs_shadow') OR jsonb_typeof(p_body->'roster') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid mode or roster' USING ERRCODE = '22023';
    END IF;
    n := jsonb_array_length(p_body->'roster');
    IF n > 5 OR n < (CASE WHEN mode IN ('official','turbo') THEN 2 ELSE 1 END) OR (mode='vs_shadow' AND n<>1)
       OR coalesce((p_body->>'target_wins')::integer,1) NOT IN (1,3,5)
       OR coalesce(p_body->>'match_format','series') NOT IN ('series','single')
       OR (mode='vs_shadow' AND coalesce(p_body->>'match_format','single')<>'single') THEN
      RAISE EXCEPTION 'invalid player count or match format' USING ERRCODE = '22023';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_body->'roster') LOOP
      IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','name')) THEN
        RAISE EXCEPTION 'invalid roster entry' USING ERRCODE = '22023';
      END IF;
      IF item->>'id' IS NOT NULL THEN
        SELECT * INTO saved FROM public.players WHERE id = (item->>'id')::uuid AND deleted_at IS NULL;
        IF NOT FOUND OR (item->>'name' IS NOT NULL AND item->>'name' <> saved.name) THEN
          RAISE EXCEPTION 'unknown player or display name mismatch' USING ERRCODE = '22023';
        END IF;
        roster := roster || jsonb_build_array(jsonb_build_object('id',saved.id,'name',saved.name));
      ELSE
        IF mode='official' OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR length(trim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 80
           OR lower(trim(item->>'name')) IN ('shadow','vs shadow') THEN
          RAISE EXCEPTION 'guest not eligible for this mode' USING ERRCODE = '22023';
        END IF;
        roster := roster || jsonb_build_array(jsonb_build_object('id',NULL,'name',trim(item->>'name')));
      END IF;
    END LOOP;
    IF (SELECT count(DISTINCT lower(value->>'name')) FROM jsonb_array_elements(roster)) <> n THEN
      RAISE EXCEPTION 'duplicate roster entry' USING ERRCODE = '22023';
    END IF;
    PERFORM private.sc004_validate_rules(coalesce(p_body->'rules','{}'::jsonb));
    mid := gen_random_uuid(); -- caller cannot attach authority to old identifiers.
    db_mode := CASE WHEN mode = 'official' THEN 'official' WHEN mode = 'turbo' THEN 'unofficial' ELSE 'practice' END;
    INSERT INTO public.matches(id,total_games,players,wins,history,mode,is_practice,target_wins)
    VALUES(mid,1,roster,(SELECT jsonb_agg(0) FROM generate_series(1,n)), '[]'::jsonb,db_mode,mode IN ('practice','vs_shadow'),coalesce((p_body->>'target_wins')::integer,1));
    INSERT INTO private.sc004_controllers(match_id,token_hash,mode,single_game,roster,rules)
    VALUES(mid,p_issue_hash,mode,coalesce(p_body->>'match_format',CASE WHEN mode IN ('practice','vs_shadow') THEN 'single' ELSE 'series' END)='single',roster,coalesce(p_body->'rules','{}'::jsonb)) RETURNING * INTO c;
    FOR i IN 0..n-1 LOOP
      INSERT INTO public.match_players(match_id,player_index,player_id,player_name)
      VALUES(mid,i,(roster->i->>'id')::uuid,roster->i->>'name');
    END LOOP;
    receipt := jsonb_build_object('ok',true,'match_id',mid,'roster',roster,'mode',mode,'match_format',CASE WHEN c.single_game THEN 'single' ELSE 'series' END,'rules',c.rules,'expires_at',c.expires_at);
    INSERT INTO private.sc004_requests(request_id,issue_hash,receipt) VALUES(rid,p_issue_hash,receipt);
    RETURN receipt;
  END IF;
  IF p_action = 'admin_action' THEN
    RETURN public.sq_sc004_admin(p_body,p_admin_user,p_admin_session,p_issue_hash);
  END IF;
  IF p_action IN ('create_training','complete_training','resume_training','renew_training') THEN
    RETURN private.sc004_training(p_action,p_token_hash,p_body,p_issue_hash);
  END IF;
  IF p_action='visit' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','device_id','day')) OR (p_body->>'device_id')::uuid IS NULL THEN RAISE EXCEPTION 'invalid visit' USING ERRCODE='22023'; END IF;
    INSERT INTO public.app_logons(day,device_id) VALUES((clock_timestamp() AT TIME ZONE 'UTC')::date,(p_body->>'device_id')::uuid::text) ON CONFLICT(day,device_id) DO NOTHING;
    RETURN jsonb_build_object('ok',true,'day',(clock_timestamp() AT TIME ZONE 'UTC')::date);
  END IF;
  -- All remaining branches require an actual live controller scoped to match.
  mid := (p_body->>'match_id')::uuid;
  c := private.sc004_assert_controller(p_token_hash,mid);
  IF p_action='cleanup_match' THEN
    IF EXISTS(SELECT 1 FROM public.games WHERE match_id=mid)
       OR EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND status='completed') THEN
      RAISE EXCEPTION 'accepted match cannot be cleaned' USING ERRCODE='42501';
    END IF;
    -- This match was minted by this registry. No UUID-only adoption or removal
    -- of a historical match is possible. Cascades remove private pending slots.
    DELETE FROM public.match_players WHERE match_id=mid;
    -- Retain the consumed issuance receipt: this secret must never bind another match.
    DELETE FROM public.matches WHERE id=mid;
    RETURN jsonb_build_object('ok',true,'match_id',mid,'cleaned',true);
  END IF;
  IF p_action='list_roster' THEN RETURN jsonb_build_object('ok',true,'roster',c.roster); END IF;
  IF p_action='resume' THEN
    RETURN jsonb_build_object('ok',true,'match_id',mid,'mode',c.mode,'match_format',CASE WHEN c.single_game THEN 'single' ELSE 'series' END,'rules',c.rules,'roster',c.roster,'expires_at',c.expires_at,
      'games',coalesce((SELECT jsonb_agg(jsonb_build_object('game_id',sl.game_id,'game_number',sl.game_number,'status',sl.status,'receipt',sl.receipt) ORDER BY sl.game_number) FROM private.sc004_slots sl WHERE sl.match_id=mid),'[]'::jsonb));
  END IF;
  IF p_action='renew' THEN
    -- Extend the same secret, avoiding an unrecoverable rotated-secret response.
    -- Revoked/expired controllers cannot renew; no UUID-only recovery exists.
    UPDATE private.sc004_controllers SET expires_at=clock_timestamp()+interval '24 hours' WHERE match_id=mid RETURNING * INTO c;
    RETURN jsonb_build_object('ok',true,'match_id',mid,'expires_at',c.expires_at);
  END IF;
  IF p_action='update_roster' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','match_id','roster'))
       OR jsonb_typeof(p_body->'roster') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid roster' USING ERRCODE='22023'; END IF;
    n := jsonb_array_length(p_body->'roster');
    IF n > 5 OR n < 1 OR (c.mode='vs_shadow' AND n<>1) THEN RAISE EXCEPTION 'invalid roster count' USING ERRCODE='22023'; END IF;
    IF n=1 AND c.mode IN ('official','turbo') THEN c.mode:='practice'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_body->'roster') LOOP
      IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','name','initials','avatar_id','nickname','display_name')) THEN
        RAISE EXCEPTION 'invalid roster entry' USING ERRCODE='22023';
      END IF;
      IF item->>'id' IS NOT NULL THEN
        SELECT * INTO saved FROM public.players WHERE id=(item->>'id')::uuid AND deleted_at IS NULL;
        IF NOT FOUND OR (item->>'name' IS NOT NULL AND item->>'name'<>saved.name) THEN RAISE EXCEPTION 'unknown roster player' USING ERRCODE='22023'; END IF;
        row_item := jsonb_build_object('id',saved.id,'name',saved.name);
      ELSE
        IF jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR length(trim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 80 OR lower(trim(item->>'name')) IN ('shadow','vs shadow') THEN RAISE EXCEPTION 'guest not eligible' USING ERRCODE='22023'; END IF;
        IF c.mode='official' THEN c.mode:='practice'; END IF;
        row_item := jsonb_build_object('id',NULL,'name',trim(item->>'name'));
      END IF;
      IF EXISTS(SELECT 1 FROM unnest(ARRAY['initials','nickname','display_name']) k WHERE item ? k AND jsonb_typeof(item->k) IS DISTINCT FROM 'string')
        OR length(coalesce(item->>'initials',''))>5 OR length(coalesce(item->>'nickname',''))>80 OR length(coalesce(item->>'display_name',''))>80
        OR (item ? 'avatar_id' AND (jsonb_typeof(item->'avatar_id') IS DISTINCT FROM 'number' OR (item->>'avatar_id')::integer NOT BETWEEN 1 AND 32)) THEN RAISE EXCEPTION 'invalid match display' USING ERRCODE='22023'; END IF;
      row_item := row_item || (item - 'id' - 'name');
      roster := roster || jsonb_build_array(row_item);
    END LOOP;
    IF (SELECT count(DISTINCT lower(value->>'name')) FROM jsonb_array_elements(roster))<>n THEN RAISE EXCEPTION 'duplicate roster' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND status='completed') THEN
      IF EXISTS(SELECT coalesce(x->>'id',lower(x->>'name')) FROM jsonb_array_elements(c.roster) x
                EXCEPT SELECT coalesce(x->>'id',lower(x->>'name')) FROM jsonb_array_elements(roster) x) THEN
        RAISE EXCEPTION 'accepted match participant cannot be removed or replaced' USING ERRCODE='22023';
      END IF;
      IF EXISTS(SELECT coalesce(x->>'id',lower(x->>'name')) FROM jsonb_array_elements(roster) x
                EXCEPT SELECT coalesce(x->>'id',lower(x->>'name')) FROM jsonb_array_elements(c.roster) x)
         AND ((SELECT count(*) FROM private.sc004_slots WHERE match_id=mid AND status='completed')<>1
              OR NOT EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND game_number=1 AND status='completed')
              OR EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND game_number>=2)) THEN
        RAISE EXCEPTION 'late join window closed' USING ERRCODE='22023';
      END IF;
    END IF;
    -- Only current snapshots change. Existing games/accepted receipts do not.
    SELECT m.wins INTO v_wins FROM public.matches m WHERE m.id=mid;
    -- Remap current operational wins by stable ID/name when order changes.
    SELECT jsonb_agg(coalesce(cmd.v_wins->old.idx, '0'::jsonb) ORDER BY fresh.idx) INTO v_wins
      FROM jsonb_array_elements(roster) WITH ORDINALITY fresh(p,idx)
      LEFT JOIN LATERAL (SELECT (o.idx-1)::integer idx FROM jsonb_array_elements(c.roster) WITH ORDINALITY o(p,idx)
        WHERE coalesce(o.p->>'id',lower(o.p->>'name'))=coalesce(fresh.p->>'id',lower(fresh.p->>'name')) LIMIT 1) old ON true;
    UPDATE private.sc004_controllers SET roster=cmd.roster,mode=c.mode WHERE match_id=mid;
    UPDATE public.matches SET players=roster,wins=cmd.v_wins,mode=CASE WHEN c.mode='official' THEN 'official' WHEN c.mode='turbo' THEN 'unofficial' ELSE 'practice' END,is_practice=c.mode IN ('practice','vs_shadow') WHERE id=mid;
    DELETE FROM public.match_players WHERE match_id=mid;
    FOR i IN 0..n-1 LOOP
      INSERT INTO public.match_players(match_id,player_index,player_id,player_name) VALUES(mid,i,(roster->i->>'id')::uuid,roster->i->>'name');
    END LOOP;
    RETURN jsonb_build_object('ok',true,'match_id',mid,'roster',roster,'mode',c.mode);
  END IF;
  IF p_action = 'revoke_controller' THEN
    UPDATE private.sc004_controllers SET revoked_at=clock_timestamp() WHERE match_id=mid;
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF p_action = 'reserve_game' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','match_id','game_number')) THEN
      RAISE EXCEPTION 'invalid reservation' USING ERRCODE = '22023';
    END IF;
    i := (p_body->>'game_number')::integer;
    IF i IS NULL OR i NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'invalid game number' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND game_number=i)
       AND i<>coalesce((SELECT max(game_number) FROM private.sc004_slots WHERE match_id=mid),0)+1 THEN
      RAISE EXCEPTION 'game sequence mismatch' USING ERRCODE='22023';
    END IF;
    IF (c.single_game AND i<>1)
       OR (NOT EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND game_number=i)
           AND EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND status<>'completed')) THEN
      RAISE EXCEPTION 'previous game unaccepted or single-game mode' USING ERRCODE='22023';
    END IF;
    INSERT INTO private.sc004_slots(match_id,game_number) VALUES(mid,i)
      ON CONFLICT(match_id,game_number) DO NOTHING;
    SELECT * INTO s FROM private.sc004_slots WHERE match_id=mid AND game_number=i;
    IF s.status='cleaned' THEN RAISE EXCEPTION 'slot already cleaned' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('ok',true,'game_id',s.game_id,'match_id',mid,'game_number',i,'status',s.status);
  END IF;
  gid := (p_body->>'game_id')::uuid;
  SELECT * INTO s FROM private.sc004_slots WHERE game_id=gid AND match_id=mid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'game scope denied' USING ERRCODE = '42501'; END IF;
  IF p_action = 'reset_game' THEN
    IF s.status='completed' THEN RAISE EXCEPTION 'accepted game cannot be reset' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND game_number>s.game_number) THEN
      RAISE EXCEPTION 'older game cannot be reset' USING ERRCODE='42501';
    END IF;
    UPDATE private.sc004_slots SET status='pending',payload=NULL,receipt=NULL WHERE game_id=gid;
    RETURN jsonb_build_object('ok',true,'game_id',gid,'match_id',mid,'game_number',s.game_number,'status','pending');
  END IF;
  IF p_action = 'cleanup_game' THEN
    IF s.status='completed' THEN RAISE EXCEPTION 'completed game cannot be cleaned' USING ERRCODE = '42501'; END IF;
    UPDATE private.sc004_slots SET status='cleaned',payload=NULL WHERE game_id=gid;
    RETURN jsonb_build_object('ok',true,'game_id',gid);
  END IF;
  IF s.status='cleaned' THEN RAISE EXCEPTION 'game is cleaned' USING ERRCODE = '42501'; END IF;
  IF p_action = 'log_go' THEN
    IF NOT(p_body ?& ARRAY['match_id','game_id','player_id','round_number','go_number','started_at','ended_at']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','match_id','game_id','player_id','round_number','go_number','started_at','ended_at')) OR jsonb_typeof(p_body->'round_number') IS DISTINCT FROM 'number' OR jsonb_typeof(p_body->'go_number') IS DISTINCT FROM 'number' OR jsonb_typeof(p_body->'started_at') IS DISTINCT FROM 'string' OR jsonb_typeof(p_body->'ended_at') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'invalid go envelope' USING ERRCODE='22023'; END IF;
    uid := (p_body->>'player_id')::uuid;
    IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.payload->'state'->'players') x WHERE (x->>'id')::uuid=uid)
       OR (p_body->>'round_number')::integer NOT BETWEEN 1 AND 14
       OR (p_body->>'go_number')::integer NOT BETWEEN 1 AND 10
       OR (p_body->>'ended_at')::timestamptz < (p_body->>'started_at')::timestamptz THEN
      RAISE EXCEPTION 'invalid go scope' USING ERRCODE = '22023';
    END IF;
    -- No historical fixture adoption: a reserved slot does not exist publicly
    -- until completion; this RPC is deferred until that committed game exists.
    IF s.status <> 'completed' THEN RAISE EXCEPTION 'game not committed' USING ERRCODE = '22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.player_go_events WHERE game_id=gid AND player_id=uid AND round_number=(p_body->>'round_number')::integer AND go_number=(p_body->>'go_number')::integer) THEN
      IF NOT EXISTS(SELECT 1 FROM public.player_go_events WHERE game_id=gid AND player_id=uid AND round_number=(p_body->>'round_number')::integer AND go_number=(p_body->>'go_number')::integer AND started_at=(p_body->>'started_at')::timestamptz AND ended_at=(p_body->>'ended_at')::timestamptz) THEN RAISE EXCEPTION 'conflicting go retry' USING ERRCODE='23505'; END IF;
      RETURN jsonb_build_object('ok',true);
    END IF;
    PERFORM public.log_player_go(gid,uid,(p_body->>'round_number')::integer,(p_body->>'go_number')::integer,(p_body->>'started_at')::timestamptz,(p_body->>'ended_at')::timestamptz);
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF p_action='append_event' THEN
    RETURN private.sc004_append_event(c,s,p_body);
  END IF;
  IF p_action <> 'complete_game' THEN RAISE EXCEPTION 'unsupported operation' USING ERRCODE = '22023'; END IF;
  IF s.status='completed' THEN
    IF (s.payload - 'request_id') IS DISTINCT FROM (p_body - 'request_id') THEN RAISE EXCEPTION 'conflicting completion retry' USING ERRCODE = '23505'; END IF;
    RETURN s.receipt;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','match_id','game_id','state','totals','stats','winner_indexes'))
     OR coalesce(jsonb_typeof(p_body->'state'),'null') <> 'object'
     OR p_body->'state'->'players' IS DISTINCT FROM c.roster
     OR (coalesce(p_body->'state'->>'mode','') <> c.mode
         AND NOT(c.mode='vs_shadow' AND p_body->'state'->>'mode'='practice'))
     OR (c.mode='vs_shadow' AND p_body->'state' ? 'gameMode' AND p_body->'state'->>'gameMode' IS DISTINCT FROM 'practice')
     OR EXISTS(SELECT 1 FROM jsonb_each(c.rules) r WHERE p_body->'state' ? r.key AND NOT (r.value <@ (p_body->'state'->r.key))) THEN
    RAISE EXCEPTION 'invalid completion scope' USING ERRCODE = '22023';
  END IF;
  IF (p_body->'state' ? 'match_id' AND p_body->'state'->>'match_id' IS DISTINCT FROM mid::text)
     OR (p_body->'state' ? 'matchId' AND p_body->'state'->>'matchId' IS DISTINCT FROM mid::text) THEN
    RAISE EXCEPTION 'nested match scope denied' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body->'state') k WHERE k NOT IN ('players','board','mode','gameMode','gameFormat','gameVariant','tournament','tournamentType','tournamentRules','strictTimer','throwLimitSeconds','startTarget','schema_version','is_practice','total_players','match_id','matchId','completed_at','practice_save_key','totals')) THEN
    RAISE EXCEPTION 'unexpected persisted state fields' USING ERRCODE = '22023';
  END IF;
  board := p_body->'state'->'board'; n := jsonb_array_length(c.roster);
  IF coalesce(jsonb_typeof(board),'null') <> 'array' OR jsonb_array_length(board) <> n
     OR coalesce(jsonb_typeof(p_body->'totals'),'null') <> 'array' OR jsonb_array_length(p_body->'totals') <> n
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_body->'totals') v WHERE jsonb_typeof(v) IS DISTINCT FROM 'number' OR v::text !~ '^[0-9]+$')
     OR (p_body ? 'stats' AND p_body->'stats' NOT IN ('null'::jsonb,'{}'::jsonb)) THEN
    RAISE EXCEPTION 'invalid board dimensions' USING ERRCODE = '22023';
  END IF;
  totals := ARRAY(SELECT value::text::integer FROM jsonb_array_elements(p_body->'totals'));
  FOR i IN 0..n-1 LOOP
    IF coalesce(jsonb_typeof(board->i),'null') <> 'array' OR jsonb_array_length(board->i) <> 14 THEN
      RAISE EXCEPTION 'invalid rounds' USING ERRCODE = '22023';
    END IF;
    sum_total := 0;
    FOR j IN 0..13 LOOP
      row_item := board->i->j;
      IF coalesce(jsonb_typeof(row_item),'null') <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(row_item) k WHERE k NOT IN ('darts','roundTotal')) OR jsonb_typeof(row_item->'roundTotal') IS DISTINCT FROM 'number' OR coalesce(jsonb_typeof(row_item->'darts'),'null') <> 'array' OR jsonb_array_length(row_item->'darts') <> 3
         OR coalesce(row_item->>'roundTotal','') !~ '^[0-9]+$' OR (row_item->>'roundTotal')::integer > 180 THEN
        RAISE EXCEPTION 'invalid round shape' USING ERRCODE = '22023';
      END IF;
      dart_total := 0;
      FOR dart IN SELECT value FROM jsonb_array_elements(row_item->'darts') LOOP
        IF dart='null'::jsonb THEN CONTINUE; END IF;
        IF coalesce(jsonb_typeof(dart),'null')<>'object'
          OR EXISTS(SELECT 1 FROM jsonb_object_keys(dart) k WHERE k NOT IN ('kind','points','sector','bull','absence','bounceOut'))
          OR jsonb_typeof(dart->'points') IS DISTINCT FROM 'number' OR coalesce(dart->>'kind','') NOT IN ('Miss','Scratch','S','D','T','Double','Triple','B')
          OR coalesce(dart->>'points','') !~ '^[0-9]+$' OR (dart->>'points')::integer>60
          OR (dart ? 'absence' AND jsonb_typeof(dart->'absence') IS DISTINCT FROM 'boolean')
          OR (dart ? 'bounceOut' AND jsonb_typeof(dart->'bounceOut') IS DISTINCT FROM 'boolean')
          OR (dart->>'kind' IN ('Miss','Scratch') AND (dart->>'points')::integer<>0)
          OR (dart->>'kind' IN ('Double','Triple') AND (jsonb_typeof(dart->'sector') IS DISTINCT FROM 'number' OR coalesce(dart->>'sector','') !~ '^[0-9]+$' OR (dart->>'sector')::integer NOT BETWEEN 1 AND 20))
          OR (dart->>'kind'='B' AND coalesce(dart->>'bull','') NOT IN ('Inner','Outer')) THEN
          RAISE EXCEPTION 'invalid dart shape' USING ERRCODE='22023';
        END IF;
        dart_total := dart_total+(dart->>'points')::integer;
      END LOOP;
      IF dart_total<>(row_item->>'roundTotal')::integer THEN RAISE EXCEPTION 'round aggregate mismatch' USING ERRCODE='22023'; END IF;
      sum_total := sum_total + (row_item->>'roundTotal')::integer;
    END LOOP;
    IF totals[i+1] <> sum_total THEN RAISE EXCEPTION 'totals mismatch' USING ERRCODE = '22023'; END IF;
  END LOOP;
  -- Preserve match win accounting without duplicating recordThrow scoring.
  -- A resolved decider may select one of the tied top-score players; otherwise
  -- the canonical current app awards all players sharing the highest total.
  SELECT max(v) INTO max_total FROM unnest(totals) v;
  winners := ARRAY(SELECT (ord-1)::integer FROM unnest(totals) WITH ORDINALITY x(v,ord) WHERE v=max_total);
  IF p_body ? 'winner_indexes' THEN
    IF coalesce(jsonb_typeof(p_body->'winner_indexes'),'null')<>'array' OR jsonb_array_length(p_body->'winner_indexes')<1 THEN RAISE EXCEPTION 'invalid winners' USING ERRCODE='22023'; END IF;
    winners := ARRAY(SELECT value::text::integer FROM jsonb_array_elements(p_body->'winner_indexes'));
    IF EXISTS(SELECT 1 FROM unnest(winners) w WHERE w<0 OR w>=n OR totals[w+1]<>max_total)
       OR cardinality(winners)<>(SELECT count(DISTINCT w) FROM unnest(winners) w) THEN RAISE EXCEPTION 'invalid winner scope' USING ERRCODE='22023'; END IF;
  END IF;
  -- Preserve canonical board; validate envelope/aggregate consistency without
  -- implementing another scoring engine. Server-derived mode/IDs/timestamps.
  db_mode := CASE WHEN c.mode='official' THEN 'official' WHEN c.mode='turbo' THEN 'unofficial' ELSE 'practice' END;
  clean_state := (p_body->'state' || c.rules) || jsonb_build_object('match_id',mid,'matchId',mid,'mode',CASE WHEN c.mode='vs_shadow' THEN 'practice' ELSE c.mode END,'gameMode',CASE WHEN c.mode='vs_shadow' THEN 'practice' ELSE c.mode END,'is_practice',c.mode IN ('practice','vs_shadow'),'total_players',n);
  INSERT INTO public.games(id,match_id,game_number,state,stats,totals,finished,mode,is_practice)
  VALUES(gid,mid,s.game_number,clean_state,p_body->'stats',totals,true,db_mode,c.mode IN ('practice','vs_shadow'))
  RETURNING jsonb_build_object('ok',true,'id',id,'game_id',id,'match_id',match_id,'game_number',game_number,'created_at',created_at) INTO receipt;
  -- Current games UPDATE trigger refers to absent HS columns. Atomic completed
  -- INSERT follows existing browser persistence boundary; explicitly route HS.
  IF c.mode <> 'turbo' THEN
    FOR i IN 0..n-1 LOOP
      uid := (c.roster->i->>'id')::uuid;
      IF uid IS NULL OR totals[i+1]<=0 THEN CONTINUE; END IF;
      IF c.mode='official' THEN
        INSERT INTO public.high_scores_sp(name,score,ts,player_id,game_id) VALUES(c.roster->i->>'name',totals[i+1],(receipt->>'created_at')::timestamptz,uid,gid);
      ELSE
        INSERT INTO public.high_scores(name,score,ts,player_id,game_id) VALUES(c.roster->i->>'name',totals[i+1],(receipt->>'created_at')::timestamptz,uid,gid);
      END IF;
    END LOOP;
  END IF;
  SELECT m.wins INTO v_wins FROM public.matches m WHERE m.id=mid;
  IF NOT c.single_game THEN
    SELECT jsonb_agg(coalesce((cmd.v_wins->>x)::integer,0)+CASE WHEN x=ANY(winners) THEN 1 ELSE 0 END ORDER BY x) INTO v_wins FROM generate_series(0,n-1) x;
  END IF;
  UPDATE public.matches SET total_games=greatest(total_games,s.game_number),wins=cmd.v_wins,history=history || jsonb_build_array(jsonb_build_object('game_id',gid,'totals',to_jsonb(totals),'mode',c.mode)) WHERE id=mid;
  UPDATE private.sc004_slots SET status='completed',payload=p_body,receipt=cmd.receipt WHERE game_id=gid;
  RETURN receipt;
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_command(text,text,jsonb,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_command(text,text,jsonb,text,uuid,uuid) TO service_role;

-- Lifecycle proposal only: no production schedule is installed. Explicitly
-- trusted pruning can remove an expired, never-accepted server-created scope.
CREATE OR REPLACE FUNCTION public.sq_sc004_prune_expired_empty(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private AS $f$
DECLARE x record; removed integer:=0;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid pruning bound' USING ERRCODE='22023'; END IF;
  IF coalesce((SELECT held FROM private.sc004_write_control WHERE singleton),true) THEN RAISE EXCEPTION 'writes held' USING ERRCODE='55000'; END IF;
  FOR x IN SELECT c.match_id FROM private.sc004_controllers c JOIN public.matches m ON m.id=c.match_id
    WHERE c.expires_at<=clock_timestamp() AND m.history='[]'::jsonb
      AND NOT EXISTS(SELECT 1 FROM public.games g WHERE g.match_id=c.match_id)
      AND NOT EXISTS(SELECT 1 FROM private.sc004_slots s WHERE s.match_id=c.match_id AND s.status='completed')
    ORDER BY c.expires_at LIMIT p_limit FOR UPDATE OF c,m SKIP LOCKED LOOP
    DELETE FROM public.match_players WHERE match_id=x.match_id;
    -- Retain the consumed issuance receipt: this secret must never bind another match.
    DELETE FROM public.matches WHERE id=x.match_id;
    removed:=removed+1;
  END LOOP;
  RETURN removed;
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_prune_expired_empty(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_prune_expired_empty(integer) TO service_role;
