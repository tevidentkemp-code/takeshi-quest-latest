  // ===== @SEC:JS:CLOUD =====
// ===== @JS:CLOUD:SUPABASE_INIT =====
function ensureCloudInit(){
    try {
      // NOTE: file:// is not recommended, but we allow Supabase init attempts for legacy behaviour.
// If the browser blocks it (CORS), we’ll mark cloud offline and continue using local cache where possible.

      // Library present?
      if (typeof window.supabase !== 'object' || !window.supabase.createClient) {
        try { setCloudStatus && setCloudStatus('error', 'Cloud not initialised'); } catch(_) {}
        return false;
      }
      // Keys present?
      if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON) {
        try { setCloudStatus && setCloudStatus('error', 'Cloud keys missing'); } catch(_) {}
        return false;
      }
      if (window.__sqInstallEgressCreateClientHook) window.__sqInstallEgressCreateClientHook();
      // Make client if missing
      if (!window.sb) {
        try {
          window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
          if (window.__sqInstrumentSupabaseClient) window.sb = window.__sqInstrumentSupabaseClient(window.sb);
          sb = window.sb;
        }
        catch (e) {
          console.error('supabase createClient failed', e);
          try { setCloudStatus && setCloudStatus('error', 'Cloud not initialised'); } catch(_) {}
          return false;
        }
      }
      else if (window.__sqInstrumentSupabaseClient) {
        window.sb = window.__sqInstrumentSupabaseClient(window.sb);
      }
      if (!sb && window.sb) sb = window.sb;
      if (sb !== window.sb) sb = window.sb;
      if (window.__sqInstrumentKnownSupabaseClients) window.__sqInstrumentKnownSupabaseClients();
      return true;
    } catch (e) {
      console.error('ensureCloudInit failed', e);
      try { setCloudStatus && setCloudStatus('error', 'Cloud not initialised'); } catch(_) {}
      return false;
    }

// >>> PATCH:MOT_STAGE5A_CLOUD_CONTRACT_PROBE START
// Stage 5A: Supabase “Truth Mode” hardening — Contract probe + health report (read-only)
//
// Enable debug via ?debug=1 or localStorage.SQ_DEBUG='1' (see Stage 2 SQ_DIAG).
// This patch does NOT change gameplay or writes; it only adds probes + reporting.
//
// Usage (console):
//   sqCloudProbe().then(()=>sqCloudHealth());          // runs contract checks
//   sqCloudHealth();               // prints concise report
//   sqCloudContractStatus();       // returns last status object
//
(function(){
  // Contract definition: required objects the UI relies on (tables + views).
  // Keep this list deterministic; prefer constants if present.
  const T = (k, fallback) => {
    try { return (typeof window[k] !== 'undefined' && window[k]) ? window[k] : fallback; } catch(_){ return fallback; }
  };

  const CONTRACT = [
    { name: T('TABLE_GAMES', 'games'), kind: 'table', usedBy: ['cloudFetch*Games', 'getGamesForMode', 'de-dupe'] },
    { name: T('TABLE_MATCHES', 'matches'), kind: 'table', usedBy: ['cloudFetchAllMatchesAsLocal', 'getMatchesOfficial'] },
    { name: T('TABLE_PLAYER_GAMES', 'player_games_union'), kind: 'view', usedBy: ['player stats windows'] },
    { name: T('TABLE_HS_LEAGUE', 'high_scores_sp'), kind: 'table|view', usedBy: ['High Score League modal'] },
    { name: T('TABLE_HS_PRACTICE', 'high_scores'), kind: 'table', usedBy: ['practice highs'] },
    { name: T('TABLE_PB_ROUNDS_CLEAN_APP', 'v_pb_by_player_round_clean_app'), kind: 'view', usedBy: ['PB rounds / records'] },
    { name: T('TABLE_WR_ROUNDS_CLEAN_APP', 'v_wr_by_round_clean_app'), kind: 'view', usedBy: ['WR rounds / records'] },
    { name: 'v_round_high_scores_modal', kind: 'view', usedBy: ['Round High Scores modal'] },
    { name: 'v_top50_scores_official', kind: 'view', usedBy: ['Top 50 Scores modal'] }
  ];

  // Expose contract list read-only-ish
  window.SQ_CLOUD_CONTRACT = CONTRACT;

  // Internal last-known status
  let _last = null;

  function _isDebug(){
    try {
      if (window.SQ_DIAG && window.SQ_DIAG.enabled) return true;
      const qs = String(location.search || '');
      if (qs.indexOf('debug=1') >= 0) return true;
      if (localStorage && localStorage.getItem('SQ_DEBUG') === '1') return true;
    } catch(_){}
    return false;
  }

  async function _probeOne(obj){
    const started = Date.now();
    const out = {
      name: obj.name,
      kind: obj.kind,
      usedBy: obj.usedBy || [],
      ok: false,
      missing: false,
      rowsUnknown: true,
      error: null,
      ms: 0
    };

    if (!ensureCloudInit()) {
      out.error = 'Cloud not initialised';
      out.ms = Date.now() - started;
      return out;
    }

    // First: cheap HEAD check for existence (works even if no "id" column)
    try {
      const res = await sb.from(obj.name).select('*', { head: true, count: 'exact' }).limit(1);
      if (res && res.error) throw res.error;
      out.ok = true;
      out.missing = false;
      out.rowsUnknown = false;
      // count is null on some configs; treat as unknown rather than lying
      if (typeof res.count === 'number') out.count = res.count;
    } catch (e1) {
      const msg = String(e1 && (e1.message || e1.details || e1.hint) || e1 || '');
      // Supabase/PostgREST common “missing relation/view” signatures
      const missingSig = /relation .* does not exist|Could not find the|404|Not Found|PGRST/i.test(msg);
      out.ok = false;
      out.missing = !!missingSig;
      out.error = msg || 'Probe failed';
      // Mark missing table/view in your existing guardrail map (non-fatal)
      try {
        if (out.missing && typeof cloudMarkTableMissing === 'function') cloudMarkTableMissing(obj.name);
      } catch(_){}
    }

    out.ms = Date.now() - started;
    return out;
  }

  window.sqCloudProbe = async function sqCloudProbe(){
    const started = Date.now();
    const status = {
      at: new Date().toISOString(),
      ok: false,
      cloudInit: false,
      total: CONTRACT.length,
      okCount: 0,
      missingCount: 0,
      failedCount: 0,
      items: [],
      ms: 0
    };

    status.cloudInit = ensureCloudInit();
    if (!status.cloudInit) {
      status.ok = false;
      status.failedCount = CONTRACT.length;
      status.items = CONTRACT.map(o => ({
        name: o.name, kind: o.kind, usedBy: o.usedBy || [],
        ok: false, missing: false, rowsUnknown: true, error: 'Cloud not initialised', ms: 0
      }));
      status.ms = Date.now() - started;
      _last = status;
      if (_isDebug()) console.warn('[SQ CLOUD PROBE] Cloud not initialised');
      return status;
    }

    const results = [];
    for (const obj of CONTRACT) results.push(await _probeOne(obj));

    status.items = results;
    status.okCount = results.filter(r => r.ok).length;
    status.missingCount = results.filter(r => r.missing).length;
    status.failedCount = results.filter(r => !r.ok && !r.missing).length;
    status.ok = (status.okCount === status.total);
    status.ms = Date.now() - started;

    _last = status;

    if (_isDebug()) {
      console.log('[SQ CLOUD PROBE]', status);
      try {
        const rows = results.map(r => ({
          name: r.name,
          kind: r.kind,
          ok: r.ok ? 'OK' : (r.missing ? 'MISSING' : 'FAIL'),
          ms: r.ms,
          error: r.ok ? '' : (r.error || '')
        }));
        console.table(rows);
      } catch(_){}
    }
    return status;
  };

  window.sqCloudContractStatus = function sqCloudContractStatus(){
    return _last;
  };

  window.sqCloudHealth = function sqCloudHealth(){
    const s = _last;
    if (!s) {
      console.log('[SQ CLOUD HEALTH] No probe run yet. Run: sqCloudProbe().then(()=>sqCloudHealth())');
      return { ok:false, msg:'No probe run yet' };
    }
    const msg = s.ok
      ? `OK (${s.okCount}/${s.total})`
      : `NOT OK (ok:${s.okCount}/${s.total}, missing:${s.missingCount}, fail:${s.failedCount})`;
    console.log('[SQ CLOUD HEALTH]', msg, s);
    return { ok: !!s.ok, msg, status: s };
  };

  // Convenience helper for Safari consoles that don't support top-level await
  window.sqCloudProbeNow = function sqCloudProbeNow(){
    try{
      return Promise.resolve(window.sqCloudProbe()).then((r)=>{ try{ window.sqCloudHealth(); }catch(_e){} return r; });
    }catch(e){
      return Promise.reject(e);
    }
  };

})();
// <<< PATCH:MOT_STAGE5A_CLOUD_CONTRACT_PROBE END

  }
