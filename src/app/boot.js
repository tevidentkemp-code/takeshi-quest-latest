
// ===== @SEC:JS:BOOT =====
// ===== JS: BOOT / GLOBALS =====// ===== JS: BOOT / GLOBALS =====

// >>> PATCH:SQ_STAGE2_FLAGS_DEPRECATIONS START
// Central feature flags (defaults preserve current production behavior).
const FLAGS = Object.freeze({
  LIVE_V2: true,                 // Live gameplay UI v2 + legacy UI hidden
  ENABLE_LEGACY_UI: false,       // Allow legacy (pre-LiveV2) gameplay UI to render
  ENABLE_LEGACY_HOME: false,     // Allow any legacy start/home layout builders to run
  DEBUG_GUARDS: false            // Extra console warnings for deprecated entrypoints
});

// Deprecations (do not expand; remove in Stage 3+ once stable).
// - Legacy gameplay UI containers: #floatWrap, #turnBar, #scoreWrap, #roundBar, #roundSeamBar
// - Any "Old"/"Legacy" home/start builders (kept only for rollback).
// <<< PATCH:SQ_STAGE2_FLAGS_DEPRECATIONS END

// Cloud fetch guard: some cloud read chains never settle when the network is
// down, leaving dialogs on "Loading…" forever. Race the read against a
// timeout so every loading state can resolve into an error + retry UI.
window.__sqWithCloudTimeout = function(promise, ms, label){
  ms = Number(ms) || 12000;
  return Promise.race([
    Promise.resolve(promise),
    new Promise(function(_, rej){
      setTimeout(function(){ rej(new Error('cloud-timeout' + (label ? ':' + label : ''))); }, ms);
    })
  ]);
};
window.__sqCloudErrorHtml = function(){
  return 'Cloud data is unavailable right now (no connection, or the server did not respond). ' +
    '<button type="button" class="btn" data-action="cloudRetry" style="margin-left:8px;">RETRY</button>';
};

