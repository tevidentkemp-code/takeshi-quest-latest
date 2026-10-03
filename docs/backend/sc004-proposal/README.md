# SC-004 match controller proposal

This is the isolated implementation proposal for Thomas's approved match-controller security boundary. It preserves ordinary gameplay without player accounts and places persistent player, history and administrative changes behind a verified permanent Auth administrator. Nothing in this directory is connected to the application or deployed to Supabase.

The portable HTTP handler, browser transport and SQL proposal are exercised together against an in-memory PostgreSQL replay of the captured production schema. The fixture includes all 18 public base tables, 28 unique indexes, foreign keys, policies and all three actual triggers. Synthetic Auth rows and a verifier test seam are used; this does not prove real Supabase Auth, PostgREST, Edge gateway or Realtime behavior.

## Proposal files

- `handler.mjs` dispatches explicit operations and supplies hashed controller secrets or verified administrator identity to the service-only SQL function.
- `client-adapter.mjs` separates credential cache from exported game state and keeps a stable completion request across lost responses and reconnects. A `memory_only` recovery result requires an explicit browser warning before relying on refresh/reconnect.
- `schema.sql.txt` is an isolated proposal, **not a production migration**. It closes public table, view and privileged RPC writes in the fixture, retains reads and supports a restricted write hold.
- The Edge bootstrap and configuration, when present as `.txt`, are undeployed review material.

## Run the isolated fixture

Use Node 24 and PGlite 0.5.8. Set `SC004_AUDIT_DIR` to the predecessor's captured read-only preimage folder and `SC004_PGLITE_MODULE` to the local installed PGlite module, then run `node tools/sc004-security/test.mjs` from the repository root. The fixture never opens a production connection. Preserve failures and distinguish the current run from earlier diagnostic results.

## Release gates

The supported external-writer set is now confirmed as browser app only. The remaining active browser calls must still be replaced, including training, telemetry, administrative maintenance, completed game/match state and mode-specific lifecycle behavior. A real administrator must enroll and be verified through the intended Auth boundary. The complete source/dist browser journey, deployed API/Realtime behavior, and full application/Edge safe-hold procedure must pass before cutover.

Public UUIDs, names, localStorage contents, the public API key and UI administrator flags never establish authority. Expired or revoked controller secrets cannot recover a match. Renewal extends the same secret; it must not rotate authority before the browser has received the response. Losing an initial issuance response may leave a new empty scope; trusted cleanup of those unaccepted scopes remains a lifecycle obligation.

Keep SEC-07 held until SEC-01 through SEC-06 all pass. Rollback retains restricted permissions and uses a write hold plus forward repair; restoring unrestricted anonymous mutation is not routine rollback.
