/** Actual browser -> production transport -> isolated real Supabase acceptance.
 * No command/Auth/PostgREST response mocks. Only the SDK CDN asset is served locally.
 * All data is synthetic in the dedicated local stack; remote APIs are refused.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createClient} from '../ui-smoke/node_modules/@supabase/supabase-js/dist/index.mjs';
const require=createRequire(import.meta.url),{chromium}=require('../ui-smoke/node_modules/playwright');
const config=JSON.parse(fs.readFileSync(process.env.SC004_LOCAL_ENV,'utf8'));
const api=config.API_URL||config.api_url,key=config.ANON_KEY||config.anon_key;
const app=process.env.SQ_APP_URL||'http://127.0.0.1:8127/index.html';
if(api!=='http://127.0.0.1:54821'||new URL(app).origin!=='http://127.0.0.1:8127')throw new Error('Only the isolated SC004 local stack and app are allowed.');
const resultPath=process.env.SC004_BROWSER_RESULTS;
if(!resultPath)throw new Error('SC004_BROWSER_RESULTS is required.');
const authFile=process.env.SC004_BROWSER_AUTH_FILE;
const auth=authFile?JSON.parse(fs.readFileSync(authFile,'utf8')):null;
const read=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const umd=fs.readFileSync(path.resolve('tools/ui-smoke/node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
const run=crypto.randomUUID().slice(0,8).toUpperCase(),results=[],errors=[];
const save=()=>fs.writeFileSync(resultPath,JSON.stringify({captured_at:new Date().toISOString(),environment:'isolated-real-local-supabase-browser',productionWrites:false,responseMocks:false,scoring:'Existing recordThrow engine; UI setup, Finish and actual server receipts',counts:{passed:results.filter(r=>r.pass).length,total:results.length},results,errors},null,2));
const browser=await chromium.launch();
const must=({data,error})=>{if(error)throw error;return data;};
async function context(){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await ctx.addInitScript(({api,key})=>{window.SQ_SECURITY_CONFIG={supabaseUrl:api,publicKey:key,allowLocalFixture:true};},{api,key});
  await ctx.route('**/*',route=>{
    const url=route.request().url();
    if(url.includes('cdn.jsdelivr.net')&&url.includes('supabase'))return route.fulfill({status:200,contentType:'application/javascript',body:umd});
    if(url.startsWith(new URL(app).origin+'/')||url.startsWith(api+'/'))return route.continue();
    return route.abort('failed');
  });
  const page=await ctx.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(String(e.message).slice(0,250)));
  page.on('dialog',d=>d.accept());
  await page.goto(app,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof SQ_SECURITY!=='undefined'&&window.sb&&document.getElementById('startGameBtn'));
  await page.waitForFunction(()=>{const b=document.getElementById('bootSplash');return !b||b.hidden||getComputedStyle(b).display==='none'||getComputedStyle(b).opacity==='0';},{timeout:20000});
  await page.waitForTimeout(700);
  return {ctx,page};
}
async function check(name,fn){let ctx;try{const pair=await context();ctx=pair.ctx;const evidence=await fn(pair.page);results.push({name,pass:true,evidence});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});}finally{if(ctx)await ctx.close();save();console.log((results.at(-1).pass?'PASS ':'FAIL ')+name+(results.at(-1).pass?'':' — '+results.at(-1).message));}}
async function clickPill(page,label){const pill=page.locator('#startGameModalBody .sg-tournament-pill').filter({hasText:label}).first();await pill.click();}
async function openCard(page,variant='classic'){
  await page.click('#startGameBtn');
  if(['practice','shadow'].includes(variant)){await page.click('#practiceBtn');await page.click(variant==='shadow'?'#practiceVsShadowBtn':'#practiceClassicBtn');}
  else{await page.click('#questBtn');await page.click(variant==='turbo'?'#matchTurboBtn':'#matchClassicBtn');}
  await page.waitForSelector('#msAddRegisteredBtn',{state:'visible'});
}
async function selectSaved(page,names){
  await page.click('#msAddRegisteredBtn');await page.waitForSelector('.sp2-row');
  for(const name of names){await page.fill('#spSearchInput',name);await page.locator('.sp2-row').filter({hasText:name}).first().click();}
  await page.click('#confirmSelectPlayerBtn');
}
async function guest(page,name){await page.click('#msAddGuestBtn');const input=page.locator('#msPlayersList input').last();await input.fill(name);await input.press('Enter');}
async function start(page,games=1,shadow=false){
  await page.click('#startMatchBtn');await page.locator('#mlGrid .mlw-seg[data-value="'+games+'"]').click();await page.click('#mlStartBtn');
  if(shadow)return;
  await page.locator('.modal-throworder button').filter({hasText:/START GAME/i}).first().click();
  await prepared(page);
}
async function prepared(page){
  await page.waitForFunction(()=>document.body.dataset.page==='game'&&!!state.__sqGameControl&&!state.__sqSecurityPreparing&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true',{timeout:25000});
  await page.waitForTimeout(200);
  if(await page.locator('.sq-turbo-ready-start').count())await page.locator('.sq-turbo-ready-start').click();
}
async function score(page,strong){
  // Invoke the exact engine entry used by the pad. No test scorer or board replacement.
  await page.evaluate(name=>{for(let i=0;i<250&&!state.finished;i++){
    const def=ROUNDS[state.currentRound],hit=state.players[state.currentPlayer].name===name;
    recordThrow(!hit?{kind:'Miss'}:def.type==='number'?{kind:'S'}:def.type==='bull'?{kind:'B',bull:'Inner'}:{kind:def.type==='doubles'?'Double':'Triple',sector:20});
  }},strong);
  assert(await page.evaluate(()=>state.finished),'Canonical scoring did not finish the game.');
  const finish=page.locator('.sq-gamecomplete-backdrop button').filter({hasText:/LEADERBOARD/i}).first();
  if(await finish.count())await finish.click();else await page.evaluate(()=>awardAndShowLeaderboard());
  await page.waitForFunction(()=>state.gameAwarded&&state.__sqAcceptedGameReceipt,{timeout:25000});
  return page.evaluate(()=>({receipt:state.__sqAcceptedGameReceipt,board:state.__sqCompletionSnapshot.state.board,totals:state.__sqCompletionSnapshot.totals,mode:state.__sqCompletionSnapshot.state.mode,matchHistory:state.match.history.length,wins:state.match.wins,players:state.__sqCompletionSnapshot.state.players,stats:state.__sqCompletionSnapshot.state.stats}));
}
async function storedGame(e){const rows=must(await read.from('games').select('id,match_id,game_number,state,totals').eq('id',e.receipt.game_id));assert.equal(rows.length,1);assert.deepEqual(rows[0].totals,e.totals);assert.deepEqual(rows[0].state.board,e.board);return rows[0];}
let players=[];
await check('Create-only registration works through the existing UI and real Edge',async page=>{
  await openCard(page);
  for(const suffix of ['A','B','C','D']){
    await page.click('#msRegisterPlayerBtn');await page.fill('#newPlayerFirst','SC004'+run+suffix);await page.fill('#newPlayerLast','Browser');await page.fill('#newPlayerInitials',suffix);await page.click('#savePlayerBtn');await page.waitForSelector('#addPlayerModal',{state:'hidden',timeout:25000});
  }
  players=must(await read.from('players').select('id,name').like('name','SC004'+run+'%'));
  assert.equal(players.length,4);assert(players.every(p=>/^[0-9a-f-]{36}$/i.test(p.id)));
  return {created:players.length};
});
await check('Official Match accepts the full canonical board once and reload resumes its issued scope',async page=>{
  assert.equal(players.length,4);await openCard(page);await selectSaved(page,players.slice(0,2).map(p=>p.name));await start(page,3);
  const initial=await page.evaluate(()=>state.__sqGameControl);
  await page.evaluate(()=>{recordThrow({kind:'S'});save();});await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#resumeBtn',{state:'visible'});await page.click('#resumeBtn');await prepared(page);
  assert.equal(await page.evaluate(()=>state.__sqGameControl.game_id),initial.game_id);assert.equal(await page.evaluate(()=>state.history.length),1);
  const e=await score(page,players[0].name),row=await storedGame(e);assert.equal(row.state.mode,'official');assert.equal(e.matchHistory,1);assert.equal(e.wins.reduce((s,n)=>s+n,0),1);
  await page.evaluate(()=>awardAndShowLeaderboard());assert.equal(await page.evaluate(()=>state.match.history.length),1);
  const hs=must(await read.from('high_scores_sp').select('game_id').eq('game_id',row.id));assert.equal(hs.length,1);
  return {game_id:row.id,mode:row.state.mode,acceptedGames:1,eligibleHighScores:hs.length};
});
await check('Guest Match uses Practice series and late join/restart retain the issued pending game',async page=>{
  await openCard(page);await selectSaved(page,[players[0].name]);await guest(page,'Guest '+run);await start(page,3);
  const gameId=await page.evaluate(()=>state.__sqGameControl.game_id);
  await page.evaluate(async name=>{recordThrow({kind:'S'});await window.__sqAppendLatePlayer({name},'guest');},'Late '+run);
  assert.equal(await page.evaluate(()=>state.players.length),3);
  await page.evaluate(()=>restartGame());await page.waitForFunction(()=>!state.__sqSecurityPreparing);
  assert.equal(await page.evaluate(()=>state.__sqGameControl.game_id),gameId);
  const e=await score(page,players[0].name),row=await storedGame(e);assert.equal(row.state.mode,'practice');assert.equal(e.wins.reduce((s,n)=>s+n,0),1);
  assert.equal(must(await read.from('high_scores_sp').select('game_id').eq('game_id',row.id)).length,0);
  return {game_id:row.id,mode:row.state.mode,players:row.state.players.length};
});
for(const guests of [false,true])await check('Turbo '+(guests?'guest':'saved')+' Match persists Turbo provenance without early-round scores',async page=>{
  await openCard(page,'turbo');if(guests){await guest(page,'Turbo A '+run);await guest(page,'Turbo B '+run);}else await selectSaved(page,players.slice(0,2).map(p=>p.name));
  await start(page);assert.equal(await page.evaluate(()=>state.currentRound),7);const strong=await page.evaluate(()=>state.players[0].name);
  const e=await score(page,strong),row=await storedGame(e);assert.equal(row.state.mode,'turbo');assert.equal(row.state.startTarget,'17');assert.equal(row.state.throwLimitSeconds,20);assert(row.state.board.every(b=>b.slice(0,7).every(r=>r.roundTotal===0)));
  return {game_id:row.id,mode:row.state.mode,guest:guests};
});
await check('Solo Practice uses one real player and preserves the canonical result',async page=>{
  await openCard(page,'practice');await selectSaved(page,[players[0].name]);await start(page);const e=await score(page,players[0].name),row=await storedGame(e);assert.equal(row.state.mode,'practice');assert.equal(row.state.players.length,1);return {game_id:row.id,mode:row.state.mode};
});
for(const kind of ['CLASSIC','TURBO'])await check(kind+' Tournament UI reaches a real issued match and accepts canonical completion',async page=>{
  await page.click('#startGameBtn');await page.click('#tournamentBtn');await clickPill(page,kind);await clickPill(page,'4 PLAYERS');
  for(const p of players)await page.locator('.sg-tournament-player').filter({hasText:p.name}).first().click();
  await page.locator('#startGameModalBody .modal-footer button.primary').click();await page.getByRole('button',{name:'START TOURNAMENT',exact:true}).click();
  await page.locator('.modal-throworder button').filter({hasText:/START GAME/i}).first().click();await prepared(page);
  const name=await page.evaluate(()=>state.players[0].name),e=await score(page,name),row=await storedGame(e);assert.equal(row.state.tournament,true);assert.equal(row.state.tournamentType,kind.toLowerCase());assert.equal(row.state.mode,kind==='TURBO'?'turbo':'official');return {game_id:row.id,type:row.state.tournamentType};
});
for(const kind of ['STANDARD','TDB','SELECT'])await check(kind+' Training uses its own issued scope and saves real pad aggregates',async page=>{
  await page.click('#startGameBtn');await page.click('#trainingBtn');await clickPill(page,players[0].name.toUpperCase());await clickPill(page,kind);
  if(kind==='SELECT'){await page.locator('.tr-sel-sec').filter({hasText:'DOUBLE'}).click();await page.locator('.tr-sel-num').filter({hasText:/^15$/}).click();await page.locator('#startGameModalBody .modal-footer button.primary').click();}
  await clickPill(page,'10 ROUNDS');await page.waitForSelector('.tr-overlay .tr-pad');
  const id=await page.evaluate(()=>window.__sqTrainingControl.training_id);
  for(let i=0;i<10;i++){await page.evaluate(()=>{for(let d=0;d<3;d++){const buttons=document.querySelectorAll('.tr-overlay .tr-pad button');buttons[buttons.length-1]?.click();}});await page.waitForTimeout(650);}
  await page.waitForSelector('.tr-summary',{timeout:25000});
  const rows=must(await read.from('training_sessions').select('id,mode,rounds_played,total_darts,total_points,results').eq('id',id));assert.equal(rows.length,1);assert.equal(rows[0].rounds_played,10);assert.equal(rows[0].total_darts,30);assert.equal(rows[0].mode,kind.toLowerCase());assert.equal(rows[0].total_points,rows[0].results.reduce((s,r)=>s+r.points,0));return {training_id:id,rounds:10,darts:30};
});
await check('Actual enrolled Auth sign-in grants browser admin status; public read client remains anonymous',async page=>{
  assert(auth?.email&&auth?.password,'Actual protected synthetic Auth credentials are required.');
  await page.evaluate(()=>{window.__sc004AdminPromise=window.SQ_ADMIN_AUTH.require();});await page.waitForSelector('#sqAdminSignInOverlay');await page.fill('#sqAdminEmail',auth.email);await page.fill('#sqAdminPassword',auth.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForSelector('#sqAdminSignInOverlay',{state:'detached',timeout:25000});
  assert.equal(await page.evaluate(async()=>{await window.__sc004AdminPromise;return (await SQ_SECURITY.admin({operation:'status'})).ok;}),true);
  assert.equal(await page.evaluate(async()=>(await sb.auth.getSession()).data.session),null);await page.evaluate(()=>SQ_ADMIN_AUTH.signOut());return {permanentAuth:true,readClientAnonymous:true};
});
await browser.close();save();if(results.some(r=>!r.pass)||errors.length)process.exitCode=1;
