# SC-004 real local rehearsal

These commands target only the existing Colima stack `sc004-supabase-local` at `http://127.0.0.1:54821`. They use actual Supabase Auth, PostgreSQL, Edge, PostgREST and Realtime. All application records and Auth test users are synthetic. The upstream model fixture remains a separately named local endpoint; it is not a production model or Auth/DB double. The older `tools/sc004-security/REHEARSAL.md` describes proposal-era PGlite evidence and must not be used as platform acceptance.

Stop the browser tests before resetting application fixtures. Retain the previous restricted database dump and results. The reset must empty only `public`, `private` and `legacy` application objects while retaining those namespaces, their default ACLs and the managed Auth/Realtime/Storage/Extensions schemas. Never replay mock Auth tables. The baseline generator refuses a nonempty public target and the production project identity; it generates files without opening a database. The controller owns the explicit local reset and mandatory `supabase migration new` allocation.

Run from the build worktree. No command below prints a credential:

```sh
SC004_WORKTREE='/Users/Thom/.codex/worktrees/sc004-build/Shateki Quest'
SC004_EVIDENCE='/Users/Thom/.codex/visualizations/2026/10/03/01a1019e-91ab-7f91-b515-54d75a96d978/sc004-security-audit/build'
SC004_LOCAL='/Users/Thom/.codex/tmp/sc004-supabase-local'
SC004_NODE='/Users/Thom/.codex/runtimes/shateki-node24.21/bin/node'
cd "$SC004_WORKTREE"
sc004_sql() {
  /opt/homebrew/bin/docker --host unix:///Users/Thom/.colima/sc004/docker.sock \
    exec -i supabase_db_sc004-supabase-local \
    psql -X -U postgres -d postgres -At --set ON_ERROR_STOP=on "$@"
}
```

After the controller has emptied only the isolated application objects, generate and apply the full schema-only baseline. It retains real platform Auth and reconstructs captured table positions, functions, views, triggers, policies, grants and application publication members. Its own transaction aborts on drift/setup failure:

```sh
"$SC004_NODE" tools/sc004-security/build-staging-baseline.mjs \
  "$SC004_EVIDENCE/catalog-complete.json" \
  "$SC004_EVIDENCE/staging-baseline.sql" sc004-supabase-local
sc004_sql < "$SC004_EVIDENCE/staging-baseline.sql" > "$SC004_EVIDENCE/final-rehearsal-baseline.log"
"$SC004_NODE" tools/sc004-security/prepare-local-rehearsal.mjs "$SC004_EVIDENCE"
sc004_sql < "$SC004_EVIDENCE/local-additive-rehearsal.sql" > "$SC004_EVIDENCE/final-rehearsal-additive.log"
```

The local adaptation changes exactly two inspected view-definition hashes for PostgreSQL deparser differences. The production `preflight.sql` and `closure-preflight.sql` hashes stay strict. The additive transaction begins with the full original guard and leaves writes held. Keep the same server issuance HMAC key across restarts and rollback. Serve the actual named Edge entrypoints using the existing chmod-600 local environment file; do not copy credentials into evidence or source.

After the final function source is applied, capture the exact new public/private authorities, regenerate the production closure guard, then regenerate its separate local adaptation. Sequence settings are text to preserve bigint precision:

```sh
sc004_sql < tools/sc004-security/capture-public-functions.sql > "$SC004_EVIDENCE/additive-public-function-manifest.json"
sc004_sql < tools/sc004-security/capture-private-manifest.sql > "$SC004_EVIDENCE/additive-private-authority-manifest.json"
"$SC004_NODE" tools/sc004-security/build-closure-preflight.mjs \
  "$SC004_EVIDENCE/additive-public-function-manifest.json" \
  "$SC004_EVIDENCE/additive-private-authority-manifest.json"
"$SC004_NODE" tools/sc004-security/prepare-local-rehearsal.mjs "$SC004_EVIDENCE"
```

The platform suite proves held startup, creates real permanent users through Auth, enrolls only its synthetic admin by the trusted SQL path, verifies live sessions and scoped controller behavior, then executes the exact guarded closure. A failed additive proof prevents closure; a rejected closure stops downstream testing and retains the hold. Run the complete suite, then the complete browser suite against the freshly built app served on port 8127:

```sh
SC004_LOCAL_ENV="$SC004_LOCAL/local-env.json" \
SC004_CATALOG="$SC004_EVIDENCE/catalog-complete.json" \
SC004_BROWSER_AUTH_FILE="$SC004_LOCAL/browser-admin.json" \
SC004_LEGACY_BROWSER_SEED="$SC004_LOCAL/legacy-browser-dist-seed.json" \
SC004_RESULTS_PATH="$SC004_EVIDENCE/real-platform-final-results.json" \
SC004_CLOSURE_SQL="$SC004_EVIDENCE/local-closure-rehearsal.sql" \
"$SC004_NODE" tools/sc004-security/platform-test.mjs

SC004_LOCAL_ENV="$SC004_LOCAL/local-env.json" \
SC004_BROWSER_AUTH_FILE="$SC004_LOCAL/browser-admin.json" \
SC004_LEGACY_BROWSER_SEED="$SC004_LOCAL/legacy-browser-dist-seed.json" \
SC004_BROWSER_RESULTS="$SC004_EVIDENCE/real-browser-final-results.json" \
"$SC004_NODE" tools/sc004-security/browser-platform-test.mjs
```

The browser credential/legacy seed files are local operational fixtures and must stay chmod 600. The production guard is generated from trusted local compilation of the reviewed source and the unchanged production baseline; it never adopts unrelated schema drift. A function change invalidates the manifests and requires recapture, regeneration and relevant acceptance reruns.

The controller allocated the real files through `supabase migration new`: `20261003161850_sc004_scoped_authority_additive.sql` and `20261003161851_sc004_close_legacy_mutation.sql`. The preparation helper checks their bytes against the exact reviewed source composition, then creates separate local copies by replacing only the two inspected hashes. It does not rebuild a parallel migration. `local-migration-rehearsal-manifest.json` records SHA-256 hashes of the unmodified production files and both local copies. After any source/manifest regeneration, the controller must update the actual CLI migration before preparing another rehearsal. The legacy browser seed must reference the current synthetic database fixtures; regenerate it after a reset instead of reusing an old UUID.

For restricted rollback, preserve the compatible app/Edge build, issuance key, capability cache, private registries/slots and accepted receipts. `restricted-recovery.sql` and `function-recovery.sql` commit the write hold before checks/replacement; they never restore anonymous authority. Rehearse failure by making a temporary copy of `function-recovery.sql` with only the first `CREATE OR REPLACE FUNCTION` changed to invalid syntax. Execute it only against this local stack. The failed definitions transaction must roll back while the prior hold remains committed. Confirm write denial, working reads/admin status/resume, unchanged function hashes and accepted receipts. Then apply the unmodified secure function anchor, rerun restricted API/browser checks, and release the hold only through `sq_sc004_set_hold(false)`. The dedicated `rollback-platform-test.mjs` and `rollback-browser-test.mjs` provide the actual queue/reconnect/held-boundary cases; the controller records their exact phase commands and results.

No rehearsal result authorizes a production cutover by itself. The controller records SEC-04/05/06 evidence, fresh production preflight, owner Auth enrollment/session proof, compatibility anchors and the ordered conditional deployment decision separately.
