-- Recovery is covered by programme RELEASE authority only while no IDs 30..32 are saved.
-- Any future remap/delete requires a separate hard data decision. Never discard or remap a selected avatar automatically.
-- Revert the client only after considering any saved 30..32 identities.
-- If new identities exist, retain the expanded range/assets and use the documented recovery gate.
begin;
set local lock_timeout = '5s';
lock table public.players in access exclusive mode;

do $sc057$
begin
  if exists (select 1 from public.players where avatar_id > 29) then
    raise exception 'SC-057 rollback blocked: saved appended avatar identities must be preserved';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_avatar_id_range' and contype = 'c' and convalidated
      and pg_get_constraintdef(oid, true) in (
        'CHECK (avatar_id IS NULL OR avatar_id >= 1 AND avatar_id <= 29)',
        'CHECK (avatar_id IS NULL OR avatar_id >= 1 AND avatar_id <= 32)'
      )
  ) then
    raise exception 'SC-057 rollback stopped: the verified avatar range constraint has changed';
  end if;
end;
$sc057$;

alter table public.players drop constraint players_avatar_id_range;
alter table public.players add constraint players_avatar_id_range
  check (avatar_id is null or avatar_id >= 1 and avatar_id <= 29);
comment on column public.players.avatar_id is
  'SC-040 presentation-only avatar catalogue id (1..29). NULL uses deterministic client fallback.';
commit;
