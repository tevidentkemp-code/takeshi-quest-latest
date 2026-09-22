const H=require('./harness');
const assert=require('assert/strict');

async function run(){
  const label=process.env.SQ_GATE1_LABEL||'UNKNOWN';
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page,{settle:800});
    await H.toMatchCard(page);
    await H.addGuests(page,['LATENCY ALPHA','LATENCY BETA']);
    await H.startMatch(page,1);
    await page.waitForFunction(()=>typeof window.sxp04Gate1Report==='function');
    await page.evaluate(()=>window.sxp04Gate1Reset());

    for(let i=0;i<36;i++){
      const finished=await page.evaluate(()=>!!(window.state&&state.finished));
      if(finished) break;
      const btn=page.locator('#pad [data-score-label="Single"]:not([disabled])').first();
      await btn.click();
      await page.waitForTimeout(45);
    }
    await page.waitForFunction(()=>{
      const r=window.sxp04Gate1Report&&window.sxp04Gate1Report();
      return r&&r.summary&&r.summary.normal&&r.summary.normal.n>=24;
    },null,{timeout:10000});
    const report=await page.evaluate(()=>window.sxp04Gate1Report());
    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource|content security policy/i.test(e));
    assert.deepEqual(unexpected,[],label+' unexpected console errors: '+unexpected.join(' | '));
    console.log(JSON.stringify({label,report},null,2));
  }finally{
    await browser.close();
  }
}
run().catch(e=>{console.error(e);process.exit(1);});