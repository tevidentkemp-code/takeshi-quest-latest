const assert = require('assert/strict');
const H = require('./harness');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

function assertNoUnexpectedErrors(consoleErrs, label) {
  const unexpected = consoleErrs.filter(error => !BROWSER_NOISE.test(error));
  assert.deepEqual(unexpected, [], `${label}: ${unexpected.join('\n')}`);
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await H.boot(page);
    await page.waitForFunction(() => window.__sqDmdV2Ready === true && !!window.__sqDmdV2, { timeout: 10000 });

    const boot = await page.evaluate(() => ({
      ready: window.__sqDmdV2Ready === true,
      emit: typeof window.__sqDmdV2?.emit,
      clear: typeof window.__sqDmdV2?.clear,
      showZones: typeof window.sqDmdShowZones,
      setIdle: typeof window.sqDmdSetIdle,
      hardClear: typeof window.__sqDmdHardClearQueue,
      transientShow: typeof window.__sqDmdShowTransientZones,
      transientCancel: typeof window.__sqDmdCancelTransientScenes,
      injectedStyle: !!document.getElementById('sq-dmd-v2-shell-css'),
      version: window.__sqDmdV2?.snapshot?.().version || '',
    }));
    assert.equal(boot.ready, true);
    assert.equal(boot.emit, 'function');
    assert.equal(boot.clear, 'function');
    assert.equal(boot.showZones, 'function', 'legacy DMD backend remains available');
    assert.equal(boot.setIdle, 'function', 'legacy idle API remains available');
    assert.equal(boot.hardClear, 'function', 'legacy hard-clear API remains available');
    assert.equal(boot.transientShow, 'function', 'safe transient renderer channel is available');
    assert.equal(boot.transientCancel, 'function', 'safe transient cancellation channel is available');
    assert.equal(boot.injectedStyle, false, 'DMD appearance is owned by semantic CSS, not an injected style tag');
    assert.match(boot.version, /^2\.1\.0-sc030-modular$/);

    await H.toMatchCard(page);
    await H.addGuests(page, ['DMD ALPHA', 'DMD BETA']);
    await H.startMatch(page);

    const before = await page.evaluate(() => {
      const canvas = document.getElementById('sqDmdCanvas').getBoundingClientRect();
      const wrap = document.getElementById('sqDmdWrap').getBoundingClientRect();
      const pad = document.getElementById('padBar').getBoundingClientRect();
      return {
        canvas: { width: canvas.width, height: canvas.height },
        wrap: { width: wrap.width, height: wrap.height },
        pad: { top: pad.top, bottom: pad.bottom, width: pad.width },
        skin: {
          backgroundImage: getComputedStyle(document.getElementById('sqDmdWrap')).backgroundImage,
          dotBackgroundImage: getComputedStyle(document.getElementById('sqDmdWrap'), '::before').backgroundImage,
          boxShadow: getComputedStyle(document.getElementById('sqDmdWrap')).boxShadow,
          canvasFilter: getComputedStyle(document.getElementById('sqDmdCanvas')).filter,
        },
      };
    });
    assert(before.canvas.width > 250, 'DMD canvas has usable mobile width');
    assert(before.canvas.height >= 70 && before.canvas.height <= 90, `DMD portrait height preserved (${before.canvas.height})`);
    assert(before.wrap.width > 250, 'DMD wrapper remains full-width');
    assert(before.pad.width > 250, 'Throwpad remains usable');
    assert.notEqual(before.skin.backgroundImage, 'none', 'active mode theme retains a cabinet background');
    assert.match(before.skin.dotBackgroundImage, /radial-gradient/i, 'semantic dot-matrix surface treatment layers through Classic');
    assert.notEqual(before.skin.boxShadow, 'none', 'semantic cabinet depth is active');
    assert.notEqual(before.skin.canvasFilter, 'none', 'controlled amber canvas treatment is active');

    // Establish a controlled legacy baseline, then prove a controller transient
    // returns to the same rendered dot pattern rather than blank/stale V2 copy.
    const amberSignature = () => page.evaluate(() => {
      const canvas = document.getElementById('sqDmdCanvas');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let amber = 0;
      for (let i=0; i<data.length; i+=4) {
        if (data[i] > 175 && data[i+1] > 70 && data[i+1] < 225 && data[i+2] < 135 && data[i+3] > 80) amber++;
      }
      return amber;
    });
    await page.evaluate(() => {
      window.__sqDmdHardClearQueue?.();
      window.sqDmdSetIdle?.('BASELINE');
      window.sqDmdShowZones?.({ z3:'TRUE STATE' }, { type:'hold', ms:40, z3Small:true });
    });
    await page.waitForTimeout(420);
    const baselineAmber = await amberSignature();
    assert(baselineAmber > 20, 'controlled legacy DMD baseline renders amber dots');
    await page.evaluate(() => window.__sqDmdV2.emit({ kind:'UNDO' }));
    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'THROW UNDONE');
    await page.waitForTimeout(900);
    const restoredAmber = await amberSignature();
    const delta = Math.abs(restoredAmber - baselineAmber);
    assert(delta <= Math.max(40, baselineAmber * 0.15), 'controller scene restores the legacy DMD baseline');

    await page.evaluate(() => {
      window.__sqDmdV2.emit({ kind: 'HIT_SINGLE', points: 20, total: 20 });
      window.__sqDmdV2.emit({ kind: 'SHATEKI_RECORD', gameScore: 700 });
    });
    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'NEW SHATEKI RECORD');
    const priority = await page.evaluate(() => window.__sqDmdV2.snapshot());
    assert.equal(priority.active.headline, 'NEW SHATEKI RECORD');
    assert.equal(priority.queue.length, 0, 'stale lower-priority throw is not replay-queued after record pre-emption');

    await page.evaluate(() => window.__sqDmdV2.clear({ restore: true }));
    const cleared = await page.evaluate(() => window.__sqDmdV2.snapshot());
    assert.equal(cleared.active, null);
    assert.equal(cleared.queue.length, 0);

    const after = await page.evaluate(() => {
      const canvas = document.getElementById('sqDmdCanvas').getBoundingClientRect();
      const pad = document.getElementById('padBar').getBoundingClientRect();
      return {
        canvas: { width: canvas.width, height: canvas.height },
        pad: { top: pad.top, bottom: pad.bottom, width: pad.width },
      };
    });
    assert.equal(Math.round(after.canvas.height), Math.round(before.canvas.height), 'controller does not change DMD height');
    assert.equal(Math.round(after.pad.width), Math.round(before.pad.width), 'controller does not change Throwpad width');

    assertNoUnexpectedErrors(consoleErrs, 'SC-030 DMD runtime');
    console.log('SC-030 DMD RUNTIME: ALL PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
