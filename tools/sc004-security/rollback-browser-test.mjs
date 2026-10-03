/** Real browser cache handoff across an actual compatible app restoration.
 * Run prepare against the candidate at 8127, then recovered after replacing
 * that server with the frozen compatible artifact at the same origin.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '../ui-smoke/node_modules/@supabase/supabase-js/dist/index.mjs';
const require=createRequire(import.meta.url),{chromium}=require('../ui-smoke/node_modules/playwright');
const phase=process.argv[2],expectedPhases=['prepare','recovered'];
if(!expectedPhases.includes(phase))throw new Error('Expected prepare or recovered.');
const manifestPath=process.env.SC004_ROLLBACK_MANIFEST;
if(!manifestPath)throw new Error('SC004_ROLLBACK_MANIFEST is required.');
const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes),anchorRoot=path.dirname(path.resolve(manifestPath));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.match(manifest.candidate_head||'',/^[a-f0-9]{40}$/,'Frozen candidate HEAD is required.');
assert(manifest.files&&typeof manifest.files==='object','Frozen file manifest is required.');
for(const [file,hash] of Object.entries(manifest.files)){
  const target=path.resolve(anchorRoot,file);
  assert(target.startsWith(anchorRoot+path.sep),'Frozen file must remain inside the anchor.');
  assert.match(hash,/^[a-f0-9]{64}$/,'Invalid frozen file digest.');
  assert.equal(sha256(fs.readFileSync(target)),hash,'Frozen artifact mismatch: '+file);
}
assert.match(manifest.files['app/index.html']||'',/^[a-f0-9]{64}$/,'Frozen app index digest is required.');
const anchor={candidate_head:manifest.candidate_head,manifest_sha256:sha256(manifestBytes)};
const config=JSON.parse(fs.readFileSync(process.env.SC004_LOCAL_ENV,'utf8'));
const api=config.API_URL||config.api_url,key=config.ANON_KEY||config.anon_key;
const app='http://127.0.0.1:8127/index.html';
if(api!=='http://127.0.0.1:54821')throw new Error('Only the isolated stack is allowed.');
const statePath=process.env.SC004_ROLLBACK_BROWSER_STATE,resultPath=process.env.SC004_ROLLBACK_BROWSER_RESULTS;
if(!statePath||!resultPath)throw new Error('Private state and public evidence paths required.');
const fixture=JSON.parse(fs.readFileSync(process.env.SC004_ROLLBACK_STATE,'utf8'));
assert.match(fixture.run_id||'',/^[a-f0-9-]{36}$/,'Shared rollback run identity is required.');
assert.deepEqual(fixture.anchor,anchor,'Browser fixture must use the same frozen anchor.');
const identity={run_id:fixture.run_id,...anchor};
const prior=phase==='prepare'?null:JSON.parse(fs.readFileSync(statePath,'utf8'));
if(prior)assert.deepEqual(prior.identity,identity,'Cached browser must belong to the same rollback run and anchor.');
const evidence=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath,'utf8')):{environment:'isolated-real-browser',productionWrites:false,authorityMocks:false,identity,expected_phases:expectedPhases,phases:[]};
assert.deepEqual(evidence.identity,identity,'Browser evidence must belong to the same rollback run and anchor.');
assert.deepEqual(evidence.expected_phases,expectedPhases);
assert.deepEqual(evidence.phases.map(p=>p.phase),expectedPhases.slice(0,expectedPhases.indexOf(phase)),'Browser rollback phases must run once, in order.');
for(const previous of evidence.phases)assert.deepEqual(previous.identity,identity,'Every browser phase must use the same rollback run and anchor.');
assert(evidence.phases.every(p=>p.pass),'A failed browser phase cannot be reused as acceptance evidence.');
const read=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const must=({data,error})=>{if(error)throw new Error(error.code||'Supabase read failed');return data;};
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,...(prior?{storageState:prior.storageState}:{})});
await ctx.addInitScript(({api,key})=>{window.SQ_SECURITY_CONFIG={supabaseUrl:api,publicKey:key,allowLocalFixture:true};},{api,key});
const umd=fs.readFileSync(path.resolve('tools/ui-smoke/node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
await ctx.route('**/*',route=>{
  const url=route.request().url();
  if(url.includes('cdn.jsdelivr.net')&&url.includes('supabase'))return route.fulfill({status:200,contentType:'application/javascript',body:umd});
  if(url.startsWith(new URL(app).origin+'/')||url.startsWith(api+'/'))return route.continue();
  return route.abort('failed');
});
const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(25000);
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const servedAssets=[],assetChecks=[];
if(phase==='recovered')page.on('response',response=>{
  const resource=new URL(response.url());
  if(resource.origin!==new URL(app).origin)return;
  const file='app/'+decodeURIComponent(resource.pathname).replace(/^\//,'');
  const expected=manifest.files[file];if(!expected)return;
  // Capture rejection as a value until all response bodies are available.
  assetChecks.push((async()=>{
    assert.equal(response.status(),200,'Frozen app asset must be served successfully: '+file);
    const hash=sha256(await response.body());
    assert.equal(hash,expected,'Served app asset must match the frozen anchor: '+file);
    servedAssets.push({file,sha256:hash});return null;
  })().catch(error=>error));
});
async function finishUI(){
  await page.waitForSelector('.sq-gamecomplete-backdrop .sq-pg-next',{timeout:12000});
  for(let i=0;i<8&&await page.evaluate(()=>document.body.dataset.page!=='leaderboard');i++){
    await page.waitForFunction(()=>{const b=document.querySelector('.sq-gamecomplete-backdrop .sq-pg-next');return document.body.dataset.page==='leaderboard'||(b&&!b.disabled);},null,{timeout:20000});
    if(await page.evaluate(()=>document.body.dataset.page==='leaderboard'))break;
    await page.locator('.sq-gamecomplete-backdrop .sq-pg-next').click();await page.waitForTimeout(350);
  }
  assert.equal(await page.evaluate(()=>document.body.dataset.page),'leaderboard','Actual Finish must reach the leaderboard.');
}
let result;
try{
  const navigation=await page.goto(app,{waitUntil:'domcontentloaded'});
  assert(navigation&&navigation.ok(),'App index must be served successfully.');
  const indexHash=sha256(await navigation.body());
  if(phase==='recovered')assert.equal(indexHash,manifest.files['app/index.html'],'Recovered browser must load the exact frozen app index.');
  await page.waitForFunction(()=>typeof SQ_SECURITY!=='undefined'&&window.sb&&document.getElementById('startGameBtn'));
  await page.waitForFunction(()=>{const b=document.getElementById('bootSplash');return !b||b.hidden||getComputedStyle(b).display==='none'||getComputedStyle(b).opacity==='0';});
  if(phase==='prepare'){
    await page.click('#startGameBtn');await page.click('#questBtn');await page.click('#matchClassicBtn');
    await page.click('#msAddRegisteredBtn');
    for(const p of fixture.players){await page.fill('#spSearchInput',p.name);await page.locator('.sp2-row').filter({hasText:p.name}).first().click();}
    await page.click('#confirmSelectPlayerBtn');await page.click('#startMatchBtn');
    await page.locator('#mlGrid .mlw-seg[data-value="3"]').click();await page.click('#mlStartBtn');
    await page.locator('.modal-throworder button').filter({hasText:/START GAME/i}).first().click();
  }else{
    await page.waitForSelector('#resumeBtn',{state:'visible'});await page.click('#resumeBtn');
  }
  await page.waitForFunction(()=>document.body.dataset.page==='game'&&!!state.__sqGameControl&&!state.__sqSecurityPreparing&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');
  const snapshot=()=>page.evaluate(()=>({control:state.__sqGameControl,score:state.score,history:state.history,cursor:[state.currentRound,state.currentPlayer,state.currentDart],match:state.match}));
  if(phase==='prepare'){
    await page.evaluate(()=>{for(let i=0;i<9;i++)recordThrow({kind:'S'});save();});
    const before=await snapshot();assert.equal(before.history.length,9);
    const acceptedBefore=must(await read.from('games').select('id,match_id,game_number,state,totals,finished').eq('match_id',before.control.match_id));
    assert.equal(acceptedBefore.length,0,'Browser rehearsal must begin with its own pending first game.');
    const storageState=await ctx.storageState();
    fs.writeFileSync(statePath,JSON.stringify({identity,before,acceptedBefore,storageState}),{mode:0o600});fs.chmodSync(statePath,0o600);
    result={phase,identity,pass:true,recordedThrows:9,game_id:before.control.game_id,index_sha256:indexHash};
  }else{
    assert.deepEqual(await snapshot(),prior.before,'App restoration must retain exact board, cursor, match and issued game identity.');
    await page.evaluate(()=>{recordThrow({kind:'S'});save();});
    const after=await snapshot();assert.equal(after.history.length,10);assert.equal(after.control.game_id,prior.before.control.game_id);
    assert.equal(await page.evaluate(()=>SQ_GAMEPLAY.canThrow()),true);
    // Continue through the existing scoring entry point without replacing the board.
    await page.evaluate(strong=>{for(let i=0;i<250&&!state.finished;i++){
      const def=ROUNDS[state.currentRound],hit=state.players[state.currentPlayer].name===strong;
      recordThrow(!hit?{kind:'Miss'}:def.type==='number'?{kind:'S'}:def.type==='bull'?{kind:'B',bull:'Inner'}:{kind:def.type==='doubles'?'Double':'Triple',sector:20});
    }},fixture.players[0].name);
    assert.equal(await page.evaluate(()=>state.finished),true,'Canonical engine must finish the preserved game.');
    await finishUI();
    await page.waitForFunction(()=>state.gameAwarded&&state.__sqAcceptedGameReceipt,null,{timeout:25000});
    const completed=await page.evaluate(()=>({receipt:state.__sqAcceptedGameReceipt,board:state.__sqCompletionSnapshot.state.board,totals:state.__sqCompletionSnapshot.totals,players:state.__sqCompletionSnapshot.state.players}));
    assert.equal(completed.receipt.game_id,prior.before.control.game_id);
    assert.equal(completed.receipt.id,prior.before.control.game_id);
    assert.equal(completed.receipt.match_id,prior.before.control.match_id);
    const rows=must(await read.from('games').select('id,match_id,game_number,state,totals,finished').eq('match_id',prior.before.control.match_id));
    assert.equal(rows.length,prior.acceptedBefore.length+1,'Recovered Finish must accept the original pending game exactly once.');
    const row=rows.find(r=>r.id===prior.before.control.game_id);assert(row,'The original issued game must be saved.');
    assert.equal(row.match_id,prior.before.control.match_id);assert.equal(row.game_number,1);assert.equal(row.finished,true);
    assert.deepEqual(row.totals,completed.totals);assert.deepEqual(row.state.board,completed.board);assert.deepEqual(row.state.players,completed.players);
    for(const old of prior.acceptedBefore)assert.deepEqual(rows.find(r=>r.id===old.id),old,'Accepted history must remain unchanged.');
    const assetErrors=(await Promise.all(assetChecks)).filter(Boolean);if(assetErrors.length)throw assetErrors[0];
    result={phase,identity,pass:true,retainedThrows:9,continuedThrows:10,game_id:row.id,match_id:row.match_id,saved_games:rows.length,finish:'actual UI',index_sha256:indexHash,served_frozen_assets:servedAssets.sort((a,b)=>a.file.localeCompare(b.file))};
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
}catch(e){result={phase,identity,pass:false,message:e.message.slice(0,700)};process.exitCode=1;}
finally{await browser.close();}
evidence.phases.push({...result,captured_at:new Date().toISOString()});
evidence.complete=evidence.phases.length===expectedPhases.length;
evidence.passed=evidence.complete&&evidence.phases.every(x=>x.pass);
fs.writeFileSync(resultPath,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(result));
