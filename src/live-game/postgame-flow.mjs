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

function updateHero(modal, st, isMatchComplete) {
  const totals = (st.players || []).map((_, i) => scoreForPlayer(st, i));
  if (!totals.length) return;
  const max = Math.max(...totals);
  const winnerIndexes = totals.map((v, i) => v === max ? i : -1).filter(i => i >= 0);
  let winnerIndex = winnerIndexes[0] ?? 0;
  try {
    if (st._decider && st._decider.resolved && Number.isInteger(st._decider.winner)) winnerIndex = st._decider.winner;
  } catch (_) {}

  const player = st.players[winnerIndex] || {};
  try {
    if (typeof window !== 'undefined' && typeof window.__sqApplyWinnerCelebration === 'function') {
      window.__sqApplyWinnerCelebration(modal, player.avatar_key);
    }
  } catch (_) {}
  const parts = playerDisplayParts(player, `Player ${winnerIndex + 1}`);
  const winnerEl = modal.querySelector('.gc-winnerName');
  if (winnerEl) {
    winnerEl.classList.add('sq-pg-winner-name');
    winnerEl.innerHTML = `<span class="sq-pg-mainname">${esc(parts.main)}</span>${parts.nickname ? `<span class="sq-pg-nickname">&ldquo;${esc(parts.nickname)}&rdquo;</span>` : ''}`;
    winnerEl.setAttribute('title', [parts.main, parts.nickname ? `"${parts.nickname}"` : ''].filter(Boolean).join(' '));
  }

  const kicker = modal.querySelector('.gc-arcade-kicker');
  if (kicker) kicker.textContent = isMatchComplete ? 'MATCH COMPLETE' : 'GAME COMPLETE';

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

function isUnresolvedDecider(modal) {
  return !!modal.querySelector('[data-action="startDecider"]');
}

function upgradePostGameOverlay(overlay) {
  if (!overlay || overlay.dataset.sqSc038 === '1') return;
  const modal = overlay.querySelector('.modal-gamecomplete.sq-gc-arcade');
  if (!modal || isUnresolvedDecider(modal)) return;
  const st = getState();
  if (!st || !Array.isArray(st.players) || !st.players.length) return;

  overlay.dataset.sqSc038 = '1';
  const advanceBtn = modal.querySelector('[data-action="advanceMatch"]');
  if (!advanceBtn) return;
  const finalLabel = finalAdvanceLabel(advanceBtn.textContent);
  const isMatchComplete = finalLabel === 'FINISH MATCH';

  updateHero(modal, st, isMatchComplete);

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

  const { screen: scorecard, rows } = buildScorecard(modal, st);
  const xpScreen = buildXpScreen();
  const nav = document.createElement('div');
  nav.className = 'sq-pg-nav';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'sq-pg-next';
  next.textContent = 'NEXT ▶';
  nav.appendChild(next);

  shell.appendChild(scorecard);
  shell.appendChild(xpScreen);
  shell.appendChild(nav);

  hydrateRecordBadges(st, rows, scorecard);

  let xpStarted = false;
  let xpReady = false;
  let xpSafety = null;

  const show = n => {
    next.dataset.pgStep = String(n);
    hero.hidden = n !== 0;
    scorecard.hidden = n !== 1;
    xpScreen.hidden = n !== 2;
    const visual = modal.querySelector('.gc-arcade-visual');
    const confetti = modal.querySelector('.gc-arcade-confetti');
    if (visual) visual.style.display = n === 0 ? '' : 'none';
    if (confetti) confetti.style.display = n === 0 ? '' : 'none';
  };

  const enableFinalAdvance = () => {
    if (xpReady) return;
    xpReady = true;
    if (xpSafety) clearTimeout(xpSafety);
    next.disabled = false;
    next.textContent = finalLabel;
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
