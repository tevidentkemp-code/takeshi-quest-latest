
(function(){
  'use strict';
  if (window.__sqFix170DeciderLeaderboardConfirm) return;
  window.__sqFix170DeciderLeaderboardConfirm = true;

  function text(el){ return String(el && el.textContent || '').replace(/\s+/g,' ').trim().toUpperCase(); }
  function hidden(el){ return !el || el.classList.contains('hidden') || el.style.display === 'none'; }

  function openEndMatchConfirm(onYes){
    document.querySelectorAll('.sq-endmatch-confirm-bd').forEach(function(n){ try{ n.remove(); }catch(_){ } });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop sq-endmatch-confirm-bd';
    var modal = document.createElement('div');
    modal.className = 'modal sq-endmatch-confirm';
    modal.style.maxWidth = '440px';
    modal.innerHTML =
      '<h3>End Match</h3>' +
      '<div class="modal-body">Are you sure you want to end the match completely?</div>' +
      '<div class="modal-footer">' +
        '<button type="button" class="btn sq-endmatch-yes">YES</button>' +
        '<button type="button" class="btn sq-endmatch-no">NO</button>' +
      '</div>';
    bd.appendChild(modal);
    document.body.appendChild(bd);
    function close(){ try{ bd.remove(); }catch(_){ } }
    modal.querySelector('.sq-endmatch-no').onclick = close;
    modal.querySelector('.sq-endmatch-yes').onclick = function(){ close(); try{ if (typeof onYes === 'function') onYes(); }catch(e){ console.error('[SQ] End Match confirm action failed', e); } };
    bd.addEventListener('click', function(e){ if (e.target === bd) close(); });
    bd.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
    modal.tabIndex = 0;
    try{ modal.focus(); }catch(_){ }
  }

  function patchLeaderboardActions(){
    try{
      if (!document.body || document.body.dataset.page !== 'leaderboard') return false;
      var stack = document.querySelector('#leaderboard .stacked-actions');
      if (!stack) return false;

      var next = document.getElementById('sqTournamentNextRoundBtnFix83') || document.getElementById('nextGameBtn');
      var scores = document.getElementById('gameScoresBtn');
      var end = document.getElementById('newMatchBtn');

      if (next && !hidden(next)) {
        next.textContent = 'NEXT GAME ▶';
        next.classList.add('sq-fix170-next-round');
        stack.appendChild(next);
      }
      if (scores) stack.appendChild(scores);

      // SC-047: Match Leaderboard no longer carries a STATS action.
      // Keep the legacy static control out of the visible action stack.
      var statsFinal = document.getElementById('statsHubBtnFinal');
      if (statsFinal) {
        statsFinal.classList.add('hidden');
        statsFinal.style.display = 'none';
      }

      // The game engine owns whether END MATCH is visible. Do not override
      // its FT3/FT5 matchDone decision here; only style/wrap the control once
      // the engine has made it visible on the final leaderboard.
      if (end && !hidden(end)) {
        end.textContent = 'END MATCH';
        end.classList.add('sq-fix170-end-match');
        stack.appendChild(end);

        var current = end.onclick;
        if (typeof current === 'function' && !current.__sqFix170ConfirmWrapper) {
          end.__sqFix170OriginalEndMatch = current;
          var wrapped = function(e){
            try{ if (e) { e.preventDefault(); e.stopPropagation(); } }catch(_){ }
            var original = end.__sqFix170OriginalEndMatch;
            openEndMatchConfirm(function(){ if (typeof original === 'function') original.call(end); });
            return false;
          };
          wrapped.__sqFix170ConfirmWrapper = true;
          end.onclick = wrapped;
        }
      }
      return true;
    }catch(e){
      try{ console.warn('[SQ] Fix170 leaderboard action patch failed', e); }catch(_){ }
      return false;
    }
  }

  var oldShowLeaderboard = window.showLeaderboard || (typeof showLeaderboard === 'function' ? showLeaderboard : null);
  if (typeof oldShowLeaderboard === 'function' && !oldShowLeaderboard.__sqFix170Wrapped) {
    var wrappedShowLeaderboard = function(){
      var ret = oldShowLeaderboard.apply(this, arguments);
      [0, 80, 250, 700].forEach(function(ms){ setTimeout(patchLeaderboardActions, ms); });
      return ret;
    };
    wrappedShowLeaderboard.__sqFix170Wrapped = true;
    window.showLeaderboard = wrappedShowLeaderboard;
    try{ showLeaderboard = wrappedShowLeaderboard; }catch(_){ }
  }

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(patchLeaderboardActions, 0); });
  setInterval(function(){ if (document.body && document.body.dataset.page === 'leaderboard') patchLeaderboardActions(); }, 500);
  try{ console.info('[SQ] Fix170 Decider input and leaderboard End Match confirmation active.'); }catch(_){ }
})();
