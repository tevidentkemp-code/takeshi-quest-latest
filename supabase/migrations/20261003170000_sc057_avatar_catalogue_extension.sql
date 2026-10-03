-- SC-057: accept only the three visually approved appended avatar identities.
-- UNAPPLIED: Thomas's programme RELEASE grant and three-pair artwork approval authorise this extension.
-- Apply and verify the required backend acceptance before selectable IDs reach production.
-- Existing mappings, column shape, defaults, RLS, ACL, policies and player rows stay intact.
begin;
set local lock_timeout = '5s';
lock table public.players in access exclusive mode;

do $sc057$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_avatar_id_range' and contype = 'c' and convalidated
      and pg_get_constraintdef(oid, true) in (
        'CHECK (avatar_id IS NULL OR avatar_id >= 1 AND avatar_id <= 29)',
        'CHECK (avatar_id IS NULL OR avatar_id >= 1 AND avatar_id <= 32)'
      )
  ) then
    raise exception 'SC-057 stopped: the verified avatar range constraint has changed';
  end if;
end;
$sc057$;

alter table public.players drop constraint players_avatar_id_range;
alter table public.players add constraint players_avatar_id_range
  check (avatar_id is null or avatar_id >= 1 and avatar_id <= 32);
comment on column public.players.avatar_id is
  'SC-057 presentation-only avatar catalogue id (1..32). NULL uses deterministic client fallback.';
commit;
