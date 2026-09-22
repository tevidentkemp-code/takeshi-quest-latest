
(function(){
'use strict';
if(window.__sqFix136PremierLeagueRestoreFilters)return;window.__sqFix136PremierLeagueRestoreFilters=true;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function key(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');}
function parseMs(t){var n=Date.parse(t||'');return Number.isFinite(n)?n:0;}
function playerName(p){if(p==null)return'';if(typeof p==='string')return p.trim();var n=String(p.name||p.player||p.player_name||p.playerName||p.display_name||'').trim();if(n)return n;var f=String(p.first_name||p.firstName||'').trim(),l=String(p.last_name||p.lastName||'').trim(),nick=String(p.nickname||'').trim();return f?(f+(nick?' "'+nick+'"':'')+(l?' '+l:'')):'';}
function playersOf(g){var ps=g&&(g.players||(g.state&&g.state.players)||(g.raw&&g.raw.state&&g.raw.state.players));return Array.isArray(ps)?ps:[];}
function totalsOf(g){var t=g&&(g.totals||(g.state&&g.state.totals)||(g.raw&&g.raw.totals)||(g.raw&&g.raw.state&&g.raw.state.totals));return Array.isArray(t)?t:[];}
function boardOf(g){return g&&(g.board||g.score||(g.state&&(g.state.board||g.state.score))||(g.raw&&g.raw.state&&(g.raw.state.board||g.raw.state.score)));}
function rowsForPlayer(board,pi){if(!Array.isArray(board))return[];if(Array.isArray(board[pi]))return board[pi];if(Array.isArray(board[0])&&board[0][pi]!=null)return board.map(function(r){return Array.isArray(r)?r[pi]:null;});return[];}
function roundScore(ent){if(ent==null)return 0;if(typeof ent==='number'||typeof ent==='string')return Number(ent)||0;var keys=['roundTotal','round_total','points','score','total','val','value'];for(var i=0;i<keys.length;i++){var n=Number(ent[keys[i]]);if(Number.isFinite(n)&&n>0)return n;}var darts=Array.isArray(ent.darts)?ent.darts:(Array.isArray(ent.throws)?ent.throws:null);if(darts)return darts.reduce(function(a,d){return a+(Number(d&&(d.points??d.score??d.val??d.value)||0)||0);},0);return 0;}
function totalFor(g,pi){var totals=totalsOf(g),v=totals[pi];if(typeof v==='number'||typeof v==='string'){var n=Number(v)||0;if(n>0)return n;}if(v&&typeof v==='object'){var no=Number(v.total??v.score??v.points??v.val);if(Number.isFinite(no)&&no>0)return no;}return rowsForPlayer(boardOf(g),pi).reduce(function(a,e){return a+roundScore(e);},0);}
function gameTs(g){return g?.ts||g?.created_at||g?.completed_at||(g?.state&&g.state.completed_at)||(g?.raw&&g.raw.created_at)||'';}
async function savedKeys(){try{var rows=typeof cloudListPlayers==='function'?await cloudListPlayers():[];if(Array.isArray(rows)&&rows.length)return new Set(rows.map(function(p){return key(p.name||p.first_name||p.firstName||'');}).filter(Boolean));}catch(_){}try{var rows2=typeof getSavedPlayers==='function'?getSavedPlayers():[];return new Set((rows2||[]).map(function(p){return key(p.name);}).filter(Boolean));}catch(_){}return new Set();}
async function officialRows(){var games=[];try{if(typeof getGamesForMode==='function')games=await getGamesForMode('official');}catch(_){}try{if((!games||!games.length)&&typeof __sqGetAllGamesNormalized==='function')games=(await __sqGetAllGamesNormalized()).filter(function(g){if(typeof window.__sqGameModeKey==='function')return window.__sqGameModeKey(g)==='official';return !(g.isPractice||g.is_practice||g.practice) && String(g.mode||g.game_mode||g.state?.mode||'').toLowerCase()!=='practice';});}catch(_){}var saved=await savedKeys(), rows=[];(games||[]).forEach(function(g){var ps=playersOf(g), ts=gameTs(g);if(ps.length<2)return;ps.forEach(function(p,i){var name=playerName(p)||('Player '+(i+1)), k=key(name), score=totalFor(g,i);if(saved.size&&!saved.has(k))return;if(score>0)rows.push({player:name,key:k,score:score,ts:ts});});});return rows;}
function startOfDay(d,off){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+(off||0));}
function filters(){var now=new Date(), out=[];out.push({id:'TODAY',label:'Today',match:function(ts){var ms=parseMs(ts),d=new Date(ms),a=startOfDay(now,0),b=startOfDay(now,1);return ms&&d>=a&&d<b;},min:2});out.push({id:'YESTERDAY',label:'Yesterday',match:function(ts){var ms=parseMs(ts),d=new Date(ms),a=startOfDay(now,-1),b=startOfDay(now,0);return ms&&d>=a&&d<b;},min:2});out.push({id:'THIS_WEEK',label:'This Week',match:function(ts){var ms=parseMs(ts),d=new Date(ms),dow=(now.getDay()+6)%7,a=startOfDay(now,-dow),b=new Date(a);b.setDate(a.getDate()+7);return ms&&d>=a&&d<b;},min:2});for(var i=0;i<6;i++){(function(i){var d=new Date(now.getFullYear(),now.getMonth()-i,1),y=d.getFullYear(),m=d.getMonth(),lab=d.toLocaleString('en-GB',{month:'short'}).toUpperCase();out.push({id:'M'+y+'-'+String(m+1).padStart(2,'0'),label:lab,match:function(ts){var ms=parseMs(ts),dt=new Date(ms);return ms&&dt.getFullYear()===y&&dt.getMonth()===m;},min:3});})(i);}out.push({id:'Y2026',label:'2026',match:function(ts){var ms=parseMs(ts),d=new Date(ms);return ms&&d.getFullYear()===2026;},min:10});out.push({id:'Y2025',label:'2025',match:function(ts){var ms=parseMs(ts),d=new Date(ms);return ms&&d.getFullYear()===2025;},min:10});out.push({id:'ALL',label:'All Time',match:function(){return true;},min:15});return out;}
function aggregate(rows,filter){var map=new Map();rows.filter(function(r){return filter.match(r.ts);}).forEach(function(r){var x=map.get(r.key)||{player:r.player,games:0,total:0,best:0};x.games++;x.total+=r.score;if(r.score>x.best)x.best=r.score;map.set(r.key,x);});return Array.from(map.values()).map(function(x){x.avg=x.games?x.total/x.games:0;x.qualifies=x.games>=filter.min;return x;}).sort(function(a,b){if(a.qualifies!==b.qualifies)return a.qualifies?-1:1;return(b.avg-a.avg)||(b.games-a.games)||String(a.player).localeCompare(String(b.player));});}
function openPremier(){try{if(typeof window.__sqCleanupLeagueRankingsOverlays==='function')window.__sqCleanupLeagueRankingsOverlays();}catch(_){}var fs=filters(), cur=fs.find(function(f){return /^M/.test(f.id);})||fs[0], allRows=null;var bd=document.createElement('div');bd.className='modal-backdrop sq136-pl-bd';var modal=document.createElement('div');modal.className='modal sq136-pl-modal';bd.appendChild(modal);modal.innerHTML='<div class="sq136-pl-head"><div><h3>Premier League</h3><div class="sq136-pl-sub">Average league by selected period.</div></div></div><div class="sq136-pl-body"><div class="sq136-pl-filters"><div class="sq136-pl-filter-row sq136-r1"></div><div class="sq136-pl-filter-row sq136-r2"></div><div class="sq136-pl-filter-row sq136-r3"></div></div><div class="sq136-pl-table-mount"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div></div><div class="sq136-pl-footer"><button type="button" class="btn sq136-back">Back</button><button type="button" class="btn sq136-close">Close</button></div>';document.body.appendChild(bd);try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(bd,modal,function(){bd.remove();});}catch(_){}var mount=modal.querySelector('.sq136-pl-table-mount');function close(){bd.remove();}modal.querySelector('.sq136-close').onclick=close;modal.querySelector('.sq136-back').onclick=function(){close();try{if(typeof openLeagueRankingsDialog==='function')openLeagueRankingsDialog();}catch(_){}};bd.addEventListener('click',function(e){if(e.target===bd)close();});function rowFor(f){if(f.id==='TODAY'||f.id==='YESTERDAY'||f.id==='THIS_WEEK')return modal.querySelector('.sq136-r1');if(/^M/.test(f.id))return modal.querySelector('.sq136-r2');return modal.querySelector('.sq136-r3');}fs.forEach(function(f){var b=document.createElement('button');b.type='button';b.textContent=f.label;b.dataset.filterId=f.id;b.onclick=function(){cur=f;render();};rowFor(f).appendChild(b);});async function render(){modal.querySelectorAll('[data-filter-id]').forEach(function(b){b.classList.toggle('active',b.dataset.filterId===cur.id);});if(!allRows){try{allRows=await window.__sqWithCloudTimeout(officialRows(),12000,'premier-league');}catch(err){try{console.warn('[SQ] Premier League cloud read failed/timed out',err);}catch(_){}mount.innerHTML='<p class="tag">'+window.__sqCloudErrorHtml()+'</p>';var rb=mount.querySelector('[data-action="cloudRetry"]');if(rb)rb.onclick=function(){render();};return;}}var rows=aggregate(allRows,cur);
// Arcade "championship table": zone-striped rows sliding in, count-up
// averages, qualification progress dots. .best-cell retained so the sq137
// medal decorator keeps working.
mount.innerHTML='<div class="sq136-pl-note">'+esc(cur.label)+' · '+cur.min+' Games Minimum</div>';
var arena=document.createElement('div');arena.className='pl-arena';mount.appendChild(arena);
if(!rows.length){arena.innerHTML='<p class="tag">No official saved-player games found for '+esc(cur.label)+'.</p>';return;}
var reduced=false;try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){ }
function plCount(el,target,dec,dur){if(reduced||!Number.isFinite(target)){el.textContent=Number(target||0).toFixed(dec);return;}var t0=performance.now();(function step(t){var p=Math.min(1,(t-t0)/dur);el.textContent=(target*(1-Math.pow(1-p,3))).toFixed(dec);if(p<1)requestAnimationFrame(step);})(t0);}
var maxAvg=rows.reduce(function(m,r){return r.qualifies?Math.max(m,r.avg):m;},0)||1;
var rank=0;
rows.forEach(function(r,i){
  var q=r.qualifies;if(q)rank++;var myRank=rank;
  var row=document.createElement('div');
  row.className='pl-row'+(q&&myRank<=3?' zone z'+myRank:'')+(q&&myRank===1?' lead':'')+(q?'':' unq');
  row.style.animationDelay=Math.min(700,i*45)+'ms';
  var rk=document.createElement('div');rk.className='pl-rank'+(q&&myRank<=3?' g'+myRank:'');rk.textContent=q?('#'+myRank):'—';
  var main=document.createElement('div');main.className='pl-main';
  var top=document.createElement('div');top.className='pl-top';
  var nm=document.createElement('div');nm.className='pl-name';nm.textContent=r.player;top.appendChild(nm);
  if(q&&myRank===1){var tr=document.createElement('span');tr.className='pl-trophy';tr.textContent='🏆';top.appendChild(tr);}
  var bar=document.createElement('div');bar.className='pl-bar';var fill=document.createElement('span');bar.appendChild(fill);
  var w=Math.max(3,Math.min(100,(Number(r.avg)||0)/maxAvg*100))+'%';
  if(reduced)fill.style.width=w;else requestAnimationFrame(function(){requestAnimationFrame(function(){fill.style.width=w;});});
  var sub=document.createElement('div');sub.className='pl-sub';
  if(q){sub.textContent=r.games+(r.games===1?' game':' games');}
  else{
    var dots=document.createElement('span');dots.className='pl-dots';
    for(var d=0;d<cur.min;d++){var dot=document.createElement('i');if(d<r.games)dot.className='on';dots.appendChild(dot);}
    var lbl=document.createElement('span');lbl.textContent=r.games+'/'+cur.min+' games to qualify';
    sub.append(dots,lbl);
  }
  main.append(top,bar,sub);
  var side=document.createElement('div');side.className='pl-side';
  var av=document.createElement('div');av.className='pl-avg';plCount(av,Number(r.avg)||0,1,750);
  var best=document.createElement('div');best.className='pl-best best-cell';best.textContent='BEST '+Math.round(r.best);
  side.append(av,best);
  row.append(rk,main,side);
  arena.appendChild(row);
});}
render();}
window.openPremierLeagueDialog=openPremier;window.openPremierLeaguePopup=openPremier;
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('#leaguePremierLeagueBtn'):null;if(!b)return;try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){}openPremier();},true);
try{console.info('[SQ] Fix136 Premier League restored period filters active');}catch(_){ }
})();
