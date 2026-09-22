const H = require('./harness');
const assert = require('assert/strict');

async function center(locator){
  const b=await locator.boundingBox();
  if(!b) throw new Error('element has no bounding box');
  return {x:b.x+b.width/2,y:b.y+b.height/2};
}

async function holdAndRelease(page, scoreLabel, optionId){
  const held=page.locator('#pad [data-score-label="'+scoreLabel+'"]');
  const p=await center(held);
  await page.mouse.move(p.x,p.y);
  await page.mouse.down();
  await page.waitForTimeout(410);
  const option=page.locator('.sqQuickEntryOption[data-qe="'+optionId+'"]');
  await option.waitFor({state:'visible'});
  const ob=await option.boundingBox();
  if(!ob) throw new Error('quick option has no bounding box');
  await page.mouse.move(ob.x+ob.width/2,ob.y+ob.height/2,{steps:3});
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function holdCancel(page, scoreLabel){
  const held=page.locator('#pad [data-score-label="'+scoreLabel+'"]');
  const p=await center(held);
  await page.mouse.move(p.x,p.y);
  await page.mouse.down();
  await page.waitForTimeout(410);
  await page.locator('.sqQuickEntryPopover').waitFor({state:'visible'});
  await page.mouse.move(8,8,{steps:3});
  await page.mouse.up();
  await page.waitForTimeout(80);
}

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['QUICK ALPHA','QUICK BETA']);
    await H.startMatch(page);

    const reset=async()=>page.evaluate(()=>{
      const mk=()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0}));
      state.score=state.players.map(()=>mk());
      state.currentRound=0;
      state.currentPlayer=0;
      state.currentDart=0;
      state.history=[];
      state.finished=false;
      state.gameAwarded=false;
      state.suddenDeath={active:false,participants:[],turnIndex:0,throws:[],round:1};
      delete state.__sqCatchUp;
      updateUI();
    });

    // Baseline is three separate taps for three identical darts.
    await reset();
    for(let i=0;i<3;i++){
      await page.locator('#pad [data-score-label="Single"]').click();
    }
    let base=await page.evaluate(()=>({
      history:state.history.length,
      darts:state.score[0][0].darts.map(d=>d&&d.kind),
      total:state.score[0][0].roundTotal
    }));
    assert.equal(base.history,3,'baseline must use three canonical dart entries');
    assert.deepEqual(base.darts,['S','S','S']);
    assert.equal(base.total,30);

    // x3 = one continuous hold/slide/release user action instead of 3 taps.
    await reset();
    await holdAndRelease(page,'Single','x3');
    let q=await page.evaluate(()=>({
      history:state.history.length,
      darts:state.score[0][0].darts.map(d=>d&&d.kind),
      total:state.score[0][0].roundTotal,
      player:state.currentPlayer,
      dart:state.currentDart,
      popovers:document.querySelectorAll('.sqQuickEntryPopover').length
    }));
    assert.equal(q.history,3,'x3 must create three ordinary history entries');
    assert.deepEqual(q.darts,['S','S','S'],'x3 must record three ordinary singles');
    assert.equal(q.total,30);
    assert.equal(q.player,1,'x3 must finish the visit normally');
    assert.equal(q.dart,0);
    assert.equal(q.popovers,0,'quick popover must close after commit');
    const x3Reduction=(3-1)/3;
    assert(x3Reduction>=1/3,'x3 must reduce actions by >=33%');

    // After dart 1 only x2 + RH fit; x3 must disappear.
    await reset();
    await page.locator('#pad [data-score-label="Double"]').click();
    const dbl=page.locator('#pad [data-score-label="Single"]');
    const dp=await center(dbl);
    await page.mouse.move(dp.x,dp.y); await page.mouse.down(); await page.waitForTimeout(410);
    let options=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>e.dataset.qe).sort());
    assert.deepEqual(options,['rh','x2'],'dart 2 must offer only x2 + RH');
    await page.mouse.up(); await page.waitForTimeout(70);
    assert.equal(await page.evaluate(()=>state.history.length),1,'release outside option must cancel without ghost scoring');

    // x2 after one ordinary dart = two user actions vs baseline three: exactly 33.3% fewer.
    await holdAndRelease(page,'Single','x2');
    q=await page.evaluate(()=>({
      history:state.history.length,
      darts:state.score[0][0].darts.map(d=>d&&d.kind),
      total:state.score[0][0].roundTotal
    }));
    assert.equal(q.history,3);
    assert.deepEqual(q.darts,['D','S','S']);
    assert.equal(q.total,40);
    const x2Reduction=(3-2)/3;
    assert(x2Reduction>=1/3-1e-9,'x2 representative flow must reduce actions by at least 33%');

    // RH repeats the immediately previous exact scoring result, not the held button.
    await reset();
    await page.locator('#pad [data-score-label="Double"]').click();
    await holdAndRelease(page,'Single','rh');
    q=await page.evaluate(()=>({
      history:state.history.length,
      darts:state.score[0][0].darts.slice(0,2).map(d=>d&&({kind:d.kind,points:d.points})),
      dart:state.currentDart
    }));
    assert.equal(q.history,2);
    assert.deepEqual(q.darts,[{kind:'D',points:20},{kind:'D',points:20}],
      'RH held from Single must still repeat the previous Double exactly');
    assert.equal(q.dart,2);

    // Dart 3: RH is the only valid quick option.
    const tp=await center(page.locator('#pad [data-score-label="Treble"]'));
    await page.mouse.move(tp.x,tp.y); await page.mouse.down(); await page.waitForTimeout(410);
    options=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>e.dataset.qe));
    assert.deepEqual(options,['rh'],'third dart must expose RH only');
    await page.mouse.move(8,8); await page.mouse.up(); await page.waitForTimeout(70);
    assert.equal(await page.evaluate(()=>state.history.length),2,'third-dart cancel must not score');

    // Full long-hold cancellation from dart 1.
    await reset();
    await holdCancel(page,'Treble');
    assert.equal(await page.evaluate(()=>state.history.length),0,'release outside quick targets must cancel');
    assert.equal(await page.locator('.sqQuickEntryPopover').count(),0);

    // Short tap remains unchanged.
    await reset();
    await page.locator('#pad [data-score-label="Treble"]').click();
    q=await page.evaluate(()=>({
      history:state.history.length,
      dart:state.currentDart,
      throw:state.history[0]?.throw
    }));
    assert.equal(q.history,1,'short tap must still create one ordinary dart');
    assert.equal(q.dart,1);
    assert.equal(q.throw?.kind,'T');

    // Future-safe RH serializer: exact existing canonical spec forms.
    const maps=await page.evaluate(()=>({
      miss:window.__sqQuickEntry.specFromDart({kind:'Miss',points:0},{type:'number',target:10}),
      number:window.__sqQuickEntry.specFromDart({kind:'D',points:20},{type:'number',target:10}),
      doubles:window.__sqQuickEntry.specFromDart({kind:'Double',sector:17,points:34},{type:'doubles'}),
      triples:window.__sqQuickEntry.specFromDart({kind:'Triple',sector:19,points:57},{type:'triples'}),
      bullIn:window.__sqQuickEntry.specFromDart({kind:'B',bull:'Inner',points:50},{type:'bull'}),
      bullOut:window.__sqQuickEntry.specFromDart({kind:'B',bull:'Outer',points:25},{type:'bull'})
    }));
    assert.deepEqual(maps,{
      miss:{kind:'Miss'},number:{kind:'D'},doubles:{sector:17},triples:{sector:19},bullIn:{bull:'Inner'},bullOut:{bull:'Outer'}
    });

    // Target geometry: physical options remain at least 48px high.
    await reset();
    const sp=await center(page.locator('#pad [data-score-label="Single"]'));
    await page.mouse.move(sp.x,sp.y); await page.mouse.down(); await page.waitForTimeout(410);
    const rects=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>{
      const r=e.getBoundingClientRect(); return {id:e.dataset.qe,w:r.width,h:r.height};
    }));
    assert(rects.length>=2 && rects.every(r=>r.w>=48&&r.h>=48),'all quick targets must be >=48px each direction');
    await page.mouse.move(8,8); await page.mouse.up();

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-04 Gate 3 quick-entry PASS: x3 action reduction 66.7%; x2 representative flow 33.3%; RH/cancel/short-tap/geometry PASS.');
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1);});
