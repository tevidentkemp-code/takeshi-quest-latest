# SC-060 — Shateki Test Lab

**Purpose:** Pre-production visual and workflow acceptance on real iPhones from the **same GitHub source** as Shateki Quest. This is not a separate scorer or a database.

## Output contract
- Public GitHub Pages continues to build with `npm run build` → `dist/`. No lab script, CSS, offline fixture or banner goes into that output.
- Test Lab is a **separate deployment target** built with `npm run build:testlab` → `test-lab-dist/`. Vercel's dedicated `shateki-quest-test-lab` project reads root `vercel.json`, enforcing the lab build command and a restrictive CSP.
- The Vercel project production URL tracks the currently shipped `main` source. Vercel Git previews for PR branches are the **candidate test builds**, auto-deployed when a candidate PR is pushed. For pre-release approval, use the PR's exact preview URL and SHA, not the latest-main stable URL.
- Confirm the displayed commit (top bar / build info) matches the candidate before approving release.

## Isolation
- Lab banner clearly says **TEST LAB — OFFLINE / NO REAL DATA**. Local and non-authoritative.
- Before production scripts load, `network-guard.js` blocks cross-origin fetch, XHR, WebSocket, EventSource and beacons. Supabase REST **GET/HEAD/OPTIONS** are emulated as empty local reads; no production network request is sent. All other remote calls, including Supabase writes, are rejected.
- The SC004 gameplay controller fixture comes **directly from** `tools/ui-smoke/security-fixture.js` during lab build. It issues fake controller receipts only in local browser storage. It is not a second game engine.
- Defense in depth: Vercel HTTP CSP plus inline HTML CSP: `connect-src 'self'; form-action 'none'`. The separate Vercel origin prevents sharing cookies/localStorage with production Pages.
- No test score, player, XP, trophy or ranking is production data. **Never use the lab as evidence of an actual Supabase persistence or authenticated production save.**

## Operator controls
Tap **LAB** on a phone. Choose Classic, Turbo or Practice and select:
- **2-PLAYER QUICKSTART** — live product game screen from two local fixture players, normal engine and offline controller.
- **5-PLAYER STRESS** — canonical five-player mobile layout and score wall.
- **LAST ROUND** — use real `recordThrow` visits to reach the final round.
- **END GAME** — complete an in-memory match with asymmetrical fixture scoring.
- **XP SCREEN** — test-only postgame XP screen using the product renderer; no real award.
- **MATCH WON / MATCH LOST** — product's winner result presentation with a different fixture winner (there is no separate canonical loser screen).
- **LIVE UPDATES EVENT** — inject a one-off local printer line, never cloud history.
- **RESET LAB** — clear this lab origin's storage and refresh.

## Candidate / release gate
1. Review GitHub PR target and code diff. Automatic Test Lab preview must show the **same exact PR SHA**; verify the obvious TEST banner.
2. Run protected Core release QA plus SC-060 lab static and iPhone/WebKit tests.
3. On a physical iPhone, test QuickStart at two and five players, history scroll/Undo, last round, Game Win/Match Win, XP, LIVE UPDATES and Reset. Report device/iOS version and problems.
4. Fix and retest failures on the same candidate branch. **Test Lab acceptance never replaces official Game Rules or production Supabase/RLS verification.**
5. Only after explicit release approval merge to canonical `main`; GitHub Pages deploy and public readback are separate production gates.

## Recovery
- Before Test Lab release: close the unmerged SC060 PR. Public app unaffected.
- After staging deployment: revert the isolated lab build script/config/new test-only files in a scoped change; no database migration or user-data rollback. Do not change normal `npm run build`.
- If Vercel Git integration fails, keep lab status **IMPLEMENTED/QA ONLY** and do not assert a stable URL.
