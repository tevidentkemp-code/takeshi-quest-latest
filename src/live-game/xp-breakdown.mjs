const STYLE_ID = 'sq-sc038-xp-breakdown-styles';
const INSTALL_FLAG = '__sqSc038XpBreakdownInstalled';
const ORIGINAL_KEY = '__sqSc038XpBreakdownOriginal';

const MISFIRE_META = Object.freeze({
  cold_start: { name: 'Cold Start', penalty: -1 },
  ghost_town: { name: 'Ghost Town', penalty: -2 },
  deep_freeze: { name: 'Deep Freeze', penalty: -3 },
  sub_ton: { name: 'Sub-Ton', penalty: -2 },
  special_delivery_failed: { name: 'Special Delivery Failed', penalty: -2 },
  bull_blind: { name: 'Bull Blind', penalty: -1 },
  century_drought: { name: 'Century Drought', penalty: -2 },
  wooden_spoon: { name: 'Wooden Spoon', penalty: -3 },
  volde_deux: { name: 'Volde-D’eux', penalty: -2 },
  volde_trois: { name: 'Volde-Trois', penalty: -2 },
});

const SCORE_MILESTONES = Object.freeze([100, 200, 300, 400, 500, 600, 700]);

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getState() {
  try { return state; } catch (_) { return null; }
}

function xpPrefetchKey(st) {
  const token = Number(st && st.__gameToken || 0);
  const names = (Array.isArray(st && st.players) ? st.players : [])
    .map(player => rawPlayerName(player).toLowerCase());
  return token + '|' + names.join('|');
}

function existingXpRows(host, st) {
  try {
    const pref = host && host.__sqGcXpPrefetch;
    if (!pref || pref.key !== xpPrefetchKey(st)) return null;
    if (Array.isArray(pref.resolved)) return Promise.resolve(pref.resolved);
    if (pref.promise && typeof pref.promise.then === 'function') return pref.promise;
  } catch (_) {}
  return null;
}

function modeKey(st) {
  try {
    if (typeof window.__sqComputeGameMode === 'function') return String(window.__sqComputeGameMode() || '').toLowerCase();
  } catch (_) {}
  return String(st && (st.gameMode || st.mode || st.match?.mode || st.match?.gameMode) || '').toLowerCase();
}

function isRankedXpMode(st) {
  try {
    if (typeof window.__sqIsVsShadowRuntime === 'function' && window.__sqIsVsShadowRuntime()) return false;
  } catch (_) {}
  const mode = modeKey(st);
  if (mode === 'training' || mode === 'turbo' || mode === 'practice') return false;
  if (st && (st.isPractice === true || st.is_practice === true)) return false;
  return true;
}

function norm(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function rawPlayerName(player) {
  return String(player && (player.name || player.player) || '').trim();
}

function prettyPlayerName(player, index) {
  try {
    if (typeof window.__sqPlayerPretty === 'function') {
      const pretty = window.__sqPlayerPretty(player);
      if (pretty) return String(pretty);
    }
  } catch (_) {}
  return rawPlayerName(player) || `Player ${index + 1}`;
}

function scoreRowsTotal(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row && row.roundTotal || 0), 0);
}

function roundTotals(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => Number(row && row.roundTotal || 0));
}

