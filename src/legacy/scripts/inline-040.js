
(function(){
  'use strict';
  if (window.__sqFix167GameplayPerfMot) return;
  window.__sqFix167GameplayPerfMot = true;

  var __sqPerfUrlEnabled = false;
  try{ __sqPerfUrlEnabled = new URLSearchParams(window.location.search || '').get('sqperf') === '1'; }catch(_){}
  if (typeof window.SQ_PERF_DEBUG === 'undefined') window.SQ_PERF_DEBUG = __sqPerfUrlEnabled;
  else if (__sqPerfUrlEnabled) window.SQ_PERF_DEBUG = true;
  var samples = [];
  var inputSeq = 0;
  var pendingInput = null;
  var longTaskSupported = false;
  function now(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
  function push(name, ms, meta){
    if (!window.SQ_PERF_DEBUG) return;
    var row = { name:name, ms:Math.round(Number(ms || 0) * 100) / 100, ts:Date.now(), meta:meta || null };
    samples.push(row);
    if (samples.length > 240) samples.shift();
    try{ if (__sqPerfUrlEnabled) updateHud(); }catch(_){}
    try{ if (row.ms >= 12) console.debug('[SQ][PERF]', row.name, row.ms + 'ms', row.meta || ''); }catch(_){}
  }
  function measure(name, fn, meta){
    var t = now();
    try{ return fn(); }
    finally{ push(name, now() - t, meta); }
  }
  function percentile(values, p){
    if (!values.length) return 0;
    var sorted = values.slice().sort(function(a,b){ return a-b; });
    var idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Math.round(Number(sorted[idx] || 0) * 100) / 100;
  }
  window.sqPerfReset = function(){
    samples.length = 0;
    pendingInput = null;
    return true;
  };
  function ensureHud(){
    try{
      if (!__sqPerfUrlEnabled || !document || !document.body) return null;
      var el = document.getElementById('sqPerfHud');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'sqPerfHud';
      el.setAttribute('aria-live','polite');
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.82);color:#fff;font:12px/1.25 -apple-system,BlinkMacSystemFont,sans-serif;max-width:min(92vw,360px);pointer-events:none;white-space:pre-line';
      el.textContent = 'SXP-04 PERF • collecting…';
      document.body.appendChild(el);
      return el;
    }catch(_){ return null; }
  }
  function updateHud(){
    try{
      var el = ensureHud();
      if (!el) return;
      var vals = samples.filter(function(s){ return s.name === 'input.tapToVisible'; }).map(function(s){ return Number(s.ms || 0); });
      var rt = samples.filter(function(s){ return s.name === 'recordThrow.total'; }).map(function(s){ return Number(s.ms || 0); });
      var lt = samples.filter(function(s){ return s.name === 'main.longtask'; }).map(function(s){ return Number(s.ms || 0); });
      el.textContent = 'SXP-04 PERF  n=' + vals.length +
        '\nTap→visible p50 ' + percentile(vals,50) + 'ms • p95 ' + percentile(vals,95) + 'ms' +
        '\nrecordThrow p95 ' + percentile(rt,95) + 'ms • long tasks ' + lt.length;
    }catch(_){}
  }
  window.sqPerfReport = function(){
    var grouped = {};
    samples.forEach(function(s){
      var g = grouped[s.name] || (grouped[s.name] = { name:s.name, count:0, total:0, max:0, last:0, values:[] });
      g.count++;
      g.total += s.ms;
      g.max = Math.max(g.max, s.ms);
      g.last = s.ms;
      g.values.push(s.ms);
    });
    var rows = Object.keys(grouped).map(function(k){
      var g = grouped[k];
      return {
        name:g.name,
        count:g.count,
        avg:Math.round((g.total / Math.max(1, g.count)) * 100) / 100,
        p50:percentile(g.values, 50),
        p95:percentile(g.values, 95),
        p99:percentile(g.values, 99),
        max:Math.round(g.max * 100) / 100,
        last:g.last
      };
    }).sort(function(a,b){ return b.max - a.max; });
    try{ console.table(rows); }catch(_){}
    try{ updateHud(); }catch(_){}
    return {
      debug:!!window.SQ_PERF_DEBUG,
      longTaskSupported:longTaskSupported,
      rows:rows,
      samples:samples.slice()
    };
  };

  // SXP-04 Gate 1: measurement-only accepted-input baseline.
  // Capture-phase click timestamp is immediately before the target button's onclick.
  // A sample is emitted only if recordThrow actually adds canonical history.
  document.addEventListener('click', function(e){
    try{
      if (!window.SQ_PERF_DEBUG) return;
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var isScore = btn.classList.contains('dtBullBtn') ||
                    btn.classList.contains('dtNumBtn') ||
                    btn.classList.contains('dtX3') ||
                    (btn.classList.contains('dtActBtn') && btn.classList.contains('miss'));
      if (!isScore) return;
      pendingInput = {
        id:++inputSeq,
        t0:now(),
        control:String(btn.getAttribute('aria-label') || btn.dataset.scoreLabel || btn.textContent || '').trim().replace(/\s+/g,' ').slice(0,48)
      };
    }catch(_){}
  }, true);

  try{
    if (typeof PerformanceObserver === 'function' &&
        Array.isArray(PerformanceObserver.supportedEntryTypes) &&
        PerformanceObserver.supportedEntryTypes.indexOf('longtask') !== -1){
      longTaskSupported = true;
      var __sqLongTaskObserver = new PerformanceObserver(function(list){
        try{
          list.getEntries().forEach(function(entry){
            push('main.longtask', Number(entry.duration || 0), { startTime:Number(entry.startTime || 0) });
          });
        }catch(_){}
      });
      __sqLongTaskObserver.observe({ entryTypes:['longtask'] });
    }
  }catch(_){}

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
      var historyBefore = 0, roundBefore = null, dartBefore = null, input = null;
      try{
        historyBefore = Array.isArray(state && state.history) ? state.history.length : 0;
        roundBefore = state && state.currentRound;
        dartBefore = state && state.currentDart;
      }catch(_){}
      try{
        if (pendingInput && (now() - Number(pendingInput.t0 || 0)) <= 2000) input = pendingInput;
      }catch(_){}
      var ret = measure('recordThrow.total', function(){ return oldRecordThrow.apply(ctx, args); }, {
        round:roundBefore,
        dart:dartBefore,
        kind:spec && (spec.kind || spec.sector || spec.bull)
      });
      try{
        var historyAfter = Array.isArray(state && state.history) ? state.history.length : historyBefore;
        if (input && pendingInput && pendingInput.id === input.id && historyAfter > historyBefore){
          pendingInput = null;
          var raf = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); };
          raf(function(){
            push('input.tapToVisible', now() - input.t0, {
              control:input.control,
              round:roundBefore,
              dart:dartBefore,
              kind:spec && (spec.kind || spec.sector || spec.bull),
              historyDelta:historyAfter - historyBefore
            });
          });
        }
      }catch(_){}
      return ret;
    };
    wrappedRecordThrow.__sqFix167Wrapped = true;
    // @CANONICAL:GAMEPLAY_RECORD_THROW_PERF_WRAPPER
    window.recordThrow = wrappedRecordThrow;
    try{ recordThrow = wrappedRecordThrow; }catch(_){}
  }

  try{
    if (__sqPerfUrlEnabled) {
      var bootHud = function(){ try{ ensureHud(); updateHud(); }catch(_){} };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootHud, {once:true});
      else bootHud();
    }
  }catch(_){}
  try{ console.info('[SQ] Fix167 gameplay perf MOT active'); }catch(_){}
})();
