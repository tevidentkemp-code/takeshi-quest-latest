const assert=require('node:assert/strict');
const H=require('./harness');

const BROWSER_NOISE=/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['ALPHA','BETA']);
    await H.startMatch(page,3);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && !!window.__sqDmdCommentary);

    await page.evaluate(()=>{
      window.__sc052Story=[];
      ['Dart','Visit','Round'].forEach(stage=>{
        const key='__sqDmdCommentary'+stage;
        const original=window[key];
        window[key]=function(ctx){
          const result=typeof original==='function'?original(ctx):null;
          window.__sc052Story.push({stage:stage.toLowerCase(),reason:result&&result.reason||null,gap:result&&result.gap||0});
          return result;
        };
      });
    });

    await page.evaluate(()=>{
      recordThrow({kind:'Miss'});
      recordThrow({kind:'Miss'});
      recordThrow({kind:'Miss'});
    });
    await page.waitForFunction(()=>state.currentPlayer===1 && state.currentDart===0);

    await page.evaluate(()=>{
      recordThrow({kind:'T'});
      recordThrow({kind:'T'});
      recordThrow({kind:'T'});
    });
    await page.waitForFunction(()=>state.currentPlayer===0 && state.currentRound===1 && state.currentDart===0);
    await page.waitForTimeout(250);

    const snap=await page.evaluate(()=>({
      mode:window.__sqDmdCommentary?.mode?.(),
      story:(window.__sc052Story||[]).slice(),
      totals:state.score.map(board=>board.reduce((n,e)=>n+Number(e&&e.roundTotal||0),0)),
      history:state.history.length,
      pageErrors:[],
    }));

    assert.equal(snap.mode,'brutal','SC-052 defaults to brutal commentary mode');
    assert.deepEqual(snap.totals,[0,90],'commentary integration must preserve canonical scoring');
    assert.equal(snap.history,6,'all six real darts remain canonical history events');
    assert(snap.story.some(x=>x.stage==='visit' && x.reason==='zero_visit'),'zero visit must produce end-of-go verdict');
    assert(snap.story.some(x=>x.stage==='round' && x.reason==='round_far_behind' && x.gap===90),'completed round must produce 50+ gap punchline');

    const unexpected=consoleErrs.filter(e=>!BROWSER_NOISE.test(e));
    assert.deepEqual(unexpected,[],'unexpected browser errors: '+unexpected.join('\n'));
    console.log('SC-052 DMD commentary runtime acceptance PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