// Dialog a11y semantics for every modal, static or dynamic (audit A-1):
// most of the ~30 dialog builders create bare divs with no role. Stamp
// role="dialog" + aria-modal on the modal inside each .modal-backdrop as
// it appears, and label it from its heading when one exists.
(function(){
  function stamp(bd){
    try{
      if (!bd || bd.nodeType !== 1 || !bd.classList || !bd.classList.contains('modal-backdrop')) return;
      var modal = bd.querySelector(':scope > .modal, :scope > [class*="modal"]') || bd.firstElementChild;
      if (!modal || modal.getAttribute('role') === 'dialog') return;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      if (!modal.getAttribute('aria-label') && !modal.getAttribute('aria-labelledby')){
        var cands = modal.querySelectorAll('h3, [class*="title-text"], [class*="-title"]');
        for (var i = 0; i < cands.length; i++){
          if (cands[i].children && cands[i].children.length) continue; // leaf headings only
          var t = (cands[i].textContent || '').replace(/\s+/g, ' ').trim();
          if (t && t.length <= 48){ modal.setAttribute('aria-label', t); break; }
        }
      }
    }catch(_){ }
  }
  function boot(){
    try{
      document.querySelectorAll('.modal-backdrop').forEach(stamp);
      new MutationObserver(function(muts){
        muts.forEach(function(m){
          (m.addedNodes || []).forEach(function(n){
            stamp(n);
            if (n.nodeType === 1 && n.querySelectorAll) n.querySelectorAll('.modal-backdrop').forEach(stamp);
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }catch(e){ try{ console.warn('[SQ] dialog a11y stamp failed', e); }catch(_){ } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

// Styled in-app confirm (replaces native window.confirm, which broke the
// app's visual language). Reuses the fix170 End-Match confirm styling.
window.__sqConfirm = function(opts, onYes, onNo){
  if (typeof opts === 'string') opts = { message: opts };
  opts = opts || {};
  document.querySelectorAll('.sq-confirm-bd').forEach(function(n){ try{ n.remove(); }catch(_){ } });
  var bd = document.createElement('div');
  bd.className = 'modal-backdrop sq-endmatch-confirm-bd sq-confirm-bd';
  var modal = document.createElement('div');
  modal.className = 'modal sq-endmatch-confirm';
  modal.style.maxWidth = '440px';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  modal.innerHTML =
    '<h3>' + esc(opts.title || 'Are you sure?') + '</h3>' +
    '<div class="modal-body">' + esc(opts.message || '') + '</div>' +
    '<div class="modal-footer">' +
      '<button type="button" class="btn sq-endmatch-yes">' + esc(opts.yesLabel || 'YES') + '</button>' +
      '<button type="button" class="btn sq-endmatch-no">' + esc(opts.noLabel || 'NO') + '</button>' +
    '</div>';
  bd.appendChild(modal);
  document.body.appendChild(bd);
  function close(){ try{ bd.remove(); }catch(_){ } }
  modal.querySelector('.sq-endmatch-no').onclick = function(){ close(); try{ if (typeof onNo === 'function') onNo(); }catch(_){ } };
  modal.querySelector('.sq-endmatch-yes').onclick = function(){ close(); try{ if (typeof onYes === 'function') onYes(); }catch(e){ console.error('[SQ] confirm action failed', e); } };
  bd.addEventListener('click', function(e){ if (e.target === bd){ close(); try{ if (typeof onNo === 'function') onNo(); }catch(_){ } } });
  bd.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ close(); try{ if (typeof onNo === 'function') onNo(); }catch(_){ } } });
  modal.tabIndex = 0;
  try{ modal.focus(); }catch(_){ }
};

// ---------------------------------------------------------------------------
// sqModal — the shared modal factory (audit P5.1 / D-1).
// One place for the shell, Back-vs-Close semantics, backdrop/Escape closing,
// focus trap, focus restore, and a modal stack so Escape always closes the
// TOPMOST dialog only. Dialogs migrate onto this incrementally; hand-rolled
// builders keep working untouched until their turn.
//
//   var m = sqModal({
//     title: 'Game Scores', sub: 'optional subtitle',   // builds menu-modal header
//     header: node,          // OR bring your own header node (skips title/sub)
//     onBack: fn,            // renders ← in header; Back = one level up
//     modalClass: '', backdropClass: '', maxWidth: '520px',
//     closeButton: 'Close',  // adds a footer Close pill (omit for none)
//     backdropClose: true, escapeClose: true,
//     onClose: fn(reason)    // 'x' | 'back' | 'backdrop' | 'escape' | 'api' | footer label
//   });
//   m.body      — append content here
//   m.footer    — footer element (created on demand via m.addFooterButton)
//   m.close()   — programmatic close
// ---------------------------------------------------------------------------
(function(){
  if (window.sqModal) return;
  var stack = window.__sqModalStack = window.__sqModalStack || [];

  function focusables(root){
    try{
      return Array.prototype.filter.call(
        root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        function(el){ return !el.disabled && el.offsetParent !== null; });
    }catch(_){ return []; }
  }

  // One document-level handler for the whole stack: Escape closes the top
  // dialog; Tab is trapped inside it.
  document.addEventListener('keydown', function(e){
    if (!stack.length) return;
    var top = stack[stack.length - 1];
    if (e.key === 'Escape' && top.escapeClose !== false){
      e.stopPropagation();
      top.close('escape');
      return;
    }
    if (e.key === 'Tab'){
      var f = focusables(top.modal);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      else if (!top.modal.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    }
  }, true);

  window.sqModal = function(opts){
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-backdrop' + (opts.backdropClass ? ' ' + opts.backdropClass : '');
    var modal = document.createElement('div');
    modal.className = 'modal' + (opts.modalClass ? ' ' + opts.modalClass : '');
    if (opts.maxWidth){ modal.style.maxWidth = opts.maxWidth; modal.style.width = opts.width || '94vw'; }
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (opts.title) modal.setAttribute('aria-label', String(opts.title));

    var header = opts.header || null;
    var api = { overlay: overlay, modal: modal, closed: false, escapeClose: opts.escapeClose };
    var prevFocus = document.activeElement;

    function close(reason){
      if (api.closed) return;
      api.closed = true;
      try{ overlay.remove(); }catch(_){ }
      var ix = stack.indexOf(api); if (ix >= 0) stack.splice(ix, 1);
      try{ if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus(); }catch(_){ }
      try{ if (typeof opts.onClose === 'function') opts.onClose(reason || 'api'); }catch(e){ console.error('[sqModal] onClose failed', e); }
    }
    api.close = close;

    if (!header && opts.title){
      header = document.createElement('div');
      header.className = 'menu-modal-header';
      var left;
      if (typeof opts.onBack === 'function'){
        left = document.createElement('button');
        left.type = 'button'; left.className = 'icon-btn'; left.setAttribute('aria-label', 'Back');
        left.innerHTML = '<span style="font-size:18px;line-height:1;">←</span>';
        left.onclick = function(){ close('back'); try{ opts.onBack(); }catch(e){ console.error(e); } };
      } else {
        left = document.createElement('span');
        left.className = 'icon-btn'; left.setAttribute('aria-hidden', 'true'); left.style.visibility = 'hidden';
      }
      var mid = document.createElement('div'); mid.className = 'menu-modal-title';
      var tt = document.createElement('div'); tt.className = 'menu-modal-title-text'; tt.textContent = String(opts.title);
      mid.appendChild(tt);
      if (opts.sub){ var ss = document.createElement('div'); ss.className = 'menu-modal-title-sub'; ss.textContent = String(opts.sub); mid.appendChild(ss); }
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'icon-btn'; x.setAttribute('aria-label', 'Close');
      x.innerHTML = '<span style="font-size:18px;line-height:1;">✕</span>';
      x.onclick = function(){ close('x'); };
      header.append(left, mid, x);
    }

    var body = document.createElement('div');
    body.className = 'modal-body';
    api.body = body;

    var footer = null;
    api.addFooterButton = function(label, className, onClick, closes){
      if (!footer){ footer = document.createElement('div'); footer.className = 'modal-footer'; modal.appendChild(footer); api.footer = footer; }
      var b = document.createElement('button');
      b.type = 'button'; b.className = className || 'btn sq-pill'; b.textContent = label;
      b.onclick = function(){ if (closes !== false) close(String(label)); if (typeof onClick === 'function'){ try{ onClick(); }catch(e){ console.error(e); } } };
      footer.appendChild(b);
      return b;
    };

    if (header) modal.appendChild(header);
    modal.appendChild(body);
    if (opts.closeButton) api.addFooterButton(typeof opts.closeButton === 'string' ? opts.closeButton : 'Close');

    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e){ if (e.target === overlay && opts.backdropClose !== false) close('backdrop'); });
    document.body.appendChild(overlay);
    stack.push(api);
    modal.tabIndex = -1;
    try{ modal.focus(); }catch(_){ }
    return api;
  };

  // Register an externally-built modal (its own markup + close logic) onto the
  // shared stack so it gains Escape-closes-topmost and Tab focus-trapping.
  // Used to retrofit the fix106 menu family (openModalShell) without a rewrite.
  // Returns an unregister function; call it from the modal's own close path.
  window.sqModal.register = function(overlay, modal, closeFn, opts){
    opts = opts || {};
    var prevFocus = document.activeElement;
    var api = { overlay: overlay, modal: modal, escapeClose: opts.escapeClose, closed: false };
    api.body = modal.querySelector('.modal-body, .sq-menu106-body') || modal;
    api.close = function(){
      if (api.closed) return; api.closed = true;
      var ix = stack.indexOf(api); if (ix >= 0) stack.splice(ix, 1);
      try{ if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus(); }catch(_){ }
      try{ if (typeof closeFn === 'function') closeFn(); }catch(e){ console.error('[sqModal.register] close failed', e); }
    };
    stack.push(api);
    try{ modal.tabIndex = -1; modal.focus(); }catch(_){ }
    return api;
  };

  // Registered dialogs may close through their own legacy paths (button
  // handlers calling overlay.remove(), preemptive duplicate cleanup, etc.).
  // Watch for overlay removal and retire the matching stack entry so the
  // stack never points at a detached dialog.
  try{
    new MutationObserver(function(muts){
      if (!stack.length) return;
      for (var i = 0; i < muts.length; i++){
        var rm = muts[i].removedNodes;
        for (var j = 0; j < rm.length; j++){
          var n = rm[j];
          if (!n || n.nodeType !== 1) continue;
          for (var k = stack.length - 1; k >= 0; k--){
            var ent = stack[k];
            if (ent.overlay === n || (n.contains && n.contains(ent.overlay))) ent.close('removed');
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }catch(e){ console.warn('[sqModal] removal observer failed', e); }
})();

// >>> PATCH:MOT_STAGE3_NAV_STACK_V1 START
// Minimal, opt-in modal stack manager used ONLY by new MOT Stage 3+ modals.
// Does not interfere with existing legacy modals that manage their own ESC handlers.
(function(){
  if (window.__sqNav) return;

  const stack = [];
  const DIAG = (typeof window.SQ_DIAG === 'object' && window.SQ_DIAG) ? window.SQ_DIAG : null;

  function top(){ return stack[stack.length - 1] || null; }

  function push(entry){
    if (!entry || !entry.overlay) return;
    stack.push(entry);
    try{ entry.overlay.dataset.sqNavManaged = '1'; }catch(_){}
    try{ if (DIAG) DIAG.mark('nav_push', { depth: stack.length, name: entry.name||'' }); }catch(_){}
  }

  function removeOverlay(overlay){
    try{ overlay.remove(); }catch(_){}
  }

  function pop(){
    const t = stack.pop();
    if (!t) return;
    removeOverlay(t.overlay);
    try{ if (DIAG) DIAG.mark('nav_pop', { depth: stack.length, name: t.name||'' }); }catch(_){}
    const nt = top();
    if (nt && nt.modal && typeof nt.modal.focus === 'function'){
      try{ nt.modal.focus(); }catch(_){}
    }
  }

  function clearAll(){
    while(stack.length){
      const t = stack.pop();
      if (t && t.overlay) removeOverlay(t.overlay);
    }
    try{ if (DIAG) DIAG.mark('nav_clear', { depth: 0 }); }catch(_){}
  }

  // Focus trap for managed modals (simple + safe)
  function trapTab(modal, ev){
    if (ev.key !== 'Tab') return;
    const focusables = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last  = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === first){ ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last){ ev.preventDefault(); first.focus(); }
  }

  // Global ESC handler for managed stack only
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const t = top();
    if (!t || !t.overlay) return;
    // Only handle if overlay is still in DOM and marked as managed
    if (!t.overlay.isConnected) { pop(); return; }
    if (t.overlay.dataset.sqNavManaged !== '1') return;
    ev.preventDefault();
    if (typeof t.onClose === 'function') { try{ t.onClose(); }catch(_){ pop(); } }
    else pop();
  }, { passive:false });

  function openMenuModal({ title, subtitle, iconSvg, items, onBack, onClose, name }){
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal menu-modal';
    modal.style.maxWidth = '980px';
    modal.style.width = '94vw';
    modal.style.maxHeight = '90vh';
    modal.style.overflow = 'hidden';

    const header = document.createElement('div');
    header.className = 'menu-modal-header';

    const backBtn = document.createElement('button');
    backBtn.className = 'icon-btn';
    backBtn.type = 'button';
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'menu-modal-title';

    const icon = document.createElement('div');
    icon.className = 'menu-modal-icon';
    icon.innerHTML = iconSvg || '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>';

    const titleEl = document.createElement('div');
    titleEl.className = 'menu-modal-title-text';
    titleEl.textContent = String(title || 'MENU');

    titleWrap.append(icon, titleEl);
    header.append(backBtn, titleWrap, closeBtn);

    const body = document.createElement('div');
    body.className = 'menu-modal-body';

    if (subtitle){
      const s = document.createElement('div');
      s.className = 'tag';
      s.style.margin = '0 0 10px 0';
      s.textContent = String(subtitle);
      body.appendChild(s);
    }

    const grid = document.createElement('div');
    grid.className = 'menu-grid';

    (items || []).forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'menu-item';
      btn.type = 'button';
      btn.innerHTML = `<div class="menu-item-title">${it.title || ''}</div>` + (it.sub ? `<div class="menu-item-sub">${it.sub}</div>` : '');
      if (it.disabled){
        btn.disabled = true;
        if (it.disabledReason) btn.title = String(it.disabledReason);
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        if (typeof it.onClick === 'function'){
          try{ it.onClick(); }catch(err){ try{ console.error(err); }catch(_){ } }
        }
      });
      grid.appendChild(btn);
    });

    body.appendChild(grid);
    modal.append(header, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const entry = { overlay, modal, name: name || String(title||'menu'), onClose: null };

// >>> PATCH:MOT_STAGE4_VIEWPORT_VARS_V1 START
// Stage 4: stable viewport + pad measurements (iOS Safari + desktop Safari)
(function(){
  const root = document.documentElement;
  function setVh(){
    const vv = window.visualViewport;
    const h = vv && vv.height ? vv.height : window.innerHeight;
    root.style.setProperty('--sqVh', `${Math.max(1, Math.round(h))}px`);
  }
  function setPadH(){
    const padEl =
      document.querySelector('#scorePad') ||
      document.querySelector('#padBar') ||
      document.querySelector('.pad-bar') ||
      document.querySelector('.pad');
    if (!padEl) return;
    const r = padEl.getBoundingClientRect();
    if (r && r.height) root.style.setProperty('--sqPadH', `${Math.max(1, Math.round(r.height))}px`);
  }
  function setDeskScale(){
    try{
      const mm = window.matchMedia && window.matchMedia('(min-width: 900px) and (hover:hover) and (pointer:fine)');
      if (!mm || !mm.matches){
        document.documentElement.style.setProperty('--sqDeskScale','1');
        return;
      }
      const gate = document.getElementById('gameScrollGate');
      if (!gate){
        document.documentElement.style.setProperty('--sqDeskScale','1');
        return;
      }
      const vv = window.visualViewport;
      const vh = vv ? vv.height : window.innerHeight;

      // Fixed pad height (already sampled into --sqPadH)
      const padEl = document.getElementById('scorePad') || document.getElementById('pad');
      const padH = padEl ? padEl.getBoundingClientRect().height : 0;

      const r = gate.getBoundingClientRect();
      const top = Math.max(0, r.top);
      const avail = Math.max(100, vh - padH - top - 12); // 12px breathing room
      const contentH = Math.max(1, gate.scrollHeight);

      let s = avail / contentH;
      if (!isFinite(s) || s <= 0) s = 1;
      s = Math.min(1, Math.max(0.75, s)); // never upscale; avoid extreme shrink
      document.documentElement.style.setProperty('--sqDeskScale', String(Math.round(s*1000)/1000));
    }catch(e){
      try{ document.documentElement.style.setProperty('--sqDeskScale','1'); }catch(_){}
    }
  }

  function setDeskPadW(){
    try{
      const mm = window.matchMedia && window.matchMedia('(min-width: 900px) and (hover:hover) and (pointer:fine)');
      if (!mm || !mm.matches){
        root.style.setProperty('--sqDeskPadW', '');
        return;
      }
      // Prefer the *actual DMD cell* width as the reference (visual match target).
      const ref =
        document.querySelector('body[data-page="game"] .sq-dmd') ||
        document.querySelector('body[data-page="game"] .sq-dmd-wrap') ||
        document.querySelector('body[data-page="game"] .v2InfoPager') ||
        document.querySelector('body[data-page="game"] .livev2panel') ||
        document.querySelector('body[data-page="game"] .wrap') ||
        document.querySelector('.wrap');
      if (!ref) return;
      const r = ref.getBoundingClientRect();
      if (r && r.width) root.style.setProperty('--sqDeskPadW', `${Math.max(320, Math.round(r.width))}px`);
    }catch(_){
      try{ root.style.setProperty('--sqDeskPadW',''); }catch(__){}
    }
  }

  function update(){
    setVh();
    setPadH();
    setDeskScale();
    setDeskPadW();
  }

  window.__sqUpdateViewportVars = update;

  window.addEventListener('resize', update, { passive:true });
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', update, { passive:true });
    window.visualViewport.addEventListener('scroll', update, { passive:true });
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    update();
    // Safari layout settles after initial paint; re-sample
    setTimeout(update, 50);
    setTimeout(update, 250);
  });
})();
// <<< PATCH:MOT_STAGE4_VIEWPORT_VARS_V1 END

    // Back/Close semantics for this modal
    const doClose = () => { if (typeof onClose === 'function') onClose(); else pop(); };
    const doBack  = () => { if (typeof onBack === 'function') onBack(); else pop(); };

    entry.onClose = doClose;

    backBtn.addEventListener('click', (e)=>{ e.preventDefault(); doBack(); });
    closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); doClose(); });

    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) doClose(); });

    // Focus management
    modal.tabIndex = 0;
    modal.addEventListener('keydown', (ev)=>trapTab(modal, ev));
    try{ modal.focus(); }catch(_){}

    push(entry);
    return entry;
  }

  window.__sqNav = { stack, top, push, pop, clearAll, openMenuModal };
})();

