
(function(){
  'use strict';
  if (window.__sqFix153MotCacheModalGuard) return;
  window.__sqFix153MotCacheModalGuard = true;

  var TTL_MS = Math.max(5 * 60 * 1000, Number(window.__sqAllGamesFetchTtlMs) || 0);
  var cache = { at:0, rows:null, promise:null };

  function now(){ return Date.now ? Date.now() : +(new Date()); }
  function cloneRows(rows){ return Array.isArray(rows) ? rows.slice() : []; }

  function clearGamesCache(){
    cache.at = 0;
    cache.rows = null;
    cache.promise = null;
    try { if (typeof window.__sqInvalidateAllGamesFetchCache === 'function') window.__sqInvalidateAllGamesFetchCache('clearGamesTruthCache'); } catch(_) {}
    try { if (typeof window.__sqInvalidatePowerOfficialFetchCache === 'function') window.__sqInvalidatePowerOfficialFetchCache('clearGamesTruthCache'); } catch(_) {}
  }

  window.__sqClearGamesTruthCache = clearGamesCache;

  var originalGetAll = window.__sqGetAllGamesNormalized;
  var originalCloudFetch = window.cloudFetchAllGamesAsLocal;

  async function fetchNormalizedFresh(force){
    var rows = [];
    if (typeof originalCloudFetch === 'function') {
      rows = await originalCloudFetch.call(window, force ? { force:true } : undefined);
    } else if (typeof originalGetAll === 'function' && originalGetAll !== window.__sqGetAllGamesNormalizedCached) {
      rows = await originalGetAll.call(window);
    }
    if (typeof window.__sqDedupeNormalizedGames === 'function') {
      return window.__sqDedupeNormalizedGames(rows || []);
    }
    return Array.isArray(rows) ? rows : [];
  }

  window.__sqGetAllGamesNormalizedCached = async function __sqGetAllGamesNormalizedCached(force){
    var age = now() - cache.at;
    if (!force && cache.rows && age >= 0 && age < TTL_MS) return cloneRows(cache.rows);
    if (!force && cache.promise) return cloneRows(await cache.promise);

    cache.promise = fetchNormalizedFresh(force)
      .then(function(rows){
        cache.rows = Array.isArray(rows) ? rows : [];
        cache.at = now();
        return cache.rows;
      })
      .catch(function(e){
        cache.promise = null;
        throw e;
      });

    try { return cloneRows(await cache.promise); }
    finally { cache.promise = null; }
  };

  window.__sqGetAllGamesNormalized = window.__sqGetAllGamesNormalizedCached;

  // Mutating/saving game data must invalidate read cache. These wrappers are deliberately narrow.
  [
    'cloudInsertHighScore',
    'cloudInsertHighScoreIfMissing',
    'cloudDeleteGameCascade',
    'cloudArchiveGame',
    'cloudReinstateGame',
    'cloudPurgeGameCascade',
    'cloudRemovePlayerFromGame',
    'cloudRenamePlayerInGamesState',
    'saveGameToCloud',
    'cloudSaveCompletedGame'
  ].forEach(function(name){
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__sqFix153CacheWrapped) return;
    var wrapped = async function(){
      try { return await fn.apply(this, arguments); }
      finally { clearGamesCache(); }
    };
    wrapped.__sqFix153CacheWrapped = true;
    window[name] = wrapped;
    try { eval(name + ' = window[name]'); } catch(_) {}
  });

  function removeDuplicateLeagueOverlays(kind){
    try{
      var re = kind === 'top50' ? /^Top\s*50\s*Scores/i : kind === 'power' ? /^Power\s*Rankings/i : null;
      if (!re) return;
      var found = false;
      Array.prototype.slice.call(document.querySelectorAll('.modal-backdrop')).forEach(function(bd){
        var h = bd.querySelector && bd.querySelector('h1,h2,h3');
        var title = String((h && h.textContent) || '').trim();
        if (!re.test(title)) return;
        if (!found) { found = true; return; }
        try { bd.remove(); } catch(_) {}
      });
    }catch(_){}
  }

  function wrapModal(name, kind){
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__sqFix153ModalGuard) return;
    var wrapped = async function(){
      removeDuplicateLeagueOverlays(kind);
      var result = await fn.apply(this, arguments);
      setTimeout(function(){ removeDuplicateLeagueOverlays(kind); }, 0);
      setTimeout(function(){ removeDuplicateLeagueOverlays(kind); }, 120);
      return result;
    };
    wrapped.__sqFix153ModalGuard = true;
    window[name] = wrapped;
    try { eval(name + ' = window[name]'); } catch(_) {}
  }

  wrapModal('openTop50ScoresDialog', 'top50');
  wrapModal('openPowerLeagueDialog', 'power');
  wrapModal('openPowerRankingsDialog', 'power');

  try { console.info('[SQ] Fix153 MOT cache/modal guard active: one cloud games fetch per 45s window, guarded duplicate league overlays.'); } catch(_) {}
})();
