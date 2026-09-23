# MASTER TEST 06 — C-037 Repository-facing Documentation

Status: EXPERIMENTAL / TEST-BENCHMARK-PROPOSE

Repository: `tevidentkemp-code/takeshi-quest-latest`

Locked commit: `69e14553beee376f28af63c7faf905bbd9c03228`

Local branch: `benchmark/c037-repository-docs`

Verified date: 2026-09-23 (Europe/London)

This record is benchmark evidence, not Project canon, product authority, implementation authority, sequencing authority, or release permission. It must not be merged to production without separate acceptance and approval.

## HOW TO USE

Use this file only to reproduce or audit MASTER TEST 06 at the locked commit. Run the two tasks unchanged, score against the locked keys, and keep baseline results frozen before evaluating the C-037 route. Stronger live Drive sources and live repository evidence always win. Remove this file with the experimental documentation layer to roll back the canary.

## TASK

### Operating boundary

- Mode: TEST / BENCHMARK / PROPOSE.
- No gameplay, scoring, state, Supabase, production, permission, release, merge, or deployment change.
- Current Shateki sequencing remains SXP-001 Experience 05 Gate 3 PARKED.
- The canary may add documentation only in this isolated local branch.

### Locked Task A — UI / design navigation

Prompt: Identify the authoritative implementation path and constraints for a proposed visual-only refinement of the mobile Live Game `Menu / TV / Sound` utility controls. Return the editable source files, generated files that must not be edited directly, design authority, protected behaviour, responsive/accessibility constraints, and required verification. Do not implement the change.

Acceptance key:

1. Markup owner: `src/app/router-ui.js`, where `ensureLiveV2Panel()` creates `#v2QuickMenu`, `#v2QuickTv`, and `#v2QuickSound`.
2. Behaviour owner: `src/live-game/live-v2.js`, especially `__sqBindLiveV2QuickRail()` and `__sqLiveV2PaintQuickSound()`.
3. Style owner: `src/styles/live-game/v2-panel.css`.
4. Generated compatibility outputs are not editable sources: `index.html`, `src/legacy/scripts/inline-005.js`, and `src/legacy/styles/inline-002.css`.
5. Stronger visual authority remains Drive `01-theme-direction.md` (`1BKCI-MPIke-8MU-EJQg_ybK1LWes9MAImNZW11GtFQA`); live code is implementation truth.
6. Preserve 44×44 CSS-pixel controls, accessible names/state, keyboard focus, existing Menu/TV/Sound behaviour, mobile-first 320/390/430 widths, no gameplay delay, and no scoring/state/Supabase change.
7. Material verification includes source-to-generated parity/materialisation, syntax/static checks, built `dist` verification, representative browser/mobile checks, and relevant SXP-04/current-main acceptance coverage.

### Locked Task B — architecture / state-flow navigation

Prompt: Trace one accepted dart-entry event from the Live Game control through canonical state mutation, presentation, persistence, and QA. Identify where a visual-response fix may be made without double-applying the dart or changing scoring. Do not implement the change.

Acceptance key:

1. UI handlers in `src/live-game/live-v2.js` call canonical `recordThrow()` once per dart; quick entry explicitly preserves one-by-one canonical calls.
2. Canonical mutation lives in `src/game/engine.js::recordThrow(spec)`: validate cursor, calculate the dart, write `entry.darts[dartIndex]`, recompute `roundTotal`, append undo history, update aggregates, advance dart/player/round, then call `updateUI()`.
3. `updateUI()` is in `src/live-game/live-v2.js`; it renders from current state, rebuilds the pad, refreshes Live V2/V3 presentation, and calls `save()` for local recovery/cache behaviour.
4. Throw DMD/commentary is presentation derived from the already-written canonical throw. It must not mutate scoring. Delayed scenes are guarded by flow/history tokens so later input or Undo invalidates stale presentation.
5. Completed-game persistent writes occur through `recordFullGameToSupabase()` / service paths, not as an independent per-dart UI truth. Supabase remains persistent truth; local storage is cache/recovery only.
6. A visual-response fix belongs in presentation/controller code (`src/live-game/live-v2.js`, `src/live-game/dmd/*`, or owned styles) unless evidence proves an engine defect. It must not add a second `recordThrow()` call, batch a new state format, or edit generated `src/legacy/scripts/inline-005.js`.
7. Required verification covers syntax, JS source-authority parity, materialised/build output, score-entry/undo/skip/mode regression, rapid/repeated input, source and `dist` browser checks, DMD cancellation/restoration, and state/presentation parity.

### Scoring

