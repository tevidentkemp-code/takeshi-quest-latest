
/* >>> PATCH:PHASE1_FIX61_LOCALSTORAGE_REPORT_NOISE_AND_PURGE START */
(function(){
  if (window.__sqLocalStoragePolicyFix61Loaded) return;
  window.__sqLocalStoragePolicyFix61Loaded = true;

  var RETIRED_KEYS = ['sq_recent_completed_games_cache_v2'];

  function rawGetLS(key){
    try{
      // Deliberately avoid localStorage.getItem() because Fix59 wraps it to warn.
      // Policy reports must not create their own authority warnings.
      var v = window.localStorage[String(key)];
      return (typeof v === 'undefined') ? null : v;
    }catch(_){ return null; }
  }

  function shapeOf(raw){
    if(raw == null) return 'missing';
    try{
      var p = JSON.parse(raw);
      if(Array.isArray(p)) return 'json-array[' + p.length + ']';
      if(p && typeof p === 'object') return 'json-object{' + Object.keys(p).slice(0,5).join(',') + '}';
      return 'json-' + typeof p;
    }catch(_){ return String(raw).length > 80 ? 'string-long' : 'string'; }
  }

  function actionFor(policy){
    policy = String(policy || '');
    if(/^safe/.test(policy)) return 'keep';
    if(policy === 'retired-inspection-only') return 'purged-if-present';
    if(policy === 'deprecated-do-not-use') return 'retire-reader-then-delete';
    if(policy.indexOf('recovery') >= 0) return 'verify-recovery-only';
    if(policy.indexOf('cache-only') >= 0) return 'verify-cache-only';
    return 'inspect-read-write-path';
  }

  function policyFor(key){
    try{
      if (typeof window.__sqGetLocalStoragePolicy === 'function') return window.__sqGetLocalStoragePolicy(key);
      var p = window.__sqLocalStoragePolicy && window.__sqLocalStoragePolicy[key];
      if (p) return { key:key, policy:p[0], reason:p[1] };
      var safe = window.__sqLocalStorageSafePolicy && window.__sqLocalStorageSafePolicy[key];
      if (safe) return { key:key, policy:safe, reason:'known safe cache/preference key' };
    }catch(_){ }
    return { key:key, policy:'unclassified', reason:'' };
  }

  window.__sqPurgeRetiredLocalStorageKeys = function __sqPurgeRetiredLocalStorageKeys(){
    var rows = RETIRED_KEYS.map(function(key){
      var before = rawGetLS(key);
      var existed = before != null;
      try{ if (existed) window.localStorage.removeItem(key); }catch(_){ }
      var after = rawGetLS(key);
      return { key:key, existed:existed, removed:existed && after == null, bytes:before == null ? 0 : String(before).length };
    });
    try{ console.table(rows); }catch(_){ console.log(rows); }
    return rows;
  };

  window.__sqGetLocalStoragePolicyReport = function __sqGetLocalStoragePolicyReport(){
    var policyKeys = Object.keys(window.__sqLocalStoragePolicy || {});
    var safeKeys = Object.keys(window.__sqLocalStorageSafePolicy || {});
    var keys = policyKeys.concat(safeKeys).filter(function(k, i, arr){ return arr.indexOf(k) === i; });
    var rows = keys.map(function(key){
      var raw = rawGetLS(key);
      var p = policyFor(key);
      return {
        key:key,
        exists:raw != null,
        policy:p.policy || 'unclassified',
        action:actionFor(p.policy),
        reason:p.reason || '',
        bytes:raw == null ? 0 : String(raw).length,
        shape:shapeOf(raw)
      };
    });
    try{ console.table(rows); }catch(_){ console.log(rows); }
    return rows;
  };
  window.__sqPrintLocalStoragePolicyReport = window.__sqGetLocalStoragePolicyReport;

  // Purge the retired completed-game cache now that Supabase games rows are authoritative.
  try{
    var purgeRows = window.__sqPurgeRetiredLocalStorageKeys();
    if (purgeRows.some(function(r){ return r.removed; })) console.info('[SQ] Retired completed-game cache key purged.');
  }catch(_){ }
})();
/* <<< PATCH:PHASE1_FIX61_LOCALSTORAGE_REPORT_NOISE_AND_PURGE END */
