// P1.2 verification:
//  A) 1-game match, exit via the overlay's advance button -> must land on
//     the leaderboard (not Home), with END MATCH available -> Home.
//  B) 2-game match, advance after game 1 -> must start game 2.
const H = require('./harness');

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}
async function clickAdvance(page) {
  // The advance button (data-action="advanceMatch") sits on a later page of
  // the celebration carousel; page through with the NEXT pager as needed.
  for (let i = 0; i < 5; i++) {
    const visible = await page.evaluate(() => {
      const b = document.querySelector('.sq-gamecomplete-backdrop [data-action="advanceMatch"]');
      return !!b && b.offsetParent !== null;
    });
    if (visible) {
      await page.click('.sq-gamecomplete-backdrop [data-action="advanceMatch"]');
      return true;
    }
    const paged = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sq-gamecomplete-backdrop button'));
      const next = btns.find((b) => b.offsetParent !== null && /^NEXT/i.test(b.textContent.trim()) && !b.dataset.action);
      if (next) { next.click(); return true; }
      return false;
    });
    if (!paged) break;
    // Actions stay .gc-actions-hidden until the XP reveal animation ends
    // (or its 9s safety timeout) — wait for them to become interactive.
    await page.waitForFunction(() => {
      const a = document.querySelector('.sq-gamecomplete-backdrop .gc-actions:not(.gc-actions-hidden) [data-action="advanceMatch"]');
      return !!a && a.offsetParent !== null;
    }, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  // last resort: programmatic click
  return page.evaluate(() => {
    const b = document.querySelector('.sq-gamecomplete-backdrop [data-action="advanceMatch"]');
    if (b) { b.click(); return true; }
    return false;
  });
}

(async () => {
  // ---- Scenario A: final game -> leaderboard
  {
    const { browser, page } = await H.launch({ width: 390, height: 844 });
    await H.boot(page, { settle: 3000 });
    await H.toMatchCard(page);
    await H.addGuests(page, ['TESTA', 'TESTB']);
    await H.startMatch(page, 1);
    await H.playToCompletion(page);
    check('A: overlay appeared', !!(await page.$('.sq-gamecomplete-backdrop')));
    const clicked = await clickAdvance(page);
    check('A: advance button found+clicked', clicked);
    // cloud writes are blocked; allow generous settle
    await page.waitForFunction(() => document.body.dataset.page === 'leaderboard', { timeout: 25000 }).catch(() => {});
    const pg = await page.evaluate(() => document.body.dataset.page);
    check('A: lands on leaderboard (was: Home before fix)', pg === 'leaderboard', 'page=' + pg);
    const overlayGone = !(await page.$('.sq-gamecomplete-backdrop'));
    check('A: overlay removed', overlayGone);
    await page.waitForTimeout(1200);
    const endVisible = await page.evaluate(() => { const e = document.getElementById('newMatchBtn'); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; });
    check('A: END MATCH visible on leaderboard', endVisible);
    await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/screen-leaderboard-via-advance.png' });
    if (endVisible) {
      await page.click('#newMatchBtn'); await page.waitForTimeout(700);
      const btns = await page.$$('.modal-backdrop:not(.hidden) button');
      for (const b of btns) { const t = (await b.textContent() || '').trim().toUpperCase(); if (/YES|END MATCH|CONFIRM/.test(t)) { await b.click(); break; } }
      await page.waitForTimeout(1200);
      check('A: END MATCH returns Home', await page.evaluate(() => document.body.dataset.page === 'details'));
    }
    await browser.close();
  }

  // ---- Scenario B: mid-match advance -> next game
  {
    const { browser, page } = await H.launch({ width: 390, height: 844 });
    await H.boot(page, { settle: 3000 });
    await H.toMatchCard(page);
    await H.addGuests(page, ['TESTA', 'TESTB']);
    await H.startMatch(page, 2); // best-of / 2-game selection (second grid cell)
    await H.playToCompletion(page);
    check('B: overlay appeared', !!(await page.$('.sq-gamecomplete-backdrop')));
    const clicked = await clickAdvance(page);
    check('B: advance clicked', clicked);
    await page.waitForTimeout(4000);
    // Mid-match advance must set up the NEXT game (throw-order dialog) or drop
    // straight into it — and must NOT bounce Home. The completion overlay closes.
    const st = await page.evaluate(() => ({
      pg: document.body.dataset.page,
      throwOrderOpen: !!document.querySelector('.modal-backdrop:not(.hidden) .to-row'),
      gcOpen: !!document.querySelector('.sq-gamecomplete-backdrop'),
    }));
    check('B: overlay closed', !st.gcOpen);
    check('B: not bounced Home', st.pg !== 'details', JSON.stringify(st));
    check('B: next game set up (throw order shown or in game)', st.throwOrderOpen || st.pg === 'game', JSON.stringify(st));
    await browser.close();
  }

  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
