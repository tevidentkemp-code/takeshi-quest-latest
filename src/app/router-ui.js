// ===== @SEC:JS:UI:ROUTER =====
function __sqIsTurboVisualRuntime(){
  try{
    const m = (typeof state !== 'undefined' && state && state.match) ? state.match : {};
    const draft = (typeof window !== 'undefined' && (window.__sqTournamentDraft || state?.__sqTournamentDraft)) || null;
    const rules = m.tournamentRules || m.rules || draft?.rules || {};
    const mode = String(m.mode || m.gameMode || state?.mode || state?.gameMode || '').toLowerCase();
    const variant = String(m.gameVariant || state?.gameVariant || '').toLowerCase();
    const type = String(m.tournamentType || m.type || state?.tournamentType || draft?.type || '').toLowerCase();
    const startTarget = String(m.startTarget || state?.startTarget || rules.startTarget || '').toLowerCase();
    return !!(type === 'turbo' || variant === 'turbo' || mode === 'turbo' || startTarget === '17' || m.strictTimer === true || state?.strictTimer === true || Number(m.throwLimitSeconds || state?.throwLimitSeconds || rules.throwLimitSeconds || 0) === 20);
  }catch(_){ return false; }
}
function __sqSyncTurboVisualState(page){
  try{
    const on = String(page || document.body?.dataset?.page || '') === 'game' && __sqIsTurboVisualRuntime();
    document.body.classList.toggle('sq-mode-turbo', !!on);
    if (on) document.body.setAttribute('data-sq-variant', 'turbo');
    else document.body.removeAttribute('data-sq-variant');
    const panel = document.getElementById('liveV2Panel');
    if (panel) panel.classList.toggle('sq-game-turbo', !!on);
  }catch(_){ }
}
function show(id){
  try{
    if (id !== 'game' && typeof __sqClearVsShadowTimers === 'function') __sqClearVsShadowTimers('show:' + id);
    if (id === 'game' && typeof __sqNormalizeVsShadowRuntimeState === 'function') __sqNormalizeVsShadowRuntimeState('show:game');
  }catch(_){ }
  ['details','players','game','leaderboard'].forEach(x=>byId(x)?.classList.add('hidden'));
  byId(id)?.classList.remove('hidden');
  document.body.setAttribute('data-page', id);
  try{ __sqSyncTurboVisualState(id); }catch(_){}
  updatePadSpacer();
  try{ bindFHCollapseScroll(); updateFHCollapse(id); }catch(e){}
  const fh=byId('floatHead');
  if(fh) fh.classList.toggle('hidden', id!=='game');
  buildPad();
  if (id === 'players') { try{ __msUpdateStartEnabled(); }catch(_){} }
  if (id === 'details') {
    try {
      if (typeof window.buildStartTicker === 'function') { window.buildStartTicker(); }
    } catch(e) { console.error(e); }
  }
  if (id === 'game') {
    // Ensure scoreboard DOM is built when resuming/loading live games
    try { if (typeof ensureGameBuilt === 'function') ensureGameBuilt(); } catch(_) {}
    try{ __sqSyncTurboVisualState('game'); }catch(_){}
    try { if (typeof updateUI === 'function') updateUI(); } catch(_) {}
    try{
      window.__sqDmdPrimePbCache?.();
      const firstVisit = !state?.finished && Number(state?.currentRound || 0) === 0 && Number(state?.currentDart || 0) === 0 && (!Array.isArray(state?.history) || state.history.length === 0);
      if (firstVisit) {
        const introKey = `${state?.match?.id || 'match'}|${state?.__gameToken || state?.match?.history?.length || 0}`;
        if (window.__sqDmdInitialIntroKey !== introKey) {
          window.__sqDmdInitialIntroKey = introKey;
          setTimeout(()=>{ try{ window.__sqDmdShowTurnIntro?.(true); }catch(_){} }, 0);
        }
      }
    }catch(_){}
    try { if (typeof __sqResumeVsShadowAutoTurnIfNeeded === 'function') __sqResumeVsShadowAutoTurnIfNeeded('show:game'); } catch(_) {}
    if (window.__marksKick) { clearInterval(window.__marksKick); window.__marksKick = null; }
    try { if (typeof scanForTripleHatAndCelebrate === 'function') scanForTripleHatAndCelebrate(); } catch(_) {}
  try { if (typeof updatePBGRBadges === 'function') updatePBGRBadges(); } catch(_) {}
  }
}
const padBar = byId('padBar');
const pad     = byId('pad');
const padHint = byId('padHint');
function updatePadSpacer(){
  try{
    const h = padBar ? padBar.getBoundingClientRect().height : 148;
    document.documentElement.style.setProperty('--pad-h', h + 'px');

    // Ensure the last scoreboard row can scroll above the fixed pad bar (classic scroll mode).
    const page = document.body.getAttribute('data-page') || '';
    const wrap = document.querySelector('.wrap');
    if (wrap){
      if (page === 'game') {
        wrap.style.paddingBottom = Math.max(20, Math.round(h + 18)) + 'px';
      } else {
        wrap.style.paddingBottom = '';
      }
    }
  }catch(e){}
  try{
    const topRow = document.getElementById('gameTopRow');
    if(topRow){
      const rh = Math.ceil(topRow.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--fhMenuH', rh + 'px');
      window.__sqFHMenuH = rh;
    }
  }catch(e){}
}

// Keep the in-header top buttons (B1) collapsible on scroll.
let __sqFHScrollBound = false;
function updateFHCollapse(forcePage){
  try{
    const page = forcePage || document.body.getAttribute('data-page') || '';
    const wrap = document.querySelector('.wrap');
    const mh = (window.__sqFHMenuH != null ? window.__sqFHMenuH : 48);

    if (page !== 'game' || !wrap){
      document.documentElement.style.setProperty('--fhCollapse', '0px');
      document.documentElement.style.setProperty('--fhScrollGate', '0px');
      return;
    }

    const s = Math.max(0, wrap.scrollTop || 0);
    const c = Math.max(0, Math.min(s, mh));

    // Phase gate:
    //  - While B1 is collapsing (s < mh), prevent A2/D content from moving under the sticky header.
    //    We cancel BOTH the scroll movement and the header-height shrink by offsetting 2*c.
    //  - Once B1 is fully gone (s >= mh), release the content to scroll normally.
    const gate = (s < mh) ? (2 * c) : mh;

    document.documentElement.style.setProperty('--fhCollapse', c + 'px');
    document.documentElement.style.setProperty('--fhScrollGate', gate + 'px');
  }catch(e){}
}
function bindFHCollapseScroll(){
  if (__sqFHScrollBound) return;
  const wrap = document.querySelector('.wrap');
  if (!wrap) return;
  wrap.addEventListener('scroll', () => {
    if (document.body.getAttribute('data-page') !== 'game') return;
    updateFHCollapse();
    // keep animated bars aligned during menu collapse / scroll (no animation on scroll)
    requestAnimationFrame(() => {
      try{ updateTurnBar(false); }catch(_){ }
      try{ updateRoundBar(false, true); }catch(_){ }
    });
  }, { passive:true });
  __sqFHScrollBound = true;
}
window.addEventListener('load', bindFHCollapseScroll, { passive:true });

addEventListener('resize', updatePadSpacer, { passive:true });
addEventListener('orientationchange', updatePadSpacer, { passive:true });
window.addEventListener('load', syncStartTitleWidth, { passive: true });

/*****************
 * GAME & STATE
 *****************/
const ROUNDS = (()=>{ const a=[]; for(let i=0;i<11;i++) a.push({type:'number',target:10+i}); a.push({type:'doubles'},{type:'triples'},{type:'bull'}); return a; })();
function labelForRound(def){
  if (!def) return '';
  if (def.type === 'number')  return String(def.target);
  if (def.type === 'doubles') return 'D';
  if (def.type === 'triples') return 'T';
  if (def.type === 'bull')    return 'B';
  return '';
}
const MAX_ROUNDS=ROUNDS.length;
const totalScoreForPlayer = i => (state.score[i]||[]).reduce((s,row)=>s+(row?.roundTotal||0),0);
const save = () => {
  safeSave(STORAGE_KEY, state);
  try { if (typeof onStateSaved === 'function') onStateSaved(); } catch(_) {}
};
function ensureMatchAgg(){ if(state.matchAgg && state.matchAgg.hits) return; state.matchAgg={ hits:Array.from({length:state.players.length},()=>({})), totals60:Array.from({length:state.players.length},()=>0), totals100:Array.from({length:state.players.length},()=>0), totals140:Array.from({length:state.players.length},()=>0) }; }

function getGameLog() {
  const v1 = safeLoad(GAMES_LOG_KEY);
  if (Array.isArray(v1) && v1.length) return v1;

  // Fallback to legacy keys; if found, migrate to v1 for future reads
  for (const k of (LEGACY_GAME_KEYS || [])) {
    const v = safeLoad(k);
    if (Array.isArray(v) && v.length) {
      setGameLog(v);
      return v;
    }
  }
  return [];
}

function setGameLog(arr) {
  safeSave(GAMES_LOG_KEY, arr || []);
}

function getMatchLog() {
  const v1 = safeLoad(MATCHES_LOG_KEY);
  if (Array.isArray(v1) && v1.length) return v1;

  for (const k of (LEGACY_MATCH_KEYS || [])) {
    const v = safeLoad(k);
    if (Array.isArray(v) && v.length) {
      setMatchLog(v);
      return v;
    }
  }
  return [];
}

function setMatchLog(arr) {
  safeSave(MATCHES_LOG_KEY, arr || []);
}

function logCompletedGame(totals, winners, boardClone) {
  const games  = getGameLog();
  const nowIso = _tsOverride || new Date().toISOString();
  const runtimePlayers = Array.isArray(state.players) ? state.players : [];
  const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
  const realPlayers = (typeof __sqRealPlayersOnly === 'function') ? __sqRealPlayersOnly(runtimePlayers) : runtimePlayers;
  const realTotals = (typeof __sqRealOnlyTotals === 'function') ? __sqRealOnlyTotals(totals || [], runtimePlayers) : (totals || []).slice();
  const realBoard = (typeof __sqRealOnlyBoard === 'function') ? __sqRealOnlyBoard(boardClone || [], runtimePlayers) : boardClone;
  const realWinners = (typeof __sqRealOnlyWinnerIndexes === 'function') ? __sqRealOnlyWinnerIndexes(winners || [], runtimePlayers) : (winners || []).slice();
  const mode = isVsShadow ? 'practice' : (__sqComputeGameMode ? __sqComputeGameMode() : ((runtimePlayers.length>=2)?'official':'practice'));

  // Build a single game record object we can reuse
  const gameRecord = {
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: nowIso,
    matchId: state.match.id || null,
    players: realPlayers.map(p => ({ name: p.name })),
    totals: realTotals,
    winners: isVsShadow ? [] : realWinners,
    board: realBoard,
    mode,
    is_practice: (mode === 'practice')
  };

  if (isVsShadow && typeof __sqAssertNoShadowPersistPayload === 'function' && !__sqAssertNoShadowPersistPayload(gameRecord, 'logCompletedGame')) return;

  games.push(gameRecord);
  setGameLog(games);
    // Persist each player's total as a High Score row (respects backdate)
  (async () => {
    try {
      await cloudSaveHighScoresForGame(totals, nowIso, null);
    } catch (e) {
      console.error('High score cloud save failed', e);
    }
  })();
};

function logCompletedMatch() {
  if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) return;
  const matches = getMatchLog();
  const nowIso = new Date().toISOString();
  const gamesInMatch = state.match.history.length;

  const runtimePlayers = Array.isArray(state.players) ? state.players : [];
  const realPlayers = (typeof __sqRealPlayersOnly === 'function') ? __sqRealPlayersOnly(runtimePlayers) : runtimePlayers;
  const players = realPlayers.map(p => ({ name: p.name }));
  const wins    = (typeof __sqRealOnlyArray === 'function') ? __sqRealOnlyArray(state.match.wins || [], runtimePlayers) : (state.match.wins || []).slice();

  const realIndexes = (typeof __sqRealPlayerIndexes === 'function') ? __sqRealPlayerIndexes(runtimePlayers) : runtimePlayers.map((_, idx) => idx);
  const matchTotals = realIndexes.map(idx =>
    state.match.history.reduce((sum, g) => sum + (g.totals?.[idx] || 0), 0)
  );

  matches.push({
    id: state.match.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: nowIso,
    players,
    wins,
    targetWins: state.match.targetWins || 1,
    games: gamesInMatch,
    matchTotals
  });

  setMatchLog(matches);
}

/*****************
 * SUPABASE HELPERS
 *****************/

// Safari-safe timestamp parsing.
// Accepts ISO strings, PostgREST timestamps like '2026-01-18 13:53:52.437+00', and epoch ms/seconds.
function parseMs(v){
  if (v == null) return null;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  const s0 = String(v).trim();
  if (!s0) return null;
  if (/^\d+$/.test(s0)) {
    const n = Number(s0);
    return n > 1e12 ? n : n * 1000;
  }

  // Normalise Postgres/Supabase timestamps for Safari/iOS.
  // Examples seen:
  //  - "2026-02-13 21:44:16.012+00"
  //  - "2026-02-13 21:44:16+0000"
  //  - "2026-02-13T21:44:16.012+00:00"
  // Safari is strict: needs "T" separator and timezone like +00:00.
  let iso = s0.replace(' ', 'T');

  // +00  -> +00:00
  iso = iso.replace(/([+-]\d{2})$/, '$1:00');

  // +0000 -> +00:00
  iso = iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

  // Some sources omit seconds; Date.parse can still handle most, but keep as-is otherwise.
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

async function cloudSynthAllGamesFromHighScores(limit = 500) {
  const items = [];
  async function fetchTbl(tbl) {
    const { data, error } = await sb
      .from(tbl)
      .select('name, score, ts, game_id')
      .order('ts', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
  try {
    const league   = await fetchTbl(TABLE_HS_LEAGUE);
    const practice = await fetchTbl(TABLE_HS_PRACTICE);
    [...league, ...practice].forEach(row => {
      items.push({
        ts: row.ts || null,
        players: [{ name: row.name }],
        totals:  [Number(row.score) || 0],
        board:   null
      });
    });
  } catch (e) {
    console.error('cloudSynthAllGamesFromHighScores failed', e);
  }
  return items;
}

// PLAYERS
// PLAYERS
async function cloudListPlayers(force=false){
  try{ if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return []; }catch(_){ return []; }

  const data = await __sqFetchPlayersRows(!!force);

  // Cache active player names/ids for light UI (ticker etc.)
  try {
    const list = Array.isArray(data) ? data : [];
    window.__sqPlayersList = list;
    const set = new Set(list.map(p => String(p?.name || '').trim().toLowerCase()).filter(Boolean));
    window.__sqActivePlayerNameSet = set;
    window.__sqIsActivePlayerName = (nm) => {
      const key = String(nm || '').trim().toLowerCase();
      return key ? (window.__sqActivePlayerNameSet?.has(key) === true) : false;
    };
  } catch (_) {}
  return data || [];
}

// Create / update a player by name only (no password)
async function cloudCreatePlayer(name, profile){
  const nm = String(name||'').trim();
  const p = (profile && typeof profile === 'object') ? profile : {};
  const initials = __sqNormalizeInitials(String(p.initials||''), nm);
  const row = {
    name: nm,
    initials,
    first_name: (p.first_name != null) ? String(p.first_name||'').trim() : undefined,
    last_name:  (p.last_name  != null) ? String(p.last_name ||'').trim() : undefined,
    nickname:   (p.nickname   != null) ? String(p.nickname  ||'').trim() : undefined,
    avatar_id:  (p.avatar_id  != null) ? __sqNormalizeAvatarId(p.avatar_id, nm) : undefined,
  };

  // Try full schema; fall back if columns missing.
  try{
    const { error } = await sb
      .from(TABLE_PLAYERS)
      .upsert(row, { onConflict: 'name' });
    if (error) throw error;
    markCloudOk();
    try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('player_upsert'); }catch(_){}
    return;
  }catch(e1){
    if (row.avatar_id != null) { markCloudError(e1); throw __sqAvatarSaveError(e1); }
    const msg = String(e1?.message || e1 || '');
    const code = String(e1?.code || '');
    const isMissingCols = (code === '42703') || /(initials|first_name|last_name|nickname|avatar_id)/i.test(msg);
    if (!isMissingCols){
      markCloudError(e1);
      throw e1;
    }
    // Minimal schema fallback
    try{
      const { error } = await sb
        .from(TABLE_PLAYERS)
        .upsert({ name: nm, initials }, { onConflict: 'name' });
      if (error) throw error;
      markCloudOk();
      try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('player_upsert_fallback'); }catch(_){}
      return;
    }catch(e2){
      const msg2 = String(e2?.message || e2 || '');
      const code2 = String(e2?.code || '');
      const isMissingInitials = (code2 === '42703') || /initials/i.test(msg2);
      if (!isMissingInitials){ markCloudError(e2); throw e2; }
      const { error } = await sb
        .from(TABLE_PLAYERS)
        .upsert({ name: nm }, { onConflict: 'name' });
      if (error){ markCloudError(error); throw error; }
      markCloudOk();
      try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('player_upsert_name_only'); }catch(_){}
    }
  }
}

// Update initials for a player (by id when available; by resolved name otherwise)
async function cloudUpdatePlayerInitials(playerOrName, initials){
  const obj = (playerOrName && typeof playerOrName === 'object') ? playerOrName : null;
  const nmIn = obj ? String(obj.name||'').trim() : String(playerOrName||'').trim();
  const id = obj && obj.id ? obj.id : null;
  if (!nmIn && !id) throw new Error('Update initials failed: missing player key');

  const init = __sqNormalizeInitials(initials, nmIn);
  try{
    let q = sb.from(TABLE_PLAYERS).update({ initials: init });
    if (id) {
      q = q.eq('id', id);
    } else {
      const resolved = await cloudResolvePlayerKeyByName(nmIn);
      const targetName = (resolved && resolved.name) ? resolved.name : nmIn;
      q = q.eq('name', targetName);
    }
    const { data, error } = await q.select('id, name, initials').maybeSingle();
    if (error) throw error;
    markCloudOk();
    try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('player_initials_update'); }catch(_){}
    return data || null;
  }catch(e1){
    const msg = String(e1?.message || e1 || '');
    const code = String(e1?.code || '');
    const isMissingInitials = (code === '42703') || /initials/i.test(msg);
    if (!isMissingInitials){
      markCloudError(e1);
      throw e1;
    }
    // Column doesn't exist yet: treat as no-op so UI doesn't break.
    markCloudOk();
    return null;
  }
}

async function cloudDeletePlayer(playerOrName){
  // "Delete" is now SAFE: archive snapshot (best effort) then soft-delete (preferred) with hard-delete fallback.
  const obj = (playerOrName && typeof playerOrName === 'object') ? playerOrName : null;
  const raw = obj ? (obj.id || obj.name || '') : String(playerOrName || '');
  const t = String(raw).trim();
  if (!t) return;

  if (!ensureCloudInit()) throw new Error('Cloud not ready');
  const sb = window.sb;

  const name = obj ? String(obj.name || '').trim() : (sqIsUuidLike(t) ? '' : t);
  let playerId = obj?.id ? String(obj.id).trim() : (sqIsUuidLike(t) ? t : null);

  if (!playerId && name){
    try{ playerId = await cloudResolvePlayerId(name); }catch(e){}
  }

  // Fetch player row for archive (best effort)
  let row = null;
  if (playerId){
    const r = await sb.from(TABLE_PLAYERS).select('*').eq('id', playerId).maybeSingle();
    if (!r.error) row = r.data || null;
  } else if (name){
    const r = await sb.from(TABLE_PLAYERS).select('*').ilike('name', name).limit(1).maybeSingle();
    if (!r.error) row = r.data || null;
    if (row?.id) playerId = row.id;
  }

  if (row) await cloudArchivePlayerSnapshot(row, 'admin_delete');

  // Prefer soft-delete (keeps history + allows restore)
  const deletedAt = new Date().toISOString();
  let softOk = false;

  if (playerId){
    const u = await sb.from(TABLE_PLAYERS).update({ deleted_at: deletedAt }).eq('id', playerId);
    softOk = !u.error;
  } else if (name){
    const u = await sb.from(TABLE_PLAYERS).update({ deleted_at: deletedAt }).ilike('name', name);
    softOk = !u.error;
  }

  // Fallback hard-delete only if soft-delete isn't available
  if (!softOk){
    if (playerId){
      const d = await sb.from(TABLE_PLAYERS).delete().eq('id', playerId);
      if (d.error) throw d.error;
    } else if (name){
      const d = await sb.from(TABLE_PLAYERS).delete().ilike('name', name);
      if (d.error) throw d.error;
    }
  }

  await cloudRefreshPlayerDirectory(true);
  window.dispatchEvent(new CustomEvent('sq:players-changed'));
}

// Fetch high scores from Supabase (league or practice)
async function cloudListHighScores(isPractice = false, limit = 500){
  const table = isPractice ? TABLE_HS_PRACTICE : TABLE_HS_LEAGUE;

  // Always use the initialised client (some call sites run before `sb` is rebound).
  const client = (window.sb || sb);

  // >>> PATCH:PBGR_ADMIN_GAMES_FALLBACK_V3 START
// Final safety net for Admin PB/GR: if PB/WR views are empty or schema-mismatched,
// compute the same table directly from Supabase games.state.board. This is read-only.
(function(){
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function alias(obj, k, meta){
    if (!k) return;
    obj[k] = meta;
    const n = Number(k);
    if (Number.isFinite(n) && n >= 10 && n <= 20) obj['N' + (n - 9)] = meta;
    if (k === 'D') obj.D_ANY = meta;
    if (k === 'T') obj.T_ANY = meta;
    if (k === 'B') obj.BULL_ANY = meta;
  }
  function catForRoundIndex(r){
    const n = Number(r);
    if (!Number.isFinite(n)) return null;
    if (n >= 0 && n <= 10) return String(10 + n);
    if (n === 11) return 'D';
    if (n === 12) return 'T';
    if (n === 13) return 'B';
    return null;
  }
  function normaliseRound(raw, ridx){
    let k = String(raw ?? '').trim().toUpperCase();
    if (!k) return catForRoundIndex(ridx);
    const m = k.match(/^N(\d+)$/i);
    if (m) return String(Number(m[1]) + 9);
    if (k === 'D_ANY' || k === 'DOUBLE' || k === 'DOUBLES') return 'D';
    if (k === 'T_ANY' || k === 'TREBLE' || k === 'TREBLES' || k === 'TRIPLE') return 'T';
    if (k === 'BULL_ANY' || k === 'BULL' || k === 'BULLS') return 'B';
    if (/^\d+$/.test(k)) return String(Number(k));
    return k;
  }
  function valFrom(row, keys){
    for (const k of keys){
      const v = row && row[k];
      if (v != null && v !== ''){
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  }
  function textFrom(row, keys){
    for (const k of keys){
      const v = row && row[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  }
  function hasAnyVals(target, players){
    let found = false;
    try{ Object.values(target || {}).forEach(m => { if (Number(m && m.val || 0) > 0) found = true; }); }catch(_){ }
    try{ for (const obj of (players || new Map()).values()){ Object.values(obj || {}).forEach(m => { if (Number(m && m.val || 0) > 0) found = true; }); } }catch(_){ }
    return found;
  }
  function boardRoundTotal(ent){
    if (!ent) return 0;
    if (ent.roundTotal != null) return Number(ent.roundTotal) || 0;
    if (ent.round_total != null) return Number(ent.round_total) || 0;
    if (ent.total != null) return Number(ent.total) || 0;
    if (Array.isArray(ent.darts)) return ent.darts.reduce((a,d)=>a + (Number(d && d.points || 0) || 0), 0);
    return 0;
  }
  function dartPattern(ent, ridx){
    try{
      if (!ent || !Array.isArray(ent.darts)) return '';
      return ent.darts.slice(0,3).map(d => {
        if (!d) return 'x';
        if (typeof symbolForDart === 'function'){
          const rd = Array.isArray(window.ROUNDS) ? window.ROUNDS[ridx] : (typeof ROUNDS !== 'undefined' ? ROUNDS[ridx] : null);
          const s = symbolForDart(d, rd);
          return (s && s.ch && s.ch !== '✕') ? s.ch : 'x';
        }
        const kind = String(d.kind || '').toUpperCase();
        if (kind.startsWith('T')) return 'T';
        if (kind.startsWith('D')) return 'D';
        if (kind.startsWith('B') || kind === 'IB' || kind === 'OB') return 'B';
        return Number(d.points || 0) > 0 ? 'S' : 'x';
      }).join('/');
    }catch(_){ return ''; }
  }
  async function buildFromGames(players){
    const byTargetMeta = {};
    const byPlayerMeta = new Map();
    const savedNames = new Set((players || []).map(p => norm(p && p.name)).filter(Boolean));
    let games = [];
    if (typeof cloudFetchAllGamesAsLocal === 'function') games = await cloudFetchAllGamesAsLocal();
    else {
      const { data, error } = await sb.from('games').select('id,created_at,state,totals,match_id,game_number').order('created_at', { ascending:true }).limit(100000);
      if (error) throw error;
      games = (data || []).map(r => ({ id:r.id, ts:r.created_at, players:r.state && r.state.players, board:r.state && r.state.board, match_id:r.match_id }));
    }
    let usedGames = 0;
    for (const g of (games || [])){
      const ps = Array.isArray(g.players) ? g.players.map(p => typeof p === 'string' ? { name:p } : p) : [];
      const board = g.board;
      if (!Array.isArray(ps) || ps.length < 1 || !Array.isArray(board)) continue;
      // Official only where match_id exists. If old data has no match_id, still allow multiplayer saved-player games.
      const officialish = !!g.match_id || ps.length >= 2;
      if (!officialish) continue;
      usedGames++;
      for (let pi=0; pi<ps.length; pi++){
        const name = String(ps[pi] && ps[pi].name || '').trim();
        if (!name) continue;
        const nameKey = norm(name);
        if (savedNames.size && !savedNames.has(nameKey)) continue;
        const rounds = board[pi];
        if (!Array.isArray(rounds)) continue;
        for (let ri=0; ri<14; ri++){
          const key = catForRoundIndex(ri);
          const ent = rounds[ri];
          const val = boardRoundTotal(ent);
          if (!key || val <= 0) continue;
          const meta = { val, player:name, darts:dartPattern(ent, ri), game_id:g.id || null, ridx:ri, ts:g.ts || g.created_at || null };
          const prevG = byTargetMeta[key];
          if (!prevG || val > Number(prevG.val || 0)) alias(byTargetMeta, key, meta);
          if (!byPlayerMeta.has(nameKey)) byPlayerMeta.set(nameKey, {});
          const obj = byPlayerMeta.get(nameKey);
          const prevP = obj[key];
          if (!prevP || val > Number(prevP.val || 0)) alias(obj, key, meta);
        }
      }
    }
    try{ window.__sqPBGRAdminLastFallback = { games:(games||[]).length, usedGames, playerKeys:byPlayerMeta.size }; }catch(_){ }
    return { byTargetMeta, byPlayerMeta };
  }

  window.getPBGRSnapshot = async function getPBGRSnapshot(){
    try{
      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return { byTargetMeta:{}, byPlayerMeta:new Map() };
      if (typeof sb === 'undefined' || !sb || !sb.from) return { byTargetMeta:{}, byPlayerMeta:new Map() };
      const players = (typeof cloudListPlayers === 'function') ? await cloudListPlayers() : [];
      const idToName = new Map();
      const nameToId = new Map();
      for (const p of (players || [])){
        const name = String(p && p.name || '').trim();
        const id = String((p && (p.id || p.player_id || p.bucket_key || p.bucketKey)) || '').trim();
        if (name && id){ idToName.set(id, name); nameToId.set(norm(name), id); }
      }
      window.__v2PBWRNameToBucket = nameToId;

      const cleanRows = (typeof __sqGetPBWRCleanRowsFromSnapshot === 'function') ? await __sqGetPBWRCleanRowsFromSnapshot() : { wrRows:[], pbRows:[], error:'Clean PB/WR helper unavailable' };
      const wrRes = { data: cleanRows.wrRows || [], error: cleanRows.error || null };
      const pbRes = { data: cleanRows.pbRows || [], error: cleanRows.error || null };

      const byTargetMeta = {};
      const byPlayerMeta = new Map();
      if (!wrRes?.error){
        for (const row of (wrRes.data || [])){
          const key = normaliseRound(textFrom(row, ['round_key','cat','round','target','key']), row && (row.ridx ?? row.round_index));
          const val = valFrom(row, ['wr_points','wr','val','points','score','round_total']);
          if (!key || val <= 0) continue;
          const meta = { val, player:textFrom(row, ['player','holder','name','player_name']) || idToName.get(textFrom(row, ['bucket_key','player_id'])) || '', darts:textFrom(row, ['darts','throws','dart_count']), game_id:row.game_id || row.game || null, ridx:row.ridx ?? row.round_index ?? null, ts:row.ts || row.created_at || row.date || null };
          const prev = byTargetMeta[key];
          if (!prev || val > Number(prev.val || 0)) alias(byTargetMeta, key, meta);
        }
      }
      if (!pbRes?.error){
        for (const row of (pbRes.data || [])){
          const key = normaliseRound(textFrom(row, ['round_key','cat','round','target','key']), row && (row.ridx ?? row.round_index));
          const val = valFrom(row, ['pb_points','pb','val','points','score','round_total']);
          if (!key || val <= 0) continue;
          const bucket = textFrom(row, ['bucket_key','player_id','id']);
          const name = textFrom(row, ['player','name','player_name','holder']) || idToName.get(bucket) || bucket;
          const nk = norm(name);
          if (!nk) continue;
          const meta = { val, player:name, darts:textFrom(row, ['darts','throws','dart_count']), game_id:row.game_id || row.game || null, ridx:row.ridx ?? row.round_index ?? null, ts:row.ts || row.created_at || row.date || null };
          if (!byPlayerMeta.has(nk)) byPlayerMeta.set(nk, {});
          const obj = byPlayerMeta.get(nk);
          const prev = obj[key];
          if (!prev || val > Number(prev.val || 0)) alias(obj, key, meta);
          if (bucket){
            const bk = norm(bucket);
            if (!byPlayerMeta.has(bk)) byPlayerMeta.set(bk, {});
            const bObj = byPlayerMeta.get(bk);
            const bPrev = bObj[key];
            if (!bPrev || val > Number(bPrev.val || 0)) alias(bObj, key, meta);
          }
        }
      }
      try{ window.__sqPBGRAdminLastCounts = { wrRows:(wrRes.data||[]).length, pbRows:(pbRes.data||[]).length, playerKeys:byPlayerMeta.size, wrError:wrRes?.error?.message || '', pbError:pbRes?.error?.message || '' }; }catch(_){ }

      if (hasAnyVals(byTargetMeta, byPlayerMeta)) return { byTargetMeta, byPlayerMeta };
      return await buildFromGames(players);
    }catch(e){
      console.warn('[SQ] PBGR Admin view read failed; using games fallback:', e && (e.message || e));
      try{
        const players = (typeof cloudListPlayers === 'function') ? await cloudListPlayers() : [];
        return await buildFromGames(players);
      }catch(e2){
        console.warn('[SQ] PBGR Admin games fallback failed:', e2 && (e2.message || e2));
        return { byTargetMeta:{}, byPlayerMeta:new Map() };
      }
    }
  };

  window.refreshPBGRCloud = async function refreshPBGRCloud(){
    window.__v2PBWRSnapshot = null;
    window.__v2PBWRSnapshotPromise = null;
    window.__pbgrSnapshot = null;
    window.__pbgrSnapshotPromise = null;
    await window.getPBGRSnapshot();
    try{ if (typeof window.updatePBGRBadges === 'function') await window.updatePBGRBadges(); }catch(_){ }
    return true;
  };
})();
// <<< PATCH:PBGR_ADMIN_GAMES_FALLBACK_V3 END

// High Score League is for SAVED PLAYERS only.
  // We *prefer* player_id, but allow legacy rows where player_id is NULL.
  // Filter by saved-player names client-side to keep the league clean.
  
  // >>> PATCH:HSLEAGUE_MERGE_TABLES START
  // League HS can exist in either `high_scores` (legacy / match-scope) or `high_scores_sp` (newer per-game/saved-player scope).
  // To avoid missing historical data (e.g. Nick 740), we merge BOTH tables, then take the best score per player.
  let data = null;
  let error = null;
  if(isPractice){
    ({ data, error } = await client
      .from(table)
      .select('player_id, name, score, ts, game_id')
      .order('score', { ascending: false })
      .order('ts',    { ascending: false })
      .limit(limit));
  } else {
    const [aRes, bRes] = await Promise.all([
      client.from('high_scores')   .select('player_id, name, score, ts, game_id').order('score',{ascending:false}).order('ts',{ascending:false}).limit(limit),
      client.from('high_scores_sp').select('player_id, name, score, ts, game_id').order('score',{ascending:false}).order('ts',{ascending:false}).limit(limit)
    ]);
    // Prefer to surface the first error, but still allow partial data if one table is empty/misconfigured.
    error = aRes.error || bRes.error || null;
    data = [ ...(aRes.data||[]), ...(bRes.data||[]) ];
  }
  // >>> PATCH:HSLEAGUE_MERGE_TABLES END

if (error) { markCloudError(error); throw error; }
  markCloudOk();

  let rows = (data || []).map(r => ({
    player_id: r.player_id || null,
    name: r.name,
    score: Number(r.score) || 0,
    ts: r.ts,
    game_id: r.game_id || null
  }));

  // >>> PATCH:HSLEAGUE_DEDUPE_BEST_PER_PLAYER START
  // Collapse to best score per saved player (player_id preferred key).
  const bestByKey = new Map();
  for(const r of rows){
    const key = r.player_id ? `pid:${r.player_id}` : `nm:${String(r.name||'').trim().toLowerCase()}`;
    const prev = bestByKey.get(key);
    if(!prev || (r.score > prev.score) || (r.score === prev.score && String(r.ts||'') > String(prev.ts||''))){
      bestByKey.set(key, r);
    }
  }
  rows = Array.from(bestByKey.values());
  // >>> PATCH:HSLEAGUE_DEDUPE_BEST_PER_PLAYER END

  // League only: filter to saved players.
// IMPORTANT: Supabase is canonical. Do NOT rely on localStorage-only saved lists (can be stale / partial).
// We cache the set briefly to avoid re-querying on every render.
if(!isPractice){
  try{
    let savedSet = null;
    const now = Date.now();
    if (window.__sq_savedPlayersSet && window.__sq_savedPlayersSet.set && (now - (window.__sq_savedPlayersSet.ts||0) < 60_000)){
      savedSet = window.__sq_savedPlayersSet.set;
    } else {
      let savedPlayers = [];
      try{
        if (typeof cloudListPlayers === 'function'){
          savedPlayers = await cloudListPlayers(); // returns active (deleted_at IS NULL)
        }
      }catch(_e2){}
      // Fallback to local cache only if cloud unavailable
      if (!savedPlayers || !savedPlayers.length){
        try{ savedPlayers = (typeof getSavedPlayers === 'function' ? getSavedPlayers() : []) || []; }catch(_e3){ savedPlayers = []; }
      }
      savedSet = new Set((savedPlayers||[]).map(p => String(p.name||'').trim().toLowerCase()).filter(Boolean));
      window.__sq_savedPlayersSet = { ts: now, set: savedSet };
    }
    if(savedSet && savedSet.size){
      rows = rows.filter(r => savedSet.has(String(r.name||'').trim().toLowerCase()));
    }
  }catch(_e){}
}

  return rows;
}
/**
 * One-time backfill: rebuild high-score rows from TABLE_GAMES.
 * Requires `game_id` column on the target HS table (recommended).
 */
async function cloudRebuildHighScoresFromGames(isPractice = false, maxPages = 200){
  if (!ensureCloudInit()) throw new Error('Cloud not initialised');
  const table = isPractice ? TABLE_HS_PRACTICE : TABLE_HS_LEAGUE;

  // Probe for game_id column support
  try{
    const probe = await sb.from(table).select('game_id', { head:true, count:'exact' }).limit(1);
    if (probe.error) throw probe.error;
  }catch(e){
    const msg  = String(e?.message || '');
    const code = String(e?.code || '');
    const missingCol = (code === '42703') || /game_id/i.test(msg);
    if (missingCol) throw new Error('Missing game_id column on high score table');
    throw e;
  }

  const pageSize = 250;
  let from = 0;

  for (let page = 0; page < maxPages; page++){
    const to = from + pageSize - 1;

    const { data, error } = await sb
      .from(TABLE_GAMES)
      .select('id, created_at, totals, match_id, state')
      .order('created_at', { ascending:false })
      .range(from, to);

    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;

    const inserts = [];

    for (const g of rows){
      const players = (g?.state?.players || []).map(p => (typeof p === 'string' ? { name:p } : p)).filter(Boolean);
      const totals  = Array.isArray(g?.totals) ? g.totals : [];

      const isSingle = players.length <= 1 || !g.match_id;
      if (isPractice && !isSingle) continue;
      if (!isPractice && isSingle) continue;

      for (let i=0;i<players.length;i++){
        const name = players[i]?.name || '';
        const score = Number(totals[i] || 0);
        if (!g.id || !name || score <= 0) continue;
                const playerId = players[i]?.id || players[i]?.player_id || null;
        if (!playerId) continue; // saved players only
        inserts.push({ game_id: g.id, player_id: playerId, name, score, ts: g.created_at });
      }
    }

    if (inserts.length){
      // Prefer upsert to avoid duplicates on reruns (requires unique constraint on (game_id,name))
      const { error: upErr } = await sb
        .from(table)
        .upsert(inserts, { onConflict: 'game_id,player_id', ignoreDuplicates: true });
      if (upErr) throw upErr;
    }

    from += pageSize;
  }
}

// If HS table is empty, attempt a one-time rebuild from games (best effort).
async function cloudListHighScoresWithBackfill(isPractice=false, limit=500){
  let rows = await cloudListHighScores(isPractice, limit);
  if (rows.length) return rows;

  try{
    await cloudRebuildHighScoresFromGames(isPractice);
    rows = await cloudListHighScores(isPractice, limit);
  }catch(e){
    console.warn('HS backfill skipped/failed', e);
  }
  return rows;
}

// Insert (name, score, ts) if not already present in the table
async function cloudInsertHighScoreIfMissing(table, playerId, name, score, ts, gameId){
  // v27: High scores are ONLY for saved players. Require player_id + game_id.
  try {
    if (!playerId || !gameId) return false;

    const payload = { player_id: playerId, name, score, ts, game_id: gameId };
    if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime() &&
        typeof __sqAssertNoShadowPersistPayload === 'function' &&
        !__sqAssertNoShadowPersistPayload(payload, 'cloudInsertHighScoreIfMissing')) {
      return false;
    }

    // One HS row per (game_id, player_id). Ignore duplicates.
    const { error } = await sb
      .from(table)
      .upsert([payload], { onConflict: 'game_id,player_id', ignoreDuplicates: true });

    if (error) { markCloudError(error); return false; }
    markCloudOk();
    return true;
  } catch (e){
    console.error('cloudInsertHighScoreIfMissing failed', e);
    return false;
  }
}

// From a finished game, write one HS row per player to the correct table
async function cloudSaveHighScoresForGame(totals, tsIso, gameId){
  try {
    const players = state.players || [];
    const realPlayers = (typeof __sqRealPlayersOnly === 'function') ? __sqRealPlayersOnly(players) : players;
    const realTotals = (typeof __sqRealOnlyTotals === 'function') ? __sqRealOnlyTotals(totals || [], players) : (totals || []);
    const gameMode = (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime())
      ? 'practice'
      : ((typeof __sqComputeGameMode === 'function') ? __sqComputeGameMode() : ((realPlayers.length===1) ? 'practice' : 'official'));
    if (gameMode === 'turbo') {
      console.warn('[SQ] Turbo high-score write skipped: no dedicated Turbo high-score table is configured; Turbo rows must not enter official high_scores_sp.');
      return;
    }
    const isPractice = (gameMode === 'practice');
    const table = isPractice ? TABLE_HS_PRACTICE : TABLE_HS_LEAGUE;
    const when = tsIso || (state && state.meta && state.meta.ts) || (state && state.ts) || new Date().toISOString();

    // Require a concrete game id (UUID) for referential integrity.
    if (!gameId) return;

    for (let i = 0; i < realPlayers.length; i++){
      const p = realPlayers[i] || {};
      const playerId = p.id || p.player_id || null; // saved players only
      const name  = p.name || '';
      const score = Number(realTotals?.[i] || 0);

      // High Score League is for saved players only.
      if (!playerId) continue;
      if (!name || score <= 0) continue;

      await cloudInsertHighScoreIfMissing(table, playerId, name, score, when, gameId);
    }
  } catch (e) {
    console.error('cloudSaveHighScoresForGame failed', e);
  }
}

// Simple initial Supabase connectivity check
async function initialCloudCheck() {
  try {
    if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return;
    const client = window.sb || sb;
    if (!client) { setCloudStatus('error', 'Cloud not initialised'); return; }

    setCloudStatus('checking', 'Checking cloud…');

    async function probe(table, col){
      try {
        const q = client.from(table).select(col || '*').limit(1);
        const { data, error } = await q;
        if (error) return { ok:false, error };
        return { ok:true, data };
      } catch (e) {
        return { ok:false, error:e };
      }
    }

    // Prefer full feature probe (players), but accept LIVE probe (throws view) as “cloud online”.
    let r = await probe((typeof TABLE_PLAYERS !== 'undefined' ? TABLE_PLAYERS : 'players'), 'id');
    if (!r.ok) {
      r = await probe('throw_events_v', 'game_id');
    }

    if (!r.ok) throw r.error;
    markCloudOk();
  } catch (err) {
    markCloudError(err);
  }
}

// --- Bootstrap wiring once the DOM is ready ---
/* Fallback: define initSetupSteppers if missing */
if (typeof window.initSetupSteppers !== 'function') {
  window.initSetupSteppers = function initSetupSteppers(){
    const steppers = document.querySelectorAll('.setup-stepper');
    steppers.forEach(stepper => {
      const selectId = stepper.getAttribute('data-select-id');
      const suffix   = stepper.getAttribute('data-suffix') || '';
      const select   = document.getElementById(selectId);
      const numEl    = stepper.querySelector('.stepper-number');
      const sufEl    = stepper.querySelector('.stepper-suffix');
      if (sufEl) sufEl.textContent = suffix;
      if (!select || !numEl) return;

      // Prevent duplicate bindings (which caused skipping: 1→3→5…)
      if (stepper.dataset.bound === '1') return;
      stepper.dataset.bound = '1';

      // Determine min/max from the select's option values
      const values = [...select.options].map(o => parseInt(o.value, 10)).filter(n => !Number.isNaN(n));
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      function syncFromSelect(){
        const val = parseInt(select.value, 10);
        if (!Number.isNaN(val)) {
          numEl.textContent = String(val);
        } else {
          const opt = select.options[select.selectedIndex];
          const txt = opt ? opt.textContent : '';
          const m = txt && txt.match(/\d+/);
          numEl.textContent = m ? m[0] : txt;
        }
      }

      function setTo(v){
        const targetIdx = [...select.options].findIndex(o => parseInt(o.value, 10) === v);
        if (targetIdx >= 0) {
          select.selectedIndex = targetIdx;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncFromSelect();
        }
      }

      // Bind buttons using `onclick` (overwrites any prior handlers)
      stepper.querySelectorAll('.stepper-btn').forEach(btn => {
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        btn.onclick = () => {
          const cur = parseInt(select.value, 10);
          const next = Math.min(maxVal, Math.max(minVal, cur + (delta > 0 ? 1 : -1)));
          setTo(next);
        };
      });

      select.addEventListener('change', syncFromSelect);
      syncFromSelect();
    });

    // Ensure initial player rows render to match default "players" count
    try { if (typeof drawPsRows === 'function') drawPsRows(); } catch(_) {}
  };
}
document.addEventListener('DOMContentLoaded', () => {
  // Critical UI wiring (keep immediate so the Start screen becomes interactive ASAP)
  try { if (typeof setupStartMenuButtons === 'function') setupStartMenuButtons(); } catch (e) { console.error(e); }
  try { if (typeof initSetupSteppers   === 'function') initSetupSteppers();   } catch (e) { console.error(e); }
  try { updatePadSpacer(); } catch (e) {}

  // Non-critical boot work (defer until after first paint to avoid long tasks / layout jank)
  try {
    if (window.SQ && SQ.boot && typeof SQ.boot.afterPaint === 'function') {
      SQ.boot.afterPaint(() => {
        try { SQ.boot.queueTask('bindScoreHeaderScrollSync', () => { try{ bindScoreHeaderScrollSync(); }catch(e){} return true; }); } catch(_) {}
        try { SQ.boot.queueTask('initialCloudCheck', () => (typeof initialCloudCheck === 'function') ? initialCloudCheck() : false); } catch(_) {}
        // Build the rolling ticker on first load of the Start screen
        try { SQ.boot.queueTask('buildStartTicker', () => (typeof window.buildStartTicker === 'function') ? window.buildStartTicker() : false); } catch(_) {}
      });
    } else {
      // Fallback (should not hit): run directly
      try { if (typeof bindScoreHeaderScrollSync === 'function') bindScoreHeaderScrollSync(); } catch (e) {}
      try { if (typeof initialCloudCheck === 'function') initialCloudCheck(); } catch (e) {}
      try { if (typeof window.buildStartTicker === 'function') window.buildStartTicker(); } catch (e) {}
    }
  } catch (e) {}
});
// --- Period filter helper (Today / 1 Week / 1 Month / All Time) ---
function periodStartIso(key){
  const now = new Date();
  if (key === 'today') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }
  if (key === 'week') {
    const d = new Date(now.getTime() - 7*24*60*60*1000);
    return d.toISOString();
  }
  if (key === 'month') {
    const d = new Date(now.getTime() - 30*24*60*60*1000);
    return d.toISOString();
  }
  return null; // all time
}
// --- Date formatter: dd/mm/yy @ 24h:mm ---
function fmtDdMmYyAtTime(d){
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${yy} @ ${hh}:${mi}`;
}

// --- Start-screen rolling banner (last 10 completed games) ---
function _psHumanList(parts){
  if (!parts || !parts.length) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] + ' and ' + parts[1];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

function _psFormatLine(game){
  try{
    const list = (game.players || []).map((p, i) => ({
      name: (p && p.name) ? String(p.name) : `Player ${i + 1}`,
      score: Number(Array.isArray(game.totals) ? (game.totals[i] || 0) : 0)
    }));
    if (!list.length) return '';
    list.sort((a,b)=> b.score - a.score);      // winner first
    const winner = list[0];
    const others = list.slice(1).map(o => `${o.name} (${o.score})`);
    return others.length
      ? `${winner.name} (${winner.score}) beats ${_psHumanList(others)}`
      : `${winner.name} (${winner.score}) wins`;
  }catch(_){ return ''; }
}

// Expose globally so `show()` can always reach it, even if the code is wrapped.
window.buildStartTicker = async function buildStartTicker(){
  const wrap1  = document.getElementById('psTicker');
  const track1 = wrap1 ? wrap1.querySelector('.track') : null;
  const wrap2  = document.getElementById('psTickerTop');
  const track2 = wrap2 ? wrap2.querySelector('.track') : null;

  if ((!wrap1 || !track1) && (!wrap2 || !track2)) { return; }

  function escHtml(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseJoined(v){
    if (!v) return 0;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }

  function getNewPlayers(days){
    const cutoff = Date.now() - (days * 86400000);
    const arr = (typeof getSavedPlayers === 'function') ? (getSavedPlayers() || []) : [];
    return arr
      .filter(p => p && p.name && parseJoined(p.joinedAt) >= cutoff)
      .sort((a,b) => parseJoined(b.joinedAt) - parseJoined(a.joinedAt))
      .map(p => p.name);
  }

  function setMarquee(track, msg, mode){
    const safe = escHtml(msg);
    // Bottom (yellow) ticker uses repeated spans for a seamless loop.
    // Top (new players) ticker uses a single span and a CSS pause between runs.
    if (mode === 'single'){
      track.innerHTML = `<div class="marquee"><span>${safe}</span></div>`;
      return;
    }
    track.innerHTML = `<div class="marquee"><span>${safe}</span><span aria-hidden="true">${safe}</span><span aria-hidden="true">${safe}</span></div>`;
  }

  try{
    // Ensure local cache includes cloud players so the ticker is consistent across devices.
    if (typeof syncSavedPlayersFromCloud === 'function') {
      try{ await syncSavedPlayersFromCloud(); }catch(_){ }
    }
    const names = getNewPlayers(14);
    const msg = names.length
      ? `NEW PLAYERS // ${names.join(', ')} // WELCOME TO SHATEKI'S QUEST`
      : `WELCOME TO SHATEKI'S QUEST`;

    if (track1) setMarquee(track1, msg, 'repeat');
    if (track2) setMarquee(track2, msg, 'single');
    if (wrap1) wrap1.classList.remove('hidden');
    if (wrap2) wrap2.classList.remove('hidden');
  }catch(e){
    console.error('buildStartTicker failed', e);
    if (wrap1) wrap1.classList.add('hidden');
    if (wrap2) wrap2.classList.add('hidden');
  }
};
// [removed: openSprintLeagueDialog + computeSprintLeagueAsync (orphaned)] audit P5.3 batch 2 — dead/shadowed definition, no live callers

// (cloudSynthGamesFromHighScores remains unchanged)

/*****************
 * CLOUD MATCH HELPERS
 *****************/
async function upsertMatchToSupabase(createdAtOverride) {
  try {
    if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) return;
    const payload = {
      id: state.match.id,                                                // uuid
      created_at: state.match.createdAtIso || createdAtOverride || new Date().toISOString(),
      total_games: state.match.history.length,
      players: state.players.map(p => ({ name: p.name })),               // [{name}]
      wins: (state.match.wins || []).slice(),
      history: state.match.history.map(g => ({ totals: (g?.totals || []).slice() }))
    };
    const { error } = await sb.from(TABLE_MATCHES).upsert(payload);
    if (error) throw error;
  } catch (e) {
    console.error('upsertMatchToSupabase failed', e);
  }
}

