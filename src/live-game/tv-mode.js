/* SC-037 — Landscape TV Mode (Beta)
   Presentation-only overlay. Reads canonical live game state; never writes scoring,
   rankings, XP, match results or Supabase data. */
(function(){
  'use strict';

  var ROOT_ID='sqTvModeOverlay';
  var timer=0;

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  function gameState(){ try{return (typeof state!=='undefined'&&state)?state:null;}catch(_){return null;} }
  function playerName(p,i){
    try{
      if(typeof __sqPlayerPretty==='function'){ var pretty=__sqPlayerPretty(p); if(pretty) return pretty; }
    }catch(_){}
    return String((p&&(p.nickname||p.name||p.displayName||p.initials))||('PLAYER '+(i+1))).trim();
  }
  function modeUnsupported(s){
    if(!s||!Array.isArray(s.players)||s.players.length<2||s.players.length>6) return 'TV Mode currently supports 2–6 player games.';
    var m=s.match||{};
    var bag=[s.mode,s.gameMode,m.mode,m.gameMode,m.practiceType,m.gameVariant].map(function(v){return String(v||'').toLowerCase();}).join(' ');
    if(m.forcePractice||m.isPractice||s.isPractice||bag.indexOf('practice')>=0||bag.indexOf('training')>=0) return 'TV Mode beta is currently Match Play only.';
    if(bag.indexOf('turbo')>=0) return 'TV Mode beta is currently Classic Match Play only.';
    return '';
  }
  function totalFor(s,p){
    try{ if(typeof totalScoreForPlayer==='function') return Number(totalScoreForPlayer(p)||0); }catch(_){}
    var rows=(s.score&&s.score[p])||[], t=0;
    rows.forEach(function(e){t+=Number((e&&e.roundTotal)||0);});
    return t;
  }
  function roundLabel(r){
    try{
      var d=(typeof ROUNDS!=='undefined'&&ROUNDS)?ROUNDS[r]:null;
      if(!d) return String(r+1);
      if(d.type==='number') return String(d.target);
      if(d.type==='doubles') return 'D';
      if(d.type==='triples') return 'T';
      if(d.type==='bull') return 'B';
      return String(d.target||d.label||r+1);
    }catch(_){return String(r+1);}
  }
  function hasDarts(e){return !!(e&&Array.isArray(e.darts)&&e.darts.some(function(d){return !!d;}));}
  function cumulative(s,p,r){
    var rows=(s.score&&s.score[p])||[], t=0, any=false;
    for(var i=0;i<=r;i++){ var e=rows[i]; if(hasDarts(e)){ any=true; t+=Number(e.roundTotal||0); } }
    return {value:t,any:any};
  }
  function roundScore(s,p,r){ var e=s.score&&s.score[p]&&s.score[p][r]; return hasDarts(e)?Number(e.roundTotal||0):null; }
  function avgPair(s,p){
    var rows=(s.score&&s.score[p])||[], vals=[];
    rows.forEach(function(e){if(hasDarts(e)) vals.push(Number(e.roundTotal||0));});
    var game=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:0;
    var last=vals.slice(-3); var a3=last.length?last.reduce(function(a,b){return a+b;},0)/last.length:0;
    return {a3:a3,game:game};
  }
  function dartToken(d){
    if(!d) return '—';
    var k=String(d.kind||'').toUpperCase();
    if(k==='MISS') return 'MISS';
    if(k==='B') return Number(d.points||d.score||d.value||0)>=50?'BULL 50':'BULL 25';
    var sec=d.sector!=null?d.sector:'';
    if(k==='DOUBLE') k='D'; if(k==='TRIPLE') k='T';
    if(k==='S'||k==='D'||k==='T') return k+sec;
    var pts=Number(d.points||d.score||d.value);
    return Number.isFinite(pts)?String(pts):(k||'—');
  }
  function shell(){
    var root=document.getElementById(ROOT_ID);
    if(root) return root;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='sq-tv-mode';
    root.setAttribute('aria-label','Shateki Quest TV Mode');
    root.innerHTML=
      '<div class="sq-tv-rotate">ROTATE DEVICE FOR TV MODE</div>'+
      '<header class="sq-tv-head">'+
        '<div class="sq-tv-brand">SHATEKI<span>QUEST</span></div>'+
        '<div class="sq-tv-dmd"><div id="sqTvDmdTop"></div><strong id="sqTvDmdMain"></strong><div id="sqTvDmdBottom"></div></div>'+
        '<div class="sq-tv-avg"><div><span>3R AVG</span><strong id="sqTvAvg3">0.0</strong></div><div><span>GAME AVG</span><strong id="sqTvAvgGame">0.0</strong></div></div>'+
        '<button class="sq-tv-exit" id="sqTvExit" type="button">EXIT TV MODE</button>'+
      '</header>'+
      '<div class="sq-tv-players" id="sqTvPlayers"></div>'+
      '<main class="sq-tv-main">'+
        '<section class="sq-tv-table-card"><div class="sq-tv-section-title"><span>SCOREBOARD</span><span id="sqTvRoundMeta"></span></div><div class="sq-tv-table-wrap"><table class="sq-tv-table"><thead id="sqTvThead"></thead><tbody id="sqTvTbody"></tbody></table></div></section>'+
        '<aside class="sq-tv-race-card"><div class="sq-tv-section-title"><span>GAME RACE</span><span id="sqTvRaceMeta"></span></div><div class="sq-tv-race" id="sqTvRace"></div></aside>'+
      '</main>'+
      '<footer class="sq-tv-rail">'+
        '<div class="sq-tv-darts" id="sqTvDarts"></div>'+
        '<button class="sq-tv-action" id="sqTvMenu" type="button">MENU</button>'+
        '<button class="sq-tv-action" id="sqTvFull" type="button">FULLSCREEN</button>'+
      '</footer>';
    document.body.appendChild(root);
    root.querySelector('#sqTvExit').onclick=function(){disable();};
    root.querySelector('#sqTvMenu').onclick=function(){try{if(window.__sqOpenGameMenu106)window.__sqOpenGameMenu106();}catch(_){}};
    root.querySelector('#sqTvFull').onclick=function(){
      try{
        if(document.fullscreenElement){ document.exitFullscreen&&document.exitFullscreen(); }
        else if(document.documentElement.requestFullscreen){ document.documentElement.requestFullscreen(); }
      }catch(_){}
    };
    return root;
  }
  function syncPadClearance(){
    try{
      var pad=document.getElementById('padBar');
      var clearance=0;
      if(pad){
        var style=window.getComputedStyle(pad);
        var rect=pad.getBoundingClientRect();
        var visible=style.display!=='none'&&style.visibility!=='hidden'&&rect.height>0&&rect.bottom>0;
        if(visible) clearance=Math.max(0,Math.ceil(window.innerHeight-rect.top));
      }
      document.documentElement.style.setProperty('--sq-tv-pad-h',clearance+'px');
      var root=document.getElementById(ROOT_ID);
      if(root) root.style.bottom=clearance+'px';
    }catch(_){}
  }
  function render(){
    if(!document.body||document.body.dataset.page!=='game'){ if(active()) disable(); return; }
    syncPadClearance();
    var s=gameState(); if(!s||!Array.isArray(s.players)) return;
    var root=document.getElementById(ROOT_ID); if(!root||!active()) return;
    var players=s.players, cp=Math.max(0,Math.min(players.length-1,Number(s.currentPlayer)||0));
    root.style.setProperty('--sq-tv-count',String(Math.max(2,Math.min(6,players.length))));
    var cr=Math.max(0,Number(s.currentRound)||0), cd=Math.max(0,Math.min(2,Number(s.currentDart)||0));
    var totals=players.map(function(_,i){return totalFor(s,i);}), lead=totals.length?Math.max.apply(null,totals):0;
    var wins=(s.match&&Array.isArray(s.match.wins))?s.match.wins:[];
    var targetWins=Math.max(1,Number(s.match&&s.match.targetWins)||1);
    var roundCount=(typeof MAX_ROUNDS==='number'&&MAX_ROUNDS>0)?MAX_ROUNDS:14;
    var curName=playerName(players[cp],cp).toUpperCase();
    var av=avgPair(s,cp);

    root.querySelector('#sqTvDmdTop').textContent='ROUND '+roundLabel(cr)+'  •  DART '+(cd+1)+' OF 3';
    root.querySelector('#sqTvDmdMain').textContent=curName+' TO THROW';
    root.querySelector('#sqTvDmdBottom').textContent='CLASSIC MATCH PLAY  •  FIRST TO '+targetWins;
    root.querySelector('#sqTvAvg3').textContent=av.a3.toFixed(1);
    root.querySelector('#sqTvAvgGame').textContent=av.game.toFixed(1);
    root.querySelector('#sqTvRoundMeta').textContent='ROUND '+(cr+1)+' / '+roundCount;
    root.querySelector('#sqTvRaceMeta').textContent='LEADER '+lead;

    root.querySelector('#sqTvPlayers').innerHTML=players.map(function(p,i){
      var diff=totals[i]-lead, w=Math.max(0,Number(wins[i]||0));
      return '<article class="sq-tv-player'+(i===cp?' active':'')+'">'+
        '<div class="sq-tv-player-name">'+esc(playerName(p,i))+'</div>'+
        '<div class="sq-tv-player-status">'+(i===cp?'NOW THROWING':'WAITING')+'</div>'+
        '<div class="sq-tv-player-score">'+totals[i]+' <small>'+(diff===0?'LEAD':diff)+'</small></div>'+
        '<div class="sq-tv-player-wins">WINS '+w+'/'+targetWins+'</div>'+
      '</article>';
    }).join('');

    var visible=6, start=Math.max(0,Math.min(Math.max(0,roundCount-visible),cr-3));
    if(cr<3) start=0;
    var end=Math.min(roundCount,start+visible);
    var thead='<tr><th>TARGET</th>'+players.map(function(p){return '<th>'+esc(playerName(p,0))+'</th>';}).join('')+'</tr>';
    var body='';
    for(var r=start;r<end;r++){
      body+='<tr class="'+(r===cr?'active':'')+'"><th>'+esc(roundLabel(r))+'</th>';
      for(var p=0;p<players.length;p++){
        var cum=cumulative(s,p,r), rs=roundScore(s,p,r), skip='';
        try{
          if(typeof __sqSkippedRoundState==='function'){
            var st=__sqSkippedRoundState(p,r); if(st==='pending') skip='»»»'; else if(st==='scratched') skip='X';
          }
        }catch(_){}
        var main=skip||(cum.any?String(cum.value):'—');
        var sub=skip?'':(rs==null?'':'('+rs+')');
        body+='<td class="'+(p===cp?'current-player':'')+'"><strong>'+main+'</strong><small>'+sub+'</small></td>';
      }
      body+='</tr>';
    }
    root.querySelector('#sqTvThead').innerHTML=thead;
    root.querySelector('#sqTvTbody').innerHTML=body;

    var denom=Math.max(lead,100);
    root.querySelector('#sqTvRace').innerHTML=players.map(function(p,i){
      var pct=Math.max(2,Math.min(100,totals[i]/denom*100));
      return '<div class="sq-tv-race-row'+(i===cp?' active':'')+'">'+
        '<span class="sq-tv-race-name">'+esc(playerName(p,i))+'</span>'+
        '<div class="sq-tv-race-track"><i style="width:'+pct.toFixed(1)+'%"></i></div>'+
        '<strong>'+totals[i]+'</strong>'+
      '</div>';
    }).join('');

    var entry=s.score&&s.score[cp]&&s.score[cp][cr], darts=(entry&&Array.isArray(entry.darts))?entry.darts:[];
    root.querySelector('#sqTvDarts').innerHTML=[0,1,2].map(function(i){
      return '<div class="sq-tv-dart '+(i===cd&&!s.finished?'next':'')+'"><span>DART '+(i+1)+'</span><strong>'+esc(dartToken(darts[i]))+'</strong></div>';
    }).join('');

    if(s.finished){ disable(); }
  }
  function active(){return !!(document.body&&document.body.classList.contains('sq-tv-mode-on'));}
  function enable(){
    var s=gameState(), reason=modeUnsupported(s);
    if(document.body.dataset.page!=='game'){ try{if(typeof toast==='function')toast('Start a game before opening TV Mode');}catch(_){} return false; }
    if(reason){ try{if(typeof toast==='function')toast(reason);}catch(_){} return false; }
    shell();
    document.body.classList.add('sq-tv-mode-on');
    render();
    if(timer) clearInterval(timer);
    timer=setInterval(render,250);
    try{window.dispatchEvent(new Event('resize'));}catch(_){}
    return true;
  }
  function disable(){
    if(timer){clearInterval(timer);timer=0;}
    document.body&&document.body.classList.remove('sq-tv-mode-on');
    try{document.documentElement.style.removeProperty('--sq-tv-pad-h');}catch(_){}
    var root=document.getElementById(ROOT_ID); if(root) root.remove();
    try{ if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen(); }catch(_){}
  }
  window.__sqTvModeIsActive=active;
  window.__sqTvModeSync=render;
  window.__sqTvModeToggle=function(on){return on===false?(disable(),false):enable();};
  window.addEventListener('pagehide',disable);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&active()&&!document.querySelector('.modal-backdrop:not(.hidden)'))disable();});
})();
