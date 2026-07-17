// P1.3 verification: with Supabase blocked, league dialogs must settle into an
// error/empty state (not eternal "Loading…"), and the RETRY button must re-run.
const H = require('./harness');

const DIALOGS = [
  ['powerRankingsBtn', 'Power Rankings'],
  ['premierLeagueBtn', 'Premier League'],
  ['highScoreLeagueBtn', 'High Score League'],
  ['streakLeagueBtn', 'Streak League'],
  ['leagueRoundHighScoresBtn', 'Round High Scores'],
  ['leagueTop50ScoresBtn', 'Top 50 Scores'],
  ['leagueLatestScoresBtn', 'Latest Scores'],
];

(async () => {
  let failures = 0;
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });

  for (const [id, name] of DIALOGS) {
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not([id])').forEach(m => m.remove()));
    await page.click('#leagueRankingsBtn'); await page.waitForTimeout(900);
    await page.evaluate((i) => { const b = document.getElementById(i); if (b) b.click(); }, id);
    // wait past the 12s cloud timeout
    await page.waitForTimeout(15000);
    const st = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-backdrop')).filter(x => !x.classList.contains('hidden')).pop();
      if (!m) return { open: false };
      const text = m.textContent.replace(/\s+/g, ' ');
      return {
        open: true,
        stillLoading: /Loading…|Loading\.\.\.|Loading Premier League/.test(text),
        hasErrorState: /unavailable|not available/i.test(text),
        hasRetry: !!m.querySelector('[data-action="cloudRetry"]'),
      };
    });
    const ok = st.open && !st.stillLoading && (st.hasErrorState || st.hasRetry);
    if (!ok) failures++;
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  ' + JSON.stringify(st));
    if (id === 'powerRankingsBtn' && st.hasRetry) {
      // exercise RETRY once: should re-enter loading then settle again
      await page.click('[data-action="cloudRetry"]').catch(() => {});
      await page.waitForTimeout(14000);
      const st2 = await page.evaluate(() => {
        const m = Array.from(document.querySelectorAll('.modal-backdrop')).filter(x => !x.classList.contains('hidden')).pop();
        const text = m ? m.textContent : '';
        return { settled: !/Loading…/.test(text), retryAgain: !!(m && m.querySelector('[data-action="cloudRetry"]')) };
      });
      const ok2 = st2.settled && st2.retryAgain;
      if (!ok2) failures++;
      console.log((ok2 ? 'PASS' : 'FAIL') + '  Power Rankings RETRY re-settles  ' + JSON.stringify(st2));
      await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/popup-league-power-rankings-cloud-error.png' });
    }
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not([id])').forEach(m => m.remove()));
    await page.waitForTimeout(300);
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
