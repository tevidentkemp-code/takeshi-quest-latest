const STYLE_ID = 'sq-sc038-postgame-styles';
const WR_VIEW = 'v_player_best_official_ranked';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function playerDisplayParts(player, fallback = '') {
  const p = player || {};
  const rawName = String(p.name || p.player || fallback || '').trim();
  const split = rawName.split(/\s+/).filter(Boolean);
  const first = String(p.first_name || p.first || '').trim() || split[0] || '';
  const last = String(p.last_name || p.last || '').trim() || split.slice(1).join(' ');
  const nickname = String(p.nickname || p.nick || '').trim();
  const main = [first, last].filter(Boolean).join(' ').trim() || rawName || fallback;
  return { main, nickname, rawName };
}

export function bestRoundSummary(scoreRows) {
  const rows = Array.isArray(scoreRows) ? scoreRows : [];
  let bestScore = -Infinity;
  let bestIndex = -1;
  rows.forEach((row, index) => {
    const n = Number(row && row.roundTotal || 0);
    if (Number.isFinite(n) && n > bestScore) {
      bestScore = n;
      bestIndex = index;
    }
  });
  if (bestIndex < 0) return { roundNumber: 1, score: 0, label: 'R1 / 0' };
  return {
    roundNumber: bestIndex + 1,
    score: Math.max(0, bestScore),
    label: `R${bestIndex + 1} / ${Math.max(0, bestScore)}`
  };
}

export function completedRoundCount(scoreRows) {
  const rows = Array.isArray(scoreRows) ? scoreRows : [];
  const count = rows.reduce((n, row) => {
    const darts = row && Array.isArray(row.darts) ? row.darts : [];
    const touched = darts.some(d => d != null) || (row && row.roundTotal != null);
    return n + (touched ? 1 : 0);
  }, 0);
  return Math.max(1, count || rows.length || 1);
}

function normalizeName(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

export function recordFlagsFromSnapshot(snapshotRows, player, score, currentGameBest = null) {
  const rows = Array.isArray(snapshotRows) ? snapshotRows : [];
  const p = player || {};
  const playerId = String(p.player_id || p.id || '').trim();
  const playerName = normalizeName(p.name || p.player || '');
  const current = Number(score || 0);
  if (!(current > 0) || !rows.length) return { pb: false, wr: false, previousBest: null, worldBest: null };

  let previous = null;
  for (const row of rows) {
    const rowId = String(row && row.player_id || '').trim();
    const rowName = normalizeName(row && row.player_name);
    if ((playerId && rowId === playerId) || (!playerId && playerName && rowName === playerName) || (playerName && rowName === playerName)) {
      previous = row;
      break;
    }
  }

  const worldBest = rows.reduce((m, row) => Math.max(m, Number(row && row.best_score || 0)), 0);
  const previousBest = previous ? Number(previous.best_score || 0) : 0;
  const gameBest = Number(currentGameBest || 0);
  const isFinalGameBest = !(gameBest > 0) || current >= gameBest;
  return {
    pb: previousBest > 0 && current > previousBest,
    wr: worldBest > 0 && current > worldBest && isFinalGameBest,
    previousBest: previousBest || null,
    worldBest: worldBest || null
  };
}

export function finalAdvanceLabel(existingText) {
  return /end\s*match|finish\s*match/i.test(String(existingText || '')) ? 'FINISH MATCH' : 'NEXT GAME';
}

function getState() {
  try { return state; } catch (_) { return null; }
}

function getMode() {
  try {
    if (typeof window.__sqComputeGameMode === 'function') return String(window.__sqComputeGameMode() || '').toLowerCase();
  } catch (_) {}
  const st = getState();
  return String(st && (st.gameMode || st.mode || st.match?.mode || st.match?.gameMode) || '').toLowerCase();
}

function scoreForPlayer(st, index) {
  const rows = st && st.score && st.score[index];
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row && row.roundTotal || 0), 0);
}


export function currentGameWinnerIndex(st) {
  const players = Array.isArray(st?.players) ? st.players : [];
  if (!players.length) return -1;
  const totals = players.map((_, i) => scoreForPlayer(st, i));
  const max = totals.length ? Math.max(...totals) : 0;
  const leaders = totals.map((value, index) => value === max ? index : -1).filter(index => index >= 0);
  let winnerIndex = leaders.length === 1 ? leaders[0] : -1;
  try {
    if (st?._decider?.resolved && st._decider.gameToken === (st.__gameToken || 0)
      && Number.isInteger(st._decider.winner) && players[st._decider.winner]) {
      winnerIndex = st._decider.winner;
    }
  } catch (_) {}
  return winnerIndex;
}