// Main Menu entrypoint (used by Stage 3 IA). Safe: only adds a new optional modal.
window.openMainMenuDialog = window.openMainMenuDialog || function openMainMenuDialog(origin){
  try{
    const page = document.body ? (document.body.getAttribute('data-page') || '') : '';
    const inGame = (page === 'game');
    const inLB   = (page === 'leaderboard');
    const onHome = (page === 'details' || !page);

    const items = [
      { title: 'NEW GAME', sub: 'Return to Home / start a new match', onClick: ()=>{ try{ if (typeof navigateToStartScreen==='function') navigateToStartScreen(); }catch(_){ } try{ if (window.__sqNav) window.__sqNav.clearAll(); }catch(_){ } } },
      { title: 'PLAYER STATS', sub: 'Open stats hub', onClick: ()=>{ try{ if (typeof window.openPlayerStatsSelect==='function') window.openPlayerStatsSelect(); else if (typeof openPlayerStatsHub==='function') openPlayerStatsHub(); }catch(_){ } } },
      { title: 'LEVEL LADDER', sub: 'XP & levels leaderboard', onClick: ()=>{ try{ if (typeof openXpLeaderboard==='function') openXpLeaderboard(); else if (typeof toast==='function') toast('Ladder not available'); }catch(_){ } } },
      { title: 'LEAGUE & RANKINGS', sub: 'High scores, round records, rankings', onClick: ()=>{ try{ if (typeof openLeagueRankingsDialog==='function') openLeagueRankingsDialog(); }catch(_){ } } },
      { title: 'ADMIN', sub: 'Tools + data (restricted)', onClick: ()=>{ try{ if (typeof openAdminHub==='function') openAdminHub(); else if (typeof openAdminHubDialog==='function') openAdminHubDialog(); else if (typeof toast==='function') toast('Admin not available'); }catch(_){ } } },
    ];

    // Optional "Resume" only meaningful when not on home
    if (inGame || inLB){
      items.unshift({ title: 'RESUME', sub: inLB ? 'Return to leaderboard' : 'Return to live game', onClick: ()=>{ try{ if (typeof _showPageSafe==='function') _showPageSafe(inLB ? 'leaderboard' : 'game'); }catch(_){ } try{ if (window.__sqNav) window.__sqNav.pop(); }catch(_){ } } });
    }

    // Disable admin if no entrypoint exists
    const adminIt = items.find(x => x.title === 'ADMIN');
    if (adminIt && typeof openAdminHub!=='function' && typeof openAdminHubDialog!=='function'){
      adminIt.disabled = true;
      adminIt.disabledReason = 'Admin is not enabled in this build';
    }

    if (!window.__sqNav || typeof window.__sqNav.openMenuModal !== 'function'){
      if (typeof toast==='function') toast('Menu system not available');
      return;
    }

    window.__sqNav.openMenuModal({
      title: 'MAIN MENU',
      subtitle: onHome ? 'Home navigation' : (inGame ? 'In-game navigation' : 'Navigation'),
      items,
      onBack: ()=>{ try{ window.__sqNav.pop(); }catch(_){ } },
      onClose: ()=>{ try{ window.__sqNav.pop(); }catch(_){ } },
      name: 'main_menu'
    });
  }catch(err){
    try{ console.error('openMainMenuDialog failed', err); }catch(_){}
  }
};

