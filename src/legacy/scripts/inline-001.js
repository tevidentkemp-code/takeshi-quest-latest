
(function(){
  function __sqSetVh(){
    try{
      var vv = window.visualViewport;
      var h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--sqVh', (h * 0.01) + 'px');
    }catch(e){}
  }
  __sqSetVh();
  try{ window.addEventListener('resize', __sqSetVh, { passive:true }); }catch(e){}
  try{
    if (window.visualViewport){
      window.visualViewport.addEventListener('resize', __sqSetVh, { passive:true });
      window.visualViewport.addEventListener('scroll', __sqSetVh, { passive:true });
    }
  }catch(e){}
  try{ document.addEventListener('visibilitychange', function(){ if(!document.hidden) __sqSetVh(); }, { passive:true }); }catch(e){}
})();

/* >>> PATCH:ADMIN_KEYPAD_GATE_V2_SERVER_AUTH START */
(function(){
  if (window.__sqAdminKeypadPatchLoaded) return;
  window.__sqAdminKeypadPatchLoaded = true;
  // UI state only. The actual admin session is held by src/services/admin-security.js
  // and every destructive action is authorised again by the server.
  window.__sqAdminAuthed = false;

  function hasLiveAdminSession(){
    try{
      return !!(window.__sqAdminAuthed && typeof window.sqAdminSessionActive === 'function' && window.sqAdminSessionActive());
    }catch(_){ return false; }
  }

  function navigateBackToStart(){
    try{
      if (typeof navigateToStartScreen === 'function') return navigateToStartScreen();
    }catch(_){}
    try{
      document.body.dataset.page = 'details';
      ['details','players','game','leaderboard'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== 'details');
      });
    }catch(_){}
  }

  function closeAdminHubIfOpen(){
    ['adminHubModal','adminModal','adminHub'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function showAdminKeypad(){
    if (window.__sqAdminModalOpen) return;
    window.__sqAdminModalOpen = true;

    var overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.id = 'adminCodeGateOverlay';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '380px';
    modal.style.width = 'min(92vw, 380px)';

    var title = document.createElement('h3');
    title.textContent = 'Admin Code';

    var body = document.createElement('div');
    body.className = 'modal-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '12px';
    body.style.alignItems = 'center';

    var hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = 'Enter admin code';

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
    display.style.letterSpacing = '.22em';
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
    var pending = false;

    function refresh(){
      display.textContent = code.length ? Array(code.length).fill('•').join(' ') : '—';
    }

    function close(goHome){
      try{ overlay.remove(); }
      finally{
        window.__sqAdminModalOpen = false;
        if (goHome){
          closeAdminHubIfOpen();
          navigateBackToStart();
        }
      }
    }

    function deny(message){
      error.textContent = message || 'Incorrect code';
      code = '';
      refresh();
    }

    function grant(){
      window.__sqAdminAuthed = true;
      close(false);
      if (typeof window.__openAdminHubUnsafe === 'function') return window.__openAdminHubUnsafe();
      if (typeof window.__sqOriginalOpenAdminHub === 'function') return window.__sqOriginalOpenAdminHub();
      if (typeof window.openAdminHub === 'function' && !window.openAdminHub.__sqIsGated) return window.openAdminHub();
    }

    async function submit(){
      if (pending || code.length !== 8) return;
      if (typeof window.sqAdminLogin !== 'function'){
        deny('Admin service unavailable');
        return;
      }
      pending = true;
      error.textContent = 'Checking…';
      var attempt = code;
      try{
        var result = await window.sqAdminLogin(attempt);
        if (result && result.ok === true){
          grant();
          return;
        }
        if (result && result.code === 'rate_limited'){
          var secs = Number(result.retry_after_seconds || 0);
          deny(secs > 0 ? ('Too many attempts. Try again in ' + Math.ceil(secs / 60) + ' min.') : 'Too many attempts. Try again later.');
        } else {
          deny('Incorrect code');
        }
      }catch(_){
        deny('Admin service unavailable');
      }finally{
        pending = false;
      }
    }

    function pushDigit(d){
      if (pending || code.length >= 8) return;
      error.textContent = '';
      code += String(d);
      refresh();
      if (code.length === 8) submit();
    }

    function makeKey(label, fn, cls){
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
      pad.appendChild(makeKey(n, function(){ pushDigit(n); }));
    });
    pad.appendChild(makeKey('Clear', function(){ if (!pending){ code=''; error.textContent=''; refresh(); } }));
    pad.appendChild(makeKey('0', function(){ pushDigit('0'); }));
    pad.appendChild(makeKey('⌫', function(){ if (!pending){ code = code.slice(0,-1); error.textContent=''; refresh(); } }));

    var footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.justifyContent = 'center';

    var ret = document.createElement('button');
    ret.className = 'btn';
    ret.textContent = 'Return';
    ret.onclick = function(){ if (!pending) close(true); };
    footer.appendChild(ret);

    body.append(hint, display, error, pad);
    modal.append(title, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    refresh();
    modal.tabIndex = 0;
    modal.focus();

    overlay.addEventListener('click', function(e){ if (e.target === overlay && !pending) close(true); });
    overlay.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && !pending){ close(true); return; }
      if (/^[0-9]$/.test(e.key)){ pushDigit(e.key); return; }
      if (e.key === 'Backspace' && !pending){ code = code.slice(0,-1); error.textContent=''; refresh(); return; }
      if (e.key === 'Enter' && code.length === 8){ submit(); }
    });
  }

  function gateAdminHub(){
    var unsafe = null;
    if (typeof window.__sqOriginalOpenAdminHub === 'function'){
      unsafe = window.__sqOriginalOpenAdminHub;
    } else if (typeof window.openAdminHub === 'function' && !window.openAdminHub.__sqIsGated){
      unsafe = window.openAdminHub;
      window.__sqOriginalOpenAdminHub = unsafe;
    }
    if (!unsafe) return false;

    var gated = function(){
      if (hasLiveAdminSession()) return unsafe();
      window.__sqAdminAuthed = false;
      return showAdminKeypad();
    };
    gated.__sqIsGated = true;
    window.openAdminHub = gated;
    try{ openAdminHub = gated; }catch(_){}
    window.openAdminPasswordModal = showAdminKeypad;
    return true;
  }

  function wireAdminButtons(){
    ['adminBtn','adminCodeBtn'].forEach(function(id){
      var b = document.getElementById(id);
      if (b){
        b.onclick = function(e){
          if (e){ e.preventDefault && e.preventDefault(); e.stopPropagation && e.stopPropagation(); }
          if (hasLiveAdminSession()){
            if (typeof window.openAdminHub === 'function') return window.openAdminHub();
          }
          window.__sqAdminAuthed = false;
          return showAdminKeypad();
        };
      }
    });
  }

  function looksLikeAdmin(el){
    if (!el) return false;
    var id = (el.id || '').toLowerCase();
    var txt = String(el.textContent || '').trim().toLowerCase();
    return id === 'adminbtn' || id === 'admincodebtn' || txt === 'admin';
  }

  function interceptClicks(){
    if (window.__sqAdminInterceptBound) return;
    window.__sqAdminInterceptBound = true;
    document.addEventListener('click', function(e){
      var el = e.target && e.target.closest ? e.target.closest('#adminBtn,#adminCodeBtn,button,a,.home-admin-row') : null;
      if (!looksLikeAdmin(el)) return;
      if (!hasLiveAdminSession()){
        window.__sqAdminAuthed = false;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        showAdminKeypad();
      }
    }, true);
  }

  function boot(){
    gateAdminHub();
    wireAdminButtons();
    interceptClicks();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  setTimeout(boot, 250);
  setTimeout(boot, 1000);
  setTimeout(boot, 2500);
})();
/* <<< PATCH:ADMIN_KEYPAD_GATE_V2_SERVER_AUTH END */