export function projectedMatchCompletion(st, modeOverride = '') {
  const players = Array.isArray(st?.players) ? st.players : [];
  const match = st?.match || {};
  const mode = String(modeOverride || st?.gameMode || st?.mode || match?.gameMode || match?.mode || '').toLowerCase();
  const targetWins = Math.max(1, Number(match.targetWins) || 1);
  const currentWins = Array.from({ length: players.length }, (_, index) => Math.max(0, Number(match.wins?.[index]) || 0));
  const projectedWins = currentWins.slice();
  const gameWinnerIndex = currentGameWinnerIndex(st);
  const nonMatchWinMode = /practice|training|shadow/.test(mode) || st?.forcePractice === true || st?.isPractice === true;

  if (!nonMatchWinMode && !st?.gameAwarded && gameWinnerIndex >= 0) {
    projectedWins[gameWinnerIndex] = (projectedWins[gameWinnerIndex] || 0) + 1;
  }

  const maxWins = projectedWins.length ? Math.max(...projectedWins) : 0;
  const leaders = projectedWins.map((value, index) => value === maxWins ? index : -1).filter(index => index >= 0);
  const winnerIndex = leaders.length === 1 ? leaders[0] : -1;
  const complete = !nonMatchWinMode && winnerIndex >= 0 && maxWins >= targetWins;

  return { complete, targetWins, winnerIndex, projectedWins, gameWinnerIndex, mode };
}

