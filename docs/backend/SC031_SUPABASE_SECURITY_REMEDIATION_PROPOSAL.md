# SC-031 Supabase Security Remediation Proposal

**Status:** PROPOSE ONLY — NOT APPLIED  
**Date:** 2026-09-13  
**Project:** Shateki-Quest (`vvfqumgtasuacpggdmxx`)  
**Production code baseline:** `main` at `05b7e8b040edc0c92a3d7b0d8ac7f9ca1c1055b2`

## Purpose

Define the smallest safe route from the current browser-accessible Supabase write model to a release-ready permission model without breaking normal Shateki gameplay.

No SQL, RLS policy, grant, role, function, schema or production data change is authorised or performed by this document.

## Verified ownership and current condition

`src/services/cloud.js` is the verified Supabase service boundary for the classic runtime. `src/services/supabase-contract.json` records the live project bindings and the invariant that Supabase remains the persistent source of truth.

The live policy audit confirms RLS is enabled, but multiple persistent tables currently expose broad anonymous UPDATE and/or DELETE paths. The browser Admin PIN is therefore a UI gate, not a database authorisation boundary.

The release objective is **not** to remove anonymous access globally. Shateki currently supports unauthenticated gameplay, so ordinary game persistence must continue to work unless Operations deliberately changes the product model.

## Write-path classification

### A. Normal gameplay persistence — preserve

These writes are part of normal game/match completion and must remain functional for the supported modes:

- `matches` INSERT — match persistence.
- `match_players` INSERT — participant persistence.
- `games` INSERT and game-state persistence — completed/in-progress game truth.
- `game_events` INSERT — gameplay event/tiebreak event persistence.
- `game_commentary` INSERT — commentary persistence.
- `match_tiebreaks` INSERT — tiebreak persistence.
- `high_scores` / `high_scores_sp` INSERT — score persistence where current mode/rules allow it.
- `log_player_go(...)` / `player_go_events` — gameplay event logging.

Security direction: preserve the minimum insert/write capability needed by verified gameplay. Prefer narrow validated RPCs or tightly constrained RLS over unrestricted table-wide UPDATE/DELETE authority.

### B. Player self-service — preserve but constrain

Player creation/profile/PIN-style operations are user-facing self-service, but they should not imply permission to update arbitrary player rows.

Security direction: bind the operation to the intended player identity/credential contract, validate accepted fields, and deny unrelated row mutation. Do not rely on a browser-only check as authority.

### C. Admin / maintenance — move behind a server-enforced boundary

The current client service includes destructive maintenance operations such as:

- archive game (`games.archived_at` UPDATE),
- reinstate game (`games.archived_at` UPDATE),
- purge game and dependent rows (DELETE paths),
- high-score deletion/repair where exposed through admin tooling.

These operations must not remain authorised solely because the caller possesses the public anon key or passes a local JavaScript PIN gate.

Preferred direction: authenticated admin identity/claim enforced by Supabase RLS and/or a narrowly scoped authenticated Edge Function/RPC. The browser may request the action, but the server/database must decide whether it is authorised.

### D. Legacy migration / repair — isolate and retire when safe

Compatibility code that backfills or migrates legacy match/player rows is not ordinary gameplay. Keep it idempotent while required, then remove its broad anonymous authority after the migration dependency is proven obsolete.

## Proposed staged migration

### Stage 1 — acceptance harness before permissions change

Before any live policy change, create a reversible acceptance set that proves:

1. Classic/Official match start, score entry, save and completion work.
2. Turbo remains isolated and persists only its intended data.
3. Practice remains isolated from official highs/rankings/XP.
4. Vs Shadow remains isolated from official competitive outputs.
5. Training does not gain unintended persistent competitive writes.
6. High-score creation works only where product rules permit it.
7. Refresh and cross-device reads remain coherent.
8. Existing player self-service required by the app still works.
9. Anonymous direct archive/reinstate/purge attempts are rejected.
10. Anonymous mutation of unrelated player/match rows is rejected.
11. Authorised admin archive/reinstate/purge succeeds through the new server-enforced path.
12. Failed admin actions leave persistent data unchanged.

### Stage 2 — establish server-enforced admin authority

Add one explicit admin authority model before removing current destructive policies. Suitable implementation options are:

- Supabase Auth identity with an admin claim/role enforced in RLS; or
- authenticated Edge Function/RPC that performs only named maintenance operations after verifying the caller.

Do not place service-role credentials in browser code. Do not make the existing local Admin PIN the database credential.

### Stage 3 — redirect destructive client operations

Change only the admin maintenance service calls in `src/services/cloud.js` so archive/reinstate/purge use the server-enforced admin path. Preserve public function/UI contracts where practical so front-of-house behaviour does not need a broad rewrite.

### Stage 4 — tighten RLS/grants

After the new admin path passes acceptance:

- remove broad anonymous UPDATE/DELETE authority that is no longer required;
- retain only the minimum anonymous gameplay writes proven by the acceptance harness;
- constrain player self-service to the intended row/fields;
- review `SECURITY DEFINER` routines for fixed safe `search_path`, validated arguments and least-privilege EXECUTE grants;
- consolidate duplicate permissive policies only after proving equivalent intended access.

### Stage 5 — re-audit and lock

Re-run Supabase security/performance advisors, repeat full app regression, and record the resulting policy/function contract in the persistent Shateki Coding controls.

## Rollback requirement

Before Stage 2–4 execution, capture the exact current definitions/grants/policies required to restore the previous state. The migration must be reversible in one bounded rollback sequence.

If any acceptance test fails:

1. stop immediately;
2. restore the previous policy/grant/function definitions;
3. verify normal gameplay is restored;
4. record the failed condition in BUILD LOG/HANDOVER;
5. do not weaken security ad hoc to force the test through.

## Current release gate

SC-031 architecture/build work can reach engineering release-readiness while this proposal remains unapplied, but **production public-release sign-off is blocked until the admin/destructive permission issue is resolved or explicitly risk-accepted by the user with full understanding of the exposure**.

**No database change is authorised by this proposal.**
