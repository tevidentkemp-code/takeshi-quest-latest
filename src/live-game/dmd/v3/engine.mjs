import { buildSceneFrame, getSceneDuration } from './scene-registry.mjs';
import { renderLogicalFrame } from './renderer.mjs';
import { createDmdTreatment } from './treatment.mjs';

function createLogicalCanvas(profile, outputCanvas) {
  const doc = outputCanvas && outputCanvas.ownerDocument;
  let canvas;
  if (doc && typeof doc.createElement === 'function') canvas = doc.createElement('canvas');
  else if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(profile.width, profile.height);
  else throw new Error('No logical canvas surface available');
  canvas.width = profile.width;
  canvas.height = profile.height;
  return canvas;
}

export function createDmdV3Engine(options = {}) {
  const profile = options.profile;
  const outputCanvas = options.outputCanvas;
  if (!profile) throw new Error('DMD V3 engine requires a resolution profile');
  if (!outputCanvas) throw new Error('DMD V3 engine requires an output canvas');

  const logicalCanvas = createLogicalCanvas(profile, outputCanvas);
  const logicalCtx = logicalCanvas.getContext('2d', { alpha: true });
  const treatment = createDmdTreatment(outputCanvas, profile, options.treatment || {});
  const host = options.host || globalThis;
  const raf = options.raf || ((cb) => host.requestAnimationFrame(cb));
  const caf = options.caf || ((id) => host.cancelAnimationFrame(id));
  const now = options.now || (() => host.performance.now());
  const assets = options.assets || {};

  let active = null;
  let requestId = null;

  function renderAt(sceneId, timeMs, data = {}, renderOptions = {}) {
    if (options.canRender && !options.canRender()) return null;
    const frame = buildSceneFrame(sceneId, timeMs, data, renderOptions);
    renderLogicalFrame(logicalCtx, frame, { assets });
    treatment.render(logicalCanvas, { intensity: frame.intensity });
    return frame;
  }

  function cancel() {
    if (requestId != null) {
      caf(requestId);
      requestId = null;
    }
    active = null;
  }

  function play(sceneId, data = {}, playOptions = {}) {
    cancel();
    const duration = getSceneDuration(sceneId);
    const start = now();
    active = { sceneId, data, playOptions, start, duration };
    const token = active;

    const tick = (timestamp) => {
      if (active !== token) return;
      const elapsed = Math.max(0, Number(timestamp) - active.start);
      renderAt(sceneId, Math.min(duration, elapsed), data, playOptions);
      if (elapsed < duration || playOptions.loop === true) {
        const nextElapsed = playOptions.loop === true ? elapsed % Math.max(1, duration) : elapsed;
        if (playOptions.loop === true && nextElapsed !== elapsed) active.start = Number(timestamp) - nextElapsed;
        requestId = raf(tick);
      } else {
        requestId = null;
        if (typeof playOptions.onComplete === 'function') playOptions.onComplete();
      }
    };

    requestId = raf(tick);
    return { sceneId, duration, cancel };
  }

  return {
    profile,
    logicalCanvas,
    outputCanvas,
    treatment,
    renderAt,
    play,
    cancel,
    setAsset(key, value) { assets[key] = value; },
    get active() { return active ? { ...active } : null; },
  };
}