// Map Supabase -> local shapes the stats code already understands
function mapCloudGameRowToLocal(row){
  const rawPlayers = Array.isArray(row?.state?.players) ? row.state.players : [];

  const players = rawPlayers.map(p => {
    if (p == null) return { name: '' };
    if (typeof p === 'string') return { name: p };

    const id = p?.player_id ?? p?.playerId ?? p?.id ?? null;
    let name = (p?.name || '').toString().trim();

    const first = (p?.first_name || '').toString().trim();
    const last  = (p?.last_name  || '').toString().trim();
    const nick  = (p?.nickname   || '').toString().trim();

    if (!name && first){
      if (nick && last) name = (first + ' "' + nick + '" ' + last).trim();
      else if (nick)    name = (first + ' "' + nick + '"').trim();
      else if (last)    name = (first + ' ' + last).trim();
      else              name = first;
    }

    if (!name && id) name = String(id).trim();
    return { id, name };
  });
  const totals  = Array.isArray(row?.totals) ? row.totals.slice() : [];
  let max = -Infinity, winners = [];
  totals.forEach((t,i)=>{ if (t>max){max=t; winners=[i];} else if (t===max){ winners.push(i);} });

  // Carry cloud identity + mode hints through to local shape
  const matchId = row?.match_id ?? row?.matchId ?? row?.state?.match_id ?? row?.state?.matchId ?? null;
  const gameNumber = row?.game_number ?? row?.gameNumber ?? row?.state?.game_number ?? row?.state?.gameNumber ?? null;

  return {
    id: row?.id ?? null,
    ts: row?.created_at || null,
    archived_at: row?.archived_at || null,
    archived_at: row?.archived_at || null,
    archivedAt: row?.archived_at || null,
    players,
    totals,
    winners,
    board: row?.state?.board || null,
    state: row?.state || null,
    mode: row?.state?.mode || row?.mode || null,
    is_practice: row?.state?.is_practice ?? row?.state?.isPractice ?? row?.is_practice ?? row?.isPractice ?? null,
    total_players: row?.state?.total_players ?? players.length,
    match_id: matchId,
    matchId,
    game_number: gameNumber,
    gameNumber
  };
}
const SQ_ALL_GAMES_FETCH_TTL_MS = 5 * 60 * 1000;
try { window.__sqAllGamesFetchTtlMs = SQ_ALL_GAMES_FETCH_TTL_MS; } catch (_) {}
try { if (typeof window.__sqAllGamesFetchAt !== 'number') window.__sqAllGamesFetchAt = 0; } catch (_) {}
try { if (typeof window.__sqAllGamesFetchGeneration !== 'number') window.__sqAllGamesFetchGeneration = 0; } catch (_) {}

function __sqCloneAllGamesFetchRows(rows){
  return Array.isArray(rows) ? rows.slice() : [];
}

function __sqAllGamesFetchCacheFresh(now){
  try {
    return Array.isArray(window.__sqAllGamesFetchCache) &&
      window.__sqAllGamesFetchAt &&
      (now - window.__sqAllGamesFetchAt) >= 0 &&
      (now - window.__sqAllGamesFetchAt) < SQ_ALL_GAMES_FETCH_TTL_MS;
  } catch (_) {
    return false;
  }
}

window.__sqInvalidateAllGamesFetchCache = function __sqInvalidateAllGamesFetchCache(reason){
  try {
    window.__sqAllGamesFetchCache = null;
    window.__sqAllGamesFetchAt = 0;
    window.__sqAllGamesFetchInFlight = null;
    window.__sqAllGamesFetchGeneration = (Number(window.__sqAllGamesFetchGeneration) || 0) + 1;
    window.__sqAllGamesFetchInvalidatedFor = String(reason || 'manual');
  } catch (_) {}
  return true;
};

async function cloudFetchAllGamesAsLocal(opts = null){
  const force = opts === true || !!(opts && opts.force);
  const now = Date.now();

  if (!force && __sqAllGamesFetchCacheFresh(now)) {
    return __sqCloneAllGamesFetchRows(window.__sqAllGamesFetchCache);
  }
  if (!force && window.__sqAllGamesFetchInFlight) {
    return __sqCloneAllGamesFetchRows(await window.__sqAllGamesFetchInFlight);
  }

  const generation = Number(window.__sqAllGamesFetchGeneration) || 0;
  const p = (async()=>{
    const { data, error } = await sb
      .from(TABLE_GAMES)
      .select('id,created_at,archived_at,state,totals,match_id,game_number')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data || []).map(mapCloudGameRowToLocal);
    if ((Number(window.__sqAllGamesFetchGeneration) || 0) === generation) {
      window.__sqAllGamesFetchCache = rows;
      window.__sqAllGamesFetchAt = Date.now();
    }
    return rows;
  })();

  window.__sqAllGamesFetchInFlight = p;
  try {
    return __sqCloneAllGamesFetchRows(await p);
  } finally {
    if (window.__sqAllGamesFetchInFlight === p) window.__sqAllGamesFetchInFlight = null;
  }
}

// Efficient: newest→oldest, limited (used by home live printer)
async function cloudFetchLatestGamesAsLocal(limit = 10){
  const { data, error } = await sb
    .from(TABLE_GAMES)
    .select('id,created_at,archived_at,state,totals,match_id,game_number')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapCloudGameRowToLocal);

}

// >>> PATCH:MOT_TICKER_VISIBLE_GAMES_V2 START
// Visible-games fetchers (exclude archived at the data source level via v_games_visible).
// These MUST be top-level (not nested) so HOME "LIVE UPDATES" (VIDE printer) can see them.
const SQ_GAMES_VISIBLE_MIN_POLL_MS = 15000;
try { window.__sqGamesVisibleMinPollMs = SQ_GAMES_VISIBLE_MIN_POLL_MS; } catch (_) {}

function __sqGamesVisiblePollState(){
  const w = window;
  if (!w.__sqGamesVisiblePollState) {
    w.__sqGamesVisiblePollState = {
      latestRows: null,
      latestFetchedAt: 0,
      sinceRows: null,
      sinceFetchedAt: 0,
      lastFetchAt: 0,
      inFlightLatest: null,
      inFlightSince: null
    };
  }
  try {
    w.__sqGamesVisiblePollerActive = true;
    w.__sqGamesVisibleLastFetchAt = w.__sqGamesVisiblePollState.lastFetchAt || 0;
    w.__sqGamesVisibleInFlight = w.__sqGamesVisiblePollState.inFlightLatest || w.__sqGamesVisiblePollState.inFlightSince || null;
  } catch (_) {}
  return w.__sqGamesVisiblePollState;
}

function __sqGamesVisibleTs(g){
  const t = g && (g.ts || g.created_at || g.createdAt || g.inserted_at);
  const n = t ? Date.parse(t) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function __sqGamesVisibleLatest(rows, limit){
  const lim = Math.max(1, Math.min(100, Number(limit) || 10));
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a,b)=>__sqGamesVisibleTs(b) - __sqGamesVisibleTs(a))
    .slice(0, lim);
}

function __sqGamesVisibleSince(rows, sinceIso, limit){
  const sinceMs = Date.parse(String(sinceIso || '').trim());
  if (!Number.isFinite(sinceMs)) return [];
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  return (Array.isArray(rows) ? rows : [])
    .filter(g => __sqGamesVisibleTs(g) > sinceMs)
    .sort((a,b)=>__sqGamesVisibleTs(a) - __sqGamesVisibleTs(b))
    .slice(0, lim);
}

function __sqMergeGamesVisibleRows(existing, incoming, cap){
  const map = new Map();
  const add = (g) => {
    if (!g) return;
    const key = String(g.id || g.game_id || g.sheet_id || g.ts || g.created_at || JSON.stringify(g));
    if (key) map.set(key, g);
  };
  (Array.isArray(existing) ? existing : []).forEach(add);
  (Array.isArray(incoming) ? incoming : []).forEach(add);
  return __sqGamesVisibleLatest(Array.from(map.values()), Math.max(1, Math.min(100, Number(cap) || 50)));
}

function __sqGamesVisibleCacheFresh(ts, now){
  return !!(ts && (now - ts) < SQ_GAMES_VISIBLE_MIN_POLL_MS);
}

async function cloudFetchLatestVisibleGamesAsLocal(limit = 10, opts = null){
  await ensureCloudInit();
  const st = __sqGamesVisiblePollState();
  const now = Date.now();
  const lim = Math.max(1, Math.min(100, Number(limit) || 10));
  const force = !!(opts && opts.force);

  if (!force && Array.isArray(st.latestRows) && __sqGamesVisibleCacheFresh(st.latestFetchedAt, now)) {
    return __sqGamesVisibleLatest(st.latestRows, lim);
  }
  if (!force && st.inFlightLatest) {
    return st.inFlightLatest.then(rows => __sqGamesVisibleLatest(rows, lim));
  }
  if (!force && st.lastFetchAt && (now - st.lastFetchAt) < SQ_GAMES_VISIBLE_MIN_POLL_MS && Array.isArray(st.latestRows)) {
    return __sqGamesVisibleLatest(st.latestRows, lim);
  }

  st.lastFetchAt = now;
  try { window.__sqGamesVisibleLastFetchAt = st.lastFetchAt; } catch (_) {}
  const p = (async()=>{
    const { data, error } = await sb
      .from('v_games_visible')
      .select('id,created_at,archived_at,state,totals,match_id,game_number')
      .order('created_at', { ascending: false })
      .limit(lim);
    if (error) throw error;
    const rows = (data || []).map(mapCloudGameRowToLocal);
    const doneAt = Date.now();
    st.latestRows = rows;
    st.latestFetchedAt = doneAt;
    st.lastFetchAt = doneAt;
    try { window.__sqGamesVisibleLastFetchAt = doneAt; } catch (_) {}
    return rows;
  })();
  st.inFlightLatest = p;
  try { window.__sqGamesVisibleInFlight = p; } catch (_) {}
  try {
    return __sqGamesVisibleLatest(await p, lim);
  } finally {
    if (st.inFlightLatest === p) st.inFlightLatest = null;
    try { window.__sqGamesVisibleInFlight = st.inFlightLatest || st.inFlightSince || null; } catch (_) {}
  }
}

// Efficient: fetch VISIBLE games created after a given timestamp (oldest→newest, limited)
// Used for delta-updating the home Live Updates ticker without refetching history.
async function cloudFetchVisibleGamesSinceAsLocal(sinceIso, limit = 50, opts = null){
  await ensureCloudInit();
  const iso = String(sinceIso || '').trim();
  if (!iso) return [];
  const st = __sqGamesVisiblePollState();
  const now = Date.now();
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const force = !!(opts && opts.force);

  if (!force && Array.isArray(st.latestRows) && __sqGamesVisibleCacheFresh(st.latestFetchedAt, now)) {
    return __sqGamesVisibleSince(st.latestRows, iso, lim);
  }
  if (!force && st.inFlightLatest) {
    return st.inFlightLatest.then(rows => __sqGamesVisibleSince(rows, iso, lim));
  }
  if (!force && st.inFlightSince) {
    return st.inFlightSince.then(rows => __sqGamesVisibleSince(rows, iso, lim));
  }
  if (!force && st.lastFetchAt && (now - st.lastFetchAt) < SQ_GAMES_VISIBLE_MIN_POLL_MS) {
    if (Array.isArray(st.latestRows)) return __sqGamesVisibleSince(st.latestRows, iso, lim);
    if (Array.isArray(st.sinceRows)) return __sqGamesVisibleSince(st.sinceRows, iso, lim);
    return [];
  }

  st.lastFetchAt = now;
  try { window.__sqGamesVisibleLastFetchAt = st.lastFetchAt; } catch (_) {}
  const p = (async()=>{
    const { data, error } = await sb
      .from('v_games_visible')
      .select('id,created_at,archived_at,state,totals,match_id,game_number')
      .gt('created_at', iso)
      .order('created_at', { ascending: true })
      .limit(lim);
    if (error) throw error;
    const rows = (data || []).map(mapCloudGameRowToLocal);
    const doneAt = Date.now();
    st.sinceRows = rows;
    st.sinceFetchedAt = doneAt;
    st.latestRows = __sqMergeGamesVisibleRows(st.latestRows, rows, Math.max(lim, Array.isArray(st.latestRows) ? st.latestRows.length : 0, 30));
    st.latestFetchedAt = doneAt;
    st.lastFetchAt = doneAt;
    try { window.__sqGamesVisibleLastFetchAt = doneAt; } catch (_) {}
    return rows;
  })();
  st.inFlightSince = p;
  try { window.__sqGamesVisibleInFlight = p; } catch (_) {}
  try {
    return __sqGamesVisibleSince(await p, iso, lim);
  } finally {
    if (st.inFlightSince === p) st.inFlightSince = null;
    try { window.__sqGamesVisibleInFlight = st.inFlightLatest || st.inFlightSince || null; } catch (_) {}
  }
}
// <<< PATCH:MOT_TICKER_VISIBLE_GAMES_V2 END

function mapCloudMatchRowToLocal(row){
  const playersArr = Array.isArray(row?.players) ? row.players : [];
  const players = playersArr.map(p => (typeof p === 'string') ? { name: p } : { name: p?.name });
  const wins = Array.isArray(row?.wins) ? row.wins.slice() : [];
  const games = row?.total_games || (Array.isArray(row?.history) ? row.history.length : 0);
  const matchTotals = [];
  if (Array.isArray(row?.history)) {
    row.history.forEach(g => {
      (g?.totals || []).forEach((v,i) => { matchTotals[i] = (matchTotals[i] || 0) + (Number(v)||0); });
    });
  }
  return { id: row?.id, ts: row?.created_at || null, players, wins, targetWins: null, games, matchTotals };
}
async function cloudFetchAllMatchesAsLocal(){
  const { data, error } = await sb
    .from(TABLE_MATCHES)
    .select('id,created_at,players,wins,history,total_games')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapCloudMatchRowToLocal);
}

async function computePlayerWindowStatsAsync(playerName, mode = 'official') {
  // 0) Load sources
  let cloudGames = [];
  let cloudMatches = [];
  try { cloudGames = await cloudFetchAllGamesAsLocal(); } catch (_) {}
  try { cloudMatches = await cloudFetchAllMatchesAsLocal(); } catch (_) {}

  const localGames   = getGameLog()   || [];
  const localMatches = getMatchLog()  || [];

  // 1) Merge (cloud first, then local) – oldest→newest order
  let games   = [...cloudGames, ...localGames];
  let matches = (mode === 'official') ? [...cloudMatches, ...localMatches] : [];

  // 2) Filter by mode
  const byMode = (g) => (mode === 'official' ? isOfficialGame(g) : isPracticeGame(g));
  games = games.filter(byMode);
  if (mode !== 'official') matches = [];

  // 3) If still no games for this player, synth from high_scores tables
  const hasAnyForPlayer = games.some(g => (g.players || []).some(p => p && eqName(p.name, playerName)));
  if (!hasAnyForPlayer) {
    try {
      const synth = await cloudSynthGamesFromHighScores(playerName);
      games = games.concat((synth || []).filter(byMode));
    } catch (_) {}
  }

  // 4) Windows
  const now = new Date();
  const out = {};
  STAT_WINDOWS.forEach(w => {
    const gWin = games.filter(g => g.ts && w.test(new Date(g.ts), now));
    const mWin = matches.filter(m => m.ts && w.test(new Date(m.ts), now));
    out[w.key] = computeSingleWindowStats(playerName, gWin, mWin, w, now);
  });
  out.life = computeSingleWindowStats(playerName, games, matches, { test: () => true }, now);
  return out;
}

// === Mode chooser (top-level) ===
function openModeChooser(onPick, onCancel){
  const ov = document.createElement('div'); ov.className='modal-backdrop';
  const m  = document.createElement('div'); m.className='modal';
  const h  = document.createElement('h3'); h.textContent='Choose Mode';
  const b  = document.createElement('div'); b.className='modal-body';
  const r  = document.createElement('div'); r.className='row';
  r.style.gap='8px'; r.style.justifyContent='center';

  const o  = document.createElement('button'); o.className='btn primary big'; o.textContent='Official';
  const p  = document.createElement('button'); p.className='btn big';         p.textContent='Practice';
  o.onclick = ()=>{ ov.remove(); onPick && onPick('official'); };
  p.onclick = ()=>{ ov.remove(); onPick && onPick('practice'); };
  r.append(o,p); b.appendChild(r);

  const f  = document.createElement('div'); f.className='modal-footer';
  const c  = document.createElement('button'); c.className='btn'; c.textContent='Return';
  c.onclick = ()=>{ ov.remove(); onCancel && onCancel(); };
  f.appendChild(c);

  m.append(h,b,f); ov.appendChild(m); document.body.appendChild(ov); m.tabIndex=0; m.focus();
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ ov.remove(); onCancel && onCancel(); }});
}

// === Target Hit Rate ===
async function openTargetHitRateDialog(playerName, mode){
  const allGames = await getGamesForMode(mode);

  function gamesForRange(rangeKey){
    // Only consider games that include this player (for POWER R / MONTH we need the player's own game set)
    const withPlayer = (allGames||[]).filter(g=>{
      const ps = g && Array.isArray(g.players) ? g.players : null;
      return ps ? ps.some(p=>p && eqName(p.name, playerName)) : false;
    });

    if (rangeKey === 'power'){
      const sorted = withPlayer.slice().sort((a,b)=>{
        const da = getGameTimestamp(a); const db = getGameTimestamp(b);
        return (db?db.getTime():0) - (da?da.getTime():0);
      });
      return sorted.slice(0, 4);
    }

    if (rangeKey === 'month'){
      const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return withPlayer.filter(g=>{
        const d = getGameTimestamp(g);
        return d && d.getTime() >= cutoff;
      });
    }

    return allGames || [];
  }

  const ov = document.createElement('div'); ov.className='modal-backdrop';
  const md = document.createElement('div'); md.className='modal';
  const h  = document.createElement('h3');  h.textContent = `Target Hit Rate – ${playerName} (${mode==='official'?'Official':'Practice'})`;
  const body = document.createElement('div'); body.className='modal-body';

  // Range buttons (top-right)
  const rangeBar = document.createElement('div');
  rangeBar.style.display = 'flex';
  rangeBar.style.justifyContent = 'flex-end';
  rangeBar.style.gap = '8px';
  rangeBar.style.margin = '2px 0 10px';

  function mkBtn(label, key){
    const b = document.createElement('button');
    b.className = 'seg-btn';
    b.type = 'button';
    b.textContent = label;
    b.style.padding = '8px 12px';
    b.style.borderRadius = '999px';
    b.style.border = '1px solid rgba(255,255,255,.14)';
    b.style.background = 'rgba(10,12,24,.55)';
    b.style.color = 'rgba(255,255,255,.85)';
    b.style.fontWeight = '800';
    b.style.letterSpacing = '.02em';
    b.style.cursor = 'pointer';
    b.style.userSelect = 'none';
    b.dataset.rangeKey = key;
    return b;
  }

  const btnAll   = mkBtn('ALL TIME', 'all');
  const btnPower = mkBtn('POWER R', 'power');
  const btnMonth = mkBtn('MONTH', 'month');
  rangeBar.append(btnAll, btnPower, btnMonth);
  body.appendChild(rangeBar);

  const tbl = document.createElement('table'); tbl.className='hs-table';
  const thead=document.createElement('thead'); const trh=document.createElement('tr');
  ['Target','Thrown','Hits','Hit %'].forEach(s=>{ const th=document.createElement('th'); th.textContent=s; trh.appendChild(th); });
  thead.appendChild(trh); tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  tbl.appendChild(tb);
  body.appendChild(tbl);

  function setActive(key){
    [btnAll, btnPower, btnMonth].forEach(b=>{
      const on = (b.dataset.rangeKey === key);
      b.style.borderColor = on ? 'rgba(255,122,0,.9)' : 'rgba(255,255,255,.14)';
      b.style.boxShadow   = on ? '0 0 0 2px rgba(255,122,0,.18) inset' : 'none';
      b.style.background  = on ? 'rgba(255,122,0,.10)' : 'rgba(10,12,24,.55)';
      b.style.color       = on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.85)';
    });
  }
  async function render(rangeKey){
    const games = gamesForRange(rangeKey);
    const gameIds = (games||[]).map(g=>g && g.id).filter(Boolean);
    const throws = gameIds.length ? await __fetchThrowsForGames(gameIds) : [];
    const counters = accumulateTargetCountersFromThrows(playerName, throws);

    tb.innerHTML = '';
    for (let n=10;n<=20;n++){
      const c = counters[String(n)];
      const tr=document.createElement('tr');
      tr.append(
        Object.assign(document.createElement('td'),{textContent:String(n)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:String(c.thrown)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:String(c.hits)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:pctStr(c.hits, c.thrown)})
      );
      tb.appendChild(tr);
    }

    [['D', counters.D], ['T', counters.T]].forEach(([label,c])=>{
      const tr=document.createElement('tr');
      tr.append(
        Object.assign(document.createElement('td'),{textContent:label}),
        Object.assign(document.createElement('td'),{className:'num', textContent:String(c.thrown)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:String(c.hits)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:pctStr(c.hits, c.thrown)})
      );
      tb.appendChild(tr);
    });

    // Bulls summary row
    {
      const c = counters.B;
      const tr=document.createElement('tr');
      tr.append(
        Object.assign(document.createElement('td'),{textContent:'B'}),
        Object.assign(document.createElement('td'),{className:'num', textContent:String(c.thrown)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:String(c.hits)}),
        Object.assign(document.createElement('td'),{className:'num', textContent:`${pctStr(c.hits, c.thrown)} (I:${pctStr(c.inner,c.thrown)} · O:${pctStr(c.outer,c.thrown)})`})
      );
      tb.appendChild(tr);
    }

    setActive(rangeKey);
  }

  btnAll.onclick   = ()=>void render('all');
  btnPower.onclick = ()=>render('power');
  btnMonth.onclick = ()=>render('month');

  // Default view
  render('all');

  const ft = document.createElement('div'); ft.className='modal-footer';
  const back=document.createElement('button'); back.className='btn'; back.textContent='Return';
  back.onclick=()=>{ ov.remove(); openPlayerStatsModePicker(playerName); };
  ft.appendChild(back);

  md.append(h, body, ft); ov.appendChild(md); document.body.appendChild(ov);
  md.tabIndex=0; md.focus(); ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.addEventListener('keydown', e=>{ if(e.key==='Escape') ov.remove(); });
}

