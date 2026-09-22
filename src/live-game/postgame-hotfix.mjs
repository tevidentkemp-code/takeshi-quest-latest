const PATCH_FLAG = '__sqSc038XpLeaderboardHotfix';
const MATCH_LEADERBOARD_LABEL = 'MATCH LEADERBOARD';

function scoreRowsTotal(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (sum, row) => sum + Number(row && row.roundTotal || 0),
    0
  );
}

export function qualifiesUntouchable(board, playerIndex) {
  if (!Array.isArray(board) || board.length < 2) return false;
  const totals = board.map(scoreRowsTotal);
  const maxTotal = Math.max(0, ...totals);
  if (!(maxTotal > 0) || totals[playerIndex] !== maxTotal) return false;
  if (totals.filter(total => total === maxTotal).length !== 1) return false;

  const running = Array(board.length).fill(0);
  const roundCount = Math.max(
    0,
    ...board.map(rows => Array.isArray(rows) ? rows.length : 0)
  );
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    for (let player = 0; player < board.length; player += 1) {
      running[player] += Number(board[player]?.[roundIndex]?.roundTotal || 0);
    }
    const lead = Math.max(0, ...running);
    if (running[playerIndex] < lead) return false;
  }
  return true;
}

export function patchAchievementDetector(host = globalThis) {
  const ach = host && host.SQ_ACH;
  if (!ach || typeof ach.detectGame !== 'function') return false;
  if (ach.detectGame.__sqSc038UntouchableFixed) return true;

  const original = ach.detectGame;

  // Bounded source-owned replacement of the existing live detector. The rules
  // below intentionally mirror the canonical detector; the only behavioural
  // correction is that Untouchable's unique-win / never-behind state is now
  // calculated inside the detector instead of referencing missing globals.
  function fixedDetectGame(board, opts){
    opts = opts || {};
    const players = opts.players || [];
    const norm = d => {
      const k = (d && d.kind) || 'Miss';
      if (k === 'S') return 'single';
      if (k === 'D' || k === 'Double') return 'double';
      if (k === 'T' || k === 'Triple') return 'treble';
      if (k === 'B' || k === 'Bull') return 'bull';
      return 'miss';
    };
    if (!Array.isArray(board) || !board.length) return [];
    const totals = board.map(rs => (rs || []).reduce((s, r) => s + (Number(r && r.roundTotal) || 0), 0));
    const maxTotal = Math.max.apply(null, totals.concat([0]));
    const out = [];
    for (let p = 0; p < board.length; p++){
      const rounds = board[p] || [];
      const earned = {}; const add = (c, n) => { earned[c] = (earned[c] || 0) + (n || 1); };
      let totMiss = 0, totDarts = 0, centuryRounds = 0, scoredRounds = 0, best = 0, run = 0;
      let finalFh = false;
      for (let ri = 0; ri < rounds.length; ri++){
        const r = rounds[ri] || {}; const darts = r.darts || [];
        let tre = 0, dou = 0, sin = 0, b50 = 0, bany = 0;
        darts.forEach(d => { const nk = norm(d); if (nk === 'treble') tre++; else if (nk === 'double') dou++; else if (nk === 'single') sin++; else if (nk === 'bull'){ bany++; if ((Number(d.points) || 0) === 50) b50++; } });
        const mis = darts.filter(d => norm(d) === 'miss' || (Number(d && d.points) || 0) === 0).length;
        const rtot = Number(r.roundTotal) || 0;
        const target = ri <= 10 ? 10 + ri : null;
        const rmax = ri <= 10 ? 9 * (10 + ri) : (ri === 11 ? 120 : ri === 12 ? 180 : 150);
        totMiss += mis; totDarts += darts.length;
        if (rtot > 0) scoredRounds++;
        const fh = (mis === 0 && darts.length === 3);
        run = fh ? run + 1 : 0; if (run > best) best = run;
        if (ri === 13) finalFh = fh;
        if (rtot === 180) add('the_180');
        else if (rtot === rmax && darts.length === 3) add('maximum');
        if (ri <= 10 && tre === 3) add('treble_trouble');
        if (ri <= 10 && dou === 3) add('double_down');
        if (fh) add('full_house');
        if (rtot >= 100 && rtot < 180){ add('century'); centuryRounds++; }
        if (target != null && sin === 1 && dou === 1 && tre === 1) add('shanghai');
        if (target != null && sin === 2 && dou === 1 && tre === 0 && mis === 0) add('desmond');
        if (target != null && tre >= 2) add('robin_hood');
        if (b50 > 0) add('dead_centre', b50);
        if (ri === 12 && tre === 3) add('triple_threat');
        if (ri === 11 && dou === 3) add('double_trouble');
        if (ri === 13 && bany === 3) add('bull_run');
        if (ri === 0 && fh) add('perfect_start');
        if (ri === 13 && rtot >= 100) add('strong_finish');
      }

      const won = totals[p] === maxTotal && maxTotal > 0;
      const topCount = totals.filter(t => t === maxTotal).length;
      const uniqueWon = won && topCount === 1;
      const running = Array(board.length).fill(0);
      let neverBehind = true;
      const roundN = Math.max.apply(null, board.map(rs => (rs || []).length).concat([0]));
      for (let ri = 0; ri < roundN; ri++){
        for (let q = 0; q < board.length; q++) {
          running[q] += Number((((board[q] || [])[ri] || {}).roundTotal) || 0);
        }
        const lead = Math.max.apply(null, running.concat([0]));
        if (running[p] < lead) { neverBehind = false; break; }
      }

      if (totMiss === 0 && totDarts > 0) add('flawless_game');
      if (scoredRounds >= 14) add('full_board');
      if (centuryRounds >= 3) add('ton_machine');
      if (best >= 5) add('inferno'); else if (best >= 3) add('hot_streak');
      if (!opts.is_tiebreak && board.length >= 2 && uniqueWon && neverBehind) add('untouchable');
      if (opts.is_tiebreak && won) add('iceman');
      if (won && finalFh) add('clutch');
      if (board.length === 2){
        const opp = 1 - p, oppRounds = board[opp] || [];
        let wonEvery = true, ca = 0, cb = 0, n = Math.max(rounds.length, oppRounds.length);
        for (let ri = 0; ri < n; ri++){
          const a = Number((rounds[ri] || {}).roundTotal) || 0, b = Number((oppRounds[ri] || {}).roundTotal) || 0;
          if (!(a > b)) wonEvery = false;
          if (ri <= 6){ ca += a; cb += b; }
        }
        if (won && wonEvery) add('whitewash');
        if (won && ca < cb) add('comeback_kid');
      }
      const list = Object.keys(earned).map(c => ({ code: c, count: earned[c] }))
        .sort((a, b) => (ach.meta(b.code).xp || 0) - (ach.meta(a.code).xp || 0));
      if (list.length) out.push({ player: p, name: (players[p] && (players[p].name || players[p])) || ('Player ' + (p + 1)), earned: list });
    }
    return out;
  }

  fixedDetectGame.__sqSc038UntouchableFixed = true;
  fixedDetectGame.__sqSc038Original = original;
  ach.detectGame = fixedDetectGame;
  return true;
}


