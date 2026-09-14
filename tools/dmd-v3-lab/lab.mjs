import { createDmdV3Engine } from '../../src/live-game/dmd/v3/engine.mjs';
import {
  DMD_V3_RESOLUTIONS,
  DMD_V3_SCENES,
  getSceneDuration,
} from '../../src/live-game/dmd/v3/scene-registry.mjs';
import { loadLegacyDmdAssets } from './legacy-assets.mjs';

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

function renderPair(sceneId, timeMs, isReduced = reducedMotion()) {
  const data = fixtureFor(sceneId);
  const opts = { reducedMotion: isReduced };
  const frameA = engine256.renderAt(sceneId, timeMs, data, opts);
  const frameB = engine320.renderAt(sceneId, timeMs, data, opts);
  return { frameA, frameB };
}

function frameLoop(timestamp) {
  if (!engine256 || !engine320) {
    requestId = requestAnimationFrame(frameLoop);
    return;
  }
  const duration = getSceneDuration(activeScene);
  const elapsed = paused ? frozenTime : Math.max(0, timestamp - sceneStart) % Math.max(1, duration);
  renderPair(activeScene, elapsed);
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

async function runBenchmark(iterations = 240) {
  if (!engine256 || !engine320) throw new Error('DMD V3 engines are not ready');
  const wasPaused = paused;
  paused = true;
  const samples256 = [];
  const samples320 = [];

  for (let i = 0; i < iterations; i += 1) {
    const sceneId = DMD_V3_SCENES[i % DMD_V3_SCENES.length];
    const duration = getSceneDuration(sceneId);
    const t = (i * 37) % Math.max(1, duration);
    const data = fixtureFor(sceneId);
    const opts = { reducedMotion: false };

    let start = performance.now();
    engine256.renderAt(sceneId, t, data, opts);
    samples256.push(performance.now() - start);

    start = performance.now();
    engine320.renderAt(sceneId, t, data, opts);
    samples320.push(performance.now() - start);
  }

  paused = wasPaused;
  if (!paused) sceneStart = performance.now();
  else renderPair(activeScene, frozenTime);

  const summarise = (samples) => ({
    count: samples.length,
    medianMs: percentile(samples, 0.50),
    p95Ms: percentile(samples, 0.95),
    maxMs: Math.max(...samples),
    longFrames50ms: samples.filter(value => value >= 50).length,
  });
  const result = { candidate256: summarise(samples256), candidate320: summarise(samples320) };
  metricsEl.innerHTML = [
    `<span>256 p95 ${result.candidate256.p95Ms.toFixed(2)} ms</span>`,
    `<span>320 p95 ${result.candidate320.p95Ms.toFixed(2)} ms</span>`,
    `<span>256 max ${result.candidate256.maxMs.toFixed(2)} ms</span>`,
    `<span>320 max ${result.candidate320.maxMs.toFixed(2)} ms</span>`,
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
      renderPair(sceneId, frozenTime, isReduced === true);
      return {
        sceneId,
        timeMs: frozenTime,
        reducedMotion: isReduced === true,
        signatures: {
          candidate256: canvasSignature(document.getElementById('candidate256')),
          candidate320: canvasSignature(document.getElementById('candidate320')),
        },
      };
    },
    resume() {
      paused = false;
      sceneStart = performance.now();
    },
    renderPair,
    runBenchmark,
    getState() {
      return { activeScene, paused, frozenTime, reducedMotion: reducedMotion() };
    },
    getSignatures() {
      return {
        candidate256: canvasSignature(document.getElementById('candidate256')),
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
  if (paused) renderPair(activeScene, frozenTime, reducedMotion());
});

boot().catch(error => {
  console.error(error);
  statusEl.textContent = 'FAILED';
  statusEl.dataset.error = String(error && error.message || error);
});
