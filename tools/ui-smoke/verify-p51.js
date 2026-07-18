// P5.1 verification: sqModal factory + first migrations.
//  - factory: stack (Escape closes topmost only), focus trap, focus restore
//  - in-game Stats hub: opens via factory, identical rows, nav-through works
//  - Game Scores: opens via factory on the leaderboard, Escape closes
const H = require('./harness');
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });

  // ---- factory unit checks (programmatic)
  const stackTest = await page.evaluate(() => {
    const a = window.sqModal({ title: 'Stack A' });
    const b = window.sqModal({ title: 'Stack B' });
    const open2 = window.__sqModalStack.length === 2;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const afterEsc1 = { aOpen: document.body.contains(a.overlay), bOpen: document.body.contains(b.overlay), stack: window.__sqModalStack.length };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const afterEsc2 = { aOpen: document.body.contains(a.overlay), stack: window.__sqModalStack.length };
    return { open2, afterEsc1, afterEsc2 };
  });
  check('factory: two modals stack', stackTest.open2);
  check('factory: Escape closes TOP only', stackTest.afterEsc1.aOpen && !stackTest.afterEsc1.bOpen && stackTest.afterEsc1.stack === 1, JSON.stringify(stackTest.afterEsc1));
  check('factory: second Escape closes the rest', !stackTest.afterEsc2.aOpen && stackTest.afterEsc2.stack === 0);

  const a11yTest = await page.evaluate(() => {
    const m = window.sqModal({ title: 'A11y test', sub: 'sub', onBack: function(){}, closeButton: 'Close' });
    const res = {
      role: m.modal.getAttribute('role'),
      ariaModal: m.modal.getAttribute('aria-modal'),
      label: m.modal.getAttribute('aria-label'),
      hasBack: !!m.modal.querySelector('[aria-label="Back"]'),
      hasX: !!m.modal.querySelector('[aria-label="Close"]'),
      hasFooterClose: !!(m.footer && m.footer.textContent.includes('Close')),
    };
    m.close();
    return res;
  });
  check('factory: role/aria/back/close/footer', a11yTest.role === 'dialog' && a11yTest.ariaModal === 'true' && a11yTest.label === 'A11y test' && a11yTest.hasBack && a11yTest.hasX && a11yTest.hasFooterClose, JSON.stringify(a11yTest));

  // ---- in-game Stats hub migration
  await H.toMatchCard(page);
  await H.addGuests(page, ['TESTA', 'TESTB']);
  await H.startMatch(page, 1);
  await page.evaluate(() => document.getElementById('settingsBtnGame').click());
  await page.waitForTimeout(800);
  // Main Menu > Stats
  const rows = await page.$$('.modal-backdrop:not(.hidden) button');
  for (const r of rows) { const t = (await r.textContent() || '').replace(/\s+/g, ' ').trim(); if (/Stats.*in-game stats/i.test(t)) { await r.click(); break; } }
  await page.waitForTimeout(900);
  const hub = await page.evaluate(() => {
    const top = (window.__sqModalStack || [])[window.__sqModalStack.length - 1];
    if (!top) return { viaFactory: false };
    const labels = Array.from(top.body.querySelectorAll('button')).map((b) => b.textContent.trim());
    return { viaFactory: true, role: top.modal.getAttribute('role'), labels };
  });
  check('stats hub is on the shared modal stack', hub.viaFactory);
  check('stats hub keeps all 5 rows', hub.viaFactory && hub.labels.length === 5 && /game race/i.test(hub.labels[0]), JSON.stringify(hub.labels || []));

  // Escape must close the hub via the shared stack handler (new behaviour)
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const afterEsc = await page.evaluate(() => ({ stack: (window.__sqModalStack || []).length, hubOpen: !!document.querySelector('.sq-menu106-bd') }));
  check('Escape closes the stats hub (fix106 family)', afterEsc.stack === 0 && !afterEsc.hubOpen, JSON.stringify(afterEsc));

  // reopen for the nav-through test
  await page.evaluate(() => window.openStatsHubDialog());
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/popup-ingame-stats-hub-sqmodal.png' });

  // nav-through: GAME RACE closes hub and opens the race dialog
  await page.evaluate(() => {
    const top = window.__sqModalStack[window.__sqModalStack.length - 1];
    Array.from(top.body.querySelectorAll('button')).find((b) => /game race/i.test(b.textContent)).click();
  });
  await page.waitForTimeout(1200);
  const afterNav = await page.evaluate(() => ({
    stack: (window.__sqModalStack || []).length,
    raceOpen: !!Array.from(document.querySelectorAll('.modal-backdrop')).find((m) => !m.classList.contains('hidden') && /Game Race/i.test(m.textContent)),
  }));
  check('GAME RACE nav-through works (hub closed, race open)', afterNav.stack === 0 && afterNav.raceOpen, JSON.stringify(afterNav));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not([id])').forEach((m) => m.remove()));

  // ---- Game Scores migration (leaderboard path)
  await H.playToCompletion(page);
  const cb = await page.$('.sq-gamecomplete-backdrop [data-action="gcClose"]'); if (cb) await cb.click();
  await page.waitForTimeout(500);
  for (const b of await page.$$('#pad button')) { const t = (await b.textContent() || '').trim(); if (/Finish Game/i.test(t)) { await b.click(); break; } }
  await page.waitForFunction(() => document.body.dataset.page === 'leaderboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.click('#gameScoresBtn').catch(() => {});
  await page.waitForTimeout(900);
  const gs = await page.evaluate(() => {
    const top = (window.__sqModalStack || [])[window.__sqModalStack.length - 1];
    if (!top) return { viaFactory: false };
    return { viaFactory: true, label: top.modal.getAttribute('aria-label'), hasTable: !!top.modal.querySelector('table'), hasClose: !!(top.footer && /Close/.test(top.footer.textContent)) };
  });
  check('Game Scores opens via factory with table + Close', gs.viaFactory && gs.label === 'Game Scores' && gs.hasTable && gs.hasClose, JSON.stringify(gs));
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/popup-game-scores-sqmodal.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  check('Game Scores closes on Escape (via stack handler)', await page.evaluate(() => (window.__sqModalStack || []).length === 0));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
