const H=require('./harness');
const assert=require('assert/strict');

const BROWSER_NOISE=/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page,{settle:1000});
    await H.startMatch(page);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && typeof window.sqDmdShowZones==='function');

    await page.evaluate(()=>{
      window.__sc056Writes=[];
      const original=window.sqDmdShowZones;
      window.sqDmdShowZones=function(z,o){
        try{window.__sc056Writes.push({z2:String(z&&z.z2||''),z3:String(z&&z.z3||'')});}catch(_){}
        return original.apply(this,arguments);
      };
    });

    const miss=page.locator('#pad .dtActBtn.miss').first();
    await miss.waitFor({state:'visible'});
    await miss.click();
    await page.waitForFunction(()=>state.currentDart===1 || state.history.length>=1,undefined,{timeout:1800});
    await page.waitForTimeout(350);

    const writes=await page.evaluate(()=>window.__sc056Writes.slice());
    assert(writes.some(w=>/^MISS$/i.test(w.z2)),'single MISS must render MISS');
    assert.equal(writes.some(w=>/^MISS\s*x\s*1$/i.test(w.z2)),false,'single MISS must never render MISS x1');

    const unexpected=consoleErrs.filter(msg=>!BROWSER_NOISE.test(msg));
    assert.deepEqual(unexpected,[]);
    console.log('SC-056 DMD single-MISS runtime PASS');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
