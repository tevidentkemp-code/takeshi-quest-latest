// SC-071 shared menu contract. Offline fixtures exercise the real menu and
// eligibility functions. The separate unchanged Turbo suite owns real-time QA.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');
const modes=['classic','turbo','practice','vsshadow','tournament-classic','tournament-turbo'];
let checks=0,phase='boot';
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
async function seedMode(page,mode,base){
 await page.evaluate(({mode,base})=>{
   state=JSON.parse(base);window.__sqTournamentDraft=null;
   state.match.mode=mode.includes('turbo')?'turbo':mode==='practice'||mode==='vsshadow'?'practice':'classic';
   state.match.gameMode=state.match.mode;state.gameMode=state.match.mode;
   if(mode==='vsshadow')state.match.practiceType='vsshadow';
   if(mode.startsWith('tournament-'))state.match.tournamentType=mode.endsWith('turbo')?'turbo':'classic';
   window.cloudListPlayers=async()=>[];
 },{mode,base});
}
async function modeCase(page,mode,width,base){
 phase=mode+'/'+width;
 await page.setViewportSize({width,height:844});
 await page.emulateMedia({reducedMotion:width===390?'reduce':'no-preference'});
 await seedMode(page,mode,base);
 const truth=await page.evaluate(()=>({turbo:__sqIsTurboVisualRuntime(),shadow:__sqIsVsShadowRuntime(),gate:__sqLateJoinEligibility()}));
 assert.equal(truth.turbo,mode.includes('turbo'));assert.equal(truth.shadow,mode==='vsshadow');checks+=2;
 const before=await snapshot(page);
 await open(page);await shape(page,0);
 const labels=await page.locator(menu+' .sq-menu106-label').allTextContents();
 assert.deepEqual(labels,['Stats','TV Mode (Beta)','Add Player','Match Display','Remove Player','Amend Initial Order','Restart Game','End Game','End Match']);checks++;
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
   await confirm.waitFor();check(await confirm.count()===1,action+' retains one confirmation');
   await confirm.locator('.sq-endmatch-no').click();check(await confirm.count()===0,action+' cancellation closes confirmation');
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
 const errors=[],events=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')events.push({phase,message:m.text()});});
 try{
   await H.boot(page,{settle:1000});await H.toMatchCard(page);await H.addGuests(page,['ALPHA','BETA']);await H.startMatch(page,3);
   await page.waitForFunction(()=>!window.__sqSecurityInputBlocked&&!document.querySelector('.sq-throw-order-reveal'));
   const base=await page.evaluate(()=>JSON.stringify(state));
   // A complete menu walk can exceed the canonical 20-second visit. Freeze
   // only this fixture's elapsed-time source, not game logic or browser timers.
   // The unchanged verify-sc067-turbo-identity.js runs in fresh real-time contexts.
   await page.evaluate(()=>{const at=performance.now();window.__sc071PerformanceDescriptor=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>at});});
   if(process.env.SC071_BASELINE==='1'){
     // Read-only diagnostic on unchanged main before the expected Back failure.
     for(const mode of modes)for(const width of [320,390,430]){
       phase='baseline/'+mode+'/'+width;await page.setViewportSize({width,height:844});
       await seedMode(page,mode,base);await open(page);await page.waitForTimeout(100);await close(page);await page.waitForTimeout(100);
     }
     console.log('SC071_BASELINE_CONSOLE='+JSON.stringify(events));
     await open(page);await shape(page,0);throw new Error('Baseline unexpectedly accepted');
   }
   for(const mode of modes)for(const width of [320,390,430])await modeCase(page,mode,width,base);
   for(const value of ['0','1']){
     phase='beta-setting/'+value;
     await page.evaluate(v=>localStorage.setItem('sq_livev3_test',v),value);
     await open(page);check(await row(page,'New Layout').count()===0,'no beta entry for either stored setting');await close(page);
     assert.equal(await page.evaluate(()=>localStorage.getItem('sq_livev3_test')),value);checks++;
   }
   phase='home-stats';
   // Use the actual navigation owner: a body attribute alone leaves the game
   // visible under Home styling and produced resize-observer errors in the fixture.
   await page.evaluate(()=>{localStorage.removeItem('sq_livev3_test');navigateToStartScreen();});
   await page.waitForFunction(()=>document.body.dataset.page==='details'&&getComputedStyle(document.getElementById('game')).display==='none');
   await page.evaluate(()=>window.openStatsHubDialog());
   await shape(page,0);await close(page);
   assert.deepEqual(errors,[],'no uncaught runtime errors');checks++;
   const unexpected=consoleErrs.filter(e=>!(/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|connect-src|Load failed/i.test(e)));
   if(unexpected.length)console.log('SC071_CONSOLE_PROVENANCE='+JSON.stringify(events));
   assert.deepEqual(unexpected,[],'no unexpected console errors');checks++;
   console.log(`PASS SC071 ${checks} assertions (${process.env.SQ_BROWSER||'chromium'})`);
 }finally{
   console.log('SC071_FINAL_PHASE='+phase);
   await page.evaluate(()=>{const d=window.__sc071PerformanceDescriptor;if(d)Object.defineProperty(performance,'now',d);else delete performance.now;}).catch(()=>{});
   await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
