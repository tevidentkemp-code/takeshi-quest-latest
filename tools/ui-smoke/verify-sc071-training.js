// SC-071: Training has its own navigation, not the Game Menu. Exercise each
// native setup and Quit/Resume path with the existing offline security fixture.
const assert=require('node:assert/strict');
const H=require('./harness');
let checks=0;
(async()=>{
 const {browser,page,consoleErrs}=await H.launch();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await H.boot(page,{settle:1000});
  await page.evaluate(()=>{window.__sqLoadPlayerStatsPlayers=async()=>[{id:'00000000-0000-4000-8000-000000000071',name:'MENU TRAINEE',initials:'MT'}];});
  for(const mode of ['STANDARD','TDB','SELECT'])for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   await page.click('#startGameBtn');await page.click('#trainingBtn');
   const body=page.locator('#startGameModalBody');
   const pill=text=>body.locator('.sg-tournament-pill').filter({has:page.locator('.sg-tournament-pill-title',{hasText:new RegExp('^'+text+'$')})});
   await pill('MENU TRAINEE').click();await pill(mode).click();
   if(mode==='SELECT'){await body.locator('.tr-sel-num').filter({hasText:/^20$/}).click();await body.locator('.modal-footer button.primary').click();}
   assert.equal(await body.locator('.ms2-back:visible').count(),1,'one Training step Back');checks++;
   await body.locator('.ms2-back').click();
   if(mode==='SELECT')await body.locator('.modal-footer button.primary').click();else await pill(mode).click();
   await pill('10 ROUNDS').click();
   try {
     await page.locator('.tr-overlay').waitFor();
   } catch(error) {
     const state=await page.evaluate(()=>({
       page:document.body.dataset.page,
       setupTitle:document.querySelector('#startGameModalBody .sg-tournament-title')?.textContent,
       overlayCount:document.querySelectorAll('.tr-overlay').length,
       modalOpen:!document.getElementById('startGameModal')?.classList.contains('hidden'),
       toastText:[...document.querySelectorAll('.toast,.sq-toast,.toast-msg')].map(n=>n.textContent).slice(-5),
       securityReady:typeof window.SQ_SECURITY?.createTraining,
       gameplayReady:typeof window.SQ_GAMEPLAY?.failure
     }));
     console.error('SC071_TRAINING_START_DIAGNOSTIC='+JSON.stringify({mode,width,...state}));
     if(process.env.SQ_SCREENSHOTS)await page.screenshot({path:require('node:path').join(process.env.SQ_SCREENSHOTS,`sc071-training-failed-${mode}-${width}.png`)}).catch(()=>{});
     throw error;
   }
   assert.match(await page.locator('.tr-mode').textContent(),new RegExp(mode));checks++;
   assert.equal(await page.locator('.sq-menu106-modal').count(),0,'Training does not gain an unrelated menu');checks++;
   await page.locator('.tr-pad button').last().click();
   await page.locator('.tr-quit').click();await page.locator('.tr-confirm.on').waitFor();
   await page.locator('.tr-confirm-no').click();
   assert.equal(await page.locator('.tr-overlay').count(),1,'Resume keeps Training active');checks++;
   assert.equal(await page.locator('.tr-confirm.on').count(),0,'Resume closes only quit confirmation');checks++;
   await page.locator('.tr-quit').click();await page.locator('.tr-confirm-yes').click();
   await page.locator('.tr-overlay').waitFor({state:'detached'});
   console.log(`PASS SC071 native Training ${mode} / ${width}: Back, Quit, Resume, confirmed exit`);
  }
  assert.deepEqual(errors,[],'no Training runtime errors');checks++;
  const unexpected=consoleErrs.filter(e=>!(/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|connect-src|Load failed/i.test(e)));
  assert.deepEqual(unexpected,[],'no unexpected Training console errors');checks++;
  console.log(`PASS SC071 Training ${checks} assertions (${process.env.SQ_BROWSER||'chromium'})`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
