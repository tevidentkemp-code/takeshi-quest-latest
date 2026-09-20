-- Run only with explicit approval AFTER reverting the avatar client.
-- Export id, avatar_id first: dropping this column discards selected avatars.
-- RESTRICT (default) deliberately refuses unexpected dependent objects.
begin;
set local lock_timeout = '5s';
alter table public.players drop column if exists avatar_id;
commit;
