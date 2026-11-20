
(function(){
  if(window.__sqFix67RecoveryCacheGuard) return;
  window.__sqFix67RecoveryCacheGuard = true;
  var RECOVERY_KEYS = ['shateki_quest_scorer_v6','sq_match_active_v1'];
  function rawGet(k){ try{ var fn = window.__sqNativeLocalStorageGetItem || Storage.prototype.getItem; return fn.call(localStorage, k); }catch(_){ return null; } }
  function rawRemove(k){ try{ var fn = window.__sqNativeLocalStorageRemoveItem || Storage.prototype.removeItem; fn.call(localStorage, k); return true; }catch(_){ return false; } }
  function parse(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(_){ return null; } }
  function isRecoverableState(obj){
    return typeof __sqIsRecoverableGameStateForLocalCache === 'function' &&
      __sqIsRecoverableGameStateForLocalCache(obj);
  }
  window.__sqRecoveryCacheReport = function(){
    var rows = RECOVERY_KEYS.map(function(k){ var raw = rawGet(k); var obj = parse(raw); return { key:k, exists:raw != null, bytes:raw ? String(raw).length : 0, players:Array.isArray(obj && obj.players) ? obj.players.length : null, finished:!!(obj && obj.finished), gameAwarded:!!(obj && obj.gameAwarded), matchCompleted:!!(obj && obj.match && obj.match.completedLogged), recoverable:isRecoverableState(obj), action:raw == null ? 'none' : (isRecoverableState(obj) ? 'keep-for-recovery' : 'purge-stale-or-completed') }; });
    try{ console.table(rows); }catch(_){ console.log(rows); }
    return rows;
  };
  window.__sqPurgeStaleRecoveryCaches = function(){
    var rows = RECOVERY_KEYS.map(function(k){ var raw = rawGet(k); var obj = parse(raw); var shouldRemove = raw != null && !isRecoverableState(obj); var removed = shouldRemove ? rawRemove(k) : false; return { key:k, existed:raw != null, removed:removed, reason: raw == null ? 'missing' : (shouldRemove ? 'not recoverable/completed/base state' : 'valid in-progress recovery') }; });
    try{ console.table(rows); }catch(_){ console.log(rows); }
    return rows;
  };
  window.__sqClearRecoveryCachesAfterCompletedSave = function(source){
    var rows = RECOVERY_KEYS.map(function(k){ var existed = rawGet(k) != null; var removed = existed ? rawRemove(k) : false; return { key:k, existed:existed, removed:removed, source:source || 'completed-save' }; });
    try{ console.info('[SQ] Recovery cache cleared after completed save', rows); }catch(_){ }
    return rows;
  };
  window.sqRecoveryCacheReport = window.__sqRecoveryCacheReport;
  window.sqPurgeStaleRecoveryCaches = window.__sqPurgeStaleRecoveryCaches;
  try{ if(typeof __sqIsRecoverableGameStateForLocalCache === 'function') window.__sqPurgeStaleRecoveryCaches(); }catch(_){ }
})();