// Optional wiring hook: if a MENU button exists on any screen, it will work.
(function wireMenuButtons(){
  const ids = ['mainMenuBtn','mainMenuBtnGame','mainMenuBtnLB','mainMenuBtnFromGame','mainMenuBtnFromLB'];
  function wire(){
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (el && !el.__sqMenuWired){
        el.__sqMenuWired = true;
        el.addEventListener('click', ()=>{ try{ openMainMenuDialog(); }catch(_){ } });
      }
    });
  }
  document.addEventListener('DOMContentLoaded', wire);
  // also attempt immediately for dynamically inserted nodes
  try{ wire(); }catch(_){}
})();
// <<< PATCH:MOT_STAGE3_NAV_STACK_V1 END
// >>> PATCH:MOT_STAGE2_DIAGNOSTICS_V1 START
(function(){
  // Opt-in debug: URL ?debug=1 OR localStorage.SQ_DEBUG='1'
  const qs = new URLSearchParams(location.search);
  const debug = (qs.get('debug') === '1') || (localStorage.getItem('SQ_DEBUG') === '1');
  window.SQ_DEBUG = !!debug;

  const MAX = 80;
  const buf = [];
  function push(entry){
    try{
      buf.push(Object.assign({ t: new Date().toISOString() }, entry));
      if (buf.length > MAX) buf.splice(0, buf.length - MAX);
    }catch(_){}
  }

  window.SQ_DIAG = window.SQ_DIAG || {
    enabled: window.SQ_DEBUG,
    buffer: buf,
    push,
    mark: function(name, data){ if (!window.SQ_DEBUG) return; push({ type:'mark', name, data: data || null }); },
    error: function(where, err){ push({ type:'error', where, message: String(err && err.message || err), stack: String(err && err.stack || '') }); },
    warn: function(where, msg){ push({ type:'warn', where, message: String(msg) }); }
  };

  window.sqGetDiagnostics = function(){ return (window.SQ_DIAG && window.SQ_DIAG.buffer) ? window.SQ_DIAG.buffer.slice() : []; };
  window.sqClearDiagnostics = function(){ try{ buf.length = 0; }catch(_){} };

  window.addEventListener('error', function(ev){
    if (!window.SQ_DEBUG) return;
    const e = ev && ev.error;
    push({
      type:'window.error',
      message: String(ev && ev.message || (e && e.message) || 'error'),
      file: String(ev && ev.filename || ''),
      line: Number(ev && ev.lineno || 0),
      col: Number(ev && ev.colno || 0),
      stack: String(e && e.stack || '')
    });
  });

  window.addEventListener('unhandledrejection', function(ev){
    if (!window.SQ_DEBUG) return;
    const r = ev && ev.reason;
    push({
      type:'unhandledrejection',
      message: String(r && r.message || r || 'rejection'),
      stack: String(r && r.stack || '')
    });
  });

  if (window.SQ_DEBUG) {
    console.log('[SQ DEBUG] enabled');
  }
})();
// <<< PATCH:MOT_STAGE2_DIAGNOSTICS_V1 END

