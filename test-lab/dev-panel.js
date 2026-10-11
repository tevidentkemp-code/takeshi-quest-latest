/* SC-060 Test Lab controls. Included only in test-lab-dist, NEVER the public dist. */
(function(){
  'use strict';
  if(!window.__SQ_TEST_LAB?.active)throw new Error('SC-060 offline guard missing: refusing Test Lab startup');
  if(window.__SQ_TEST_LAB_PANEL)return;
  const root=document.createElement('div');
  root.id='sq060-test-lab-root';
  const dom=root.attachShadow({mode:'open'});
  dom.innerHTML=[
    '<link rel="stylesheet" href="./lab/panel.css">',
    '<div class="lab-banner"><b>TEST LAB</b><span>OFFLINE / NO REAL DATA</span><span id="lab-sha">BUILD ...</span></div>',
    '<button class="lab-toggle" type="button" aria-label="Open Shateki Test Lab" aria-expanded="false">LAB</button>',
    '<div class="lab-overlay" hidden></div>',
    '<section class="lab-panel" role="dialog" aria-label="Shateki Test Lab controls" aria-modal="true" hidden>',
    '<header><div><strong>SHATEKI TEST LAB</strong><small>LOCAL FIXTURE • PRODUCTION DISCONNECTED</small></div><button type="button" class="lab-close" aria-label="Close Test Lab">×</button></header>',
    '<div class="lab-contents">',
    '<p>Test-only game states. Nothing entered here is a real match, record, player, or XP award.</p>',
    '<label for="lab-mode">QuickStart mode</label>',
    '<select id="lab-mode"><option value="classic">CLASSIC</option><option value="turbo">TURBO</option><option value="practice">PRACTICE</option></select>',
    '<div class="lab-grid">',
    '<button type="button" data-action="quick2">2-PLAYER QUICKSTART</button>',
    '<button type="button" data-action="quick5">5-PLAYER STRESS</button>',
    '<button type="button" data-action="last">LAST ROUND</button>',
    '<button type="button" data-action="end">END GAME</button>',
    '<button type="button" data-action="xp">XP SCREEN</button>',
    '<button type="button" data-action="won">MATCH WON</button>',
    '<button type="button" data-action="lost">MATCH LOST</button>',
    '<button type="button" data-action="feed">LIVE UPDATES EVENT</button>',
    '<button type="button" data-action="reset" class="danger">RESET LAB</button>',
    '</div>',
    '<p id="lab-status" role="status" aria-live="polite">Ready. Data never reaches production Supabase.</p>',
    '<footer><span id="lab-build">Build identity loading</span><span>Test-only • no backend writes</span></footer>',
    '</div></section>'
  ].join('');
  document.body.appendChild(root);
  const toggle=dom.querySelector('.lab-toggle');
  const overlay=dom.querySelector('.lab-overlay');
  const panel=dom.querySelector('.lab-panel');
  const status=dom.querySelector('#lab-status');
  const buttons=[...dom.querySelectorAll('[data-action]')];
  const mode=dom.querySelector('#lab-mode');
  let busy=false;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function tell(s,failed=false){status.textContent=s;status.classList.toggle('error',failed);}
  function open(on){
    panel.hidden=!on;overlay.hidden=!on;toggle.setAttribute('aria-expanded',String(on));
    if(on)dom.querySelector('.lab-close').focus();else toggle.focus();
  }
  toggle.addEventListener('click',()=>open(panel.hidden));
  dom.querySelector('.lab-close').addEventListener('click',()=>open(false));
  overlay.addEventListener('click',()=>open(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false);});
  async function readyGame(timeout=10000){
    const start=performance.now();
    while(performance.now()-start<timeout){
      if(document.body.dataset.page==='game'&&!state.__sqSecurityPreparing&&!window.__sqSecurityInputBlocked
        &&window.SQ_GAMEPLAY?.hasCachedController(state)&&window.SQ_GAMEPLAY?.canThrow()
        &&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true')return;
      await wait(80);
    }
    throw new Error('Offline QuickStart did not reach a playable game');
  }
  async function quickStart(count=2,variant=mode.value){
    if(typeof startNewGame!=='function'||typeof baseState==='undefined')throw new Error('Canonical Shateki engine unavailable');
    if(count<2||count>5)throw new Error('Lab supports 2–5 players only');
    tell('Preparing '+count+' test players ...');
    const token=Number(state?.__gameToken||0);
    state=JSON.parse(JSON.stringify(baseState));
    state.__gameToken=token;
    state.players=Array.from({length:count},(_,i)=>({
      id:'lab-fixture-'+String(i+1),name:'LAB PLAYER '+String(i+1),
      initials:'L'+String(i+1),avatar_id:i+1,color:'#ff7a00',isGuest:true
    }));
    assignUniqueColors(state.players);
    const isPractice=variant==='practice',isTurbo=variant==='turbo';
    state.match={
      id:'sc060-local-only',targetWins:3,gameNumber:1,
      autoRotateOrder:true,wins:Array(count).fill(0),history:[],
      mode:isPractice?'practice':'match',gameFormat:'match_play',
      gameVariant:isTurbo?'turbo':'classic'
    };
    if(isPractice)Object.assign(state.match,{forcePractice:true,isPractice:true});
    if(isTurbo)Object.assign(state.match,{
      tournamentType:'turbo',startTarget:'17',strictTimer:true,throwLimitSeconds:20,
      tournamentRules:{startRoundIndex:7,strictTimer:true,throwLimitSeconds:20}
    });
    await startNewGame(true);
    // Initial-order and reveal layers must be handled through the existing game contract.
    const startButton=document.querySelector('.to-start');
    if(startButton&&startButton.offsetParent)startButton.click();
    await readyGame();
    tell('Playable '+count+'-player '+variant.toUpperCase()+' fixture. No cloud writes.');
    return state;
  }
  function requireGame(){
    if(document.body.dataset.page!=='game'||!Array.isArray(state?.players)||!state.players.length)
      throw new Error('Open a Lab QuickStart game first');
    if(!window.SQ_GAMEPLAY?.canThrow())throw new Error('Offline game control is not ready');
  }
  async function advanceTo(target,winningPlayer=-1){
    requireGame();
    if(typeof recordThrow!=='function')throw new Error('RecordThrow not present');
    let n=0,prev=-1;
    while(!state.finished&&state.currentRound<14&&(target==='complete'||state.currentRound<13)&&n++<310){
      const player=Number(state.currentPlayer||0),round=ROUNDS[state.currentRound];
      let throwSpec={kind:'Miss'};
      if(winningPlayer===player&&round){
        if(round.type==='number')throwSpec={kind:'S',number:round.target};
        else if(round.type==='doubles')throwSpec={kind:'D',number:12};
        else if(round.type==='triples')throwSpec={kind:'T',number:12};
        else if(round.type==='bull')throwSpec={kind:'B',number:25};
      }
      recordThrow(throwSpec);
      if((n%12)===0){
        tell('Advancing local game: '+String(state.currentRound+1)+'/14 ...');
        await wait(0);
      }
      if(state.currentRound===prev&&state.currentDart===0&&n>280)break;
      prev=state.currentRound;
    }
    if(target==='complete'&&!state.finished)throw new Error('Game fixture did not complete');
    if(target==='last'&&state.currentRound<13)throw new Error('Could not reach the final target');
    tell(target==='last'?'Final-round Lab fixture ready.':'Completed Lab game using canonical engine.');
  }
  function roundRows(total){
    return Array.from({length:14},(_,i)=>({
      darts:i===0?[{kind:'S',number:10,points:total}]:[],
      roundTotal:i===0?total:0
    }));
  }
  async function postgame(destination='game',winner=0){
    await quickStart(2,'classic');
    // Presentation fixture only. Never updates rankings or production match truth.
    const first=winner===0?280:120,second=winner===1?300:130;
    const a=roundRows(first),b=roundRows(second);
    state.score=[a,b];state.currentRound=13;state.currentPlayer=1;
    state.currentDart=0;state.finished=true;state.gameAwarded=false;
    state.history=[];state.match.targetWins=3;
    state.match.gameNumber=3;state.match.wins=winner===0?[2,0]:[0,2];
    state.match.history=[
      {totals:[210,190],board:[a,b]},
      {totals:[190,230],board:[a,b]}
    ];
    if(typeof updateUI==='function')updateUI();
    if(typeof openGameCompleteDialog!=='function')throw new Error('Post-game UI missing');
    openGameCompleteDialog();
    await wait(150);
    const next=()=>document.querySelector('.sq-gamecomplete-backdrop .sq-pg-next');
    if(destination==='game'){
      tell('Game Complete presentation fixture open.');
      return;
    }
    for(let step=0;step<2;step++){
      if(!next())throw new Error('Post-game navigation not available');
      next().click();await wait(70);
    }
    if(destination==='xp'){
      if(!document.querySelector('.sq-pg-xp-screen:not([hidden])'))throw new Error('XP view not visible');
      tell('XP display: test fixture only. Real XP and records never change.');
      return;
    }
    const started=performance.now();
    while(next()?.disabled&&performance.now()-started<10500)await wait(120);
    if(!next()||next().disabled)throw new Error('Match presentation navigation unavailable');
    next().click();await wait(140);
    if(!document.querySelector('.sq-pg-match-win:not([hidden])'))throw new Error('Match Win view not visible');
    tell(winner===0?'Match won visual fixture.':'Match lost: opponent wins visual fixture.');
  }
  async function eventInjection(){
    if(typeof window.__homeLivePrinterInjectLine!=='function'){
      if(typeof show==='function')show('details');
      await wait(250);
    }
    const inject=window.__homeLivePrinterInjectLine;
    if(typeof inject!=='function')throw new Error('LIVE UPDATES printer unavailable');
    if(typeof show==='function')show('details');
    inject('🚨 SC060 TEST EVENT - LOCAL DISPLAY ONLY - NEVER SAVED');
    tell('Local LIVE UPDATES event injected. No cloud record created.');
  }
  async function execute(action){
    if(action==='reset'){
      localStorage.clear();sessionStorage.clear();location.reload();return;
    }
    if(action==='quick2')return quickStart(2);
    if(action==='quick5')return quickStart(5);
    if(action==='last'){await quickStart(2);return advanceTo('last');}
    if(action==='end'){await quickStart(2);return advanceTo('complete',0);}
    if(action==='xp')return postgame('xp',0);
    if(action==='won')return postgame('won',0);
    if(action==='lost')return postgame('lost',1);
    if(action==='feed')return eventInjection();
    throw new Error('Unknown Test Lab action');
  }
  async function run(action){
    if(busy)throw new Error('Lab scenario already running');
    busy=true;buttons.forEach(b=>b.disabled=true);
    try{await execute(action);return {ok:true,action};}
    catch(error){tell('TEST FAILED: '+String(error.message||error),true);throw error;}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  }
  for(const button of buttons){
    button.addEventListener('click',async()=>{const action=button.dataset.action;
      open(false);try{await run(action);}catch(error){console.warn('[SC060]',error);}
    });
  }
  window.__SQ_TEST_LAB_PANEL=Object.freeze({run,open,version:1});
  fetch('./lab/build-info.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('build info missing'))).then(info=>{
    const sha=String(info.sha||'unknown').slice(0,8);
    dom.querySelector('#lab-sha').textContent='SHA '+sha;
    dom.querySelector('#lab-build').textContent='Source '+sha+' · '+String(info.builtAt||'');
  }).catch(()=>{dom.querySelector('#lab-sha').textContent='BUILD UNVERIFIED';});
})();
