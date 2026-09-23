
// >>> PATCH:START_TOURNAMENT_ROUTE_BLOCKER_GUARD_V2 START
(function(){
  'use strict';
  if (window.__sqStartTournamentRouteBlockerGuardV2) return;
  window.__sqStartTournamentRouteBlockerGuardV2 = true;
  function openTournament(e){
    try{
      if (e){
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      }
    }catch(_){ }
    if (typeof window.__sqOpenTournamentSteppedSetup === 'function') return window.__sqOpenTournamentSteppedSetup();
    try{ if (typeof toast === 'function') toast('Tournament setup is still loading. Try again in a moment.'); }catch(_){ }
  }
  function bind(){
    var b = document.getElementById('tournamentBtn');
    if (!b) return;
    b.disabled = false;
    b.setAttribute('aria-disabled','false');
    b.onclick = openTournament;
  }
  try{ document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('#tournamentBtn') : null;
    if (!b) return;
    return openTournament(e);
  }, true); }catch(_){ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
  setTimeout(bind, 50);
  setTimeout(bind, 250);
  setTimeout(bind, 1000);
})();
// <<< PATCH:START_TOURNAMENT_ROUTE_BLOCKER_GUARD_V2 END
