
(function(){
  if (window.__sqTurbo20TimerPatch) return;
  window.__sqTurbo20TimerPatch = true;
  const LIMIT_MS = 20000;
  let timer = null;
  let raf = null;
  let firing = false;
  function isTurboGame(){
    try{
      const m = (typeof state !== 'undefined' && state) ? (state.match || {}) : {};
      const draft = window.__sqTournamentDraft || state?.__sqTournamentDraft || null;
      const type = String(m.tournamentType || m.type || draft?.type || state?.tournamentType || '').toLowerCase();
      const mode = String(m.mode || m.gameMode || state?.mode || state?.gameMode || '').toLowerCase();
      const variant = String(m.gameVariant || state?.gameVariant || '').toLowerCase();
      const startTarget = String(m.startTarget || state?.startTarget || m.tournamentRules?.startTarget || draft?.rules?.startTarget || '').toLowerCase();
      return !!(type === 'turbo' || variant === 'turbo' || mode === 'turbo' || startTarget === '17' || m.strictTimer === true || m.throwLimitSeconds === 20 || state?.strictTimer === true || state?.throwLimitSeconds === 20);
    }catch(_){ return false; }
  }
  function turboGatePending(){
    try{
      return !!(isTurboGame() && window.__sqTurboPreStartArmed === true && window.__sqTurboPreStartReleased !== true);
    }catch(_){ return false; }
  }
  function gameActive(){
    try{
      return document.body?.dataset?.page === 'game' && typeof state !== 'undefined' && state && !state.finished && !state?.suddenDeath?.active && Array.isArray(state.players) && state.players.length >= 2 && isTurboGame() && !turboGatePending();
    }catch(_){ return false; }
  }
  function turnKey(){
    // Turbo's strict clock is per 3-dart turn, not per individual dart.
    try{ return [state.currentRound,state.currentPlayer].map(v=>String(v ?? '')).join('|'); }catch(_){ return ''; }
  }
  function clearBoxes(){
    try{ document.querySelectorAll('.livev2panel .v2ScoreBox.sqTurboTimerActive,.livev2panel .v2ScoreBox.sqTurboWarn,.livev2panel .v2ScoreBox.sqTurboDanger').forEach(el=>{ el.classList.remove('sqTurboTimerActive','sqTurboWarn','sqTurboDanger'); el.style.removeProperty('--sqTurboDeg'); }); }catch(_){ }
  }
  function activeBox(){
    try{ return document.querySelector('.livev2panel .v2ScoreBox[data-p="'+Number(state?.currentPlayer || 0)+'"]'); }catch(_){ return null; }
  }
  function ensureTimer(){
    if (!gameActive()){ timer = null; clearBoxes(); return; }
    const key = turnKey();
    if (!timer || timer.key !== key) timer = { key, startedAt: performance.now(), fired:false };
  }
  function renderTimer(){
    try{
      if (turboGatePending()) {
        try{ if (document.body?.dataset?.page === 'game' && typeof window.__sqShowTurboReadyGate === 'function') window.__sqShowTurboReadyGate(); }catch(_){}
      }
      ensureTimer();
      if (!timer) return;
      const elapsed = performance.now() - timer.startedAt;
      const pct = Math.max(0, Math.min(1, elapsed / LIMIT_MS));
      const box = activeBox();
      clearBoxes();
      if (box){
        box.style.setProperty('--sqTurboDeg', (pct * 360).toFixed(1) + 'deg');
        box.classList.add('sqTurboTimerActive');
        if (elapsed >= 15000) box.classList.add('sqTurboDanger');
        else if (elapsed >= 10000) box.classList.add('sqTurboWarn');
      }
      if (elapsed >= LIMIT_MS && !timer.fired){ timer.fired = true; autoMissTurn(timer.key); }
    }catch(e){ try{ console.warn('[SQ] turbo timer render failed', e); }catch(_){ } }
  }
  function releaseTurboGate(){
    try{
      if (window.__sqTurboPreStartReleased === true) return;
      window.__sqTurboPreStartReleased = true;
      window.__sqTurboPreStartArmed = false;
      window.__sqTurboPreStartShowing = false;
      timer = null;
      clearBoxes();
      document.querySelectorAll('.sq-turbo-ready-backdrop').forEach(n=>{ try{ n.remove(); }catch(_){} });
      setTimeout(renderTimer, 0);
    }catch(_){ }
  }
  window.__sqReleaseTurboReadyGate = releaseTurboGate;
  window.__sqShowTurboReadyGate = function(){
    try{
      if (!turboGatePending()) return;
      if (document.body?.dataset?.page !== 'game') return;
      if (window.__sqTurboPreStartShowing === true || document.querySelector('.sq-turbo-ready-backdrop')) return;
      window.__sqTurboPreStartShowing = true;
      const bd = document.createElement('div');
      bd.className = 'modal-backdrop sq-turbo-ready-backdrop';
      const modal = document.createElement('div');
      modal.className = 'modal sq-turbo-ready-modal';
      modal.innerHTML = '<div class="sq-turbo-ready-title">TURBO GAME LOADED...</div><div class="sq-turbo-ready-sub">Players Ready?</div><button type="button" class="btn sq-turbo-ready-start">START GAME</button>';
      bd.appendChild(modal);
      document.body.appendChild(bd);
      const start = modal.querySelector('.sq-turbo-ready-start');
      const close = function(){
        if (window.__sqTurboPreStartReleased === true) return;
        releaseTurboGate();
      };
      if (start) start.onclick = function(e){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} close(); };
      bd.addEventListener('click', function(e){ if (e.target === bd) close(); });
      modal.tabIndex = 0;
      setTimeout(function(){ try{ modal.focus(); }catch(_){} }, 0);
    }catch(e){ try{ console.warn('[SQ] Turbo ready gate failed', e); }catch(_){} releaseTurboGate(); }
  };
  function autoMissTurn(key){
    if (firing) return;
    try{
      if (!gameActive() || !timer || timer.key !== key) return;
      const remaining = Math.max(0, 3 - Math.max(0, Math.min(3, Number(state?.currentDart || 0))));
      if (!remaining) return;
      firing = true;
      try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }
      try{ window.__sqDmdBulkMiss = true; }catch(_){ }
      for (let i=0; i<remaining; i++){
        if (state?.finished) break;
        if (typeof window.recordThrow === 'function') window.recordThrow({ kind:'Miss' });
        else if (typeof recordThrow === 'function') recordThrow({ kind:'Miss' });
      }
      setTimeout(()=>{ try{ window.__sqDmdBulkMiss = false; }catch(_){ } }, 120);
    }catch(e){ try{ console.warn('[SQ] turbo auto MISS x3 failed', e); }catch(_){ } }
    finally{ firing = false; timer = null; clearBoxes(); }
  }
  function loop(){ renderTimer(); raf = requestAnimationFrame(loop); }
  try{
    const oldRecordThrow = window.recordThrow || (typeof recordThrow === 'function' ? recordThrow : null);
    if (oldRecordThrow && !oldRecordThrow.__sqTurboWrapped){
      const wrapped = function(){ const ret = oldRecordThrow.apply(this, arguments); setTimeout(renderTimer,0); return ret; };
      wrapped.__sqTurboWrapped = true; window.recordThrow = wrapped; try{ recordThrow = wrapped; }catch(_){ }
    }
  }catch(_){ }
  try{
    const oldUpdateUI = window.updateUI || (typeof updateUI === 'function' ? updateUI : null);
    if (oldUpdateUI && !oldUpdateUI.__sqTurboWrapped){
      const wrappedUI = function(){ const ret = oldUpdateUI.apply(this, arguments); setTimeout(renderTimer,0); return ret; };
      wrappedUI.__sqTurboWrapped = true; window.updateUI = wrappedUI; try{ updateUI = wrappedUI; }catch(_){ }
    }
  }catch(_){ }
  window.__sqTurboTimerStatus = function(){ return { active:gameActive(), turbo:isTurboGame(), turnKey:turnKey(), currentRound:state?.currentRound, currentPlayer:state?.currentPlayer, currentDart:state?.currentDart, timer:timer ? { key:timer.key, elapsedMs:Math.round(performance.now()-timer.startedAt), fired:!!timer.fired } : null }; };
  raf = requestAnimationFrame(loop);
  window.addEventListener('pagehide', ()=>{ try{ cancelAnimationFrame(raf); }catch(_){ } }, { once:true });
})();
