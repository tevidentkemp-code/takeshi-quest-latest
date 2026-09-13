-- SC-031: additive admin security foundation.
-- Safe to apply before app cutover: no existing gameplay/admin RLS policy is removed here.
-- Plaintext admin passcode is intentionally NOT stored in this repository or migration.

begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.sq_admin_config (
  id smallint primary key check (id = 1),
  pin_hash text not null,
  session_minutes integer not null default 15 check (session_minutes between 5 and 60),
  max_failures integer not null default 5 check (max_failures between 3 and 20),
  window_minutes integer not null default 15 check (window_minutes between 1 and 120),
  lock_minutes integer not null default 30 check (lock_minutes between 1 and 240),
  updated_at timestamptz not null default now()
);

insert into private.sq_admin_config
  (id, pin_hash, session_minutes, max_failures, window_minutes, lock_minutes, updated_at)
values
  (1, '$2a$12$4.WlIXsGxtDkOFwX8/unoOtRR2hxZmwmlzIBe6l4HD/YwoWmcrUqq', 15, 5, 15, 30, now())
on conflict (id) do update set
  pin_hash = excluded.pin_hash,
  session_minutes = excluded.session_minutes,
  max_failures = excluded.max_failures,
  window_minutes = excluded.window_minutes,
  lock_minutes = excluded.lock_minutes,
  updated_at = now();

create table if not exists private.sq_admin_attempts (
  client_hash text primary key,
  window_started timestamptz not null,
  fail_count integer not null default 0 check (fail_count >= 0),
  locked_until timestamptz,
  last_attempt timestamptz not null default now()
);

create table if not exists private.sq_admin_audit (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  action text not null,
  object_id text,
  client_hash text,
  success boolean not null,
  detail text
);

revoke all on all tables in schema private from public;
revoke all on all tables in schema private from anon;
revoke all on all tables in schema private from authenticated;
revoke all on all sequences in schema private from public;
revoke all on all sequences in schema private from anon;
revoke all on all sequences in schema private from authenticated;

create or replace function public.sq_admin_authorize(p_pin text, p_client_key text)
returns table (
  ok boolean,
  retry_after_seconds integer,
  session_minutes integer,
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  cfg private.sq_admin_config%rowtype;
  attempt private.sq_admin_attempts%rowtype;
  v_now timestamptz := clock_timestamp();
  v_client_hash text;
  v_has_attempt boolean := false;
  v_matches boolean := false;
  v_fail_count integer := 0;
  v_locked_until timestamptz := null;
  v_retry integer := 0;
begin
  select * into cfg
  from private.sq_admin_config
  where id = 1;

  if not found then
    return query select false, 0, 0, 'unconfigured'::text;
    return;
  end if;

  v_client_hash := encode(
    extensions.digest(coalesce(nullif(p_client_key, ''), 'unknown'), 'sha256'),
    'hex'
  );

  select * into attempt
  from private.sq_admin_attempts
  where client_hash = v_client_hash
  for update;
  v_has_attempt := found;

  if v_has_attempt
     and attempt.window_started < v_now - make_interval(mins => cfg.window_minutes) then
    delete from private.sq_admin_attempts where client_hash = v_client_hash;
    v_has_attempt := false;
  end if;

  if v_has_attempt and attempt.locked_until is not null and attempt.locked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (attempt.locked_until - v_now)))::integer);
    insert into private.sq_admin_audit(action, object_id, client_hash, success, detail)
    values ('authorize', null, v_client_hash, false, 'locked');
    return query select false, v_retry, 0, 'locked'::text;
    return;
  end if;

  v_matches := extensions.crypt(coalesce(p_pin, ''), cfg.pin_hash) = cfg.pin_hash;

  if v_matches then
    delete from private.sq_admin_attempts where client_hash = v_client_hash;
    insert into private.sq_admin_audit(action, object_id, client_hash, success, detail)
    values ('authorize', null, v_client_hash, true, null);
    return query select true, 0, cfg.session_minutes, 'ok'::text;
    return;
  end if;

  if v_has_attempt then
    v_fail_count := attempt.fail_count + 1;
    if v_fail_count >= cfg.max_failures then
      v_locked_until := v_now + make_interval(mins => cfg.lock_minutes);
    end if;
    update private.sq_admin_attempts
      set fail_count = v_fail_count,
          locked_until = v_locked_until,
          last_attempt = v_now
      where client_hash = v_client_hash;
  else
    v_fail_count := 1;
    if v_fail_count >= cfg.max_failures then
      v_locked_until := v_now + make_interval(mins => cfg.lock_minutes);
    end if;
    insert into private.sq_admin_attempts
      (client_hash, window_started, fail_count, locked_until, last_attempt)
    values
      (v_client_hash, v_now, v_fail_count, v_locked_until, v_now);
  end if;

  if v_locked_until is not null then
    v_retry := greatest(1, ceil(extract(epoch from (v_locked_until - v_now)))::integer);
  end if;

  insert into private.sq_admin_audit(action, object_id, client_hash, success, detail)
  values ('authorize', null, v_client_hash, false,
          case when v_locked_until is null then 'invalid' else 'locked' end);

  return query select false, v_retry, 0,
    case when v_locked_until is null then 'unauthorized'::text else 'locked'::text end;
