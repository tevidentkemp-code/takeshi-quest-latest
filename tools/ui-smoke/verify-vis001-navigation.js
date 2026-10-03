const assert = require('node:assert/strict');
const H = require('./harness');

(async () => {
  for (const width of [320,390,430]) {
    const {browser,page,consoleErrs} = await H.launch({width,height:844},{seedPlayers:true});
    try {
      await H.boot(page,{settle:1300});
      const returnFromAdmin = async () => {
        await page.locator('#adminCodeBtn').tap();
        // Keep the Home Start control in view before cancelling real sign-in.
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.locator('#sqAdminSignInOverlay button').filter({hasText:/^Cancel$/}).tap();
        await page.locator('#sqAdminSignInOverlay').waitFor({state:'detached'});
      };
      const enterImmediately = async (id, title) => {
        // No settling delay before the action: this races the deferred Home work.
        await page.locator('#startGameBtn').tap();
        await page.locator('#'+id).tap();
        const pane = page.locator('#startGameModalBody .sg-practice-title');
        assert.equal((await pane.textContent()).trim(),title,'requested submenu opens immediately');
        // Check after every existing 50/80/160/350 ms callback has had time to run.
        await page.waitForTimeout(450);
        const retained = await page.evaluate(()=>document.querySelector('#startGameModalBody .sg-practice-title')?.textContent.trim());
        assert.equal(retained,title,'deferred Home work preserves the open submenu');
        await page.locator('#startGameModalBody .sg-practice-footer button').filter({hasText:/BACK/i}).tap();
        assert(await page.locator('#practiceBtn').isVisible(),'explicit submenu Back still rebuilds the main choices');
        await page.locator('#closeStartGameModalBtn').tap();
      };
      for (const [id,title] of [['practiceBtn','PRACTICE MODE'],['questBtn','MATCH PLAY']]) {
        await returnFromAdmin();
        await enterImmediately(id,title);
      }
      if (width === 390) {
        await returnFromAdmin();
        await page.locator('#startGameBtn').tap();
        await page.locator('#practiceBtn').tap();
        const originalChoice = await page.locator('#practiceClassicBtn').elementHandle();
        await page.locator('#practiceClassicBtn').tap();
        await page.waitForFunction(()=>document.body.dataset.page==='players');
        await page.waitForTimeout(450);
        assert(await originalChoice.evaluate(n=>n.isConnected),'deferred Home work does not rebuild a pane after leaving Home');
        assert.equal(await page.evaluate(()=>window.__sqSelectedMode),'practice');
        await page.locator('#startScreenBtn').tap();
        await page.locator('#closeStartGameModalBtn').tap();

        await H.toMatchCard(page);
        await H.addGuests(page,['VIS NAV ALPHA','VIS NAV BETA']);
        await H.startMatch(page);
        await page.locator('#settingsBtnGame').tap();
        await page.locator('.sq-menu106-bd button').filter({hasText:/End Match/}).tap();
        await page.locator('.sq-confirm-bd .sq-endmatch-yes').tap();
        await page.waitForFunction(()=>document.body.dataset.page==='details');
        await enterImmediately('practiceBtn','PRACTICE MODE');
        assert.equal(await page.evaluate(()=>state.players.length),0,'End Match retains its established current-match reset');
      }
      await page.waitForTimeout(450);
      assert.equal(await page.locator('#homeLivePrinter').count(),1,'settled Home has one VIDE panel');
      assert.equal(await page.locator('#startGameBtn').count(),1,'settled Home has one Start control');
      assert.equal(await page.evaluate(()=>document.body.dataset.page),'details');
      assert.deepEqual(consoleErrs.filter(e=>e.startsWith('pageerror:')),[],'no uncaught browser error');
      console.log(`PASS VIS-001 ${width}px rapid Practice/Match entry, explicit Back and deferred Home guards`);
    } finally { await browser.close(); }
  }
})().catch(error=>{console.error(error);process.exit(1);});
