import fs from 'node:fs';
import crypto from 'node:crypto';

function fail(msg){ throw new Error('SC-034 writer: '+msg); }
function replaceOnce(text, from, to, label){
  const first=text.indexOf(from);
  if(first<0) fail(label+' anchor missing');
  if(text.indexOf(from,first+1)>=0) fail(label+' anchor not unique');
  return text.slice(0,first)+to+text.slice(first+from.length);
}

const enginePath='src/game/engine.js';
let engine=fs.readFileSync(enginePath,'utf8');
const recordAnchor='// @CANONICAL:GAMEPLAY_RECORD_THROW_BASE\nfunction recordThrow(spec){';
if(engine.includes('// >>> SC-034 LATE-JOIN PLAYER FLOW START')) fail('engine already patched');

const helper=String.raw`// >>> SC-034 LATE-JOIN PLAYER FLOW START
function __sqIsActualTournamentRuntime(){
  try{
    const m=(state&&state.match)||{};
    return !!(m.tournament===true||m.tournamentType||m.tournamentSize||m.tournamentMatch||state?.__sqTournamentDraft||state?.__sqTournamentActive);
  }catch(_){return false;}
}
function __sqFirst17DartRecorded(){
  try{
    if(Number(state?.currentRound||0)>7)return true;
    const board=Array.isArray(state?.score)?state.score:[];
    if(board.some(rows=>Array.isArray(rows?.[7]?.darts)&&rows[7].darts.some(d=>d!=null)))return true;
    return (Array.isArray(state?.history)?state.history:[]).some(h=>Number(h?.round)>=7&&h?.throw!=null);
  }catch(_){return true;}
}
function __sqLateJoinStatus(){
  try{
    if(!state||state.finished)return {ok:false,reason:'Game is not active.'};
    if(state.suddenDeath&&state.suddenDeath.active)return {ok:false,reason:'Add Player is unavailable during a decider.'};
    if(state.__sqLateJoinCatchUp&&state.__sqLateJoinCatchUp.active)return {ok:false,reason:'Finish the current catch-up first.'};
    if(__sqIsActualTournamentRuntime())return {ok:false,reason:'Add Player is not available in Tournament games.'};
    if(typeof __sqIsVsShadowRuntime==='function'&&__sqIsVsShadowRuntime())return {ok:false,reason:'Add Player is not available in Vs Shadow.'};
    const players=Array.isArray(state.players)?state.players:[];
    if(players.length>=6)return {ok:false,reason:'Maximum 6 players.'};
    const mode=(typeof __sqComputeGameMode==='function')?String(__sqComputeGameMode()||'').toLowerCase():'';
    if(mode==='practice')return {ok:false,reason:'Add Player is only available in Match Play.'};
    if(__sqFirst17DartRecorded())return {ok:false,reason:'Late entry closes when the first 17s dart is thrown.'};
    return {ok:true,reason:'Player will join as the final thrower.'};
  }catch(_){return {ok:false,reason:'Add Player is unavailable.'};}
}
function __sqLateJoinEmptyBoardEntry(status=''){
  const out={darts:[null,null,null],roundTotal:0};
  if(status)out.lateJoinStatus=status;
  return out;
}
function __sqLateJoinPlayerKey(p){
  try{
    const id=p&&p.id!=null?String(p.id).trim().toLowerCase():'';
    if(id)return 'id:'+id;
    const name=p&&p.name!=null?String(p.name).trim().toLowerCase():'';
    return name?'name:'+name:'';
  }catch(_){return '';}
}
function __sqLateJoinNormalizeSavedPlayer(input){
  try{
    const rawName=String(input?.name||'').trim();
    if(!rawName)return null;
    const saved=(typeof __sqFindSavedPlayerMetaByName==='function')?__sqFindSavedPlayerMetaByName(rawName):null;
    if(!saved)return null;
    const src=Object.assign({},saved,input||{});
    const name=String(src.name||rawName).trim();
    const parts=(typeof __sqNameParts==='function')?__sqNameParts(name):{first:name,last:''};
    return {type:'registered',id:src.id!=null&&String(src.id).trim()?String(src.id).trim():null,name,
      first_name:String(src.first_name||'').trim()||parts.first||'',last_name:String(src.last_name||'').trim()||parts.last||'',
      nickname:String(src.nickname||'').trim(),initials:(typeof __sqNormalizeInitials==='function')?__sqNormalizeInitials(src.initials,name):String(src.initials||'').trim()};
  }catch(_){return null;}
}
function __sqLateJoinEnsureHistorySlots(newCount){
  try{
    const hist=Array.isArray(state?.match?.history)?state.match.history:[];
    hist.forEach(game=>{
      if(!game)return;
      if(Array.isArray(game.totals))while(game.totals.length<newCount)game.totals.push(null);
      if(Array.isArray(game.board))while(game.board.length<newCount)game.board.push(null);
    });
  }catch(_){}
}
function __sqLateJoinExtendAggregates(){
  try{if(typeof ensureMatchAgg==='function')ensureMatchAgg();}catch(_){}
  const count=state.players.length;
  if(state.matchAgg){
    if(!Array.isArray(state.matchAgg.hits))state.matchAgg.hits=[];
    while(state.matchAgg.hits.length<count)state.matchAgg.hits.push({});
    ['totals60','totals100','totals140'].forEach(key=>{
      if(!Array.isArray(state.matchAgg[key]))state.matchAgg[key]=[];
      while(state.matchAgg[key].length<count)state.matchAgg[key].push(0);
    });
  }
  if(state.match){
    if(!Array.isArray(state.match.wins))state.match.wins=[];
    while(state.match.wins.length<count)state.match.wins.push(0);
  }
}
function __sqAppendLatePlayer(input){
  const gate=__sqLateJoinStatus();
  if(!gate.ok)return gate;
  const player=__sqLateJoinNormalizeSavedPlayer(input);
  if(!player)return {ok:false,reason:'Choose a registered player synced from Supabase.'};
  const currentKeys=new Set((state.players||[]).map(__sqLateJoinPlayerKey).filter(Boolean));
  const key=__sqLateJoinPlayerKey(player);
  const nameKey='name:'+String(player.name||'').trim().toLowerCase();
  if((key&&currentKeys.has(key))||currentKeys.has(nameKey))return {ok:false,reason:'That player is already in the game.'};
  if(!Array.isArray(state.score))return {ok:false,reason:'Current game score state is unavailable.'};

  const joinRound=Math.max(0,Math.min(MAX_ROUNDS-1,Number(state.currentRound||0)));
  const mode=(typeof __sqComputeGameMode==='function')?String(__sqComputeGameMode()||'').toLowerCase():'';
  const firstPlayableRound=mode==='turbo'?7:0;
  const priorRounds=joinRound>firstPlayableRound?Array.from({length:joinRound-firstPlayableRound},(_,i)=>firstPlayableRound+i):[];
  const pendingRounds=priorRounds.slice(-3);
  const scratchRounds=priorRounds.slice(0,Math.max(0,priorRounds.length-pendingRounds.length));
  const board=Array.from({length:MAX_ROUNDS},(_,r)=>{
    if(scratchRounds.includes(r))return __sqLateJoinEmptyBoardEntry('scratch');
    if(pendingRounds.includes(r))return __sqLateJoinEmptyBoardEntry('pending');
    return __sqLateJoinEmptyBoardEntry('');
  });

  state.players.push(player);
  state.score.push(board);
  const playerIndex=state.players.length-1;
  __sqLateJoinExtendAggregates();
  __sqLateJoinEnsureHistorySlots(state.players.length);
  if(!Array.isArray(state.lateJoinJobs))state.lateJoinJobs=[];
  state.lateJoinJobs.push({playerIndex,playerKey:key||nameKey,joinedAtRound:joinRound,pendingRounds:pendingRounds.slice(),scratchRounds:scratchRounds.slice(),completed:pendingRounds.length===0});
  try{if(typeof assignUniqueColors==='function')assignUniqueColors(state.players);}catch(_){}
  try{if(typeof save==='function')save();}catch(_){}
  return {ok:true,reason:'Player added as final thrower.',playerIndex,pendingRounds:pendingRounds.slice(),scratchRounds:scratchRounds.slice()};
}
function __sqPendingLateJoinJobsForRound(completedRound){
  try{return (Array.isArray(state.lateJoinJobs)?state.lateJoinJobs:[]).map((job,idx)=>({job,idx}))
    .filter(x=>!x.job.completed&&Number(x.job.joinedAtRound)<=Number(completedRound)&&Array.isArray(x.job.pendingRounds)&&x.job.pendingRounds.length);}
  catch(_){return [];}
}
function __sqStartLateJoinCatchUp(completedRound){
  const jobs=__sqPendingLateJoinJobsForRound(completedRound);
  if(!jobs.length)return false;
  const resumeRound=Number(completedRound)+1;
  state.__sqLateJoinCatchUp={active:true,queue:jobs.map(x=>x.idx),queuePos:0,roundPos:0,resumeRound,finishAfter:resumeRound>=MAX_ROUNDS};
  const job=state.lateJoinJobs[jobs[0].idx];
  state.currentPlayer=Number(job.playerIndex); state.currentRound=Number(job.pendingRounds[0]); state.currentDart=0;
  try{toast('Catch-up: '+String(state.players?.[job.playerIndex]?.name||'player'));}catch(_){}
  return true;
}
function __sqAdvanceLateJoinCatchUp(){
  const flow=state.__sqLateJoinCatchUp;
  if(!flow||!flow.active)return false;
  const jobIndex=Number(flow.queue?.[flow.queuePos]),job=state.lateJoinJobs?.[jobIndex];
  if(!job){flow.active=false;return false;}
  const completedRound=Number(job.pendingRounds?.[flow.roundPos]);
  const ent=state.score?.[job.playerIndex]?.[completedRound];
  if(ent)ent.lateJoinStatus='caughtUp';
  flow.roundPos++;
  if(flow.roundPos<job.pendingRounds.length){
    state.currentPlayer=Number(job.playerIndex); state.currentRound=Number(job.pendingRounds[flow.roundPos]); state.currentDart=0; return true;
  }
  job.completed=true; flow.queuePos++; flow.roundPos=0;
  if(flow.queuePos<flow.queue.length){
    const next=state.lateJoinJobs?.[Number(flow.queue[flow.queuePos])];
    if(next&&next.pendingRounds?.length){state.currentPlayer=Number(next.playerIndex);state.currentRound=Number(next.pendingRounds[0]);state.currentDart=0;return true;}
  }
  flow.active=false; state.currentDart=0; state.currentPlayer=0;
  if(flow.finishAfter){state.currentRound=MAX_ROUNDS-1;state.finished=true;}else state.currentRound=Number(flow.resumeRound);
  try{if(typeof save==='function')save();}catch(_){}
  return true;
}
try{window.__sqLateJoinStatus=__sqLateJoinStatus;window.__sqAppendLatePlayer=__sqAppendLatePlayer;}catch(_){}
// <<< SC-034 LATE-JOIN PLAYER FLOW END

`;
engine=replaceOnce(engine,recordAnchor,helper+recordAnchor,'recordThrow');

