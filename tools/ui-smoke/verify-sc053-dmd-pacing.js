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
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && typeof window.sqDmdShowZones==='function');

    await page.evaluate(()=>{
      window.__sc053Writes=[];
      const original=window.sqDmdShowZones;
      window.__sc053OriginalShowZones=original;
      window.sqDmdShowZones=function(z,o){
        try{
          window.__sc053Writes.push({
            at:performance.now(),
            z2:String(z&&z.z2||''),
            z3:String(z&&z.z3||''),
            type:String(o&&o.type||''),
            ms:Number(o&&o.ms||0),
            revealMs:Number(o&&o.revealMs||0),
            fx:String(o&&o.fx||'')
          });
        }catch(_){}
        return original.apply(this,arguments);
      };
    });

    const missX=page.locator('#pad .dtX3');
    assert.equal(await missX.count(),1,'MISS xN control must exist');
    const preMiss=await page.evaluate(()=>{
      const btn=document.querySelector('#pad .dtX3');
      return {
        currentPlayer:state.currentPlayer,
        currentRound:state.currentRound,
        currentDart:state.currentDart,
        history:state.history.length,
        label:String(btn&&btn.textContent||'').replace(/\s+/g,' ').trim(),
        missN:String(btn&&btn.dataset&&btn.dataset.missN||''),
        onclick:String(btn&&btn.onclick||'').slice(0,700),
        showZones:String(window.sqDmdShowZones||'').slice(0,300)
      };
    });
    console.log('SC053_PRE_MISS',JSON.stringify(preMiss));
    await missX.click();
    await page.waitForFunction(()=>state.history.length>=3 && state.currentPlayer===1 && state.currentDart===0,undefined,{timeout:2500});
    await page.waitForTimeout(250);

    const allMissWrites=await page.evaluate(()=>window.__sc053Writes.slice());
    console.log('SC053_MISS_WRITES',JSON.stringify(allMissWrites));
    const missWrites=allMissWrites.filter(w=>/^MISS x3$/i.test(w.z2));
    assert.equal(missWrites.length,3,'MISS x3 must render exactly three X impact frames');
    missWrites.forEach((w,i)=>{
      assert.equal(w.type,'snap',`MISS x3 frame ${i+1} must use snap`);
      assert.equal(w.ms,150,`MISS x3 frame ${i+1} must be 150ms`);
      assert(w.revealMs<=130,`MISS x3 frame ${i+1} reveal must stay punchy`);
    });
    const compact=missWrites.map(w=>w.z3.replace(/\s+/g,'').replace(/\//g,'/'));
    assert(compact[0].startsWith('X/'),'first MISS x3 frame must land one X');
    assert(compact[1].startsWith('X/X/'),'second MISS x3 frame must land two Xs');
    assert(compact[2].includes('X/X/X'),'third MISS x3 frame must land all three Xs');
    const span=missWrites[2].at-missWrites[0].at;
    assert(span<450,`MISS x3 X sequence should complete quickly; observed ${span.toFixed(1)}ms`);

    await page.evaluate(()=>{ window.__sc053Writes=[]; });
    await page.evaluate(()=>{
      recordThrow({kind:'T'});
      recordThrow({kind:'T'});
      recordThrow({kind:'T'});
    });
    await page.waitForFunction(()=>state.currentPlayer===0 && state.currentRound===1 && state.currentDart===0,undefined,{timeout:1500});
    await page.waitForTimeout(6200);

    const writes=await page.evaluate(()=>window.__sc053Writes.slice());
    const find=(pred)=>writes.find(pred);
    const roundScore=find(w=>w.z2==='ROUND SCORE');
    const visitStory=find(w=>w.type==='hold' && w.ms===1200);
    const roundComplete=find(w=>/^ROUND /.test(w.z2) && w.z3==='COMPLETE');
    const roundPunch=find(w=>w.type==='hold' && w.ms===1380);
    const handoff=find(w=>/^NEXT:/.test(w.z2) && /TO THROW/.test(w.z3));

    assert(roundScore,'ROUND SCORE frame missing');
    assert.equal(roundScore.type,'roll');
    assert.equal(roundScore.ms,900,'ROUND SCORE must remain readable for 900ms');
    assert(visitStory,'end-of-go story must hold for 1200ms');
    assert(roundComplete,'ROUND COMPLETE frame missing');
    assert.equal(roundComplete.type,'shutter','round change must use split shutter');
    assert.equal(roundComplete.ms,900);
    assert(roundPunch,'end-of-round punchline must hold for 1380ms');
    assert(handoff,'combined next-target/player handoff missing');
    assert.equal(handoff.type,'wipe');
    assert.equal(handoff.ms,900);

    const order=[roundScore.at,visitStory.at,roundComplete.at,roundPunch.at,handoff.at];
    assert(order.every((v,i)=>i===0||v>order[i-1]),'story frames must appear in canonical order');
    assert(!writes.some(w=>w.z2==='NEXT UP'),'redundant standalone NEXT UP frame must be removed');

    const reduced=await page.evaluate(()=>{
      const before=window.matchMedia;
      window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
      try{
        window.sqDmdShowZones({z2:'REDUCED SNAP',z3:'TEST'},{type:'snap',ms:160,revealMs:120,fx:'impact'});
        window.sqDmdShowZones({z2:'REDUCED SHUTTER',z3:'TEST'},{type:'shutter',ms:300,revealMs:220});
        return true;
      }finally{window.matchMedia=before;}
    });
    assert.equal(reduced,true,'reduced-motion fallback must accept snap/shutter scenes');

    const unexpected=consoleErrs.filter(e=>!BROWSER_NOISE.test(e));
    assert.deepEqual(unexpected,[],'unexpected browser errors: '+unexpected.join('\n'));
    console.log('SC-053 DMD pacing + motion runtime acceptance PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
