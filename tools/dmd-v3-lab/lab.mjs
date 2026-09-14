import { createDmdV3Engine } from '../../src/live-game/dmd/v3/engine.mjs';
import {
  DMD_V3_RESOLUTIONS,
  DMD_V3_SCENES,
  getSceneDuration,
} from '../../src/live-game/dmd/v3/scene-registry.mjs';
import { loadLegacyDmdAssets } from './legacy-assets.mjs';

const HYBRID_PROFILE = Object.freeze({
  id: '640x160@288x72',
  width: 640,
  height: 160,
  dotColumns: 288,
  dotRows: 72,
});

const FIXTURES = Object.freeze({
  PLAYER_UP: { player: 'THOM', target: '20' },
  SINGLE: { points: 20, total: 180, target: '20' },
  TREBLE: { points: 60, total: 220, target: '20' },
  BULLSEYE: { points: 50, total: 270, target: 'BULL' },
  MISS: { player: 'THOM', target: '20' },
  PERSONAL_BEST: { score: 332, previousScore: 286 },
  LAST_DART_HERO: {},
  DESMOND: {},
  VOLDY: {},
});

const statusEl = document.getElementById('status');
const buttonsHost = document.getElementById('sceneButtons');
const replayBtn = document.getElementById('replayBtn');
const benchmarkBtn = document.getElementById('benchmarkBtn');
const reducedMotionEl = document.getElementById('reducedMotion');
const fixtureNameEl = document.getElementById('fixtureName');
const metricsEl = document.getElementById('metrics');

let assets = {};
let engine256 = null;
let engine288 = null;
let engine320 = null;
let activeScene = 'PLAYER_UP';
let sceneStart = performance.now();
let paused = false;
let frozenTime = 0;
let requestId = null;

function fixtureFor(sceneId) {
  return FIXTURES[sceneId] || {};
}

function reducedMotion() {
  return reducedMotionEl.checked === true;
}

function renderAll(sceneId, timeMs, isReduced = reducedMotion()) {
  const data = fixtureFor(sceneId);
  const opts = { reducedMotion: isReduced };
  return {
    frame256: engine256.renderAt(sceneId, timeMs, data, opts),
    frame288: engine288.renderAt(sceneId, timeMs, data, opts),
    frame320: engine320.renderAt(sceneId, timeMs, data, opts),
  };
}

function frameLoop(timestamp) {
  if (!engine256 || !engine288 || !engine320) {
    requestId = requestAnimationFrame(frameLoop);
    return;
  }
  const duration = getSceneDuration(activeScene);
  const elapsed = paused ? frozenTime : Math.max(0, timestamp - sceneStart) % Math.max(1, duration);
  renderAll(activeScene, elapsed);
  requestId = requestAnimationFrame(frameLoop);
}

function setScene(sceneId) {
  activeScene = sceneId;
  sceneStart = performance.now();
  frozenTime = 0;
  fixtureNameEl.textContent = sceneId.replaceAll('_', ' ');
  [...buttonsHost.querySelectorAll('button')].forEach(button => {
    button.classList.toggle('active', button.dataset.scene === sceneId);
  });
}

