import { detectExistingBackend, install } from './controller.mjs';
import { createMotionSafeBackend } from './motion.mjs';
import { createRendererSpike, sceneOf } from './spike.mjs';

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

async function boot() {
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
  let spike;
  try {
    spike = await createRendererSpike({ canvas, host: window, reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  } catch (error) {
    window.__sqDmdSpikeUnavailable = String(error?.message || error);
    console.warn('[SC-032] Pixi WebGL spike unavailable; retaining V2 rollback.', error);
    window.__sqDmdV2 = install({ host: window, document, backend: v2, maxQueue: 2, hapticsEnabled: false });
    window.__sqDmdV2Ready = true;
    return true;
  }
  let owner = 'v2';
  const backend = {
    render(zones, opts = {}) {
      const scene = sceneOf(opts.eventKind);
      if (window.__SQ_DMD_SPIKE_ENABLED !== false && scene) {
        owner = 'spike'; v2.clear(); spike.play(opts.eventKind, opts.eventData || {}); return;
      }
      owner = 'v2'; spike.cancel(); return v2.render(zones, opts);
    },
    clear() { spike.cancel(); v2.clear(); owner = 'v2'; },
    restoreIdle() { spike.cancel(); owner = 'v2'; return v2.restoreIdle(); },
  };
  window.__sqDmdSpike = spike;
  window.__sqDmdOwnership = { snapshot: () => ({ owner, selected: window.__SQ_DMD_SPIKE_ENABLED === false ? 'v2' : 'spike' }), canWrite: backendName => backendName === owner, select(value) { window.__SQ_DMD_SPIKE_ENABLED = value === 'spike'; owner = value; if (value === 'v2') spike.cancel(); }, };
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
