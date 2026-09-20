-- SC-040 rollback evidence — DO NOT AUTO-RUN.
-- Apply only if explicitly approved during recovery.
-- Effect: removes avatar selections only; no game, score, ranking or XP data is touched.

alter table public.players drop column if exists avatar_key;
