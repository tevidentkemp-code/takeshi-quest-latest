const assert=require('node:assert/strict');
const H=require('./harness');
(async()=>{
 const {browser,page,consoleErrs}=await H.launch({width:1920,height:1080});
 try{
  await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page,3);
  const before=await page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,match:state.match}));
  assert.equal(await page.evaluate(()=>window.__sqTvModeIsAvailable&&window.__sqTvModeIsAvailable()),false,'TV Mode should be parked');
  await page.evaluate(()=>window.__sqOpenGameMenu106());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.sq-menu106-row .sq-menu106-label').filter({hasText:/TV Mode \(Beta\)/}).count(),0,'parked TV Mode must not appear in Game Menu');
  const direct=await page.evaluate(()=>window.__sqTvModeToggle&&window.__sqTvModeToggle(true));
  assert.equal(direct,false,'direct activation must be refused while parked');
  assert.equal(await page.locator('#sqTvModeOverlay').count(),0,'parked TV Mode must not create an overlay');
  const after=await page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,match:state.match}));
  assert.equal(after,before,'parking TV Mode must not mutate game state');
  assert.equal(consoleErrs.filter(x=>x.startsWith('pageerror:')).length,0,JSON.stringify(consoleErrs));
  console.log('SC-037 parked-state acceptance PASS: hidden from Game Menu, direct activation blocked, game state unchanged.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
