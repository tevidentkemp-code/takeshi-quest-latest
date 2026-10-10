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

    await page.waitForFunction(() => !!window.__sqUpdateAvailableState?.latestVersion, { timeout: 5000 });
    const releaseCurrent = await page.evaluate(() => ({
      running: window.__sqRunningVersion,
      state: window.__sqUpdateAvailableState,
      label: document.getElementById('sqReleaseVersionBtn')?.textContent?.trim()
    }));
    assert.equal(releaseCurrent.state.updateAvailable, false,
      'current build must not show an update warning when latest metadata matches');
    assert.equal(releaseCurrent.label, 'v' + releaseCurrent.running,
      'version control must show the actually running build, not fetched latest metadata');

    // Seed the exact class of legacy browser-local contamination reported
    // from physical iPhone acceptance. The current session may still receive
    // a transient NEW PLAYER notification, but public feed history must never
    // persist either event in browser storage.
    await page.evaluate(() => {
      const key = 'sq_live_updates_events_v1';
      localStorage.setItem(key, JSON.stringify([{
        id:'local:sc004-accept',
        ts:new Date().toISOString(),
        kind:'new_player',
        line:'🚨 NEW PLAYER - SC004 ACCEPT FIXTURE - Welcome to Shateki Quest 🎯'
      }]));
      window.__homeLivePrinterPersistLine('🚨 NEW PLAYER - Refresh Tester - Welcome to Shateki Quest 🎯', 'new_player');
    });
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#homeLivePrinterRows tr.lp-row');
      const body = document.getElementById('homeLivePrinterRows');
      return rows.length === 15 && !!body && body.textContent.includes('Refresh Tester');
    }, { timeout: 5000 });
    const preReloadLocalCache = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('sq_live_updates_events_v1') || '[]'); }
      catch (_) { return []; }
    });
    assert.equal(preReloadLocalCache.length, 1,
      'VIDE persistence API must not append new browser-local feed history');
    assert.match(String(preReloadLocalCache[0]?.line || ''), /SC004 ACCEPT FIXTURE/i,
      'legacy contamination fixture missing before cleanup reload');

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
    assert.match(firstLoad.text, /Refresh Tester/i, 'transient NEW PLAYER event must be visible in the current session');
    assert.doesNotMatch(firstLoad.text, /SC004 ACCEPT FIXTURE/i,
      'legacy browser-local contamination must never enter the current feed');
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
        supportsTextSizeAdjust: CSS.supports('-webkit-text-size-adjust', '100%') || CSS.supports('text-size-adjust', '100%'),
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
    // Desktop WebKit does not implement the iOS text-autosizing property.
    // Engines exposing it must still report the locked value; font/geometry
    // outcomes below run in every engine.
    if (mobileGeometry.supportsTextSizeAdjust) {
      assert.equal(mobileGeometry.textSizeAdjust, '100%',
        'Home must disable iOS Safari text autosizing drift');
      assert.equal(mobileGeometry.printerTextSizeAdjust, '100%',
        'VIDE must explicitly disable iOS Safari text autosizing drift');
    }
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
      label: document.getElementById('homeLivePauseBtn')?.textContent?.trim(),
      localCache: localStorage.getItem('sq_live_updates_events_v1')
    }));
    assert.equal(refreshed.localCache, null,
      'full reload must remove the retired local LIVE UPDATES history cache');
    assert.equal(refreshed.buffer.some(line => /Refresh Tester/i.test(String(line))), false,
      'transient NEW PLAYER event must not survive refresh as browser-local history');
    assert.equal(refreshed.buffer.some(line => /SC004 ACCEPT FIXTURE/i.test(String(line))), false,
      'SC/test acceptance contamination must not survive refresh');
    assert.doesNotMatch(refreshed.text, /SC004 ACCEPT FIXTURE|Refresh Tester/i,
      'retired local feed history must not render after refresh');
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
      return /22:31/.test(meta) && !/Thom/.test(meta) && !result;
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
    assert(twoLine.hasMeta && twoLine.hasResult, 'game row must expose time and scoreline blocks');
    assert(twoLine.resultTop <= twoLine.metaBottom + 1, 'time and player scores must share a compact row');

    // Regression: once 6-10 structured rows are populated, the fixed VIDE
    // viewport must not squeeze rows together or leave the top row clipped.
    // Keep this on the real scheduler so it covers the same repeated shift/type
    // path used on Home rather than a synthetic DOM-only layout.
    const geometryLines = Array.from({ length: 9 }, (_, i) =>
      i === 8
        ? 'CLA / 22:48 GEOM9 (450) bts Christopher (404), Grant (403), Liam (397), Matteo (388), James (377)'
        : `CLA / 22:${String(40 + i).padStart(2, '0')} GEOM${i + 1} (200) bts TESTER (180)`
    );
    await page.evaluate((lines) => {
      lines.forEach(line => window.__homeLivePrinterInjectLine(line));
      if (window.__homeLivePrinterState) window.__homeLivePrinterState.hold = 0;
    }, geometryLines);
    await page.waitForFunction((expected) => {
      const text = document.getElementById('homeLivePrinterRows')?.textContent || '';
      return expected.every(token => text.includes(token));
    }, [...geometryLines.map((_, i) => `GEOM${i + 1}`), 'James (377)'], { timeout: 30000 });
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

    // Mobile-width acceptance: SC-047 visual work must remain safe at the
    // repository's representative 320 / 390 / 430 CSS-pixel widths.
    for (const width of [320, 430, 390]) {
      await page.setViewportSize({ width, height: 844 });
      // Fitting runs on the resize event's animation frame. WebKit can deliver
      // that event after the viewport call resolves, so await the visible
      // outcome rather than assuming a fixed 120ms delivery time.
      await page.waitForFunction(() => {
        const mid = document.querySelector('#homeLivePrinter .lp-mid');
        const table = document.querySelector('#homeLivePrinter .lp-table');
        return mid && table && table.getBoundingClientRect().bottom <= mid.getBoundingClientRect().bottom + 1;
      }, null, { timeout: 2000 });
      const widthGeometry = await page.evaluate(() => {
        const mid = document.querySelector('#homeLivePrinter .lp-mid');
        const table = document.querySelector('#homeLivePrinter .lp-table');
        const midRect = mid?.getBoundingClientRect() || null;
        const tableRect = table?.getBoundingClientRect() || null;
        const visibleRows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'))
          .map(row => {
            const rect = row.getBoundingClientRect();
            return { text:(row.textContent || '').trim(), top:rect.top, bottom:rect.bottom, height:rect.height };
          })
          .filter(row => row.text && row.height > 0.5);
        return { midRect, tableRect, visibleRows };
      });
      assert(widthGeometry.midRect && widthGeometry.tableRect, `VIDE geometry missing at ${width}px`);
      console.log('SC-047 width geometry', width, JSON.stringify(widthGeometry));
      assert(widthGeometry.tableRect.bottom <= widthGeometry.midRect.bottom + 1,
        `VIDE table must remain inside viewport at ${width}px`);
      assert(widthGeometry.visibleRows.every(row => row.height >= 26),
        `visible VIDE rows must retain readable height at ${width}px`);
      const wrappedResult = await page.locator('#homeLivePrinterRows tr.lp-row').filter({ hasText: 'GEOM9' }).last().evaluate(row => {
        const result = row.querySelector('.lp-result');
        return { text: result?.textContent || '', width: result?.clientWidth || 0, scrollWidth: result?.scrollWidth || 0 };
      });
      assert.match(wrappedResult.text, /James \(377\)/, 'long result must retain its final player');
      assert(wrappedResult.width > 0 && wrappedResult.scrollWidth <= wrappedResult.width + 1,
        `long scoreline must wrap without horizontal clipping at ${width}px`);
      for (let i = 1; i < widthGeometry.visibleRows.length; i++) {
        assert(widthGeometry.visibleRows[i].top >= widthGeometry.visibleRows[i - 1].bottom - 0.5,
          `VIDE rows must not overlap at ${width}px`);
      }
    }

    // A narrow viewport can retire every older visual slot. The one remaining
    // result must keep its content height, rather than stretch to fill VIDE.
    // This isolates the sparse-table layout seen in Thomas's iPhone report.
    const sparseGeometry = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'));
      const previous = rows.map(row => row.classList.contains('lp-fit-hidden'));
      try {
        rows.forEach((row, i) => row.classList.toggle('lp-fit-hidden', i < rows.length - 1));
        const row = rows[rows.length - 1];
        return {
          height: row.getBoundingClientRect().height,
          text: row.textContent || '',
          tableWidth: document.querySelector('#homeLivePrinter .lp-table').getBoundingClientRect().width,
          resultWidth: row.querySelector('.lp-result')?.getBoundingClientRect().width || 0
        };
      } finally {
        rows.forEach((row, i) => row.classList.toggle('lp-fit-hidden', previous[i]));
      }
    });
    console.log('SC-047 sparse row geometry', JSON.stringify(sparseGeometry));
    assert.match(sparseGeometry.text, /GEOM9/, 'sparse fallback must retain the newest real result');
    assert(sparseGeometry.height >= 26 && sparseGeometry.height < 80,
      'one remaining VIDE result must keep natural height, never fill the entire panel');
    assert(sparseGeometry.resultWidth <= sparseGeometry.tableWidth,
      'sparse result must wrap inside the feed width');

    // Geometry capture pauses the real printer to remove transition noise.
    // Restore playing state before continuing the pre-existing pause/resume contract checks.
    await page.click('#homeLivePauseBtn');
    await page.waitForFunction(() => !window.__homeLivePrinterState?.paused);

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

    // Data truth / mode isolation: Practice may appear as a result, but it
    // must never contribute ROUND PB/WR lines. Official and Turbo maintain
    // independent round-history baselines.
    await page.evaluate(() => {
      const game = (id, ts, mode, name, roundTotal) => ({
        id,
        ts,
        archived_at:null,
        mode,
        is_practice: mode === 'practice',
        state:{ mode, is_practice:mode === 'practice' },
        players:[{name},{name:'FILLER'}],
        totals:[300,200],
        board:[
          [{ roundTotal, darts:[] }],
          [{ roundTotal:0, darts:[] }]
        ]
      });
      const games = [
        game('official-leader','2026-10-03T20:00:00Z','official','OFFICIAL LEADER',60),
        game('official-player','2026-10-03T20:01:00Z','official','MODE B',50),
        game('turbo-leader','2026-10-03T20:02:00Z','turbo','TURBO LEADER',60),
        game('turbo-player','2026-10-03T20:03:00Z','turbo','MODE B',40),
        game('practice-player','2026-10-03T20:04:00Z','practice','PRACTICE ONLY',70)
      ];
      window.cloudFetchAllGamesAsLocal = async () => games.map(g => ({...g}));
      window.cloudFetchLatestVisibleGamesAsLocal = async () => [];
      window.cloudFetchLatestGamesAsLocal = async () => [];
      window.cloudListPlayers = async () => [];
      const st = window.__homeLivePrinterState;
      st.derivedItems = [];
      st.derivedFetchedAt = 0;
      st.bufLines = [];
      st.lastSig = '';
      st.lastSyncMs = 0;
      st.hold = 0;
    });
    await page.waitForFunction(() => {
      const lines = window.__homeLivePrinterState?.bufLines || [];
      return lines.some(line => /ROUND PB.*MODE B.*\(50\)/i.test(String(line))) &&
             lines.some(line => /ROUND PB.*MODE B.*\(40\)/i.test(String(line)));
    }, { timeout: 5000 });
    const modePbLines = await page.evaluate(() =>
      (window.__homeLivePrinterState?.bufLines || [])
        .map(String)
        .filter(line => /ROUND\s+(?:PB|WR)\b/i.test(line))
    );
    assert(modePbLines.some(line => /ROUND PB.*MODE B.*\(50\)/i.test(line)),
      'Official ROUND PB must be derived from the Official history bucket');
    assert(modePbLines.some(line => /ROUND PB.*MODE B.*\(40\)/i.test(line)),
      'Turbo ROUND PB must be derived from the Turbo history bucket, not Official history');
    assert.equal(modePbLines.some(line => /PRACTICE ONLY|\(70\)/i.test(line)), false,
      'Practice must never contribute ROUND PB/WR lines to VIDE');

    // SC063: the current Stats directory covers Home even when a relevant
    // match request began first. Keep the native poll/clock and all original
    // SC047 fixtures; only transport seams below park/deliver that response.
    await page.waitForFunction(() => !window.__homeLivePrinterState?.syncing,
      { timeout: 8000 });
    await page.evaluate(() => {
      const prior = {
        all: window.cloudFetchAllGamesAsLocal,
        visible: window.cloudFetchLatestVisibleGamesAsLocal,
        latest: window.cloudFetchLatestGamesAsLocal,
        players: window.cloudListPlayers,
        sb: window.sb
      };
      window.__sc063NativeHomePrior = prior;
      window.__sc063NativeHomeAllCalls = 0;
      window.__sc063NativeHomeAllAt = 0;
      window.__sc063NativeHomeMatchCalls = 0;
      window.__sc063NativeHomeMatchDeliver = null;
      window.cloudFetchAllGamesAsLocal = async () => {
        ++window.__sc063NativeHomeAllCalls;
        window.__sc063NativeHomeAllAt = Date.now();
        return prior.all();
      };
      const recent = {
        id:'sc063-home-guard-native-game',
        ts:'2026-10-03T20:05:00Z',
        archived_at:null,
        mode:'official',
        match_id:'sc063-home-guard-native-match',
        players:[{name:'MODE B'},{name:'FILLER'}],
        totals:[300,200],
        state:{mode:'official'}
      };
      window.cloudFetchLatestVisibleGamesAsLocal = async () => [{...recent}];
      window.cloudFetchLatestGamesAsLocal = async () => [{...recent}];
      window.cloudListPlayers = async () => [{name:'MODE B'}];
      window.sb = {
        ...prior.sb,
        from(table) {
          if (table !== 'matches') return prior.sb.from(table);
          return {
            select() { return this; },
            in() {
              ++window.__sc063NativeHomeMatchCalls;
              return new Promise(resolve => {
                window.__sc063NativeHomeMatchDeliver = () => resolve({data:[],error:null});
              });
            }
          };
        }
      };
      const st = window.__homeLivePrinterState;
      st.matchRowsCache = null;
      st.derivedItems = [];
      st.derivedFetchedAt = 0;
      st.lastSyncMs = 0;
    });
    await page.waitForFunction(() =>
      typeof window.__sc063NativeHomeMatchDeliver === 'function' &&
      !!window.__homeLivePrinterState?.syncing,
      { timeout: 8000 });
    await page.click('#playerStatsBtn');
    await page.waitForSelector('.sq-player-stats-directory .ps-pick-search',
      { timeout: 8000 });
    assert.equal(await page.evaluate(() => window.__sc063NativeHomeAllCalls), 0,
      'Stats directory must not prewarm full game history while the Home match read is pending');
    await page.evaluate(() => window.__sc063NativeHomeMatchDeliver());
    await page.waitForFunction(() => !window.__homeLivePrinterState?.syncing,
      { timeout: 8000 });
    const coveredHome = await page.evaluate(() => ({
      allCalls:window.__sc063NativeHomeAllCalls,
      matchCalls:window.__sc063NativeHomeMatchCalls,
      fetchedAt:window.__homeLivePrinterState?.derivedFetchedAt,
      derivedCount:window.__homeLivePrinterState?.derivedItems?.length,
      lastSyncMs:window.__homeLivePrinterState?.lastSyncMs,
      recentResult:(window.__homeLivePrinterState?.bufLines || [])
        .some(line => /MODE B.*300/i.test(String(line)))
    }));
    assert.equal(coveredHome.allCalls, 0,
      'Home must check current Stats visibility after its awaited match response before starting full history');
    assert.equal(coveredHome.matchCalls, 1, 'relevant match read must remain the original single request');
    assert.equal(coveredHome.fetchedAt, 0, 'covered Home must not stamp a fabricated derived fetch');
    assert.equal(coveredHome.derivedCount, 0, 'covered Home must preserve the prior empty derived cache');
    assert.equal(coveredHome.recentResult, true, 'recent visible results must still enter the Home buffer');
    await page.click('.sq-player-stats-directory [aria-label="Close"]');
    await page.waitForFunction(() => !document.querySelector('.sq-player-stats-directory'),
      { timeout: 8000 });
    // Observe the existing >=15-second native poll. Do not install a timer,
    // lower its interval, force another sync or move the clock.
    await page.waitForTimeout(8000);
    await page.waitForFunction(() =>
      window.__sc063NativeHomeAllCalls === 1 &&
      !window.__homeLivePrinterState?.syncing &&
      !!window.__homeLivePrinterState?.derivedFetchedAt,
      { timeout: 8000 });
    const resumedHome = await page.evaluate(() => ({
      allCalls:window.__sc063NativeHomeAllCalls,
      allAt:window.__sc063NativeHomeAllAt,
      matchCalls:window.__sc063NativeHomeMatchCalls,
      lines:(window.__homeLivePrinterState?.bufLines || []).map(String)
        .filter(line => /ROUND\s+(?:PB|WR)\b/i.test(line))
    }));
    assert.equal(resumedHome.allCalls, 1, 'closing Stats must permit the next original poll to rebuild full history once');
    assert(resumedHome.allAt - coveredHome.lastSyncMs >= 15000,
      'Home must resume on its existing native >=15-second poll');
    assert.equal(resumedHome.matchCalls, 1, 'the normal poll must retain the relevant-match cache');
    assert(resumedHome.lines.some(line => /ROUND PB.*MODE B.*\(50\)/i.test(line)),
      'resumed Home must preserve the original Official ROUND PB fixture');
    assert(resumedHome.lines.some(line => /ROUND PB.*MODE B.*\(40\)/i.test(line)),
      'resumed Home must preserve the original Turbo ROUND PB fixture');
    assert.equal(resumedHome.lines.some(line => /PRACTICE ONLY|\(70\)/i.test(line)), false,
      'resumed Home must preserve original Practice ROUND isolation');
    await page.evaluate(() => {
      const prior = window.__sc063NativeHomePrior;
      window.cloudFetchAllGamesAsLocal = prior.all;
      window.cloudFetchLatestVisibleGamesAsLocal = prior.visible;
      window.cloudFetchLatestGamesAsLocal = prior.latest;
      window.cloudListPlayers = prior.players;
      window.sb = prior.sb;
      delete window.__sc063NativeHomePrior;
    });
    console.log('SC063 native Home/Stats match-order and original poll PASS',
      JSON.stringify({covered:coveredHome, resumed:{...resumedHome, lines:undefined}}));

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

    const runningVersion = await page.evaluate(() => window.__sqRunningVersion);
    const versionBits = runningVersion.split('.').map(Number);
    const fakeLatest = [versionBits[0], versionBits[1], versionBits[2] + 1].join('.');
    await page.route('**/assets/release-metadata.json*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schemaVersion: 1,
          currentVersion: fakeLatest,
          currentReleaseId: 'SC047_TEST_UPDATE',
          releases: []
        })
      });
    });
    await page.evaluate(() => window.__sqCheckForAppUpdate(true));
    await page.waitForFunction((latest) => {
      const st = window.__homeLivePrinterState || {};
      const queued = (st.injectQueue || []).some(line => String(line).includes('REFRESH APP - UPDATE AVAILABLE') && String(line).includes('v' + latest));
      const visible = (document.getElementById('homeLivePrinterRows')?.textContent || '').includes('REFRESH APP - UPDATE AVAILABLE');
      return queued || visible;
    }, fakeLatest, { timeout: 5000 });
    await page.waitForFunction(() =>
      (document.getElementById('homeLivePrinterRows')?.textContent || '').includes('REFRESH APP - UPDATE AVAILABLE'),
      { timeout: 5000 }
    );
    const updateAlert = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'))
        .find(r => (r.textContent || '').includes('REFRESH APP - UPDATE AVAILABLE'));
      return {
        state: window.__sqUpdateAvailableState,
        label: document.getElementById('sqReleaseVersionBtn')?.textContent?.trim(),
        localCache: localStorage.getItem('sq_live_updates_events_v1'),
        alertClass: !!row?.classList.contains('lp-alert'),
        text: row?.textContent || ''
      };
    });
    assert.equal(updateAlert.state.updateAvailable, true,
      'newer metadata must set updateAvailable');
    assert.equal(updateAlert.state.latestVersion, fakeLatest);
    assert.equal(updateAlert.label, 'v' + runningVersion,
      'stale app must continue to identify the build actually running');
    assert.match(updateAlert.text, /REFRESH APP - UPDATE AVAILABLE/i);
    assert.equal(updateAlert.alertClass, true,
      'update notice must use the existing high-priority VIDE alert treatment');
    assert.equal(updateAlert.localCache, null,
      'update notice must never persist as browser-local feed history');
    await page.unroute('**/assets/release-metadata.json*');

    await page.screenshot({ path: path.join(out, 'live-updates-stable.png') });
    const pageErrors = consoleErrs.filter(x => x.startsWith('pageerror:'));
    assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
    console.log('SC-047 LIVE UPDATES stability PASS');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
