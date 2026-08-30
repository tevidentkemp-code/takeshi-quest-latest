// Regression verifier for Player Stats > Progression mode isolation.
// Run from tools/ui-smoke with repo root served on http://localhost:8123.
// Supabase is replaced with an in-page read-only fixture so production data is never touched.
const H = require('./harness');

const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 2500 });

  await page.evaluate(() => {
    const rowsByView = {
      v_player_game_scores_official_clean: [100, 200, 300, 400, 500, 600].map((score, i) => ({
        game_id: 'o' + i,
        ts: `2026-08-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
        player_name: 'Thom',
        score
      })),
      v_player_game_scores_turbo_clean: [40, 50, 60, 70, 80, 90].map((score, i) => ({
        game_id: 't' + i,
        ts: `2026-08-${String(i + 11).padStart(2, '0')}T12:00:00Z`,
        player_name: 'Thom',
        score
      }))
    };

    window.__progQueries = [];
    const makeQuery = (view) => {
      let query;
      query = new Proxy({}, {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve) => resolve({ data: rowsByView[view] || [], error: null });
          }
          return (...args) => {
            if (prop === 'ilike') window.__progQueries.push({ view, col: args[0], value: args[1] });
            return query;
          };
        }
      });
      return query;
    };

    window.sb = {
      from(view) { return makeQuery(view); },
      rpc() { return makeQuery('__rpc__'); }
    };
  });

  await page.evaluate(() => window.openPlayerProgressionDialog('Thom'));
  await page.waitForSelector('.sq-progression-mode-toggle');
  const modal = page.locator('.modal:has(.sq-progression-mode-toggle)');
  const official = modal.locator('button[data-progression-mode="official"]');
  const turbo = modal.locator('button[data-progression-mode="turbo"]');
  const pillAll = modal.locator('.prog-stats').first();
  const pillAvg = modal.locator('.prog-stats').nth(1);

  check('Official mode button visible', await official.isVisible());
  check('Turbo mode button visible', await turbo.isVisible());
  const mobileGeom = await modal.evaluate((m) => {
    const h = m.querySelector('.modal-header')?.getBoundingClientRect();
    const t = m.querySelector('.sq-progression-mode-toggle')?.getBoundingClientRect();
    const o = m.querySelector('button[data-progression-mode="official"]')?.getBoundingClientRect();
    const u = m.querySelector('button[data-progression-mode="turbo"]')?.getBoundingClientRect();
    const mr = m.getBoundingClientRect();
    return {
      headerRight: h?.right || 0, toggleRight: t?.right || 0,
      modalLeft: mr.left, modalRight: mr.right,
      toggleLeft: t?.left || 0, officialH: o?.height || 0, turboH: u?.height || 0,
      scrollWidth: m.scrollWidth, clientWidth: m.clientWidth
    };
  });
  check('mode controls meet 44px mobile tap target', mobileGeom.officialH >= 44 && mobileGeom.turboH >= 44, JSON.stringify(mobileGeom));
  check('mode controls stay upper-right inside modal', mobileGeom.toggleLeft >= mobileGeom.modalLeft && mobileGeom.toggleRight <= mobileGeom.modalRight + 1 && Math.abs(mobileGeom.headerRight - mobileGeom.toggleRight) <= 20, JSON.stringify(mobileGeom));
  check('Progression modal has no horizontal overflow at 390px', mobileGeom.scrollWidth <= mobileGeom.clientWidth + 1, JSON.stringify(mobileGeom));
  check('Official is selected by default', (await official.getAttribute('aria-pressed')) === 'true');
  check('Turbo is not selected by default', (await turbo.getAttribute('aria-pressed')) === 'false');

  const officialStats = (await pillAll.textContent() || '').trim();
  check('Official fixture only drives summary', officialStats.includes('Avg 350.0') && officialStats.includes('Low 100') && officialStats.includes('High 600'), officialStats);

  await modal.locator('button[data-mode="B5"]').click();
  await page.waitForTimeout(150);
  const officialB5 = (await pillAvg.textContent() || '').trim();
  check('5 Game AV uses Official series only', officialB5.includes('Avg Low 300.0') && officialB5.includes('Avg High 600.0'), officialB5);

  await page.setViewportSize({ width: 400, height: 844 });
  await page.waitForTimeout(250);
  const officialAfterResize = (await pillAvg.textContent() || '').trim();
  check('resize preserves selected 5 Game AV', officialAfterResize.includes('Avg Low 300.0') && officialAfterResize.includes('Avg High 600.0'), officialAfterResize);

  await turbo.click();
  await page.waitForFunction(() => {
    const m = document.querySelector('.modal .sq-progression-mode-toggle')?.closest('.modal');
    const p = m?.querySelector('.prog-stats');
    return !!p && /Avg 65\.0/.test(p.textContent || '');
  });

  check('Turbo becomes selected', (await turbo.getAttribute('aria-pressed')) === 'true');
  check('Official deselects', (await official.getAttribute('aria-pressed')) === 'false');
  const turboStats = (await pillAll.textContent() || '').trim();
  check('Turbo fixture only drives summary', turboStats.includes('Avg 65.0') && turboStats.includes('Low 40') && turboStats.includes('High 90'), turboStats);
  const turboB5 = (await pillAvg.textContent() || '').trim();
  check('5 Game AV remains selected inside Turbo', turboB5.includes('Avg Low 60.0') && turboB5.includes('Avg High 90.0'), turboB5);

  const queries = await page.evaluate(() => window.__progQueries.slice());
  check('Official reads canonical Official clean view', queries.some(q => q.view === 'v_player_game_scores_official_clean'));
  check('Turbo reads canonical Turbo clean view', queries.some(q => q.view === 'v_player_game_scores_turbo_clean'));
  check('no mixed/legacy progression source queried', queries.every(q => /v_player_game_scores_(official|turbo)_clean/.test(q.view)), JSON.stringify(queries));

  const realErrs = consoleErrs.filter((e) => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('PROGRESSION MODE VERIFY CRASH:', e); process.exit(2); });
