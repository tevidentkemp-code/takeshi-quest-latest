# SC-032 — DMD V3 Phase 0 Authority / Closure

Status: **PHASE 0 CLOSED / PHASE 1 AUTHORISED FOR BUILD**

This file resolves the final Phase-0 authority state for SC-032 and supersedes any conflicting older wording inside the exploratory SC-032 design/build/how-to-use documents on this branch.

## Production baseline

Current production code authority when this closure was recorded:

`main` = `31c02a2cb7a0cf684e976cda4d14bef9d866e54f`

This is the released SC-030 modular Live Game / DMD V2 baseline. Phase 1 must be created from current `main`, after re-verifying that baseline or reviewing any later production movement.

## Phase-0 evidence authority

Final three-density Phase-0 evidence code head:

`f25c3c695028eb8d5a228cdf3e4eacb19028c9af`

Final Phase-0 workflow:

`34878176517` — **SUCCESS**

Evidence artifact:

`sc032-dmd-v3-phase0-evidence`

Artifact id:

`10361951786`

Artifact digest:

`sha256:1c6e8378b6b11a1ca5685e9c69b6687b56088d539972ed91afe0696e01d979f8`

The successful browser acceptance on that exact code head exercised three controlled candidates at the same 640×160 authored scene resolution:

- 256×64 physical dot treatment;
- **288×72 Hybrid physical dot treatment**;
- 320×80 physical dot treatment.

The 288×72 candidate is intentionally declared inside the Phase-0 visual lab as `HYBRID_PROFILE`; Phase 0 did **not** yet promote that experimental candidate into the production-facing resolution registry. That promotion belongs to Phase 1.

The browser acceptance explicitly verifies `candidate288.dotColumns === 288`, `candidate288.dotRows === 72`, deterministic frames, distinct output versus the 256 and 320 candidates, reduced-motion differentiation, phone-scale geometry and the same hard renderer performance gates as the other candidates.

## Product/design selection

Selected Phase-1 treatment:

**HYBRID — 640×160 authored scene → 288×72 physical dot treatment → 640×160 visible DMD**

Reason:

- 256×64 retains strong DMD texture but is visibly more retro/stippled than the requested Beta-quality direction;
- 320×80 is smoother but begins to lose too much obvious DMD texture in ordinary score/text scenes;
- 288×72 is the intended middle ground: materially smoother and more digital than V2 while retaining unmistakable DMD character.

Thomas reviewed the comparison direction and then instructed the project to proceed to implementation / Codex handoff. Treat 288×72 as the approved Phase-1 design choice unless Thomas explicitly reopens it.

## Locked architecture

Phase 1 must preserve:

```text
existing gameplay state/events
        -> SC-030 DMD controller / priority scheduler
        -> V3 semantic adapter
        -> deterministic V3 scene registry/timeline
        -> 640×160 smooth Canvas2D authored scene
        -> 288×72 stable physical-dot treatment
        -> visible DMD canvas
```

V3 remains presentation-only. It must not own scoring, player/dart/round truth, mode rules, persistence, Supabase state, rankings or game completion.

## Phase-1 source-control rule

Do **not** merge the Phase-0 branch wholesale.

Create/recreate Phase 1 from current production `main` and selectively port the proven V3 renderer modules. The Phase-0 branch remains research/evidence authority.

The 288×72 Hybrid profile must be promoted out of lab-local ownership into the canonical V3 production configuration during Phase 1.

V2 must remain an immediate rollback backend until V3 completes full release acceptance.

## Phase-1 minimum scope

Foundation scenes:

- Player Up / target baseline;
- Single;
- Double;
- Treble;
- Outer Bull;
- Bullseye;
- Miss;
- authoritative baseline restoration and controller pre-emption.

Required engineering qualities:

- timestamp-based requestAnimationFrame motion;
- no deliberate 30fps stepping;
- reduced-motion variants;
- deterministic fixed-time render testing;
- source and built-dist regression;
- paced post-warmup performance testing;
- no renderer-attributed >=50ms call;
- p95 renderer cost <8ms;
- p99 <16.67ms;
- mobile visual evidence at representative 320 / 390 / 430 widths;
- physical iPhone Safari smoke before release.

## Release boundary

This closure authorises **BUILD/FIX only** for Phase 1.

It does not authorise production merge/deployment.

Production release still requires explicit Thomas `RELEASE` authority after exact-head QA and real-device acceptance.

## Rollback

Before release: abandon/close the Phase-1 branch or disable the V3 backend and retain V2.

After any future approved release: use the bounded release commit/merge rollback route recorded by that release; no Supabase rollback is expected for renderer-only adoption.

## Exact next action

Resume SC-032 Phase 1 from a clean branch based on current `main`, using this closure file plus exact Phase-0 run `34878176517` as the authoritative handoff. Promote 288×72 into canonical V3 configuration, port only the required renderer foundation, retain V2 rollback, run full source/dist/controller/mobile/performance acceptance, then stop at release gate.
