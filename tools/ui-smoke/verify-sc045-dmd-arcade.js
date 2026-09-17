const assert = require('assert/strict');
const H = require('./harness');
const fs = require('fs');
const path = require('path');
(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ARCADE A','ARCADE B']); await H.startMatch(page);
    await page.waitForFunction(()=>typeof window.sqDmdShowZones==='function' && typeof window.recordThrow==='function');
    await page.evaluate(()=>{
      window.__sc045Writes=[];
      const original=window.sqDmdShowZones;
      window.sqDmdShowZones=function(z,o){ window.__sc045Writes.push({z2:String(z?.z2||''),z3:String(z?.z3||''),type:String(o?.type||'')}); return original.apply(this,arguments); };
    });
    await page.evaluate(()=>recordThrow({kind:'T'}));
    let writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>w.z2==='TREBLE!'),'first treble => TREBLE!');
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.__sc045Writes=[]; recordThrow({kind:'T'}); });
    writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>w.z2==='CAN HE......?' && w.type==='anticipationEyes'),'dart-2 second treble => anticipation scene');
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.__sc045Writes=[]; recordThrow({kind:'T'}); });
    writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>/MAXI/.test(w.z2+' '+w.z3)),'third treble => MAXI MAYHEM');

    const out=process.env.SQ_SCREENSHOTS || path.join(process.cwd(),'qa-artifacts-sc045'); fs.mkdirSync(out,{recursive:true});
    for(const [type,ms] of [['anticipationEyes',1150],['dolphinSwim',2000],['bullseyeHit',1100]]){
      await page.evaluate(({type,ms})=>{ window.sqDmdStop(); window.sqDmdShowZones({z2:type==='anticipationEyes'?'CAN HE......?':'',z3:''},{type,ms}); },{type,ms});
      await page.waitForTimeout(type==='anticipationEyes'?350:550);
      const lit=await page.evaluate(()=>{ const c=document.getElementById('sqDmdCanvas'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>20)n++; return n; });
      assert(lit>30, `${type} must visibly render amber dots`);
      await page.screenshot({path:path.join(out,`sc045-${type}.png`),fullPage:false});
    }
    const unexpected=consoleErrs.filter(e=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(e));
    assert.deepEqual(unexpected,[],unexpected.join('\n'));
    console.log('SC-045 DMD ARCADE RUNTIME: ALL PASS');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
