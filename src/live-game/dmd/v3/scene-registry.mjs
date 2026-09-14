import {
  clamp01,
  countBetween,
  deterministicJitter,
  fadeWindow,
  lerp,
  pulse,
  scaleIn,
  segment,
  translateIn,
} from './primitives.mjs';

export const DMD_V3_RESOLUTIONS = Object.freeze({
  DENSE_256: Object.freeze({ id: '256x64', width: 256, height: 64, dotColumns: 128, dotRows: 32 }),
  DENSE_320: Object.freeze({ id: '320x80', width: 320, height: 80, dotColumns: 160, dotRows: 40 }),
});

export const DMD_V3_PALETTE = Object.freeze({
  amber: '#ff8a1c',
  amberHot: '#ffc66d',
  warm: '#fff0cf',
  green: '#74e2a8',
  red: '#ff5a4f',
  dim: '#7f4a1e',
});

export const DMD_V3_SCENES = Object.freeze([
  'PLAYER_UP',
  'SINGLE',
  'TREBLE',
  'BULLSEYE',
  'MISS',
  'PERSONAL_BEST',
  'LAST_DART_HERO',
  'DESMOND',
  'VOLDY',
]);

const DEFAULT_DATA = Object.freeze({
  player: 'THOM',
  target: '20',
  points: 60,
  total: 180,
  score: 332,
  previousScore: 286,
});

function withDefaults(data = {}) {
  return { ...DEFAULT_DATA, ...(data || {}) };
}

function text(textValue, x, y, size, options = {}) {
  return {
    kind: 'text',
    text: String(textValue ?? ''),
    x, y, size,
    align: options.align || 'center',
    baseline: options.baseline || 'middle',
    weight: options.weight || 800,
    alpha: options.alpha == null ? 1 : clamp01(options.alpha),
    color: options.color || DMD_V3_PALETTE.amber,
    scale: options.scale == null ? 1 : options.scale,
  };
}

function number(value, x, y, size, options = {}) {
  return { ...text(String(value), x, y, size, options), kind: 'number' };
}

function line(x1, y1, x2, y2, options = {}) {
  return {
    kind: 'line',
    x1, y1, x2, y2,
    width: options.width || 0.008,
    alpha: options.alpha == null ? 1 : clamp01(options.alpha),
    color: options.color || DMD_V3_PALETTE.amber,
  };
}

function ring(x, y, radius, options = {}) {
  return {
    kind: 'ring',
    x, y, radius,
    width: options.width || 0.012,
    alpha: options.alpha == null ? 1 : clamp01(options.alpha),
    color: options.color || DMD_V3_PALETTE.amber,
  };
}

function cross(x, y, size, options = {}) {
  return {
    kind: 'cross',
    x, y, size,
    width: options.width || 0.018,
    alpha: options.alpha == null ? 1 : clamp01(options.alpha),
    color: options.color || DMD_V3_PALETTE.red,
  };
}

function image(assetKey, options = {}) {
  return {
    kind: 'image',
    assetKey,
    x: options.x ?? 0.5,
    y: options.y ?? 0.5,
    width: options.width ?? 1.06,
    height: options.height ?? 1.06,
    alpha: options.alpha == null ? 1 : clamp01(options.alpha),
    scale: options.scale ?? 1,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    monochrome: options.monochrome !== false,
    tint: options.tint || DMD_V3_PALETTE.amber,
  };
}

function scene(id, duration, layers, meta = {}) {
  return {
    id,
    duration,
    layers,
    background: meta.background || 'black',
    intensity: meta.intensity ?? 1,
  };
}

function playerUpFrame(t, d, reduced) {
  const enter = reduced ? 1 : segment(t, 0, 240);
  const drift = reduced ? 0 : translateIn(t, 0, 240, 0.06);
  const sweep = reduced ? 0 : segment(t, 120, 700);
  return scene('PLAYER_UP', 1400, [
    line(0.11 + drift, 0.77, 0.89, 0.77, { alpha: 0.22 + sweep * 0.34, width: 0.006 }),
    text(d.player, 0.5 + drift, 0.43, 0.42, { color: DMD_V3_PALETTE.warm, alpha: enter, weight: 900 }),
    text('UP', 0.86, 0.43, 0.13, { color: DMD_V3_PALETTE.amber, alpha: enter * 0.9, weight: 800 }),
    text(`TARGET ${d.target}`, 0.5, 0.78, 0.13, { color: DMD_V3_PALETTE.amber, alpha: 0.62 + 0.28 * sweep, weight: 800 }),
  ], { intensity: 0.9 });
}