// === T-D-B ===
async function openTDHDialog(playerName, mode){
  const games = await getGamesForMode(mode);
  const counters = accumulateTargetCounters(playerName, games);

  const ov = document.createElement('div'); ov.className='modal-backdrop';
  const md = document.createElement('div'); md.className='modal';
  const h  = document.createElement('h3');  h.textContent = `T-D-B – ${playerName} (${mode==='official'?'Official':'Practice'})`;
  const body = document.createElement('div'); body.className='modal-body';

  const tbl = document.createElement('table'); tbl.className='hs-table';
  const thead=document.createElement('thead'); const trh=document.createElement('tr');
  ['Target','Thrown','Treble %','Double %'].forEach(s=>{
    const th=document.createElement('th'); th.textContent=s; trh.appendChild(th);
  });
  thead.appendChild(trh); tbl.appendChild(thead);

  const tb = document.createElement('tbody');
  for (let n=10;n<=20;n++){
    const c = counters[String(n)];
    const tr=document.createElement('tr');
    tr.append(
      Object.assign(document.createElement('td'),{textContent:String(n)}),
      Object.assign(document.createElement('td'),{className:'num', textContent:String(c.thrown)}),
      Object.assign(document.createElement('td'),{className:'num', textContent:pctStr(c.tHits, c.thrown)}),
      Object.assign(document.createElement('td'),{className:'num', textContent:pctStr(c.dHits, c.thrown)})
    );
    tb.appendChild(tr);
  }
  tbl.appendChild(tb); body.appendChild(tbl);

  const ft = document.createElement('div'); ft.className='modal-footer';
  const back=document.createElement('button'); back.className='btn'; back.textContent='Return';
  back.onclick=()=>{ ov.remove(); openPlayerStatsModePicker(playerName); };
  ft.appendChild(back);

  md.append(h, body, ft); ov.appendChild(md); document.body.appendChild(ov);
  md.tabIndex=0; md.focus();
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.addEventListener('keydown', e=>{ if(e.key==='Escape') ov.remove(); });
}

/*****************
 * DETAILS PAGE (page 1)
 *****************/
const resumeBtn=byId('resumeBtn');
function getSavedState(){ 
  try{
    const raw=localStorage.getItem(STORAGE_KEY); 
    if(!raw) return null; 
    const saved=JSON.parse(raw); 
    if(!saved||!Array.isArray(saved.players)||!saved.players.length) { safeClear(STORAGE_KEY); return null; }
    if(typeof __sqIsRecoverableGameStateForLocalCache === 'function' && !__sqIsRecoverableGameStateForLocalCache(saved)) { safeClear(STORAGE_KEY); return null; }
    return saved;
  }catch(e){ 
    return null; 
  } 
}
function setupStartMenuButtons(){ 
  const saved   = getSavedState(); 
  const hasSaved = !!saved; 

  
  // Tournament button (placeholder)
  const tournamentBtn = byId("tournamentBtn");
  if (tournamentBtn) {
    tournamentBtn.disabled = false;
    tournamentBtn.title = "Tournament mode is coming soon";
    tournamentBtn.onclick = () => toast("Tournament mode; for 4 / 8 players - Coming soon!");
  }

  // Only show Resume if we actually have an in-progress saved match
  resumeBtn.style.display = hasSaved ? '' : 'none';
  resumeBtn.disabled = !hasSaved;
  resumeBtn.title    = hasSaved ? 'Resume last match' : 'No saved match';
if (hasSaved){ 
    resumeBtn.onclick = () => {
      try{ if (typeof __sqClearVsShadowTimers === 'function') __sqClearVsShadowTimers('resume-before-load'); }catch(_){ }
      if (typeof __sqSavedStateIsVsShadow === 'function' && __sqSavedStateIsVsShadow(saved)) {
        try{ safeClear(STORAGE_KEY); }catch(_){ }
        try{ setupStartMenuButtons(); }catch(_){ }
        try{ toast('Vs Shadow recovery is not supported for this mode. Start a new Vs Shadow game instead.'); }catch(_){ }
        return;
      }
      __sqShowGameLoadOverlay('Resuming Game');
      __sqAfterPaint(async ()=>{
        try{
          state = Object.assign(JSON.parse(JSON.stringify(baseState)), saved);
          try{ if (typeof __sqNormalizeVsShadowRuntimeState === 'function') __sqNormalizeVsShadowRuntimeState('resume-after-load'); }catch(_){ }
          show('game');
          assignUniqueColors(state.players);
          await buildEverythingChunked();
          updateUI();
          toast('Resumed last match');
        } finally {
          __sqHideGameLoadOverlay();
        }
      });
    }; 
  } else { 
    resumeBtn.onclick = null; 
  }

  const hsMainBtn = byId('hsMainBtn');
  if (hsMainBtn) {
    hsMainBtn.onclick = openHighScoresMenuDialog;
  }

  const leagueBtn = byId('leagueRankingsBtn');
  if (leagueBtn) leagueBtn.onclick = openLeagueRankingsDialog;

// === Player Stats: simple name-only picker (no PIN) ===
async function openPlayerStatsLookupDialog() {
  // Create basic modal shell
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Player Stats \u2013 Select Player';

  const body = document.createElement('div');
  body.className = 'modal-body';

  // Player name dropdown
  const nameWrap = document.createElement('div');
  nameWrap.className = 'stack';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'tag';
  nameLabel.textContent = 'Player Name';

  const nameSelect = document.createElement('select');
  nameSelect.id = 'statsPlayerSelect';
  nameSelect.style.width = '100%';

  nameWrap.append(nameLabel, nameSelect);
  body.append(nameWrap);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';
  cancelBtn.onclick = () => overlay.remove();

  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn primary';
  viewBtn.textContent = 'View Stats';
  viewBtn.type = 'button';

  footer.append(cancelBtn, viewBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.tabIndex = 0;
  modal.focus();

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.remove();
  });

  // Populate players: cloud first, then local saved players
  nameSelect.innerHTML = '<option value="">Select a saved player...</option>';
  let anyPlayers = false;

  try {
    if (typeof cloudListPlayers === 'function') {
      const cloudPlayers = await cloudListPlayers();
      (cloudPlayers || []).forEach(p => {
        if (!p || !p.name) return;
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        nameSelect.appendChild(opt);
        anyPlayers = true;
      });
    }
  } catch (err) {
    console.error('Stats: cloudListPlayers failed', err);
  }

  if (!anyPlayers && typeof getSavedPlayers === 'function') {
    const local = getSavedPlayers();
    (local || []).forEach(p => {
      if (!p || !p.name) return;
      const opt = document.createElement('option');
      opt.value = (p.id != null && String(p.id).trim()) ? String(p.id).trim() : p.name;
      opt.textContent = __sqPlayerOptionLabel(p) || p.name;
      nameSelect.appendChild(opt);
      anyPlayers = true;
    });
  }

  if (!anyPlayers) {
    body.innerHTML = '<p>No saved players found. Save a player from the Player Select screen first.</p>';
    viewBtn.disabled = true;
    return;
  }

  // Confirm: open stats for selected player, no PIN check
  viewBtn.onclick = () => {
    const name = nameSelect.value;
    if (!name) {
      if (typeof toast === 'function') toast('Select a saved player');
      return;
    }

    overlay.remove();

    if (typeof openPlayerStatsModePicker === 'function') {
      openPlayerStatsModePicker(name);
    } else {
      console.warn('openPlayerStatsModePicker is not defined; cannot show stats for', name);
    }
  };
}

// === Player Stats: simple name-only picker (no PIN) ===
async function openPlayerStatsLookupDialog() {
  // Create basic modal shell
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Player Stats – Select Player';

  const body = document.createElement('div');
  body.className = 'modal-body';

  // Player name dropdown
  const nameWrap = document.createElement('div');
  nameWrap.className = 'stack';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'tag';
  nameLabel.textContent = 'Player Name';

  const nameSelect = document.createElement('select');
  nameSelect.id = 'statsPlayerSelect';
  nameSelect.style.width = '100%';

  nameWrap.append(nameLabel, nameSelect);
  body.append(nameWrap);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';
  cancelBtn.onclick = () => overlay.remove();

  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn primary';
  viewBtn.textContent = 'View Stats';
  viewBtn.type = 'button';

  footer.append(cancelBtn, viewBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.tabIndex = 0;
  modal.focus();

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.remove();
  });

  // Populate players: cloud first, then local saved players
  nameSelect.innerHTML = '<option value="">Select a saved player...</option>';
  let anyPlayers = false;

  try {
    if (typeof cloudListPlayers === 'function') {
      const cloudPlayers = await cloudListPlayers();
      (cloudPlayers || []).forEach(p => {
        if (!p || !p.name) return;
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        nameSelect.appendChild(opt);
        anyPlayers = true;
      });
    }
  } catch (err) {
    console.error('Stats: cloudListPlayers failed', err);
  }

  if (!anyPlayers && typeof getSavedPlayers === 'function') {
    const local = getSavedPlayers();
    (local || []).forEach(p => {
      if (!p || !p.name) return;
      const opt = document.createElement('option');
      opt.value = (p.id != null && String(p.id).trim()) ? String(p.id).trim() : p.name;
      opt.textContent = __sqPlayerOptionLabel(p) || p.name;
      nameSelect.appendChild(opt);
      anyPlayers = true;
    });
  }

  if (!anyPlayers) {
    body.innerHTML = '<p>No saved players found. Save a player from the Player Select screen first.</p>';
    viewBtn.disabled = true;
    return;
  }

  // Confirm: open stats for selected player, no PIN check
  viewBtn.onclick = () => {
    const name = nameSelect.value;
    if (!name) {
      if (typeof toast === 'function') toast('Select a saved player');
      return;
    }

    overlay.remove();

    if (typeof openPlayerStatsModePicker === 'function') {
      openPlayerStatsModePicker(name);
    } else {
      console.warn('openPlayerStatsModePicker is not defined; cannot show stats for', name);
    }
  };
}

  const playerStatsBtn = byId('playerStatsBtn');
  if (playerStatsBtn) {
    playerStatsBtn.onclick = function(){
      if (typeof window.openPlayerStatsSelect === 'function') return window.openPlayerStatsSelect();
    if (typeof window.openPlayerStatsHub === 'function') return window.openPlayerStatsHub();
      return openPlayerStatsLookupDialog();
    };
  }
}

window.__sqSelectedMode = window.__sqSelectedMode || 'official';
const questBtnEl = byId('questBtn');
if (questBtnEl) questBtnEl.addEventListener('click', ()=>{
  window.__sqSelectedMode = 'official';
  show('players');
});
['startScreenBtnLB', 'backToDetailsBtn'].forEach(id => {
  document.querySelectorAll('#' + id).forEach(btn => {
    btn.addEventListener('click', () => show('details'));
  });
});
// Match Card BACK -> step back to the Select Game Mode screen (one screen
// back), not all the way out to the main/home screen. Switch the page under
// the modal to home first, so the modal's own Back then lands on home (one
// screen back again) instead of re-revealing the match card.
document.querySelectorAll('#startScreenBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    try{ show('details'); }catch(_){}
    try{ if (typeof arrangeStartActions === 'function') arrangeStartActions(); }catch(_){}
    try{ (window.openModal || openModal)('startGameModal'); }catch(_){}
  });
});

/*****************
 * PLAYER SELECT (page 2) — MATCH SETUP FLOW
 *
 * Desired flow:
 * 1) Players screen: add players (registered/guest). No match length here.
 * 2) Start Match -> Match Length modal (1–5 games)
 * 3) Start Match (Match Length) -> Throwing Order dialog -> game
 *****************/
const msPlayersList = byId('msPlayersList');
const msAddRegisteredBtn = byId('msAddRegisteredBtn');
const msAddGuestBtn = byId('msAddGuestBtn');
const msRegisterPlayerBtn = byId('msRegisterPlayerBtn');
const msMinHint = byId('msMinHint');

let __msPlayers = []; // { type:'registered'|'guest', name:'' }

function __msResetSetupForMode(mode){
  try{
    window.__sqSelectedMode = mode || window.__sqSelectedMode || 'match';
    if (window.__sqSelectedMode !== 'match') window.__sqSelectedMatchVariant = 'classic';
    else window.__sqSelectedMatchVariant = window.__sqSelectedMatchVariant || 'classic';
    __msPlayers = [];
    __mlSelectedGames = 0;
    const ml = byId('matchLengthModal');
    if (ml) ml.classList.add('hidden');
    try{ __msRenderPlayers(); }catch(_){
      try{ if (msPlayersList) msPlayersList.innerHTML = ''; }catch(__){}
      try{ __msUpdateStartEnabled(); }catch(__){}
    }
    try{ __msApplyModeStyling(); }catch(_){ }
    try{ __msUpdateStartEnabled(); }catch(_){ }
  }catch(_){ }
}


function __msNormalizeName(name, fallback){
  const s = (name || '').trim();
  return s || fallback || '';
}

function __sqIsVsShadowSetup(){
  return (window.__sqSelectedMode || 'match') === 'practice' && String(window.__sqPracticeGameType || '').toLowerCase() === 'vsshadow';
}

function __sqVsShadowSetupSlotTaken(){
  return __sqIsVsShadowSetup() && Array.isArray(__msPlayers) && __msPlayers.length >= 1;
}

function __sqVsShadowHasExactlyOneRealPlayer(){
  return __sqIsVsShadowSetup() && Array.isArray(__msPlayers) && __msPlayers.length === 1 && __msValidPlayerCount() === 1;
}

const MS2_MAX_PLAYERS = 6;

// Best-effort Power Rank lookup (official power rankings, cached ~60s).
// Resolves to a Map of lowercased player name -> rank; empty map offline.
async function __ms2EnsurePowerRanks(){
  if (window.__ms2PowerRanks && (Date.now() - (window.__ms2PowerRanksAt || 0) < 60000)) return window.__ms2PowerRanks;
  const map = new Map();
  try{
    if (typeof getOfficialPowerRows === 'function'){
      const rows = await getOfficialPowerRows();
      (rows || []).forEach((r, i) => {
        const n = String((r && r.player) || '').trim().toLowerCase();
        if (n && !map.has(n)) map.set(n, i + 1);
      });
    }
  }catch(_){ }
  window.__ms2PowerRanks = map;
  window.__ms2PowerRanksAt = Date.now();
  return map;
}

function __ms2DisplayName(p){
  const base = String((p && p.name) || '').trim().toUpperCase();
  const nick = String((p && p.nickname) || '').trim().toUpperCase();
  return nick ? `${base} “${nick}”` : base;
}

// Avatar (M3 generic person) + rank line builders for slot rows.
function __ms2Avatar(player){
  const ava = document.createElement('span');
  ava.className = 'ms2-ava';
  ava.setAttribute('aria-hidden', 'true');
  const isGuest = !!(player && typeof player === 'object' && player.type === 'guest');
  if (isGuest) {
    ava.dataset.guestAvatar = '1';
    ava.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="3.4"/><path d="M5.5 19.5c1.2-3.1 3.6-4.7 6.5-4.7s5.3 1.6 6.5 4.7"/></svg>';
    return ava;
  }
  try{ __sqApplyAvatarSprite(ava, __sqAvatarIdForPlayer(player)); }
  catch(_){ ava.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="3.4"/><path d="M5.5 19.5c1.2-3.1 3.6-4.7 6.5-4.7s5.3 1.6 6.5 4.7"/></svg>'; }
  return ava;
}

function __ms2RankLine(name){
  const ranks = document.createElement('span');
  ranks.className = 'ms2-ranks';
  const key = String(name || '').trim().toLowerCase();
  const pr = (window.__ms2PowerRanks && window.__ms2PowerRanks.get(key)) || null;
  const mo = document.createElement('span');
  mo.textContent = 'Monthly Rank: ';
  const mob = document.createElement('b'); mob.textContent = '–';
  mo.appendChild(mob);
  const po = document.createElement('span');
  po.textContent = 'Power Rank: ';
  const pob = document.createElement('b'); pob.textContent = pr != null ? String(pr) : '–';
  pob.className = 'ms2-power-rank';
  pob.dataset.playerKey = key;
  po.appendChild(pob);
  ranks.append(mo, po);
  return ranks;
}

function __msRenderPlayers(){
  if (!msPlayersList) return;
  msPlayersList.innerHTML = '';

  __msPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'ms2-slot filled ms-player-row';
    row.dataset.index = String(i);

    row.appendChild(__ms2Avatar(p));

    const info = document.createElement('div');
    info.className = 'ms2-info';

    if (p.type === 'guest') {
      const inp = document.createElement('input');
      inp.className = 'ms2-guest-input ms-player-input';
      inp.type = 'text';
      inp.setAttribute('aria-label', `Guest player ${i + 1} name`);
      inp.autocomplete = 'off';
      inp.enterKeyHint = 'done';
      inp.placeholder = 'Guest player name';
      inp.value = p.name || '';
      inp.addEventListener('input', () => {
        __msPlayers[i].name = inp.value;
        __msUpdateStartEnabled();
      });
      inp.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          inp.blur();
        }
      });
      info.appendChild(inp);
      const tag = document.createElement('span');
      tag.className = 'ms2-ranks';
      tag.textContent = 'Guest · not saved';
      info.appendChild(tag);
    } else {
      const nm = document.createElement('span');
      nm.className = 'ms2-nm ms-player-name';
      nm.textContent = __ms2DisplayName(p) || '—';
      info.appendChild(nm);
      info.appendChild(__ms2RankLine(p.name));
    }
    row.appendChild(info);

    const remove = document.createElement('button');
    remove.className = 'ms2-x ms-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove player ${i + 1}`);
    remove.textContent = '✕';
    remove.onclick = () => {
      __msPlayers.splice(i, 1);
      __msRenderPlayers();
      __msUpdateStartEnabled();
      const next = msPlayersList.querySelectorAll('.ms-remove')[i]
        || msPlayersList.querySelectorAll('.ms-remove')[i - 1]
        || msAddGuestBtn;
      if (next) next.focus();
    };
    row.appendChild(remove);

    msPlayersList.appendChild(row);
  });

  // Keep available places visible; Vs Shadow has one real-player place.
  const slotCap = __sqIsVsShadowSetup() ? 1 : MS2_MAX_PLAYERS;
  for (let i = __msPlayers.length; i < slotCap; i++){
    const slot = document.createElement('div');
    slot.className = 'ms2-slot empty';
    slot.setAttribute('aria-hidden', 'true');
    slot.textContent = `${String(i + 1).padStart(2, '0')}  /  OPEN SLOT`;
    msPlayersList.appendChild(slot);
  }

  // Fill Power Rank values once rankings arrive (offline -> dashes stay).
  if (!window.__ms2PowerRanks && __msPlayers.some(p => p.type !== 'guest')){
    __ms2EnsurePowerRanks().then(m => {
      // Update only rank text: replacing the list steals focus/caret from guest inputs.
      if (!m) return;
      msPlayersList.querySelectorAll('.ms2-power-rank').forEach(el => {
        const rank = m.get(el.dataset.playerKey);
        el.textContent = rank != null ? String(rank) : '–';
      });
    }).catch(()=>{});
  }

  __msUpdateStartEnabled();
}

function __msValidPlayerCount(){
  const nonEmpty = __msPlayers.filter(p => __msNormalizeName(p.name,'') !== '');
  return nonEmpty.length;
}

function __msMinPlayersRequired(){
  // Practice allows 1–6 players. Match Play requires 2–6.
  const mode = (window.__sqSelectedMode || 'match');
  if (__sqIsVsShadowSetup()) return 1;
  return (mode === 'practice') ? 1 : 2;
}

function __msApplyModeStyling(){
  const mode = (window.__sqSelectedMode || 'match');
  const startBtn = byId('startMatchBtn');
  const regBtn = byId('msRegisterPlayerBtn');

  // Practice: remove Save New Player from this flow
  if (regBtn) regBtn.style.display = (mode === 'practice') ? 'none' : '';

  // Practice: blue primary CTA
  if (startBtn) {
    startBtn.classList.remove('ms-primary','ms-primary-blue','ms-primary-blueLight');
    startBtn.classList.add(mode === 'practice' ? 'ms-primary-blue' : 'ms-primary');
  }
}

function __msUpdateStartEnabled(){
  try{ __msApplyModeStyling(); }catch(_){ }
  const n = __msValidPlayerCount();
  const startBtn = byId('startMatchBtn');
  const minP = __msMinPlayersRequired();
  const vsShadow = __sqIsVsShadowSetup();
  const vsShadowOk = !vsShadow || __sqVsShadowHasExactlyOneRealPlayer();
  const cap = vsShadow ? 1 : MS2_MAX_PLAYERS;
  const overCap = __msPlayers.length > cap;
  const ready = n >= minP && vsShadowOk && !overCap;
  if (startBtn) startBtn.disabled = !ready;

  const full = __msPlayers.length >= cap;
  const fullReason = vsShadow ? 'Vs Shadow uses exactly 1 real player.' : 'All 6 places are filled. Remove a player to add another.';
  [msAddRegisteredBtn, msAddGuestBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = full;
    btn.title = full ? fullReason : '';
    btn.setAttribute('aria-describedby', 'msMinHint');
  });
  const count = byId('msRosterCount');
  if (count) count.textContent = `${__msPlayers.length} / ${cap} selected`;
  const modeLabel = byId('msModeLabel');
  if (modeLabel) {
    const practice = (window.__sqSelectedMode || 'match') === 'practice';
    modeLabel.textContent = vsShadow ? 'VS SHADOW' : practice ? 'PRACTICE'
      : window.__sqSelectedMatchVariant === 'turbo' ? 'TURBO' : 'CLASSIC';
  }

  if (msMinHint) {
    const unnamed = __msPlayers.length - n;
    const needed = Math.max(0, minP - n);
    let needTxt = ready ? `${n} player${n === 1 ? '' : 's'} ready. Choose the match length.`
      : `Add ${needed} ${n ? 'more ' : ''}player${needed === 1 ? '' : 's'} to continue.`;
    if (!ready && unnamed && !overCap) needTxt = `Name your guest${unnamed === 1 ? '' : 's'} to continue. ${minP} named player${minP === 1 ? '' : 's'} required.`;
    if (ready && unnamed) needTxt += ` ${unnamed} unnamed guest${unnamed === 1 ? '' : 's'} will be left out.`;
    if (full) needTxt += ` ${fullReason}`;
    if (overCap) needTxt = `Remove ${__msPlayers.length - cap} player${__msPlayers.length - cap === 1 ? '' : 's'} to continue. Maximum ${cap}.`;
    if (msMinHint.textContent !== needTxt) msMinHint.textContent = needTxt;
    msMinHint.dataset.ready = String(ready);
  }
}

function __msAddGuest(){
  if (__sqVsShadowSetupSlotTaken()) {
    toast('Vs Shadow uses exactly 1 real player.');
    return;
  }
  if (__msPlayers.length >= MS2_MAX_PLAYERS) {
    toast(`Match card is full (max ${MS2_MAX_PLAYERS} players)`);
    return;
  }
  __msPlayers.push({ type:'guest', name:'' });
  __msRenderPlayers();
  const input = msPlayersList.querySelector(`[data-index="${__msPlayers.length - 1}"] .ms-player-input`);
  if (input) input.focus();
}

if (msAddRegisteredBtn) msAddRegisteredBtn.addEventListener('click', async () => {
  if (__sqVsShadowSetupSlotTaken()) {
    toast('Vs Shadow uses exactly 1 real player.');
    return;
  }
  await showSelectPlayerDialog(0); // index==0 => add to list
});

if (msAddGuestBtn) msAddGuestBtn.addEventListener('click', __msAddGuest);

// Register Player: open the Add Player modal but do not bind to a row (index==0)
if (msRegisterPlayerBtn) {
  msRegisterPlayerBtn.addEventListener('click', async () => {
    await showAddPlayerDialog(0);
  });
}

/* ===== Match Length modal ===== */
const matchLengthModal = byId('matchLengthModal');
const mlGrid = byId('mlGrid');
const mlStartBtn = byId('mlStartBtn');
const mlBackBtn = byId('mlBackBtn');

let __mlSelectedGames = 0;

function __mlModeKind(){
  try{ if (__sqIsVsShadowSetup()) return 'shadow'; }catch(_){ }
  return ((window.__sqSelectedMode || 'match') === 'practice') ? 'practice' : 'match';
}

function __mlHintTextFor(n){
  const s = (n === 1) ? '' : 's';
  const kind = __mlModeKind();
  if (kind === 'shadow')   return `Shadow battle: you'll play ${n} game${s} against the shadow.`;
  if (kind === 'practice') return `Practice session: you'll play ${n} game${s}.`;
  // Match semantics are first-to-N wins (targetWins = games).
  return `The first player to win ${n} game${s} is the match winner.`;
}

function __mlBuildGrid(){
  if (!mlGrid) return;

  // Radial dial: 5 ring segments around a centre readout.
  const CX = 130, CY = 130, RO = 124, RI = 74, GAP = 2.6;
  const rad = a => (a * Math.PI) / 180;
  const px = (r, a) => (CX + r * Math.cos(rad(a))).toFixed(2);
  const py = (r, a) => (CY + r * Math.sin(rad(a))).toFixed(2);
  const segPath = (a1, a2) =>
    `M ${px(RO,a1)} ${py(RO,a1)} A ${RO} ${RO} 0 0 1 ${px(RO,a2)} ${py(RO,a2)} ` +
    `L ${px(RI,a2)} ${py(RI,a2)} A ${RI} ${RI} 0 0 0 ${px(RI,a1)} ${py(RI,a1)} Z`;

  let svg = `<svg class="mlw-svg" viewBox="0 0 260 260" role="group" aria-label="Select number of games">`;
  svg += `<defs><filter id="mlwGlow" x="-40%" y="-40%" width="180%" height="180%">` +
         `<feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ff7a00" flood-opacity=".55"/></filter></defs>`;
  for (let n = 1; n <= 5; n++){
    const mid = -90 + (n - 1) * 72;
    const a1 = mid - 36 + GAP, a2 = mid + 36 - GAP;
    const tr = (RO + RI) / 2;
    svg += `<g class="mlw-seg" data-value="${n}" role="button" tabindex="0" aria-label="${n} game${n===1?'':'s'}">` +
           `<path class="mlw-seg-path" d="${segPath(a1, a2)}"/>` +
           `<text class="mlw-seg-num" x="${px(tr, mid)}" y="${py(tr, mid)}" text-anchor="middle" dominant-baseline="central">${n}</text>` +
           `</g>`;
  }
  svg += `<circle class="mlw-hub" cx="${CX}" cy="${CY}" r="${RI - 10}"/>` +
         `<g class="mlw-trophy" transform="translate(${CX - 11},${CY - 44}) scale(0.92)">` +
         `<path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0V4ZM5 6H3v2a4 4 0 0 0 4 2M19 6h2v2a4 4 0 0 1-4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>` +
         `<text class="mlw-hub-top" x="${CX}" y="${CY - 8}" text-anchor="middle">FIRST TO</text>` +
         `<text class="mlw-hub-num" id="mlwHubNum" x="${CX}" y="${CY + 24}" text-anchor="middle">3</text>` +
         `<text class="mlw-hub-bot" id="mlwHubBot" x="${CX}" y="${CY + 46}" text-anchor="middle">WINS</text>` +
         `</svg>`;
  mlGrid.innerHTML = svg;

  const hubTop = mlGrid.querySelector('.mlw-hub-top');
  const hubNum = mlGrid.querySelector('#mlwHubNum');
  const hubBot = mlGrid.querySelector('#mlwHubBot');
  const hintEl = byId('mlHintText');

  const select = (n) => {
    __mlSelectedGames = n;
    mlGrid.querySelectorAll('.mlw-seg').forEach(g => {
      g.classList.toggle('selected', Number(g.dataset.value) === n);
    });
    const kind = __mlModeKind();
    if (hubTop) hubTop.textContent = (kind === 'match') ? 'FIRST TO' : 'PLAY';
    if (hubNum) hubNum.textContent = String(n);
    if (hubBot) hubBot.textContent = (kind === 'match') ? (n === 1 ? 'WIN' : 'WINS') : (n === 1 ? 'GAME' : 'GAMES');
    if (hintEl) hintEl.textContent = __mlHintTextFor(n);
    if (mlStartBtn) mlStartBtn.disabled = false;
  };

  mlGrid.querySelectorAll('.mlw-seg').forEach(g => {
    const pick = () => select(Number(g.dataset.value));
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });

  // default selection: 3 games (matches old default)
  select(3);
}

function __mlOpen(){
  if (!matchLengthModal) return;

  const mode = (window.__sqSelectedMode || 'match');
  if (mlStartBtn) {
    if (__sqIsVsShadowSetup()) {
      mlStartBtn.className = 'btn ms-start ms-primary-blueLight practice-cta';
      mlStartBtn.innerHTML = 'SELECT OPPONENT <span class="ms-arrow">▶</span>';
    } else if (mode === 'practice') {
      mlStartBtn.className = 'btn ms-start ms-primary-blueLight practice-cta';
      mlStartBtn.innerHTML = 'SELECT THROWING ORDER <span class="ms-arrow">▶</span>';
    } else {
      // Match Play: keep CTA styling consistent with Match Setup
      mlStartBtn.className = 'btn ms-start ms-primary';
      mlStartBtn.innerHTML = 'SET THROW ORDER <span class="ms-arrow">▶</span>';
    }
    mlStartBtn.disabled = true;
  }

  const mlFootBack = byId('mlFooterBackBtn');
  if (mlFootBack && !mlFootBack.__mlWired){
    mlFootBack.__mlWired = true;
    mlFootBack.onclick = () => { if (mlBackBtn) mlBackBtn.click(); else __mlClose(); };
  }

  __mlBuildGrid();
  matchLengthModal.classList.remove('hidden');
}

function __mlClose(){
  if (!matchLengthModal) return;
  matchLengthModal.classList.add('hidden');
}

if (mlBackBtn) mlBackBtn.onclick = __mlClose;

// Start Match (players screen) -> open match length modal
const psStartMatchBtn = byId('startMatchBtn');
if (psStartMatchBtn) {
  psStartMatchBtn.addEventListener('click', () => {
    const minP = __msMinPlayersRequired();
    if (__msPlayers.length > MS2_MAX_PLAYERS) {
      toast(`Match card is full (max ${MS2_MAX_PLAYERS} players)`);
      return;
    }
    if (__sqIsVsShadowSetup() && !__sqVsShadowHasExactlyOneRealPlayer()) {
      toast('Vs Shadow uses exactly 1 real player.');
      return;
    }
    if (__msValidPlayerCount() < minP) {
      toast(minP === 1 ? 'Add 1+ player' : 'Add 2+ players');
      return;
    }
    __mlOpen();
  });
}

// Match Length -> Start Match -> Throwing Order -> Game
if (mlStartBtn) {
  mlStartBtn.addEventListener('click', () => {
    const games = parseInt(__mlSelectedGames, 10) || 1;

    // Build players from __msPlayers (trim empties) and carry profile fields through.
    const built = [];
    __msPlayers.forEach((p) => {
      const nm = __msNormalizeName(p.name, '');
      if (!nm) return;
      built.push({
        type: p.type || 'guest',
        id: p.id != null ? p.id : null,
        name: nm,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        nickname: p.nickname || '',
        initials: p.initials || '',
        avatar_id: p.type === 'guest' ? null : __sqAvatarIdForPlayer(p)
      });
    });

    const minP = __msMinPlayersRequired();
    if (built.length < minP) {
      toast(minP === 1 ? 'Add 1+ player' : 'Add 2+ players');
      return;
    }
    const __isVsShadow = __sqIsVsShadowSetup();
    if (__isVsShadow && built.length !== 1) {
      toast('Vs Shadow uses exactly 1 real player.');
      return;
    }

    // Attach full profile (cloud-synced) when available; fallback to name parsing.
    state.players = built.map(p => {
      const meta = (p.type === 'registered')
        ? (p.first_name || p.last_name || p.nickname || p.initials ? p : (__sqFindSavedPlayerMetaByName(p.name) || p))
        : p;

      const parts = __sqNameParts(p.name);
      const first = String(meta.first_name || '').trim() || parts.first;
      const last  = String(meta.last_name  || '').trim() || parts.last;
      const nick  = String(meta.nickname   || '').trim();
      const init  = __sqNormalizeInitials(meta.initials, p.name);

      return {
        type: p.type || 'guest',
        id: p.id,
        name: p.name,
        first_name: first,
        last_name: last,
        nickname: nick,
        initials: init,
        avatar_id: p.type === 'guest' ? null : __sqAvatarIdForPlayer(meta || p),
        color: null
      };
    });
    assignUniqueColors(state.players);

    const __selMode = (window.__sqSelectedMode || 'official');
    const __matchVariant = (__selMode === 'match' && window.__sqSelectedMatchVariant === 'turbo') ? 'turbo' : 'classic';
    const __isMatchTurbo = (__selMode === 'match' && __matchVariant === 'turbo');
    try{
      delete state.gameFormat;
      delete state.gameVariant;
      delete state.mode;
      delete state.gameMode;
      delete state.startTarget;
      delete state.strictTimer;
      delete state.throwLimitSeconds;
      delete state.tournamentType;
      delete state.tournamentRules;
      if (__selMode === 'match') {
        try{ window.__sqTournamentDraft = null; }catch(__){}
        delete state.__sqTournamentDraft;
        delete state.__sqTournamentActive;
        delete state.__sqTournamentTurboTimer;
        try{ sessionStorage.removeItem('sq_tournament_runtime_v1'); }catch(__){}
      }
    }catch(_){ }
    if (__isMatchTurbo) {
      state.gameFormat = 'match_play';
      state.gameVariant = 'turbo';
      state.mode = 'turbo';
      state.gameMode = 'turbo';
      state.startTarget = '17';
      state.strictTimer = true;
      state.throwLimitSeconds = 20;
    }
    state.match = {
      id: genUuidV4(),
      mode: __isMatchTurbo ? 'turbo' : __selMode,
      gameMode: __isMatchTurbo ? 'turbo' : undefined,
      gameFormat: (__selMode === 'match') ? 'match_play' : undefined,
      gameVariant: (__selMode === 'match') ? __matchVariant : undefined,
      startTarget: __isMatchTurbo ? '17' : undefined,
      strictTimer: __isMatchTurbo ? true : undefined,
      throwLimitSeconds: __isMatchTurbo ? 20 : undefined,
      tournament: __isMatchTurbo ? false : undefined,
      forcePractice: (__selMode === 'practice'),
      practiceType: (__selMode === 'practice' ? (window.__sqPracticeGameType || 'classic') : null),
      createdAtIso: _tsOverride || new Date().toISOString(),
      targetWins: games,
      gameNumber: 1,
      // SC-033: ordinary Match Play rotates the starter one place each new game by default.
      // Practice / Vs Shadow remain on their existing order paths.
      autoRotateOrder: (__selMode === 'match') ? true : undefined,
      wins: Array.from({ length: state.players.length }, () => 0),
      history: [],
      completedLogged: false
    };

    state.matchAgg = null;
    ensureMatchAgg();

    __mlClose();

    // Force Live V2 to rebuild when switching between solo practice and multiplayer matches.
    try{
      const p = document.getElementById('liveV2Panel');
      if (p){ p.dataset.built = '0'; p.dataset.pcount = ''; p.innerHTML = ''; }
    }catch(_){ }

    if (__isVsShadow) {
      state.match.practiceType = 'vsShadow';
      state.match.forcePractice = true;
      state.shadow = __sqBuildVsShadowDraftConfig(games, state.players[0]);
      if (typeof openPracticeVsShadowOpponentDialog === 'function') {
        openPracticeVsShadowOpponentDialog();
      } else {
        toast('Vs Shadow opponent selector unavailable.');
      }
      setupStartMenuButtons();
      return;
    }

    try{ delete state.shadow; }catch(_){ }

    // Open throw-order dialog first, then start game on confirm
    startNewGame(false);
    setupStartMenuButtons();
    save();
  });
}

const __SQ_VS_SHADOW_PHASE1_REASON = 'Select replayable Official source data for every game to start Vs Shadow.';
const __SQ_VS_SHADOW_PHASE2C_REASON = 'Shadow is replaying its Official round. Manual input is disabled.';
const __SQ_VS_SHADOW_COMPLETION_BLOCK_REASON = 'Vs Shadow completion/save is only available for a live fully replayed game.';
const __SQ_VS_SHADOW_UNDO_BLOCK_REASON = 'Shadow undo is unavailable while the Shadow turn is in progress.';
const __SQ_VS_SHADOW_PRE_THROW_DELAY_MS = 3000;
const __SQ_VS_SHADOW_DART_STAGGER_MS = 800;
const __SQ_VS_SHADOW_POST_DART_ADVANCE_MS = 900;

