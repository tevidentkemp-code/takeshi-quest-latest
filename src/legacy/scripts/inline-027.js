
(function(){
  if(window.__sqFix99Top50PracticeTab) return;
  window.__sqFix99Top50PracticeTab = true;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function parseMs(t){var n=Date.parse(t||''); return Number.isFinite(n)?n:0;}
  function fmtWhen(ts){try{var d=new Date(ts||0); if(!Number.isFinite(d.getTime()))return ''; return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');}catch(_){return '';}}
  function pName(p){if(p==null)return ''; if(typeof p==='string')return p.trim(); var n=String(p.name||p.player||p.player_name||p.playerName||p.display_name||p.nick||'').trim(); if(n)return n; var f=String(p.first_name||p.firstName||'').trim(),l=String(p.last_name||p.lastName||'').trim(),nick=String(p.nickname||'').trim(); return f?(nick?(f+' "'+nick+'"'+(l?' '+l:'')):(f+(l?' '+l:''))):'';}
  function playersOf(g){var ps=g&&(g.players||(g.state&&g.state.players)||(g.raw&&g.raw.state&&g.raw.state.players));return Array.isArray(ps)?ps:[];}
  function totalsOf(g){var t=g&&(g.totals||(g.state&&g.state.totals)||(g.raw&&g.raw.totals)||(g.raw&&g.raw.state&&g.raw.state.totals));return Array.isArray(t)?t:[];}
  function boardOf(g){return g&&(g.board||g.score||(g.state&&(g.state.board||g.state.score))||(g.raw&&g.raw.state&&(g.raw.state.board||g.raw.state.score)));}
  function rowsForPlayer(board,pi){if(!Array.isArray(board))return []; if(Array.isArray(board[pi]))return board[pi]; if(Array.isArray(board[0])&&board[0][pi]!=null)return board.map(function(r){return Array.isArray(r)?r[pi]:null;}); return [];}
  function roundScore(ent){if(ent==null)return 0; if(typeof ent==='number'||typeof ent==='string')return Number(ent)||0; var keys=['roundTotal','round_total','points','score','total','val','value']; for(var i=0;i<keys.length;i++){var n=Number(ent[keys[i]]); if(Number.isFinite(n)&&n>0)return n;} var darts=Array.isArray(ent.darts)?ent.darts:(Array.isArray(ent.throws)?ent.throws:null); if(darts)return darts.reduce(function(a,d){return a+(Number(d&&(d.points||d.score||d.val||d.value)||0)||0);},0); return 0;}
  function totalFor(g,pi){var t=totalsOf(g),v=t[pi]; if(typeof v==='number'||typeof v==='string'){var n=Number(v)||0;if(n>0)return n;} if(v&&typeof v==='object'){var no=Number(v.total||v.score||v.points||v.val); if(Number.isFinite(no)&&no>0)return no;} return rowsForPlayer(boardOf(g),pi).reduce(function(a,e){return a+roundScore(e);},0);}
  function isPractice(g){var st=(g&&g.state)||{},rawst=(g&&g.raw&&g.raw.state)||{};var mode=String((g&&g.mode)||(g&&g.game_mode)||st.mode||st.gameMode||rawst.mode||'').toLowerCase();return mode.indexOf('practice')>=0||mode.indexOf('unofficial')>=0||mode==='solo'||(g&&g.isPractice===true)||(g&&g.is_practice===true)||st.isPractice===true||st.is_practice===true||playersOf(g).length===1;}
  function isTurbo(g){try{var st=(g&&g.state)||{},rawst=(g&&g.raw&&g.raw.state)||{},m=st.match||rawst.match||(g&&g.match)||{},rules=st.tournamentRules||m.tournamentRules||rawst.tournamentRules||{};var type=String((g&&g.tournamentType)||st.tournamentType||st.tournament_type||m.tournamentType||m.tournament_type||rawst.tournamentType||(st.__sqTournamentDraft&&st.__sqTournamentDraft.type)||'').toLowerCase();return type==='turbo'||st.strictTimer===true||m.strictTimer===true||rules.strictTimer===true||Number(st.throwLimitSeconds||m.throwLimitSeconds||rules.throwLimitSeconds||0)===20||String(rules.startTarget||st.startTarget||m.startTarget||'').toLowerCase()==='17';}catch(_){return false;}}
  async function gamesFor(bucket){
    try{if(typeof window.getGamesForMode==='function'){var g=await window.getGamesForMode(bucket); if(Array.isArray(g))return g;}}catch(_){}
    var all=[]; try{if(typeof window.__sqGetAllGamesNormalized==='function')all=await window.__sqGetAllGamesNormalized(); else if(typeof cloudFetchAllGamesAsLocal==='function')all=await cloudFetchAllGamesAsLocal();}catch(_){all=[];}
    all=Array.isArray(all)?all:[];
    return all.filter(function(g){
      if(g&&(g.archived_at||g.archivedAt))return false;
      if(bucket==='turbo')return isTurbo(g)&&!isPractice(g);
      if(bucket==='practice')return isPractice(g)&&!isTurbo(g);
      return !isTurbo(g)&&!isPractice(g);
    }).sort(function(a,b){return parseMs(b.ts||b.created_at)-parseMs(a.ts||a.created_at);});
  }
  function denomFor(bucket,g,pi){
    if(bucket==='turbo') return 7;
    var rows=rowsForPlayer(boardOf(g),pi).filter(function(x){return x!=null;});
    return rows.length>=7?rows.length:14;
  }
  async function rowsFor(bucket){var gs=await gamesFor(bucket),rows=[]; gs.forEach(function(g){playersOf(g).forEach(function(p,pi){var name=pName(p);if(!name)return;var score=totalFor(g,pi);if(!(score>0))return;rows.push({player:name,score:score,avg_round:score/denomFor(bucket,g,pi),ts:g.ts||g.created_at||''});});}); rows.sort(function(a,b){return (b.score-a.score)||(parseMs(b.ts)-parseMs(a.ts))||String(a.player).localeCompare(String(b.player));}); return rows.slice(0,50);}
  async function openTop50(initialMode){
    var requested=String(initialMode||'official').toLowerCase();
    var mode=(requested==='turbo'||requested==='practice')?requested:'official';
    document.querySelectorAll('.sq-top50-backdrop,.sq-top50-fix98-backdrop,.sq-top50-fix99-backdrop').forEach(function(n){try{n.remove();}catch(_){}});
    var overlay=document.createElement('div');overlay.className='modal-backdrop sq-top50-fix99-backdrop';
    var modal=document.createElement('div');modal.className='modal sq-wide-modal';
    var head=document.createElement('div');head.className='sq-fix98-head';
    head.innerHTML='<div class="sq-fix98-title"><h3>Top 50 Scores</h3><div class="sq-fix98-sub">Official, Turbo and Practice scores are stored separately.</div></div><div class="sq-fix98-tabs"><button type="button" data-mode="official">Official</button><button type="button" data-mode="turbo">Turbo</button><button type="button" data-mode="practice">Practice</button></div>';
    var body=document.createElement('div');body.className='modal-body';
    body.innerHTML='<div class="sq-fix98-note"></div><div class="table-wrap"><table class="hs-table"><thead><tr><th>#</th><th>Player</th><th>Score</th><th>Avg / Round</th><th>When</th></tr></thead><tbody></tbody></table></div>';
    var footer=document.createElement('div');footer.className='modal-footer';
    var back=document.createElement('button');back.className='btn';back.textContent='Back';
    var close=document.createElement('button');close.className='btn primary';close.textContent='Close';
    footer.append(back,close);modal.append(head,body,footer);overlay.appendChild(modal);document.body.appendChild(overlay);
    var tabs=head.querySelector('.sq-fix98-tabs'),tbody=body.querySelector('tbody'),note=body.querySelector('.sq-fix98-note');
    function label(){return mode==='turbo'?'Turbo':(mode==='practice'?'Practice':'Official');}
    function setTabs(){Array.from(tabs.querySelectorAll('button')).forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});}
    async function render(){setTabs();note.textContent=mode==='turbo'?'Turbo player-game scores only.':(mode==='practice'?'Practice player-game scores only.':'Classic official player-game scores only.');tbody.innerHTML='<tr><td colspan="5" style="opacity:.8;padding:14px;">Loading…</td></tr>';var rows=await rowsFor(mode);if(!rows.length){tbody.innerHTML='<tr><td colspan="5" style="opacity:.85;padding:14px;">No '+label()+' scores found.</td></tr>';return;}tbody.innerHTML=rows.map(function(r,i){return '<tr><td style="color:#ff8a00;font-weight:800;">'+(i+1)+'</td><td>'+esc(r.player)+'</td><td style="font-weight:800;">'+Math.round(r.score)+'</td><td>'+Number(r.avg_round||0).toFixed(1)+'</td><td style="font-size:.8rem;opacity:.85;">'+esc(fmtWhen(r.ts))+'</td></tr>';}).join('');}
    tabs.onclick=function(e){var b=e.target.closest('button[data-mode]');if(!b)return;mode=b.dataset.mode;render();};
    back.onclick=function(){overlay.remove();try{if(typeof openLeagueRankingsDialog==='function')openLeagueRankingsDialog();}catch(_){}};
    close.onclick=function(){overlay.remove();};overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    await render();
  }
  window.__sqOpenTop50ScoresTurboTabs=function(){ return openTop50.apply(window, arguments); };
  window.__sqOpenTop50ScoresAllModes=window.__sqOpenTop50ScoresTurboTabs;
  try{console.info('[SQ] Fix99 Top 50 Official/Turbo/Practice tabs active');}catch(_){ }
})();
