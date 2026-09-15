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
    spike = await createRendererSpike({ canvas, visibleCanvas: canvas, host: window, reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  } catch (error) {
    window.__sqDmdSpikeUnavailable = String(error?.message || error);
    console.warn('[SC-032] Pixi WebGL spike unavailable; retaining V2 rollback.', error);
    window.__sqDmdV2 = install({ host: window, document, backend: v2, maxQueue: 2, hapticsEnabled: false });
    window.__sqDmdV2Ready = true;
    if (new URLSearchParams(window.location.search).get('sc032SpikeTest') === '1') {
      const panel = document.createElement('div'); panel.id = 'sc032SpikeDiagnostics'; panel.style.cssText = 'position:fixed;z-index:99999;left:8px;right:8px;bottom:8px;padding:8px;background:#160d06ee;color:#fff8e8;font:12px monospace;border:1px solid #ff5a4f;border-radius:6px';
      panel.textContent = `V2 FALLBACK | owner: V2 | WebGL initialization error: ${window.__sqDmdSpikeUnavailable}`; document.body.append(panel);
    }
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
  if (new URLSearchParams(window.location.search).get('sc032SpikeTest') === '1') {
    const panel = document.createElement('div');
    panel.id = 'sc032SpikeDiagnostics';
    panel.style.cssText = 'position:fixed;z-index:99999;left:8px;right:8px;bottom:8px;padding:8px;background:#160d06ee;color:#fff8e8;font:12px monospace;border:1px solid #ff9d2e;border-radius:6px';
    const status = document.createElement('div'); panel.append(status);
    for (const [label, action] of [['PLAYER UP', () => window.__sqDmdV2.emit({ kind:'PLAYER_UP', player:'SPIKE PLAYER', target:20 })], ['TREBLE', () => window.__sqDmdV2.emit({ kind:'HIT_TREBLE', points:60, target:20, total:60 })], ['DESMOND DELIGHT', () => window.__sqDmdV2.emit({ kind:'DESMOND_DELIGHT', total:80 })], ['V2 FALLBACK', () => window.__sqDmdOwnership.select('v2')]]) {
      const button = document.createElement('button'); button.textContent = label; button.style.margin = '3px'; button.onclick = action; panel.append(button);
    }
    document.body.append(panel);
    const update = () => { const d = spike.diagnostics; const s = window.__sqDmdOwnership.snapshot(); status.textContent = `${d.renderer} | owner: ${s.owner.toUpperCase()} | initialized:${d.initialized} rendered:${d.rendered} composited:${d.composited} | scene:${spike.active?.scene || 'IDLE'}${d.error ? ` | error:${d.error}` : ''}`; };
    window.__sqDmdSpikeDiagnostics = { update };
    window.setInterval(update, 100);
  }
  return true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { backendReady, boot };
