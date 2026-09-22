const H = require('./harness');
const assert = require('assert/strict');

async function center(locator){
  const b=await locator.boundingBox();
  if(!b) throw new Error('element has no bounding box');
  return {x:b.x+b.width/2,y:b.y+b.height/2};
}

async function openHold(page,label){
  const held=page.locator('#pad [data-score-label="'+label+'"]');
  const p=await center(held);
  await page.mouse.move(p.x,p.y);
  await page.mouse.down();
  await page.waitForTimeout(410);
  await page.locator('.sqQuickEntryPopover').waitFor({state:'visible'});
  return held;
}

async function releaseOn(page,id){
  const option=page.locator('.sqQuickEntryOption[data-qe="'+id+'"]');
  const b=await option.boundingBox();
  if(!b) throw new Error('quick option has no bounding box: '+id);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:3});
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function releaseAway(page){
  await page.mouse.move(8,8,{steps:3});
  await page.mouse.up();
  await page.waitForTimeout(80);
}

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['IPHONE ALPHA','IPHONE BETA']);
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
      state.matchAgg={hits:[{},{}],totals60:[0,0],totals100:[0,0],totals140:[0,0]};
      delete state.__sqCatchUp;
      updateUI();
    });

    // First dart: x2/x3 still work and x3 retains the accepted 66.7% action reduction.
    await reset();
    let held=await openHold(page,'Single');
    let opts=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>e.dataset.qe).sort());
    assert.deepEqual(opts,['x2','x3'],'dart 1 should expose x2/x3 only');
    const stable=await page.evaluate(()=>{
      const p=document.querySelector('.sqQuickEntryPopover');
      const h=document.querySelector('#pad [data-score-label="Single"]');
      const pc=getComputedStyle(p), hc=getComputedStyle(h);
      return {
        popTransform:pc.transform,
        popAnimation:pc.animationName,
        popBackdrop:pc.backdropFilter || pc.webkitBackdropFilter || 'none',
        heldUserSelect:hc.userSelect || hc.webkitUserSelect,
        heldTouchCallout:h.style.webkitTouchCallout || ''
      };
    });
    assert.equal(stable.popTransform,'none','quick popover must not transform/scale');
    assert.equal(stable.popAnimation,'none','quick popover must not animate/scale');
    assert.equal(stable.popBackdrop,'none','quick popover must not use backdrop-filter');
    assert.equal(stable.heldUserSelect,'none','held score button must suppress selection');
    assert.equal(stable.heldTouchCallout,'none','held score button must suppress iOS callout');
    await releaseOn(page,'x3');
    let q=await page.evaluate(()=>({
      history:state.history.length,
      darts:state.score[0][0].darts.map(d=>d&&d.kind),
      total:state.score[0][0].roundTotal
    }));
    assert.deepEqual(q,{history:3,darts:['S','S','S'],total:30});

    // Dart 2 after Double: RH must NOT appear from Single/Treble.
    await reset();
    await page.locator('#pad [data-score-label="Double"]').click();
    held=await openHold(page,'Single');
    opts=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>e.dataset.qe).sort());
    assert.deepEqual(opts,['x2'],'after D, holding S may offer x2 but never RH');
    await releaseAway(page);
    assert.equal(await page.evaluate(()=>state.history.length),1,'release-away must remain a no-op');

    held=await openHold(page,'Double');
    opts=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>e.dataset.qe).sort());
    assert.deepEqual(opts,['rh','x2'],'after D, only D may expose RH alongside valid x2');
    await releaseAway(page);
    assert.equal(await page.evaluate(()=>state.history.length),1);

    // Representative x2 remains exactly 33.3% fewer user actions.
    held=await openHold(page,'Single');
    await releaseOn(page,'x2');
    q=await page.evaluate(()=>({
      history:state.history.length,
      darts:state.score[0][0].darts.map(d=>d&&d.kind),
      total:state.score[0][0].roundTotal
    }));
    assert.deepEqual(q,{history:3,darts:['D','S','S'],total:40});

    // RH repeats the immediately previous dart, and only from its matching button.
    await reset();
    await page.locator('#pad [data-score-label="Double"]').click();
    held=await openHold(page,'Double');
    await releaseOn(page,'rh');
    q=await page.evaluate(()=>({
      history:state.history.length,
      dart:state.currentDart,
      darts:state.score[0][0].darts.slice(0,2).map(d=>d&&({kind:d.kind,points:d.points}))
    }));
    assert.deepEqual(q,{
      history:2,dart:2,
      darts:[{kind:'D',points:20},{kind:'D',points:20}]
    },'RH must repeat the immediately previous exact result');

    // Dart 3: no x2/x3 anywhere; only the button matching dart 2 may expose RH.
    const third=await page.evaluate(()=>({
      s:window.__sqQuickEntry.options({kind:'S'}).map(o=>o.id),
      d:window.__sqQuickEntry.options({kind:'D'}).map(o=>o.id),
      t:window.__sqQuickEntry.options({kind:'T'}).map(o=>o.id)
    }));
    assert.deepEqual(third,{s:[],d:['rh'],t:[]},
      'dart 3 long-press must be inactive except RH on the exact prior-result button');

    held=await openHold(page,'Double');
    opts=await page.locator('.sqQuickEntryOption').evaluateAll(els=>els.map(e=>e.dataset.qe));
    assert.deepEqual(opts,['rh'],'matching dart-3 hold must expose RH only');
    await releaseAway(page);
    assert.equal(await page.evaluate(()=>state.history.length),2,'dart-3 RH release-away must cancel');

    // Previous miss has no known scoring button/location, so RH must not be offered.
    await reset();
    await page.evaluate(()=>recordThrow({kind:'Miss'}));
    const afterMiss=await page.evaluate(()=>({
      s:window.__sqQuickEntry.options({kind:'S'}).map(o=>o.id),
      d:window.__sqQuickEntry.options({kind:'D'}).map(o=>o.id),
      t:window.__sqQuickEntry.options({kind:'T'}).map(o=>o.id)
    }));
    assert.deepEqual(afterMiss,{s:['x2'],d:['x2'],t:['x2']},
      'a miss may still use x2 for a new scoring choice but cannot expose RH');

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-04 Gate 5 iPhone corrections PASS: no-transform/no-backdrop hold UI; RH exact previous-button only; dart-3 RH-only; x2/x3 efficiencies preserved.');
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1);});