For each task score: accepted-output correctness, acceptance pass, repository reads/tool calls, canonical-source reads/tool calls, total calls, call ordinal at correct subsystem, wrong files, incorrect assumptions, authority errors, protected-dependency violations, re-explanation, selected-context estimate, omissions, inventions, design/state drift, handover quality, maintainability, stale-derived-truth response, and rollback.

Context figures are heuristic selected-input estimates, not provider billing or credit telemetry.

## BUILD LOG

### BL-001 — Source and commit lock

- Fresh-read MASTER Research Inbox C-037 registration, Source Freshness/Research Queue, Failures/Lessons/Regression Tests, Routing Standard, Skill Router, SKL-001, and SKL-002.
- Fresh-read Shateki Source Map, Pipeline, Coding Project Control TASK/BUILD LOG/HANDOVER, Working Rules, Coding Instructions, HOW TO USE, Game Rules, theme direction, and live GitHub repository metadata.
- Locked `main` at `69e14553beee376f28af63c7faf905bbd9c03228`.
- Confirmed Shateki MASTER adoption remains unaudited; no repository document is allowed to silently change that state.

### BL-002 — Frozen baseline: Task A

- Result: PASS, 7/7 acceptance-key groups.
- Repository route: 3 tool calls to identify and validate the subsystem; 10 logical repository file reads plus one repository-wide search.
- Correct subsystem first appeared on repository call 2, after five broad orientation files.
- Canonical route: Source Map + Working Rules + theme direction (3 logical canonical reads).
- Wrong-file selections: 0 final; `docs/ui-audit/*` appeared in search as dated evidence but was correctly not treated as current authority.
- Incorrect assumptions: 0. Authority errors: 0. Protected-dependency violations: 0.
- Re-explanation/recovery: 1 follow-up validation pass was required to distinguish inline runtime styling from the semantic CSS owner and generated compatibility outputs.
- Selected context: approximately 12k–14k tokens ESTIMATED from bounded source excerpts, architecture documents, search results, and canonical excerpts.
- Handover quality: complete, but the correct three-file ownership set was not obvious from the repository root.

### BL-003 — Frozen baseline: Task B

- Result: PASS, 7/7 acceptance-key groups.
- Repository route: 4 tool calls; 9 logical repository/workflow reads plus two repository-wide searches.
- Correct state owner (`src/game/engine.js::recordThrow`) appeared on repository call 1; correct complete boundary required calls 2–4.
- Canonical route: Source Map + Working Rules + Game Rules + public-release engineering standard (4 logical canonical reads).
- Wrong-file selections: 0 final. Incorrect assumptions: 0. Authority errors: 0. Protected-dependency violations: 0.
- Re-explanation/recovery: 2 focused follow-ups were needed because the first large excerpt mixed state mutation, DMD presentation, delayed timers, and generated-runtime references.
- Selected context: approximately 18k–21k tokens ESTIMATED.
- Handover quality: correct and reproducible, but expensive; the state/presentation/persistence split had to be reconstructed across multiple large files.

### BL-004 — Baseline aggregate

- Accepted tasks: 2/2.
- Acceptance-key groups: 14/14.
- Repository tool calls: 7.
- Logical repository/workflow reads: 19, plus 3 broad searches.
- Logical canonical-source reads: 7.
- Wrong-file selections: 0.
- Incorrect assumptions: 0.
- Source-authority errors: 0.
- Protected-dependency violations: 0.
- Required recovery/re-explanation passes: 3.
- Selected context: approximately 30k–35k tokens ESTIMATED.
- Provider token/credit/cost and end-to-end wall time: NOT MEASURABLE.

Baseline results are frozen at this point. Later C-037 results must not rewrite them.

### BL-005 — Canary documentation layer

Created and read back four bounded, commit-stamped, non-canonical helpers:

- `AGENTS.md` — authority order, protected behaviour, editable/generated boundaries, verification, permission and refresh rules.
- `docs/ARCHITECTURE.md` — current system map and accepted-dart state/presentation/persistence trace.
- `docs/DESIGN_SYSTEM.md` — implementation-facing visual authority, live tokens, utility-rail ownership, accessibility/responsive constraints, and explicit unknowns.
- `docs/PRD.md` — product invariant and authority-link summary only; no roadmap or build permission.

The layer is 217 lines / 16,102 bytes. All four files identify the locked SHA and non-canonical status. All local Markdown links resolve. No application source was changed.

### BL-006 — C-037 route: Task A

