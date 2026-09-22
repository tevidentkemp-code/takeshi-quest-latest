
(function(){
  'use strict';
  if(window.__sqFix132PowerRankingsProperLayout) return;
  window.__sqFix132PowerRankingsProperLayout = true;

  var LIMIT_ROUNDS = 56;
  var MIN_ROUNDS = 28;
  var ACTIVE_DAYS = 14;
  var MODES=[{mode:'official',label:'Official'},{mode:'turbo',label:'Turbo'},{mode:'practice',label:'Practice'}];

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function key(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');}
  function parseMs(t){var n=Date.parse(t||'');return Number.isFinite(n)?n:0;}
  function playerName(p){if(p==null)return'';if(typeof p==='string')return p.trim();var n=String(p.name||p.player||p.player_name||p.playerName||p.display_name||'').trim();if(n)return n;var f=String(p.first_name||p.firstName||'').trim(),l=String(p.last_name||p.lastName||'').trim(),nick=String(p.nickname||'').trim();return f?(f+(nick?' "'+nick+'"':'')+(l?' '+l:'')):'';}
  function playersOf(g){var ps=g&&(g.players||(g.state&&g.state.players)||(g.raw&&g.raw.state&&g.raw.state.players));return Array.isArray(ps)?ps:[];}
  function totalsOf(g){var t=g&&(g.totals||(g.state&&g.state.totals)||(g.raw&&g.raw.totals)||(g.raw&&g.raw.state&&g.raw.state.totals));return Array.isArray(t)?t:[];}
  function boardOf(g){return g&&(g.board||g.score||(g.state&&(g.state.board||g.state.score))||(g.raw&&g.raw.state&&(g.raw.state.board||g.raw.state.score)));}
  function rowsForPlayer(board,pi){if(!Array.isArray(board))return[];if(Array.isArray(board[pi]))return board[pi];if(Array.isArray(board[0])&&board[0][pi]!=null)return board.map(function(r){return Array.isArray(r)?r[pi]:null;});return[];}
  function roundScore(ent){if(ent==null)return 0;if(typeof ent==='number'||typeof ent==='string')return Number(ent)||0;var keys=['roundTotal','round_total','points','score','total','val','value'];for(var i=0;i<keys.length;i++){var n=Number(ent[keys[i]]);if(Number.isFinite(n)&&n>=0)return n;}var darts=Array.isArray(ent.darts)?ent.darts:(Array.isArray(ent.throws)?ent.throws:null);if(darts)return darts.reduce(function(a,d){return a+(Number(d&&(d.points??d.score??d.val??d.value)||0)||0);},0);return 0;}
  function isTurboRow(g){try{var st=(g&&g.state)||{},rawst=(g&&g.raw&&g.raw.state)||{},m=st.match||rawst.match||g?.match||{},rules=st.tournamentRules||m.tournamentRules||rawst.tournamentRules||{};var type=String(g?.tournamentType||st.tournamentType||st.tournament_type||m.tournamentType||m.tournament_type||rawst.tournamentType||st.__sqTournamentDraft?.type||'').toLowerCase();return type==='turbo'||st.strictTimer===true||m.strictTimer===true||rules.strictTimer===true||Number(rules.throwLimitSeconds||st.throwLimitSeconds||m.throwLimitSeconds)===20||String(rules.startTarget||st.startTarget||m.startTarget||'')==='17';}catch(_){return false;}}
  function isPracticeRow(g){var st=(g&&g.state)||{},rawst=(g&&g.raw&&g.raw.state)||{};var mode=String(g?.mode||g?.game_mode||st.mode||st.gameMode||rawst.mode||'').toLowerCase();if(mode.includes('practice')||mode.includes('unofficial')||mode==='solo')return true;if(g?.isPractice===true||g?.is_practice===true||g?.practice===true||st.isPractice===true||st.is_practice===true||st.practice===true||rawst.is_practice===true)return true;return playersOf(g).length===1;}
  async function gamesFor(mode){mode=String(mode||'official').toLowerCase();try{if(typeof window.getGamesForMode==='function'){var rows=await window.getGamesForMode(mode);if(Array.isArray(rows))return rows;}}catch(_){}try{if(typeof __sqGetAllGamesNormalized==='function'){var all=await __sqGetAllGamesNormalized();return(all||[]).filter(function(g){if(typeof window.__sqGameModeKey==='function'){return window.__sqGameModeKey(g)===(mode==='classic'?'practice':mode);}var p=isPracticeRow(g),t=isTurboRow(g);if(mode==='practice')return p;if(mode==='turbo')return !p&&t;return !p&&!t;});}}catch(_){}return[];}
  function gameTs(g){return g?.ts||g?.created_at||g?.completed_at||(g?.state&&g.state.completed_at)||(g?.raw&&g.raw.created_at)||'';}
  function activeCutoffMs(){return Date.now()-(ACTIVE_DAYS*24*60*60*1000);}
  function isRecentlyActive(ms){return Number.isFinite(ms)&&ms>=activeCutoffMs();}
  async function savedNameMap(){try{var rows=typeof cloudListPlayers==='function'?await cloudListPlayers():[];var map=new Map();(rows||[]).forEach(function(p){var n=String(p&&p.name||'').trim();if(n)map.set(key(n),n);});return map;}catch(_){return new Map();}}
  async function officialSavedNameMap(){
    var map=await savedNameMap();
    if(map&&map.size)return map;
    try{
      var rows=typeof getSavedPlayers==='function'?getSavedPlayers():[];
      (rows||[]).forEach(function(p){var n=String(p&&p.name||'').trim();if(n)map.set(key(n),n);});
    }catch(_){}
    return map;
  }
  function isOfficialSavedPlayer(k,saved){return !!(saved&&saved.size&&saved.has(k));}

  async function rowsFromCleanView(mode){
    mode = String(mode || 'official').toLowerCase();
    try{
      if(typeof sb==='undefined') return null;
      if (mode === 'official' && typeof window.__sqFetchPowerRowsFromCleanRoundScores === 'function') {
        var guardedRows = await window.__sqFetchPowerRowsFromCleanRoundScores('official');
        if (Array.isArray(guardedRows) && guardedRows.length) return guardedRows;
      }
      var saved=await savedNameMap();
      var view = (typeof window.__sqPowerRankingCleanViewForMode === 'function')
        ? window.__sqPowerRankingCleanViewForMode(mode)
        : (mode === 'turbo' ? 'v_power_rankings_last56_turbo_clean' : (mode === 'practice' ? 'v_power_rankings_last56_practice_clean' : 'v_power_rankings_last56_official_clean'));
      var q=await sb.from(view).select('player,player_key,rounds_used,total_points,avg_per_round,last_played_at,rank_pos').limit(500);
      if(q.error) throw q.error;
      var rawRows = (q.data || []).sort(function(a,b){
        return (Number(b.avg_per_round || 0) - Number(a.avg_per_round || 0)) ||
          (Number(b.rounds_used || 0) - Number(a.rounds_used || 0)) ||
          String(a.player || '').localeCompare(String(b.player || ''));
      });
      var mapped = rawRows.map(function(r){
        var k=key(r.player_key||r.player), name=saved.get(k)||String(r.player||'').trim();
        if (saved && saved.size && !saved.has(k)) return null;
        var rounds=Math.min(LIMIT_ROUNDS,Math.max(0,Number(r.rounds_used||0)));
        var total=Number(r.total_points);
        var viewAvg=Number(r.avg_per_round);
        var rank=Number.isFinite(viewAvg) ? viewAvg : (Number.isFinite(total)&&rounds>0 ? total/rounds : 0);
        var lastMs=parseMs(r.last_played_at);return {player:name,playerKey:k,rounds:rounds,powerRank:rank,rankPos:Number(r.rank_pos||0)||null,qualified:(mode==='turbo'?rounds>0:rounds>=MIN_ROUNDS),active:(mode==='turbo'?true:isRecentlyActive(lastMs)),lastPlayedMs:lastMs,source:view};
      }).filter(function(r){return r.player&&Number.isFinite(r.powerRank)&&r.powerRank>0;});
      if (rawRows.length && !mapped.length) {
        try{ if(window.SQ_DEBUG) console.warn('[SQ] Power Rankings clean rows were filtered out by saved-player matching; showing raw DB rows.', { mode:mode, view:view, rawRows:rawRows.length }); }catch(_){}
        mapped = rawRows.map(function(r){
          var k=key(r.player_key||r.player), rounds=Math.min(LIMIT_ROUNDS,Math.max(0,Number(r.rounds_used||0)));
          var total=Number(r.total_points), viewAvg=Number(r.avg_per_round);
          var rank=Number.isFinite(viewAvg) ? viewAvg : (Number.isFinite(total)&&rounds>0 ? total/rounds : 0);
          var lastMs=parseMs(r.last_played_at);
          return {player:String(r.player||'').trim(),playerKey:k,rounds:rounds,powerRank:rank,rankPos:Number(r.rank_pos||0)||null,qualified:(mode==='turbo'?rounds>0:rounds>=MIN_ROUNDS),active:(mode==='turbo'?true:isRecentlyActive(lastMs)),lastPlayedMs:lastMs,source:view};
        }).filter(function(r){return r.player&&Number.isFinite(r.powerRank)&&r.powerRank>0;});
      }
      return mapped;
    }catch(e){
      try{
        if (typeof window.__sqFetchPowerRowsFromCleanRoundScores === 'function') {
          return await window.__sqFetchPowerRowsFromCleanRoundScores(mode);
        }
      }catch(_fallbackErr){}
      try{ if(window.SQ_DEBUG) console.warn('[SQ] Power Rankings clean source unavailable:',e); }catch(_){}
      return null;
    }
  }

  async function computePowerRows(mode){
    mode=String(mode||'official').toLowerCase();
    var viewRows=await rowsFromCleanView(mode);
    if(Array.isArray(viewRows)&&viewRows.length){
      return viewRows.sort(function(a,b){return ((b.active!==false)-(a.active!==false))||(b.qualified-a.qualified)||(b.powerRank-a.powerRank)||(b.rounds-a.rounds)||a.player.localeCompare(b.player);});
    }
    return [];
  }

  function modeNote(mode){
    if(mode==='turbo')return '';
    if(mode==='practice')return 'Practice Power Rank = saved players only; average points per round from the player’s latest '+LIMIT_ROUNDS+' Practice rounds. Inactive players (no game in '+ACTIVE_DAYS+' days) are greyed out at the bottom.';
    return 'Official Power Rank = saved players only; average points per round from each player’s latest '+LIMIT_ROUNDS+' official rounds. Inactive players (no game in '+ACTIVE_DAYS+' days) are greyed out at the bottom.';
  }

  function buildModal(initialMode){
    document.querySelectorAll('.sq132-bd,.sq108-bd').forEach(function(n){try{n.remove();}catch(_){}});
    var mode=['official','turbo','practice'].indexOf(String(initialMode||'').toLowerCase())>=0?String(initialMode).toLowerCase():'official';
    var bd=document.createElement('div');bd.className='modal-backdrop sq132-bd';
    var modal=document.createElement('div');modal.className='modal sq132-modal';
    bd.appendChild(modal);
    modal.innerHTML='<div class="sq132-head"><div class="sq132-title"><h3>Power Rankings</h3><div class="sq132-sub">Recent form by round average.</div></div><div class="sq132-tabs">'+MODES.map(function(m){return '<button type="button" data-mode="'+m.mode+'" class="'+(m.mode===mode?'active':'')+'">'+m.label+'</button>';}).join('')+'</div></div><div class="sq132-body"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div><div class="sq132-footer"><button type="button" class="btn sq132-back">Back</button><button type="button" class="btn sq132-close">Close</button></div>';
    document.body.appendChild(bd);
    try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(bd,modal,function(){bd.remove();});}catch(_){}
    var body=modal.querySelector('.sq132-body'),tabs=modal.querySelector('.sq132-tabs');
    function setMode(m){mode=m;tabs.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});render();}
    tabs.onclick=function(e){var b=e.target.closest('button[data-mode]');if(b)setMode(b.dataset.mode);};
    modal.querySelector('.sq132-back').onclick=function(){bd.remove();try{if(typeof window.openLeagueRankingsDialog==='function')window.openLeagueRankingsDialog();}catch(_){}};
    modal.querySelector('.sq132-close').onclick=function(){bd.remove();};
    bd.addEventListener('click',function(e){if(e.target===bd)bd.remove();});
    async function render(){
      body.innerHTML='<div class="sq132-note">'+esc(modeNote(mode))+'</div><div class="sq132-table-wrap"><table class="sq132-table"><colgroup><col style="width:64px"><col><col style="width:170px"></colgroup><thead><tr><th>#</th><th>PLAYER</th><th>POWER RANK</th></tr></thead><tbody><tr><td colspan="3">Loading…</td></tr></tbody></table></div>';
      var tb=body.querySelector('tbody');
      var rows;
      try{rows=await window.__sqWithCloudTimeout(computePowerRows(mode),12000,'power-rankings');}
      catch(err){
        try{console.warn('[SQ] Power Rankings cloud read failed/timed out',err);}catch(_){}
        tb.innerHTML='<tr><td colspan="3" style="padding:14px;opacity:.85;">'+window.__sqCloudErrorHtml()+'</td></tr>';
        var rb=tb.querySelector('[data-action="cloudRetry"]');if(rb)rb.onclick=function(){render();};
        return;
      }
      if(!rows.length){tb.innerHTML='<tr><td colspan="3">Power Rankings data is not available yet for '+esc(mode)+'. Required clean Supabase view/data source is missing or empty.</td></tr>';return;}
      var rank=0;
      tb.innerHTML=rows.map(function(r){
        var active=r.active!==false;
        var qualified=r.qualified!==false;
        var q=active&&qualified;
        if(q) rank++;
        var shown=q?(r.rankPos||rank):'—';
        var cls=(active?'':'inactive ')+(qualified?'':'unqualified');
        var title=!active?' title="Inactive: no completed game in the last '+ACTIVE_DAYS+' days"':(qualified?'':' title="Needs '+Math.max(0,MIN_ROUNDS-(r.rounds||0))+' more round(s) to qualify"');
        return '<tr class="'+cls.trim()+'"'+title+'><td class="rank-cell">'+shown+'</td><td>'+esc(r.player)+'</td><td class="power-cell">'+Number(r.powerRank||0).toFixed(2)+'</td></tr>';
      }).join('');
    }
    render();
  }

  window.openPowerLeagueDialog=window.openPowerRankingsDialog=function(initialMode){buildModal(initialMode||'official');};
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('#leaguePowerRankingsBtn'):null;if(!b)return;try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){}window.openPowerLeagueDialog('official');},true);
  try{console.info('[SQ] Fix132 Power Rankings proper layout/rank active');}catch(_){ }
})();