// >>> PATCH:SQ_STAGE2_GUARD_LEGACY_ENTRYPOINTS START
(function(){
  // Wrap any legacy/old entrypoints so they cannot accidentally overwrite the active UI.
  const wrap = (name, enabledFlag)=>{
    const fn = window[name];
    if(typeof fn !== 'function') return;
    if(fn.__sqWrapped) return;
    const wrapped = function(){
      const enabled = !!(FLAGS && FLAGS[enabledFlag]);
      if(!enabled){
        if(FLAGS && FLAGS.DEBUG_GUARDS) console.warn('[SQ][DEPRECATED] blocked call to', name, 'because', enabledFlag, 'is false');
        return;
      }
      return fn.apply(this, arguments);
    };
    wrapped.__sqWrapped = true;
    window[name] = wrapped;
  };

  // Known legacy toggles/builders (only wrapped if they exist)
  wrap('__sqBuildLegacyHome', 'ENABLE_LEGACY_HOME');
  wrap('buildLegacyHome', 'ENABLE_LEGACY_HOME');
  wrap('buildOldHome', 'ENABLE_LEGACY_HOME');
  wrap('renderOldHome', 'ENABLE_LEGACY_HOME');
  wrap('buildLegacyGameUI', 'ENABLE_LEGACY_UI');
  wrap('buildLegacyScoreboard', 'ENABLE_LEGACY_UI');
})();
// <<< PATCH:SQ_STAGE2_GUARD_LEGACY_ENTRYPOINTS END

