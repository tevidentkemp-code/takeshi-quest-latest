const assert = require('assert/strict');
const H = require('./harness');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['MOTION ALPHA', 'MOTION BETA']);
    await H.startMatch(page);
    await page.waitForFunction(() => window.__sqDmdV2Ready === true && !!window.__sqDmdV2);

    await page.evaluate(() => {
      window.__sc030MotionCapture = [];
      const original = window.__sqDmdShowTransientZones;
      window.__sqDmdShowTransientZones = (zones, opts) => {
        window.__sc030MotionCapture.push({ zones: { ...zones }, opts: { ...opts } });
        return original(zones, opts);
      };
      window.__sqDmdV2.emit({ kind: 'LAST_DART_HERO', total: 321 });
    });
    await page.waitForFunction(() => window.__sc030MotionCapture.length > 0);
    const reduced = await page.evaluate(() => window.__sc030MotionCapture.at(-1));
    assert.equal(reduced.zones.z2, 'LAST DART HERO');
    assert.equal(reduced.opts.type, 'hold', 'reduced motion uses static DMD presentation');
    assert.equal(reduced.opts.amp, 0, 'reduced motion removes judder amplitude');

    await page.evaluate(() => window.__sqDmdV2.clear({ restore: true }));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => window.__sqDmdV2.emit({ kind: 'VOLDY', headline: 'VOLDY', total: 99 }));
    await page.waitForFunction(() => window.__sc030MotionCapture.at(-1)?.zones?.z2 === 'VOLDY');
    const normal = await page.evaluate(() => window.__sc030MotionCapture.at(-1));
    assert.equal(normal.opts.type, 'voldyImg', 'normal DMD image motion remains available');
    assert(normal.opts.amp > 0, 'normal motion amplitude is preserved');

    const unexpected = consoleErrs.filter(error => !BROWSER_NOISE.test(error));
    assert.deepEqual(unexpected, []);
    console.log('SC-030 REDUCED MOTION RUNTIME: ALL PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
