// Seasonal presentation lifecycle. The harness blocks all production data traffic.
const assert = require('node:assert/strict');
const H = require('./harness');

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    page.setDefaultNavigationTimeout(30000);
    await page.addInitScript(() => {
      // A deterministic, progressing event clock and shortest decorative delays.
      const start = performance.now();
      window.__halloweenTestClock = Date.parse('2026-11-01T12:00:00Z');
      Date.now = () => window.__halloweenTestClock + performance.now() - start;
      Math.random = () => 0;
    });
    await H.boot(page, { settle: 800 });
    const layer = page.locator('.sq-haunt-layer');
    await layer.waitFor();
    assert.equal(await layer.count(), 1, 'one Halloween layer is mounted');
    assert.equal(await layer.getAttribute('aria-hidden'), 'true');
    assert.equal(await layer.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    assert.equal(await layer.locator('.sq-haunt-bat').count(), 2);
    assert.equal(await layer.locator('.sq-haunt-ghost').count(), 1);
    assert.equal(await layer.locator('.sq-haunt-lightning').count(), 1);
    assert.equal(await page.evaluate(() => window.__sqHalloweenActive()), true);
    assert.notEqual(await layer.locator('.sq-haunt-bat').first().evaluate(el => getComputedStyle(el).animationName), 'none');

    await page.waitForFunction(() => document.querySelector('.sq-haunt-ghost')?.classList.contains('is-haunting'), null, { timeout: 6500 });
    await page.waitForFunction(() => document.querySelector('.sq-haunt-lightning')?.classList.contains('is-lightning'), null, { timeout: 17000 });
    console.log('PASS bats, random ghost and bounded lightning activate');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    // The media-change listener replaces the layer. Read the attached layer
    // atomically so WebKit never samples an element detached between calls.
    const reducedHandle = await page.waitForFunction(() => {
      const layers = document.querySelectorAll('.sq-haunt-layer');
      const layer = layers[0], bat = layer?.querySelector('.sq-haunt-bat');
      const ghost = layer?.querySelector('.sq-haunt-ghost'), bolt = layer?.querySelector('.sq-haunt-lightning');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches || layers.length !== 1 || !layer.isConnected || !bat || !ghost || !bolt) return false;
      const state = { batAnimation:getComputedStyle(bat).animationName, ghostDisplay:getComputedStyle(ghost).display, lightningDisplay:getComputedStyle(bolt).display };
      return state.batAnimation === 'none' && state.ghostDisplay === 'none' && state.lightningDisplay === 'none' ? state : false;
    });
    const reducedState = await reducedHandle.jsonValue(); await reducedHandle.dispose();
    assert.deepEqual(reducedState, { batAnimation:'none', ghostDisplay:'none', lightningDisplay:'none' });
    console.log('PASS reduced motion suppresses motion and lightning');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => {
      const layer=document.querySelector('.sq-haunt-layer'), bat=layer?.querySelector('.sq-haunt-bat');
      if (!layer?.isConnected || !bat || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      const animation=getComputedStyle(bat).animationName;
      return animation && animation !== 'none';
    });
    // A backgrounded tab removes the layer and a foregrounded tab restores one.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('.sq-haunt-layer').count(), 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('.sq-haunt-layer').count(), 1);
    await page.evaluate(() => {
      window.__halloweenTestClock = Date.parse('2026-11-02T00:00:00Z');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(() => window.__sqHalloweenActive()), false);
    assert.equal(await page.locator('.sq-haunt-layer').count(), 0, 'expiry removes the layer in an open tab');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('sq-halloween')), false);
    assert.deepEqual(consoleErrs.filter(s => s.startsWith('pageerror:')), []);
    console.log('PASS visibility lifecycle and Monday expiry');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
