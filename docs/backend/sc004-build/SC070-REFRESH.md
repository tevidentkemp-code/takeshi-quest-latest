The SC-004 candidate was refreshed from main `388ffec4b6dac169e932e09815a3e94759ed98ed` to `73aa208156bd030418d83c301980a90457f84ec0`, which adds SC-070 five-player presentation. The observed rebuilt runtime candidate is `a19f5dcf3823b69e32ba62800a1fc31fa24468e1`. The published `dba8944132ce39520c19ff931d32176d7a10c437` and its original evidence remain preserved. This refresh has not been deployed to production.

Independent comparison found the exact eight-file SC-070 delta and no additional runtime change:

- All 22 SC-004 SQL, migration, Edge, configuration and recovery files match both `dba8944` and the proven `50d4595` runtime byte-for-byte. The 11 Edge/recovery files in the actual sealed `50d4595` rollback anchor also match their manifest hashes.
- At compatibility capture, the owned `live-v2.js`, two five-player CSS modules and `verify-sc070-five-player-fit.js` equal SC-070 main exactly. All three owned source modules appear verbatim in the materialized compatibility output. The new renderer hunks do not overlap SC-004 authority or engine changes. The subsequent test-only readiness correction is described below; runtime source remains unchanged.
- All 63 prior release-history objects are unchanged. The added SC-070 v0.11.7 object equals main; the 64-entry history retains SC-004 v0.12.0 as the current release.
- The Core workflow preserves the prior workflow exactly after removing only SC-070's additional syntax check and new matrix job. All six SC-004 static commands remain. Expected final CI is 37 Core jobs (17 retained plus 20 SC-070) and seven specialist jobs, across eight workflows.

The immutable [compatibility receipt](sc070-refresh-compatibility.json) was captured outside Git, SHA-256 `5c0f92df4e3a1f7fd7ca849aea8c2510de2d025bc4dfd4626a4df19eef50180e`. It includes each compared file/hash, sealed-anchor comparisons and the exact changed-path set at that capture. Its pending fields retain their original capture state; the later acceptance receipts below provide completed results. The controller separately reports the fresh exact original production catalog guard passed in a read-only transaction; avatars remain 1–29, the intended owner is permanent and confirmed, and no SC-004 production schema is installed. This comparison did not execute production SQL, alter the local database, regenerate guards or change runtime source.

The two production-unapplied migration contents are unchanged:

| Migration | SHA-256 |
| --- | --- |
| `20261003161850_sc004_scoped_authority_additive.sql` | `f71a1bd8497c15faa711a8c85230f72f56fcdd86a6f4f72841bd076f02a1e763` |
| `20261003161851_sc004_close_legacy_mutation.sql` | `f0a67bdfa9804d81bac145be90f4231e3804072ed33c92efc3957a18190f2012` |

The original real-platform 45/45 acceptance and full SQL-fault/hold proof remain evidence for these unchanged backend files. They do not establish acceptance of the refreshed app. The controller reports rebuild and `verify:dist` passed before this independent comparison. Fresh app acceptance completed separately:

| Check | Later refresh result |
| --- | --- |
| SC-004 actual source and dist browser flows | PASS 19/19 on each, zero page errors; actual isolated Auth/Edge/PostgREST responses |
| SC-070 Chromium/WebKit, source/dist rendering | PASS four complete 62-case runs, 248 total; explicit offline transport fixtures |
| Release-note browser checks | PASS 23 assertions on source and 23 on dist, 64 release entries |
| Static authority/contract/syntax commands | PASS 25/25; cache 5/5 and runtime 6/6 use explicit transport doubles |
| Current app anchor and app-restoration phases | PASS 11 platform checks and two actual browser phases |
| Final pushed candidate CI, eight workflows / 44 jobs | Pending at document capture; record final results outside Git and on the PR |

