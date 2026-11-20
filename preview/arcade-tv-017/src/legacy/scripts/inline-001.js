
(function(){
  function __sqSetVh(){
    try{
      var vv = window.visualViewport;
      var h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--sqVh', (h * 0.01) + 'px');
    }catch(e){}
  }
  __sqSetVh();
  try{ window.addEventListener('resize', __sqSetVh, { passive:true }); }catch(e){}
  try{
    if (window.visualViewport){
      window.visualViewport.addEventListener('resize', __sqSetVh, { passive:true });
      window.visualViewport.addEventListener('scroll', __sqSetVh, { passive:true });
    }
  }catch(e){}
  try{ document.addEventListener('visibilitychange', function(){ if(!document.hidden) __sqSetVh(); }, { passive:true }); }catch(e){}
})();

/* SC-004 authenticated administrator entry point. */
(function(){
  function openAuthenticatedAdmin(){
    if (!window.SQ_ADMIN_AUTH) return;
    return window.SQ_ADMIN_AUTH.require().then(()=>{
      const open=window.__sqOriginalOpenAdminHub || window.__openAdminHubUnsafe;
      if (typeof open==='function') return open();
    }).catch(e=>{ if (typeof toast==='function') toast(e.message || 'Admin sign-in failed'); });
  }
  openAuthenticatedAdmin.__sqIsGated=true;
  function boot(){
    const existing=window.__sqOriginalOpenAdminHub || window.__openAdminHubUnsafe || window.openAdminHub;
    if (typeof existing==='function' && existing!==openAuthenticatedAdmin) window.__sqOriginalOpenAdminHub=existing;
    window.openAdminHub=openAuthenticatedAdmin;
    window.openAdminPasswordModal=openAuthenticatedAdmin;
    try{openAdminHub=openAuthenticatedAdmin;}catch(_){}
    ['adminBtn','adminCodeBtn'].forEach(id=>{
      const button=document.getElementById(id);
      if(button)button.onclick=event=>{event.preventDefault();openAuthenticatedAdmin();};
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',boot);
})();
