# SC-004 ordered production cutover

This is a reviewed operation plan, not a deployment receipt. Production project is `vvfqumgtasuacpggdmxx`, API `https://vvfqumgtasuacpggdmxx.supabase.co`; the browser origin is `https://tevidentkemp-code.github.io`. Production has not been changed by this build. The [acceptance record](ACCEPTANCE.md) contains final fresh real-platform **45/45**, source browser **19/19**, and dist browser **19/19**, with zero browser page errors. These use the isolated real Supabase stack. The separate actual [restricted rollback acceptance](ROLLBACK-ACCEPTANCE.md) passed its ordered Auth/API/browser phases, including failed-definition hold retention and actual resumed Finish. Intended-owner enrollment and sign-in must still be proved in production during the additive phase.

The production sequence is additive backend → owner enrollment → new route proof → compatible app → owner sign-in/controller proof → brief hold → atomic guarded closure → release → bounded live acceptance. The private hold controls the new routes. Before closure, it does not stop old clients using the still-open legacy table/RPC authority. Coordinate the legacy browser transition explicitly; do not wait indefinitely with the new app held while the owner signs in.

## 1. Freeze the review and arrange the owner-controlled secret step

Before any production mutation, the controller records the approved PR/revision, passing SEC-04/05/06 implementation and rehearsal evidence, compatible secure rollback anchor, deployment mechanism and operator window. Recompare current main and deployed assets. A new code change requires relevant verification and a new artifact record. Passing local tests alone is not production activation. Existing conditional production authority remains valid; these are ordered operational prerequisites, with owner secret-setting/sign-in an actual access dependency. No paid project or branch is part of this procedure.

Verify these unmodified CLI-allocated migration files by SHA-256:

| File | SHA-256 |
| --- | --- |
| `supabase/migrations/20261003161850_sc004_scoped_authority_additive.sql` | `f71a1bd8497c15faa711a8c85230f72f56fcdd86a6f4f72841bd076f02a1e763` |
| `supabase/migrations/20261003161851_sc004_close_legacy_mutation.sql` | `f0a67bdfa9804d81bac145be90f4231e3804072ed33c92efc3957a18190f2012` |

Use these production files, never the local rehearsal copies. The local copies replace only the two documented PostgreSQL view-deparser hashes; neither substitution is valid for the production guard. See [fresh replay receipt](final-fresh-rehearsal-receipt.json) and [local migration manifest](local-migration-rehearsal-manifest.json).

The verified owner principal already exists: `8c04bacf-c14c-4334-ba28-cb5671d0fe1c`, permanent, email-confirmed, active, with zero sessions at the read-only capture. Do not create a replacement administrator. The owner keeps the password and performs the real browser sign-in privately.

The connector can apply SQL and deploy functions but cannot set Edge secrets. The current CLI is not authenticated; the computer-use surface is locked with no authenticated Dashboard tab. This is the remaining external access dependency, not a request to approve the architecture again. After the PR, tests and rollback result are concrete, the controller supplies a chmod-600, non-repository `production.env` to the owner-controlled secret-setting flow. Record success without publishing its contents. Required custom variables are:

| Variable | Production value/handling |
| --- | --- |
| `SQ_SC004_ISSUANCE_KEY` | Newly generated 32 random bytes, encoded as 64 hex characters. Server only; retain the same key for retries and rollback. |
| `SQ_SC004_BROWSER_ORIGINS` | `https://tevidentkemp-code.github.io`; add another origin only when deliberately required and verified. |
| `SQ_SC004_WRITES_ENABLED` | `true`; use the trusted SQL hold for operational pauses. |
| `SQ_SC004_AUTH_ISSUER` | Omit to use the project URL default, or set exactly `https://vvfqumgtasuacpggdmxx.supabase.co/auth/v1`. Never use the local proxy issuer. |
| `OPENAI_API_KEY` | Preserve the existing server-only production model key. Do not copy the local model fixture into production. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are the existing server runtime inputs, not browser secrets. Verify their availability through behavior without printing them. Do not rotate the issuance key during cutover/rollback: it would break exact initiation/recovery retries. Random initiation request IDs and their exact bodies are private recovery credentials too; do not expose them in logs, screenshots, public state or gate receipts.

