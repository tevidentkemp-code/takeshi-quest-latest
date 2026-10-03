-- Verify authority before any service read, model request or commentary write.
CREATE FUNCTION public.sq_sc004_authorize_game(p_hash text,p_game uuid,p_admin_user uuid,p_admin_session uuid)
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

CREATE FUNCTION public.sq_sc004_commentary_claim(p_hash text,p_game uuid,p_kind text,p_admin_user uuid,p_admin_session uuid)
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

CREATE FUNCTION public.sq_sc004_commentary_commit(p_claim uuid,p_lines jsonb) RETURNS jsonb
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
