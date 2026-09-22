
(function(){
  if(window.__sqFix100LeagueRanksFormat) return;
  window.__sqFix100LeagueRanksFormat = true;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function norm(s){return String(s||'').trim().toLowerCase();}
  function parseMs(t){try{return typeof window.__sqParsePowerRankTs==='function'?window.__sqParsePowerRankTs(t):(Number.isFinite(Date.parse(t||''))?Date.parse(t||''):0);}catch(_){return 0;}}
  function fmtDateTime(ts){try{var d=new Date(ts||0);if(!Number.isFinite(d.getTime()))return '—';return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');}catch(_){return '—';}}
  function playerName(p){if(p==null)return '';if(typeof p==='string')return p.trim();var n=String(p.name||p.player||p.player_name||p.playerName||p.display_name||p.nick||'').trim();if(n)return n;var f=String(p.first_name||p.firstName||'').trim(),l=String(p.last_name||p.lastName||'').trim(),nick=String(p.nickname||'').trim();return f?(nick?(f+' "'+nick+'"'+(l?' '+l:'')):(f+(l?' '+l:''))):'';}
  function playersOf(g){var ps=g&&(g.players||(g.state&&g.state.players)||(g.raw&&g.raw.state&&g.raw.state.players));return Array.isArray(ps)?ps:[];}
  function totalsOf(g){var t=g&&(g.totals||(g.state&&g.state.totals)||(g.raw&&g.raw.totals)||(g.raw&&g.raw.state&&g.raw.state.totals));return Array.isArray(t)?t:[];}
  function boardOf(g){return g&&(g.board||g.score||(g.state&&(g.state.board||g.state.score))||(g.raw&&g.raw.state&&(g.raw.state.board||g.raw.state.score)));}
  function rowsForPlayer(board,pi){if(!Array.isArray(board))return [];if(Array.isArray(board[pi]))return board[pi];if(Array.isArray(board[0])&&board[0][pi]!=null)return board.map(function(r){return Array.isArray(r)?r[pi]:null;});return [];}
  function roundScore(ent){if(ent==null)return 0;if(typeof ent==='number'||typeof ent==='string')return Number(ent)||0;var keys=['roundTotal','round_total','points','score','total','val','value'];for(var i=0;i<keys.length;i++){var n=Number(ent[keys[i]]);if(Number.isFinite(n)&&n>0)return n;}var darts=Array.isArray(ent.darts)?ent.darts:(Array.isArray(ent.throws)?ent.throws:null);if(darts)return darts.reduce(function(a,d){return a+(Number(d&&(d.points||d.score||d.val||d.value)||0)||0);},0);return 0;}
  function totalFor(g,pi){var t=totalsOf(g),v=t[pi];if(typeof v==='number'||typeof v==='string'){var n=Number(v)||0;if(n>0)return n;}if(v&&typeof v==='object'){var no=Number(v.total||v.score||v.points||v.val);if(Number.isFinite(no)&&no>0)return no;}return rowsForPlayer(boardOf(g),pi).reduce(function(a,e){return a+roundScore(e);},0);}
  function isPractice(g){var st=(g&&g.state)||{},rawst=(g&&g.raw&&g.raw.state)||{};var mode=String((g&&g.mode)||(g&&g.game_mode)||st.mode||st.gameMode||rawst.mode||'').toLowerCase();return mode.indexOf('practice')>=0||mode.indexOf('unofficial')>=0||mode==='solo'||(g&&g.isPractice===true)||(g&&g.is_practice===true)||st.isPractice===true||st.is_practice===true||playersOf(g).length===1;}
  function isTurbo(g){try{var st=(g&&g.state)||{},rawst=(g&&g.raw&&g.raw.state)||{},m=st.match||rawst.match||(g&&g.match)||{},rules=st.tournamentRules||m.tournamentRules||rawst.tournamentRules||{};var type=String((g&&g.tournamentType)||st.tournamentType||st.tournament_type||m.tournamentType||m.tournament_type||rawst.tournamentType||(st.__sqTournamentDraft&&st.__sqTournamentDraft.type)||'').toLowerCase();return type==='turbo'||st.strictTimer===true||m.strictTimer===true||rules.strictTimer===true||Number(st.throwLimitSeconds||m.throwLimitSeconds||rules.throwLimitSeconds||0)===20||String(rules.startTarget||st.startTarget||m.startTarget||'').toLowerCase()==='17';}catch(_){return false;}}
  async function allGames(){try{if(typeof window.__sqGetAllGamesNormalized==='function'){var n=await window.__sqGetAllGamesNormalized();if(Array.isArray(n))return n;}}catch(_){}try{if(typeof cloudFetchAllGamesAsLocal==='function'){var c=await cloudFetchAllGamesAsLocal();if(Array.isArray(c))return c;}}catch(_){}return [];}
  async function gamesFor(bucket){var gs=await allGames();return gs.filter(function(g){if(g&&(g.archived_at||g.archivedAt))return false;if(bucket==='turbo')return isTurbo(g)&&!isPractice(g);if(bucket==='practice')return isPractice(g)&&!isTurbo(g);return !isTurbo(g)&&!isPractice(g);}).sort(function(a,b){return parseMs(b.ts||b.created_at)-parseMs(a.ts||a.created_at);});}
  function denominator(bucket,g,pi){if(bucket==='turbo')return 7;var rows=rowsForPlayer(boardOf(g),pi).filter(function(x){return x!=null;});return rows.length>=7?rows.length:14;}
  async function playerRows(bucket){var rows=[];(await gamesFor(bucket)).forEach(function(g){playersOf(g).forEach(function(p,pi){var name=playerName(p);if(!name)return;var score=totalFor(g,pi);if(!(score>0))return;rows.push({player:name,playerKey:norm(name),score:score,avg:score/denominator(bucket,g,pi),ts:g.ts||g.created_at||"",game:g});});});return rows.sort(function(a,b){return (b.score-a.score)||(parseMs(b.ts)-parseMs(a.ts))||String(a.player).localeCompare(String(b.player));});}
  function tabsEl(modes){var tabs=document.createElement('div');tabs.className='sq-league-tabs';modes.forEach(function(m){var b=document.createElement('button');b.type='button';b.dataset.mode=m.mode;b.textContent=m.label;tabs.appendChild(b);});return tabs;}
  function setTabs(tabs,mode){Array.from(tabs.querySelectorAll('button[data-mode]')).forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});}
  function buildModal(title,sub,modes){var overlay=document.createElement('div');overlay.className='modal-backdrop sq-fix100-backdrop';var modal=document.createElement('div');modal.className='modal sq-wide-modal';var head=document.createElement('div');head.className='sq-league-clean-head';head.innerHTML='<div class="sq-league-clean-title"><h3>'+esc(title)+'</h3>'+(sub?'<div class="sq-league-clean-sub">'+esc(sub)+'</div>':'')+'</div>';var tabs=tabsEl(modes);head.appendChild(tabs);var body=document.createElement('div');body.className='modal-body';var footer=document.createElement('div');footer.className='modal-footer';var back=document.createElement('button');back.className='btn sq-pill';back.textContent='Back';var close=document.createElement('button');close.className='btn sq-pill';close.textContent='Close';footer.append(back,close);modal.append(head,body,footer);overlay.appendChild(modal);document.body.appendChild(overlay);try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}back.onclick=function(){overlay.remove();try{if(typeof openLeagueRankingsDialog==='function')openLeagueRankingsDialog();}catch(_){}};close.onclick=function(){overlay.remove();};overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};return {overlay:overlay,modal:modal,head:head,tabs:tabs,body:body};}
  async function savedPlayerKeys(){try{if(typeof cloudListPlayers==='function'){var rows=await cloudListPlayers();return new Set((rows||[]).map(function(p){return norm(playerName(p)||p.name);}).filter(Boolean));}}catch(_){}return new Set();}

