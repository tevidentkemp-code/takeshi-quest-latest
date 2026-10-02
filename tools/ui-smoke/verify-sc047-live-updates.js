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
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(80);
    const mobileGeometry = await page.evaluate(() => {
      const printer = document.getElementById('homeLivePrinter');
      const wrap = document.querySelector('.wrap');
      const nav = document.querySelector('#homeFooterNav .home-nav-row');
      const version = document.getElementById('sqReleaseVersionBtn');
      const bodyStyle = getComputedStyle(document.body);
      const printerStyle = printer ? getComputedStyle(printer) : null;
      const navStyle = nav ? getComputedStyle(nav) : null;
      const normalCopy = document.querySelector('#homeLivePrinter .lp-row:not(.lp-datehdr) .lp-result')
        || document.querySelector('#homeLivePrinter .lp-row:not(.lp-datehdr) .lp-ellipsis');
      return {
        height: printer?.getBoundingClientRect().height || 0,
        wrapPaddingBottom: parseFloat(getComputedStyle(wrap).paddingBottom || '0'),
        navPosition: navStyle?.position || '',
        navBottom: parseFloat(navStyle?.bottom || '0'),
        navRect: nav?.getBoundingClientRect() || null,
        printerRect: printer?.getBoundingClientRect() || null,
        versionRect: version?.getBoundingClientRect() || null,
        viewportBottomClearance: nav ? (window.innerHeight - nav.getBoundingClientRect().bottom) : 0,
        textSizeAdjust: bodyStyle.webkitTextSizeAdjust || bodyStyle.textSizeAdjust || '',
        printerTextSizeAdjust: printerStyle?.webkitTextSizeAdjust || printerStyle?.textSizeAdjust || '',
        tableFontSize: parseFloat(getComputedStyle(document.querySelector('#homeLivePrinter .lp-table')).fontSize || '0'),
        normalCopyFontSize: normalCopy ? parseFloat(getComputedStyle(normalCopy).fontSize || '0') : 0
      };
    });
    assert(Math.abs(mobileGeometry.height - stableHeightBefore) < 1,
      'VIDE height must remain fixed when a long result wraps');
    assert(mobileGeometry.wrapPaddingBottom >= 72,
      'Home must retain bottom scroll clearance for Safari chrome');
    assert.equal(mobileGeometry.navPosition, 'sticky',
      'mobile Home primary nav must dock with sticky positioning only after VIDE/version');
    assert(mobileGeometry.navBottom >= 92,
      'mobile Home primary nav must carry explicit Safari toolbar clearance');
    assert(mobileGeometry.viewportBottomClearance >= 90,
      'PLAYER HUB / STATS / LEAGUE must sit above the mobile browser bottom controls');
    assert(mobileGeometry.navRect && mobileGeometry.printerRect &&
      mobileGeometry.navRect.top >= mobileGeometry.printerRect.bottom,
      'PLAYER HUB / STATS / LEAGUE must remain below VIDE, never in front of it');
    assert(mobileGeometry.versionRect && mobileGeometry.navRect &&
      mobileGeometry.versionRect.bottom <= mobileGeometry.navRect.top + 1,
      'Home version must remain above the primary navigation rail');
    assert.equal(mobileGeometry.textSizeAdjust, '100%',
      'Home must disable iOS Safari text autosizing drift');
    assert.equal(mobileGeometry.printerTextSizeAdjust, '100%',
      'VIDE must explicitly disable iOS Safari text autosizing drift');
    assert(Math.abs(mobileGeometry.normalCopyFontSize - mobileGeometry.tableFontSize) < 0.05,
      'ordinary VIDE copy must keep the same computed font size as the printer table');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      !!window.__homeLivePrinterState &&
      document.querySelectorAll('#homeLivePrinterRows tr.lp-row').length === 15
    , { timeout: 5000 });
    const bootBlank = await page.evaluate(() =>
      (document.getElementById('homeLivePrinterRows')?.textContent || '').trim()
    );
    assert.equal(bootBlank, '', 'VIDE must begin visually blank after a full reload');

    await page.waitForTimeout(2600);
    const refreshed = await page.evaluate(() => ({
      text: document.getElementById('homeLivePrinterRows')?.textContent || '',
      buffer: (window.__homeLivePrinterState?.bufLines || []).slice(),
      paused: !!window.__homeLivePrinterState?.paused,
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim()
    }));
    const refreshedNewPlayer = refreshed.buffer.find(line => /Refresh Tester/i.test(String(line)));
    assert(refreshedNewPlayer,
      'persisted NEW PLAYER event must survive refresh in the printer buffer');
    assert.doesNotMatch(String(refreshedNewPlayer), /\s-\s(CLASSIC|TURBO|PRACTICE)\s*$/i,
      'NEW PLAYER presentation events must never gain a game-mode suffix');
    assert.equal(refreshed.paused, false, 'refresh must start LIVE UPDATES playing');
    assert.equal(refreshed.label, 'PAUSE');

    // Reload legitimately creates a fresh document. Mark the new canonical row
    // nodes before testing whether subsequent pause/injection mutates them.
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'))
        .forEach((row, i) => { row.dataset.sc047Stable = 'row-' + i; });
    });

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => window.__homeLivePrinterInjectLine('CLA / 22:31 Thom (200) bts Sam (180)'));
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'));
      const row = rows.find(r => r.querySelector('.lp-game-meta'));
      if (!row) return false;
      const meta = row.querySelector('.lp-game-meta')?.textContent || '';
      const result = row.querySelector('.lp-result')?.textContent || '';
      return /CLA/.test(meta) && !/Thom/.test(meta) && !result;
    }, { timeout: 5000 });
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

    // Regression: once 6-10 structured rows are populated, the fixed VIDE
    // viewport must not squeeze rows together or leave the top row clipped.
    // Keep this on the real scheduler so it covers the same repeated shift/type
    // path used on Home rather than a synthetic DOM-only layout.
    const geometryLines = Array.from({ length: 9 }, (_, i) =>
      `CLA / 22:${String(40 + i).padStart(2, '0')} GEOM${i + 1} (200) bts TESTER (180)`
    );
    await page.evaluate((lines) => {
      lines.forEach(line => window.__homeLivePrinterInjectLine(line));
      if (window.__homeLivePrinterState) window.__homeLivePrinterState.hold = 0;
    }, geometryLines);
    await page.waitForFunction((expected) => {
      const text = document.getElementById('homeLivePrinterRows')?.textContent || '';
      return expected.every(token => text.includes(token));
    }, geometryLines.map((_, i) => `GEOM${i + 1}`), { timeout: 30000 });
    await page.click('#homeLivePauseBtn');
    await page.waitForTimeout(800);

    const denseGeometry = await page.evaluate(() => {
      const mid = document.querySelector('#homeLivePrinter .lp-mid');
      const table = document.querySelector('#homeLivePrinter .lp-table');
      const midRect = mid?.getBoundingClientRect() || null;
      const tableRect = table?.getBoundingClientRect() || null;
      const populated = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'))
        .filter(row => (row.textContent || '').trim())
        .map(row => {
          const rect = row.getBoundingClientRect();
          return {
            text: (row.textContent || '').trim(),
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height
          };
        });
      return { midRect, tableRect, populated };
    });
    console.log('SC-047 dense row geometry', JSON.stringify(denseGeometry));
    const geomRows = denseGeometry.populated.filter(row => /GEOM\d+/.test(row.text));
    assert(geomRows.length >= 9, 'dense regression must retain all nine injected structured rows');
    assert(denseGeometry.midRect && denseGeometry.tableRect, 'dense regression requires VIDE viewport geometry');
    assert(geomRows.every(row => row.height >= 26),
      'structured game rows must retain readable two-line height after 6+ populated rows');
    for (let i = 1; i < geomRows.length; i++) {
      assert(geomRows[i].top >= geomRows[i - 1].bottom - 0.5,
        'populated VIDE rows must never overlap or bunch together');
    }
    assert(geomRows[0].top >= denseGeometry.midRect.top - 1,
      'first populated VIDE row must remain fully inside the top of the feed viewport');
    assert(geomRows[geomRows.length - 1].bottom <= denseGeometry.midRect.bottom + 1,
      'last populated VIDE row must remain fully inside the bottom of the feed viewport');

    await page.emulateMedia({ reducedMotion: 'reduce' });
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
