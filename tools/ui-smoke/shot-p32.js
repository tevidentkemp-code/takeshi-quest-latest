// Capture the P3.2 restyle candidates (before OR after, per argv[2] tag).
// Targets: New Player SAVE PLAYER (disabled + enabled), Select Player sort chips.
const H = require('./harness');
const TAG = process.argv[2] || 'before';
const OUT = '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/p32/';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 }, { seedPlayers: true });
  await H.boot(page, { settle: 3000 });
  await H.toMatchCard(page);

  // New Player modal — SAVE PLAYER disabled
  await page.click('#msRegisterPlayerBtn'); await page.waitForTimeout(700);
  const np = await page.$('#addPlayerModal .np-modal');
  await np.screenshot({ path: OUT + `np-disabled-${TAG}.png` });
  // fill fields to enable (no save click — cloud writes stay untouched)
  await page.fill('#newPlayerFirst', 'Test');
  await page.fill('#newPlayerLast', 'Person');
  await page.fill('#newPlayerInitials', 'TP');
  await page.waitForTimeout(500);
  await np.screenshot({ path: OUT + `np-enabled-${TAG}.png` });
  await page.click('#npCloseBtn'); await page.waitForTimeout(400);

  // Select Player modal — sort chips
  await page.click('#msAddRegisteredBtn'); await page.waitForTimeout(700);
  const sp = await page.$('#selectPlayerModal .sp-modal');
  await sp.screenshot({ path: OUT + `chips-${TAG}.png` });

  await browser.close();
  console.log('captured', TAG);
})().catch((e) => { console.error(e); process.exit(1); });
