const H = require('./harness');
const assert = require('assert/strict');

const GAME_STORAGE_KEY = 'shateki_quest_scorer_v6';
const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

function clean(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function resetCanonicalFixture(page){
  await page.evaluate(() => {
    const mk = () => Array.from({length:14}, () => ({darts:[null,null,null], roundTotal:0}));
    state.score = state.players.map(() => mk());
    state.currentRound = 0;
    state.currentPlayer = 0;
    state.currentDart = 0;
    state.history = [];
    state.finished = false;
    state.gameAwarded = false;
    state.currentGameIsTiebreak = false;
    state.is_tiebreak = false;
    state.suddenDeath = {active:false,participants:[],turnIndex:0,throws:[],round:1};
    state.matchAgg = null;
    try{ ensureMatchAgg(); }catch(_){}
    delete state.__sqCatchUp;
    delete state.uiLastGo;
    delete state.__uiLastGoToken;
    try{ window.__sqQuickEntry.close(); }catch(_){}
    try{ save(); }catch(_){}
    updateUI();
  });
}

async function captureCanonical(page){
  return page.evaluate((storageKey) => {
    const clone = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
    const project = (st) => {
      if (!st) return null;
      const match = st.match || {};
      return {
        score: clone(st.score || []),
        history: clone(st.history || []),
        cursor: {
          player:Number(st.currentPlayer || 0),
          round:Number(st.currentRound || 0),
          dart:Number(st.currentDart || 0),
          finished:!!st.finished,
          gameAwarded:!!st.gameAwarded,
          suddenDeath:clone(st.suddenDeath || null)
        },
        matchAgg: clone(st.matchAgg || null),
        mode: {
          mode:st.mode ?? null,
          gameMode:st.gameMode ?? null,
          matchMode:match.mode ?? null,
          matchGameMode:match.gameMode ?? null,
          practiceType:match.practiceType ?? st.practiceType ?? null,
          forcePractice:match.forcePractice === true
        },
        match: {
          wins:clone(match.wins || []),
          history:clone(match.history || []),
          targetWins:match.targetWins ?? match.target_wins ?? null,
          gameNumber:match.gameNumber ?? null
        }
      };
    };

    const players = Array.isArray(state.players) ? state.players : [];
    const stats = players.map((_, i) =>
      typeof computeStatsForPlayerGame === 'function' ? clone(computeStatsForPlayerGame(i)) : null
    );
    const liveAverages = players.map((_, i) =>
      typeof __sqV2LiveAveragePair === 'function' ? clone(__sqV2LiveAveragePair(i, Number(state.currentRound || 0))) : null
    );
    let achievements = [];
    try{
      achievements = (window.SQ_ACH && typeof SQ_ACH.detectGame === 'function')
        ? clone(SQ_ACH.detectGame(state.score, {players, is_tiebreak:!!(state.is_tiebreak || state.currentGameIsTiebreak)}) || [])
        : [];
    }catch(_){ achievements = []; }

    try{ save(); }catch(_){}
    let persisted = null;
    try{ persisted = JSON.parse(localStorage.getItem(storageKey) || 'null'); }catch(_){}

    return {
      runtime:project(state),
      persisted:project(persisted),
      stats,
      liveAverages,
      achievements
    };
  }, storageKey);
}

async function ordinary(page, specs){
  await resetCanonicalFixture(page);
  await page.evaluate((items) => items.forEach(spec => recordThrow(spec)), specs);
  return captureCanonical(page);
}

async function quickX3(page, spec){
  await resetCanonicalFixture(page);
  const result = await page.evaluate((s) => window.__sqQuickEntry.commit(s, 3), spec);
  assert.deepEqual(result.requested, 3, 'x3 fixture must request three darts');
  assert.deepEqual(result.committed, 3, 'x3 fixture must commit three canonical darts');
  return captureCanonical(page);
}

async function quickAfterPrefix(page, prefix, spec, count){
  await resetCanonicalFixture(page);
  const result = await page.evaluate(({prefix,spec,count}) => {
    prefix.forEach(item => recordThrow(item));
    return window.__sqQuickEntry.commit(spec, count);
  }, {prefix,spec,count});
  assert.equal(result.committed, count, 'quick repeat must commit the requested canonical darts');
  return captureCanonical(page);
}

async function rhAfterPrefix(page, firstSpec, heldSpec, suffix=[]){
  await resetCanonicalFixture(page);
  const outcome = await page.evaluate(({firstSpec,heldSpec,suffix}) => {
    recordThrow(firstSpec);
    const rh = window.__sqQuickEntry.options(heldSpec).find(opt => opt.id === 'rh');
    if (!rh) return {found:false, committed:0};
    const result = window.__sqQuickEntry.commit(rh.spec, rh.count);
    suffix.forEach(item => recordThrow(item));
    return {found:true, committed:result.committed, rhSpec:rh.spec};
  }, {firstSpec,heldSpec,suffix});
  assert(outcome.found, 'RH option must be available after an ordinary first dart');
  assert.equal(outcome.committed, 1, 'RH must commit exactly one canonical dart');
  return {snapshot:await captureCanonical(page), outcome};
}

async function undoSnapshot(page){
  await page.evaluate(() => {
    undo();
    try{ save(); }catch(_){}
  });
  return captureCanonical(page);
}

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['EQUIV ALPHA','EQUIV BETA']);
    await H.startMatch(page);

    assert.equal(await page.evaluate(() => typeof window.__sqQuickEntry?.commit), 'function', 'Gate 3 quick-entry API must be present');

    // x3: identical number-round scoring must be canonical in every state surface.
    const normalX3 = await ordinary(page,[{kind:'S'},{kind:'S'},{kind:'S'}]);
    const quick3 = await quickX3(page,{kind:'S'});
    assert.deepEqual(quick3, normalX3, 'x3 must be 100% equivalent to three ordinary Single entries');

    // Undo after x3: quick-entry history must unwind exactly like ordinary history.
    await resetCanonicalFixture(page);
    await page.evaluate(() => [{kind:'S'},{kind:'S'},{kind:'S'}].forEach(recordThrow));
    const normalAfterUndo = await undoSnapshot(page);
    await resetCanonicalFixture(page);
    await page.evaluate(() => window.__sqQuickEntry.commit({kind:'S'},3));
    const quickAfterUndo = await undoSnapshot(page);
    assert.deepEqual(quickAfterUndo, normalAfterUndo, 'Undo after x3 must restore identical canonical state/history/stats/persistence');

    // x2 after a normal first dart: exact mixed-visit parity.
    const normalX2 = await ordinary(page,[{kind:'D'},{kind:'S'},{kind:'S'}]);
    const quick2 = await quickAfterPrefix(page,[{kind:'D'}],{kind:'S'},2);
    assert.deepEqual(quick2, normalX2, 'x2 must be 100% equivalent to two ordinary repeated darts after a prefix dart');

    // RH: held-button identity is irrelevant; exact previous scoring result is repeated.
    const normalRh = await ordinary(page,[{kind:'D'},{kind:'D'},{kind:'S'}]);
    const quickRh = await rhAfterPrefix(page,{kind:'D'},{kind:'S'},[{kind:'S'}]);
    assert.deepEqual(quickRh.snapshot, normalRh, 'RH must be 100% equivalent to manually repeating the previous exact result');
    assert.deepEqual(quickRh.outcome.rhSpec,{kind:'D'},'RH on number rounds must serialize the prior Double exactly');

    // Miss serializer, special-round sectors and Bulls must remain canonical reference forms.
    const serializer = await page.evaluate(() => ({
      miss:window.__sqQuickEntry.specFromDart({kind:'Miss',points:0},{type:'number',target:10}),
      number:window.__sqQuickEntry.specFromDart({kind:'T',points:30},{type:'number',target:10}),
      doubles:window.__sqQuickEntry.specFromDart({kind:'Double',sector:17,points:34},{type:'doubles'}),
      triples:window.__sqQuickEntry.specFromDart({kind:'Triple',sector:19,points:57},{type:'triples'}),
      bullOuter:window.__sqQuickEntry.specFromDart({kind:'B',bull:'Outer',points:25},{type:'bull'}),
      bullInner:window.__sqQuickEntry.specFromDart({kind:'B',bull:'Inner',points:50},{type:'bull'})
    }));
    assert.deepEqual(serializer,{
      miss:{kind:'Miss'},
      number:{kind:'T'},
      doubles:{sector:17},
      triples:{sector:19},
      bullOuter:{bull:'Outer'},
      bullInner:{bull:'Inner'}
    },'RH serializer must preserve canonical recordThrow spec forms across round families');

    // Guard boundaries: count is clamped to remaining darts and cannot spill into the next player/round.
    await resetCanonicalFixture(page);
    await page.evaluate(() => recordThrow({kind:'D'}));
    const clamp = await page.evaluate(() => window.__sqQuickEntry.commit({kind:'T'},3));
    assert.equal(clamp.requested,2,'repeat count must clamp to two remaining darts');
    assert.equal(clamp.committed,2,'clamped repeat must commit only those two darts');
    const clampState = await page.evaluate(() => ({
      history:state.history.length,
      first:state.score[0][0].darts.map(d=>d&&d.kind),
      nextPlayer:state.currentPlayer,
      nextDart:state.currentDart,
      nextBoard:state.score[1][0].darts.slice()
    }));
    assert.deepEqual(clampState.first,['D','T','T']);
    assert.equal(clampState.history,3);
    assert.equal(clampState.nextPlayer,1);
    assert.equal(clampState.nextDart,0);
    assert(clampState.nextBoard.every(d=>d==null),'quick repeat must never spill onto the next player');

    // Mode identity is a protected canonical field: quick entry must not rewrite it.
    for (const marker of [
      {mode:'match',gameMode:'classic',matchMode:'match',matchGameMode:'classic'},
      {mode:'practice',gameMode:'practice',matchMode:'practice',matchGameMode:'practice'},
      {mode:'turbo',gameMode:'turbo',matchMode:'turbo',matchGameMode:'turbo'}
    ]){
      await resetCanonicalFixture(page);
      const before = await page.evaluate((m) => {
        state.mode=m.mode; state.gameMode=m.gameMode;
        state.match=state.match||{}; state.match.mode=m.matchMode; state.match.gameMode=m.matchGameMode;
        return {mode:state.mode,gameMode:state.gameMode,matchMode:state.match.mode,matchGameMode:state.match.gameMode};
      }, marker);
      await page.evaluate(() => window.__sqQuickEntry.commit({kind:'S'},2));
      const after = await page.evaluate(() => ({mode:state.mode,gameMode:state.gameMode,matchMode:state.match?.mode,matchGameMode:state.match?.gameMode}));
      assert.deepEqual(after,before,marker.mode+' quick entry must not rewrite mode identity');
    }

    // No hidden second truth: quick layer itself owns no history write, persistence write,
    // aggregate mutation or score assignment; all scoring is delegated to recordThrow.
    const quickSource = await page.evaluate(() => ({
      commit:String(window.__sqQuickEntry.commit),
      options:String(window.__sqQuickEntry.options)
    }));
    assert(quickSource.commit.includes('recordThrow('),'quick commit must delegate to canonical recordThrow');
    assert(!/history\.push|localStorage\.|matchAgg\.|roundTotal\s*=|\.darts\s*\[/.test(quickSource.commit),
      'quick commit must not own score/history/persistence mutation');

    const unexpected=consoleErrs.filter(e=>!BROWSER_NOISE.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-04 Gate 4 equivalence PASS: x3/x2/RH runtime + history + Undo + stats/averages + achievements + persistence are canonical-equivalent; repeat clamp and mode identity PASS.');
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1);});
