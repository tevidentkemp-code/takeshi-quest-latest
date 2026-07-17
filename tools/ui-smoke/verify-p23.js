// P2.3 verification: duplicate header back controls removed; the surviving
// single control still dismisses; header layout stays centred.
const H = require('./harness');
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }
const SHOTS = '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/';

(async () => {
  // Match Length: header arrow gone, footer BACK works
  {
    const { browser, page } = await H.launch({ width: 390, height: 844 }, { seedPlayers: true });
    await H.boot(page, { settle: 3000 });
    await H.toMatchCard(page);
    await H.addGuests(page, ['TESTA', 'TESTB']);
    await page.click('#startMatchBtn'); await page.waitForTimeout(700);
    check('ML: header arrow #mlBackBtn removed', await page.evaluate(() => !document.getElementById('mlBackBtn')));
    check('ML: footer BACK present', await page.evaluate(() => !!document.getElementById('mlFooterBackBtn')));
    await page.screenshot({ path: SHOTS + 'modal-match-length-single-back.png' });
    await page.click('#mlFooterBackBtn'); await page.waitForTimeout(500);
    check('ML: footer BACK closes to Match Card', await page.evaluate(() => document.getElementById('matchLengthModal').classList.contains('hidden') && document.body.dataset.page === 'players'));
    await browser.close();
  }
  // New Player: back arrow gone, close X works
  {
    const { browser, page } = await H.launch({ width: 390, height: 844 }, { seedPlayers: true });
    await H.boot(page, { settle: 3000 });
    await H.toMatchCard(page);
    await page.click('#msRegisterPlayerBtn'); await page.waitForTimeout(600);
    check('NP: back arrow #npBackBtn removed', await page.evaluate(() => !document.getElementById('npBackBtn')));
    check('NP: close X present', await page.evaluate(() => !!document.getElementById('npCloseBtn')));
    await page.screenshot({ path: SHOTS + 'modal-add-player-single-close.png' });
    await page.click('#npCloseBtn'); await page.waitForTimeout(500);
    check('NP: close X dismisses', await page.evaluate(() => document.getElementById('addPlayerModal').classList.contains('hidden')));
    await browser.close();
  }
  // Admin Hub: back arrow gone, close X works
  {
    const { browser, page } = await H.launch({ width: 390, height: 844 }, { seedPlayers: true });
    await H.boot(page, { settle: 3000 });
    await page.click('#adminCodeBtn'); await page.waitForTimeout(700);
    for (const d of ['4', '9', '3', '6']) { const bts = await page.$$('#adminCodeGateOverlay button'); for (const b of bts) { if ((await b.textContent() || '').trim() === d) { await b.click(); break; } } await page.waitForTimeout(150); }
    const bts = await page.$$('#adminCodeGateOverlay button'); for (const b of bts) { if ((await b.textContent() || '').trim() === 'Return') { await b.click(); break; } }
    await page.waitForTimeout(900);
    check('ADMIN: back arrow #closeAdminHubBtn removed', await page.evaluate(() => !document.getElementById('closeAdminHubBtn')));
    check('ADMIN: close ✕ present', await page.evaluate(() => !!document.getElementById('closeAdminHubBtnX')));
    check('ADMIN: hub visible', await page.evaluate(() => !document.getElementById('adminHubModal').classList.contains('hidden')));
    await page.screenshot({ path: SHOTS + 'popup-admin-hub-single-close.png' });
    await page.click('#closeAdminHubBtnX'); await page.waitForTimeout(500);
    check('ADMIN: ✕ dismisses hub', await page.evaluate(() => document.getElementById('adminHubModal').classList.contains('hidden')));
    await browser.close();
  }
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