// >>> PATCH:MOT5B3_ARCHIVE_REINSTATE_PURGE START
async function cloudArchiveGame(game){
  await ensureCloudInit();
  const gid = (typeof game === 'object' && game) ? (game.id || game.game_id || null) : game;
  if (!gid) throw new Error('cloudArchiveGame: missing game id');
  const { error } = await sb.from(TABLE_GAMES).update({ archived_at: new Date().toISOString() }).eq('id', gid);
  if (error) throw error;
  try{ if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('cloudArchiveGame'); }catch(_){ }
  try{ localStorage.removeItem('SQ_PSTICKER_CACHE_V1'); }catch(_){ }
  try{ if (typeof window.__sqRefreshRecentMatchesTicker==='function') window.__sqRefreshRecentMatchesTicker(); }catch(_){ }
  try{ localStorage.removeItem('SQ_PSTICKER_CACHE_V1'); }catch(_){ }
  try{ if (typeof window.__sqRefreshRecentMatchesTicker==='function') window.__sqRefreshRecentMatchesTicker(); }catch(_){ }
  return true;
}

async function cloudReinstateGame(game){
  await ensureCloudInit();
  const gid = (typeof game === 'object' && game) ? (game.id || game.game_id || null) : game;
  if (!gid) throw new Error('cloudReinstateGame: missing game id');
  const { error } = await sb.from(TABLE_GAMES).update({ archived_at: null }).eq('id', gid);
  if (error) throw error;
  try{ if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('cloudReinstateGame'); }catch(_){ }
  try{ localStorage.removeItem('SQ_PSTICKER_CACHE_V1'); }catch(_){ }
  try{ if (typeof window.__sqRefreshRecentMatchesTicker==='function') window.__sqRefreshRecentMatchesTicker(); }catch(_){ }
  return true;
}

// Permanent purge: remove game row + best-effort cleanup of related tables.
// NOTE: This is intentionally destructive.
async function cloudPurgeGameCascade(game){
  await ensureCloudInit();
  const gid = (typeof game === 'object' && game) ? (game.id || game.game_id || null) : game;
  if (!gid) throw new Error('cloudPurgeGameCascade: missing game id');

  const tryDel = async (table, col='game_id')=>{
    try{ await sb.from(table).delete().eq(col, gid); }catch(_){ }
  };

  await tryDel(TABLE_HS_LEAGUE, 'game_id');
  await tryDel(TABLE_HS_PRACTICE, 'game_id');

  // Best-effort event/commentary cleanup (only if tables exist)
  await tryDel('game_events', 'game_id');
  await tryDel('game_commentary', 'game_id');

  // Throws table if ever enabled
  try{
    if (typeof TABLE_GAME_THROWS==='string' && TABLE_GAME_THROWS && !(CLOUD_TABLE_MISSING && CLOUD_TABLE_MISSING[TABLE_GAME_THROWS])){
      await tryDel(TABLE_GAME_THROWS, 'game_id');
    }
  }catch(_){ }

  const { error: delErr } = await sb.from(TABLE_GAMES).delete().eq('id', gid);
  if (delErr) throw delErr;
  try{ if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('cloudPurgeGameCascade'); }catch(_){ }
  return true;
}
// <<< PATCH:MOT5B3_ARCHIVE_REINSTATE_PURGE END

// >>> PATCH:MOT_STAGE5A_PROBE_EARLY_V4 START
// Ensure probe helpers exist even if later script sections bail early.
// Read-only: probes required Supabase tables/views and reports status.
(function(){
  try{
    // Contract items default to required:true unless explicitly set required:false (optional).
    if (!window.SQ_CLOUD_CONTRACT){
      window.SQ_CLOUD_CONTRACT = [
        { kind:'table', name: (typeof TABLE_GAMES!=='undefined'?TABLE_GAMES:'games'), usedBy:['cloudFetch*','getGamesForMode'], required:true },
        { kind:'table', name: (typeof TABLE_MATCHES!=='undefined'?TABLE_MATCHES:'matches'), usedBy:['cloudFetchAllMatchesAsLocal','getMatchesOfficial'], required:true },
        { kind:'view',  name: (typeof TABLE_PLAYER_GAMES!=='undefined'?TABLE_PLAYER_GAMES:'player_games_union'), usedBy:['stats windows'], required:true },
        { kind:'table', name: (typeof TABLE_HS_LEAGUE!=='undefined'?TABLE_HS_LEAGUE:'high_scores_sp'), usedBy:['High Score League'], required:true },
        { kind:'table', name: (typeof TABLE_HS_PRACTICE!=='undefined'?TABLE_HS_PRACTICE:'high_scores'), usedBy:['practice highs'], required:true },
        { kind:'view',  name: 'v_top50_scores_official', usedBy:['Top 50 modal'], required:true },
        { kind:'view',  name: 'v_round_high_scores_modal', usedBy:['Round High Scores modal'], required:true },

        // Optional clean app PB/WR views for runtime edging/admin snapshots.
        { kind:'view', name: (typeof TABLE_PB_ROUNDS_CLEAN_APP!=='undefined'?TABLE_PB_ROUNDS_CLEAN_APP:'v_pb_by_player_round_clean_app'), usedBy:['PB rounds'], required:false },
        { kind:'view', name: (typeof TABLE_WR_ROUNDS_CLEAN_APP!=='undefined'?TABLE_WR_ROUNDS_CLEAN_APP:'v_wr_by_round_clean_app'), usedBy:['WR rounds'], required:false }
      ];
    }

    var _lastProbe = null;

    function _isOptional(obj){ return obj && obj.required === false; }

    async function _probeOne(obj){
      const started = Date.now();
      const out = { kind: obj.kind, name: obj.name, required: (obj.required !== false), ok:false, missing:false, rowsUnknown:true, count:null, error:null, ms:0 };
      try{
        if (typeof ensureCloudInit === 'function' && !ensureCloudInit()){
          out.error = 'Cloud not initialised';
          out.ms = Date.now()-started;
          return out;
        }
        if (!window.sb){
          out.error = 'Supabase client missing (window.sb)';
          out.ms = Date.now()-started;
          return out;
        }
        const res = await window.sb.from(obj.name).select('*', { head:true, count:'exact' }).limit(1);
        if (res && res.error) throw res.error;
        out.ok = true;
        out.rowsUnknown = false;
        if (typeof res.count === 'number') out.count = res.count;
      }catch(e){
        const msg = String(e && (e.message || e.details || e.hint) || e || '');
        out.ok = false;
        out.error = msg || 'Probe failed';
        out.missing = /relation .* does not exist|Could not find the|404|Not Found|PGRST/i.test(out.error);

        // Only auto-mark required deps as missing; optional deps should not trip global guards.
        try{
          if (out.missing && out.required && typeof cloudMarkTableMissing === 'function') cloudMarkTableMissing(obj.name);
        }catch(_){}
      }
      out.ms = Date.now()-started;
      return out;
    }

    // sqCloudProbe({ includeOptional:true|false })  (default false to avoid noisy 404s in consoles)
    window.sqCloudProbe = window.sqCloudProbe || async function sqCloudProbe(opts){
      const o = opts || {};
      const includeOptional = !!o.includeOptional;

      const CONTRACT_ALL = window.SQ_CLOUD_CONTRACT || [];
      const CONTRACT = includeOptional ? CONTRACT_ALL : CONTRACT_ALL.filter(x => !_isOptional(x));

      const started = Date.now();
      const status = {
        at:new Date().toISOString(),
        ok:false,
        cloudInit:false,
        total:CONTRACT.length,
        requiredTotal: CONTRACT.filter(x => x.required !== false).length,
        okCount:0,
        missingCount:0,
        failedCount:0,
        okRequired:0,
        missingRequired:0,
        failedRequired:0,
        optionalMissing:0,
        items:[],
        ms:0,
        includeOptional
      };

      status.cloudInit = (typeof ensureCloudInit==='function') ? !!ensureCloudInit() : !!window.sb;

      const results = [];
      for (const obj of CONTRACT) results.push(await _probeOne(obj));

      status.items = results;

      const ok = results.filter(r=>r.ok);
      const missing = results.filter(r=>r.missing);
      const failed = results.filter(r=>(!r.ok && !r.missing));

      status.okCount = ok.length;
      status.missingCount = missing.length;
      status.failedCount = failed.length;

      const req = results.filter(r=>r.required);
      status.okRequired = req.filter(r=>r.ok).length;
      status.missingRequired = req.filter(r=>r.missing).length;
      status.failedRequired = req.filter(r=>(!r.ok && !r.missing)).length;

      const opt = results.filter(r=>!r.required);
      status.optionalMissing = opt.filter(r=>!r.ok).length;

      status.ok = (status.okRequired === status.requiredTotal) && (status.missingRequired === 0) && (status.failedRequired === 0);
      status.ms = Date.now()-started;
      _lastProbe = status;
      return status;
    };

    window.sqCloudContractStatus = window.sqCloudContractStatus || function(){ return _lastProbe; };

    window.sqCloudHealth = window.sqCloudHealth || function(){
      const s = _lastProbe;
      if (!s){
        console.log('[SQ CLOUD HEALTH] No probe run yet. Run: sqCloudProbeNow()');
        return { ok:false, msg:'No probe run yet' };
      }

      const reqMsg = s.ok
        ? `REQUIRED OK (${s.okRequired}/${s.requiredTotal})`
        : `REQUIRED NOT OK (ok:${s.okRequired}/${s.requiredTotal}, missing:${s.missingRequired}, fail:${s.failedRequired})`;

      const optMsg = s.includeOptional
        ? `OPTIONAL (missing:${s.optionalMissing})`
        : `OPTIONAL (skipped)`;

      const msg = `${reqMsg} • ${optMsg}`;

      console.log('[SQ CLOUD HEALTH]', msg, s);
      return { ok:!!s.ok, msg, status:s };
    };

    // Convenience: default probe is required-only (no optional noisy 404s)
    window.sqCloudProbeNow = window.sqCloudProbeNow || function(){
      return Promise.resolve(window.sqCloudProbe({ includeOptional:false })).then(()=>window.sqCloudHealth());
    };

    // Convenience: probe everything (will show optional misses if they truly don't exist)
    window.sqCloudProbeAllNow = window.sqCloudProbeAllNow || function(){
      return Promise.resolve(window.sqCloudProbe({ includeOptional:true })).then(()=>window.sqCloudHealth());
    };

  }catch(_e){}
})();
// <<< PATCH:MOT_STAGE5A_PROBE_EARLY_V4 END

