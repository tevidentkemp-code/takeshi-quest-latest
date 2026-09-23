/*
 * Shateki Quest — SXP-001 Experience 05 Modern HD backend.
 *
 * Presentation-only adapter. Semantic/controller scenes arrive here after
 * canonical gameplay state has already been decided. This module never owns
 * scoring, timers, persistence or mode rules.
 */

function clean(value, max = 48) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function sceneOptions(scene = {}) {
  const payload = scene.payload || {};
  return {
    type: clean(scene.renderType || 'hold', 24),
    ms: Number.isFinite(Number(scene.duration)) ? Math.max(0, Number(scene.duration)) : 2000,
    amp: Number.isFinite(Number(scene.amp)) ? Number(scene.amp) : 3.2,
    __sqModernHd: true,
    __sqPersistent: scene.persistent === true,
    __sqUpdateOnly: scene.updateOnly === true,
    __sqSceneId: clean(scene.sceneId, 48),
    __sqSceneToken: clean(scene.token, 96),
    __sqSceneFamily: clean(scene.family, 24),
    __sqSceneType: clean(scene.sceneType, 24),
    __sqSceneMode: clean(scene.mode, 24),
    __sqSceneArchitecture: clean(scene.architecture, 48),
    __sqReducedMotion: scene.motion === 'reduced',
    __sqPlayer: clean(payload.player, 24),
    __sqTarget: clean(payload.target, 16),
    __sqSeconds: Number.isFinite(Number(payload.seconds)) ? Math.max(0, Number(payload.seconds)) : null,
    __sqMargin: Number.isFinite(Number(payload.margin)) ? Number(payload.margin) : null,
  };
}

export function createModernHdProofBackend(base = {}, host = globalThis) {
  const renderBase = typeof base.render === 'function' ? base.render.bind(base) : () => {};
  const clearBase = typeof base.clear === 'function' ? base.clear.bind(base) : () => {};
  const restoreBase = typeof base.restoreIdle === 'function' ? base.restoreIdle.bind(base) : () => {};
  let lastBaseline = null;

  function applyBaseline(scene) {
    if (!scene) return;
    lastBaseline = scene;
    try {
      if (typeof host.__sqDmdSetModernHdBaseline === 'function') {
        host.__sqDmdSetModernHdBaseline(scene);
      }
    } catch (_) {}
  }

  return {
    ...base,
    architecture: 'modern-hd-gate4-backend',
    renderScene(scene = {}) {
      if (String(scene.family || '').toUpperCase() === 'IDLE') {
        applyBaseline(scene);
        return true;
      }

      const zones = {
        z2: clean(scene.headline, 24),
        z3: clean(scene.subline, 24),
      };
      return renderBase(zones, sceneOptions(scene));
    },
    clear() {
      return clearBase();
    },
    restoreIdle(baseline) {
      const result = restoreBase(baseline);
      if (baseline) applyBaseline(baseline);
      else if (lastBaseline) applyBaseline(lastBaseline);
      return result;
    },
    baseline() {
      return lastBaseline ? { ...lastBaseline } : null;
    },
  };
}
