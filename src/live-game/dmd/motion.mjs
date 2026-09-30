/*
 * SC-030 reduced-motion adapter.
 * Presentation only: scoring, game state, persistence and mode routing stay untouched.
 */

export function prefersReducedMotion(host = globalThis) {
  try {
    return !!(
      host &&
      typeof host.matchMedia === 'function' &&
      host.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch (_) {
    return false;
  }
}

export function createMotionSafeBackend(base, host = globalThis) {
  if (!base || typeof base.render !== 'function') return base;

  return {
    ...base,
    render(zones, opts = {}) {
      if (!prefersReducedMotion(host)) return base.render(zones, opts);
      return base.render(zones, {
        ...opts,
        type: 'hold',
        amp: 0,
      });
    },
    renderScene(scene = {}) {
      if (typeof base.renderScene !== 'function') return undefined;
      if (!prefersReducedMotion(host)) return base.renderScene(scene);
      return base.renderScene({
        ...scene,
        renderType: 'hold',
        amp: 0,
        motion: 'reduced',
      });
    },
  };
}
