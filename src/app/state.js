// ===== @SEC:JS:STATE =====

let state = JSON.parse(JSON.stringify(baseState));
const COLOR_PALETTE=['#7bdcff','#8cff9e','#ffcc66','#ff9bd6','#f8d66d','#a6b3ff','#7fffd4','#ffb27b','#ffd166','#06d6a0','#118ab2','#ef476f'];
function assignUniqueColors(arr){ for(let i=0;i<arr.length;i++){ arr[i].color = COLOR_PALETTE[i % COLOR_PALETTE.length]; } }

// Cloud status indicator
const cloudStatusEl     = byId('cloudStatus');
const cloudStatusTextEl = byId('cloudStatusText');

function setCloudStatus(mode, text) {
  if (!cloudStatusEl || !cloudStatusTextEl) return;
  cloudStatusEl.classList.remove('ok', 'error', 'checking');
  cloudStatusEl.classList.add(mode);
  cloudStatusTextEl.textContent = text;
}

function markCloudOk() {
  try{ if (typeof __sqHideBootSplash === 'function') __sqHideBootSplash(); }catch(_){}
  window.__cloudEverOk = true;
  setCloudStatus('ok', 'Cloud: connected');
}

// ===== Animated end-of-game XP + rewards reveal =====
function __sqGcXpEnsureStyles(){
  if (document.getElementById('sqGcXpStyles')) return;
  const st = document.createElement('style'); st.id = 'sqGcXpStyles';
  st.textContent = `
  .gc-xp-reveal{ margin:8px auto 12px; width:min(520px,94%); }
  /* Arcade marquee header for the XP screen */
  .gc-xp-title{ position:relative; text-align:center; font-size:13px; font-weight:950; letter-spacing:.28em; color:#ff9440;
    text-shadow:0 0 16px rgba(255,106,0,.7); margin-bottom:10px; padding:9px 8px; border-radius:12px; overflow:hidden;
    background:linear-gradient(180deg,#0b0f1a,#05070d); border:1px solid rgba(255,106,0,.28);
    box-shadow:inset 0 0 22px rgba(0,0,0,.8), 0 0 20px rgba(255,106,0,.14); }
  .gc-xp-title::after{ content:''; position:absolute; inset:0; pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 3px); opacity:.4; }
  /* Unranked modes (practice / turbo / vs-shadow) earn no XP — say so plainly
     rather than showing an XP tally the server will never award. */
  .gc-xp-noxp{ text-align:center; padding:16px 14px; border-radius:13px; margin-bottom:8px;
    background:linear-gradient(165deg,#1a2030 0%,#10141f 100%); border:1px solid rgba(255,255,255,.09);
    box-shadow:0 6px 16px rgba(0,0,0,.3); opacity:0; transform:translateY(10px);
    transition:opacity .35s ease, transform .35s cubic-bezier(.2,.9,.25,1); }
  .gc-xp-noxp.in{ opacity:1; transform:none; }
  .gc-xp-noxp-mode{ font-size:12px; font-weight:950; letter-spacing:.22em; color:#45b8ff;
    text-shadow:0 0 14px rgba(69,184,255,.5); }
  .gc-xp-noxp-copy{ margin-top:7px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.62); }
  .gc-xp-row{ position:relative; background:linear-gradient(165deg,#1a2030 0%,#10141f 100%); border:1px solid rgba(255,255,255,.09); border-radius:13px; padding:10px 12px 10px 15px; margin-bottom:8px; overflow:hidden; opacity:0; transform:translateY(10px); transition:opacity .35s ease, transform .35s cubic-bezier(.2,.9,.25,1); box-shadow:0 6px 16px rgba(0,0,0,.3); }
  /* Rank accent bar: gold for the winner, orange otherwise */
  .gc-xp-row::before{ content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:#ff6a00; box-shadow:0 0 12px rgba(255,106,0,.6); }
  .gc-xp-row.won::before{ background:#ffc84a; box-shadow:0 0 14px rgba(255,200,74,.85); }
  .gc-xp-row.in{ opacity:1; transform:none; }
  .gc-xp-row.won{ border-color:rgba(255,196,74,.5); box-shadow:0 0 16px rgba(255,150,60,.18); }
  .gc-xp-head{ display:flex; align-items:center; justify-content:space-between; gap:8px 10px; flex-wrap:wrap; }
  .gc-xp-name{ font-weight:900; font-size:15px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1 1 auto; }
  .gc-xp-name .nm{ white-space:nowrap; flex:0 0 auto; }
  .gc-xp-gain{ font-weight:900; color:#7be0a0; font-size:15px; white-space:nowrap; }
  .gc-xp-bar{ position:relative; margin-top:8px; height:11px; border-radius:999px; background:linear-gradient(180deg,#05070d,#0b0f1a); border:1px solid rgba(255,255,255,.10); overflow:hidden; box-shadow:inset 0 0 10px rgba(0,0,0,.9); }
  /* segmented arcade energy bar */
  .gc-xp-bar::after{ content:''; position:absolute; inset:0; z-index:2; pointer-events:none;
    background:repeating-linear-gradient(90deg, rgba(0,0,0,.55) 0 1.5px, transparent 1.5px 6.5%); }
  .gc-xp-fill{ position:relative; height:100%; width:0; border-radius:999px; background:linear-gradient(90deg,#ff5a18,#ffb14a 60%,#ffe27a); box-shadow:0 0 14px rgba(255,150,60,.85); transition:width .8s cubic-bezier(.2,.8,.25,1); }
  .gc-xp-fill::after{ content:''; position:absolute; right:0; top:0; bottom:0; width:7px; background:#fff; filter:blur(2px); opacity:.85; }
  .gc-xp-row.gc-levelup{ animation: gcLevelPulse .7s ease-out; }
  @keyframes gcLevelPulse{ 0%,100%{ box-shadow:0 0 16px rgba(255,150,60,.18);} 40%{ box-shadow:0 0 30px rgba(255,214,64,.85);} }
  .gc-xp-lvup{ display:inline-block; font-size:11px; font-weight:900; color:#ffd24a; letter-spacing:.06em; opacity:0; transform:scale(.7); transition:opacity .3s, transform .3s cubic-bezier(.2,.9,.25,1); }
  .gc-xp-lvup.in{ opacity:1; transform:none; }
  /* Trophies on one line, achievements on another — each scrolls sideways if it overflows */
  .gc-xp-awards{ display:flex; flex-direction:column; gap:5px; margin-top:9px; }
  .gc-xp-line{ display:flex; align-items:center; gap:7px; min-width:0; }
  .gc-xp-line[data-empty]{ display:none; }
  .gc-xp-linelab{ flex:0 0 auto; width:18px; text-align:center; font-size:13px; line-height:1; opacity:.9; filter:drop-shadow(0 0 4px rgba(255,180,74,.45)); }
  .gc-xp-chips{ display:flex; flex-wrap:nowrap; gap:6px; min-width:0; overflow-x:auto; overflow-y:hidden; padding-bottom:2px; scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.2) transparent; -webkit-overflow-scrolling:touch; }
  .gc-xp-chips::-webkit-scrollbar{ height:3px; }
  .gc-xp-chips::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.2); border-radius:3px; }
  .gc-xp-trophy{ flex:0 0 auto; display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:999px; font-size:11px; font-weight:800; color:#fff; white-space:nowrap; opacity:0; transform:scale(.7) translateY(4px); transition:opacity .3s, transform .3s cubic-bezier(.2,.9,.25,1); }
  .gc-xp-trophy.in{ opacity:1; transform:none; }
  .gc-actions-hidden{ opacity:0; pointer-events:none; transform:translateY(8px); transition:opacity .45s ease, transform .45s ease; }
  @media (prefers-reduced-motion: reduce){ .gc-xp-row,.gc-xp-fill,.gc-xp-trophy,.gc-xp-lvup,.gc-actions-hidden{ transition:none !important; animation:none !important; } }`;
  document.head.appendChild(st);
}
function __sqAnimCount(el, from, to, dur, fmt){
  const t0 = performance.now();
  (function step(t){ const k = Math.min(1, (t - t0) / dur); const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2))); el.textContent = fmt ? fmt(v) : String(v); if (k < 1) requestAnimationFrame(step); })(t0);
}
function __sqGcXpRow(panel, row, reduced){
  return new Promise(resolve => {
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s == null ? '' : s));
    const pre = SQ_XP.progress(row.pre), post = SQ_XP.progress(row.post);
    const el = document.createElement('div'); el.className = 'gc-xp-row' + (row.won ? ' won' : '');
    el.innerHTML = '<div class="gc-xp-head"><span class="gc-xp-name"><span class="nm">' + esc(row.nm) + '</span>'
      + '<span class="gc-xp-lvholder"></span><span class="gc-xp-lvup">LEVEL UP!</span></span>'
      + '<span class="gc-xp-gain">+0 XP</span></div>'
      + '<div class="gc-xp-bar"><div class="gc-xp-fill"></div></div>'
      + '<div class="gc-xp-awards">'
      +   '<div class="gc-xp-line gc-xp-trophies" data-empty="1"><span class="gc-xp-linelab" title="Trophies">🏆</span><div class="gc-xp-chips"></div></div>'
      +   '<div class="gc-xp-line gc-xp-achis" data-empty="1"><span class="gc-xp-linelab" title="Achievements">🎖️</span><div class="gc-xp-chips"></div></div>'
      + '</div>';
    panel.appendChild(el);
    const lvHolder = el.querySelector('.gc-xp-lvholder');
    try{ lvHolder.appendChild(__sqXpChip(pre)); }catch(_){ }
    const gainEl = el.querySelector('.gc-xp-gain');
    const fill = el.querySelector('.gc-xp-fill');
    const trophyLine = el.querySelector('.gc-xp-trophies'), achiLine = el.querySelector('.gc-xp-achis');
    const trophyChips = trophyLine.querySelector('.gc-xp-chips'), achiChips = achiLine.querySelector('.gc-xp-chips');
    const levelUp = post.level > pre.level;
    const addTrophies = () => {
      let ti = 0;
      row.troph.forEach((e) => {
        const isMile = !!(window.SQ_ACH && SQ_ACH.isMilestone && SQ_ACH.isMilestone(e.code));
        const a = SQ_ACH.meta(e.code); const s = SQ_ACH.tierStyle(a.tier);
        const chip = document.createElement('span'); chip.className = 'gc-xp-trophy';
        chip.style.background = s.g; chip.style.border = '1px solid ' + s.b; chip.style.color = s.c;
        chip.innerHTML = '<span>' + a.icon + '</span><span>' + a.name + (e.count > 1 ? ' ×' + e.count : '') + '</span>';
        (isMile ? achiChips : trophyChips).appendChild(chip);
        (isMile ? achiLine : trophyLine).removeAttribute('data-empty');
        setTimeout(() => chip.classList.add('in'), reduced ? 0 : 460 + (ti++) * 100);
      });
    };
    if (reduced){
      el.classList.add('in'); gainEl.textContent = '+' + row.gained + ' XP';
      fill.style.transition = 'none'; fill.style.width = (post.pct * 100) + '%';
      if (levelUp){ try{ lvHolder.firstChild && lvHolder.firstChild.replaceWith(__sqXpChip(post)); }catch(_){ } el.querySelector('.gc-xp-lvup').classList.add('in'); }
      addTrophies(); resolve(); return;
    }
    setTimeout(() => {
      el.classList.add('in');
      __sqAnimCount(gainEl, 0, row.gained, 900, v => '+' + v + ' XP');
      requestAnimationFrame(() => {
        fill.style.width = (pre.pct * 100) + '%';
        requestAnimationFrame(() => {
          if (levelUp){
            fill.style.width = '100%';
            setTimeout(() => {
              try{ lvHolder.firstChild && lvHolder.firstChild.replaceWith(__sqXpChip(post)); }catch(_){ }
              el.querySelector('.gc-xp-lvup').classList.add('in');
              el.classList.add('gc-levelup');
              try{ if (typeof __sqV3SndGame === 'function') __sqV3SndGame(); }catch(_){ }
              fill.style.transition = 'none'; fill.style.width = '0%';
              requestAnimationFrame(() => { fill.style.transition = ''; fill.style.width = (post.pct * 100) + '%'; });
            }, 720);
          } else {
            fill.style.width = (post.pct * 100) + '%';
          }
        });
      });
      addTrophies();
      setTimeout(resolve, 1100 + (levelUp ? 700 : 0) + row.troph.length * 120);
    }, 120);
  });
}
// XP is only earned in ranked play. The Supabase views that own the real
// totals (v_player_base_xp / v_ach_rounds) skip any game whose mode is
// 'practice' or 'turbo', and Training never writes to `games` at all — so
// showing an XP tally after those games promises points that are never
// awarded. Returns the unranked mode label, or '' when the game does count.
function __sqUnrankedXpMode(){
  try{
    if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) return 'PRACTICE';
    const mode = String(
      (typeof __sqComputeGameMode === 'function' ? __sqComputeGameMode() : '') ||
      (state && (state.gameMode || state.mode)) || ''
    ).toLowerCase();
    if (mode === 'training') return 'TRAINING';
    if (mode === 'turbo') return 'TURBO';
    if (mode === 'practice') return 'PRACTICE';
    if (state && (state.isPractice === true || state.is_practice === true)) return 'PRACTICE';
    return '';
  }catch(_){ return ''; }
}

