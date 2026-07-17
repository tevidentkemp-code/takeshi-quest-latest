const H = require('./harness');
let failures=0; function check(n,ok,d){if(!ok)failures++;console.log((ok?'PASS':'FAIL')+'  '+n+(ok||!d?'':'  — '+d));}
(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  // enter admin
  await page.click('#adminCodeBtn'); await page.waitForTimeout(700);
  for (const d of ['4','9','3','6']) { const bts=await page.$$('#adminCodeGateOverlay button'); for (const b of bts){ if((await b.textContent()||'').trim()===d){await b.click();break;} } await page.waitForTimeout(150); }
  const bts=await page.$$('#adminCodeGateOverlay button'); for (const b of bts){ if((await b.textContent()||'').trim()==='Return'){await b.click();break;} }
  await page.waitForTimeout(900);
  // open HS League admin (dynamic dialog), then immediately reopen the hub — the old repro left both stacked
  await page.click('#openHsLeagueAdmin'); await page.waitForTimeout(1200);
  await page.evaluate(() => window.openAdminHub());
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-backdrop'))
    .filter(m => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none')
    .map(m => m.id || '(dyn:' + (m.querySelector('h3') ? m.querySelector('h3').textContent.trim().slice(0,30) : '?') + ')'));
  check('only the Admin Hub is open after reopen (no stacking)', st.length === 1 && st[0] === 'adminHubModal', JSON.stringify(st));
  // switching between two tools rapidly also leaves a single dialog
  await page.click('#openLeagueLowsAdmin').catch(()=>{}); await page.waitForTimeout(500);
  await page.evaluate(() => window.openAdminHub()); await page.waitForTimeout(300);
  await page.click('#openHsPracticeAdmin').catch(()=>{}); await page.waitForTimeout(1000);
  const st2 = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-backdrop'))
    .filter(m => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none').length);
  check('rapid tool switching leaves <=1 open backdrop', st2 <= 1, 'open=' + st2);
  await browser.close();
  console.log(failures?`\n${failures} FAILURES`:'\nALL PASS'); process.exit(failures?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
