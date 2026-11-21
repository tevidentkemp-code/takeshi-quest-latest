// SC-060 live browser acceptance. Standalone LOCAL Test Lab build only.
// Every true production Supabase HTTP request is blocked/counted by Playwright.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { chromium,webkit }=require('../ui-smoke/node_modules/playwright');
(async()=>{
  const type=process.env.SQ_BROWSER||'chromium';
  if(!['webkit','chromium'].includes(type))throw Error('Unsupported browser '+type);
  const browser=await ({webkit,chromium}[type]).launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const base='http://127.0.0.1:8130';
  const blocked=[],errors=[];
  const umd=path.join(__dirname,'../ui-smoke/node_modules/@supabase/supabase-js/dist/umd/supabase.js');
  await ctx.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(base))return route.continue();
    if(url.includes('cdn.jsdelivr.net')&&url.includes('supabase')&&fs.existsSync(umd))
      return route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(umd,'utf8')});
    if(url.includes('supabase.co'))blocked.push({url:new URL(url).origin,method:route.request().method()});
    return route.abort('failed');
  });
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(String(e).slice(0,220)));
  try{
    await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__SQ_TEST_LAB?.active&&!!window.__SQ_TEST_LAB_PANEL,{timeout:15000});
    const identity=await page.evaluate(()=>{
      const root=document.getElementById('sq060-test-lab-root');
      const dom=root?.shadowRoot;
      return {
        banner:dom?.querySelector('.lab-banner')?.textContent||'',
        buttons:[...(dom?.querySelectorAll('button[data-action]')||[])].map(b=>b.dataset.action),
        version:window.__SQ_TEST_LAB?.environment,
        csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||'',
        prodMarker:document.body?.dataset.page,
      };
    });
    assert.match(identity.banner,/TEST LAB.*OFFLINE/i);
    assert.match(identity.csp,/connect-src 'self'/);
    assert.equal(identity.buttons.length,9);
    assert.equal(identity.version,'OFFLINE TEST LAB');
    const blockedWrite=await page.evaluate(async()=>{
      try{await fetch('https://vvfqumgtasuacpggdmxx.supabase.co/rest/v1/games',{method:'POST',body:'{}'});return false;}
      catch(_){return true;}
    });
    assert.equal(blockedWrite,true,'Test Lab permits an external production write');
    const fakeRead=await page.evaluate(async()=>await (await fetch('https://vvfqumgtasuacpggdmxx.supabase.co/rest/v1/games',{method:'GET'})).json());
    assert.deepEqual(fakeRead,[],'Test Lab should return empty local cloud fixture');
    await page.evaluate(()=>window.__SQ_TEST_LAB_PANEL.run('quick2'));
    const first=await page.evaluate(()=>({count:state.players.length,screen:document.body.dataset.page,controlled:window.SQ_GAMEPLAY?.hasCachedController(state)}));
    assert.deepEqual(first,{count:2,screen:'game',controlled:true},'2-player lab QuickStart not playable');
    await page.evaluate(()=>window.__SQ_TEST_LAB_PANEL.run('quick5'));
    const max=await page.evaluate(()=>({count:state.players.length,screen:document.body.dataset.page}));
    assert.deepEqual(max,{count:5,screen:'game'},'canonical five-player Lab stress setup failed');
    assert.equal(blocked.length,0,'An actual Supabase network request escaped the Lab guard');
    const resetKey=await page.evaluate(()=>window.__SQ_TEST_LAB_PANEL.run('reset').catch(()=>{}));
    // A reload after Reset is expected; the TEST banner and guard must reappear.
    await page.waitForFunction(()=>window.__SQ_TEST_LAB?.active&&!!window.__SQ_TEST_LAB_PANEL,{timeout:15000});
    assert.equal(blocked.length,0,'Real Supabase access during Reset/reload');
    console.log('SC060 browser PASS '+type+': Test banner, 9 controls, CSP, no Supabase request, 2/5 QuickStart playable, Reset');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
