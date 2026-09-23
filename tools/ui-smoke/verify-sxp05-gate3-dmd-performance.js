const H = require('./harness');
const assert = require('assert/strict');

function percentile(values, p){
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length) return 0;
  const idx=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));
  return sorted[idx];
}

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && !!window.__sqDmdV2,{timeout:10000});
    await H.toMatchCard(page);
    await H.addGuests(page,['GATE THREE A','GATE THREE B']);
    await H.startMatch(page);

    async function reset(){
      await page.evaluate(()=>{
        const mk=()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0}));
        state.players=[
          {id:'p0',name:'GATE THREE A',initials:'GA',type:'guest'},
          {id:'p1',name:'GATE THREE B',initials:'GB',type:'guest'}
        ];
        state.score=state.players.map(()=>mk());
        state.currentRound=0;
        state.currentPlayer=0;
        state.currentDart=0;
        state.history=[];
        state.finished=false;
        state.gameAwarded=false;
        state.suddenDeath={active:false,participants:[],turnIndex:0,throws:[],round:1};
        state.match=Object.assign({},state.match||{},{
          gameFormat:'match_play',gameNumber:1,targetWins:1,wins:[0,0],history:[]
        });
        delete state.__sqCatchUp;
        updateUI();
      });
      await page.waitForSelector('#pad [data-score-label="Single"]',{state:'visible'});
    }

    const clickSamples=[];
    for(let i=0;i<24;i++){
      await reset();
      const sample=await page.evaluate(()=>{
        const btn=document.querySelector('#pad [data-score-label="Single"]');
        if(!btn) throw new Error('Single button missing');
        const historyBefore=Array.isArray(state.history)?state.history.length:0;
        const t0=performance.now();
        btn.click();
        const ms=performance.now()-t0;
        return {
          ms,
          historyDelta:(Array.isArray(state.history)?state.history.length:0)-historyBefore,
          dart:Number(state.currentDart||0)
        };
      });
      assert.equal(sample.historyDelta,1,'accepted score must commit history synchronously');
      assert.equal(sample.dart,1,'accepted score must advance dart synchronously');
      clickSamples.push(sample.ms);
    }

    const p95=percentile(clickSamples,95);
    const maxClick=Math.max(...clickSamples);
    assert(p95<=100,`accepted scoring response p95 exceeded 100ms: ${p95.toFixed(2)}ms`);

    const dmdPerf=await page.evaluate(async()=>{
      const durations=[];
      const longTasks=[];
      let observer=null;
      try{
        if(typeof PerformanceObserver==='function' &&
           Array.isArray(PerformanceObserver.supportedEntryTypes) &&
           PerformanceObserver.supportedEntryTypes.includes('longtask')){
          observer=new PerformanceObserver(list=>{
            for(const entry of list.getEntries()){
              longTasks.push({startTime:entry.startTime,duration:entry.duration});
            }
          });
          observer.observe({entryTypes:['longtask']});
        }
      }catch(_){}

      const events=[];
      for(let i=0;i<36;i++){
        if(i%6===0) events.push({kind:'SHATEKI_RECORD',gameScore:800+i,eventToken:'perf-record-'+i});
        else if(i%5===0) events.push({kind:'BULLSEYE',total:200+i,eventToken:'perf-bull-'+i,playerInput:true});
        else events.push({kind:'HIT_SINGLE',points:20,total:100+i,eventToken:'perf-throw-'+i,playerInput:true});
      }

      for(const event of events){
        await new Promise(resolve=>requestAnimationFrame(()=>{
          const t0=performance.now();
          window.__sqDmdV2.emit(event);
          durations.push(performance.now()-t0);
          resolve();
        }));
      }
      await new Promise(resolve=>setTimeout(resolve,80));
      try{observer?.disconnect();}catch(_){}
      return {
        durations,
        longTasks,
        architecture:window.__sqDmdV2?.snapshot?.().architecture||'',
        queue:window.__sqDmdV2?.snapshot?.().queue?.length||0
      };
    });

    const dmdP95=percentile(dmdPerf.durations,95);
    const dmdMax=Math.max(...dmdPerf.durations);
    assert.equal(dmdPerf.architecture,'sxp05-gate3-scene-contract','Gate 3 scene architecture must be active');
    assert.equal(dmdPerf.queue,0,'representative Gate 3 event run must not leave replay queue');
    assert(dmdP95<50,`DMD emit p95 should stay comfortably below long-task threshold: ${dmdP95.toFixed(2)}ms`);
    assert(dmdMax<50,`DMD emit produced >=50ms synchronous task: ${dmdMax.toFixed(2)}ms`);
    assert.equal(dmdPerf.longTasks.length,0,`DMD-attributable long tasks detected: ${JSON.stringify(dmdPerf.longTasks)}`);

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed|content security policy|connect-src/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-05 GATE 3 DMD PERFORMANCE PASS',JSON.stringify({
      scoringSamples:clickSamples.length,
      scoringP95Ms:Number(p95.toFixed(3)),
      scoringMaxMs:Number(maxClick.toFixed(3)),
      dmdSamples:dmdPerf.durations.length,
      dmdP95Ms:Number(dmdP95.toFixed(3)),
      dmdMaxMs:Number(dmdMax.toFixed(3)),
      longTasks:dmdPerf.longTasks.length
    }));
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1);});
