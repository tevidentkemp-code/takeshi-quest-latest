-- SC-040: persistent avatar identity for Shateki players.
-- Presentation-only field; scoring, rankings, XP and historical name keys are untouched.
-- Rollback: ALTER TABLE public.players DROP COLUMN IF EXISTS avatar_id;

alter table public.players add column if not exists avatar_id smallint;
alter table public.players drop constraint if exists players_avatar_id_range;
alter table public.players add constraint players_avatar_id_range
  check (avatar_id is null or avatar_id between 1 and 29);
comment on column public.players.avatar_id is
  'SC-040 presentation-only avatar catalogue id (1..29). NULL uses deterministic client fallback.';
