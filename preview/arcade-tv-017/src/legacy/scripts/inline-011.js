
(function(){
  if (window.__sqPlayerCacheVerifiedPatchLoaded) return;
  window.__sqPlayerCacheVerifiedPatchLoaded = true;
  var PLAYER_KEY = 'shateki_players';
  var lastSyncMeta = window.__sqPlayerCacheLastSync || null;
  function nowIso(){ try{ return new Date().toISOString(); }catch(_){ return ''; } }
  function rawGet(k){ try{ var fn = window.__sqNativeLocalStorageGetItem || Storage.prototype.getItem; return fn.call(localStorage, k); }catch(_){ return null; } }
  function rawSet(k,v){ try{ var fn = window.__sqNativeLocalStorageSetItem || Storage.prototype.setItem; fn.call(localStorage, k, v); return true; }catch(_){ return false; } }
  function parsePlayers(raw){ try{ var arr = JSON.parse(raw || '[]'); return Array.isArray(arr) ? arr : []; }catch(_){ return []; } }
  function normalizeCachePlayer(p){
    if (!p) return null;
    var name = String(p.name || '').trim();
    if (!name) return null;
    return { id:(p.id != null ? String(p.id).trim() : null), name:name, avatar_id:p.avatar_id ?? null, first_name:(p.first_name != null ? String(p.first_name) : ''), last_name:(p.last_name != null ? String(p.last_name) : ''), nickname:(p.nickname != null ? String(p.nickname) : ''), initials:(typeof window.__sqNormalizeInitials === 'function' ? window.__sqNormalizeInitials(p.initials, name) : String(p.initials || '').trim()), joinedAt:p.joinedAt || p.created_at || p.createdAt || null, _src:p._src || 'cloud-cache' };
  }
  function safeSetCache(arr, meta){
    var clean = (Array.isArray(arr) ? arr : []).map(normalizeCachePlayer).filter(Boolean).sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
    try{ rawSet(PLAYER_KEY, JSON.stringify(clean)); lastSyncMeta = window.__sqPlayerCacheLastSync = Object.assign({ ts: nowIso(), count: clean.length }, meta || {}); }catch(e){ console.warn('[SQ] player cache write failed', e); }
    return clean;
  }
  window.getSavedPlayers = function getSavedPlayers(){ try{ return parsePlayers(rawGet(PLAYER_KEY)); }catch(_){ return []; } };
  window.setSavedPlayers = function setSavedPlayers(arr){ return safeSetCache(arr, { source:'setSavedPlayers-cache-write' }); };
  window.__sqSyncPlayerCacheFromCloud = async function __sqSyncPlayerCacheFromCloud(){
    if (typeof window.cloudListPlayers !== 'function') return { ok:false, reason:'cloudListPlayers missing', count:0 };
    try{ var cloud = await window.cloudListPlayers(); var clean = safeSetCache(cloud || [], { source:'cloudListPlayers' }); try{ if (typeof window.populateSavedPlayersSelects === 'function') window.populateSavedPlayersSelects(clean); }catch(_){ } return { ok:true, source:'cloud', count:clean.length, ts:lastSyncMeta && lastSyncMeta.ts }; }
    catch(e){ console.warn('[SQ] player cache cloud sync failed; existing cache remains display-only fallback', e); return { ok:false, reason:String(e && (e.message || e)), count:(window.getSavedPlayers ? window.getSavedPlayers().length : 0) }; }
  };
  window.__sqPlayerCacheReport = function __sqPlayerCacheReport(){
    var arr = []; try{ arr = window.getSavedPlayers ? window.getSavedPlayers() : []; }catch(_){ arr = []; }
    var report = { key:PLAYER_KEY, policy:'safe-player-cloud-cache', exists:arr.length > 0, count:arr.length, lastSync:lastSyncMeta, rule:'Supabase players table is canonical. localStorage is UI cache/dropdown fallback only.' };
    try{ console.table([report]); console.table(arr.slice(0, 10).map(function(p){ return { id:p.id || '', name:p.name || '', initials:p.initials || '', nickname:p.nickname || '', src:p._src || '' }; })); }catch(_){ console.log(report, arr.slice(0,10)); }
    return { report:report, sample:arr.slice(0,10) };
  };
  setTimeout(function(){ try{ window.__sqSyncPlayerCacheFromCloud(); }catch(_){ } }, 800);
  console.info('[SQ] player cache verified as cloud-synced UI cache only');
})();