function __sqIsShadowPlayer(p){
  try{
    return !!(p && typeof p === 'object' && (
      p.isShadow === true ||
      p.virtual === true ||
      p.shadow === true ||
      p.shadowId != null ||
      String(p.type || '').toLowerCase() === 'shadow' ||
      String(p.kind || '').toLowerCase() === 'shadow'
    ));
  }catch(_){ return false; }
}

function __sqIsVsShadowRuntime(){
  try{
    const st = (typeof state !== 'undefined' && state) ? state : (window.state || {});
    const match = st.match || {};
    const shadow = st.shadow || {};
    return String(shadow.mode || '').toLowerCase() === 'vsshadow' ||
      String(match.practiceType || '').toLowerCase() === 'vsshadow';
  }catch(_){ return false; }
}

function __sqVsShadowCompletionBlocked(){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    const shadow = (typeof state !== 'undefined' && state && state.shadow) ? state.shadow : {};
    return !(shadow.autoTurnEnabled === true && shadow.completionEnabled === true);
  }catch(_){ return false; }
}

function __sqVsShadowCurrentPlayerIsShadow(){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    const idx = Number(state && state.currentPlayer);
    return Number.isFinite(idx) && __sqIsShadowPlayer(state.players && state.players[idx]);
  }catch(_){ return false; }
}

function __sqVsShadowBlockPhase2C(message){
  const msg = message || __SQ_VS_SHADOW_PHASE2C_REASON;
  try{ if (state && state.shadow) state.shadow.lastBlockedReason = msg; }catch(_){ }
  try{ window.__sqVsShadowLastBlockMessage = msg; }catch(_){ }
  try{ if (typeof toast === 'function') toast(msg); }catch(_){ }
  try{ window.sqDmdShowZones?.({ z2:'SHADOW PAUSED', z3:'PHASE 2C' }, { type:'flash', ms:900, fx:'impact', z3Small:true }); }catch(_){ }
  return true;
}

function __sqClearVsShadowTimers(reason){
  try{
    const timers = Array.isArray(window.__sqVsShadowTimers) ? window.__sqVsShadowTimers : [];
    timers.forEach(id => { try{ clearTimeout(id); }catch(_){ } });
    window.__sqVsShadowTimers = [];
    if (state && state.shadow) {
      state.shadow.autoTurnPending = false;
      state.shadow.autoTurnInProgress = false;
      state.shadow.autoTurnToken = null;
      state.shadow.autoTurnClearReason = reason || '';
    }
  }catch(_){ window.__sqVsShadowTimers = []; }
}

function __sqSavedStateIsVsShadow(st){
  try{
    const s = (st && typeof st === 'object') ? st : {};
    const match = s.match || {};
    const players = Array.isArray(s.players) ? s.players : [];
    const matchType = String(match.practiceType || match.practice_type || '').toLowerCase();
    return matchType === 'vsshadow' || players.some(p => __sqIsShadowPlayer(p));
  }catch(_){ return false; }
}

function __sqNormalizeVsShadowRuntimeState(reason){
  try{
    const match = (state && state.match) ? state.match : {};
    const players = Array.isArray(state && state.players) ? state.players : [];
    const hasShadowPlayer = players.some(p => __sqIsShadowPlayer(p));
    const matchType = String(match.practiceType || match.practice_type || '').toLowerCase();
    const isVsShadow = hasShadowPlayer || matchType === 'vsshadow';
    if (!isVsShadow) {
      try{ __sqClearVsShadowTimers(reason || 'normalize-non-shadow'); }catch(_){ }
      try{ delete state.shadow; }catch(_){ }
      return false;
    }
    if (!state.shadow || typeof state.shadow !== 'object') state.shadow = {};
    try{ __sqClearVsShadowTimers(reason || 'normalize-shadow'); }catch(_){ }
    const reasonText = String(reason || '').toLowerCase();
    const liveRuntime = /^runtime_phase/i.test(String(state.shadow.status || '')) &&
      state.shadow.autoTurnEnabled === true &&
      !/(resume|recover|storage|load)/i.test(reasonText);
    state.shadow.autoTurnPending = false;
    state.shadow.autoTurnInProgress = false;
    state.shadow.autoTurnToken = null;
    state.shadow.autoTurnClearReason = reason || 'normalize';
    state.shadow.completionEnabled = liveRuntime ? (state.shadow.completionEnabled === true) : false;
    state.shadow.savePolicy = state.shadow.savePolicy || 'real-only';
    return true;
  }catch(_){ return false; }
}

function __sqSanitizeVsShadowForGenericStart(reason){
  try{
    const players = Array.isArray(state && state.players) ? state.players : [];
    const wasVsShadow = (typeof __sqSavedStateIsVsShadow === 'function' && __sqSavedStateIsVsShadow(state)) ||
      players.some(p => __sqIsShadowPlayer(p));
    if (!wasVsShadow) return false;
    try{ __sqClearVsShadowTimers(reason || 'sanitize-generic-start'); }catch(_){ }
    const realIndexes = (typeof __sqRealPlayerIndexes === 'function') ? __sqRealPlayerIndexes(players) : players.map((_, i) => i);
    const realPlayers = realIndexes.map(i => players[i]).filter(Boolean);
    const realScore = Array.isArray(state.score)
      ? realIndexes.map(i => __sqDeepCloneForPersist(state.score[i] || []))
      : realPlayers.map(() => []);
    state.players = realPlayers;
    state.score = realScore;
    state.currentPlayer = 0;
    state.currentRound = 0;
    state.currentDart = 0;
    state.history = [];
    state.finished = false;
    state.gameAwarded = false;
    state.match = Object.assign({}, state.match || {}, {
      mode:'practice',
      forcePractice:true,
      practiceType:'classic',
      gameMode:'practice',
      wins:Array.from({ length: realPlayers.length }, () => 0)
    });
    delete state.shadow;
    return true;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow generic-start sanitization failed', e); }catch(_){ }
    return false;
  }
}

function __sqRuntimePlayerDisplayEntries(opts){
  try{
    const players = Array.isArray(state && state.players) ? state.players : [];
    const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
    const page = String(document.body && document.body.dataset && document.body.dataset.page || '').toLowerCase();
    const shadow = (state && state.shadow) ? state.shadow : {};
    const liveShadowRuntime = /^runtime_phase/i.test(String(shadow.status || '')) && shadow.autoTurnEnabled === true;
    const liveComparison = !!(isVsShadow && liveShadowRuntime && page === 'game' && state.finished !== true && state.gameAwarded !== true && !(opts && opts.persisted));
    // Live gameplay comparison may show the runtime Shadow. Completed/report/history views stay real-only.
    const indexes = (isVsShadow && !liveComparison && typeof __sqRealPlayerIndexes === 'function')
      ? __sqRealPlayerIndexes(players)
      : players.map((_, i) => i);
    return indexes.map(i => ({ index:i, player:players[i] })).filter(x => !!x.player);
  }catch(_){
    return [];
  }
}

function __sqVsShadowShadowDartsStarted(roundIndex){
  try{
    const shadowIndex = Number(state && state.shadow && state.shadow.shadowPlayerIndex);
    const entry = state && state.score && state.score[shadowIndex] && state.score[shadowIndex][roundIndex];
    const darts = entry && Array.isArray(entry.darts) ? entry.darts : [];
    return darts.some(d => d && Number.isFinite(Number(d.points)));
  }catch(_){ return false; }
}

function __sqVsShadowShadowRoundComplete(roundIndex){
  try{
    const shadowIndex = Number(state && state.shadow && state.shadow.shadowPlayerIndex);
    const entry = state && state.score && state.score[shadowIndex] && state.score[shadowIndex][roundIndex];
    const darts = entry && Array.isArray(entry.darts) ? entry.darts.slice(0, 3) : [];
    return darts.length === 3 && darts.every(d => d && Number.isFinite(Number(d.points)));
  }catch(_){ return false; }
}

function __sqResetVsShadowShadowRound(roundIndex){
  try{
    const shadowIndex = Number(state && state.shadow && state.shadow.shadowPlayerIndex);
    const entry = state && state.score && state.score[shadowIndex] && state.score[shadowIndex][roundIndex];
    if (!entry || !Array.isArray(entry.darts)) return false;
    entry.darts = [null, null, null];
    entry.roundTotal = 0;
    state.currentDart = 0;
    try{ __sqRecomputeVsShadowShadowTotals(); }catch(_){ }
    return true;
  }catch(_){ return false; }
}

function __sqResumeVsShadowAutoTurnIfNeeded(reason){
  try{
    if (!__sqIsVsShadowRuntime() || !__sqVsShadowCurrentPlayerIsShadow()) return false;
    const shadow = state.shadow || {};
    if (shadow.autoTurnPending || shadow.autoTurnInProgress || state.finished || state.gameAwarded) return false;
    const roundIndex = Number(state.currentRound);
    if (!Number.isFinite(roundIndex)) return false;
    if (__sqVsShadowShadowRoundComplete(roundIndex)) return __sqAdvanceAfterVsShadowAutoTurn();
    if (__sqVsShadowShadowDartsStarted(roundIndex)) __sqResetVsShadowShadowRound(roundIndex);
    state.currentDart = 0;
    return __sqScheduleVsShadowAutoTurn(roundIndex);
  }catch(_){ return false; }
}

function __sqVsShadowSelectedRowsReady(controls){
  try{
    const rows = Array.isArray(controls) ? controls : [];
    return rows.length > 0 && rows.every(ctrl => {
      const candidate = (ctrl.candidates || []).find(c => c.key === ctrl.scoreSelect.value);
      return !!(candidate && candidate.replayAvailable && candidate.gameId && Array.isArray(candidate.sourceRows) && candidate.sourceRows.length);
    });
  }catch(_){ return false; }
}

function __sqVsShadowCleanSourceName(value){
  try{
    return String(value || '')
      .replace(/^Shadow:\s*/i, '')
      .replace(/\s+(?:GHOST|👻)\s*$/i, '')
      .trim();
  }catch(_){ return ''; }
}

function __sqVsShadowGhostMarker(forDmd){
  try{
    if (forDmd) return 'GHOST';
    if (!forDmd) return '👻';
  }catch(_){ return forDmd ? 'GHOST' : '👻'; }
}

function __sqVsShadowDmdInitialsForName(name){
  try{
    const cleaned = __sqVsShadowCleanSourceName(name)
      .replace(/\bPB\b/ig, ' ')
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return 'P';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return String(parts[0][0] || 'P').toUpperCase();
    const first = String(parts[0][0] || '');
    const last = String(parts[parts.length - 1][0] || '');
    return (first + last).toUpperCase() || 'P';
  }catch(_){ return 'P'; }
}

function __sqVsShadowDmdLabelForGame(gameConfig){
  try{
    const g = gameConfig || {};
    const rawName = __sqVsShadowCleanSourceName(__sqVsShadowPlayerName(g.sourcePlayerName || g.opponentName || g.playerName || g.name)) || 'Player';
    const isPb = String(g.opponentKind || '').toLowerCase() === 'player_pb' || /\bPB\b/i.test(rawName);
    const initials = __sqVsShadowDmdInitialsForName(rawName);
    return (initials + (isPb ? ' PB' : '') + ' GHOST').replace(/\s+/g, ' ').trim();
  }catch(_){ return 'P GHOST'; }
}

function __sqVsShadowGraphLabelForGame(gameConfig){
  try{
    const g = gameConfig || {};
    const rawName = __sqVsShadowCleanSourceName(__sqVsShadowPlayerName(g.sourcePlayerName || g.opponentName || g.playerName || g.name)) || 'Player';
    const isPb = String(g.opponentKind || '').toLowerCase() === 'player_pb' || /\bPB\b/i.test(rawName);
    const initials = __sqVsShadowDmdInitialsForName(rawName);
    return (initials + (isPb ? ' PB' : ' GHOST')).replace(/\s+/g, ' ').trim();
  }catch(_){ return 'P GHOST'; }
}

function __sqVsShadowDisplayLabelForGame(gameConfig, opts){
  try{
    const g = gameConfig || {};
    const forDmd = !!(opts && opts.dmd);
    const forGraph = !!(opts && (opts.graph || opts.race || opts.canvas || opts.compact));
    const rawName = __sqVsShadowCleanSourceName(__sqVsShadowPlayerName(g.sourcePlayerName || g.opponentName || g.playerName || g.name)) || 'Player';
    if (forDmd) return __sqVsShadowDmdLabelForGame(g);
    if (forGraph) return __sqVsShadowGraphLabelForGame(g);
    const marker = __sqVsShadowGhostMarker(forDmd);
    const isPb = String(g.opponentKind || '').toLowerCase() === 'player_pb';
    const pbName = (isPb && !/\bPB\b/i.test(rawName)) ? (rawName + ' PB') : rawName;
    return (pbName + ' ' + marker).trim();
  }catch(_){ return 'Player ' + __sqVsShadowGhostMarker(!!(opts && opts.dmd)); }
}

function __sqVsShadowDisplayLabelForPlayer(player, opts){
  try{
    if (typeof __sqIsShadowPlayer === 'function' && !__sqIsShadowPlayer(player)) return '';
    const forDmd = !!(opts && opts.dmd);
    const forGraph = !!(opts && (opts.graph || opts.race || opts.canvas || opts.compact));
    const shadow = (typeof state !== 'undefined' && state && state.shadow) ? state.shadow : null;
    const games = Array.isArray(shadow && shadow.games) ? shadow.games : [];
    const gameIndex = Math.max(0, Number(shadow && shadow.activeGameIndex) || 0);
    const fromGame = games[gameIndex] ? __sqVsShadowDisplayLabelForGame(games[gameIndex], opts || {}) : '';
    if (fromGame) return fromGame;
    if (forGraph) {
      return String(player.shadowGraphName || '').trim() ||
        __sqVsShadowGraphLabelForGame({ sourcePlayerName: player.shadowSourcePlayerName || player.shadowDisplayName || player.name || 'Player' });
    }
    return String((forDmd ? player.shadowDmdName : player.shadowDisplayName) || player.displayName || player.name || '').trim();
  }catch(_){ return ''; }
}

function __sqVsShadowRuntimePlayer(config){
  const games = (config && Array.isArray(config.games)) ? config.games : [];
  const gameIndex = Math.max(0, Number(config && config.activeGameIndex) || 0);
  const first = games[gameIndex] || games[0] || {};
  const baseName = __sqVsShadowCleanSourceName(__sqVsShadowPlayerName(first.sourcePlayerName || first.opponentName)) || 'Player';
  const displayName = __sqVsShadowDisplayLabelForGame(first, { dmd:false });
  const dmdName = __sqVsShadowDisplayLabelForGame(first, { dmd:true });
  const graphName = __sqVsShadowDisplayLabelForGame(first, { graph:true });
  const sourceId = String(first.sourceGameId || 'shadow').trim() || 'shadow';
  return {
    name: displayName,
    first_name: displayName,
    last_name: '',
    nickname: '',
    initials: '👻',
    displayName,
    fullName: displayName,
    shadowDisplayName: displayName,
    shadowDmdName: dmdName,
    shadowGraphName: graphName,
    shadowSourcePlayerName: baseName,
    color: null,
    type: 'shadow',
    kind: 'shadow',
    id: null,
    player_id: null,
    isShadow: true,
    virtual: true,
    shadow: true,
    shadowId: 'shadow:' + sourceId + ':' + gameIndex
  };
}

function __sqStartPracticeVsShadowFromDraft(overlay){
  if (!__sqIsVsShadowRuntime()) {
    try{ toast('Vs Shadow setup is unavailable.'); }catch(_){ }
    return false;
  }
  try{ __sqClearVsShadowTimers('runtime-start'); }catch(_){ }
  const shadowState = state.shadow || {};
  const draftGames = Array.isArray(shadowState.games) ? shadowState.games : [];
  const ready = draftGames.length > 0 && draftGames.every(g => !!(g && g.replayAvailable && g.sourceGameId && Array.isArray(g.sourceRows) && g.sourceRows.length));
  if (!ready) {
    try{ toast(__SQ_VS_SHADOW_PHASE1_REASON); }catch(_){ }
    return false;
  }

  const realPlayer = Array.isArray(state.players) ? state.players.find(p => !__sqIsShadowPlayer(p)) : null;
  if (!realPlayer) {
    try{ toast('Add 1 real player for Vs Shadow.'); }catch(_){ }
    return false;
  }

  const runtimeConfig = Object.assign({}, shadowState, {
    mode: 'vsShadow',
    version: 2,
    status: 'runtime_phase2d',
    activeGameIndex: 0,
    realPlayerIndex: 0,
    shadowPlayerIndex: 1,
    savePolicy: 'real-only',
    autoTurnEnabled: true,
    completionEnabled: true,
    phase2BCompletionBlocked: false,
    phase2CCompletionBlocked: false,
    blockedReason: __SQ_VS_SHADOW_PHASE2C_REASON,
    completionBlockedReason: '',
    games: draftGames
  });
  const shadowPlayer = __sqVsShadowRuntimePlayer(runtimeConfig);

  state.players = [realPlayer, shadowPlayer];
  state.match = Object.assign({}, state.match || {}, {
    mode: 'practice',
    forcePractice: true,
    practiceType: 'vsShadow',
    gameMode: 'practice',
    gameFormat: undefined,
    gameVariant: undefined,
    wins: Array.from({ length: 2 }, () => 0),
    history: Array.isArray(state.match && state.match.history) ? state.match.history : [],
    completedLogged: false
  });
  state.shadow = runtimeConfig;
  try{ assignUniqueColors(state.players); }catch(_){ }

  try{ if (overlay) overlay.remove(); }catch(_){ }
  try{ document.querySelectorAll('.modal-throworder').forEach(el => el.closest('.modal-backdrop')?.remove()); }catch(_){ }
  try{ startNewGame(true); }catch(e){ console.error('[SQ] Vs Shadow runtime start failed', e); try{ toast('Vs Shadow start failed.'); }catch(_){ } return false; }
  try{ setupStartMenuButtons(); }catch(_){ }
  return true;
}

function __sqGetVsShadowSourceRound(gameIndex, roundIndex){
  try{
    if (!__sqIsVsShadowRuntime()) return null;
    const games = Array.isArray(state.shadow && state.shadow.games) ? state.shadow.games : [];
    const g = games[Math.max(0, Number(gameIndex) || 0)] || null;
    const rows = Array.isArray(g && g.sourceRows) ? g.sourceRows : [];
    const round = rows[Math.max(0, Number(roundIndex) || 0)] || null;
    return round ? __sqDeepCloneForPersist(round) : null;
  }catch(_){ return null; }
}

function __sqNormalizeVsShadowReplayDarts(sourceRound, roundIndex){
  try{
    const roundDef = (typeof ROUNDS !== 'undefined' && ROUNDS[roundIndex]) ? ROUNDS[roundIndex] : {};
    const rawDarts = Array.isArray(sourceRound && sourceRound.darts) ? sourceRound.darts
      : (Array.isArray(sourceRound && sourceRound.throws) ? sourceRound.throws
      : (Array.isArray(sourceRound) ? sourceRound : null));
    if (!Array.isArray(rawDarts) || rawDarts.length !== 3) return null;

    function finiteNumber(v){
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    function rawKind(d){
      return String((d && (d.kind ?? d.type ?? d.multiplier ?? d.mult)) || '').trim();
    }
    function inferFromPoints(points){
      if (points === 0) return { kind:'Miss', points:0 };
      if (roundDef.type === 'number') {
        const t = Number(roundDef.target || 0);
        if (t > 0 && points === t) return { kind:'S', points };
        if (t > 0 && points === t * 2) return { kind:'D', points };
        if (t > 0 && points === t * 3) return { kind:'T', points };
      }
      if (roundDef.type === 'doubles' && points > 0 && points % 2 === 0 && points / 2 >= 1 && points / 2 <= 20) {
        return { kind:'Double', sector:points / 2, points };
      }
      if (roundDef.type === 'triples' && points > 0 && points % 3 === 0 && points / 3 >= 1 && points / 3 <= 20) {
        return { kind:'Triple', sector:points / 3, points };
      }
      if (roundDef.type === 'bull' && (points === 25 || points === 50)) {
        return { kind:'B', bull:points === 50 ? 'Inner' : 'Outer', points };
      }
      return null;
    }
    function pointsFromKind(kind, d){
      const k = String(kind || '').toLowerCase();
      const sector = finiteNumber(d && (d.sector ?? d.segment ?? d.target));
      const bull = String((d && d.bull) || '').toLowerCase();
      if (!k || k === 'miss' || k === 'x') return 0;
      if (k === 'b' || k === 'bull') return bull === 'inner' ? 50 : (bull === 'outer' ? 25 : null);
      if (roundDef.type === 'number') {
        const t = Number(roundDef.target || 0);
        if (!(t > 0)) return null;
        if (k === 's' || k === 'single') return t;
        if (k === 'd' || k === 'double') return t * 2;
        if (k === 't' || k === 'triple' || k === 'treble') return t * 3;
      }
      if ((k === 'double' || k === 'd') && sector >= 1 && sector <= 20) return sector * 2;
      if ((k === 'triple' || k === 'treble' || k === 't') && sector >= 1 && sector <= 20) return sector * 3;
      return null;
    }
    function normalizeOne(raw){
      if (raw == null) return null;
      const obj = (typeof raw === 'object') ? __sqDeepCloneForPersist(raw) : {};
      let points = (typeof raw === 'number' || typeof raw === 'string') ? finiteNumber(raw) : finiteNumber(obj.points ?? obj.pts ?? obj.score ?? obj.value ?? obj.val);
      const kind = rawKind(obj);
      if (points == null && kind) points = pointsFromKind(kind, obj);
      if (points == null) return null;
      let inferred = inferFromPoints(points);
      if (!inferred && kind) {
        const k = kind.toLowerCase();
        if (points === 0 || k === 'miss' || k === 'x') inferred = { kind:'Miss', points:0 };
        else if (k === 'b' || k === 'bull') inferred = { kind:'B', bull:obj.bull || (points === 50 ? 'Inner' : 'Outer'), points };
        else if (k === 'double') inferred = { kind:'Double', sector:obj.sector ?? obj.segment, points };
        else if (k === 'triple' || k === 'treble') inferred = { kind:'Triple', sector:obj.sector ?? obj.segment, points };
        else if (k === 's' || k === 'single') inferred = { kind:'S', points };
        else if (k === 'd') inferred = { kind:'D', points };
        else if (k === 't') inferred = { kind:'T', points };
      }
      if (!inferred || !Number.isFinite(Number(inferred.points))) return null;
      const out = Object.assign({}, obj, inferred, { points:Number(inferred.points) });
      if (out.points === 0) out.kind = 'Miss';
      return out;
    }

    const darts = rawDarts.map(normalizeOne);
    if (darts.some(d => !d)) return null;
    const roundTotal = darts.reduce((sum, d) => sum + (Number(d.points) || 0), 0);
    const explicitTotal = finiteNumber(sourceRound && (sourceRound.roundTotal ?? sourceRound.round_total ?? sourceRound.total ?? sourceRound.points ?? sourceRound.score));
    if (explicitTotal != null && Math.abs(explicitTotal - roundTotal) > 0.001) return null;
    return { darts, roundTotal };
  }catch(_){ return null; }
}

function __sqRecomputeVsShadowShadowTotals(){
  try{
    const idx = Number(state && state.shadow && state.shadow.shadowPlayerIndex);
    if (!Number.isFinite(idx)) return;
    ensureMatchAgg();
    if (typeof recomputeMatchAggHitsForPlayer === 'function') recomputeMatchAggHitsForPlayer(idx);
    if (typeof recomputeMatchAggTotalsForPlayer === 'function') recomputeMatchAggTotalsForPlayer(idx);
  }catch(_){ }
}

function __sqVsShadowAutoTurnStillValid(token, roundIndex){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    if (!state.shadow || state.shadow.autoTurnToken !== token) return false;
    if (state.shadow.autoTurnEnabled !== true) return false;
    if (state.finished || state.gameAwarded) return false;
    if (!__sqVsShadowCurrentPlayerIsShadow()) return false;
    if (Number(state.currentRound) !== Number(roundIndex)) return false;
    return true;
  }catch(_){ return false; }
}

function __sqPauseVsShadowAutoTurn(message){
  try{ __sqClearVsShadowTimers('auto-turn-paused'); }catch(_){ }
  try{
    if (state && state.shadow) {
      state.shadow.autoTurnFailed = true;
      state.shadow.lastBlockedReason = message || __SQ_VS_SHADOW_PHASE2C_REASON;
    }
  }catch(_){ }
  __sqVsShadowBlockPhase2C(message || 'Shadow replay data is unavailable for this round. Vs Shadow is paused.');
}

function __sqHandleVsShadowManualShadowInput(reason){
  try{
    if (!__sqIsVsShadowRuntime() || !__sqVsShadowCurrentPlayerIsShadow()) return false;
    const shadow = state.shadow || {};
    const roundIndex = Number(state.currentRound);
    const shadowIndex = Number(shadow.shadowPlayerIndex);
    const realIndex = Number.isFinite(Number(shadow.realPlayerIndex)) ? Number(shadow.realPlayerIndex) : 0;
    if (!Number.isFinite(roundIndex) || !Number.isFinite(shadowIndex)) return true;

    try{ __sqClearVsShadowTimers('manual-shadow-input:' + (reason || 'input')); }catch(_){ }
    try{ __sqVsShadowClearDmdPreThrowState(); }catch(_){ }

    const gameIndex = Number(shadow.activeGameIndex || 0);
    const sourceRound = __sqGetVsShadowSourceRound(gameIndex, roundIndex);
    const normalized = __sqNormalizeVsShadowReplayDarts(sourceRound, roundIndex);
    const entry = state.score && state.score[shadowIndex] && state.score[shadowIndex][roundIndex];

    if (entry && normalized && Array.isArray(normalized.darts) && normalized.darts.length === 3) {
      entry.darts = normalized.darts.map(d => __sqDeepCloneForPersist(d));
      entry.roundTotal = Number(normalized.roundTotal || 0);
      if (state.shadow) {
        state.shadow.autoTurnPending = false;
        state.shadow.autoTurnInProgress = false;
        state.shadow.autoTurnToken = null;
        state.shadow.lastBlockedReason = '';
      }
      state.currentPlayer = shadowIndex;
      state.currentRound = roundIndex;
      state.currentDart = 3;
      try{ __sqRecomputeVsShadowShadowTotals(); }catch(_){ }
      try{ updateUI(); }catch(_){ }
      try{ __sqAdvanceAfterVsShadowAutoTurn(); }catch(_){ }
      return true;
    }

    try{ if (entry) __sqResetVsShadowShadowRound(roundIndex); }catch(_){ }
    if (state.shadow) {
      state.shadow.autoTurnPending = false;
      state.shadow.autoTurnInProgress = false;
      state.shadow.autoTurnToken = null;
      state.shadow.lastBlockedReason = '';
    }
    state.currentPlayer = realIndex;
    state.currentDart = 0;
    if (roundIndex < ((typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 14) - 1)) {
      state.currentRound = roundIndex + 1;
    } else {
      state.currentRound = roundIndex;
      state.finished = true;
      state.gameAwarded = false;
    }
    try{ updateUI(); }catch(_){ }
    try{
      const realName = (typeof __sqVsShadowRealDmdName === 'function') ? __sqVsShadowRealDmdName(realIndex) : 'Player';
      const infoLines = (typeof __sqVsShadowRealDmdInfoLines === 'function') ? __sqVsShadowRealDmdInfoLines(realIndex) : [];
      window.sqDmdShowZones?.({ z2:realName, z3:'' }, { type:'hold', ms:1 });
      window.__sqDmdStartPreThrow?.(realName, infoLines);
    }catch(_){ }
    return true;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow manual interruption cleanup failed', e); }catch(_){ }
    try{ __sqClearVsShadowTimers('manual-shadow-input-error'); }catch(_){ }
    return true;
  }
}

function __sqVsShadowDmdRoundLabel(roundDef, roundIndex){
  try{
    if (roundDef && roundDef.type === 'number') return String(roundDef.target || '');
    if (roundDef && roundDef.type === 'doubles') return 'DBL';
    if (roundDef && roundDef.type === 'triples') return 'TRB';
    if (roundDef && roundDef.type === 'bull') return 'BULL';
    return String((Number(roundIndex) || 0) + 1);
  }catch(_){ return String((Number(roundIndex) || 0) + 1); }
}

function __sqVsShadowDmdTokenForDart(dart, roundDef){
  try{
    if (!dart) return '';
    const kind = String(dart.kind || dart.type || '').trim();
    const points = Number(dart.points ?? dart.pts ?? dart.score ?? 0);
    if (/^Miss$/i.test(kind) || points === 0) return 'X';
    if (/^B$/i.test(kind) || dart.bull) return dart.bull === 'Inner' ? 'B50' : 'B25';
    if (roundDef && roundDef.type === 'number') {
      const n = Number(roundDef.target || 0);
      if (n > 0) {
        if (points === n * 3) return 'T' + n;
        if (points === n * 2) return 'D' + n;
        if (points === n) return 'S' + n;
      }
    }
    if (roundDef && roundDef.type === 'doubles') {
      const s = Number(dart.sector || dart.segment || 0);
      return s ? ('D' + s) : (points > 0 ? 'D' : 'X');
    }
    if (roundDef && roundDef.type === 'triples') {
      const s = Number(dart.sector || dart.segment || 0);
      return s ? ('T' + s) : (points > 0 ? 'T' : 'X');
    }
    if (roundDef && roundDef.type === 'bull') return dart.bull === 'Inner' ? 'B50' : 'B25';
    if (/^(Triple|T)$/i.test(kind)) return ('T' + (dart.sector || dart.segment || '')).trim();
    if (/^(Double|D)$/i.test(kind)) return ('D' + (dart.sector || dart.segment || '')).trim();
    if (/^(Single|S)$/i.test(kind)) return ('S' + (dart.sector || dart.segment || '')).trim();
    return kind.toUpperCase();
  }catch(_){ return ''; }
}

function __sqVsShadowDmdKindForDart(dart){
  try{
    if (!dart) return '';
    const k = String(dart.kind || dart.type || '').trim();
    const p = Number(dart.points ?? dart.pts ?? dart.score ?? 0);
    if (/^Miss$/i.test(k) || p === 0) return 'Miss';
    if (/^(Triple|Treble|T)$/i.test(k)) return 'T';
    if (/^(Double|D)$/i.test(k)) return 'D';
    if (/^(Single|S)$/i.test(k)) return 'S';
    if (/^B$/i.test(k) || dart.bull) return 'B';
    return k;
  }catch(_){ return ''; }
}

function __sqVsShadowInputKindForDart(dart, roundDef){
  try{
    if (!dart) return '';
    const kind = String(dart.kind || dart.type || '').trim();
    const points = Number(dart.points ?? dart.pts ?? dart.score ?? 0);
    if (/^Miss$/i.test(kind) || points === 0) return 'miss';
    if (/^B$/i.test(kind) || dart.bull) return 'bull';
    if (roundDef && roundDef.type === 'number') {
      const n = Number(roundDef.target || 0);
      if (n > 0) {
        if (points === n * 3) return 'triple';
        if (points === n * 2) return 'double';
        if (points === n) return 'single';
      }
    }
    if (roundDef && roundDef.type === 'doubles') return 'double';
    if (roundDef && roundDef.type === 'triples') return 'triple';
    if (roundDef && roundDef.type === 'bull') return 'bull';
    if (/^(Triple|Treble|T)$/i.test(kind)) return 'triple';
    if (/^(Double|D)$/i.test(kind)) return 'double';
    if (/^(Single|S)$/i.test(kind)) return 'single';
    return '';
  }catch(_){ return ''; }
}

function __sqVsShadowVisiblePadButtons(selector){
  try{
    const root = document.getElementById('pad') || document;
    return Array.from(root.querySelectorAll(selector)).filter(btn => {
      try{
        const rect = btn.getBoundingClientRect();
        const css = window.getComputedStyle ? window.getComputedStyle(btn) : null;
        return rect.width > 0 && rect.height > 0 && (!css || (css.display !== 'none' && css.visibility !== 'hidden'));
      }catch(_){ return true; }
    });
  }catch(_){ return []; }
}

function __sqFindVsShadowInputButtonForDart(dart, kind){
  try{
    const clean = v => String(v || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (kind === 'miss') {
      return __sqVsShadowVisiblePadButtons('.dtActBtn.miss')[0] ||
        __sqVsShadowVisiblePadButtons('.dtX3')[0] ||
        null;
    }
    if (kind === 'single' || kind === 'double' || kind === 'triple') {
      const letter = kind === 'single' ? 'S' : (kind === 'double' ? 'D' : 'T');
      const direct = __sqVsShadowVisiblePadButtons('.dtBullBtn')
        .find(btn => clean(btn.textContent) === letter);
      if (direct) return direct;

      const sector = Number(dart && (dart.sector ?? dart.segment ?? dart.target) || 0);
      if (sector > 0) {
        const sectorBtn = __sqVsShadowVisiblePadButtons('.dtNumBtn')
          .find(btn => clean(btn.textContent) === String(sector));
        if (sectorBtn) return sectorBtn;
      }
    }
    if (kind === 'bull') {
      const bullText = /inner/i.test(String(dart && dart.bull || '')) ? 'INNER' : (/outer/i.test(String(dart && dart.bull || '')) ? 'OUTER' : '');
      const buttons = __sqVsShadowVisiblePadButtons('.dtBullBtn');
      return buttons.find(btn => bullText && clean(btn.textContent).indexOf(bullText) >= 0) ||
        buttons.find(btn => clean(btn.textContent).indexOf('BULL') >= 0) ||
        null;
    }
    return null;
  }catch(_){ return null; }
}

function __sqPulseVsShadowInputButton(btn, classes, ms){
  try{
    if (!btn || !btn.classList) return false;
    const all = [
      'sq-padfx-shadow-hit',
      'sq-padfx-shadow-single',
      'sq-padfx-shadow-double',
      'sq-padfx-shadow-triple',
      'sq-padfx-shadow-bull',
      'sq-padfx-shadow-miss',
      'sq-padfx-miss'
    ];
    all.forEach(cls => btn.classList.remove(cls));
    void btn.offsetWidth;
    (classes || []).forEach(cls => { if (cls) btn.classList.add(cls); });
    try{ btn.dataset.sqVsShadowFx = '1'; }catch(_){ }
    setTimeout(() => {
      try{
        all.forEach(cls => btn.classList.remove(cls));
        delete btn.dataset.sqVsShadowFx;
      }catch(_){ }
    }, Number(ms || 680));
    return true;
  }catch(_){ return false; }
}

function __sqFlashVsShadowInputButton(dart, roundIndex){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    const roundDef = (typeof ROUNDS !== 'undefined' && ROUNDS[roundIndex]) ? ROUNDS[roundIndex] : {};
    const kind = __sqVsShadowInputKindForDart(dart, roundDef);
    if (!kind) return false;
    const btn = __sqFindVsShadowInputButtonForDart(dart, kind);
    if (!btn) return false;
    if (kind === 'miss') {
      return __sqPulseVsShadowInputButton(btn, ['sq-padfx-miss', 'sq-padfx-shadow-miss'], 520);
    }
    return __sqPulseVsShadowInputButton(btn, ['sq-padfx-shadow-hit', 'sq-padfx-shadow-' + kind], 680);
  }catch(_){ return false; }
}

