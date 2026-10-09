// SC-074 prototype: the scheduled current row stays fixed while ONLY history
// moves in the existing scroll viewport. Tests the actual app, not a replica.
// The shared harness blocks every production Supabase request/write.
const assert = require('node:assert/strict');
const H = require('./harness');

async function ready(page,count,width){
  await page.setViewportSize({width,height:width===320?568:844});
  const token=await page.evaluate(n=>{
    const previous=Number(state.__gameToken||0);
    state=JSON.parse(JSON.stringify(baseState));
    state.__gameToken=previous;
    state.players=Array.from({length:n},(_,i)=>({
      id:'sc074-'+i,name:'PIN '+i,initials:'P'+i,avatar_id:i+1,color:'#ff7a00'
    }));
    assignUniqueColors(state.players);
    state.match={id:'sc074-offline',gameNumber:1,targetWins:3,
      autoRotateOrder:true,wins:Array(n).fill(0),history:[],mode:'match',
      gameFormat:'match_play',gameVariant:'classic'};
    startNewGame(false);
    return previous+1;
  },count);
  await page.click('.to-start');
  await page.waitForFunction(expected=>{
    return document.body.dataset.page==='game'
      && Number(state.__gameToken||0)===expected
      && !state.__sqSecurityPreparing
      && !window.__sqSecurityInputBlocked
      && !!state.__sqGameControl
      && window.SQ_GAMEPLAY?.hasCachedController(state)
      && window.SQ_GAMEPLAY?.canThrow()
      && document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true';
  },token);
  await page.evaluate(()=>{
    let guard=0;
    while(state.currentRound<9 && guard++<190){
      recordThrow({kind:'S',number:ROUNDS[state.currentRound].target});
    }
    if(state.currentRound!==9)throw Error('SC074 canonical fixture did not reach Round 19');
  });
  await page.waitForFunction(()=>document.querySelector('#v2Rows .v2Badge.liveRow')?.dataset.round==='9');
  await page.waitForFunction(()=>{
    const rows=document.getElementById('v2Rows');
    const own=document.getElementById('liveV2Panel').__sqV2Wall?.animation;
    return [own,...rows.getAnimations()].every(a=>!a || (!a.pending&&!['running','paused'].includes(a.playState)));
  });
  await page.waitForTimeout(200);
}
async function layout(page) {
  return page.evaluate(()=>{
    const panel=document.getElementById('liveV2Panel');
    const wrap=panel.querySelector('.v2RowsWrap');
    const rows=document.getElementById('v2Rows');
    const live=rows.querySelector('.v2Badge.liveRow');
    const cells=[...rows.querySelectorAll('.v2Cell.liveRow')];
    const history=rows.querySelector('.v2Badge[data-round="3"]');
    const rect=n=>{const b=n.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
    return {
      viewport:rect(wrap),scrollTop:wrap.scrollTop,maxScroll:wrap.scrollHeight-wrap.clientHeight,
      live:rect(live),cells:cells.map(rect),older:rect(history),
      current:state.currentRound,player:state.currentPlayer,dart:state.currentDart,
      historyLen:state.history.length,score:JSON.stringify(state.score),
      count:state.players.length,liveRound:Number(live.dataset.round),
      duplicates:rows.querySelectorAll('.v2Badge.liveRow').length,
      styles:{outer:getComputedStyle(wrap).overflowY,
        inner:getComputedStyle(rows).overflowY,
        sticky:getComputedStyle(live).position}
    };
  });
}
(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page,{settle:800});
    for(const {count,width} of [{count:2,width:390},{count:5,width:320}]){
      await ready(page,count,width);
      let home=await layout(page);
      assert.equal(home.liveRound,9,'single scheduled current round');
      assert.equal(home.duplicates,1,'no duplicate score truth');
      assert(home.maxScroll>70,'actual historical scrolling required');
      await page.evaluate(()=>{
        const wrap=document.querySelector('#liveV2Panel .v2RowsWrap');
        wrap.scrollTop=wrap.scrollHeight;
      });
      await page.waitForTimeout(100);
      home=await layout(page);
      await page.evaluate(()=>{document.querySelector('#liveV2Panel .v2RowsWrap').scrollTop=0;});
      await page.waitForTimeout(100);
      const back=await layout(page);
      assert(back.scrollTop<home.scrollTop-40,'history scroller must move to older rounds');
      assert(Math.abs(back.older.top-home.older.top)>40,'completed history must move independently');
      assert(Math.abs(back.live.top-home.live.top)<2,'current row moved when browsing history');
      for(let i=0;i<home.cells.length;i++){
        assert(Math.abs(back.cells[i].top-home.cells[i].top)<2,'player '+i+' current cell moved while history scrolled');
      }
      assert.deepEqual(
        [back.current,back.player,back.dart,back.historyLen,back.score],
        [home.current,home.player,home.dart,home.historyLen,home.score],
        'scrolling modified canonical game state');
      assert(back.live.bottom<=back.viewport.bottom+1,'current row clipped at viewport bottom');
      await page.evaluate(()=>recordThrow({kind:'S',number:ROUNDS[state.currentRound].target}));
      await page.waitForFunction(()=>{
        const w=document.querySelector('#liveV2Panel .v2RowsWrap');
        return w.scrollHeight-w.scrollTop-w.clientHeight<8;
      });
      const scored=await layout(page);
      assert.equal(scored.historyLen,home.historyLen+1,'score entry did not create one dart');
      assert.equal(scored.liveRound,9,'scoring changed current table round');
      await page.evaluate(()=>undo());
      await page.waitForFunction(expected=>state.history.length===expected,home.historyLen);
      assert.equal((await layout(page)).historyLen,home.historyLen,'Undo changed history length');
      console.log('SC074 prototype PASS '+width+'px/'+count+' players: history moved, current row fixed, state untouched, scoring snaps back, Undo correct');
    }
    const err=consoleErrs.filter(x=>!(/supabase|Failed to fetch|Fetch API|NetworkError/i.test(x)));
    assert.deepEqual(err,[],'unexpected browser errors');
  }finally{
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
