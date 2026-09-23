# Shateki Quest Design-System Orientation

Status: **DERIVED IMPLEMENTATION GUIDE — NON-CANONICAL**

Verified against commit: `69e14553beee376f28af63c7faf905bbd9c03228`

Verified: 2026-09-23 (Europe/London)

The current Drive theme direction is the stronger visual/UX authority; live source is implementation truth. This file names current implementation paths and constraints only. It does not approve a redesign or alter the brand.

## Authority

- Visual/UX direction: [Drive `01-theme-direction.md` — `1BKCI-MPIke-8MU-EJQg_ybK1LWes9MAImNZW11GtFQA`](https://docs.google.com/document/d/1BKCI-MPIke-8MU-EJQg_ybK1LWes9MAImNZW11GtFQA/edit)
- Working rules: [Drive document `19Bps656J9DjJzXRRpWbUhjoetJDD-h76o5D0f4-WqwI`](https://docs.google.com/document/d/19Bps656J9DjJzXRRpWbUhjoetJDD-h76o5D0f4-WqwI/edit)
- CSS ownership: [`architecture/CSS_SOURCE_AUTHORITY.md`](architecture/CSS_SOURCE_AUTHORITY.md)
- Implemented foundations: [`../src/styles/core/foundations-tokens.css`](../src/styles/core/foundations-tokens.css)

The umbrella direction is a dark arcade identity with restrained orange emphasis, mobile-first clarity, and fast interaction over decorative delay. Specialist feature controls, including DMD controls, remain subordinate within their approved scope.

## Current tokens in source

Do not copy these values into a new parallel token system. Re-read `src/styles/core/foundations-tokens.css` before editing.

| Role | Current value |
|---|---|
| Background | `--bg: #0f1220` |
| Card | `--card: #171a2b` |
| Primary ink | `--ink: #e7e9f5` |
| Muted ink | `--muted: #a8acc3` |
| Accent | `--accent: #7bdcff` |
| Secondary accent | `--accent-2: #8cff9e` |
| Leader lime | `--leader-lime: #9BFF2E` |
| Danger / warning / good | `#ff6b6b` / `#ffcc66` / `#7fffd4` |
| Brand orange | `--shatekiOrange: #ff7a00` |
| Brand blue | `--shatekiBlue: #2f86ff` |
| General radius | `--radius: 14px` |

The primary-button implementation currently uses orange-led colour, `#ffbd86` border/outline ink, `#ffead9` text, and an 8px radius. Treat source definitions—not this summary—as definitive.

## Type, spacing, and component rules

- The application base uses a system UI stack. Monospace styling is reserved for dense game/DMD-like information where already implemented.
- Reuse existing spacing, radius, shadow, control, panel, and typography rules in the owning stylesheet. No universal spacing scale is canonically declared here.
- Keep hierarchy readable under gameplay pressure: primary score/action first, utilities secondary, status legible without competing animation.
- Use semantic controls with stable accessible names. Visible icon-only controls still require meaningful labels/state.
- Preserve keyboard focus and reduced-motion handling. Motion must be interruptible and must not delay scoring or other canonical interaction.
- Touch controls governed by the current standard remain at least 44×44 CSS pixels.

## Live Game utility rail

For visual-only work on the mobile `Menu / TV / Sound` controls:

- Markup owner: `src/app/router-ui.js::ensureLiveV2Panel()` (`#v2QuickMenu`, `#v2QuickTv`, `#v2QuickSound`).
- Behaviour owner: `src/live-game/live-v2.js`, especially `__sqBindLiveV2QuickRail()` and `__sqLiveV2PaintQuickSound()`.
- Style owner: `src/styles/live-game/v2-panel.css`.
- Do not edit `index.html`, `src/legacy/scripts/inline-005.js`, or `src/legacy/styles/inline-002.css` directly.
- Preserve existing Menu, TV, and Sound behaviour; ARIA state; focus; 44×44 targets; and layout at 320, 390, and 430 CSS pixels.
- A visual refinement must not change gameplay, scoring, state, Supabase behaviour, or input latency.

## Verification

Run materialisation/parity, syntax/static checks, build and `dist` verification. Exercise both source and built application paths at 320/390/430 widths, keyboard focus, touch, overflow, reduced motion, and relevant current-main/SXP-04 regression coverage. Record screenshots or other visual evidence when a visible result changes.

## Unknowns and refresh rule

This document does not declare a complete reusable component library, a canonical spacing scale, or permission to normalize legacy styling. Those remain unresolved unless stronger current evidence says otherwise. Refresh by comparing the Drive theme direction and Working Rules with CSS ownership and live tokens/components at the current `main` SHA.
