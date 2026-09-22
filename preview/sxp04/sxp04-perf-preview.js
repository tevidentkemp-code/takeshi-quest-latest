(function(){
  'use strict';
  if (window.__sxp04PreviewPerf) return;
  window.__sxp04PreviewPerf = true;

  var samples = [];
  var longTasks = [];
  var pending = null;
  var seq = 0;
  var hud = null;
  var storageKey = 'sxp04_perf_samples:' + String(location.pathname || 'preview');

  function now(){ try { return performance.now(); } catch(_) { return Date.now(); } }
  function pct(values, p){
    if (!values.length) return 0;
    var a = values.slice().sort(function(x,y){ return x-y; });
    var i = Math.min(a.length-1, Math.max(0, Math.ceil((p/100)*a.length)-1));
    return Math.round(Number(a[i]||0)*10)/10;
  }
  function vals(kind){
    return samples.filter(function(s){ return !kind || s.kind===kind; }).map(function(s){ return s.ms; });
  }
  function perfVals(name){
    try{
      var report = window.sqPerfReport ? window.sqPerfReport() : null;
      var rows = report && Array.isArray(report.samples) ? report.samples : [];
      return rows.filter(function(s){ return s && s.name === name; }).map(function(s){ return Number(s.ms || 0); });
    }catch(_){ return []; }
  }
  function ensureHud(){
    if (hud && document.body && document.body.contains(hud)) return hud;
    if (!document.body) return null;
    hud = document.createElement('div');
    hud.id = 'sxp04PerfHud';
    hud.style.cssText = [
      'position:fixed','left:8px','right:8px','bottom:max(8px,env(safe-area-inset-bottom))',
      'z-index:2147483647','padding:9px 10px','border:1px solid rgba(255,122,0,.7)',
      'border-radius:9px','background:rgba(8,10,16,.94)','color:#fff',
      'font:600 11px/1.35 -apple-system,BlinkMacSystemFont,system-ui,sans-serif',
      'letter-spacing:.01em','box-shadow:0 4px 18px rgba(0,0,0,.35)','pointer-events:none',
      'white-space:pre-line'
    ].join(';');
    document.body.appendChild(hud);
    return hud;
  }
  function render(){
    var el = ensureHud(); if (!el) return;
    var all=vals(), normal=vals('normal'), bulk=vals('bulk-miss');
    var dom=samples.map(function(x){ return Number(x.domMs == null ? x.ms : x.domMs); });
    var record=perfVals('recordThrow.total'), live=perfVals('liveV2Render'), pad=perfVals('buildPad');
    el.textContent =
      'SXP-04 AFTER CANDIDATE • OFFLINE PREVIEW' +
      '\nPAINT  n='+all.length+'  p95 '+pct(all,95)+'ms  max '+pct(all,100)+'ms' +
      '\nDOM  n='+dom.length+'  p95 '+pct(dom,95)+'ms' +
      '\nNORMAL  n='+normal.length+'  p95 '+pct(normal,95)+'ms' +
      '\nMISS×N  n='+bulk.length+'  p95 '+pct(bulk,95)+'ms' +
      '\nRECORD THROW  n='+record.length+'  p95 '+pct(record,95)+'ms' +
      '\nLIVE RENDER  n='+live.length+'  p95 '+pct(live,95)+'ms' +
      '\nBUILD PAD  n='+pad.length+'  p95 '+pct(pad,95)+'ms' +
      '\nLONG TASKS  '+longTasks.length +
      '\nAfter 2–3 rounds: screenshot this panel.';
  }
  function controlKind(btn){
    if (!btn) return null;
    if (btn.classList.contains('dtX3')) return 'bulk-miss';
    if (btn.classList.contains('dtBullBtn') || btn.classList.contains('dtNumBtn')) return 'normal';
    if (btn.classList.contains('dtActBtn') && btn.classList.contains('miss')) return 'normal';
    return null;
  }
  function installObserver(){
    var host = document.getElementById('v2Rows');
    if (!host || host.__sxp04Observed) return false;
    host.__sxp04Observed = true;
    new MutationObserver(function(){
      if (!pending) return;
      var p = pending; pending = null;
      var domMs = Math.max(0, now()-p.t0);
      var raf = window.requestAnimationFrame || function(cb){ return setTimeout(cb,16); };
      raf(function(){
        samples.push({ id:p.id, kind:p.kind, control:p.control, domMs:domMs, ms:Math.max(0, now()-p.t0), ts:Date.now() });
        if (samples.length > 200) samples.shift();
        try { localStorage.setItem(storageKey, JSON.stringify(samples)); } catch(_){}
        render();
      });
    }).observe(host,{subtree:true,childList:true,characterData:true,attributes:true});
    return true;
  }

  document.addEventListener('click',function(e){
    try{
      var btn=e.target&&e.target.closest?e.target.closest('#pad button'):null;
      var kind=controlKind(btn);
      if(!kind) return;
      installObserver();
      pending={
        id:++seq,
        kind:kind,
        control:String(btn.getAttribute('aria-label')||btn.textContent||'').trim().replace(/\s+/g,' ').slice(0,48),
        t0:now()
      };
    }catch(_){}
  },true);

  try{
    if(typeof PerformanceObserver==='function' &&
       Array.isArray(PerformanceObserver.supportedEntryTypes) &&
       PerformanceObserver.supportedEntryTypes.indexOf('longtask')!==-1){
      var po=new PerformanceObserver(function(list){
        try{
          list.getEntries().forEach(function(e){ longTasks.push({duration:Number(e.duration||0),startTime:Number(e.startTime||0)}); });
          if(longTasks.length>100) longTasks=longTasks.slice(-100);
          render();
        }catch(_){}
      });
      po.observe({entryTypes:['longtask']});
    }
  }catch(_){}

  window.sxp04PerfReport=function(){
    return {
      samples:samples.slice(),
      longTasks:longTasks.slice(),
      summary:{
        all:{n:vals().length,p50:pct(vals(),50),p95:pct(vals(),95),p99:pct(vals(),99),max:pct(vals(),100)},
        normal:{n:vals('normal').length,p95:pct(vals('normal'),95)},
        bulkMiss:{n:vals('bulk-miss').length,p95:pct(vals('bulk-miss'),95)}
      }
    };
  };

  function boot(){
    try{ window.SQ_PERF_DEBUG = true; }catch(_){}
    try{
      var prior=JSON.parse(localStorage.getItem(storageKey)||'[]');
      if(Array.isArray(prior)) samples=prior.slice(-200);
    }catch(_){}
    ensureHud(); installObserver(); render();
    setInterval(function(){ try{ installObserver(); }catch(_){} },500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();