function populateSceneControls() {
  for (const sceneId of DMD_V3_SCENES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.scene = sceneId;
    button.textContent = sceneId.replaceAll('_', ' ');
    button.addEventListener('click', () => {
      paused = false;
      setScene(sceneId);
    });
    buttonsHost.append(button);
  }
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function nextAnimationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function summariseSamples(samples) {
  const values = samples.map(sample => sample.ms);
  const worst = [...samples].sort((a, b) => b.ms - a.ms).slice(0, 5);
  return {
    count: values.length,
    medianMs: percentile(values, 0.50),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maxMs: Math.max(...values),
    overBudget16ms: values.filter(value => value >= 16.67).length,
    longFrames50ms: values.filter(value => value >= 50).length,
    worst,
  };
}

async function runBenchmark(iterations = 120) {
  if (!engine256 || !engine288 || !engine320) throw new Error('DMD V3 engines are not ready');
  const wasPaused = paused;
  const savedScene = activeScene;
  const savedFrozenTime = frozenTime;
  paused = true;

  for (const sceneId of DMD_V3_SCENES) {
    const duration = getSceneDuration(sceneId);
    renderAll(sceneId, Math.round(duration * 0.42), false);
    await nextAnimationFrame();
  }

  const samples256 = [];
  const samples288 = [];
  const samples320 = [];
  const allFrameMs = [];
  const rafIntervals = [];
  let previousRaf = null;

  const candidates = [
    { engine: engine256, bucket: samples256, candidate: '256x64' },
    { engine: engine288, bucket: samples288, candidate: '288x72' },
    { engine: engine320, bucket: samples320, candidate: '320x80' },
  ];

  for (let i = 0; i < iterations; i += 1) {
    const rafTime = await nextAnimationFrame();
    if (previousRaf != null) rafIntervals.push(rafTime - previousRaf);
    previousRaf = rafTime;

    const sceneId = DMD_V3_SCENES[i % DMD_V3_SCENES.length];
    const duration = getSceneDuration(sceneId);
    const t = (i * 37) % Math.max(1, duration);
    const data = fixtureFor(sceneId);
    const opts = { reducedMotion: false };
    const allStart = performance.now();

    const renderOne = ({ engine, bucket, candidate }) => {
      const start = performance.now();
      engine.renderAt(sceneId, t, data, opts);
      bucket.push({ ms: performance.now() - start, sceneId, timeMs: t, candidate });
    };

    for (let offset = 0; offset < candidates.length; offset += 1) {
      renderOne(candidates[(i + offset) % candidates.length]);
    }
    allFrameMs.push(performance.now() - allStart);
  }

  paused = wasPaused;
  activeScene = savedScene;
  frozenTime = savedFrozenTime;
  if (!paused) sceneStart = performance.now();
  else renderAll(activeScene, frozenTime);

  const result = {
    methodology: 'requestAnimationFrame-paced-after-warmup',
    candidate256: summariseSamples(samples256),
    candidate288: summariseSamples(samples288),
    candidate320: summariseSamples(samples320),
    comparisonAll: {
      p95Ms: percentile(allFrameMs, 0.95),
      p99Ms: percentile(allFrameMs, 0.99),
      maxMs: Math.max(...allFrameMs),
    },
    scheduler: {
      p95IntervalMs: percentile(rafIntervals, 0.95),
      maxIntervalMs: rafIntervals.length ? Math.max(...rafIntervals) : 0,
    },
  };

  metricsEl.innerHTML = [
    `<span>256 p95 ${result.candidate256.p95Ms.toFixed(2)} ms</span>`,
    `<span>288 p95 ${result.candidate288.p95Ms.toFixed(2)} ms</span>`,
    `<span>320 p95 ${result.candidate320.p95Ms.toFixed(2)} ms</span>`,
    `<span>all p95 ${result.comparisonAll.p95Ms.toFixed(2)} ms</span>`,
  ].join('');
  return result;
}

function canvasSignature(canvas) {
  return canvas.toDataURL('image/png');
}

async function boot() {
  populateSceneControls();
  statusEl.textContent = 'LOADING ASSETS';
  assets = await loadLegacyDmdAssets();

  engine256 = createDmdV3Engine({
    profile: DMD_V3_RESOLUTIONS.DENSE_256,
    outputCanvas: document.getElementById('candidate256'),
    assets: { ...assets },
    treatment: { outputWidth: 640, outputHeight: 160 },
  });
  engine288 = createDmdV3Engine({
    profile: HYBRID_PROFILE,
    outputCanvas: document.getElementById('candidate288'),
    assets: { ...assets },
    treatment: { outputWidth: 640, outputHeight: 160 },
  });
  engine320 = createDmdV3Engine({
    profile: DMD_V3_RESOLUTIONS.DENSE_320,
    outputCanvas: document.getElementById('candidate320'),
    assets: { ...assets },
    treatment: { outputWidth: 640, outputHeight: 160 },
  });

  setScene(activeScene);
  statusEl.textContent = 'READY';
  requestId = requestAnimationFrame(frameLoop);

  window.SC032Lab = {
    ready: true,
    scenes: [...DMD_V3_SCENES],
    resolutions: {
      candidate256: engine256.treatment.snapshotMeta(),
      candidate288: engine288.treatment.snapshotMeta(),
      candidate320: engine320.treatment.snapshotMeta(),
    },
    setScene(sceneId) {
      if (!DMD_V3_SCENES.includes(sceneId)) throw new Error(`Unknown scene ${sceneId}`);
      paused = false;
      setScene(sceneId);
    },
    freeze(sceneId = activeScene, timeMs = 0, isReduced = false) {
      if (!DMD_V3_SCENES.includes(sceneId)) throw new Error(`Unknown scene ${sceneId}`);
      activeScene = sceneId;
      paused = true;
      frozenTime = Math.max(0, Math.min(getSceneDuration(sceneId), Number(timeMs) || 0));
      reducedMotionEl.checked = isReduced === true;
      setScene(sceneId);
      paused = true;
      frozenTime = Math.max(0, Math.min(getSceneDuration(sceneId), Number(timeMs) || 0));
      renderAll(sceneId, frozenTime, isReduced === true);
      return {
        sceneId,
        timeMs: frozenTime,
        reducedMotion: isReduced === true,
        signatures: {
          candidate256: canvasSignature(document.getElementById('candidate256')),
          candidate288: canvasSignature(document.getElementById('candidate288')),
          candidate320: canvasSignature(document.getElementById('candidate320')),
        },
      };
    },
    resume() {
      paused = false;
      sceneStart = performance.now();
    },
    renderAll,
    runBenchmark,
    getState() {
      return { activeScene, paused, frozenTime, reducedMotion: reducedMotion() };
    },
    getSignatures() {
      return {
        candidate256: canvasSignature(document.getElementById('candidate256')),
        candidate288: canvasSignature(document.getElementById('candidate288')),
        candidate320: canvasSignature(document.getElementById('candidate320')),
      };
    },
    getAssets() {
      return Object.fromEntries(Object.entries(assets).map(([key, value]) => [key, {
        width: value.naturalWidth || value.width,
        height: value.naturalHeight || value.height,
      }]));
    },
  };
}

replayBtn.addEventListener('click', () => {
  paused = false;
  sceneStart = performance.now();
});
benchmarkBtn.addEventListener('click', async () => {
  benchmarkBtn.disabled = true;
  statusEl.textContent = 'BENCHMARKING';
  try {
    await runBenchmark();
    statusEl.textContent = 'READY';
  } finally {
    benchmarkBtn.disabled = false;
  }
});
reducedMotionEl.addEventListener('change', () => {
  sceneStart = performance.now();
  if (paused) renderAll(activeScene, frozenTime, reducedMotion());
});

boot().catch(error => {
  console.error(error);
  statusEl.textContent = 'FAILED';
  statusEl.dataset.error = String(error && error.message || error);
});