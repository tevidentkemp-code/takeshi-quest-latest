
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

  function refreshDeferredHome(){
    try{
      if(!document.body || document.body.dataset.page!=='details') return;
      var modeMenu=document.getElementById('startGameModal');
      if(modeMenu && !modeMenu.classList.contains('hidden')) return;
      if(typeof arrangeStartActions==='function') arrangeStartActions();
      ensureHomePanels();
    }catch(_){ }
  }

  function openModalShell(title, sub, onBack){
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
    modal.innerHTML='<div class="sq-menu106-head">'+(typeof onBack==='function'?'<button class="sq-menu106-back" type="button" aria-label="Back">‹</button>':'<span aria-hidden="true"></span>')+'<div><div class="sq-menu106-title">'+esc(title)+'</div>'+(sub?'<div class="sq-menu106-sub">'+esc(sub)+'</div>':'')+'</div><button class="sq-menu106-x" type="button" aria-label="Close">×</button></div><div class="sq-menu106-body"></div><div class="sq-menu106-footer"><button class="btn sq-menu106-close" type="button">Close</button></div>';
    bd.appendChild(modal); document.body.appendChild(bd);
    var close=function(){bd.remove();};
    if(window.sqModal&&window.sqModal.register){
      close=window.sqModal.register(bd,modal,function(){bd.remove();}).close;
    }
    bd.addEventListener('click',function(e){if(e.target===bd)close();});
    modal.querySelector('.sq-menu106-x').onclick=close;
    modal.querySelector('.sq-menu106-close').onclick=close;
    // SC-071: only a genuine parent gets Back; Close never reopens it.
    var back=modal.querySelector('.sq-menu106-back');
    if(back) back.onclick=function(){close();onBack();};
    return {bd:bd,modal:modal,body:modal.querySelector('.sq-menu106-body'),close:close};
  }
  // SC-071: fixed, decorative line icons. Labels remain escaped below.
  var MENU_ICONS={
    "stats": "<path d=\"M5 19V11M12 19V5M19 19V8\"/>",
    "tv": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>",
    "add": "<path d=\"M12 5v14M5 12h14\"/>",
    "edit": "<path d=\"m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z\"/>",
    "remove": "<path d=\"M5 12h14\"/>",
    "order": "<path d=\"M8 20V4m-4 4 4-4 4 4M16 4v16m-4-4 4 4 4-4\"/>",
    "restart": "<path d=\"M4 10a8 8 0 1 1 1 8M4 4v6h6\"/>",
    "stop": "<rect x=\"5\" y=\"5\" width=\"14\" height=\"14\" rx=\"1\"/>",
    "finish": "<path d=\"M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0\"/>",
    "race": "<path d=\"M3 17l6-6 4 3 8-10M15 4h6v6\"/>",
    "table": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M10 4v16\"/>",
    "trophy": "<path d=\"M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v7m-4 1h8\"/>",
    "warning": "<path d=\"m12 3 10 18H2zM12 9v5m0 3h.01\"/>",
    "next": "<path d=\"m9 5 7 7-7 7\"/>"
};
  function menuIcon(name){
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(MENU_ICONS[name]||MENU_ICONS.next)+'</svg>';
  }
  function addRow(body,opt){
    var b=document.createElement('button');
    b.type='button';
    b.className='sq-menu106-row '+(opt.cls||'');
    b.innerHTML='<span class="sq-menu106-ico" aria-hidden="true">'+menuIcon(opt.ico)+'</span><span class="sq-menu106-copy"><span class="sq-menu106-label">'+esc(opt.label||'')+'</span><span class="sq-menu106-desc">'+esc(opt.desc||'')+'</span></span><span class="sq-menu106-chev">›</span>';
    b.onclick=opt.onClick||function(){};
    body.appendChild(b); return b;
  }
  function addPlayerChoice(body,opt,player){
    var row=addRow(body,opt);
    row.classList.add('ms2-slot','sp2-row');
    var icon=row.querySelector('.sq-menu106-ico');
    if(player && typeof __ms2Avatar==='function') icon.replaceWith(__ms2Avatar(player));
    else icon.className='ms2-ava';
    row.querySelector('.sq-menu106-copy').classList.add('ms2-info');
    var name=row.querySelector('.sq-menu106-label');
    name.classList.add('ms2-nm');
    if(player && typeof __ms2DisplayName==='function') name.textContent=__ms2DisplayName(player)||opt.label;
    return row;
  }
  function styleAddPlayerShell(m){
    m.modal.classList.add('sp-modal','sq-add-player-modal');
    m.modal.querySelector('.sq-menu106-title').classList.add('sp2-title');
  }

  function resetCurrentGameKeepPlayers(){
    try{
      try{ if(typeof __sqSanitizeVsShadowForGenericStart==='function') __sqSanitizeVsShadowForGenericStart('menu106-reset-current-game'); }catch(_){ }
      var players=Array.isArray(state.players)?state.players.slice():[];
      var gameControl=state.__sqGameControl?JSON.parse(JSON.stringify(state.__sqGameControl)):null;
      var match=state.match?JSON.parse(JSON.stringify(state.match)):JSON.parse(JSON.stringify(baseState.match));
      state=JSON.parse(JSON.stringify(baseState));
      state.players=players; state.match=match;if(gameControl)state.__sqGameControl=gameControl; state.score=players.map(function(){return[];});
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
    }catch(e){ console.error('[SQ] reset game failed',e); }
  }
  function doRestartGame(){ if(typeof __sqNewGamePlayerCountAllowed==='function' && !__sqNewGamePlayerCountAllowed()) return; window.__sqConfirm({ title:'Restart Game', message:'Restart game? This clears current game data and returns to throw order.' }, function(){ if(!window.SQ_GAMEPLAY.canDiscard())return; resetCurrentGameKeepPlayers(); try{save();}catch(_){} try{ if(typeof startNewGame==='function') startNewGame(); else if(typeof restartGameSafe==='function') restartGameSafe(); }catch(e){console.error(e);} }); }
  function doEndGame(){ window.__sqConfirm({ title:'End Game', message:'End game? Current game data will be cleared and you will go to the end-game screen.' }, async function(){ try{await window.SQ_GAMEPLAY.abandon();}catch(error){window.SQ_GAMEPLAY.failure(error);return;} resetCurrentGameKeepPlayers(); try{save();}catch(_){} try{ if(typeof showLeaderboard==='function') showLeaderboard(); else if(typeof _showPageSafe==='function') _showPageSafe('leaderboard'); }catch(e){console.error(e);} }); }
  function doEndMatch(){ window.__sqConfirm({ title:'End Match', message:'End match? This will clear the current match state and return to the start screen.' }, async function(){ try{await window.SQ_GAMEPLAY.abandon();}catch(error){window.SQ_GAMEPLAY.failure(error);return;} try{ clearTournamentRuntime('end match'); state=JSON.parse(JSON.stringify(baseState)); save(); }catch(_){} try{ if(typeof navigateToStartScreen==='function') navigateToStartScreen(); else show('details'); }catch(_){ } setTimeout(refreshDeferredHome,80); }); }

  function __sqLateJoinEligibility(){
    try{
      if(!state || state.finished) return {ok:false, reason:'Game is not active.'};
      if(state.suddenDeath && state.suddenDeath.active) return {ok:false, reason:'Unavailable during a tiebreak.'};
      var players=Array.isArray(state.players)?state.players:[];
      var gameNumber=Number(state&&state.match&&state.match.gameNumber||1);
      if(gameNumber>1) return {ok:false, reason:'Mid-game late entry is only available in Game 1.'};
      if(players.length>=5) return {ok:false, reason:'Maximum 5 players.'};
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
      avatar_id:(typeof __sqAvatarIdForPlayer==='function' ? __sqAvatarIdForPlayer(row) : (row.avatar_id ?? null)),
      name:name,
      first_name:String(row.first_name||'').trim(),
      last_name:String(row.last_name||'').trim(),
      nickname:String(row.nickname||'').trim(),
      initials:String(row.initials||'').trim() || name.slice(0,2).toUpperCase(),
      type:type || (id?'registered':'guest')
    };
  }

  async function __sqAppendLatePlayer(row,type){
    if(window.__sqLateJoinInFlight)return false;
    var joiningState=state;
    var gate=__sqLateJoinEligibility();
    if(!gate.ok){ try{toast(gate.reason);}catch(_){} return false; }
    var p=__sqNormaliseLateJoinPlayer(row,type);
    if(!p) return false;
    var players=Array.isArray(state.players)?state.players:(state.players=[]);
    var key=__sqLateJoinPlayerKey(p,players.length);
    var dupe=players.some(function(existing,idx){return __sqLateJoinPlayerKey(existing,idx)===key || String(existing&&existing.name||'').trim().toLowerCase()===p.name.toLowerCase();});
    if(dupe){ try{toast('Player is already in this game.');}catch(_){} return false; }

    window.__sqLateJoinInFlight=true;window.__sqSecurityInputBlocked=true;
    try{await window.SQ_GAMEPLAY.syncRoster(players.concat([p]));if(state!==joiningState)throw new window.Sc004Error('game_state_changed');}
    catch(error){window.SQ_GAMEPLAY.failure(error);return false;}
    finally{window.__sqLateJoinInFlight=false;window.__sqSecurityInputBlocked=false;}
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

  function openAddGuestMenu(prev,initialName){
    var m=openModalShell('Add Guest Player','Joins as the final thrower',prev);
    styleAddPlayerShell(m);
    m.body.classList.add('np-body');
    var input=document.createElement('input');
    input.className='ms-player-input';
    input.id='sqLateGuestName';
    input.type='text';
    input.maxLength=40;
    input.placeholder='Guest name';
    input.autocomplete='off';
    input.value=String(initialName||'');
    var add=document.createElement('button');
    add.type='button'; add.className='btn np-save'; add.textContent='ADD PLAYER';
    add.onclick=function(){
      var name=String(input.value||'').trim();
      if(!name){try{toast('Enter a player name.');}catch(_){}return;}
      m.close();
      window.__sqConfirm(
        { title:'Add Player', message:'Are you sure you want to add '+name+'?' },
        function(){ __sqAppendLatePlayer({name:name},'guest'); },
        function(){ openAddGuestMenu(prev,name); }
      );
    };
    var field=document.createElement('div');
    field.className='np-field';
    var label=document.createElement('label');
    label.className='np-label'; label.htmlFor=input.id; label.textContent='Guest name';
    field.append(label,input);
    m.body.append(field,add);
    setTimeout(function(){try{input.focus();}catch(_){}},0);
  }

  async function openAddPlayerMenu(prev){
    var gate=__sqLateJoinEligibility();
    if(!gate.ok){try{toast(gate.reason);}catch(_){}return;}
    var m=openModalShell('Add Player','Joins as the final thrower',prev);
    styleAddPlayerShell(m);
    m.body.classList.add('sp2-list');
    var active=new Set((state.players||[]).map(function(p){return String(p&&p.name||'').trim().toLowerCase();}).filter(Boolean));

    // Keep a usable action visible immediately. Registered-player discovery is
    // cloud-backed and may be slow or unavailable on a mobile connection.
    addPlayerChoice(m.body,{ico:'add',label:'Guest Player',desc:'Add by name • may change game classification',onClick:function(){m.close();openAddGuestMenu(function(){openAddPlayerMenu(prev);});}});
    var loading=document.createElement('p');
    loading.className='tag sq-add-player-loading';
    loading.textContent='Loading registered players…';
    m.body.appendChild(loading);

    var rows=[];
    var loadFailed=false;
    try{
      if(typeof cloudListPlayers==='function') rows=await cloudListPlayers();
      else loadFailed=true;
    }catch(e){
      loadFailed=true;
      console.warn('[SQ] Add Player cloud list failed',e);
    }
    // The user may already have chosen Guest Player or closed the menu while
    // the cloud request was in flight. Never mutate a detached modal.
    if(!document.contains(m.bd)) return;
    try{ loading.remove(); }catch(_){}

    rows=(Array.isArray(rows)?rows:[]).filter(function(p){return !active.has(String(p&&p.name||'').trim().toLowerCase());});
    if(rows.length){
      rows.forEach(function(p){
        var name=(typeof __sqPlayerPretty==='function'?__sqPlayerPretty(p):'') || p.name || 'Player';
        addPlayerChoice(m.body,{ico:'add',label:name,desc:'Registered player • final thrower',cls:'green',onClick:function(){
          m.close();
          window.__sqConfirm(
            { title:'Add Player', message:'Are you sure you want to add '+name+'?' },
            function(){ __sqAppendLatePlayer(p,'registered'); },
            function(){ openAddPlayerMenu(prev); }
          );
        }},p);
      });
    }else{
      var empty=document.createElement('p');
      empty.className='tag';
      empty.textContent=loadFailed?'Registered players unavailable. Guest entry still works.':'No other registered players available.';
      m.body.appendChild(empty);
    }
  }
  window.__sqOpenAddPlayerMenu=openAddPlayerMenu;

  function removeCurrentPlayer(index){
    var oldCurrent=state.currentPlayer,next=Math.min(index,state.players.length-2);
    var map=i=>i===index?next:i>index?i-1:i;
    var remap=(object,key)=>{if(object&&Number.isInteger(object[key]))object[key]=map(object[key]);};
    var catchUp=cu=>{if(!cu)return;var active=(cu.jobs||[])[cu.activeJobIndex];cu.jobs=(cu.jobs||[]).filter(job=>job.playerIndex!==index);cu.jobs.forEach(job=>{remap(job,'playerIndex');if(/^idx:\d+$/.test(job.playerKey||''))job.playerKey='idx:'+job.playerIndex;});remap(cu,'resumePlayer');if(active&&!cu.jobs.includes(active)){cu.active=false;cu.activeJobIndex=-1;}else if(active)cu.activeJobIndex=cu.jobs.indexOf(active);};
    state.players.splice(index,1);if(Array.isArray(state.score))state.score.splice(index,1);
    if(Array.isArray(state.match?.wins))state.match.wins.splice(index,1);
    for(var key of ['hits','totals60','totals100','totals140'])if(Array.isArray(state.matchAgg?.[key]))state.matchAgg[key].splice(index,1);
    state.history=(state.history||[]).filter(entry=>entry.player!==index);
    state.history.forEach(entry=>{remap(entry,'player');remap(entry.absenceCursorBefore,'player');catchUp(entry.catchUpStateBefore);catchUp(entry.catchUpStartStateBefore);});
    catchUp(state.__sqCatchUp);remap(state,'currentPlayer');
    if(state.uiLastGo?.player===index)delete state.uiLastGo;else remap(state.uiLastGo,'player');
    if(state._decider?.winner===index)state._decider=null;else remap(state._decider,'winner');
    if(oldCurrent===index)state.currentDart=0;
    try{delete window.__sqDmdFightBenchmarks;window.__sqDmdHardClearQueue?.();}catch(_){}
  }

  function openRemovePlayerMenu(prev){
    var m=openModalShell('Remove Player','Current game only',prev);
    if((state.match?.history||[]).length){var warning=document.createElement('p');warning.className='tag';warning.textContent='An accepted game is part of this match. Participant history changes require an administrator.';m.body.appendChild(warning);return;}
    (state.players||[]).forEach(function(player,index){
      var name=player.name||('Player '+(index+1));
      addRow(m.body,{ico:'remove',label:'Remove '+name,desc:'Current game only',cls:'danger',onClick:function(){
        window.__sqConfirm({title:'Remove Player',message:'Remove '+name+' from the current game?'},async function(){
          if(!window.SQ_GAMEPLAY.canDiscard())return;
          var removingState=state;var players=state.players.filter(function(_,i){return i!==index;});
          window.__sqSecurityInputBlocked=true;
          try{await window.SQ_GAMEPLAY.syncRoster(players);if(state!==removingState)throw new window.Sc004Error('game_state_changed');removeCurrentPlayer(index);save();m.close();if(typeof buildEverythingChunked==='function')await buildEverythingChunked();updateUI();}
          catch(error){window.SQ_GAMEPLAY.failure(error);}
          finally{window.__sqSecurityInputBlocked=false;}
        });
      }});
    });
  }
  function openMatchDisplayMenu(prev){
    var m=openModalShell('Match Display','Only this match; saved player profiles stay unchanged',prev);
    (state.players||[]).forEach(function(player,index){
      if(player?.isShadow||player?.virtual)return;
      addPlayerChoice(m.body,{label:player.name||'Player',desc:'Edit match initials',onClick:function(){
        m.close();var edit=openModalShell('Match Initials',player.name||'Player',function(){openMatchDisplayMenu(prev);});
        var input=document.createElement('input');input.className='ms-player-input';input.maxLength=5;input.value=player.initials||'';input.setAttribute('aria-label','Match initials');
        var saveButton=document.createElement('button');saveButton.type='button';saveButton.className='btn primary';saveButton.textContent='SAVE MATCH INITIALS';
        saveButton.onclick=async function(){saveButton.disabled=true;try{await window.SQ_GAMEPLAY.updateDisplay(index,{initials:input.value.trim().toUpperCase()});edit.close();}catch(error){saveButton.disabled=false;}};
        edit.body.append(input,saveButton);setTimeout(function(){input.focus();},0);
      }},player);
    });
  }

  window.__sqOpenGameMenu106=function(){
    var m=openModalShell('Game Menu','Live game controls');
    // Safe / frequently-used actions first.
    addRow(m.body,{ico:'stats',label:'Stats',desc:'Race, game & match stats',cls:'blue',onClick:function(){m.close(); window.openStatsHubDialog();}});
    var __tvOn=false; try{ __tvOn=!!(window.__sqTvModeIsActive&&window.__sqTvModeIsActive()); }catch(_){ }
    addRow(m.body,{ico:'tv',label:'TV Mode (Beta)'+(__tvOn?' • ON':''),desc:'16:9 big-screen live view',cls:(__tvOn?'orange':''),onClick:function(){
      m.close();
      try{
        if(typeof window.__sqTvModeToggle==='function') window.__sqTvModeToggle(!__tvOn);
        else if(typeof toast==='function') toast('TV Mode unavailable');
      }catch(e){ try{console.warn('[SQ] TV Mode toggle failed',e);}catch(_){ } }
    }});
    // SC-071 hides only the beta menu entry; experimental code/settings stay intact.
    var __addGate=__sqLateJoinEligibility();
    addRow(m.body,{ico:'add',label:'Add Player',desc:(__addGate.ok?'Final thrower • available before 17s':__addGate.reason),cls:(__addGate.ok?'green':''),onClick:function(){
      if(!__addGate.ok){try{toast(__addGate.reason);}catch(_){}return;}
      m.close(); setTimeout(function(){ openAddPlayerMenu(window.__sqOpenGameMenu106); },0);
    }});
    addRow(m.body,{ico:'remove',label:'Remove Player',desc:'Remove from this game',onClick:function(){m.close(); openRemovePlayerMenu(window.__sqOpenGameMenu106);}});
    addRow(m.body,{ico:'edit',label:'Match Display',desc:'Match-only initials; saved profiles unchanged',onClick:function(){m.close();openMatchDisplayMenu(window.__sqOpenGameMenu106);}});
    var __orderGate=typeof __sqInitialOrderAmendEligibility==='function'?__sqInitialOrderAmendEligibility():{ok:false,reason:'Initial order correction unavailable.'};
    addRow(m.body,{ico:'order',label:'Amend Initial Order',desc:(__orderGate.ok?'Game 1 • correction before Round 1 completes':__orderGate.reason),onClick:function(){
      if(!__orderGate.ok){try{toast(__orderGate.reason);}catch(_){}return;}
      m.close();showPlayerOrderDialog({amend:true,onBack:window.__sqOpenGameMenu106});
    }});
    // Destructive group, set apart below a divider.
    try{ m.body.insertAdjacentHTML('beforeend','<div class="sq-menu106-sep" aria-hidden="true"></div>'); }catch(_){ }
    addRow(m.body,{ico:'restart',label:'Restart Game',desc:'Reset this game',cls:'danger',onClick:function(){m.close(); doRestartGame();}});
    addRow(m.body,{ico:'stop',label:'End Game',desc:'Go to game leaderboard',cls:'danger',onClick:function(){m.close(); doEndGame();}});
    addRow(m.body,{ico:'finish',label:'End Match',desc:'Return to start screen',cls:'danger',onClick:function(){m.close(); doEndMatch();}});
  };

  window.openStatsHubDialog=function(){
    try{ if(typeof __sqSetStatsOrigin==='function') __sqSetStatsOrigin('ingame'); }catch(_){ }
    var m=openModalShell('Player Stats','Choose a stats view',document.body.dataset.page==='game'?window.__sqOpenGameMenu106:null);
    addRow(m.body,{ico:'race',label:'Game Race',desc:'Score race chart',cls:'orange',onClick:function(){m.close(); openGameRaceDialog();}});
    addRow(m.body,{ico:'stats',label:'Game Stats',desc:'Current game breakdown',cls:'blue',onClick:function(){m.close(); openGameStatsDialog();}});
    addRow(m.body,{ico:'table',label:'Match Stats',desc:'Match totals and averages',cls:'blue',onClick:function(){m.close(); openMatchStatsDialog();}});
    addRow(m.body,{ico:'trophy',label:'High Scores (Official)',desc:'Official high-score view',cls:'green',onClick:function(){m.close(); openHighScoresDialog();}});
    addRow(m.body,{ico:'warning',label:'Low Scores (Official)',desc:'Official low-score view',cls:'green',onClick:function(){m.close(); openLowScoresDialog();}});
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
      navigateToStartScreen=function(){ clearTournamentRuntime('navigate home'); var r=old.apply(this,arguments); [50,160,350].forEach(function(ms){setTimeout(refreshDeferredHome,ms);}); return r; };
      navigateToStartScreen.__sqFix106Wrapped=true;
      try{window.navigateToStartScreen=navigateToStartScreen;}catch(_){ }
    }
  }catch(e){console.warn('[SQ] Fix106 navigate wrapper failed',e);}

  document.addEventListener('DOMContentLoaded',function(){ setTimeout(ensureHomePanels,180); });
  window.addEventListener('load',function(){ setTimeout(ensureHomePanels,250); });
  setTimeout(ensureHomePanels,250);
  try{ console.info('[SQ] Fix106 home/menu/stats reset active'); }catch(_){ }
})();