An authenticated owner CLI can set the private file with the following command; the controller cannot claim it ran while CLI access is absent:

```sh
supabase secrets set --project-ref vvfqumgtasuacpggdmxx --env-file /private/operator/path/production.env
```

The owner can instead set those variables through the project Dashboard Edge Function secrets page. Supabase documents both the [private env-file flow](https://supabase.com/docs/guides/functions/secrets) and [CLI flags](https://supabase.com/docs/reference/cli/supabase-secrets-set). Keep credentials and secret files out of the repository and evidence exports.

## 2. Recapture and prove the original production boundary

Immediately before additive deployment, use the trusted Supabase connector to recapture application catalog, grants/policies/functions/views/triggers, sequence settings, schema/default ACLs, publication membership, migration history, deployed Edge sources/config and intended owner Auth state. Preserve the restricted preimages and rollback assets. Compare against the reviewed [production preflight](PRODUCTION-PREFLIGHT.md); record managed-service changes separately.

Run the exact `docs/backend/sc004-build/preflight.sql` inside `BEGIN READ ONLY … ROLLBACK`. It must pass. Do not regenerate expected hashes merely to accept unexplained drift. Keep other application DDL/deployments out of this window. The initial production capture has 18 public base tables, 40 write policies to remove, one writable view and four mutable sequences; the guard also checks the broader original relation/function inventory.

## 3. Apply only the additive migration and deploy the new command route

Use Supabase `apply_migration` with `project_id: "vvfqumgtasuacpggdmxx"`, `name: "sc004_scoped_authority_additive"`, and `query` equal to the exact full first migration file above. Do not batch both migrations or use an unrestricted push that also closes authority now. The file contains its own original preflight and transaction, then the gameplay, lifecycle, admin and commentary authority definitions. Check successful commit and `private.sc004_write_control.held = true`.

Read back remote migration history and retain the connector's actual migration version/name. Its timestamp may differ from the local CLI filename; retain the local filename and content SHA as the reviewed identity. Do not invent a matching remote version or run the same additive DDL again.

Deploy `sq-match-control` first from `supabase/functions/sq-match-control/index.ts`, with the pinned `deno.json`/`deno.lock` and its relative `_shared/sc004-runtime.ts` and `_shared/sc004-handler.mjs` dependencies. For connector deployment, include each required file with its unchanged relative path/content and set `verify_jwt: false`. Read back the deployed version, entrypoint and configuration. An unauthenticated create must return `503 writes_held` while the initial SQL hold is active; malformed or unsupported commands must fail without creating rows.

Gateway JWT verification is deliberately disabled because normal gameplay uses an opaque controller header. The function implements custom authorization: admin JWTs are verified by `getUser`, and SQL rechecks the matching live permanent user/session and private allowlist; gameplay hashes are scoped to one server-issued match/training registry. Request bodies cannot supply admin identity, sessions or service keys. The new route and additive schema can coexist with the old browser before app switch; this is not yet authority closure.

## 4. Enroll the existing owner through trusted SQL

Use `execute_sql` for this DML-only owner transaction, never a public RPC or browser enrollment command. It repeats the live permanent-user check before inserting the allowlist entry:

```sql
BEGIN;
DO $enroll$
DECLARE intended uuid := '8c04bacf-c14c-4334-ba28-cb5671d0fe1c';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = intended AND is_anonymous IS FALSE
      AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The intended permanent confirmed Auth user does not exist';
  END IF;
  INSERT INTO private.sc004_admins(user_id, enabled, revoked_at)
    VALUES (intended, true, NULL)
    ON CONFLICT (user_id) DO UPDATE SET enabled = true, revoked_at = NULL;
END $enroll$;
COMMIT;
```

Read back only the owner's enabled/revoked status and the user checks. Zero sessions proves that a browser sign-in still needs to occur; it does not prove an authentication failure. Neither a player profile/PIN nor editable JWT metadata grants this privilege. If the verified principal changed, stop for owner identity resolution rather than enabling another account opportunistically.

## 5. Release additive hold, switch the compatible app, and prove real authority

Once the new route/config and trusted enrollment are ready, release the initial additive hold through trusted SQL:

```sql
SELECT public.sq_sc004_set_hold(false);
```

Prove the released new route can issue and resume one unique synthetic scope before closing legacy authority. Keep the issuance request and secret in the private browser cache; record only public IDs, status and redacted result. Verify a missing/wrong secret cannot operate that scope. Leave the scope live for the before/after-closure check.

Release the reviewed compatible browser through the repository's normal approved build/deployment path. Record the deployed revision, served index/runtime/metadata hashes and completed deployment. Confirm the production browser sends `{action, request_id, body}` to `/functions/v1/sq-match-control`, uses the opaque `X-SQ-Match-Controller` header for gameplay and separate Auth for Admin, and does not fall back to direct table/RPC writes.

The intended owner signs in through Admin in this actual deployed app. Require successful Auth `getUser`, authenticated `admin_action` / `{operation: "status"}`, and trusted SQL confirmation of the same live `auth.sessions` user/session. Keep the JWT/session identifiers out of public receipts. Verify browser flags/metadata do not substitute for verified Auth. If an existing unenrolled permanent production account is available, verify its admin denial; do not create a production account solely for this test or claim the local ordinary-account proof happened in production. Direct authenticated Data API denial can use the intended owner’s signed session because its database client role remains authenticated. The enrolled owner's status works during hold too; sign-in is performed while gameplay remains available, not during an indefinite hold.

Verify the synthetic current match can reserve, update allowed match-only display, reconnect/renew with the same secret and accept a canonical completed game through the new route. Check the issued IDs, immutable retry receipt, correct scores/match wins, and public reads. Retain a pending scope and durable completion queue for the short closure window. A `memory_only` cache must show the explicit tab-loss warning and safe end/retry choices; never claim durable recovery for that tab.

## 6. Transition legacy browsers and retire the old Edge bypasses

Coordinate with the owner and actual active browsers: finish known old games or refresh/recover them using the implemented branches. Absence of public unfinished rows, quiet anonymous reads or a successful SELECT does not prove all cached/offline browsers drained. Record known sessions handled and the refresh/recovery behavior for an old tab returning later.

- **Fresh cache, no saved match:** `recoverFreshLegacy` requires empty accepted history and a successful read proving the old UUID absent. It issues fresh server-controlled match/game IDs without an account and preserves the unfinished board, cursor and throw history. Read errors fail closed; the old UUID receives no authority.
- **Persisted legacy match:** the intended enrolled owner uses `recover_legacy`. SQL locks saved truth, checks contiguous accepted game/history totals, retains roster/wins/history and issues only the next pending game. The owner confirms missing target wins, series/single format and pending rules when required. The browser checks saved truth against its cache while retaining the unfinished board and presentation history. An ordinary public UUID/name is never adoption authority. Archive, ambiguity, missing provenance, history mismatch, completed series or unsupported six-player recovery requires owner resolution.
- **Returning old/cached writer after closure:** the legacy direct write is denied. Refresh into the compatible app and apply the appropriate branch; retain its cache until recovery succeeds. Do not clear caches to hide failed saves or restore anonymous grants to accommodate that client.

After the compatible app and owner/new-controller proofs work, replace the other two production Edge entries within the cutover window:

| Function | Exact entrypoint and behavior | Configuration |
| --- | --- | --- |
| `commentary_generate` | `supabase/functions/commentary_generate/index.ts`; include runtime, commentary handler/model, command handler and pinned Deno dependency files. Authorize the exact game before service reads/model cost; actor-bound commit rechecks after the model call. | `verify_jwt=false`; custom controller or verified admin Auth. |
| `sq-admin-maintenance` | `supabase/functions/sq-admin-maintenance/index.ts`; retired PIN route returns HTTP 410 `legacy_admin_route_retired`. | `verify_jwt=false`; this entrypoint performs no service call or write. |

Together with `sq-match-control`, these are the three entries in `supabase/config.toml`. Read back each deployed version/config/source identity; a deploy acknowledgement alone is insufficient. Missing/foreign controller commentary must fail before service context reads/cost/write; old PIN calls must return 410. Do not deploy `commentary-fixture` or restore the old v15 commentary/PIN source. An authenticated CLI, if used instead of the connector, deploys each named function with `--project-ref vvfqumgtasuacpggdmxx --no-verify-jwt`; never use `--prune`. These are the documented [function deployment flags](https://supabase.com/docs/reference/cli/supabase-functions-deploy).

## 7. Hold briefly and apply exact atomic closure

Do not start this window until owner sign-in, new controller operation, compatible app and retired Edge routes are verified. Use trusted SQL to commit the operational hold first:

```sql
BEGIN;
SELECT public.sq_sc004_set_hold(true);
COMMIT;
```

Verify new route mutations return `503 writes_held`, the exact pending payload stays queued, owner status/public reads/authorized resume remain available, and no scope or receipt was deleted. Valid-at-hold controller/training lifetimes pause; already expired or revoked credentials remain denied. This hold does not close the old table/RPC authority by itself.

Use `apply_migration` with `project_id: "vvfqumgtasuacpggdmxx"`, `name: "sc004_close_legacy_mutation"`, and `query` equal to the exact full second migration file. Its transaction runs the unchanged strict closure guard and closure together. The guard checks original objects/grants/policies/definitions plus the exact seven new public functions and complete private authority inventory. Enrollment, sessions, hold data and accepted receipts do not relax the metadata check. Any unexplained drift aborts; keep the hold enabled and diagnose rather than rewriting the guard to pass.

Closure removes exactly 40 write policies, client mutation grants including `MAINTAIN` on 18 base tables plus `v_games_visible`, and `USAGE`/`UPDATE` on four sequences. It restricts privileged RPCs, retains the six-argument service-only Go helper, and drops the proven-unused broken ten-argument overload. It does not tidy unrelated read-view ACLs, change public SELECT definitions or alter application publication membership.

Before release, read back migration history and prove the committed boundary using trusted ACL/policy/function checks plus safe Data API denials. Require zero anonymous/ordinary authenticated mutation privilege on the closed objects; neither role may execute private/new authority or closed legacy RPCs. Compare SELECT/view definitions/publication membership against the preimage. Verify the intended owner status still succeeds, the retained original controller resumes with the same scope and secret, and the retired PIN endpoint remains 410. No public read result substitutes for these authority checks.

If these immediate closure checks pass, release the brief hold immediately through trusted `sq_sc004_set_hold(false)`. Verify `held=false`, repeat owner status and same-controller resume, then submit the preserved exact queue once: one accepted receipt, no duplicate game/score/win. Any failed mandatory closure check enters restricted recovery while held; do not release speculatively.

## 8. Complete bounded production acceptance and reconcile gates

Use generated, uniquely marked synthetic records only, with an explicit private inventory of IDs for owner cleanup. Do not alter existing real profiles/history to test destructive routes, create a new production Auth principal, rotate/revoke the intended owner's session casually, or replay local seed data. The local `platform-test.mjs` and browser harness intentionally refuse production URLs; do not remove that safeguard. Conduct the approved bounded live checks through the actual deployed app/SDK and trusted owner observations.

Record positive and negative checks for registration, official series, guest Practice series, solo Practice, saved/guest Turbo, tournament provenance, real-only Vs Shadow, permitted late join/restart/display/removal, Standard/TDB/Select Training including partial-go completion, scoped Go/events, visits and exact retries. Exercise missing/foreign controller and ordinary Auth denial, intended-owner retained admin operations against only those synthetic objects, queue/reconnect before/after the hold, public statistics/high-score reads and actual application Realtime. Verify match wins, score routes and accepted history from database truth. The full isolated 45/45 and 19+19 receipts remain distinct from this live receipt.

For commentary, test authorization denials without generating model cost. If an authorized paid production generation is included in the approved live check, use one marked synthetic game and the real retained model key; record model/cost scope explicitly. The local deterministic upstream output does not prove a production model call. Observe service/model/write ordering and actor revocation/archive denial from existing reviewed evidence; do not introduce a production fixture or revoke an unrelated active scope to manufacture a race.

Data API mutation probes must use valid, bounded synthetic fixtures and both anon/ordinary Auth roles so malformed payload rejection cannot masquerade as authorization denial. Keep unexpected accepted synthetic rows in the inventory, fail the check and hold/recover; clean only exact inventoried IDs through the enrolled owner. Preserve accepted receipts/tombstones as required by the implementation. Record requests/results redacted, error counts, deployed version/config/hashes, accepted row identities, boundary catalog and advisor differences. Existing read-view advisor findings are recorded residuals, not an invitation for unrelated cleanup.

After all mandatory live checks pass, reconcile the SC-004 gate/control records from observed production evidence. Report the intended-owner proof, both remote migration records and content identities, three deployed Edge versions/configs, app release identity, final held state, known legacy transitions, live acceptance and cleanup. A production activation or SEC-07/08 pass is not inferred from this document.

## Restricted recovery on any cutover failure

The current compatible secure anchor is `/Users/Thom/.codex/tmp/sc004-rollback-current-main-anchor/manifest.json`, candidate `50d459536118dab8b607d8b1fb2b4d8036878955`, manifest SHA-256 `1d280090a76df40c5af0bc0d24bc538efdc824c73cd7a7a5f608b18f3c2ba42c`. Its [sealed public manifest](rollback-current-main-anchor-manifest.json) and [current-main rollback acceptance](ROLLBACK-CURRENT-MAIN.md) prove 181 file hashes, actual app/Edge faults, 11 platform assertions and both browser phases while retaining SC-063. The prior [full SQL-fault proof](ROLLBACK-ACCEPTANCE.md) remains evidence for the 11 byte-identical backend/recovery files; the refreshed run did not repeat that deliberate invalid definition. The controller must verify every referenced file hash, complete phase receipts and the eventual production-compatible asset record before using the anchor. It contains the secure built app/Edge/functions; the older insecure production snapshot is a diagnostic preimage, not a restoration target. Any later runtime change requires separately identified and verified compatible bytes.

1. Commit `sq_sc004_set_hold(true)` through trusted owner SQL. Preserve browser caches, exact pending request envelopes, issuance key, private controller/training registries, slots, consumed initiation receipts, admin enrollment and accepted game/score/win receipts. Do not reset/reseed production or restore a database snapshot over newer accepted history.
2. Once closure has committed, run the frozen `restricted-recovery.sql` assertion. It commits the hold before checking closed table/view/sequence/RPC/private authority. A failed assertion remains held. If additive-phase failure occurs before closure, this assertion will correctly reject the still-open legacy boundary: stop the app switch or complete reviewed closure under owner coordination; do not treat it as successful restricted recovery.
3. Restore only the verified compatible secure app and three Edge entrypoints, retaining the same issuance key and custom Auth/config. If SQL function recovery is required, use the frozen `function-recovery.sql` via the DDL migration route. Its hold transaction commits first and its secure definitions transaction follows; compilation failure rolls back definitions and leaves writes held. Preserve the recovered function/schema ACLs. Never restore old PIN/commentary bypasses, public mutation grants/policies, service secrets in the browser or a public-ID adoption path.
4. While held, verify exact function/anchor identities, owner Auth/status, scope resume, public reads, immutable accepted receipts, denied mutations and preserved queues. Restore/release only after the restricted checks succeed; `sq_sc004_set_hold(false)` resumes credentials valid when the hold began without reviving expired-before-hold/revoked ones.
5. Prove the original pending match and Training IDs reconnect and the original queued payloads accept once after release, including actual browser Finish. Recheck denied ordinary table/view/RPC writes, Realtime and owner status. Record the failure, held interval, restored hashes, immutable receipt comparison and resumed result. Sign out of Admin when owner operations finish.

The destructive reset, deliberately invalid recovery definition and deliberately broken app/Edge restore tests belong only to the isolated rehearsal. They must not be copied into production. A failed recovery is an explicit hold with retained data/queues until a reviewed compatible fix exists; anonymous authority is never a fallback.
