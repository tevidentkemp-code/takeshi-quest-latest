/* SC-031 server-enforced admin boundary.
   Token remains memory-only. No admin credential or service-role key is shipped to the browser. */
(function(){
  if (window.__sqAdminSecurityV1) return;
  window.__sqAdminSecurityV1 = true;

  var adminToken = '';
  var adminExpiresAt = 0;

  function endpoint(){
    try{
      if (typeof SUPABASE_URL === 'string' && SUPABASE_URL) {
        return SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/sq-admin-maintenance';
      }
    }catch(_){}
    return '';
  }

  function publicKey(){
    try{ return (typeof SUPABASE_ANON === 'string') ? SUPABASE_ANON : ''; }
    catch(_){ return ''; }
  }

  function clearSession(){
    adminToken = '';
    adminExpiresAt = 0;
    window.__sqAdminAuthed = false;
  }

  async function callServer(body){
    var url = endpoint();
    var key = publicKey();
    if (!url || !key) throw new Error('Admin service unavailable');

    var res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key
      },
      body: JSON.stringify(body || {})
    });

    var data = {};
    try{ data = await res.json(); }catch(_){ data = {}; }
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  window.sqAdminSessionActive = function(){
    return !!(adminToken && adminExpiresAt > Date.now() + 1000);
  };

  window.sqAdminLogin = async function(pin){
    clearSession();
    var out = await callServer({ action:'login', pin:String(pin || '') });
    var data = out.data || {};
    if (out.ok && data.ok === true && typeof data.token === 'string'){
      var exp = Date.parse(String(data.expires_at || ''));
      if (!Number.isFinite(exp) || exp <= Date.now()) throw new Error('Invalid admin session');
      adminToken = data.token;
      adminExpiresAt = exp;
      window.__sqAdminAuthed = true;
      return data;
    }
    return data;
  };

  window.sqAdminLogout = async function(){
    var token = adminToken;
    clearSession();
    if (!token) return true;
    try{ await callServer({ action:'logout', token:token }); }catch(_){}
    return true;
  };

  window.sqAdminGameMaintenance = async function(action, gameId){
    if (!window.sqAdminSessionActive()){
      clearSession();
      var expired = new Error('Admin session expired');
      expired.code = 'unauthorized';
      throw expired;
    }

    var out = await callServer({
      action:String(action || ''),
      gameId:String(gameId || ''),
      token:adminToken
    });
    var data = out.data || {};

    if (out.status === 401 || data.code === 'unauthorized'){
      clearSession();
      var denied = new Error('Admin session expired');
      denied.code = 'unauthorized';
      throw denied;
    }
    if (!out.ok || data.ok !== true){
      var err = new Error(String(data.code || 'Admin operation failed'));
      err.code = String(data.code || 'operation_failed');
      throw err;
    }
    return data;
  };

  function gameIdOf(game){
    return (typeof game === 'object' && game) ? (game.id || game.game_id || null) : game;
  }

  async function archiveGame(game){
    var gid = gameIdOf(game);
    if (!gid) throw new Error('cloudArchiveGame: missing game id');
    await window.sqAdminGameMaintenance('archive', gid);
    try{ if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('cloudArchiveGame'); }catch(_){}
    try{ localStorage.removeItem('SQ_PSTICKER_CACHE_V1'); }catch(_){}
    try{ if (typeof window.__sqRefreshRecentMatchesTicker === 'function') window.__sqRefreshRecentMatchesTicker(); }catch(_){}
    try{ localStorage.removeItem('SQ_PSTICKER_CACHE_V1'); }catch(_){}
    try{ if (typeof window.__sqRefreshRecentMatchesTicker === 'function') window.__sqRefreshRecentMatchesTicker(); }catch(_){}
    return true;
  }

  async function reinstateGame(game){
    var gid = gameIdOf(game);
    if (!gid) throw new Error('cloudReinstateGame: missing game id');
    await window.sqAdminGameMaintenance('reinstate', gid);
    try{ if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('cloudReinstateGame'); }catch(_){}
    try{ localStorage.removeItem('SQ_PSTICKER_CACHE_V1'); }catch(_){}
    try{ if (typeof window.__sqRefreshRecentMatchesTicker === 'function') window.__sqRefreshRecentMatchesTicker(); }catch(_){}
    return true;
  }

  async function purgeGame(game){
    var gid = gameIdOf(game);
    if (!gid) throw new Error('cloudPurgeGameCascade: missing game id');
    await window.sqAdminGameMaintenance('purge', gid);
    try{ if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('cloudPurgeGameCascade'); }catch(_){}
    return true;
  }

  window.cloudArchiveGame = archiveGame;
  window.cloudReinstateGame = reinstateGame;
  window.cloudPurgeGameCascade = purgeGame;
  try{ cloudArchiveGame = archiveGame; }catch(_){}
  try{ cloudReinstateGame = reinstateGame; }catch(_){}
  try{ cloudPurgeGameCascade = purgeGame; }catch(_){}

  document.addEventListener('visibilitychange', function(){
    if (!document.hidden && adminExpiresAt && adminExpiresAt <= Date.now()) clearSession();
  }, { passive:true });
})();
