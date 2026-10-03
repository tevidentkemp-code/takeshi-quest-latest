-- Exact current dispatcher; use full function-refresh.sql for coordinated final refresh.
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