// SXP-04: warm the existing pre-game XP lookup as soon as a completed game
// enters the Game Winner flow. This does not calculate, award or persist XP;
// it only moves the same v_player_xp-backed reads earlier and runs them in
// parallel so the Rewards screen does not begin with a network waterfall.
function __sqGcXpPrefetchKey(){
  try{
    const token = Number(state && state.__gameToken || 0);
    const names = (state && Array.isArray(state.players) ? state.players : [])
      .map(p => String((p && (p.name || p.player)) || '').trim().toLowerCase());
    return token + '|' + names.join('|');
  }catch(_){ return ''; }
}
function __sqGcXpStartPrefetch(){
  try{
    if (!window.SQ_XP || typeof SQ_XP.forName !== 'function' || !state) return Promise.resolve([]);
    if (__sqUnrankedXpMode()) return Promise.resolve([]);
    const key = __sqGcXpPrefetchKey();
    const existing = window.__sqGcXpPrefetch;
    if (existing && existing.key === key && existing.promise) return existing.promise;
    const players = (state.players || []).map(p => String((p && (p.name || p.player)) || '').trim());
    const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const promise = Promise.all(players.map(async name => {
      if (!name) return null;
      try{ return await SQ_XP.forName(name); }catch(_){ return null; }
    })).then(rows => {
      try{
        if (window.__sqGcXpPrefetch && window.__sqGcXpPrefetch.key === key){
          window.__sqGcXpPrefetch.resolved = rows;
          window.__sqGcXpPrefetch.resolvedAt =
            (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        }
      }catch(_){}
      return rows;
    });
    window.__sqGcXpPrefetch = { key, promise, startedAt, resolved:null };
    return promise;
  }catch(_){ return Promise.resolve([]); }
}
async function __sqGcXpReveal(host, onComplete){
  try{
    if (!window.SQ_XP || !window.SQ_ACH || !state || !state.score){ if (onComplete) onComplete(); return; }
    const unranked = __sqUnrankedXpMode();
    if (unranked){
      const panel = document.createElement('div'); panel.className = 'gc-xp-panel';
      const title = document.createElement('div'); title.className = 'gc-xp-title';
      title.textContent = 'NO XP EARNED';
      const note = document.createElement('div'); note.className = 'gc-xp-noxp';
      const mode = document.createElement('div'); mode.className = 'gc-xp-noxp-mode';
      mode.textContent = unranked + ' GAME';
      const copy = document.createElement('div'); copy.className = 'gc-xp-noxp-copy';
      copy.textContent = 'Practice and Training don’t count towards XP, levels or trophies. Play a Match to rank up.';
      note.appendChild(mode); note.appendChild(copy);
      panel.appendChild(title); panel.appendChild(note); host.appendChild(panel);
      requestAnimationFrame(() => note.classList.add('in'));
      setTimeout(() => { if (onComplete) onComplete(); }, 700);
      return;
    }
    const reduced = (typeof __sqV3Reduced === 'function') ? __sqV3Reduced() : false;
    const board = state.score;
    // Display uses the pretty name (with nickname); the XP lookup must use the
    // RAW player name, because v_player_xp stores plain names — looking up
    // 'Chris "The Inevitable"' always missed, so every player read back 0 XP and
    // showed as a level-2 rookie regardless of their real total.
    const players = (state.players || []).map(p => ({
      name: (typeof __sqPlayerPretty === 'function' ? __sqPlayerPretty(p) : (p && p.name)) || (p && p.name) || '',
      rawName: String((p && (p.name || p.player)) || '').trim(),
    }));
    // Prefer the game-end prefetch. If the player tapped NEXT exceptionally
    // quickly, this waits for one parallel batch rather than N serial reads.
    const prefetchedXp = await __sqGcXpStartPrefetch();
    const totals = players.map((_, i) => (board[i] || []).reduce((s, r) => s + (Number(r && r.roundTotal) || 0), 0));
    const maxTotal = Math.max(0, ...totals);
    const results = SQ_ACH.detectGame(board, { players, is_tiebreak: !!(state.is_tiebreak || state.currentGameIsTiebreak) });
    const trophiesByP = {}; results.forEach(r => { trophiesByP[r.player] = r.earned; });
    const rows = [];
    for (let p = 0; p < players.length; p++){
      const nm = players[p].name || ('Player ' + (p + 1));
      const won = totals[p] === maxTotal && maxTotal > 0;
    const topCount = totals.filter(t => t === maxTotal).length;
    const uniqueWon = won && topCount === 1;
    const running = Array(board.length).fill(0);
    let neverBehind = true;
    const roundN = Math.max.apply(null, board.map(rs => (rs || []).length).concat([0]));
    for (let ri = 0; ri < roundN; ri++){
      for (let q = 0; q < board.length; q++) running[q] += Number((((board[q] || [])[ri] || {}).roundTotal) || 0);
      const lead = Math.max.apply(null, running.concat([0]));
      if (running[p] < lead) { neverBehind = false; break; }
    }
      const troph = trophiesByP[p] || [];
      const trophyXp = troph.reduce((s, e) => s + (SQ_ACH.meta(e.code).xp || 0) * e.count, 0);
      const gained = Math.round(totals[p] * SQ_XP.W.point) + SQ_XP.W.game + (won ? SQ_XP.W.gameWin : 0) + trophyXp;
      let pre = 0;
      try{
        const xr = Array.isArray(prefetchedXp) ? prefetchedXp[p] : null;
        pre = xr ? Number(xr.total_xp) || 0 : 0;
      }catch(_){ }
      rows.push({ nm, won, troph, gained, pre, post: pre + gained });
    }
    rows.sort((a, b) => (Number(b.won) - Number(a.won)) || (b.gained - a.gained));
    const panel = document.createElement('div'); panel.className = 'gc-xp-panel';
    const title = document.createElement('div'); title.className = 'gc-xp-title'; title.textContent = 'XP EARNED';
    panel.appendChild(title); host.appendChild(panel);
    // Append every row immediately, then let the existing row animations run
    // together. Previously each row blocked the next for ~1.1–1.8s.
    await Promise.all(rows.map(row => __sqGcXpRow(panel, row, reduced)));
    // Freshen caches so subsequent screens read the new totals.
    try{ SQ_XP._cache = null; SQ_ACH._cache = {}; }catch(_){ }
    if (onComplete) onComplete();
  }catch(_){ if (onComplete) onComplete(); }
}

function openGameCompleteDialog() {
  // No scoring-pad hold UI may survive the transition into post-game.
  try{ window.__sqQuickEntry?.close?.(); }catch(_){}
  try{ document.querySelectorAll('#pad .sq-miss-bounce-held').forEach(el=>el.classList.remove('sq-miss-bounce-held')); }catch(_){}
  try{ window.__sqQuickSuppressClick = null; window.__sqMissBounceSuppressClick = 0; }catch(_){}
  if (typeof __sqVsShadowCompletionBlocked === 'function' && __sqVsShadowCompletionBlocked()) {
    try{ state.finished = false; state.gameAwarded = false; }catch(_){ }
    try{ __sqVsShadowBlockPhase2C(__SQ_VS_SHADOW_COMPLETION_BLOCK_REASON); }catch(_){ }
    return;
  }
  const __isVsShadowComplete = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;

  // SXP-04: start the Rewards read while the player is still viewing Game Winner.
  // Fire-and-forget; reveal reuses this exact promise/result.
  try{ __sqGcXpStartPrefetch(); }catch(_){ }

  // Presentation-only finished-game state: once completion is valid, replace
  // the last live-game DMD frame with a centered, slow-pulsing GAME OVER.
  // The next startNewGame(true) hard-clears this scene.
  try{
    window.__sqDmdStopPreThrow?.();
    window.__sqDmdHardClearQueue?.();
    window.sqDmdShowZones?.({ z2:'GAME OVER', z3:'' }, { type:'pulseFull', ms:60 * 60 * 1000 });
  }catch(_){ }

  const totals = state.players.map((_, i) => totalScoreForPlayer(i));
  if (!totals.length) return;
  
  const max = Math.max(...totals);
  const winnerIdx = [];
  totals.forEach((t, i) => {
    if (t === max) winnerIdx.push(i);
  });

  // Remove any old instances
  document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(n => n.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-gamecomplete-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal modal-gamecomplete sq-gc-arcade';

  const winnerNames = winnerIdx.map(i => __sqPlayerPretty(state.players[i]) || state.players[i].name || ('Player ' + (i+1)));
  const isDraw = winnerNames.length > 1;
  // If a draw was resolved via decider shootout, treat as single winner for UI + awards
  const __dec = state && state._decider && state._decider.resolved ? state._decider : null;
  const __drawResolved = !!(__dec && ( __dec.gameToken === (state.__gameToken || 0) ) && typeof __dec.winner === 'number');

  // Rank list (sorted desc)
  const ranking = totals
    .map((score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score);

  const ord = (n) => {
    if (n === 1) return '1ST';
    if (n === 2) return '2ND';
    if (n === 3) return '3RD';
    return n + 'TH';
  };

  const escGc = (v) => {
    try { return (typeof escapeHtml === 'function') ? escapeHtml(String(v == null ? '' : v)) : String(v == null ? '' : v); }
    catch(_) { return String(v == null ? '' : v); }
  };
  const primaryWinnerIndex = __drawResolved ? __dec.winner : winnerIdx[0];
  const winnerDisplay = __drawResolved
    ? (__sqPlayerPretty(state.players[__dec.winner]) || state.players[__dec.winner].name || ('Player ' + (__dec.winner+1)))
    : winnerNames.join(' · ');
  const winnerLabelHtml = __drawResolved
    ? '<span class="gc-accent">WINNER</span>'
    : (isDraw ? '<span class="gc-accent">DRAW</span>' : '<span class="gc-accent">WINNER</span>');
  const winnerScores = (state && state.score && state.score[primaryWinnerIndex]) || [];
  const winnerRoundTotals = Array.isArray(winnerScores)
    ? winnerScores.map(r => Number(r && r.roundTotal || 0)).filter(n => Number.isFinite(n) && n > 0)
    : [];
  const completedRoundCount = (() => {
    try {
      const hs = (state && Array.isArray(state.history)) ? state.history : [];
      const set = new Set();
      hs.forEach(h => { if (h && h.round != null) set.add(h.round); });
      return Math.max(1, set.size || (state.currentRound || 1));
    } catch(_) {
      return 1;
    }
  })();
  const bestRound = winnerRoundTotals.length ? Math.max(...winnerRoundTotals) : max;
  const avgScore = max / completedRoundCount;
  const rankMovementText = 'Pending';
  const ordinalLabel = (n) => {
    const x = Number(n) || 0;
    if (x === 1) return '1ST';
    if (x === 2) return '2ND';
    if (x === 3) return '3RD';
    return String(x) + 'TH';
  };
  const completedRoundsForPlayer = (playerIndex) => {
    try {
      const rows = (state && state.score && state.score[playerIndex]) || [];
      const count = Array.isArray(rows)
        ? rows.reduce((n, row) => {
            const darts = row && Array.isArray(row.darts) ? row.darts : [];
            return n + (darts.some(d => d != null) ? 1 : 0);
          }, 0)
        : 0;
      return Math.max(1, count || (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 1));
    } catch(_) {
      return 1;
    }
  };
  const bestRoundForPlayer = (playerIndex) => {
    try {
      const rows = (state && state.score && state.score[playerIndex]) || [];
      if (!Array.isArray(rows) || !rows.length) return 0;
      return rows.reduce((best, row) => {
        const n = Number(row && row.roundTotal || 0);
        return Number.isFinite(n) && n > best ? n : best;
      }, 0);
    } catch(_) {
      return 0;
    }
  };
  const buildCurrentGameBreakdownRows = () => {
    const rows = totals.map((score, index) => {
      const player = (state.players && state.players[index]) || {};
      const name = __sqPlayerPretty(player) || String(player.name || '').trim() || ('Player ' + (index + 1));
      const rounds = completedRoundsForPlayer(index);
      return {
        index,
        name,
        score,
        average: score / rounds,
        bestRound: bestRoundForPlayer(index)
      };
    }).sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));

    let lastScore = null;
    let currentPosition = 0;
    rows.forEach((row, idx) => {
      if (lastScore === null || row.score !== lastScore) currentPosition = idx + 1;
      row.position = currentPosition;
      lastScore = row.score;
    });
    return rows;
  };
  const targetGamesForMatch = () => {
    try { return Math.max(1, parseInt(state && state.match && state.match.targetWins, 10) || 1); }
    catch(_) { return 1; }
  };
  const completedGamesInMatch = () => {
    try { return Array.isArray(state && state.match && state.match.history) ? state.match.history.length : 0; }
    catch(_) { return 0; }
  };
  // SC-055: match completion must follow the existing engine-owned rule.
  // Standard matches finish when a player reaches targetWins; Vs Shadow keeps
  // its existing fixed-game-count completion semantics.
  const projectedMatchComplete = () => {
    const targetWins = targetGamesForMatch();
    const alreadyAwarded = !!(state && state.gameAwarded);
    if (__isVsShadowComplete) {
      const projectedPlayed = completedGamesInMatch() + (alreadyAwarded ? 0 : 1);
      return projectedPlayed >= targetWins;
    }
    const wins = Array.isArray(state && state.match && state.match.wins)
      ? state.match.wins.map(v => Number(v) || 0)
      : [];
    if (!alreadyAwarded && Number.isInteger(primaryWinnerIndex) && primaryWinnerIndex >= 0) {
      while (wins.length <= primaryWinnerIndex) wins.push(0);
      wins[primaryWinnerIndex] = (wins[primaryWinnerIndex] || 0) + 1;
    }
    const maxWins = wins.length ? Math.max(...wins) : 0;
    return maxWins >= targetWins;
  };
  const matchAdvanceLabel = projectedMatchComplete() ? 'End Match' : 'Next Round';
  const openCurrentGameBreakdownDialog = () => {
    document.querySelectorAll('.sq-gc-breakdown-backdrop').forEach(n => n.remove());
    const rows = buildCurrentGameBreakdownRows();
    const bdOverlay = document.createElement('div');
    bdOverlay.className = 'modal-backdrop sq-gc-breakdown-backdrop';

    const bdModal = document.createElement('div');
    bdModal.className = 'modal sq-gc-breakdown-modal';
    bdModal.setAttribute('role', 'dialog');
    bdModal.setAttribute('aria-modal', 'true');
    bdModal.innerHTML = `
      <div class="gc-breakdownTitle">Game Scores</div>
      <div class="gc-breakdownTableWrap">
        <table class="gc-breakdownTable">
          <thead>
            <tr>
              <th>Position</th>
              <th>Name</th>
              <th>Score</th>
              <th>Average</th>
              <th>Best Round</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr${row.position === 1 ? ' class="isWinner"' : ''}>
                <td>${escGc(ordinalLabel(row.position))}</td>
                <td>${escGc(row.name)}</td>
                <td>${escGc(row.score)}</td>
                <td>${escGc(row.average.toFixed(1))}</td>
                <td>${escGc(row.bestRound)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="gc-breakdownActions">
        <button class="btn gc-breakdownBack" type="button" data-action="breakdownBack">Back</button>
      </div>
    `;

    const closeBreakdown = () => bdOverlay.remove();
    bdModal.querySelector('[data-action="breakdownBack"]')?.addEventListener('click', closeBreakdown);
    bdOverlay.addEventListener('click', e => { if (e.target === bdOverlay) closeBreakdown(); });
    bdOverlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeBreakdown(); });
    bdOverlay.appendChild(bdModal);
    document.body.appendChild(bdOverlay);
    bdModal.tabIndex = 0;
    bdModal.focus();
  };
  const endMatchToClubhouse = () => {
    try {
      state = JSON.parse(JSON.stringify(baseState));
      save();
    } catch(_) {}
    try {
      if (typeof navigateToStartScreen === 'function') navigateToStartScreen();
      else if (typeof show === 'function') show('details');
    } catch(e) {
      console.error(e);
      try { toast('Could not return to clubhouse.'); } catch(_) {}
    }
  };
  const completeGameAndAdvanceMatch = async (btn) => {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }
    try {
      const wasVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
      if (typeof awardAndShowLeaderboard === 'function') await awardAndShowLeaderboard();
      const gamesPlayedAfterAward = completedGamesInMatch();
      const matchComplete = projectedMatchComplete();

      if (wasVsShadow && state && state.shadow && state.shadow.saveFailed === true && state.gameAwarded !== true) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = matchAdvanceLabel;
        }
        return;
      }

      remove();

      if (matchComplete) {
        try {
          if (!wasVsShadow && state && state.match && !state.match.completedLogged && typeof logCompletedMatch === 'function') {
            logCompletedMatch();
            state.match.completedLogged = true;
            save();
          }
        } catch(e) {
          console.warn('[SQ] Match completion log failed', e);
        }
        // Match over: stay on the leaderboard (already shown by
        // awardAndShowLeaderboard) so final standings and GAME SCORES are
        // reachable from this exit too; END MATCH there returns home.
        try { if (typeof showLeaderboard === 'function') showLeaderboard(); } catch(_) {}
        return;
      }

      if (wasVsShadow) {
        const nextIndex = gamesPlayedAfterAward;
        const games = Array.isArray(state && state.shadow && state.shadow.games) ? state.shadow.games : [];
        if (nextIndex >= games.length || (typeof __sqRefreshVsShadowRuntimePlayerForGame === 'function' && !__sqRefreshVsShadowRuntimePlayerForGame(nextIndex))) {
          try { toast('No next Shadow source is available.'); } catch(_) {}
          return;
        }
        state.finished = false;
        state.gameAwarded = false;
        try { delete state.__sqGameCompleteOpen; } catch(_) {}
        if (typeof startNewGame === 'function') startNewGame(true);
        return;
      }

      state.finished = false;
      if (typeof startNewGame === 'function') startNewGame();
    } catch(e) {
      console.error(e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = matchAdvanceLabel;
      }
      try { toast('Could not advance match.'); } catch(_) {}
    }
  };

  modal.innerHTML = `
    <div class="gc-arcade-shell">
      <button class="gc-close" type="button" data-action="gcClose" aria-label="Close">✕</button>
      <div class="gc-arcade-confetti" aria-hidden="true"></div>
      <div class="gc-arcade-visual" aria-hidden="true"></div>
      <div class="gc-arcade-content">
        <div class="gc-arcade-kicker">MATCH COMPLETE</div>
        <div class="gc-winnerLabel">${winnerLabelHtml}</div>
        <div class="gc-winnerName" title="${escGc(winnerDisplay)}">${escGc(winnerDisplay)}</div>

        <div class="gc-statPanel" aria-label="Match result summary">
          <div class="gc-statRow">
            <span class="gc-statLabel">Final Score</span>
            <span class="gc-statValue">${escGc(max)}</span>
          </div>
          <div class="gc-statRow">
            <span class="gc-statLabel">Best Round</span>
            <span class="gc-statValue">${escGc(bestRound)}</span>
          </div>
          <div class="gc-statRow">
            <span class="gc-statLabel">Average</span>
            <span class="gc-statValue">${escGc(avgScore.toFixed(1))}</span>
          </div>
          <div class="gc-statRow">
            <span class="gc-statLabel">Rank Movement</span>
            <span class="gc-statValue gc-rankMovementValue" title="Power Rank movement is calculated from Supabase after this game is saved.">${escGc(rankMovementText)}</span>
          </div>
        </div>
      </div>

      <div class="gc-ranks" data-role="gcRanks" aria-hidden="true"></div>

      <div class="gc-actions gc-arcade-actions">
        ${(!__isVsShadowComplete && !__drawResolved && isDraw) ? '<button class="btn dec-startDecider" type="button" data-action="startDecider">START DECIDER SHOOTOUT</button>' : ''}
        <button class="btn gc-breakdown" type="button" data-action="breakdown">VIEW BREAKDOWN</button>
        <button class="btn gc-next-match" type="button" data-action="advanceMatch">${escGc(matchAdvanceLabel)}</button>
      </div>
    </div>
`;

  // Round Avg % (based on completed rounds in history; 60 pts assumed as nominal max per round for % display)
  try {
    const roundsPlayed = (() => {
      const hs = (state && Array.isArray(state.history)) ? state.history : [];
      const set = new Set();
      hs.forEach(h => { if (h && h.round != null) set.add(h.round); });
      return Math.max(1, set.size || (state.currentRound || 1));
    })();
    const roundAvgPct = (max / (roundsPlayed * 60)) * 100;
    const elAvg = modal.querySelector('[data-role="gcRoundAvg"]');
    if (elAvg) elAvg.textContent = 'ROUND AVG %  ' + roundAvgPct.toFixed(1) + '%';
  } catch(_) {}

  // Fireworks on winner pill (only when single winner is known)
  try {
    const singleWinner = __drawResolved ? true : (!isDraw);
    if (singleWinner) modal.querySelector('.gc-winnerCard')?.classList.add('gc-fireworks');
  } catch(_) {}

  const ranksEl = modal.querySelector('[data-role="gcRanks"]');
  if (ranksEl) {
    ranksEl.innerHTML = '';
    ranking.forEach((row, idx) => {
      const p = state.players[row.index] || {};
      const nm = __sqPlayerPretty(p) || String(p.name || '').trim() || ('Player ' + (row.index + 1));
      const pos = ord(idx + 1);
      const isWinnerRow = (row.score === max);
      const div = document.createElement('div');
      div.className = 'gc-rankRow' + (isWinnerRow ? ' isWinner' : '');
      const avgPts = (row.score / 14);
      div.innerHTML = `
        <div class="gc-rankPos">${pos}</div>
        <div class="gc-rankName">${escGc(nm)}</div>
        <div class="gc-rankScore">
          <span class="gc-rankScoreVal">${escGc(row.score)}</span>
          <span class="gc-rankAvg">${avgPts.toFixed(1)}</span>
        </div>
      `;
      ranksEl.appendChild(div);
    });
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Two-step: the MATCH COMPLETE hero has a NEXT button that reveals a
  // separate animated XP / Rewards screen, which then shows NEXT GAME / END.
  try{
    __sqGcXpEnsureStyles();
    const actionsEl = modal.querySelector('.gc-actions');        // breakdown + advance (screen 2)
    const contentEl = modal.querySelector('.gc-arcade-content');  // hero (winner + stats)
    const ranksEl2  = modal.querySelector('.gc-ranks');           // standings (everyone's results)
    const visualEl  = modal.querySelector('.gc-arcade-visual');   // decorative hero photo
    const confettiEl = modal.querySelector('.gc-arcade-confetti');
    // Reveal host must sit ABOVE the z-index:1 hero photo, full width.
    const host = document.createElement('div'); host.className = 'gc-xp-reveal';
    host.style.display = 'none'; host.style.position = 'relative'; host.style.zIndex = '4'; host.style.width = '100%';
    if (actionsEl && actionsEl.parentNode) actionsEl.parentNode.insertBefore(host, actionsEl);
    else (contentEl || modal).appendChild(host);
    const nextWrap = document.createElement('div'); nextWrap.className = 'gc-actions gc-arcade-actions';
    const nextBtn = document.createElement('button'); nextBtn.className = 'btn gc-next-match'; nextBtn.type = 'button'; nextBtn.textContent = 'NEXT ▶';
    nextWrap.appendChild(nextBtn);
    if (actionsEl && actionsEl.parentNode) actionsEl.parentNode.insertBefore(nextWrap, actionsEl);
    if (actionsEl){ actionsEl.style.display = 'none'; actionsEl.style.position = 'relative'; actionsEl.style.zIndex = '4'; }
    // SCORECARD button (screen 2) — toggles the standings so everyone's results show.
    if (actionsEl && ranksEl2 && !actionsEl.querySelector('[data-action="scorecard"]')){
      const scBtn = document.createElement('button'); scBtn.className = 'btn gc-breakdown'; scBtn.type = 'button'; scBtn.setAttribute('data-action','scorecard'); scBtn.textContent = 'SCORECARD';
      ranksEl2.style.zIndex = '4'; ranksEl2.style.position = 'relative';
      scBtn.onclick = () => {
        const showing = ranksEl2.getAttribute('aria-hidden') !== 'true';
        if (showing){
          // Arcade CSS hides .gc-ranks with !important, so toggle it with an
          // important inline value the button can actually override.
          ranksEl2.style.setProperty('display', 'none', 'important');
          ranksEl2.setAttribute('aria-hidden','true');
          scBtn.textContent = 'SCORECARD';
        } else {
          ranksEl2.style.setProperty('display', 'flex', 'important');
          ranksEl2.setAttribute('aria-hidden','false');
          scBtn.textContent = 'HIDE SCORECARD';
          try{ ranksEl2.scrollIntoView({behavior:'smooth', block:'nearest'}); }catch(_){ }
        }
      };
      actionsEl.insertBefore(scBtn, actionsEl.firstChild);
    }
    const __tok = state.__gameToken || 0;
    const goToRewards = () => {
      nextWrap.style.display = 'none';
      if (contentEl) contentEl.style.display = 'none';
      if (ranksEl2){ ranksEl2.style.display = 'none'; ranksEl2.setAttribute('aria-hidden','true'); }
      if (visualEl) visualEl.style.display = 'none';   // clean XP screen (no photo overlay)
      if (confettiEl) confettiEl.style.display = 'none';
      host.style.display = '';
      if (actionsEl){ actionsEl.style.display = ''; actionsEl.classList.add('gc-actions-hidden'); }
      let __shown = false;
      const showActions = () => { if (__shown) return; __shown = true; if (actionsEl) actionsEl.classList.remove('gc-actions-hidden'); };
      if (state.__sqXpRevealedTok !== __tok){
        state.__sqXpRevealedTok = __tok;
        __sqGcXpReveal(host, showActions);
        setTimeout(showActions, 9000); // safety
      } else { showActions(); }
    };
    nextBtn.onclick = goToRewards;
    if (state.__sqXpRevealedTok === __tok) goToRewards(); // re-render after reveal: skip to screen 2
  }catch(_){ }

  const remove = () => overlay.remove();
  // Close handlers
  modal.querySelector('[data-action="gcClose"]')?.addEventListener('click', remove);
  modal.querySelector('[data-action="breakdown"]')?.addEventListener('click', () => {
    try {
      openCurrentGameBreakdownDialog();
    } catch(e) {
      console.error(e);
      try { toast('Could not open game breakdown.'); } catch(_) {}
    }
  });
  modal.querySelector('[data-action="advanceMatch"]')?.addEventListener('click', (e) => {
    completeGameAndAdvanceMatch(e.currentTarget);
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) remove(); });
  document.addEventListener('keydown', function __gcEsc(e){
    if (e.key === 'Escape') { try { remove(); } catch(_) {} document.removeEventListener('keydown', __gcEsc); }
  });

  // Decider shootout (only when draw + not yet resolved)
  modal.querySelector('[data-action="startDecider"]')?.addEventListener('click', () => {
    try {
      openDeciderShootoutDialog(winnerIdx, totals);
      // hide this modal while decider runs
      overlay.remove();
    } catch (e) {
      console.error(e);
      toast('Could not start decider (see console)');
    }
  });

  modal.tabIndex = 0;
  modal.focus();
}

