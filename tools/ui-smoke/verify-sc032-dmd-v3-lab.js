const { chromium } = require('playwright');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const URL = process.env.SQ_DMD_V3_LAB_URL || 'http://127.0.0.1:8125/tools/dmd-v3-lab/index.html';
const SCREENSHOTS = process.env.SQ_SCREENSHOTS || '';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console:${msg.text()}`); });
  page.on('pageerror', error => consoleErrors.push(`pageerror:${error.message}`));

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.SC032Lab && window.SC032Lab.ready === true, undefined, { timeout: 10000 });

    const boot = await page.evaluate(() => ({
      status: document.getElementById('status')?.textContent,
      assets: window.SC032Lab.getAssets(),
      resolutions: window.SC032Lab.resolutions,
      scenes: window.SC032Lab.scenes,
    }));
    assert.equal(boot.status, 'READY', 'visual lab reaches READY');
    assert.deepEqual(Object.keys(boot.assets).sort(), ['desmond','lastDart','voldy'], 'all three legacy special-scene assets load');
    assert(Object.values(boot.assets).every(asset => asset.width > 0 && asset.height > 0), 'special-scene assets decode');
    assert.equal(boot.resolutions.candidate256.logicalWidth, 640, 'balanced candidate keeps smooth 640px authoring width');
    assert.equal(boot.resolutions.candidate256.logicalHeight, 160, 'balanced candidate keeps smooth 160px authoring height');
    assert.equal(boot.resolutions.candidate320.logicalWidth, 640, 'digital candidate keeps smooth 640px authoring width');
    assert.equal(boot.resolutions.candidate320.logicalHeight, 160, 'digital candidate keeps smooth 160px authoring height');
    assert.equal(boot.resolutions.candidate256.dotColumns, 256, 'balanced candidate uses 256x64 dot grid');
    assert.equal(boot.resolutions.candidate320.dotColumns, 320, 'digital candidate uses 320x80 dot grid');

    const expectedScenes = ['PLAYER_UP','SINGLE','TREBLE','BULLSEYE','MISS','PERSONAL_BEST','LAST_DART_HERO','DESMOND','VOLDY'];
    assert.deepEqual(boot.scenes, expectedScenes, 'Phase 0 scene catalogue is complete');

    const checkpoints = {
      PLAYER_UP: 260,
      SINGLE: 150,
      TREBLE: 220,
      BULLSEYE: 260,
      MISS: 110,
      PERSONAL_BEST: 560,
      LAST_DART_HERO: 360,
      DESMOND: 360,
      VOLDY: 380,
    };

    if (SCREENSHOTS) fs.mkdirSync(SCREENSHOTS, { recursive: true });

    for (const sceneId of expectedScenes) {
      const t = checkpoints[sceneId];
      const first = await page.evaluate(({ sceneId, t }) => window.SC032Lab.freeze(sceneId, t, false), { sceneId, t });
      const second = await page.evaluate(({ sceneId, t }) => window.SC032Lab.freeze(sceneId, t, false), { sceneId, t });
      assert.equal(first.signatures.candidate256, second.signatures.candidate256, `${sceneId} balanced deterministic rendered frame`);
      assert.equal(first.signatures.candidate320, second.signatures.candidate320, `${sceneId} digital deterministic rendered frame`);
      assert.notEqual(first.signatures.candidate256, first.signatures.candidate320, `${sceneId} candidates produce distinct dot-treatment output`);
      if (SCREENSHOTS) {
        await page.locator('.candidate-grid').screenshot({ path: path.join(SCREENSHOTS, `sc032-${sceneId.toLowerCase()}.png`) });
      }
    }

    for (const sceneId of ['TREBLE','VOLDY']) {
      const t = checkpoints[sceneId];
      const normal = await page.evaluate(({ sceneId, t }) => window.SC032Lab.freeze(sceneId, t, false), { sceneId, t });
      const reduced = await page.evaluate(({ sceneId, t }) => window.SC032Lab.freeze(sceneId, t, true), { sceneId, t });
      assert.notEqual(normal.signatures.candidate320, reduced.signatures.candidate320, `${sceneId} reduced-motion output is materially different`);
      if (SCREENSHOTS) {
        await page.locator('.candidate-grid').screenshot({ path: path.join(SCREENSHOTS, `sc032-${sceneId.toLowerCase()}-reduced.png`) });
      }
    }

    const geometry = await page.evaluate(() => [...document.querySelectorAll('.dmd-bezel canvas')].map(canvas => {
      const rect = canvas.getBoundingClientRect();
      return { width: rect.width, height: rect.height, ratio: rect.width / rect.height };
    }));
    assert(geometry.every(item => item.width > 200 && item.height > 50), 'both candidate DMDs are visibly rendered');
    assert(geometry.every(item => Math.abs(item.ratio - 4) < 0.02), 'both candidate DMDs retain 4:1 geometry');

    // Performance is measured after all code/artwork paths are warm and one
    // sample per animation frame. This catches renderer work that can actually
    // consume a live frame without manufacturing GC pressure through a tight loop.
    const benchmark = await page.evaluate(() => window.SC032Lab.runBenchmark(120));
    console.log('SC-032 BENCHMARK', JSON.stringify(benchmark));
    assert.equal(benchmark.methodology, 'requestAnimationFrame-paced-after-warmup', 'benchmark models production scheduling');
    for (const [label, result] of [['balanced', benchmark.candidate256], ['digital', benchmark.candidate320]]) {
      assert(result.p95Ms < 8, `${label} candidate p95 render cost stays comfortably inside a 60 Hz frame`);
      assert(result.p99Ms < 16.67, `${label} candidate p99 render cost stays inside a 60 Hz frame`);
      assert.equal(result.longFrames50ms, 0, `${label} candidate has no renderer-attributed >=50ms render`);
      assert(result.maxMs < 50, `${label} candidate max renderer call stays under long-task threshold`);
      assert(result.overBudget16ms <= 1, `${label} candidate has at most one isolated >16.67ms call across the paced fixture`);
    }
    assert(benchmark.comparisonPair.p95Ms < 16.67, 'even rendering both lab candidates in one frame remains inside the 60 Hz budget at p95');

    // Evidence must also be judged at an actual phone-sized CSS viewport. The
    // canvas keeps its high internal resolution; only physical display size changes.
    // Validate against the actual bezel content box rather than an arbitrary
    // absolute width, because the lab itself deliberately keeps page/card gutters.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const sceneId of ['PLAYER_UP','TREBLE','PERSONAL_BEST','DESMOND']) {
      const t = checkpoints[sceneId];
      await page.evaluate(({ sceneId, t }) => window.SC032Lab.freeze(sceneId, t, false), { sceneId, t });
      const mobileLayout = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const overflow = document.documentElement.scrollWidth > viewportWidth + 1;
        const canvases = [...document.querySelectorAll('.dmd-bezel canvas')].map(canvas => {
          const rect = canvas.getBoundingClientRect();
          const bezel = canvas.closest('.dmd-bezel');
          const bezelRect = bezel.getBoundingClientRect();
          const style = getComputedStyle(bezel);
          const insetX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
            parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          const expectedCanvasWidth = bezelRect.width - insetX;
          return {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            ratio: rect.width / rect.height,
            expectedCanvasWidth,
          };
        });
        return { viewportWidth, overflow, canvases };
      });
      assert.equal(mobileLayout.overflow, false, `${sceneId} lab has no horizontal overflow at 390px`);
      assert.equal(mobileLayout.canvases.length, 2, `${sceneId} renders both phone candidates`);
      assert(mobileLayout.canvases.every(item => item.width >= mobileLayout.viewportWidth * 0.70), `${sceneId} DMDs use the available phone content width`);
      assert(mobileLayout.canvases.every(item => Math.abs(item.width - item.expectedCanvasWidth) <= 2), `${sceneId} DMD canvases fit their bezel content boxes`);
      assert(mobileLayout.canvases.every(item => item.left >= -0.5 && item.right <= mobileLayout.viewportWidth + 0.5), `${sceneId} DMD canvases stay inside the phone viewport`);
      assert(mobileLayout.canvases.every(item => Math.abs(item.ratio - 4) < 0.02), `${sceneId} phone DMDs retain 4:1 geometry`);
      if (SCREENSHOTS) {
        await page.locator('.candidate-grid').screenshot({ path: path.join(SCREENSHOTS, `sc032-mobile-${sceneId.toLowerCase()}.png`) });
      }
    }
    await page.setViewportSize({ width: 1180, height: 900 });

    if (SCREENSHOTS) {
      await page.screenshot({ path: path.join(SCREENSHOTS, 'sc032-visual-lab-overview.png'), fullPage: true });
    }

    assert.deepEqual(consoleErrors, [], consoleErrors.join('\n'));
    console.log('PASS SC-032 DMD V3 Phase 0 visual lab / determinism / artwork / phone-scale / performance acceptance');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});