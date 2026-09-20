-- SC-040 rollback. Destructive to avatar selections only; no game/history/scoring data is touched.
alter table public.players drop column if exists avatar_key;
