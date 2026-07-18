// Capture the Player Stats profile dialog (fixture data) — per argv[2] tag.
const H = require('./harness');
const FX = require('./pstats-fixture');
const TAG = process.argv[2] || 'before';
const OUT = '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/pstats/';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await FX.install(page);
  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(4000);

  await page.screenshot({ path: OUT + `stats-top-${TAG}.png` });
  // scroll panels for the rest of the STATS tab
  await page.evaluate(() => { const b = document.querySelector('.sq-stats-modal .modal-body'); if (b) b.scrollTop = 700; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + `stats-mid-${TAG}.png` });
  await page.evaluate(() => { const b = document.querySelector('.sq-stats-modal .modal-body'); if (b) b.scrollTop = 99999; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + `stats-bottom-${TAG}.png` });

  // XP tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.sq-stats-modal button')).filter((b) => /^xp$/i.test(b.textContent.trim()));
    if (btns[0]) btns[0].click();
    const b = document.querySelector('.sq-stats-modal .modal-body'); if (b) b.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + `xp-${TAG}.png` });

  // Achievements tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.sq-stats-modal button')).filter((b) => /^achievements$/i.test(b.textContent.trim()));
    if (btns[0]) btns[0].click();
    const b = document.querySelector('.sq-stats-modal .modal-body'); if (b) b.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + `ach-${TAG}.png` });

  await browser.close();
  console.log('captured', TAG, '->', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