function __sqVsShadowQueueDmdPhrase(phrase, opts){
  try{
    if (!window.sqDmdShowZones) return false;
    const words = String(phrase || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    const o = opts || {};
    const stepMs = Number(o.stepMs || 340);
    const finalHoldMs = stepMs + 500;
    const restoreZ2 = String(o.restoreZ2 ?? '');
    const restoreZ3 = String(o.restoreZ3 ?? '');

    if (o.imageType) {
      window.sqDmdShowZones({ z2:'', z3:'' }, { type:o.imageType, ms:Number(o.imageMs || 900), amp:Number(o.amp || 3.0) });
    }
    if (o.wholePhrase) {
      window.sqDmdShowZones({ z2:String(phrase || '').toUpperCase(), z3:'' }, { type:'flash', ms:Number(o.phraseMs || finalHoldMs), fx:'impact' });
    } else if (words.length === 1) {
      window.sqDmdShowZones({ z2:words[0], z3:'' }, { type:'flash', ms:finalHoldMs, fx:'impact' });
    } else if (words.length === 2) {
      window.sqDmdShowZones({ z2:words[0], z3:'' }, { type:'flash', ms:stepMs, fx:'impact' });
      window.sqDmdShowZones({ z2:words[0], z3:words[1] }, { type:'flash', ms:finalHoldMs, fx:'impact' });
    } else {
      window.sqDmdShowZones({ z2:words[0], z3:'' }, { type:'flash', ms:stepMs, fx:'impact' });
      window.sqDmdShowZones({ z2:words.slice(0, -1).join(' '), z3:'' }, { type:'flash', ms:stepMs, fx:'impact' });
      window.sqDmdShowZones({ z2:words.slice(0, -1).join(' '), z3:words[words.length - 1] }, { type:'flash', ms:finalHoldMs, fx:'impact' });
    }
    if (o.afterType) window.sqDmdShowZones({ z2:'', z3:'' }, { type:o.afterType, ms:Number(o.afterMs || 1000), amp:Number(o.afterAmp || 0) });
    window.sqDmdShowZones({ z2:restoreZ2, z3:restoreZ3 }, { type:'hold', ms:1 });
    return true;
  }catch(_){ return false; }
}

function __sqVsShadowDmdCalloutForDart(dart, dartIndex, entry, roundDef){
  try{
    const kind = String((dart && (dart.kind || dart.type)) || '').trim();
    const points = Number(dart && (dart.points ?? dart.pts ?? dart.score) || 0);
    const prior = Array.isArray(entry && entry.darts) ? entry.darts.slice(0, Math.max(0, Number(dartIndex) || 0)) : [];
    const kindFor = __sqVsShadowDmdKindForDart;
    const turnKinds = prior.concat([dart]).map(kindFor);
    const scoringKinds = turnKinds.filter(k => k && k !== 'Miss');
    const hasS = scoringKinds.includes('S'), hasD = scoringKinds.includes('D'), hasT = scoringKinds.includes('T');
    const hasMiss = turnKinds.includes('Miss');
    const isFinalDart = Number(dartIndex) === 2;
    const priorKinds = prior.map(kindFor);
    const thirdMissAfterTwoTriples = isFinalDart && (kind === 'Miss' || points === 0) && priorKinds[0] === 'T' && priorKinds[1] === 'T';
    const thirdMissAfterTwoDoubles = isFinalDart && (kind === 'Miss' || points === 0) && priorKinds[0] === 'D' && priorKinds[1] === 'D';
    const thirdIsScoringAfterTwoMisses = isFinalDart && kind !== 'Miss' && points > 0 && priorKinds[0] === 'Miss' && priorKinds[1] === 'Miss';
    const lastDartHeroImageHit = thirdIsScoringAfterTwoMisses && (kind === 'Double' || kind === 'D' || kind === 'Triple' || kind === 'T' || kind === 'B');
    const isDesmondDelight = isFinalDart && turnKinds.filter(k => k === 'S').length === 2 && turnKinds.filter(k => k === 'D').length === 1 && !hasT && !hasMiss;
    const roundTotalNow = prior.concat([dart]).reduce((sum,d)=>sum + Number(d && (d.points ?? d.pts ?? d.score) || 0), 0);
    const distinctKinds = Array.from(new Set(scoringKinds));
    const isDirtyTurn = isFinalDart && roundTotalNow > 0 && roundTotalNow <= 30 && !(hasS && hasD && hasT) && !isDesmondDelight && distinctKinds.length >= 2;
    const isDoublesRound = roundDef && roundDef.type === 'doubles';
    const isTriplesRound = roundDef && roundDef.type === 'triples';
    const sector = Number(dart && (dart.sector ?? dart.segment ?? dart.target) || 0);
    const voldyHit = sector >= 1 && sector <= 5 && ((isDoublesRound && (kind === 'Double' || kind === 'D')) || (isTriplesRound && (kind === 'Triple' || kind === 'T')));

    if (thirdMissAfterTwoTriples || thirdMissAfterTwoDoubles) return { z2:'AWKWARD', fx:{ type:'shake', amp:3.0, ms:900, fx:'impact' } };
    if (isDesmondDelight) return { phrase:'DESMOND DELIGHT', phraseOpts:{ imageType:'desmondImg', imageMs:950, amp:3.6, stepMs:280 }, queueOnly:true };
    if (isFinalDart && hasS && hasD && hasT) return { phrase:'SHANGHAI', phraseOpts:{ stepMs:320 }, queueOnly:true };
    if (thirdIsScoringAfterTwoMisses) return { phrase:'LAST DART HERO', phraseOpts:lastDartHeroImageHit ? { imageType:'lastDartImg', imageMs:900, amp:3.4, stepMs:260 } : { stepMs:260 }, queueOnly:true };
    if (voldyHit) return { phrase:'HAHA HA HAHAA!', phraseOpts:{ imageType:'voldyImg', imageMs:900, amp:2.8, stepMs:300 }, queueOnly:true };
    if (kind === 'Miss' || points === 0) return isFinalDart && roundTotalNow === 0 ? { z2:'SCRATCH', fx:{ type:'flash', ms:760, fx:'smear' } } : { z2:'MISS', fx:{ type:'flash', ms:650, fx:'smear' } };
    if (kind === 'B') return dart.bull === 'Inner'
      ? { phrase:'BULLSEYE', phraseOpts:{ wholePhrase:true, phraseMs:700, afterType:'bullseyeHit', afterMs:1100 }, queueOnly:true }
      : { z2:'OUTER!', fx:{ type:'shake', amp:2.0, ms:760, fx:'impact' } };
    if (kind === 'Triple' || kind === 'T') {
      const count = turnKinds.filter(k => k === 'T').length;
      if (count === 1) return { z2:'TREBLE!', fx:{ type:'shake', amp:2.3, ms:850, fx:'impact' } };
      if (count === 2 && Number(dartIndex) === 1) return { z2:'CAN HE......?', fx:{ type:'anticipationEyes', ms:1150, fx:'impact' } };
      if (count === 2 && isFinalDart) return { beats:['TWO TREBLES','NICE FINISH'], queueOnly:true };
      return { phrase:'MAXI MAYHEM!', phraseOpts:{ stepMs:250 }, queueOnly:true };
    }
    if (kind === 'Double' || kind === 'D') {
      const count = turnKinds.filter(k => k === 'D').length;
      if (count === 1) return { z2:'DOUBLE!', fx:{ type:'flash', ms:800, fx:'impact' } };
      if (count === 2 && Number(dartIndex) === 1) return { z2:'HOLD UP....', fx:{ type:'anticipationEyes', ms:1150, fx:'impact' } };
      if (count === 2 && isFinalDart) return { z2:'TWO DOUBLES!', fx:{ type:'flash', ms:850, fx:'impact' } };
      return { phrase:'GET IN THE SEA!!', phraseOpts:{ wholePhrase:true, phraseMs:760, afterType:'dolphinSwim', afterMs:2000 }, queueOnly:true };
    }
    if (isDirtyTurn) return { phrase:'UGLY BUT IT COUNTS', phraseOpts:{ stepMs:250 }, queueOnly:true };
    if (isFinalDart && turnKinds.filter(k => k === 'S').length >= 3) {
      const pool = ['STEADY HAND','DOING THE BASICS','SLOW AND STEADY','MAKING BANK','EASY MONEY','BASIC BITCH'];
      const key = `vs:${Number(state?.currentPlayer || 0)}`;
      let pickIndex = Math.abs((Number(state?.currentPlayer || 0) + Number(dartIndex || 0) + roundTotalNow)) % pool.length;
      const lastMap = window.__sqDmdLastSinglePhraseByPlayer || (window.__sqDmdLastSinglePhraseByPlayer = Object.create(null));
      if (lastMap[key] === pool[pickIndex]) pickIndex = (pickIndex + 1) % pool.length;
      lastMap[key] = pool[pickIndex];
      return { phrase:pool[pickIndex], phraseOpts:{ stepMs:250 }, queueOnly:true };
    }
    return { z2:'SINGLE', fx:{ type:'wipe', ms:650, fx:'smear' } };
  }catch(_){ return { z2:'', fx:{ type:'hold', ms:1 } }; }
}

function __sqShowVsShadowDartFeedback(dart, dartIndex, roundIndex, entry){
  try{
    if (!window.sqDmdShowZones) return;
    const roundDef = (typeof ROUNDS !== 'undefined' && ROUNDS[roundIndex]) ? ROUNDS[roundIndex] : {};
    const z1 = 'ROUND\n' + __sqVsShadowDmdRoundLabel(roundDef, roundIndex);
    const seq = (entry && Array.isArray(entry.darts) ? entry.darts : [])
      .slice(0, Math.min(3, Math.max(0, Number(dartIndex) + 1)))
      .map(d => __sqVsShadowDmdTokenForDart(d, roundDef))
      .filter(Boolean)
      .join(' / ');
    const callout = __sqVsShadowDmdCalloutForDart(dart, dartIndex, entry, roundDef);
    if (callout && Array.isArray(callout.beats) && callout.beats.length >= 2) {
      window.sqDmdShowZones({ z2:String(callout.beats[0] || '').toUpperCase(), z3:'' }, { type:'flash', ms:620, fx:'impact' });
      window.sqDmdShowZones({ z2:String(callout.beats[1] || '').toUpperCase(), z3:'' }, { type:'flash', ms:720, fx:'impact' });
      window.sqDmdShowZones({ z2:'', z3:seq }, { type:'hold', ms:1 });
      return;
    }
    if (callout && callout.phrase) {
      const queued = __sqVsShadowQueueDmdPhrase(callout.phrase, Object.assign({ restoreZ2:'', restoreZ3:seq }, callout.phraseOpts || {}));
      if (queued && callout.queueOnly) return;
    }
    window.sqDmdShowZones({ z1, z2:(callout && callout.z2) || 'SINGLE', z3:seq }, (callout && callout.fx) || { type:'flash', ms:650, fx:'impact' });
  }catch(_){ }
}

function __sqShowVsShadowDartDmd(dartIndex, roundIndex, entry, dart){
  return __sqShowVsShadowDartFeedback(dart, dartIndex, roundIndex, entry);
}

function __sqVsShadowClearDmdPreThrowState(){
  try{ window.__sqDmdStopPreThrow?.(); }catch(_){ }
  try{ window.__sqDmdPinnedZ2Text = ''; }catch(_){ }
  try{ window.__sqDmdNoScrollZ2 = false; }catch(_){ }
  try{ window.__sqDmdZ3Small = false; }catch(_){ }
}

function __sqVsShadowRealDmdName(realIndex){
  try{
    const p = state && state.players ? state.players[realIndex] : null;
    return String((p && (p.name || p.fullName || p.full || p.nickname || p.code || p.initials)) || 'Player').trim() || 'Player';
  }catch(_){ return 'Player'; }
}

function __sqVsShadowRealDmdInfoLines(realIndex){
  try{
    const players = Array.isArray(state && state.players) ? state.players : [];
    const pCount = Math.max(1, players.length || 1);
    let total = 0;
    let dartsThrown = 0;
    for (let r = 0; r < (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 14); r++) {
      const entry = state.score && state.score[realIndex] && state.score[realIndex][r];
      if (!entry) continue;
      total += Number(entry.roundTotal || 0) || 0;
      const darts = Array.isArray(entry.darts) ? entry.darts : [];
      darts.forEach(d => { if (d) dartsThrown++; });
    }
    const totals = players.map((_, i) => {
      let t = 0;
      for (let r = 0; r < (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 14); r++) {
        t += Number(state.score && state.score[i] && state.score[i][r] && state.score[i][r].roundTotal || 0) || 0;
      }
      return t;
    });
    const ordered = totals.map((v, i) => ({ i, v })).sort((a,b) => (b.v - a.v) || (a.i - b.i));
    const pos = Math.max(1, ordered.findIndex(x => x.i === realIndex) + 1);
    const avg = dartsThrown ? (total * 3 / dartsThrown) : 0;
    const avgTxt = (Math.round(avg * 10) / 10).toFixed(1);
    return (typeof window.__sqDmdBuildPreThrowInfo === 'function') ? window.__sqDmdBuildPreThrowInfo(realIndex) : ['SCORE: ' + total + '  PB: —', 'POS: ' + pos + '/' + pCount];
  }catch(_){ return []; }
}

function __sqShowVsShadowAfterTurnDmd(roundIndex, roundTotal, realIndex){
  try{
    if (!window.sqDmdShowZones) return;
    try{ __sqVsShadowClearDmdPreThrowState(); }catch(_){ }
    window.sqDmdShowZones({ z2:'ROUND SCORE', z3:String(Number(roundTotal || 0)), z3Small:true, type:'roll' }, { type:'flash', ms:650, fx:'impact' });
    const realName = __sqVsShadowRealDmdName(realIndex);
    const infoLines = __sqVsShadowRealDmdInfoLines(realIndex);
    const id = setTimeout(() => {
      try{
        if (!__sqIsVsShadowRuntime()) return;
        if (Number(state && state.currentPlayer) !== Number(realIndex)) return;
        if (Number(state && state.currentDart) !== 0) return;
        try{ __sqVsShadowClearDmdPreThrowState(); }catch(_){ }
        window.sqDmdShowZones?.({ z2:realName, z3:'' }, { type:'hold', ms:1 });
        try{ window.__sqDmdStartPreThrow?.(realName, infoLines); }catch(_){ }
      }catch(_){ }
    }, 850);
    (window.__sqVsShadowTimers || (window.__sqVsShadowTimers = [])).push(id);
  }catch(_){ }
}

function __sqApplyVsShadowDart(dartIndex, dartValue, roundIndex){
  try{
    const shadowIndex = Number(state && state.shadow && state.shadow.shadowPlayerIndex);
    if (!Number.isFinite(shadowIndex)) return false;
    const entry = state.score && state.score[shadowIndex] && state.score[shadowIndex][roundIndex];
    if (!entry || !Array.isArray(entry.darts)) return false;
    const dart = __sqDeepCloneForPersist(dartValue);
    if (!dart || !Number.isFinite(Number(dart.points))) return false;
    entry.darts[dartIndex] = dart;
    entry.roundTotal = (entry.darts || []).reduce((sum, d) => sum + (Number(d && d.points) || 0), 0);
    state.currentDart = Math.min(3, Math.max(0, Number(dartIndex) + 1));
    try{ if (state.uiLastGo && state.uiLastGo.player !== shadowIndex) state.uiLastGo = null; }catch(_){ }
    try{ __sqRecomputeVsShadowShadowTotals(); }catch(_){ }
    try{ updateUI(); }catch(_){ }
    try{ __sqFlashVsShadowInputButton(dart, roundIndex); }catch(_){ }
    try{ __sqShowVsShadowDartFeedback(dart, dartIndex, roundIndex, entry); }catch(_){ }
    return true;
  }catch(_){ return false; }
}

function __sqAdvanceAfterVsShadowAutoTurn(){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    const shadow = state.shadow || {};
    const shadowIndex = Number(shadow.shadowPlayerIndex);
    const realIndex = Number.isFinite(Number(shadow.realPlayerIndex)) ? Number(shadow.realPlayerIndex) : 0;
    const roundIndex = Number(state.currentRound);
    if (!Number.isFinite(shadowIndex) || !Number.isFinite(roundIndex)) return false;
    const entry = state.score && state.score[shadowIndex] && state.score[shadowIndex][roundIndex];
    const darts = entry && Array.isArray(entry.darts) ? entry.darts.slice(0, 3) : [];
    if (darts.length !== 3 || darts.some(d => !d || !Number.isFinite(Number(d.points)))) {
      __sqPauseVsShadowAutoTurn('Shadow replay did not complete cleanly. Vs Shadow is paused.');
      return false;
    }
    const gameIndex = Number(shadow.activeGameIndex || 0);
    const sourceGameId = String((shadow.games && shadow.games[gameIndex] && shadow.games[gameIndex].sourceGameId) || '');
    state.history.push({
      type:'shadowAutoTurn',
      player:shadowIndex,
      round:roundIndex,
      darts:__sqDeepCloneForPersist(darts),
      roundTotal:Number(entry.roundTotal || 0),
      sourceGameId
    });
    shadow.autoTurnPending = false;
    shadow.autoTurnInProgress = false;
    shadow.autoTurnToken = null;
    shadow.lastCompletedRound = roundIndex;
    shadow.lastBlockedReason = '';
    state.currentPlayer = realIndex;
    state.currentDart = 0;
    if (roundIndex < ((typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 14) - 1)) {
      state.currentRound = roundIndex + 1;
    } else {
      state.currentRound = roundIndex;
      state.finished = true;
      state.gameAwarded = false;
      shadow.visualCompleteBlocked = false;
      shadow.completionReady = true;
      shadow.lastBlockedReason = '';
    }
    try{ updateUI(); }catch(_){ }
    try{ __sqShowVsShadowAfterTurnDmd(roundIndex, Number(entry.roundTotal || 0), realIndex); }catch(_){ }
    if (state.finished) {
      const id = setTimeout(() => {
        try{
          if (!__sqIsVsShadowRuntime() || !state.finished || state.gameAwarded) return;
          if (typeof openGameCompleteDialog === 'function') openGameCompleteDialog();
        }catch(_){ }
      }, 1100);
      (window.__sqVsShadowTimers || (window.__sqVsShadowTimers = [])).push(id);
    }
    return true;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow advance failed', e); }catch(_){ }
    __sqPauseVsShadowAutoTurn('Shadow replay failed. Vs Shadow is paused.');
    return false;
  }
}

function __sqApplyVsShadowAutoTurn(roundIndex){
  try{
    const shadow = state.shadow || {};
    const token = shadow.autoTurnToken;
    if (!__sqVsShadowAutoTurnStillValid(token, roundIndex)) return false;
    const gameIndex = Number(shadow.activeGameIndex || 0);
    const sourceRound = __sqGetVsShadowSourceRound(gameIndex, roundIndex);
    const normalized = __sqNormalizeVsShadowReplayDarts(sourceRound, roundIndex);
    if (!normalized || !Array.isArray(normalized.darts) || normalized.darts.length !== 3) {
      __sqPauseVsShadowAutoTurn('Shadow replay data is missing for this round. Vs Shadow is paused.');
      return false;
    }
    shadow.autoTurnPending = false;
    shadow.autoTurnInProgress = true;
    shadow.autoTurnFailed = false;
    state.currentDart = 0;
    try{ window.__sqDmdStopPreThrow?.(); }catch(_){ }
    try{ updateUI(); }catch(_){ }
    [0, 1, 2].forEach((dartIndex) => {
      const id = setTimeout(() => {
        if (!__sqVsShadowAutoTurnStillValid(token, roundIndex)) return;
        if (!__sqApplyVsShadowDart(dartIndex, normalized.darts[dartIndex], roundIndex)) {
          __sqPauseVsShadowAutoTurn('Shadow replay dart could not be applied. Vs Shadow is paused.');
        }
      }, dartIndex * __SQ_VS_SHADOW_DART_STAGGER_MS);
      (window.__sqVsShadowTimers || (window.__sqVsShadowTimers = [])).push(id);
    });
    const advanceId = setTimeout(() => {
      if (!__sqVsShadowAutoTurnStillValid(token, roundIndex)) return;
      __sqAdvanceAfterVsShadowAutoTurn();
    }, (2 * __SQ_VS_SHADOW_DART_STAGGER_MS) + __SQ_VS_SHADOW_POST_DART_ADVANCE_MS);
    (window.__sqVsShadowTimers || (window.__sqVsShadowTimers = [])).push(advanceId);
    return true;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow auto-turn failed', e); }catch(_){ }
    __sqPauseVsShadowAutoTurn('Shadow replay failed. Vs Shadow is paused.');
    return false;
  }
}

function __sqScheduleVsShadowAutoTurn(roundIndex){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    const shadow = state.shadow || {};
    if (shadow.autoTurnEnabled !== true) return false;
    if (!__sqVsShadowCurrentPlayerIsShadow()) return false;
    if (state.currentDart !== 0 || Number(state.currentRound) !== Number(roundIndex) || state.finished || state.gameAwarded) return false;
    if (shadow.autoTurnPending || shadow.autoTurnInProgress) return false;
    const gameIndex = Number(shadow.activeGameIndex || 0);
    const game = Array.isArray(shadow.games) ? shadow.games[gameIndex] : null;
    const token = [state.__gameToken || 0, gameIndex, roundIndex, game && game.sourceGameId || 'source'].join(':');
    __sqClearVsShadowTimers('schedule-new');
    state.shadow.autoTurnToken = token;
    state.shadow.autoTurnPending = true;
    state.shadow.autoTurnInProgress = false;
    state.shadow.autoTurnFailed = false;
    try{ updateUI(); }catch(_){ }
    const id = setTimeout(() => {
      if (!__sqVsShadowAutoTurnStillValid(token, roundIndex)) return;
      __sqApplyVsShadowAutoTurn(roundIndex);
    }, __SQ_VS_SHADOW_PRE_THROW_DELAY_MS);
    (window.__sqVsShadowTimers || (window.__sqVsShadowTimers = [])).push(id);
    return true;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow schedule failed', e); }catch(_){ }
    __sqPauseVsShadowAutoTurn('Shadow replay could not be scheduled. Vs Shadow is paused.');
    return false;
  }
}

function __sqRealPlayerIndexes(players){
  try{
    const list = Array.isArray(players) ? players : [];
    const out = [];
    list.forEach((p, i) => { if (!__sqIsShadowPlayer(p)) out.push(i); });
    return out;
  }catch(_){ return []; }
}

function __sqRealPlayersOnly(players){
  try{
    const list = Array.isArray(players) ? players : [];
    return __sqRealPlayerIndexes(list).map(i => list[i]);
  }catch(_){ return []; }
}

function __sqRealOnlyArray(values, players){
  try{
    const arr = Array.isArray(values) ? values : [];
    const realIndexes = __sqRealPlayerIndexes(players);
    const playerCount = Array.isArray(players) ? players.length : 0;
    if (arr.length === realIndexes.length && arr.length !== playerCount) return arr.slice();
    return realIndexes.map(i => arr[i]);
  }catch(_){ return []; }
}

function __sqRealOnlyTotals(totals, players){
  try{
    return __sqRealOnlyArray(totals, players).map(v => Number(v) || 0);
  }catch(_){ return []; }
}

function __sqDeepCloneForPersist(value){
  try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
}

function __sqRealOnlyBoard(board, players){
  try{
    if (!Array.isArray(board)) return [];
    const realIndexes = __sqRealPlayerIndexes(players);
    if (!realIndexes.length) return [];
    const playerCount = Array.isArray(players) ? players.length : 0;
    const maxRounds = (typeof MAX_ROUNDS === 'number' && MAX_ROUNDS > 0) ? MAX_ROUNDS : 14;
    const looksRoundFirst = board.length === maxRounds && Array.isArray(board[0]) && board[0].length === playerCount;

    if (looksRoundFirst) {
      return board.map(round => {
        if (!Array.isArray(round)) return round;
        return realIndexes.map(i => __sqDeepCloneForPersist(round[i]));
      });
    }

    return realIndexes.map(i => __sqDeepCloneForPersist(board[i]));
  }catch(_){ return []; }
}

function __sqRealOnlyWinnerIndexes(winners, players){
  try{
    const realIndexes = __sqRealPlayerIndexes(players);
    const remap = new Map(realIndexes.map((original, compact) => [original, compact]));
    return (Array.isArray(winners) ? winners : [])
      .filter(i => remap.has(i))
      .map(i => remap.get(i));
  }catch(_){ return []; }
}

function __sqRealOnlyMatchHistory(history, players){
  try{
    const rows = Array.isArray(history) ? history : [];
    return rows.map(g => {
      const copy = Object.assign({}, g || {});
      if (Array.isArray(copy.totals)) copy.totals = __sqRealOnlyTotals(copy.totals, players);
      if (Array.isArray(copy.board)) copy.board = __sqRealOnlyBoard(copy.board, players);
      return copy;
    });
  }catch(_){ return []; }
}

function __sqAssertNoShadowPersistPayload(payload, context){
  try{
    if (typeof __sqIsVsShadowRuntime === 'function' && !__sqIsVsShadowRuntime()) return true;
    const text = JSON.stringify(payload || {});
    const forbidden = [
      /"isShadow"\s*:/i,
      /"virtual"\s*:/i,
      /"shadowId"\s*:/i,
      /"shadow"\s*:/i,
      /shadow:/i,
      /\bGHOST\b/i,
      /👻/,
      /sourceGameId/i,
      /sourceScore/i,
      /sourceRows/i,
      /opponentName/i,
      /opponentKind/i
    ];
    const hit = forbidden.find(re => re.test(text));
    if (!hit) return true;
    const msg = 'Vs Shadow save blocked: Shadow data cannot be persisted.';
    try{ if (typeof toast === 'function') toast(msg); }catch(_){ }
    try{ console.warn('[SQ] ' + msg, { context: context || '', pattern: String(hit), payload }); }catch(_){ }
    return false;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow save assertion failed closed', e); }catch(_){ }
    try{ if (typeof toast === 'function') toast('Vs Shadow save blocked: payload could not be verified.'); }catch(_){ }
    return false;
  }
}

function __sqRefreshVsShadowRuntimePlayerForGame(gameIndex){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    const shadow = state.shadow || {};
    const games = Array.isArray(shadow.games) ? shadow.games : [];
    const idx = Math.max(0, Number(gameIndex) || 0);
    const cfg = games[idx] || null;
    if (!cfg || !cfg.replayAvailable || !Array.isArray(cfg.sourceRows) || !cfg.sourceRows.length) return false;
    state.shadow = Object.assign({}, shadow, {
      status: 'runtime_phase2d',
      activeGameIndex: idx,
      autoTurnPending: false,
      autoTurnInProgress: false,
      autoTurnToken: null,
      autoTurnFailed: false,
      autoTurnEnabled: true,
      completionEnabled: true,
      savePolicy: 'real-only',
      visualCompleteBlocked: false,
      completionReady: false,
      lastBlockedReason: ''
    });
    const existing = state.players && state.players[1] ? state.players[1] : {};
    const next = __sqVsShadowRuntimePlayer(state.shadow);
    next.color = existing.color || next.color || null;
    state.players[1] = Object.assign({}, existing, next);
    return true;
  }catch(_){ return false; }
}

function __sqUndoVsShadowCompletedAutoTurn(){
  try{
    if (!__sqIsVsShadowRuntime()) return false;
    if (state.gameAwarded || state.__sqPracticeSavedToGames || state.__sqPracticeCloudSavedV2 || state.__sqPracticeSavedKeyV2) {
      try{ toast('Vs Shadow undo is locked after save.'); }catch(_){ }
      return true;
    }
    const history = Array.isArray(state.history) ? state.history : [];
    const marker = history[history.length - 1];
    if (!marker || marker.type !== 'shadowAutoTurn') return false;
    const shadow = state.shadow || {};
    const round = Number(marker.round);
    const realIndex = Number.isFinite(Number(shadow.realPlayerIndex)) ? Number(shadow.realPlayerIndex) : 0;
    const shadowIndex = Number.isFinite(Number(shadow.shadowPlayerIndex)) ? Number(shadow.shadowPlayerIndex) : 1;
    let realHistoryIndex = -1;
    for (let i = history.length - 2; i >= 0; i--) {
      const h = history[i];
      if (!h || h.type === 'shadowAutoTurn') continue;
      if (Number(h.player) === realIndex && Number(h.round) === round && Number(h.dartIndex) === 2) {
        realHistoryIndex = i;
        break;
      }
    }
    if (realHistoryIndex < 0) {
      try{ toast('Vs Shadow undo could not find the paired real dart.'); }catch(_){ }
      return true;
    }

    try{ __sqClearVsShadowTimers('undo-completed-shadow-turn'); }catch(_){ }
    history.pop();
    const realThrow = history.splice(realHistoryIndex, 1)[0];

    const shadowEntry = state.score && state.score[shadowIndex] && state.score[shadowIndex][round];
    if (shadowEntry) {
      shadowEntry.darts = [null, null, null];
      shadowEntry.roundTotal = 0;
    }

    const realEntry = state.score && state.score[realIndex] && state.score[realIndex][round];
    if (realEntry && Array.isArray(realEntry.darts)) {
      realEntry.darts[2] = null;
      realEntry.roundTotal = realEntry.darts.reduce((sum, d) => sum + (Number(d && d.points) || 0), 0);
    }

    state.currentPlayer = realIndex;
    state.currentRound = round;
    state.currentDart = 2;
    state.finished = false;
    state.gameAwarded = false;
    try{ delete state.__sqGameCompleteOpen; }catch(_){ }
    try{ document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(n => n.remove()); }catch(_){ }
    if (state.shadow) {
      state.shadow.autoTurnPending = false;
      state.shadow.autoTurnInProgress = false;
      state.shadow.autoTurnToken = null;
      state.shadow.visualCompleteBlocked = false;
      state.shadow.completionReady = false;
      state.shadow.lastBlockedReason = '';
      if (Number(state.shadow.lastCompletedRound) === round) delete state.shadow.lastCompletedRound;
    }

    try{ recomputeMatchAggHitsForPlayer(realIndex); }catch(_){ }
    try{ recomputeMatchAggTotalsForPlayer(realIndex); }catch(_){ }
    try{ recomputeMatchAggHitsForPlayer(shadowIndex); }catch(_){ }
    try{ recomputeMatchAggTotalsForPlayer(shadowIndex); }catch(_){ }
    try{ updateUI(); }catch(_){ }
    try{ window.sqDmdShowZones?.({ z2:'UNDO', z3:'REAL DART 3' }, { type:'wipe', dir:'rev', ms:420, revealMs:120, z3Small:true }); }catch(_){ }
    return true;
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow paired undo failed', e); }catch(_){ }
    try{ toast('Vs Shadow undo failed safely.'); }catch(_){ }
    return true;
  }
}

function __sqBuildVsShadowDraftConfig(games, realPlayer){
  const count = Math.max(1, parseInt(games, 10) || 1);
  const realName = __sqVsShadowPlayerName(realPlayer) || 'Player';
  return {
    mode: 'vsShadow',
    version: 1,
    status: 'draft_phase1',
    realPlayerIndex: 0,
    shadowPlayerIndex: null,
    phase1GameplayBlocked: true,
    blockedReason: __SQ_VS_SHADOW_PHASE1_REASON,
    games: Array.from({ length: count }, (_, i) => ({
      gameNumber: i + 1,
      opponentKind: 'player_pb',
      opponentPlayerId: null,
      opponentName: realName,
      sourceGameId: null,
      sourceScore: 0,
      sourceTs: '',
      sourcePlayerIndex: null,
      replayAvailable: false
    }))
  };
}

function __sqVsShadowPlayerName(p){
  if (p == null) return '';
  if (typeof p === 'string') return p.trim();
  const direct = String(p.name || p.player || p.player_name || p.playerName || p.display_name || '').trim();
  if (direct) return direct;
  const first = String(p.first_name || p.firstName || '').trim();
  const last = String(p.last_name || p.lastName || '').trim();
  return (first + (last ? ' ' + last : '')).trim();
}

