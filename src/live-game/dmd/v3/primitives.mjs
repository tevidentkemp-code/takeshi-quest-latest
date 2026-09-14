export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function lerp(from, to, t) {
  return Number(from) + (Number(to) - Number(from)) * clamp01(t);
}

export function easeOutCubic(t) {
  const p = 1 - clamp01(t);
  return 1 - (p * p * p);
}

export function easeInOutCubic(t) {
  const p = clamp01(t);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function easeOutQuint(t) {
  return 1 - Math.pow(1 - clamp01(t), 5);
}

export function segment(timeMs, startMs, endMs, easing = easeOutCubic) {
  const start = Number(startMs) || 0;
  const end = Math.max(start + 0.001, Number(endMs) || start + 1);
  return easing(clamp01((Number(timeMs) - start) / (end - start)));
}

export function fadeWindow(timeMs, inStart, inEnd, outStart, outEnd) {
  const t = Number(timeMs) || 0;
  const inAlpha = t <= inStart ? 0 : t >= inEnd ? 1 : segment(t, inStart, inEnd, easeOutCubic);
  if (outStart == null || outEnd == null || t <= outStart) return inAlpha;
  if (t >= outEnd) return 0;
  return inAlpha * (1 - segment(t, outStart, outEnd, easeInOutCubic));
}

export function pulse(timeMs, startMs, endMs, amplitude = 1) {
  const p = segment(timeMs, startMs, endMs, easeInOutCubic);
  return Math.sin(Math.PI * p) * Number(amplitude || 0);
}

export function countBetween(timeMs, startMs, endMs, from, to) {
  const p = segment(timeMs, startMs, endMs, easeOutQuint);
  return Math.round(lerp(from, to, p));
}

export function translateIn(timeMs, startMs, endMs, distance = 0.08) {
  return lerp(Number(distance) || 0, 0, segment(timeMs, startMs, endMs, easeOutCubic));
}

export function scaleIn(timeMs, startMs, endMs, from = 1.08) {
  return lerp(Number(from) || 1, 1, segment(timeMs, startMs, endMs, easeOutQuint));
}

export function deterministicJitter(timeMs, amplitude = 0.004, frequency = 0.04) {
  const t = Number(timeMs) || 0;
  const amp = Number(amplitude) || 0;
  const f = Number(frequency) || 0.04;
  return {
    x: Math.sin(t * f) * amp,
    y: Math.cos(t * f * 1.37) * amp * 0.7,
  };
}
