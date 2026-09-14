const H = require('./harness');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await page.addInitScript(() => {
      window.__sc030ArtworkFrames = [];
      let nextImageId = 1;
      const imageIds = new WeakMap();
      const draw = CanvasRenderingContext2D.prototype.drawImage;

      CanvasRenderingContext2D.prototype.drawImage = function(im, ...args) {
        if (
          this.canvas.width === 640 &&
          this.canvas.height === 160 &&
          im instanceof HTMLImageElement &&
          args.length === 4
        ) {
          let imageId = imageIds.get(im);
          if (!imageId) {
            imageId = nextImageId++;
            imageIds.set(im, imageId);
          }
          window.__sc030ArtworkFrames.push({
            imageId,
            naturalWidth: im.naturalWidth,
            naturalHeight: im.naturalHeight,
            bounds: args.map(Number),
          });
          if (window.__sc030ArtworkFrames.length > 120) {
            window.__sc030ArtworkFrames.splice(0, window.__sc030ArtworkFrames.length - 120);
          }
        }
        return draw.call(this, im, ...args);
      };
    });

    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['ART QA ALPHA', 'ART QA BETA']);
    await H.startMatch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    const imageIds = [];
    for (const type of ['lastDartImg', 'desmondImg', 'voldyImg']) {
      await page.evaluate(sceneType => {
        if (typeof window.sqDmdStop !== 'function' || typeof window.sqDmdShowZones !== 'function') {
          throw new Error('DMD renderer API unavailable');
        }
        // Stop is the test isolation boundary: it empties the legacy queue,
        // clears the active scene and restarts cleanly when the requested scene is shown.
        window.sqDmdStop();
        window.__sc030ArtworkFrames = [];
        window.sqDmdShowZones({ z2: '', z3: '' }, { type: sceneType, ms: 1500, amp: 3.6 });
      }, type);

      await page.waitForFunction(() => window.__sc030ArtworkFrames.length >= 3, undefined, {
        timeout: 4000,
        polling: 50,
      });
      await page.waitForTimeout(80);

      const frames = await page.evaluate(() => window.__sc030ArtworkFrames.slice());
      assert(frames.length >= 3, `${type} renders repeated artwork frames`);
      const imageId = frames[0].imageId;
      assert(frames.every(frame => frame.imageId === imageId), `${type} remains on one isolated artwork source`);
      assert(frames.every(frame => frame.naturalWidth > 0 && frame.naturalHeight > 0), `${type} artwork is loaded`);
      assert(
        frames.every(frame => {
          const [x, y, width, height] = frame.bounds;
          return width >= 630 && x < 16 && x + width > 624 && y < 160 && y + height > 0;
        }),
        `${type} fills the DMD width and remains vertically centred through canvas cropping`,
      );
      imageIds.push(imageId);

      if (process.env.SQ_SCREENSHOTS) {
        fs.mkdirSync(process.env.SQ_SCREENSHOTS, { recursive: true });
        await page.screenshot({
          path: path.join(process.env.SQ_SCREENSHOTS, `sc030-isolated-${type}.png`),
        });
      }
      console.log(`PASS ${type} isolated full-width DMD artwork`);
    }

    assert.equal(new Set(imageIds).size, 3, 'Last Dart Hero, Desmond and Voldy use distinct artwork sources');

    await page.evaluate(() => {
      window.sqDmdStop();
      window.__sc030ArtworkFrames = [];
      window.sqDmdShowZones(
        { z2: 'DESMOND DELIGHT', z3: 'LAST DART HERO' },
        { type: 'hold', ms: 600 },
      );
    });
    await page.waitForTimeout(220);
    const staleFrames = await page.evaluate(() => window.__sc030ArtworkFrames.length);
    assert.equal(staleFrames, 0, 'text-only scene contains no stale artwork from the previous scene');

    if (process.env.SQ_SCREENSHOTS) {
      await page.screenshot({
        path: path.join(process.env.SQ_SCREENSHOTS, 'sc030-isolated-long-callout.png'),
      });
    }

    const unexpectedErrors = consoleErrs.filter(error => !BROWSER_NOISE.test(error));
    assert.deepEqual(unexpectedErrors, [], `unexpected browser errors: ${unexpectedErrors.join('\n')}`);
    console.log('PASS SC-030 isolated artwork identity / stale-scene acceptance');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
