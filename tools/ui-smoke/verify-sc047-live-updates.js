const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');

const out = process.env.SQ_SCREENSHOTS || path.join(__dirname, '../../output/playwright/sc047');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const { browser, page, consoleErrs } = await H.launch();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await H.boot(page, { settle: 3000 });
    await page.waitForSelector('#homeLivePrinterRows');

    const baseline = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'));
      rows.forEach((row, i) => { row.dataset.sc047Stable = 'row-' + i; });
      const pause = document.getElementById('homeLivePauseBtn');
      return {
        count: rows.length,
        pause: !!pause,
        pressed: pause && pause.getAttribute('aria-pressed')
      };
    });
    assert.equal(baseline.count, 15, 'LIVE UPDATES must mount the canonical 15 stable rows');
    assert.equal(baseline.pause, true, 'LIVE UPDATES pause control missing');
    assert.equal(baseline.pressed, 'false', 'LIVE UPDATES should start playing');

    await page.click('#homeLivePauseBtn');
    let state = await page.evaluate(() => ({
      paused: !!window.__homeLivePrinterState?.paused,
      pressed: document.getElementById('homeLivePauseBtn')?.getAttribute('aria-pressed'),
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim()
    }));
    assert.deepEqual(state, { paused: true, pressed: 'true', label: 'PLAY' });

    await page.evaluate(() => window.__homeLivePrinterInjectLine('SC047 TEST EVENT'));
    await page.waitForTimeout(1300);

    const paused = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'));
      return {
        count: rows.length,
        markers: rows.map(r => r.dataset.sc047Stable || ''),
        text: document.getElementById('homeLivePrinterRows')?.textContent || '',
        queue: (window.__homeLivePrinterState?.injectQueue || []).slice()
      };
    });
    assert.equal(paused.count, 15, 'Pause must not change printer geometry');
    assert.equal(paused.text.includes('SC047 TEST EVENT'), false, 'Paused printer must not advance queued events');
    assert(paused.queue.includes('SC047 TEST EVENT'), 'Injected event must queue while paused');
    assert.equal(paused.markers.filter(Boolean).length, 15, 'Pause/injection must not replace stable row nodes');

    await page.click('#homeLivePauseBtn');
    await page.waitForFunction(() => {
      const body = document.getElementById('homeLivePrinterRows');
      return !!body && body.textContent.includes('SC047 TEST EVENT');
    }, { timeout: 5000 });

    const resumed = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'));
      const tbody = document.getElementById('homeLivePrinterRows');
      return {
        count: rows.length,
        markers: rows.map(r => r.dataset.sc047Stable || ''),
        pressed: document.getElementById('homeLivePauseBtn')?.getAttribute('aria-pressed'),
        paused: !!window.__homeLivePrinterState?.paused,
        transition: tbody?.style.transition || ''
      };
    });
    assert.equal(resumed.count, 15, 'Resume must preserve printer geometry');
    assert.equal(resumed.markers.filter(Boolean).length, 15, 'Resume must update existing rows rather than rebuilding them');
    assert.equal(resumed.pressed, 'false');
    assert.equal(resumed.paused, false);
    assert.equal(resumed.transition, '', 'Reduced motion must not leave a transform transition active');

    await page.screenshot({ path: path.join(out, 'live-updates-stable.png') });
    const pageErrors = consoleErrs.filter(x => x.startsWith('pageerror:'));
    assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
    console.log('SC-047 LIVE UPDATES stability PASS');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
