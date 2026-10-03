/** Real browser cache handoff across an actual compatible app restoration.
 * Run prepare against the candidate at 8127, then recovered after replacing
 * that server with the frozen compatible artifact at the same origin.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('../ui-smoke/node_modules/playwright');
const phase=process.argv[2];if(!['prepare','recovered'].includes(phase))throw new Error('Expected prepare or recovered.');
const config=JSON.parse(fs.readFileSync(process.env.SC004_LOCAL_ENV,'utf8'));
const api=config.API_URL||config.api_url,key=config.ANON_KEY||config.anon_key;
const app='http://127.0.0.1:8127/index.html';
if(api!=='http://127.0.0.1:54821')throw new Error('Only the isolated stack is allowed.');
const statePath=process.env.SC004_ROLLBACK_BROWSER_STATE,resultPath=process.env.SC004_ROLLBACK_BROWSER_RESULTS;
if(!statePath||!resultPath)throw new Error('Private state and public evidence paths required.');
const fixture=JSON.parse(fs.readFileSync(process.env.SC004_ROLLBACK_STATE,'utf8'));
const prior=phase==='prepare'?null:JSON.parse(fs.readFileSync(statePath,'utf8'));
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
let result;
try{
  await page.goto(app,{waitUntil:'domcontentloaded'});
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
    const storageState=await ctx.storageState();
    fs.writeFileSync(statePath,JSON.stringify({before,storageState}),{mode:0o600});
    result={phase,pass:true,recordedThrows:9,game_id:before.control.game_id};
  }else{
    assert.deepEqual(await snapshot(),prior.before,'App restoration must retain exact board, cursor, match and issued game identity.');
    await page.evaluate(()=>{recordThrow({kind:'S'});save();});
    const after=await snapshot();assert.equal(after.history.length,10);assert.equal(after.control.game_id,prior.before.control.game_id);
    assert.equal(await page.evaluate(()=>SQ_GAMEPLAY.canThrow()),true);
    result={phase,pass:true,retainedThrows:9,continuedThrows:10,game_id:after.control.game_id};
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
}catch(e){result={phase,pass:false,message:e.message.slice(0,700)};process.exitCode=1;}
finally{await browser.close();}
const evidence=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath,'utf8')):{environment:'isolated-real-browser',productionWrites:false,authorityMocks:false,phases:[]};
evidence.phases.push({...result,captured_at:new Date().toISOString()});evidence.passed=evidence.phases.every(x=>x.pass);
fs.writeFileSync(resultPath,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(result));
