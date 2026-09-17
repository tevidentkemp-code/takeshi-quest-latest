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
  function fixedDetectGame(board, opts = {}) {
    const hadUniqueWon = Object.prototype.hasOwnProperty.call(host, 'uniqueWon');
    const hadNeverBehind = Object.prototype.hasOwnProperty.call(host, 'neverBehind');
    const previousUniqueWon = host.uniqueWon;
    const previousNeverBehind = host.neverBehind;
    let results;

    try {
      // The canonical detector currently references these two identifiers out of
      // scope. Supplying false globals lets every existing trophy rule complete;
      // the correct per-player Untouchable result is restored below.
      host.uniqueWon = false;
      host.neverBehind = false;
      results = original.call(this, board, opts);
    } finally {
      if (hadUniqueWon) host.uniqueWon = previousUniqueWon;
      else {
        try { delete host.uniqueWon; } catch (_) { host.uniqueWon = undefined; }
      }
      if (hadNeverBehind) host.neverBehind = previousNeverBehind;
      else {
        try { delete host.neverBehind; } catch (_) { host.neverBehind = undefined; }
      }
    }

    const out = Array.isArray(results) ? results : [];
    if (opts && opts.is_tiebreak) return out;
    if (!Array.isArray(board) || board.length < 2) return out;

    const players = Array.isArray(opts && opts.players) ? opts.players : [];
    for (let player = 0; player < board.length; player += 1) {
      if (!qualifiesUntouchable(board, player)) continue;
      let row = out.find(item => Number(item && item.player) === player);
      if (!row) {
        const source = players[player];
        const name = source && typeof source === 'object' ? source.name : source;
        row = { player, name: name || `Player ${player + 1}`, earned: [] };
        out.push(row);
      }
      if (!Array.isArray(row.earned)) row.earned = [];
      if (!row.earned.some(item => item && item.code === 'untouchable')) {
        row.earned.push({ code: 'untouchable', count: 1 });
      }
      if (typeof ach.meta === 'function') {
        row.earned.sort((a, b) =>
          (Number(ach.meta(b.code)?.xp || 0) - Number(ach.meta(a.code)?.xp || 0))
        );
      }
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
  if (!next || !xpScreen) return false;

  overlay.dataset.sqSc038LeaderboardHotfix = '1';

  // Do not rewrite identical text from inside the button's own MutationObserver.
  // An unconditional textContent assignment retriggers childList forever and can
  // starve the UI thread immediately after the XP animation completes.
  const syncLabel = () => {
    if (xpScreen.hidden || next.disabled) return;
    if (String(next.textContent || '').trim() !== MATCH_LEADERBOARD_LABEL) {
      next.textContent = MATCH_LEADERBOARD_LABEL;
    }
  };
  const buttonObserver = new MutationObserver(syncLabel);
  buttonObserver.observe(next, { attributes: true, childList: true, subtree: true });

  next.addEventListener('click', async event => {
    if (xpScreen.hidden || next.disabled) return;
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
      next.textContent = MATCH_LEADERBOARD_LABEL;
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
