# Shateki Quest Repository Guide

Status: **DERIVED ORIENTATION — NON-CANONICAL**

Verified against commit: `69e14553beee376f28af63c7faf905bbd9c03228`

Verified: 2026-09-23 (Europe/London)

This file shortens repository navigation. It does not replace current Google Drive Project authorities, live source code, Supabase truth, approved sequencing, or release permission. If it conflicts with any stronger source, stop, use the stronger source, and record the mismatch before changing code.

## Read order

1. Confirm the task, operating mode, current branch/commit, and explicit write/release permission.
2. Read the current Shateki Source Map and the task-specific Drive authority named there.
3. Read the relevant repository map in `docs/architecture/` and then the live source files.
4. For UI work, read `docs/DESIGN_SYSTEM.md`; for state/data work, read `docs/ARCHITECTURE.md`.
5. Treat dated audits, proposals, generated outputs, and these helper documents as evidence or orientation only.

## Authority and protected behaviour

- Supabase is persistent truth. Browser storage is cache/recovery only.
- `src/game/engine.js::recordThrow()` is the canonical scoring mutation path. Do not duplicate it, bypass it, or add a second state format without explicit approval and evidence.
- Preserve player count, round sequence, dart count, scoring rules, mode isolation, Back versus Close behaviour, and existing persistence boundaries.
- Keep the live throw path fast. Presentation, DMD, sound, animation, and telemetry must not delay or mutate scoring.
- Preserve accessible names/state, keyboard focus, reduced-motion behaviour, and at least 44×44 CSS-pixel touch targets where the current design standard requires them.
- Do not modify production data, Supabase schema/policies, security controls, public brand, or live automation behaviour without their own explicit scope and approval.

## Editable source and generated output

Edit semantic source, not materialised compatibility output:

- HTML/app shell: `src/app/router-ui.js` and owned files described by `docs/architecture/HTML_COMPONENT_MAP.md`.
- JavaScript: owned modules listed by `docs/architecture/JS_SOURCE_AUTHORITY.md`.
- CSS: owned modules listed by `docs/architecture/CSS_SOURCE_AUTHORITY.md`.
- Generated outputs: `index.html`, `src/legacy/scripts/inline-005.js`, and `src/legacy/styles/inline-002.css`. Do not edit these directly.

Run `npm run materialize` to regenerate compatibility output and `npm run build` plus `npm run verify:dist` to verify the built application.

## Change and verification discipline

- Make the smallest coherent change in the owning source file.
- Check repository status before and after; preserve unrelated user changes.
- For JavaScript changes, run syntax/static checks, source-authority parity, build/dist checks, and the relevant functional workflow.
- For visual changes, test source and built output at representative mobile widths 320, 390, and 430 CSS pixels, including focus, touch, overflow, and reduced motion.
- For state changes, test score entry, Undo, Skip, mode isolation, rapid/repeated input, persistence boundaries, and presentation cancellation/restoration.
- A local build or passing check is not release approval. Do not merge, push, deploy, or change production without explicit authority.

## Current sequencing warning

At this verification point, SXP-001 Experience 05 is live at v0.5.1 and Gate 3 is parked/unmerged. This is a time-stamped orientation fact, not permanent sequencing authority. Re-read the Shateki MASTER Pipeline and Coding Project Control before resuming or starting experience work.

## Deterministic refresh

Re-check the Source Map, Working Rules, Coding Project Control, Shateki MASTER Pipeline, relevant task authority, repository `main` SHA, source-authority maps, and live implementation. Update this guide only as a reviewed derived copy; never resolve a conflict by weakening the stronger source.