engine=replaceOnce(engine,
`  state.history.push({
    player:    pIndex,
    round:     rIndex,
    dartIndex: dartIndex,
    throw:     dartObj
  });`,
`  state.history.push({
    player:    pIndex,
    round:     rIndex,
    dartIndex: dartIndex,
    throw:     dartObj,
    lateJoinCatchUp: !!(state.__sqLateJoinCatchUp && state.__sqLateJoinCatchUp.active)
  });`,'history');

engine=replaceOnce(engine,
`  // Advance dart / player / round
  if (state.currentDart < 2) {
    state.currentDart++;
  } else {
    state.currentDart = 0;
    if (state.currentPlayer < state.players.length - 1) {
      state.currentPlayer++;
    } else {
      state.currentPlayer = 0;
      if (state.currentRound < MAX_ROUNDS - 1) {
        state.currentRound++;
      } else {
        // Game done – completion dialog will open
        state.finished = true;
      }
    }
  }`,
`  // Advance dart / player / round.
  // SC-034 catch-up runs only after the live table round has completed.
  if (state.currentDart < 2) {
    state.currentDart++;
  } else {
    state.currentDart = 0;
    if (state.__sqLateJoinCatchUp && state.__sqLateJoinCatchUp.active) {
      __sqAdvanceLateJoinCatchUp();
    } else if (state.currentPlayer < state.players.length - 1) {
      state.currentPlayer++;
    } else {
      const completedRound = Number(state.currentRound);
      state.currentPlayer = 0;
      if (!__sqStartLateJoinCatchUp(completedRound)) {
        if (state.currentRound < MAX_ROUNDS - 1) state.currentRound++;
        else state.finished = true;
      }
    }
  }`,'advance');

