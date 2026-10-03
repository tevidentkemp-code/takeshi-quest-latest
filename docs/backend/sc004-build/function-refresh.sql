-- Coordinated functions-only refresh. Schema, registries, capabilities and receipts survive.
BEGIN;
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

CREATE OR REPLACE FUNCTION private.sc004_validate_rules(p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $f$
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

CREATE OR REPLACE FUNCTION private.sc004_training(p_action text,p_hash text,p_body jsonb,p_issue text) RETURNS jsonb
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

CREATE OR REPLACE FUNCTION private.sc004_append_event(c private.sc004_controllers,s private.sc004_slots,p jsonb) RETURNS jsonb
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
  IF p_action = 'create_player' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('request_id','name','initials','first_name','last_name','nickname','avatar_id'))
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
    IF FOUND THEN RETURN receipt; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_requests r WHERE r.request_id=rid) THEN
      RAISE EXCEPTION 'match initiation request already consumed' USING ERRCODE = '23505';
    END IF;
    mode := p_body->>'mode';
    IF mode IS NULL OR mode NOT IN ('official','practice','turbo','vs_shadow') OR jsonb_typeof(p_body->'roster') <> 'array' THEN
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
      IF jsonb_typeof(item) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','name')) THEN
        RAISE EXCEPTION 'invalid roster entry' USING ERRCODE = '22023';
      END IF;
      IF item->>'id' IS NOT NULL THEN
        SELECT * INTO saved FROM public.players WHERE id = (item->>'id')::uuid AND deleted_at IS NULL;
        IF NOT FOUND OR (item->>'name' IS NOT NULL AND item->>'name' <> saved.name) THEN
          RAISE EXCEPTION 'unknown player or display name mismatch' USING ERRCODE = '22023';
        END IF;
        roster := roster || jsonb_build_array(jsonb_build_object('id',saved.id,'name',saved.name));
      ELSE
        IF mode='official' OR length(trim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 80
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
    DELETE FROM private.sc004_requests r WHERE r.receipt->>'match_id'=mid::text;
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
       OR jsonb_typeof(p_body->'roster') <> 'array' THEN RAISE EXCEPTION 'invalid roster' USING ERRCODE='22023'; END IF;
    n := jsonb_array_length(p_body->'roster');
    IF n > 5 OR n < 1 OR (c.mode='vs_shadow' AND n<>1) THEN RAISE EXCEPTION 'invalid roster count' USING ERRCODE='22023'; END IF;
    IF n=1 AND c.mode IN ('official','turbo') THEN c.mode:='practice'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_body->'roster') LOOP
      IF jsonb_typeof(item)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','name','initials','avatar_id','nickname','display_name')) THEN
        RAISE EXCEPTION 'invalid roster entry' USING ERRCODE='22023';
      END IF;
      IF item->>'id' IS NOT NULL THEN
        SELECT * INTO saved FROM public.players WHERE id=(item->>'id')::uuid AND deleted_at IS NULL;
        IF NOT FOUND OR (item->>'name' IS NOT NULL AND item->>'name'<>saved.name) THEN RAISE EXCEPTION 'unknown roster player' USING ERRCODE='22023'; END IF;
        row_item := jsonb_build_object('id',saved.id,'name',saved.name);
      ELSE
        IF length(trim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 80 OR lower(trim(item->>'name')) IN ('shadow','vs shadow') THEN RAISE EXCEPTION 'guest not eligible' USING ERRCODE='22023'; END IF;
        IF c.mode='official' THEN c.mode:='practice'; END IF;
        row_item := jsonb_build_object('id',NULL,'name',trim(item->>'name'));
      END IF;
      IF length(coalesce(item->>'initials',''))>5 OR length(coalesce(item->>'nickname',''))>80 OR length(coalesce(item->>'display_name',''))>80
        OR (item ? 'avatar_id' AND (item->>'avatar_id')::integer NOT BETWEEN 1 AND 29) THEN RAISE EXCEPTION 'invalid match display' USING ERRCODE='22023'; END IF;
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
           AND EXISTS(SELECT 1 FROM private.sc004_slots WHERE match_id=mid AND status='pending')) THEN
      RAISE EXCEPTION 'previous game pending or single-game mode' USING ERRCODE='22023';
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
     OR coalesce(p_body->'state'->>'mode','') <> c.mode
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
    DELETE FROM private.sc004_requests WHERE receipt->>'match_id'=x.match_id::text;
    DELETE FROM public.matches WHERE id=x.match_id;
    removed:=removed+1;
  END LOOP;
  RETURN removed;
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_prune_expired_empty(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_prune_expired_empty(integer) TO service_role;

CREATE OR REPLACE FUNCTION private.sc004_controller_now() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,private AS $f$
  SELECT CASE WHEN held AND held_at IS NOT NULL THEN held_at ELSE clock_timestamp() END
    FROM private.sc004_write_control WHERE singleton;
$f$;
REVOKE ALL ON FUNCTION private.sc004_controller_now() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sq_sc004_set_hold(p_held boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,private AS $f$
DECLARE control private.sc004_write_control; pause interval;
BEGIN
  IF p_held IS NULL THEN RAISE EXCEPTION 'hold required' USING ERRCODE='22023'; END IF;
  SELECT * INTO control FROM private.sc004_write_control WHERE singleton FOR UPDATE;
  IF control.held=p_held THEN RETURN jsonb_build_object('ok',true,'held',p_held); END IF;
  IF p_held THEN UPDATE private.sc004_write_control SET held=true,held_at=clock_timestamp() WHERE singleton;
  ELSE
    pause:=clock_timestamp()-coalesce(control.held_at,clock_timestamp());
    UPDATE private.sc004_controllers SET expires_at=expires_at+pause WHERE revoked_at IS NULL AND expires_at>control.held_at;
    UPDATE private.sc004_training_controls SET expires_at=expires_at+pause WHERE revoked_at IS NULL AND expires_at>control.held_at;
    UPDATE private.sc004_write_control SET held=false,held_at=NULL WHERE singleton;
  END IF;
  RETURN jsonb_build_object('ok',true,'held',p_held);
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_set_hold(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_set_hold(boolean) TO service_role;

CREATE OR REPLACE FUNCTION private.sc004_rename_json(v jsonb,old_name text,new_name text,old_id uuid,new_id uuid,context text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE result jsonb; k text; item jsonb; next_context text;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(v)='array' THEN
    SELECT coalesce(jsonb_agg(private.sc004_rename_json(x,old_name,new_name,old_id,new_id,context)),'[]'::jsonb) INTO result FROM jsonb_array_elements(v) x;
    RETURN result;
  ELSIF jsonb_typeof(v)='object' THEN
    result:='{}'::jsonb;
    FOR k,item IN SELECT * FROM jsonb_each(v) LOOP
      next_context:=CASE WHEN k IN ('name','player_name','player','displayName') THEN 'name'
        WHEN k IN ('players','names','player_names','opponent_name') THEN 'name'
        WHEN k IN ('id','player_id','playerId','saved_player_id') THEN 'id'
        WHEN k='wins' THEN 'wins' ELSE '' END;
      result:=result||jsonb_build_object(k,private.sc004_rename_json(item,old_name,new_name,old_id,new_id,next_context));
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(v)='string' AND context IN ('name','wins') AND lower(v#>>'{}')=lower(old_name) THEN
    RETURN to_jsonb(new_name);
  ELSIF jsonb_typeof(v)='string' AND context='id' AND v#>>'{}'=old_id::text THEN
    RETURN to_jsonb(new_id::text);
  END IF;
  RETURN v;
END $f$;
REVOKE ALL ON FUNCTION private.sc004_rename_json(jsonb,text,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.sc004_rename_player(old_id uuid,new_name text)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE src public.players; dst public.players; target uuid; x record;
BEGIN
  new_name:=btrim(new_name);
  IF new_name IS NULL OR length(new_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid player name' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(lower(new_name)));
  SELECT * INTO src FROM public.players WHERE id=old_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'player not found' USING ERRCODE='P0002'; END IF;
  IF src.name=new_name THEN RETURN src.id; END IF;
  IF (SELECT count(*) FROM public.players WHERE lower(name)=lower(new_name) AND id<>src.id)>1 THEN RAISE EXCEPTION 'merge target is ambiguous' USING ERRCODE='22023'; END IF;
  SELECT * INTO dst FROM public.players WHERE lower(name)=lower(new_name) AND id<>src.id FOR UPDATE;
  IF FOUND THEN
    IF dst.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'restore the archived target before merging' USING ERRCODE='22023'; END IF;
    target:=dst.id;
    -- A merge must not collapse two different participants in one saved board.
    IF EXISTS(SELECT 1 FROM public.games g WHERE
      EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(g.state->'players')='array' THEN g.state->'players' ELSE '[]'::jsonb END) p WHERE p->>'id'=src.id::text OR p->>'player_id'=src.id::text OR lower(p->>'name')=lower(src.name) OR (jsonb_typeof(p)='string' AND lower(p#>>'{}')=lower(src.name)))
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(g.state->'players')='array' THEN g.state->'players' ELSE '[]'::jsonb END) p WHERE p->>'id'=dst.id::text OR p->>'player_id'=dst.id::text OR lower(p->>'name')=lower(dst.name) OR (jsonb_typeof(p)='string' AND lower(p#>>'{}')=lower(dst.name)))) THEN
      RAISE EXCEPTION 'players sharing a saved game cannot be merged' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.players_archive(player_id,player_name,reason,payload) VALUES(src.id,src.name,'admin_merge',to_jsonb(src));
    UPDATE public.players SET deleted_at=clock_timestamp() WHERE id=src.id;
  ELSE
    target:=src.id;
    INSERT INTO public.players_archive(player_id,player_name,reason,payload) VALUES(src.id,src.name,'admin_rename',to_jsonb(src));
    UPDATE public.players SET name=new_name WHERE id=src.id;
  END IF;
  UPDATE private.sc004_controllers c SET revoked_at=clock_timestamp() WHERE c.revoked_at IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.roster) p WHERE p->>'id' IN (src.id::text,target::text) OR lower(p->>'name')=lower(src.name));
  UPDATE public.match_players SET player_name=new_name,player_id=target WHERE player_id=src.id OR lower(player_name)=lower(src.name);
  UPDATE public.high_scores SET name=new_name,player_id=target WHERE player_id=src.id OR lower(name)=lower(src.name);
  UPDATE public.high_scores_sp SET name=new_name,player_id=target WHERE player_id=src.id OR lower(name)=lower(src.name);
  UPDATE public.games SET state=private.sc004_rename_json(state,src.name,new_name,src.id,target),stats=private.sc004_rename_json(stats,src.name,new_name,src.id,target)
    WHERE state IS DISTINCT FROM private.sc004_rename_json(state,src.name,new_name,src.id,target) OR stats IS DISTINCT FROM private.sc004_rename_json(stats,src.name,new_name,src.id,target);
  UPDATE public.matches SET players=private.sc004_rename_json(players,src.name,new_name,src.id,target,'name'),history=private.sc004_rename_json(history,src.name,new_name,src.id,target),wins=private.sc004_rename_json(wins,src.name,new_name,src.id,target,'wins')
    WHERE players IS DISTINCT FROM private.sc004_rename_json(players,src.name,new_name,src.id,target,'name') OR history IS DISTINCT FROM private.sc004_rename_json(history,src.name,new_name,src.id,target) OR wins IS DISTINCT FROM private.sc004_rename_json(wins,src.name,new_name,src.id,target,'wins');
  UPDATE public.player_match_stats SET player_name=new_name WHERE lower(player_name)=lower(src.name);
  UPDATE public.player_match_stats SET opponent_name=private.sc004_rename_json(opponent_name,src.name,new_name,src.id,target,'name') WHERE opponent_name IS DISTINCT FROM private.sc004_rename_json(opponent_name,src.name,new_name,src.id,target,'name');
  IF target<>src.id THEN
    UPDATE public.player_go_events SET player_id=target WHERE player_id=src.id;
    INSERT INTO public.player_aliases(saved_player_id,alias) SELECT target,alias FROM public.player_aliases WHERE saved_player_id=src.id ON CONFLICT DO NOTHING;
    DELETE FROM public.player_aliases WHERE saved_player_id=src.id;
    UPDATE public.player_bucket_map SET saved_player_id=target,display_name=new_name WHERE saved_player_id=src.id;
    INSERT INTO public.player_round_highs(saved_player_id,display_name,round_key,round_label,hits,round_points,source_game_id,last_seen)
      SELECT target,new_name,round_key,round_label,hits,round_points,source_game_id,last_seen FROM public.player_round_highs WHERE saved_player_id=src.id
      ON CONFLICT(saved_player_id,round_key) DO UPDATE SET display_name=EXCLUDED.display_name,round_label=EXCLUDED.round_label,hits=EXCLUDED.hits,round_points=EXCLUDED.round_points,source_game_id=EXCLUDED.source_game_id,last_seen=EXCLUDED.last_seen
      WHERE EXCLUDED.round_points>public.player_round_highs.round_points;
    DELETE FROM public.player_round_highs WHERE saved_player_id=src.id;
  END IF;
  INSERT INTO public.player_aliases(saved_player_id,alias) VALUES(target,src.name) ON CONFLICT DO NOTHING;
  UPDATE public.player_bucket_map SET display_name=new_name WHERE saved_player_id=target;
  UPDATE public.player_round_highs SET display_name=new_name WHERE saved_player_id=target;
  RETURN target;
END $f$;
REVOKE ALL ON FUNCTION private.sc004_rename_player(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.sc004_ensure_scores(gid uuid,scope text DEFAULT NULL,only_player uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE g public.games; p jsonb; pid uuid; nm text; i integer:=0; count_added integer:=0; changed integer; practice boolean;
BEGIN
  SELECT * INTO g FROM public.games WHERE id=gid;
  IF NOT FOUND THEN RAISE EXCEPTION 'game not found' USING ERRCODE='P0002'; END IF;
  IF NOT g.finished OR g.archived_at IS NOT NULL OR jsonb_typeof(g.state->'players') IS DISTINCT FROM 'array' THEN RETURN 0; END IF;
  IF g.mode='unofficial' OR lower(coalesce(g.state->>'mode',''))='turbo' OR lower(coalesce(g.state->>'gameMode',''))='turbo' OR lower(coalesce(g.state->>'gameVariant',''))='turbo' OR lower(coalesce(g.state->>'tournamentType',''))='turbo' THEN RETURN 0; END IF;
  practice:=g.is_practice OR g.mode='practice' OR lower(coalesce(g.state->>'mode',''))='practice' OR coalesce((g.state->>'is_practice')::boolean,false) OR jsonb_array_length(g.state->'players')<2;
  IF scope IS NOT NULL AND scope<>(CASE WHEN practice THEN 'practice' ELSE 'league' END) THEN RETURN 0; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(g.state->'players') LOOP
    i:=i+1;nm:=CASE WHEN jsonb_typeof(p)='string' THEN p#>>'{}' ELSE p->>'name' END;
    pid:=coalesce(nullif(p->>'id',''),nullif(p->>'player_id',''))::uuid;
    -- A guest snapshot stays ineligible after somebody later registers the same name.
    IF pid IS NULL AND jsonb_typeof(p)='string' THEN SELECT id INTO pid FROM public.players WHERE name=nm; END IF;
    IF pid IS NULL OR nm IS NULL OR coalesce(g.totals[i],0)<=0 OR (only_player IS NOT NULL AND pid<>only_player) THEN CONTINUE; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.players WHERE id=pid) THEN CONTINUE; END IF;
    IF practice THEN INSERT INTO public.high_scores(name,score,ts,player_id,game_id) VALUES(nm,g.totals[i],g.created_at,pid,g.id) ON CONFLICT DO NOTHING;
    ELSE INSERT INTO public.high_scores_sp(name,score,ts,player_id,game_id) VALUES(nm,g.totals[i],g.created_at,pid,g.id) ON CONFLICT DO NOTHING; END IF;
    GET DIAGNOSTICS changed=ROW_COUNT;count_added:=count_added+changed;
  END LOOP;
  RETURN count_added;
END $f$;
REVOKE ALL ON FUNCTION private.sc004_ensure_scores(uuid,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sq_sc004_admin(p_body jsonb,p_admin_user uuid,p_admin_session uuid,p_issue_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
<<cmd>>
DECLARE
  op text; rid uuid; uid uuid; gid uuid; mid uuid; scope text; sql_table text;
  m public.matches; recovered_controller private.sc004_controllers; next_game integer; target integer; mode text; rules jsonb; roster jsonb:='[]'::jsonb;
  profile jsonb; result jsonb; previous private.sc004_admin_requests; player public.players; g public.games;
  n integer; changed integer:=0; total integer:=0; idx integer; arr jsonb; key text; item jsonb; payload jsonb; nm text; ts timestamptz;
BEGIN
  IF jsonb_typeof(p_body) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid request' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM private.sc004_admins a JOIN auth.users u ON u.id=a.user_id JOIN auth.sessions s ON s.user_id=u.id AND s.id=p_admin_session
    WHERE a.user_id=p_admin_user AND a.enabled AND a.revoked_at IS NULL AND NOT coalesce(u.is_anonymous,true) AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (s.not_after IS NULL OR s.not_after>clock_timestamp());
  IF NOT FOUND THEN RAISE EXCEPTION 'admin denied' USING ERRCODE='42501'; END IF;
  op:=p_body->>'operation';rid:=(p_body->>'request_id')::uuid;
  IF op='status' THEN RETURN jsonb_build_object('ok',true,'user_id',p_admin_user); END IF;
  IF rid IS NULL OR op IS NULL THEN RAISE EXCEPTION 'operation and request id required' USING ERRCODE='22023'; END IF;
  IF coalesce((SELECT held FROM private.sc004_write_control WHERE singleton),true) THEN RAISE EXCEPTION 'writes held' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_admin_user::text||rid::text));
  SELECT * INTO previous FROM private.sc004_admin_requests WHERE user_id=p_admin_user AND request_id=rid;
  IF FOUND THEN
    IF previous.payload<>p_body THEN RAISE EXCEPTION 'admin request conflict' USING ERRCODE='23505'; END IF;
    IF op='recover_legacy' THEN
      SELECT * INTO recovered_controller FROM private.sc004_controllers WHERE match_id=(previous.receipt->>'match_id')::uuid FOR UPDATE;
      IF NOT FOUND OR recovered_controller.revoked_at IS NOT NULL OR recovered_controller.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'recovered controller unavailable' USING ERRCODE='42501'; END IF;
      IF recovered_controller.token_hash IS DISTINCT FROM p_issue_hash THEN RAISE EXCEPTION 'recovery issuance changed' USING ERRCODE='23505'; END IF;
    END IF;
    RETURN previous.receipt;
  END IF;
  uid:=coalesce(p_body->>'player_id',p_body->>'id')::uuid;
  gid:=(p_body->>'game_id')::uuid;
  scope:=p_body->>'scope';
  IF op='recover_legacy' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('operation','request_id','match_id','target_wins','mode','rules')) OR coalesce(p_issue_hash,'')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid legacy recovery' USING ERRCODE='22023'; END IF;
    mid:=(p_body->>'match_id')::uuid;
    -- Only an enrolled owner may recover an actual saved scope. Never create
    -- history or wins from the browser's unfinished board/cache.
    SELECT * INTO m FROM public.matches WHERE id=mid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'saved match not found' USING ERRCODE='P0002'; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_controllers WHERE match_id=mid) THEN RAISE EXCEPTION 'match already has a controller' USING ERRCODE='23505'; END IF;
    IF jsonb_typeof(m.players) IS DISTINCT FROM 'array' OR jsonb_array_length(m.players) NOT BETWEEN 1 AND 5 OR jsonb_typeof(m.history) IS DISTINCT FROM 'array' OR jsonb_typeof(m.wins) IS DISTINCT FROM 'array' OR jsonb_array_length(m.wins)<>jsonb_array_length(m.players) THEN RAISE EXCEPTION 'unsupported saved match shape' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.games WHERE match_id=mid AND (NOT finished OR archived_at IS NOT NULL)) THEN RAISE EXCEPTION 'saved match requires owner repair' USING ERRCODE='22023'; END IF;
    SELECT coalesce(max(game_number),0)+1 INTO next_game FROM public.games WHERE match_id=mid;
    IF next_game>99 OR jsonb_array_length(m.history)<>next_game-1 OR (SELECT count(*) FROM public.games WHERE match_id=mid)<>next_game-1 THEN RAISE EXCEPTION 'saved game sequence cannot be reconciled' USING ERRCODE='22023'; END IF;
    target:=coalesce(m.target_wins,(p_body->>'target_wins')::integer);
    IF m.target_wins IS NOT NULL AND p_body ? 'target_wins' AND (p_body->>'target_wins')::integer IS DISTINCT FROM m.target_wins THEN RAISE EXCEPTION 'saved first-to setting cannot change' USING ERRCODE='22023'; END IF;
    IF target IS NULL OR target NOT IN (1,3,5) OR EXISTS(SELECT 1 FROM jsonb_array_elements(m.wins) w WHERE (w::text)::integer>=target OR (w::text)::integer<0) THEN RAISE EXCEPTION 'saved match is complete or needs owner settings repair' USING ERRCODE='22023'; END IF;
    SELECT * INTO g FROM public.games WHERE match_id=mid ORDER BY game_number DESC LIMIT 1;
    mode:=CASE WHEN g.mode='unofficial' OR g.state->>'mode'='turbo' THEN 'turbo' WHEN g.mode='practice' OR g.is_practice OR m.mode='practice' OR m.is_practice OR jsonb_array_length(m.players)=1 THEN 'practice' ELSE 'official' END;
    SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb) INTO rules FROM jsonb_each(coalesce(g.state,'{}'::jsonb)) e(k,v) WHERE k IN ('gameFormat','gameVariant','tournament','tournamentType','tournamentRules','strictTimer','throwLimitSeconds','startTarget');
    IF next_game=1 THEN
      IF p_body->>'mode' NOT IN ('official','practice','turbo','vs_shadow') OR p_body->>'mode' IS NULL OR jsonb_typeof(p_body->'rules') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'owner must confirm unsaved pending settings' USING ERRCODE='22023'; END IF;
      mode:=p_body->>'mode';rules:=p_body->'rules';
    ELSE
      IF p_body ? 'mode' AND p_body->>'mode' IS DISTINCT FROM mode THEN RAISE EXCEPTION 'saved mode cannot change' USING ERRCODE='22023'; END IF;
      IF p_body ? 'rules' AND p_body->'rules' IS DISTINCT FROM rules THEN RAISE EXCEPTION 'saved rules cannot change' USING ERRCODE='22023'; END IF;
    END IF;
    IF (mode IN ('official','turbo') AND jsonb_array_length(m.players)<2) OR (mode='vs_shadow' AND jsonb_array_length(m.players)<>1) THEN RAISE EXCEPTION 'saved roster does not fit mode' USING ERRCODE='22023'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(m.players) LOOP
      nm:=CASE WHEN jsonb_typeof(item)='string' THEN item#>>'{}' ELSE item->>'name' END;
      uid:=coalesce(item->>'id',item->>'player_id')::uuid;
      IF uid IS NULL THEN SELECT id INTO uid FROM public.players WHERE name=nm AND deleted_at IS NULL; END IF;
      IF uid IS NULL THEN
        IF mode='official' OR length(coalesce(nm,'')) NOT BETWEEN 1 AND 80 OR lower(nm) IN ('shadow','vs shadow') THEN RAISE EXCEPTION 'saved roster needs owner repair' USING ERRCODE='22023'; END IF;
        roster:=roster||jsonb_build_array(jsonb_build_object('id',NULL,'name',nm));
      ELSE
        SELECT * INTO player FROM public.players WHERE id=uid AND deleted_at IS NULL;
        IF NOT FOUND OR player.name IS DISTINCT FROM nm THEN RAISE EXCEPTION 'saved roster needs owner repair' USING ERRCODE='22023'; END IF;
        roster:=roster||jsonb_build_array(jsonb_build_object('id',player.id,'name',player.name));
      END IF;
    END LOOP;
    IF (SELECT count(DISTINCT coalesce(value->>'id',lower(value->>'name'))) FROM jsonb_array_elements(roster))<>jsonb_array_length(roster) THEN RAISE EXCEPTION 'duplicate saved roster' USING ERRCODE='22023'; END IF;
    PERFORM private.sc004_validate_rules(rules);
    INSERT INTO private.sc004_controllers(match_id,token_hash,mode,single_game,roster,rules) VALUES(mid,p_issue_hash,mode,target=1,roster,rules) RETURNING * INTO recovered_controller;
    IF m.target_wins IS NULL THEN UPDATE public.matches SET target_wins=target WHERE id=mid; END IF;
    -- Historical slots make the next reservation sequence deterministic. They
    -- preserve accepted public records and cannot be overwritten by completion.
    INSERT INTO private.sc004_slots(game_id,match_id,game_number,status,payload,receipt)
      SELECT h.id,mid,h.game_number,'completed',jsonb_build_object('match_id',mid,'game_id',h.id,'state',h.state,'totals',to_jsonb(h.totals),'stats',h.stats),jsonb_build_object('ok',true,'id',h.id,'game_id',h.id,'match_id',mid,'game_number',h.game_number,'created_at',h.created_at)
      FROM public.games h WHERE h.match_id=mid;
    INSERT INTO private.sc004_slots(match_id,game_number) VALUES(mid,next_game) RETURNING game_id INTO gid;
    result:=jsonb_build_object('ok',true,'recovered',true,'match_id',mid,'game_id',gid,'game_number',next_game,'roster',roster,'wins',m.wins,'history',m.history,'target_wins',target,'mode',mode,'match_format',CASE WHEN recovered_controller.single_game THEN 'single' ELSE 'series' END,'rules',rules,'expires_at',recovered_controller.expires_at);
  ELSIF op IN ('archive','reinstate','purge') THEN
    IF gid IS NULL AND p_body->>'timestamp' IS NOT NULL THEN
      SELECT count(*) INTO n FROM public.games WHERE created_at=(p_body->>'timestamp')::timestamptz;
      IF n<>1 THEN RAISE EXCEPTION 'timestamp must identify exactly one game' USING ERRCODE='22023'; END IF;
      SELECT id INTO gid FROM public.games WHERE created_at=(p_body->>'timestamp')::timestamptz;
    END IF;
    PERFORM 1 FROM private.sc004_controllers WHERE match_id=(SELECT match_id FROM public.games WHERE id=gid) ORDER BY match_id FOR UPDATE;
    SELECT * INTO g FROM public.games WHERE id=gid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'game not found' USING ERRCODE='P0002'; END IF;
    UPDATE private.sc004_controllers SET revoked_at=clock_timestamp() WHERE match_id=g.match_id AND revoked_at IS NULL;
    IF op='archive' THEN UPDATE public.games SET archived_at=clock_timestamp() WHERE id=gid;
    ELSIF op='reinstate' THEN UPDATE public.games SET archived_at=NULL WHERE id=gid;
    ELSE
      DELETE FROM public.game_events WHERE game_id=gid;DELETE FROM public.game_commentary WHERE game_id=gid;DELETE FROM public.player_go_events WHERE game_id=gid;
      DELETE FROM public.games WHERE id=gid;
    END IF;
    result:=jsonb_build_object('ok',true,'game_id',gid);
  ELSIF op IN ('update_player','delete_player','archive_player','rename_merge') THEN
    IF uid IS NULL THEN
      nm:=coalesce(p_body->>'player_name',p_body->>'old_name');
      SELECT count(*) INTO n FROM public.players WHERE lower(name)=lower(nm);
      IF n<>1 THEN RAISE EXCEPTION 'player key must be unambiguous' USING ERRCODE='22023'; END IF;
      SELECT id INTO uid FROM public.players WHERE lower(name)=lower(nm);
    END IF;
    PERFORM 1 FROM private.sc004_controllers c WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(c.roster) p WHERE p->>'id'=uid::text OR lower(p->>'name')=lower(coalesce(p_body->>'new_name',p_body->'profile'->>'name'))) ORDER BY c.match_id FOR UPDATE;
    SELECT * INTO player FROM public.players WHERE id=uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'player not found' USING ERRCODE='P0002'; END IF;
    IF op='archive_player' OR op='delete_player' THEN
      INSERT INTO public.players_archive(player_id,player_name,reason,payload) VALUES(uid,player.name,left(coalesce(p_body->>'reason',op),80),to_jsonb(player));
      IF op='delete_player' THEN
        UPDATE public.players SET deleted_at=clock_timestamp() WHERE id=uid;
        UPDATE private.sc004_controllers c SET revoked_at=clock_timestamp() WHERE c.revoked_at IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.roster) p WHERE p->>'id'=uid::text);
      END IF;
    ELSIF op='rename_merge' THEN uid:=private.sc004_rename_player(uid,p_body->>'new_name');
    ELSE
      profile:=p_body->'profile';
      IF jsonb_typeof(profile) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(profile) k WHERE k NOT IN ('name','first_name','last_name','nickname','initials','avatar_id','deleted_at')) THEN RAISE EXCEPTION 'invalid profile patch' USING ERRCODE='22023'; END IF;
      IF length(coalesce(profile->>'initials',''))>5 OR length(coalesce(profile->>'first_name',''))>80 OR length(coalesce(profile->>'last_name',''))>80 OR length(coalesce(profile->>'nickname',''))>80 THEN RAISE EXCEPTION 'profile field too long' USING ERRCODE='22023'; END IF;
      IF profile ? 'name' AND profile->>'name' IS DISTINCT FROM player.name THEN uid:=private.sc004_rename_player(uid,profile->>'name'); END IF;
      UPDATE public.players SET
        first_name=CASE WHEN profile ? 'first_name' THEN profile->>'first_name' ELSE first_name END,
        last_name=CASE WHEN profile ? 'last_name' THEN profile->>'last_name' ELSE last_name END,
        nickname=CASE WHEN profile ? 'nickname' THEN profile->>'nickname' ELSE nickname END,
        initials=CASE WHEN profile ? 'initials' THEN profile->>'initials' ELSE initials END,
        avatar_id=CASE WHEN profile ? 'avatar_id' THEN (profile->>'avatar_id')::smallint ELSE avatar_id END,
        deleted_at=CASE WHEN profile ? 'deleted_at' THEN (profile->>'deleted_at')::timestamptz ELSE deleted_at END WHERE id=uid;
    END IF;
    SELECT * INTO player FROM public.players WHERE id=uid;
    result:=jsonb_build_object('ok',true,'player',to_jsonb(player),'player_id',uid);
  ELSIF op='remove_game_player' THEN
    PERFORM 1 FROM private.sc004_controllers WHERE match_id=(SELECT match_id FROM public.games WHERE id=gid) ORDER BY match_id FOR UPDATE;
    SELECT * INTO g FROM public.games WHERE id=gid FOR UPDATE;
    IF NOT FOUND OR uid IS NULL THEN RAISE EXCEPTION 'game and player required' USING ERRCODE='P0002'; END IF;
    SELECT (ord-1)::integer INTO idx FROM jsonb_array_elements(g.state->'players') WITH ORDINALITY x(p,ord)
      WHERE p->>'id'=uid::text OR p->>'player_id'=uid::text OR p->>'name'=p_body->>'player_name' LIMIT 1;
    IF jsonb_typeof(g.state->'board')='array' AND jsonb_array_length(g.state->'board')<>jsonb_array_length(g.state->'players') THEN RAISE EXCEPTION 'unknown historical board layout' USING ERRCODE='22023'; END IF;
    IF idx IS NULL THEN RAISE EXCEPTION 'player not present in game' USING ERRCODE='22023'; END IF;
    UPDATE private.sc004_controllers SET revoked_at=clock_timestamp() WHERE match_id=g.match_id AND revoked_at IS NULL;
    FOR key IN SELECT unnest(ARRAY['players','player_ids','playerIds','names','board']) LOOP
      IF jsonb_typeof(g.state->key)='array' THEN g.state:=jsonb_set(g.state,ARRAY[key],(g.state->key)-idx); END IF;
    END LOOP;
    IF jsonb_typeof(g.stats)='object' THEN
      FOR key IN SELECT unnest(ARRAY['players','player_ids','playerIds','names','perPlayer']) LOOP
        IF jsonb_typeof(g.stats->key)='array' THEN g.stats:=jsonb_set(g.stats,ARRAY[key],(g.stats->key)-idx); END IF;
      END LOOP;
    END IF;
    UPDATE public.games SET state=g.state,stats=g.stats,totals=ARRAY(SELECT value::text::integer FROM jsonb_array_elements(to_jsonb(g.totals)-idx)) WHERE id=gid;
    DELETE FROM public.high_scores WHERE game_id=gid AND player_id=uid;DELETE FROM public.high_scores_sp WHERE game_id=gid AND player_id=uid;
    DELETE FROM public.player_go_events WHERE game_id=gid AND player_id=uid;
    result:=jsonb_build_object('ok',true,'game_id',gid,'player_id',uid);
  ELSIF op IN ('delete_score','dedupe_scores') THEN
    IF scope NOT IN ('league','practice') OR scope IS NULL THEN RAISE EXCEPTION 'invalid score scope' USING ERRCODE='22023'; END IF;
    sql_table:=CASE WHEN scope='league' THEN 'high_scores_sp' ELSE 'high_scores' END;
    IF op='dedupe_scores' THEN
      EXECUTE format('DELETE FROM public.%I WHERE id IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY lower(name),score ORDER BY ts,id) rn FROM public.%I) d WHERE rn>1)',sql_table,sql_table);
    ELSE
      IF p_body->>'score_id' IS NOT NULL THEN
        EXECUTE format('DELETE FROM public.%I WHERE id=$1',sql_table) USING (p_body->>'score_id')::bigint;
      ELSE
        IF (gid IS NULL AND p_body->>'timestamp' IS NULL) OR p_body->>'name' IS NULL OR p_body->>'score' IS NULL THEN RAISE EXCEPTION 'exact score identity required' USING ERRCODE='22023'; END IF;
        EXECUTE format('DELETE FROM public.%I WHERE name=$1 AND score=$2 AND ($3 IS NULL OR game_id=$3) AND ($4 IS NULL OR ts=$4)',sql_table)
          USING p_body->>'name',(p_body->>'score')::integer,gid,(p_body->>'timestamp')::timestamptz;
      END IF;
    END IF;
    GET DIAGNOSTICS changed=ROW_COUNT;result:=jsonb_build_object('ok',true,'deleted',changed);
  ELSIF op IN ('ensure_score','rebuild_scores','recover_scores') THEN
    IF scope IS NOT NULL AND scope NOT IN ('league','practice') THEN RAISE EXCEPTION 'invalid score scope' USING ERRCODE='22023'; END IF;
    IF op='ensure_score' THEN
      IF gid IS NULL THEN
        IF uid IS NULL AND p_body->>'player_name' IS NOT NULL THEN
          IF (SELECT count(*) FROM public.players WHERE name=p_body->>'player_name')<>1 THEN RAISE EXCEPTION 'saved player required' USING ERRCODE='22023'; END IF;
          SELECT id INTO uid FROM public.players WHERE name=p_body->>'player_name';
        END IF;
        SELECT count(*),min(q.id::text)::uuid INTO n,gid FROM public.games q WHERE q.finished AND q.archived_at IS NULL AND (p_body->>'timestamp' IS NULL OR q.created_at=(p_body->>'timestamp')::timestamptz)
          AND EXISTS(SELECT 1 FROM jsonb_array_elements(q.state->'players') WITH ORDINALITY x(p,ord) WHERE (p->>'id'=uid::text OR p->>'player_id'=uid::text) AND q.totals[ord::integer]=(p_body->>'score')::integer);
        IF n<>1 THEN RAISE EXCEPTION 'score must identify exactly one saved game' USING ERRCODE='22023'; END IF;
      END IF;
      total:=private.sc004_ensure_scores(gid,scope,uid);n:=1;
    ELSE
      n:=0;
      FOR gid IN SELECT id FROM public.games WHERE finished AND archived_at IS NULL
        AND (op<>'recover_scores' OR created_at>=clock_timestamp()-make_interval(hours=>least(8760,greatest(1,coalesce((p_body->>'hours')::integer,24)))))
        ORDER BY created_at DESC LIMIT least(50000,greatest(250,coalesce((p_body->>'max_games')::integer,50000))) LOOP
        n:=n+1;total:=total+private.sc004_ensure_scores(gid,scope,NULL);
      END LOOP;
    END IF;
    result:=jsonb_build_object('ok',true,'inserted',total,'scanned',n,'skipped',greatest(0,n-total));
  ELSIF op='import_match' THEN
    payload:=p_body->'match';mid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
    IF jsonb_typeof(payload->'players') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'wins') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'history') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid match import' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.matches WHERE id=mid) THEN
      IF NOT EXISTS(SELECT 1 FROM public.matches WHERE id=mid AND players=payload->'players' AND wins=payload->'wins' AND history=payload->'history') THEN RAISE EXCEPTION 'existing match import conflicts with saved truth' USING ERRCODE='23505'; END IF;
      changed:=0;
    ELSE
      INSERT INTO public.matches(id,created_at,total_games,players,wins,history) VALUES(mid,coalesce((payload->>'created_at')::timestamptz,clock_timestamp()),greatest(1,coalesce((payload->>'total_games')::integer,1)),payload->'players',payload->'wins',payload->'history');changed:=1;
    END IF;
    result:=jsonb_build_object('ok',true,'match_id',mid,'inserted',changed);
  ELSIF op='import_game' THEN
    payload:=p_body->'game';
    IF jsonb_typeof(payload->'state'->'players') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'totals') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid game import' USING ERRCODE='22023'; END IF;
    ts:=coalesce((payload->>'created_at')::timestamptz,clock_timestamp());
    SELECT id INTO gid FROM public.games WHERE created_at=ts AND state->'players'=payload->'state'->'players' AND state->'board'=payload->'state'->'board' AND to_jsonb(totals)=payload->'totals' LIMIT 1;
    IF gid IS NOT NULL THEN result:=jsonb_build_object('ok',true,'game_id',gid,'inserted',0);
    ELSE
    mid:=nullif(payload->>'match_id','')::uuid;
    IF mid IS NULL THEN mid:=gen_random_uuid(); END IF;
    IF NOT EXISTS(SELECT 1 FROM public.matches WHERE id=mid) THEN
      INSERT INTO public.matches(id,created_at,total_games,players,wins,history) VALUES(mid,ts,1,payload->'state'->'players','[]','[]');
    END IF;
    INSERT INTO public.games(id,match_id,game_number,created_at,state,totals,finished,mode,is_practice)
      VALUES(gen_random_uuid(),mid,coalesce((payload->>'game_number')::integer,1),ts,payload->'state',ARRAY(SELECT value::text::integer FROM jsonb_array_elements(payload->'totals')),true,
        CASE WHEN payload->'state'->>'mode'='turbo' THEN 'unofficial' WHEN payload->'state'->>'mode'='practice' OR jsonb_array_length(payload->'state'->'players')<2 THEN 'practice' ELSE 'official' END,
        coalesce(payload->'state'->>'mode'='practice',false) OR jsonb_array_length(payload->'state'->'players')<2) RETURNING id INTO gid;
    total:=private.sc004_ensure_scores(gid,NULL,NULL);
    result:=jsonb_build_object('ok',true,'game_id',gid,'match_id',mid,'inserted',1,'high_scores',total);
    END IF;
  ELSE RAISE EXCEPTION 'unsupported admin operation' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.sc004_admin_audit(user_id,session_id,action,object_id) VALUES(p_admin_user,p_admin_session,op,coalesce(gid,uid,mid));
  INSERT INTO private.sc004_admin_requests(user_id,request_id,payload,receipt) VALUES(p_admin_user,rid,p_body,result);
  RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_admin(jsonb,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_admin(jsonb,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.sq_sc004_authorize_game(p_hash text,p_game uuid,p_admin_user uuid,p_admin_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $f$
DECLARE c private.sc004_controllers; s private.sc004_slots; roster jsonb;
BEGIN
  IF coalesce((SELECT held FROM private.sc004_write_control WHERE singleton),true) THEN RAISE EXCEPTION 'writes held' USING ERRCODE='55000'; END IF;
  IF p_hash IS NOT NULL THEN
    SELECT ct.* INTO c FROM private.sc004_controllers ct JOIN private.sc004_slots sl ON sl.match_id=ct.match_id
      WHERE sl.game_id=p_game AND ct.token_hash=p_hash AND ct.revoked_at IS NULL AND ct.expires_at>clock_timestamp() FOR UPDATE OF ct;
    IF NOT FOUND THEN RAISE EXCEPTION 'game controller denied' USING ERRCODE='42501'; END IF;
    SELECT * INTO s FROM private.sc004_slots WHERE game_id=p_game AND match_id=c.match_id AND status<>'cleaned';
    IF NOT FOUND THEN RAISE EXCEPTION 'game scope denied' USING ERRCODE='42501'; END IF;
    IF s.status='completed' AND NOT EXISTS(SELECT 1 FROM public.games WHERE id=p_game AND archived_at IS NULL) THEN RAISE EXCEPTION 'game unavailable' USING ERRCODE='42501'; END IF;
    roster:=CASE WHEN s.status='completed' THEN s.payload->'state'->'players' ELSE c.roster END;
  ELSE
    PERFORM 1 FROM private.sc004_admins a JOIN auth.users u ON u.id=a.user_id JOIN auth.sessions se ON se.user_id=u.id AND se.id=p_admin_session
      WHERE a.user_id=p_admin_user AND a.enabled AND a.revoked_at IS NULL AND NOT coalesce(u.is_anonymous,true) AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (se.not_after IS NULL OR se.not_after>clock_timestamp());
    IF NOT FOUND THEN RAISE EXCEPTION 'admin denied' USING ERRCODE='42501'; END IF;
    SELECT state->'players' INTO roster FROM public.games WHERE id=p_game AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'game not found' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'game_id',p_game,'roster',roster);
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_authorize_game(text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_authorize_game(text,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sq_sc004_commentary_claim(p_hash text,p_game uuid,p_kind text,p_admin_user uuid,p_admin_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $f$
DECLARE authority jsonb; claim private.sc004_commentary_claims;
BEGIN
  authority:=public.sq_sc004_authorize_game(p_hash,p_game,p_admin_user,p_admin_session);
  IF p_kind NOT IN ('studio_intro','studio_outro') THEN RAISE EXCEPTION 'invalid commentary kind' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_game::text||p_kind));
  IF EXISTS(SELECT 1 FROM public.game_commentary WHERE game_id=p_game AND meta->>'kind'=p_kind) THEN RETURN jsonb_build_object('ok',true,'skipped',true); END IF;
  SELECT * INTO claim FROM private.sc004_commentary_claims WHERE game_id=p_game AND kind=p_kind FOR UPDATE;
  IF FOUND AND (claim.status='done' OR claim.expires_at>clock_timestamp()) THEN RETURN jsonb_build_object('ok',true,'skipped',true); END IF;
  INSERT INTO private.sc004_commentary_claims(game_id,kind,actor_hash,admin_user,admin_session) VALUES(p_game,p_kind,p_hash,p_admin_user,p_admin_session)
    ON CONFLICT(game_id,kind) DO UPDATE SET claim_id=gen_random_uuid(),actor_hash=EXCLUDED.actor_hash,admin_user=EXCLUDED.admin_user,admin_session=EXCLUDED.admin_session,status='pending',expires_at=clock_timestamp()+interval '10 minutes' RETURNING * INTO claim;
  RETURN authority||jsonb_build_object('claim_id',claim.claim_id,'kind',p_kind);
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_commentary_claim(text,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_commentary_claim(text,uuid,text,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sq_sc004_commentary_commit(p_claim uuid,p_lines jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $f$
DECLARE claim private.sc004_commentary_claims; line jsonb;
BEGIN
  IF coalesce((SELECT held FROM private.sc004_write_control WHERE singleton),true) THEN RAISE EXCEPTION 'writes held' USING ERRCODE='55000'; END IF;
  SELECT * INTO claim FROM private.sc004_commentary_claims WHERE claim_id=p_claim AND status='pending' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'claim denied' USING ERRCODE='42501'; END IF;
  -- Recheck the actor after the asynchronous model call. Lock controller before
  -- claim to retain the same lock order as issuance and avoid deadlocks.
  PERFORM public.sq_sc004_authorize_game(claim.actor_hash,claim.game_id,claim.admin_user,claim.admin_session);
  SELECT * INTO claim FROM private.sc004_commentary_claims WHERE claim_id=p_claim AND status='pending' AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines) NOT BETWEEN 3 AND 5 THEN RAISE EXCEPTION 'invalid lines' USING ERRCODE='22023'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF jsonb_typeof(line)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(line) k WHERE k NOT IN ('speaker','text','intensity')) OR line->>'speaker' NOT IN ('SARAH','WADE','MICKY') OR length(trim(coalesce(line->>'text',''))) NOT BETWEEN 1 AND 180 OR (line->>'intensity')::integer NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid line' USING ERRCODE='22023'; END IF;
    INSERT INTO public.game_commentary(game_id,line,kind,meta) VALUES(claim.game_id,line->>'speaker'||': '||trim(line->>'text'),'studio',jsonb_build_object('kind',claim.kind,'speaker',line->>'speaker','intensity',(line->>'intensity')::integer));
  END LOOP;
  UPDATE private.sc004_commentary_claims SET status='done' WHERE claim_id=p_claim;
  RETURN jsonb_build_object('ok',true,'inserted',jsonb_array_length(p_lines));
END $f$;
REVOKE ALL ON FUNCTION public.sq_sc004_commentary_commit(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sq_sc004_commentary_commit(uuid,jsonb) TO service_role;

DROP FUNCTION IF EXISTS public.sq_sc004_admin(jsonb,uuid,uuid);
COMMIT;
