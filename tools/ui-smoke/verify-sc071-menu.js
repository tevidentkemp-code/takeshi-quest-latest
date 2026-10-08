// SC-071 shared menu contract. All network traffic uses the existing offline
// harness; mode fixtures exercise the real menu/eligibility functions, not a
// second menu implementation. Native mode journeys remain in release QA.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');
const modes=['classic','turbo','practice','vsshadow','tournament-classic','tournament-turbo'];
let checks=0;
function check(ok,label){assert(ok,label);checks++;}
const menu='.sq-menu106-modal';
const row=(page,label)=>page.locator(menu+' .sq-menu106-row').filter({has:page.locator('.sq-menu106-label',{hasText:new RegExp('^'+label+'$')})});
async function open(page){await page.evaluate(()=>window.__sqOpenGameMenu106());await page.locator(menu).waitFor();}
async function close(page){await page.locator(menu+' .sq-menu106-x').click();await page.locator(menu).waitFor({state:'detached'});}
async function title(page,text){assert.equal(await page.locator(menu+' .sq-menu106-title').textContent(),text);checks++;}
async function sameState(page,before,label){assert.equal(await snapshot(page),before,label);checks++;}
async function snapshot(page){return page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,history:state.history,match:state.match,currentRound:state.currentRound,currentPlayer:state.currentPlayer,currentDart:state.currentDart}));}
async function shape(page,back){
 const got=await page.locator(menu).evaluate(m=>{const r=m.getBoundingClientRect();return {inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,back:m.querySelectorAll('.sq-menu106-back').length,targets:Array.from(m.querySelectorAll('.sq-menu106-back,.sq-menu106-x,.sq-menu106-close')).map(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;}),icons:Array.from(m.querySelectorAll('.sq-menu106-ico')).every(i=>i.getAttribute('aria-hidden')==='true'&&i.querySelector('svg[aria-hidden="true"][focusable="false"]'))};});
 assert.equal(got.back,back,'SC071_BACK_OWNER: exactly one genuine Back or none at root');checks++;
 check(got.inside&&got.targets.every(Boolean),'menu and 44px navigation stay inside mobile viewport');
 check(got.icons,'fixed decorative SVGs replace emoji action imagery');
}
async function modeCase(page,mode,width,base){
 await page.setViewportSize({width,height:844});
 await page.emulateMedia({reducedMotion:width===390?'reduce':'no-preference'});
 await page.evaluate(({mode,base})=>{
   // Synthetic mode-only navigation fixture: hold Turbo at its real READY
   // gate, before the visit clock legally starts. Existing SC-076/077 suites
   // separately test native 20-second expiry and timer perimeter.
   window.__sqTurboPreStartArmed=mode.includes('turbo');
   window.__sqTurboPreStartReleased=!mode.includes('turbo');
   window.__sqTurboPreStartShowing=mode.includes('turbo');
   state=JSON.parse(base);window.__sqTournamentDraft=null;
   state.match.mode=mode.includes('turbo')?'turbo':mode==='practice'||mode==='vsshadow'?'practice':'classic';
   state.match.gameMode=state.match.mode;state.gameMode=state.match.mode;
   if(mode==='vsshadow')state.match.practiceType='vsshadow';
   if(mode.startsWith('tournament-'))state.match.tournamentType=mode.endsWith('turbo')?'turbo':'classic';
   window.cloudListPlayers=async()=>[];
 },{mode,base});
 const truth=await page.evaluate(()=>({turbo:__sqIsTurboVisualRuntime(),shadow:__sqIsVsShadowRuntime(),gate:__sqLateJoinEligibility()}));
 assert.equal(truth.turbo,mode.includes('turbo'));assert.equal(truth.shadow,mode==='vsshadow');checks+=2;
 const before=await snapshot(page);
 await open(page);await shape(page,0);
 const labels=await page.locator(menu+' .sq-menu106-label').allTextContents();
 assert.deepEqual(labels,['Stats','TV Mode (Beta)','Add Player','Remove Player','Match Display','Amend Initial Order','Restart Game','End Game','End Match']);checks++;
 check(!labels.some(x=>/New Layout/.test(x)),'experimental menu entry absent');
 await sameState(page,before,'opening menu does not mutate game state');
 await page.evaluate(()=>window.__sqOpenGameMenu106());
 check(await page.locator(menu).count()===1,'reopening cannot duplicate menu');
 check(await page.evaluate(()=>window.__sqModalStack.filter(x=>document.contains(x.overlay)&&x.overlay.classList.contains('sq-menu106-bd')).length===1),'one live shared-stack entry');
 if(process.env.SQ_SCREENSHOTS){fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`sc071-${mode}-${width}.png`)});}
 await row(page,'Stats').click();await title(page,'Player Stats');await shape(page,1);
 await page.locator(menu+' .sq-menu106-back').click();await title(page,'Game Menu');
 await row(page,'Match Display').click();await title(page,'Match Display');await shape(page,1);
 await page.locator(menu+' .sq-menu106-row').first().click();await title(page,'Match Initials');await shape(page,1);
 await page.locator(menu+' .sq-menu106-back').click();await title(page,'Match Display');
 await page.locator(menu+' .sq-menu106-back').click();await title(page,'Game Menu');
 await row(page,'Remove Player').click();await title(page,'Remove Player');await shape(page,1);
 await page.locator(menu+' .sq-menu106-back').click();await title(page,'Game Menu');
 await row(page,'Add Player').click();
 if(truth.gate.ok){
   await title(page,'Add Player');await shape(page,1);
   await row(page,'Guest Player').click();await title(page,'Add Guest Player');await shape(page,1);
   await page.locator('#sqLateGuestName').fill('NAME <safe> & literal');
   check(await page.locator(menu+' safe').count()===0,'name stays input text');
   await page.locator(menu+' .sq-menu106-back').click();await title(page,'Add Player');
   await page.locator(menu+' .sq-menu106-back').click();await title(page,'Game Menu');
 }else{await title(page,'Game Menu');check(!truth.gate.ok,'mode-specific late-entry gate remains denied');}
 for(const action of ['Restart Game','End Game','End Match']){
   await row(page,action).click();
   const confirm=page.locator('.sq-confirm-bd');
   if(await confirm.count()){await confirm.locator('.sq-endmatch-no').click();check(await confirm.count()===0,action+' cancellation closes confirmation');}
   await open(page);
 }
 await close(page);await sameState(page,before,'menu/back/cancel preserves canonical scores, identity and cursor');
 for(const method of ['footer','escape','backdrop']){
   await open(page);await row(page,'Stats').click();
   if(method==='footer')await page.locator(menu+' .sq-menu106-close').click();
   if(method==='escape')await page.keyboard.press('Escape');
   if(method==='backdrop')await page.locator('.sq-menu106-bd').click({position:{x:1,y:1}});
   check(await page.locator(menu).count()===0,method+' exits without reopening parent');
 }
 console.log(`PASS SC071 mode fixture ${mode} / ${width}: icons, Back/Close, guards, cancellation and state`);
}
(async()=>{
 const {browser,page,consoleErrs}=await H.launch();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
   await H.boot(page,{settle:1000});await H.toMatchCard(page);await H.addGuests(page,['ALPHA','BETA']);await H.startMatch(page,3);
   await page.waitForFunction(()=>!window.__sqSecurityInputBlocked&&!document.querySelector('.sq-throw-order-reveal'));
   const base=await page.evaluate(()=>JSON.stringify(state));
   if(process.env.SC071_BASELINE==='1'){await open(page);await shape(page,0);throw new Error('Baseline unexpectedly accepted');}
   // SC-071 CI shard split: same six modes x three widths, no skipped assertions.
   const shard=process.env.SQ_SC071_SHARD||'all';
   const cases=shard==='a'?modes.slice(0,3):shard==='b'?modes.slice(3):shard==='all'?modes:null;
   assert(cases,'SC071 shard must be a, b or all');
   for(const mode of cases)for(const width of [320,390,430])await modeCase(page,mode,width,base);
   for(const value of ['0','1']){
     await page.evaluate(v=>localStorage.setItem('sq_livev3_test',v),value);
     await open(page);check(await row(page,'New Layout').count()===0,'no beta entry for either stored setting');await close(page);
     assert.equal(await page.evaluate(()=>localStorage.getItem('sq_livev3_test')),value);checks++;
   }
   await page.evaluate(()=>{window.__sqTurboPreStartArmed=false;window.__sqTurboPreStartReleased=true;window.__sqTurboPreStartShowing=false;localStorage.removeItem('sq_livev3_test');navigateToStartScreen();});
   await page.waitForFunction(()=>document.body.dataset.page==='details');
   await page.evaluate(()=>window.openStatsHubDialog());
   await shape(page,0);await close(page);
   assert.deepEqual(errors,[],'no uncaught runtime errors');checks++;
   // Forced 320/390/430 resizes can generate the browser's own ResizeObserver
   // delivery-loop notice; preserve strict checks for every other console error.
   const resizeNotice=/^\[SQ\] error: ResizeObserver loop completed with undelivered notifications\. ErrorEvent$/;
   const notices=consoleErrs.filter(e=>resizeNotice.test(e));
   const unexpected=consoleErrs.filter(e=>!resizeNotice.test(e)&&!(/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|connect-src|Load failed/i.test(e)));
   assert.deepEqual(unexpected,[],'no unexpected console errors');checks++;
   console.log('SC071 browser ResizeObserver notices during deliberate viewport changes: '+notices.length);
   console.log(`PASS SC071 ${checks} assertions (${process.env.SQ_BROWSER||'chromium'})`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
