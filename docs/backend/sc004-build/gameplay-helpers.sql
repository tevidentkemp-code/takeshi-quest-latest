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
  IF jsonb_typeof(p)<>'object' OR octet_length(p::text)>8192
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('gameFormat','gameVariant','tournament','tournamentType','tournamentRules','strictTimer','throwLimitSeconds','startTarget'))
    OR (p ? 'gameFormat' AND p->>'gameFormat' NOT IN ('match_play'))
    OR (p ? 'gameVariant' AND p->>'gameVariant' NOT IN ('classic','turbo'))
    OR (p ? 'startTarget' AND p->>'startTarget' NOT IN ('10','17'))
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
    IF FOUND THEN RETURN receipt; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_requests WHERE request_id=rid) THEN RAISE EXCEPTION 'request conflict' USING ERRCODE='23505'; END IF;
    p:=p_body->'player';
    IF jsonb_typeof(p)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('id','name')) OR length(trim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 80
      OR coalesce(p_body->>'mode','') NOT IN ('standard','tdb','select') OR coalesce((p_body->>'length')::integer,-1) NOT IN (0,10,15)
      OR jsonb_typeof(p_body->'config')<>'object' OR octet_length((p_body->'config')::text)>8192 THEN RAISE EXCEPTION 'invalid training setup' USING ERRCODE='22023'; END IF;
    IF p->>'id' IS NOT NULL THEN SELECT * INTO saved FROM public.players WHERE id=(p->>'id')::uuid AND deleted_at IS NULL; IF NOT FOUND OR saved.name<>p->>'name' THEN RAISE EXCEPTION 'unknown training player' USING ERRCODE='22023'; END IF; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body->'config') k WHERE k<>'targets') THEN RAISE EXCEPTION 'invalid training config' USING ERRCODE='22023'; END IF;
    IF p_body->>'mode'='select' THEN
      IF jsonb_typeof(p_body->'config'->'targets')<>'array' OR jsonb_array_length(p_body->'config'->'targets') NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid selected targets' USING ERRCODE='22023'; END IF;
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
