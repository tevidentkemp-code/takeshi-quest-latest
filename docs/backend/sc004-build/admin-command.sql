-- SC-004 authenticated administrative boundary. Apply after the base migration.
CREATE TABLE IF NOT EXISTS private.sc004_admin_requests (
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);
ALTER TABLE private.sc004_admin_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.sc004_admin_requests FROM PUBLIC,anon,authenticated;

-- Structural JSON replacement: no raw string replacement or SQL interpolation.
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

-- High-score repair derives identity, score, mode and time from saved truth.
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
  m public.matches; recovered_controller private.sc004_controllers; next_game integer; target integer; mode text; match_format text; rules jsonb; roster jsonb:='[]'::jsonb;
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
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('operation','request_id','match_id','target_wins','mode','match_format','rules')) OR coalesce(p_issue_hash,'')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid legacy recovery' USING ERRCODE='22023'; END IF;
    mid:=(p_body->>'match_id')::uuid;
    -- Only an enrolled owner may recover an actual saved scope. Never create
    -- history or wins from the browser's unfinished board/cache.
    SELECT * INTO m FROM public.matches WHERE id=mid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'saved match not found' USING ERRCODE='P0002'; END IF;
    IF EXISTS(SELECT 1 FROM private.sc004_controllers WHERE match_id=mid) THEN RAISE EXCEPTION 'match already has a controller' USING ERRCODE='23505'; END IF;
    IF jsonb_typeof(m.players) IS DISTINCT FROM 'array' OR jsonb_array_length(m.players) NOT BETWEEN 1 AND 5 OR jsonb_typeof(m.history) IS DISTINCT FROM 'array' OR jsonb_typeof(m.wins) IS DISTINCT FROM 'array' OR jsonb_array_length(m.wins)<>jsonb_array_length(m.players) THEN RAISE EXCEPTION 'unsupported saved match shape' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.games WHERE match_id=mid AND (NOT finished OR archived_at IS NOT NULL)) THEN RAISE EXCEPTION 'saved match requires owner repair' USING ERRCODE='22023'; END IF;
    SELECT coalesce(max(game_number),0)+1 INTO next_game FROM public.games WHERE match_id=mid;
    IF next_game>99 OR jsonb_array_length(m.history)<>next_game-1 OR (SELECT count(*) FROM public.games WHERE match_id=mid)<>next_game-1
      OR (SELECT count(DISTINCT game_number) FROM public.games WHERE match_id=mid)<>next_game-1
      OR EXISTS(SELECT 1 FROM public.games h WHERE h.match_id=mid AND (h.game_number<1 OR jsonb_typeof(m.history->(h.game_number-1)) IS DISTINCT FROM 'object' OR jsonb_typeof(m.history->(h.game_number-1)->'totals') IS DISTINCT FROM 'array' OR m.history->(h.game_number-1)->'totals' IS DISTINCT FROM to_jsonb(h.totals)))
      THEN RAISE EXCEPTION 'saved game sequence cannot be reconciled' USING ERRCODE='22023'; END IF;
    target:=coalesce(m.target_wins,(p_body->>'target_wins')::integer);
    IF m.target_wins IS NOT NULL AND p_body ? 'target_wins' AND (p_body->>'target_wins')::integer IS DISTINCT FROM m.target_wins THEN RAISE EXCEPTION 'saved first-to setting cannot change' USING ERRCODE='22023'; END IF;
    IF target IS NULL OR target NOT IN (1,3,5) OR EXISTS(SELECT 1 FROM jsonb_array_elements(m.wins) w WHERE (w::text)::integer>=target OR (w::text)::integer<0) THEN RAISE EXCEPTION 'saved match is complete or needs owner settings repair' USING ERRCODE='22023'; END IF;
    -- Legacy matches did not persist whether first-to-one was a series or a
    -- single game. Only the verified owner can attest that missing setting.
    match_format:=p_body->>'match_format';
    IF match_format IS NULL OR match_format NOT IN ('single','series') OR (match_format='single' AND (target<>1 OR next_game<>1)) THEN RAISE EXCEPTION 'owner must confirm saved match format' USING ERRCODE='22023'; END IF;
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
    IF mode='vs_shadow' AND match_format<>'single' THEN RAISE EXCEPTION 'shadow recovery must be a single game' USING ERRCODE='22023'; END IF;
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
    INSERT INTO private.sc004_controllers(match_id,token_hash,mode,single_game,roster,rules) VALUES(mid,p_issue_hash,mode,match_format='single',roster,rules) RETURNING * INTO recovered_controller;
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

-- Remove the superseded three-argument overload after installing the trusted interface.
DROP FUNCTION IF EXISTS public.sq_sc004_admin(jsonb,uuid,uuid);