function singleFrame(t, d, reduced) {
  const a = fadeWindow(t, 0, reduced ? 40 : 90, 260, 320);
  const y = 0.48 + (reduced ? 0 : translateIn(t, 0, 160, 0.07));
  return scene('SINGLE', 320, [
    number(d.points || 20, 0.5, y, 0.56, { color: DMD_V3_PALETTE.warm, alpha: a, scale: reduced ? 1 : scaleIn(t, 0, 180, 1.06), weight: 900 }),
    text('SINGLE', 0.18, 0.79, 0.11, { color: DMD_V3_PALETTE.amber, alpha: a * 0.8, align: 'left' }),
    text(`TOTAL ${d.total}`, 0.82, 0.79, 0.11, { color: DMD_V3_PALETTE.amber, alpha: a * 0.76, align: 'right' }),
  ]);
}

function trebleFrame(t, d, reduced) {
  const a = fadeWindow(t, 0, reduced ? 40 : 90, 350, 430);
  const p = reduced ? 0 : pulse(t, 40, 360, 1);
  const total = reduced ? d.total : countBetween(t, 90, 350, Math.max(0, d.total - d.points), d.total);
  return scene('TREBLE', 430, [
    ...(reduced ? [] : [
      ring(0.5, 0.46, 0.19 + p * 0.11, { alpha: (1 - p) * 0.38, width: 0.010 }),
      ring(0.5, 0.46, 0.29 + p * 0.06, { alpha: (1 - p) * 0.18, width: 0.006 }),
    ]),
    number(d.points || 60, 0.5, 0.45, 0.58, { color: DMD_V3_PALETTE.warm, alpha: a, scale: reduced ? 1 : scaleIn(t, 0, 180, 1.10), weight: 900 }),
    text(`TREBLE ${d.target}`, 0.18, 0.80, 0.11, { color: DMD_V3_PALETTE.amber, alpha: a * 0.88, align: 'left' }),
    text(`TOTAL ${total}`, 0.82, 0.80, 0.11, { color: DMD_V3_PALETTE.amberHot, alpha: a * 0.92, align: 'right' }),
  ], { intensity: 1.05 });
}

function bullFrame(t, d, reduced) {
  const a = fadeWindow(t, 0, reduced ? 40 : 100, 430, 520);
  const p = reduced ? 0 : segment(t, 20, 430);
  return scene('BULLSEYE', 520, [
    ...(reduced ? [] : [
      ring(0.5, 0.44, lerp(0.13, 0.34, p), { alpha: (1 - p) * 0.44, width: 0.012, color: DMD_V3_PALETTE.amberHot }),
      ring(0.5, 0.44, lerp(0.08, 0.24, p), { alpha: (1 - p) * 0.28, width: 0.008 }),
    ]),
    number(50, 0.5, 0.43, 0.60, { color: DMD_V3_PALETTE.warm, alpha: a, scale: reduced ? 1 : scaleIn(t, 0, 210, 1.12), weight: 900 }),
    text('BULLSEYE', 0.18, 0.80, 0.11, { color: DMD_V3_PALETTE.amberHot, alpha: a * 0.9, align: 'left' }),
    text(`TOTAL ${d.total}`, 0.82, 0.80, 0.11, { color: DMD_V3_PALETTE.amber, alpha: a * 0.8, align: 'right' }),
  ], { intensity: 1.08 });
}

function missFrame(t, d, reduced) {
  const a = fadeWindow(t, 0, reduced ? 30 : 55, 190, 250);
  const j = reduced ? { x: 0, y: 0 } : deterministicJitter(t, 0.006, 0.12);
  return scene('MISS', 250, [
    cross(0.5 + j.x, 0.43 + j.y, 0.22, { alpha: a, width: 0.022, color: DMD_V3_PALETTE.red }),
    text('MISS', 0.5, 0.79, 0.13, { color: DMD_V3_PALETTE.red, alpha: a * 0.92, weight: 900 }),
  ], { intensity: 0.95 });
}

