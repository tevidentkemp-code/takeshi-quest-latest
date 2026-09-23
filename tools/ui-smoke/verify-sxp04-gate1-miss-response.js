// SXP-04 Gate 1 — MISS must never wait for presentation before scoring.
const H = require('./harness');
const assert = require('assert/strict');

function p95(values){
  const a=values.slice().sort((x,y)=>x-y);
  return a[Math.min(a.length-1,Math.max(0,Math.ceil(a.length*.95)-1))] || 0;
}

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['LATENCY ALPHA','LATENCY BETA']);
    await H.startMatch(page);
    await page.waitForSelector('#pad .dtActBtn.miss');

    const samples=[];
    for(let i=0;i<12;i++){
      const sample=await page.evaluate(()=>new Promise(resolve=>{
        const btn=document.querySelector('#pad .dtActBtn.miss');
        const rows=document.getElementById('v2Rows');
        const beforeHistory=Array.isArray(state.history)?state.history.length:0;
        const before={player:Number(state.currentPlayer||0),round:Number(state.currentRound||0),dart:Number(state.currentDart||0)};
        const t0=performance.now();
        let done=false;
        const finish=(payload)=>{
          if(done)return; done=true;
          try{obs.disconnect();}catch(_){}
          resolve(Object.assign({ms:performance.now()-t0},payload||{}));
        };
        const obs=new MutationObserver(()=>{
          requestAnimationFrame(()=>{
            const afterHistory=Array.isArray(state.history)?state.history.length:0;
            finish({
              timeout:false,
              before,
              after:{player:Number(state.currentPlayer||0),round:Number(state.currentRound||0),dart:Number(state.currentDart||0)},
              historyDelta:afterHistory-beforeHistory
            });
          });
        });
        obs.observe(rows,{subtree:true,childList:true,characterData:true,attributes:true});
        btn.click();
        setTimeout(()=>finish({timeout:true,historyDelta:(Array.isArray(state.history)?state.history.length:0)-beforeHistory}),700);
      }));
      assert.equal(sample.timeout,false,'MISS produced no visible Live V2 response');
      assert.equal(sample.historyDelta,1,'MISS must create exactly one canonical history entry');
      samples.push(sample.ms);
      await page.waitForTimeout(25);
    }

    const q=p95(samples);
    assert(q<=100,'MISS click → visible response p95 exceeded 100ms: '+q.toFixed(1)+'ms; samples='+samples.map(v=>v.toFixed(1)).join(','));
    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));
    console.log('SXP-04 Gate 1 MISS latency PASS p95='+q.toFixed(1)+'ms samples='+samples.map(v=>v.toFixed(1)).join(','));
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1);});
