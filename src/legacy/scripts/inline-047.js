
// Measure the fixed controls instead of assuming their height: D/T/B layouts
// and Safari's changing viewport leave different amounts of usable space.
(function(){
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(fit); };
  function fit(){
    raf = 0;
    if (document.body.dataset.page !== 'game' || !document.body.classList.contains('livev2-on') || document.body.classList.contains('livev3-on')) return;
    const panel = document.getElementById('liveV2Panel');
    const pager = panel && panel.querySelector('.v2InfoPager');
    const pad = document.getElementById('padBar');
    if (!pager || !pad || !pager.offsetHeight || !pad.offsetHeight) return;
    const box = panel.getBoundingClientRect(), pageBox = pager.getBoundingClientRect();
    const scale = pageBox.height / pager.offsetHeight || 1;
    const viewport = window.visualViewport;
    const bottom = Math.min(pad.getBoundingClientRect().top, viewport ? viewport.height + viewport.offsetTop : innerHeight);
    const height = Math.max(126, Math.min(900, Math.floor(pager.offsetHeight + (bottom - box.bottom - 10) / scale));
    if (Math.abs(height - pager.offsetHeight) > 1) panel.style.setProperty('--sqClassicRaceHeight', height + 'px');
  }
  const observer = new ResizeObserver(schedule);
  ['liveV2Panel','padBar'].forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node); });
  new MutationObserver(schedule).observe(document.body, {attributes:true, attributeFilter:['class','data-page']});
  window.addEventListener('resize', schedule, {passive:true});
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule, {passive:true});
  schedule();
})();

/* >>> PATCH:SC031_ADMIN_SERVER_BOUNDARY_LOADER START */
(function(){
  if (window.__sqAdminSecurityScriptRequested) return;
  window.__sqAdminSecurityScriptRequested = true;
  var script = document.createElement('script');
  script.src = './src/services/admin-security.js';
  script.async = false;
  script.onerror = function(){
    window.__sqAdminAuthed = false;
    console.error('SC-031 admin security service failed to load');
  };
  document.head.appendChild(script);
})();
/* <<< PATCH:SC031_ADMIN_SERVER_BOUNDARY_LOADER END */