function __sqVsShadowNameKey(v){
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function __sqVsShadowPickState(g){
  return (g && g.state && typeof g.state === 'object') ? g.state : {};
}

function __sqVsShadowPickRawState(g){
  return (g && g.raw && g.raw.state && typeof g.raw.state === 'object') ? g.raw.state : {};
}

function __sqVsShadowPlayersOfGame(g){
  const st = __sqVsShadowPickState(g);
  const raw = __sqVsShadowPickRawState(g);
  const players = (g && (g.players || g.player_names)) || st.players || raw.players || [];
  if (Array.isArray(players) && players.length) return players;
  const fallbackName = __sqVsShadowPlayerName(g && (g.player || g.player_name || g.playerName));
  return fallbackName ? [{ name: fallbackName }] : [];
}

function __sqVsShadowTotalsOfGame(g){
  const st = __sqVsShadowPickState(g);
  const raw = __sqVsShadowPickRawState(g);
  const totals = (g && g.totals) || st.totals || raw.totals || [];
  return Array.isArray(totals) ? totals : [];
}

function __sqVsShadowBoardOfGame(g){
  const st = __sqVsShadowPickState(g);
  const raw = __sqVsShadowPickRawState(g);
  return (g && (g.board || g.score)) || st.board || st.score || raw.board || raw.score || [];
}

function __sqVsShadowRowsForPlayer(board, idx){
  if (!Array.isArray(board)) return [];
  if (Array.isArray(board[idx])) return board[idx];
  if (Array.isArray(board[0]) && board[0] && board[0][idx] != null) {
    return board.map(r => Array.isArray(r) ? r[idx] : null);
  }
  return [];
}

function __sqVsShadowRoundScore(entry){
  if (entry == null) return 0;
  if (typeof entry === 'number' || typeof entry === 'string') return Number(entry) || 0;
  if (Array.isArray(entry)) return entry.reduce((sum, d) => sum + __sqVsShadowRoundScore(d), 0);
  if (typeof entry !== 'object') return 0;
  const keys = ['roundTotal','round_total','points','score','total','val','value'];
  for (let i = 0; i < keys.length; i++) {
    const n = Number(entry[keys[i]]);
    if (Number.isFinite(n)) return n;
  }
  const darts = Array.isArray(entry.darts) ? entry.darts : (Array.isArray(entry.throws) ? entry.throws : null);
  if (darts) {
    return darts.reduce((sum, d) => sum + (Number(d && (d.points ?? d.score ?? d.val ?? d.value) || 0) || 0), 0);
  }
  return 0;
}

function __sqVsShadowHasReplayableBoard(board, playerIndex){
  const rows = __sqVsShadowRowsForPlayer(board, playerIndex);
  const minRounds = Math.max(1, (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 14));
  if (!Array.isArray(rows) || rows.length < minRounds) return false;
  return rows.some(entry => {
    if (!entry || typeof entry !== 'object') return false;
    if (Array.isArray(entry.darts) && entry.darts.some(Boolean)) return true;
    if (Array.isArray(entry.throws) && entry.throws.some(Boolean)) return true;
    return Number(entry.roundTotal ?? entry.round_total ?? entry.points ?? entry.score ?? entry.total ?? 0) > 0;
  });
}

function __sqVsShadowGameId(g){
  return String((g && (g.id || g.game_id || g.sheet_id)) || (g && g.raw && (g.raw.id || g.raw.game_id || g.raw.sheet_id)) || '').trim();
}

function __sqVsShadowGameTs(g){
  const st = __sqVsShadowPickState(g);
  const raw = g && g.raw ? g.raw : {};
  return String((g && (g.ts || g.created_at || g.completed_at)) || st.completed_at || raw.created_at || raw.ts || '').trim();
}

function __sqVsShadowFormatTs(ts){
  const ms = Date.parse(ts || '');
  if (!Number.isFinite(ms)) return 'date unknown';
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return dd + '.' + mm + '.' + yy;
}

function __sqVsShadowIsPracticeGame(g){
  try{
    if (typeof window.__sqGameModeKey === 'function') return window.__sqGameModeKey(g) === 'practice';
    const st = __sqVsShadowPickState(g);
    const raw = __sqVsShadowPickRawState(g);
    const match = (g && g.match) || st.match || raw.match || {};
    const mode = String((g && (g.mode || g.gameMode || g.game_mode)) || st.mode || st.gameMode || raw.mode || '').toLowerCase();
    return mode.indexOf('practice') >= 0 || st.is_practice === true || raw.is_practice === true || match.forcePractice === true || __sqVsShadowPlayersOfGame(g).length === 1;
  }catch(_){ return false; }
}

async function __sqVsShadowFetchPracticeGames(){
  try{
    if (typeof window.getGamesForMode === 'function') {
      const rows = await window.getGamesForMode('practice');
      if (Array.isArray(rows) && rows.length) return rows;
    }
  }catch(e){
    try{ console.warn('[SQ] Vs Shadow practice game list via getGamesForMode failed', e); }catch(_){ }
  }

  if (typeof sb === 'undefined' || !sb || typeof sb.from !== 'function') return [];
  const table = (typeof TABLE_GAMES !== 'undefined' && TABLE_GAMES) ? TABLE_GAMES : 'games';
  const res = await sb.from(table)
    .select('id,match_id,game_number,created_at,totals,state,finished')
    .eq('finished', true)
    .order('created_at', { ascending: false })
    .limit(500);
  if (res && res.error) throw res.error;
  return (Array.isArray(res && res.data) ? res.data : []).filter(__sqVsShadowIsPracticeGame);
}

async function __sqVsShadowLoadPracticeCandidates(playerName){
  const targetKey = __sqVsShadowNameKey(playerName);
  if (!targetKey) return [];
  const games = await __sqVsShadowFetchPracticeGames();
  const candidates = [];

  (games || []).forEach(g => {
    const players = __sqVsShadowPlayersOfGame(g);
    const totals = __sqVsShadowTotalsOfGame(g);
    const board = __sqVsShadowBoardOfGame(g);
    players.forEach((p, playerIndex) => {
      const name = __sqVsShadowPlayerName(p);
      if (__sqVsShadowNameKey(name) !== targetKey) return;
      const rows = __sqVsShadowRowsForPlayer(board, playerIndex);
      let score = Number(totals[playerIndex] || 0);
      if (!Number.isFinite(score) || score <= 0) {
        score = rows.reduce((sum, entry) => sum + __sqVsShadowRoundScore(entry), 0);
      }
      if (!Number.isFinite(score) || score <= 0) return;
      const gameId = __sqVsShadowGameId(g);
      const ts = __sqVsShadowGameTs(g);
      const replayAvailable = __sqVsShadowHasReplayableBoard(board, playerIndex);
      candidates.push({
        key: [gameId || 'game', playerIndex, score, ts || 'no-ts'].join(':'),
        playerName: name,
        playerIndex,
        gameId,
        score,
        ts,
        replayAvailable
      });
    });
  });

  candidates.sort((a,b) => (Number(b.score || 0) - Number(a.score || 0)) || (Date.parse(b.ts || '') - Date.parse(a.ts || '')));
  return candidates.slice(0, 10);
}

function __sqVsShadowIsOfficialGame(g){
  try{
    if (typeof window.__sqGameModeKey === 'function') return window.__sqGameModeKey(g) === 'official';
    const st = __sqVsShadowPickState(g);
    const raw = __sqVsShadowPickRawState(g);
    const match = (g && g.match) || st.match || raw.match || {};
    const mode = String((g && (g.mode || g.gameMode || g.game_mode)) || st.mode || st.gameMode || raw.mode || '').toLowerCase();
    if (mode.indexOf('practice') >= 0 || mode.indexOf('turbo') >= 0) return false;
    if (st.is_practice === true || raw.is_practice === true || match.forcePractice === true) return false;
    return __sqVsShadowPlayersOfGame(g).length >= 2;
  }catch(_){ return false; }
}

async function __sqVsShadowFetchOfficialGames(){
  if (typeof sb === 'undefined' || !sb || typeof sb.from !== 'function') return [];
  const table = (typeof TABLE_GAMES !== 'undefined' && TABLE_GAMES) ? TABLE_GAMES : 'games';
  const res = await sb.from(table)
    .select('id,match_id,game_number,created_at,totals,state,finished')
    .eq('finished', true)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (res && res.error) throw res.error;
  return (Array.isArray(res && res.data) ? res.data : []).filter(__sqVsShadowIsOfficialGame);
}

function __sqVsShadowCandidateFromOfficialGame(g, playerIndex){
  const players = __sqVsShadowPlayersOfGame(g);
  const name = __sqVsShadowPlayerName(players[playerIndex]);
  if (!name) return null;
  const totals = __sqVsShadowTotalsOfGame(g);
  const board = __sqVsShadowBoardOfGame(g);
  const rows = __sqVsShadowRowsForPlayer(board, playerIndex);
  let score = Number(totals[playerIndex] || 0);
  if (!Number.isFinite(score) || score <= 0) {
    score = rows.reduce((sum, entry) => sum + __sqVsShadowRoundScore(entry), 0);
  }
  if (!Number.isFinite(score) || score <= 0) return null;
  const gameId = __sqVsShadowGameId(g);
  const ts = __sqVsShadowGameTs(g);
  const replayAvailable = __sqVsShadowHasReplayableBoard(board, playerIndex);
  return {
    key: ['official', gameId || 'game', playerIndex, score, ts || 'no-ts'].join(':'),
    playerName: name,
    playerIndex,
    gameId,
    score,
    ts,
    replayAvailable,
    sourceRows: replayAvailable ? __sqDeepCloneForPersist(rows) : []
  };
}

async function __sqVsShadowLoadOfficialPbCandidates(savedPlayers){
  const savedKeys = new Set((Array.isArray(savedPlayers) ? savedPlayers : [])
    .map(p => __sqVsShadowNameKey(__sqVsShadowPlayerName(p)))
    .filter(Boolean));
  if (!savedKeys.size) return [];
  const games = await __sqVsShadowFetchOfficialGames();
  const bestByPlayer = new Map();

  (games || []).forEach(g => {
    const players = __sqVsShadowPlayersOfGame(g);
    players.forEach((p, playerIndex) => {
      const nameKey = __sqVsShadowNameKey(__sqVsShadowPlayerName(p));
      if (!savedKeys.has(nameKey)) return;
      const candidate = __sqVsShadowCandidateFromOfficialGame(g, playerIndex);
      if (!candidate) return;
      const prev = bestByPlayer.get(nameKey);
      if (!prev ||
          Number(candidate.score || 0) > Number(prev.score || 0) ||
          (Number(candidate.score || 0) === Number(prev.score || 0) && Date.parse(candidate.ts || '') > Date.parse(prev.ts || ''))) {
        bestByPlayer.set(nameKey, candidate);
      }
    });
  });

  return Array.from(bestByPlayer.values())
    .sort((a,b) => (Number(b.score || 0) - Number(a.score || 0)) || (Date.parse(b.ts || '') - Date.parse(a.ts || '')) || String(a.playerName).localeCompare(String(b.playerName)));
}

async function __sqVsShadowLoadOfficialCandidatesForPlayer(playerName){
  const targetKey = __sqVsShadowNameKey(playerName);
  if (!targetKey) return [];
  const games = await __sqVsShadowFetchOfficialGames();
  const candidates = [];

  (games || []).forEach(g => {
    const players = __sqVsShadowPlayersOfGame(g);
    players.forEach((p, playerIndex) => {
      if (__sqVsShadowNameKey(__sqVsShadowPlayerName(p)) !== targetKey) return;
      const candidate = __sqVsShadowCandidateFromOfficialGame(g, playerIndex);
      if (candidate) candidates.push(candidate);
    });
  });

  candidates.sort((a,b) => (Number(b.score || 0) - Number(a.score || 0)) || (Date.parse(b.ts || '') - Date.parse(a.ts || '')));
  return candidates.slice(0, 10);
}

function openPracticeVsShadowOpponentDialog(){
  try{ document.querySelectorAll('.sq-vs-shadow-overlay').forEach(el => el.remove()); }catch(_){ }

  const games = Math.max(1, parseInt(state && state.match && state.match.targetWins, 10) || 1);
  const realPlayer = state && Array.isArray(state.players) ? state.players[0] : null;
  const realName = __sqVsShadowPlayerName(realPlayer) || 'Player';

  state.match = Object.assign({}, state.match || {}, { practiceType:'vsShadow', forcePractice:true });
  state.shadow = __sqBuildVsShadowDraftConfig(games, realPlayer);

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-vs-shadow-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '760px';

  const title = document.createElement('h3');
  title.textContent = 'Select Shadow Opponent';

  const body = document.createElement('div');
  body.className = 'modal-body';

  const rowsWrap = document.createElement('div');
  rowsWrap.className = 'stack';

  const status = document.createElement('div');
  status.className = 'tag';
  status.textContent = 'Loading saved players from Supabase...';

  const controls = [];
  let savedPlayerRows = [];
  let startBtn = null;
  let reason = null;

  function syncDraft(){
    const draftGames = controls.map((ctrl, i) => {
      const opponentOption = ctrl.opponentSelect.options[ctrl.opponentSelect.selectedIndex] || null;
      const opponentKind = ctrl.opponentSelect.value === '__player_pb__' ? 'player_pb' : 'saved_player';
      const candidate = (ctrl.candidates || []).find(c => c.key === ctrl.scoreSelect.value) || null;
      const selectedName = String((opponentOption && opponentOption.dataset.playerName) || '').trim();
      const sourceName = __sqVsShadowPlayerName(candidate && candidate.playerName) || selectedName || (opponentKind === 'player_pb' ? 'Player PB' : '');
      return {
        gameNumber: i + 1,
        opponentKind,
        opponentPlayerId: opponentKind === 'saved_player' ? (opponentOption && opponentOption.dataset.playerId ? opponentOption.dataset.playerId : null) : null,
        opponentName: sourceName,
        sourcePlayerName: sourceName,
        sourceGameId: candidate ? candidate.gameId : null,
        sourceScore: candidate ? candidate.score : 0,
        sourceTs: candidate ? candidate.ts : '',
        sourcePlayerIndex: candidate ? candidate.playerIndex : null,
        replayAvailable: !!(candidate && candidate.replayAvailable),
        sourceRows: candidate && candidate.replayAvailable ? __sqDeepCloneForPersist(candidate.sourceRows || []) : []
      };
    });
    state.match = Object.assign({}, state.match || {}, { practiceType:'vsShadow', forcePractice:true });
    state.shadow = Object.assign({}, state.shadow || {}, {
      mode: 'vsShadow',
      version: 1,
      status: 'draft_phase1',
      realPlayerIndex: 0,
      shadowPlayerIndex: null,
      phase1GameplayBlocked: true,
      blockedReason: __SQ_VS_SHADOW_PHASE1_REASON,
      games: draftGames
    });
    const ready = __sqVsShadowSelectedRowsReady(controls);
    if (startBtn) {
      startBtn.disabled = !ready;
      startBtn.title = ready ? 'Start Vs Shadow practice game.' : __SQ_VS_SHADOW_PHASE1_REASON;
    }
    if (reason) {
      reason.textContent = ready
        ? 'Ready. Shadow gameplay will replay the selected Official source and save only the real Practice result.'
        : __SQ_VS_SHADOW_PHASE1_REASON;
    }
  }

  function setScoreLoading(ctrl, text){
    ctrl.scoreSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = text;
    opt.disabled = true;
    opt.selected = true;
    ctrl.scoreSelect.appendChild(opt);
  }

  async function loadScoresForControl(ctrl){
    const selected = ctrl.opponentSelect.options[ctrl.opponentSelect.selectedIndex] || null;
    const sourceName = ctrl.opponentSelect.value === '__player_pb__'
      ? realName
      : String((selected && selected.dataset.playerName) || '').trim();
    ctrl.candidates = [];
    ctrl.scoreSelect.disabled = true;
    setScoreLoading(ctrl, 'Loading Official scores...');
    syncDraft();

    try{
      const rows = ctrl.opponentSelect.value === '__player_pb__'
        ? await __sqVsShadowLoadOfficialPbCandidates(savedPlayerRows)
        : await __sqVsShadowLoadOfficialCandidatesForPlayer(sourceName);
      ctrl.candidates = rows;
      ctrl.scoreSelect.innerHTML = '';
      if (!rows.length) {
        setScoreLoading(ctrl, 'No Official scores found');
        ctrl.scoreSelect.disabled = true;
      } else {
        rows.forEach((row, idx) => {
          const opt = document.createElement('option');
          opt.value = row.key;
          const playerPrefix = ctrl.opponentSelect.value === '__player_pb__' ? (__sqVsShadowPlayerName(row.playerName) + ' - ') : '';
          opt.textContent = playerPrefix + String(Math.round(row.score)) + ' - ' + __sqVsShadowFormatTs(row.ts) + (row.gameId ? ' - ' + row.gameId.slice(0, 8) : '') + (row.replayAvailable ? '' : ' - unavailable: no replay data');
          opt.disabled = !row.replayAvailable;
          if (idx === 0 && row.replayAvailable) opt.selected = true;
          ctrl.scoreSelect.appendChild(opt);
        });
        const firstPlayable = rows.find(r => r.replayAvailable);
        if (firstPlayable) {
          ctrl.scoreSelect.value = firstPlayable.key;
          ctrl.scoreSelect.disabled = false;
        } else {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No replayable board data available';
          opt.disabled = true;
          opt.selected = true;
          ctrl.scoreSelect.insertBefore(opt, ctrl.scoreSelect.firstChild);
          ctrl.scoreSelect.disabled = true;
        }
      }
    }catch(e){
      try{ console.warn('[SQ] Vs Shadow score candidate load failed', e); }catch(_){ }
      setScoreLoading(ctrl, 'Official scores unavailable');
      ctrl.scoreSelect.disabled = true;
    }
    syncDraft();
  }

  for (let i = 0; i < games; i++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.flexWrap = 'wrap';

    const label = document.createElement('div');
    label.className = 'tag';
    label.textContent = 'Game ' + (i + 1) + ' vs';

    const opponentSelect = document.createElement('select');
    opponentSelect.style.minWidth = '180px';
    const pbOpt = document.createElement('option');
    pbOpt.value = '__player_pb__';
    pbOpt.textContent = 'Player PB';
    pbOpt.dataset.playerName = realName;
    opponentSelect.appendChild(pbOpt);

    const inMatch = document.createElement('div');
    inMatch.className = 'tag';
    inMatch.textContent = 'in match';

    const scoreSelect = document.createElement('select');
    scoreSelect.style.minWidth = '260px';
    setScoreLoading({ scoreSelect }, 'Loading Official scores...');

    const ctrl = { opponentSelect, scoreSelect, candidates: [] };
    controls.push(ctrl);

    opponentSelect.addEventListener('change', () => { loadScoresForControl(ctrl); });
    scoreSelect.addEventListener('change', syncDraft);

    row.append(label, opponentSelect, inMatch, scoreSelect);
    rowsWrap.appendChild(row);
  }

  body.append(rowsWrap, status);

  reason = document.createElement('div');
  reason.className = 'tag';
  reason.textContent = __SQ_VS_SHADOW_PHASE1_REASON;

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'btn primary';
  startBtn.textContent = 'Start Game';
  startBtn.disabled = true;
  startBtn.title = __SQ_VS_SHADOW_PHASE1_REASON;
  startBtn.onclick = () => {
    syncDraft();
    if (!__sqVsShadowSelectedRowsReady(controls)) {
      try{ toast(__SQ_VS_SHADOW_PHASE1_REASON); }catch(_){ }
      return;
    }
    __sqStartPracticeVsShadowFromDraft(overlay);
  };

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.onclick = () => {
    overlay.remove();
    if (matchLengthModal) matchLengthModal.classList.remove('hidden');
  };

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => {
    overlay.remove();
    show('details');
  };

  footer.append(startBtn, backBtn, closeBtn);
  modal.append(title, body, reason, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.tabIndex = 0;
  modal.focus();

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

  Promise.resolve()
    .then(async () => {
      let saved = [];
      try{
        saved = (typeof cloudListPlayers === 'function') ? await cloudListPlayers() : [];
      }catch(e){
        try{ console.warn('[SQ] Vs Shadow saved player load failed', e); }catch(_){ }
      }
      const savedRows = (Array.isArray(saved) ? saved : [])
        .filter(p => p && __sqVsShadowPlayerName(p))
        .sort((a,b) => __sqVsShadowPlayerName(a).localeCompare(__sqVsShadowPlayerName(b)));
      savedPlayerRows = savedRows;
      controls.forEach(ctrl => {
        savedRows.forEach(p => {
          const opt = document.createElement('option');
          const name = __sqVsShadowPlayerName(p);
          opt.value = 'saved:' + String((p && p.id) || name);
          opt.textContent = name;
          opt.dataset.playerId = p && p.id != null ? String(p.id) : '';
          opt.dataset.playerName = name;
          ctrl.opponentSelect.appendChild(opt);
        });
      });
      status.textContent = savedRows.length ? 'Select a replayable Official score for each game.' : 'Saved players unavailable from Supabase. Official PB choices require saved-player data.';
      controls.forEach(ctrl => { loadScoresForControl(ctrl); });
      syncDraft();
    });
}

/* ---- Saved players helpers (shared by Add + Select modals) ---- */
function getSavedPlayers(){
  try { return JSON.parse(localStorage.getItem('shateki_players') || '[]'); }
  catch(e){ return []; }
}
function setSavedPlayers(arr){
  try { localStorage.setItem('shateki_players', JSON.stringify(arr)); }
  catch(e){}
}

// Keep local saved players in sync with Supabase (cloud is canonical).
async function syncSavedPlayersFromCloud(){
  if (typeof cloudListPlayers !== 'function') return false;
  try{
    const cloud = await cloudListPlayers(); // [{id,name,created_at,initials,first_name,last_name,nickname}]
    const cloudArr = (cloud || [])
      .filter(p => p && p.name)
      .map(p => ({
        id: (p.id != null ? String(p.id).trim() : null),
        name: String(p.name),
        first_name: (p.first_name != null ? String(p.first_name) : ''),
        last_name: (p.last_name != null ? String(p.last_name) : ''),
        nickname: (p.nickname != null ? String(p.nickname) : ''),
        initials: __sqNormalizeInitials(p.initials, p.name),
        avatar_id: p.avatar_id ?? null,
        joinedAt: p.created_at ? new Date(p.created_at).toISOString() : null,
        _src: 'cloud'
      }))
      .sort((a,b)=> String(a.name).localeCompare(String(b.name)));

    setSavedPlayers(cloudArr);
    return true;
  }catch(e){
    console.error('syncSavedPlayersFromCloud failed', e);
    return false;
  }
}

function populateSavedPlayersSelects(arrOverride){
  const arr = Array.isArray(arrOverride) ? arrOverride : getSavedPlayers();
  const sel1 = document.getElementById('existingPlayers');      // (legacy) some screens
  const sel2 = document.getElementById('existingPlayerSelect'); // Select Player modal

  [sel1, sel2].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a saved player...</option>';
    (arr || []).forEach(p => {
      if (!p) return;
      const v = (p.id != null && String(p.id).trim()) ? String(p.id).trim() : String(p.name || '').trim();
      const label = __sqPlayerOptionLabel(p) || String(p.name || '').trim();
      if (!v || !label) return;
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  });
}

// Best-effort: sync at startup so all devices converge.
document.addEventListener('DOMContentLoaded', function(){
  try{
    syncSavedPlayersFromCloud().then(()=>{
      try{
        populateSavedPlayersSelects(getSavedPlayers());
        if (typeof window.buildStartTicker === 'function') {
          try{ window.buildStartTicker(); }catch(_){ }
        }
      }catch(_){}
    });
  }catch(_){}
});

// Nickname generator pool (non-pro style, darts vibe) — no repeats until exhausted.
const __sqNicknamePool = ["The Quiet Checkout", "Captain Double", "The Split Fixer", "Bullseye Bandit", "The Oche Operator", "Double Dealer", "Treble Tactician", "The Wire Whisperer", "The Flight Surgeon", "The Dart Doctor", "Checkout Chief", "The Board Whisper", "The Angle Artist", "The Scoring Sentry", "The Bull Butler", "The Nickel Navigator", "The Treble Clerk", "The Double Clerk", "The Oche Enforcer", "The Marker", "The Point Professor", "The Segment Sniper", "The Ring Rattler", "The 180 Tease", "The Inside Man", "Outer Bull Baron", "Inner Bull Boss", "The Finishing Foreman", "The Calm Closer", "The Rhythm Rack", "The Aim Assistant", "The Line Judge", "The Split Specialist", "The Lane Lifter", "The Dart Librarian", "The Checkout Courier", "The Trouble Trebler", "The Double Dispatcher", "The Oche Accountant", "The Treble Broker", "The Scoring Steward", "The Board Barista", "The Flight Captain", "The Wire Walker", "The Calm Calculator", "The Segment Surgeon", "The Bull Runner", "The Finish Inspector", "The Tempo Technician", "The Pressure Plumber"];
let __sqNicknameBag = [];
function __sqRefillNicknameBag(){
  __sqNicknameBag = Array.isArray(__sqNicknamePool) ? __sqNicknamePool.slice() : [];
  // Fisher–Yates
  for (let i = __sqNicknameBag.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = __sqNicknameBag[i];
    __sqNicknameBag[i] = __sqNicknameBag[j];
    __sqNicknameBag[j] = tmp;
  }
}
function __sqPickNickname(){
  if (!__sqNicknameBag.length) __sqRefillNicknameBag();
  return __sqNicknameBag.pop() || '';
}
function __sqAutoInitials(first, last){
  return __sqComputeInitials(first, last);
}
function __sqBuildFullName(first, last){
  const f = String(first||'').trim();
  const l = String(last||'').trim();
  return (f + (l ? ' ' + l : '')).trim();
}

// Add / Save Player – now supports First/Last/Initials/Nickname. (No PIN.)
// index==0 means "register only" (do not inject into any row).
async function showAddPlayerDialog(index){
  const modal = byId('addPlayerModal');
  if (!modal) { toast('Add Player modal missing'); return; }

  // Ensure cloud is ready — players should not diverge device-locally.
  try{ if (typeof ensureCloudInit === 'function') ensureCloudInit(); }catch(_){ }

  const firstEl = byId('newPlayerFirst');
  const lastEl  = byId('newPlayerLast');
  const initEl  = byId('newPlayerInitials');
  const nickEl  = byId('newPlayerNickname');
  const genBtn  = byId('genNicknameBtn');
  const saveBtn = byId('savePlayerBtn');
  const backBtn = byId('npBackBtn');
  const closeBtn= byId('npCloseBtn');

  let chosenName = '';
  let manualInitials = false;
  let chosenAvatarId = (typeof __sqAvatarAutoAssignId === 'function') ? __sqAvatarAutoAssignId('new-player') : 1;
  const avatarHost = byId('newPlayerAvatarPicker');
  const renderAvatarPicker = () => {
    if (!avatarHost || typeof __sqBuildAvatarPicker !== 'function') return;
    avatarHost.innerHTML = '';
    avatarHost.appendChild(__sqBuildAvatarPicker(chosenAvatarId, id => { chosenAvatarId = id; }));
  };

  const setSaveEnabled = () => {
    const ok = !!String(firstEl?.value || '').trim();
    const cloudOk = !!(window.sb && typeof window.sb.from === 'function');
    if (saveBtn) saveBtn.disabled = !(ok && cloudOk);
  };

  const maybeAutoInitials = () => {
    if (!initEl) return;
    if (manualInitials) return;
    const val = __sqAutoInitials(firstEl?.value, lastEl?.value);
    initEl.value = val || '';
  };

  const reset = () => {
    if (firstEl) firstEl.value = '';
    if (lastEl)  lastEl.value  = '';
    if (nickEl)  nickEl.value  = __sqPickNickname();
    if (initEl)  initEl.value  = '';
    chosenAvatarId = (typeof __sqAvatarAutoAssignId === 'function') ? __sqAvatarAutoAssignId('new-player') : 1;
    renderAvatarPicker();
    manualInitials = false;
    maybeAutoInitials();
    setSaveEnabled();
  };

  const finish = (msg) => {
    const idx = parseInt(modal.dataset.playerIndex || '0', 10) || 0;

    // idx>0 => legacy: inject into old #psPlayerFields row (if it exists)
    if (idx > 0) {
      const row =
        document.querySelector(`#psPlayerFields .pf[data-index="${idx}"]`) ||
        document.querySelector(`.pf[data-index="${idx}"]`);
      const input = row?.querySelector('input[data-role="display"]');
      if (input) input.value = chosenName || '';
    }

    modal.classList.add('hidden');
    reset();
    toast(msg);
  };

  // Wire buttons (avoid stacking listeners)
  if (backBtn)  backBtn.onclick  = () => { modal.classList.add('hidden'); reset(); };
  if (closeBtn) closeBtn.onclick = () => { modal.classList.add('hidden'); reset(); };

  if (genBtn && nickEl){
    genBtn.onclick = () => {
      nickEl.value = __sqPickNickname();
    };
  }

  if (initEl){
    initEl.addEventListener('input', () => {
      manualInitials = !!String(initEl.value||'').trim();
      setSaveEnabled();
    }, { passive:true });
  }
  if (firstEl){
    firstEl.addEventListener('input', () => { setSaveEnabled(); maybeAutoInitials(); }, { passive:true });
  }
  if (lastEl){
    lastEl.addEventListener('input', () => { maybeAutoInitials(); }, { passive:true });
  }

  // Open
  modal.dataset.playerIndex = index ? String(index) : '0';
  modal.classList.remove('hidden');
  reset();
  try{ firstEl?.focus(); }catch(_){ }

  // Save
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const first = String(firstEl?.value || '').trim();
      const last  = String(lastEl?.value  || '').trim();
      if (!first){ toast('Enter a first name'); return; }

      const fullName = __sqBuildFullName(first, last);
      const initials = __sqNormalizeInitials(String(initEl?.value || '').trim(), fullName);
      const nickname = String(nickEl?.value || '').trim();

      chosenName = fullName;

      try {
        await cloudCreatePlayer(fullName, { initials, nickname, first_name: first, last_name: last, avatar_id: chosenAvatarId });
        try{ if (typeof window.__homeLivePrinterInjectLine === 'function') window.__homeLivePrinterInjectLine(`🚨 NEW PLAYER - ${fullName} - Welcome to Shateki Quest 🎯`); }catch(_e){}
        await syncSavedPlayersFromCloud();
        try{ populateSavedPlayersSelects(); }catch(_){ }
        try{ if (typeof window.buildStartTicker === 'function') window.buildStartTicker(); }catch(_){ }
        try{ document.dispatchEvent(new Event('sq:savedPlayersUpdated')); }catch(_){ }
      } catch (e) {
        console.error('cloudCreatePlayer failed', e);
        toast(e?.message || 'Save failed');
        return;
      }

      // Saved from the Match Setup screen (index 0) => drop the new player
      // straight onto the Match Card, then close this dialog. Repeats cleanly
      // for each new player. Mirrors the "Add Saved" confirm path.
      let cardMsg = 'Player saved';
      try{
        const fromSetup = (parseInt(String(index || 0), 10) || 0) === 0
          && !!(msPlayersList && msPlayersList.offsetParent !== null)
          && Array.isArray(__msPlayers) && typeof __msRenderPlayers === 'function';
        if (fromSetup){
          let meta = null;
          try{
            const list = (typeof cloudListPlayers === 'function') ? (await cloudListPlayers()) : [];
            meta = (list || []).find(p => String(p && p.name || '').trim().toLowerCase() === fullName.toLowerCase()) || null;
          }catch(_){ meta = null; }
          const cand = {
            type: 'registered',
            id: (meta && meta.id != null) ? meta.id : null,
            name: fullName,
            first_name: (meta && meta.first_name) || first,
            last_name:  (meta && meta.last_name)  || last,
            nickname:   (meta && meta.nickname)   || nickname,
            initials:   (meta && meta.initials)   || initials,
            avatar_id:  __sqAvatarIdForPlayer(meta || { name: fullName, avatar_id: chosenAvatarId })
          };
          const candKey = String(cand.id || cand.name).trim().toLowerCase();
          const already = __msPlayers.some(p => String((p && (p.id || p.name)) || '').trim().toLowerCase() === candKey);
          const cap = (typeof MS2_MAX_PLAYERS === 'number' ? MS2_MAX_PLAYERS : 6);
          const vsBlocked = (typeof __sqVsShadowSetupSlotTaken === 'function') && __sqVsShadowSetupSlotTaken();
          if (already){
            cardMsg = 'Already on the match card';
          } else if (vsBlocked){
            cardMsg = 'Saved · Vs Shadow uses exactly 1 real player';
          } else if (__msPlayers.length >= cap){
            cardMsg = `Saved · match card is full (max ${cap})`;
          } else {
            __msPlayers.push(cand);
            __msRenderPlayers();
            cardMsg = 'Player added to match card';
          }
        }
      }catch(err){ try{ console.warn('add-to-card after save failed', err); }catch(_){ } }

      finish(cardMsg);
    };
  }
}

