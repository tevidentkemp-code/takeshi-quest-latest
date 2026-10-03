/* SC-004: network authority around the canonical engine, never another scorer. */
(function(){
  'use strict';
  let transport;
  const completions=new Map();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const current=()=>typeof state!=='undefined'?state:window.state;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function client(){
    if(transport) return transport;
    const cfg=window.SQ_SECURITY_CONFIG||{};
    const base=cfg.supabaseUrl||(typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:'');
    const key=cfg.publicKey||(typeof SUPABASE_ANON!=='undefined'?SUPABASE_ANON:'');
    transport=window.createSc004Client({endpoint:cfg.endpoint||base+'/functions/v1/sq-match-control',publicKey:key,
      storage:localStorage,getAdminToken:async()=>window.SQ_ADMIN_AUTH?.getToken(),
      allowLocalFixture:cfg.allowLocalFixture===true});
    return transport;
  }
  function notice(message,error){
    let el=document.getElementById('sqSecurityStatus');
    if(!el){el=document.createElement('div');el.id='sqSecurityStatus';el.className='cloud-status';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:900000;background:var(--card,#171a2b);padding:12px;border:1px solid var(--warning,#ffcc66);border-radius:8px;font-size:13px';document.body.appendChild(el);}
    el.textContent=message;el.hidden=!message;
    if(error) console.warn('[SQ] secure persistence',error.code||error.message);
  }
  function failure(error){
    const code=String(error?.code||error?.message||'');
    const msg=/controller|required|denied|expired/.test(code)?'Match recovery needs valid control authority. Your board is preserved; retry after reconnecting or contact the owner.':/held/.test(code)?'Saving is temporarily held. Your completed board and pending save are preserved. Retry Finish Game when service resumes.':/cache|pending_payload/.test(code)?'Recovery storage is unavailable or another save is pending. Your board is preserved; retry Finish Game before starting another game.':'Cloud save unavailable. Your board and pending save are preserved. Retry Finish Game when connected.';
    notice(msg,error);try{if(typeof toast==='function')toast(msg);}catch(_){}
    return error;
  }
  function realIndexes(st){return(st.players||[]).map((p,i)=>({p,i})).filter(({p})=>!(p?.isShadow||p?.virtual||p?.shadow||p?.shadowId||p?.type==='shadow')).map(x=>x.i);}
  function mode(st){
    if(String(st.match?.practiceType||'').toLowerCase()==='vsshadow')return'vs_shadow';
    return typeof __sqComputeGameMode==='function'?__sqComputeGameMode():'practice';
  }
  function roster(st,display=false){return realIndexes(st).map(i=>{const p=st.players[i];let id=p.id||p.player_id;
    if(!UUID.test(id||'')&&typeof __sqFindSavedPlayerMetaByName==='function'){const saved=__sqFindSavedPlayerMetaByName(p.name);id=saved?.id||saved?.player_id;}
    const item=UUID.test(id||'')?{id,name:String(p.name||'').trim()}:{name:String(p.name||'').trim()};
    if(display)for(const key of ['initials','avatar_id','nickname','display_name'])if(p[key]!==undefined&&p[key]!==null)item[key]=p[key];
    return item;});}
  function rules(st){
    const out={};const m=st.match||{};
    for(const k of ['gameFormat','gameVariant','tournament','tournamentType','tournamentRules','strictTimer','throwLimitSeconds','startTarget']){
      const value=m[k]??st[k];if(value!==undefined&&value!==null)out[k]=clone(value);
    }
    return out;
  }
  function updateMatchReceipt(st,receipt){
    st.match.id=receipt.match_id;st.match.securityVersion=1;st.match.__sqRoster=receipt.roster;
    st.match.__sqControllerMode=receipt.mode||st.match.__sqControllerMode;
    if(receipt.recovery==='memory_only')notice('Match control is available only in this tab because storage is unavailable. Keep this tab open until the game is saved.');
  }
  async function syncRoster(players){
    const st=current();const m=st.match||{};
    if(!m.securityVersion||!client().hasController(m.id))throw new window.Sc004Error('controller_required');
    const snapshot={...st,players:players||st.players};
    const result=await client().command('update_roster',m.id,{roster:roster(snapshot,true)});
    m.__sqRoster=result.roster;m.__sqControllerMode=result.mode;
    if(st.__sqGameControl)st.__sqGameControl.roster=clone(result.roster);
    return result;
  }
  async function updateDisplay(index,fields){
    const st=current();if(!Number.isInteger(index)||!realIndexes(st).includes(index)||!fields||Object.keys(fields).some(k=>!['initials','avatar_id','nickname','display_name'].includes(k)))throw new window.Sc004Error('invalid_display_patch');
    const players=clone(st.players);Object.assign(players[index],fields);
    window.__sqSecurityInputBlocked=true;
    try{await syncRoster(players);st.players[index]=players[index];if(typeof save==='function')save();if(typeof updateUI==='function')updateUI();return players[index];}
    catch(error){throw failure(error);}
    finally{window.__sqSecurityInputBlocked=false;}
  }
  async function prepareNewGame(){
    const st=current();if(st.__sqSecurityPreparing)throw new window.Sc004Error('preparation_in_flight');
    if((st.__sqCompletionSnapshot&&!st.__sqAcceptedGameReceipt)||client().pendingCompletions().some(x=>x.match_id===st.match?.id))throw failure(new window.Sc004Error('pending_completion_required'));
    st.__sqSecurityPreparing=true;window.__sqSecurityInputBlocked=true;
    try{
      const gameMode=mode(st);const m=st.match||(st.match={});
      const series=gameMode!=='vs_shadow'&&(m.mode==='match'||m.gameFormat==='match_play'||Number(m.targetWins)>1||m.tournament===true);
      const previous=st.__sqGameControl;
      const separate=!series&&['practice','vs_shadow'].includes(gameMode)&&previous&&st.__sqAcceptedGameReceipt?.game_id===previous.game_id;
      if(!m.securityVersion||separate){
        if(!m.__sqInitiationKey||separate)m.__sqInitiationKey=crypto.randomUUID();
        try{if(typeof save==='function')save();}catch(_){}
        const issued=await client().createMatch({mode:gameMode,roster:roster(st),target_wins:[1,3,5].includes(Number(m.targetWins))?Number(m.targetWins):1,match_format:series?'series':'single',rules:rules(st)},m.__sqInitiationKey);
        updateMatchReceipt(st,issued);m.__sqServerSingle=!series;
      }else{
        if(!client().hasController(m.id))throw new window.Sc004Error('controller_required');
        await client().command('renew',m.id);
        await syncRoster();
      }
      const number=m.__sqServerSingle?1:Math.max(1,(m.history||[]).length+1);
      const slot=await client().command('reserve_game',m.id,{game_number:number});
      if(slot.status!=='pending')throw new window.Sc004Error('accepted_game_immutable');
      st.__sqGameControl={match_id:m.id,game_id:slot.game_id,game_number:slot.game_number,mode:m.__sqControllerMode,roster:clone(m.__sqRoster)};
      delete st.__sqAcceptedGameReceipt;delete st.__sqCompletionSnapshot;
      try{if(typeof save==='function')save();}catch(_){}
      return slot;
    }catch(error){throw failure(error);}
    finally{st.__sqSecurityPreparing=false;window.__sqSecurityInputBlocked=false;}
  }
  async function resume(){
    const st=current();const control=st.__sqGameControl;
    if(!control||!client().hasController(control.match_id))throw failure(new window.Sc004Error('controller_required'));
    try{
      const receipt=await client().command('resume',control.match_id);
      const slot=(receipt.games||[]).find(x=>x.game_id===control.game_id);
      if(!slot||slot.status==='cleaned')throw new window.Sc004Error('game_recovery_denied');
      if(slot.status==='completed'){st.__sqAcceptedGameReceipt=slot.receipt||{game_id:slot.game_id,match_id:control.match_id};}
      await client().command('renew',control.match_id);
      return receipt;
    }catch(error){throw failure(error);}
  }
  const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
  async function recoverLegacy(settings){
    const st=current(),m=st.match||{};
    if(m.securityVersion||!UUID.test(m.id||'')||String(m.practiceType||'').toLowerCase()==='vsshadow')throw new window.Sc004Error('legacy_recovery_denied');
    if(st.__sqAwardInFlight||st.__sqSecurityPreparing)throw new window.Sc004Error('preparation_in_flight');
    await window.SQ_ADMIN_AUTH.require();
    const before=clone(st),receipt=await client().recoverLegacyMatch(m.id,settings);
    if(current()!==st||canonical(st.score)!==canonical(before.score)||canonical(st.players)!==canonical(before.players))throw new window.Sc004Error('recovery_board_changed');
    const cached=realIndexes(st).map(i=>st.players[i]),issued=receipt.roster||[];
    if(cached.length!==issued.length||cached.some(p=>!issued.some(q=>String(p.name||'').trim().toLowerCase()===String(q.name||'').trim().toLowerCase()&&(!UUID.test(p.id||p.player_id||'')||String(p.id||p.player_id).toLowerCase()===String(q.id||'').toLowerCase()))))throw new window.Sc004Error('legacy_roster_mismatch');
    if(canonical(m.history||[])!==canonical(receipt.history||[])||issued.some((p,i)=>{const index=cached.findIndex(q=>String(q.name||'').trim().toLowerCase()===String(p.name||'').trim().toLowerCase());return Number(m.wins?.[index]||0)!==Number(receipt.wins?.[i]||0);}))throw new window.Sc004Error('legacy_history_mismatch');
    if(Number(receipt.game_number)!==(receipt.history||[]).length+1||!['official','practice','turbo'].includes(receipt.mode)||![1,3,5].includes(Number(receipt.target_wins)))throw new window.Sc004Error('legacy_scope_mismatch');
    updateMatchReceipt(st,receipt);m.__sqServerSingle=receipt.match_format==='single';m.targetWins=receipt.target_wins;m.gameNumber=receipt.game_number;
    st.__sqGameControl={match_id:receipt.match_id,game_id:receipt.game_id,game_number:receipt.game_number,mode:receipt.mode,roster:clone(receipt.roster)};
    delete st.__sqAcceptedGameReceipt;delete st.__sqCompletionSnapshot;
    if(typeof save==='function')save();await resume();return receipt;
  }
  function offerLegacyRecovery(){
    const st=current(),m=st?.match||{};if(m.securityVersion||!UUID.test(m.id||''))return;
    const status=document.getElementById('sqSecurityStatus');if(!status||status.querySelector('[data-sq-owner-recovery]'))return;
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='OWNER RECOVERY';button.dataset.sqOwnerRecovery='1';
    button.onclick=async()=>{
      try{await window.SQ_ADMIN_AUTH.require();}catch(error){failure(error);return;}
      const settings={target_wins:[1,3,5].includes(Number(m.targetWins))?Number(m.targetWins):1,mode:mode(st),rules:rules(st)};
      if(!['official','practice','turbo'].includes(settings.mode)){notice('This legacy mode needs owner review. Your board remains preserved.');return;}
      const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.id='sqLegacyRecovery';
      const modal=document.createElement('div');modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.style.maxWidth='420px';
      const title=document.createElement('h3');title.textContent='Recover unfinished match';
      const body=document.createElement('div');body.className='modal-body';
      const summary=document.createElement('p');summary.textContent='Match '+m.id+' · '+settings.mode.toUpperCase()+' · first to '+settings.target_wins+' wins. The server must verify the saved participants, history and wins. Your current board stays intact.';
      const label=document.createElement('label'),confirm=document.createElement('input');confirm.type='checkbox';confirm.id='sqLegacyRecoveryConfirmed';label.append(confirm,document.createTextNode(' I confirm this match mode, rules and target wins.'));
      const provenance=document.createElement('pre');provenance.style.whiteSpace='pre-wrap';provenance.textContent=JSON.stringify(settings.rules,null,2);
      const error=document.createElement('p');error.setAttribute('role','status');
      const footer=document.createElement('div');footer.className='modal-footer';
      const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='Cancel';cancel.onclick=()=>overlay.remove();
      const recover=document.createElement('button');recover.className='btn primary';recover.textContent='RECOVER MATCH';recover.disabled=true;confirm.onchange=()=>{recover.disabled=!confirm.checked;};
      recover.onclick=async()=>{recover.disabled=true;try{await recoverLegacy(settings);overlay.remove();if(typeof show==='function')show('game');if(typeof buildEverythingChunked==='function')await buildEverythingChunked();if(typeof updateUI==='function')updateUI();notice('Owner recovery verified. Your board is preserved.');}catch(e){error.textContent='Recovery could not be verified: '+String(e.code||e.message)+'. Your cached board is preserved.';recover.disabled=false;}};
      body.append(summary,provenance,label,error);footer.append(cancel,recover);modal.append(title,body,footer);overlay.append(modal);document.body.appendChild(overlay);confirm.focus();
    };status.appendChild(button);
  }
  function canThrow(){const st=current();return !window.__sqSecurityInputBlocked&&!!st.__sqGameControl&&client().hasController(st.__sqGameControl.match_id)&&!st.__sqAcceptedGameReceipt&&!st.__sqCompletionSnapshot;}
  function canDiscard(){const st=current();if(st.__sqAwardInFlight||(st.__sqCompletionSnapshot&&!st.__sqAcceptedGameReceipt)||client().pendingCompletions().some(x=>x.match_id===st.match?.id)){notice('A completed game is awaiting acceptance. Retry Finish Game before resetting or ending this match.');return false;}return true;}
  async function saveGoEvents(st,receipt){
    const indexes=realIndexes(st);const history=st.history||[];
    for(const i of indexes){const player=st.players[i];const id=player.id||player.player_id;if(!UUID.test(id||''))continue;
      for(let round=0;round<14;round++){
        const entries=history.filter(x=>x.player===i&&x.round===round&&x.recorded_at&&Number.isInteger(x.dartIndex));
        if(!entries.length)continue;
        const body={game_id:receipt.game_id,player_id:id,round_number:round+1,go_number:1,started_at:entries[0].recorded_at,ended_at:entries.at(-1).recorded_at};
        try{await client().logGo(receipt.match_id,body);}catch(error){notice('Game accepted; turn history is queued for retry when connected.',error);}
      }
    }
  }
  async function completeCurrentGame(canonicalPayload){
    const st=current();const control=st.__sqGameControl;if(!control)throw failure(new window.Sc004Error('controller_required'));
    if(st.__sqAcceptedGameReceipt?.game_id===control.game_id)return st.__sqAcceptedGameReceipt;
    if(completions.has(control.game_id))return completions.get(control.game_id);
    const job=(async()=>{
      try{
        await client().command('renew',control.match_id);
        await syncRoster();
        const body=st.__sqCompletionSnapshot||(typeof canonicalPayload==='function'?canonicalPayload():canonicalPayload)||__sqBuildCompletedGamePayload();st.__sqCompletionSnapshot=clone(body);
        const historyState={players:clone(st.players),history:clone(st.history||[])};
        const receipt=await client().completeGame(control.match_id,body);
        st.__sqAcceptedGameReceipt=receipt;
        try{if(typeof save==='function')save();}catch(_){}
        try{window.__sqClearGamesTruthCache?.('secure-completion');}catch(_){}
        notice('');void saveGoEvents(historyState,receipt);
        return receipt;
      }catch(error){throw failure(error);}
      finally{completions.delete(control.game_id);}
    })();completions.set(control.game_id,job);return job;
  }
  async function abandon(){
    const st=current();const control=st.__sqGameControl;if(!control)return;
    if(client().pendingCompletions().some(x=>x.game_id===control.game_id))throw failure(new window.Sc004Error('pending_completion_required'));
    if(!st.__sqAcceptedGameReceipt){await client().command('cleanup_game',control.match_id,{game_id:control.game_id});
      if(!(st.match?.history||[]).length)await client().command('cleanup_match',control.match_id);}
    delete st.__sqGameControl;
  }
  window.SQ_SECURITY=Object.freeze({ready:async()=>client(),createPlayer:body=>client().createPlayer(body),admin:body=>client().admin(body),recoverLegacyMatch:(...args)=>client().recoverLegacyMatch(...args),command:(...args)=>client().command(...args),completeGame:(...args)=>client().completeGame(...args),pendingCompletions:()=>client().pendingCompletions(),createTraining:(...args)=>client().createTraining(...args),completeTraining:(...args)=>client().completeTraining(...args),retryTraining:id=>client().retryTraining(id),pendingTraining:()=>client().pendingTraining(),visit:body=>client().visit(body),retryCompletion:id=>client().retryCompletion(id)});
  window.SQ_GAMEPLAY=Object.freeze({prepareNewGame,resume,recoverLegacy,offerLegacyRecovery,canThrow,canDiscard,syncRoster,updateDisplay,completeCurrentGame,abandon,failure,notice});
  async function retryPending(){
    for(const item of client().pendingCompletions()){
      const receipt=await client().retryCompletion(item.game_id);const st=current();
      if(st.__sqGameControl?.game_id===receipt.game_id){st.__sqAcceptedGameReceipt=receipt;if(st.finished&&!st.gameAwarded&&typeof awardAndShowLeaderboard==='function')await awardAndShowLeaderboard();}
    }
    for(const item of client().pendingTraining())await client().retryTraining(item.training_id);
    await client().retryGoEvents();notice('Pending saves accepted.');
  }
  window.SQ_RETRY_PENDING=()=>retryPending().catch(failure);
  function pendingNotice(){try{if(client().pendingCompletions().length||client().pendingTraining().length){notice('A completed game or training session is queued for recovery.');const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='RETRY SAVE';button.onclick=window.SQ_RETRY_PENDING;document.getElementById('sqSecurityStatus').appendChild(button);}}catch(_){} }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pendingNotice,{once:true});else setTimeout(pendingNotice,0);
  let renewing=false;
  async function heartbeat(){
    if(renewing||navigator.onLine===false)return;renewing=true;
    try{
      const st=current(),control=st?.__sqGameControl;
      if(control&&client().hasController(control.match_id))await client().command('renew',control.match_id);
      const training=window.__sqTrainingControl;if(training)await client().command('renew_training',training.training_id);
    }catch(error){notice('Control renewal is unavailable. Your current board/session is preserved.',error);}
    finally{renewing=false;}
  }
  if(typeof window.setInterval==='function')window.setInterval(heartbeat,60*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void heartbeat();});
  window.addEventListener('online',()=>{void heartbeat();try{void client().retryGoEvents().catch(error=>notice('Turn history remains queued.',error));}catch(_){} });
})();
