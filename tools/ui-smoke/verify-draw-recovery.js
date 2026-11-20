// Runs entirely against the existing offline browser and game-control fixture.
const assert = require('node:assert/strict');
const H = require('./harness');

(async () => {
  const { page, ctx, browser } = await H.launch({width:390, height:844});
  try {
    await ctx.route('**.supabase.co/rest/v1/**', route => route.fulfill({
      status:200, contentType:'application/json', body:'[]',
      headers:{'access-control-allow-origin':'*', 'content-range':'*/0'}
    }));
    await H.boot(page);
    await page.evaluate(async () => {
      state.players = ['Alpha','Bravo','Charlie'].map(name => ({name,id:crypto.randomUUID()}));
      setSavedPlayers(state.players.map(p => ({...p,_src:'cloud-cache'})));
      state.match.mode='official';
      state.match.targetWins=3;
      await startNewGame(true);
    });
    await page.waitForFunction(() => document.body.dataset.page === 'game' && window.SQ_GAMEPLAY.canThrow());
    await page.evaluate(() => {
      for (let i=0; i<126; i++) recordThrow({kind:'Miss'});
    });
    const modal = page.getByRole('dialog',{name:'Draw decider shootout'});
    const action = name => modal.locator('[data-act="'+name+'"]');
    await modal.waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => state.__sqGameControl.mode),'official');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).history.length),126);
    await modal.getByRole('button',{name:'Close decider'}).click();
    await page.getByRole('button',{name:'Resume Decider'}).click();
    await modal.waitFor({state:'visible'});
    await modal.locator('[data-kind="T"]').click();
    await modal.locator('[data-decider-sector="20"]').click();
    assert.deepEqual(await page.evaluate(() => state._decider.totals),[60,0,0]);
    await page.reload();
    await page.locator('#resumeBtn').click();
    await modal.waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(() => [state._decider.dart,...state._decider.totals]),[1,60,0,0]);
    await action('skip').click();
    await modal.locator('[data-kind="T"]').click();
    await modal.locator('[data-decider-sector="20"]').click();
    // Finish Bravo's first visit, then Charlie's, then all three remaining rounds.
    for (let i=0; i<11; i++) await action('skip').click();
    await page.waitForFunction(() => state._decider.repeat && !state._decider.hold);
    assert.deepEqual(await page.evaluate(() => state._decider.participants),[0,1]);
    assert.equal(await page.evaluate(() => !!state.__sqAcceptedGameReceipt),false);
    await action('skip').click();
    await modal.locator('[data-decider-sector="20"]').click();
    for(let i=0; i<7; i++) await action('skip').click();
    const result=page.locator('.sq-shootoutcomplete-backdrop');
    await result.waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => state._decider.winner),1);
    await result.getByRole('button',{name:'Close'}).click();
    await page.getByRole('button',{name:'Finish Game → Leaderboard'}).click();
    await page.waitForFunction(() => state.gameAwarded && document.body.dataset.page==='leaderboard');
    const outcome = await page.evaluate(() => ({
      wins:state.match.wins, totals:state.match.history[0].totals, games:state.match.history.length
    }));
    assert.deepEqual(outcome,{wins:[0,1,0],totals:[0,0,0],games:1});
    console.log('PASS automatic decider, Close and Resume, refresh, any-number triple, three-way narrowing, repeat and single award');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