end;
$$;

create or replace function public.sq_admin_log_action(
  p_action text,
  p_object_id text,
  p_client_key text,
  p_success boolean,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_client_hash text;
begin
  v_client_hash := encode(
    extensions.digest(coalesce(nullif(p_client_key, ''), 'unknown'), 'sha256'),
    'hex'
  );
  insert into private.sq_admin_audit(action, object_id, client_hash, success, detail)
  values (
    left(coalesce(p_action, 'unknown'), 80),
    left(p_object_id, 120),
    v_client_hash,
    coalesce(p_success, false),
    left(p_detail, 500)
  );
end;
$$;

create or replace function public.sq_admin_archive_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.games
     set archived_at = clock_timestamp()
   where id = p_game_id;
  return found;
end;
$$;

create or replace function public.sq_admin_reinstate_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.games
     set archived_at = null
   where id = p_game_id;
  return found;
end;
$$;

create or replace function public.sq_admin_purge_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform 1 from public.games where id = p_game_id for update;
  if not found then
    return false;
  end if;

  -- Preserve the existing client purge semantics, but execute atomically.
  delete from public.game_events where game_id = p_game_id;
  delete from public.game_commentary where game_id = p_game_id;
  -- high_scores/high_scores_sp are ON DELETE CASCADE from games.
  delete from public.games where id = p_game_id;
  return true;
end;
$$;

create or replace function public.sq_admin_delete_high_score(
  p_scope text,
  p_game_id uuid,
  p_name text,
  p_score integer,
  p_ts timestamptz
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer := 0;
  v_scope text := lower(trim(coalesce(p_scope, '')));
begin
  if v_scope not in ('practice', 'league') then
    raise exception 'invalid high-score scope' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'missing high-score name' using errcode = '22023';
  end if;
  if p_game_id is null and p_ts is null then
    raise exception 'high-score delete requires game_id or timestamp' using errcode = '22023';
  end if;

  if v_scope = 'practice' then
    delete from public.high_scores
     where name = p_name
       and score = p_score
       and (p_game_id is null or game_id = p_game_id)
       and (p_ts is null or ts = p_ts);
    get diagnostics v_deleted = row_count;

    if v_deleted = 0 and p_ts is not null then
      delete from public.high_scores
       where name = p_name
         and score = p_score
         and (p_game_id is null or game_id = p_game_id)
         and ts between (p_ts - interval '2 minutes') and (p_ts + interval '2 minutes');
      get diagnostics v_deleted = row_count;
    end if;
  else
    delete from public.high_scores_sp
     where name = p_name
       and score = p_score
       and (p_game_id is null or game_id = p_game_id)
       and (p_ts is null or ts = p_ts);
    get diagnostics v_deleted = row_count;

    if v_deleted = 0 and p_ts is not null then
      delete from public.high_scores_sp
       where name = p_name
         and score = p_score
         and (p_game_id is null or game_id = p_game_id)
         and ts between (p_ts - interval '2 minutes') and (p_ts + interval '2 minutes');
      get diagnostics v_deleted = row_count;
    end if;
  end if;

  return v_deleted;
end;
$$;

revoke execute on function public.sq_admin_authorize(text, text) from public, anon, authenticated;
revoke execute on function public.sq_admin_log_action(text, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.sq_admin_archive_game(uuid) from public, anon, authenticated;
revoke execute on function public.sq_admin_reinstate_game(uuid) from public, anon, authenticated;
revoke execute on function public.sq_admin_purge_game(uuid) from public, anon, authenticated;
revoke execute on function public.sq_admin_delete_high_score(text, uuid, text, integer, timestamptz) from public, anon, authenticated;

grant execute on function public.sq_admin_authorize(text, text) to service_role;
grant execute on function public.sq_admin_log_action(text, text, text, boolean, text) to service_role;
grant execute on function public.sq_admin_archive_game(uuid) to service_role;
grant execute on function public.sq_admin_reinstate_game(uuid) to service_role;
grant execute on function public.sq_admin_purge_game(uuid) to service_role;
grant execute on function public.sq_admin_delete_high_score(text, uuid, text, integer, timestamptz) to service_role;

comment on function public.sq_admin_authorize(text, text) is 'SC-031 service-role-only server-side admin passcode verifier with lockout.';
comment on function public.sq_admin_purge_game(uuid) is 'SC-031 service-role-only atomic equivalent of the existing admin game purge path.';

commit;
