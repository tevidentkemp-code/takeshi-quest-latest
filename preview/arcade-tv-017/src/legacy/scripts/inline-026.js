
(function(){
  if(window.__sqFix97LeagueRanksTurboTabs) return;
  window.__sqFix97LeagueRanksTurboTabs = true;

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function norm(s){return String(s||'').trim().toLowerCase();}
  function parseMs(t){var n=Date.parse(t||''); return Number.isFinite(n)?n:0;}
  function fmtWhen(ts){
    try{
      var d = new Date(ts || 0); if(!Number.isFinite(d.getTime())) return '';
      return d.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');
    }catch(_){return '';}
  }
  function pName(p){
    if(p==null) return '';
    if(typeof p==='string') return p.trim();
    var n = String(p.name || p.player || p.player_name || p.playerName || p.display_name || p.nick || '').trim();
    if(n) return n;
    var f=String(p.first_name||p.firstName||'').trim(), l=String(p.last_name||p.lastName||'').trim(), nick=String(p.nickname||'').trim();
    if(f) return nick ? (f+' "'+nick+'"'+(l?' '+l:'')) : (f+(l?' '+l:''));
    return '';
  }
  function playersOf(g){
    var ps = g && (g.players || (g.state&&g.state.players) || (g.raw&&g.raw.state&&g.raw.state.players));
    return Array.isArray(ps)?ps:[];
  }
  function totalsOf(g){
    var t = g && (g.totals || (g.state&&g.state.totals) || (g.raw&&g.raw.totals) || (g.raw&&g.raw.state&&g.raw.state.totals));
    return Array.isArray(t)?t:[];
  }
  function boardOf(g){return g && (g.board || g.score || (g.state&&(g.state.board||g.state.score)) || (g.raw&&g.raw.state&&(g.raw.state.board||g.raw.state.score)));}
  function rowsForPlayer(board, pi){
    if(!Array.isArray(board)) return [];
    if(Array.isArray(board[pi])) return board[pi];
    if(Array.isArray(board[0]) && board[0][pi] != null) return board.map(function(r){return Array.isArray(r)?r[pi]:null;});
    return [];
  }
  function roundScore(ent){
    if(ent==null) return 0;
    if(typeof ent==='number' || typeof ent==='string') return Number(ent)||0;
    var keys=['roundTotal','round_total','points','score','total','val','value'];
    for(var i=0;i<keys.length;i++){var n=Number(ent[keys[i]]); if(Number.isFinite(n)&&n>0) return n;}
    var darts = Array.isArray(ent.darts)?ent.darts:(Array.isArray(ent.throws)?ent.throws:null);
    if(darts) return darts.reduce(function(a,d){return a+(Number(d&&(d.points??d.score??d.val??d.value)||0)||0);},0);
    return 0;
  }
  function totalFor(g, pi){
    var totals=totalsOf(g); var v=totals[pi];
    if(typeof v==='number' || typeof v==='string'){var n=Number(v)||0; if(n>0) return n;}
    if(v && typeof v==='object'){var no=Number(v.total??v.score??v.points??v.val); if(Number.isFinite(no)&&no>0)return no;}
    var rows=rowsForPlayer(boardOf(g), pi); return rows.reduce(function(a,e){return a+roundScore(e);},0);
  }
  function dartToken(d){
    if(!d) return 'X';
    var kind=String(d.kind||d.multiplier||d.type||'').toLowerCase();
    var bull=String(d.bull||d.bull_type||'').toLowerCase();
    var target=Number(d.sector??d.target??d.number??d.num??d.segment);
    var pts=Number(d.points??d.score??d.val??d.value??0)||0;
    if(!(pts>0)) return 'X';
    if(kind.startsWith('tr')||kind.startsWith('tre')||kind==='t'||kind==='3') return Number.isFinite(target)&&target>0?'T'+target:'T';
    if(kind.startsWith('do')||kind==='d'||kind==='2') return Number.isFinite(target)&&target>0?'D'+target:'D';
    if(kind.startsWith('b')||bull||kind==='ib'||kind==='ob') return (bull.startsWith('inner')||bull==='ib'||pts>=50)?'IB':'OB';
    if(kind.startsWith('s')||kind==='1') return Number.isFinite(target)&&target>0?'S'+target:'S';
    return Number.isFinite(target)&&target>0?'S'+target:'S';
  }
  function dartsText(ent){
    try{
      if(!ent) return '';
      if(typeof ent.dartsText==='string' && ent.dartsText.trim()) return ent.dartsText.trim();
      if(typeof ent.darts==='string' && ent.darts.trim()) return ent.darts.trim();
      var darts=Array.isArray(ent.darts)?ent.darts:(Array.isArray(ent.throws)?ent.throws:[]);
      return darts.slice(0,3).map(dartToken).join(' / ');
    }catch(_){return '';}
  }
  function isPractice(g){
    var st=(g&&g.state)||{}, rawst=(g&&g.raw&&g.raw.state)||{};
    var mode=String(g?.mode||g?.game_mode||st.mode||st.gameMode||rawst.mode||'').toLowerCase();
    if(mode.includes('practice')||mode.includes('unofficial')||mode==='solo') return true;
    if(g?.isPractice===true||g?.is_practice===true||g?.practice===true||st.isPractice===true||st.is_practice===true||st.practice===true||rawst.is_practice===true) return true;
    return playersOf(g).length===1;
  }
  function isTurbo(g){
    try{
      var st=(g&&g.state)||{}, rawst=(g&&g.raw&&g.raw.state)||{}, m=st.match||rawst.match||g?.match||{};
      var rules=st.tournamentRules||m.tournamentRules||rawst.tournamentRules||{};
      var type=String(g?.tournamentType||st.tournamentType||st.tournament_type||m.tournamentType||m.tournament_type||rawst.tournamentType||st.__sqTournamentDraft?.type||'').toLowerCase();
      return type==='turbo' || st.strictTimer===true || m.strictTimer===true || rules.strictTimer===true || Number(st.throwLimitSeconds||m.throwLimitSeconds||rules.throwLimitSeconds||0)===20 || String(rules.startTarget||st.startTarget||m.startTarget||'').toLowerCase()==='17';
    }catch(_){return false;}
  }
  function isArchived(g){return !!(g && (g.archived_at||g.archivedAt));}
  function bucketOf(g){
    try{
      if (typeof window.__sqGameModeKey === 'function') {
        var clean = window.__sqGameModeKey(g);
        if (clean === 'official' || clean === 'turbo' || clean === 'practice' || clean === 'archived') return clean;
      }
    }catch(_){}
    if(isArchived(g)) return 'archived';
    if(isTurbo(g)) return 'turbo';
    if(isPractice(g)) return 'practice';
    return 'official';
  }
  async function allGames(){
    try{ if(typeof window.__sqGetAllGamesNormalized==='function'){var n=await window.__sqGetAllGamesNormalized(); if(Array.isArray(n)) return n;} }catch(_){ }
    try{ if(typeof cloudFetchAllGamesAsLocal==='function'){var c=await cloudFetchAllGamesAsLocal(); if(Array.isArray(c)) return c;} }catch(_){ }
    return [];
  }
  async function gamesFor(bucket){
    var gs=(await allGames()).filter(Boolean);
    return gs.filter(function(g){return bucketOf(g)===bucket;}).sort(function(a,b){return parseMs(b.ts||b.created_at)-parseMs(a.ts||a.created_at);});
  }
  window.__sqGameBucketOf = bucketOf;
  window.__sqGameIsTurbo = isTurbo;

  // Support getGamesForMode('turbo') and make official exclude Turbo.
  var oldGet = window.getGamesForMode;
  window.getGamesForMode = async function(mode){
    var m=String(mode||'official').toLowerCase();
    if(m==='turbo') return gamesFor('turbo');
    if(m==='practice') return gamesFor('practice');
    if(m==='official'||m==='classic') return gamesFor('official');
    try{return oldGet?await oldGet(mode):await gamesFor('official');}catch(_){return [];}
  };

  function playerRows(bucket){
    return gamesFor(bucket).then(function(gs){
      var rows=[];
      gs.forEach(function(g){
        var ps=playersOf(g), board=boardOf(g);
        ps.forEach(function(p,pi){
          var name=pName(p); if(!name) return;
          var score=totalFor(g,pi); if(!(score>0)) return;
          var denom = bucket==='turbo' ? 7 : 14;
          rows.push({player:name,playerKey:norm(name),score:score,avg_round:score/denom,ts:g.ts||g.created_at||'',game:g,game_id:g.id||g.game_id||''});
        });
      });
      return rows.sort(function(a,b){return (b.score-a.score)||(parseMs(b.ts)-parseMs(a.ts))||String(a.player).localeCompare(String(b.player));});});
  }

  function setBtnStates(root, mode){
    root.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('active', b.dataset.mode===mode);});
  }
  function tabBar(modes){
    var d=document.createElement('div'); d.className='sq-fix97-tabs';
    modes.forEach(function(x){var b=document.createElement('button'); b.className='seg-btn'; b.dataset.mode=x.mode; b.textContent=x.label; d.appendChild(b);});
    return d;
  }
  function cleanDbClient(){
    try{ if(typeof ensureCloudInit==='function') ensureCloudInit(); }catch(_){}
    try{ if(window.sb&&typeof window.sb.from==='function') return window.sb; }catch(_){}
    try{ if(typeof sb!=='undefined'&&sb&&typeof sb.from==='function') return sb; }catch(_){}
    return null;
  }
  async function fetchTurboLatestScoresClean(){
    var client=cleanDbClient();
    if(!client) throw new Error('Supabase client unavailable');
    var q=await client.from('v_latest_scores_turbo_clean')
      .select('game_id,created_at,game_number,player_scores,winner_name,winner_score,total_players,result_text')
      .order('created_at',{ascending:false})
      .limit(50);
    if(q&&q.error) throw q.error;
    return Array.isArray(q&&q.data)?q.data:[];
  }
  async function fetchOfficialLatestScoresClean(){
    var client=cleanDbClient();
    if(!client) throw new Error('Supabase client unavailable');
    var q=await client.from('v_player_game_scores_official_clean')
      .select('game_id,ts,player_index,player_name,score')
      .order('ts',{ascending:false})
      .limit(260);
    if(q&&q.error) throw q.error;
    var rows = Array.isArray(q&&q.data) ? q.data : [];
    var byGame = new Map();
    rows.forEach(function(r){
      var id = String(r&&r.game_id||'').trim();
      if(!id) return;
      var rec = byGame.get(id);
      if(!rec){
        rec = { game_id:id, ts:r.ts||'', players:[] };
        byGame.set(id, rec);
      }
      rec.players.push({
        name:String(r&&r.player_name||'').trim(),
        score:Number(r&&r.score||0),
        idx:Number(r&&r.player_index||0)
      });
      if(parseMs(r.ts)>parseMs(rec.ts)) rec.ts = r.ts || rec.ts;
    });
    return Array.from(byGame.values())
      .sort(function(a,b){ return parseMs(b.ts)-parseMs(a.ts); })
      .slice(0,50);
  }
  async function fetchTurboRoundHighScoresClean(){
    var client=cleanDbClient();
    if(!client) throw new Error('Supabase client unavailable');
    var q=await client.from('v_round_high_scores_turbo_clean_app')
      .select('mode,round_key,round_label,target_sort,wr_points,darts,holder,holders,tie_count,darts_detail,game_id,first_created_at,created_at,source_view_version')
      .order('target_sort',{ascending:true});
    if(q&&q.error) throw q.error;
    return (Array.isArray(q&&q.data)?q.data:[]).map(function(r){
      return {
        mode:r&&r.mode,
        round_key:(r&&r.round_key)||(r&&r.round_label)||'',
        round_label:r&&r.round_label,
        target_sort:r&&r.target_sort,
        wr:r&&r.wr_points,
        wr_points:r&&r.wr_points,
        darts:r&&r.darts,
        holder:r&&r.holder,
        holders:r&&r.holders,
        tie_count:r&&r.tie_count,
        darts_detail:r&&r.darts_detail,
        game_id:r&&r.game_id,
        first_created_at:r&&r.first_created_at,
        created_at:(r&&r.created_at)||(r&&r.first_created_at)||'',
        source_view_version:r&&r.source_view_version,
        holder_suffix:''
      };
    });
  }
  function cleanRoundRecordHolderToken(v){
    return String(v==null?'':v).trim().replace(/\s+x\d+\s*$/i,'').trim();
  }
  function cleanRoundRecordHolders(v){
    var raw=Array.isArray(v)?v:(typeof v==='string'?v.split('/'):[]);
    var seen=new Set(), out=[];
    raw.forEach(function(h){
      var clean=cleanRoundRecordHolderToken(h);
      var key=norm(clean);
      if(clean && key && !seen.has(key)){seen.add(key);out.push(clean);}
    });
    return out;
  }
  async function fetchOfficialRoundHighScoresClean(){
    var client=cleanDbClient();
    if(!client) throw new Error('Supabase client unavailable');
    var q=await client.from('v_round_high_scores_official_clean_app')
      .select('mode,round_key,round_label,target_sort,wr_points,darts,holder,holders,tie_count,darts_detail,game_id,first_created_at,created_at,source_view_version')
      .order('target_sort',{ascending:true});
    if(q&&q.error) throw q.error;
    return (Array.isArray(q&&q.data)?q.data:[]).map(function(r){
      var holders=cleanRoundRecordHolders(r&&r.holders);
      var holderParts=cleanRoundRecordHolders(r&&r.holder);
      holderParts.slice().reverse().forEach(function(h){
        if(!holders.some(function(x){return norm(x)===norm(h);})){holders.unshift(h);}
      });
      var holder=holders.join(' / ');
      return {
        mode:r&&r.mode,
        round_key:(r&&r.round_key)||(r&&r.round_label)||'',
        round_label:r&&r.round_label,
        target_sort:r&&r.target_sort,
        wr:r&&r.wr_points,
        wr_points:r&&r.wr_points,
        darts:r&&r.darts,
        holder:holder,
        holders:holders,
        tie_count:r&&r.tie_count,
        darts_detail:r&&r.darts_detail,
        game_id:r&&r.game_id,
        first_created_at:r&&r.first_created_at,
        created_at:(r&&r.created_at)||(r&&r.first_created_at)||'',
        source_view_version:r&&r.source_view_version
      };
    });
  }
  function roundDisplayKey(raw){
    var s=String(raw||'').trim();
    var low=s.toLowerCase();
    if(!s || low==='unknown') return '';
    if(low==='bull'||low==='b') return 'B';
    if(low==='d'||low==='double'||low==='doubles') return 'D';
    if(low==='t'||low==='treble'||low==='trebles') return 'T';
    var m=low.match(/(\d+)/);
    return m ? String(Number(m[1])) : s.toUpperCase();
  }
  function turboLatestResultText(row){
    var txt=String(row&&row.result_text||'').trim();
    if(txt) return txt;
    var scores=row&&row.player_scores;
    if(typeof scores==='string'){try{scores=JSON.parse(scores);}catch(_){scores=[];}}
    scores=Array.isArray(scores)?scores:[];
    var ordered=scores.map(function(p,i){return {
      name:String((p&& (p.player_name||p.player||p.name))||'').trim(),
      score:Number(p&&p.score||0),
      idx:Number(p&&p.player_index||i)
    };}).filter(function(p){return p.name;}).sort(function(a,b){return (b.score-a.score)||(a.idx-b.idx)||a.name.localeCompare(b.name);});
    if(!ordered.length) return '—';
    if(ordered.length===1) return ordered[0].name+' '+ordered[0].score+' - TURBO';
    var out=ordered[0].name+' '+ordered[0].score+' beat '+ordered[1].name+' '+ordered[1].score;
    if(ordered.length>2) out+=' '+ordered.slice(2).map(function(p){return p.name+' '+p.score;}).join(' ');
    return out+' - TURBO';
  }
  function officialLatestResultText(row){
    var players=Array.isArray(row&&row.players)?row.players:[];
    var ordered=players.filter(function(p){return p.name;}).sort(function(a,b){return (b.score-a.score)||(a.idx-b.idx)||a.name.localeCompare(b.name);});
    if(!ordered.length) return '—';
    if(ordered.length===1) return ordered[0].name+' '+ordered[0].score;
    var out=ordered[0].name+' '+ordered[0].score+' Bt '+ordered[1].name+' '+ordered[1].score;
    if(ordered.length>2) out+=' '+ordered.slice(2).map(function(p){return p.name+' '+p.score;}).join(' ');
    return out;
  }

  window.openLatestScoresDialog = async function(initialMode){
    try{if(typeof window.__sqCleanupLeagueRankingsOverlays==='function')window.__sqCleanupLeagueRankingsOverlays();}catch(_){}
    var mode = ['official','turbo','practice'].includes(String(initialMode||'').toLowerCase()) ? String(initialMode).toLowerCase() : 'official';
    var overlay=document.createElement('div'); overlay.className='modal-backdrop sq-latest-scores-backdrop';
    var modal=document.createElement('div'); modal.className='modal'; modal.style.maxWidth='980px'; modal.style.width='94vw';
    var head=document.createElement('div'); head.className='sq-fix97-head';
    head.innerHTML='<div class="sq-fix97-title"><h3>Latest Scores</h3><div class="sq-fix97-sub">Games history truth / Result / Date-Time</div></div>';
    var tabs=tabBar([{mode:'official',label:'Official'},{mode:'turbo',label:'Turbo'},{mode:'practice',label:'Practice'}]); head.appendChild(tabs);
    var body=document.createElement('div'); body.className='modal-body'; body.innerHTML='<div class="ls-feed"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div>';
    var footer=document.createElement('div'); footer.className='modal-footer'; footer.style.justifyContent='flex-start';
    var back=document.createElement('button'); back.className='btn small sq-pill'; back.textContent='Back';
    var close=document.createElement('button'); close.className='btn small sq-pill'; close.textContent='Close'; footer.append(back,close);
    modal.append(head,body,footer); overlay.appendChild(modal); document.body.appendChild(overlay);
    try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
    var feed=body.querySelector('.ls-feed');
    var reduced=false;try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){ }
    // One result card: parses "A 140 beat B 120 …" into a winner/loser mini
    // scoreboard; anything unparseable renders as a plain text line.
    function lsCard(i,text,whenText,onClick){
      var card=document.createElement('div');
      card.className='ls-card'+(i===0?' latest':'');
      card.style.animationDelay=Math.min(800,i*40)+'ms';
      var main=document.createElement('div');main.className='ls-main';
      if(i===0){
        var tag=document.createElement('span');tag.className='ls-tag-latest';
        var dot=document.createElement('span');dot.className='ls-dot';
        tag.appendChild(dot);tag.appendChild(document.createTextNode('Latest result'));
        main.appendChild(tag);
      }
      var m=String(text||'').match(/^(.+?)\s(\d+)\s(?:beat|Bt)\s(.+?)\s(\d+)(.*)$/i);
      if(m){
        var winLine=document.createElement('div');winLine.className='ls-line win';
        var wn=document.createElement('span');wn.className='ls-nm';wn.textContent=m[1];
        var ws=document.createElement('span');ws.className='ls-sc';ws.textContent=m[2];
        var wtag=document.createElement('span');wtag.className='ls-w';wtag.textContent='WIN';
        winLine.append(wn,ws,wtag);
        var loseLine=document.createElement('div');loseLine.className='ls-line lose';
        var ln=document.createElement('span');ln.className='ls-nm';ln.textContent=m[3];
        var lsc=document.createElement('span');lsc.className='ls-sc';lsc.textContent=m[4];
        loseLine.append(ln,lsc);
        main.append(winLine,loseLine);
        var extra=String(m[5]||'').trim();
        if(extra){var ex=document.createElement('div');ex.className='ls-extra';ex.textContent=extra.replace(/^-\s*/,'');main.appendChild(ex);}
      } else {
        var tx=document.createElement('div');tx.className='ls-text';tx.textContent=String(text||'—');
        main.appendChild(tx);
      }
      var when=document.createElement('div');when.className='ls-when';when.textContent=whenText||'—';
      card.append(main,when);
      if(typeof onClick==='function'){card.style.cursor='pointer';card.onclick=onClick;}
      return card;
    }
    function format(g){
      try{ if(typeof window.formatGameResultLine==='function') return window.formatGameResultLine(g)+(mode==='turbo'?' - TURBO':''); }catch(_){ }
      var ps=playersOf(g).map(pName).filter(Boolean), totals=totalsOf(g);
      var ord=ps.map(function(n,i){return {name:n,score:Number(totals[i]||totalFor(g,i)||0)}}).sort(function(a,b){return b.score-a.score;});
      if(!ord.length) return '—';
      if(ord.length===1) return ord[0].name+' '+ord[0].score+(mode==='practice'?' - PRACTICE':(mode==='turbo'?' - TURBO':''));
      var out=ord[0].name+' '+ord[0].score+' beat '+ord[1].name+' '+ord[1].score;
      if(ord.length>2) out+=' '+ord.slice(2).map(function(o){return o.name+' '+o.score;}).join(' ');
      return out+(mode==='turbo'?' - TURBO':'');
    }
    async function render(){
      setBtnStates(tabs,mode); feed.innerHTML='<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
      if(mode==='turbo'){
        var rows=[];
        try{ rows=await fetchTurboLatestScoresClean(); }
        catch(e){
          try{ console.warn('[SQ] Turbo Latest Scores clean view unavailable', e); }catch(_){}
          feed.innerHTML='<p class="tag">Turbo Latest Scores data is unavailable.</p>';
          return;
        }
        if(!rows.length){
          feed.innerHTML='<p class="tag">No Turbo games found.</p>';
          return;
        }
        feed.innerHTML='';
        rows.forEach(function(r,i){ feed.appendChild(lsCard(i,turboLatestResultText(r),fmtWhen(r.created_at))); });
        return;
      }
      if(mode==='official'){
        var officialRows=[];
        try{ officialRows=await fetchOfficialLatestScoresClean(); }
        catch(e){
          try{ console.warn('[SQ] Official Latest Scores clean source unavailable', e); }catch(_){}
          feed.innerHTML='<p class="tag">Official Latest Scores data is unavailable.</p>';
          return;
        }
        if(!officialRows.length){
          feed.innerHTML='<p class="tag">No official games found.</p>';
          return;
        }
        feed.innerHTML='';
        officialRows.forEach(function(r,i){ feed.appendChild(lsCard(i,officialLatestResultText(r),fmtWhen(r.ts))); });
        return;
      }
      var gs=await gamesFor(mode); gs=gs.filter(function(g){return playersOf(g).some(function(p){return !!pName(p);});}).slice(0,50);
      if(!gs.length){feed.innerHTML='<p class="tag">No '+mode+' games found.</p>';return;}
      feed.innerHTML='';
      gs.forEach(function(g,i){
        feed.appendChild(lsCard(i,format(g),fmtWhen(g.ts||g.created_at),function(){try{if(typeof openSingleGameScoreSheet==='function')openSingleGameScoreSheet(gs[i]);}catch(_){}}));
      });
    }
    tabs.onclick=function(e){var b=e.target.closest('[data-mode]'); if(!b)return; mode=b.dataset.mode; render();};
    back.onclick=function(){overlay.remove();try{if(typeof openLeagueRankingsDialog==='function')openLeagueRankingsDialog();}catch(_){}}; close.onclick=function(){overlay.remove();}; overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    await render();
  };

