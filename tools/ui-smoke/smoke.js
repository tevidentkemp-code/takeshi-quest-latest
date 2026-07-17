// SHATEKI-QUEST smoke suite.
// Full journey: home -> mode tree -> match card -> match length -> throw order
// -> live game -> completion overlay -> leaderboard -> game scores -> end match -> home.
// Run: node smoke.js   (serve the repo root first, default http://localhost:8123)
// Exit code 0 = pass. All Supabase traffic is network-blocked by the harness.
const H = require('./harness');
const fs = require('fs');
const path = require('path');

const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });

  // -- Home
  check('boots to Home (data-page=details)', await page.evaluate(() => document.body.dataset.page === 'details'));
  for (const id of ['startGameBtn', 'playerHubBtn', 'playerStatsBtn', 'leagueRankingsBtn', 'adminCodeBtn']) {
    check(`home control #${id} visible`, await page.evaluate((i) => { const b = document.getElementById(i); return !!b && b.offsetParent !== null; }, id));
  }

  // -- Select Game Mode tree
  await page.click('#startGameBtn'); await page.waitForTimeout(500);
  check('SELECT GAME MODE opens', await page.evaluate(() => !document.getElementById('startGameModal').classList.contains('hidden')));
  await page.click('#questBtn'); await page.waitForTimeout(500);
  check('MATCH PLAY variant submenu shows CLASSIC', !!(await page.$('#matchClassicBtn')));
  const back = await page.$('#startGameModal .modal-footer .ms2-back, #startGameModal .sg-practice-footer .ms2-back, #startGameModal .sq-back');
  check('variant submenu has BACK', !!back);
  if (back) { await back.click(); await page.waitForTimeout(500); }
  check('BACK returns to mode list', !!(await page.$('#practiceBtn')));

  // -- Match card + setup
  await page.click('#questBtn'); await page.waitForTimeout(400);
  await page.click('#matchClassicBtn'); await page.waitForTimeout(700);
  check('Match Card shown', await page.evaluate(() => document.body.dataset.page === 'players'));
  check('SELECT MATCH LENGTH disabled with <2 players', await page.evaluate(() => document.getElementById('startMatchBtn').disabled));
  await H.addGuests(page, ['TESTA', 'TESTB']);
  check('SELECT MATCH LENGTH enabled with 2 players', await page.evaluate(() => !document.getElementById('startMatchBtn').disabled));

  await H.startMatch(page, 1);
  check('Live Game reached', await page.evaluate(() => document.body.dataset.page === 'game'));
  check('throw pad built', await page.evaluate(() => document.querySelectorAll('#pad button').length >= 5));

  // -- In-game Main Menu
  await page.evaluate(() => document.getElementById('settingsBtnGame').click());
  await page.waitForTimeout(800);
  check('Main Menu opens (fix106)', !!(await page.$('.sq-menu106-bd')));
  // Known limitation (audit N-7): Main Menu does not close on Escape; backdrop works.
  await page.evaluate(() => {
    const m = document.querySelector('.sq-menu106-bd');
    if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  check('Main Menu closes via backdrop', !(await page.$('.sq-menu106-bd')));

  // -- Play to completion
  await H.playToCompletion(page);
  const gc = await page.$('.sq-gamecomplete-backdrop');
  check('completion overlay appears', !!gc);

  // Dismiss overlay: prefer an explicit control (added by P1.1), fall back to backdrop.
  let usedExplicit = false;
  const closeBtn = await page.$('.sq-gamecomplete-backdrop [data-action="gcClose"]');
  if (closeBtn) { await closeBtn.click(); usedExplicit = true; }
  else {
    await page.evaluate(() => {
      const ov = document.querySelector('.sq-gamecomplete-backdrop');
      if (ov) ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await page.waitForTimeout(800);
  check('completion overlay dismissible' + (usedExplicit ? ' (explicit control)' : ' (backdrop only)'), !(await page.$('.sq-gamecomplete-backdrop')));

  // -- Finish to leaderboard
  const fin = await page.$$('#pad button');
  for (const b of fin) { const t = (await b.textContent() || '').trim(); if (/Finish Game/i.test(t)) { await b.click(); break; } }
  await page.waitForFunction(() => document.body.dataset.page === 'leaderboard', { timeout: 15000 }).catch(() => {});
  check('leaderboard reached via Finish Game', await page.evaluate(() => document.body.dataset.page === 'leaderboard'));

  // -- Game Scores popup
  await page.click('#gameScoresBtn').catch(() => {});
  await page.waitForTimeout(800);
  check('Game Scores opens', await page.evaluate(() => !!document.querySelector('.modal-backdrop:not(.hidden)')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  check('Game Scores closes on Escape', await page.evaluate(() => !document.querySelector('.modal-backdrop:not(.hidden)')));

  // -- End match -> home
  const end = await page.$('#newMatchBtn:not(.hidden)');
  if (end) {
    await end.click(); await page.waitForTimeout(700);
    const btns = await page.$$('.modal-backdrop:not(.hidden) button');
    for (const b of btns) { const t = (await b.textContent() || '').trim().toUpperCase(); if (/YES|END MATCH|CONFIRM/.test(t)) { await b.click(); break; } }
    await page.waitForTimeout(1200);
  }
  check('END MATCH returns Home', await page.evaluate(() => document.body.dataset.page === 'details'));

  // -- Home dialogs still open after full journey
  await page.click('#leagueRankingsBtn'); await page.waitForTimeout(900);
  check('League menu opens post-journey', await page.evaluate(() => !!document.querySelector('.modal-backdrop:not(.hidden)')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // -- Console errors (allow known cloud-fetch failures — Supabase is blocked)
  const realErrs = consoleErrs.filter((e) => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

  // -- Snapshot for regression diffing
  const snap = await H.domSnapshot(page);
  const outDir = path.join(__dirname, 'snapshots');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'home.json'), JSON.stringify(snap, null, 1));

  await browser.close();
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH:', e); process.exit(2); });
