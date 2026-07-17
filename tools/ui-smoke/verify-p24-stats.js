// P2.4 verification: the leaderboard must expose a working STATS action
// (previously stranded in the hidden top row — audit N-4).
const H = require('./harness');
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await H.toMatchCard(page);
  await H.addGuests(page, ['TESTA', 'TESTB']);
  await H.startMatch(page, 1);
  await H.playToCompletion(page);
  // dismiss overlay + go to leaderboard
  const cb = await page.$('.sq-gamecomplete-backdrop [data-action="gcClose"]'); if (cb) await cb.click();
  await page.waitForTimeout(500);
  for (const b of await page.$$('#pad button')) { const t = (await b.textContent() || '').trim(); if (/Finish Game/i.test(t)) { await b.click(); break; } }
  await page.waitForFunction(() => document.body.dataset.page === 'leaderboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const st = await page.evaluate(() => {
    const b = document.getElementById('statsHubBtnFinal');
    if (!b) return { present: false };
    const inStack = !!b.closest('.stacked-actions');
    return { present: true, visible: b.offsetParent !== null, inStack, label: b.textContent.trim(), cls: b.className };
  });
  check('STATS button present', st.present);
  check('STATS visible on leaderboard', st.visible, JSON.stringify(st));
  check('STATS relocated into action stack', st.inStack);
  check('STATS labelled "STATS"', /STATS/i.test(st.label || ''));

  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/screen-leaderboard-with-stats.png' });

  // clicking it opens the stats hub
  await page.click('#statsHubBtnFinal').catch(() => {});
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => !!document.querySelector('.modal-backdrop:not(.hidden)'));
  check('STATS opens the stats hub', opened);

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
