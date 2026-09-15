import { detectExistingBackend, install } from './controller.mjs';
import { createMotionSafeBackend } from './motion.mjs';
import { createOwnershipRouter } from './ownership.mjs';

const MAX_ATTEMPTS = 120;
const RETRY_MS = 50;
let attempts = 0;
let timer = null;

function backendReady(host) {
  return !!(
    host &&
    typeof host.sqDmdShowZones === 'function' &&
    typeof host.__sqDmdShowTransientZones === 'function' &&
    typeof host.__sqDmdCancelTransientScenes === 'function' &&
    typeof host.sqDmdSetIdle === 'function'
  );
}

function boot() {
  if (window.__sqDmdV2) return true;

  if (!backendReady(window)) {
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      console.warn('[SC-030] DMD V2 bootstrap skipped: existing DMD backend was not ready.');
      return false;
    }
    timer = window.setTimeout(boot, RETRY_MS);
    return false;
  }

  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }

  const v2 = createMotionSafeBackend(detectExistingBackend(window), window);
  const canvas = document.getElementById('sqDmdCanvas');
  const backend = createOwnershipRouter({ host:window, canvas, v2, readBaseline() {
    if (typeof state === 'undefined' || typeof ROUNDS === 'undefined') return null;
    const player = state.players?.[state.currentPlayer];
    const round = ROUNDS[state.currentRound];
    if (!player || !round) return null;
    return { player:typeof player === 'string' ? player : player.name || player.initials || '',
      target:round.target ?? round.type };
  } });
  // Existing UI actions establish state synchronously. Refresh the read-only
  // baseline after their event handlers finish, without another animation loop.
  document.addEventListener('click', () => queueMicrotask(() => backend.refreshIdle()));
  window.__sqDmdV2 = install({
    host: window,
    document,
    backend,
    maxQueue: 2,
    hapticsEnabled: false,
  });
  window.__sqDmdV2Ready = true;
  return true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { backendReady, boot };
