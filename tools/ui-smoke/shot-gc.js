// Capture the completion overlay with the new explicit close control (P1.1 evidence).
const H = require('./harness');
(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await H.toMatchCard(page);
  await H.addGuests(page, ['TESTA', 'TESTB']);
  await H.startMatch(page, 1);
  await H.playToCompletion(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/popup-match-complete-with-close.png' });
  const btn = await page.$('.sq-gamecomplete-backdrop .gc-close');
  console.log('gc-close present:', !!btn, btn ? await btn.evaluate(b => ({ vis: b.offsetParent !== null || getComputedStyle(b).position === 'absolute', aria: b.getAttribute('aria-label') })) : null);
  await browser.close();
})();
