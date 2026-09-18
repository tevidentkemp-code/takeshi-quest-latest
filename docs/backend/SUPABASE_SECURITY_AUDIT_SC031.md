# SC-031 Supabase Security and Data-Path Audit

**Audit date:** 2026-09-13
**Project:** Shateki-Quest (`vvfqumgtasuacpggdmxx`)
**Mode:** READ/AUDIT only — no DDL, policy, role, function or data writes were made.

## Authority and currentness

**Authority class:** BACKEND / SECURITY RESEARCH KNOWLEDGE.

This document is the durable Shateki security research/rationale authority for Supabase/backend security findings and the reasoning that future remediation must preserve. It does not own live backend state, current implementation state, Pipeline sequencing, product rules, permissions, SQL/DDL/RLS/schema writes or release approval.

- Live Supabase schema, policies, grants, Auth state, keys, functions/RPCs, Edge Functions and advisor output are backend truth and must be freshly read before material security work.
- Live GitHub source is implementation truth for client/service/backend call paths.
- `SHATEKI — MASTER PIPELINE` owns SC-004 sequencing and current work state.
- Shateki Coding controls own operating procedure and permissions.
- `docs/backend/SC031_SUPABASE_SECURITY_REMEDIATION_PROPOSAL.md` is subordinate supporting/proposal evidence only; it is not a second CURRENT security knowledge authority.

Unless a finding is explicitly freshly reverified, counts, policy inventories, function exposure, key/Auth state and implementation observations in the dated audit below are historical snapshot evidence from 13 September 2026. Before SC-004, RLS/grant/policy work, Auth/admin-boundary changes, destructive-operation security work, RPC/SECURITY DEFINER changes, Edge Function privilege design, key/credential-model changes or other backend-authority work, freshly verify the live Supabase schema, policies/grants, advisors, Auth state, key posture, functions/RPCs, Edge Functions where relevant, and current GitHub write/service paths.


## Executive finding

The current browser application uses the public Supabase client for normal gameplay and some administrative data mutations. The live database has multiple broad anonymous write policies, including unrestricted UPDATE and/or DELETE paths on persistent game/player data. The local Admin keypad in the browser is therefore a UI convenience only; it is not a database security boundary.

This is a **P0 release-hardening item** for SC-031. It does not justify changing live RLS blindly: some anonymous writes may currently be required by legitimate unauthenticated gameplay. The exact write paths must be classified and covered by acceptance tests before any policy change.

## 13 September 2026 Supabase advisor snapshot

Security advisor:

- 1 table with RLS enabled but no policy: `public.game_events_archive`.
- 151 `SECURITY DEFINER` views.
- 16 functions with mutable/unset `search_path`.
- 10 materialized views exposed through the Data API to `anon` and/or `authenticated`.
- 3 `SECURITY DEFINER` function signatures executable by `anon` and `authenticated`:
  - `public.check_pin(p_name text, p_hash text)`
  - two overloads of `public.log_player_go(...)`.

Performance advisor:

- 4 foreign keys without covering indexes.
- 16 multiple-permissive-policy findings.
- 2 duplicate-index findings.
- 12 indexes currently reported unused. These are evidence for review only and must not be removed solely because the advisor reports no usage.

## 13 September 2026 confirmed anonymous UPDATE/DELETE snapshot

A direct read of `pg_policies` confirmed broad anonymous mutation policies on:

- `games` — UPDATE and DELETE (`qual = true`, with duplicate admin/anon permissive policies).
- `high_scores` — DELETE.
- `high_scores_sp` — DELETE.
- `matches` — UPDATE and DELETE.
- `match_players` — UPDATE and DELETE.
- `match_tiebreaks` — UPDATE and DELETE.
- `player_aliases` — UPDATE and DELETE.
- `player_bucket_map` — UPDATE and DELETE.
- `player_round_highs` — UPDATE for anon/authenticated.
- `players` — UPDATE and DELETE.
- `players_archive` — UPDATE and DELETE.