function scorecardRows(st) {
  const players = Array.isArray(st && st.players) ? st.players : [];
  const totals = players.map((_, index) => scoreForPlayer(st, index));
  const max = totals.length ? Math.max(...totals) : 0;
  return players.map((player, index) => {
    const rows = Array.isArray(st.score?.[index]) ? st.score[index] : [];
    const parts = playerDisplayParts(player, `Player ${index + 1}`);
    const rounds = completedRoundCount(rows);
    return {
      index,
      player,
      parts,
      score: totals[index] || 0,
      average: (totals[index] || 0) / rounds,
      best: bestRoundSummary(rows),
      winner: (totals[index] || 0) === max
    };
  }).sort((a, b) => (b.score - a.score) || a.parts.main.localeCompare(b.parts.main));
}

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* SC-038: preserve the current dark arcade cabinet; presentation only. */
body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn[data-bull="Outer"],
body .modal-decider .dtBullRow .dtBullBtn[data-bull="Outer"]{
  background:linear-gradient(180deg,rgba(18,92,52,.90),rgba(8,48,29,.98)) !important;
  border-color:rgba(72,224,124,.86) !important;
  color:#bcffd2 !important;
  box-shadow:0 0 0 1px rgba(47,208,107,.12),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(220,255,232,.10),0 0 18px rgba(47,208,107,.12) !important;
}
body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn.inner[data-bull="Inner"],
body .modal-decider .dtBullRow .dtBullBtn.inner[data-bull="Inner"]{
  background:linear-gradient(180deg,rgba(126,27,42,.92),rgba(62,10,23,.98)) !important;
  border-color:rgba(255,77,94,.88) !important;
  color:#ffc1c8 !important;
  box-shadow:0 0 0 1px rgba(255,77,94,.11),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,225,229,.10),0 0 18px rgba(255,77,94,.11) !important;
}
.modal-gamecomplete.sq-gc-arcade .gc-arcade-visual .sq-gc-celebration-sprite{
  position:absolute;
  top:0;
  right:0;
  height:100%;
  aspect-ratio:4 / 5;
  background-repeat:no-repeat;
  background-size:600% 500%;
  filter:saturate(1.04) contrast(1.04);
}
.modal-gamecomplete.sq-gc-arcade .gc-winnerName.sq-pg-winner-name{
  margin-bottom:18px;
  max-width:min(440px,92vw);
  line-height:1;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-mainname{
  display:block;
  font-size:clamp(27px,6.2vw,42px);
  line-height:.98;
  font-weight:950;
  letter-spacing:.005em;
  color:var(--shatekiOrange,#ff7a00);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-nickname{
  display:block;
  margin-top:7px;
  font-size:clamp(14px,3.8vw,20px);
  line-height:1.05;
  font-weight:850;
  letter-spacing:.08em;
  color:rgba(255,186,104,.92);
}
.modal-gamecomplete.sq-gc-arcade .gc-statRow .gc-statValue{ white-space:nowrap; }
.modal-gamecomplete.sq-gc-arcade .gc-arcade-actions{ display:none !important; }
.modal-gamecomplete.sq-gc-arcade .gc-ranks{ display:none !important; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-screen[hidden]{ display:none !important; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-scorecard,
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-screen{
  position:relative;
  z-index:4;
  width:100%;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-scorecard-title,
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-heading{
  margin:0 0 16px;
  color:rgba(238,241,255,.94);
  font-size:clamp(22px,5.4vw,34px);
  line-height:1;
  font-weight:950;
  letter-spacing:.10em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-head,
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) 48px 48px 82px;
  gap:6px;
  align-items:center;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-head{
  padding:0 10px 7px;
  color:rgba(238,241,255,.50);
  font-size:9px;
  font-weight:950;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-row{
  min-height:54px;
  padding:8px 10px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:12px;
  background:linear-gradient(180deg,rgba(18,25,38,.88),rgba(8,13,22,.94));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 18px rgba(0,0,0,.20);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-row.is-winner{
  border-color:rgba(255,122,0,.34);
  box-shadow:inset 3px 0 0 var(--shatekiOrange,#ff7a00),inset 0 1px 0 rgba(255,255,255,.04),0 8px 18px rgba(0,0,0,.20);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-player-main{
  min-width:0;
  font-size:13px;
  line-height:1.05;
  font-weight:950;
  color:rgba(248,249,255,.96);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-player-nick{
  display:block;
  margin-top:3px;
  color:rgba(255,174,86,.72);
  font-size:9px;
  font-weight:800;
  letter-spacing:.05em;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-num{
  text-align:right;
  color:rgba(244,247,255,.94);
  font-size:13px;
  font-weight:950;
  font-variant-numeric:tabular-nums;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-best{ font-size:11px; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-records{
  grid-column:1 / -1;
  display:flex;
  gap:6px;
  min-height:0;
  margin-top:-1px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-records:empty{ display:none; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-badge{
  display:inline-flex;
  align-items:center;
  min-height:22px;
  padding:3px 8px;
  border-radius:999px;
  font-size:9px;
  line-height:1;
  font-weight:950;
  letter-spacing:.07em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-badge.pb{
  color:#b8ffd0;
  border:1px solid rgba(47,208,107,.46);
  background:rgba(47,208,107,.11);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-badge.wr{
  color:#e1c3ff;
  border:1px solid rgba(176,107,255,.54);
  background:rgba(176,107,255,.13);
  box-shadow:0 0 14px rgba(176,107,255,.10);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-nav{
  position:relative;
  z-index:5;
  width:100%;
  margin-top:16px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-nav{ display:grid; grid-template-columns:minmax(96px,.34fr) minmax(0,1fr); gap:8px; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-back,
.modal-gamecomplete.sq-gc-arcade .sq-pg-next{
  width:100%;
  min-height:58px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(180deg,rgba(28,35,48,.98),rgba(12,17,26,.99));
  color:#eef3ff;
  font-size:13px;
  font-weight:950;
  letter-spacing:.10em;
  text-transform:uppercase;
  box-shadow:0 12px 28px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-back:not(:disabled):active,
.modal-gamecomplete.sq-gc-arcade .sq-pg-next:not(:disabled):active{ transform:translateY(1px); filter:brightness(1.10); }
.modal-gamecomplete.sq-gc-arcade .sq-pg-next:disabled{ opacity:.48; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-screen .gc-xp-reveal{
  width:100%;
  margin:0;
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal{
  width:min(94vw,620px);
  max-width:620px;
  max-height:min(88vh,820px);
  padding:0;
  overflow:hidden;
  border:1px solid rgba(255,122,0,.24);
  border-radius:22px;
  background:linear-gradient(165deg,#151b28 0%,#090d14 100%);
  box-shadow:0 24px 60px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.05);
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal .modal-body.sq-pg-history-body{
  display:flex;
  flex-direction:column;
  gap:14px;
  max-height:72vh;
  padding:18px;
  overflow-y:auto;
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal .sq-pg-history-scorecard{
  display:block;
  padding:15px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:16px;
  background:linear-gradient(180deg,rgba(18,25,38,.94),rgba(8,13,22,.98));
  box-shadow:inset 3px 0 0 rgba(255,122,0,.70),0 10px 24px rgba(0,0,0,.24);
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal .sq-pg-history-scorecard .sq-pg-scorecard-title{
  margin-bottom:14px;
  font-size:clamp(18px,4.8vw,28px);
}


.modal-gamecomplete.sq-gc-arcade .sq-pg-match-win{
  position:relative;
  z-index:4;
  width:100%;
  min-height:390px;
  overflow:hidden;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-stage{
  position:relative;
  min-height:390px;
  border:1px solid rgba(255,122,0,.26);
  border-radius:18px;
  overflow:hidden;
  background:radial-gradient(circle at 78% 20%,rgba(255,122,0,.18),transparent 38%),linear-gradient(150deg,rgba(25,31,45,.98),rgba(7,11,18,.99));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 16px 34px rgba(0,0,0,.30);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-copy{
  position:relative;
  z-index:4;
  width:min(58%,330px);
  padding:28px 0 0 22px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-kicker{
  color:rgba(255,184,101,.88);
  font-size:11px;
  font-weight:950;
  letter-spacing:.18em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-name{
  margin-top:9px;
  color:var(--shatekiOrange,#ff7a00);
  font-size:clamp(30px,7vw,46px);
  line-height:.95;
  font-weight:950;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-nick{
  margin-top:8px;
  color:rgba(255,211,158,.92);
  font-size:clamp(13px,3.6vw,19px);
  font-weight:850;
  letter-spacing:.07em;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-score{
  display:inline-flex;
  align-items:center;
  min-height:34px;
  margin-top:18px;
  padding:7px 11px;
  border:1px solid rgba(255,122,0,.34);
  border-radius:999px;
  color:#fff2df;
  background:rgba(255,122,0,.10);
  font-size:15px;
  font-weight:950;
  letter-spacing:.07em;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-celebration{
  position:absolute;
  z-index:2;
  top:0;
  right:-4%;
  height:100%;
  aspect-ratio:4 / 5;
  background-repeat:no-repeat;
  background-size:600% 500%;
  filter:saturate(1.10) contrast(1.06);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent-rail{
  position:absolute;
  z-index:5;
  left:18px;
  right:18px;
  bottom:16px;
  display:flex;
  align-items:flex-end;
  gap:8px;
  pointer-events:none;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent{
  position:relative;
  width:44px;
  height:44px;
  flex:0 0 44px;
  border:1px solid rgba(255,255,255,.18);
  border-radius:50%;
  overflow:visible;
  background-color:#101723;
  box-shadow:0 8px 18px rgba(0,0,0,.38);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent-avatar{
  position:absolute;
  inset:0;
  border-radius:inherit;
  background-repeat:no-repeat;
  background-size:600% 500%;
  filter:saturate(.76) brightness(.78);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent-reaction{
  position:absolute;
  right:-5px;
  bottom:-7px;
  display:grid;
  place-items:center;
  width:21px;
  height:21px;
  border-radius:50%;
  border:1px solid rgba(255,255,255,.18);
  background:#0b1018;
  font-size:12px;
  line-height:1;
}

@media (max-width:560px){
  .modal-gamecomplete.sq-gc-arcade .gc-arcade-shell{ min-height:0; padding:28px 18px 20px; }
  .modal-gamecomplete.sq-gc-arcade .gc-arcade-content{ min-height:360px; }
  .modal-gamecomplete.sq-gc-arcade .gc-winnerName.sq-pg-winner-name{ max-width:75%; }
  .modal-gamecomplete.sq-gc-arcade .gc-statPanel{ width:min(310px,82%); }
  .modal-gamecomplete.sq-gc-arcade .sq-pg-score-head,
  .modal-gamecomplete.sq-gc-arcade .sq-pg-score-row{ grid-template-columns:minmax(0,1fr) 44px 44px 76px; gap:5px; }
}
`;
  document.head.appendChild(style);
}


function updateHero(modal, st) {
  const winnerIndex = currentGameWinnerIndex(st);
  if (winnerIndex < 0) return;

  const player = st.players[winnerIndex] || {};
  const parts = playerDisplayParts(player, 'Player ' + (winnerIndex + 1));
  const visual = modal.querySelector('.gc-arcade-visual');
  if (visual && typeof window !== 'undefined' && typeof window.__sqAvatarSpritePosition === 'function') {
    const id = (typeof window.__sqAvatarIdForPlayer === 'function') ? window.__sqAvatarIdForPlayer(player) : 1;
    const pos = window.__sqAvatarSpritePosition(id);
    visual.style.background = 'none';
    visual.innerHTML = '';
    const art = document.createElement('div');
    art.className = 'sq-gc-celebration-sprite sq-pg-game-win-art';
    art.dataset.avatarId = String(pos.id);
    art.style.backgroundImage = 'url("./assets/avatars/celebration-sprite.webp")';
    art.style.backgroundPosition = pos.x.toFixed(4) + '% ' + pos.y.toFixed(4) + '%';
    visual.appendChild(art);
  }
  const winnerEl = modal.querySelector('.gc-winnerName');
  if (winnerEl) {
    winnerEl.classList.add('sq-pg-winner-name');
    winnerEl.innerHTML = '<span class="sq-pg-mainname">' + esc(parts.main) + '</span>'
      + (parts.nickname ? '<span class="sq-pg-nickname">&ldquo;' + esc(parts.nickname) + '&rdquo;</span>' : '');
    winnerEl.setAttribute('title', [parts.main, parts.nickname ? '"' + parts.nickname + '"' : ''].filter(Boolean).join(' '));
  }

  const kicker = modal.querySelector('.gc-arcade-kicker');
  if (kicker) kicker.textContent = 'GAME WINNER';

  const best = bestRoundSummary(st.score?.[winnerIndex] || []);
  const statRows = Array.from(modal.querySelectorAll('.gc-statRow'));
  statRows.forEach(row => {
    const label = String(row.querySelector('.gc-statLabel')?.textContent || '').trim().toLowerCase();
    const value = row.querySelector('.gc-statValue');
    if (!value) return;
    if (label === 'best round') value.textContent = best.label;
  });
}

function buildScorecard(modal, st, opts = {}) {
  const screen = document.createElement('section');
  screen.className = 'sq-pg-screen sq-pg-scorecard';
  screen.hidden = true;
  screen.innerHTML = `
    <h2 class="sq-pg-scorecard-title">${esc(opts.title || 'GAME SCORECARD')}</h2>
    <div class="sq-pg-score-head" aria-hidden="true">
      <span>Name</span><span>Score</span><span>Avg</span><span>Best Round</span>
    </div>
    <div class="sq-pg-score-list"></div>
  `;
  const list = screen.querySelector('.sq-pg-score-list');
  const rows = scorecardRows(st);
  rows.forEach(row => {
    const el = document.createElement('div');
    el.className = 'sq-pg-score-row' + (row.winner ? ' is-winner' : '');
    el.dataset.playerIndex = String(row.index);
    el.innerHTML = `
      <div class="sq-pg-player-main">${esc(row.parts.main)}${row.parts.nickname ? `<span class="sq-pg-player-nick">&ldquo;${esc(row.parts.nickname)}&rdquo;</span>` : ''}</div>
      <div class="sq-pg-num">${esc(row.score)}</div>
      <div class="sq-pg-num">${esc(row.average.toFixed(1))}</div>
      <div class="sq-pg-num sq-pg-best">${esc(row.best.label)}</div>
      <div class="sq-pg-records" data-records-for="${row.index}"></div>
    `;
    list.appendChild(el);
  });
  return { screen, rows };
}

function openMatchGameScores(st = getState()) {
  const history = Array.isArray(st?.match?.history) ? st.match.history : [];
  const players = Array.isArray(st?.players) ? st.players : [];
  if (!history.length || !players.length) return false;
  if (typeof window.sqModal !== 'function') return false;

  injectStyles();
  const m = window.sqModal({
    title:'GAME SCORES',
    closeButton:'CLOSE',
    modalClass:'modal-gamecomplete sq-gc-arcade sq-pg-history-modal',
    maxWidth:'620px',
    width:'94vw'
  });
  m.body.classList.add('sq-pg-history-body');

  history.forEach((game, index) => {
    const board = Array.isArray(game?.board) ? game.board : [];
    const pseudo = { players, score: board };
    const built = buildScorecard(m.modal, pseudo, { title:`GAME ${index + 1} SCORECARD` });
    built.screen.hidden = false;
    built.screen.classList.add('sq-pg-history-scorecard');
    m.body.appendChild(built.screen);
  });
  return true;
}

async function hydrateRecordBadges(st, rows, scorecard) {
  if (getMode() !== 'official') return;
  const client = window.sb;
  if (!client || typeof client.from !== 'function') return;
  try {
    const { data, error } = await client
      .from(WR_VIEW)
      .select('player_id,player_name,best_score,best_score_pos');
    if (error || !Array.isArray(data) || !data.length) return;
    const currentGameBest = rows.reduce((m, row) => Math.max(m, Number(row && row.score || 0)), 0);
    rows.forEach(row => {
      const flags = recordFlagsFromSnapshot(data, row.player, row.score, currentGameBest);
      if (!flags.pb && !flags.wr) return;
      const host = scorecard.querySelector(`[data-records-for="${row.index}"]`);
      if (!host) return;
      if (flags.pb) host.insertAdjacentHTML('beforeend', '<span class="sq-pg-badge pb">PB</span>');
      if (flags.wr) host.insertAdjacentHTML('beforeend', '<span class="sq-pg-badge wr">WR</span>');
    });
  } catch (err) {
    try { console.warn('[SC-038] PB/WR scorecard read unavailable', err); } catch (_) {}
  }
}


function buildXpScreen() {
  const screen = document.createElement('section');
  screen.className = 'sq-pg-screen sq-pg-xp-screen';
  screen.hidden = true;
  screen.innerHTML = '<div class="gc-xp-reveal sq-pg-xp-host"></div>';
  return screen;
}

function buildMatchWinScreen(st, matchState) {
  if (!matchState?.complete || matchState.winnerIndex < 0) return null;
  const winnerIndex = matchState.winnerIndex;
  const player = st.players?.[winnerIndex] || {};
  const parts = playerDisplayParts(player, 'Player ' + (winnerIndex + 1));
  const projectedWins = matchState.projectedWins || [];
  const scoreText = projectedWins.length === 2
    ? Number(projectedWins[0] || 0) + '–' + Number(projectedWins[1] || 0)
    : Number(projectedWins[winnerIndex] || 0) + ' WINS';

  const screen = document.createElement('section');
  screen.className = 'sq-pg-screen sq-pg-match-win';
  screen.hidden = true;
  screen.innerHTML =
    '<div class="sq-pg-match-stage">'
      + '<div class="sq-pg-match-copy">'
        + '<div class="sq-pg-match-kicker">MATCH WINNER</div>'
        + '<div class="sq-pg-match-name">' + esc(parts.main) + '</div>'
        + (parts.nickname ? '<div class="sq-pg-match-nick">&ldquo;' + esc(parts.nickname) + '&rdquo;</div>' : '')
        + '<div class="sq-pg-match-score">' + esc(scoreText) + '</div>'
      + '</div>'
      + '<div class="sq-pg-opponent-rail" aria-label="Other match players"></div>'
    + '</div>';

  const stage = screen.querySelector('.sq-pg-match-stage');
  if (stage && typeof window !== 'undefined' && typeof window.__sqAvatarSpritePosition === 'function') {
    const winnerId = (typeof window.__sqAvatarIdForPlayer === 'function') ? window.__sqAvatarIdForPlayer(player) : 1;
    const winnerPos = window.__sqAvatarSpritePosition(winnerId);
    const art = document.createElement('div');
    art.className = 'sq-pg-match-celebration';
    art.dataset.avatarId = String(winnerPos.id);
    art.style.backgroundImage = 'url("./assets/avatars/celebration-sprite.webp")';
    art.style.backgroundPosition = winnerPos.x.toFixed(4) + '% ' + winnerPos.y.toFixed(4) + '%';
    stage.appendChild(art);

    const rail = screen.querySelector('.sq-pg-opponent-rail');
    (st.players || []).forEach((opponent, index) => {
      if (index === winnerIndex || !rail) return;
      const id = (typeof window.__sqAvatarIdForPlayer === 'function') ? window.__sqAvatarIdForPlayer(opponent) : 1;
      const pos = window.__sqAvatarSpritePosition(id);
      const chip = document.createElement('div');
      chip.className = 'sq-pg-opponent';
      chip.setAttribute('aria-label', playerDisplayParts(opponent, 'Player ' + (index + 1)).main);
      chip.innerHTML = '<div class="sq-pg-opponent-avatar"></div><span class="sq-pg-opponent-reaction" aria-hidden="true"></span>';
      const avatar = chip.querySelector('.sq-pg-opponent-avatar');
      avatar.style.backgroundImage = 'url("./assets/avatars/avatar-sprite.webp")';
      avatar.style.backgroundPosition = pos.x.toFixed(4) + '% ' + pos.y.toFixed(4) + '%';
      chip.querySelector('.sq-pg-opponent-reaction').textContent = ((index + winnerIndex) % 2 === 0) ? '👏' : '😤';
      rail.appendChild(chip);
    });
  }
  return screen;
}

function isUnresolvedDecider(modal) {
  return !!modal.querySelector('[data-action="startDecider"]');
}


function upgradePostGameOverlay(overlay) {
  try { window.__sqQuickEntry?.close?.(); } catch (_) {}
  try { document.querySelectorAll('.sqQuickEntryPopover').forEach(el=>el.remove()); } catch (_) {}
  try { document.querySelectorAll('#pad .sq-quick-holding,#pad .sq-miss-bounce-held').forEach(el=>el.classList.remove('sq-quick-holding','sq-miss-bounce-held')); } catch (_) {}
  if (!overlay || overlay.dataset.sqSc038 === '1') return;
  const modal = overlay.querySelector('.modal-gamecomplete.sq-gc-arcade');
  if (!modal || isUnresolvedDecider(modal)) return;
  const st = getState();
  if (!st || !Array.isArray(st.players) || !st.players.length) return;

  // SXP-04: start the detailed XP/history package while Game Winner is on screen.
  // Rewards reveal reuses this promise; no XP formula or persistence rule changes.
  try { window.__sqSc038StartXpPrefetch?.(st); } catch (_) {}

  overlay.dataset.sqSc038 = '1';
  const advanceBtn = modal.querySelector('[data-action="advanceMatch"]');
  if (!advanceBtn) return;

  const matchState = projectedMatchCompletion(st, getMode());
  const isMatchComplete = !!matchState.complete;
  overlay.dataset.sqSc055MatchComplete = isMatchComplete ? '1' : '0';
  updateHero(modal, st);

  Array.from(modal.querySelectorAll('.gc-actions.gc-arcade-actions')).forEach(group => {
    group.style.setProperty('display', 'none', 'important');
    group.setAttribute('aria-hidden', 'true');
  });
  const oldXpHost = modal.querySelector('.gc-xp-reveal:not(.sq-pg-xp-host)');
  if (oldXpHost) oldXpHost.style.display = 'none';
  const ranks = modal.querySelector('.gc-ranks');
  if (ranks) { ranks.style.setProperty('display', 'none', 'important'); ranks.setAttribute('aria-hidden', 'true'); }

  const shell = modal.querySelector('.gc-arcade-shell') || modal;
  const hero = modal.querySelector('.gc-arcade-content');
  if (!hero) return;
  hero.classList.add('sq-pg-screen', 'sq-pg-result');

  const built = buildScorecard(modal, st);
  const scorecard = built.screen;
  const rows = built.rows;
  const xpScreen = buildXpScreen();
  const matchWinScreen = isMatchComplete ? buildMatchWinScreen(st, matchState) : null;
  const nav = document.createElement('div');
  nav.className = 'sq-pg-nav';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'sq-pg-back';
  back.textContent = '◀ BACK';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'sq-pg-next';
  next.textContent = 'NEXT ▶';
  nav.append(back, next);

  shell.appendChild(scorecard);
  shell.appendChild(xpScreen);
  if (matchWinScreen) shell.appendChild(matchWinScreen);
  shell.appendChild(nav);

  hydrateRecordBadges(st, rows, scorecard);

  let xpStarted = false;
  let xpReady = false;
  let xpSafety = null;

  const show = n => {
    next.dataset.pgStep = String(n);
    back.dataset.pgStep = String(n);
    hero.hidden = n !== 0;
    scorecard.hidden = n !== 1;
    xpScreen.hidden = n !== 2;
    if (matchWinScreen) matchWinScreen.hidden = n !== 3;
    const visual = modal.querySelector('.gc-arcade-visual');
    const confetti = modal.querySelector('.gc-arcade-confetti');
    if (visual) visual.style.display = n === 0 ? '' : 'none';
    if (confetti) confetti.style.display = (n === 0 || (isMatchComplete && n === 3)) ? '' : 'none';
    back.textContent = n === 0 ? '◀ GAME' : '◀ BACK';
  };

  const returnToFinishedGame = () => {
    try { if (xpSafety) clearTimeout(xpSafety); } catch (_) {}
    try { window.__sqQuickEntry?.close?.(); } catch (_) {}
    try { document.querySelectorAll('#pad .sq-miss-bounce-held').forEach(el=>el.classList.remove('sq-miss-bounce-held')); } catch (_) {}
    overlay.remove();
    try {
      // Restore the canonical live-game surface exactly as completed. The
      // existing Undo path is the sole mechanism that reopens the final dart.
      if (document.body) document.body.setAttribute('data-page', 'game');
      if (typeof updateUI === 'function') updateUI();
    } catch (_) {}
  };

  back.onclick = event => {
    try { event?.preventDefault?.(); event?.stopPropagation?.(); } catch (_) {}
    const current = Number(next.dataset.pgStep || 0);
    if (current <= 0) { returnToFinishedGame(); return; }
    show(current - 1);
    if (current - 1 === 0 || current - 1 === 1) next.textContent = 'NEXT ▶';
    else if (current - 1 === 2) next.textContent = xpReady ? (isMatchComplete ? 'MATCH WIN ▶' : 'MATCH LEADERBOARD') : 'XP…';
  };

  const enableFinalAdvance = () => {
    if (xpReady) return;
    xpReady = true;
    if (xpSafety) clearTimeout(xpSafety);
    next.disabled = false;
    next.textContent = isMatchComplete ? 'MATCH WIN ▶' : 'MATCH LEADERBOARD';
  };

  const startXp = () => {
    if (xpStarted) return;
    xpStarted = true;
    next.disabled = true;
    next.textContent = 'XP…';
    const host = xpScreen.querySelector('.sq-pg-xp-host');
    try { if (typeof window.__sqGcXpEnsureStyles === 'function') window.__sqGcXpEnsureStyles(); } catch (_) {}
    if (typeof window.__sqGcXpReveal === 'function') {
      window.__sqGcXpReveal(host, enableFinalAdvance);
      xpSafety = setTimeout(enableFinalAdvance, 9000);
    } else {
      if (host) host.innerHTML = '<div class="gc-xp-title">XP SUMMARY UNAVAILABLE</div>';
      enableFinalAdvance();
    }
  };

  next.onclick = event => {
    try { event?.preventDefault?.(); event?.stopPropagation?.(); } catch (_) {}
    const current = Number(next.dataset.pgStep || 0);
    if (current === 0 || !hero.hidden) {
      show(1);
      next.textContent = 'NEXT ▶';
      return;
    }
    if (current === 1 || !scorecard.hidden) {
      show(2);
      startXp();
      return;
    }
    if ((current === 2 || !xpScreen.hidden) && xpReady) {
      if (isMatchComplete && matchWinScreen) {
        show(3);
        next.textContent = 'MATCH LEADERBOARD';
        return;
      }
      advanceBtn.click();
      return;
    }
    if (current === 3 && matchWinScreen && !matchWinScreen.hidden) {
      advanceBtn.click();
    }
  };

  show(0);
}

function installPostGameFlow() {
  injectStyles();
  if (typeof window === 'undefined') return false;
  const original = window.openGameCompleteDialog;
  if (typeof original !== 'function') return false;
  if (original.__sqSc038Wrapped) return true;

  function wrappedOpenGameCompleteDialog(...args) {
    const out = original.apply(this, args);
    queueMicrotask(() => {
      try {
        const overlays = document.querySelectorAll('.sq-gamecomplete-backdrop');
        upgradePostGameOverlay(overlays[overlays.length - 1]);
      } catch (err) {
        try { console.warn('[SC-038] post-game presentation upgrade failed', err); } catch (_) {}
      }
    });
    return out;
  }
  wrappedOpenGameCompleteDialog.__sqSc038Wrapped = true;
  wrappedOpenGameCompleteDialog.__sqSc038Original = original;
  window.openGameCompleteDialog = wrappedOpenGameCompleteDialog;
  window.__sqOpenMatchGameScores = function(){ return openMatchGameScores(getState()); };
  return true;
}

function boot() {
  injectStyles();
  let tries = 0;
  const attempt = () => {
    tries += 1;
    if (installPostGameFlow() || tries >= 120) return;
    setTimeout(attempt, 50);
  };
  attempt();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export { installPostGameFlow, upgradePostGameOverlay, scorecardRows, openMatchGameScores };
