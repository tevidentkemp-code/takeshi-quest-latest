// SHATEKI-QUEST smoke suite.
// Full canonical journey: home -> mode tree -> match card -> FT3 match length
// -> throw order -> live game 1 -> leaderboard/NEXT GAME -> AUTO-rotated live game 2
// -> leaderboard/NEXT GAME -> AUTO-rotated live game 3 -> leaderboard/END MATCH
// -> game scores -> end match -> home.
// Run: node smoke.js   (serve the repo root first, default http://localhost:8123)
// Exit code 0 = pass. All Supabase traffic is network-blocked by the harness.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const { createThrowpadChecks, checkScoreControls } = require('./throwpad-layout');

const results = [];
let failures = 0;
const shots = process.env.SQ_SCREENSHOTS;
async function screenshot(page, name, selector) {
  if (!shots) return;
  fs.mkdirSync(shots, { recursive: true });
  const file = path.join(shots, name + '.png');
  if (selector) await page.locator(selector).screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: false });
}
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}

async function dismissCompletion(page, label) {
  const gc = await page.$('.sq-gamecomplete-backdrop');
  check(`${label}: completion overlay appears`, !!gc);

  let usedExplicit = false;
  const closeBtn = await page.$('.sq-gamecomplete-backdrop [data-action="gcClose"]');
  if (closeBtn) {
    await closeBtn.click();
    usedExplicit = true;
  } else {
    await page.evaluate(() => {
      const ov = document.querySelector('.sq-gamecomplete-backdrop');
      if (ov) ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await page.waitForTimeout(800);
  check(`${label}: completion overlay dismissible${usedExplicit ? ' (explicit control)' : ' (backdrop only)'}`, !(await page.$('.sq-gamecomplete-backdrop')));
}

async function finishToLeaderboard(page, label) {
  const buttons = await page.$$('#pad button');
  let clicked = false;
  for (const b of buttons) {
    const t = (await b.textContent() || '').trim();
    if (/Finish Game/i.test(t)) {
      await b.click();
      clicked = true;
      break;
    }
  }
  check(`${label}: Finish Game control available`, clicked);
  await page.waitForFunction(() => document.body.dataset.page === 'leaderboard', { timeout: 15000 }).catch(() => {});
  check(`${label}: leaderboard reached via Finish Game`, await page.evaluate(() => document.body.dataset.page === 'leaderboard'));
}

async function leaderboardState(page) {
  return page.evaluate(() => {
    const visible = (id) => {
      const el = document.getElementById(id);
      return !!el && !el.classList.contains('hidden') && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
    };
    return {
      nextVisible: visible('nextGameBtn'),
      endVisible: visible('newMatchBtn'),
      rows: document.querySelectorAll('#lbTable tbody tr').length,
    };
  });
}

async function continueMatch(page, label, nextGameNumber) {
  const lb = await leaderboardState(page);
  check(`${label} leaderboard has player rows`, lb.rows >= 2, JSON.stringify(lb));
  check(`${label} leaderboard shows NEXT GAME`, lb.nextVisible, JSON.stringify(lb));
  check(`${label} leaderboard hides END MATCH`, !lb.endVisible, JSON.stringify(lb));

  const before = await page.evaluate(() => ({
    order: (state.players || []).map(p => String(p && p.name || '')),
    auto: state?.match?.autoRotateOrder === true,
  }));
  check(`${label}: AUTO throw-order rotation is enabled`, before.auto, JSON.stringify(before));

  await page.click('#nextGameBtn');
  await page.waitForFunction(() => document.body.dataset.page === 'game', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);

  const after = await page.evaluate(() => ({
    order: (state.players || []).map(p => String(p && p.name || '')),
    modal: !!document.querySelector('.modal-throworder'),
  }));
  const expected = before.order.length > 1 ? before.order.slice(1).concat(before.order[0]) : before.order.slice();
  check(`${label}: NEXT GAME skips manual throw-order when AUTO is ON`, !after.modal, JSON.stringify(after));
  check(`${label}: starter rotates exactly one place`, JSON.stringify(after.order) === JSON.stringify(expected), JSON.stringify({before:before.order, after:after.order, expected}));
  check(`NEXT GAME starts Game ${nextGameNumber}`, await page.evaluate(() => document.body.dataset.page === 'game'));
  check(`Game ${nextGameNumber} throw pad built`, await page.evaluate(() => document.querySelectorAll('#pad button').length >= 5));
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

  // Canonical official match: first to 3 wins. Player-identity scoring keeps
  // TESTA as the intended winner regardless of any inter-game order choice.
  await H.startMatch(page, 3);
  check('FT3 Live Game reached', await page.evaluate(() => document.body.dataset.page === 'game'));
  check('throw pad built', await page.evaluate(() => document.querySelectorAll('#pad button').length >= 5));
  await page.waitForTimeout(700);
  await screenshot(page, 'sc015-live-classic-mobile');
  const throwpadChecks = createThrowpadChecks(check, screenshot);
  await throwpadChecks.onTurn(page);
  await checkScoreControls(page, check);

  // -- SXP-04 quick rail utilities
  const soundBefore = await page.evaluate(() => localStorage.getItem('sq_livev3_sound') !== '0');
  await page.locator('#v2QuickSound').click();
  const soundAfter = await page.evaluate(() => ({
    on:localStorage.getItem('sq_livev3_sound') !== '0',
    pressed:document.getElementById('v2QuickSound')?.getAttribute('aria-pressed')
  }));
  check('Quick Sound toggles the existing persisted sound preference',
    soundAfter.on !== soundBefore && soundAfter.pressed === (soundAfter.on ? 'true' : 'false'));
  await page.locator('#v2QuickSound').click();
  check('Quick Sound can restore its prior state',
    await page.evaluate(expected => (localStorage.getItem('sq_livev3_sound') !== '0') === expected, soundBefore));

  await page.locator('#v2QuickTv').click();
  await page.waitForTimeout(250);
  check('Quick TV enters the canonical TV layout',
    await page.evaluate(() => !!(window.__sqTvModeIsActive && window.__sqTvModeIsActive())));
  await page.evaluate(() => { try{ window.__sqTvModeToggle?.(false); }catch(_){} });
  await page.waitForTimeout(150);
  check('TV layout can return to the live scoring view',
    await page.evaluate(() => !(window.__sqTvModeIsActive && window.__sqTvModeIsActive())));

  // -- In-game Main Menu (SXP-04 quick rail)
  await page.locator('#v2QuickMenu').click();
  await page.waitForTimeout(800);
  check('Main Menu opens from Live V2 quick rail', !!(await page.$('.sq-menu106-bd')));
  check('Quick Menu opens only the canonical menu', await page.evaluate(() => {
    const open = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')].filter(m => getComputedStyle(m).display !== 'none');
    return open.length === 1 && open[0].classList.contains('sq-menu106-bd');
  }));
  // Known limitation (audit N-7): Main Menu does not close on Escape; backdrop works.
  await page.evaluate(() => {
    const m = document.querySelector('.sq-menu106-bd');
    if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  check('Main Menu closes via backdrop', !(await page.$('.sq-menu106-bd')));
  check('Closing Settings leaves no blocking overlay', await page.evaluate(() => !document.querySelector('.modal-backdrop:not(.hidden)')));

  // -- Game 1: first legitimate intermediate Leaderboard state.
  await H.playToCompletion(page, { onTurn: throwpadChecks.onTurn, strongPlayerName: 'TESTA' });
  throwpadChecks.finish();
  await dismissCompletion(page, 'Game 1');
  await finishToLeaderboard(page, 'Game 1');
  await continueMatch(page, 'Game 1', 2);

  // -- Game 2: same intended player, independent of throw order.
  await H.playToCompletion(page, { strongPlayerName: 'TESTA' });
  await dismissCompletion(page, 'Game 2');
  await finishToLeaderboard(page, 'Game 2');
  await continueMatch(page, 'Game 2', 3);

  // -- Game 3: TESTA reaches the canonical FT3 winning threshold.
  await H.playToCompletion(page, { strongPlayerName: 'TESTA' });
  await dismissCompletion(page, 'Game 3');
  await finishToLeaderboard(page, 'Game 3');

  const lb = await leaderboardState(page);
  check('Final FT3 leaderboard has player rows', lb.rows >= 2, JSON.stringify(lb));
  check('Final FT3 leaderboard hides NEXT GAME', !lb.nextVisible, JSON.stringify(lb));
  check('Final FT3 leaderboard shows END MATCH', lb.endVisible, JSON.stringify(lb));

  // -- Game Scores popup from final leaderboard
  await page.click('#gameScoresBtn').catch(() => {});
  await page.waitForTimeout(800);
  check('Game Scores opens', await page.evaluate(() => !!document.querySelector('.modal-backdrop:not(.hidden)')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  check('Game Scores closes on Escape', await page.evaluate(() => !document.querySelector('.modal-backdrop:not(.hidden)')));

  // -- End match -> home
  const end = await page.$('#newMatchBtn:not(.hidden)');
  check('END MATCH control available after FT3 win', !!end);
  if (end) {
    await end.click(); await page.waitForTimeout(700);
    const btns = await page.$$('.modal-backdrop:not(.hidden) button');
    for (const b of btns) {
      const t = (await b.textContent() || '').trim().toUpperCase();
      if (/YES|END MATCH|CONFIRM/.test(t)) { await b.click(); break; }
    }
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
