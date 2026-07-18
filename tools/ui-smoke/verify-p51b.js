// P5.1 batch 2: league-dialog family registered on the shared modal stack.
// For each dialog: opens onto the stack, Escape closes it (stack handler),
// and the legacy Close button still works with the stack ending clean
// (removal observer retires the entry).
const H = require('./harness');
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }

const DIALOGS = [
  { name: 'League & Rankings menu', open: "window.openLeagueRankingsDialog()", closeSel: null },
  { name: 'Latest Scores', open: "window.openLatestScoresDialog('official')" },
  { name: 'Round High Scores', open: "window.openRoundHighScoresDialog('official')" },
  { name: 'Top 50 Scores', open: "window.openTop50ScoresDialog('official')" },
  { name: 'High Score League', open: "window.openHighScoreLeagueDialog('official')" },
  { name: 'Power Rankings', open: "window.openPowerRankingsDialog('official')" },
  { name: 'Premier League', open: "window.openPremierLeagueDialog()" },
];

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });

  for (const d of DIALOGS) {
    // -- open, expect a stack entry whose overlay is the visible backdrop
    await page.evaluate(d.open);
    await page.waitForTimeout(1500); // cloud timeout paths settle to error state
    const opened = await page.evaluate(() => {
      const st = window.__sqModalStack || [];
      const top = st[st.length - 1];
      return {
        stack: st.length,
        attached: !!(top && document.body.contains(top.overlay)),
      };
    });
    check(`${d.name}: opens onto the stack`, opened.stack === 1 && opened.attached, JSON.stringify(opened));

    // -- Escape closes via the stack handler
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const afterEsc = await page.evaluate(() => ({
      stack: (window.__sqModalStack || []).length,
      backdrops: Array.from(document.querySelectorAll('.modal-backdrop')).filter((b) => !b.classList.contains('hidden') && !b.id).length,
    }));
    check(`${d.name}: Escape closes it, stack clean`, afterEsc.stack === 0 && afterEsc.backdrops === 0, JSON.stringify(afterEsc));

    // -- reopen, close via the legacy Close button; observer must retire the entry
    await page.evaluate(d.open);
    await page.waitForTimeout(1200);
    const closed = await page.evaluate(() => {
      const st = window.__sqModalStack || [];
      const top = st[st.length - 1];
      if (!top) return { reopened: false };
      const btn = Array.from(top.overlay.querySelectorAll('button')).find((b) => /^close$/i.test(b.textContent.trim()));
      if (btn) btn.click(); else top.overlay.remove(); // menu dialog has ✕ only
      return { reopened: true };
    });
    await page.waitForTimeout(500);
    const afterBtn = await page.evaluate(() => ({
      stack: (window.__sqModalStack || []).length,
      backdrops: Array.from(document.querySelectorAll('.modal-backdrop')).filter((b) => !b.classList.contains('hidden') && !b.id).length,
    }));
    check(`${d.name}: legacy close leaves no stale stack entry`, closed.reopened && afterBtn.stack === 0 && afterBtn.backdrops === 0, JSON.stringify({ closed, afterBtn }));
  }

  // -- nested: menu -> Latest Scores -> Escape closes only the top
  await page.evaluate(() => window.openLeagueRankingsDialog());
  await page.waitForTimeout(800);
  await page.evaluate(() => window.openLatestScoresDialog('official'));
  await page.waitForTimeout(1200);
  // menu builders remove siblings on open in some paths; require >=1 and top = latest scores
  const nested = await page.evaluate(() => {
    const st = window.__sqModalStack || [];
    const top = st[st.length - 1];
    return { stack: st.length, topIsLatest: !!(top && /latest/i.test(top.overlay.className + ' ' + top.overlay.textContent.slice(0, 200))) };
  });
  check('nested: Latest Scores is top of stack', nested.stack >= 1 && nested.topIsLatest, JSON.stringify(nested));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const nestedAfter = await page.evaluate(() => ({ stack: (window.__sqModalStack || []).length }));
  check('nested: Escape pops one level', nestedAfter.stack === nested.stack - 1, JSON.stringify(nestedAfter));
  await page.evaluate(() => (window.__sqModalStack || []).slice().reverse().forEach((e) => e.close()));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