- Result: PASS, 7/7 acceptance-key groups.
- Repository route: 1 bounded tool call; 5 logical repository reads (`AGENTS.md`, `docs/DESIGN_SYSTEM.md`, and the three exact owning source files); no repository-wide search.
- Correct subsystem and complete three-file ownership set appeared on repository call 1.
- Canonical route: 1 task-specific canonical source read at the source-lock stage (current Drive theme direction); the helper correctly kept it above derived repository guidance.
- Wrong-file selections: 0. Incorrect assumptions: 0. Authority errors: 0. Protected-dependency violations: 0.
- Re-explanation/recovery: 0.
- Selected context: approximately 6k–8k tokens ESTIMATED.
- Handover quality: complete; editable owners, generated exclusions, authority, protected behaviour, target widths, accessibility and verification were available from one entry route and exact source confirmation.

### BL-007 — C-037 route: Task B

- Result: PASS, 7/7 acceptance-key groups.
- Repository route: 1 bounded tool call; 5 logical repository/workflow reads (`AGENTS.md`, `docs/ARCHITECTURE.md`, `src/game/engine.js`, `src/live-game/live-v2.js`, and the SXP-04 current-main workflow); no repository-wide search.
- Correct state owner and the complete state/presentation/persistence split appeared on repository call 1.
- Canonical route: 1 task-specific canonical source read at the source-lock stage (current Drive Working Rules); the helper correctly kept Supabase truth and repository implementation above the derived summary.
- Wrong-file selections: 0. Incorrect assumptions: 0. Authority errors: 0. Protected-dependency violations: 0.
- Re-explanation/recovery: 0.
- Selected context: approximately 9k–12k tokens ESTIMATED.
- Handover quality: complete; the fix-placement rule, one-call scoring invariant, generated exclusion, persistence boundary and verification set were explicit and confirmed in live source.

### BL-008 — Comparative result

| Measure | Baseline | C-037 route | Change |
|---|---:|---:|---:|
| Tasks accepted | 2/2 | 2/2 | no regression |
| Acceptance-key groups | 14/14 | 14/14 | no regression |
| Repository tool calls | 7 | 2 | -5 / -71% |
| Logical repository/workflow reads | 19 | 10 | -9 / -47% |
| Broad repository searches | 3 | 0 | -3 / -100% |
| Task-specific canonical reads | 7 | 2 | -5 / -71% |
| Correct complete subsystem | Task A call 2; Task B calls 2–4 | Task A call 1; Task B call 1 | earlier for both |
| Wrong-file selections | 0 | 0 | no regression |
| Incorrect assumptions | 0 | 0 | no regression |
| Source-authority errors | 0 | 0 | no regression |
| Protected-dependency violations | 0 | 0 | no regression |
| Recovery/re-explanation passes | 3 | 0 | -3 / -100% |
| Selected context | 30k–35k EST. | 15k–20k EST. | about -43% to -50% |

Provider token/credit/cost and end-to-end wall time were not exposed and are NOT MEASURABLE. The selected-context figures are bounded heuristic estimates, so the defensible efficiency claim is reduced navigation calls, reads, searches and recovery passes—not a billing claim.

### BL-009 — Deliberate stale/conflict fixture

A temporary repository-derived note asserted, incorrectly, that `index.html` was editable source and `localStorage` was persistent gameplay truth. The C-037 route:

1. identified the note as derived and deliberately stale;
2. rejected both assertions;
3. selected `docs/architecture/SOURCE_AUTHORITY.md` and current Drive Working Rules as stronger sources;
4. independently confirmed the persistence boundary in `README.md`, `docs/architecture/PUBLIC_RELEASE_ENGINEERING_STANDARD.md`, and `src/services/supabase-contract.json`; and
5. made no implementation change.

Fixture result: PASS. Stale-derived-truth errors: 0. Authority-selection errors: 0. The temporary false note was removed after the evidence was recorded here so it cannot pollute later repository navigation.

### BL-010 — Maintenance and drift assessment

- `AGENTS.md`: high navigation value across both tasks; low update surface when kept to authority order, protected boundaries and verification. Proposed retention.
- `docs/ARCHITECTURE.md`: high value for Task B; its function-level trace must be refreshed when scoring/persistence ownership changes. Proposed retention.
- `docs/DESIGN_SYSTEM.md`: high value for Task A; token copies create drift risk, mitigated by commit/date labels, source links, and explicit instruction to re-read live tokens. Proposed retention with future review of whether the token table should be shortened further.
- `docs/PRD.md`: no observable advantage on either benchmark task beyond links already supplied elsewhere. It duplicates durable game invariants and adds roadmap/state staleness risk. Proposed rejection.
- Separate `SECURITY.md` and `TESTING.md`: not created. Existing repository engineering/security and workflow/test evidence already cover the benchmark needs; new root files would add cosmetic document count without demonstrated task value.

