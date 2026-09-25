const assert=require('node:assert/strict');
const H=require('./harness');
const BROWSER_NOISE=/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page,3);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && !!window.__sqDmdCommentary);
    await page.evaluate(()=>{
      window.__sc052Story=[];
      ['Dart','Visit','Round'].forEach(stage=>{
        const key='__sqDmdCommentary'+stage, original=window[key];
        window[key]=function(ctx){ const result=typeof original==='function'?original(ctx):null; window.__sc052Story.push({stage:stage.toLowerCase(),reason:result&&result.reason||null,gap:result&&result.gap||0}); return result; };
      });
    });
    await page.evaluate(()=>{ recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); });
    await page.waitForFunction(()=>state.currentPlayer===1 && state.currentDart===0);
    await page.evaluate(()=>{ recordThrow({kind:'T'}); recordThrow({kind:'T'}); recordThrow({kind:'T'}); });
    await page.waitForFunction(()=>state.currentPlayer===0 && state.currentRound===1 && state.currentDart===0);
    const snap=await page.evaluate(()=>{
      const roundBeat=window.__sqDmdCommentaryRound?.({rIndex:0,pIndex:1,players:state.players,score:state.score,history:state.history,matchHistory:state?.match?.history,mode:String(state?.gameMode||state?.mode||state?.match?.gameMode||state?.match?.mode||''),suppress:false})||null;
      return {mode:window.__sqDmdCommentary?.mode?.(),story:(window.__sc052Story||[]).slice(),roundBeat:roundBeat?{reason:roundBeat.reason||null,gap:roundBeat.gap||0}:null,totals:state.score.map(board=>board.reduce((n,e)=>n+Number(e&&e.roundTotal||0),0)),history:state.history.length,controller:window.__sqDmdV2?.snapshot?.()};
    });
    assert.equal(snap.mode,'brutal');
    assert.deepEqual(snap.totals,[0,90]);
    assert.equal(snap.history,6);
    assert(snap.story.some(x=>x.stage==='visit' && x.reason==='zero_visit'),'zero visit classifier remains available');
    assert.equal(snap.roundBeat?.reason,'round_far_behind','round commentary classifier remains intact for Gate 5');
    assert.equal(snap.roundBeat?.gap,90);
    assert(Number(snap.controller?.active?.priority||0)>=20,'Gate 4 controller remains authoritative for live delivery');
    const unexpected=consoleErrs.filter(e=>!BROWSER_NOISE.test(e)); assert.deepEqual(unexpected,[],'unexpected browser errors: '+unexpected.join('\n'));
    console.log('SC-052 DMD commentary boundary acceptance PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
