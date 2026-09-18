
(function(){
  'use strict';
  if(window.__sqFix106HomeMenuStatsReset) return;
  window.__sqFix106HomeMenuStatsReset = true;

  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function clearTournamentRuntime(reason){
    try{ if(typeof window.__sqClearTournamentRuntimeForNormalMode==='function') window.__sqClearTournamentRuntimeForNormalMode(reason||'fix106'); }catch(_){ }
    try{ window.__sqTournamentDraft=null; }catch(_){ }
    try{ sessionStorage.removeItem('sq_tournament_runtime_v1'); }catch(_){ }
    try{ document.documentElement.removeAttribute('data-sq-turbo'); document.body.removeAttribute('data-sq-turbo'); }catch(_){ }
    try{ if(window.state){ state.__sqTournamentDraft=null; state.__sqTournamentActive=null; state.__sqTournamentTurboTimer=null; } }catch(_){ }
  }
  window.__sqFix106ClearTournamentRuntime = clearTournamentRuntime;

  function ensureHomePanels(){
    try{
      var host=document.querySelector('#details .start-actions.column')||document.querySelector('.start-actions.column');
      if(!host) return;
      // POWER RANKINGS mini panel removed from the home screen: no longer
      // recreated here; remove any leftover instance instead.
      var printer=document.getElementById('homeLivePrinter');
      try{ document.getElementById('homeMiniLeagues')?.remove(); }catch(_){}
      // Desired home order: START GAME, RESUME(if any), VIDE, footer buttons.
      if(printer && printer.parentNode!==host){ host.appendChild(printer); }
    }catch(e){ console.warn('[SQ] Fix106 ensureHomePanels failed',e); }
  }
  window.__sqFix106EnsureHomePanels = ensureHomePanels;

  function openModalShell(title, sub){
    document.querySelectorAll('.sq-menu106-bd').forEach(function(n){
      // Close via the shared stack when registered so stack state stays true.
      var st=window.__sqModalStack||[]; var handled=false;
      for(var i=st.length-1;i>=0;i--){ if(st[i].overlay===n){ st[i].close(); handled=true; break; } }
      if(!handled) n.remove();
    });
    var bd=document.createElement('div');
    bd.className='modal-backdrop sq-menu106-bd';
    var modal=document.createElement('div');
    modal.className='modal sq-menu106-modal';
    modal.innerHTML='<div class="sq-menu106-head"><button class="sq-menu106-back" type="button" aria-label="Back">‹</button><div><div class="sq-menu106-title">'+esc(title)+'</div>'+(sub?'<div class="sq-menu106-sub">'+esc(sub)+'</div>':'')+'</div><button class="sq-menu106-x" type="button" aria-label="Close">×</button></div><div class="sq-menu106-body"></div><div class="sq-menu106-footer"><button class="btn sq-menu106-close" type="button">Close</button></div>';
    bd.appendChild(modal); document.body.appendChild(bd);
    var close=function(){bd.remove();};
    if(window.sqModal&&window.sqModal.register){
      close=window.sqModal.register(bd,modal,function(){bd.remove();}).close;
    }
    bd.addEventListener('click',function(e){if(e.target===bd)close();});
    modal.querySelector('.sq-menu106-x').onclick=close;
    modal.querySelector('.sq-menu106-close').onclick=close;
    modal.querySelector('.sq-menu106-back').onclick=close;
    return {bd:bd,modal:modal,body:modal.querySelector('.sq-menu106-body'),close:close};
  }
  function addRow(body,opt){
    var b=document.createElement('button');
    b.type='button';
    b.className='sq-menu106-row '+(opt.cls||'');
    b.innerHTML='<span class="sq-menu106-ico">'+esc(opt.ico||'›')+'</span><span class="sq-menu106-copy"><span class="sq-menu106-label">'+esc(opt.label||'')+'</span><span class="sq-menu106-desc">'+esc(opt.desc||'')+'</span></span><span class="sq-menu106-chev">›</span>';
    b.onclick=opt.onClick||function(){};
    body.appendChild(b); return b;
  }

  function resetCurrentGameKeepPlayers(){
    try{
      try{ if(typeof __sqSanitizeVsShadowForGenericStart==='function') __sqSanitizeVsShadowForGenericStart('menu106-reset-current-game'); }catch(_){ }
      var players=Array.isArray(state.players)?state.players.slice():[];
      var match=state.match?JSON.parse(JSON.stringify(state.match)):JSON.parse(JSON.stringify(baseState.match));
      state=JSON.parse(JSON.stringify(baseState));
      state.players=players; state.match=match; state.score=players.map(function(){return[];});
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
    }catch(e){ console.error('[SQ] reset game failed',e); }
  }
  function doRestartGame(){ window.__sqConfirm({ title:'Restart Game', message:'Restart game? This clears current game data and returns to throw order.' }, function(){ resetCurrentGameKeepPlayers(); try{save();}catch(_){} try{ if(typeof startNewGame==='function') startNewGame(); else if(typeof restartGameSafe==='function') restartGameSafe(); }catch(e){console.error(e);} }); }
  function doEndGame(){ window.__sqConfirm({ title:'End Game', message:'End game? Current game data will be cleared and you will go to the end-game screen.' }, function(){ resetCurrentGameKeepPlayers(); try{save();}catch(_){} try{ if(typeof showLeaderboard==='function') showLeaderboard(); else if(typeof _showPageSafe==='function') _showPageSafe('leaderboard'); }catch(e){console.error(e);} }); }
  function doEndMatch(){ window.__sqConfirm({ title:'End Match', message:'End match? This will clear the current match state and return to the start screen.' }, function(){ try{ clearTournamentRuntime('end match'); state=JSON.parse(JSON.stringify(baseState)); save(); }catch(_){} try{ if(typeof navigateToStartScreen==='function') navigateToStartScreen(); else show('details'); }catch(_){ } setTimeout(function(){try{ if(typeof arrangeStartActions==='function') arrangeStartActions(); ensureHomePanels(); }catch(_){ }},80); }); }

  function __sqLateJoinEligibility(){
    try{
      if(!state || state.finished) return {ok:false, reason:'Game is not active.'};
      if(state.suddenDeath && state.suddenDeath.active) return {ok:false, reason:'Unavailable during a tiebreak.'};
      var players=Array.isArray(state.players)?state.players:[];
      var gameNumber=Number(state&&state.match&&state.match.gameNumber||1);
      if(gameNumber>1) return {ok:false, reason:'Mid-game late entry is only available in Game 1.'};
      if(players.length>=6) return {ok:false, reason:'Maximum 6 players.'};
      try{ if(typeof __sqIsVsShadowRuntime==='function' && __sqIsVsShadowRuntime()) return {ok:false, reason:'Not available in Vs Shadow.'}; }catch(_){}
      try{
        var m=state.match||{};
        if(m.tournamentType || m.tournamentId || state.__sqTournamentActive || window.__sqTournamentDraft) return {ok:false, reason:'Not available during Tournament play.'};
      }catch(_){}
      var round=Number(state.currentRound||0);
      var dart=Number(state.currentDart||0);
      var player=Number(state.currentPlayer||0);
      var seventeenStarted=(Array.isArray(state.history)?state.history:[]).some(function(h){return Number(h&&h.round)===7;});
      if(round>7 || (round===7 && (dart>0 || player>0 || seventeenStarted))){
        return {ok:false, reason:'Late entry closes once 17s begins.'};
      }
      return {ok:true, reason:'Joins as the final thrower.'};
    }catch(e){ return {ok:false, reason:'Add Player unavailable.'}; }
  }
  window.__sqLateJoinEligibility=__sqLateJoinEligibility;

  function __sqLateJoinPlayerKey(p,idx){
    var raw=(p&&(p.id||p.player_id||p.name||p.player_name))||('idx:'+idx);
    return String(raw||('idx:'+idx)).trim().toLowerCase();
  }

  function __sqLateJoinEmptyBoard(){
    var n=(typeof MAX_ROUNDS==='number'&&MAX_ROUNDS>0)?MAX_ROUNDS:14;
    return Array.from({length:n},function(){return {darts:[null,null,null],roundTotal:0};});
  }

  function __sqNormaliseLateJoinPlayer(row,type){
    row=(row&&typeof row==='object')?row:{name:String(row||'').trim()};
    var name=String(row.name||row.player_name||row.display_name||'').trim();
    if(!name) return null;
    var id=row.id||row.player_id||null;
    return {
      id:id,
      player_id:id,
      name:name,
      first_name:String(row.first_name||'').trim(),
      last_name:String(row.last_name||'').trim(),
      nickname:String(row.nickname||'').trim(),
      initials:String(row.initials||'').trim() || name.slice(0,2).toUpperCase(),
      type:type || (id?'registered':'guest')
    };
  }

  function __sqAppendLatePlayer(row,type){
    var gate=__sqLateJoinEligibility();
    if(!gate.ok){ try{toast(gate.reason);}catch(_){} return false; }
    var p=__sqNormaliseLateJoinPlayer(row,type);
    if(!p) return false;
    var players=Array.isArray(state.players)?state.players:(state.players=[]);
    var key=__sqLateJoinPlayerKey(p,players.length);
    var dupe=players.some(function(existing,idx){return __sqLateJoinPlayerKey(existing,idx)===key || String(existing&&existing.name||'').trim().toLowerCase()===p.name.toLowerCase();});
    if(dupe){ try{toast('Player is already in this game.');}catch(_){} return false; }

    var idx=players.length;
    players.push(p);
    if(typeof assignUniqueColors==='function'){ try{assignUniqueColors(players);}catch(_){} }

    if(!Array.isArray(state.score)) state.score=[];
    state.score.push(__sqLateJoinEmptyBoard());

    if(!state.match) state.match={};
    if(!Array.isArray(state.match.wins)) state.match.wins=[];
    while(state.match.wins.length<idx) state.match.wins.push(0);
    state.match.wins.push(0);

    try{
      if(typeof ensureMatchAgg==='function') ensureMatchAgg();
      if(state.matchAgg){
        if(!Array.isArray(state.matchAgg.hits)) state.matchAgg.hits=[];
        if(!Array.isArray(state.matchAgg.totals60)) state.matchAgg.totals60=[];
        if(!Array.isArray(state.matchAgg.totals100)) state.matchAgg.totals100=[];
        if(!Array.isArray(state.matchAgg.totals140)) state.matchAgg.totals140=[];
        state.matchAgg.hits[idx]={};
        state.matchAgg.totals60[idx]=0;
        state.matchAgg.totals100[idx]=0;
        state.matchAgg.totals140[idx]=0;
      }
    }catch(_){}

    var joinedRound=Math.max(0,Number(state.currentRound||0));
    var liveMode=String(
      state.gameMode ||
      (state.match && (state.match.gameMode || state.match.gameVariant || state.match.mode)) ||
      ''
    ).toLowerCase();
    var firstPlayableRound=(liveMode==='turbo')?7:0;
    var missedCount=Math.max(0,joinedRound-firstPlayableRound);
    var allMissed=Array.from({length:missedCount},function(_,i){return firstPlayableRound+i;});
    var pending=allMissed.slice(-3);
    var scratched=allMissed.slice(0,Math.max(0,allMissed.length-3));
    if(!state.__sqCatchUp || typeof state.__sqCatchUp!=='object') state.__sqCatchUp={version:1,jobs:[],active:false};
    if(!Array.isArray(state.__sqCatchUp.jobs)) state.__sqCatchUp.jobs=[];
    state.__sqCatchUp.jobs.push({
      kind:'lateJoin',
      playerIndex:idx,
      playerKey:key,
      joinedRound:joinedRound,
      pendingRounds:pending.slice(),
      scratchedRounds:scratched.slice(),
      completed:pending.length===0
    });

    try{save();}catch(_){}
    try{
      var rebuild=(typeof buildEverythingChunked==='function')?buildEverythingChunked():null;
      if(rebuild&&typeof rebuild.then==='function') rebuild.then(function(){try{updateUI();}catch(_){}});
      else if(typeof updateUI==='function') updateUI();
    }catch(_){}
    try{toast(p.name+' added as final thrower.');}catch(_){}
    return true;
  }
  window.__sqAppendLatePlayer=__sqAppendLatePlayer;

  function openAddGuestMenu(prev){
    var m=openModalShell('Add Guest Player','Joins as the final thrower');
    m.modal.querySelector('.sq-menu106-back').onclick=function(){m.close();if(prev)prev();};
    var input=document.createElement('input');
    input.className='ms-player-input';
    input.type='text';
    input.maxLength=40;
    input.placeholder='Guest name';
    input.autocomplete='off';
    var add=document.createElement('button');
    add.type='button'; add.className='btn'; add.textContent='ADD PLAYER';
    add.onclick=function(){
      var name=String(input.value||'').trim();
      if(!name){try{toast('Enter a player name.');}catch(_){}return;}
      if(__sqAppendLatePlayer({name:name},'guest')){m.close();}
    };
    m.body.append(input,add);
    setTimeout(function(){try{input.focus();}catch(_){}},0);
  }

  async function openAddPlayerMenu(prev){
    var gate=__sqLateJoinEligibility();
    if(!gate.ok){try{toast(gate.reason);}catch(_){}return;}
    var m=openModalShell('Add Player','Joins as the final thrower');
    m.modal.querySelector('.sq-menu106-back').onclick=function(){m.close();if(prev)prev();};
    var active=new Set((state.players||[]).map(function(p){return String(p&&p.name||'').trim().toLowerCase();}).filter(Boolean));
    var rows=[];
    try{ if(typeof cloudListPlayers==='function') rows=await cloudListPlayers(); }catch(e){ console.warn('[SQ] Add Player cloud list failed',e); }
    rows=(Array.isArray(rows)?rows:[]).filter(function(p){return !active.has(String(p&&p.name||'').trim().toLowerCase());});
    if(rows.length){
      rows.forEach(function(p){
        var name=(typeof __sqPlayerPretty==='function'?__sqPlayerPretty(p):'') || p.name || 'Player';
        addRow(m.body,{ico:'＋',label:name,desc:'Registered player • final thrower',cls:'green',onClick:function(){
          if(__sqAppendLatePlayer(p,'registered')) m.close();
        }});
      });
    }else{
      var empty=document.createElement('p'); empty.className='tag'; empty.textContent='No other registered players available.'; m.body.appendChild(empty);
    }
    addRow(m.body,{ico:'＋',label:'Guest Player',desc:'Add by name • may change game classification',onClick:function(){m.close();openAddGuestMenu(function(){openAddPlayerMenu(prev);});}});
  }
  window.__sqOpenAddPlayerMenu=openAddPlayerMenu;

  function openRemovePlayerMenu(prev){
    var m=openModalShell('Remove Player','Current game only');
    m.modal.querySelector('.sq-menu106-back').onclick=function(){ m.close(); if(prev) prev(); };
    var pls=Array.isArray(state&&state.players)?state.players:[];
    if(!pls.length){ var p=document.createElement('p'); p.className='tag'; p.textContent='No players available.'; m.body.appendChild(p); return; }
    pls.forEach(function(p,idx){
      var name=(typeof __sqPlayerPretty==='function'?__sqPlayerPretty(p):'') || p.name || ('Player '+(idx+1));
      addRow(m.body,{ico:'−',label:'Remove '+name,desc:'Delete current-game data',cls:'danger',onClick:function(){ window.__sqConfirm({ title:'Remove Player', message:'Remove '+name+'? Their current-game data will be deleted and the match continues.' }, function(){ try{state.players.splice(idx,1); if(Array.isArray(state.score))state.score.splice(idx,1); if(state.match&&Array.isArray(state.match.wins))state.match.wins.splice(idx,1); if(state.currentPlayer>=state.players.length)state.currentPlayer=0; save(); m.close(); if(typeof liveV2Render==='function') liveV2Render();}catch(e){console.error(e);} }); }});
    });
  }

  window.__sqOpenGameMenu106=function(){
    var m=openModalShell('Game Menu','Live game controls');
    var v3on=false; try{ v3on = localStorage.getItem('sq_livev3_test')==='1'; }catch(_){ }
    // Safe / frequently-used actions first.
    addRow(m.body,{ico:'📊',label:'Stats',desc:'Race, game & match stats',cls:'blue',onClick:function(){m.close(); window.openStatsHubDialog();}});
    addRow(m.body,{ico:'🧪',label:'New Layout (Beta): '+(v3on?'ON':'OFF'),desc:'2-4 player Match Play Classic',cls:(v3on?'green':''),onClick:function(){
      try{ localStorage.setItem('sq_livev3_test', v3on?'0':'1'); }catch(_){ }
      m.close();
      try{ if(typeof updateUI==='function') updateUI(); else if(window.__sqLiveV3Sync) window.__sqLiveV3Sync(); }catch(_){ }
      try{ toast('New layout '+(v3on?'disabled':'enabled')); }catch(_){ }
    }});
    var __addGate=__sqLateJoinEligibility();
    addRow(m.body,{ico:'＋',label:'Add Player',desc:(__addGate.ok?'Final thrower • available before 17s':__addGate.reason),cls:(__addGate.ok?'green':''),onClick:function(){
      if(!__addGate.ok){try{toast(__addGate.reason);}catch(_){}return;}
      m.close(); openAddPlayerMenu(window.__sqOpenGameMenu106);
    }});
    addRow(m.body,{ico:'−',label:'Remove Player',desc:'Remove from this game',onClick:function(){m.close(); openRemovePlayerMenu(window.__sqOpenGameMenu106);}});
    // Destructive group, set apart below a divider.
    try{ m.body.insertAdjacentHTML('beforeend','<div class="sq-menu106-sep" aria-hidden="true"></div>'); }catch(_){ }
    addRow(m.body,{ico:'↻',label:'Restart Game',desc:'Reset this game',cls:'danger',onClick:function(){m.close(); doRestartGame();}});
    addRow(m.body,{ico:'⏹',label:'End Game',desc:'Go to game leaderboard',cls:'danger',onClick:function(){m.close(); doEndGame();}});
    addRow(m.body,{ico:'🏁',label:'End Match',desc:'Return to start screen',cls:'danger',onClick:function(){m.close(); doEndMatch();}});
  };

  window.openStatsHubDialog=function(){
    try{ if(typeof __sqSetStatsOrigin==='function') __sqSetStatsOrigin('ingame'); }catch(_){ }
    var m=openModalShell('Player Stats','Choose a stats view');
    addRow(m.body,{ico:'📈',label:'Game Race',desc:'Score race chart',cls:'orange',onClick:function(){m.close(); openGameRaceDialog();}});
    addRow(m.body,{ico:'📊',label:'Game Stats',desc:'Current game breakdown',cls:'blue',onClick:function(){m.close(); openGameStatsDialog();}});
    addRow(m.body,{ico:'▦',label:'Match Stats',desc:'Match totals and averages',cls:'blue',onClick:function(){m.close(); openMatchStatsDialog();}});
    addRow(m.body,{ico:'🏆',label:'High Scores (Official)',desc:'Official high-score view',cls:'green',onClick:function(){m.close(); openHighScoresDialog();}});
    addRow(m.body,{ico:'⚠',label:'Low Scores (Official)',desc:'Official low-score view',cls:'green',onClick:function(){m.close(); openLowScoresDialog();}});
  };

  document.addEventListener('click',function(e){
    // Both Settings controls belong to this menu. Intercept the pad click here
    // so its older onclick cannot also open the retired fallback overlay.
    var btn=e.target&&e.target.closest?e.target.closest('#settingsBtnGame, #settingsBtnGamePad'):null;
    if(!btn) return;
    e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.__sqOpenGameMenu106();
  },true);

  document.addEventListener('click',function(e){
    var start=e.target&&e.target.closest?e.target.closest('#startGameBtn'):null;
    if(!start) return;
    clearTournamentRuntime('main start game');
    try{ if(typeof arrangeStartActions==='function') arrangeStartActions(); }catch(_){ }
    setTimeout(ensureHomePanels,20);
  },true);

  try{
    if(typeof navigateToStartScreen==='function' && !navigateToStartScreen.__sqFix106Wrapped){
      var old=navigateToStartScreen;
      navigateToStartScreen=function(){ clearTournamentRuntime('navigate home'); var r=old.apply(this,arguments); [50,160,350].forEach(function(ms){setTimeout(function(){try{ if(typeof arrangeStartActions==='function') arrangeStartActions(); ensureHomePanels(); }catch(_){ }},ms);}); return r; };
      navigateToStartScreen.__sqFix106Wrapped=true;
      try{window.navigateToStartScreen=navigateToStartScreen;}catch(_){ }
    }
  }catch(e){console.warn('[SQ] Fix106 navigate wrapper failed',e);}

  document.addEventListener('DOMContentLoaded',function(){ setTimeout(ensureHomePanels,180); });
  window.addEventListener('load',function(){ setTimeout(ensureHomePanels,250); });
  setTimeout(ensureHomePanels,250);
  try{ console.info('[SQ] Fix106 home/menu/stats reset active'); }catch(_){ }
})();
