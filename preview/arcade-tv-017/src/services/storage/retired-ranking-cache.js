
(function(){
  if (window.__sqFix62RetireRankingLocalStorage) return;
  window.__sqFix62RetireRankingLocalStorage = true;

  const RETIRED_RANK_KEYS = [
    'hsLeaguePositions.v2',
    'powerRankings.allTime.lastRanks',
    'powerRankings.current.lastRanks',
    'powerRankings.lastRanks',
    'powerLeague.lastRanks'
  ];

  function rawGet(k){
    try{
      const nativeGet = window.__sqNativeLocalStorageGetItem || Storage.prototype.getItem;
      return nativeGet.call(localStorage, k);
    }catch(_){ return null; }
  }
  function rawRemove(k){
    try{
      const nativeRemove = window.__sqNativeLocalStorageRemoveItem || Storage.prototype.removeItem;
      nativeRemove.call(localStorage, k);
      return true;
    }catch(_){ return false; }
  }

  window.__sqPurgeRetiredRankingLocalStorageKeys = function __sqPurgeRetiredRankingLocalStorageKeys(){
    const rows = RETIRED_RANK_KEYS.map(key => {
      const before = rawGet(key);
      const existed = before != null;
      const removed = existed ? rawRemove(key) : false;
      return { key, existed, removed, bytes: before ? String(before).length : 0 };
    });
    try{ console.table(rows); }catch(_){ console.log(rows); }
    return rows;
  };

  try{
    const rows = window.__sqPurgeRetiredRankingLocalStorageKeys();
    if (rows.some(r => r.removed)) console.info('[SQ] Retired local ranking caches purged; rankings now use canonical/cloud-derived truth.');
    else console.info('[SQ] No retired local ranking caches present.');
  }catch(e){ console.warn('[SQ] Retired ranking cache purge failed', e); }
})();
