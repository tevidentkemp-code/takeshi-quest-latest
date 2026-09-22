const H = require('./harness');
const assert = require('assert/strict');

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['BLOCK ALPHA','BLOCK BETA']);
    await H.startMatch(page);

    await page.evaluate(()=>{
      window.__sxp04Gate2Writes=[];
      if(!window.__sxp04Gate2OriginalShowZones) window.__sxp04Gate2OriginalShowZones=window.sqDmdShowZones;
      window.sqDmdShowZones=function(zones,opts){
        try{
          window.__sxp04Gate2Writes.push({
            at:performance.now(),
            z2:String(zones?.z2||''),
            z3:String(zones?.z3||''),
            requestedMs:Number(opts?.ms||0)
          });
        }catch(_){}
        const forced=Object.assign({},opts||{},{ms:5000});
        return window.__sxp04Gate2OriginalShowZones.apply(this,[zones,forced]);
      };
    });

    async function reset(shadow=false){
      await page.evaluate((shadow)=>{
        const mk=()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0}));
        state.players=shadow
          ? [
              {id:'real',name:'BLOCK ALPHA',initials:'BA',type:'guest'},
              {id:'shadow',name:'BLOCK SHADOW',initials:'BS',type:'shadow',isShadow:true,virtual:true}
            ]
          : [
              {id:'p0',name:'BLOCK ALPHA',initials:'BA',type:'guest'},
              {id:'p1',name:'BLOCK BETA',initials:'BB',type:'guest'}
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
          gameFormat:'match_play',
          gameNumber:1,
          targetWins:1,
          wins:[0,0],
          history:[]
        });
        delete state.__sqCatchUp;
        if(shadow){
          state.match.practiceType='vsshadow';
          state.shadow={
            mode:'vsshadow',
            status:'runtime_phase_test',
            autoTurnEnabled:false,
            completionEnabled:true,
            shadowPlayerIndex:1,
            activeGameIndex:0,
            games:[],
            autoTurnPending:false,
            autoTurnInProgress:false
          };
        }else{
          delete state.match.practiceType;
          delete state.match.practice_type;
          try{ delete state.shadow; }catch(_){ state.shadow=undefined; }
        }
        window.__sxp04Gate2Writes=[];
        updateUI();
      },shadow);
      await page.waitForSelector('#pad .dtActBtn.skip',{state:'visible'});
    }

    const clickMeasure=async(selector)=>page.evaluate((selector)=>{
      const btn=document.querySelector(selector);
      if(!btn) throw new Error('missing control '+selector);
      const before={
        history:Array.isArray(state.history)?state.history.length:0,
        player:Number(state.currentPlayer||0),
        round:Number(state.currentRound||0),
        dart:Number(state.currentDart||0)
      };
      const t0=performance.now();
      btn.click();
      return {
        ms:performance.now()-t0,
        before,
        after:{
          history:Array.isArray(state.history)?state.history.length:0,
          player:Number(state.currentPlayer||0),
          round:Number(state.currentRound||0),
          dart:Number(state.currentDart||0)
        },
        skipFlag:!!window.__sqSkipInProgress,
        writes:(window.__sxp04Gate2Writes||[]).slice()
      };
    },selector);

    await reset(false);
    let r=await clickMeasure('#pad [data-score-label="Single"]');
    assert(r.ms<100,'SCORE handler blocked by presentation: '+r.ms.toFixed(1)+'ms');
    assert.equal(r.after.history-r.before.history,1,'SCORE must add one canonical history entry immediately');
    assert.equal(r.after.dart,1,'SCORE must advance one dart immediately');

    await reset(false);
    r=await clickMeasure('#pad .dtActBtn.miss');
    assert(r.ms<100,'MISS handler blocked by presentation: '+r.ms.toFixed(1)+'ms');
    assert.equal(r.after.history-r.before.history,1,'MISS must add one canonical history entry immediately');
    assert.equal(r.after.dart,1,'MISS must advance one dart immediately');

    await reset(false);
    await page.evaluate(()=>recordThrow({kind:'S'}));
    r=await clickMeasure('#pad .dtActBtn.skip');
    assert(r.ms<100,'normal SKIP handler blocked by presentation: '+r.ms.toFixed(1)+'ms');
    assert.equal(r.after.history-r.before.history,2,'mid-visit SKIP must immediately record the two remaining canonical misses');
    assert.equal(r.after.player,1,'mid-visit SKIP must advance to next player immediately');
    assert.equal(r.after.dart,0,'mid-visit SKIP must end the visit immediately');

    await reset(false);
    await page.evaluate(()=>recordThrow({kind:'S'}));
    r=await clickMeasure('#pad .dtActBtn.undo');
    assert(r.ms<100,'UNDO handler blocked by presentation: '+r.ms.toFixed(1)+'ms');
    assert.equal(r.after.history,0,'UNDO must remove canonical history immediately');
    assert.equal(r.after.dart,0,'UNDO must restore the dart cursor immediately');

    await reset(true);
    r=await clickMeasure('#pad .dtActBtn.skip');
    assert(r.ms<100,'Vs Shadow SKIP handler blocked by presentation: '+r.ms.toFixed(1)+'ms');
    assert.equal(r.after.history-r.before.history,3,'Vs Shadow start-of-visit SKIP must immediately use the canonical three-miss history path');
    assert.equal(r.after.player,1,'Vs Shadow SKIP must advance to Shadow immediately');
    assert.equal(r.after.dart,0,'Vs Shadow SKIP must finish the real visit immediately');
    assert.equal(r.skipFlag,false,'Vs Shadow SKIP presentation guard must not remain latched after the state commit');
    assert(r.writes.some(w=>/SKIP GO/i.test(w.z2)),'Vs Shadow SKIP presentation must still be emitted');
    assert(r.writes.some(w=>/SKIP GO/i.test(w.z2) && w.requestedMs===500),'existing 500ms SKIP GO presentation duration must remain presentation-only');

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-04 Gate 2 non-blocking PASS',JSON.stringify({
      note:'All actions mutated state synchronously while DMD renderer was forced to hold scenes for 5000ms.'
    }));
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1);});