The [browser summary](sc070-refresh-browser-receipt.json), [source results](sc070-refresh-browser-source-results.json) and [dist results](sc070-refresh-browser-dist-results.json) identify the observed `a19f5dc` runtime and served module/bundle hashes. Both unchanged 19-check suites finished with exit 0 and no authority response mocks. The browser summary has SHA-256 `9b89a626ad2635ad36429f6aa89dc9b08799daf27d3f9f6dd2541efdac0b3e87`. The dist index is `06b9eaec008956ef1012af8334c679174f1771ac5d16ab0bb724e3bbe64b1399`; the source index alone is insufficient to identify imported runtime modules.

The [offline/static receipt](sc070-refresh-offline-results.json), SHA-256 `96fb0957da1f263cea3bd296dec4b65f93cb09c1a3b8b9894e4a0f5a145f706a`, retains both original Chromium failures and the original WebKit passes. The original fixture could read the preceding game's `body.page='game'` while secure issuance and rendering were still preparing, then assert Turbo round 7 prematurely. The sole test correction relocates its existing two-line loading-overlay wait/catch before the Turbo assertion/start. Independent byte comparison confirms that exact relocation is the entire file change. The predicate, diagnostic catch, round-7/timer checks, all 62 cases and their assertions, and all deadlines are unchanged. Repaired verifier SHA-256 is `25a932983f8d32a4fc6efd1a52fb6d95374926ee74b51edec6363b7c2217cc05`. These offline and cache/runtime results do not substitute for real authority acceptance.

The fresh app-restoration rehearsal uses run `a4eccca5-cd3e-4d97-a135-7b74451405b2`, candidate `a19f5dcf3823b69e32ba62800a1fc31fa24468e1`, and [sealed 181-file anchor](sc070-refresh-rollback-manifest.json) SHA-256 `10bcc1548024548ca27e655acc392a13fd52d9e08a268a2bf0556023250e1898`. The [deliberate app-outage receipt](sc070-refresh-rollback-app-outage.json) confirms actual HTTP 503 after the local write hold committed. The [restoration receipt](sc070-refresh-rollback-restoration.json) verifies all 181 anchor files and unchanged 42 function definitions plus nine private-table fingerprints. Its fingerprint baseline was captured under the committed hold, rather than before the hold. The [platform results](sc070-refresh-rollback-platform-results.json) passed prepare 3/3, held 4/4 and recovered 4/4; the [browser results](sc070-refresh-rollback-browser-results.json) passed both phases with zero page errors. They preserved the original nine throws, continued to ten, and used the actual UI Finish to save original game `235ac974-df95-4d15-9346-91ebd97af8a8` in match `415999f5-146a-45d0-a604-4129083d7e00` once. All 58 served frozen assets matched the anchor. The final local hold is released.

This refresh repeated the app outage/replacement and actual queue/browser recovery only. It did not repeat an Edge/backend fault or execute SQL function recovery. The prior full backend/SQL-fault proof is retained because all 11 sealed Edge/recovery files are byte-identical. No anonymous grants, policies or retired PIN/commentary bypasses were restored.

The earlier `dba8944` CI result is eight workflows and 24 jobs passed. The [preserved receipt](ci-dba-final-results.json) is an exact copy of its original outside-Git `final-ci-results.json`, SHA-256 `4f6dc38548389cc051ad70a2cadab7fbe926141a2f640063c2d3a787061c81fd`; it must not be relabelled as this candidate's CI. Likewise, the prior SC-063 browser and app-restoration receipts retain their original source/hash and anchor identities. The new app evidence preserves SC-070, original capability/queue state and acceptance of the same original pending game once. An older app anchor would omit the new presentation.

Production remains subject to the [cutover runbook](CUTOVER-RUNBOOK.md), intended-owner server-secret setting and actual enrolled-owner sign-in. The additive proof, brief guarded-closure hold and restricted rollback order are unchanged. No anonymous authority restoration or public-ID adoption is permitted.
