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
    await page.waitForFunction(() =>
      !!window.__homeLivePrinterState &&
      typeof window.__homeLivePrinterInjectLine === 'function' &&
      !!document.getElementById('homeLivePauseBtn')
    , { timeout: 20000 });

    // Persist a presentation event, then reload. This mirrors a newly-created
    // player event and proves the feed can recover immediately after refresh
    // even when the cloud is unavailable in the QA harness.
    await page.evaluate(() => window.__homeLivePrinterPersistLine('🚨 NEW PLAYER - Refresh Tester - Welcome to Shateki Quest 🎯', 'new_player'));
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#homeLivePrinterRows tr.lp-row');
      const body = document.getElementById('homeLivePrinterRows');
      return rows.length === 15 && !!body && body.textContent.includes('Refresh Tester');
    }, { timeout: 5000 });

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

    const firstLoad = await page.evaluate(() => ({
      text: document.getElementById('homeLivePrinterRows')?.textContent || '',
      height: document.getElementById('homeLivePrinter')?.getBoundingClientRect().height || 0,
      paused: !!window.__homeLivePrinterState?.paused,
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim()
    }));
    assert.match(firstLoad.text, /Refresh Tester/i, 'persisted NEW PLAYER event must be visible before refresh');
    assert(firstLoad.height >= 320, 'home LIVE UPDATES must retain the fuller vertical composition');
    assert.equal(firstLoad.paused, false, 'home must never enter paused');
    assert.equal(firstLoad.label, 'PAUSE', 'playing state must show PAUSE, not PLAY');

    // Long/wrapped content must never resize VIDE. This guards the mobile
    // regression where feed content pushed HUB / STATS / LEAGUE below Safari.
    const stableHeightBefore = firstLoad.height;
    await page.evaluate(() => window.__homeLivePrinterInjectLine(
      'CLA / 22:31 Thom (450) bts Chris (404), Grant (403), Liam (397), Matteo (388), James (377)'
    ));
    await page.waitForTimeout(120);
    const mobileGeometry = await page.evaluate(() => {
      const printer = document.getElementById('homeLivePrinter');
      const wrap = document.querySelector('.wrap');
      const bodyStyle = getComputedStyle(document.body);
      return {
        height: printer?.getBoundingClientRect().height || 0,
        wrapPaddingBottom: parseFloat(getComputedStyle(wrap).paddingBottom || '0'),
        textSizeAdjust: bodyStyle.webkitTextSizeAdjust || bodyStyle.textSizeAdjust || ''
      };
    });
    assert(Math.abs(mobileGeometry.height - stableHeightBefore) < 1,
      'VIDE height must remain fixed when a long result wraps');
    assert(mobileGeometry.wrapPaddingBottom >= 72,
      'Home must reserve enough bottom scroll clearance for Safari chrome');
    assert.equal(mobileGeometry.textSizeAdjust, '100%',
      'Home must disable iOS Safari text autosizing drift');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600);
    const refreshed = await page.evaluate(() => ({
      text: document.getElementById('homeLivePrinterRows')?.textContent || '',
      paused: !!window.__homeLivePrinterState?.paused,
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim()
    }));
    assert.match(refreshed.text, /Refresh Tester/i, 'NEW PLAYER must survive a page refresh via the persisted feed event cache');
    assert.equal(refreshed.paused, false, 'refresh must start LIVE UPDATES playing');
    assert.equal(refreshed.label, 'PAUSE');

    // Reload legitimately creates a fresh document. Mark the new canonical row
    // nodes before testing whether subsequent pause/injection mutates them.
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'))
        .forEach((row, i) => { row.dataset.sc047Stable = 'row-' + i; });
    });

    await page.evaluate(() => window.__homeLivePrinterInjectLine('CLA / 22:31 Thom (200) bts Sam (180)'));
    await page.waitForFunction(() => document.getElementById('homeLivePrinterRows')?.textContent.includes('Thom (200)'), { timeout: 5000 });
    const twoLine = await page.locator('#homeLivePrinterRows tr.lp-row').filter({ hasText: 'Thom (200)' }).last().evaluate(row => {
      const meta = row.querySelector('.lp-game-meta')?.getBoundingClientRect();
      const result = row.querySelector('.lp-result')?.getBoundingClientRect();
      return {
        hasMeta: !!meta,
        hasResult: !!result,
        metaBottom: meta?.bottom || 0,
        resultTop: result?.top || 0
      };
    });
    assert(twoLine.hasMeta && twoLine.hasResult, 'game row must expose separate mode/time and scoreline blocks');
    assert(twoLine.resultTop >= twoLine.metaBottom - 1, 'player names/scoreline must start on the line below CLA / time');

    await page.click('#homeLivePauseBtn');
    let state = await page.evaluate(() => ({
      paused: !!window.__homeLivePrinterState?.paused,
      pressed: document.getElementById('homeLivePauseBtn')?.getAttribute('aria-pressed'),
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim()
    }));
    assert.deepEqual(state, { paused: true, pressed: 'true', label: 'PLAY' });

    await page.evaluate(() => arrangeStartActions());
    await page.waitForTimeout(80);
    const reentered = await page.evaluate(() => ({
      paused: !!window.__homeLivePrinterState?.paused,
      pressed: document.getElementById('homeLivePauseBtn')?.getAttribute('aria-pressed'),
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim()
    }));
    assert.deepEqual(reentered, { paused:false, pressed:'false', label:'PAUSE' }, 'returning to Home must reset a prior pause');
    await page.click('#homeLivePauseBtn');

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

    // WR is a locked semantic colour: verified World Records must be purple,
    // not inherited from the generic alert/PB gold treatment.
    await page.evaluate(() => window.__homeLivePrinterInjectLine('🚨 ROUND WR / 18s - SC047 (90) - S0 / D0 / T1'));
    await page.waitForFunction(() => !!document.querySelector('#homeLivePrinterRows .lp-row.lp-world-record'), { timeout: 5000 });
    const wr = await page.locator('#homeLivePrinterRows .lp-row.lp-world-record').last().evaluate(row => {
      const chip = row.querySelector('.lp-record-chip');
      return {
        text: row.textContent || '',
        rowColor: getComputedStyle(row.querySelector('.lp-ellipsis') || row).color,
        chipColor: chip ? getComputedStyle(chip).color : ''
      };
    });
    assert.match(wr.text, /ROUND WR/i, 'World Record row missing WR content');
    assert.match(wr.rowColor, /196,\s*153,\s*255/, 'World Record row must use the locked purple semantic');
    assert.match(wr.chipColor, /214,\s*184,\s*255/, 'World Record chip must use the locked purple semantic');

    await page.screenshot({ path: path.join(out, 'live-updates-stable.png') });
    const pageErrors = consoleErrs.filter(x => x.startsWith('pageerror:'));
    assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
    console.log('SC-047 LIVE UPDATES stability PASS');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