// Select a saved player for match.
// index==0 => add to Match Setup list.
async function showSelectPlayerDialog(index){
  const select = byId('existingPlayerSelect');
  if (!select) { toast('Select list missing'); return; }
  if ((parseInt(index || '0', 10) || 0) === 0 && __sqVsShadowSetupSlotTaken()) {
    toast('Vs Shadow uses exactly 1 real player.');
    return;
  }
  select.innerHTML = '<option value="">Select a saved player...</option>';

  let any = false;
  let cloudLoaded = false;
  let resolvedList = [];

  const pushResolved = (p) => {
    if (!p || !p.name) return;
    const opt = document.createElement('option');
    opt.value = (p.id != null && String(p.id).trim()) ? String(p.id).trim() : p.name;
    opt.textContent = __sqPlayerOptionLabel(p) || p.name;
    select.appendChild(opt);
    resolvedList.push({
      id: (p.id != null ? String(p.id).trim() : null),
      name: String(p.name),
      first_name: (p.first_name != null ? String(p.first_name) : ''),
      last_name: (p.last_name != null ? String(p.last_name) : ''),
      nickname: (p.nickname != null ? String(p.nickname) : ''),
      initials: __sqNormalizeInitials(p.initials, p.name),
      avatar_id: __sqAvatarIdForPlayer(p)
    });
  };

  // Prefer cloud
  try {
    const cloudList = await cloudListPlayers(true);
    cloudLoaded = true;
    (cloudList || []).forEach(pushResolved);
    any = !!(cloudList && cloudList.length);
  } catch (err) {
    console.error('cloudListPlayers failed', err);
  }

  if (!any && __sqIsVsShadowSetup()) {
    toast('Saved players unavailable from Supabase. Add a guest player or try again.');
    return;
  }

  // Fallback: local
  if (!any && !cloudLoaded) {
    const local = getSavedPlayers();
    (local || []).forEach(pushResolved);
    any = !!(local && local.length);
  }

  if (!any) { toast('No saved players found'); return; }

  // Dedupe by id/name
  {
    const seen = new Set();
    resolvedList = resolvedList.filter(p => {
      const key = String(p.id || p.name).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const modal = byId('selectPlayerModal');
  if (!modal) { toast('Select Player modal missing'); return; }
  modal.dataset.playerIndex = String(index || 0);
  modal.classList.remove('hidden');

  const listWrap = byId('spPlayerList');
  const searchEl = byId('spSearchInput');
  const chips = Array.from(modal.querySelectorAll('.sp2-chip'));
  const vsShadow = __sqIsVsShadowSetup();
  const slotsLeft = Math.max(0, (typeof MS2_MAX_PLAYERS === 'number' ? MS2_MAX_PLAYERS : 6) - ((__msPlayers && __msPlayers.length) || 0));
  const maxPick = vsShadow ? 1 : slotsLeft;

  const alreadyIn = new Set((__msPlayers || []).map(p => String(p.id || p.name || '').trim().toLowerCase()).filter(Boolean));

  const selectedKeys = new Set();
  let sortMode = 'recent';
  let query = '';

  const keyOf = p => String(p.id || p.name).trim().toLowerCase();

  const sorted = () => {
    const arr = resolvedList.slice();
    if (sortMode === 'az'){
      arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } else if (sortMode === 'rank'){
      const ranks = window.__ms2PowerRanks || new Map();
      arr.sort((a, b) => {
        const ra = ranks.get(String(a.name).trim().toLowerCase()) ?? 9999;
        const rb = ranks.get(String(b.name).trim().toLowerCase()) ?? 9999;
        return ra - rb || String(a.name).localeCompare(String(b.name));
      });
    }
    // 'recent' keeps cloud order (newest data source ordering)
    if (!query) return arr;
    const q = query.toLowerCase();
    return arr.filter(p => (String(p.name) + ' ' + String(p.nickname || '')).toLowerCase().includes(q));
  };

  const renderList = () => {
    if (!listWrap) return;
    listWrap.innerHTML = '';
    const rows = sorted();
    if (!rows.length){
      const none = document.createElement('div');
      none.className = 'sp2-none';
      none.textContent = 'No players match your search.';
      listWrap.appendChild(none);
      return;
    }
    rows.forEach(p => {
      const key = keyOf(p);
      const inCard = alreadyIn.has(key);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ms2-slot sp2-row' + (selectedKeys.has(key) ? ' selected' : '') + (inCard ? ' in-card' : '');
      row.appendChild(__ms2Avatar(p));

      const info = document.createElement('span');
      info.className = 'ms2-info';
      const nm = document.createElement('span');
      nm.className = 'ms2-nm';
      nm.textContent = __ms2DisplayName(p) || '—';
      info.appendChild(nm);
      info.appendChild(__ms2RankLine(p.name));
      row.appendChild(info);

      const check = document.createElement('span');
      check.className = 'sp2-check';
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7.5" r="3"/><path d="M3.5 19c1-2.6 3-4 5.5-4 1.1 0 2.1.25 3 .75"/><path d="M15 17l2.4 2.4L21.5 15"/></svg>';
      row.appendChild(check);

      row.onclick = () => {
        if (inCard){ toast('Already on the match card'); return; }
        if (selectedKeys.has(key)){
          selectedKeys.delete(key);
        } else {
          if (vsShadow) selectedKeys.clear();
          if (selectedKeys.size >= maxPick){
            toast(vsShadow ? 'Vs Shadow uses exactly 1 real player.' : `Match card is full (max ${MS2_MAX_PLAYERS} players)`);
            return;
          }
          selectedKeys.add(key);
        }
        // Keep the hidden native select in sync (first selection) for legacy hooks.
        const first = resolvedList.find(x => selectedKeys.has(keyOf(x)));
        select.value = first ? ((first.id != null && String(first.id).trim()) ? String(first.id).trim() : first.name) : '';
        renderList();
      };
      listWrap.appendChild(row);
    });
  };

  if (searchEl){
    searchEl.value = '';
    searchEl.oninput = () => { query = String(searchEl.value || '').trim(); renderList(); };
  }
  chips.forEach(ch => {
    ch.classList.toggle('active', ch.dataset.sort === sortMode);
    ch.onclick = () => {
      sortMode = ch.dataset.sort || 'recent';
      chips.forEach(c => c.classList.toggle('active', c === ch));
      if (sortMode === 'rank' && !(window.__ms2PowerRanks && window.__ms2PowerRanks.size)){
        __ms2EnsurePowerRanks().then(() => renderList()).catch(()=>{});
      }
      renderList();
    };
  });

  let cancelBtn  = byId('cancelSelectPlayerBtn');
  let confirmBtn = byId('confirmSelectPlayerBtn');
  let saveNewBtn = byId('spSaveNewBtn');

  // Strip old listeners (defensive)
  if (cancelBtn) {
    const clone = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(clone, cancelBtn);
    cancelBtn = clone;
  }
  if (confirmBtn) {
    const clone = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(clone, confirmBtn);
    confirmBtn = clone;
  }
  if (saveNewBtn) {
    const clone = saveNewBtn.cloneNode(true);
    saveNewBtn.parentNode.replaceChild(clone, saveNewBtn);
    saveNewBtn = clone;
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      select.value = '';
      modal.classList.add('hidden');
    };
  }

  if (saveNewBtn) {
    saveNewBtn.onclick = async () => {
      modal.classList.add('hidden');
      try{ await showAddPlayerDialog(0); }catch(_){ }
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const picks = resolvedList.filter(p => selectedKeys.has(keyOf(p)));
      if (!picks.length) { toast('Select at least one player'); return; }

      const idx = parseInt(modal.dataset.playerIndex || '0', 10) || 0;

      if (idx === 0) {
        if (__sqVsShadowSetupSlotTaken()) {
          toast('Vs Shadow uses exactly 1 real player.');
          return;
        }
        picks.forEach(meta => {
          if (__msPlayers.length >= (typeof MS2_MAX_PLAYERS === 'number' ? MS2_MAX_PLAYERS : 6)) return;
          __msPlayers.push({
            type: 'registered',
            id: meta.id != null ? meta.id : null,
            name: String(meta.name).trim(),
            first_name: meta.first_name || '',
            last_name: meta.last_name || '',
            nickname: meta.nickname || '',
            initials: meta.initials || '',
            avatar_id: __sqAvatarIdForPlayer(meta)
          });
        });
        __msRenderPlayers();
      } else {
        // Legacy injection (if old rows exist) - uses the first pick only
        const resolvedFinal = String(picks[0].name).trim();
        const row =
          document.querySelector(`#psPlayerFields .pf[data-index="${idx}"]`) ||
          document.querySelector(`.pf[data-index="${idx}"]`);
        const input = row?.querySelector('input[data-role="display"]');
        if (input) input.value = resolvedFinal;
      }

      select.value = '';
      modal.classList.add('hidden');
      toast(picks.length === 1 ? 'Player added' : `${picks.length} players added`);
    };
  }

  // Populate Power Rank values as soon as rankings are available.
  __ms2EnsurePowerRanks().then(m => { if (m && m.size) renderList(); }).catch(()=>{});

  renderList();
}

// Init
__msRenderPlayers();
__msUpdateStartEnabled();

/*****************
 * BUILDERS
 *****************/
const thead=byId('thead'), tbody=byId('tbody');
const statsThead=byId('statsThead'), statsTbody=byId('statsTbody');
const mstatsThead=byId('mstatsThead'), mstatsTbody=byId('mstatsTbody');
const floatThead=byId('floatThead');

function buildScoreHeader(){ 
  // Main scoreboard header: spacer row used to keep column widths aligned.
  // Match progress (wins) lives in the floating header now.
  thead.innerHTML = '';

  const tr = document.createElement('tr');

  // Left column header above "10s" (leave blank)
  const thRound = document.createElement('th');
  thRound.textContent = '';
  tr.appendChild(thRound);

  // Per-player header cells: blank (width alignment only)
  for (let i = 0; i < state.players.length; i++) {
    const th = document.createElement('th');
    th.className = 'player';
    th.style.color = state.players[i].color;
    th.textContent = '';
    tr.appendChild(th);
  }

  thead.appendChild(tr);
}

function buildScoreBody(){ 
  tbody.innerHTML = ''; 

  for (let r = 0; r < MAX_ROUNDS; r++) {
    const tr = document.createElement('tr'); 

    // Left-hand round label
    const th = document.createElement('th'); 
    th.className = 'round-label';
    th.id = `roundth-${r}`;
    th.textContent = (
      ROUNDS[r].type === 'number'
        ? (ROUNDS[r].target + 's')
        : (ROUNDS[r].type === 'doubles'
            ? "D"
            : (ROUNDS[r].type === 'triples' ? "T" : 'B'))
    );
    tr.appendChild(th); 

    // Cells: now have main (rolling total) + sub (round total)
    for (let p = 0; p < state.players.length; p++) { 
      const td = document.createElement('td'); 
      td.className = 'center num player'; 
      td.id = `cell-${p}-${r}`;
      td.innerHTML = `
        <div class="cell-wrap">
          <div class="cell-main" id="cell-main-${p}-${r}">–</div>
          <div class="cell-sub" id="cell-sub-${p}-${r}"></div>
        </div>
      `;
      tr.appendChild(td);
    } 

    tbody.appendChild(tr);
  } 
}

function buildFloatingHeader(){ 
  floatThead.innerHTML = '';

  // Apply player-count classes for responsive sizing
  try {
    floatHead.classList.remove('players-5','players-6');
    if (state.players.length === 5) floatHead.classList.add('players-5');
    if (state.players.length === 6) floatHead.classList.add('players-6');
  } catch(_) {}

  // A) Target (left) spans B/C rows
  const trNames = document.createElement('tr');

  const thRound = document.createElement('th');
  thRound.id = 'froundlabel';
  thRound.rowSpan = 2;          // B, C rows
  thRound.textContent = '';     // filled by updateUI()
  trNames.appendChild(thRound);

  // B) Player names + match progress
  for (let i = 0; i < state.players.length; i++) { 
    const th = document.createElement('th'); 
    th.className = 'player'; 
    th.style.color = state.players[i].color; 

    const wrap = document.createElement('div'); 
    wrap.className = 'th-wrap'; 

    const wins = document.createElement('div');
    wins.className = 'th-wins';
    wins.id = 'fwins-' + i;
    wins.textContent = '';

    const name = document.createElement('div'); 
    name.className = 'th-name'; 
    name.textContent = __sqHeaderLabelForPlayer(state.players[i]); 

    wrap.append(wins, name);
    th.appendChild(wrap); 
    trNames.appendChild(th);
  }  

  // C) Totals + diff + throw indicator (single row; no separate D row)
  const trTotals = document.createElement('tr');
  for (let i = 0; i < state.players.length; i++) { 
    const th = document.createElement('th'); 
    th.className = 'player';
    th.id = 'fcoltot-' + i; 

    const total = document.createElement('div'); 
    total.className = 'th-total num'; 
    total.id = 'ftotal-' + i; 
    total.textContent = '0'; 

    const diff = document.createElement('div'); 
    diff.className = 'th-diff'; 
    diff.id = 'fdiff-' + i; 
    diff.textContent = '0';
    th.append(total, diff);
trTotals.appendChild(th);
  }  

  floatThead.append(trNames, trTotals);
}

// Darts display (D row)
function dartHeaderSymbol(dart){
  if (!dart) return { text: '➤', cls: 'dart-empty' };

  const k = dart.kind;

  if (k === 'Miss') return { text: 'X', cls: 'dart-miss' };
  if (k === 'S' || k === 'D' || k === 'T') return { text: k, cls: 'dart-' + k.toLowerCase() };
  if (k === 'Double') return { text: 'D', cls: 'dart-d' };
  if (k === 'Triple') return { text: 'T', cls: 'dart-t' };
  if (k === 'B') return { text: (dart.bull === 'Outer' ? 'OB' : 'B'), cls: (dart.bull === 'Outer' ? 'dart-ob' : 'dart-b') };

  return { text: '?', cls: 'dart-unk' };
}
function renderDartsHeaderHTML(pIdx){
  const now = Date.now();

  // Expire last-go hold
  if (state.uiLastGo && now >= state.uiLastGo.showUntil) {
    state.uiLastGo = null;
  }

  const isActive = (!state.finished && pIdx === state.currentPlayer);
  const showLast = (!!state.uiLastGo && state.uiLastGo.player === pIdx);

  let darts = [];
  if (isActive) {
    const entry = state.score?.[pIdx]?.[state.currentRound];
    darts = entry?.darts || [];
  } else if (showLast) {
    darts = state.uiLastGo.darts || [];
  }

  let html = '';
  for (let k = 0; k < 3; k++) {
    let d = null;

    if (isActive) {
      // Only show darts already thrown this go (currentDart is the NEXT dart index)
      d = (k < state.currentDart) ? darts[k] : null;
    } else if (showLast) {
      // Show completed go for 1s after 3rd dart
      d = darts[k] || null;
    }

    const sym = dartHeaderSymbol(d);
    html += `<span class="dart-slot ${sym.cls}">${sym.text}</span>`;
  }
  return html;
}

// Shared go indicator (single 3-slot display under TARGET)
function renderSharedGoIndicatorHTML(){
  const now = Date.now();

  // expire any hold
  if (state.uiLastGo && now >= state.uiLastGo.showUntil) {
    state.uiLastGo = null;
  }

  // If the next player has already started throwing, don't keep showing previous go
  if (state.uiLastGo && state.currentPlayer !== state.uiLastGo.player && state.currentDart > 0) {
    state.uiLastGo = null;
  }

  const isHoldingPrev = (!!state.uiLastGo && state.currentPlayer !== state.uiLastGo.player && state.currentDart === 0);

  let darts = [];
  if (isHoldingPrev) {
    darts = state.uiLastGo.darts || [];
  } else {
    const entry = state.score?.[state.currentPlayer]?.[state.currentRound];
    darts = entry?.darts || [];
  }

  let html = '';
  for (let k = 0; k < 3; k++) {
    let d = null;
    if (isHoldingPrev) {
      d = darts[k] || null;           // hold completed go for 1s
    } else {
      d = (k < state.currentDart) ? (darts[k] || null) : null; // show only thrown darts for active player
    }
    const sym = dartHeaderSymbol(d);
    html += `<span class="dart-slot ${sym.cls}">${sym.text}</span>`;
  }
  return html;
}

function formatTop3Inline(list){
  if (!Array.isArray(list) || !list.length) return '—';
  const pick = i => list[i] || '—';
  return `1st ${pick(0)} | 2nd ${pick(1)} | 3rd ${pick(2)}`;
}

/*****************
 * STATS (modal compute)
 *****************/
const METRICS = [
  { key: 'miss',         label: '% Miss',           fmt: v => v + '%' },
  { key: 'single',       label: '% Singles',        fmt: v => v + '%' },
  { key: 'double',       label: '% Doubles',        fmt: v => v + '%' },
  { key: 'treble',       label: '% Trebles',        fmt: v => v + '%' },
  { key: 'bulls',        label: '% Bulls (I+O)',    fmt: v => v + '%' },

  { key: 'sixtyPlus',    label: '60+ Rounds',       fmt: v => String(v) },
  { key: 'hundredPlus',  label: '100+ Rounds',      fmt: v => String(v) },
  { key: 'oneFortyPlus', label: '140+ Rounds',      fmt: v => String(v) },

  { key: 'avg9',         label: 'Avg (last 9)',     fmt: v => v.toFixed(1) },
  { key: 'avgRound',     label: 'Avg (round)',      fmt: v => v.toFixed(1) },
  { key: 'avgGame',      label: 'Avg (throw)',      fmt: v => v.toFixed(1) },
  { key: 'singleStreak', label: 'Single Streak',    fmt: v => String(v) },
  { key: 'roundStreak',  label: 'Round Streak',     fmt: v => String(v) },

  // NEW: top-3 lists
  { key: 'bestNumbers',  label: 'Best Numbers',     fmt: formatTop3Inline },
  { key: 'worstNumbers', label: 'Worst Numbers',    fmt: formatTop3Inline },
];

// What the popups actually render
const DISPLAY_METRICS = [
  { key: 'wins',          label: 'Game Wins',              kind: 'wins' },
  { sep: true },

  { key: 'miss',          label: 'Miss %',                 fmt: v => v + '%' },
  { key: 'single',        label: 'Single %',               fmt: v => v + '%' },
  { key: 'double',        label: 'Double %',               fmt: v => v + '%' },
  { key: 'treble',        label: 'Trebles %',              fmt: v => v + '%' },
  { key: 'bulls',         label: 'Bulls % (I+O)',          fmt: v => v + '%' },
  { sep: true },

  { key: 'sixtyPlus',     label: '60+ Round',              fmt: v => String(v) },
  { key: 'hundredPlus',   label: '100+ Round',             fmt: v => String(v) },
  { key: 'oneFortyPlus',  label: '140+ Round',             fmt: v => String(v) },
  { sep: true },

  { key: 'avgGame',       label: 'Avg Throw',              fmt: v => v.toFixed(1) },
  { key: 'avgRound',      label: 'Avg Round',              fmt: v => v.toFixed(1) },
  { key: 'avg9',          label: 'Avg Last 9',             fmt: v => v.toFixed(1) },
  { sep: true },

  { key: 'singleStreak',  label: 'Single Streak',          fmt: v => String(v) },
  { key: 'roundStreak',   label: 'Round Streak',           fmt: v => String(v) },
  { sep: true },

  // NEW: multi-line rows rendered specially in the popups
  { key: 'bestNumbers',   label: 'Best Numbers',           multi: true },
  { key: 'worstNumbers',  label: 'Worst Numbers',          multi: true },
];

function computeStatsFromBoards(boards, pIdx) {
  // Flatten darts (in order) and collect per-round info
  const dartsFlat = [];
  const perRoundHit = [];          // boolean per round (any scoring dart)
  let rounds60 = 0, rounds100 = 0, rounds140 = 0;
  let completedRounds = 0, completedPoints = 0;

  // Weighted-hit tracking for 10..20 (S=1, D=2, T=3); bulls excluded
  const numAttempts = {};       // total darts aimed at that number
  const numWeightedHits = {};   // sum of weights of successful hits

  function addAttempt(n){ numAttempts[n] = (numAttempts[n] || 0) + 1; }
  function addWeighted(n,w){ numWeightedHits[n] = (numWeightedHits[n] || 0) + w; }

  (boards || []).forEach(board => {
    const playerBoard = board?.[pIdx];
    if (!playerBoard) return;

    for (let r = 0; r < MAX_ROUNDS; r++) {
      const roundDef = ROUNDS[r];
      const entry = playerBoard[r];
      const darts = entry?.darts || [];
      const rt = entry?.roundTotal || 0;

      if (rt > 0) { completedRounds++; completedPoints += rt; }
      if (rt >=  60) rounds60++;
      if (rt >= 100) rounds100++;
      if (rt >= 140) rounds140++;

      let anyHit = false;

      darts.forEach(d => {
        if (!d) return;
        dartsFlat.push({ dart: d, roundDef });
        const points = d.points || 0;
        if (points > 0) anyHit = true;

        // Attempts/weighted hits by number (10..20)
        if (roundDef.type === 'number') {
          const n = roundDef.target;
          if (n >= 10 && n <= 20) {
            addAttempt(n);
            if (points > 0) {
              const w = (d.kind === 'T' || d.kind === 'Triple') ? 3 :
                        (d.kind === 'D' || d.kind === 'Double') ? 2 : 1;
              addWeighted(n, w);
            }
          }
        } else if ((roundDef.type === 'doubles' || roundDef.type === 'triples') && d.sector) {
          const n = d.sector;
          if (n >= 10 && n <= 20) {
            addAttempt(n); // only count when we know the sector
            if (points > 0) addWeighted(n, roundDef.type === 'doubles' ? 2 : 3);
          }
        }
        // Bulls are ignored for best/worst number calc (by design)
      });

      perRoundHit.push(anyHit);
    }
  });

  const n = dartsFlat.length;
  let miss=0, single=0, double=0, treble=0, bulls=0, pts=0;
  let curHitStreak=0, bestHitStreak=0;

  dartsFlat.forEach(({ dart }) => {
    const p = dart.points || 0;
    pts += p;
    if (p > 0) { curHitStreak++; bestHitStreak = Math.max(bestHitStreak, curHitStreak); }
    else curHitStreak = 0;

    if (dart.kind === 'Miss') miss++;
    else if (dart.kind === 'B') bulls++;
    else if (dart.kind === 'S' || dart.kind === 'Single') single++;
    else if (dart.kind === 'D' || dart.kind === 'Double') double++;
    else if (dart.kind === 'T' || dart.kind === 'Triple') treble++;
  });

  const pct = v => n ? Math.round((v / n) * 100) : 0;

  // Avg of last 9 throws
  const last9 = dartsFlat.slice(-9);
  const sum9  = last9.reduce((a, x) => a + (x.dart.points || 0), 0);
  const avg9  = last9.length ? (sum9 / last9.length) : 0;

  const avgGame  = n ? (pts / n) : 0;
  const avgRound = completedRounds ? (completedPoints / completedRounds) : 0;

  // Round streak (consecutive rounds with any score)
  let curR = 0, bestR = 0;
  perRoundHit.forEach(hit => {
    if (hit) { curR++; bestR = Math.max(bestR, curR); } else curR = 0;
  });

  // Best / Worst numbers by weighted hit % (10..20 only)
  const scored = [];
  for (let num = 10; num <= 20; num++) {
    const att = numAttempts[num] || 0;
    if (!att) continue;
    const p = (numWeightedHits[num] || 0) / (3 * att); // 0..1
    scored.push({ num, pct: p });
  }
  scored.sort((a, b) => b.pct - a.pct);
  const best3  = scored.slice(0, 3).map(x => `${x.num} (${Math.round(x.pct * 100)}%)`);
  const worst3 = scored.slice(-3).reverse().map(x => `${x.num} (${Math.round(x.pct * 100)}%)`);

  return {
    miss: pct(miss),
    single: pct(single),
    double: pct(double),
    treble: pct(treble),
    bulls: pct(bulls),

    sixtyPlus:    rounds60,
    hundredPlus:  rounds100,
    oneFortyPlus: rounds140,

    avg9,
    avgRound,
    avgGame,

    singleStreak: bestHitStreak,
    roundStreak:  bestR,

    // top-3 lists + backward-compat single value
    bestNumber:   best3[0] || '—',
    worstNumber:  worst3[0] || '—',
    bestNumbers:  best3,
    worstNumbers: worst3,

    totalThrows:  n,
    totalHits:    n - miss,
    totalMisses:  miss
  };
}

// Per-game stats (current board only)
function computeStatsForPlayerGame(pIdx) {
  return computeStatsFromBoards([state.score], pIdx);
}

// Per-match stats (all finished games + current game)
function computeStatsForPlayerMatch(pIdx) {
  const boards = [];

  if (state.match && Array.isArray(state.match.history)) {
    state.match.history.forEach(g => {
      if (g && Array.isArray(g.board)) boards.push(g.board);
    });
  }

  if (state.score && state.score[pIdx]) {
    boards.push(state.score);
  }

  if (!boards.length) {
    return computeStatsFromBoards([], pIdx);
  }
  return computeStatsFromBoards(boards, pIdx);
}
function buildStatsHeader(){ 
  statsThead.innerHTML = '';
  const tr = document.createElement('tr');

  const thLabel = document.createElement('th');
  thLabel.textContent = 'Game Stats';
  tr.appendChild(thLabel);

  // one column per player (we keep header blank – names are in the popup)
  for (let i = 0; i < state.players.length; i++) {
    const th = document.createElement('th');
    th.className = 'player';
    tr.appendChild(th);
  }

  statsThead.appendChild(tr);
}

function buildStatsBody(){ 
  statsTbody.innerHTML = '';

  METRICS.forEach(m => {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.className = 'stats-th';
    th.textContent = m.label;
    tr.appendChild(th);

    for (let p = 0; p < state.players.length; p++) {
      const td = document.createElement('td');
      td.className = 'center num player';
      td.id = `stat-${m.key}-${p}`;    // used by updateStatsRows()
      td.textContent = '—';
      tr.appendChild(td);
    }

    statsTbody.appendChild(tr);
  });
}

function buildMatchStatsHeader(){ 
  mstatsThead.innerHTML = '';
  const tr = document.createElement('tr');

  const thLabel = document.createElement('th');
  thLabel.textContent = 'Match Stats';
  tr.appendChild(thLabel);

  for (let i = 0; i < state.players.length; i++) {
    const th = document.createElement('th');
    th.className = 'player';
    tr.appendChild(th);
  }

  mstatsThead.appendChild(tr);
}

function buildMatchStatsBody(){ 
  mstatsTbody.innerHTML = '';

  METRICS.forEach(m => {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.className = 'stats-th';
    th.textContent = m.label;
    tr.appendChild(th);

    for (let p = 0; p < state.players.length; p++) {
      const td = document.createElement('td');
      td.className = 'center num player';
      td.id = `mstat-${m.key}-${p}`;   // used by updateMatchStats()
      td.textContent = '—';
      tr.appendChild(td);
    }

    mstatsTbody.appendChild(tr);
  });
}

// Fill the hidden match-stats table so widths stay in sync and data is there if needed
function updateMatchStats(){ 
  for (let i = 0; i < state.players.length; i++) {
    const v = computeStatsForPlayerMatch(i);
    for (const m of METRICS) {
      const td = byId(`mstat-${m.key}-${i}`);
      if (td) td.textContent = m.fmt(v[m.key]);
    }
  }
}

// Keep the score table focused on the most recent rounds (show 3 rows: current + previous 2)
// ===== @JS:UI:GAMEPLAY:AUTOSCROLL =====

// >>> PATCH:livev2-mobile-window START
function __sqSetupMobileScoreWindow(){
  try{
    if (document.body.getAttribute('data-page') !== 'game') return;
    if (((window.innerWidth || 9999) > 480) && !document.documentElement.classList.contains('force-mobile')) return;

    const scoreWrap = document.getElementById('scoreWrap');
    const table = document.getElementById('scoreTable');
    const tbodyEl = document.getElementById('tbody');
    const theadEl = table ? table.querySelector('thead') : null;
    if (!scoreWrap || !tbodyEl || !theadEl) return;

    // Hide future (unplayed) rounds in the DOM so the 4-row window never shows them.
    // Users can scroll back (history) but cannot scroll forward into unplayed rows.
    try{
      const curIdx = (typeof state !== 'undefined' && typeof state.currentRound === 'number') ? state.currentRound : 0;
      const rows = tbodyEl.rows || [];
      for (let i = 0; i < rows.length; i++){
        rows[i].style.display = (i > curIdx) ? 'none' : '';
      }
    }catch(_){/* ignore */}

    // Force internal scrolling on mobile so only the “window” is visible.
    scoreWrap.style.overflowY = 'auto';

    const row0 = tbodyEl.rows && tbodyEl.rows[0];
    // Use offsetHeight so borders are included; more stable than getBoundingClientRect on Safari.
    const rowH = Math.max(44, Math.round((row0 && row0.offsetHeight) || 52));
    const headH = Math.max(36, Math.round(theadEl.offsetHeight || theadEl.getBoundingClientRect().height || 44));

    // Show exactly previous 2 rounds + current round = 3 rows.
    // Exactly 3 visible rows (current + previous 2). No extra padding, otherwise a 4th row peeks in.
    const wantH = Math.round(headH + (rowH * 3));
    scoreWrap.style.setProperty('--sqScoreWinH', wantH + 'px');
    // Use CSS !important rules to apply height/max-height on mobile (see PATCH:livev2-mobile-win-css)
    scoreWrap.style.height = '';
    scoreWrap.style.maxHeight = '';

    // Stash for scroll clamping.
    scoreWrap.__sqRowH = rowH;
    scoreWrap.__sqHeadH = headH;
  }catch(_){}
}
// <<< PATCH:livev2-mobile-window END

function autoScrollScoreboard(){
  const scoreWrap = document.getElementById('scoreWrap');
  const tbodyEl = document.getElementById('tbody');
  if (!tbodyEl) return;

  // Mobile: constrain the scoreboard to 4 visible rounds (3 previous + current).
  __sqSetupMobileScoreWindow();

  // Decide which element actually scrolls:
  // - If scoreWrap is internally scrollable (overflow-y auto/scroll), use it.
  // - Otherwise (classic mode), the page scroller is ".wrap".
  let scroller = null;
  try{
    const oy = scoreWrap ? getComputedStyle(scoreWrap).overflowY : '';
    const internalScrollable = !!(scoreWrap && (oy === 'auto' || oy === 'scroll') && scoreWrap.scrollHeight > scoreWrap.clientHeight + 2);
    scroller = internalScrollable ? scoreWrap : (document.querySelector('body[data-page="game"] .wrap') || document.querySelector('.wrap'));
  }catch(_){
    scroller = document.querySelector('body[data-page="game"] .wrap') || document.querySelector('.wrap') || scoreWrap;
  }
  if (!scroller) return;

  // Measure the fixed throw pad height (so the last round never hides behind it)
  let padH = 0;
  try{
    const padEl = document.getElementById('pad');
    if (padEl){
      padH = Math.max(0, Math.round(padEl.getBoundingClientRect().height || 0));
    }
  }catch(_){}

  // Ensure the scroller has enough bottom space to scroll the last row above the pad.
  // (Safari especially needs explicit padding on the real scrolling element.)
  try{
    const extra = 18;
    const want = Math.max(0, padH + extra);
    const cur = parseInt((scroller.style.paddingBottom || '0').replace('px',''), 10) || 0;
    if (want > cur) scroller.style.paddingBottom = want + 'px';
  }catch(_){}

  // Allow user scroll without snapping back (1500ms guard)
  try{
    if (!scroller.__sqScrollGuard) {
      scroller.__sqScrollGuard = true;
      scroller.addEventListener('scroll', () => {
        // Allow manual back-scroll, but prevent scrolling forward into unplayed rounds.
        scroller.__sqUserScrollUntil = Date.now() + 1500;

        try{
          const maxA = scroller.__sqMaxAllowed;
          if (typeof maxA === 'number' && isFinite(maxA) && scroller.scrollTop > maxA + 2){
            scroller.scrollTop = maxA;
          }
        }catch(_){}
      }, { passive: true });
    }
    if (scroller.__sqUserScrollUntil && Date.now() < scroller.__sqUserScrollUntil) return;
  }catch(_){ }

  const rows = tbodyEl.rows;
  if (!rows || !rows.length) return;

  const endIdx = Math.min(state.currentRound, rows.length - 1);
  if (endIdx < 0) return;

  // Start auto-scrolling once we have at least 3 rounds played (e.g. 10/11/12).
  if (endIdx < 2) return;
  // Show exactly 3 rounds at all times: current + previous 2 (no forward look).
  const startIdx = Math.max(0, endIdx - 2);
  const targetRow = rows[startIdx];
  const endRow = rows[endIdx];
  if (!targetRow || !endRow) return;

  // Clamp forward scrolling so users can look back, but not into future/unplayed rounds.
  try{
    const scRectClamp = scroller.getBoundingClientRect();
    const endRectClamp = endRow.getBoundingClientRect();
    const bottomLimitClamp = scRectClamp.bottom - Math.max(0, padH) - 10;
    // Max scrollTop allowed such that the last played round is still within view.
    let maxAllowed = scroller.scrollTop;
    if (endRectClamp.bottom > bottomLimitClamp){
      maxAllowed = scroller.scrollTop + (endRectClamp.bottom - bottomLimitClamp);
    }
    // Also allow a small slack so the row can sit comfortably above the pad.
    scroller.__sqMaxAllowed = Math.max(0, Math.min(maxAllowed, scroller.scrollHeight - scroller.clientHeight));
  }catch(_){ scroller.__sqMaxAllowed = null; }

  // Compute desired scrollTop inside chosen scroller (anchor to startIdx row)
  let desiredTop = 0;
  try{
    const rowRect = targetRow.getBoundingClientRect();
    const scRect  = scroller.getBoundingClientRect();
    desiredTop = (rowRect.top - scRect.top) + scroller.scrollTop;
    desiredTop = Math.max(0, Math.min(desiredTop, scroller.scrollHeight - scroller.clientHeight));
  }catch(_){
    // Fallback for older browsers: use offsetTop when possible
    desiredTop = Math.max(0, Math.min(targetRow.offsetTop, scroller.scrollHeight - scroller.clientHeight));
  }

  // If the current round is still clipped by the throw pad at the bottom, nudge down.
  try{
    const endRect = endRow.getBoundingClientRect();
    const scRect  = scroller.getBoundingClientRect();
    const bottomLimit = scRect.bottom - Math.max(0, padH) - 10; // 10px breathing room
    if (endRect.bottom > bottomLimit){
      desiredTop += (endRect.bottom - bottomLimit);
      desiredTop = Math.max(0, Math.min(desiredTop, scroller.scrollHeight - scroller.clientHeight));
    }
  }catch(_){}

  if (Math.abs((scroller.scrollTop || 0) - desiredTop) > 2) {
    try{
      scroller.scrollTo({ top: desiredTop, behavior: 'smooth' });
    }catch(_){
      scroller.scrollTop = desiredTop;
    }
  }
}

// >>> PATCH:livev2-panel-js START
// LIVE V2 panel: tiebreak-style gameplay UI for 2–6 players (mobile portrait).
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
window.escHtml = escapeHtml; // several later patches feature-detect a global escHtml and fall back to UNESCAPED text without it

function getLiveV2PlayerCount(){
  try{ return Array.isArray(state?.players) ? state.players.length : 0; }catch(_){ return 0; }
}

function isLiveV2Eligible(){
  try{
    // Standardize LIVE V2 gameplay layout across all platforms for supported player counts.
    // Practice can be solo, so Live V2 must support 1-player games as well as 2–6 player matches.
    if(!document.body || document.body.dataset.page !== "game") return false;
    const pCount = getLiveV2PlayerCount();
    if(!(pCount >= 1 && pCount <= 6)) return false;
    if(typeof FORCE_LIVEV2 === "boolean") return FORCE_LIVEV2;
    return true;
  }catch(_){ return false; }
}

function ensureLiveV2Panel(){
  const panel = document.getElementById("liveV2Panel");
  if(!panel) return null;

  const pCount = getLiveV2PlayerCount();
  const key = String(pCount);

  // Rebuild if player count changed (prevents 2-player markup lingering into 3–6 games)
  if(panel.dataset.built === "1" && panel.dataset.pcount === key) return panel;

  panel.style.setProperty("--sqV2P", String(Math.max(1, Math.min(6, pCount))));

  const scoreBoxes = Array.from({length: Math.max(1, Math.min(6, pCount))}).map((_,i)=>`
    <div class="v2ScoreBox" data-p="${i}">
      <div class="v2Initial" id="v2Init${i}">${escapeHtml(String.fromCharCode(65+i))}</div>
      <div class="v2Total" id="v2Total${i}">0</div>
      <div class="v2Sub" id="v2Sub${i}">0</div>
      <div class="v2WinDots" id="v2WinDots${i}"></div>
    </div>
  `).join("");
  const miniAvgBoxes = Array.from({length: Math.max(1, Math.min(6, pCount))}).map((_,i)=>`
    <div class="v2MiniAvg" data-p="${i}" aria-label="Player averages">
      <span class="v2MiniMetric"><span class="v2MiniLab">3AV</span><strong id="v2Mini3R${i}">–</strong></span>
      <span class="v2MiniMetric"><span class="v2MiniLab">MAV</span><strong id="v2MiniMtc${i}">–</strong></span>
    </div>
  `).join("");

  panel.innerHTML = `
    <div class="v2GameCell" aria-label="Gameplay">
      <div class="v2Scores">
        <div class="v2DotsCol" aria-hidden="true">
          <div class="v2Dot" data-dot="0"></div>
          <div class="v2Dot" data-dot="1"></div>
          <div class="v2Dot" data-dot="2"></div>
        </div>
        <div class="v2ScoreGrid">
          ${scoreBoxes}
          ${miniAvgBoxes}
        </div>
        <div class="v2SoloRecords" id="v2SoloRecords" aria-label="Solo practice PB and WR pace">
          <div class="v2SoloRecordPill is-empty" id="v2SoloPB"><span class="v2SoloRecLabel">PB</span><span class="v2SoloRecValue">– / –</span></div>
          <div class="v2SoloRecordPill is-empty" id="v2SoloWR"><span class="v2SoloRecLabel">WR</span><span class="v2SoloRecValue">– / –</span></div>
        </div>
        <div class="v2SoloVars" id="v2SoloVars" aria-label="Solo practice pace variance">
          <div class="v2SoloVarPill is-empty" id="v2SoloPBVar">–</div>
          <div class="v2SoloVarPill is-empty" id="v2SoloWRVar">–</div>
        </div>
      </div>

      <div class="v2RowsWrap">
        <div class="v2RowsScroller">
          <div class="v2Rows" id="v2Rows"></div>
        </div>
      </div>

      <div class="v2NextRow" id="v2NextRow" aria-label="Next round"></div>

    </div>

    <!-- >>> PATCH:livev2-scoringcell-html START -->
    <!-- removed: v2ScoringCell; v2NextRow moved into v2GameCell -->
<!-- <<< PATCH:livev2-scoringcell-html END -->

    <div class="v2InfoPager" aria-label="Game Race, Game Stats and Game Streak">
      <div class="v2InfoViewport">
        <div class="v2InfoTrack" id="v2InfoTrack" data-page="1">
          <div class="v2InfoPage">
            <div class="v2InfoCell" aria-label="Game Stats">
              <div class="v2AvgWrap" aria-label="Game Stats">
                <div class="v2AvgScroll" id="v2AvgScroll">
                  <div class="v2AvgPage" aria-label="Game Stats">
                    <div class="v2Avg" id="v2Avg"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="v2InfoPage">
            <div class="v2InfoDmdCell" aria-label="Game Race">
              <canvas id="v2InfoDmd" width="320" height="116"></canvas>
            </div>
          </div>

          <div class="v2InfoPage">
            <div class="v2HighCell" aria-label="Game Streak">
              <div class="v2HighWrap" aria-label="Game Streak">
                <div class="v2High" id="v2High"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="v2PagerDots" aria-label="B3 views">
        <div class="v2PagerDot" data-dot="0"></div>
        <div class="v2PagerDot on" data-dot="1"></div>
        <div class="v2PagerDot" data-dot="2"></div>
      </div>
    </div>
  `.trim();

  panel.dataset.built = "1";
  panel.dataset.pcount = key;
  return panel;
}

function roundLabelForIndex(r){
  const th = document.getElementById("roundth-" + r);
  if(th && th.textContent){
    const raw = th.textContent.trim();
    const mm = raw.match(/^\s*(\d+)\s*s\s*$/i);
    return mm ? mm[1] : raw;
  }
  return String(r + 1);
}

function getPlayerInitial(i){
  try{
    const p = state.players?.[i];
    if (typeof __sqVsShadowDisplayLabelForPlayer === 'function') {
      const shadowLabel = __sqVsShadowDisplayLabelForPlayer(p, { compact:true });
      if (shadowLabel) return shadowLabel;
    }
  }catch(_){ }
  const name = (state.players?.[i]?.name || state.players?.[i] || "").toString().trim();
  // Two initials:
  // - If name has multiple words -> first letter of first + first letter of last
  // - If single word -> first two letters (or duplicate the first if only one)
  // - If blank -> AA, BB, CC...
  if(!name){
    const ch = String.fromCharCode(65 + i);
    return (ch + ch);
  }
  const parts = name.split(/\s+/).filter(Boolean);
  let a = "", b = "";
  if(parts.length >= 2){
    a = (parts[0][0] || "");
    b = (parts[parts.length-1][0] || "");
  }else{
    a = (name[0] || "");
    b = (name[1] || name[0] || "");
  }
  return (a + b).toUpperCase();
}

function getPlayerName(i){
  const p = state.players?.[i];
  try{
    if (typeof __sqVsShadowDisplayLabelForPlayer === 'function') {
      const shadowLabel = __sqVsShadowDisplayLabelForPlayer(p, { graph:true });
      if (shadowLabel) return shadowLabel;
    }
  }catch(_){ }
  const name = (p && typeof p === 'object' ? (p.name || p.fullName || p.displayName) : p);
  return String(name || '').trim();
}

// Live V2 uses PB/WR snapshot for per-round WR/PB borders.
// Keep it cached and refresh once when needed.
async function __sqEnsurePBGRSnapshot(){
  try{
    if (window.__pbgrSnapshot && window.__pbgrSnapshot.__ts && (Date.now() - window.__pbgrSnapshot.__ts) < 60_000) return window.__pbgrSnapshot;
    if (window.__pbgrSnapshotPromise) return window.__pbgrSnapshotPromise;
    if (typeof getPBGRSnapshot !== 'function') return (window.__pbgrSnapshot || null);

    window.__pbgrSnapshotPromise = getPBGRSnapshot()
      .then(snap => {
        if (snap && typeof snap === 'object'){
          try{ Object.defineProperty(snap, '__ts', { value: Date.now(), enumerable:false }); }catch(_){ snap.__ts = Date.now(); }
          window.__pbgrSnapshot = snap;
        }
        window.__pbgrSnapshotPromise = null;
        return window.__pbgrSnapshot;
      })
      .catch(()=>{ window.__pbgrSnapshotPromise = null; return window.__pbgrSnapshot || null; });

    return window.__pbgrSnapshotPromise;
  }catch(_){
    return window.__pbgrSnapshot || null;
  }
}

function __sqCatForRoundIdx(r){
  try{
    const rd = (typeof ROUNDS !== "undefined") ? ROUNDS[r] : null;
    if (!rd) return null;
    if (rd.type === 'number')  return String(rd.target);
    if (rd.type === 'doubles') return 'D';
    if (rd.type === 'triples') return 'T';
    if (rd.type === 'bull')    return 'B';
  }catch(_){}
  // fallback: already stripped "10s" -> "10"
  const lbl = String(roundLabelForIndex(r) || '').trim();
  const m = lbl.match(/^(\d+)/);
  if (m) return m[1];
  return null;
}

  

// >>> PATCH:v2-pbwr-views START
// Prefer database-derived clean app PB/WR views for Live V2 cell edging.
// Keeps UI consistent across devices and avoids client-side divergence.
function __sqRoundKeyForIdx(r){
  const cat = __sqCatForRoundIdx(r);
  if (cat === 'D') return 'D_ANY';
  if (cat === 'T') return 'T_ANY';
  if (cat === 'B') return 'BULL_ANY';
  // Numeric rounds are 10->20, stored as round_number 1..11 in DB.
  return 'N' + String((Number(r) || 0) + 1);
}

function __sqResolveBucketKeyForPlayer(i){
  const p = state.players?.[i];
  if (p && typeof p === 'object'){
    const bk = (p.bucket_key ?? p.bucketKey ?? p.bucket ?? p.bk);
    if (bk != null && String(bk).trim() !== '') return String(bk).trim();
  }
  const nameLC = getPlayerName(i).toLowerCase();
  const map = window.__v2PBWRNameToBucket || null;
  if (map && typeof map.get === 'function') return map.get(nameLC) || null;
  return null;
}

async function __sqEnsureV2PBWR(){
  try{
    const ttl = 5 * 60_000; // 5 minutes
    if (window.__v2PBWRSnapshot && window.__v2PBWRSnapshot.__ts && (Date.now() - window.__v2PBWRSnapshot.__ts) < ttl) return window.__v2PBWRSnapshot;
    if (window.__v2PBWRSnapshotPromise) return window.__v2PBWRSnapshotPromise;
    if (typeof sb === 'undefined' || !sb) return window.__v2PBWRSnapshot || null;

    window.__v2PBWRSnapshotPromise = (async () => {
      // Build name -> bucket_key map from saved players (best-effort).
      try{
        if (typeof cloudListPlayers === 'function'){
          const saved = await cloudListPlayers();
          const m = new Map();
          for (const p of (saved || [])){
            const nm = String(p?.name || '').trim().toLowerCase();
            const bk = (p?.bucket_key ?? p?.bucketKey ?? p?.bucket ?? p?.bk ?? p?.id);
            if (!nm || bk == null) continue;
            // First one wins; if duplicates exist, PB will be ambiguous by name anyway.
            if (!m.has(nm)) m.set(nm, String(bk).trim());
          }
          window.__v2PBWRNameToBucket = m;
        }
      }catch(_){}

      // Fetch WR + PB (views are small: 14-ish rows for WR, PB is per player x 14-ish)
      const [wrRes, pbRes] = await Promise.all([
        sb.from(TABLE_WR_ROUNDS_CLEAN_APP).select('round_key, wr_points'),
        sb.from(TABLE_PB_ROUNDS_CLEAN_APP).select('bucket_key, round_key, pb_points')
      ]);

      if (wrRes?.error) throw wrRes.error;
      if (pbRes?.error) throw pbRes.error;

      const wrByRound = new Map();
      for (const r of (wrRes.data || [])){
        const k = String(r.round_key || '').trim();
        if (!k) continue;
        wrByRound.set(k, Number(r.wr_points || 0));
      }

      const pbByBucket = new Map(); // bucket_key -> Map(round_key -> pb_points)
      for (const r of (pbRes.data || [])){
        const bk = String(r.bucket_key ?? '').trim();
        const rk = String(r.round_key || '').trim();
        if (!bk || !rk) continue;
        let m = pbByBucket.get(bk);
        if (!m){ m = new Map(); pbByBucket.set(bk, m); }
        m.set(rk, Number(r.pb_points || 0));
      }

      const snap = { wrByRound, pbByBucket };
      try{ Object.defineProperty(snap, '__ts', { value: Date.now(), enumerable:false }); }catch(_){ snap.__ts = Date.now(); }
      window.__v2PBWRSnapshot = snap;
      return snap;
    })().finally(() => { window.__v2PBWRSnapshotPromise = null; });

    return window.__v2PBWRSnapshotPromise;
  }catch(e){
    // Don't break gameplay if PB/WR can't load.
    console.warn('[SQ] v2 PB/WR views unavailable:', e?.message || e);
    window.__v2PBWRSnapshotPromise = null;
    return window.__v2PBWRSnapshot || null;
  }
}
// <<< PATCH:v2-pbwr-views END

function getPlayerTotal(i){
  try{
    if(typeof totalScoreForPlayer === "function"){
      const v = totalScoreForPlayer(i);
      return Number.isFinite(+v) ? +v : 0;
    }
  }catch(_){}
  const p = state.players?.[i];
  const v = (p && (p.total ?? p.score ?? p.points)) ?? (state.totals?.[i] ?? 0);
  return Number.isFinite(+v) ? +v : 0;
}

function getPerRoundScore(r, i){
  try{
    const rt = state?.score?.[i]?.[r]?.roundTotal;
    if(Number.isFinite(+rt)) return +rt;
  }catch(_){}
  try{
    const s = state?.scores?.[r]?.[i];
    if(Number.isFinite(+s)) return +s;
  }catch(_){}
  const sub = document.getElementById(`cell-sub-${i}-${r}`);
  if(sub){
    const t = (sub.textContent || "").trim();
    const n = parseInt(t, 10);
    if(Number.isFinite(n)) return n;
  }
  const td = document.getElementById(`cell-${i}-${r}`);
  if(td){
    const t = (td.textContent || "").trim();
    const n = parseInt(t, 10);
    if(Number.isFinite(n)) return n;
  }
  return null;
}

function __sqFmtAvg(n){
  if(!Number.isFinite(+n)) return "–";
  const v = Math.round((+n) * 10) / 10;
  return (Math.abs(v - Math.round(v)) < 1e-9) ? String(Math.round(v)) : v.toFixed(1);
}

function __sqV2LiveAveragePair(pIdx, currentRound){
  try{
    const vals = [];
    const cr = Math.max(0, Number(currentRound) || 0);
    for(let r = 0; r <= cr; r++){
      const entry = state.score?.[pIdx]?.[r];
      const done = (r < cr) || (entry && entry.darts && entry.darts[2] != null);
      if(!done) continue;
      const v = getPerRoundScore(r, pIdx);
      if(Number.isFinite(+v)) vals.push(+v);
    }
    const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : NaN;
    return { r3: mean(vals.slice(-3)), mtc: mean(vals), count: vals.length };
  }catch(_){ return { r3:NaN, mtc:NaN, count:0 }; }
}

function __sqSetupLiveV2Sizing(panel){
  try{
    const pCount = getLiveV2PlayerCount();
    if(!panel || !pCount) return;
    const grid = panel.querySelector('.v2ScoreGrid');
    if(!grid) return;

    // Gaps scale down as players increase.
    const gap = (pCount <= 3) ? 12 : (pCount === 4 ? 10 : 8);
    panel.style.setProperty('--sqV2Gap', gap + 'px');
    panel.style.setProperty('--sqV2RowGapX', gap + 'px');
    panel.style.setProperty('--sqV2RowGapY', '10px');

    // Calculate pill width based on available grid width.
    const gw = Math.max(1, grid.getBoundingClientRect().width);
    const pillW = Math.max(44, Math.floor((gw - (gap * (pCount - 1))) / pCount));

    // Height + typography scale with pill width (keeps 5–6 players readable on iPhone portrait).
    const scoreH = Math.max(64, Math.min(98, Math.floor(pillW * 1.05)));
    const totalF = Math.max(18, Math.min(34, Math.floor(pillW * 0.54)));
    const totalF2 = (pCount === 6) ? Math.min(totalF, 18) : totalF;
    const initF  = Math.max(12, Math.min(16, Math.floor(pillW * 0.26)));
    const subF   = Math.max(10, Math.min(12, Math.floor(pillW * 0.20)));

    const cellH  = Math.max(44, Math.min(58, Math.floor(pillW * 0.72)));
    const cellF  = Math.max(16, Math.min(24, Math.floor(pillW * 0.40)));

    panel.style.setProperty('--sqV2ScoreH', scoreH + 'px');
    panel.style.setProperty('--sqV2TotalF', totalF2 + 'px');
    panel.style.setProperty('--sqV2InitF', initF + 'px');
    panel.style.setProperty('--sqV2SubF', subF + 'px');
    panel.style.setProperty('--sqV2CellH', cellH + 'px');
    panel.style.setProperty('--sqV2CellF', cellF + 'px');

    // Padding tightens as players increase.
    const padX = (pCount <= 3) ? 10 : 8;
    const padY = (pCount <= 3) ? 12 : 10;
    panel.style.setProperty('--sqV2ScorePadX', padX + 'px');
    panel.style.setProperty('--sqV2ScorePadY', padY + 'px');
  }catch(_){}
}

// >>> PATCH:V30_INFO_RECORDS_PAGER_JS START
function __sqSetupV2InfoPager(panel){
  try{
    const track = panel.querySelector('#v2InfoTrack');
    if(!track) return;
    const viewport = panel.querySelector('.v2InfoViewport');

    // Idempotent: do not bind twice
    if(track.dataset.bound === "1") {
      // still ensure correct transform (in case DOM was rebuilt)
      let page0 = parseInt(track.dataset.page || '1', 10);
      if(!(page0 === 0 || page0 === 1 || page0 === 2)) page0 = 1;
      __sqV2SetPagerPage(panel, page0, false);
      return;
    }
    track.dataset.bound = "1";

    // preserve page index across renders
    let page = parseInt(track.dataset.page || '1', 10);
    if(!(page === 0 || page === 1 || page === 2)) page = 1;
    __sqV2SetPagerPage(panel, page, false);

    const dots = panel.querySelectorAll('.v2PagerDot');
    dots.forEach(d=>{
      d.addEventListener('click', ()=>{
        const p = parseInt(d.getAttribute('data-dot')||'0',10) || 0;
        __sqV2SetPagerPage(panel, p, true);
      }, {passive:true});
    });

    // Swipe support (mobile Safari + desktop):
    // Bind ONLY to the viewport so we never steal taps from the scoring buttons.
    let startX=0,startY=0,lastX=0,lastY=0,dragging=false,lockedAxis='';
    const pagerEl = (viewport || panel.querySelector('.v2InfoViewport') || track.parentElement || panel);

    const reset=()=>{ dragging=false; lockedAxis=''; };
    const onStart=(x,y)=>{ startX=lastX=x; startY=lastY=y; dragging=true; lockedAxis=''; };
    const onMove=(x,y)=>{ if(!dragging) return; lastX=x; lastY=y; if(!lockedAxis){
        const dx=Math.abs(lastX-startX), dy=Math.abs(lastY-startY);
        if(dx>10 || dy>10) lockedAxis = (dx>dy)?'x':'y';
      }
    };
    const onEnd=()=>{ if(!dragging) return; const dx=lastX-startX, dy=lastY-startY; const absX=Math.abs(dx), absY=Math.abs(dy); reset();
      if(absX<40 || absX<absY) return;
      const cur=parseInt(track.dataset.page||'0',10)||0;
      const next = dx<0 ? Math.min(2,cur+1) : Math.max(0,cur-1);
      __sqV2SetPagerPage(panel,next,true);
    };

    // Touch
    pagerEl.addEventListener('touchstart',(e)=>{ const t=e.touches&&e.touches[0]; if(!t) return; onStart(t.clientX,t.clientY); }, {passive:true});
    pagerEl.addEventListener('touchmove',(e)=>{ const t=e.touches&&e.touches[0]; if(!t) return; onMove(t.clientX,t.clientY);
      // If the user is swiping horizontally, prevent the page from scrolling.
      if(lockedAxis==='x') { try{ e.preventDefault(); }catch(_){} }
    }, {passive:false});
    pagerEl.addEventListener('touchend',(e)=>{ const t=(e.changedTouches&&e.changedTouches[0])||null; if(t) onMove(t.clientX,t.clientY); onEnd(); }, {passive:true});
    pagerEl.addEventListener('touchcancel',reset,{passive:true});

    // Pointer
    pagerEl.addEventListener('pointerdown',(e)=>{ if(e.pointerType==='mouse' && e.buttons!==1) return; onStart(e.clientX,e.clientY); }, {passive:true});
    pagerEl.addEventListener('pointermove',(e)=>{ if(!dragging) return; onMove(e.clientX,e.clientY); }, {passive:true});
    pagerEl.addEventListener('pointerup',(e)=>{ onMove(e.clientX,e.clientY); onEnd(); }, {passive:true});
    pagerEl.addEventListener('pointercancel',reset,{passive:true});

    // Make intent explicit for iOS
    try{ if(pagerEl && pagerEl.style) pagerEl.style.touchAction = 'pan-y'; }catch(_){ }
  }catch(_){}
}

function __sqV2SetPagerPage(panel, page, animate){
  try{
    const track = panel.querySelector('#v2InfoTrack');
    if(!track) return;
    if(!(page === 0 || page === 1 || page === 2)) page = 1;
    if(!animate) track.style.transition = 'none';
    const pct = (100/3) * page;
    track.style.transform = `translateX(-${pct}%)`;
    track.dataset.page = String(page);
    if(!animate){
      // force reflow then restore transition
      void track.offsetWidth;
      track.style.transition = '';
    }
    const dots = panel.querySelectorAll('.v2PagerDot');
    dots.forEach(d=>{
      d.classList.toggle('on', (d.getAttribute('data-dot') === String(page)));
    });
      try{ if(page===1){ window.__sqV2InfoDmdUpdate?.(); } }catch(_){ }
  }
  catch(_){}
}
// >>> PATCH:V30_INFO_RECORDS_PAGER_JS END

// >>> PATCH:V2_INFO_DMD_PAGE START
// B3a canonical view: Game Race
(function(){
  if (window.__sqV2CommentaryInit) return;
  window.__sqV2CommentaryInit = true;

  const PALETTE = ['#7bdcff','#8cff9e','#ffcc66','#ff8ea1','#c5a3ff','#79ffd5'];

  function getCanvas(){
    return document.getElementById('v2InfoDmd');
  }

  function roundsCount(){
    try{ return Math.max(1, Array.isArray(ROUNDS) ? ROUNDS.length : (MAX_ROUNDS || 14)); }catch(_){ return 14; }
  }

  function roundLabel(i){
    try{
      if (typeof roundLabelForIndex === 'function') return String(roundLabelForIndex(i) || '');
      const r = Array.isArray(ROUNDS) ? ROUNDS[i] : null;
      if (!r) return String(i + 1);
      if (r.type === 'number') return String(r.target);
      if (r.type === 'doubles') return 'D';
      if (r.type === 'triples') return 'T';
      return 'B';
    }catch(_){ return String(i + 1); }
  }

  function legendLabelForSeriesName(name){
    try{
      const s = String(name || '').trim();
      if (!s) return '--';
      if (/^Record:/i.test(s)) return 'HS';
      if (/^[A-Z0-9]{1,3}\s+(?:PB|GHOST)$/i.test(s)) return s.toUpperCase();
      const parts = s.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return ((parts[0][0] || '') + (parts[parts.length-1][0] || '')).toUpperCase();
      return s.slice(0,2).toUpperCase();
    }catch(_){ return '--'; }
  }

  function buildLiveSeries(){
    const rc = roundsCount();
    const out = [];
    const pList = Array.isArray(state.players) ? state.players : [];
    const cr = Number(state.currentRound || 0);

    for(let p=0; p<pList.length; p++){
      const player = pList[p] || {};
      let running = 0;
      let throwRunning = 0;
      const data = [];
      const throwData = [0];
      let startedAny = false;

      for(let r=0; r<rc; r++){
        const entry = state.score?.[p]?.[r];
        const darts = Array.isArray(entry?.darts) ? entry.darts.filter(v => v != null) : [];
        const started = !!entry && (darts.length > 0 || Number(entry?.roundTotal || 0) > 0);
        const done = (r < cr) || darts.length >= 3;
        // SC-021: retain canonical round totals, but expose a read-only per-throw
        // cumulative path for Classic race motion. Misses append the same Y value
        // while still advancing one X step.
        for (const dart of darts){
          const pts = (typeof __sqV2DartPoints === 'function')
            ? __sqV2DartPoints(dart)
            : Number(dart && (dart.points ?? dart.score ?? dart.value ?? dart.total)) || 0;
          throwRunning += Number.isFinite(Number(pts)) ? Number(pts) : 0;
          throwData.push(throwRunning);
        }

        if (r > cr && !started) {
          data.push(null);
          continue;
        }
        if (!started && !done && !startedAny && r >= cr) {
          data.push(null);
          continue;
        }

        startedAny = startedAny || done || started;
        const rt = Number(entry?.roundTotal || 0);
        running += rt;
        data.push(running);
      }

      // trim anything after the last finite point so future rounds do not draw at zero or flatline
      let lastFinite = -1;
      for (let i = 0; i < data.length; i++) if (Number.isFinite(data[i])) lastFinite = i;
      const trimmed = data.map((v, i) => i <= lastFinite ? v : null);

      out.push({
        key: 'p' + p,
        name: String((typeof __sqVsShadowDisplayLabelForPlayer === 'function' && __sqVsShadowDisplayLabelForPlayer(player, { graph:true })) || player.name || player.fullName || player.displayName || ('P' + (p+1))),
        color: player.color || PALETTE[p % PALETTE.length],
        data: trimmed,
        throwData,
        dotted: false
      });
    }
    return out;
  }

  async function getRecordSeries(){
    try{
      const rc = roundsCount();
      try{ window.__sqV2RaceRecord = null; window.__sqV2RaceRecordPromise = null; }catch(_){}
      return (typeof buildRecordPaceSeries === 'function')
        ? await buildRecordPaceSeries(rc).catch(()=>null)
        : null;
    }catch(_){
      return null;
    }
  }

  function sigFor(series, rec, records){
    const recSig = Array.isArray(records)
      ? records.map(r => (r && r.data ? r.data.join(',') : '')).join('||')
      : ((rec && rec.data) ? rec.data.join(',') : '');
    const arr = series.map(s => s.data.join(',') + '>' + (Array.isArray(s.throwData) ? s.throwData.join(',') : '')).join('|') + '||' + recSig;
    return arr;
  }

  // Both live layouts use the beta renderer; Classic retains its canonical
  // mode-aware reference packets and never starts a second record query.
  let racePacket = null, raceCanvas = null, raceRaf = 0, raceBoard = null;
  const raceMotion = {grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
  function raceFrame(now){
    raceRaf = 0;
    if (!raceCanvas || !raceCanvas.isConnected || document.body.dataset.page !== 'game' || document.body.classList.contains('livev3-on')) return;
    if (raceCanvas.getBoundingClientRect().width) __sqDrawArcadeRace(raceCanvas, racePacket, raceMotion, now);
    raceRaf = requestAnimationFrame(raceFrame);
  }
  function drawRace(canvas, packet){
    if (raceBoard !== state.score) {
      raceBoard = state.score;
      Object.assign(raceMotion, {grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0});
    }
    raceCanvas = canvas; racePacket = packet;
    if (!raceRaf) raceRaf = requestAnimationFrame(raceFrame);
  }
  let renderVersion = 0;

  async function render(){
    const version = ++renderVersion;
    const canvas = getCanvas();
    if (!canvas) return;

    let labels = Array.from({length: roundsCount()}, (_,i)=>roundLabel(i));
    let live = buildLiveSeries();

    const __turboRace = (typeof __sqIsTurboRaceRuntimeState === 'function') ? __sqIsTurboRaceRuntimeState(state) : (()=>{ try{ const m = state?.match || {}; const draft = window.__sqTournamentDraft || state?.__sqTournamentDraft || null; const type = String(m.tournamentType || m.type || draft?.type || state?.tournamentType || '').toLowerCase(); return !!(type === 'turbo' || m.strictTimer === true || m.throwLimitSeconds === 20 || state?.strictTimer === true || state?.throwLimitSeconds === 20); }catch(_){ return false; } })();
    const __raceMatch = state?.match || {};
    const __raceModeKeys = [state?.mode, state?.gameMode, state?.game_mode, __raceMatch.mode, __raceMatch.gameMode, __raceMatch.game_mode]
      .map(v => String(v || '').trim().toLowerCase());
    const __practiceRace = __raceModeKeys.some(v => ['practice','unofficial','solo'].includes(v)) ||
      state?.isPractice === true || state?.is_practice === true || state?.practice === true ||
      __raceMatch.forcePractice === true || __raceMatch.isPractice === true || __raceMatch.is_practice === true || __raceMatch.practice === true;
    const __shadowRace = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() :
      !!(state?.practiceVsShadow || state?.vsShadow || state?.vs_shadow || String(state?.shadow?.mode || '').toLowerCase() === 'vsshadow' || String(__raceMatch.practiceType || '').toLowerCase() === 'vsshadow' || __raceModeKeys.includes('vsshadow'));
    // Keep the SC-021 Classic routing contract intact. Turbo gets the same modern
    // per-throw presentation through its own mode-isolated packet flag.
    const __classicThrowRace = live.length >= 2 && !__turboRace && !__practiceRace && !__shadowRace;
    const __turboThrowRace = live.length >= 2 && __turboRace && !__practiceRace && !__shadowRace;
    const __turboStartIdx = (typeof __sqTurboRaceStartIndex === 'function') ? __sqTurboRaceStartIndex(state, roundsCount()) : (()=>{ try{ const rules = state?.match?.tournamentRules || state?.__sqTournamentDraft?.rules || window.__sqTournamentDraft?.rules || {}; return Math.max(0, Math.min(roundsCount()-1, Number(rules.startRoundIndex ?? 7))); }catch(_){ return 7; } })();
    if (__turboRace) {
      labels = labels.slice(__turboStartIdx);
      live = live.map((s, pIdx) => {
        // Turbo starts at its configured round. Rebuild the per-dart cumulative
        // path from that point so resumed games can never inherit pre-Turbo X/Y data.
        let run = 0;
        const throwData = [0];
        for (let r = __turboStartIdx; r < roundsCount(); r++){
          const darts = Array.isArray(state.score?.[pIdx]?.[r]?.darts)
            ? state.score[pIdx][r].darts.filter(v => v != null)
            : [];
          for (const dart of darts){
            const pts = (typeof __sqV2DartPoints === 'function')
              ? __sqV2DartPoints(dart)
              : Number(dart && (dart.points ?? dart.score ?? dart.value ?? dart.total)) || 0;
            run += Number.isFinite(Number(pts)) ? Number(pts) : 0;
            throwData.push(run);
          }
        }
        return { ...s, data: Array.isArray(s.data) ? s.data.slice(__turboStartIdx) : [], throwData };
      });
    }
    const offset = __turboRace ? __turboStartIdx : 0;
    drawRace(canvas, {series:live, record:null, records:null, labels, offset, classicThrowRace:__classicThrowRace, turboThrowRace:__turboThrowRace});
    let rec = (typeof __sqBuildRaceReferenceSeriesForCurrentMode === 'function')
      ? await __sqBuildRaceReferenceSeriesForCurrentMode(roundsCount(), __turboStartIdx)
      : (__turboRace ? null : await getRecordSeries());
    let records = null;

    // Solo Practice: Race chart should compare the live player against their PB pace
    // and the true WR pace. PB is green dotted; WR is purple dotted.
    try{
      const soloPractice = (typeof getLiveV2PlayerCount === 'function' && getLiveV2PlayerCount() === 1) &&
        (String(state?.mode || state?.gameMode || '').toLowerCase() === 'practice' || state?.isPractice || state?.is_practice || !state?.match_id);
      if (soloPractice && typeof __sqEnsureSoloPracticePace === 'function'){
        const pace = await __sqEnsureSoloPracticePace();
        const nextRecords = [];
        if (pace && pace.pb && Array.isArray(pace.pb.data)) nextRecords.push({ label:'PB', color:'rgba(80,255,140,.78)', data:pace.pb.data, dotted:true });
        if (pace && pace.wr && Array.isArray(pace.wr.data)) nextRecords.push({ label:'WR', color:'rgba(190,110,255,.82)', data:pace.wr.data, dotted:true });
        if (nextRecords.length){ records = nextRecords; rec = null; }
      }
    }catch(_){ }

    // A late cloud response must never replace a newer throw or a new game.
    if (version !== renderVersion || canvas !== getCanvas()) return;
    drawRace(canvas, {series:live, record:rec, records, labels, offset, classicThrowRace:__classicThrowRace, turboThrowRace:__turboThrowRace});
  }

  window.__sqV2InfoDmdUpdate = function(){
    try{
      cancelAnimationFrame(window.__sqV2RaceRaf || 0);
      window.__sqV2RaceRaf = requestAnimationFrame(render);
    }catch(_){}
  };

  try{ requestAnimationFrame(render); }catch(_){}
  window.addEventListener('resize', ()=>{ try{ render(); }catch(_){ } }, { passive:true });
})();
// <<< PATCH:V2_INFO_DMD_PAGE END

// >>> PATCH:PRACTICE_SOLO_PB_WR_PANEL_JS_V1 START
function __sqV2DartToken(d, rIdx){try{if(!d)return 'X';if(typeof symbolForDart==='function'){const rd=Array.isArray(window.ROUNDS)?window.ROUNDS[rIdx]:(typeof ROUNDS!=='undefined'?ROUNDS[rIdx]:null);const s=symbolForDart(d,rd);const ch=String((s&&s.ch)||'').trim();if(ch&&ch!=='✕')return ch.toUpperCase();}const kind=String(d.kind||d.multiplier||d.type||'').toUpperCase();if(kind==='MISS'||kind==='X')return 'X';if(kind.startsWith('T'))return 'T';if(kind.startsWith('D'))return 'D';if(kind==='IB')return 'IB';if(kind==='OB')return 'OB';if(kind.startsWith('B'))return 'B';return (Number(d.points||d.score||d.value||0)>0)?'S':'X';}catch(_){return 'X';}}
function __sqV2DartsTextForEntry(entry,rIdx){try{const darts=Array.isArray(entry&&entry.darts)?entry.darts.slice(0,3):[];if(!darts.length)return '';const parts=[];for(let i=0;i<Math.min(3,darts.length);i++)parts.push(__sqV2DartToken(darts[i],rIdx));return parts.join(' / ');}catch(_){return '';}}
function __sqV2GamePlayers(g){const ps=g&&(g.players||(g.state&&g.state.players));return Array.isArray(ps)?ps:[];}
function __sqV2GameBoard(g){const b=g&&(g.board||g.score||(g.state&&(g.state.board||g.state.score)));return Array.isArray(b)?b:[];}
function __sqV2RoundEntryFromBoard(board,pIdx,rIdx,playerCount){if(Array.isArray(board&&board[pIdx]))return board[pIdx][rIdx];if(Array.isArray(board&&board[rIdx])&&board.length>=14&&board.length!==playerCount)return board[rIdx][pIdx];return null;}
function __sqV2DartPoints(d){try{return Number(d&&(d.points??d.score??d.value??d.total))||0;}catch(_){return 0;}}
function __sqV2RoundTotalFromEntry(entry){try{if(!entry)return 0;if(typeof entry==='number')return Number(entry)||0;if(Number.isFinite(Number(entry.roundTotal)))return Number(entry.roundTotal)||0;if(Number.isFinite(Number(entry.round_total)))return Number(entry.round_total)||0;if(Number.isFinite(Number(entry.total)))return Number(entry.total)||0;if(Number.isFinite(Number(entry.score)))return Number(entry.score)||0;if(Array.isArray(entry.darts))return entry.darts.reduce((sum,d)=>sum+__sqV2DartPoints(d),0);}catch(_){}return 0;}
function __sqV2RoundDartCumulativeFromEntry(entry){try{const darts=Array.isArray(entry&&entry.darts)?entry.darts.slice(0,3):[];let run=0;const out=[];for(let i=0;i<3;i++){run+=__sqV2DartPoints(darts[i]);out.push(run);}return out;}catch(_){return [0,0,0];}}
function __sqV2CumulativeForGame(g,pIdx,rc){const ps=__sqV2GamePlayers(g);const board=__sqV2GameBoard(g);let running=0;const data=[];for(let r=0;r<rc;r++){running+=__sqV2RoundTotalFromEntry(__sqV2RoundEntryFromBoard(board,pIdx,r,ps.length));data.push(running);}return data;}
function __sqV2DartDataForGame(g,pIdx,rc){const ps=__sqV2GamePlayers(g);const board=__sqV2GameBoard(g);const out=[];for(let r=0;r<rc;r++){out.push(__sqV2RoundDartCumulativeFromEntry(__sqV2RoundEntryFromBoard(board,pIdx,r,ps.length)));}return out;}
function __sqV2TotalForGame(g,pIdx,rc){try{const totals=g&&(g.totals||(g.state&&g.state.totals));const t=Array.isArray(totals)?Number(totals[pIdx]):NaN;if(Number.isFinite(t)&&t>0)return t;}catch(_){}const data=__sqV2CumulativeForGame(g,pIdx,rc);return data.length?(Number(data[data.length-1])||0):0;}
function __sqV2NormName(v){return String(v||'').trim().toLowerCase();}
function __sqV2PlayerNameFromObj(p){return String((p&&(p.name||p.fullName||p.displayName||p.nick||p.player))||'').trim();}
async function __sqEnsureSoloPracticePace(){try{const rc=(Array.isArray(window.ROUNDS)&&window.ROUNDS.length)?window.ROUNDS.length:14;const p=state&&state.players&&state.players[0];const playerName=__sqV2PlayerNameFromObj(p);const key=__sqV2NormName(playerName);const cacheKey=key+'|'+rc;const cache=window.__sqSoloPracticePace;if(cache&&cache.key===cacheKey&&(Date.now()-(cache.ts||0)<45000))return cache;let games=[];try{if(typeof cloudFetchAllGamesAsLocal==='function')games=await cloudFetchAllGamesAsLocal();}catch(e){games=[];}let pb=null;let wr=null;for(const g of (Array.isArray(games)?games:[])){try{const ps=__sqV2GamePlayers(g);if(!ps.length)continue;if(typeof isOfficialGame==='function'&&!isOfficialGame(g))continue;for(let pi=0;pi<ps.length;pi++){const nm=__sqV2PlayerNameFromObj(ps[pi]);if(!nm)continue;const total=__sqV2TotalForGame(g,pi,rc);if(!Number.isFinite(total)||total<=0)continue;const data=__sqV2CumulativeForGame(g,pi,rc);if(!data.some(v=>Number(v)>0))continue;const dartData=__sqV2DartDataForGame(g,pi,rc);const cand={name:nm,total,data,dartData};if(!wr||cand.total>wr.total)wr=cand;if(key&&__sqV2NormName(nm)===key&&(!pb||cand.total>pb.total))pb=cand;}}catch(_){}}const next={key:cacheKey,ts:Date.now(),pb,wr};window.__sqSoloPracticePace=next;return next;}catch(e){try{console.warn('[SQ] solo practice pace failed',e&&(e.message||e));}catch(_){}return {key:'',ts:Date.now(),pb:null,wr:null};}}
function __sqUpdateSoloPracticePacePanel(currentTotal,currentRound){
  try{
    const pCount=getLiveV2PlayerCount();
    const pbEl=document.getElementById('v2SoloPB');
    const wrEl=document.getElementById('v2SoloWR');
    const pbVarEl=document.getElementById('v2SoloPBVar');
    const wrVarEl=document.getElementById('v2SoloWRVar');
    const totalEl=document.querySelector('.livev2panel[style*="--sqV2P: 1"] .v2ScoreBox[data-p="0"] .v2Total');
    if(!pbEl||!wrEl||!pbVarEl||!wrVarEl||pCount!==1)return;

    const roundIdx=Math.max(0,Math.min(13,Number(currentRound)||0));
    const liveTotal=Number(currentTotal||0)||0;
    const liveEntry=state&&state.score&&state.score[0] ? state.score[0][roundIdx] : null;
    const liveDarts=Array.isArray(liveEntry&&liveEntry.darts) ? Math.max(0,Math.min(3,liveEntry.darts.filter(v=>v!=null).length)) : 0;

    const rollingToCurrentDart=(rec)=>{
      try{
        if(!rec||!rec.total)return 0;
        const prev=roundIdx>0 ? (Number((rec.data||[])[roundIdx-1]||0)||0) : 0;
        const full=Number((rec.data||[])[roundIdx]||0)||0;
        if(liveDarts>=3)return full;
        if(liveDarts<=0)return prev;
        const partial=Number(((rec.dartData||[])[roundIdx]||[])[liveDarts-1]||0)||0;
        if(partial>0 || full===prev)return prev + partial;
        return prev + Math.round(Math.max(0,full-prev) * (liveDarts/3));
      }catch(_){return 0;}
    };

    const apply=(pace)=>{
      const renderRecord=(el,label,rec,kind)=>{
        const val=el.querySelector('.v2SoloRecValue');
        const lab=el.querySelector('.v2SoloRecLabel');
        if(lab){
          lab.classList.remove('is-pace-ahead-pb','is-pace-ahead-wr');
          lab.textContent=label;
        }
        if(!rec||!rec.total){
          el.classList.add('is-empty');
          if(val)val.textContent='– / –';
          return 0;
        }
        const rolling=rollingToCurrentDart(rec);
        el.classList.remove('is-empty');
        if(val)val.textContent=String(Math.round(rec.total))+' / '+String(Math.round(rolling));
        if(lab && rolling && rolling > liveTotal){
          lab.classList.add(kind === 'wr' ? 'is-pace-ahead-wr' : 'is-pace-ahead-pb');
        }
        return rolling;
      };
      const pbRoll=renderRecord(pbEl,'PB',pace&&pace.pb,'pb');
      const wrRoll=renderRecord(wrEl,'WR',pace&&pace.wr,'wr');
      const renderVar=(el,rolling)=>{
        if(!rolling){
          el.classList.add('is-empty');
          el.classList.remove('is-behind','is-ahead','is-level');
          el.textContent='–';
          return;
        }
        const diff=Math.round(Number(rolling||0)-liveTotal);
        el.classList.remove('is-empty','is-behind','is-ahead','is-level');
        if(diff > 0){
          el.classList.add('is-behind');
          el.innerHTML='<span class="sqVarArrow" aria-hidden="true">▼</span><span class="sqVarNum">'+String(Math.abs(diff))+'</span>';
        }else if(diff < 0){
          el.classList.add('is-ahead');
          el.innerHTML='<span class="sqVarArrow" aria-hidden="true">▲</span><span class="sqVarNum">'+String(Math.abs(diff))+'</span>';
        }else{
          el.classList.add('is-level');
          el.textContent='0';
        }
      };
      renderVar(pbVarEl,pbRoll);
      renderVar(wrVarEl,wrRoll);

      try{
        if(totalEl){
          totalEl.classList.remove('soloAheadPB','soloAheadWR');
          const afterFirstRound = roundIdx > 0;
          if(afterFirstRound && wrRoll && liveTotal > wrRoll) totalEl.classList.add('soloAheadWR');
          else if(afterFirstRound && pbRoll && liveTotal > pbRoll) totalEl.classList.add('soloAheadPB');
        }
      }catch(_){ }
    };
    if(window.__sqSoloPracticePace)apply(window.__sqSoloPracticePace);
    __sqEnsureSoloPracticePace().then(pace=>apply(pace)).catch(()=>{});
  }catch(_){ }
}
// <<< PATCH:PRACTICE_SOLO_PB_WR_PANEL_JS_V1 END

// >>> PATCH:LIVEV2_NEXTROW_FAILSAFE_HELPER START
function __sqEnsureV2NextRowFilled(panel){
  try{
    const host = panel ? panel.querySelector('#v2NextRow') : document.getElementById('v2NextRow');
    if(!host) return;
    // If the next-row host is intentionally hidden, never re-populate it.
    if(host.getAttribute('aria-hidden') === 'true' || host.style.display === 'none') return;
    const html = (host.innerHTML || '').trim();
    if(html) return;
    const pCount = (panel && panel.dataset && panel.dataset.pcount) ? parseInt(panel.dataset.pcount,10) : getLiveV2PlayerCount();
    const safeP = Math.max(2, Math.min(6, Number.isFinite(pCount)?pCount:2));
    const out = [];
    out.push('<div class="v2Badge">–</div>');
    for(let i=0;i<safeP;i++) out.push('<div class="v2Cell">–</div>');
    host.innerHTML = out.join('');
  }catch(_){}
}

// <<< PATCH:LIVEV2_NEXTROW_FAILSAFE_HELPER END

function __sqSetupLiveV2RowsWindow(panel){
  try{
    const wrap = panel ? panel.querySelector('.v2RowsWrap') : null;
    if(!wrap) return;
    const badges = wrap.querySelectorAll('.v2Badge');
    if(!badges || badges.length < 1) return;
    const r0 = badges[0].getBoundingClientRect();
    let wantH = 0;
    // The smallest supported portrait layout deliberately shows two historic
    // rows plus the live row. Larger layouts retain three historic rows.
    const narrow = Number(window.innerWidth || document.documentElement.clientWidth || 0) <= 360;
    const visibleRows = narrow ? 3 : 4;
    const last = Math.min(badges.length - 1, visibleRows - 1);
    if(last >= 0){
      const target = badges[last].getBoundingClientRect();
      wantH = Math.round(target.bottom - r0.top);
    }else if(badges.length >= 3){
      const r2 = badges[badges.length - 1].getBoundingClientRect();
      wantH = Math.round(r2.bottom - r0.top);
    }else{
      const rl = badges[badges.length-1].getBoundingClientRect();
      wantH = Math.round(rl.bottom - r0.top);
    }
    // Add a small safety buffer so the top/bottom row edges never clip
    // (padding + border-radius + subpixel rounding on iOS).
    wantH = Math.max(120, wantH + 60);
    wrap.style.setProperty('--sqV2RowsWinH', wantH + 'px');
  }catch(_){ }
}

function __sqToggleLegacyUIForLiveV2(on){
  // Stage 2 guard: if legacy UI is not enabled, we always keep it hidden.
  if(FLAGS && FLAGS.ENABLE_LEGACY_UI === false){ on = true; }

  const legacyIds = ["floatWrap","turnBar","scoreWrap","roundBar","roundSeamBar"];
  legacyIds.forEach((id)=>{
    const el = document.getElementById(id);
    if(!el) return;
    // Use both hidden + display to survive iOS/Safari quirks and inline styles.
    if(on){
      el.hidden = true;
      el.setAttribute("aria-hidden","true");
      el.style.display = "none";
    }else{
      el.hidden = false;
      el.removeAttribute("aria-hidden");
      el.style.display = "";
    }
  });
}
