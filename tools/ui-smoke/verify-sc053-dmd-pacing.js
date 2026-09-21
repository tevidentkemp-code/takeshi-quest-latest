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
      window.__sc053TransientCancels=0;
      const originalCancel=window.__sqDmdCancelTransientScenes;
      if (typeof originalCancel==='function') {
        window.__sqDmdCancelTransientScenes=function(){
          window.__sc053TransientCancels++;
          return originalCancel.apply(this,arguments);
        };
      }
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

    // Fresh visit: prove the full MISS x3 speed/punch sequence.
    await missX.click();
    await page.waitForFunction(()=>state.history.length>=3 && state.currentPlayer===1 && state.currentDart===0,undefined,{timeout:2500});
    await page.waitForTimeout(180);
    const missWrites=await page.evaluate(()=>window.__sc053Writes.filter(w=>/^MISS$/i.test(w.z2)&&/X/.test(w.z3)));
    assert.equal(missWrites.length,3,'MISS x3 must render exactly three X impact frames');
    missWrites.forEach((w,i)=>{
      assert.equal(w.type,'snap',`MISS x3 frame ${i+1} must use snap`);
      assert.equal(w.ms,125,`MISS x3 frame ${i+1} must be 125ms`);
      assert.equal(w.revealMs,90,`MISS x3 frame ${i+1} reveal must be 90ms`);
    });
    const compact=missWrites.map(w=>w.z3.replace(/\s+/g,''));
    assert.equal(compact[0],'X//','first MISS x3 frame must land one X');
    assert.equal(compact[1],'X/X/','second MISS x3 frame must land two Xs');
    assert.equal(compact[2],'X/X/X','third MISS x3 frame must land all three Xs');
    const span=missWrites[2].at-missWrites[0].at;
    assert(span<230,`MISS x3 X sequence should land quickly; observed ${span.toFixed(1)}ms`);

    // Existing deterministic round-story scenario remains intact.
    await page.evaluate(()=>{ window.__sc053Writes=[]; });
    await page.evaluate(()=>{
      recordThrow({kind:'T'});
      recordThrow({kind:'T'});
      // Put an ordinary low-priority controller transient on screen immediately
      // before dart 3. Stage 3 must clear it before the readable story begins.
      try{ window.__sqDmdV2?.emit?.({kind:'HIT_SINGLE',points:10,total:10}); }catch(_){}
      recordThrow({kind:'T'});
    });
    await page.waitForFunction(()=>state.currentPlayer===0 && state.currentRound===1 && state.currentDart===0,undefined,{timeout:1500});
    await page.waitForTimeout(8200);

    const writes=await page.evaluate(()=>window.__sc053Writes.slice());
    const find=(pred)=>writes.find(pred);
    const roundScore=find(w=>w.z2==='ROUND SCORE');
    const visitStory=find(w=>w.type==='hold' && w.ms>=1600 && w.ms<=2200);
    const roundComplete=find(w=>/^ROUND /.test(w.z2) && w.z3==='COMPLETE');
    const roundPunch=find(w=>w.type==='hold' && w.ms>=1900 && w.ms<=2450);
    const handoff=find(w=>/^NEXT:/.test(w.z2) && /TO THROW/.test(w.z3));

    assert(roundScore,'ROUND SCORE frame missing');
    assert.equal(roundScore.type,'roll');
    assert.equal(roundScore.ms,1050,'ROUND SCORE must remain readable for 1050ms');
    assert(visitStory,'end-of-go story must hold for at least 1600ms');
    assert(roundComplete,'ROUND COMPLETE frame missing');
    assert.equal(roundComplete.type,'shutter','round change must use split shutter');
    assert.equal(roundComplete.ms,950);
    assert(roundPunch,'end-of-round punchline must hold for at least 1900ms');
    const transientCancels=await page.evaluate(()=>window.__sc053TransientCancels||0);
    assert(transientCancels>=1,'important story must clear a low-priority controller transient');
    assert(handoff,'combined next-target/player handoff missing');
    assert.equal(handoff.type,'wipe');
    assert.equal(handoff.ms,900);
    const order=[roundScore.at,visitStory.at,roundComplete.at,roundPunch.at,handoff.at];
    assert(order.every((v,i)=>i===0||v>order[i-1]),'story frames must appear in canonical order');
    assert(!writes.some(w=>w.z2==='NEXT UP'),'redundant standalone NEXT UP frame must be removed');

    // Regression: one scored dart must remain visible when MISS x2 fills darts 2+3.
    await page.evaluate(()=>recordThrow({kind:'T'}));
    await page.waitForFunction(()=>state.currentPlayer===0 && state.currentRound===1 && state.currentDart===1);
    await page.evaluate(()=>{ window.__sc053Writes=[]; });
    await missX.click();
    await page.waitForFunction(()=>state.currentPlayer===1 && state.currentRound===1 && state.currentDart===0,undefined,{timeout:2500});
    await page.waitForTimeout(180);
    const x2Writes=await page.evaluate(()=>window.__sc053Writes.filter(w=>/^MISS$/i.test(w.z2)&&/X/.test(w.z3)));
    assert.equal(x2Writes.length,2,'MISS x2 must render two X impact frames');
    assert.equal(x2Writes[0].z3.replace(/\s+/g,''),'T/X/','MISS x2 first frame must preserve dart 1 TREBLE');
    assert.equal(x2Writes[1].z3.replace(/\s+/g,''),'T/X/X','MISS x2 final frame must preserve dart 1 TREBLE');

    // Regression: two scored darts must remain visible when MISS x1 fills dart 3.
    await page.evaluate(()=>{
      recordThrow({kind:'S'});
      recordThrow({kind:'D'});
    });
    await page.waitForFunction(()=>state.currentPlayer===1 && state.currentRound===1 && state.currentDart===2);
    await page.evaluate(()=>{ window.__sc053Writes=[]; });
    await missX.click();
    await page.waitForFunction(()=>state.currentPlayer===0 && state.currentRound===2 && state.currentDart===0,undefined,{timeout:2500});
    await page.waitForTimeout(180);
    const x1Writes=await page.evaluate(()=>window.__sc053Writes.filter(w=>/^MISS$/i.test(w.z2)&&/X/.test(w.z3)));
    assert.equal(x1Writes.length,1,'MISS x1 must render one X impact frame');
    assert.equal(x1Writes[0].z3.replace(/\s+/g,''),'S/D/X','MISS x1 must preserve darts 1+2');

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
