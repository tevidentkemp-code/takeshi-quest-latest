
(function(){
  if (window.__sqFix75TournamentStartRunner) return;
  window.__sqFix75TournamentStartRunner = true;

  try{
    if (typeof startNewGame === 'function' && !startNewGame.__sqTournamentStartWrapped){
      const __sqOriginalStartNewGame = startNewGame;
      startNewGame = function(setOrder){
        const ret = __sqOriginalStartNewGame.apply(this, arguments);
        try{
          const m = state && state.match ? state.match : {};
          const rules = (m && (m.tournamentRules || m.rules)) || {};
          const turboLike = String(m.gameVariant || state?.gameVariant || '').toLowerCase() === 'turbo'
            || String(m.mode || m.gameMode || state?.mode || state?.gameMode || '').toLowerCase() === 'turbo'
            || String(m.startTarget || rules.startTarget || state?.startTarget || '').toLowerCase() === '17';
          const rawStartIdx = Number.isFinite(+rules.startRoundIndex)
            ? +rules.startRoundIndex
            : (Number.isFinite(+m.startRoundIndex) ? +m.startRoundIndex : (turboLike ? 7 : 0));
          const startIdx = Math.max(0, Math.min((typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS - 1 : 13), rawStartIdx));
          if (setOrder && startIdx > 0){
            state.currentRound = startIdx;
            state.currentPlayer = 0;
            state.currentDart = 0;
            if (turboLike) {
              window.__sqTurboPreStartArmed = true;
              window.__sqTurboPreStartReleased = false;
              window.__sqTurboPreStartShowing = false;
              window.__sqTurboPreStartToken = String(state?.__gameToken || '') + '|' + String(Date.now());
              [80, 240, 600].forEach(function(ms){
                setTimeout(function(){ try{ if (typeof window.__sqShowTurboReadyGate === 'function') window.__sqShowTurboReadyGate(); }catch(_){} }, ms);
              });
            }
            if (m.tournament) state.__sqTournamentTurboTimer = rules.strictTimer ? { seconds:Number(rules.throwLimitSeconds || 20), strict:true, pending:true } : null;
            try{ save(); }catch(_){}
            setTimeout(function(){ try{ updateUI(); }catch(_){} }, 0);
          }
        }catch(e){ console.warn('[SQ] Tournament starting round apply failed', e); }
        return ret;
      };
      startNewGame.__sqTournamentStartWrapped = true;
    }
  }catch(e){ console.warn('[SQ] Tournament start wrapper failed', e); }
})();
