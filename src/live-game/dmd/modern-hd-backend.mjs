/*
 * Shateki Quest — SXP-001 Experience 05 Gate 3 Modern HD architecture proof backend.
 *
 * Presentation-only adapter.
 * Accepts renderer-neutral scene descriptors from controller.mjs and routes them
 * through the existing safe transient surface while Gate 3 proves ownership.
 * Final Modern HD visual implementation belongs to later bounded gates.
 */

function clean(value, max = 48) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function createModernHdProofBackend(base = {}) {
  const renderBase = typeof base.render === 'function' ? base.render.bind(base) : () => {};
  const clearBase = typeof base.clear === 'function' ? base.clear.bind(base) : () => {};
  const restoreBase = typeof base.restoreIdle === 'function' ? base.restoreIdle.bind(base) : () => {};

  return {
    ...base,
    architecture: 'modern-hd-proof-backend',
    renderScene(scene = {}) {
      const zones = {
        z2: clean(scene.headline, 24),
        z3: clean(scene.subline, 24),
      };
      const opts = {
        type: clean(scene.renderType || 'hold', 24).toLowerCase(),
        ms: Number.isFinite(Number(scene.duration)) ? Math.max(0, Number(scene.duration)) : 2000,
        amp: Number.isFinite(Number(scene.amp)) ? Number(scene.amp) : 3.2,
        __sqSceneId: clean(scene.sceneId, 48),
        __sqSceneToken: clean(scene.token, 96),
        __sqSceneFamily: clean(scene.family, 24),
        __sqSceneType: clean(scene.sceneType, 24),
        __sqSceneArchitecture: clean(scene.architecture, 48),
        __sqReducedMotion: scene.motion === 'reduced',
      };
      return renderBase(zones, opts);
    },
    clear() {
      return clearBase();
    },
    restoreIdle(baseline) {
      // The released transient channel owns fresh-current-state restoration.
      // The baseline argument is intentionally forwarded for future Modern HD
      // ownership without requiring gameplay state to move into this adapter.
      return restoreBase(baseline);
    },
  };
}
