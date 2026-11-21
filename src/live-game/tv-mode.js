/* Arcade TV projects the active board. All inputs use the existing scorer. */
(function(){
  'use strict';
  function playerName(p,i){
    try{
      if(typeof window.__sqHalloweenActive==='function' && window.__sqHalloweenActive() && typeof window.__sqHalloweenNickname==='function'){
        var seasonal=window.__sqHalloweenNickname(p);
        if(seasonal) return seasonal;
      }
      if(typeof __sqPlayerPretty==='function'){ var pretty=__sqPlayerPretty(p); if(pretty) return pretty; }
    }catch(_){}
    return String((p&&(p.nickname||p.name||p.displayName||p.initials))||('PLAYER '+(i+1))).trim();
  }
  function playerIdentity(p,i){
    const player=typeof p==='string'?{name:p}:(p||{});
    const parts=__sqNameParts(player.name);
    const first=String(player.first_name||'').trim()||parts.first;
    const last=String(player.last_name||'').trim()||parts.last;
    const name=[first,last].filter(Boolean).join(' ')||('PLAYER '+(i+1));
    let nickname=String(player.nickname||'').trim();
    // Seasonal aliases stay on the nickname line, never in the real identity.
    try{
      if(typeof window.__sqHalloweenActive==='function' && window.__sqHalloweenActive() && typeof window.__sqHalloweenNickname==='function'){
        nickname=String(window.__sqHalloweenNickname(player)||nickname).trim();
      }
    }catch(_){}
    return {name,shortName:first?first+(last?' '+[...last][0]:''):name,nickname};
  }
  function modeUnsupported(s){
    // The viewer retains historical six-player boards; new games are capped upstream.
    if(!s||!Array.isArray(s.players)||s.players.length<2||s.players.length>6) return 'TV Mode currently supports 2–6 player games.';
    var m=s.match||{};
    var bag=[s.mode,s.gameMode,m.mode,m.gameMode,m.practiceType,m.gameVariant].map(function(v){return String(v||'').toLowerCase();}).join(' ');
    if(m.forcePractice||m.isPractice||s.isPractice||bag.indexOf('practice')>=0||bag.indexOf('training')>=0) return 'TV Mode beta is currently Match Play only.';
    if(bag.indexOf('turbo')>=0) return 'TV Mode beta is currently Classic Match Play only.';
    return '';
  }
  let root, iframe, channel, receiverUrl, cache, pace, activeGame, frame, lastFrame;
  let pending = 0, tick = 0, trigger, menuObserver;
  const asset = new URL('assets/tv/arcade.html?v=0.17.1', document.baseURI);

  function displayDart(dart, round) {
    if (!dart) return null;
    const points = Number(dart.points) || 0;
    let label = dart.bounceOut ? 'BO' : 'Miss';
    if (points && dart.kind === 'B') label = dart.bull === 'Inner' ? 'Inner' : 'Outer';
    else if (points && ['D','T','S','Double','Triple'].includes(dart.kind)) {
      label = dart.kind[0] + Number(dart.sector || ROUNDS[round].target);
    }
    return {label, points};
  }

  function snapshot() {
    const view=__sqLiveRoundView(state.currentRound,state.currentPlayer);
    const round = state.finished ? MAX_ROUNDS : view.scoringRound;
    const current = Math.min(round, MAX_ROUNDS-1);
    const thrower = Math.min(state.currentPlayer, state.players.length-1);
    const board = state.players.map((_,i)=>state.score[i].map((row,r)=>
      (row?.darts || []).map(dart=>displayDart(dart,r))));
    const visits = board.map(rows=>rows[current]?.filter(Boolean) || []);
    // The clean record views use targets (10..20, D, T, B) and canonical
    // lower-case player names. Older cached snapshots use indexed round keys.
    function recordRounds(map) {
      return ROUNDS.map((_,r)=>map?.get(__sqCatForRoundIdx(r)) ?? map?.get(__sqRoundKeyForIdx(r)) ?? null);
    }
    const rows = board.map((player,i)=>player.map((visit,r)=>
      visit.some(Boolean) ? state.score[i][r].roundTotal : null));
    // Keep each trace aligned to the target, even during skipped-round catch-up.
    const traces = board.map(player=>{
      const points=player.flatMap(visit=>Array.from({length:3},(_,d)=>visit[d]?.points??null));
      while (points.length && points[points.length-1] === null) points.pop();
      return points;
    });
    const last = state.history?.at(-1);
    const job = __sqFinalBullReturnTimerActive(thrower) && __sqFinalBullReturnTimerJob(thrower);
    const records = {
      world:recordRounds(cache?.wrByRound),
      personal:state.players.map((player,i)=>{
        if (!(player.id || player.player_id || player.bucket_key)) return recordRounds(null);
        const name=String(player.name || '').trim().toLowerCase();
        return recordRounds(cache?.pbByBucket.get(name) ?? cache?.pbByBucket.get(__sqResolveBucketKeyForPlayer(i)));
      })
    };
    return {
      completedRounds:state.finished?MAX_ROUNDS:view.tableRound,
      deciderWinner:state._decider?.resolved && state._decider.gameToken===(state.__gameToken||0) ?
        state._decider.winner : null,
      round, thrower, dartIndex:state.currentDart, visits, darts:visits[thrower], rows,traces,
      identities:state.players.map(playerIdentity),
      names:state.players.map(playerName),targets:ROUNDS.map(def=>def.type==='number'?def.target:
        ({doubles:'Doubles',triples:'Triples',bull:'Bull'})[def.type]),
      totals:state.players.map((_,i)=>totalScoreForPlayer(i)), forms:state.players.map((_,i)=>__sqV3FormData(i)),
      records,pace, canUndo:Boolean(last), canSkip:Boolean(document.querySelector('#pad .dtActBtn.skip:not(:disabled)')), historyLength:state.history?.length||0,
      last:last?.throw?{player:last.player,round:last.round,dart:last.dartIndex,
        hit:displayDart(last.throw,last.round).label,visit:board[last.player][last.round].filter(Boolean)}:null,
      returnSeconds:job?.bullReturnDeadlineAt?Math.max(0,Math.ceil((job.bullReturnDeadlineAt-Date.now())/1000)):null
    };
  }

  function sync() {
    if (!root) return;
    if (document.body.dataset.page!=='game' || state!==activeGame) { disable(); return; }
    cache=window.__v2PBWRSnapshot || cache;
    const next = snapshot();
    const signature = JSON.stringify(next);
    if (signature !== lastFrame) {
      lastFrame = signature;
      frame = next;
      iframe.contentWindow?.showTvFrame?.(frame);
      channel?.postMessage({frame});
    }
    if (state.finished && !root.hidden) {
      // Give the native finish and shootout dialogs the scorer surface.
      // Keep mirroring so final-dart correction and spectator refresh work.
      root.hidden=true;
      document.body.classList.remove('sq-tv-mode-on');
      if(document.fullscreenElement===document.documentElement)document.exitFullscreen?.();
    } else if (!state.finished && root.hidden) {
      root.hidden=false;
      document.body.classList.add('sq-tv-mode-on');
    }
  }
  function schedule() {
    if (!root || pending) return;
    pending=requestAnimationFrame(()=>{ pending=0; sync(); });
  }

  function score(label) {
    if (!root || root.inert || root.hidden || state!==activeGame || state.finished || document.body.dataset.page!=='game') return;
    const selectors = {Single:'[data-score-label="Single"]',Double:'[data-score-label="Double"]',
      Treble:'[data-score-label="Treble"]',Miss:'.dtActBtn.miss',undo:'.dtActBtn.undo',
      skip:'.dtActBtn.skip','Inner 50':'.dtBullBtn.inner','Outer 25':'.dtBullBtn:not(.inner)'};
    const pad=document.getElementById('pad');
    const numeric=/^[DT](\d{1,2})$/.exec(label);
    const button=numeric ? [...pad.querySelectorAll('.dtNumBtn')].find(b=>b.textContent===numeric[1]) :
      selectors[label] && pad.querySelector(selectors[label]);
    if (button && !button.disabled) button.click();
    sync();
  }

  function openSettings() {
    if (!root || root.inert || !window.__sqOpenGameMenu106) return;
    root.inert=true;
    root.classList.add('menu-open');
    window.__sqOpenGameMenu106();
    document.querySelector('.sq-menu106-bd button')?.focus();
    // Submenus replace the previous dialog through the shared modal stack.
    menuObserver=new MutationObserver(()=>requestAnimationFrame(()=>{
      if (!root?.inert || window.__sqModalStack?.some(entry=>entry.overlay?.isConnected) ||
          document.querySelector('.sq-menu106-bd')) return;
      menuObserver?.disconnect(); menuObserver=null;
      root.inert=false;
      root.classList.remove('menu-open');
      iframe.contentDocument?.querySelector('.tv-settings')?.focus();
    }));
    menuObserver.observe(document.body,{childList:true});
  }

  function enable(){
    if (root) return true;
    const reason=modeUnsupported(state);
    if (document.body.dataset.page!=='game' || reason || state.finished) {
      toast(reason || 'Start a game before opening TV Mode'); return false;
    }
    activeGame=state;
    trigger=document.activeElement;
    root=document.createElement('section');
    root.id='sqTvModeOverlay';
    root.setAttribute('aria-label','Arcade TV');
    root.innerHTML='<nav aria-label="TV controls"><button id="sqTvExit">Exit TV mode</button><button id="sqTvWatch">Spectator window</button><button id="sqTvFull">Fullscreen</button></nav><iframe title="Live arcade scoreboard"></iframe>';
    iframe=root.querySelector('iframe');
    iframe.src=asset.href;
    iframe.onload=()=>{
      if (!root || !iframe.contentWindow?.showTvFrame) return;
      iframe.contentWindow.setTvControls({score,settings:openSettings,bindMiss:__sqBindMissBounceHold,exit:disable});
      if (frame) iframe.contentWindow.showTvFrame(frame);
    };
    root.querySelector('#sqTvExit').onclick=()=>disable();
    root.querySelector('#sqTvFull').onclick=()=>document.fullscreenElement ?
      document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    const watch=root.querySelector('#sqTvWatch');
    if (typeof BroadcastChannel==='function') {
      // The spectator window shares the browser on an extended or mirrored display.
      // It receives display fields only. It cannot send scoring commands.
      let id;
      try {id=sessionStorage.getItem('sq.tv.display');} catch(_){}
      if (!id) {id=crypto.randomUUID();try{sessionStorage.setItem('sq.tv.display',id);}catch(_){}}
      receiverUrl=new URL(asset);
      receiverUrl.hash=id;
      channel=new BroadcastChannel('sq-tv-'+id);
      channel.onmessage=event=>{if(event.data==='ready' && frame)channel?.postMessage({frame});};
      watch.onclick=()=>window.open(receiverUrl.href,'_blank','noopener');
    } else watch.hidden=true;
    document.body.append(root);
    document.body.classList.add('sq-tv-mode-on');
    root.querySelector('#sqTvExit').focus();
    sync();
    const opened=root;
    __sqEnsureV2PBWR().then(result=>{if(root===opened){cache=result;schedule();}});
    buildRecordPaceSeries(MAX_ROUNDS,true).then(result=>{if(root===opened){pace=result?[0,...result.data]:null;schedule();}});
    // Deadline and route changes can occur independently of a throw.
    tick=setInterval(()=>{
      if(document.body.dataset.page!=='game' || frame?.returnSeconds!=null || state.finished ||
          window.__v2PBWRSnapshot && cache!==window.__v2PBWRSnapshot) schedule();
      if (!cache && root===opened && Date.now()>=(window.__v2PBWRRetryAfter||0)) {
        __sqEnsureV2PBWR().then(result=>{if(result && root===opened){cache=result;schedule();}});
      }
    },1000);
    return true;
  }
  function disable(finished=false){
    if (!root) return;
    menuObserver?.disconnect(); menuObserver=null;
    clearInterval(tick);
    cancelAnimationFrame(pending); pending=0;
    if (!finished) channel?.postMessage({closed:true});
    channel?.close(); channel=null;
    if(document.fullscreenElement===document.documentElement)document.exitFullscreen?.();
    root.remove(); root=null; iframe=null; lastFrame=null; frame=null; cache=null; pace=null; activeGame=null;
    document.body.classList.remove('sq-tv-mode-on');
    if (!finished) trigger?.focus?.();
  }
  window.__sqTvModeToggle=on=>on===false?(disable(),false):enable();
  window.__sqTvModeIsActive=()=>Boolean(root);
  window.__sqTvModeSync=schedule;
  window.addEventListener('pagehide',()=>disable());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root&&!root.inert&&!root.hidden)disable();});
})();
