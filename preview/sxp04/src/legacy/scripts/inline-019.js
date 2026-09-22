
/* Auto-scroll live round row with extra bottom clearance, fixing the 13→14 half-hidden row edge case. */
(function(){
  if(window.__sqFix41AutoScrollBound) return;
  window.__sqFix41AutoScrollBound = true;
  function snapLiveRound(){
    try{
      if(document.body.dataset.page !== 'game') return;
      const wrap = document.querySelector('.livev2panel .v2RowsWrap');
      // Geometry/scroll follows the table's live row. During catch-up the
      // orange .active badge may point at an older missed round and must not
      // drag the viewport backwards.
      const live = document.querySelector('.livev2panel .v2Badge.liveRow');
      if(!wrap || !live) return;
      const bottomPad = 22;
      const target = Math.max(0, live.offsetTop + live.offsetHeight - wrap.clientHeight + bottomPad);
      if(Math.abs(wrap.scrollTop - target) > 4) wrap.scrollTop = target;
    }catch(_){ }
  }
  const oldLiveV2Render = window.liveV2Render;
  if(typeof oldLiveV2Render === 'function' && !oldLiveV2Render.__sqFix41Wrapped){
    window.liveV2Render = function(){
      const ret = oldLiveV2Render.apply(this, arguments);
      requestAnimationFrame(()=>requestAnimationFrame(snapLiveRound));
      return ret;
    };
    window.liveV2Render.__sqFix41Wrapped = true;
    try{ liveV2Render = window.liveV2Render; }catch(_){ }
  }
  ['click','pointerup','touchend'].forEach(evt=>{
    document.addEventListener(evt, function(e){
      try{ if(e.target && e.target.closest && e.target.closest('.pad-bar')) setTimeout(snapLiveRound, 90); }catch(_){ }
    }, {passive:true});
  });
})();
