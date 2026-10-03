# SC-004 gameplay integration evidence

This document describes the real candidate source. It does not certify a production deployment. The final gate record identifies the served artifact and the real-platform results separately.

The browser loads `sc004-client.js`, `sc004-gameplay.js` and `admin-auth.js` before the materialized core script. The ESM transport export uses the same production implementation. Browser configuration contains only the public Supabase URL/key; command authority is an opaque, server-issued match or training credential stored separately from public engine state and receipts.

| Existing flow | Implemented boundary |
| --- | --- |
| Match, Practice, Turbo, Tournament and Vs Shadow setup | The existing setup and throw-order UI awaits server match issuance and a server-reserved game before resetting or accepting throws. Rules and series/single intent are captured from canonical state. Shadow issues authority for only its real player. |
| Throw entry, Undo, decider and final board | `recordThrow` remains the canonical scorer. The existing board, metadata, mode and decider winner are passed through `__sqBuildCompletedGamePayload`; no parallel scoring engine was added. Accepted or pending frozen completion cannot be changed by Undo. |
| Finish, local wins and match history | One shared completion promise freezes the canonical payload. The durable exact request is recorded before sending. Local award/advance happens after atomic server acceptance. Lost replies retry the same game, request ID and body. |
| Late arrival, order and current display | Scoped roster commands are awaited before local mutation. Existing first-game timing and between-game UI guards remain. Accepted snapshots are immutable. Match initials do not edit the persistent profile. |
| Restart, End Game and End Match | Own unaccepted slots are reset/cleaned through the controller. Pending completion blocks discard. Historical edits use enrolled admin authority. |
| Ordinary cached resume | The same cached credential is verified and renewed. A public UUID or player name is never used as control authority. |
| First unfinished legacy cache with no saved DB match | A real read must prove the old UUID absent and the cache must have no accepted history. Ordinary issuance creates fresh match/game IDs while retaining the board, cursor and throw history, including Practice and Shadow. The absent old UUID is not adopted. |
| Existing saved legacy cache | Enrolled owner Auth verifies server participants, wins, history and any owner-confirmed missing settings. Ordered totals-only history is compared with the old DB projection; cached presentation board/gameToken fields are retained. The server reserves only the next game. |
| Standard, TDB and Select Training | The existing training pads use a separate issued training scope. Completion and End Early preserve actual results/darts. Failed or in-flight save blocks Done/Play Again from discarding the current results. |
| Create Player and visits | Registration is create-only; duplicate name retries cannot overwrite a profile. Visit day is derived by the server. |

Credential, pending-start, completion and Go caches use a same-origin Web Lock for fresh read/merge/write/removal. Browser environments without that primitive fail closed before a recovery-cache mutation rather than risking loss of another tab's pending work. Network calls run outside the cache lock. Storage errors preserve local authority and completed payloads where possible, with an explicit memory-only recovery notice; they do not grant replacement authority by UUID.

The security notice owns its interactive layout. It overrides the older passive cloud-pill pointer-events/top rules so actual recovery and retry controls can receive clicks.

`gameplay-runtime-tests.mjs` verifies the production lifecycle/canonical-envelope contracts with an explicitly local transport double. `client-cache-tests.mjs` verifies cross-instance cache merging with fake network receipts. These are regression evidence, not Auth or database authorization acceptance.

`browser-platform-test.mjs` uses the actual candidate browser scripts and an isolated real Supabase Auth, Edge and PostgREST stack. It never replaces those API responses. Only the installed SDK asset is served locally at the pinned version. Setup, registration, throw-order/Ready, staged Finish, Training pads, owner recovery and retained admin screens are driven through their actual UI. Competitive throws invoke the same `recordThrow` entry used by the pad; boards and totals are read back from the actual database. Shadow uses its original natural replay timers. Synthetic legacy SQL setup is restricted to the isolated stack and provides a real saved Game1 plus the old totals-only history projection.

The browser evidence records the app URL, Git HEAD observed at launch and SHA-256 of the served index. Source runs use `http://127.0.0.1:8127/index.html`; built-artifact runs use the same origin at `/dist/index.html`. Protected credentials and synthetic capability-bearing storage are kept outside published evidence. Production cutover, real owner enrollment and restricted rollback remain controlled by the programme's separate gate record.

Final browser candidate acceptance passed **19/19 on source and 19/19 on dist**, with zero page errors in both runs. The public evidence is preserved in `browser-source-results.json` and `browser-dist-results.json`. These runs cover actual controller/Training receipts and enrolled synthetic Auth in the isolated stack. They do not claim production deployment or replace the programme's independent restricted rollback and owner bootstrap gates.
