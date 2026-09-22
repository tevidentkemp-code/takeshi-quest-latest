const H = require('./harness');
const assert = require('assert/strict');

const STORAGE_FALLBACK='shateki_quest_scorer_v6';

function stable(value){ return JSON.parse(JSON.stringify(value)); }

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['EQUIV ALPHA','EQUIV BETA']);
    await H.startMatch(page);

    await page.waitForFunction(() =>
      window.__sqQuickEntry &&
      typeof window.__sqQuickEntry.commit === 'function' &&
      typeof window.__sqQuickEntry.specFromDart === 'function' &&
      typeof window.computeMatchAverages === 'function' &&
      window.SQ_ACH && typeof window.SQ_ACH.detectGame === 'function'
    );

    async function reset({mode='classic', round=0, shadow=false}={}){
      await page.evaluate(({mode,round,shadow})=>{
        try{ window.__sqDmdHardClearQueue?.(); }catch(_){}
        try{ window.__sqClearVsShadowTimers?.('sxp04-gate4-reset'); }catch(_){}
        const mk=()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0}));
        const real={id:'eq-real',name:'EQUIV ALPHA',initials:'EA',type:'guest'};
        const other=shadow
          ? {id:'eq-shadow',name:'EQUIV SHADOW',initials:'ES',type:'shadow',isShadow:true,virtual:true}
          : {id:'eq-beta',name:'EQUIV BETA',initials:'EB',type:'guest'};
        state.players=[real,other];
        state.score=state.players.map(()=>mk());
        state.currentRound=Number(round||0);
        state.currentPlayer=0;
        state.currentDart=0;
        state.history=[];
        state.finished=false;
        state.gameAwarded=false;
        state.suddenDeath={active:false,participants:[],turnIndex:0,throws:[],round:1};
        state.matchAgg={hits:[{},{}],totals60:[0,0],totals100:[0,0],totals140:[0,0]};
        delete state.__sqCatchUp;
        delete state.uiLastGo;
        delete state.__uiLastGoToken;

        state.match=Object.assign({},state.match||{},{
          gameFormat:'match_play',
          gameNumber:1,
          targetWins:3,
          wins:[0,0],
          history:[],
          gameMode:mode
        });
        state.gameMode=mode;
        state.mode=mode;
        delete state.match.practiceType;
        delete state.match.practice_type;
        try{ delete state.shadow; }catch(_){ state.shadow=undefined; }

        if(mode==='practice'){
          state.match.practiceType='practice';
        }else if(mode==='turbo'){
          state.match.gameMode='turbo';
        }else if(mode==='vsshadow'){
          state.gameMode='practice';
          state.mode='practice';
          state.match.gameMode='practice';
          state.match.practiceType='vsshadow';
          state.shadow={
            mode:'vsshadow',
            status:'runtime_phase_gate4',
            autoTurnEnabled:false,
            completionEnabled:true,
            shadowPlayerIndex:1,
            activeGameIndex:0,
            games:[],
            autoTurnPending:false,
            autoTurnInProgress:false,
            savePolicy:'real-only'
          };
        }
        save();
        updateUI();
      },{mode,round,shadow});
      await page.waitForSelector('#pad',{state:'visible'});
    }

    async function snapshot(){
      return page.evaluate(()=>{
        const key=(typeof STORAGE_KEY!=='undefined' && STORAGE_KEY) ? STORAGE_KEY : 'shateki_quest_scorer_v6';
        try{ save(); }catch(_){}
        let persisted=null;
        try{ persisted=JSON.parse(localStorage.getItem(key)||'null'); }catch(_){ persisted=null; }

        const pick=(s)=>s?({
          score:JSON.parse(JSON.stringify(s.score||[])),
          history:JSON.parse(JSON.stringify(s.history||[])),
          currentRound:Number(s.currentRound||0),
          currentPlayer:Number(s.currentPlayer||0),
          currentDart:Number(s.currentDart||0),
          finished:!!s.finished,
          gameAwarded:!!s.gameAwarded,
          suddenDeath:JSON.parse(JSON.stringify(s.suddenDeath||null)),
          matchAgg:JSON.parse(JSON.stringify(s.matchAgg||null)),
          catchUp:JSON.parse(JSON.stringify(s.__sqCatchUp||null)),
          gameMode:String(s.gameMode||''),
          mode:String(s.mode||''),
          match:{
            gameFormat:String(s.match?.gameFormat||''),
            gameMode:String(s.match?.gameMode||''),
            practiceType:String(s.match?.practiceType||s.match?.practice_type||''),
            gameNumber:Number(s.match?.gameNumber||0),
            targetWins:Number(s.match?.targetWins||0),
            wins:JSON.parse(JSON.stringify(s.match?.wins||[])),
            history:JSON.parse(JSON.stringify(s.match?.history||[]))
          },
          shadow:s.shadow?{
            mode:String(s.shadow.mode||''),
            status:String(s.shadow.status||''),
            autoTurnEnabled:!!s.shadow.autoTurnEnabled,
            completionEnabled:!!s.shadow.completionEnabled,
            shadowPlayerIndex:Number(s.shadow.shadowPlayerIndex??-1),
            activeGameIndex:Number(s.shadow.activeGameIndex||0),
            autoTurnPending:!!s.shadow.autoTurnPending,
            autoTurnInProgress:!!s.shadow.autoTurnInProgress,
            savePolicy:String(s.shadow.savePolicy||'')
          }:null
        }):null;

        const averages=JSON.parse(JSON.stringify(window.computeMatchAverages()));
        const achievements=JSON.parse(JSON.stringify(
          window.SQ_ACH.detectGame(state.score,{
            players:state.players,
            is_tiebreak:false
          })
        ));

        return {
          canonical:pick(state),
          persisted:pick(persisted),
          averages,
          achievements
        };
      });
    }

    async function runOrdinary(config,specs,undoCount=0){
      await reset(config);
      await page.evaluate((specs)=>{ specs.forEach(spec=>recordThrow(spec)); },specs);
      let snaps=[await snapshot()];
      for(let i=0;i<undoCount;i++){
        await page.evaluate(()=>undo());
        snaps.push(await snapshot());
      }
      return snaps;
    }

    async function runQuick(config,{prelude=[],spec=null,count=1,rh=false},undoCount=0){
      await reset(config);
      const result=await page.evaluate(({prelude,spec,count,rh})=>{
        prelude.forEach(s=>recordThrow(s));
        let useSpec=spec;
        if(rh){
          const p=Number(state.currentPlayer||0);
          const r=Number(state.currentRound||0);
          const d=Number(state.currentDart||0);
          const prior=state.score?.[p]?.[r]?.darts?.[d-1]||null;
          useSpec=window.__sqQuickEntry.specFromDart(prior,ROUNDS?.[r]);
        }
        return window.__sqQuickEntry.commit(useSpec,count);
      },{prelude,spec,count,rh});
      assert.equal(result.committed,count,'quick commit count mismatch');
      let snaps=[await snapshot()];
      for(let i=0;i<undoCount;i++){
        await page.evaluate(()=>undo());
        snaps.push(await snapshot());
      }
      return snaps;
    }

    function compareSeries(label,a,b){
      assert.equal(a.length,b.length,label+' snapshot-series length differs');
      for(let i=0;i<a.length;i++){
        assert.deepEqual(b[i],a[i],label+' diverged at checkpoint '+i);
      }
    }

    // Classic x3: achievement-sensitive three trebles. Also prove three-step Undo
    // behaves exactly like three ordinary per-dart entries.
    let ordinary=await runOrdinary({mode:'classic'},[{kind:'T'},{kind:'T'},{kind:'T'}],3);
    let quick=await runQuick({mode:'classic'},{spec:{kind:'T'},count:3},3);
    compareSeries('classic x3 T / Undo',ordinary,quick);
    assert(ordinary[0].achievements.some(p=>p.earned?.some(e=>e.code==='treble_trouble')),
      'achievement detector must see treble_trouble in equivalence fixture');

    // Classic mixed x2: one normal dart then two repeated Singles.
    ordinary=await runOrdinary({mode:'classic'},[{kind:'D'},{kind:'S'},{kind:'S'}],1);
    quick=await runQuick({mode:'classic'},{prelude:[{kind:'D'}],spec:{kind:'S'},count:2},1);
    compareSeries('classic mixed x2 / Undo',ordinary,quick);

    // RH: repeat the immediately previous exact canonical result rather than the held button.
    ordinary=await runOrdinary({mode:'classic'},[{kind:'T'},{kind:'T'}],2);
    quick=await runQuick({mode:'classic'},{prelude:[{kind:'T'}],rh:true,count:1},2);
    compareSeries('classic RH exact-repeat / Undo',ordinary,quick);
    assert(ordinary[0].achievements.some(p=>p.earned?.some(e=>e.code==='robin_hood')),
      'achievement detector must see robin_hood after two trebles');

    // Practice: quick entry must not create a second state/history/persistence truth.
    ordinary=await runOrdinary({mode:'practice'},[{kind:'S'},{kind:'S'},{kind:'S'}],1);
    quick=await runQuick({mode:'practice'},{spec:{kind:'S'},count:3},1);
    compareSeries('practice x3',ordinary,quick);

    // Turbo: compare a two-dart quick entry without finishing the visit.
    ordinary=await runOrdinary({mode:'turbo'},[{kind:'D'},{kind:'D'}],1);
    quick=await runQuick({mode:'turbo'},{spec:{kind:'D'},count:2},1);
    compareSeries('turbo x2',ordinary,quick);

    // Vs Shadow: real-player two-dart lane only, so the canonical Shadow turn scheduler
    // is not invoked. Shadow mode metadata must stay byte-for-byte equivalent.
    ordinary=await runOrdinary({mode:'vsshadow',shadow:true},[{kind:'S'},{kind:'S'}],1);
    quick=await runQuick({mode:'vsshadow',shadow:true},{spec:{kind:'S'},count:2},1);
    compareSeries('Vs Shadow real-player x2',ordinary,quick);

    // Explicit history-shape assertion: no batch/quick-entry history type exists.
    const historyShape=quick[0].canonical.history;
    assert.equal(historyShape.length,2,'Vs Shadow fixture must keep two per-dart history entries');
    assert(historyShape.every(h=>h && h.throw && !h.type),
      'quick entry must preserve ordinary per-dart history objects, not batch history');

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-04 Gate 4 equivalence PASS: ordinary vs x2/x3/RH canonical state/history, Undo, averages, achievements, persisted resume state and Classic/Practice/Turbo/Vs Shadow isolation are 100% equal.');
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error('SXP-04 Gate 4 equivalence FAIL');console.error(err&&err.stack||err);process.exit(1);});
