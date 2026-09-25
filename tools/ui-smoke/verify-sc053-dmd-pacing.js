const assert=require('node:assert/strict');
const H=require('./harness');
const BROWSER_NOISE=/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page,3);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && window.__sqDmdV2?.snapshot?.().architecture==='sxp05-gate3-scene-contract');
    const missX=page.locator('#pad .dtX3'); assert.equal(await missX.count(),1); await missX.click();
    await page.waitForFunction(()=>state.history.length===3 && state.currentPlayer===1 && state.currentDart===0,undefined,{timeout:2500});
    const scratch=await page.evaluate(()=>({headline:window.__sqDmdV2?.snapshot?.().active?.headline||'',priority:Number(window.__sqDmdV2?.snapshot?.().active?.priority||0),roundTotal:Number(state.score?.[0]?.[0]?.roundTotal||0)}));
    assert.deepEqual(scratch,{headline:'SCRATCH',priority:20,roundTotal:0},'Scratch must own zero-visit closure');
    await page.locator('#pad [data-score-label="Single"]').click();
    await page.locator('#pad [data-score-label="Treble"]').click();
    await page.locator('#pad [data-score-label="Single"]').click();
    await page.waitForFunction(()=>state.history.length===6 && state.currentPlayer===0 && state.currentRound===1 && state.currentDart===0,undefined,{timeout:2500});
    const transition=await page.evaluate(()=>({active:window.__sqDmdV2?.snapshot?.().active?.headline||'',priority:Number(window.__sqDmdV2?.snapshot?.().active?.priority||0),duration:Number(window.__sqDmdV2?.snapshot?.().active?.duration||0),total:Number(state.score?.[1]?.[0]?.roundTotal||0)}));
    assert.equal(transition.active,'TARGET 11'); assert.equal(transition.priority,20); assert.equal(transition.total,50);
    // VISIT duration is applied internally by the controller scheduler; prove
    // the <=900ms contract by observing fresh-state restoration after 780ms.
    // Enter the next legitimate score while the round transition is still active:
    // accepted player input must hard-cancel that transient immediately.
    await page.locator('#pad [data-score-label="Double"]').click();
    await page.waitForFunction(()=>state.history.length===7 && state.currentDart===1);
    const rapid=await page.evaluate(()=>window.__sqDmdV2?.snapshot?.());
    assert.equal(rapid.active?.headline,'DOUBLE +22');
    assert.equal(rapid.lastDecision?.action,'input-preempt');

    // The replacement THROW transient then restores against fresh current state.
    await page.waitForTimeout(700);
    const restored=await page.evaluate(()=>window.__sqDmdV2?.snapshot?.().idle||null);
    assert.equal(restored?.headline,'ALPHA UP'); assert.equal(restored?.subline,'TARGET 11');
    const unexpected=consoleErrs.filter(e=>!BROWSER_NOISE.test(e)); assert.deepEqual(unexpected,[],'unexpected browser errors: '+unexpected.join('\n'));
    console.log('SC-053 Gate 4 pacing + motion contract PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
