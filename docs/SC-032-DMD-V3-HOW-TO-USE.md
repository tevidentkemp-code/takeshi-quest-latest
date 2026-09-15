# SC-032 DMD V3 Phase 1 — QA How To Use

Run `npm ci --prefix scripts --ignore-scripts`, `npm ci --ignore-scripts --no-audit --no-fund`, `npm run build`, and `npm run verify:dist`. Browser QA dependencies belong to `tools/ui-smoke`; do not add them to the root package.

The V3 candidate is selected by default. Set `window.__SQ_DMD_V3_ENABLED = false` before bootstrap to exercise the V2 rollback. Use the ownership snapshot at `window.__sqDmdOwnership.snapshot()` to confirm the selected backend and current writer.

Verify on iPhone Safari in portrait at narrow, standard, and wide phone widths:

- Start a disposable two-player match and confirm Player Up and target baseline.
- Exercise Single, Double, Treble, Outer Bull, Bullseye, and Miss through the real Throwpad.
- Fire Dart 1, Dart 2, Dart 3 rapidly; confirm the latest scene remains readable and input is never blocked.
- Use Undo and Skip, hand the turn to the next player, and confirm the baseline restores.
- Switch V2/V3 while idle and during a transient; confirm no blank canvas, stale repaint, or duplicate renderer output.
- Confirm current-round targets remain embedded in each player score cell, historic rows contain scores only, and the immediate orange-dot reset remains unchanged.
- Check no horizontal or vertical overflow, full Throwpad access, readable DMD at phone size, and no console errors.
- Repeat with iOS Reduce Motion enabled; information must remain while translation, zoom, shake, and repeated pulses disappear.

Capture screenshots for Player Up, Single, Double, Treble, Bullseye, Miss, rapid-throw final state, and reduced-motion Treble. Record iPhone model, iOS/Safari version, viewport orientation, and whether each check passed.