// >>> PATCH:decider_shootout_logic START
function openDeciderShootoutDialog(participantIdx, baseTotals){
  // Participants are ONLY the top-tied players
  const parts = (participantIdx || []).slice();
  if (parts.length < 2) { toast('No draw to resolve'); return; }

  // remove any old instances
  document.querySelectorAll('.sq-decider-backdrop').forEach(n=>n.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-decider-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal modal-decider';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.tabIndex = -1;

  const R = [
    { key:'any',     label:'R1 — ANY NUMBER' },
    { key:'doubles', label:'R2 — DOUBLES' },
    { key:'triples', label:'R3 — TRIPPLES' },
    { key:'bull',    label:'R4 — BULLS' }
  ];

  const dec = state._decider = {
    resolved:false,
    gameToken: state.__gameToken || 0,

    participants: parts.slice(),
    round: 0,
    turn: 0,
    dart: 0,
    kind: 'S', // for R1 any: S/D/T
    totals: Array.from({length: parts.length}, ()=>0),
    history: [], // {p,r,d,points,spec}
    lastToken: "-",
    hold: false
  };

  function pName(pIndex){
    const p = state.players[pIndex] || {};
    return __sqPlayerPretty(p) || p.name || ('Player ' + (pIndex+1));
  }

  function pInit(pIndex){
    const p = state.players[pIndex] || {};
    const raw = (p.initials || '').trim();
    if (raw) return raw.slice(0,2).toUpperCase();
    const nm = String(__sqPlayerPretty(p) || p.name || '').trim();
    if (!nm) return ('P' + (pIndex+1));
    const parts = nm.split(/\s+/).filter(Boolean);
    const a = (parts[0]||'')[0]||'';
    const b = (parts[1]||'')[0]||((parts[0]||'')[1]||'');
    return (a + b).toUpperCase();
  }

  function ord(n){
    if (n===1) return '1ST';
    if (n===2) return '2ND';
    if (n===3) return '3RD';
    return n+'TH';
  }

  function roundScore(pi, r){
    // pi is index within participants array
    let sum = 0;
    for (let i = 0; i < dec.history.length; i++){
      const h = dec.history[i];
      if (h && h.p === pi && h.round === r) sum += (h.points || 0);
    }
    return sum ? String(sum) : '–';
  }

  // Return the token shown inside the dart indicator dot for a given
  // participant (pi), round (r), and dart index (d: 0..2).
  function getDartToken(pi, r, d){
    try{
      // Find the throw in history
      for (let i = 0; i < dec.history.length; i++){
        const h = dec.history[i];
        if (!h) continue;
        if (h.p === pi && h.round === r && h.dart === d){
          if (h.token) return h.token;
          // Fallback: derive token from spec/points for that round
          const rk = (R[r] && R[r].key) ? R[r].key : 'any';
          const spec = h.spec || {};
          const pts  = Number(h.points || 0);
          if (spec.kind === 'Miss' || pts === 0) return 'X';
          if (spec.bull) return (spec.bull === 'Inner') ? 'IB' : 'OB';
          const sector = Number(spec.sector || 0);
          if (!sector) return 'X';
          if (rk === 'doubles') return 'D' + sector;
          if (rk === 'triples') return 'T' + sector;
          // any: infer multiplier from pts
          if (pts === sector * 3) return 'T' + sector;
          if (pts === sector * 2) return 'D' + sector;
          return 'S' + sector;
        }
      }
    }catch(_){ }
    return '';
  }

  function render(){
    const rDef = R[dec.round];
    const liveP = dec.participants[dec.turn];
    try{
      if (Number(dec.dart || 0) === 0) {
        const dmdKey = `${dec.round}|${dec.turn}`;
        if (dec.__dmdTurnKey !== dmdKey) {
          dec.__dmdTurnKey = dmdKey;
          const p = state?.players?.[liveP];
          const nm = (typeof p === 'string' ? p : (p?.name || p?.full || p?.nickname || p?.initials || `P${Number(liveP)+1}`)).toString();
          const first = Number(dec.round || 0) === 0 && Number(dec.turn || 0) === 0;
          setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:nm, z3:(first ? 'TO THROW FIRST' : 'TO THROW') }, { type:'wipe', ms:780, fx:'impact', z3Small:true }); }catch(_){} }, 0);
        }
      }
    }catch(_){}

    modal.innerHTML = `
      <div class="dec-top">
        <div class="dec-title">DECIDER</div>
        <div class="dec-sub">Each player gets three darts per round.<br>Any score, followed by doubles, trebles then bulls.<br>Points do not count towards stats.</div>
      </div>

      <div class="dec-body">
        <div class="dec-card">
          

          
<div class="dec-gridWrap">
            ${dec.participants.length===2 ? `
          <div class="dec-dartsTop" aria-label="Dart indicators">
            <div class="dec-darts">
              ${[0,1,2].map(i=>{const tok=getDartToken(dec.turn, dec.round, i); return `<span class="dec-dartDot ${tok?'done':''}">${tok?tok:''}</span>`;}).join('')}
            </div>
          
            </div>
        ` : ''}

        <div class="dec-headStrip" aria-label="Players and totals">
              <div class="dec-headCorner"></div>
              ${(()=>{ 
                if(dec.participants.length===2){
                  const p0 = dec.participants[0], p1 = dec.participants[1];
                  return `
                    <div class="dec-headBox ${0===dec.turn?'live':''}">
                      <div class="dec-headInit">${pInit(p0)}</div>
                      <div class="dec-headTotal">${dec.totals[0]}</div>
                    </div>