// >>> PATCH:SQ_STAGE3C_BOOT_SCHEDULER START
// Boot scheduler: defer non-critical work until after first paint, and prevent duplicate runs.
window.SQ = window.SQ || {};
SQ.boot = SQ.boot || (function(){
  const ran = new Set();
  const inflight = new Map();

  function afterPaint(fn){
    try{

  
        requestAnimationFrame(()=>{ setTimeout(()=>{ try{ fn && fn(); }catch(e){ console.error('[SQ][boot] afterPaint task failed', e); } }, 0); });
    }catch(e){
      // Fallback: run soon
      setTimeout(()=>{ try{ fn && fn(); }catch(err){ console.error('[SQ][boot] afterPaint fallback failed', err); } }, 0);
    }
  }

  function queueTask(name, fn){
    if(!name || typeof fn !== 'function') return Promise.resolve(false);
    if(ran.has(name)) return Promise.resolve(false);
    if(inflight.has(name)) return inflight.get(name);

    const p = Promise.resolve().then(async ()=>{
      try{
        const out = await fn();
        ran.add(name);
        return out;
      }catch(e){
        console.error('[SQ][boot] task failed:', name, e);
        return false;
      }finally{
        inflight.delete(name);
      }
    });

    inflight.set(name, p);
    return p;
  }

  function markRan(name){ try{ ran.add(name); }catch(_){ } }

  return { afterPaint, queueTask, markRan };
})();
// <<< PATCH:SQ_STAGE3C_BOOT_SCHEDULER END