function pbFrame(t, d, reduced) {
  const a = fadeWindow(t, 0, reduced ? 60 : 120, 900, 1050);
  const score = reduced ? d.score : countBetween(t, 80, 640, d.previousScore, d.score);
  const p = reduced ? 0 : pulse(t, 300, 900, 1);
  return scene('PERSONAL_BEST', 1050, [
    ...(reduced ? [] : [ring(0.5, 0.43, 0.27 + p * 0.06, { alpha: 0.12 + (1 - p) * 0.22, width: 0.007, color: DMD_V3_PALETTE.green })]),
    number(score, 0.5, 0.42, 0.57, { color: DMD_V3_PALETTE.warm, alpha: a, weight: 900 }),
    text('PERSONAL BEST', 0.5, 0.79, 0.12, { color: DMD_V3_PALETTE.green, alpha: a * 0.95, weight: 900 }),
  ], { intensity: 1.06 });
}

function artworkFrame(id, assetKey, label, t, reduced, options = {}) {
  const duration = options.duration || 900;
  const enter = reduced ? 1 : segment(t, 0, 220);
  const exitAlpha = fadeWindow(t, 0, 100, duration - 130, duration);
  const scale = reduced ? 1 : lerp(options.startScale || 1.07, 1, enter);
  const j = (!reduced && options.jitter) ? deterministicJitter(t, options.jitter, 0.055) : { x: 0, y: 0 };
  return scene(id, duration, [
    image(assetKey, {
      alpha: exitAlpha,
      scale,
      offsetX: j.x,
      offsetY: j.y,
      tint: options.tint || DMD_V3_PALETTE.amber,
    }),
    text(label, 0.5, 0.86, 0.105, {
      color: options.labelColor || DMD_V3_PALETTE.amberHot,
      alpha: Math.min(1, enter * 1.15) * exitAlpha,
      weight: 900,
    }),
  ], { intensity: options.intensity || 1 });
}

export function getSceneDuration(sceneId) {
  switch (sceneId) {
    case 'PLAYER_UP': return 1400;
    case 'SINGLE': return 320;
    case 'TREBLE': return 430;
    case 'BULLSEYE': return 520;
    case 'MISS': return 250;
    case 'PERSONAL_BEST': return 1050;
    case 'LAST_DART_HERO': return 900;
    case 'DESMOND': return 900;
    case 'VOLDY': return 950;
    default: throw new Error(`Unknown DMD V3 scene: ${sceneId}`);
  }
}

export function buildSceneFrame(sceneId, timeMs = 0, data = {}, options = {}) {
  const d = withDefaults(data);
  const reduced = options.reducedMotion === true;
  const duration = getSceneDuration(sceneId);
  const t = Math.max(0, Math.min(duration, Number(timeMs) || 0));

  switch (sceneId) {
    case 'PLAYER_UP': return playerUpFrame(t, d, reduced);
    case 'SINGLE': return singleFrame(t, d, reduced);
    case 'TREBLE': return trebleFrame(t, d, reduced);
    case 'BULLSEYE': return bullFrame(t, d, reduced);
    case 'MISS': return missFrame(t, d, reduced);
    case 'PERSONAL_BEST': return pbFrame(t, d, reduced);
    case 'LAST_DART_HERO': return artworkFrame('LAST_DART_HERO', 'lastDart', 'LAST DART HERO', t, reduced, { startScale: 1.05, intensity: 1.04 });
    case 'DESMOND': return artworkFrame('DESMOND', 'desmond', 'DESMOND DELIGHT', t, reduced, { startScale: 1.06, intensity: 1.02 });
    case 'VOLDY': return artworkFrame('VOLDY', 'voldy', 'HE WHO MUST NOT MISS', t, reduced, { startScale: 1.035, jitter: 0.004, tint: '#ff7722', labelColor: DMD_V3_PALETTE.red, intensity: 1.05, duration: 950 });
    default: throw new Error(`Unknown DMD V3 scene: ${sceneId}`);
  }
}

export function deterministicSceneSignature(sceneId, timeMs, data = {}, options = {}) {
  return JSON.stringify(buildSceneFrame(sceneId, timeMs, data, options));
}