/*** CLOUD HIGH SCORES API — safe fallback implementations ***/
(function(){
  // Insert (or keep existing) → create only if missing to avoid duplicates
  if (typeof window.cloudInsertHighScore !== 'function') {
    window.cloudInsertHighScore = async function(name, score, isPractice){
      if (!ensureCloudInit()) throw new Error('Cloud not initialised');
      const table = isPractice
        ? (typeof TABLE_HS_PRACTICE !== 'undefined' ? TABLE_HS_PRACTICE : 'high_scores_practice')
        : (typeof TABLE_HS_LEAGUE   !== 'undefined' ? TABLE_HS_LEAGUE   : 'high_scores');

      const row = {
        name: String(name || '').trim(),
        score: Number(score || 0),
        // Prefer server default if your table has one; otherwise send a timestamp
        ts: new Date().toISOString()
      };

      // basic guards; don't write empty rows
      if (!row.name || row.score <= 0) return false;

      const { error } = await sb.from(table).insert(row);
      if (error) throw error;
      return true;
    };
  }
if (typeof window.cloudInsertHighScoreIfMissing !== 'function') {
  window.cloudInsertHighScoreIfMissing = async function(table, name, score, ts){
    if (!ensureCloudInit()) throw new Error('Cloud not initialised');
    const n = String(name || '').trim();
    const s = Number(score || 0);
    if (!n || s <= 0) return false;

    // Does a matching row already exist? (exact name/score; if ts is given, use ±2 min window)
    async function existsQuery() {
      try {
        if (ts) {
          const pad = 2 * 60 * 1000;
          const fromIso = new Date(new Date(ts).getTime() - pad).toISOString();
          const toIso   = new Date(new Date(ts).getTime() + pad).toISOString();
          const { count, error } = await sb
            .from(table)
            .select('name,score,ts', { count: 'exact', head: true })
            .gte('ts', fromIso).lte('ts', toIso)
            .eq('name', n).eq('score', s)
            .limit(1);
          if (error) throw error;
          return !!(count && count > 0);
        } else {
          const { count, error } = await sb
            .from(table)
            .select('name,score,ts', { count: 'exact', head: true })
            .eq('name', n).eq('score', s)
            .limit(1);
          if (error) throw error;
          return !!(count && count > 0);
        }
      } catch {
        // Fallback: non-head select
        try {
          if (ts) {
            const pad = 2 * 60 * 1000;
            const fromIso = new Date(new Date(ts).getTime() - pad).toISOString();
            const toIso   = new Date(new Date(ts).getTime() + pad).toISOString();
            const { data } = await sb
              .from(table).select('name,score,ts')
              .gte('ts', fromIso).lte('ts', toIso)
              .eq('name', n).eq('score', s).limit(1);
            return Array.isArray(data) && data.length > 0;
          } else {
            const { data } = await sb
              .from(table).select('name,score,ts')
              .eq('name', n).eq('score', s).limit(1);
            return Array.isArray(data) && data.length > 0;
          }
        } catch {
          return false;
        }
      }
    }

    if (await existsQuery()) return false;

    const row = { name: n, score: s, ts: ts || new Date().toISOString() };
    const { error } = await sb.from(table).insert(row);
    if (error) throw error;
    return true;
  };
}

  if (typeof window.cloudListHighScores !== 'function') {
    window.cloudListHighScores = async function(isPractice, limit = 50){
      if (!ensureCloudInit()) throw new Error('Cloud not initialised');
      const table = isPractice
        ? (typeof TABLE_HS_PRACTICE !== 'undefined' ? TABLE_HS_PRACTICE : 'high_scores_practice')
        : (typeof TABLE_HS_LEAGUE   !== 'undefined' ? TABLE_HS_LEAGUE   : 'high_scores');

      const { data, error } = await sb
        .from(table)
        .select('name, score, ts, game_id')
        .order('score', { ascending: false })
        .order('ts',    { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    };
  }

  if (typeof window.cloudDeleteHighScore !== 'function') {
    window.cloudDeleteHighScore = async function(row, isPractice){
      if (!ensureCloudInit()) throw new Error('Cloud not initialised');
      const table = isPractice
        ? (typeof TABLE_HS_PRACTICE !== 'undefined' ? TABLE_HS_PRACTICE : 'high_scores_practice')
        : (typeof TABLE_HS_LEAGUE   !== 'undefined' ? TABLE_HS_LEAGUE   : 'high_scores');

      // Try exact match (including ts if provided)
      try {
        let q = sb.from(table).delete()
          .eq('name', String(row?.name || ''))
          .eq('score', Number(row?.score || 0));
        if (row?.ts) q = q.eq('ts', row.ts);
        const { error } = await q;
        if (error) throw error;
        return;
      } catch (e) {
        // Fallback: delete on small time window if exact ts equality fails
        if (!row?.ts) throw e;
        const pad = 2 * 60 * 1000;
        const fromIso = new Date(new Date(row.ts).getTime() - pad).toISOString();
        const toIso   = new Date(new Date(row.ts).getTime() + pad).toISOString();
        const { error } = await sb.from(table).delete()
          .gte('ts', fromIso).lte('ts', toIso)
          .eq('name', String(row.name || ''))
          .eq('score', Number(row.score || 0));
        if (error) throw error;
      }
    };
  }
})();
// Toggle for writing per-player game rows to a table.
// Your project uses a view (`player_games_union`), so writes should be disabled.
const ENABLE_PLAYER_GAMES_WRITES = false;

/*****************
 * CLOUD-ONLY READS (force consistency across devices)
 *****************/
const READS_CLOUD_ONLY = true; // all reads come from Supabase

// If cloud-only reads are enabled, neutralise local log accessors so UI never reads from them
if (READS_CLOUD_ONLY) {
  window.getGameLog = function(){ return []; };
  window.setGameLog = function(){ /* no-op */ };
  window.logCompletedGame = function(){ /* no-op (we persist to cloud in recordFullGameToSupabase) */ };
  window.getMatchLog = function(){ return []; };
  window.setMatchLog = function(){ /* no-op */ };
  window.logCompletedMatch = function(){ /* no-op */ };
}

/* NEW: shared date formatter → "DD/MM/YY @ HH:MM" (24h) */
if (typeof window.fmtWhen !== 'function') {
  window.fmtWhen = function fmtWhen(ts){
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = String(d.getFullYear()).slice(-2);
    const HH = String(d.getHours()).padStart(2,'0');
    const MI = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yy} @ ${HH}:${MI}`;
  };
}

// Helpers (define only if missing)
if (typeof window.eqName !== 'function') {
  window.eqName = (a,b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
}
if (typeof window.isOfficialGame !== 'function') {
  window.isOfficialGame = g => Array.isArray(g?.players) && g.players.length >= 2;
}
if (typeof window.isPracticeGame !== 'function') {
  window.isPracticeGame = g => Array.isArray(g?.players) && g.players.length === 1;
}

/* >>> PATCH:PHASE1_CANONICAL_GAME_ADAPTER_V1 START
   Purpose:
   - One canonical reader for saved game rows.
   - Supabase/cloud rows remain the source of truth.
   - localStorage remains cache only.
   - Keep this foundation non-invasive: it normalises + routes getGamesForMode first.
*/
(function(){
  if (window.__sqPhase1GameAdapterV1) return;
  window.__sqPhase1GameAdapterV1 = true;

  function str(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return str(v).toLowerCase(); }
  function asArr(v){ return Array.isArray(v) ? v : []; }
  function pick(){
    for (var i=0; i<arguments.length; i++){
      var v = arguments[i];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  }

  function playerNameSafe(p){
    try{
      if (typeof window.playerNameFrom === 'function') return str(window.playerNameFrom(p));
    }catch(_){ }
    if (p == null) return '';
    if (typeof p === 'string') return str(p);
    return str(p.name || p.player || p.player_name || p.display_name || p.nickname || p.nick || p.username || p.id || '');
  }

  function playerIdSafe(p){
    if (!p || typeof p !== 'object') return null;
    return pick(p.player_id, p.playerId, p.id, p.uuid, null);
  }

  function normalizePlayers(g, state){
    var raw = asArr(pick(g && g.players, state && state.players, state && state.match && state.match.players, []));
    return raw.map(function(p, idx){
      if (p && typeof p === 'object'){
        return Object.assign({}, p, { name: playerNameSafe(p), player_id: playerIdSafe(p), index: idx });
      }
      return { name: playerNameSafe(p), player_id: null, index: idx };
    }).filter(function(p){ return !!p.name; });
  }

  function normalizeBoard(g, state){
    return pick(g && g.board, g && g.score, state && state.board, state && state.score, null);
  }

  function roundScoreSafe(ent){
    if (ent == null) return 0;
    if (typeof ent === 'number') return Number(ent) || 0;
    if (typeof ent === 'string') return Number(ent) || 0;
    var keys = ['roundTotal','round_total','points','score','total','val','value'];
    for (var i=0; i<keys.length; i++){
      var n = Number(ent[keys[i]]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    var darts = Array.isArray(ent) ? ent : (Array.isArray(ent.darts) ? ent.darts : (Array.isArray(ent.throws) ? ent.throws : []));
    if (darts.length){
      return darts.reduce(function(a,d){
        if (typeof d === 'number') return a + (Number(d)||0);
        return a + (Number(d && (d.points ?? d.score ?? d.val ?? d.value) || 0) || 0);
      }, 0);
    }
    return 0;
  }

  function rowsForPlayer(board, idx){
    if (!Array.isArray(board)) return [];
    if (Array.isArray(board[idx])) return board[idx];
    if (Array.isArray(board[0]) && board[0] && board[0][idx] != null){
      return board.map(function(r){ return Array.isArray(r) ? r[idx] : null; });
    }
    return [];
  }

  function totalsFromBoard(board, playerCount){
    var out = [];
    for (var i=0; i<playerCount; i++){
      out[i] = rowsForPlayer(board, i).reduce(function(a,r){ return a + roundScoreSafe(r); }, 0);
    }
    return out;
  }

  function normalizeTotals(g, state, players, board){
    var raw = pick(g && g.totals, state && state.totals, null);
    var totals = [];
    if (Array.isArray(raw)){
      totals = raw.map(function(v){
        if (typeof v === 'number') return Number(v) || 0;
        if (v && typeof v === 'object') return Number(pick(v.total, v.score, v.points, v.val, 0)) || 0;
        return Number(v) || 0;
      });
    } else if (raw && typeof raw === 'object'){
      totals = players.map(function(p, idx){
        var v = pick(raw[p.name], raw[lower(p.name)], raw[String(idx)], raw[p.player_id], 0);
        if (v && typeof v === 'object') v = pick(v.total, v.score, v.points, v.val, 0);
        return Number(v) || 0;
      });
    }
    if ((!totals.length || totals.every(function(v){ return !v; })) && Array.isArray(board)){
      totals = totalsFromBoard(board, players.length);
    }
    while (totals.length < players.length) totals.push(0);
    return totals.slice(0, players.length);
  }

  function normalizeMode(g, state, players, matchId){
    var rawMode = lower(pick(g && g.mode, g && g.game_mode, g && g.type, state && state.mode, state && state.game_mode, state && state.type, ''));
    var explicitPractice = !!(g && (g.is_practice === true || g.isPractice === true || g.practice === true || g.single_player === true)) ||
      !!(state && (state.is_practice === true || state.isPractice === true || state.practice === true || state.single_player === true)) ||
      rawMode.indexOf('practice') >= 0 || rawMode.indexOf('unofficial') >= 0 || rawMode === 'solo';
    var explicitOfficial = !!(g && (g.is_practice === false || g.isPractice === false)) || !!(state && (state.is_practice === false || state.isPractice === false)) || rawMode === 'official' || rawMode === 'match';
    if (explicitPractice) return 'practice';
    if (matchId && players.length >= 2) return 'official';
    if (explicitOfficial && players.length >= 2) return 'official';
    if (players.length === 1) return 'practice';
    if (!matchId && players.length >= 1) return 'practice';
    return 'unknown';
  }

  function normalizeTs(g, state){
    return pick(g && g.ts, g && g.created_at, g && g.inserted_at, g && g.completed_at, state && state.ts, state && state.created_at, state && state.completed_at, g && g.meta && (g.meta.ts || g.meta.date), null);
  }

  function stableKey(norm){
    var id = str(norm.id || norm.game_id || '');
    if (id && !/^recent-/i.test(id)) return 'cloud:' + id;
    var names = norm.players.map(function(p){ return lower(p.name); }).join('|');
    var totals = norm.totals.join('|');
    var boardKey = '';
    try{ boardKey = JSON.stringify(norm.board || []); }catch(_){ boardKey = ''; }
    return ['game', norm.mode, norm.ts || '', names, totals, boardKey].join('::');
  }

  window.__sqNormalizeGameRow = function __sqNormalizeGameRow(g){
    g = g || {};
    var state = (g.state && typeof g.state === 'object') ? g.state : {};
    var matchId = pick(g.match_id, g.matchId, g.match, state.match_id, state.matchId, state.match && state.match.id, null);
    var players = normalizePlayers(g, state);
    var board = normalizeBoard(g, state);
    var totals = normalizeTotals(g, state, players, board);
    var mode = normalizeMode(g, state, players, matchId);
    var ts = normalizeTs(g, state);
    var out = {
      id: pick(g.id, g.game_id, g.gameId, null),
      game_id: pick(g.game_id, g.gameId, g.id, null),
      ts: ts,
      created_at: pick(g.created_at, ts, null),
      completed_at: pick(g.completed_at, state.completed_at, ts, null),
      mode: mode,
      isPractice: mode === 'practice',
      is_practice: mode === 'practice',
      isOfficial: mode === 'official',
      is_official: mode === 'official',
      players: players,
      player_names: players.map(function(p){ return p.name; }),
      totals: totals,
      board: board,
      match_id: matchId,
      matchId: matchId,
      game_number: pick(g.game_number, g.gameNumber, state.game_number, state.gameNumber, null),
      archived_at: pick(g.archived_at, g.archivedAt, state.archived_at, state.archivedAt, null),
      raw: g
    };
    out.stableKey = stableKey(out);
    return out;
  };

  window.__sqNormalizeGameRows = function __sqNormalizeGameRows(rows){
    return asArr(rows).map(function(g){ return window.__sqNormalizeGameRow(g); }).filter(function(g){ return g && g.players && g.players.length; });
  };

  window.__sqIsOfficialGame = function __sqIsOfficialGame(g){
    var n = (g && g.mode && Array.isArray(g.players) && Array.isArray(g.totals)) ? g : window.__sqNormalizeGameRow(g);
    return !!(n && n.isOfficial && n.players.length >= 2);
  };

  window.__sqIsPracticeGame = function __sqIsPracticeGame(g){
    var n = (g && g.mode && Array.isArray(g.players) && Array.isArray(g.totals)) ? g : window.__sqNormalizeGameRow(g);
    return !!(n && n.isPractice && n.players.length >= 1);
  };

  window.isOfficialGame = window.__sqIsOfficialGame;
  window.isPracticeGame = window.__sqIsPracticeGame;
  try{ isOfficialGame = window.__sqIsOfficialGame; isPracticeGame = window.__sqIsPracticeGame; }catch(_){ }

  window.__sqDedupeNormalizedGames = function __sqDedupeNormalizedGames(rows){
    var map = new Map();
    asArr(rows).forEach(function(g){
      var n = (g && g.stableKey) ? g : window.__sqNormalizeGameRow(g);
      if (!n || !n.players.length) return;
      if (n.archived_at) return;
      if (!map.has(n.stableKey)) map.set(n.stableKey, n);
    });
    return Array.from(map.values()).sort(function(a,b){
      var ta = Date.parse(a.ts || a.created_at || '') || 0;
      var tb = Date.parse(b.ts || b.created_at || '') || 0;
      return tb - ta;
    });
  };

  window.__sqGetAllGamesNormalized = async function __sqGetAllGamesNormalized(){
    var cloudGames = [];
    if (typeof window.cloudFetchAllGamesAsLocal === 'function'){
      cloudGames = await window.cloudFetchAllGamesAsLocal();
    }
    return window.__sqDedupeNormalizedGames(cloudGames || []);
  };

  window.__sqAuditLocalStorageAuthority = function __sqAuditLocalStorageAuthority(opts){
    opts = opts || {};

    function getPreview(value){
      var raw = String(value == null ? '' : value);
      var compact = raw.replace(/\s+/g, ' ').trim();
      return compact.length > 120 ? compact.slice(0, 117) + '...' : compact;
    }

    function sniffShape(value){
      var raw = String(value == null ? '' : value);
      if (!raw) return 'empty';
      try{
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return 'json-array[' + parsed.length + ']';
        if (parsed && typeof parsed === 'object') return 'json-object{' + Object.keys(parsed).slice(0, 6).join(',') + (Object.keys(parsed).length > 6 ? ',...' : '') + '}';
        return 'json-' + typeof parsed;
      }catch(_){
        return raw.length > 80 ? 'string-long' : 'string';
      }
    }

    var authorityPatterns = [
      { re: /(rank|ranking|leaderboard|league|premier)/i, reason: 'ranking/league-like key' },
      { re: /(pb|personal.?best|wr|world.?record|record)/i, reason: 'PB/WR/record-like key' },
      { re: /(h2h|head.?to.?head|versus|rival)/i, reason: 'H2H/rivalry-like key' },
      { re: /(latest|recent|history|archive|result|results)/i, reason: 'history/latest-results-like key' },
      { re: /(score|scores|total|totals|throw|throws|round|rounds)/i, reason: 'score/round-like key' },
      { re: /(player|players|match|matches|game|games)/i, reason: 'player/match/game-like key' }
    ];

    var safePatterns = [
      { re: /(debug|diag|diagnostic|log)/i, reason: 'debug/diagnostic' },
      { re: /(theme|colour|color|accent|appearance|style)/i, reason: 'UI preference' },
      { re: /(ui|pref|setting|settings|layout|tab|panel|menu)/i, reason: 'UI state/preference' },
      { re: /(cache|cached|draft|tmp|temp|viewport|vh|scroll)/i, reason: 'cache/temp/browser layout state' }
    ];

    var rows = [];
    try{
      for (var i=0; i<localStorage.length; i++){
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        var lowerKey = String(key || '').toLowerCase();
        var safeHit = safePatterns.find(function(p){ return p.re.test(lowerKey); });
        var authorityHits = authorityPatterns.filter(function(p){ return p.re.test(lowerKey); });
        var shape = sniffShape(value);
        var bytes = String(value || '').length;
        var risk = 'likely-safe-cache-or-pref';
        var action = 'keep';
        var reason = safeHit ? safeHit.reason : 'no authority pattern detected';

        if (authorityHits.length && !safeHit){
          risk = 'review-authority-risk';
          action = 'inspect-read-write-path';
          reason = authorityHits.map(function(p){ return p.reason; }).join('; ');
        } else if (authorityHits.length && safeHit){
          risk = 'mixed-name-review';
          action = 'verify-cache-only';
          reason = safeHit.reason + ' but also matches ' + authorityHits.map(function(p){ return p.reason; }).join('; ');
        }

        rows.push({
          key: key,
          risk: risk,
          action: action,
          reason: reason,
          shape: shape,
          bytes: bytes,
          preview: opts.withPreview ? getPreview(value) : undefined
        });
      }
    }catch(e){
      rows.push({ key:'localStorage unavailable', risk:'error', action:'none', reason:String(e && (e.message || e)), shape:'error', bytes:0 });
    }

    rows.sort(function(a,b){
      var order = { 'review-authority-risk':0, 'mixed-name-review':1, 'likely-safe-cache-or-pref':2, 'error':3 };
      return ((order[a.risk] == null ? 9 : order[a.risk]) - (order[b.risk] == null ? 9 : order[b.risk])) || String(a.key).localeCompare(String(b.key));
    });

    var summary = rows.reduce(function(acc,r){ acc[r.risk] = (acc[r.risk] || 0) + 1; return acc; }, {});
    try{
      console.log('SQ localStorage authority audit summary', summary);
      console.table(rows.map(function(r){
        var out = { key:r.key, risk:r.risk, action:r.action, reason:r.reason, shape:r.shape, bytes:r.bytes };
        if (opts.withPreview) out.preview = r.preview;
        return out;
      }));
    }catch(_){ }

    return { summary: summary, rows: rows };
  };

  window.__sqPrintLocalStorageAuthorityAudit = function __sqPrintLocalStorageAuthorityAudit(){
    return window.__sqAuditLocalStorageAuthority({ withPreview:false });
  };

  window.__sqPrintLocalStorageAuthorityAuditVerbose = function __sqPrintLocalStorageAuthorityAuditVerbose(){
    return window.__sqAuditLocalStorageAuthority({ withPreview:true });
  };

  window.__sqExportLocalStorageAuthorityAudit = function __sqExportLocalStorageAuthorityAudit(){
    var report = window.__sqAuditLocalStorageAuthority({ withPreview:true });
    var text = JSON.stringify(report, null, 2);
    try{
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text);
        console.log('SQ localStorage audit copied to clipboard');
      } else {
        console.log(text);
      }
    }catch(_){ console.log(text); }
    return report;
  };
})();
/* <<< PATCH:PHASE1_CANONICAL_GAME_ADAPTER_V1 END */

/* >>> PATCH:PHASE1_LOCALSTORAGE_POLICY_WARNINGS_V1 START */
(function(){
  if(window.__sqLocalStoragePolicyPatchLoaded) return;
  window.__sqLocalStoragePolicyPatchLoaded = true;

  var POLICY = {
    "hsLeaguePositions.v2": ["retired-ranking-cache-purged", "ranking movement cache retired; Supabase/canonical history is truth"],
    "powerRankings.allTime.lastRanks": ["retired-ranking-cache-purged", "all-time rank movement cache retired; Supabase/canonical history is truth"],
    "powerRankings.current.lastRanks": ["retired-ranking-cache-purged", "current rank movement cache retired; Supabase/canonical history is truth"],
    "shateki_players": ["safe-player-cloud-cache", "player setup/display cache synced from Supabase players; not stats authority"],
    "shateki_quest_scorer_v6": ["safe-recovery-cache", "in-progress recovery cache; guarded against completed/base state truth"],
    "sq_match_active_v1": ["safe-recovery-cache", "active match recovery cache; guarded against completed/base state truth"],
    "sq_playerhub_passwords": ["deprecated-do-not-use", "password-era player hub data; retire after checking current path"],
    "sq_recent_completed_games_cache_v2": ["retired-inspection-only", "completed-game cache retired; Supabase games plus canonical adapter are truth"]
  };
  var SAFE = {
    "sq_cloud_logons_disabled": "safe-debug-or-pref",
    "sq_daily_logons": "safe-debug-or-pref",
    "sq_device_id": "safe-device-cache",
    "SQ_PSTICKER_CACHE_V1": "safe-visual-cache"
  };

  window.__sqLocalStoragePolicy = POLICY;
  window.__sqLocalStorageSafePolicy = SAFE;

  function policyFor(key){
    key=String(key||'');
    if(Object.prototype.hasOwnProperty.call(POLICY,key)) return {key:key, policy:POLICY[key][0], reason:POLICY[key][1]};
    if(Object.prototype.hasOwnProperty.call(SAFE,key)) return {key:key, policy:SAFE[key], reason:'known safe cache/preference key'};
    return null;
  }
  window.__sqGetLocalStoragePolicy = policyFor;

  function shapeOf(raw){
    if(raw==null) return 'missing';
    try{
      var p=JSON.parse(raw);
      if(Array.isArray(p)) return 'json-array['+p.length+']';
      if(p&&typeof p==='object') return 'json-object{'+Object.keys(p).slice(0,5).join(',')+'}';
      return 'json-'+typeof p;
    }catch(_){ return String(raw).length>80?'string-long':'string'; }
  }

  window.__sqGetLocalStoragePolicyReport = function(){
    var keys = Object.keys(POLICY).concat(Object.keys(SAFE));
    var rows = keys.map(function(key){
      var raw=null, exists=false, bytes=0, shape='missing';
      try{ raw=localStorage.getItem(key); exists=raw!=null; bytes=raw==null?0:String(raw).length; shape=shapeOf(raw); }catch(e){ shape='read-error'; }
      var p=policyFor(key)||{};
      var action = (p.policy&&/^safe/.test(p.policy)) ? 'keep' : 'inspect-read-write-path';
      if(p.policy && /^(retired|purged)/.test(String(p.policy)) && !exists) action = 'retired-missing-ok';
      return { key:key, exists:exists, policy:p.policy||'unclassified', action:action, reason:p.reason||'', bytes:bytes, shape:shape };
    });
    try{ console.table(rows); }catch(_){ console.log(rows); }
    return rows;
  };
  window.__sqPrintLocalStoragePolicyReport = window.__sqGetLocalStoragePolicyReport;

  var warnedRead=Object.create(null), warnedWrite=Object.create(null);
  function risky(p, kind, value){
    if(!p) return false;
    var policy = String(p.policy || '');
    if(/^safe/.test(policy)) return false;
    // Retired/purged keys are intentionally inspected by old code during boot.
    // If absent, do not warn: absence is the desired state.
    if(kind === 'read' && value == null && /^(retired|purged)/.test(policy)) return false;
    return true;
  }
  function warnOnce(kind,key,value){
    var p=policyFor(key); if(!risky(p, kind, value)) return;
    var b=kind==='read'?warnedRead:warnedWrite; var id=kind+':'+key; if(b[id]) return; b[id]=1;
    try{ console.warn('[SQ localStorage authority warning]', {access:kind,key:key,policy:p.policy,reason:p.reason,valuePreview:value==null?null:String(value).slice(0,140)}); }catch(_){}
  }

  try{
    var og=Storage.prototype.getItem, os=Storage.prototype.setItem;
    if(og && !og.__sqPolicyWrapped){
      var ng=function(key){ var value=og.apply(this,arguments); try{ if(this===window.localStorage) warnOnce('read',String(key),value); }catch(_){} return value; };
      var ns=function(key,value){ try{ if(this===window.localStorage) warnOnce('write',String(key),value); }catch(_){} return os.apply(this,arguments); };
      ng.__sqPolicyWrapped=true; ns.__sqPolicyWrapped=true;
      Storage.prototype.getItem=ng; Storage.prototype.setItem=ns;
      console.info('[SQ] localStorage policy warning layer active');
    }
  }catch(e){ console.warn('[SQ] localStorage policy warning layer failed', e); }
})();
/* <<< PATCH:PHASE1_LOCALSTORAGE_POLICY_WARNINGS_V1 END */

// Override readers to fetch **only** from cloud and dedupe by a stable key
window.getGamesForMode = async function getGamesForMode(mode){
  try {
    var games = (typeof window.__sqGetAllGamesNormalized === 'function')
      ? await window.__sqGetAllGamesNormalized()
      : ((await cloudFetchAllGamesAsLocal()) || []);

    games = Array.isArray(games) ? games : [];
    var wantOfficial = String(mode || '').toLowerCase() === 'official';
    var filtered = games.filter(function(g){
      return wantOfficial
        ? (typeof window.__sqIsOfficialGame === 'function' ? window.__sqIsOfficialGame(g) : isOfficialGame(g))
        : (typeof window.__sqIsPracticeGame === 'function' ? window.__sqIsPracticeGame(g) : isPracticeGame(g));
    });

    return (typeof window.__sqDedupeNormalizedGames === 'function')
      ? window.__sqDedupeNormalizedGames(filtered)
      : filtered;
  } catch (e) {
    console.error('getGamesForMode (canonical cloud-only) failed', e);
    return [];
  }
};

window.getMatchesOfficial = async function getMatchesOfficial(){
  try {
    const cloudMatches = await cloudFetchAllMatchesAsLocal();
    const list = Array.isArray(cloudMatches) ? cloudMatches : [];

    // De-dup by ts | players(lowercased)
    const map = new Map();
    const stableKey = (m) => {
      const players = (m.players || [])
        .map(p => (p && p.name) ? String(p.name).trim().toLowerCase() : '')
        .join(',');
      return [m.ts || '', players].join('|');
    };
    for (const m of list) {
      const key = stableKey(m);
      if (!map.has(key)) map.set(key, m);
    }
    return [...map.values()];
  } catch (e) {
    console.error('getMatchesOfficial (cloud-only) failed', e);
    return [];
  }
};

// Recover missing High Scores by scanning cloud Games for a recent window (default 24h).
async function recoverHighScoresFromCloudWindow(hours = 24){
  if (!ensureCloudInit()) { toast('Cloud not initialised'); return { inserted:0, scanned:0, skipped:0 }; }
  const now = Date.now();
  const fromIso = new Date(now - (hours * 60 * 60 * 1000)).toISOString();
  const toIso   = new Date(now + (5 * 60 * 1000)).toISOString(); // small future skew for device time drift

  let scanned = 0, inserted = 0, skipped = 0;
  let rows = [];
  try {
    const { data, error } = await sb
      .from(TABLE_GAMES)
      .select('created_at, state, totals')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true });
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    console.error('recover HS: fetch games failed', e);
    toast('Recover HS failed: could not fetch games');
    return { inserted, scanned, skipped };
  }

  for (const g of rows) {
    scanned++;
    const players = (g?.state?.players || [])
      .map(p => (typeof p === 'string') ? { name: p } : p)
      .filter(Boolean);
    const totals = Array.isArray(g?.totals) ? g.totals : [];
    const ts = g?.created_at || new Date().toISOString();
    const isSingle = players.length === 1;
    const table = isSingle
      ? (typeof TABLE_HS_PRACTICE !== 'undefined' ? TABLE_HS_PRACTICE : 'high_scores_practice')
      : (typeof TABLE_HS_LEAGUE   !== 'undefined' ? TABLE_HS_LEAGUE   : 'high_scores');

    for (let i = 0; i < players.length; i++) {
      const name  = players[i]?.name || '';
      const score = Number(totals[i] || 0);
      if (!name || score <= 0) continue;
      try {
        const playerId = players[i]?.id || players[i]?.player_id || null;
        const gameId = g?.id || null;
        if (!playerId || !gameId) { skipped++; continue; }
        const ok = await cloudInsertHighScoreIfMissing(table, playerId, name, score, ts, gameId);
        if (ok) inserted++; else skipped++;
      } catch (e) {
        console.error('recover HS: insert failed', e);
        skipped++;
      }
    }
  }

  return { inserted, scanned, skipped };
}

/*****************
 * BACKFILL: Sync all local data → Supabase
 *****************/
  async function backfillLocalGamesToCloud() {
    const games = (typeof getGameLog === 'function') ? (getGameLog() || []) : [];
    let inserted = 0, hs = 0, playerRows = 0;
    for (const g of games) {
      try {
        const players = (g.players || []).map(p => typeof p === 'string' ? { name:p } : p).filter(Boolean);
        const totals  = Array.isArray(g.totals) ? g.totals : [];
        const isSingle = players.length === 1;
        const ts = g.ts || new Date().toISOString();

        // --- games table
        if (typeof TABLE_GAMES !== 'undefined') {
          const payload = {
            created_at: ts,
            state: { players, board: g.board || null },
            totals,
            finished: true,
            match_id: g.match_id || null
          };
          try {
            const { error } = await sb.from(TABLE_GAMES).insert(payload);
            if (!error) inserted++;
          } catch (e) {
            // attempt upsert on conflict(created_at) if supported
            try {
              const { error } = await sb.from(TABLE_GAMES).upsert(payload);
              if (!error) inserted++;
            } catch(_) {}
          }
        }

        // --- high scores tables
        if (typeof cloudInsertHighScore === 'function') {
          for (let i = 0; i < players.length; i++) {
            const name = players[i]?.name || `Player ${i+1}`;
            const score = Number(totals[i] || 0);
            if (!name || score <= 0) continue;
            try { await cloudInsertHighScore(name, score, isPractice); hs++; } catch(_) {}
          }
        }

        // --- player_games (optional; skipped when using a view like `player_games_union`)
        if (ENABLE_PLAYER_GAMES_WRITES && typeof TABLE_PLAYER_GAMES !== 'undefined' && players.length) {
          const sorted = totals.map((t,i)=>({t:Number(t||0),i})).sort((a,b)=>b.t-a.t);
          const posByIdx = Array(players.length).fill(null);
          sorted.forEach((o,rank)=>{ posByIdx[o.i] = rank+1; });
          for (let i=0;i<players.length;i++){
            const row = {
              sheet_id: g.sheet_id || null,
              player: players[i]?.name || `Player ${i+1}`,
              score: Number(totals[i] || 0),
              position: posByIdx[i] || null,
              ts,
              is_practice: isSingle,
              rounds: (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : null)
            };
            try {
              const { error } = await sb.from(TABLE_PLAYER_GAMES).insert(row);
              if (!error) playerRows++;
            } catch(_) {}
          }
        }
      } catch (e) {
        console.error('Backfill game failed', e);
      }
    }
    return { inserted, hs, playerRows, scanned: games.length };
  }
  
  async function backfillLocalMatchesToCloud() {
    const matches = (typeof getMatchLog === 'function') ? (getMatchLog() || []) : [];
    if (typeof TABLE_MATCHES === 'undefined') return { inserted: 0, scanned: matches.length };
    let inserted = 0;
    for (const m of matches) {
      try {
        const payload = {
          id: m.id || null,
          created_at: m.ts || new Date().toISOString(),
          players: (m.players || []).map(p => typeof p === 'string' ? { name:p } : p),
          wins: m.wins || [],
          total_games: m.games || (Array.isArray(m.history) ? m.history.length : null),
          history: (m.history || []).map(g => ({ totals: g.totals || [] }))
        };
        try {
          const { error } = await sb.from(TABLE_MATCHES).insert(payload);
          if (!error) inserted++;
        } catch(_) {
          try {
            const { error } = await sb.from(TABLE_MATCHES).upsert(payload);
            if (!error) inserted++;
          } catch(e) { console.warn('match upsert failed', e); }
        }
      } catch (e) {
        console.error('Backfill match failed', e);
      }
    }
    return { inserted, scanned: matches.length };
  }
  
  async function runBackfillAll(){
    if (!ensureCloudInit()) { toast('Cloud not initialised'); return; }
    const btn = document.getElementById('backfillAllBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Backdating…'; }
    toast('Starting backdate — syncing local → cloud');
    try {
      const gamesRes   = await backfillLocalGamesToCloud();
      const matchesRes = await backfillLocalMatchesToCloud();
      const msg = `Backdate done.
  Games: ${gamesRes.inserted}/${gamesRes.scanned} to cloud
  High scores rows: ${gamesRes.hs}
  Player-game rows: ${gamesRes.playerRows}
  Matches: ${matchesRes.inserted}/${matchesRes.scanned}`;
      console.log(msg.replace(/\\n/g,' '));
      toast('Backdate complete ✔');
    } catch (e) {
      console.error(e);
      toast('Backdate failed — see console');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'BACKDATE: Sync Local → Cloud'; }
      try { await initialCloudCheck(); } catch(_) {}
    }
  }

// === Player Summary Stats dialog (cloud-only, simple aggregate) ===
window.openPlayerSummaryStatsDialog = async function openPlayerSummaryStatsDialog(playerName, mode){
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal   = document.createElement('div'); modal.className   = 'modal';
  const title   = document.createElement('h3');
  const body    = document.createElement('div'); body.className    = 'modal-body';
  const footer  = document.createElement('div'); footer.className  = 'modal-footer';

  const isPractice = (mode === 'practice' || mode === true);

  title.textContent = 'Player Stats — ' + (playerName || 'Unknown') + (isPractice ? ' (Practice)' : ' (Official)');

  async function render(){
    body.innerHTML = '';

    try{
      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()){
        const p = document.createElement('p');
        p.textContent = 'Cloud not initialised.';
        body.appendChild(p);
        return;
      }
    } catch(_){}

    // Fetch all games for this player/mode from the cloud view
    let rows = [];
    try{
      const tableName = (typeof TABLE_PLAYER_GAMES !== 'undefined' && TABLE_PLAYER_GAMES)
        ? TABLE_PLAYER_GAMES
        : 'player_games_union';

      const query = sb
        .from(tableName)
        .select('score, position, ts, is_practice, rounds')
        .eq('player', playerName || '')
        .eq('is_practice', !!isPractice)
        .order('ts', { ascending: false })
        .limit(5000);

      const { data, error } = await query;
      if (error) throw error;
      rows = data || [];
    }catch(e){
      console.error('Player summary stats fetch failed', e);
      const p = document.createElement('p');
      p.textContent = 'Failed to load stats.';
      const d = document.createElement('p');
      d.className = 'tag';
      d.textContent = (e && e.message) ? e.message : 'Unknown error';
      body.append(p, d);
      return;
    }

    if (!rows.length){
      const p = document.createElement('p');
      p.textContent = 'No games found for this player in this mode.';
      body.appendChild(p);
      return;
    }

    // Basic aggregates
    const games = rows.length;
    const scores = rows.map(r => Number(r.score || 0));
    const wins   = rows.filter(r => Number(r.position || 0) === 1).length;
    const best   = Math.max(...scores);
    const worst  = Math.min(...scores);
    const total  = scores.reduce((s,v)=> s + v, 0);
    const avg    = total / games;

    const last   = rows[0];
    const lastScore = Number(last.score || 0);
    const lastWhen  = (window.fmtWhen && last.ts) ? window.fmtWhen(last.ts) : (last.ts || '');

    // Build a compact two-column table of stats
    const table = document.createElement('table');
    table.className = 'hs-table compact';

    const tbody = document.createElement('tbody');
    function addRow(label, value){
      const tr = document.createElement('tr');
      const tdL = document.createElement('td'); tdL.textContent = label;
      const tdV = document.createElement('td'); tdV.textContent = value;
      tr.append(tdL, tdV);
      tbody.appendChild(tr);
    }

    const winPct = games ? ((wins / games) * 100).toFixed(1) + '%' : '0%';
    addRow('Games Played', String(games));
    addRow('Wins',        `${wins} (${winPct})`);
    addRow('Best Score',  String(best));
    addRow('Worst Score', String(worst));
    addRow('Average Score', avg.toFixed(1));
    addRow('Last Game Score', String(lastScore));
    addRow('Last Game When',  lastWhen || '—');

    table.appendChild(tbody);
    body.appendChild(table);
  }

  await render();

  const backBtn  = document.createElement('button'); backBtn.className  = 'btn sq-pill'; backBtn.textContent  = 'Return';
  const closeBtn = document.createElement('button'); closeBtn.className = 'btn sq-pill'; closeBtn.textContent = 'Close';
backBtn.onclick  = () => {
  overlay.remove();
  try { 
    if (typeof window.openPlayerStatsModePicker === 'function') {
      window.openPlayerStatsModePicker(name || pretty || playerName);
    }
  } catch(_) {}
};  closeBtn.onclick = () => overlay.remove();
  footer.append(backBtn, closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();
};

// === SHARED: Official Power Rankings calculator =============================
// Returns [{ player, rounds, avgRound, qualifies }] sorted by avgRound desc
// Rules: practice excluded, rounds = 10..20 + D + T + B, last 56 rounds window,
//        qualifies with >= 28 rounds (2 games)
// @MODE:POWER_RANKINGS_CLEAN_SOURCE
// Active Power Rankings read mode-specific Supabase clean views built from v_games_mode_classified.
// Official must not read the legacy power_rankings_last56_official view because that source predates
// the Turbo quarantine and can include legacy Turbo-shaped games.
window.__sqPowerRankingCleanViewForMode = function __sqPowerRankingCleanViewForMode(mode){
  mode = String(mode || 'official').toLowerCase();
  if (mode === 'turbo') return 'v_power_rankings_last56_turbo_clean';
  if (mode === 'practice' || mode === 'classic') return 'v_power_rankings_last56_practice_clean';
  return 'v_power_rankings_last56_official_clean';
};
window.__sqParsePowerRankTs = function __sqParsePowerRankTs(ts){
  try{
    if (!ts) return 0;
    if (typeof window.parseMs === 'function') {
      var parsed = window.parseMs(ts);
      if (Number.isFinite(Number(parsed)) && Number(parsed) > 0) return Number(parsed);
    }
    var s = String(ts).trim();
    if (/^\d{4}-\d{2}-\d{2}\s/.test(s) && !s.includes('T')) s = s.replace(' ', 'T');
    if (/[+-]\d{2}$/.test(s)) s += ':00';
    if (/[+-]\d{4}$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    var n = Date.parse(s);
    return Number.isFinite(n) ? n : 0;
  }catch(_){ return 0; }
};
window.getOfficialPowerRows = async function getOfficialPowerRows(){
  const MIN_ROUNDS = 28, WINDOW = 56;
  const INACTIVE_MS = 14 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  // Prefer DB-derived Power Rankings (Supabase view) for correctness + speed.
  try{
    if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) throw new Error('cloud not ready');
    if (typeof sb === 'undefined' || !sb || !sb.from) throw new Error('sb missing');

    if (typeof window.__sqFetchPowerRowsFromCleanRoundScores === 'function') {
      const guarded = await window.__sqFetchPowerRowsFromCleanRoundScores('official');
      if (guarded && guarded.length) {
        return guarded.map(r => ({
          player: r.player,
          playerKey: r.playerKey,
          rounds: r.rounds,
          avgRound: r.powerRank,
          recentMs: r.lastPlayedMs,
          rankPos: r.rankPos,
          qualifiesRounds: r.qualified,
          qualifiesRecent: r.active
        }));
      }
    }

    const VIEW = (typeof window.__sqPowerRankingCleanViewForMode === 'function')
      ? window.__sqPowerRankingCleanViewForMode('official')
      : 'v_power_rankings_last56_official_clean';
    let data = null;

    // Fetch pre-aggregated rows (server-truth).
    try{
      const q = await sb.from(VIEW)
        .select('player,player_key,rounds_used,total_points,avg_per_round,last_played_at,rank_pos')
        .limit(300);
      if (q.error) throw q.error;
      data = (q.data || []).sort((a,b)=>
        (Number(b.avg_per_round || 0) - Number(a.avg_per_round || 0)) ||
        (Number(b.rounds_used || 0) - Number(a.rounds_used || 0)) ||
        String(a.player || '').localeCompare(String(b.player || ''))
      );
    }catch(e1){
      if (typeof window.__sqFetchPowerRowsFromCleanRoundScores === 'function') {
        const fallback = await window.__sqFetchPowerRowsFromCleanRoundScores('official');
        return (fallback || []).map(r => ({
          player: r.player,
          playerKey: r.playerKey,
          rounds: r.rounds,
          avgRound: r.powerRank,
          recentMs: r.lastPlayedMs,
          rankPos: r.rankPos,
          qualifiesRounds: r.qualified,
          qualifiesRecent: r.active
        }));
      }
      throw e1;
    }

    const rows = (data || []).map(r=>{
      const player = String(r.player || '').trim();
      const playerKey = String(r.player_key || player).trim().toLowerCase();
      const roundsRaw = Number(r.rounds_used ?? 0);
      const rounds = Math.max(0, Math.min(WINDOW, roundsRaw || 0));

      // Clean views return avg_per_round as the authoritative Power Rank value. Recompute only if needed.
      const tp = Number(r.total_points ?? NaN);
      const viewAvg = Number(r.avg_per_round ?? NaN);
      const avgRound = Number.isFinite(viewAvg) ? viewAvg : ((Number.isFinite(tp) && rounds > 0) ? (tp / rounds) : 0);

      const lastAt = r.last_played_at || null;
      const recentMs = lastAt ? window.__sqParsePowerRankTs(lastAt) : 0;

      const qualifiesRounds = Number.isFinite(rounds) && rounds >= MIN_ROUNDS;
      const qualifiesRecent = lastAt ? (recentMs >= (nowMs - INACTIVE_MS)) : true; // if not available, don't block
      return { player, playerKey, rounds, avgRound, recentMs, rankPos:Number(r.rank_pos || 0) || null, qualifiesRounds, qualifiesRecent };
    }).filter(r=>r.player);

    const out = rows
      .filter(r=> r.qualifiesRounds && r.qualifiesRecent)
      .sort((a,b)=>
        (b.avgRound - a.avgRound) ||
        (b.rounds   - a.rounds)   ||
        (b.recentMs - a.recentMs) ||
        String(a.player).localeCompare(String(b.player))
      );

    return out;
  }catch(_dbErr){
    try{ if (window.SQ_DEBUG) console.warn('[SQ] Official Power Rankings clean source unavailable.', _dbErr); }catch(_){}
    return [];
  }
};

// [removed: openPlayerProgressionDialog dead def #2] audit P5.3 batch 2 — dead/shadowed definition, no live callers

// === Patch Player Stats modal to wire PROGRESSION button ===
(function(){
  if (window.__playerProgressionPatch) return;
  window.__playerProgressionPatch = true;

  function attachProgression(root){
    try{
      const modal = root.querySelector('.modal');
      if (!modal) return;
      const h3 = modal.querySelector('h3');
      if (!h3) return;
      const title = (h3.textContent || '').trim();
      if (!/^Player Stats/i.test(title)) return;

      // Extract player name + mode from title: "Player Stats — Name (Practice)"
      let rest = title.replace(/^Player Stats\s*[\u2013\u2014\-]\s*/i, '');
      const isPractice = /\(practice\)/i.test(rest);
      rest = rest.replace(/\(.*\)\s*$/,'').trim();
      const playerName = rest || 'Unknown';

      const buttons = Array.from(modal.querySelectorAll('button'));
      const progBtn = buttons.find(b => (b.textContent || '').trim().toUpperCase() === 'PROGRESSION');
      if (!progBtn) return;

      // Avoid double-binding
      if (progBtn.dataset && progBtn.dataset.progressionBound === '1') return;
      if (progBtn.dataset) progBtn.dataset.progressionBound = '1';

      progBtn.onclick = () => {
        try{
          if (typeof window.openPlayerProgressionDialog === 'function'){
            window.openPlayerProgressionDialog(playerName, isPractice);
          }
        }catch(e){
          console.error('Progression button handler failed', e);
        }
      };
    }catch(e){
      console.error('attachProgression error', e);
    }
  }

  try {
    window.__sqUIMutationBus?.on((muts) => {
      for (const m of (muts || [])){
        for (const n of (m.addedNodes || [])){
          if (n.nodeType !== 1) continue;
          if (n.classList.contains('modal-backdrop')){
            setTimeout(() => attachProgression(n), 0);
          } else if (n.querySelector){
            const backdrop = n.querySelector('.modal-backdrop');
            if (backdrop) setTimeout(() => attachProgression(backdrop), 0);
          }
        }
      }
    });
  } catch(_) {}
})();

(function(){
  // >>> PATCH:game-utils START — shared game/time helpers for games lists
  if (window.__gameTimeUtilsPatched) return;
  window.__gameTimeUtilsPatched = true;

  // Canonical timestamp extractor for game rows
  window.getGameTimestamp = function getGameTimestamp(g){
    if (!g || typeof g !== 'object') return null;
    const tsVal = g.ts || g.created_at || g.inserted_at || (g.meta && (g.meta.ts || g.meta.date)) || null;
    if (!tsVal) return null;
    const d = new Date(tsVal);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // Canonical result line: "A 220 beat B 190 C 175" etc.
  window.formatGameResultLine = function formatGameResultLine(g){
    if (!g) return '';

    const alias = (typeof window !== 'undefined' && typeof window.__sqApplyPlayerAlias === 'function')
      ? window.__sqApplyPlayerAlias
      : (x)=>x;

    const players = (g.players || []).map(p => {
      const nm = (p && typeof p === 'object' && 'name' in p) ? p.name : String(p || '');
      return alias(nm);
    });
    const totals  = Array.isArray(g.totals) ? g.totals : [];

    const ordered = players
      .map((name, i) => ({ name, score: Number(totals[i] || 0) }))
      .filter(x => x.name)
      .sort((a, b) => b.score - a.score);

    let result = '—';
    if (ordered.length >= 2){
      result = `${ordered[0].name} ${ordered[0].score} beat ${ordered[1].name} ${ordered[1].score}`;
      if (ordered.length > 2){
        result += ' ' + ordered.slice(2).map(o => `${o.name} ${o.score}`).join(' ');
      }
    } else if (ordered.length === 1){
      result = `${ordered[0].name} ${ordered[0].score}`;
    }

    return result;
  };

  // Canonical date/time formatter (Europe/London, DD/MM[/YY] HH:MM)
  window.fmtWhen = function fmtWhen(ts, opts){
    if (!ts) return '';
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const HH = String(d.getHours()).padStart(2, '0');
    const MI = String(d.getMinutes()).padStart(2, '0');

    if (opts && opts.omitYear) {
      return `${dd}/${mm} ${HH}:${MI}`;
    }
    return `${dd}/${mm}/${yy} ${HH}:${MI}`;
  };
})();
// >>> PATCH:game-utils END

