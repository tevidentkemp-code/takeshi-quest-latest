const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');

const out = process.env.SQ_SCREENSHOTS || path.join(__dirname,'../../output/playwright/sc037');
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:1920,height:1080});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot']);
    await H.startMatch(page,3);

    await page.waitForSelector('#sqTvModeBtn');
    assert(await page.locator('#sqTvModeBtn').isVisible(),'TV button must be visible in live game');

    await page.click('#sqTvModeBtn');
    await page.waitForSelector('#sqTvModeOverlay');

    assert(await page.evaluate(()=>document.body.classList.contains('sq-tv-mode')),'body must enter TV mode');
    assert.equal(await page.locator('#sqTvModeOverlay .sq-tv-player').count(),6,'TV mode must support six players');
    assert.equal(await page.locator('#sqTvModeOverlay .sq-tv-table thead th').count(),7,'scoreboard must contain target + six player columns');
    assert(await page.locator('#padBar').isVisible(),'canonical score pad must remain visible');

    const before = await page.evaluate(()=>({
      round:state.currentRound,
      player:state.currentPlayer,
      dart:state.currentDart,
      total:state.score[0][0]?.roundTotal||0
    }));

    await page.locator('#pad [data-score-label="Single"]').click();
    await page.waitForTimeout(400);

    const after = await page.evaluate(()=>({
      round:state.currentRound,
      player:state.currentPlayer,
      dart:state.currentDart,
      total:state.score[0][0]?.roundTotal||0
    }));

    assert.equal(after.round,before.round,'single TV-mode throw stays in round');
    assert.equal(after.player,before.player,'single TV-mode throw stays with player');
    assert.equal(after.dart,before.dart+1,'canonical pad must still record a dart');
    assert(after.total>before.total,'canonical score must increase');

    const activeTotal=(await page.locator('#sqTvModeOverlay .sq-tv-player.is-active .sq-tv-player-score').first().textContent()).trim();
    assert.equal(activeTotal,String(after.total),'TV total must update from canonical state');
    const nextRoundCell=(await page.locator('#sqTvModeOverlay .sq-tv-table tbody tr').nth(1).locator('td').nth(1).textContent()).trim();
    assert.equal(nextRoundCell,'—','future unplayed rounds must remain visually empty');

    await page.screenshot({path:path.join(out,'tv-1920x1080.png'),fullPage:false});

    await page.setViewportSize({width:844,height:1100});
    await page.waitForTimeout(300);
    assert(await page.locator('#sqTvModeOverlay .sq-tv-rotate').isVisible(),'portrait TV mode must show rotate prompt');

    await page.setViewportSize({width:1920,height:1080});
    await page.waitForTimeout(300);
    assert(!(await page.locator('#sqTvModeOverlay .sq-tv-rotate').isVisible()),'landscape restores TV dashboard');

    await page.click('#sqTvExitBtn');
    assert(!(await page.evaluate(()=>document.body.classList.contains('sq-tv-mode'))),'exit must restore normal mode');
    assert.equal(await page.locator('#sqTvModeOverlay').count(),0,'TV overlay must detach on exit');
    assert.equal(await page.evaluate(()=>state.score[0][0]?.roundTotal||0),after.total,'exit must preserve game state');

    const pageErrors=consoleErrs.filter(x=>x.startsWith('pageerror:'));
    assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));

    console.log('SC-037 provisional TV Mode PASS: 6-player landscape, canonical scoring pad, live sync, portrait guard and lossless exit');
  }finally{
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exit(1);});
