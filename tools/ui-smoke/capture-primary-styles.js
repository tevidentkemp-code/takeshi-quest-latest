// Capture computed styles of the primary/orange buttons across the setup funnel.
// Used as a before/after oracle for the P3 design-token repoint: the values
// must be byte-identical after tokens replace the hard-coded literals.
const H = require('./harness');
const fs = require('fs');
const path = require('path');

async function cap(page, label, selector) {
  const d = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { MISSING: true };
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, bgImg: cs.backgroundImage, border: cs.borderColor, color: cs.color, radius: cs.borderRadius };
  }, selector);
  return { label, selector, ...d };
}

(async () => {
  const out = [];
  const { browser, page } = await H.launch({ width: 390, height: 844 }, { seedPlayers: true });
  await H.boot(page, { settle: 3000 });

  await page.click('#startGameBtn'); await page.waitForTimeout(500);
  out.push(await cap(page, 'startGame(hero)', '#startGameBtn'));
  await page.click('#questBtn'); await page.waitForTimeout(400);
  await page.click('#matchClassicBtn'); await page.waitForTimeout(700);
  out.push(await cap(page, 'msAddSaved', '#msAddRegisteredBtn'));
  out.push(await cap(page, 'startMatch(ms-primary)', '#startMatchBtn'));
  await H.addGuests(page, ['TESTA', 'TESTB']);
  out.push(await cap(page, 'startMatch(enabled)', '#startMatchBtn'));
  await page.click('#startMatchBtn'); await page.waitForTimeout(600);
  await page.evaluate(() => { const s = document.querySelector('#mlGrid .mlw-seg[data-value="1"]'); if (s) s.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(300);
  out.push(await cap(page, 'mlStart(ms-primary)', '#mlStartBtn'));
  await page.click('#mlStartBtn'); await page.waitForTimeout(900);
  out.push(await cap(page, 'throwOrderStart(to-start)', '.to-start'));

  await browser.close();
  const dest = path.join(__dirname, process.argv[2] || 'primary-styles.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
