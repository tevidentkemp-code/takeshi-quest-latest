// SC-008 Player Stats regression: achievement-v2 catalogue + separate Misfires UI.
const H = require('./harness');
const FX = require('./pstats-fixture');
const E = FX.EXPECTED;
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await FX.install(page);
  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(1800);

  const catalogue = await page.evaluate(() => {
    const wanted = ['photo_finish','runaway','last_gasp','special_forces','steady_eddie','century_streak','pb_smasher','reverse_sweep','clean_sweep'];
    const byCode = Object.fromEntries((window.SQ_ACH && SQ_ACH.CATALOG || []).map((x) => [x.code, x]));
    return wanted.map((code) => byCode[code] || null);
  });
  check('achievement-v2: all 9 client catalogue entries present', catalogue.length === 9 && catalogue.every(Boolean), JSON.stringify(catalogue));
  check('achievement-v2: XP values mirror DB rules', JSON.stringify(catalogue.map((x) => x && x.xp)) === JSON.stringify([20,30,50,180,25,40,50,150,80]), JSON.stringify(catalogue));

  const refined = await page.evaluate(() => {
    const byCode = Object.fromEntries(SQ_ACH.CATALOG.map((x) => [x.code, x]));
    return {
      untouchable: byCode.untouchable && byCode.untouchable.desc,
      treble: byCode.treble_trouble && byCode.treble_trouble.desc,
      double: byCode.double_down && byCode.double_down.desc,
      david: !!byCode.david_and_goliath,
    };
  });
  check('Untouchable copy reflects no-falling-behind rule', /without ever falling behind/i.test(refined.untouchable || ''), JSON.stringify(refined));
  check('Treble Trouble copy is number-round isolated', /number round \(10–20\)/i.test(refined.treble || ''), JSON.stringify(refined));
  check('Double Down copy is number-round isolated', /number round \(10–20\)/i.test(refined.double || ''), JSON.stringify(refined));
  check('David & Goliath remains held', refined.david === false, JSON.stringify(refined));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).find((b) => /^achievements$/i.test(b.textContent.trim()));
    if (btn) btn.click();
  });
  await page.waitForTimeout(900);

  const misfires = await page.evaluate(() => {
    const card = document.querySelector('.sq-stats-modal .pp-misfires');
    if (!card) return null;
    const rows = {};
    card.querySelectorAll('.pp-misfire-row').forEach((row) => {
      const cells = row.children;
      const name = cells[1] && cells[1].firstElementChild ? cells[1].firstElementChild.textContent : '';
      const value = cells[2] ? cells[2].textContent : '';
      rows[String(name).trim()] = String(value).trim();
    });
    return {
      visible: card.offsetParent !== null,
      total: (card.querySelector('.pp-misfire-total') || {}).textContent || '',
      xp: (card.querySelector('.pp-misfire-xp') || {}).textContent || '',
      footer: (card.querySelector('.pp-misfire-foot') || {}).textContent || '',
      rowCount: card.querySelectorAll('.pp-misfire-row').length,
      rows,
      tabs: Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).map((b) => b.textContent.trim()),
    };
  });

  check('Misfires section visible inside Achievements', !!misfires && misfires.visible, JSON.stringify(misfires));
  if (misfires) {
    check('Misfires: all 8 rules shown', misfires.rowCount === 8, JSON.stringify(misfires.rowCount));
    check('Misfires: historical total = 4', norm(misfires.total) === E.misfires.total, JSON.stringify(misfires.total));
    check('Misfires: launch-forward XP impact = -2 XP', norm(misfires.xp) === E.misfires.xp, JSON.stringify(misfires.xp));
    check('Misfires: Bull Blind count from DB aggregate', norm(misfires.rows['Bull Blind']) === E.misfires.bullBlind, JSON.stringify(misfires.rows));
    check('Misfires: Cold Start count from DB aggregate', norm(misfires.rows['Cold Start']) === E.misfires.coldStart, JSON.stringify(misfires.rows));
    check('Misfires: footer explicitly says launch-forward', /apply only from 5 Sep 2026 20:13 UTC/i.test(misfires.footer), misfires.footer);
    check('Misfires: footer states worst-only / -5 cap', /only the worst penalty applies/i.test(misfires.footer) && /maximum deduction is 5 XP per game/i.test(misfires.footer), misfires.footer);
    check('Player Stats navigation unchanged (3 tabs)', JSON.stringify(misfires.tabs) === JSON.stringify(['Stats','XP','Achievements']), JSON.stringify(misfires.tabs));
  }

  const realErrs = consoleErrs.filter((e) => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', realErrs.length === 0, realErrs.slice(0, 5).join(' | '));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
