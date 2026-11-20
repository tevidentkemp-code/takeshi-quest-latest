
(function(){
  var reportFn = window.__sqPlayerCacheReport;
  var syncFn = window.__sqSyncPlayerCacheFromCloud;
  window.sqPlayerCacheReport = function(){
    if (typeof reportFn !== 'function') return { ok:false, reason:'__sqPlayerCacheReport missing' };
    return reportFn.apply(window, arguments);
  };
  window.sqSyncPlayerCacheFromCloud = function(){
    if (typeof syncFn !== 'function') return Promise.resolve({ ok:false, reason:'__sqSyncPlayerCacheFromCloud missing' });
    return syncFn.apply(window, arguments);
  };
  console.info('[SQ] Player cache safe console aliases active: sqPlayerCacheReport(), sqSyncPlayerCacheFromCloud()');
})();
