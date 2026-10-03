# SC-057 approved avatar pairs — candidate, database gate pending

Starting code: production `main` / `6176c8902f4598c15908af0209065c4fda734d57` (v0.11.0). Mode: bounded BUILD/FIX, T2 production candidate. Thomas approved the six original portraits/winner images for appended IDs 30–32. Pipeline 38 authorises the source/asset preparation; production database application requires its own specific approval. This document describes preparation, not a production release.

## Verified source and live database

`src/app/util.js` owns the catalogue, accessible Create/Edit picker and deterministic automatic assignment. Existing portraits and celebration sprites are matching 6×5 grids; IDs 1–29 use row-major coordinates and the final blank cell is excluded. Both sprite files and every old coordinate must remain byte-for-byte/value-for-value unchanged. Automatic assignment remains IDs 1–20. IDs 30–32 are manual choices using six separate WebP assets with unchanged approved compositions.

`src/live-game/postgame-flow.mjs` owns actual game/shootout and match winner art plus opponent portraits; `src/live-game/xp-breakdown.mjs` owns the XP-screen portrait application. Their artwork application changes must not alter winner selection or any XP calculation. Setup's existing `!important` sprite sizing needs only a standalone-asset exception. Existing Create/Edit/Select/setup/late-join state and canonical `avatar_id` transport already work and need no competing identity store.

The six approved PNGs are encoded as WebP quality 90 at their original full dimensions, with no crop, redraw or composition change. Original PNGs total 14,850,510 bytes; shipped WebP pairs total 1,847,220 bytes. The approved originals and prompts remain external review evidence; no source photos are committed.

| Appended ID | Portrait bytes (1254×1254) | Winner bytes (1122×1402) |
| --- | ---: | ---: |
| 30 | 302,646 | 334,398 |
| 31 | 234,168 | 320,942 |
| 32 | 285,840 | 369,226 |

Original portrait sprite SHA-256: `c24139d80247d43fa153afeb4a02de5a3061f0a92abada42d16f29896a575f12`. Original winner sprite SHA-256: `96b90f87c284a74a038d6500b493ff9b016bcb94e7a11ec84107bdbc8aba953f`. The append-only contract test pins both files and every original paired coordinate, and tests 1,000 automatic-assignment seeds remain in IDs 1–20. The shared helper keeps the old portrait alias; appended standalone IDs have no invented sprite coordinate.

Read-only live inspection of Shateki-Quest / `vvfqumgtasuacpggdmxx` on 3 October 2026 confirmed nullable `public.players.avatar_id smallint`, no default, no column ACL, and validated constraint `players_avatar_id_range` exactly `CHECK (avatar_id IS NULL OR avatar_id >= 1 AND avatar_id <= 29)`. There were zero new/invalid avatar assignments. No public/private routine references `avatar_id`; no table rules. The only user trigger is `AFTER UPDATE OF name`, calling the existing name-merge function, so avatar-only edits do not invoke it. Create calls direct `players` upsert; Edit calls direct update and requires a returned row. Avatar failures do not fall back to a partial successful write and retain the form.

Captured security: RLS enabled, force RLS false; table ACL `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. Existing permissive anon SELECT/UPDATE/DELETE `USING true` and INSERT/UPDATE `WITH CHECK true` policies are unchanged. This work adds no privilege, RPC, policy, trigger, default, backfill, player row or scoring/history mutation.

## Specific unapplied database change

`supabase/migrations/20261003170000_sc057_avatar_catalogue_extension.sql` changes only the named check's upper limit 29→32 and its truthful column comment, transactionally with a 5-second lock timeout. A fail-closed guard rejects unexpected constraint drift. It accepts the verified 29 baseline or its own 32 state for safe reapplication. Nothing changes IDs 1–29 or existing rows.

The candidate must remain unmerged/unreleased until that exact migration is separately approved, applied and verified. Do not ship selectable IDs while production still rejects them. Do not mark the live range 32 merely because the source candidate supports it.

## Verification and zero-committed-write live method

Local structural tests must apply the existing SC-040 migration then this candidate, verify NULL and IDs 1/29/30/31/32, reject integer IDs 0/33/negative values, reapply, and compare column shape, named constraints, ACL/RLS/policies and old assignments. Client normalisation also rejects fractional/malformed values; PostgreSQL's existing smallint type is unchanged. Rollback succeeds only when no appended IDs are assigned; with IDs 30–32 it must abort without data changes. Existing SC-040 historical migration tests continue to reject 30 under the original 29 constraint; new candidate tests verify 32 and reject 33. All browser persistence fixtures block production network traffic and do not claim a production round trip.

`tools/ui-smoke/verify-sc057-migration.mjs` passed this complete local PGlite proof, including unexpected-range drift rejection and anon insert/update followed by rollback with zero committed synthetic rows. Root independently reran the exact runner successfully. This confirms candidate SQL compilation/local semantics; it is not evidence of live migration or live anon acceptance. `verify-sc057-avatars.mjs` passed the sprite/mapping/automatic-pool contracts. The focused actual-browser runner verifies all three Create choices, Edit, failed old-range/denied/zero-row writes, refresh, Select/setup/Throw Order/live identity, confirmed registered late join, resolved shootout, and all nine identity×320/390/430 Game Winner→XP→visible Match Winner paths with decoded asset dimensions/computed sizing and strict uncaught-error checks.

After specific database/test authority, use `BEGIN; SET LOCAL ROLE anon;` with unique synthetic UUID/name values checked absent beforehand. Insert NULL/1/29/30/31/32 into `public.players`, update only those new synthetic rows' `avatar_id` through 30→31→32→29, and compare aggregate returned counts/IDs. Always `ROLLBACK`, including after any error; verify those UUIDs/names are absent afterward. The verified table has UUID defaults, no sequence and no insert trigger; avatar-only updates avoid the name trigger. This exercises live anon ACL/RLS and constraint acceptance with zero committed rows. Invalid IDs should be attempted in separate transactions/savepoints and rolled back. This method is a proposed authorized test, not executed evidence. Read-only `EXPLAIN` without `ANALYZE` can verify planning/ACL but cannot prove runtime check-constraint acceptance.

Read back the exact named check/comment, ACL/RLS/policies and counts before/after application. No privileged key is needed in client code or logs. Production read/write verification remains root-coordinated.

## Recovery

Before deployment, abandon the held candidate or revert its app commit; production is untouched. After approved application but before any 30–32 assignments, `supabase/rollbacks/sc057_avatar_catalogue_extension.sql` restores the exact captured 29 check and original SC-040 comment. It holds the table lock before checking assignments, preventing a concurrent new assignment from slipping through.

If any appended ID is saved, rollback deliberately aborts. Retain the expanded range and assets to preserve the choices; use a reviewed forward correction. Any export/remap/restore of affected UUID→avatar mappings needs its own explicit data decision. Never automatically replace IDs or drop the column. Reverting to a 29-only client could display a fallback for saved 30–32 values, so it is not complete identity recovery. No score/history/XP rollback is required.

Exact next action: root independently reviews this file pair and asks the single specific backend approval while source implementation and offline QA proceed. Final main/history/version refresh, exact-head CI, approved database application/readback and production avatar smoke precede release.