engine=replaceOnce(engine,
`      const t = (state.match.history[g]?.totals?.[idx]) || 0;
      perGame.push(t);
      total += t;`,
`      const raw = state.match.history[g]?.totals?.[idx];
      const t = raw == null ? null : (Number(raw) || 0);
      perGame.push(t);
      if (t != null) total += t;`,'history totals');

engine=replaceOnce(engine,
`      perPlayer.map(p => String(p.perGame[g] || 0)),`,
`      perPlayer.map(p => p.perGame[g] == null ? '–' : String(p.perGame[g])),`,'history display');

fs.writeFileSync(enginePath,engine);

const menuPath='src/legacy/scripts/inline-030.js';
let menu=fs.readFileSync(menuPath,'utf8');
if(menu.includes('function openAddPlayerMenu('))fail('menu already patched');

const removeFn='  function openRemovePlayerMenu(prev){';
const addFn=String.raw`  async function openAddPlayerMenu(prev){
    var gate=(typeof window.__sqLateJoinStatus==='function')?window.__sqLateJoinStatus():{ok:false,reason:'Add Player is unavailable.'};
    if(!gate.ok){try{toast(gate.reason);}catch(_){} if(prev)prev(); return;}
    var m=openModalShell('Add Player','Joins as final thrower');
    m.modal.querySelector('.sq-menu106-back').onclick=function(){m.close();if(prev)prev();};
    var info=document.createElement('p');info.className='tag';info.textContent='Loading registered players…';m.body.appendChild(info);
    try{
      if(typeof window.__sqSyncPlayerCacheFromCloud!=='function')throw new Error('Player sync unavailable');
      var sync=await window.__sqSyncPlayerCacheFromCloud();
      if(!sync||sync.ok!==true)throw new Error((sync&&sync.reason)||'Supabase player sync failed');
      var rows=(typeof getSavedPlayers==='function'?getSavedPlayers():[])||[];
      var current=new Set((state.players||[]).map(function(p){return String((p&&p.id)||'').trim().toLowerCase()||('name:'+String((p&&p.name)||'').trim().toLowerCase());}));
      rows=rows.filter(function(p){
        var id=String((p&&p.id)||'').trim().toLowerCase();
        var nk='name:'+String((p&&p.name)||'').trim().toLowerCase();
        return p&&p.name&&!current.has(id||nk)&&!current.has(nk);
      });
      info.remove();
      if(!rows.length){var none=document.createElement('p');none.className='tag';none.textContent='No other registered players are available.';m.body.appendChild(none);return;}
      rows.forEach(function(p){
        var label=(typeof __sqPlayerPretty==='function'?__sqPlayerPretty(p):'')||p.name;
        addRow(m.body,{ico:'+',label:label,desc:'Join as final thrower',cls:'green',onClick:function(){
          var latest=(typeof window.__sqLateJoinStatus==='function')?window.__sqLateJoinStatus():{ok:false,reason:'Add Player is unavailable.'};
          if(!latest.ok){try{toast(latest.reason);}catch(_){}return;}
          var res=(typeof window.__sqAppendLatePlayer==='function')?window.__sqAppendLatePlayer(p):{ok:false,reason:'Add Player is unavailable.'};
          if(!res||!res.ok){try{toast((res&&res.reason)||'Player could not be added.');}catch(_){}return;}
          m.close();
          try{if(typeof buildEverything==='function')buildEverything();}catch(e){console.error(e);}
          try{if(typeof updateUI==='function')updateUI();}catch(e){console.error(e);}
          try{toast(label+' added as final thrower');}catch(_){}
        }});
      });
    }catch(e){
      info.textContent='Registered players could not be verified from Supabase. Add Player is unavailable.';
      try{console.warn('[SQ] SC-034 player load failed',e);}catch(_){}
    }
  }

`;
menu=replaceOnce(menu,removeFn,addFn+removeFn,'menu add function');

