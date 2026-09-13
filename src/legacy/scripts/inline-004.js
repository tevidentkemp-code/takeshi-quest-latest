
(function(){
  if (window.__sqFix17PadFxStronger) return;
  window.__sqFix17PadFxStronger = true;
  function retrigger(el, cls, ms){
    try{ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function(){ try{ el.classList.remove(cls); }catch(_){} }, ms || 720); }catch(_){ }
  }
  function getMissN(btn){
    try{
      var n = Number(btn && btn.dataset ? (btn.dataset.missN || btn.dataset.n || 0) : 0);
      if (n >= 1 && n <= 3) return n;
      var txt = String(btn ? (btn.textContent || btn.getAttribute('aria-label') || btn.title || '') : '');
      var m = txt.match(/x\s*([123])/i);
      if (m) return Number(m[1]);
      return 1;
    }catch(_){ return 1; }
  }
  function hardMissDmd(n){
    try{
      if (!window.sqDmdShowZones) return;
      try{ window.__sqDmdHardClearQueue && window.__sqDmdHardClearQueue(); }catch(_){ }
      var label = n > 1 ? ('MISS x' + n) : 'MISS';
      window.sqDmdShowZones({ z2: label, z3: '!!!' }, { type:'flash', ms:160, fx:'impact' });
      for (var i=1; i<=n; i++){
        (function(k){ setTimeout(function(){ try{ window.sqDmdShowZones({ z2: label, z3: Array(k).fill('X').join(' / '), z3Small:true }, { type:'flash', ms:210, fx:'impact' }); }catch(_){ } }, 85 + ((k-1) * 115)); })(i);
      }
    }catch(_){ }
  }
  document.addEventListener('pointerdown', function(e){
    try{
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var act = String(btn.getAttribute('data-act') || '').toLowerCase();
      var txt = String(btn.textContent || btn.getAttribute('aria-label') || btn.title || '').toUpperCase();
      if (btn.classList.contains('dtX3') || /MISS\s*x\s*[123]/i.test(txt)){
        var n = getMissN(btn);
        retrigger(btn, 'sq-padfx-miss-hard', 760);
        hardMissDmd(n);
        return;
      }
      if (act === 'undo' || btn.classList.contains('undo') || txt.indexOf('UNDO') !== -1){
        retrigger(btn, 'sq-padfx-undo-hard', 420);
        return;
      }
    }catch(_){ }
  }, true);
})();
