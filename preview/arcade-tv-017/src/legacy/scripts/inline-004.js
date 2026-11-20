
(function(){
  if (window.__sqFix17PadFxStronger) return;
  window.__sqFix17PadFxStronger = true;
  function retrigger(el, cls, ms){
    try{ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function(){ try{ el.classList.remove(cls); }catch(_){} }, ms || 720); }catch(_){ }
  }

  // SC-032: stronger button feedback only.
  // Do not hard-clear or write DMD scenes here; the authoritative gameplay/DMD path
  // owns Miss/Undo presentation and inline-007 retains the renderer-level fallback.
  document.addEventListener('pointerdown', function(e){
    try{
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var act = String(btn.getAttribute('data-act') || '').toLowerCase();
      var txt = String(btn.textContent || btn.getAttribute('aria-label') || btn.title || '').toUpperCase();
      if (btn.classList.contains('dtX3') || /MISS\s*x\s*[123]/i.test(txt)){
        retrigger(btn, 'sq-padfx-miss-hard', 760);
        return;
      }
      if (act === 'undo' || btn.classList.contains('undo') || txt.indexOf('UNDO') !== -1){
        retrigger(btn, 'sq-padfx-undo-hard', 420);
        return;
      }
    }catch(_){ }
  }, true);
})();
