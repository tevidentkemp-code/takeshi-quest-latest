-- A trusted operational hold pauses credentials valid when the hold began.
-- Revoked credentials and credentials already expired before the hold stay denied.
ALTER TABLE private.sc004_write_control ADD COLUMN held_at timestamptz DEFAULT clock_timestamp();
CREATE FUNCTION private.sc004_controller_now() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,private AS $f$
  SELECT CASE WHEN held AND held_at IS NOT NULL THEN held_at ELSE clock_timestamp() END
    FROM private.sc004_write_control WHERE singleton;
$f$;
REVOKE ALL ON FUNCTION private.sc004_controller_now() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sq_sc004_set_hold(p_held boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
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
