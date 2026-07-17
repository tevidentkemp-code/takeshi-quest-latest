// P5.2 verification: Main Menu confirms are styled dialogs, not native confirm().
// The harness records any native dialog; zero must fire. NO keeps state; YES acts.
const H = require('./harness');
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  let nativeDialogs = 0;
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => { nativeDialogs++; await d.dismiss().catch(() => {}); });

  await H.boot(page, { settle: 3000 });
  await H.toMatchCard(page);
  await H.addGuests(page, ['TESTA', 'TESTB']);
  await H.startMatch(page, 1);

  async function openMenuRow(re) {
    await page.evaluate(() => document.getElementById('settingsBtnGame').click());
    await page.waitForTimeout(800);
    const rows = await page.$$('.modal-backdrop:not(.hidden) button');
    for (const r of rows) {
      const t = (await r.textContent() || '').replace(/\s+/g, ' ').trim();
      if (re.test(t)) { await r.click(); return true; }
    }
    return false;
  }

  // --- End Game: NO first
  check('End Game row clicked', await openMenuRow(/End Game/i));
  await page.waitForTimeout(700);
  let st = await page.evaluate(() => {
    const c = document.querySelector('.sq-confirm-bd');
    return { styled: !!c, title: c ? (c.querySelector('h3') || {}).textContent : null };
  });
  check('styled confirm shown (End Game)', st.styled && /End Game/i.test(st.title || ''), JSON.stringify(st));
  await page.click('.sq-confirm-bd .sq-endmatch-no').catch(() => {});
  await page.waitForTimeout(600);
  // close the still-open main menu via backdrop
  await page.evaluate(() => { const m = document.querySelector('.sq-menu106-bd'); if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(400);
  check('NO keeps the game running', await page.evaluate(() => document.body.dataset.page === 'game'));

  // --- Restart Game styled confirm appears
  check('Restart row clicked', await openMenuRow(/Restart Game/i));
  await page.waitForTimeout(700);
  st = await page.evaluate(() => { const c = document.querySelector('.sq-confirm-bd'); return { styled: !!c, title: c ? (c.querySelector('h3') || {}).textContent : null }; });
  check('styled confirm shown (Restart)', st.styled && /Restart/i.test(st.title || ''), JSON.stringify(st));
  await page.click('.sq-confirm-bd .sq-endmatch-no').catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => { const m = document.querySelector('.sq-menu106-bd'); if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(400);

  // --- End Game: YES -> leaderboard
  await openMenuRow(/End Game/i);
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/popup-end-game-styled-confirm.png' });
  await page.click('.sq-confirm-bd .sq-endmatch-yes').catch(() => {});
  await page.waitForTimeout(1500);
  check('YES ends game -> leaderboard', await page.evaluate(() => document.body.dataset.page === 'leaderboard'));

  check('zero native confirm() dialogs fired', nativeDialogs === 0, 'native=' + nativeDialogs);

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