function maxRun(values, predicate) {
  let best = 0;
  let run = 0;
  values.forEach(value => {
    if (predicate(value)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  });
  return best;
}

function voldeHitCount(rows, roundIndex, expectedKind) {
  const row = Array.isArray(rows) ? rows[roundIndex] : null;
  const darts = row && Array.isArray(row.darts) ? row.darts : [];
  return darts.filter(dart => {
    const kind = String(dart && (dart.kind || dart.type) || '').trim().toLowerCase();
    const sector = Number(dart && dart.sector);
    const rightKind = expectedKind === 'double'
      ? (kind === 'd' || kind === 'double')
      : (kind === 't' || kind === 'triple');
    return rightKind && Number.isInteger(sector) && sector >= 1 && sector <= 5;
  }).length;
}

function isVoldeCode(code) {
  return code === 'volde_deux' || code === 'volde_trois';
}

export function detectImmediateMisfires(rows, total) {
  const values = roundTotals(rows);
  const events = [];
  const add = code => {
    if (events.some(event => event.code === code)) return;
    const meta = MISFIRE_META[code];
    if (meta) events.push({ code, name: meta.name, penalty: meta.penalty, count:1 });
  };
  const addVolde = (code, count) => {
    const meta = MISFIRE_META[code];
    if (!meta || !(count > 0)) return;
    events.push({
      code,
      name:meta.name,
      count,
      unitPenalty:meta.penalty,
      penalty:meta.penalty * count,
      stacking:true,
    });
  };

  if (values.length >= 3 && values.slice(0, 3).every(value => value === 0)) add('cold_start');
  const zeroRun = maxRun(values, value => value === 0);
  if (zeroRun >= 3) add('ghost_town');
  if (zeroRun >= 5) add('deep_freeze');
  if (Number(total || 0) < 100) add('sub_ton');
  if (values.length >= 14 && values[11] === 0 && values[12] === 0 && values[13] === 0) add('special_delivery_failed');
  if (values.length >= 14 && values[13] === 0) add('bull_blind');

  // SC-048: these two are dart-level exceptions. Every qualifying hit stacks
  // independently and is additional to the normal worst-only / -5 game rule.
  addVolde('volde_deux', voldeHitCount(rows, 11, 'double'));
  addVolde('volde_trois', voldeHitCount(rows, 12, 'triple'));
  return events;
}

export function appliedMisfirePenalty(events) {
  const source = Array.isArray(events) ? events : [];
  const normal = source
    .filter(event => !isVoldeCode(event && event.code))
    .map(event => Number(event && event.penalty || 0))
    .filter(value => value < 0);
  const normalPenalty = normal.length ? Math.max(-5, Math.min(...normal)) : 0;
  const voldePenalty = source
    .filter(event => isVoldeCode(event && event.code))
    .reduce((sum, event) => sum + Math.min(0, Number(event && event.penalty || 0)), 0);
  return normalPenalty + voldePenalty;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.gc-xp-row.sq-xp-detailed{
  padding:14px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.08);
  background:
    radial-gradient(110% 80% at 0% 0%, rgba(255,122,0,.075), transparent 52%),
    linear-gradient(180deg, rgba(18,24,39,.96), rgba(9,14,25,.97));
  box-shadow:0 16px 36px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.035);
}
.gc-xp-hero{
  display:grid;
  grid-template-columns:116px minmax(0,1fr);
  gap:14px;
  align-items:stretch;
}
.gc-xp-portrait{
  position:relative;
  min-height:148px;
  border-radius:16px;
  overflow:hidden;
  border:1px solid rgba(255,149,45,.38);
  background:
    radial-gradient(circle at 50% 20%, rgba(255,130,30,.16), transparent 55%),
    #0b101b;
  box-shadow:0 0 22px rgba(255,120,0,.10), inset 0 0 0 1px rgba(255,255,255,.035);
}
.gc-xp-avatar-sprite{
  position:absolute;
  inset:0;
  background-repeat:no-repeat;
  background-size:600% 500%;
}
.gc-xp-current{
  position:absolute;
  left:7px;
  right:7px;
  bottom:7px;
  min-height:38px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:7px 9px;
  border-radius:11px;
  border:1px solid rgba(255,185,92,.24);
  background:rgba(4,8,15,.82);
  backdrop-filter:blur(8px);
  box-shadow:0 8px 20px rgba(0,0,0,.34);
}
.gc-xp-current-label{
  color:rgba(226,234,248,.58);
  font-size:7px;
  font-weight:950;
  letter-spacing:.13em;
  text-transform:uppercase;
  white-space:nowrap;
}
.gc-xp-current-value{
  color:#ffd176;
  font-size:13px;
  font-weight:950;
  line-height:1;
  white-space:nowrap;
}
.gc-xp-summary{ min-width:0; display:flex; flex-direction:column; }
.gc-xp-summary .gc-xp-head{ margin:0; }
.gc-xp-summary .gc-xp-gain{
  margin-top:7px;
  color:#69efb4;
  font-size:22px;
  line-height:1;
  font-weight:950;
  letter-spacing:.01em;
}
.gc-xp-bars{ margin-top:auto; padding-top:12px; }
.gc-xp-totalbar-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin:10px 0 4px;
  color:rgba(235,240,250,.62);
  font-size:8px;
  font-weight:950;
  letter-spacing:.12em;
  text-transform:uppercase;
}
.gc-xp-totalbar-value{
  color:#ffd176;
  font-size:10px;
  letter-spacing:0;
  text-transform:none;
}
.gc-xp-breakdown{
  padding-top:12px;
  margin-top:12px;
  border-top:1px solid rgba(255,255,255,.09);
}

