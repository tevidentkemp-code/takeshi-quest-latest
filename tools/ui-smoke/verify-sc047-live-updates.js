const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');

const out = process.env.SQ_SCREENSHOTS || path.join(__dirname, '../../output/playwright/sc047');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const { browser, ctx, page, consoleErrs } = await H.launch();
  try {
    await ctx.addInitScript(() => {
      const iso = new Date().toISOString();
      localStorage.setItem('shateki_players', JSON.stringify([{
        id:'sc047-recent-player',
        name:'Recent Player',
        first_name:'Recent',
        last_name:'Player',
        nickname:'',
        initials:'RP',
        joinedAt:iso,
        _src:'cloud-cache'
      }]));
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await H.boot(page, { settle: 3000 });
    await page.waitForFunction(() =>
      !!window.__homeLivePrinterState &&
      typeof window.__homeLivePrinterInjectLine === 'function' &&
      !!document.getElementById('homeLivePauseBtn')
    , { timeout: 20000 });

    // A recent saved player comes from the cloud-synced display cache and
    // must survive reload as a proper LIVE UPDATES event. First paint should
    // already contain data rather than 15 blank rows slowly filling over time.
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#homeLivePrinterRows tr.lp-row');
      const body = document.getElementById('homeLivePrinterRows');
      const pause = document.getElementById('homeLivePauseBtn');
      return rows.length === 15 && !!body && body.textContent.includes('Recent Player')
        && pause && pause.textContent.trim() === 'PAUSE'
        && pause.getAttribute('aria-pressed') === 'false';
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
    const visibleGeometry = await page.evaluate(() => {
      const mid = document.querySelector('#homeLivePrinter .lp-mid');
      const rows = Array.from(document.querySelectorAll('#homeLivePrinterRows tr.lp-row'));
      const mr = mid && mid.getBoundingClientRect();
      const last = rows[rows.length - 1] && rows[rows.length - 1].getBoundingClientRect();
      return { midBottom: mr && mr.bottom, lastBottom: last && last.bottom, midTop: mr && mr.top, firstTop: rows[0] && rows[0].getBoundingClientRect().top };
    });
    assert(visibleGeometry.lastBottom <= visibleGeometry.midBottom + 1, '15th LIVE UPDATES row must be fully visible: ' + JSON.stringify(visibleGeometry));
    assert(visibleGeometry.firstTop >= visibleGeometry.midTop - 1, 'first LIVE UPDATES row must stay inside panel: ' + JSON.stringify(visibleGeometry));
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
