# SC-032 — DMD V3 Phase 1 Build Log

Status: **RELEASE CANDIDATE — BUILD/FIX COMPLETE; PHYSICAL DEVICE QA REQUIRED**

Candidate branch: `codex/sc032-dmd-v3-phase1`
Production base: `ef0a482f17c16f9266131ec7378d9d544378ca66`
Phase-0 authority: `dcbc5480c756549fbb320eb66477802078328e71`
Selected treatment: `640×160 authored → 288×72 HYBRID → 640×160 visible`

Phase 1 preserves SC-030 as the priority and scheduling authority. The ownership router grants the shared DMD canvas to exactly one backend, cancels the previous backend before handoff, restores the authoritative Player Up/target baseline, and falls back to V2 for unsupported presentation scenes.

Implemented files include `src/live-game/dmd/ownership.mjs`, `src/live-game/dmd/v3/`, the SC-030 controller metadata boundary, the bounded `recordThrow()` presentation forwarding, and the V3 bootstrap integration. Scoring, game state, modes, persistence, Supabase, rankings, XP, and completion rules are unchanged.

Acceptance evidence: source and dist builds, SC-030 responsive and reduced-motion suites, V2 controller suite, real Throwpad semantic scenes, ownership switching, 320/390/430 screenshots, and full smoke journey `84/84` passed. Source p95/p99 renderer cost: `0.60/0.60ms`; dist p95/p99: `0.50/0.60ms`; renderer calls ≥50ms: `0`.

Known release gate: physical iPhone Safari acceptance remains required. No merge or deployment is authorized by this candidate.

Rollback: disable V3 with `window.__SQ_DMD_V3_ENABLED = false`; the SC-030 V2 backend remains available.

Next action: run the physical iPhone Safari checklist in `docs/SC-032-DMD-V3-HOW-TO-USE.md`, record device evidence, then obtain explicit release approval before merge.
