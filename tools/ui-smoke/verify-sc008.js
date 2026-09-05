// SC-008/009 Player Stats regression: achievement catalogue + Misfire history remains DB-derived.
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
  check('achievement-v2: all 9 SC-008 catalogue entries remain present', catalogue.length === 9 && catalogue.every(Boolean), JSON.stringify(catalogue));
  check('achievement-v2: XP values remain unchanged', JSON.stringify(catalogue.map((x) => x && x.xp)) === JSON.stringify([20,30,50,180,25,40,50,150,80]), JSON.stringify(catalogue));

  const refined = await page.evaluate(() => {
    const byCode = Object.fromEntries(SQ_ACH.CATALOG.map((x) => [x.code, x]));
    return {
      untouchable: byCode.untouchable && byCode.untouchable.desc,
      miniMaxi: byCode.treble_trouble && byCode.treble_trouble.name,
      miniDs: byCode.double_down && byCode.double_down.name,
      david: byCode.david_and_goliath || null,
      giant: byCode.giant_slayer || null,
    };
  });
  check('Untouchable copy reflects canonical no-behind rule', /without ever being behind/i.test(refined.untouchable || ''), JSON.stringify(refined));
  check('SC-009 canonical rename: Mini Maxi', refined.miniMaxi === 'Mini Maxi', JSON.stringify(refined));
  check('SC-009 canonical rename: Mini D’s', refined.miniDs === 'Mini D’s', JSON.stringify(refined));
  check('David & Goliath now active at +100 XP', !!refined.david && refined.david.xp === 100, JSON.stringify(refined));
  check('legacy Giant Slayer remains separate', !!refined.giant, JSON.stringify(refined));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).find((b) => /^achievements$/i.test(b.textContent.trim()));
    if (btn) btn.click();
  });
  await page.waitForTimeout(900);

  const misfires = await page.evaluate(() => {
    const card = document.querySelector('.sq-stats-modal .pp-misfires');
    if (!card) return null;
    const byCode = {};
    card.querySelectorAll('.pp-misfire-card').forEach((row) => {
      byCode[row.dataset.code] = {
        count: Number(row.dataset.count || 0),
        penalty: (row.querySelector('.pp-misfire-penalty') || {}).textContent || '',
        repeat: (row.querySelector('.pp-misfire-count') || {}).textContent || '',
      };
    });
    return {
      visible: card.offsetParent !== null,
      total: (card.querySelector('.pp-misfire-total') || {}).textContent || '',
      xp: (card.querySelector('.pp-misfire-xp') || {}).textContent || '',
      footer: (card.querySelector('.pp-misfire-foot') || {}).textContent || '',
      cardCount: card.querySelectorAll('.pp-misfire-card').length,
      byCode,
      tabs: Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).map((b) => b.textContent.trim()),
    };
  });

  check('Misfires section remains visible inside Achievements', !!misfires && misfires.visible, JSON.stringify(misfires));
  if (misfires) {
    check('Misfires: all 8 rules shown', misfires.cardCount === 8, JSON.stringify(misfires.cardCount));
    check('Misfires: historical total = 4', norm(misfires.total) === E.misfires.total, JSON.stringify(misfires.total));
    check('Misfires: launch-forward XP impact = -2 XP', norm(misfires.xp) === E.misfires.xp, JSON.stringify(misfires.xp));
    check('Misfires: Bull Blind count from DB aggregate', misfires.byCode.bull_blind && misfires.byCode.bull_blind.count === 3 && norm(misfires.byCode.bull_blind.repeat) === '×3', JSON.stringify(misfires.byCode));
    check('Misfires: Cold Start count from DB aggregate', misfires.byCode.cold_start && misfires.byCode.cold_start.count === 1, JSON.stringify(misfires.byCode));
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
