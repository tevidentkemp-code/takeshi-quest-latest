# SC-004 acceptance after current-main refresh

Main advanced to SC-063 commit `388ffec4b6dac169e932e09815a3e94759ed98ed` before the original push completed. The controller created `codex/sc004-security-current-main` and rebased without force-pushing the original branch. The metadata conflict retained all 62 current-main release entries semantically and added SC-004 as the 63rd entry, current version `0.12.0`. The current-main Player Stats source and generated runtime remain in the candidate. Earlier acceptance and rollback receipts are preserved as evidence for their recorded artifacts; the refreshed artifact has its own checks below.

## Affected offline checks

All **5/5 affected suite runs passed** after the controller reported the new build and `verify:dist` PASS and froze the served source/dist files. [The public receipt](main-refresh-offline-results.json) records exact commands, log hashes, artifact hashes and fixture limits. Observed candidate HEAD was `da4d10eb05d2e67f67211158f1fc4e999b4f4aa0` on `codex/sc004-security-current-main`. The offline runs began on 2026-10-03 at 17:16:25 UTC.

| Refreshed check | Result | What was retained |
| --- | --- | --- |
| `verify-sc063-backend-performance.mjs` | PASS; exit 0 | Exactly the classifier short-circuits and private explicit-marker prefilter, matching rollback. The verifier makes no database connection or application. |
| `verify-sc043-player-stats.js`, source | 60/60 PASS | Three mobile widths, independent slow/failed sources, real XP/history/misfire semantics, scoped retries, cache expiry, deferred-read prioritisation, navigation and no unexpected JavaScript errors. |
| `verify-sc043-player-stats.js`, dist | 60/60 PASS | Same Player Stats assertions against the built artifact. |
| `verify-sc050-release-notes.js`, source | 23 explicit assertions PASS | Version and all 63 entries; 320/390/430px geometry, internal scrolling, Back/Close and no unexpected JavaScript errors. |
| `verify-sc050-release-notes.js`, dist | 23 explicit assertions PASS | Same release-note assertions against the built artifact. |

The original 62 current-main release objects were compared as parsed JSON with the candidate's retained history and matched exactly. Served source and dist metadata matched the same candidate metadata, SHA-256 `f9ca110e3f5fad657ca61212c3c68100bd35b0380047315930567c4ba96878bb`. Their served `inline-005.js` bytes also matched, SHA-256 `d26bf170bcfda26cf362e02f11643dbad7e2067a9385d528d996578cee4ffd51`.

| App URL | Served index SHA-256 |
| --- | --- |
| `http://127.0.0.1:8127/index.html` | `f3061585869ca50c58ff7b279df71ed27fe61d742d1c4385d955df3509e2a2dd` |
| `http://127.0.0.1:8127/dist/index.html` | `42dd342e55dd2d2039bd9b087f444c14135e7f714a2ca2c52ee747ac90ccdcb3` |

These hashes identify the observed files individually. An unchanged index hash does not stand in for the changed external runtime or metadata bytes; those are recorded separately above and in the receipt. Exact suite entry points were `tools/ui-smoke/verify-sc063-backend-performance.mjs`, `tools/ui-smoke/verify-sc043-player-stats.js` and `tools/ui-smoke/verify-sc050-release-notes.js`, using Node 24.21 and `SQ_APP_URL` explicitly set to the two 8127 URLs for browser runs. Screenshot directories were distinct for each suite/artifact.

The browser harness blocks Supabase traffic and uses explicit local command/read fixtures. These checks prove the affected static and UI regressions; they do not prove actual Auth, Edge, PostgREST or Realtime acceptance. No real database/API writes, hold changes, server changes or application source edits were made by these runs. The controller consolidates the separate refreshed backend, actual browser, rollback and release records before the conditional production decision.

## Refreshed rollback

The [current-main rollback rehearsal](ROLLBACK-CURRENT-MAIN.md) passed **11/11 real platform assertions and 2/2 browser phases**, including Finish through the actual UI and exact acceptance of the original issued game. Independent verification matched all 181 sealed files and all 58 observed loaded assets. The restored frozen app separately passed 60/60 Player Stats checks; those 60 checks are distinct from the 58 asset hashes. The refreshed document preserves the earlier deliberate SQL-fault evidence and records that the 11 backend/recovery files remained byte-identical to its original tested anchor.

## SC040 CI fixture correction

The [original SC040 CI failure](sc040-ci-failure-receipt.json) remains recorded as a failure. Its offline fixture replaced `window.SQ_ADMIN_AUTH`, while the production `sqAdminAction` helper retained its closed-over real Auth requirement. Hub opened through the explicit fixture, but Save correctly awaited real sign-in and the test timed out. The correction binds only that offline helper through the fixture Auth seam and the actual `SQ_SECURITY.admin` transport. The test now asserts the exact fixture Authorization, `update_player` operation, saved profile ID and UUID request envelope.

All **11/11 local suite runs passed** in [the repair receipt](sc040-fixture-results.json): SC040, P23 and N5 against both source and dist, plus source SC034, SC038, Training, Progression and the original smoke flow. Progression retained 24/24 checks and smoke retained 90/90. The original busy, saved, denied and zero-row assertions and timeouts remain intact. Both changed test files passed syntax checks and `git diff --check` passed. No application, build or backend bytes changed, and no real API/database writes occurred. These offline results do not relabel the original CI run or replace subsequent CI on the pushed head.
