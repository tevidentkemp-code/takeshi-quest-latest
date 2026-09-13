
(function(){
  if (window.__sqFix16B3PadFx) return;
  window.__sqFix16B3PadFx = true;

  function pulse(el, cls){
    try{
      if (!el) return;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      setTimeout(function(){ try{ el.classList.remove(cls); }catch(_){} }, 460);
    }catch(_){ }
  }

  function missCountFromButton(btn){
    try{
      var n = Number(btn && btn.dataset ? btn.dataset.missN : 0);
      if (n >= 1 && n <= 3) return n;
      var txt = String(btn ? btn.textContent || '' : '');
      var m = txt.match(/x\s*([123])/i);
      if (m) return Number(m[1]);
      var dart = (window.state && typeof window.state.currentDart === 'number') ? window.state.currentDart : 0;
      return Math.max(1, Math.min(3, 3 - dart));
    }catch(_){ return 1; }
  }

  function showMissDmd(n){
    try{
      if (!window.sqDmdShowZones) return;
      var label = n > 1 ? ('MISS x' + n) : 'MISS';
      window.sqDmdShowZones({ z2: label, z3: '' }, { type:'flash', ms:180, fx:'impact' });
      for (var i=1; i<=n; i++){
        (function(k){
          setTimeout(function(){
            try{
              var xs = Array(k).fill('X').join(' / ');
              window.sqDmdShowZones({ z2: label, z3: xs, z3Small:true }, { type:'flash', ms:150, fx:'impact' });
            }catch(_){ }
          }, 90 + (k * 95));
        })(i);
      }
    }catch(_){ }
  }

  document.addEventListener('click', function(e){
    try{
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      if (btn.classList.contains('dtActBtn') && btn.classList.contains('miss')){
        pulse(btn, 'sq-padfx-miss');
        showMissDmd(1);
        return;
      }
      if (btn.classList.contains('dtActBtn') && btn.classList.contains('undo')){
        pulse(btn, 'sq-padfx-undo');
        try{ window.sqDmdShowZones && window.sqDmdShowZones({ z2:'UNDO', z3:'<<<<' }, { type:'wipe', dir:'rev', ms:360, revealMs:100 }); }catch(_){ }
        return;
      }
      if (btn.classList.contains('dtActBtn') && btn.classList.contains('skip')){
        pulse(btn, 'sq-padfx-skip');
        return;
      }
    }catch(_){ }
  }, true);
})();
