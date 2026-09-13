# Shateki Quest Public-Release Engineering Standard

## Purpose

This document defines the engineering quality bar for the modular Shateki Quest codebase. It supplements the canonical Working Rules and Game Rules; it does not redefine gameplay or product behaviour.

The governing principle is: **small, reversible, independently verified changes with explicit ownership and no hidden production authority.**

## 1. Architecture

- Keep the browser UI, game/domain logic, persistent-data services and presentation code separated by explicit boundaries.
- Prefer native JavaScript modules and small public APIs over framework migration for its own sake.
- Keep game-rule calculations independent from visual effects, DMD rendering, sound and animation.
- Keep Supabase access behind service functions once verified; UI code must not invent schema or persistence contracts.
- Preserve mode isolation: Classic/Official, Turbo, Practice, Vs Shadow and Training must not contaminate one another.
- New code belongs to an owned domain. Unclear legacy code stays quarantined until its callers and side effects are known.
- No large-scale rewrite is accepted where a strangler migration can preserve proven behaviour.

## 2. Source layout and ownership

The target source tree uses stable domains such as:

- `src/app/` — bootstrap, routing, state coordination.
- `src/game/` — scoring/game engine and rule-neutral orchestration.
- `src/modes/` — mode-specific behaviour.
- `src/live-game/` — Live Game, throwpad, race, averages and DMD.
- `src/services/` — Supabase and external-data access.
- `src/player-stats/` — player profile/statistics presentation and transforms.
- `src/league/` — rankings and league presentation.
- `src/ui/` — reusable UI primitives and modal/navigation behaviour.
- `src/styles/` — tokens, shared foundations and domain-owned styles.
- `src/legacy/` — temporary compatibility source only; no new feature should originate here.

Generated compatibility runtimes may remain temporarily while source ownership is migrated. Generated output must be reproducible from committed source and must never become a second source of truth.

## 3. Deterministic toolchain

- Use an active Node.js LTS line for repository tooling and pin the CI version explicitly.
- Commit npm lockfiles for every independently installed package tree.
- CI installs dependencies with `npm ci`; dependency resolution is not allowed to drift silently between runs.
- Package upgrades are deliberate changes with their own green regression evidence.
- Vite is the planned production build/dev layer only after source parity is proven. The production build must be deterministic and emit a deployable `dist/` artifact.
- GitHub Pages base-path behaviour must be explicitly configured and verified before the build pipeline replaces the current static deployment route.

## 4. CI/CD and supply-chain security

- Workflow token permissions are read-only by default.
- A job that executes application or migration code does not receive repository write permission.
- Repository writes happen only in a separate job after verification succeeds, with the smallest required permission.
- External GitHub Actions are pinned to full commit SHAs. Human-readable release versions remain comments for reviewability.
- Generated-file writes are guarded by an explicit allow-list and `git diff --check`.
- Build/deploy actions must consume verified artifacts rather than rebuilding unreviewed source with broader credentials.
- Before public release, protect `main` with required status checks and an explicit review/merge policy.
- Public-release deployment should add build provenance/artifact attestation where supported by the final pipeline.

## 5. Testing

Tests should verify user-observable contracts rather than implementation details wherever practical.

Required layers:

- syntax/static structure checks for generated code;
- focused unit/contract tests for isolated modules as modules are introduced;
- integration tests for game-state and mode boundaries;
- Playwright browser tests for critical user journeys;
- visual/layout assertions for the mobile Live Game surface;
- explicit persistence-path tests against verified Supabase contracts where safe;
- release smoke tests against the built artifact before deployment.

Browser tests should prefer resilient role, accessible-name, text or explicit test-id locators over brittle DOM/CSS structure selectors when a stable user-facing contract exists.

Critical regressions include setup, resume, score entry, miss, undo, skip, all 14 rounds, completion, 2–6 players, mode isolation, rankings/stats, DMD/race bounds, modal Back/Close and mobile control clearance.

## 6. Accessibility and mobile interaction

- WCAG 2.2 AA is the public-release baseline; automated checks supplement rather than replace manual testing.
- Preserve the Shateki internal 44×44 CSS-pixel minimum tap-target target for primary interactive controls unless a documented exception is essential.
- Keyboard focus must remain visible and must not be hidden behind sticky/fixed UI.
- Controls need accessible names and state where applicable.
- Motion respects `prefers-reduced-motion` when effects are non-essential.
- Do not require dragging where a single-pointer alternative can provide the same function unless dragging is essential.
- Test at minimum the existing 320px, 390px and 430px mobile widths plus representative desktop layout.

## 7. Data and security

- Supabase remains the persistent source of truth.
- No service-role or privileged secret may exist in client code, ordinary source documents or public repository history.
- Client-visible keys are treated according to Supabase's intended public-key model; authorization is enforced by verified RLS/auth policies, not by hiding client configuration.
- RLS/auth/security remediation is a separate explicit public-release gate and must be completed before launch.
- Schema, tables, views, RPCs and returned fields are inspected live before code is changed.
- Architecture migration must not weaken RLS or create a competing local source of truth.

## 8. Performance and production build

Once Vite becomes the verified build layer:

- review generated chunk sizes and source maps;
- keep initial-load code focused on the active application path;
- lazy-load genuinely secondary/admin areas where measurement supports it;
- optimise large images and other static assets;
- preserve cacheable hashed assets;
- establish explicit performance budgets only after a measured baseline exists.

Performance changes require measurements; file splitting alone is not treated as proof of improvement.

## 9. Observability and failure behaviour

- Unexpected runtime errors must be visible during QA; do not suppress console failures to make tests green.
- Network/data failures should fail clearly and must not fabricate successful persistence.
- Existing known backend failures are tracked separately from architecture work rather than hidden by UI patches.
- Public release should have a defined client-error reporting strategy before broad distribution.

## 10. Release and rollback

A structural slice is releasable only when:

1. authoritative source and affected boundaries were inspected;
2. the change is bounded and documented;
3. protected behaviour remains green;
4. the production build is reproducible;
5. database truth is unchanged unless separately authorised;
6. rollback is explicit and tested or trivially reversible;
7. release approval is explicit.

SC-031 remains BUILD/FIX work. Nothing in this standard authorises a production merge or deployment.

## External standards used for this engineering bar

Current implementation choices should be periodically rechecked against primary documentation from GitHub Actions security guidance, Node.js release/LTS guidance, Vite production/deployment guidance, Playwright testing guidance and W3C WCAG 2.2. Version upgrades are reviewed deliberately rather than followed through floating tags.