// >>> PATCH:SQ_STAGE3C2_POLL_SCHEDULER START
// Unified poll/timer scheduler (Mobile Safari friendly):
// - single interval tick
// - pauses when tab hidden
// - per-task cadence + exponential backoff on errors
SQ.boot = SQ.boot || {};
SQ.boot.poller = SQ.boot.poller || (function(){
  const tasks = new Map(); // name -> {fn,everyMs,lastRun,nextAt,failCount,enabled}
  let _iv = null;
  let _tickMs = 250;

  function _now(){ return Date.now(); }

  function _hasEnabled(){
    for (const t of tasks.values()) if (t && t.enabled) return true;
    return false;
  }

  function _stop(){
    if (_iv){ try{ clearInterval(_iv); }catch(_){} _iv=null; }
  }

  function _start(){
    if (_iv) return;
    if (!_hasEnabled()) return;
    _iv = setInterval(_tick, _tickMs);
  }

  function _tick(){
    if (document && document.hidden) return;
    const now = _now();
    for (const [name, t] of tasks.entries()){
      if (!t || !t.enabled) continue;
      const due = (t.nextAt || 0);
      if (now < due) continue;

      // cadence guard
      if (t.lastRun && (now - t.lastRun) < (t.everyMs - 5)) continue;

      t.lastRun = now;
      // precompute nextAt assuming success
      t.nextAt = now + t.everyMs;

      try{
        const out = t.fn();
        // allow async
        if (out && typeof out.then === 'function'){
          out.then(()=>{ t.failCount = 0; }).catch((e)=>{
            t.failCount = Math.min((t.failCount||0) + 1, 6);
            const backoff = Math.min(t.everyMs * (2 ** t.failCount), 60000);
            t.nextAt = _now() + backoff;
            console.warn('[SQ][poller] task failed (async):', name, e);
          });
        } else {
          t.failCount = 0;
        }
      }catch(e){
        t.failCount = Math.min((t.failCount||0) + 1, 6);
        const backoff = Math.min(t.everyMs * (2 ** t.failCount), 60000);
        t.nextAt = _now() + backoff;
        console.warn('[SQ][poller] task failed:', name, e);
      }
    }
  }

  function register(name, fn, everyMs, opts){
    if (!name || typeof fn !== 'function') return false;
    const ms = Math.max(50, Number(everyMs||0) || 1000);
    const enabled = (opts && opts.enabled === false) ? false : true;
    const existing = tasks.get(name);
    tasks.set(name, {
      fn,
      everyMs: ms,
      lastRun: existing ? existing.lastRun : 0,
      nextAt: _now() + (opts && opts.immediate ? 0 : ms),
      failCount: existing ? existing.failCount : 0,
      enabled
    });
    _start();
    return true;
  }

  function unregister(name){
    if (!name) return false;
    tasks.delete(name);
    if (!_hasEnabled()) _stop();
    return true;
  }

  function enable(name, on){
    const t = tasks.get(name);
    if (!t) return false;
    t.enabled = !!on;
    if (t.enabled){
      t.nextAt = _now();
      _start();
    } else {
      if (!_hasEnabled()) _stop();
    }
    return true;
  }

  // Pause/resume based on visibility for battery + smoothness
  try{
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden) _stop();
      else _start();
    }, { passive:true });
    window.addEventListener('pagehide', _stop, { passive:true });
    window.addEventListener('pageshow', ()=>{ if (!document.hidden) _start(); }, { passive:true });
  }catch(_){}

  return { register, unregister, enable };
})();
// <<< PATCH:SQ_STAGE3C2_POLL_SCHEDULER END

