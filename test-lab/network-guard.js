/* SC-060 only: deployed in test-lab-dist, never the public dist. */
(function(){
  'use strict';
  if (window.__SQ_TEST_LAB) return;
  const log=[];
  const flags=Object.freeze({active:true,environment:'OFFLINE TEST LAB',persistentTruth:false});
  Object.defineProperty(window,'__SQ_TEST_LAB',{value:flags,configurable:false,writable:false});
  Object.defineProperty(window,'__SQ_TEST_LAB_NETWORK_LOG',{value:log,configurable:false});
  function urlOf(input) {
    try{return new URL(typeof input==='string'?input:input?.url||String(input),location.href);}
    catch(_){return null;}
  }
  function blocked(kind,url) {
    if(log.length<60)log.push({kind,host:url?.hostname||'unresolved'});
    return new TypeError('SC-060: external network blocked in Test Lab');
  }
  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const u=urlOf(input);
    if(!u)return Promise.reject(blocked('fetch',null));
    if(u.origin===location.origin)return nativeFetch(input,init);
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    if(u.hostname.endsWith('.supabase.co')&&u.pathname.startsWith('/rest/v1/')){
      // Simulated EMPTY read, not a network request or a source of true records.
      if(method==='GET')return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json','Content-Range':'*/0'}}));
      if(method==='HEAD')return Promise.resolve(new Response(null,{status:200,headers:{'Content-Range':'*/0'}}));
      if(method==='OPTIONS')return Promise.resolve(new Response(null,{status:204}));
    }
    return Promise.reject(blocked('fetch',u));
  };
  const originalOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,resource){
    const u=urlOf(resource);
    if(!u||u.origin!==location.origin)throw blocked('xhr',u);
    return originalOpen.apply(this,arguments);
  };
  for(const name of ['WebSocket','EventSource']){
    const Native=window[name];
    if(typeof Native!=='function')continue;
    window[name]=new Proxy(Native,{construct(Target,args){
      const u=urlOf(args[0]);
      if(!u||u.origin!==location.origin)throw blocked(name,u);
      return Reflect.construct(Target,args);
    }});
  }
  try{Object.defineProperty(navigator,'sendBeacon',{configurable:true,value:function(url){
    const u=urlOf(url);
    if(!u||u.origin!==location.origin){blocked('beacon',u);return false;}
    return false; // No Test Lab beacons, including local endpoints.
  }});}catch(_){}
  try{if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('SC-060: no service worker in Test Lab'));}catch(_){}
})();