const removeRow=`    addRow(m.body,{ico:'−',label:'Remove Player',desc:'Remove from this game',onClick:function(){m.close(); openRemovePlayerMenu(window.__sqOpenGameMenu106);}});`;
const addRowBlock=`    var addGate=(typeof window.__sqLateJoinStatus==='function')?window.__sqLateJoinStatus():{ok:false,reason:'Add Player is unavailable.'};
    var addPlayerRow=addRow(m.body,{ico:'+',label:'Add Player',desc:addGate.ok?'Join as final thrower':addGate.reason,cls:addGate.ok?'green':'',onClick:function(){m.close();openAddPlayerMenu(window.__sqOpenGameMenu106);}});
    if(!addGate.ok){addPlayerRow.disabled=true;addPlayerRow.setAttribute('aria-disabled','true');}
`+removeRow;
menu=replaceOnce(menu,removeRow,addRowBlock,'menu row');
fs.writeFileSync(menuPath,menu);

const patchManifestPath='src/legacy/intentional-patches.json';
const migrationPath='src/legacy/migration-manifest.json';
const patchManifest=JSON.parse(fs.readFileSync(patchManifestPath,'utf8'));
const migration=JSON.parse(fs.readFileSync(migrationPath,'utf8'));
const extracted=(migration.scripts||[]).find(x=>x.file===menuPath);
if(!extracted||!extracted.sha256)fail('migration authority missing for '+menuPath);
if(!Array.isArray(patchManifest.patches))patchManifest.patches=[];
if(patchManifest.patches.some(x=>x.file===menuPath))fail('intentional patch already registered for '+menuPath);
const sha256=(value)=>crypto.createHash('sha256').update(value).digest('hex');
patchManifest.patches.push({
  file:menuPath,
  originalSha256:extracted.sha256,
  sha256:sha256(menu),
  bytes:Buffer.byteLength(menu,'utf8'),
  task:'SC-034',
  reason:'Add the rules-aligned in-game registered-player late-entry control to the existing Game Menu without creating a parallel roster or navigation system.'
});
fs.writeFileSync(patchManifestPath,JSON.stringify(patchManifest,null,2)+'\n');

console.log('SC-034 deterministic source patch applied.');