// ===== SQ NAV INDEX (CTRL+F KEYS) =====
/*
  STYLE
  - @CSS:TOKENS
  - @CSS:HOME
  - @CSS:MODALS
  - @CSS:TICKER
  - @CSS:THROWPAD_DT_BULL

  HTML (STATIC DOM)
  - @HTML:SCREENS
  - @HTML:MODALS
  - @HTML:ADMIN

  JS (CORE)
  - @JS:BOOT
  - @JS:UTIL:UI_MUTATION_BUS
  - @JS:UI:HOME
  - @JS:UI:ADMIN
  - @JS:UI:STATS_ROUTER
  - @JS:UI:LIVE_UPDATES_VIDE
  - @JS:UI:GAMEPLAY:AUTOSCROLL
  - @JS:UI:GAMEPLAY:THROWPAD

  CLOUD
  - @JS:CLOUD:SUPABASE_INIT
  - @JS:CLOUD:PLAYERS
  - @JS:CLOUD:GAMES
  - @JS:CLOUD:HIGHSCORES

  MODALS (LEAGUE / STATS)
  - @JS:MODAL:LEAGUE_RANKINGS
  - @JS:MODAL:HIGH_SCORE_LEAGUE
  - @JS:MODAL:PREMIER_LEAGUE
  - @JS:MODAL:TOP_50_SCORES
  - @JS:MODAL:ROUND_HIGH_SCORES
  - @JS:MODAL:LATEST_SCORES
  - @JS:MODAL:PLAYER_LATEST_MATCHES

  PATCHES
  - @PATCHES:REGISTRY
  - @PATCH:<name>  (search the patch name exactly as printed)
*/
// ===== @JS:BOOT =====
