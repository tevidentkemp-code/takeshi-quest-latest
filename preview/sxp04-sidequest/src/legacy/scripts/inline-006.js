
(function(){
  function wireSettings(btnId, menuId, actions){
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if(!btn || !menu) return;

    function close(){ menu.classList.add('hidden'); btn.setAttribute('aria-expanded','false'); }
    function open(){ menu.classList.remove('hidden'); btn.setAttribute('aria-expanded','true'); }
    function toggle(){ (menu.classList.contains('hidden') ? open() : close()); }

    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });

    menu.addEventListener('click', (e)=>{
      const item = e.target.closest('[data-sq-action]');
      if(!item) return;
      const key = item.getAttribute('data-sq-action');
      const targetBtnId = actions[key];
      const targetBtn = targetBtnId ? document.getElementById(targetBtnId) : null;
      if(targetBtn){ targetBtn.click(); }
      close();
    });

    document.addEventListener('click', (e)=>{
      if(menu.classList.contains('hidden')) return;
      if(e.target.closest('#'+menuId) || e.target.closest('#'+btnId)) return;
      close();
    });

    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape') close();
    });

    close();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // >>> PATCH:game_settings_modal_v1 START
    (function(){
      const btn = document.getElementById('settingsBtnGame');
      if(!btn) return;

      function mkBackdrop(){
        const bd = document.createElement('div');
        bd.className = 'modal-backdrop';
        bd.style.zIndex = '9999';
        return bd;
      }

      function mkModal(title){
        const m = document.createElement('div');
        m.className = 'modal';
        m.style.maxWidth = '520px';
        m.style.width = 'min(92vw, 520px)';
        m.innerHTML = `
          <div class="modal-title">${title}</div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:10px"></div>
          <div class="modal-actions" style="display:flex;gap:12px;justify-content:center;margin-top:14px">
            <button class="btn" data-x="close">Close</button>
          </div>
        `;
        return m;
      }

      function closeAny(){
        document.querySelectorAll('.sq-gsettings-bd,.sq-rmplayer-bd').forEach(n=>n.remove());
      }

      function confirmThen(msg, fn){
        if(confirm(msg)) {
          try{ fn(); }
          catch(e){ console.error(e); if(typeof toast==='function') toast('Action failed'); }
        }
      }

      function resetCurrentGameKeepPlayers(){
        // Keep players + match meta/history, reset only current game state
        try{ if (typeof __sqSanitizeVsShadowForGenericStart === 'function') __sqSanitizeVsShadowForGenericStart('settings-reset-current-game'); }catch(_){ }
        const players = Array.isArray(state.players) ? state.players.slice() : [];
        const match   = state.match ? JSON.parse(JSON.stringify(state.match)) : JSON.parse(JSON.stringify(baseState.match));
        state = JSON.parse(JSON.stringify(baseState));
        state.players = players;
        state.match = match;
        state.score = players.map(()=>[]);
        state.currentRound = 0;
        state.currentPlayer = 0;
        state.currentDart = 0;
        state.history = [];
        state.finished = false;
      }

      function doRestartGame(){
        resetCurrentGameKeepPlayers();
        save();
        if(typeof startNewGame === 'function') startNewGame();
        else restartGameSafe();
      }

      function doEndGame(){
        // Abandon current game and go to leaderboard/next match screen
        resetCurrentGameKeepPlayers();
        save();
        if(typeof showLeaderboard === 'function') showLeaderboard();
        else _showPageSafe('leaderboard');
      }

      function doEndMatch(){
        confirmThen('End match? This will clear the current match state and return to the start screen.', ()=>{
          state = JSON.parse(JSON.stringify(baseState));
          save();
          navigateToStartScreen();
        });
      }

      function openRemovePlayer(){
        closeAny();
        const bd = mkBackdrop();
        bd.classList.add('sq-rmplayer-bd');
        const m  = mkModal('Remove player');
        const body = m.querySelector('.modal-body');

        const pls = Array.isArray(state.players) ? state.players : [];
        pls.forEach((p, idx)=>{
          const name = (__sqPlayerPretty(p) || p.name || ('Player ' + (idx+1)));
          const b = document.createElement('button');
          b.className = 'btn danger';
          b.textContent = 'Remove ' + name;
          b.onclick = ()=>{
            confirmThen('Remove ' + name + '? Their current-game data will be deleted and the match continues.', ()=>{
              state.players.splice(idx,1);
              if(Array.isArray(state.score)) state.score.splice(idx,1);
              if(state.match && Array.isArray(state.match.wins)) state.match.wins.splice(idx,1);
              if(state.currentPlayer >= state.players.length) state.currentPlayer = 0;
              save();
              closeAny();
              try{ liveV2Render(); }catch(_e){}
            });
          };
          body.appendChild(b);
        });

        m.querySelector('[data-x=close]').onclick = closeAny;
        bd.addEventListener('click', (e)=>{ if(e.target===bd) closeAny(); });
        document.body.appendChild(bd);
        bd.appendChild(m);
      }

      function openMenu(){
        closeAny();
        const bd = mkBackdrop();
        bd.classList.add('sq-gsettings-bd');
        const m  = mkModal('Game menu');
        const body = m.querySelector('.modal-body');

        function addBtn(label, cls, onClick){
          const b = document.createElement('button');
          b.className = 'btn ' + (cls||'');
          b.textContent = label;
          b.onclick = ()=>{ closeAny(); onClick(); };
          body.appendChild(b);
        }

        addBtn('Restart Game', 'danger', ()=>confirmThen('Restart game? This clears current game data and returns to throw order.', doRestartGame));
        addBtn('End Game', 'danger', ()=>confirmThen('End game? Current game data will be cleared and you will go to the end-game screen.', doEndGame));
        addBtn('End Match', 'danger', doEndMatch);
        addBtn('Remove player', '', openRemovePlayer);
        addBtn('Stats', '', openStatsHubSafe);

        m.querySelector('[data-x=close]').onclick = closeAny;
        bd.addEventListener('click', (e)=>{ if(e.target===bd) closeAny(); });
        document.body.appendChild(bd);
        bd.appendChild(m);
      }

      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation();
        // Prefer the single canonical in-game menu (FIX106) so the two menu
        // systems can never stack; only fall back to this older one if it's absent.
        if (typeof window.__sqOpenGameMenu106 === 'function') return window.__sqOpenGameMenu106();
        openMenu();
      });
    })();
    // >>> PATCH:game_settings_modal_v1 END

    wireSettings('settingsBtnLB','settingsMenuLB',{
      startScreenLB: 'startScreenBtnLB',
      restartGameLB: 'restartGameBtnLB'
    });
  });
})();

// >>> PATCH:admin-password-enforce START
(function(){
  function enforce(){
    try{
      if (typeof window.openAdminPasswordModal === 'function'){
        const b = document.getElementById('adminCodeBtn');
        if (b) b.onclick = window.openAdminPasswordModal;
      }
      if (typeof window.openAdminHub === 'function' && typeof window.openAdminPasswordModal === 'function'){
        // If something overwrote the gated wrapper, re-wrap now.
        if (!window.openAdminHub.__sqIsGated && window.__openAdminHubUnsafe){
          const unsafe = window.__openAdminHubUnsafe;
          window.openAdminHub = function(){
            if (window.__sqAdminAuthed) return unsafe();
            return window.openAdminPasswordModal();
          };
          window.openAdminHub.__sqIsGated = true;
        }
      }
    }catch(_e){}
  }
  document.addEventListener('DOMContentLoaded', enforce);
  window.addEventListener('load', enforce);
})();
// >>> PATCH:admin-password-enforce END

