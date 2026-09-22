
(function(){
  'use strict';
  if (window.__sqFix167GameplayPerfMot) return;
  window.__sqFix167GameplayPerfMot = true;

  if (typeof window.SQ_PERF_DEBUG === 'undefined') window.SQ_PERF_DEBUG = false;
  var samples = [];
  function now(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
  function push(name, ms, meta){
    if (!window.SQ_PERF_DEBUG) return;
    var row = { name:name, ms:Math.round(Number(ms || 0) * 100) / 100, ts:Date.now(), meta:meta || null };
    samples.push(row);
    if (samples.length > 240) samples.shift();
    try{ if (row.ms >= 12) console.debug('[SQ][PERF]', row.name, row.ms + 'ms', row.meta || ''); }catch(_){}
  }
  function measure(name, fn, meta){
    var t = now();
    try{ return fn(); }
    finally{ push(name, now() - t, meta); }
  }
  window.sqPerfReport = function(){
    var grouped = {};
    samples.forEach(function(s){
      var g = grouped[s.name] || (grouped[s.name] = { name:s.name, count:0, total:0, max:0, last:0 });
      g.count++;
      g.total += s.ms;
      g.max = Math.max(g.max, s.ms);
      g.last = s.ms;
    });
    var rows = Object.keys(grouped).map(function(k){
      var g = grouped[k];
      return {
        name:g.name,
        count:g.count,
        avg:Math.round((g.total / Math.max(1, g.count)) * 100) / 100,
        max:Math.round(g.max * 100) / 100,
        last:g.last
      };
    }).sort(function(a,b){ return b.max - a.max; });
    try{ console.table(rows); }catch(_){}
    return { debug:!!window.SQ_PERF_DEBUG, rows:rows, samples:samples.slice() };
  };

  function pageKey(){
    try{ return document.body && (document.body.getAttribute('data-page') || (document.body.dataset && document.body.dataset.page)) || ''; }
    catch(_){ return ''; }
  }
  function padEl(){
    try{ if (typeof pad !== 'undefined' && pad) return pad; }catch(_){}
    return document.getElementById('pad');
  }
  function missCount(){
    try{
      var dart = (typeof state !== 'undefined' && state && typeof state.currentDart === 'number') ? state.currentDart : 0;
      return Math.max(1, Math.min(3, 3 - dart));
    }catch(_){ return 3; }
  }
  function refreshPadLight(){
    try{
      var el = padEl();
      if (!el) return;
      var n = missCount();
      el.querySelectorAll('.dtX3').forEach(function(btn){
        btn.textContent = 'MISS\nx' + n;
        btn.dataset.missN = String(n);
      });
      try{
        if (typeof padHint !== 'undefined' && padHint) padHint.textContent = (typeof state !== 'undefined' && state && state.finished) ? 'Game finished.' : '';
      }catch(_){}
    }catch(_){}
  }
  function padSig(){
    try{
      var rIdx = Number(state && state.currentRound || 0);
      var r = (typeof ROUNDS !== 'undefined' && ROUNDS && ROUNDS[rIdx]) ? ROUNDS[rIdx] : null;
      return [
        pageKey(),
        state && state.finished ? 'done' : 'live',
        state && state.suddenDeath && state.suddenDeath.active ? 'sd' : '',
        state && state.players ? state.players.length : 0,
        rIdx,
        state && Number.isFinite(Number(state.currentPlayer)) ? Number(state.currentPlayer) : 0,
        r && r.type || '',
        r && r.target || ''
      ].join('|');
    }catch(_){ return 'unknown|' + Date.now(); }
  }

  var oldBuildPad = window.buildPad || (typeof buildPad === 'function' ? buildPad : null);
  if (oldBuildPad && !oldBuildPad.__sqFix167Wrapped){
    var lastPadSig = '';
    var wrappedBuildPad = function(){
      var sig = padSig();
      var el = padEl();
      if (sig && sig === lastPadSig && el && el.children && el.children.length && pageKey() === 'game'){
        refreshPadLight();
        push('buildPad.skip', 0, { sig:sig });
        return;
      }
      try{
        if (window.__sqNumPadX3Obs && typeof window.__sqNumPadX3Obs.disconnect === 'function') {
          window.__sqNumPadX3Obs.disconnect();
        }
        window.__sqNumPadX3Obs = null;
      }catch(_){}
      var ctx = this, args = arguments;
      var ret = measure('buildPad', function(){ return oldBuildPad.apply(ctx, args); }, { sig:sig });
      lastPadSig = padSig();
      refreshPadLight();
      return ret;
    };
    wrappedBuildPad.__sqFix167Wrapped = true;
    // @CANONICAL:THROWPAD_PERF_WRAPPER
    window.buildPad = wrappedBuildPad;
    try{ buildPad = wrappedBuildPad; }catch(_){}
  }

  var oldLiveV2Render = window.liveV2Render || (typeof liveV2Render === 'function' ? liveV2Render : null);
  if (oldLiveV2Render && !oldLiveV2Render.__sqFix167Wrapped){
    var liveQueued = false, liveThis = null, liveArgs = null;
    var wrappedLiveV2 = function(){
      liveThis = this;
      liveArgs = arguments;
      if (window.__sqLiveV2Immediate === true) {
        return measure('liveV2Render', function(){ return oldLiveV2Render.apply(liveThis, liveArgs); });
      }
      if (liveQueued) {
        push('liveV2Render.coalesced', 0);
        return;
      }
      liveQueued = true;
      var raf = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); };
      return raf(function(){
        liveQueued = false;
        measure('liveV2Render', function(){ return oldLiveV2Render.apply(liveThis, liveArgs); });
      });
    };
    wrappedLiveV2.__sqFix167Wrapped = true;
    // @CANONICAL:LIVE_V2_PERF_WRAPPER
    window.liveV2Render = wrappedLiveV2;
    try{ liveV2Render = wrappedLiveV2; }catch(_){}
  }

  var oldRecordThrow = window.recordThrow || (typeof recordThrow === 'function' ? recordThrow : null);
  if (oldRecordThrow && !oldRecordThrow.__sqFix167Wrapped){
    var wrappedRecordThrow = function(spec){
      var ctx = this, args = arguments;
      return measure('recordThrow.total', function(){ return oldRecordThrow.apply(ctx, args); }, {
        round:(typeof state !== 'undefined' && state) ? state.currentRound : null,
        dart:(typeof state !== 'undefined' && state) ? state.currentDart : null,
        kind:spec && (spec.kind || spec.sector || spec.bull)
      });
    };
    wrappedRecordThrow.__sqFix167Wrapped = true;
    // @CANONICAL:GAMEPLAY_RECORD_THROW_PERF_WRAPPER
    window.recordThrow = wrappedRecordThrow;
    try{ recordThrow = wrappedRecordThrow; }catch(_){}
  }

  try{ console.info('[SQ] Fix167 gameplay perf MOT active'); }catch(_){}
})();
