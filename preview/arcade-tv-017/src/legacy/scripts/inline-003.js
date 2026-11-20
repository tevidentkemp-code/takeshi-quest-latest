
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

  // SC-032: visual button feedback only.
  // DMD presentation is owned by the scoring engine / current DMD controller path.
  document.addEventListener('click', function(e){
    try{
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      if (btn.classList.contains('dtActBtn') && btn.classList.contains('miss')){
        pulse(btn, 'sq-padfx-miss');
        return;
      }
      if (btn.classList.contains('dtActBtn') && btn.classList.contains('undo')){
        pulse(btn, 'sq-padfx-undo');
        return;
      }
      if (btn.classList.contains('dtActBtn') && btn.classList.contains('skip')){
        pulse(btn, 'sq-padfx-skip');
        return;
      }
    }catch(_){ }
  }, true);
})();