.gc-xp-row.sq-xp-detailed .gc-xp-head{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:start;
  gap:8px 12px;
  flex-wrap:initial;
}
.gc-xp-row.sq-xp-detailed .gc-xp-name{
  min-width:0;
  display:block;
  padding-top:2px;
  padding-right:4px;
  font-size:15px;
  line-height:1.16;
  font-weight:900;
}
.gc-xp-row.sq-xp-detailed .gc-xp-name .nm{
  display:block;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.gc-xp-rankstack{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  justify-content:flex-start;
  gap:5px;
  min-width:102px;
}
.gc-xp-rankstack .gc-xp-lvholder{ display:flex; justify-content:flex-end; }
.gc-xp-row.sq-xp-detailed .gc-xp-lvup{
  display:block;
  margin:0 2px 0 0;
  font-size:10px;
  line-height:1;
  text-align:right;
  white-space:nowrap;
}
.gc-xp-row.sq-xp-detailed .gc-xp-gain{
  margin-top:7px;
  font-size:15px;
  line-height:1;
}
.gc-xp-gamebar-wrap{ margin-top:7px; }
.gc-xp-gamebar-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; color:rgba(235,240,250,.62); font-size:8px; font-weight:950; letter-spacing:.12em; text-transform:uppercase; }
.gc-xp-gamebar{ height:6px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); }
.gc-xp-gamebar-fill{ height:100%; width:0; border-radius:999px; background:linear-gradient(90deg,#ff6a00,#ffb14a); box-shadow:0 0 10px rgba(255,138,0,.45); transition:width .55s ease; }
.gc-xp-totalbar-label{ margin-top:5px; color:rgba(235,240,250,.38); font-size:7px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
.gc-xp-info-backdrop{ position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(0,0,0,.72); }
.gc-xp-info-card{ width:min(360px,92vw); border-radius:15px; padding:16px; background:#121826; border:1px solid rgba(255,149,0,.34); box-shadow:0 18px 50px rgba(0,0,0,.55); color:#f7f8fa; }
.gc-xp-info-title{ font-size:16px; font-weight:950; }
.gc-xp-info-xp{ margin-top:5px; color:#7be0a0; font-size:13px; font-weight:900; }
.gc-xp-info-copy{ margin-top:10px; color:#b8c0cc; font-size:12px; line-height:1.45; }
.gc-xp-info-close{ margin-top:14px; width:100%; min-height:40px; border-radius:10px; border:1px solid rgba(255,149,0,.42); background:rgba(255,138,0,.10); color:#fff; font-weight:900; }
.gc-xp-source-chip[data-xp-info]{ cursor:pointer; }
.gc-xp-breakdown{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:10px;
  min-width:0;
}
.gc-xp-source-line{
  display:grid;
  grid-template-columns:58px minmax(0,1fr);
  align-items:center;
  gap:7px;
  min-width:0;
}
.gc-xp-source-label{
  color:rgba(235,240,250,.48);
  font-size:8px;
  line-height:1;
  font-weight:950;
  letter-spacing:.12em;
  text-transform:uppercase;
  white-space:nowrap;
}
.gc-xp-source-chips{
  display:flex;
  flex-wrap:nowrap;
  gap:6px;
  min-width:0;
  overflow-x:auto;
  overflow-y:hidden;
  padding:1px 2px 3px 0;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
  overscroll-behavior-inline:contain;
}
.gc-xp-source-chips::-webkit-scrollbar{ display:none; }
.gc-xp-source-chip{
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  gap:5px;
  min-height:25px;
  padding:4px 9px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.11);
  background:rgba(255,255,255,.045);
  color:rgba(246,248,255,.9);
  font-size:10px;
  line-height:1;
  font-weight:850;
  white-space:nowrap;
}
.gc-xp-source-chip.base{ border-color:rgba(255,148,64,.28); background:rgba(255,122,0,.08); color:#ffd0aa; }
.gc-xp-source-chip.positive{ border-color:rgba(177,111,255,.35); background:rgba(141,84,218,.12); color:#ebd8ff; }
.gc-xp-source-chip.milestone{ border-color:rgba(255,201,74,.38); background:rgba(255,190,58,.10); color:#ffe2a0; }
.gc-xp-source-chip.negative{ border-color:rgba(255,88,106,.36); background:rgba(150,28,48,.15); color:#ffbcc5; }
.gc-xp-source-chip.applied{ box-shadow:inset 0 0 0 1px rgba(255,88,106,.17); }
.gc-xp-source-chip.empty{ color:rgba(235,240,250,.38); border-color:rgba(255,255,255,.06); background:rgba(255,255,255,.025); }
@media(max-width:560px){
  .gc-xp-hero{ grid-template-columns:92px minmax(0,1fr); gap:10px; }
  .gc-xp-portrait{ min-height:128px; border-radius:14px; }
  .gc-xp-current{ left:5px; right:5px; bottom:5px; padding:6px 7px; }
  .gc-xp-current-label{ font-size:6px; }
  .gc-xp-current-value{ font-size:11px; }
  .gc-xp-summary .gc-xp-gain{ font-size:19px; }
  .gc-xp-row.sq-xp-detailed .gc-xp-name{ font-size:14px; }
  .gc-xp-rankstack{ min-width:96px; }
  .gc-xp-source-line{ grid-template-columns:52px minmax(0,1fr); gap:5px; }
  .gc-xp-source-label{ font-size:7px; }
  .gc-xp-source-chip{ font-size:9px; padding:4px 8px; }
}
@media(prefers-reduced-motion:reduce){
  .gc-xp-row.sq-xp-detailed,.gc-xp-row.sq-xp-detailed .gc-xp-fill,.gc-xp-row.sq-xp-detailed .gc-xp-lvup{ transition:none!important; animation:none!important; }
}
`;
  document.head.appendChild(style);
}

function playerKey(playerRow) {
  const id = String(playerRow && playerRow.playerId || '').trim();
  return id ? `id:${id}` : `nm:${norm(playerRow && playerRow.rawName)}`;
}

function keyFromHistoryRow(row) {
  const id = String(row && row.player_id || '').trim();
  return id ? `id:${id}` : `nm:${norm(row && row.player_name)}`;
}

async function fetchCloudContext(host, playerRows) {
  const context = {
    previousBest: new Map(),
    priorGames: new Map(),
    allRowsByGame: new Map(),
    historyAvailable: false,
  };
  const client = host && host.sb;
  if (!client || typeof client.from !== 'function') return context;

  try {
    const bestRes = await client
      .from('v_player_best_official_ranked')
      .select('player_id,player_name,best_score');
    if (!bestRes?.error && Array.isArray(bestRes?.data)) {
      bestRes.data.forEach(row => {
        const id = String(row && row.player_id || '').trim();
        const name = norm(row && row.player_name);
        const value = Number(row && row.best_score || 0);
        if (id) context.previousBest.set(`id:${id}`, value);
        if (name) context.previousBest.set(`nm:${name}`, value);
      });
    }
  } catch (_) {}

  try {
    const ids = playerRows.map(row => row.playerId).filter(Boolean);
    const names = playerRows.map(row => row.rawName).filter(Boolean);
    let query = client
      .from('v_player_game_scores_official_clean')
      .select('game_id,ts,player_id,player_name,score')
      .order('ts', { ascending:false })
      .limit(Math.max(120, playerRows.length * 24));

    if (ids.length === playerRows.length && typeof query.in === 'function') query = query.in('player_id', ids);
    else if (names.length && typeof query.in === 'function') query = query.in('player_name', names);

    const histRes = await query;
    if (histRes?.error || !Array.isArray(histRes?.data)) return context;

    const grouped = new Map();
    histRes.data.forEach(row => {
      const key = keyFromHistoryRow(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

    const neededGameIds = new Set();
    playerRows.forEach(playerRow => {
      const key = playerKey(playerRow);
      const rows = grouped.get(key) || grouped.get(`nm:${norm(playerRow.rawName)}`) || [];
      const seen = new Set();
      const prior = [];
      rows.forEach(row => {
        const gameId = String(row && row.game_id || '');
        if (!gameId || seen.has(gameId) || prior.length >= 10) return;
        seen.add(gameId);
        prior.push({
          gameId,
          score: Number(row && row.score || 0),
          ts: row && row.ts || null,
          playerId: String(row && row.player_id || ''),
          playerName: String(row && row.player_name || ''),
        });
        neededGameIds.add(gameId);
      });
      context.priorGames.set(key, prior);
    });

    const gameIds = Array.from(neededGameIds);
    if (gameIds.length) {
      let allQuery = client
        .from('v_player_game_scores_official_clean')
        .select('game_id,player_id,player_name,score');
      if (typeof allQuery.in === 'function') allQuery = allQuery.in('game_id', gameIds);
      const allRes = await allQuery;
      if (!allRes?.error && Array.isArray(allRes?.data)) {
        allRes.data.forEach(row => {
          const gameId = String(row && row.game_id || '');
          if (!gameId) return;
          if (!context.allRowsByGame.has(gameId)) context.allRowsByGame.set(gameId, []);
          context.allRowsByGame.get(gameId).push(row);
        });
      }
    }
    context.historyAvailable = true;
  } catch (err) {
    try { console.warn('[SC-038] XP breakdown history unavailable', err); } catch (_) {}
  }
  return context;
}

function previousBestFor(context, row) {
  const byId = row.playerId ? context.previousBest.get(`id:${row.playerId}`) : null;
  if (Number.isFinite(Number(byId))) return Number(byId);
  const byName = context.previousBest.get(`nm:${norm(row.rawName)}`);
  return Number.isFinite(Number(byName)) ? Number(byName) : 0;
}

function isUniqueLastInSavedGame(context, priorGame, row) {
  const rows = context.allRowsByGame.get(priorGame.gameId) || [];
  if (!rows.length) return false;
  const scores = rows.map(item => Number(item && item.score || 0));
  const min = Math.min(...scores);
  const bottom = scores.filter(score => score === min).length;
  if (bottom !== 1) return false;
  const mine = rows.find(item => {
    const id = String(item && item.player_id || '');
    if (row.playerId && id) return id === row.playerId;
    return norm(item && item.player_name) === norm(row.rawName);
  });
  return !!mine && Number(mine.score || 0) === min;
}

function addStreakMisfires(events, context, row, currentTotal, currentUniqueLast) {
  const prior = context.priorGames.get(playerKey(row)) || context.priorGames.get(`nm:${norm(row.rawName)}`) || [];
  if (prior.length >= 4 && Number(currentTotal || 0) < 100) {
    const previousFour = prior.slice(0, 4).every(game => Number(game.score || 0) < 100);
    const previousFiveAlready = prior.length >= 5 && Number(prior[4].score || 0) < 100;
    if (previousFour && !previousFiveAlready) {
      const meta = MISFIRE_META.century_drought;
      events.push({ code:'century_drought', name:meta.name, penalty:meta.penalty });
    }
  }
  if (prior.length >= 4 && currentUniqueLast) {
    const previousFour = prior.slice(0, 4).every(game => isUniqueLastInSavedGame(context, game, row));
    const previousFiveAlready = prior.length >= 5 && isUniqueLastInSavedGame(context, prior[4], row);
    if (previousFour && !previousFiveAlready) {
      const meta = MISFIRE_META.wooden_spoon;
      events.push({ code:'wooden_spoon', name:meta.name, penalty:meta.penalty });
    }
  }
}

function awardMapFromRuntime(host, board, players, st) {
  const byPlayer = new Map();
  try {
    const results = host.SQ_ACH.detectGame(board, {
      players,
      is_tiebreak: !!(st.is_tiebreak || st.currentGameIsTiebreak),
    }) || [];
    results.forEach(result => {
      const map = new Map();
      (result && Array.isArray(result.earned) ? result.earned : []).forEach(event => {
        map.set(event.code, Math.max(1, Number(event.count || 1)));
      });
      byPlayer.set(Number(result.player), map);
    });
  } catch (err) {
    try { console.warn('[SC-038] XP award detector unavailable', err); } catch (_) {}
  }
  return byPlayer;
}

function addAwardIfKnown(host, map, code, count = 1) {
  if (!code || map.has(code)) return;
  try {
    const meta = host.SQ_ACH.meta(code);
    if (meta && Number(meta.xp || 0) > 0) map.set(code, Math.max(1, Number(count || 1)));
  } catch (_) {}
}

function supplementCurrentGameAwards(host, map, playerIndex, rows, totals, st, context, playerRow) {
  const total = Number(totals[playerIndex] || 0);
  const maxTotal = Math.max(0, ...totals);
  const topCount = totals.filter(value => value === maxTotal).length;
  const uniqueWin = maxTotal > 0 && total === maxTotal && topCount === 1;
  const prevBest = previousBestFor(context, playerRow);

  SCORE_MILESTONES.forEach(threshold => {
    if (total >= threshold && prevBest < threshold) addAwardIfKnown(host, map, `score_${threshold}`);
  });

  if (uniqueWin) {
    const runners = totals.filter((_, index) => index !== playerIndex);
    const runner = runners.length ? Math.max(...runners) : 0;
    const margin = total - runner;
    if (margin >= 1 && margin <= 10) addAwardIfKnown(host, map, 'photo_finish');
    if (margin >= 200) addAwardIfKnown(host, map, 'runaway');

    const running = totals.map(() => 0);
    for (let roundIndex = 0; roundIndex <= 11; roundIndex += 1) {
      totals.forEach((_, p) => {
        running[p] += Number(st.score?.[p]?.[roundIndex]?.roundTotal || 0);
      });
    }
    if (running[playerIndex] < Math.max(...running)) addAwardIfKnown(host, map, 'last_gasp');
  }

  const values = roundTotals(rows);
  if (maxRun(values, value => value > 0) >= 10) addAwardIfKnown(host, map, 'steady_eddie');
  if (maxRun(values, value => value >= 100) >= 2) addAwardIfKnown(host, map, 'century_streak');
  if (prevBest > 0 && total >= prevBest + 100) addAwardIfKnown(host, map, 'pb_smasher');

  if (map.has('double_trouble') && map.has('triple_threat') && map.has('bull_run')) {
    addAwardIfKnown(host, map, 'special_forces');
  }

  if (uniqueWin) {
    const myPrior = context.priorGames.get(playerKey(playerRow)) || context.priorGames.get(`nm:${norm(playerRow.rawName)}`) || [];
    if (myPrior.length >= 10) {
      const myAvg = myPrior.slice(0, 10).reduce((sum, game) => sum + Number(game.score || 0), 0) / 10;
      const hasGoliath = playerRow.allPlayerRows.some((other, otherIndex) => {
        if (otherIndex === playerIndex) return false;
        const prior = context.priorGames.get(playerKey(other)) || context.priorGames.get(`nm:${norm(other.rawName)}`) || [];
        if (prior.length < 10) return false;
        const avg = prior.slice(0, 10).reduce((sum, game) => sum + Number(game.score || 0), 0) / 10;
        return (avg - myAvg) >= 200;
      });
      if (hasGoliath) addAwardIfKnown(host, map, 'david_and_goliath');
    }
  }

  const priorHistory = Array.isArray(st.match?.history) ? st.match.history : [];
  const matchGameTotals = priorHistory.map(game => Array.isArray(game?.totals) ? game.totals.map(Number) : []);
  matchGameTotals.push(totals.map(Number));
  const results = matchGameTotals.map(gameTotals => {
    const max = Math.max(0, ...gameTotals);
    const count = gameTotals.filter(value => value === max).length;
    return max > 0 && count === 1 && Number(gameTotals[playerIndex] || 0) === max;
  });
  const targetWins = Number(st.match?.targetWins || 1);
  const winsAfter = results.filter(Boolean).length;
  if (uniqueWin && winsAfter >= targetWins && targetWins >= 3) {
    addAwardIfKnown(host, map, 'champion');
    if (results.length === targetWins && results.every(Boolean)) addAwardIfKnown(host, map, 'clean_sweep');
    if (targetWins === 3 && results.length >= 5) {
      const tail = results.slice(-5);
      if (!tail[0] && !tail[1] && tail[2] && tail[3] && tail[4]) addAwardIfKnown(host, map, 'reverse_sweep');
    }
  }
}

function awardDetails(host, map) {
  const details = [];
  map.forEach((count, code) => {
    try {
      const meta = host.SQ_ACH.meta(code);
      const each = Number(meta && meta.xp || 0);
      if (!(each > 0)) return;
      details.push({
        code,
        count,
        xp: each * count,
        name: String(meta.name || code),
        icon: String(meta.icon || '★'),
        tier: meta.tier,
        milestone: !!(host.SQ_ACH.isMilestone && host.SQ_ACH.isMilestone(code)),
        description: String(meta.description || meta.desc || meta.criteria || meta.rule || 'Award earned by meeting this achievement condition in the current game.'),
      });
    } catch (_) {}
  });
  return details.sort((a, b) => (b.xp - a.xp) || a.name.localeCompare(b.name));
}

function matchWinBaseXp(st, playerIndex, totals) {
  const targetWins = Number(st.match?.targetWins || 1);
  if (targetWins < 2) return 0;
  const max = Math.max(0, ...totals);
  const unique = max > 0 && totals.filter(value => value === max).length === 1;
  if (!unique || Number(totals[playerIndex] || 0) !== max) return 0;
  const existingWins = Number(st.match?.wins?.[playerIndex] || 0);
  if (existingWins + 1 < targetWins) return 0;
  return 150;
}

function showXpInfo(info) {
  if (!info) return;
  document.querySelector('.gc-xp-info-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'gc-xp-info-backdrop';
  const card = document.createElement('div');
  card.className = 'gc-xp-info-card';
  card.innerHTML = `<div class="gc-xp-info-title">${esc(info.title || 'XP')}</div>
    <div class="gc-xp-info-xp">${esc(info.xp || '')}</div>
    <div class="gc-xp-info-copy">${esc(info.description || 'XP earned from this game.')}</div>
    <button type="button" class="gc-xp-info-close">CLOSE</button>`;
  back.appendChild(card);
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back) close(); });
  card.querySelector('.gc-xp-info-close')?.addEventListener('click', close);
  document.body.appendChild(back);
}

function makeChip(text, kind, extraClass = '', info = null) {
  const chip = document.createElement(info ? 'button' : 'span');
  if (info) chip.type = 'button';
  chip.className = `gc-xp-source-chip ${kind}${extraClass ? ` ${extraClass}` : ''}`;
  chip.textContent = text;
  if (info) {
    chip.dataset.xpInfo = '1';
    chip.setAttribute('aria-label', `${info.title}. View XP explanation`);
    chip.addEventListener('click', () => showXpInfo(info));
  }
  return chip;
}

function makeSourceLine(label) {
  const line = document.createElement('div');
  line.className = 'gc-xp-source-line';
  const lab = document.createElement('div');
  lab.className = 'gc-xp-source-label';
  lab.textContent = label;
  const chips = document.createElement('div');
  chips.className = 'gc-xp-source-chips';
  line.append(lab, chips);
  return { line, chips };
}

function formatXp(value) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-GB');
}

function applyPlayerAvatar(host, el, player) {
  if (!el) return;
  try {
    const id = typeof host.__sqAvatarIdForPlayer === 'function'
      ? host.__sqAvatarIdForPlayer(player)
      : (typeof window.__sqAvatarIdForPlayer === 'function' ? window.__sqAvatarIdForPlayer(player) : 1);
    const pos = typeof host.__sqAvatarSpritePosition === 'function'
      ? host.__sqAvatarSpritePosition(id)
      : (typeof window.__sqAvatarSpritePosition === 'function' ? window.__sqAvatarSpritePosition(id) : null);
    if (pos) {
      el.dataset.avatarId = String(pos.id);
      el.style.backgroundImage = 'url("./assets/avatars/avatar-sprite.webp")';
      el.style.backgroundPosition = pos.x.toFixed(4) + '% ' + pos.y.toFixed(4) + '%';
      return;
    }
  } catch (_) {}
  el.style.backgroundImage = 'radial-gradient(circle at 50% 30%, rgba(255,122,0,.28), rgba(17,24,39,.96) 58%)';
}

function rankChip(host, holder, progress) {
  holder.replaceChildren();
  try {
    if (typeof host.__sqXpChip === 'function') {
      holder.appendChild(host.__sqXpChip(progress));
      return;
    }
  } catch (_) {}
  const fallback = document.createElement('span');
  fallback.className = 'gc-xp-source-chip base';
  fallback.textContent = `LV ${Number(progress && progress.level || 1)}`;
  holder.appendChild(fallback);
}

function buildDetailedRow(host, data) {
  const pre = host.SQ_XP.progress(data.pre);
  const post = host.SQ_XP.progress(data.post);
  const el = document.createElement('div');
  el.className = `gc-xp-row sq-xp-detailed${data.won ? ' won' : ''}`;
  el.innerHTML = `
    <div class="gc-xp-hero">
      <div class="gc-xp-portrait" aria-label="${esc(data.name)} profile picture">
        <div class="gc-xp-avatar-sprite" aria-hidden="true"></div>
        <div class="gc-xp-current">
          <span class="gc-xp-current-label">RANK</span>
          <span class="gc-xp-current-value">${esc(String(post.title || 'Rookie').toUpperCase())}</span>
        </div>
      </div>
      <div class="gc-xp-summary">
        <div class="gc-xp-head">
          <span class="gc-xp-name"><span class="nm">${esc(data.name)}</span></span>
          <span class="gc-xp-rankstack"><span class="gc-xp-lvholder"></span><span class="gc-xp-lvup">LEVEL UP!</span></span>
        </div>
        <div class="gc-xp-gain">${data.netXp >= 0 ? '+' : ''}${data.netXp} XP</div>
        <div class="gc-xp-bars">
          <div class="gc-xp-gamebar-wrap">
            <div class="gc-xp-gamebar-head"><span>THIS GAME XP</span><span>${data.netXp >= 0 ? '+' : ''}${data.netXp} XP</span></div>
            <div class="gc-xp-gamebar"><div class="gc-xp-gamebar-fill"></div></div>
          </div>
          <div class="gc-xp-totalbar-head">
            <span>TOTAL XP</span>
            <span class="gc-xp-totalbar-value">${formatXp(data.post)} XP</span>
          </div>
          <div class="gc-xp-bar"><div class="gc-xp-fill"></div></div>
        </div>
      </div>
    </div>
    <div class="gc-xp-breakdown"></div>
  `;

  applyPlayerAvatar(host, el.querySelector('.gc-xp-avatar-sprite'), data.player);

  const rankHolder = el.querySelector('.gc-xp-lvholder');
  rankChip(host, rankHolder, pre);

  const breakdown = el.querySelector('.gc-xp-breakdown');
  const base = makeSourceLine(`BASE XP ${data.baseXp >= 0 ? '+' : ''}${data.baseXp}`);
  data.base.forEach(item => base.chips.appendChild(makeChip(`${item.label} +${item.xp} XP`, 'base', '', {
    title:item.label + ' XP', xp:`+${item.xp} XP`, description:item.description
  })));
  if (!data.base.length) base.chips.appendChild(makeChip('NONE', 'empty'));
  breakdown.appendChild(base.line);

  const positive = makeSourceLine(`POSITIVE +${data.positiveXp}`);
  data.positive.forEach(item => {
    const countText = item.count > 1 ? ` ×${item.count}` : '';
    const chip = makeChip(`${item.icon} ${item.name}${countText} +${item.xp} XP`, item.milestone ? 'milestone' : 'positive', '', {
      title:item.name, xp:`+${item.xp} XP`, description:item.description
    });
    positive.chips.appendChild(chip);
  });
  if (!data.positive.length) positive.chips.appendChild(makeChip('NO NEW AWARDS', 'empty'));
  breakdown.appendChild(positive.line);

  const negative = makeSourceLine(`NEGATIVE ${data.penalty}`);
  if (data.negative.length) {
    data.negative.forEach(item => {
      const applied = !!item.applied;
      const countText = Number(item.count || 1) > 1 ? ` ×${Number(item.count)}` : '';
      negative.chips.appendChild(makeChip(`${item.name}${countText} ${item.penalty} XP${applied ? ' · APPLIED' : ''}`, 'negative', applied ? 'applied' : '', {
        title:item.name, xp:`${item.penalty} XP`, description: applied
          ? 'Misfire condition triggered in this game. This penalty is applied to the game XP total.'
          : 'Misfire condition triggered in this game, but a stronger normal Misfire penalty is applied instead.'
      }));
    });
  } else {
    negative.chips.appendChild(makeChip('NO MISFIRES', 'empty'));
  }
  breakdown.appendChild(negative.line);

  return { el, pre, post, rankHolder };
}

function animateCount(el, from, to, duration) {
  const start = performance.now();
  const format = value => `${value >= 0 ? '+' : ''}${value} XP`;
  function tick(now) {
    const k = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - k, 2);
    const value = Math.round(from + (to - from) * eased);
    el.textContent = format(value);
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function animateDetailedRow(host, built, data, reduced) {
  const { el, pre, post, rankHolder } = built;
  const gain = el.querySelector('.gc-xp-gain');
  const fill = el.querySelector('.gc-xp-fill');
  const gameFill = el.querySelector('.gc-xp-gamebar-fill');
  const gameScale = Math.max(1, Number(data.baseXp||0) + Number(data.positiveXp||0) + Math.abs(Number(data.penalty||0)));
  const gamePct = Math.max(0, Math.min(1, Math.abs(Number(data.netXp||0)) / gameScale));
  const levelUp = el.querySelector('.gc-xp-lvup');
  const didLevel = Number(post.level || 0) > Number(pre.level || 0);

  if (reduced) {
    el.classList.add('in');
    if (gameFill) { gameFill.style.transition='none'; gameFill.style.width=`${gamePct * 100}%`; }
    fill.style.transition = 'none';
    fill.style.width = `${Math.max(0, Math.min(1, Number(post.pct || 0))) * 100}%`;
    if (didLevel) {
      rankChip(host, rankHolder, post);
      levelUp.classList.add('in');
    }
    return;
  }

  gain.textContent = '+0 XP';
  if (gameFill) requestAnimationFrame(()=>{ gameFill.style.width=`${gamePct * 100}%`; });
  await new Promise(resolve => setTimeout(resolve, 70));
  el.classList.add('in');
  animateCount(gain, 0, data.netXp, 600);
  fill.style.width = `${Math.max(0, Math.min(1, Number(pre.pct || 0))) * 100}%`;
  await new Promise(resolve => requestAnimationFrame(() => resolve()));

  if (didLevel) {
    fill.style.width = '100%';
    await new Promise(resolve => setTimeout(resolve, 460));
    rankChip(host, rankHolder, post);
    levelUp.classList.add('in');
    el.classList.add('gc-levelup');
    try { if (typeof host.__sqV3SndGame === 'function') host.__sqV3SndGame(); } catch (_) {}
    fill.style.transition = 'none';
    fill.style.width = '0%';
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    fill.style.transition = '';
    fill.style.width = `${Math.max(0, Math.min(1, Number(post.pct || 0))) * 100}%`;
  } else {
    fill.style.width = `${Math.max(0, Math.min(1, Number(post.pct || 0))) * 100}%`;
  }
  await new Promise(resolve => setTimeout(resolve, didLevel ? 450 : 300));
}

async function buildPlayerData(host, st) {
  const board = Array.isArray(st.score) ? st.score : [];
  const statePlayers = Array.isArray(st.players) ? st.players : [];
  const totals = statePlayers.map((_, index) => scoreRowsTotal(board[index]));
  const maxTotal = Math.max(0, ...totals);
  const deciderWinner = st._decider && st._decider.resolved && Number.isInteger(st._decider.winner)
    ? st._decider.winner
    : null;

  let prefetchedXp = null;
  try {
    const existing = existingXpRows(host, st);
    if (existing) prefetchedXp = await existing;
  } catch (_) {}

  const playerRows = await Promise.all(statePlayers.map(async (player, index) => {
    const rawName = rawPlayerName(player);
    let xpRow = Array.isArray(prefetchedXp) ? prefetchedXp[index] : null;
    if (!xpRow) {
      try { xpRow = await host.SQ_XP.forName(rawName); } catch (_) {}
    }
    return {
      index,
      player,
      rawName,
      name: prettyPlayerName(player, index),
      playerId: String(xpRow && xpRow.player_id || player && (player.player_id || player.id) || '').trim(),
      pre: Number(xpRow && xpRow.total_xp || 0),
      allPlayerRows: null,
    };
  }));
  playerRows.forEach(row => { row.allPlayerRows = playerRows; });

  const context = await fetchCloudContext(host, playerRows);
  const runtimeAwards = awardMapFromRuntime(host, board, playerRows.map(row => ({ name:row.name, rawName:row.rawName })), st);
  const minTotal = Math.min(...totals);
  const bottomCount = totals.filter(value => value === minTotal).length;

  return playerRows.map(row => {
    const p = row.index;
    const won = deciderWinner != null ? p === deciderWinner : (maxTotal > 0 && totals[p] === maxTotal);
    const awardMap = runtimeAwards.get(p) || new Map();
    supplementCurrentGameAwards(host, awardMap, p, board[p] || [], totals, st, context, row);
    const positive = awardDetails(host, awardMap);

    const negative = detectImmediateMisfires(board[p] || [], totals[p]);
    addStreakMisfires(negative, context, row, totals[p], bottomCount === 1 && totals[p] === minTotal);
    const normalWorst = negative
      .filter(item => !isVoldeCode(item && item.code))
      .reduce((worst, item) => Math.min(worst, Number(item && item.penalty || 0)), 0);
    negative.forEach(item => {
      item.applied = isVoldeCode(item && item.code)
        ? Number(item && item.penalty || 0) < 0
        : (normalWorst < 0 && Number(item && item.penalty || 0) === normalWorst);
    });
    const penalty = appliedMisfirePenalty(negative);

    const scoreXp = Math.round(Number(totals[p] || 0) * Number(host.SQ_XP.W.point || 0));
    const gameXp = Number(host.SQ_XP.W.game || 0);
    const winXp = won ? Number(host.SQ_XP.W.gameWin || 0) : 0;
    const matchXp = matchWinBaseXp(st, p, totals);
    const base = [
      { label:'SCORE', xp:scoreXp, description:'XP generated directly from the points scored in this game.' },
      { label:'GAME', xp:gameXp, description:'Base XP awarded for completing an XP-eligible game.' },
    ];
    if (winXp) base.push({ label:'WIN', xp:winXp, description:'Base XP awarded for winning this game.' });
    if (matchXp) base.push({ label:'MATCH WIN', xp:matchXp, description:'Base XP awarded for winning the completed match.' });

    const positiveXp = positive.reduce((sum, item) => sum + Number(item.xp || 0), 0);
    const baseXp = base.reduce((sum, item) => sum + Number(item.xp || 0), 0);
    const netXp = baseXp + positiveXp + penalty;

    return {
      ...row,
      won,
      total:totals[p],
      base,
      positive,
      negative,
      penalty,
      baseXp,
      positiveXp,
      netXp,
      post:Math.max(0, row.pre + netXp),
    };
  }).sort((a, b) => (Number(b.won) - Number(a.won)) || (b.netXp - a.netXp));
}

function startDetailedXpPrefetch(host, st = getState()) {
  try {
    if (!host || !st || !host.SQ_XP || !host.SQ_ACH || !isRankedXpMode(st)) return Promise.resolve(null);
    const key = xpPrefetchKey(st);
    const existing = host.__sqSc038XpPrefetch;
    if (existing && existing.key === key && existing.promise) return existing.promise;
    const promise = buildPlayerData(host, st).then(data => {
      try {
        if (host.__sqSc038XpPrefetch && host.__sqSc038XpPrefetch.key === key) {
          host.__sqSc038XpPrefetch.resolved = data;
          host.__sqSc038XpPrefetch.resolvedAt = performance.now();
        }
      } catch (_) {}
      return data;
    });
    host.__sqSc038XpPrefetch = { key, promise, resolved:null, startedAt:performance.now() };
    return promise;
  } catch (_) {
    return Promise.resolve(null);
  }
}

async function detailedReveal(hostEl, onComplete, original, host) {
  const st = getState();
  if (!st || !Array.isArray(st.score) || !host.SQ_XP || !host.SQ_ACH || !isRankedXpMode(st)) {
    return original(hostEl, onComplete);
  }

  try {
    injectStyles();
    const data = await startDetailedXpPrefetch(host, st);
    const reduced = typeof host.__sqV3Reduced === 'function' ? !!host.__sqV3Reduced() : false;
    const panel = document.createElement('div');
    panel.className = 'gc-xp-panel sq-xp-detailed-panel';
    const title = document.createElement('div');
    title.className = 'gc-xp-title';
    title.textContent = 'XP EARNED';
    panel.appendChild(title);
    hostEl.replaceChildren(panel);

    const builtRows = data.map(row => ({ row, built:buildDetailedRow(host, row) }));
    builtRows.forEach(({ built }) => panel.appendChild(built.el));
    await Promise.all(builtRows.map(({ row, built }) => animateDetailedRow(host, built, row, reduced)));

    try { host.SQ_XP._cache = null; host.SQ_ACH._cache = {}; } catch (_) {}
    if (typeof onComplete === 'function') onComplete();
  } catch (err) {
    try { console.error('[SC-038] detailed XP breakdown failed; restoring canonical renderer', err); } catch (_) {}
    try { hostEl.replaceChildren(); } catch (_) {}
    return original(hostEl, onComplete);
  }
}

export function installXpBreakdown(host = globalThis) {
  if (!host || typeof document === 'undefined') return false;
  if (host[INSTALL_FLAG]) return true;
  const original = host.__sqGcXpReveal;
  if (typeof original !== 'function') return false;
  if (original.__sqSc038DetailedBreakdown) {
    host[INSTALL_FLAG] = true;
    return true;
  }

  const detailed = function(hostEl, onComplete) {
    return detailedReveal(hostEl, onComplete, original, host);
  };
  detailed.__sqSc038DetailedBreakdown = true;
  detailed[ORIGINAL_KEY] = original;
  host.__sqGcXpReveal = detailed;
  host[INSTALL_FLAG] = true;
  host.__sqSc038StartXpPrefetch = st => startDetailedXpPrefetch(host, st || getState());
  host.__sqSc038XpBreakdown = {
    detectImmediateMisfires,
    appliedMisfirePenalty,
  };
  injectStyles();
  return true;
}

function boot() {
  let tries = 0;
  const attempt = () => {
    tries += 1;
    if (installXpBreakdown(window) || tries >= 120) return;
    setTimeout(attempt, 50);
  };
  attempt();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
