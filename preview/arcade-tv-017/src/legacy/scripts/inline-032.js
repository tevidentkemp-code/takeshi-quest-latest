
(function(){
  'use strict';
  if(window.__sqFix126PracticeGeometryLock) return;
  window.__sqFix126PracticeGeometryLock = true;

  function isSoloPractice(){
    try{
      var players = Array.isArray(window.state && state.players) ? state.players : [];
      if(players.length !== 1) return false;
      var m = (state && state.match) || {};
      var mode = String(state.mode || state.gameMode || m.mode || m.gameMode || '').toLowerCase();
      return mode.indexOf('practice') >= 0 || m.isPractice === true || m.is_practice === true || state.isPractice === true || state.is_practice === true || players.length === 1;
    }catch(_){ return false; }
  }

  function ensureReservedSep(rows){
    try{
      if(!rows) return;
      var active = rows.querySelector('.v2Badge.active');
      if(!active) return;
      var label = String(active.textContent || '').trim();
      if(label !== '10') return;
      var prev = active.previousElementSibling;
      var hasSep = prev && prev.classList && (prev.classList.contains('v2Sep') || prev.classList.contains('sq126-reserved-sep'));
      if(hasSep) return;
      var sepNo = document.createElement('div');
      sepNo.className = 'v2SepNo sq126-reserved-sep';
      var sep = document.createElement('div');
      sep.className = 'v2Sep sq126-reserved-sep';
      rows.insertBefore(sepNo, active);
      rows.insertBefore(sep, active);
    }catch(_){ }
  }

  function setImp(el, prop, val){ try{ if(el && el.style) el.style.setProperty(prop, val, 'important'); }catch(_){ } }

  function lockGeometry(){
    try{
      var panel = document.getElementById('liveV2Panel') || document.querySelector('.livev2panel');
      if(!panel) return false;
      var game = panel.querySelector('.v2GameCell');
      var scores = panel.querySelector('.v2Scores');
      var wrap = panel.querySelector('.v2RowsWrap');
      var scroller = panel.querySelector('.v2RowsScroller');
      var rows = panel.querySelector('#v2Rows, .v2Rows');
      var next = panel.querySelector('.v2NextRow');
      if(!game || !scores || !wrap || !rows) return false;

      if(!isSoloPractice()){
        panel.classList.remove('sq126-solo-practice-geometry');
        return false;
      }

      panel.classList.add('sq126-solo-practice-geometry');
      panel.style.setProperty('--sqV2RowsWinH', '220px', 'important');
      panel.style.setProperty('--sq126ScoresH', '110px', 'important');
      panel.style.setProperty('--sq126RowsH', '220px', 'important');
      ensureReservedSep(rows);

      setImp(game, 'display', 'grid');
      setImp(game, 'grid-template-rows', '110px 220px 0px');
      setImp(game, 'row-gap', '12px');
      setImp(game, 'height', '368px');
      setImp(game, 'min-height', '368px');
      setImp(game, 'max-height', '368px');
      setImp(game, 'box-sizing', 'border-box');
      setImp(game, 'overflow', 'hidden');

      setImp(scores, 'height', '110px');
      setImp(scores, 'min-height', '110px');
      setImp(scores, 'max-height', '110px');
      setImp(scores, 'margin-bottom', '0px');
      setImp(scores, 'box-sizing', 'border-box');

      setImp(wrap, 'height', '220px');
      setImp(wrap, 'min-height', '220px');
      setImp(wrap, 'max-height', '220px');
      setImp(wrap, 'overflow', 'hidden');
      setImp(wrap, 'box-sizing', 'border-box');
      wrap.scrollTop = 0;

      if(scroller){
        setImp(scroller, 'height', '100%');
        setImp(scroller, 'min-height', '100%');
        setImp(scroller, 'max-height', '100%');
        setImp(scroller, 'overflow', 'hidden');
      }
      setImp(rows, 'height', '100%');
      setImp(rows, 'min-height', '100%');
      setImp(rows, 'max-height', '100%');
      setImp(rows, 'overflow', 'hidden');
      if(next){
        setImp(next, 'display', 'none');
        setImp(next, 'height', '0px');
        setImp(next, 'min-height', '0px');
        setImp(next, 'max-height', '0px');
        setImp(next, 'padding', '0px');
        setImp(next, 'margin', '0px');
        try{ next.innerHTML=''; next.setAttribute('aria-hidden','true'); }catch(_){ }
      }
      try{ if(typeof window.__sqApplyPracticePbCompare === 'function') window.__sqApplyPracticePbCompare(); }catch(_){ }
      return true;
    }catch(e){ try{ console.warn('[SQ] Fix126 practice geometry lock failed', e); }catch(_){ } return false; }
  }

  window.__sqApplyPracticeGeometryLock126 = lockGeometry;
  window.__sqPracticeGeometryDebug = function(){
    var panel = document.getElementById('liveV2Panel') || document.querySelector('.livev2panel');
    var game = panel && panel.querySelector('.v2GameCell');
    var wrap = panel && panel.querySelector('.v2RowsWrap');
    var rows = panel && panel.querySelector('#v2Rows, .v2Rows');
    var info = {soloPractice:isSoloPractice(), panelClass:panel&&panel.className, gameH:game&&game.getBoundingClientRect().height, wrapH:wrap&&wrap.getBoundingClientRect().height, rowsH:rows&&rows.getBoundingClientRect().height, cssRowsVar:panel&&getComputedStyle(panel).getPropertyValue('--sqV2RowsWinH'), rowChildren:rows&&rows.children.length};
    console.table(info);
    return info;
  };

  // Override the old measuring helper for solo practice. It was the main blocker: it measured
  // early blank rows and kept shrinking/growing --sqV2RowsWinH before the layout settled.
  try{
    var oldSetup = window.__sqSetupLiveV2RowsWindow;
    if(typeof oldSetup === 'function' && !oldSetup.__sqFix126Wrapped){
      window.__sqSetupLiveV2RowsWindow = function(panel){
        if(isSoloPractice()){
          try{ (panel || document.getElementById('liveV2Panel') || document.querySelector('.livev2panel')).style.setProperty('--sqV2RowsWinH','220px','important'); }catch(_){ }
          lockGeometry();
          return;
        }
        return oldSetup.apply(this, arguments);
      };
      window.__sqSetupLiveV2RowsWindow.__sqFix126Wrapped = true;
      try{ __sqSetupLiveV2RowsWindow = window.__sqSetupLiveV2RowsWindow; }catch(_){ }
    }
  }catch(_){ }

  try{
    var oldRender = window.liveV2Render;
    if(typeof oldRender === 'function' && !oldRender.__sqFix126Wrapped){
      window.liveV2Render = function(){
        var ret = oldRender.apply(this, arguments);
        lockGeometry();
        requestAnimationFrame(function(){ lockGeometry(); });
        setTimeout(lockGeometry, 30);
        setTimeout(lockGeometry, 120);
        return ret;
      };
      window.liveV2Render.__sqFix126Wrapped = true;
      try{ liveV2Render = window.liveV2Render; }catch(_){ }
    }
  }catch(_){ }

  ['click','pointerup','touchend','keyup'].forEach(function(evt){
    document.addEventListener(evt, function(){ setTimeout(lockGeometry, 0); setTimeout(lockGeometry, 80); }, true);
  });

  var mo = new MutationObserver(function(){ setTimeout(lockGeometry, 0); });
  try{ mo.observe(document.documentElement, {childList:true, subtree:true}); }catch(_){ }
  setInterval(lockGeometry, 300);
  setTimeout(lockGeometry, 50);
  setTimeout(lockGeometry, 300);
  try{ console.info('[SQ] Fix126 Practice geometry canonical lock active; Fix123-125 retired.'); }catch(_){ }
})();
