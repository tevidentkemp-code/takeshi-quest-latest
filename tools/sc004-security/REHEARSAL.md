# SC-004 isolated boundary rehearsal

These files are an unapplied representative proposal. They do not prove a production cutover or satisfy SEC-05/06. No production connection, mutation, migration, Edge deployment, Auth enrollment, schedule or frontend activation is used.

Run with Node 24 and PGlite 0.5.8, supplying the predecessor's exact read-only schema snapshots:

```sh
SC004_AUDIT_DIR=/absolute/path/to/sc004-security-audit \
SC004_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js \
SC004_RESULTS_PATH=/absolute/path/to/results.json \
node tools/sc004-security/test.mjs
```

`fixture.mjs` reconstructs 18 public tables with captured columns, generated expressions, constraints and 28 unique indexes. It replays current policies/grants, the owner-permission writable view, both go RPC overloads, the relevant administrative helpers and all three actual triggers. All data is synthetic. The candidate schema and grant/policy/RPC closure run exclusively in in-memory PostgreSQL. The Auth fixture contains only the confirmed columns needed for SQL checks; the injected `getUser` seam models an already verified user and does not verify real Auth tokens.

The actual candidate client sends requests to the actual candidate handler and service-only SQL adapter. The transport tests cover server-issued hashes, foreign-scope denial, roster join/order/display changes, accepted participant preservation, create-only profiles, completed canonical boards and mode-isolated scores, frozen go-event membership, idempotent retries, expiry/revocation and administrative allowlist/session checks. Direct PostgreSQL role tests exercise every table's DML/TRUNCATE permissions, both RPC EXECUTE privileges and all writable-view operations. They are not live PostgREST requests.

The hold rehearsal reserves an incomplete slot, switches the private hold flag on, attempts completion and observes HTTP 503. The exact payload remains in browser recovery storage. Existing reads and authorized resume work; table, view and RPC grant closure stays in force. After the hold is removed, a reloaded client retries the same payload and receives one accepted receipt. At no point are anonymous policies or grants restored. [safe-hold.sql.txt](safe-hold.sql.txt) is the exact proposed operator sequence; it requires the candidate schema and a trusted database owner. A missing hold row also fails closed.

Empty-match cleanup is authorized by the live controller for a server-created match and requires no accepted slot or public game. It removes the exact empty match and pending registry scope. The proposed service-only `sq_sc004_prune_expired_empty(100)` handles expired issuance-orphans under the same no-history/no-game criteria. It cannot remove historical or accepted games. No pruning schedule is installed. An initial capability response lost before browser receipt cannot be recovered from a public UUID or request ID.

The diagnostic record retains setup and earlier test failures. The first test run passed 22/23 and exposed a missing SQL hold-to-HTTP 503 mapping, which was fixed in the handler. A later 23/26 run exposed an unsynchronized `cleanup_match` allowlist and fixture queue contamination from multiple client instances. The action allowlist was synchronized; recovery and hold tests now use separate storage scopes with strict queue-count assertions. The underlying concurrent-tab cache contract remains unproved and is listed as a cutover limitation.

SEC-04/05/06 remain incomplete because current frontend callers are not replaced, real admin Auth is not enrolled/tested, all administrative/training/telemetry routes are not implemented, full tournament/provenance and first-game late-join timing parity are not certified, and PostgREST/Realtime/deployed rollback behavior is untested. Positive boundary assertions are evidence for a concrete proposal, not acceptance of those missing integrations.