<div class="dec-headBox ${1===dec.turn?'live':''}">
                      <div class="dec-headInit">${pInit(p1)}</div>
                      <div class="dec-headTotal">${dec.totals[1]}</div>
                    </div>
                  `;
                }
                return dec.participants.map((pIdx,i)=>`<div class="dec-headBox ${i===dec.turn?'live':''}">
                  <div class="dec-headInit">${pInit(pIdx)}</div>
                  <div class="dec-headTotal">${dec.totals[i]}</div>
                </div>`).join('');
              })()}
            </div>

            <div class="dec-grid" data-role="grid" aria-label="Decider rounds and scores">
              ${['ANY','D','T','B'].map((lbl,r)=>`
                <div class="dec-gridRow ${dec.round>r?'done':''} ${dec.round===r?'active':''}">
                  <div class="dec-gridLbl">${lbl}</div>
                  ${dec.participants.map((pIdx,i)=>`<div class="dec-gridCell ${i===dec.turn?'live':''}">${roundScore(i,r)}</div>`).join('')}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="dec-divider"></div>

          <div class="dec-inputArea">
            <div class="dec-kindRow" data-role="kindRow" style="${rDef.key==='any' ? '' : 'display:none'}">
              <button class="dec-kindBtn ${dec.kind==='S'?'on':''}" data-kind="S" type="button">S</button>
              <button class="dec-kindBtn ${dec.kind==='D'?'on':''}" data-kind="D" type="button">D</button>
              <button class="dec-kindBtn ${dec.kind==='T'?'on':''}" data-kind="T" type="button">T</button>
            </div>

            <div class="dtScroller" data-role="numRow" style="${rDef.key==='bull' ? 'display:none' : ''}"></div>

            <div class="dtBullRow" data-role="bullRow" style="${rDef.key==='bull' ? '' : 'display:none'}">
              <button class="dtBullBtn" type="button" data-bull="Outer">OUTER BULL</button>
              <button class="dtBullBtn inner" type="button" data-bull="Inner">INNER BULL</button>
            </div>

            <div class="dtActions" data-role="actRow">
              <button class="dtActBtn miss" type="button" data-act="miss"><div class="dtIcon">⊘</div><div class="dtLbl">MISS</div></button>
              <button class="dtActBtn undo" type="button" data-act="undo"><div class="dtIcon">↶</div><div class="dtLbl">UNDO</div></button>
              <button class="dtActBtn skip" type="button" data-act="skip"><div class="dtIcon">▶</div><div class="dtLbl">SKIP</div></button>
            </div>
          </div>
    `;

    // Decider input is delegated at the modal level so score buttons remain live
    // after each render and are not affected by stale inline handlers.
    if (!modal.__sqDeciderInputBound) {
      modal.__sqDeciderInputBound = true;
      modal.__sqDeciderLastInput = { key:'', at:0 };
      modal.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!btn || !modal.contains(btn)) return;

        let key = '';
        if (btn.classList.contains('dec-kindBtn')) key = 'kind:' + (btn.getAttribute('data-kind') || '');
        else if (btn.classList.contains('dtNumBtn')) key = 'sector:' + (btn.getAttribute('data-decider-sector') || btn.textContent || '');
        else if (btn.hasAttribute('data-bull')) key = 'bull:' + (btn.getAttribute('data-bull') || '');
        else if (btn.hasAttribute('data-act')) key = 'act:' + (btn.getAttribute('data-act') || '');
        if (!key) return;

        try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch(_) {}
        const now = Date.now();
        const last = modal.__sqDeciderLastInput || { key:'', at:0 };
        if (last.key === key && (now - last.at) < 180) return;
        modal.__sqDeciderLastInput = { key, at:now };

        if (key.indexOf('kind:') === 0) {
          dec.kind = btn.getAttribute('data-kind') || 'S';
          render();
          return;
        }
        if (key.indexOf('sector:') === 0) {
          const sector = Number(btn.getAttribute('data-decider-sector') || btn.textContent || 0);
          if (sector > 0) deciderRecordThrow({ sector });
          return;
        }
        if (key.indexOf('bull:') === 0) {
          deciderRecordThrow({ bull: btn.getAttribute('data-bull') });
          return;
        }
        const act = btn.getAttribute('data-act');
        if (act === 'miss') {
          try{ window.sqDmdShowZones?.({ z2:'MISS' },{type:'flash',ms:650}); }catch(_){ }
          deciderRecordThrow({ kind:'Miss' });
        } else if (act === 'undo') {
          try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }
          deciderUndo();
        } else if (act === 'skip') {
          deciderSkip();
        }
      }, true);
    }

    // Kind buttons
    modal.querySelectorAll('.dec-kindBtn').forEach(b=>{
      b.onclick = ()=>{
        dec.kind = b.getAttribute('data-kind') || 'S';
        render();
      };
    });

    // Number scroller 1..20
    const numRow = modal.querySelector('[data-role="numRow"]');
    if (numRow) {
      numRow.innerHTML = '';
      numRow.style.display = 'flex';
      numRow.style.gap = '8px';
      numRow.style.overflowX = 'auto';
      numRow.style.scrollSnapType = 'x mandatory';
      numRow.style.paddingBottom = '2px';

      for (let s=1; s<=20; s++){
        const b = document.createElement('button');
        b.className = 'dtNumBtn';
        b.type = 'button';
        b.textContent = String(s);
        b.setAttribute('data-decider-sector', String(s));
        b.style.flex = '0 0 calc((100% - 40px) / 6)';
        b.style.scrollSnapAlign = 'start';
        b.onclick = ()=> deciderRecordThrow({ sector:s });
        numRow.appendChild(b);
      }
    }

    // Bulls
    modal.querySelectorAll('[data-bull]').forEach(b=>{
      b.onclick = ()=> deciderRecordThrow({ bull: b.getAttribute('data-bull') });
    });
    // actions
    /* >>> PATCH:SQ_DMD_DECIDER_ACTION_HOOKS START */
    modal.querySelector('[data-act="miss"]')?.addEventListener('click', ()=>{
      try{ window.sqDmdShowZones?.({ z2:'MISS' },{type:'flash',ms:650}); }catch(_){ }
      deciderRecordThrow({ kind:'Miss' });
    });
    modal.querySelector('[data-act="undo"]')?.addEventListener('click', ()=>{
      try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }
      deciderUndo();
    });
    modal.querySelector('[data-act="skip"]')?.addEventListener('click', ()=>{
      deciderSkip();
    });
    /* <<< PATCH:SQ_DMD_DECIDER_ACTION_HOOKS END */

    // disable input during 2s hold
    if (dec.hold){
      modal.querySelectorAll('button').forEach(b=>{ try{ b.disabled = true; }catch(_){ } });
      modal.classList.add('dec-hold');
    } else {
      modal.classList.remove('dec-hold');
    }
  // (no CLOSE button in decider)
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    overlay.addEventListener('keydown', e=>{ if(e.key==='Escape') overlay.remove(); });
  }

  function roundKey(){ return R[dec.round].key; }

  function scoreFromSpec(spec){
    const rk = roundKey();
    if (spec.kind === 'Miss') return 0;

    if (rk === 'any'){
      // Any number: sectors + S/D/T and bulls
      if (spec.bull){
        return spec.bull === 'Inner' ? 50 : 25;
      }
      const sector = Number(spec.sector||0);
      if (!sector) return 0;
      const k = dec.kind || 'S';
      if (k === 'D') return sector * 2;
      if (k === 'T') return sector * 3;
      return sector;
    }

    if (rk === 'doubles'){
      // Doubles only: sector * 2; bulls do not count
      const sector = Number(spec.sector||0);
      return sector ? sector*2 : 0;
    }

    if (rk === 'triples'){
      const sector = Number(spec.sector||0);
      return sector ? sector*3 : 0;
    }

    if (rk === 'bull'){
      if (!spec.bull) return 0;
      return spec.bull === 'Inner' ? 50 : 25;
    }

    return 0;
  }

  function tokenFromSpec(spec, pts){
    // Display code inside dart indicator: X, S20, D10, T7, OB, IB
    try{
      const rk = roundKey();
      if (!spec) return '-';
      if (spec.kind === 'Miss') return 'X';
      if (spec.bull){
        return (spec.bull === 'Inner') ? 'IB' : 'OB';
      }
      const sector = Number(spec.sector||0);
      if (!sector || !pts) return 'X';

      // Determine multiplier letter
      if (rk === 'doubles') return 'D' + sector;
      if (rk === 'triples') return 'T' + sector;
      // rk === 'any'
      const k = (dec.kind || 'S').toUpperCase();
      if (k === 'D') return 'D' + sector;
      if (k === 'T') return 'T' + sector;
      return 'S' + sector;
    }catch(_){
      return 'X';
    }
  }

  function deciderRecordThrow(spec){
    if (dec.hold) return;
    // close guard
    if (!state._decider || state._decider.resolved) return;

    const pts = scoreFromSpec(spec || {});
    dec.lastToken = tokenFromSpec(spec || {}, pts);
    const pi = dec.turn;
    dec.totals[pi] += pts;

    dec.history.push({
      p: pi,
      round: dec.round,
      dart: dec.dart,
      points: pts,
      token: dec.lastToken,
      spec: JSON.parse(JSON.stringify(spec||{}))
    });

    // advance dart/turn/round
    if (dec.dart < 2) {
      dec.dart++;
      render();
      return;
    }

    // last dart for this player/round: hold the filled indicators for 2s
    dec.hold = true;

    const _turn = dec.turn;
    const _round = dec.round;

    window.setTimeout(() => {
      try{
        dec.hold = false;
        dec.kind = 'S'; // reset kind UI

        // advance to next player / round
        dec.dart = 0;
        if (_turn < dec.participants.length - 1) {
          dec.turn = _turn + 1;
          dec.round = _round;
        } else {
          dec.turn = 0;
          dec.round = _round + 1;
        }

        if (dec.round >= R.length) {
          finishDecider();
          return;
        }
        render();
      }catch(_){}
    }, 2000);

    render();
    return;

  }

  function deciderUndo(){
    try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }
    const last = dec.history.pop();
    if (!last) return;

    // rewind pointers to last throw position
    dec.round = last.round;
    dec.turn  = last.p;
    dec.dart  = last.dart;

    // subtract points
    dec.totals[last.p] -= (last.points || 0);
    if (dec.totals[last.p] < 0) dec.totals[last.p] = 0;

    // restore readout to previous throw
    const prev = dec.history.length ? dec.history[dec.history.length-1] : null;
    dec.lastToken = prev ? tokenFromSpec(prev.spec || {}, prev.points || 0) : "-";

    render();
  }

  function deciderSkip(){
    // Skip the rest of this player's go: fill current + remaining darts with misses
    try{ window.sqDmdShowZones?.({ z2:'SKIP' },{type:'flash',ms:650}); }catch(_){ }
    const remaining = 3 - (dec.dart);
    for (let i=0; i<remaining; i++){
      // deciderRecordThrow advances pointers internally
      deciderRecordThrow({ kind:'Miss' });
      if (!state._decider || state._decider.resolved) break;
    }
  }

  function finishDecider(){
    // determine winner among participants
    const max = Math.max(...dec.totals);
    const bestIdx = dec.totals.map((t,i)=> t===max?i:null).filter(v=>v!==null);

    // tie-break inside decider: sudden-death bull shootout (single-dart) until resolved
    if (bestIdx.length > 1) {
      // For now: deterministic tie-breaker by original order
      // (can be extended later to a real bull sudden-death loop)
      bestIdx.sort((a,b)=>a-b);
    }
    const winP = bestIdx[0];
    // runner-up among participants
    const sorted = dec.totals.map((t,i)=>({i,t})).sort((a,b)=> b.t - a.t || a.i - b.i);
    const runner = sorted[1]?.i ?? null;

    dec.winner = dec.participants[winP];
    dec.runnerUp = runner===null ? null : dec.participants[runner];
    dec.resolved = true;

    // Store override winner for award logic
    state._decider = dec;

    // Show shootout complete modal in GAME COMPLETE style
    openShootoutCompleteDialog(dec, baseTotals);

    // close this modal
    overlay.remove();
  }

  render();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.focus();
}

function openShootoutCompleteDialog(dec, baseTotals){
  // remove any old instances
  document.querySelectorAll('.sq-shootoutcomplete-backdrop').forEach(n=>n.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-shootoutcomplete-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal modal-gamecomplete';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.tabIndex = -1;

  const winnerName = __sqPlayerPretty(state.players[dec.winner]) || state.players[dec.winner].name || ('Player ' + (dec.winner+1));
  const runnerName = (typeof dec.runnerUp==='number')
    ? (__sqPlayerPretty(state.players[dec.runnerUp]) || state.players[dec.runnerUp].name || ('Player ' + (dec.runnerUp+1)))
    : '';

  // compute a simple ranking list: winner first, runner second, others by original game totals
  const totals = (baseTotals || state.players.map((_,i)=>totalScoreForPlayer(i)));
  const ranking = totals.map((score,index)=>({index,score})).sort((a,b)=> b.score - a.score);

  // enforce first/second among tied winners only
  const topScore = Math.max(...totals);
  const tiedTop  = ranking.filter(r=>r.score===topScore).map(r=>r.index);

  // Build final order: winner then runner (if present), then remaining (excluding these) in original ranking order
  const finalOrder = [];
  finalOrder.push(dec.winner);
  if (typeof dec.runnerUp==='number' && dec.runnerUp !== dec.winner) finalOrder.push(dec.runnerUp);
  ranking.forEach(r=>{
    if (finalOrder.includes(r.index)) return;
    // keep everyone else in their original order
    finalOrder.push(r.index);
  });

  // persist final placement override order for awards/leaderboard only (no score changes)
  state._decider.finalOrder = finalOrder.slice();

  modal.innerHTML = `
    <div class="gc-top">
      <div class="gc-title">SHOOTOUT COMPLETE</div>
      <div class="gc-subtitle"><span class="gc-accent">WINNER</span></div>
    </div>

    <div class="gc-body">
      <div class="gc-winnerCard">
        <div class="gc-winnerLabel"><span class="gc-accent">WINNER</span></div>
        <div class="gc-winnerName" title="${winnerName}">${winnerName}</div>
        <div class="gc-winnerScore">${dec.totals[dec.participants.indexOf(dec.winner)] || 0}</div>
      </div>

      <div class="gc-divider"></div>

      <div class="gc-ranks" data-role="gcRanks"></div>
    </div>

    <div class="gc-actions">
      <button class="btn gc-close" type="button" data-action="close">CLOSE</button>
    </div>
  `;

  const ranksEl = modal.querySelector('[data-role="gcRanks"]');
  if (ranksEl) {
    ranksEl.innerHTML = '';
    finalOrder.forEach((pIdx, i)=>{
      const div = document.createElement('div');
      const nm = __sqPlayerPretty(state.players[pIdx]) || state.players[pIdx].name || ('Player ' + (pIdx+1));
      const isWin = pIdx === dec.winner;
      div.className = 'gc-rankRow' + (isWin ? ' win' : '');
      div.innerHTML = `
        <div class="gc-rankPos">${(i+1)===1?'1ST':(i+1)===2?'2ND':(i+1)===3?'3RD':(i+1)+'TH'}</div>
        <div class="gc-rankName">${nm}</div>
        <div class="gc-rankScore">${totals[pIdx] ?? 0}</div>
      `;
      ranksEl.appendChild(div);
    });
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const remove = () => overlay.remove();

  // CLOSE button
  modal.querySelector('[data-action="close"]')?.addEventListener('click', () => remove());

  // Allow overlay click to dismiss (safe here)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) remove();
  });

  // ESC closes
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); remove(); }
  });

  modal.tabIndex = 0;
  modal.focus();
}
// >>> PATCH:decider_shootout_logic END

function markCloudError(err) {
  try{ if (typeof __sqHideBootSplash === 'function') __sqHideBootSplash(); }catch(_){}
  console.error('[Supabase]', err);

  // If we've already proven cloud connectivity once, avoid screaming “offline”
  // for common non-fatal cases (RLS, timeout/abort). Show WARN instead.
  const msg = String((err && (err.message || err.error_description || err.hint)) || err || '');
  const isAbort = (err && err.name === 'AbortError') || /AbortError/i.test(msg) || /aborted/i.test(msg);
  const isAuth  = /JWT|401|403|permission|RLS|row level/i.test(msg);

  if (window.__cloudEverOk && (isAbort || isAuth)) {
    setCloudStatus('warn', isAuth ? 'Cloud: limited (RLS)' : 'Cloud: timeout');
    return;
  }

  setCloudStatus('error', 'Cloud: problem – using local');
}

