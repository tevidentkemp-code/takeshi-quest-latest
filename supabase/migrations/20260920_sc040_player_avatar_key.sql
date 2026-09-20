-- SC-040: persistent player avatar identity.
-- Nullable for backward compatibility with every existing player row.
alter table public.players
  add column if not exists avatar_key text;

comment on column public.players.avatar_key is
  'SC-040 presentation identity key (av01..av34). Artwork stays in the app asset catalogue; no image URL is stored in player data.';
