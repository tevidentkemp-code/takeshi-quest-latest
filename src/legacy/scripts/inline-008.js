
// [removed: openRoundHighScoresDialog_v82 IIFE] audit P5.3 batch 4 — shadowed by v85 then the fix100 canonical path; its exports (__rhsHolderTicker, openRoundHighScoresDialog) are re-exported later

// [removed: openRoundHighScoresDialog_v85 IIFE (PATCH:ROUND_HIGH_SCORES_MERGE_PBGR_V86)] audit P5.3 batch 5 — its window.openRoundHighScoresDialog export is shadowed by the canonical Fix97 def, which the Fix102 wrapper captures; no _v85 helper or __rhsHolderTicker reference exists outside the block. Correction to batch 4 note: the LIVE getPBGRSnapshot is the PBGR_ADMIN_SCHEMA_FALLBACK_V2 def (last write), not this block.

/* >>> PATCH:PLAYER_HUB_GATE_V1 START */
(function(){
  if (window.__sqPlayerHubPatchLoaded) return;
  window.__sqPlayerHubPatchLoaded = true;

  function __sqToast(msg){
    try { if (typeof toast === 'function') return toast(msg); } catch(_){}
    try { console.log(msg); } catch(_){}
  }

  function __sqPwStore(){
    try { return JSON.parse(localStorage.getItem('sq_playerhub_passwords') || '{}') || {}; }
    catch(_){ return {}; }
  }
  function __sqSetPwStore(obj){
    try { localStorage.setItem('sq_playerhub_passwords', JSON.stringify(obj || {})); } catch(_){}
  }
  function __sqPlayerPwKey(p){
    if (!p) return '';
    var id = (p.id != null && String(p.id).trim()) ? ('id:' + String(p.id).trim()) : '';
    if (id) return id;
    return 'name:' + String(p.name || '').trim().toLowerCase();
  }
  function __sqPlayerDefaultPw(p){
    var key = __sqPlayerPwKey(p);
    var map = __sqPwStore();
    return String(map[key] || '1111');
  }

  async function __sqListPlayersForHub(){
    var rows = [];
    try {
      if (typeof cloudListPlayers === 'function'){
        var cloud = await cloudListPlayers(true);
        (cloud || []).forEach(function(p){
          if (!p || !p.name) return;
          rows.push({
            id: (p.id != null ? String(p.id).trim() : null),
            name: String(p.name),
            first_name: (p.first_name != null ? String(p.first_name) : ''),
            last_name: (p.last_name != null ? String(p.last_name) : ''),
            nickname: (p.nickname != null ? String(p.nickname) : ''),
            initials: (p.initials != null ? String(p.initials) : ''),
            avatar_id: p.avatar_id ?? null
          });
        });
      }
    } catch(err){
      console.error('PLAYER HUB cloudListPlayers failed', err);
    }

    if (!rows.length && typeof getSavedPlayers === 'function'){
      try{
        (getSavedPlayers() || []).forEach(function(p){
          if (!p || !p.name) return;
          rows.push({
            id: (p.id != null ? String(p.id).trim() : null),
            name: String(p.name),
            first_name: (p.first_name != null ? String(p.first_name) : ''),
            last_name: (p.last_name != null ? String(p.last_name) : ''),
            nickname: (p.nickname != null ? String(p.nickname) : ''),
            initials: (p.initials != null ? String(p.initials) : ''),
            avatar_id: p.avatar_id ?? null
          });
        });
      }catch(err){
        console.error('PLAYER HUB getSavedPlayers failed', err);
      }
    }

    rows.sort(function(a,b){
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return rows;
  }

  function __sqBuildPlayerLabel(p){
    if (!p) return '';
    var nick = String(p.nickname || '').trim();
    return nick ? (String(p.name) + ' — "' + nick + '"') : String(p.name);
  }

  function __sqOpenPlayerProfileEditor(player, openerOverlay){
    if (!player) return;
    if (openerOverlay) openerOverlay.style.display = 'none';

    var overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.id = 'playerHubEditorOverlay';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '520px';
    modal.style.width = 'min(94vw, 520px)';

    var title = document.createElement('h3');
    title.textContent = 'PLAYER HUB';

    var sub = document.createElement('div');
    sub.className = 'muted';
    sub.style.textAlign = 'center';
    sub.style.marginTop = '-6px';
    sub.style.marginBottom = '10px';
    sub.textContent = String(player.name || '');

    var body = document.createElement('div');
    body.className = 'modal-body';
    body.style.display = 'grid';
    body.style.gap = '10px';

    function mkField(labelText, value){
      var wrap = document.createElement('label');
      wrap.style.display = 'grid';
      wrap.style.gap = '6px';

      var lab = document.createElement('div');
      lab.className = 'muted';
      lab.textContent = labelText;

      var input = document.createElement('input');
      input.type = 'text';
      input.value = value || '';

      wrap.append(lab, input);
      return { wrap: wrap, input: input };
    }

    var firstF = mkField('First name', player.first_name || '');
    var lastF  = mkField('Last name', player.last_name || '');
    var nickF  = mkField('Nickname', player.nickname || '');
    var passF  = mkField('Password', __sqPlayerDefaultPw(player));
    passF.input.type = 'password';
    passF.input.inputMode = 'numeric';
    passF.input.maxLength = 12;
    passF.input.placeholder = '1111';

    var note = document.createElement('div');
    note.className = 'muted';
    note.style.fontSize = '.86rem';
    note.textContent = 'Profile edits update avatar, first name, last name, nickname and Player Hub password. Historic player name key stays intact.';

    body.append(sub, firstF.wrap, lastF.wrap, nickF.wrap, passF.wrap, note);
    overlay.appendChild(body);
    __sqEnhancePlayerHubAvatarEditor(overlay, player);

    var footer = document.createElement('div');
    footer.className = 'modal-footer';

    var backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.textContent = 'Back';
    backBtn.onclick = function(){
      overlay.remove();
      if (openerOverlay){
        openerOverlay.style.display = '';
        try{ openerOverlay.querySelector('.modal') && openerOverlay.querySelector('.modal').focus(); }catch(_){}
      }
    };

    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn primary';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async function(){
      var first = String(firstF.input.value || '').trim();
      var last  = String(lastF.input.value  || '').trim();
      var nick  = String(nickF.input.value  || '').trim();
      var pass  = String(passF.input.value  || '').trim() || '1111';
      if (!first){ __sqToast('First name required'); return; }

      var fullName = (typeof __sqBuildFullName === 'function')
        ? __sqBuildFullName(first, last)
        : [first, last].filter(Boolean).join(' ').trim();
      var init = (typeof __sqNormalizeInitials === 'function')
        ? __sqNormalizeInitials('', fullName)
        : fullName.split(/\s+/).map(function(x){ return x ? x.charAt(0).toUpperCase() : ''; }).join('').slice(0,2);

      try{
        var id = player.id;
        var nmOld = player.name;
        if (!id && nmOld && typeof cloudResolvePlayerKeyByName === 'function'){
          var key = await cloudResolvePlayerKeyByName(nmOld);
          id = key && key.id ? key.id : null;
        }
        if (!id){
          __sqToast('Save failed: missing player id');
          return;
        }

        if (typeof cloudUpdatePlayerProfile === 'function'){
          await cloudUpdatePlayerProfile({ id: id, name: nmOld }, {
            first_name: first,
            last_name: last,
            nickname: nick,
            initials: init,
            avatar_id: Number(overlay.dataset.sqAvatarId)
          });
        } else {
          throw new Error('cloudUpdatePlayerProfile not available');
        }

        try {
          if (typeof cloudUpdatePlayerInitials === 'function'){
            await cloudUpdatePlayerInitials({ id: id, name: nmOld }, init);
          }
        } catch(_){}

        try {
          var pwMap = __sqPwStore();
          pwMap[__sqPlayerPwKey(player)] = pass;
          __sqSetPwStore(pwMap);
        } catch(_){}

        try { if (typeof syncSavedPlayersFromCloud === 'function') await syncSavedPlayersFromCloud(); } catch(_){}
        try { document.dispatchEvent(new Event('sq:savedPlayersUpdated')); } catch(_){}
        __sqToast('Profile saved');
        overlay.remove();
        if (openerOverlay) openerOverlay.remove();
      }catch(err){
        console.error(err);
        var msg = (err && (err.message || err.details)) ? String(err.message || err.details) : '';
        if (/duplicate key|unique/i.test(msg)) __sqToast('Save failed: name already exists');
        else __sqToast(msg || 'Save failed');
      }
    };

    var delBtn = document.createElement('button');
    delBtn.className = 'btn danger';
    delBtn.textContent = 'Delete Profile';
    delBtn.onclick = async function(){
      var nmOld = player.name;
      if (!nmOld){ __sqToast('Invalid player'); return; }

      try{
        var inCurrent = (state && Array.isArray(state.players))
          ? state.players.some(function(pl){ return pl && typeof _normName === 'function' ? _normName(pl.name) === _normName(nmOld) : String(pl.name||'').trim().toLowerCase() === String(nmOld||'').trim().toLowerCase(); })
          : false;
        var gameStarted = !!(state && ((state.currentRound||0) > 0 || (state.history && state.history.length)));
        if (inCurrent && gameStarted){
          __sqToast('Finish/reset the current game before deleting this player.');
          return;
        }
      }catch(_){}

      if (!confirm('Delete ' + String(player.name || 'this player') + '?')) return;
      try{
        if (typeof cloudDeletePlayer === 'function'){
          await cloudDeletePlayer(player.id ? { id: player.id, name: player.name } : player.name);
        } else {
          throw new Error('cloudDeletePlayer not available');
        }
        try { if (typeof removePlayerFromLocalCache === 'function') removePlayerFromLocalCache(player.name); } catch(_){}
        try { if (typeof syncSavedPlayersFromCloud === 'function') await syncSavedPlayersFromCloud(); } catch(_){}
        try { document.dispatchEvent(new Event('sq:savedPlayersUpdated')); } catch(_){}
        __sqToast('Profile deleted');
        overlay.remove();
        if (openerOverlay) openerOverlay.remove();
      }catch(err){
        console.error(err);
        __sqToast('Delete failed');
      }
    };

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = function(){ overlay.remove(); if (openerOverlay) openerOverlay.remove(); };
    footer.append(backBtn, closeBtn, saveBtn, delBtn);
    modal.append(title, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.tabIndex = 0;
    modal.focus();

    overlay.addEventListener('click', function(e){
      if (e.target === overlay){
        overlay.remove();
        if (openerOverlay) openerOverlay.remove();
      }
    });
    overlay.addEventListener('keydown', function(e){
      if (e.key === 'Escape'){
        overlay.remove();
        if (openerOverlay) openerOverlay.remove();
      }
    });
  }

  async function __sqOpenPlayerHubGate(){
    var players = await __sqListPlayersForHub();
    if (!players.length){
      __sqToast('No saved players');
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.id = 'playerHubGateOverlay';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '420px';
    modal.style.width = 'min(94vw, 420px)';

    var title = document.createElement('h3');
    title.textContent = 'PLAYER HUB';

    var body = document.createElement('div');
    body.className = 'modal-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '12px';
    body.style.alignItems = 'center';

    var selectWrap = document.createElement('label');
    selectWrap.style.display = 'grid';
    selectWrap.style.gap = '6px';
    selectWrap.style.width = '100%';

    var selectLab = document.createElement('div');
    selectLab.className = 'muted';
    selectLab.textContent = 'Player';

    var select = document.createElement('select');
    select.id = 'playerHubSelect';
    select.innerHTML = '<option value="">Select a player...</option>';
    players.forEach(function(p, i){
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = __sqBuildPlayerLabel(p);
      select.appendChild(opt);
    });
    selectWrap.append(selectLab, select);

    var hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = 'Default password is 1111';

    var display = document.createElement('div');
    display.setAttribute('aria-live', 'polite');
    display.style.width = '100%';
    display.style.maxWidth = '240px';
    display.style.minHeight = '52px';
    display.style.padding = '12px 14px';
    display.style.borderRadius = '12px';
    display.style.border = '1px solid #2b3050';
    display.style.background = '#101329';
    display.style.color = '#e7e9f5';
    display.style.textAlign = 'center';
    display.style.fontSize = '1.25rem';
    display.style.fontWeight = '800';
    display.style.letterSpacing = '.35em';
    display.style.fontVariantNumeric = 'tabular-nums';
    display.style.boxSizing = 'border-box';

    var error = document.createElement('div');
    error.style.minHeight = '18px';
    error.style.fontSize = '.9rem';
    error.style.color = '#ff6b6b';
    error.style.textAlign = 'center';

    var pad = document.createElement('div');
    pad.style.display = 'grid';
    pad.style.gridTemplateColumns = 'repeat(3, minmax(68px, 1fr))';
    pad.style.gap = '10px';
    pad.style.width = '100%';
    pad.style.maxWidth = '240px';

    var code = '';

    function refresh(){
      display.textContent = code.length ? Array(code.length).fill('•').join(' ') : '—';
    }
    function chosenPlayer(){
      var idx = String(select.value || '').trim();
      if (idx === '') return null;
      return players[Number(idx)] || null;
    }
    function clearCode(){
      code = '';
      error.textContent = '';
      refresh();
    }
    function close(){
      overlay.remove();
    }
    function submit(){
      var p = chosenPlayer();
      if (!p){ error.textContent = 'Select a player'; clearCode(); return; }
      if (code === __sqPlayerDefaultPw(p)){
        overlay.style.display = 'none';
        __sqOpenPlayerProfileEditor(p, overlay);
      } else {
        error.textContent = 'Incorrect password';
        code = '';
        refresh();
      }
    }
    function pushDigit(d){
      if (!chosenPlayer()){ error.textContent = 'Select a player'; return; }
      error.textContent = '';
      if (code.length >= 4) return;
      code += String(d);
      refresh();
      if (code.length === 4) submit();
    }
    function mkKey(label, fn, cls){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cls || 'btn';
      b.textContent = label;
      b.style.minHeight = '54px';
      b.style.fontSize = '1.05rem';
      b.onclick = fn;
      return b;
    }

    ['1','2','3','4','5','6','7','8','9'].forEach(function(n){
      pad.appendChild(mkKey(n, function(){ pushDigit(n); }));
    });
    pad.appendChild(mkKey('Clear', function(){ clearCode(); }));
    pad.appendChild(mkKey('0', function(){ pushDigit('0'); }));
    pad.appendChild(mkKey('⌫', function(){
      code = code.slice(0,-1);
      error.textContent = '';
      refresh();
    }));

    var footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.justifyContent = 'center';

    var returnBtn = document.createElement('button');
    returnBtn.className = 'btn';
    returnBtn.textContent = 'Return';
    returnBtn.onclick = close;

    footer.append(returnBtn);
    body.append(selectWrap, hint, display, error, pad);
    modal.append(title, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.tabIndex = 0;
    modal.focus();
    refresh();

    select.addEventListener('change', clearCode);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', function(e){
      if (e.key === 'Escape'){ close(); return; }
      if (/^[0-9]$/.test(e.key)){ pushDigit(e.key); return; }
      if (e.key === 'Backspace'){ code = code.slice(0,-1); error.textContent=''; refresh(); return; }
      if (e.key === 'Enter' && code.length === 4){ submit(); }
    });
  }

  function __sqLooksLikePlayerHub(el){
    if (!el) return false;
    var id = String(el.id || '').toLowerCase();
    var txt = String(el.textContent || '').trim().toLowerCase();
    return id === 'playerhubbtn' || txt === 'player hub';
  }

  function __sqWirePlayerHubButtons(){
    var ids = ['playerHubBtn','playerHubButton'];
    ids.forEach(function(id){
      var b = document.getElementById(id);
      if (b){
        b.onclick = function(e){
          if (e){ e.preventDefault && e.preventDefault(); e.stopPropagation && e.stopPropagation(); }
          __sqOpenPlayerHubGate();
        };
      }
    });
  }

  function __sqInterceptPlayerHub(){
    if (window.__sqPlayerHubInterceptBound) return;
    window.__sqPlayerHubInterceptBound = true;
    document.addEventListener('click', function(e){
      var el = e.target && e.target.closest ? e.target.closest('button,a,.sq-navBtn') : null;
      if (!__sqLooksLikePlayerHub(el)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      __sqOpenPlayerHubGate();
    }, true);
  }

  function __sqBootPlayerHub(){
    __sqWirePlayerHubButtons();
    __sqInterceptPlayerHub();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', __sqBootPlayerHub, { once:true });
  } else {
    __sqBootPlayerHub();
  }
  window.addEventListener('load', __sqBootPlayerHub);
  setTimeout(__sqBootPlayerHub, 250);
  setTimeout(__sqBootPlayerHub, 1200);

  window.openPlayerHubGate = __sqOpenPlayerHubGate;
})();
/* <<< PATCH:PLAYER_HUB_GATE_V1 END */

/* >>> PATCH:C1_SKIP_SETTINGS_SPLIT_V2_JS START */
(function(){
  if (window.__sqPadSettingsInsertedV2) return;
  window.__sqPadSettingsInsertedV2 = true;

  function norm(el){
    return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function findPadBtn(labels){
    var btns = Array.from(document.querySelectorAll('#padBar button, .pad-bar button, #pad button'));
    return btns.find(function(b){
      var t = norm(b);
      return labels.some(function(lbl){ return t === lbl || t.indexOf(lbl) !== -1; });
    }) || null;
  }

  function triggerGameSettings(){
    try{
      var menu = document.getElementById('settingsMenuGame');
      if (menu){
        var hidden = menu.classList.contains('hidden') || getComputedStyle(menu).display === 'none';
        if (hidden) menu.classList.remove('hidden');
        else menu.classList.add('hidden');
        return;
      }
    }catch(_){}

    try{
      var btn = document.getElementById('settingsBtnGame');
      if (btn) return btn.click();
    }catch(_){}

    try{
      if (typeof window.openGameSettingsMenu === 'function') return window.openGameSettingsMenu();
    }catch(_){}
  }

  function buildBtn(){
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'settingsBtnGamePad';
    b.className = 'btn';
    b.setAttribute('aria-label', 'Settings');
    b.title = 'Settings';
    b.textContent = '☰'; b.textContent = '☰';
    b.onclick = function(e){
      if (e){
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
      }
      triggerGameSettings();
    };
    return b;
  }

  function applyLayout(){
    var miss = findPadBtn(['MISS']);
    var undo = findPadBtn(['UNDO']);
    var skip = findPadBtn(['SKIP']);
    if (!miss || !undo || !skip) return false;

    var row = skip.parentElement;
    if (!row) return false;

    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
    row.style.gap = '8px';
    row.style.alignItems = 'stretch';

    [miss, undo, skip].forEach(function(btn){
      btn.style.width = '100%';
      btn.style.minWidth = '0';
    });

    // SXP-04: Settings moved to the Live V2 quick rail. Keep the Throwpad
    // action row to three normal-size controls: MISS / UNDO / SKIP.
    var settings = document.getElementById('settingsBtnGamePad');
    if (settings) settings.remove();
    return true;
  }

  function boot(){
    if (!(document.body && document.body.dataset && document.body.dataset.page === 'game')) return;
    applyLayout();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
  setInterval(boot, 1000);
})();
/* <<< PATCH:C1_SKIP_SETTINGS_SPLIT_V2_JS END */

/* >>> PATCH:C1_SETTINGS_BUTTON_ACTION_V1 START */
(function(){
  if (window.__sqPadSettingsActionPatched) return;
  window.__sqPadSettingsActionPatched = true;

  function ensureOverlayMenu(){
    var existing = document.getElementById('settingsMenuGamePadOverlay');
    if (existing) return existing;

    var wrap = document.createElement('div');
    wrap.id = 'settingsMenuGamePadOverlay';
    wrap.className = 'modal-backdrop hidden';

    var card = document.createElement('div');
    card.className = 'modal';
    card.style.maxWidth = '320px';
    card.style.width = 'min(88vw, 320px)';

    var title = document.createElement('h3');
    title.textContent = 'Settings';

    var body = document.createElement('div');
    body.className = 'modal-body';
    body.style.display = 'grid';
    body.style.gap = '8px';

    function mk(label, onClick){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sq-settings-item';
      b.textContent = label;
      b.onclick = function(e){
        e.preventDefault();
        e.stopPropagation();
        try { wrap.classList.add('hidden'); } catch(_){}
        onClick && onClick();
      };
      return b;
    }

    body.append(
      mk('Player Hub', function(){
        try{
          if (typeof window.openPlayerHubGate === 'function') return window.openPlayerHubGate();
        }catch(_){}
      }),
      mk('Stats', function(){
        try{
          var b = document.getElementById('statsHubBtnGame');
          if (b) return b.click();
        }catch(_){}
      }),
      mk('League & Ranks', function(){
        try{
          var b = document.getElementById('leagueHubBtn') || document.getElementById('leagueHubBtnHome');
          if (b) return b.click();
        }catch(_){}
      })
    );

    var footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.justifyContent = 'center';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn';
    close.textContent = 'Close';
    close.onclick = function(){
      wrap.classList.add('hidden');
    };
    footer.appendChild(close);

    card.append(title, body, footer);
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function(e){
      if (e.target === wrap) wrap.classList.add('hidden');
    });

    return wrap;
  }

  function openSettingsFromPad(){
    try{
      var nativeBtn = document.getElementById('settingsBtnGame');
      if (nativeBtn){
        nativeBtn.click();
        var nativeMenu = document.getElementById('settingsMenuGame');
        if (nativeMenu) {
          nativeMenu.classList.remove('hidden');
          return;
        }
      }
    }catch(_){}

    try{
      var nativeMenu = document.getElementById('settingsMenuGame');
      if (nativeMenu){
        nativeMenu.classList.toggle('hidden');
        return;
      }
    }catch(_){}

    ensureOverlayMenu().classList.remove('hidden');
  }

  function patchPadButton(){
    var b = document.getElementById('settingsBtnGamePad');
    if (!b) return false;
    b.textContent = '☰';
    b.setAttribute('aria-label', 'Settings');
    b.title = 'Settings';
    b.onclick = function(e){
      if (e){
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
      }
      openSettingsFromPad();
    };
    return true;
  }

  function boot(){
    patchPadButton();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
  setInterval(boot, 1500);
})();
/* <<< PATCH:C1_SETTINGS_BUTTON_ACTION_V1 END */

/* >>> PATCH:C1_SETTINGS_ICON_FORCE_V1_JS START */
(function(){
  if (window.__sqForcePadSettingsIconLoaded) return;
  window.__sqForcePadSettingsIconLoaded = true;

  function forceIcon(){
    var b = document.getElementById('settingsBtnGamePad');
    if (!b) return false;
    b.textContent = '☰';
    b.setAttribute('aria-label', 'Settings');
    b.title = 'Settings';
    return true;
  }

  function boot(){
    forceIcon();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  setTimeout(boot, 200);
  setTimeout(boot, 800);
  setTimeout(boot, 1600);
  setInterval(boot, 1200);
})();
/* <<< PATCH:C1_SETTINGS_ICON_FORCE_V1_JS END */

/* >>> PATCH:C1_THROWPAD_HARD_SCALE_V2_JS START */
(function(){
  if (window.__sqThrowPadHardScaleLoaded) return;
  window.__sqThrowPadHardScaleLoaded = true;

  function norm(el){
    return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function findPadButtons(){
    return Array.from(document.querySelectorAll('#padBar button, .pad-bar button, #scorePad button, #pad button'));
  }

  function hardStyle(btn, size, weight, lineHeight){
    if (!btn) return;
    btn.style.fontSize = size + 'px';
    btn.style.fontWeight = String(weight);
    btn.style.lineHeight = String(lineHeight || 1.1);
    btn.style.letterSpacing = '.03em';
  }

  function boot(){
    if (!(document.body && document.body.dataset && document.body.dataset.page === 'game')) return;
    var btns = findPadButtons();
    if (!btns.length) return;

    btns.forEach(function(btn){
      var t = norm(btn);

      if (btn.id === 'settingsBtnGamePad' || t === '☰' || t === '≡'){
        hardStyle(btn, 28, 900, 1);
        btn.textContent = '☰';
        btn.title = 'Settings';
        btn.setAttribute('aria-label', 'Settings');
        return;
      }

      if (t === 'S' || t === 'D' || t === 'T'){
        hardStyle(btn, 22, 800, 1);
        return;
      }

      if (t.indexOf('MISS X') === 0 || t.indexOf('MISS ×') === 0 || t.replace(/\s+/g,'').indexOf('MISSX') === 0){
        hardStyle(btn, 20, 800, 1.05);
        return;
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  setTimeout(boot, 250);
  setTimeout(boot, 800);
  setTimeout(boot, 1600);
  setInterval(boot, 1200);
})();
/* <<< PATCH:C1_THROWPAD_HARD_SCALE_V2_JS END */


/* >>> PATCH:LEAGUE_RANKS_GAMES_TRUTH_V1 START
   High Score League + Top 50 now derive from official games history first.
   This avoids stale high_scores/high_score_league/top50 views becoming UI truth.
*/
(function(){
  if (window.__sqLeagueRanksGamesTruthV1) return;
  window.__sqLeagueRanksGamesTruthV1 = true;

  function esc(v){
    try{ if (typeof window.escapeHtml === 'function') return window.escapeHtml(String(v == null ? '' : v)); }catch(_){}
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); });
  }

  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }

  function parseTime(v){
    try{
      if (typeof parseMs === 'function'){
        var ms = parseMs(v);
        if (Number.isFinite(ms)) return ms;
      }
    }catch(_){}
    var t = Date.parse(v || '');
    return Number.isFinite(t) ? t : 0;
  }

  function fmtWhen(ts){
    try{
      var ms = parseTime(ts);
      if (!ms) return '';
      var d = new Date(ms);
      var dd = String(d.getDate()).padStart(2,'0');
      var mm = String(d.getMonth()+1).padStart(2,'0');
      var yy = String(d.getFullYear()).slice(-2);
      var hh = String(d.getHours()).padStart(2,'0');
      var mi = String(d.getMinutes()).padStart(2,'0');
      return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
    }catch(_){ return ''; }
  }

  function playerName(p){
    if (p == null) return '';
    if (typeof p === 'string') return p.trim();
    return String(p.name || p.player || p.player_name || p.display_name || p.nick || '').trim();
  }

  function playersOfGame(g){
    var ps = g && (g.players || (g.state && g.state.players));
    return Array.isArray(ps) ? ps : [];
  }

  function boardOfGame(g){
    return g && (g.board || (g.state && g.state.board) || (g.score || (g.state && g.state.score)));
  }

  function roundScore(ent){
    if (ent == null) return 0;
    if (typeof ent === 'number') return Number(ent) || 0;
    if (typeof ent === 'string') return Number(ent) || 0;
    var keys = ['roundTotal','round_total','points','score','total','val','value'];
    for (var i=0;i<keys.length;i++){
      var n = Number(ent[keys[i]]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (Array.isArray(ent.darts)){
      return ent.darts.reduce(function(a,d){ return a + (Number(d && (d.points ?? d.score ?? d.val ?? d.value) || 0) || 0); }, 0);
    }
    return 0;
  }

  function rowsForPlayer(board, pi){
    if (!Array.isArray(board)) return [];
    if (Array.isArray(board[pi])) return board[pi];
    if (Array.isArray(board[0]) && board[0][pi] != null){
      return board.map(function(r){ return Array.isArray(r) ? r[pi] : null; });
    }
    return [];
  }

  function totalFromBoard(board, pi){
    var rows = rowsForPlayer(board, pi);
    if (!Array.isArray(rows)) return 0;
    var n = 0;
    for (var i=0;i<rows.length;i++) n += roundScore(rows[i]);
    return n;
  }

  function totalFromTotals(g, pi){
    try{
      var totals = g && (g.totals || (g.state && g.state.totals));
      if (Array.isArray(totals)){
        var v = totals[pi];
        if (typeof v === 'number') return Number(v) || 0;
        if (v && typeof v === 'object'){
          var n = Number(v.total ?? v.score ?? v.points ?? v.val);
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
      if (totals && typeof totals === 'object'){
        var ps = playersOfGame(g);
        var name = norm(playerName(ps[pi]));
        var raw = totals[name] ?? totals[playerName(ps[pi])] ?? totals[String(pi)];
        var m = Number(raw && typeof raw === 'object' ? (raw.total ?? raw.score ?? raw.points ?? raw.val) : raw);
        if (Number.isFinite(m) && m > 0) return m;
      }
    }catch(_){}
    return 0;
  }

  function isOfficialGame(g){
    try {
      if (typeof window.__sqGameModeKey === 'function') return window.__sqGameModeKey(g) === 'official';
    } catch(_) {}
    var ps = playersOfGame(g);
    if (ps.length < 2) return false;
    var mode = String((g && (g.mode || g.game_mode || g.type || (g.state && (g.state.mode || g.state.game_mode || g.state.type)))) || '').toLowerCase();
    if (mode.indexOf('practice') >= 0 || mode.indexOf('unofficial') >= 0 || mode === 'solo') return false;
    if (g && (g.is_practice === true || g.practice === true || g.single_player === true)) return false;
    return true;
  }

  async function listSavedPlayerNames(){
    try{
      var saved = (typeof cloudListPlayers === 'function') ? await cloudListPlayers() : [];
      return new Set((saved || []).map(function(p){ return norm(playerName(p)); }).filter(Boolean));
    }catch(_){ return new Set(); }
  }

  async function fetchGames(){
    try{
      if (typeof cloudFetchAllGamesAsLocal === 'function'){
        var g = await cloudFetchAllGamesAsLocal();
        if (Array.isArray(g) && g.length) return g;
      }
    }catch(e){ try{ console.warn('[SQ] League games truth cloudFetchAllGamesAsLocal failed', e && (e.message || e)); }catch(_){} }

    var client = window.sb || (typeof sb !== 'undefined' ? sb : null);
    if (!client || !client.from) return [];
    var res = await client.from('games').select('id,created_at,state,totals,match_id,game_number,finished,mode').order('created_at', { ascending:false }).limit(100000);
    if (res.error) throw res.error;
    return (res.data || []).map(function(r){
      return {
        id:r.id,
        ts:r.created_at,
        created_at:r.created_at,
        state:r.state || {},
        players:r.state && r.state.players,
        board:r.state && (r.state.board || r.state.score),
        totals:r.totals || (r.state && r.state.totals),
        match_id:r.match_id,
        game_number:r.game_number,
        finished:r.finished,
        mode:r.mode || (r.state && r.state.mode),
        raw:r
      };
    });
  }

  async function computeOfficialPlayerGameRows(){
    var games = await fetchGames();
    var rows = [];
    for (var gi=0; gi<(games || []).length; gi++){
      var g = games[gi];
      if (!isOfficialGame(g)) continue;
      var ps = playersOfGame(g);
      var board = boardOfGame(g);
      for (var pi=0; pi<ps.length; pi++){
        var name = playerName(ps[pi]);
        if (!name) continue;
        var score = totalFromTotals(g, pi) || totalFromBoard(board, pi);
        if (!(score > 0)) continue;
        rows.push({
          player:name,
          playerKey:norm(name),
          score:score,
          avg_round:score / 14,
          ts:g.ts || g.created_at || (g.raw && g.raw.created_at) || '',
          game_id:g.id || g.game_id || '',
          game:g
        });
      }
    }
    rows.sort(function(a,b){
      return (b.score - a.score) || (parseTime(b.ts) - parseTime(a.ts)) || String(a.player).localeCompare(String(b.player));
    });
    return rows;
  }

  window.__sqComputeOfficialPlayerGameRows = computeOfficialPlayerGameRows;

// [removed: openHighScoreLeagueDialog games-truth def] audit P5.3 batch 3 — shadowed by later canonical definition

// [removed: openTop50ScoresDialog games-truth def] audit P5.3 batch 3 — shadowed by later canonical definition
})();
/* <<< PATCH:LEAGUE_RANKS_GAMES_TRUTH_V1 END */

/* >>> PATCH:LATEST_SCORES_PRACTICE_COMPLETED_CACHE_V2 START */
(function(){
  if (window.__sqPracticeCompletedCacheV2) return;
  window.__sqPracticeCompletedCacheV2 = true;
  var CACHE_KEY = 'sq_recent_completed_games_cache_v2';
  var MAX_AGE_MS = 24 * 60 * 60 * 1000;
  function safeParse(raw){ try { var v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch(_) { return []; } }
  function nowIso(){ try { return new Date().toISOString(); } catch(_) { return ''; } }
  function getTs(g){ return g && (g.ts || g.created_at || g.inserted_at || (g.state && (g.state.ts || g.state.created_at))); }
  function normName(p){ if (p == null) return ''; if (typeof p === 'string') return p.trim(); return String(p.name || p.player || p.player_name || p.playerName || p.id || p.player_id || '').trim(); }
  function gameKey(g){
    var ps = (Array.isArray(g && g.players) ? g.players : (Array.isArray(g && g.state && g.state.players) ? g.state.players : [])).map(normName).filter(Boolean).join('|');
    var totals = Array.isArray(g && g.totals) ? g.totals : (Array.isArray(g && g.state && g.state.totals) ? g.state.totals : []);
    var id = String(g && (g.id || g.game_id || g.sheet_id) || '');
    // Local cache ids are generated per trigger, so using them prevents de-dupe.
    if (id && !/^recent-/i.test(id)) return 'cloud:' + id;
    var mode = String(g && (g.mode || (g.state && g.state.mode)) || '').toLowerCase();
    var board = Array.isArray(g && g.board) ? g.board : (Array.isArray(g && g.state && g.state.board) ? g.state.board : []);
    var boardKey = '';
    try{ boardKey = JSON.stringify(board); }catch(_){ boardKey = String(board && board.length || ''); }
    return ['local', mode, ps, totals.join('|'), boardKey].join('::');
  }
  function readCache(){ return []; }
  function writeCache(rows){ return; }
  function addGameToCache(g){ return; }
  window.__sqGetRecentCompletedGamesCache = function(){ return []; };
  // Phase 1 Fix60: completed-game local cache retired from active reads/writes.
  // Supabase games + canonical adapter are now the truth; this legacy key remains only for manual inspection.
  window.__sqCacheCompletedGameFromState = function(extra){
    // Phase 1 Fix60: no completed games are written to localStorage.
    // Recovery cache is not completed-game truth; Supabase games rows are authoritative.
    return null;
  };
  // Phase 1 Fix60: do not wrap recordFullGameToSupabase for local completed-game cache writes.
})();
/* <<< PATCH:LATEST_SCORES_PRACTICE_COMPLETED_CACHE_V2 END */


/* >>> PATCH:PRACTICE_AUTOSAVE_TO_GAMES_V1 START
   Solo/practice completion must persist to TABLE_GAMES immediately.
   Reason: practice completion opens Game Complete but does not always pass through
   awardAndShowLeaderboard()/Finish Game, so Latest Scores had no games-row truth. */
(function(){
  if (window.__sqPracticeAutosaveGamesV1) return;
  window.__sqPracticeAutosaveGamesV1 = true;
  // >>> PATCH:practice-save-v3-disable-legacy-v1 START
  // V2/V3 direct practice save is now the authority. The older V1 wrapper sets
  // state.__sqPracticeSavedToGames before the direct insert path and can cause
  // back-to-back practice games to be skipped. Keep the marker set, but do not
  // install the legacy autosave wrappers.
  return;
  // <<< PATCH:practice-save-v3-disable-legacy-v1 END

  function isPracticeNow(){
    try{
      if (typeof __sqComputeGameMode === 'function') return __sqComputeGameMode() === 'practice';
      return !!(state && Array.isArray(state.players) && state.players.length === 1);
    }catch(_){ return false; }
  }

  function canAutosavePractice(){
    try{
      if (typeof __sqVsShadowCompletionBlocked === 'function' && __sqVsShadowCompletionBlocked()) return false;
      return !!(
        state &&
        state.finished === true &&
        isPracticeNow() &&
        Array.isArray(state.players) &&
        state.players.length >= 1 &&
        !state.__sqPracticeSavedToGames
      );
    }catch(_){ return false; }
  }

  function cachePracticeSnapshot(ts){
    // Phase 1 Fix60: no local completed-game cache writes.
    return null;
  }

  var rawRecord = null;
  try{
    rawRecord = (typeof window.recordFullGameToSupabase === 'function')
      ? window.recordFullGameToSupabase
      : (typeof recordFullGameToSupabase === 'function' ? recordFullGameToSupabase : null);
  }catch(_){ rawRecord = null; }

  async function autosavePracticeGame(){
    if (!canAutosavePractice()) return;
    if (!rawRecord) return;

    var ts = new Date().toISOString();
    state.__sqPracticeSavedToGames = true;
    window.__sqPracticeAutosavingNow = true;
    cachePracticeSnapshot(ts);

    try{
      await rawRecord(ts);
      try{ console.info('[SQ] Practice game saved to games table'); }catch(_){ }
    }catch(e){
      // Allow another attempt if the cloud write failed.
      try{ state.__sqPracticeSavedToGames = false; }catch(_){ }
      try{ console.error('[SQ] Practice autosave to games failed', e); }catch(_){ }
    }finally{
      window.__sqPracticeAutosavingNow = false;
    }
  }

  // Prevent duplicate cloud rows if the user later presses Finish Game / Leaderboard
  // after the practice autosave has already succeeded.
  if (rawRecord && !rawRecord.__sqPracticeDedupWrapped){
    var wrappedRecord = async function(createdAtOverride){
      try{
        if (!window.__sqPracticeAutosavingNow && isPracticeNow() && state && state.__sqPracticeSavedToGames){
          cachePracticeSnapshot(createdAtOverride || new Date().toISOString());
          return null;
        }
      }catch(_){ }
      return rawRecord.apply(this, arguments);
    };
    wrappedRecord.__sqPracticeDedupWrapped = true;
    try{ window.recordFullGameToSupabase = wrappedRecord; }catch(_){ }
    try{ recordFullGameToSupabase = wrappedRecord; }catch(_){ }
  }

  try{
    if (typeof openGameCompleteDialog === 'function' && !openGameCompleteDialog.__sqPracticeAutosaveWrapped){
      var oldOpenGameCompleteDialog = openGameCompleteDialog;
      var wrappedOpenGameCompleteDialog = function(){
        var ret = oldOpenGameCompleteDialog.apply(this, arguments);
        try{ setTimeout(autosavePracticeGame, 80); }catch(_){ }
        return ret;
      };
      wrappedOpenGameCompleteDialog.__sqPracticeAutosaveWrapped = true;
      openGameCompleteDialog = wrappedOpenGameCompleteDialog;
      try{ window.openGameCompleteDialog = wrappedOpenGameCompleteDialog; }catch(_){ }
    }
  }catch(_){ }

  // Safety: if a future completion path bypasses openGameCompleteDialog, catch the
  // first UI update after state.finished flips true.
  try{
    if (typeof updateUI === 'function' && !updateUI.__sqPracticeAutosaveWrapped){
      var oldUpdateUI = updateUI;
      updateUI = function(){
        var ret = oldUpdateUI.apply(this, arguments);
        try{ if (canAutosavePractice()) setTimeout(autosavePracticeGame, 120); }catch(_){ }
        return ret;
      };
      updateUI.__sqPracticeAutosaveWrapped = true;
      try{ window.updateUI = updateUI; }catch(_){ }
    }
  }catch(_){ }
})();
/* <<< PATCH:PRACTICE_AUTOSAVE_TO_GAMES_V1 END */

/* >>> PATCH:PRACTICE_CLOUD_SAVE_V2 START
   Purpose:
   - Latest Scores Practice was showing local/recent cached games, while Supabase.games had no practice rows.
   - This writes solo/practice completions directly to TABLE_GAMES with an explicit practice payload.
   - It runs before the older V1 autosave delay, and marks the state as saved to avoid duplicate legacy writes. */
(function(){
  if (window.__sqPracticeCloudSaveV2) return;
  window.__sqPracticeCloudSaveV2 = true;

  function isPracticeState(){
    try{
      if (typeof __sqVsShadowCompletionBlocked === 'function' && __sqVsShadowCompletionBlocked()) return false;
      if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) return false;
      if (!window.state || !Array.isArray(state.players) || !state.players.length) return false;
      if (typeof __sqComputeGameMode === 'function') return __sqComputeGameMode() === 'practice';
      if (state.match && (state.match.mode === 'practice' || state.match.forcePractice === true)) return true;
      return state.players.length === 1;
    }catch(_){ return false; }
  }

  function isCompleteEnough(){
    try{
      if (!window.state || !Array.isArray(state.players) || !state.players.length) return false;
      if (state.finished === true || state.gameAwarded === true || state.__sqGameCompleteOpen === true) return true;
      var rounds = (typeof roundsCount === 'function') ? roundsCount() : (Array.isArray(state.score && state.score[0]) ? state.score[0].length : 0);
      var board = Array.isArray(state.score) ? state.score : [];
      if (state.players.length === 1 && Array.isArray(board[0]) && rounds && board[0].filter(function(x){ return x != null; }).length >= rounds) return true;
      return false;
    }catch(_){ return false; }
  }

  function playerRows(){
    try{
      var players = (typeof __sqRealPlayersOnly === 'function') ? __sqRealPlayersOnly(state.players || []) : (state.players || []);
      return players.map(function(p){ return { name: String((p && p.name) || '').trim() }; }).filter(function(p){ return !!p.name; });
    }catch(_){ return []; }
  }

  function totalsNow(){
    try{
      var players = state.players || [];
      var totals = players.map(function(_, i){
        if (typeof totalScoreForPlayer === 'function') return Number(totalScoreForPlayer(i) || 0);
        var rows = Array.isArray(state.score && state.score[i]) ? state.score[i] : [];
        return rows.reduce(function(a,r){
          if (typeof r === 'number') return a + (Number(r)||0);
          if (!r || typeof r !== 'object') return a;
          return a + (Number(r.roundTotal ?? r.round_total ?? r.score ?? r.points ?? r.total ?? 0) || 0);
        }, 0);
      });
      return (typeof __sqRealOnlyTotals === 'function') ? __sqRealOnlyTotals(totals, players) : totals;
    }catch(_){ return []; }
  }

  function cloneBoard(){
    try{
      return (typeof __sqRealOnlyBoard === 'function')
        ? __sqRealOnlyBoard(state.score || [], state.players || [])
        : JSON.parse(JSON.stringify(state.score || []));
    }catch(_){ return []; }
  }

  function cacheSnapshot(ts, payload){
    // Phase 1 Fix60: no local completed-game cache writes. Supabase games row is truth.
    return null;
  }

  function completedPracticeKey(players, totals, board){
    try{
      var names = (players || []).map(function(p){ return String((p && p.name) || '').trim().toLowerCase(); }).join('|');
      var totalStr = (totals || []).map(function(x){ return Number(x)||0; }).join('|');
      var boardStr = JSON.stringify(board || []);
      var token = (window.state && state.__gameToken != null) ? String(state.__gameToken) : '';
      return ['practice-v3', token, names, totalStr, boardStr].join('::');
    }catch(_){
      return 'practice-v3::' + Date.now() + '::' + Math.random().toString(36).slice(2,8);
    }
  }

  async function savePracticeToGames(){
    var saveKey = '';
    try{
      if (!isPracticeState() || !isCompleteEnough()) return null;
      if (typeof sb === 'undefined' || !sb || typeof sb.from !== 'function'){
        try{ console.info('[SQ] Practice cloud save V3 skipped: Supabase unavailable'); }catch(_){ }
        return null;
      }

      var players = playerRows();
      if (!players.length) return null;
      var totals = totalsNow();
      var board = cloneBoard();
      saveKey = completedPracticeKey(players, totals, board);

      // Dedupe only the exact same completed game. Do not let stale boolean flags
      // from a previous practice completion block the next game.
      if (state.__sqPracticeSaveInFlightKeyV2 === saveKey){
        try{ console.info('[SQ] Practice cloud save V3 skipped: same game save already in flight'); }catch(_){ }
        return null;
      }
      if (state.__sqPracticeSavedKeyV2 === saveKey){
        try{ console.info('[SQ] Practice cloud save V3 skipped: exact completed game already saved'); }catch(_){ }
        return null;
      }
      if ((state.__sqPracticeCloudSavedV2 || state.__sqPracticeSavedToGames) && state.__sqPracticeSavedKeyV2 !== saveKey){
        try{ console.info('[SQ] Practice cloud save V3 continuing: stale saved flags belonged to previous practice game'); }catch(_){ }
        try{
          delete state.__sqPracticeCloudSavedV2;
          delete state.__sqPracticeSavedToGames;
          delete state.__sqPracticeSaveMatchIdV2;
        }catch(_){ }
      }

      var ts = new Date().toISOString();
      var table = (typeof TABLE_GAMES !== 'undefined' && TABLE_GAMES) ? TABLE_GAMES : 'games';
      var matchTable = (typeof TABLE_MATCHES !== 'undefined' && TABLE_MATCHES) ? TABLE_MATCHES : 'matches';
      var practiceMatchId = ((typeof crypto !== 'undefined' && crypto && crypto.randomUUID) ? crypto.randomUUID() : ('practice-' + Date.now() + '-' + Math.random().toString(36).slice(2,8)));

      state.__sqPracticeSaveInFlightV2 = true;
      state.__sqPracticeSaveInFlightKeyV2 = saveKey;
      state.__sqPracticeSaveMatchIdV2 = practiceMatchId;

      // Mark the current exact game as guarded before the async insert to stop
      // duplicate wrappers from saving the same board twice. If insert fails,
      // the catch block removes this key so retry remains possible.
      state.__sqPracticeSavedKeyV2 = saveKey;
      state.__sqPracticeCloudSavedV2 = true;
      state.__sqPracticeSavedToGames = true;

      state.match = Object.assign({}, state.match || {}, {
        id: practiceMatchId,
        mode: 'practice',
        forcePractice: true,
        createdAtIso: ts,
        history: [],
        wins: Array.from({ length: players.length }, function(){ return 0; })
      });

      var matchRes = await sb.from(matchTable).upsert({
        id: practiceMatchId,
        created_at: ts,
        total_games: 1,
        players: players,
        wins: Array.from({ length: players.length }, function(){ return 0; }),
        history: [{ totals: totals.slice(), mode: 'practice' }]
      }).select('id').single();
      if (matchRes && matchRes.error) throw matchRes.error;

      var payload = {
        match_id: practiceMatchId,
        game_number: 1,
        created_at: ts,
        totals: totals,
        finished: true,
        mode: 'practice',
        state: {
          players: players,
          board: board,
          totals: totals,
          mode: 'practice',
          gameMode: 'practice',
          is_practice: true,
          total_players: players.length,
          match_id: practiceMatchId,
          matchId: practiceMatchId,
          completed_at: ts,
          practice_save_key: saveKey,
          schema_version: 3
        }
      };

      var res = await sb.from(table).insert(payload).select('id, created_at').single();
      if (res && res.error) throw res.error;
      try{ console.info('[SQ] Practice cloud save V3 wrote games row', { game: res && res.data, practiceMatchId: practiceMatchId, game_number: 1, created_at: ts, saveKey: saveKey }); }catch(_){ }
      return res && res.data ? res.data : null;
    }catch(e){
      try{
        if (!saveKey || state.__sqPracticeSavedKeyV2 === saveKey) delete state.__sqPracticeSavedKeyV2;
        state.__sqPracticeCloudSavedV2 = false;
        state.__sqPracticeSavedToGames = false;
        delete state.__sqPracticeSaveMatchIdV2;
      }catch(_){ }
      try{ console.error('[SQ] Practice cloud save V3 failed', e); }catch(_){ }
      return null;
    }finally{
      try{
        if (!saveKey || state.__sqPracticeSaveInFlightKeyV2 === saveKey) delete state.__sqPracticeSaveInFlightKeyV2;
        delete state.__sqPracticeSaveInFlightV2;
      }catch(_){ }
    }
  }

  window.__sqSavePracticeToGamesNow = savePracticeToGames;

  try{
    if (typeof openGameCompleteDialog === 'function' && !openGameCompleteDialog.__sqPracticeCloudSaveV2Wrapped){
      var oldOpenGameCompleteDialog = openGameCompleteDialog;
      var wrappedOpenGameCompleteDialog = function(){
        try{ if (window.state) state.__sqGameCompleteOpen = true; }catch(_){ }
        var ret = oldOpenGameCompleteDialog.apply(this, arguments);
        try{ setTimeout(savePracticeToGames, 20); }catch(_){ }
        return ret;
      };
      wrappedOpenGameCompleteDialog.__sqPracticeCloudSaveV2Wrapped = true;
      openGameCompleteDialog = wrappedOpenGameCompleteDialog;
      try{ window.openGameCompleteDialog = wrappedOpenGameCompleteDialog; }catch(_){ }
    }
  }catch(_){ }

  try{
    if (typeof updateUI === 'function' && !updateUI.__sqPracticeCloudSaveV2Wrapped){
      var oldUpdateUI = updateUI;
      updateUI = function(){
        var ret = oldUpdateUI.apply(this, arguments);
        try{ if (isPracticeState() && isCompleteEnough()) setTimeout(savePracticeToGames, 40); }catch(_){ }
        return ret;
      };
      updateUI.__sqPracticeCloudSaveV2Wrapped = true;
      try{ window.updateUI = updateUI; }catch(_){ }
    }
  }catch(_){ }
})();
/* <<< PATCH:PRACTICE_CLOUD_SAVE_V2 END */

