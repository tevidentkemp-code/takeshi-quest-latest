const H=require('./harness');
const assert=require('assert/strict');
const BROWSER_NOISE=/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page,{settle:1000}); await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page,3);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && !!window.__sqDmdV2);
    const miss=page.locator('#pad .dtActBtn.miss').first(); await miss.waitFor({state:'visible'}); await miss.click();
    await page.waitForFunction(()=>state.currentDart===1 && state.history.length===1,undefined,{timeout:1800});
    const snap=await page.evaluate(()=>window.__sqDmdV2?.snapshot?.());
    assert.equal(snap.active?.headline,'MISS','single MISS must render MISS'); assert.equal(snap.active?.priority,10);
    assert.equal(/MISS\s*x\s*1/i.test(String(snap.active?.headline||'')),false,'single MISS must never render MISS x1');
    const unexpected=consoleErrs.filter(msg=>!BROWSER_NOISE.test(msg)); assert.deepEqual(unexpected,[]);
    console.log('SC-056 DMD single-MISS runtime PASS');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