// [removed: openTop50ScoresDialog fix97 def] audit P5.3 batch 3 — shadowed by later canonical definition

  // ACTIVE ROUND HIGH SCORES IMPLEMENTATION
  // Current League & Rankings path uses Fix102 wrapper -> this Fix97 dynamic modal.
  // Per-target leaderboard: tap a round in Round High Scores to see every
  // player's best round on that target. Ranked by TARGET HIT (darts on the
  // target) first, then points — so three single 10s (3 hits) beat one treble
  // and two misses (1 hit). D/T rounds show the exact double/treble hit.
  window.openRoundTargetLeaderboard = async function(rawKey, mode){
    var key = String(rawKey || '').trim().toUpperCase();
    mode = String(mode || 'official').toLowerCase() === 'turbo' ? 'turbo' : 'official';
    var roundIndex = key === 'D' ? 11 : key === 'T' ? 12 : key === 'B' ? 13 : (Number(key) - 10);
    if (!Number.isFinite(roundIndex) || roundIndex < 0 || roundIndex > 13) return;
    var titleLabel = key === 'D' ? 'Doubles Round' : key === 'T' ? 'Trebles Round' : key === 'B' ? 'Bull Round' : ('Target ' + key);

    var overlay = document.createElement('div'); overlay.className = 'modal-backdrop sq-rhs-fix97-backdrop sq-rt-leaderboard';
    var modal = document.createElement('div'); modal.className = 'modal sq-wide-modal';
    var head = document.createElement('div'); head.className = 'sq-fix97-head';
    head.innerHTML = '<div class="sq-fix97-title"><h3>' + esc(titleLabel) + '</h3></div>';
    var body = document.createElement('div'); body.className = 'modal-body';
    body.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
    var footer = document.createElement('div'); footer.className = 'modal-footer';
    var back = document.createElement('button'); back.className = 'btn sq-pill'; back.textContent = 'Back';
    footer.append(back);
    modal.append(head, body, footer); overlay.appendChild(modal); document.body.appendChild(overlay);
    var reg = null; try{ if (window.sqModal && window.sqModal.register) reg = window.sqModal.register(overlay, modal, function(){ overlay.remove(); }); }catch(_){ }
    var close = function(){ if (reg && reg.close) reg.close(); else overlay.remove(); };
    back.onclick = close;
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
    modal.tabIndex = 0; modal.focus();

    var reduced = false; try{ reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ }
    // Tokenise a dart to its board notation (S10 / D11 / T14 / IB / OB / ✕).
    function tok(d){
      if (!d) return { t:'✕', c:'x', hit:false, pts:0 };
      var kind = String(d.kind || d.type || d.ring || d.segment || d.multiplier || '').toLowerCase();
      var bull = String(d.bull || d.bull_type || '').toLowerCase();
      var target = Number(d.sector != null ? d.sector : d.target != null ? d.target : d.number != null ? d.number : d.num != null ? d.num : d.n != null ? d.n : d.value);
      var mult = Number(d.mult != null ? d.mult : d.multiplier);
      var pts = Number(d.points != null ? d.points : d.pts != null ? d.pts : d.score != null ? d.score : d.val);
      if (!Number.isFinite(pts)) pts = (Number.isFinite(target) ? target : 0) * (Number.isFinite(mult) ? mult : 1);
      if (!(pts > 0)) return { t:'✕', c:'x', hit:false, pts:0 };
      if (kind.indexOf('tr') === 0 || kind === 't' || mult === 3) return { t:(Number.isFinite(target) && target > 0 ? 'T' + target : 'T'), c:'t', hit:true, pts:pts };
      if (kind.indexOf('do') === 0 || kind === 'd' || mult === 2) return { t:(Number.isFinite(target) && target > 0 ? 'D' + target : 'D'), c:'d', hit:true, pts:pts };
      if (kind.indexOf('b') === 0 || bull) return { t:(bull.indexOf('inner') === 0 || pts >= 50 ? 'IB' : 'OB'), c:'b', hit:true, pts:pts };
      return { t:(Number.isFinite(target) && target > 0 ? 'S' + target : 'S'), c:'s', hit:true, pts:pts };
    }
    function rowsForPlayer(board, pi){
      if (!Array.isArray(board) || !board.length) return [];
      if (Array.isArray(board[pi])) return board[pi];
      if (Array.isArray(board[0]) && typeof board[0][pi] !== 'undefined') return board.map(function(r){ return r ? r[pi] : null; });
      return [];
    }
    function dartsOf(cell){
      if (!cell) return [];
      return Array.isArray(cell) ? cell : (Array.isArray(cell.throws) ? cell.throws : (Array.isArray(cell.darts) ? cell.darts : []));
    }

    try{
      var raw = (typeof cloudFetchAllGamesAsLocal === 'function') ? await cloudFetchAllGamesAsLocal() : [];
      var games = (raw || []).map(__normalizeGame).filter(function(g){
        if (!(Array.isArray(g.players) && g.players.length >= 2)) return false;
        var turbo = (typeof __sqGameLooksTurbo === 'function') ? __sqGameLooksTurbo(g.raw) : false;
        return mode === 'turbo' ? turbo : !turbo;
      });
      // Optional saved-player filter (matches the Round High Scores view scope).
      var savedKeys = null;
      try{
        if (typeof cloudListPlayers === 'function'){
          var sp = await cloudListPlayers();
          if (Array.isArray(sp) && sp.length) savedKeys = new Set(sp.map(function(p){ return String((p && (p.name || p.player_name || p.player)) || '').trim().toLowerCase(); }).filter(Boolean));
        }
      }catch(_){ }

      var best = new Map(); // nameKey -> { player, hits, pts, tokens }
      games.forEach(function(g){
        (g.players || []).forEach(function(pname, pi){
          var nm = String(pname || '').trim();
          if (!nm) return;
          var nk = nm.toLowerCase();
          if (savedKeys && !savedKeys.has(nk)) return;
          var darts = dartsOf(rowsForPlayer(g.board, pi)[roundIndex]);
          if (!darts.length) return;
          var toks = darts.slice(0, 3).map(tok);
          var hits = toks.filter(function(x){ return x.hit; }).length;
          var pts = toks.reduce(function(s, x){ return s + (x.hit ? (Number(x.pts) || 0) : 0); }, 0);
          if (hits <= 0 && pts <= 0) return;
          var prev = best.get(nk);
          // "best" round = most hits, then most points
          if (!prev || hits > prev.hits || (hits === prev.hits && pts > prev.pts)){
            best.set(nk, { player: nm, hits: hits, pts: pts, tokens: toks });
          }
        });
      });

      var rows = Array.from(best.values()).sort(function(a, b){
        return (b.hits - a.hits) || (b.pts - a.pts) || String(a.player).localeCompare(String(b.player));
      });

      body.innerHTML = '';
      if (!rows.length){
        var msg = document.createElement('p'); msg.className = 'tag';
        msg.textContent = 'No ' + (mode === 'turbo' ? 'Turbo' : 'official') + ' rounds recorded on ' + (key === 'D' || key === 'T' || key === 'B' ? titleLabel.toLowerCase() : ('target ' + key)) + ' yet.';
        body.appendChild(msg); return;
      }
      var note = document.createElement('div'); note.className = 'rt-note'; note.textContent = 'Ranked by darts on target, then points';
      body.appendChild(note);
      var list = document.createElement('div'); list.className = 'rt-list';
      rows.forEach(function(r, i){
        var row = document.createElement('div'); row.className = 'rt-row' + (i === 0 ? ' top1' : '');
        row.style.animationDelay = Math.min(700, i * 45) + 'ms';
        var rank = document.createElement('div'); rank.className = 'rt-rank' + (i < 3 ? ' g' + (i + 1) : ''); rank.textContent = '#' + (i + 1);
        var main = document.createElement('div'); main.className = 'rt-main';
        var nm = document.createElement('div'); nm.className = 'rt-name'; nm.textContent = r.player;
        var combo = document.createElement('div'); combo.className = 'rh-combo';
        r.tokens.forEach(function(x){ var c = document.createElement('span'); c.className = 'rh-dc ' + x.c; c.textContent = x.hit ? x.t : '✕'; c.title = x.t; combo.appendChild(c); });
        main.append(nm, combo);
        var side = document.createElement('div'); side.className = 'rt-side';
        var pts = document.createElement('div'); pts.className = 'rt-pts';
        if (reduced){ pts.textContent = String(r.pts); } else { var t0 = performance.now(); (function step(t){ var p = Math.min(1, (t - t0) / 650); pts.textContent = String(Math.round(r.pts * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); })(t0); }
        var hits = document.createElement('div'); hits.className = 'rt-hits'; hits.textContent = r.hits + (r.hits === 1 ? ' hit' : ' hits');
        side.append(pts, hits);
        row.append(rank, main, side);
        list.appendChild(row);
      });
      body.appendChild(list);
    }catch(e){
      try{ console.warn('[SQ] Round target leaderboard failed', e); }catch(_){ }
      body.innerHTML = '<p class="tag">Round data is unavailable.</p>';
    }
  };

  // Official source: v_round_high_scores_official_clean_app.
  // Turbo source: v_round_high_scores_turbo_clean.
  // Patch this path for current Round High Scores behaviour.
  window.openRoundHighScoresDialog = async function(initialMode){
    var mode=String(initialMode||'official').toLowerCase()==='turbo'?'turbo':'official';
    try{if(typeof window.__sqCleanupLeagueRankingsOverlays==='function')window.__sqCleanupLeagueRankingsOverlays();}catch(_){}
    var overlay=document.createElement('div'); overlay.className='modal-backdrop sq-rhs-fix97-backdrop';
    var modal=document.createElement('div'); modal.className='modal sq-wide-modal';
    var head=document.createElement('div'); head.className='sq-fix97-head'; head.innerHTML='<div class="sq-fix97-title"><h3>Round High Scores</h3></div>';
    var tabs=tabBar([{mode:'official',label:'Official'},{mode:'turbo',label:'Turbo'}]); head.appendChild(tabs);
    var body=document.createElement('div'); body.className='modal-body';
    var footer=document.createElement('div'); footer.className='modal-footer'; var back=document.createElement('button'); back.className='btn sq-pill'; back.textContent='Back'; var close=document.createElement('button'); close.className='btn sq-pill'; close.textContent='Close'; footer.append(back,close); modal.append(head,body,footer); overlay.appendChild(modal); document.body.appendChild(overlay);
    try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
    var reduced=false;try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){ }
    function rhCount(el,target,dur){if(reduced||!Number.isFinite(target)){el.textContent=String(Math.round(target||0));return;}var t0=performance.now();(function step(t){var p=Math.min(1,(t-t0)/dur);el.textContent=String(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step);})(t0);}
    // Theoretical perfect max per target: numbers 10-20 = 3 trebles (9×N);
    // D round = 3×D20 (120), T round = 3×T20 (180), B round = 3×bull (150).
    function maxForKey(k){
      var s=String(k||'').trim().toUpperCase();
      if(s==='D') return 120; if(s==='T') return 180; if(s==='B') return 150;
      var n=Number(s); return (Number.isFinite(n)&&n>0)?9*n:0;
    }
    function comboChips(darts){
      var wrap=document.createElement('div'); wrap.className='rh-combo';
      String(darts||'').split('/').map(function(t){return t.trim();}).filter(Boolean).slice(0,3).forEach(function(tok){
        var c=tok.charAt(0).toLowerCase();
        var chip=document.createElement('span');
        chip.className='rh-dc '+('tdsb'.indexOf(c)>=0?c:'x');
        chip.textContent=('tdsb'.indexOf(c)>=0?c.toUpperCase():'✕');
        chip.title=tok;
        wrap.appendChild(chip);
      });
      return wrap;
    }
    // Perfection Board: champion hero (record closest to its perfect max) +
    // per-target records with a perfection meter + a compact unclaimed strip.
    function buildBoard(entries){
      var board=document.createElement('div'); board.className='rh-board';
      var claimed=entries.filter(function(e){ return e.wr!=null&&e.wr!==''&&Number.isFinite(Number(e.wr))&&Number(e.wr)>0; });
      var unclaimed=entries.filter(function(e){ return !(e.wr!=null&&e.wr!==''&&Number.isFinite(Number(e.wr))&&Number(e.wr)>0); });
      claimed.forEach(function(e){ var mx=maxForKey(e.key); e.__mx=mx; e.__pct=mx?Math.min(100,Number(e.wr)/mx*100):0; e.__perfect=mx>0&&Number(e.wr)>=mx; });
      // champion: highest perfection %, tie-break highest WR
      var champ=claimed.slice().sort(function(a,b){ return (b.__pct-a.__pct)||(Number(b.wr)-Number(a.wr)); })[0];

      if(champ){
        var hero=document.createElement('div'); hero.className='rh-champ'+(champ.__perfect?' perfect':'');
        var badge=document.createElement('div'); badge.className='rh-badge'; badge.textContent=champ.key;
        var info=document.createElement('div'); info.className='rh-champ-info';
        var eye=document.createElement('div'); eye.className='rh-champ-eyebrow'; eye.textContent=champ.__perfect?'★ Perfect Round':'Top Round';
        var wr=document.createElement('div'); wr.className='rh-champ-wr'; rhCount(wr,Number(champ.wr),1000);
        var meta=document.createElement('div'); meta.className='rh-champ-meta';
        meta.textContent=(champ.__perfect?'Maximum on target '+champ.key:Math.round(champ.__pct)+'% of perfect on target '+champ.key)+(champ.holderText?' · '+champ.holderText:'');
        info.append(eye,wr,meta,comboChips(champ.darts));
        hero.append(badge,info);
        board.appendChild(hero);
      }

      var list=document.createElement('div'); list.className='rh-list';
      claimed.forEach(function(e,i){
        var row=document.createElement('div'); row.className='rh-rec'+(e.__perfect?' perfect':'');
        row.style.animationDelay=Math.min(700,i*45)+'ms';
        var tgt=document.createElement('div'); tgt.className='rh-tgt'; tgt.textContent=e.key;
        var main=document.createElement('div'); main.className='rh-rec-main';
        var top=document.createElement('div'); top.className='rh-rec-top';
        top.appendChild(comboChips(e.darts));
        var hold=document.createElement('div'); hold.className='rh-holder'; hold.textContent=e.holderText||'—'; hold.title=e.holderText||'';
        top.appendChild(hold);
        var meter=document.createElement('div'); meter.className='rh-meter'; var fill=document.createElement('span'); meter.appendChild(fill);
        var w=Math.max(3,Math.min(100,e.__pct))+'%';
        if(reduced)fill.style.width=w;else requestAnimationFrame(function(){requestAnimationFrame(function(){fill.style.width=w;});});
        main.append(top,meter);
        var side=document.createElement('div'); side.className='rh-side';
        var val=document.createElement('div'); val.className='rh-wr'; rhCount(val,Number(e.wr),700);
        var pct=document.createElement('div'); pct.className='rh-pct'+(e.__perfect?' perfect':''); pct.textContent=e.__perfect?'PERFECT':(Math.round(e.__pct)+'%');
        side.append(val,pct);
        row.append(tgt,main,side);
        row.setAttribute('role','button'); row.tabIndex=0;
        row.onclick=function(){ try{ window.openRoundTargetLeaderboard(e.key, mode); }catch(_){ } };
        list.appendChild(row);
      });
      board.appendChild(list);

      var hint=document.createElement('div'); hint.className='rh-hint'; hint.textContent='Tap a target for the full player leaderboard';
      board.appendChild(hint);

      if(unclaimed.length){
        var strip=document.createElement('div'); strip.className='rh-unclaimed';
        var lbl=document.createElement('span'); lbl.className='rh-unclaimed-label'; lbl.textContent='Unclaimed';
        strip.appendChild(lbl);
        unclaimed.forEach(function(e){ var c=document.createElement('span'); c.className='rh-uchip'; c.textContent=e.key; c.setAttribute('role','button'); c.onclick=function(){ try{ window.openRoundTargetLeaderboard(e.key, mode); }catch(_){ } }; strip.appendChild(c); });
        board.appendChild(strip);
      }
      return board;
    }
    async function render(){
      setBtnStates(tabs,mode); body.innerHTML='<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
      if(mode==='turbo'){
        var rows=[];
        try{ rows=await fetchTurboRoundHighScoresClean(); }
        catch(e){
          try{ console.warn('[SQ] Turbo Round High Scores clean view unavailable', e); }catch(_){}
          body.innerHTML='<div class="muted">Turbo Round High Scores data is unavailable.</div>';
          return;
        }
        if(!rows.length){
          body.innerHTML='<div class="muted">No Turbo round high scores found.</div>';
          return;
        }
        var tEntries=rows.map(function(r){
          var holder=String(r.holder||'').trim();
          var suffix=String(r.holder_suffix||'').trim();
          return { key:String(r.round_key||''), wr:r.wr, darts:r.darts, holderText:holder+(suffix?' '+suffix:'') };
        });
        body.innerHTML=''; body.appendChild(buildBoard(tEntries));
        return;
      }
      if(mode==='official'){
        var officialRows=[];
        try{ officialRows=await fetchOfficialRoundHighScoresClean(); }
        catch(e){
          try{ console.warn('[SQ] Official Round High Scores clean source unavailable', e); }catch(_){}
          body.innerHTML='<div class="muted">Official Round High Scores data is unavailable.</div>';
          return;
        }
        var officialBy=new Map();
        officialRows.forEach(function(r){ officialBy.set(String(r.round_key||''), r); });
        var oEntries=['10','11','12','13','14','15','16','17','18','19','20','D','T','B'].map(function(k){
          var r=officialBy.get(k), holders=r&&Array.isArray(r.holders)?r.holders:[];
          return { key:k, wr:r&&r.wr!=null?r.wr:null, darts:r&&r.darts?r.darts:'', holderText:holders.length?holders.join(' / '):'' };
        });
        body.innerHTML=''; body.appendChild(buildBoard(oEntries));
        return;
      }
      body.innerHTML='<div class="muted">Round High Scores source is unavailable for this mode.</div>';
    }
    tabs.onclick=function(e){var b=e.target.closest('[data-mode]'); if(!b)return; mode=b.dataset.mode; render();};
    back.onclick=function(){overlay.remove();try{if(typeof openLeagueRankingsDialog==='function')openLeagueRankingsDialog();}catch(_){}}; close.onclick=function(){overlay.remove();}; overlay.onclick=function(e){if(e.target===overlay)overlay.remove();}; await render();
  };

  try{ console.info('[SQ] Fix97 League & Ranks Turbo tabs active'); }catch(_){ }
})();