Required ownership if retained: repository maintainers update the three retained helpers in the same change that alters an owned boundary; reviewers compare them with Drive authorities and live source. Deterministic refresh input is the current Source Map, task-specific Drive authority, current `main` SHA, ownership maps, and named live implementation. Rollback is deletion of the derived helpers; no application/data migration is involved.

### BL-011 — Verification and acceptance checks

- Full readback completed for all four canary documents and this benchmark record.
- Local Markdown-link check: PASS, 0 missing targets.
- Non-canonical label check: PASS, 4/4.
- Locked-SHA label check: PASS, 4/4.
- `git diff --check`: PASS.
- `npm run materialize`: PASS; HTML, core CSS and core JavaScript rebuilt from source authority without a tracked application diff.
- `npm run build`: PASS under Vite 8.3.0. Vite emitted the existing informational warnings that classic legacy scripts lack `type="module"`; the build completed.
- `npm run verify:dist`: PASS, schema version 2; 47 classic local script references, 1 source module reference, 1 dist module reference, 1 stylesheet reference, relative base true.
- First materialisation attempt: setup failure because the repository's separate `scripts/package-lock.json` dependencies had not been installed. The exact locked `scripts/` dependency set was installed, temporary failed-build artifacts were removed, and the same verification then passed. This was a benchmark-environment recovery, not a product-source fix.
- Environment warning: repository `package.json` requests Node `>=24.21.0`; the available runtime was Node `24.15.0`. The documented build checks passed, but strict validation on the requested engine remains unverified.
- Browser/visual regression was not run because this canary changed documentation only and introduced no application or visible-output delta.
- Pre-approval experimental change boundary: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/PRD.md`, and `docs/benchmark/C037_MASTER_TEST_06.md` only.

### BL-012 — MASTER control update and readback

Appended bounded C-037 results to the existing MASTER Research Inbox, Source Freshness/Research Queue, and Failures/Lessons controls using revision-guarded Google Docs writes. Post-write connector readback confirmed the exact target document IDs, new revisions, complete Test 06 text, 4-of-6 programme state, reduced three-document proposal, rejected options, conflict-fixture outcome, and no-promotion boundary. No MASTER Routing Standard, Skill Router, Genesis standard, governance, permission, automation, or Project canon was modified.

### BL-013 — Review approval

Thomas explicitly approved the review PR for the reduced proposal. The rejected `docs/PRD.md` canary was removed. Final review scope is `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, and this benchmark evidence file only. Approval covers final verification, commit, branch push and PR creation; merge, deployment, release, Project-canon change and MASTER/Genesis promotion remain outside scope.

### BL-014 — Review PR handover

Review PR #89 was opened against `main`: `https://github.com/tevidentkemp-code/takeshi-quest-latest/pull/89`. Remote readback confirmed the PR is open, non-draft, unmerged and mergeable, with exactly four changed files: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, and this benchmark evidence file. No pull-request-triggered workflow runs were present at the first remote check. No merge, deployment or release action was taken.

## DECISION

**MASTER TEST 06 / C-037: PASS for a reduced three-document repository guidance layer; review PR approved, merge/promotion remain unapproved.**

Proposed retain: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`.

Proposed reject: `docs/PRD.md`, separate `SECURITY.md`, separate `TESTING.md`.

The retained subset delivered the same 14/14 accepted outputs with fewer navigation calls, reads, searches, recovery passes and selected context, while the conflict fixture correctly preferred stronger authority. The full four-document layer is not recommended because `docs/PRD.md` did not earn its maintenance burden.

Thomas approved preparation of the reduced three-document review PR. This approval authorises removal of the rejected `docs/PRD.md`, final verification, commit, branch push, and PR creation only. It does not authorise merge, deployment, Shateki-canon change, Project-sequencing change, release, wider rollout, or promotion into a MASTER/Genesis standard.

## HANDOVER

Current state: benchmark complete and MASTER evidence controls updated/read back. The rejected `docs/PRD.md` canary has been removed following explicit approval. Review PR #89 is open, non-draft, unmerged and mergeable with the exact three-document guidance layer plus this benchmark evidence; no deployment, product code, data, or production state was changed.

Verified result: PASS for the reduced three-document subset; `docs/PRD.md` rejected.

Exact next action: review PR #89. Any merge, deployment, wider rollout or MASTER/Genesis promotion requires separate explicit approval.

Rollback: close the review PR without merge and delete `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, and `docs/benchmark/C037_MASTER_TEST_06.md` from the review branch. No application or data rollback is required.