// [removed: openTop50ScoresDialog fix100 def] audit P5.3 batch 3 — shadowed by later canonical definition

  async function fetchOfficialHighScoreLeagueClean(){
    var client=null;
    try{ if(typeof ensureCloudInit==='function') ensureCloudInit(); }catch(_){}
    try{ client=window.sb||(typeof sb!=='undefined'?sb:null); }catch(_){ client=null; }
    if(!client||typeof client.from!=='function') throw new Error('Supabase client unavailable');
    // @MODE:HIGH_SCORE_LEAGUE_OFFICIAL_CLEAN_SOURCE
    // Official High Score League uses the DB-classified clean view only. Do not fall back to high_scores_sp,
    // high_score_league_official, legacy__high_score_league_official, or browser game aggregation.
    var res=await client.from('v_high_score_league_official_from_games_clean')
      .select('player,best_score,best_ts,game_id,avg_round,rounds')
      .order('best_score',{ascending:false})
      .order('best_ts',{ascending:false})
      .limit(5000);
    if(res&&res.error){
      res=await client.from('v_high_score_league_official_from_games_clean')
        .select('player,best_score,best_ts,game_id,avg_round')
        .order('best_score',{ascending:false})
        .order('best_ts',{ascending:false})
        .limit(5000);
    }
    if(res&&res.error){
      res=await client.from('v_high_score_league_official_from_games_clean')
        .select('player,best_score,best_ts,game_id,rounds')
        .order('best_score',{ascending:false})
        .order('best_ts',{ascending:false})
        .limit(5000);
    }
    if(res&&res.error){
      res=await client.from('v_high_score_league_official_from_games_clean')
        .select('player,best_score,best_ts,game_id')
        .order('best_score',{ascending:false})
        .order('best_ts',{ascending:false})
        .limit(5000);
    }
    if(res&&res.error) throw res.error;
    var saved=await savedPlayerKeys();
    return (Array.isArray(res&&res.data)?res.data:[]).map(function(r){
      var score=Number(r.best_score||0);
      var hasAvg=r.avg_round!==null&&r.avg_round!==undefined&&r.avg_round!=='';
      var hasRounds=r.rounds!==null&&r.rounds!==undefined&&r.rounds!=='';
      var avg=hasAvg?Number(r.avg_round):NaN, rounds=hasRounds?Number(r.rounds):NaN;
      if(!Number.isFinite(avg)&&Number.isFinite(score)&&Number.isFinite(rounds)&&rounds>0) avg=score/rounds;
      return {player:String(r.player||'').trim(),playerKey:norm(r.player),score:score,avg:Number.isFinite(avg)?avg:null,ts:r.best_ts||'',game_id:r.game_id||''};
    }).filter(function(r){return r.player&&r.score>0&&(!saved.size||saved.has(r.playerKey));})
      .sort(function(a,b){return (b.score-a.score)||(parseMs(b.ts)-parseMs(a.ts))||String(a.player).localeCompare(String(b.player));});
	  }
	  async function fetchTurboHighScoreLeagueClean(){
	    var saved=await savedPlayerKeys();
	    var client=null;
	    try{ if(typeof ensureCloudInit==='function') ensureCloudInit(); }catch(_){}
	    try{ client=window.sb||(typeof sb!=='undefined'?sb:null); }catch(_){ client=null; }
	    if(!client||typeof client.from!=='function') throw new Error('Supabase client unavailable');
	    // @MODE:HIGH_SCORE_LEAGUE_TURBO_CLEAN_SOURCE
	    // Turbo High Score League uses the DB-classified clean view only. Do not fall back
	    // to browser aggregation or Official sources for production Turbo rows.
	    var res=await client.from('v_high_score_league_turbo_from_games_clean')
	      .select('player,best_score,best_ts,game_id,avg_round,rounds')
	      .order('best_score',{ascending:false})
	      .order('best_ts',{ascending:false})
	      .limit(5000);
	    if(res&&res.error){
	      res=await client.from('v_high_score_league_turbo_from_games_clean')
	        .select('player,best_score,best_ts,game_id,avg_round')
	        .order('best_score',{ascending:false})
	        .order('best_ts',{ascending:false})
	        .limit(5000);
	    }
	    if(res&&res.error){
	      res=await client.from('v_high_score_league_turbo_from_games_clean')
	        .select('player,best_score,best_ts,game_id,rounds')
	        .order('best_score',{ascending:false})
	        .order('best_ts',{ascending:false})
	        .limit(5000);
	    }
	    if(res&&res.error){
	      res=await client.from('v_high_score_league_turbo_from_games_clean')
	        .select('player,best_score,best_ts,game_id')
	        .order('best_score',{ascending:false})
	        .order('best_ts',{ascending:false})
	        .limit(5000);
	    }
	    if(res&&res.error) throw res.error;
	    return (Array.isArray(res&&res.data)?res.data:[]).map(function(r){
	      var score=Number(r.best_score||0);
	      var hasAvg=r.avg_round!==null&&r.avg_round!==undefined&&r.avg_round!=='';
	      var hasRounds=r.rounds!==null&&r.rounds!==undefined&&r.rounds!=='';
	      var avg=hasAvg?Number(r.avg_round):NaN, rounds=hasRounds?Number(r.rounds):NaN;
	      if(!Number.isFinite(avg)&&Number.isFinite(score)&&Number.isFinite(rounds)&&rounds>0) avg=score/rounds;
	      return {player:String(r.player||'').trim(),playerKey:norm(r.player),score:score,avg:Number.isFinite(avg)?avg:null,ts:r.best_ts||'',game_id:r.game_id||''};
	    }).filter(function(r){return r.player&&r.score>0&&(!saved.size||saved.has(r.playerKey));})
	      .sort(function(a,b){return (b.score-a.score)||(parseMs(b.ts)-parseMs(a.ts))||String(a.player).localeCompare(String(b.player));});
	  }

  window.openHighScoreLeagueDialog = async function(initialMode){
    var mode=String(initialMode||'official').toLowerCase()==='turbo'?'turbo':'official';
    try{if(typeof window.__sqCleanupLeagueRankingsOverlays==='function')window.__sqCleanupLeagueRankingsOverlays();}catch(_){}
    var ui=buildModal('High Score League','Highest verified match score per saved player.',[{mode:'official',label:'Official'},{mode:'turbo',label:'Turbo'}]);
    ui.overlay.classList.add('sq-hs-league-backdrop','sq-fix100-hsl');
    ui.body.innerHTML='<div class="hs-arena"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div>';
    var arena=ui.body.querySelector('.hs-arena');
    var reduced=false;try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){ }
    function hsCount(el,target,dur){if(reduced||!Number.isFinite(target)){el.textContent=String(Math.round(target||0));return;}var t0=performance.now();(function step(t){var p=Math.min(1,(t-t0)/dur);el.textContent=String(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step);})(t0);}
    async function render(){
      setTabs(ui.tabs,mode);
      arena.innerHTML='<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
      var rows=[];
      try{ rows=await window.__sqWithCloudTimeout(mode==='turbo'?fetchTurboHighScoreLeagueClean():fetchOfficialHighScoreLeagueClean(),12000,'hs-league'); }
      catch(e){
        try{ if(window.SQ_DEBUG)console.warn('[SQ] High Score League clean source read failed', e); }catch(_){}
        arena.innerHTML='<p class="tag">'+(mode==='turbo'?'Turbo':'Official')+' High Score League data is not available yet.</p>';
        return;
      }
      if(!rows.length){
        arena.innerHTML='<p class="tag">'+(mode==='turbo'?'Turbo':'Official')+' High Score League data is not available yet.</p>';
        return;
      }
      // Record board: all-time record banner + score-meter ladder.
      arena.innerHTML='';
      var record=rows[0];
      var ban=document.createElement('div');ban.className='hs-record';
      var eye=document.createElement('div');eye.className='hs-record-eyebrow';eye.textContent='All-Time Record — '+(mode==='turbo'?'Turbo':'Official');
      var big=document.createElement('div');big.className='hs-record-score';hsCount(big,Math.round(record.score),1100);
      var who=document.createElement('div');who.className='hs-record-holder';who.textContent=record.player;
      var when=document.createElement('div');when.className='hs-record-date';when.textContent=fmtDateTime(record.ts);
      ban.append(eye,big,who,when);
      arena.appendChild(ban);
      var list=document.createElement('div');list.className='hs-list';
      var maxScore=Math.max(1,Math.round(record.score));
      rows.forEach(function(r,i){
        var row=document.createElement('div');
        row.className='hs-row'+(i===0?' top1':'');
        row.style.animationDelay=Math.min(700,i*45)+'ms';
        var rank=document.createElement('div');rank.className='hs-rank'+(i<3?' g'+(i+1):'');rank.textContent='#'+(i+1);
        var main=document.createElement('div');main.className='hs-main';
        var nm=document.createElement('div');nm.className='hs-name';nm.textContent=r.player;
        var meter=document.createElement('div');meter.className='hs-meter';
        var fill=document.createElement('span');meter.appendChild(fill);
        var w=Math.max(3,Math.min(100,Math.round(r.score)/maxScore*100))+'%';
        if(reduced)fill.style.width=w;else requestAnimationFrame(function(){requestAnimationFrame(function(){fill.style.width=w;});});
        var dt=document.createElement('div');dt.className='hs-date';dt.textContent=fmtDateTime(r.ts);
        main.append(nm,meter,dt);
        var side=document.createElement('div');side.className='hs-side';
        var sc=document.createElement('div');sc.className='hs-score';hsCount(sc,Math.round(r.score),750);
        side.appendChild(sc);
        var hasAvg=r.avg!==null&&r.avg!==undefined&&r.avg!==''&&Number.isFinite(Number(r.avg));
        var chip=document.createElement('div');chip.className='hs-avgchip';chip.textContent='AVG '+(hasAvg?Number(r.avg).toFixed(1):'—');
        side.appendChild(chip);
        row.append(rank,main,side);
        list.appendChild(row);
      });
      arena.appendChild(list);
    }
    ui.tabs.onclick=function(e){var b=e.target.closest('button[data-mode]');if(!b)return;mode=b.dataset.mode;render();};
    await render();
  };

  function normaliseHeaders(root){try{(root||document).querySelectorAll('th').forEach(function(th){var t=String(th.textContent||'').trim().toLowerCase();if(t==='when')th.textContent='DATE/TIME';else if(t==='avg / round'||t==='avg/round')th.textContent='AVG';else th.textContent=String(th.textContent||'').toUpperCase();});(root||document).querySelectorAll('table.hs-table,table.sq-table').forEach(function(tbl){tbl.classList.add('sq-league-table');});}catch(_){}}
  var mo=new MutationObserver(function(ms){ms.forEach(function(m){Array.from(m.addedNodes||[]).forEach(function(n){if(n&&n.nodeType===1)normaliseHeaders(n);});});});
  try{mo.observe(document.documentElement,{childList:true,subtree:true});normaliseHeaders(document);}catch(_){}
  try{console.info('[SQ] Fix100 League & Ranks formatting/alignment active');}catch(_){ }
})();
