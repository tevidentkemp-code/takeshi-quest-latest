const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');
const out=process.env.SQ_SCREENSHOTS||path.join(__dirname,'../../output/playwright/sc037');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const {browser,page,consoleErrs}=await H.launch({width:1920,height:1080});
 try{
  await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page,3);
  const before=await page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,match:state.match}));
  await page.evaluate(()=>window.__sqOpenGameMenu106());
  const row=page.locator('.sq-menu106-bd').getByText(/TV Mode \(Beta\)/,{exact:false}).first();
  assert(await row.isVisible(),'TV Mode menu row missing');
  await row.click();
  await page.waitForSelector('#sqTvModeOverlay');
  assert.equal(await page.locator('#sqTvModeOverlay .sq-tv-player').count(),2);
  assert.equal(await page.locator('#sqTvModeOverlay .sq-tv-table tbody tr').count(),6);
  assert.equal(await page.locator('#sqTvModeOverlay .sq-tv-dart').count(),3);
  await page.screenshot({path:path.join(out,'tv-1920x1080.png')});
  await page.evaluate(()=>{state.score[0][0]={roundTotal:30,darts:[{kind:'T',sector:10,points:30},{kind:'Miss',points:0},{kind:'S',sector:10,points:10}]};state.currentPlayer=1;state.currentDart=0;window.__sqTvModeSync();});
  assert.match(await page.locator('#sqTvDmdMain').textContent(),/BETA TO THROW/);
  assert.equal(await page.locator('#sqTvModeOverlay .sq-tv-player').nth(1).getAttribute('class').then(x=>x.includes('active')),true);
  const during=await page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,match:state.match}));
  await page.click('#sqTvExit'); await page.waitForSelector('#sqTvModeOverlay',{state:'detached'});
  assert(!await page.evaluate(()=>document.body.classList.contains('sq-tv-mode-on')));
  const after=await page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,match:state.match}));
  assert.equal(after,during,'TV close must not mutate game state');
  assert.notEqual(before,during,'fixture score mutation did not apply');
  assert.equal(consoleErrs.filter(x=>x.startsWith('pageerror:')).length,0,JSON.stringify(consoleErrs));
  console.log('SC-037 TV Mode browser acceptance PASS (presentation only; production network blocked)');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