This list is not a claim that every policy is unused or malicious. It is a statement that possession of the public anon client is sufficient to reach those RLS paths unless another database constraint prevents the operation.

## 13 September 2026 confirmed client-side destructive-path snapshot

`src/services/cloud.js` contains direct public-client mutations for administrative game maintenance:

- archive game: direct `games` UPDATE of `archived_at`;
- reinstate game: direct `games` UPDATE;
- permanent purge: best-effort DELETEs from score/event/commentary tables followed by direct DELETE from `games`.

The Admin keypad implementation explicitly describes itself as a UI gate. Because its credential/check runs in client-side JavaScript, it cannot protect database operations from callers who invoke the Supabase API directly.

## Functions identified for review in the 13 September 2026 snapshot

### `public.check_pin`

- `SECURITY DEFINER`.
- Has an explicit `search_path` to `public`.
- Currently executable by PUBLIC/anon/authenticated/service-role paths.
- Behaviour is a player name/password-hash existence check.

This may be an intentional player feature rather than an admin feature. Do not revoke it until every caller and product requirement is confirmed. Its public execution and brute-force/privacy characteristics still require review.

### `public.log_player_go` overloads

- `SECURITY DEFINER`.
- Publicly executable.
- Advisor reports mutable/unset `search_path`.
- Writes `player_go_events`.

Because anonymous gameplay may legitimately need this write, the remediation must preserve gameplay while constraining privilege. At minimum, fixed `search_path`, argument validation and an explicit grant/RLS design should be evaluated.

## Required remediation design before DDL

1. **Classify every persistent mutation** as normal gameplay, player-self-service, admin-only, maintenance-only or obsolete.
2. **Choose a server-enforced admin boundary.** Preferred engineering direction is an authenticated admin identity/role enforced by Supabase/RLS or an authenticated server/Edge Function. A short client-side PIN must not remain the sole authority for destructive operations.
3. **Remove direct anonymous destructive admin operations** from the browser once a server boundary exists.
4. **Replace broad `qual = true` UPDATE/DELETE policies** with the minimum policy/RPC permissions required for confirmed gameplay paths.
5. **Fix SECURITY DEFINER functions** with explicit safe `search_path`, least-privilege execution grants and validated inputs.
6. **Review SECURITY DEFINER views and exposed materialized views** based on actual app dependencies; convert/restrict only with query-parity evidence.
7. **Consolidate duplicate permissive policies** after proving equivalent intended access.
8. **Add missing FK indexes** only after confirming the relevant tables/queries and testing the migration.
9. **Treat unused-index findings as review candidates, not deletion instructions.**

## Test requirements for any security migration

Before changing live policies/functions, prepare a reversible migration and prove at minimum:

- anonymous normal gameplay can still start/save/complete the supported modes;
- required score/high-score/player writes still work;
- anonymous callers cannot archive, reinstate or purge protected data directly;
- anonymous callers cannot mutate unrelated players/matches;
- intended admin flow can perform each authorised action;
- rejected admin requests fail closed and leave data unchanged;
- refresh/cross-device reads remain coherent;
- Official/Classic, Turbo, Practice, Vs Shadow and Training isolation remains correct;
- advisor scan is rerun after migration;
- rollback SQL restores the previous grants/policies/functions if acceptance fails.

## Tooling direction

Supabase's supported CLI can generate schema types and run pgTAP database tests. Those controls are a strong fit for SC-031 once a local migration baseline is established. The current live project does not have the `pgtap` extension installed, so enabling it or introducing a migration baseline is a separate DDL decision and must not be performed implicitly.

## Historical audit disposition

**No live database change was authorised or performed by the 13 September 2026 audit.**

The audit established the durable security rationale captured above and produced the subordinate remediation proposal. Current SC-004 status, sequencing and next action are not maintained here; retrieve the live Pipeline/HANDOVER. Any future execution still requires the appropriate explicit database/DDL authority and fresh live Supabase verification.
