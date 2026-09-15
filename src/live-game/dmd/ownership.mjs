import { createDmdV3Engine } from './v3/engine.mjs';
import { DMD_V3_RESOLUTIONS } from './v3/scene-registry.mjs';

export const sceneFor = kind => ({ PLAYER_UP:'PLAYER_UP', TARGET:'PLAYER_UP',
  HIT_SINGLE:'SINGLE', HIT_DOUBLE:'DOUBLE', HIT_TREBLE:'TREBLE',
  OUTER_BULL:'OUTER_BULL', BULLSEYE:'BULLSEYE', MISS:'MISS' })[kind] || null;

// Sole owner of renderer handoffs. Gameplay is read only through readBaseline.
export function createOwnershipRouter({ host, canvas, v2, readBaseline }) {
  let selected = host.__SQ_DMD_V3_ENABLED === false ? 'v2' : 'v3';
  let owner = 'none';
  let engine;
  let current = null;
  let fallbackTimer = null;
  const reduced = () => !!host.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function take(next) {
    owner = 'none';
    engine?.cancel();
    host.sqDmdStop?.();
    if (fallbackTimer != null) host.clearTimeout(fallbackTimer);
    fallbackTimer = null;
    owner = next;
  }
  function getEngine() {
    if (canvas.width !== 640) canvas.width = 640;
    if (canvas.height !== 160) canvas.height = 160;
    if (!engine) {
      engine = createDmdV3Engine({ host, outputCanvas:canvas,
        profile:DMD_V3_RESOLUTIONS.HYBRID_288, canRender:() => owner === 'v3' });
      host.__sqDmdV3 = engine;
    }
    return engine;
  }
  function restoreIdle() {
    current = null;
    if (selected === 'v2') { take('v2'); v2.restoreIdle(); return; }
    const data = readBaseline();
    if (!data) { take('v2'); v2.restoreIdle(); return; }
    take('v3');
    getEngine().renderAt('PLAYER_UP', 700, data, { reducedMotion:reduced() });
  }
  function render(zones, opts = {}) {
    current = { zones, opts };
    const scene = sceneFor(opts.eventKind);
    if (selected === 'v3' && scene) {
      take('v3');
      getEngine().play(scene, opts.eventData || {}, { reducedMotion:reduced() });
    } else { take('v2'); v2.render(zones, opts); }
  }
  const router = {
    render, restoreIdle,
    clear() { current = null; take('none'); },
    canWrite(backend) { return owner === backend; },
    refreshIdle() { if (!current && fallbackTimer == null && !host.document.hidden) restoreIdle(); },
    legacyScene(opts = {}) {
      if (opts.__sqSemantic === true) return;
      take('v2');
      fallbackTimer = host.setTimeout(() => {
        fallbackTimer = null;
        restoreIdle();
      }, Math.max(950, Number(opts.ms) || 0) + 80);
    },
    select(value) {
      if (value !== 'v2' && value !== 'v3') throw new Error('Expected v2 or v3');
      selected = value;
      host.__SQ_DMD_V3_ENABLED = value === 'v3';
      const previous = current;
      if (host.document.hidden) { take('none'); return; }
      if (previous) render(previous.zones, previous.opts); else restoreIdle();
    },
    snapshot:() => ({ selected, owner, eventKind:current?.opts.eventKind || null }),
  };
  host.__sqDmdOwnership = router;
  restoreIdle();
  return router;
}