function patchPostGameOverlay(overlay, host = globalThis) {
  if (!overlay || overlay.dataset.sqSc038LeaderboardHotfix === '1') return false;
  const next = overlay.querySelector('.sq-pg-next');
  const xpScreen = overlay.querySelector('.sq-pg-xp-screen');
  const matchWinScreen = overlay.querySelector('.sq-pg-match-win');
  if (!next || !xpScreen) return false;

  overlay.dataset.sqSc038LeaderboardHotfix = '1';

  const isMatchComplete = () => overlay.dataset.sqSc055MatchComplete === '1';
  const xpVisible = () => !xpScreen.hidden;
  const matchWinVisible = () => !!matchWinScreen && !matchWinScreen.hidden;

  // Keep the post-game navigation label aligned with the visible SC-055 stage.
  // A completed match must pass through MATCH WIN before the leaderboard.
  const syncLabel = () => {
    if (next.disabled) return;
    let wanted = '';
    if (xpVisible() && isMatchComplete()) wanted = 'MATCH WIN ▶';
    else if ((xpVisible() && !isMatchComplete()) || matchWinVisible()) wanted = MATCH_LEADERBOARD_LABEL;
    if (wanted && String(next.textContent || '').trim() !== wanted) next.textContent = wanted;
  };
  const buttonObserver = new MutationObserver(syncLabel);
  buttonObserver.observe(next, { attributes: true, childList: true, subtree: true });

  next.addEventListener('click', async event => {
    const onXp = xpVisible();
    const onMatchWin = matchWinVisible();
    if ((!onXp && !onMatchWin) || next.disabled) return;

    // For a completed match, let postgame-flow advance XP -> MATCH WIN.
    // The next click, from MATCH WIN, is the only one that may hand off.
    if (onXp && isMatchComplete()) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    next.disabled = true;
    next.textContent = 'SAVING…';
    try {
      const awardAndShow = host.awardAndShowLeaderboard;
      if (typeof awardAndShow !== 'function') {
        throw new Error('Match leaderboard handoff is unavailable.');
      }
      await awardAndShow();
      if (document.body?.getAttribute('data-page') !== 'leaderboard') {
        throw new Error('Match leaderboard did not open.');
      }
      buttonObserver.disconnect();
      overlay.remove();
    } catch (error) {
      next.disabled = false;
      next.textContent = onMatchWin ? MATCH_LEADERBOARD_LABEL : (isMatchComplete() ? 'MATCH WIN ▶' : MATCH_LEADERBOARD_LABEL);
      try { console.error('[SC-038] Match leaderboard handoff failed', error); } catch (_) {}
      try {
        if (typeof host.toast === 'function') host.toast('Could not open Match Leaderboard. Please retry.');
      } catch (_) {}
    }
  }, true);

  syncLabel();
  return true;
}

function patchExistingOverlays(host = globalThis) {
  document.querySelectorAll('.sq-gamecomplete-backdrop[data-sq-sc038="1"]').forEach(overlay => {
    patchPostGameOverlay(overlay, host);
  });
}

export function installSc038Hotfix(host = globalThis) {
  if (!host || typeof document === 'undefined') return false;
  if (host[PATCH_FLAG]) return true;
  host[PATCH_FLAG] = true;

  let tries = 0;
  const patchDetector = () => {
    tries += 1;
    if (patchAchievementDetector(host) || tries >= 120) return;
    setTimeout(patchDetector, 50);
  };
  patchDetector();

  patchExistingOverlays(host);
  const observer = new MutationObserver(() => patchExistingOverlays(host));
  const start = () => {
    const root = document.body || document.documentElement;
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sq-sc038'] });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  host.__sqSc038Hotfix = {
    patchAchievementDetector: () => patchAchievementDetector(host),
    patchPostGameOverlay: overlay => patchPostGameOverlay(overlay, host),
    qualifiesUntouchable,
  };
  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installSc038Hotfix(window);
}
