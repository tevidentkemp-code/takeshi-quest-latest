// ===== @SEC:JS:GAME:LIVEV2 =====
// @CANONICAL:LIVE_V2_BASE_RENDER
function __sqLiveV2PaintQuickSound(btn){
  if (!btn) return;
  let on = true;
  try{ on = (typeof __sqV3SoundOn === 'function') ? __sqV3SoundOn() : localStorage.getItem('sq_livev3_sound') !== '0'; }catch(_){ on = true; }
  btn.classList.toggle('muted', !on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? 'Turn sound effects off' : 'Turn sound effects on');
  btn.title = on ? 'Sound effects on' : 'Sound effects off';
}
function __sqBindLiveV2QuickRail(panel){
  try{
    if (!panel) return;
    const menu = panel.querySelector('#v2QuickMenu');
    const tv = panel.querySelector('#v2QuickTv');
    const sound = panel.querySelector('#v2QuickSound');
    if (menu){
      menu.onclick = () => {
        try{ if (typeof window.__sqOpenGameMenu106 === 'function') return window.__sqOpenGameMenu106(); }catch(_){}
        try{ document.getElementById('settingsBtnGame')?.click(); }catch(_){}
      };
    }
    if (tv){
      tv.onclick = () => {
        try{
          if (typeof window.__sqTvModeToggle === 'function') return window.__sqTvModeToggle(true);
          if (typeof toast === 'function') toast('TV Mode unavailable');
        }catch(e){ try{ console.warn('[SQ] TV Mode toggle failed', e); }catch(_){} }
      };
    }
    if (sound){
      __sqLiveV2PaintQuickSound(sound);
      sound.onclick = () => {
        let next = true;
        try{
          const current = (typeof __sqV3SoundOn === 'function') ? __sqV3SoundOn() : localStorage.getItem('sq_livev3_sound') !== '0';
          next = !current;
          if (typeof __sqV3SetSound === 'function') __sqV3SetSound(next);
          else localStorage.setItem('sq_livev3_sound', next ? '1' : '0');
          if (next && typeof __sqV3Ac === 'function') __sqV3Ac();
        }catch(_){}
        __sqLiveV2PaintQuickSound(sound);
      };
    }
  }catch(_){}
}
function liveV2Render(){
  // Only runs on gameplay screen; prevents start/menu JS from crashing
  const page = document.body && (document.body.getAttribute('data-page') || document.body.dataset && document.body.dataset.page);
  if(page !== 'game') return;

  const eligible = (FLAGS.LIVE_V2 !== false) && isLiveV2Eligible();
  document.body.classList.toggle("livev2-on", eligible);
  __sqToggleLegacyUIForLiveV2(!!eligible);

  // Kick PB/WR snapshot refresh (async, cached) — deferred until after first paint
  // Prefer DB-derived PB/WR views for Live V2; fall back to legacy snapshot if unavailable.
  const __pbwr = window.__v2PBWRSnapshot || null;   // use existing cached snapshot immediately
  const __pbgr = window.__pbgrSnapshot || null;

  // >>> PATCH:BOOT_DEFER_NONCRITICAL_PREFETCH START
  // Defer non-critical PB/WR + history warming so the gameplay transition stays snappy (Mobile Safari).
  try{
    const __afterPaint = (cb)=>{
      try{
        if (window.SQ && SQ.boot && typeof SQ.boot.afterPaint === 'function') return SQ.boot.afterPaint(cb);
      }catch(_){}
      setTimeout(cb, 0);
    };
    const __queue = (name, fn)=>{
      try{
        if (window.SQ && SQ.boot && typeof SQ.boot.queueTask === 'function') return SQ.boot.queueTask(name, fn);
      }catch(_){}
      try{ return fn(); }catch(_){ return false; }
    };

    __afterPaint(()=>{
      __queue('v2_pbwr_snapshot_refresh', ()=> (typeof __sqEnsureV2PBWR === 'function') ? __sqEnsureV2PBWR() : false);
      __queue('v2_pbgr_snapshot_refresh', ()=> (typeof __sqEnsurePBGRSnapshot === 'function') ? __sqEnsurePBGRSnapshot().then(()=>{ try{ liveV2Render(); }catch(_){} }) : false);

      __queue('pl_wr_history_warm', ()=> (typeof window.__plEnsureWRHistory === 'function') ? window.__plEnsureWRHistory() : false);

      __queue('pl_alltime_players_warm', ()=>{
        if (typeof window.__plEnsureAllTimeForPlayers !== 'function') return false;
        const pNames = (state.players||[]).map(p => (p && (p.name||p)) ).filter(Boolean);
        if (!pNames.length) return false;
        return window.__plEnsureAllTimeForPlayers(pNames);
      });
    });
  }catch(_){}
  // <<< PATCH:BOOT_DEFER_NONCRITICAL_PREFETCH END

  const panel = ensureLiveV2Panel();
  if(!panel) return;
  try{ if (typeof __sqSyncTurboVisualState === 'function') __sqSyncTurboVisualState('game'); }catch(_){ }

  if(!eligible){
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  try{ __sqBindLiveV2QuickRail(panel); }catch(_){ }
  try{ __sqSetupLiveV2Sizing(panel); }catch(_){ }

  const pCount = getLiveV2PlayerCount();

  // Active player index (derive from real state)
  const turn = Number.isFinite(+state.currentPlayer) ? +state.currentPlayer
             : (Number.isFinite(+state.currentPlayerIndex) ? +state.currentPlayerIndex
             : (Number.isFinite(+state.turnIndex) ? +state.turnIndex : 0));

  // Totals + initials + leader diff subline.
  // SC-036 presentation split: during absence catch-up the engine cursor rewinds
  // to the missed scoring round, but the table/viewport stays on the scheduled
  // live round. The orange active edge follows the catch-up target independently.
  const cr = state.currentRound ?? 0;
  const __sqCatchUpView = (()=>{
    const clampRound = v => Math.max(0, Math.min(MAX_ROUNDS - 1, Number(v) || 0));
    const cu = state && state.__sqCatchUp;
    let tableRound = clampRound(cr);
    let scoringRound = clampRound(cr);
    let preview = false;

    if(cu && cu.active){
      if(Number.isFinite(Number(cu.resumeRound))) tableRound = clampRound(cu.resumeRound);
    }else if(cu && Array.isArray(cu.jobs) && Number(state.currentDart || 0) === 0){
      for(let j=cu.jobs.length-1; j>=0; j--){
        const job = cu.jobs[j];
        if(!job || job.kind !== 'absence' || job.completed || job.returned === true || Number(job.playerIndex) !== Number(turn)) continue;
        const pending = Array.isArray(job.pendingRounds) ? job.pendingRounds.map(Number).filter(Number.isFinite).sort((a,b)=>a-b) : [];
        if(!pending.length) break;
        // Final Bull remains Bull-first under §§9.8–9.11; do not preview older
        // catch-up rounds until that first Bull dart has been taken.
        if(tableRound === MAX_ROUNDS - 1 && pending.some(r=>r < MAX_ROUNDS - 1)) break;
        scoringRound = clampRound(pending[0]);
        preview = scoringRound !== tableRound;
        break;
      }
    }

    return { tableRound, scoringRound, active:!!(cu && cu.active), preview };
  })();
  const tableCr = __sqCatchUpView.tableRound;
  const activeCr = __sqCatchUpView.scoringRound;

  // Bottom number:
  // - leaders show green positive gap to the next non-leading score
  // - if tied on top, all tied leaders stay green and show +0 (or +gap to the next non-tied score)
  // - trailing players keep red negative gap to leader
  const __v2Totals = [];
  for(let i=0;i<pCount;i++) __v2Totals[i] = (+getPlayerTotal(i) || 0);
  const __v2LeaderTotal = __v2Totals.length ? Math.max.apply(null, __v2Totals) : 0;
  const __v2UniqueTotals = Array.from(new Set(__v2Totals.map(v => +v || 0))).sort((a,b)=>b-a);
  const __v2SecondDistinct = (__v2UniqueTotals.length > 1) ? Number(__v2UniqueTotals[1] || 0) : Number(__v2LeaderTotal || 0);

  const __v2GamesInMatch = Math.max(0, Number(state?.match?.targetWins || 0) || 0);
  const __v2MatchWins = Array.isArray(state?.match?.wins) ? state.match.wins : [];

  for(let i=0; i<pCount; i++){
    const v2i = document.getElementById("v2Init"+i);
    const v2t = document.getElementById("v2Total"+i);
    const v2s = document.getElementById("v2Sub"+i);
    const v2w = document.getElementById("v2WinDots"+i);
    if(v2i) v2i.textContent = getPlayerInitial(i);
    if(v2t) v2t.textContent = String(__v2Totals[i]);

    const diff = (__v2Totals[i] - __v2LeaderTotal); // trailing = negative
    const isLeader = (__v2Totals[i] === __v2LeaderTotal);
    if(v2t) v2t.classList.toggle("leaderTotal", isLeader);

    if(v2s){
      if(isLeader){
        const leadGap = Math.max(0, (__v2LeaderTotal - __v2SecondDistinct));
        v2s.textContent = `+${leadGap}`;
        v2s.classList.remove("trailing", "crown");
        v2s.classList.add("leader", "leaderGap");
      }else{
        v2s.textContent = String(diff);
        v2s.classList.remove("leader", "leaderGap", "crown");
        v2s.classList.add("trailing");
      }
    }

    if(v2w){
      const wins = Math.max(0, Number(__v2MatchWins[i] || 0) || 0);
      const totalDots = Math.max(__v2GamesInMatch, wins);
      v2w.innerHTML = Array.from({length: totalDots}, (_,k)=>`<i class="v2WinDot${k < wins ? ' on' : ''}"></i>`).join('');
    }
  }

  // Highlight active player on totals
  panel.querySelectorAll(".v2ScoreBox").forEach((el)=>{
    const p = parseInt(el.getAttribute("data-p") || "0", 10);
    el.classList.toggle("active", p === turn);
  });

  // SC-017: duplicate the canonical live 3R/MTC averages beneath each player card.
  for(let i=0; i<pCount; i++){
    const av = __sqV2LiveAveragePair(i, cr);
    const a3 = document.getElementById('v2Mini3R' + i);
    const mt = document.getElementById('v2MiniMtc' + i);
    if(a3) a3.textContent = __sqFmtAvg(av.r3);
    if(mt) mt.textContent = __sqFmtAvg(av.mtc);
  }

  // Solo Practice: PB/WR total + rolling pace and live variance beside the player score pill.
  try{ if(pCount === 1) __sqUpdateSoloPracticePacePanel(__v2Totals[0] || 0, cr || 0); }catch(_){ }

  // Live V2 shot track: reuse the current Beta/V3 dart notation and state.
  // A completed go briefly uses the engine's existing uiLastGo hold, then the
  // first slot resets for the next player/round. This is presentation only.
  const dartN = Math.max(0, Math.min(3, Number.isFinite(+state.currentDart) ? +state.currentDart : 0));
  const heldGo = state.uiLastGo && Date.now() < Number(state.uiLastGo.showUntil || 0) &&
    Number(state.uiLastGo.player) !== turn && dartN === 0;
  const shotDarts = heldGo
    ? (Array.isArray(state.uiLastGo.darts) ? state.uiLastGo.darts : [])
    : (Array.isArray(state.score?.[turn]?.[cr]?.darts) ? state.score[turn][cr].darts : []);
  const nextShot = heldGo ? 3 : dartN;
  const renderVisitDots = (nodes, darts, nextIndex, allowNext = true) => {
    nodes.forEach((el)=>{
      const k = parseInt(el.getAttribute("data-dot") || "0", 10);
      const dart = darts[k] || null;
      el.classList.remove("off", "idle", "next", "done", "single", "double", "treble", "bull", "miss");
      el.textContent = "";
      if(dart){
        const kind = dart.kind;
        const visual = kind === "Miss" ? "miss"
          : (kind === "T" || kind === "Triple") ? "treble"
          : (kind === "D" || kind === "Double") ? "double"
          : kind === "B" ? "bull" : "single";
        const mark = (typeof __sqV3Mark === "function") ? __sqV3Mark(dart) : __sqV2DartToken(dart, cr);
        el.classList.add("done", visual);
        el.dataset.shotState = "done";
        el.textContent = mark;
      }else if(allowNext && !state.finished && k === nextIndex){
        el.classList.add("next");
        el.dataset.shotState = "next";
      }else{
        el.classList.add("idle");
        el.dataset.shotState = "idle";
      }
    });
  };

  // Keep the original left-hand indicators authoritative at every viewport.
  panel.querySelectorAll(".v2DotsCol .v2Dot").forEach((el)=>{
    const k = parseInt(el.getAttribute("data-dot") || "0", 10);
    const dart = shotDarts[k] || null;
    el.classList.remove("off", "idle", "next", "done", "single", "double", "treble", "bull", "miss");
    el.textContent = "";
    if(dart){
      const kind = dart.kind;
      const visual = kind === "Miss" ? "miss"
        : (kind === "T" || kind === "Triple") ? "treble"
        : (kind === "D" || kind === "Double") ? "double"
        : kind === "B" ? "bull" : "single";
      const mark = (typeof __sqV3Mark === "function") ? __sqV3Mark(dart) : __sqV2DartToken(dart, cr);
      el.classList.add("done", visual);
      el.dataset.shotState = "done";
      el.textContent = mark;
    }else if(!state.finished && k === nextShot){
      el.classList.add("next");
      el.dataset.shotState = "next";
    }else{
      el.classList.add("idle");
      el.dataset.shotState = "idle";
    }
  });

  // Rounds list: 3-row viewport. At game start show current + next 2; later show current + previous 2.
  // >>> PATCH:LIVEV2_ROWS_GUARD START
  try {
  const rowsHost = document.getElementById("v2Rows");
  if(rowsHost){
    const out = [];
    const totalR = (typeof ROUNDS!=="undefined" && Array.isArray(ROUNDS) && ROUNDS.length) ? ROUNDS.length : Math.max(cr+1, 1);

    // Window behavior: render all rounds up to current (plus next), within a scrollable viewport.
    // Users can scroll back to see completed rounds; on scoring input we auto-scroll back to the live round.
    // Window end logic:
    // - For early game (Rounds 10–12), keep a forward-looking 4-row window: 10,11,12,13.
    // - From Round 13 onward, show a trailing 4-row window ending at the live round (no future row below live).
    // Fix122/Fix131: early games should start with the live round anchored on row 4.
    // Practice solo: blank / blank / blank / 10.
    // Standard Match Play: blank / blank / blank / 10, then roll up each completed round.
    const __sqSoloPracticeStartAnchor = (pCount === 1 && tableCr <= 2 && (function(){
      try{
        const m = state.match || {};
        const mode = String(state.mode || state.gameMode || m.mode || m.gameMode || '').toLowerCase();
        return mode.indexOf('practice') >= 0 || m.isPractice === true || m.is_practice === true || state.isPractice === true || state.is_practice === true || pCount === 1;
      }catch(_){ return pCount === 1; }
    })());
    const __sqStandardMatchStartAnchor = (pCount > 1 && tableCr <= 2 && (function(){
      try{
        const m = state.match || {};
        const mode = String(state.mode || state.gameMode || m.mode || m.gameMode || '').toLowerCase();
        const tType = String(m.tournamentType || m.tournament_type || state.tournamentType || state.tournament_type || '').toLowerCase();
        const isTournament = m.tournament === true || !!m.tournamentRules || !!m.tournamentType || !!m.tournament_type || !!state.__sqTournamentDraft;
        const isPractice = mode.indexOf('practice') >= 0 || m.isPractice === true || m.is_practice === true || state.isPractice === true || state.is_practice === true;
        const isTurboLike = tType === 'turbo' || m.strictTimer === true || Number(m.throwLimitSeconds || 0) === 20;
        return !isTournament && !isPractice && !isTurboLike;
      }catch(_){ return true; }
    })());
    const __sqStartAnchorRow4 = (__sqSoloPracticeStartAnchor || __sqStandardMatchStartAnchor);
    const renderEnd = Math.min(totalR - 1, (__sqStartAnchorRow4 ? tableCr : (tableCr <= 2 ? 3 : tableCr)));
    if(__sqStartAnchorRow4){
      const __blankRows = Math.max(0, 3 - tableCr);
      for(let __b = 0; __b < __blankRows; __b++){
        out.push('<div class="v2Badge small solo-future sq122-blank sq131-blank"></div>');
        if(pCount === 1){
          out.push('<div class="v2Cell small solo-future sq122-blank sq131-blank"></div>');
          out.push('<div class="v2Cell small v2SoloPbCell solo-future sq122-blank sq131-blank"></div>');
        }else{
          for(let __pi = 0; __pi < pCount; __pi++){
            out.push('<div class="v2Cell small solo-future sq122-blank sq131-blank"></div>');
          }
        }
      }
    }
    for(let r = 0; r <= renderEnd; r++){

      const rowSmall = (r !== tableCr);
      const rowClass = (r === tableCr) ? " liveRow" : (rowSmall ? " small" : "");

      // Insert a faint divider line above the table's live row. Catch-up changes
      // orange focus only; it must not move or resize the viewport rows.
      if(r === tableCr && (r > 0 || __sqStartAnchorRow4)){
        out.push('<div class="v2SepNo"></div>');
        out.push('<div class="v2Sep"></div>');
      }

      // Compute per-round max (for faint green highlight)
      let maxV = -Infinity;
      const vals = new Array(pCount);
      for(let i=0;i<pCount;i++){
        const v = getPerRoundScore(r, i);
        vals[i] = (Number.isFinite(+v) ? +v : null);
        if(vals[i] != null && vals[i] > maxV) maxV = vals[i];
      }

      const __soloRowState = (pCount === 1) ? (r === tableCr ? " solo-current" : (r < tableCr ? " solo-complete" : " solo-future")) : "";
      out.push(`<div class="v2Badge${rowClass} ${r === activeCr ? "active":""}${__soloRowState}" data-round="${r}">${escapeHtml(roundLabelForIndex(r))}</div>`);
      for(let i=0; i<pCount; i++){
        const val = vals[i];
        const isActiveCell = (r === activeCr) && (i === turn);

        // Highlight highest round score(s), but don't green-glow a row of zeros.
        const isHi = (maxV > 0) && (val != null) && (val === maxV);

        const rk = __sqRoundKeyForIdx(r);
const bk = __sqResolveBucketKeyForPlayer(i);
let pbVal = 0;
let wrVal = 0;

// Prefer DB-derived PB/WR (views). Fallback to legacy snapshot if needed.
if(__pbwr && rk){
  try{ wrVal = Number(__pbwr.wrByRound && __pbwr.wrByRound.get ? (__pbwr.wrByRound.get(rk) || 0) : 0); }catch(_){ wrVal = 0; }
  if(bk){
    try{
      const m2 = (__pbwr.pbByBucket && __pbwr.pbByBucket.get) ? __pbwr.pbByBucket.get(String(bk)) : null;
      pbVal = Number(m2 && m2.get ? (m2.get(rk) || 0) : 0);
    }catch(_){ pbVal = 0; }
  }
}else{
  const cat = __sqCatForRoundIdx(r);
  const pNameKey = getPlayerName(i).toLowerCase();
  pbVal = (__pbgr && __pbgr.byPlayerMeta && typeof __pbgr.byPlayerMeta.get === 'function' && cat)
    ? Number((__pbgr.byPlayerMeta.get(pNameKey) || {})[cat]?.val || 0) : 0;
  wrVal = (__pbgr && __pbgr.byTargetMeta && cat)
    ? Number(__pbgr.byTargetMeta[cat]?.val || 0) : 0;
}

// Solo Practice uses the displayed round-PB value for completed-row comparison.
// The DB bucket view can lag or miss older names; the rich PB/GR snapshot is the visual source here.
if(pCount === 1){
  try{
    const catCmp = __sqCatForRoundIdx(r);
    const rkCmp = __sqRoundKeyForIdx(r);
    const nmCmp = String(getPlayerName(i) || '').trim().toLowerCase();
    const bkCmp = __sqResolveBucketKeyForPlayer(i);
    let soloCmpPb = 0;
    if(__pbgr && __pbgr.byPlayerMeta && typeof __pbgr.byPlayerMeta.get === 'function' && catCmp){
      const richCmp = (__pbgr.byPlayerMeta.get(nmCmp) || (bkCmp ? __pbgr.byPlayerMeta.get(String(bkCmp).toLowerCase()) : null) || null);
      const metaCmp = richCmp && richCmp[catCmp];
      soloCmpPb = Number(metaCmp && (metaCmp.val || metaCmp.pb || metaCmp.points) || 0) || 0;
    }
    if(!soloCmpPb && __pbwr && rkCmp && bkCmp){
      const mCmp = (__pbwr.pbByBucket && __pbwr.pbByBucket.get) ? __pbwr.pbByBucket.get(String(bkCmp)) : null;
      soloCmpPb = Number(mCmp && mCmp.get ? (mCmp.get(rkCmp) || 0) : 0) || 0;
    }
    if(soloCmpPb > 0) pbVal = soloCmpPb;
  }catch(_){ }
}

const isWR = (val != null) && (wrVal > 0) && (val === wrVal);
const isPB = (!isWR) && (val != null) && (pbVal > 0) && (val === pbVal);

const __soloLiveDarts = (pCount === 1) ? __sqV2DartsTextForEntry(state.score?.[i]?.[r], r) : '';
const __soloScoreBorderClass = (pCount === 1)
  ? (r === tableCr ? ' solo-current' : ((r < tableCr && val != null && pbVal > 0 && Number(val) > pbVal) ? ' solo-beat-pb' : (r < tableCr ? ' solo-complete' : ' solo-future')))
  : '';
const __skipState = (typeof __sqSkippedRoundState === 'function') ? __sqSkippedRoundState(i, r) : '';
const __skipEntry = state.score?.[i]?.[r];
const __hasCatchUpDart = Array.isArray(__skipEntry?.darts) && __skipEntry.darts.some(d=>d && d.kind!=='Scratch');
const __inlineScore = (__skipState === 'pending' && !__hasCatchUpDart)
  ? '<span class="v2CellNum sq-skip-cell-mark">»»»</span>'
  : (__skipState === 'scratched'
    ? '<span class="v2CellNum sq-skip-cell-scratched">X</span>'
    : (val == null ? "–" : `<span class="v2CellNum">${escapeHtml(String(val))}</span>${__soloLiveDarts ? `<span class="v2CellDarts">${escapeHtml(__soloLiveDarts)}</span>` : ''}`));
const __inlineTargets = (r === tableCr)
  ? `<div class="v2CellShots" data-p="${i}" data-round="${r}" aria-label="Current round targets">
      <span class="v2Dot" data-p="${i}" data-dot="0" data-shot-state="idle"></span>
      <span class="v2Dot" data-p="${i}" data-dot="1" data-shot-state="idle"></span>
      <span class="v2Dot" data-p="${i}" data-dot="2" data-shot-state="idle"></span>
    </div>`
  : '';
const __cellContents = (r === tableCr)
  ? `<div class="v2CellScore">${__inlineScore}</div>${__inlineTargets}`
  : __inlineScore;
out.push(`<div class="v2Cell${rowClass} ${(isActiveCell ? "active":"")} ${(isHi ? "hi":"")} ${(isPB ? "pb":"")} ${(isWR ? "wr":"")}${__soloScoreBorderClass}" data-p="${i}" data-round="${r}">` +
         __cellContents +
         `</div>`);

        // Solo Practice: player round score = 2/3 width, PB pill = 1/3 width.
        if(pCount === 1){
          let soloPbVal = 0;
          let soloPbDarts = '';
          try{
            const cat2 = __sqCatForRoundIdx(r);
            const rk2 = __sqRoundKeyForIdx(r);
            const nm2 = String(getPlayerName(i) || '').trim().toLowerCase();
            const bk2 = __sqResolveBucketKeyForPlayer(i);
            if(__pbgr && __pbgr.byPlayerMeta && typeof __pbgr.byPlayerMeta.get === 'function' && cat2){
              const rich = (__pbgr.byPlayerMeta.get(nm2) || (bk2 ? __pbgr.byPlayerMeta.get(String(bk2).toLowerCase()) : null) || null);
              const meta2 = rich && rich[cat2];
              if(meta2){
                soloPbVal = Number(meta2.val || meta2.pb || meta2.points || 0) || 0;
                soloPbDarts = String(meta2.darts || meta2.throws || '').trim().replace(/\s*\/\s*/g, ' / ');
              }
            }
            if(!soloPbVal && __pbwr && rk2 && bk2){
              const m3 = (__pbwr.pbByBucket && __pbwr.pbByBucket.get) ? __pbwr.pbByBucket.get(String(bk2)) : null;
              soloPbVal = Number(m3 && m3.get ? (m3.get(rk2) || 0) : 0) || 0;
            }
          }catch(_){ }
          const __soloPbBorderClass = (r === tableCr)
            ? ' solo-current'
            : ((r < tableCr && val != null && soloPbVal > 0 && Number(val) <= soloPbVal) ? ' solo-pb-holds' : (r < tableCr ? ' solo-complete' : ' solo-future'));
          out.push(`<div class="v2Cell${rowClass} v2SoloPbCell ${soloPbVal > 0 ? 'hasPb' : ''}${__soloPbBorderClass}">` +
            (soloPbVal > 0
              ? `<span class="v2SoloPbScore">${escapeHtml(String(soloPbVal))}</span><span class="v2SoloPbDarts">${escapeHtml(soloPbDarts || '—')}</span>`
              : `<span class="v2SoloPbScore">–</span><span class="v2SoloPbDarts">PB</span>`) +
            `</div>`);
        }

      }
    }
    rowsHost.innerHTML = out.join("");

    // Current-round target cells live inside the live score cells only. They
    // derive from the authoritative per-player round darts and reset in place
    // when the round cursor advances; historic rows never receive targets.
    for(let i=0;i<pCount;i++){
      const targetNodes = rowsHost.querySelectorAll(`.v2Cell.liveRow[data-p="${i}"] .v2CellShots .v2Dot`);
      const darts = Array.isArray(state.score?.[i]?.[tableCr]?.darts) ? state.score[i][tableCr].darts : [];
      const ownsTableRound = i === turn && activeCr === tableCr;
      const next = ownsTableRound ? dartN : 3;
      renderVisitDots(targetNodes, darts, next, !state.finished && ownsTableRound);
    }

    // >>> PATCH:livev2-scoringcell-nextrow START
    // Live V2 should only show 3 score rows total (no extra "next" row).
    // The old v2NextRow host is now forcibly hidden to prevent a 4th visible row (e.g. Round 13).
    const nextHost = document.getElementById("v2NextRow");
    if(nextHost){
      nextHost.innerHTML = "";
      nextHost.style.display = "none";
      nextHost.setAttribute("aria-hidden", "true");
    }
    // <<< PATCH:livev2-scoringcell-nextrow END

    /*
    (Legacy next-row renderer retained below for reference, but disabled.)
    if(nextHost){
      const rNext = scoringIdx;
      if(rNext >= 0 && rNext <= (totalR - 1)){
const out2 = [];

        // Compute per-round max (for faint green highlight)
        let maxV2 = -Infinity;
        const vals2 = new Array(pCount);
        for(let i=0;i<pCount;i++){
          const v = getPerRoundScore(rNext, i);
          vals2[i] = (Number.isFinite(+v) ? +v : null);
          if(vals2[i] != null && vals2[i] > maxV2) maxV2 = vals2[i];
        }

        out2.push(`<div class=\"v2Badge ${rNext === cr ? 'active' : ''}\">${escapeHtml(roundLabelForIndex(rNext))}</div>`);
        for(let i=0; i<pCount; i++){
          const val = vals2[i];
          const isActiveCell2 = (rNext === cr) && (i === turn);

          // Highlight highest round score(s), but don't green-glow a row of zeros.
          const isHi = (maxV2 > 0) && (val != null) && (val === maxV2);

          const rk = __sqRoundKeyForIdx(rNext);
          const bk = __sqResolveBucketKeyForPlayer(i);
          let pbVal = 0;
          let wrVal = 0;

          // Prefer DB-derived PB/WR (views). Fallback to legacy snapshot if needed.
          if(__pbwr && rk){
            try{ wrVal = Number(__pbwr.wrByRound && __pbwr.wrByRound.get ? (__pbwr.wrByRound.get(rk) || 0) : 0); }catch(_){ wrVal = 0; }
            if(bk){
              try{
                const m2 = (__pbwr.pbByBucket && __pbwr.pbByBucket.get) ? __pbwr.pbByBucket.get(String(bk)) : null;
                pbVal = Number(m2 && m2.get ? (m2.get(rk) || 0) : 0);
              }catch(_){ pbVal = 0; }
            }
          }else{
            const cat = __sqCatForRoundIdx(rNext);
            const pNameKey = getPlayerName(i).toLowerCase();
            pbVal = (__pbgr && __pbgr.byPlayerMeta && typeof __pbgr.byPlayerMeta.get === 'function' && cat)
              ? Number((__pbgr.byPlayerMeta.get(pNameKey) || {})[cat]?.val || 0) : 0;
            wrVal = (__pbgr && __pbgr.byTargetMeta && cat)
              ? Number(__pbgr.byTargetMeta[cat]?.val || 0) : 0;
          }

          const isWR = (val != null) && (wrVal > 0) && (val === wrVal);
          const isPB = (!isWR) && (val != null) && (pbVal > 0) && (val === pbVal);

          out2.push("<div class=\"v2Cell " + (isActiveCell2 ? "active " : "") + (isHi ? "hi " : "") + (isPB ? "pb " : "") + (isWR ? "wr " : "") + "\">" +
                   (val == null ? "–" : "<span class=\"v2CellNum\">" + escapeHtml(String(val)) + "<\/span>") +
                   "<\/div>");
        }
        nextHost.innerHTML = out2.join("");
      }else{
        // Failsafe: always render a visible next-row placeholder to avoid blank bands
        const safeP = Math.max(2, Math.min(6, pCount));
        const out2 = [];
        out2.push('<div class="v2Badge">–</div>');
        for(let i=0;i<safeP;i++) out2.push('<div class="v2Cell">–</div>');
        nextHost.innerHTML = out2.join('');
      }
    }
    */
  }
// >>> PATCH:LIVEV2_POST_RENDER_BINDINGS START
    // Bind swipe + compute viewport heights AFTER DOM paint (Mobile Safari can miss initial bindings if bound too early).
    try{
      requestAnimationFrame(()=>{
        try{ __sqSetupLiveV2RowsWindow(panel); }catch(_){}
        try{ __sqSetupV2InfoPager(panel); }catch(_){}
        try{ __sqEnsureV2NextRowFilled(panel); }catch(_){}
      });
    }catch(_){
      try{ __sqSetupLiveV2RowsWindow(panel); }catch(__){}
      try{ __sqSetupV2InfoPager(panel); }catch(__){}
      try{ __sqEnsureV2NextRowFilled(panel); }catch(__){}
    }
// <<< PATCH:LIVEV2_POST_RENDER_BINDINGS END

  } catch(e) {
    console.warn('[SQ] liveV2 rows/info render failed:', e?.message || e);
    try{
      const rowsHost = document.getElementById("v2Rows");
      if(rowsHost){
        const safeP = Math.max(2, Math.min(6, getLiveV2PlayerCount()));
        const safeCr = Number.isFinite(+state.currentRound) ? +state.currentRound : 0;
        const totalR = (typeof ROUNDS!=="undefined" && Array.isArray(ROUNDS) && ROUNDS.length) ? ROUNDS.length : Math.max(safeCr+1, 1);
        const winStart = Math.max(0, Math.min(totalR-1, safeCr));
        const winEnd = Math.min(totalR-1, winStart + 2);
        const out = [];
        for(let r=winStart; r<=winEnd; r++){
          out.push('<div class="v2Badge '+(r===safeCr?'active':'')+'">'+escapeHtml(roundLabelForIndex(r))+'</div>');
          for(let i=0;i<safeP;i++) out.push('<div class="v2Cell">–</div>');
        }
        rowsHost.innerHTML = out.join('');
      }
      const nextHost = document.getElementById("v2NextRow");
      if(nextHost) nextHost.innerHTML = '';
      const avgHost = document.getElementById("v2Avg");
      if(avgHost) avgHost.innerHTML = '';
      const highHost = document.getElementById("v2High");
      if(highHost) highHost.innerHTML = '';
    }catch(_){}
  }
  // <<< PATCH:LIVEV2_ROWS_GUARD END

  
  // Scroll behavior:
  // - Users may scroll up to review completed rounds.
  // - Any scoring input (dart/total changes) snaps back to the live round at the bottom.
  // - Round advance also snaps to bottom.
  const wrap = panel.querySelector(".v2RowsWrap");
  if(wrap){
    if(!window.__sqLiveV2ResponsiveResizeBound){
      window.__sqLiveV2ResponsiveResizeBound = true;
      window.addEventListener('resize', ()=>{
        setTimeout(()=>{
          try{
            const livePanel = document.getElementById('liveV2Panel');
            const liveWrap = livePanel && livePanel.querySelector('.v2RowsWrap');
            if(!liveWrap) return;
            __sqSetupLiveV2RowsWindow(livePanel);
            liveWrap.scrollTop = liveWrap.scrollHeight;
          }catch(_){ }
        }, 0);
      }, {passive:true});
    }
    // Bind once: track whether the user has scrolled away from bottom.
    if(!wrap.__sqBound){
      wrap.__sqBound = true;
      wrap.addEventListener("scroll", ()=>{
        const slack = 8;
        const atBottom = (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight) < slack;
        window.__liveV2UserScrolled = !atBottom;
      }, {passive:true});
    }

    // Build a signature around the table round, not the temporary catch-up
    // scoring cursor. Starting/continuing catch-up must never drag the viewport
    // backwards; only the orange active edge moves to activeCr.
    const sig = String(tableCr) + "|" + String(turn) + "|" + String(dartN) + "|" + __v2Totals.join(",");
    const hadSig = (typeof window.__liveV2LastSig !== "undefined");
    const changed = hadSig && (sig !== window.__liveV2LastSig);
    window.__liveV2LastSig = sig;

    if(typeof window.__liveV2LastCr === "undefined") window.__liveV2LastCr = -1;

    const roundChanged = (tableCr !== window.__liveV2LastCr);
    if(__sqCatchUpView.active){
      window.__liveV2LastCr = tableCr;
    }else if(roundChanged){
      window.__liveV2LastCr = tableCr;
      wrap.scrollTop = wrap.scrollHeight;
      window.__liveV2UserScrolled = false;
    }else if(changed){
      // Ordinary scoring still snaps to the live table round.
      wrap.scrollTop = wrap.scrollHeight;
      window.__liveV2UserScrolled = false;
    }
  }

  // Averages box (under 3-round viewport)
  const avgHost = document.getElementById("v2Avg");
  if(avgHost){

// A "completed round" for a player is:
    // - any round < currentRound, OR
    // - the current round where they have thrown all 3 darts
    function __v2CompletedRoundsForPlayer(pIdx){
      const list = [];
      for(let r=0; r<=cr; r++){
        const entry = state.score?.[pIdx]?.[r];
        const done = (r < cr) || (entry && entry.darts && entry.darts[2] != null);
        if(done) list.push(r);
      }
      return list;
    }

    const rows = [];

    
    // Helper: ordinal labels
    function __sqOrdinal(n){
      const s = ["th","st","nd","rd"], v = n % 100;
      return n + (s[(v-20)%10] || s[v] || s[0]);
    }

    // Helper: format rank with ordinal
    function __sqFmtOrd(n){ return n ? escapeHtml(__sqOrdinal(n)) : "–"; }

    // Row 1: POS (rank within current game by total score, deterministic tie-breaker by player index)
    rows.push(`<div class="v2AvgLabel v2AvgLabel--one"><div>POS</div></div>`);
    // Build ranks
    const __posPairs = [];
    for(let i=0;i<pCount;i++) __posPairs.push({i, t: Number.isFinite(+(__v2Totals?.[i])) ? +__v2Totals[i] : -Infinity});
    __posPairs.sort((a,b)=> (b.t - a.t) || (a.i - b.i));
    const __rankByIdx = {};
    for(let k=0;k<__posPairs.length;k++) __rankByIdx[__posPairs[k].i] = k + 1;
    for(let i=0;i<pCount;i++){
      const rk = __rankByIdx[i] || 0;
      rows.push(`<div class="v2AvgCell">${__sqFmtOrd(rk)}</div>`);
    }

    // Row 2: rolling 3-round average (last 3 completed rounds for that player)
    rows.push(`<div class="v2AvgLabel"><div>3R</div><div class="sub">AVG</div></div>`);
    for(let i=0; i<pCount; i++){
      const done = __v2CompletedRoundsForPlayer(i);
      const last3 = done.slice(-3);
      let sum = 0; let n = 0;
      last3.forEach((r)=>{
        const v = getPerRoundScore(r, i);
        if(Number.isFinite(+v)) { sum += +v; n++; }
      });
      rows.push(`<div class="v2AvgCell">${escapeHtml(__sqFmtAvg(n ? (sum / n) : NaN))}</div>`);
    }

    // Row 3: Match average (all completed rounds so far for that player)
    rows.push(`<div class="v2AvgLabel"><div>MTC</div><div class="sub">AVG</div></div>`);
    for(let i=0; i<pCount; i++){
      const done = __v2CompletedRoundsForPlayer(i);
      let sum = 0; let n = 0;
      done.forEach((r)=>{
        const v = getPerRoundScore(r, i);
        if(Number.isFinite(+v)) { sum += +v; n++; }
      });
      rows.push(`<div class="v2AvgCell">${escapeHtml(__sqFmtAvg(n ? (sum / n) : NaN))}</div>`);
    }

    // Row 4: P RANK (current total vs THIS player's historical game totals, descending, dense_rank)
    rows.push(`<div class="v2AvgLabel"><div>P</div><div class="sub">RANK</div></div>`);
    for(let i=0; i<pCount; i++){
      rows.push(`<div class="v2AvgCell"><span class="v2RankVal" data-rank="p" data-idx="${i}">—</span></div>`);
    }

    // Row 5: G RANK (current total vs ALL players historical game totals, descending, dense_rank)
    rows.push(`<div class="v2AvgLabel"><div>G</div><div class="sub">RANK</div></div>`);
    for(let i=0; i<pCount; i++){
      rows.push(`<div class="v2AvgCell"><span class="v2RankVal" data-rank="g" data-idx="${i}">—</span></div>`);
    }

    avgHost.innerHTML = rows.join("");

    // @RANKING:FAIL_CLOSED_LIVEV2
    // P/G Rank must come from sq_rank_score only. Browser dense-rank fallback is disabled because
    // player-game windows can be partial and must not become production rank truth.
    (function __sqUpdateRanks(){
      try{
        const players = (state && Array.isArray(state.players)) ? state.players : [];
        if (!players.length) return;
        const totals = Array.isArray(__v2Totals) ? __v2Totals.slice(0) : [];
        function __failClosed(e){
          try{
            avgHost.querySelectorAll('.v2RankVal[data-rank="p"],.v2RankVal[data-rank="g"]').forEach((el)=>{
              el.textContent = '—';
              el.title = 'Rank unavailable — database rank source missing';
            });
            if (e) try{ console.warn('[SQ] LiveV2 P/G Rank unavailable; sq_rank_score failed closed', e && (e.message||e)); }catch(_){}
          }catch(_){}
        }
        const rankClient = (typeof sb !== 'undefined' && sb) ? sb : (window.sb || null);
        if (!rankClient || typeof rankClient.rpc !== 'function') { __failClosed(new Error('sq_rank_score RPC unavailable')); return; }

        const timeoutMs = 3500;
        const withTimeout = (promise) => Promise.race([
          promise,
          new Promise((_, reject)=>setTimeout(()=>reject(new Error('sq_rank_score timeout')), timeoutMs))
        ]);

        Promise.all(players.map((p, i)=>{
          const nm = p && (p.name || p.player || p.n || p.label) ? (p.name || p.player || p.n || p.label) : '';
          const total = Number(totals[i]);
          return withTimeout(rankClient.rpc('sq_rank_score', { p_player: String(nm||''), p_score: Number.isFinite(total)? Math.round(total) : null }))
            .then(({data, error})=>{
              if (error) throw error;
              const row = Array.isArray(data) ? data[0] : data;
              return { i, p_rank: row && row.p_rank, g_rank: row && row.g_rank };
            });
        })).then((arr)=>{
          try{
            arr.forEach((r)=>{
              const pEl = avgHost.querySelector(`.v2RankVal[data-rank="p"][data-idx="${r.i}"]`);
              const gEl = avgHost.querySelector(`.v2RankVal[data-rank="g"][data-idx="${r.i}"]`);
              if (pEl){ pEl.textContent = r.p_rank ? __sqOrdinal(Number(r.p_rank)) : '—'; pEl.title = ''; }
              if (gEl){ gEl.textContent = r.g_rank ? String(r.g_rank) : '—'; gEl.title = ''; }
            });
          }catch(_){}
        }).catch(__failClosed);
      }catch(_){}
    })();

  }

  // B3c Game Streak host
  const highHost = document.getElementById("v2High");

  // >>> PATCH:B3C_MOMENTUM_LANE_JS_V1 START
  if (highHost){
    try{
      const __heatCache = window.__sqV2MomentumCache || (window.__sqV2MomentumCache = {});
      const __roundMax = function(rIdx){
        try{
          const rd = ROUNDS?.[rIdx];
          if (!rd) return 180;
          if (rd.type === 'number') return Math.max(1, Number(rd.target || 0) * 9);
          if (rd.type === 'doubles') return 120;
          if (rd.type === 'triples') return 180;
          if (rd.type === 'bull') return 150;
        }catch(_){ }
        return 180;
      };

      const __entryFor = function(pIdx, rIdx){
        try{ return state?.score?.[pIdx]?.[rIdx] || null; }catch(_){ return null; }
      };

      const __dartsFor = function(pIdx, rIdx){
        const entry = __entryFor(pIdx, rIdx);
        return (entry && Array.isArray(entry.darts)) ? entry.darts.filter(Boolean) : [];
      };

      const __isRoundComplete = function(pIdx, rIdx){
        try{
          if (rIdx < cr) return true;
          const entry = __entryFor(pIdx, rIdx);
          const darts = (entry && Array.isArray(entry.darts)) ? entry.darts.filter(Boolean) : [];
          return darts.length >= 3;
        }catch(_){
          return false;
        }
      };

      const __safeRoundTotal = function(pIdx, rIdx){
        try{
          const entry = __entryFor(pIdx, rIdx);
          if (entry && Number.isFinite(+entry.roundTotal)) return +entry.roundTotal;
        }catch(_){ }
        const v = getPerRoundScore(rIdx, pIdx);
        return Number.isFinite(+v) ? +v : 0;
      };

      const __metricForRound = function(pIdx, rIdx, provisional){
        const roundMax = __roundMax(rIdx);
        const entry = __entryFor(pIdx, rIdx) || {};
        const darts = (__dartsFor(pIdx, rIdx) || []);
        const score = Math.max(0, provisional ? darts.reduce((s, d)=> s + (Number(d && d.points) || 0), 0) : __safeRoundTotal(pIdx, rIdx));
        const scoringDarts = darts.reduce((n, d)=> n + (((Number(d && d.points) || 0) > 0) ? 1 : 0), 0);
        const rd = (ROUNDS && ROUNDS[rIdx]) ? ROUNDS[rIdx] : null;

        let visitQuality = Math.max(0, Math.min(1, score / Math.max(1, roundMax)));
        const contactQuality = Math.max(0, Math.min(1, scoringDarts / 3));
        let rawForm = (visitQuality * 0.60) + (contactQuality * 0.40);

        if (rd && rd.type === 'doubles'){
          const avgHitValue = scoringDarts > 0 ? (score / scoringDarts) : 0;   // 0..40
          const valueQuality = Math.max(0, Math.min(1, avgHitValue / 40));
          visitQuality = (contactQuality * 0.80) + (valueQuality * 0.20);
          rawForm = (visitQuality * 0.36) + (contactQuality * 0.64);
          if (scoringDarts >= 2) rawForm = Math.max(rawForm, 0.66 + ((scoringDarts - 2) * 0.12) + (valueQuality * 0.06));
        } else if (rd && rd.type === 'triples'){
          const avgHitValue = scoringDarts > 0 ? (score / scoringDarts) : 0;   // 0..60
          const valueQuality = Math.max(0, Math.min(1, avgHitValue / 60));
          visitQuality = (contactQuality * 0.76) + (valueQuality * 0.24);
          rawForm = (visitQuality * 0.40) + (contactQuality * 0.60);
          if (scoringDarts >= 2) rawForm = Math.max(rawForm, 0.62 + ((scoringDarts - 2) * 0.12) + (valueQuality * 0.08));
        }

        return {
          roundIdx: rIdx,
          score,
          roundMax,
          scoringDarts,
          visitQuality,
          contactQuality,
          rawForm,
          scratch: score <= 0,
          provisional: !!provisional,
          started: darts.length > 0 || score > 0,
          complete: !!__isRoundComplete(pIdx, rIdx)
        };
      };

      const __applyMomentumModel = function(metrics){
        let momentum = 0.22;
        let goodStreak = 0;
        let poorStreak = 0;
        const adjustedHistory = [];
        const recentAvgHistory = [];
        let latestDelta = 0;
        let latestAdjusted = 0;

        metrics.forEach((m)=>{
          const baseline = adjustedHistory.length
            ? adjustedHistory.slice(-3).reduce((a,b)=> a+b, 0) / Math.min(3, adjustedHistory.length)
            : 0.32;

          if (m.scratch){
            goodStreak = 0;
            poorStreak += 1;
          } else if (m.rawForm >= 0.29){
            goodStreak += 1;
            poorStreak = 0;
          } else if (m.rawForm < 0.08){
            goodStreak = 0;
            poorStreak += 1;
          } else {
            goodStreak = 0;
            poorStreak = 0;
          }

          let streakMod = 0;
          if (goodStreak >= 4) streakMod += 0.10;
          else if (goodStreak === 3) streakMod += 0.08;
          else if (goodStreak === 2) streakMod += 0.04;
          if (poorStreak >= 2) streakMod -= 0.04;
          if (m.scratch) streakMod -= 0.05;

          const adjusted = Math.max(0, Math.min(1, m.rawForm + streakMod));
          let candidate = (momentum * 0.66) + (adjusted * 0.34);
          candidate = Math.max(momentum - 0.10, Math.min(momentum + 0.22, candidate));
          momentum = Math.max(0, Math.min(1, candidate));

          adjustedHistory.push(adjusted);
          recentAvgHistory.push(baseline);
          latestDelta = adjusted - baseline;
          latestAdjusted = adjusted;
        });

        const recentAvg = recentAvgHistory.length ? recentAvgHistory[recentAvgHistory.length - 1] : 0.32;
        return {
          momentum: Math.round(momentum * 1000) / 10,
          adjustedHistory,
          recentAvg,
          latestAdjusted,
          delta: latestDelta
        };
      };

      const __stateLabel = function(v){
        if (v >= 80) return 'PEAK';
        if (v >= 60) return 'HOT';
        if (v >= 40) return 'ACTIVE';
        if (v >= 20) return 'BUILD';
        return 'EMBER';
      };

      const __pulseMeta = function(momentum, delta, adjusted){
        const m = Math.max(0, Math.min(100, momentum || 0));
        const q = Math.max(0, Math.min(1, adjusted || 0));
        const d = Math.abs(delta || 0);

        const bigMove = (q >= 0.68) || (d >= 0.040);

        let pulseA = 2.35 - (q * 1.10) - ((m / 100) * 0.20);
        let sweepA = 2.45 - (q * 1.00);
        let sweepOpacity = (q < 0.28 && d < 0.02) ? 0 : Math.max(0.18, Math.min(0.96, 0.10 + (q * 1.05)));
        let sweepScale = 1.00 + (q * 0.26);
        let pulseBoost = 0.03 + (q * 0.24);
        let pulseLift = 0.010 + (q * 0.080);

        pulseA = Math.max(0.92, pulseA);
        sweepA = Math.max(0.98, sweepA);

        if (bigMove){
          pulseA = Math.max(0.82, pulseA * 0.74);
          pulseBoost += 0.18;
          pulseLift += 0.070;
          sweepOpacity = Math.min(1.0, sweepOpacity + 0.12);
          sweepScale += 0.10;
        }

        const arrowA = sweepA;
        const arrowOpacity = sweepOpacity;
        const arrowSize = Math.round(22 + (q * 14));

        return { pulseA, sweepA, sweepOpacity, sweepScale, pulseBoost, pulseLift, arrowA, arrowOpacity, arrowSize, bigMove };
      };

      const __playerHeat = [];
      for (let i = 0; i < pCount; i++){
        const metrics = [];
        for (let r = 0; r < cr; r++){
          metrics.push(__metricForRound(i, r, false));
        }
        if (__isRoundComplete(i, cr)){
          metrics.push(__metricForRound(i, cr, false));
        }

        const model = __applyMomentumModel(metrics);
        const prevMomentum = ((__heatCache[i] && Number.isFinite(+__heatCache[i].momentum)) ? +__heatCache[i].momentum : model.momentum);
        __playerHeat.push({
          idx: i,
          init: escapeHtml(getPlayerInitial(i)),
          momentum: model.momentum,
          label: __stateLabel(model.momentum),
          rising: model.delta > 0.04,
          falling: model.delta < -0.04,
          active: i === turn,
          prevMomentum,
          delta: model.delta,
          adjusted: model.latestAdjusted || 0,
          recentAvg: model.recentAvg || 0
        });
      }

      const ordered = __playerHeat.slice().sort((a,b)=> a.idx - b.idx);

      if (!highHost.querySelector('.sqMomentumBoard')){
        highHost.innerHTML = '<div class="sqMomentumBoard">' + ordered.map((row)=>{
          const pm = __pulseMeta(row.prevMomentum, row.delta, row.adjusted);
          const cls = [
            'sqMomentumRow',
            row.active ? 'is-active' : '',
            row.label === 'BUILD' ? 'is-warm' : '',
            row.label === 'ACTIVE' || row.label === 'HOT' ? 'is-hot' : '',
            row.label === 'PEAK' ? 'is-peak' : '',
            row.rising ? 'is-rising' : '',
            row.falling ? 'is-falling' : '',
            pm.bigMove && row.rising ? 'is-surge-up' : '',
            pm.bigMove && row.falling ? 'is-surge-down' : ''
          ].filter(Boolean).join(' ');
          return '' +
            '<div class="' + cls + '" data-player-idx="' + row.idx + '" style="--sqLanePct:' + row.prevMomentum.toFixed(1) + '%;--sqPulseA:' + pm.pulseA.toFixed(2) + 's;--sqSweepA:' + pm.sweepA.toFixed(2) + 's;--sqSweepOpacity:' + pm.sweepOpacity.toFixed(2) + ';--sqSweepScale:' + pm.sweepScale.toFixed(2) + ';--sqArrowA:' + pm.arrowA.toFixed(2) + 's;--sqArrowOpacity:' + pm.arrowOpacity.toFixed(3) + ';--sqArrowSize:' + pm.arrowSize + 'px;">' +
              '<div class="sqMomentumInit">' + row.init + '</div>' +
              '<div class="sqMomentumTrack" aria-label="' + row.init + ' momentum ' + row.label + '">' +
                '<div class="sqMomentumGlow"></div>' +
                '<div class="sqMomentumFill"></div>' +
                '<div class="sqMomentumEdge"></div>' +
                '<div class="sqMomentumSurge" aria-hidden="true"></div>' +
              '</div>' +
              '<div class="sqMomentumMeta"></div>' +
            '</div>';
        }).join('') + '</div>';
      }

      requestAnimationFrame(()=>{
        try{
          ordered.forEach((row)=>{
            const el = highHost.querySelector('.sqMomentumRow[data-player-idx="' + row.idx + '"]');
            if (!el) return;
            const pm = __pulseMeta(row.momentum, row.delta, row.adjusted);
            el.classList.toggle('is-active', !!row.active);
            el.classList.toggle('is-warm', row.label === 'BUILD');
            el.classList.toggle('is-hot', row.label === 'ACTIVE' || row.label === 'HOT');
            el.classList.toggle('is-peak', row.label === 'PEAK');
            el.classList.toggle('is-rising', !!row.rising);
            el.classList.toggle('is-falling', !!row.falling);
            const surgeUp = !!(pm.bigMove && (row.rising || row.adjusted >= 0.74));
            const surgeDown = !!((!surgeUp) && pm.bigMove && row.falling);
            el.classList.toggle('is-surge-up', surgeUp);
            el.classList.toggle('is-surge-down', surgeDown);
            if (surgeUp || surgeDown){
              clearTimeout(el.__sqSurgeTimer);
              el.classList.add('sq-surge-fire');
              el.__sqSurgeTimer = setTimeout(()=>{
                try{ el.classList.remove('sq-surge-fire'); }catch(_){}
              }, 900);
            }
            el.style.setProperty('--sqLanePct', row.momentum.toFixed(1) + '%');
            el.style.setProperty('--sqPulseA', pm.pulseA.toFixed(2) + 's');
            el.style.setProperty('--sqSweepA', pm.sweepA.toFixed(2) + 's');
            el.style.setProperty('--sqSweepOpacity', pm.sweepOpacity.toFixed(2));
            el.style.setProperty('--sqSweepScale', pm.sweepScale.toFixed(2));
            el.style.setProperty('--sqPulseBoost', pm.pulseBoost.toFixed(3));
            el.style.setProperty('--sqPulseLift', pm.pulseLift.toFixed(3));
            el.style.setProperty('--sqArrowA', pm.arrowA.toFixed(2) + 's');
            el.style.setProperty('--sqArrowOpacity', pm.arrowOpacity.toFixed(3));
            el.style.setProperty('--sqArrowSize', pm.arrowSize + 'px');
            const fill = el.querySelector('.sqMomentumFill');
            const glow = el.querySelector('.sqMomentumGlow');
            if (fill) fill.style.width = row.momentum.toFixed(1) + '%';
            if (glow) glow.style.width = row.momentum.toFixed(1) + '%';
            if (row.active){
              try{
                const activeCell = document.getElementById('cell-' + row.idx + '-' + cr);
                if (activeCell){
                  activeCell.style.setProperty('--sqCellPulseA', pm.pulseA.toFixed(2) + 's');
                  activeCell.style.setProperty('--sqCellPulseBoost', pm.pulseBoost.toFixed(3));
                  activeCell.style.setProperty('--sqCellPulseGlow', Math.min(.56, .14 + (row.momentum / 100) * .34).toFixed(3));
                }
              }catch(__){}
            }
          });
        }catch(_){ }
      });

      ordered.forEach((row)=>{
        __heatCache[row.idx] = { momentum: row.momentum, label: row.label, ts: Date.now() };
      });
    }catch(_){
      try{ highHost.innerHTML = ''; }catch(__){}
    }
  }
  // <<< PATCH:B3C_MOMENTUM_LANE_JS_V1 END

}
// <<< PATCH:livev2-panel-js END

/*****************
 * UI UPDATE
 *****************/
// @CANONICAL:THROWPAD_BASE_RENDER
function buildPad(){ 
  if (!pad) return; 
  pad.innerHTML = ''; 

  const page = document.body.getAttribute('data-page');

  // Leaderboard: no throw pad content
  if (page === 'leaderboard') {
    padHint.textContent = '';
    return;
  }

  // Other non-game pages: no pad
  if (page !== 'game') {
    padHint.textContent = '';
    return;
  }

  // Game page
  padHint.textContent = state.finished ? 'Game finished.' : '';

  // SC-030: one verified Undo/DMD path for all Live V2 pad layouts.
  // Scoring/state restoration stays owned by undo(); this helper only decides
  // whether a presentation event is truthful after that state transition.
  function __sqRunUndoActionWithDmd(){
    const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') && __sqIsVsShadowRuntime();

    // Preserve the existing Vs Shadow presentation path exactly. Its undo
    // helper has mode-specific block/restore messages which must not be
    // overwritten by the generic DMD V2 event.
    if (isVsShadow){
      try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }
      try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }
      undo();
      return;
    }

    const before = Array.isArray(state?.history) ? state.history.length : 0;
    if (before <= 0){
      undo();
      return;
    }

    undo();

    const after = Array.isArray(state?.history) ? state.history.length : before;
    if (after >= before) return;

    // Re-establish the truthful persistent DMD baseline from restored game state
    // before the transient Undo message takes ownership of presentation.
    try{
      const rIdx = Number(state?.currentRound || 0);
      const pIdx = Number(state?.currentPlayer || 0);
      const rd = (typeof ROUNDS !== 'undefined' && Array.isArray(ROUNDS)) ? ROUNDS[rIdx] : null;
      let z1 = String(rIdx + 1);
      if (rd?.type === 'number') z1 = String(rd.target);
      else if (rd?.type === 'doubles') z1 = 'DBL';
      else if (rd?.type === 'triples') z1 = 'TRB';
      else if (rd?.type === 'bull') z1 = 'BULL';
      const darts = Array.isArray(state?.score?.[pIdx]?.[rIdx]?.darts)
        ? state.score[pIdx][rIdx].darts.slice(0, Number(state?.currentDart || 0)).filter(Boolean)
        : [];
      const z3 = darts.map(d => {
        try{ return (typeof __sqV2DartToken === 'function') ? __sqV2DartToken(d, rIdx) : String(d?.kind || ''); }catch(_){ return String(d?.kind || ''); }
      }).filter(Boolean).join(' / ');
      const z2 = (typeof getPlayerName === 'function') ? String(getPlayerName(pIdx) || '') : '';
      window.sqDmdShowZones?.({ z1, z2, z3 }, { type:'hold', ms:1, z3Small:true });
    }catch(_){ }

    try{
      if (window.__sqDmdV2 && typeof window.__sqDmdV2.emit === 'function'){
        window.__sqDmdV2.emit({ kind:'UNDO' });
      } else {
        window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120});
      }
    }catch(_){ }
  }

  // SC-030 responsiveness: gameplay state changes immediately; DMD feedback is
  // presentation-only and must never hold input hostage. Vs Shadow keeps its
  // existing specialised timing until that mode has dedicated cloud-backed QA.
  function __sqRunSkipActionWithDmd(){
    const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') && __sqIsVsShadowRuntime();
    if (isVsShadow){
      try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }
      try{ window.__sqSkipInProgress = true; }catch(_){ }
      try{ window.sqDmdShowZones?.({ z2:'SKIP GO', z3:'>>>' }, { type:'flash', ms:500, fx:'impact' }); }catch(_){ }
      setTimeout(() => {
        try{ missGo(); }catch(_){ }
        setTimeout(() => { try{ window.__sqSkipInProgress = false; }catch(_){ } }, 120);
      }, 500);
      return;
    }

    const before = {
      history: Array.isArray(state?.history) ? state.history.length : 0,
      player: Number(state?.currentPlayer || 0),
      round: Number(state?.currentRound || 0),
      dart: Number(state?.currentDart || 0),
      finished: !!state?.finished
    };

    try{ window.__sqSkipInProgress = true; }catch(_){ }
    try{
      const absenceHandled = (typeof __sqSkipAbsentVisit === 'function') ? (__sqSkipAbsentVisit() === true) : false;
      if (!absenceHandled) missGo();
    }catch(_){ }
    finally { try{ window.__sqSkipInProgress = false; }catch(_){ } }

    const afterHistory = Array.isArray(state?.history) ? state.history.length : before.history;
    const changed = afterHistory > before.history ||
      Number(state?.currentPlayer || 0) !== before.player ||
      Number(state?.currentRound || 0) !== before.round ||
      Number(state?.currentDart || 0) !== before.dart ||
      !!state?.finished !== before.finished;
    if (!changed) return;

    let nextName = '';
    try{
      if (!state.finished && typeof getPlayerName === 'function') nextName = String(getPlayerName(Number(state.currentPlayer || 0)) || '');
    }catch(_){ }

    try{
      if (window.__sqDmdV2 && typeof window.__sqDmdV2.emit === 'function'){
        window.__sqDmdV2.emit({ kind:'SKIP', player:nextName });
      } else {
        window.sqDmdShowZones?.({ z2:'TURN SKIPPED', z3:(nextName ? (nextName + ' UP') : '') }, { type:'hold', ms:500 });
      }
    }catch(_){ }
  }

  if (!state.finished) {
    const r = ROUNDS[state.currentRound];
    if (!r) return;

    // @CANONICAL:THROWPAD HELPERS (shared across number / doubles / triples / bull)
    function __sqMissCountForCurrentThrow(){
      try{
        const dart = (typeof state !== 'undefined' && state && typeof state.currentDart === 'number') ? state.currentDart : 0;
        const remaining = 3 - dart;
        return Math.max(1, Math.min(3, remaining));
      }catch(_){
        return 3;
      }
    }

    function __sqSetMissXLabel(btn){
      try{
        const n = __sqMissCountForCurrentThrow();
        btn.textContent = `MISS\nx${n}`;
        btn.dataset.missN = String(n);
      }catch(_){}
    }

    // @CANONICAL:THROWPAD MISS / xN handler
    async function pressMissN(n){
      const __prevBulk = !!window.__sqDmdBulkMiss;
      const dart =
        (typeof state !== 'undefined' && state && typeof state.currentDart === 'number') ? state.currentDart :
        (typeof state !== 'undefined' && state && typeof state.currentDartIndex === 'number') ? state.currentDartIndex :
        (typeof state !== 'undefined' && state && typeof state.dartIndex === 'number') ? state.dartIndex : 0;

      const specialMissSeq = (dart >= 0 && dart <= 2 && n >= 1);
      const seqSlots = [' ', ' ', ' '];

      try{
        const rIdx = Number(state?.currentRound || 0);
        const pIdx = Number(state?.currentPlayer || 0);
        const entry = state?.score?.[pIdx]?.[rIdx];
        const darts = Array.isArray(entry?.darts) ? entry.darts.slice(0, dart).filter(Boolean) : [];
        const tokenFor = (d)=>{
          const k = String(d?.kind || d?.type || '').trim();
          const pts = Number(d?.points ?? d?.pts ?? d?.score ?? 0);
          if (/^Miss$/i.test(k) || pts === 0) return 'X';
          if (/^B$/i.test(k) || d?.bull) return 'B';

          const rd = (typeof state !== 'undefined' && state && Array.isArray(state.rounds) && state.rounds[rIdx])
            ? state.rounds[rIdx]
            : (typeof ROUNDS !== 'undefined' ? ROUNDS[rIdx] : null);

          if (rd && rd.type === 'number') {
            const rn = Number(rd.target || 0);
            if (rn > 0) {
              if (pts === rn * 3) return 'T';
              if (pts === rn * 2) return 'D';
              if (pts === rn) return 'S';
            }
          }
          if (rd && rd.type === 'doubles') return 'D';
          if (rd && rd.type === 'triples') return 'T';
          if (rd && rd.type === 'bull') return 'B';

          if (/^(Triple|T)$/i.test(k)) return 'T';
          if (/^(Double|D)$/i.test(k)) return 'D';
          if (/^(Single|S)$/i.test(k)) return 'S';
          return (k || ' ').slice(0,1).toUpperCase();
        };
        for (let i=0; i<Math.min(3, darts.length); i++) seqSlots[i] = tokenFor(darts[i]);
      }catch(_){}

      if (n >= 2 || specialMissSeq) window.__sqDmdBulkMiss = true;

      let myToken = Number(window.__sqDmdFlowToken || 0);
      if (specialMissSeq){
        try{ window.__sqSuppressMissCallouts = true; }catch(_){}
        const base = seqSlots.slice();
        const label = n > 1 ? `MISS x${n}` : 'MISS';

        for (let i=0; i<n; i++){
          if (Number(window.__sqDmdFlowToken || 0) !== myToken) return;
          const idx = Math.min(2, dart + i);
          base[idx] = 'X';
          try{
            const z3 = `${base[0]} / ${base[1]} / ${base[2]}`;
            window.sqDmdShowZones?.({ z2: label, z3, z3Small:true }, { type:'flash', ms:260, fx:'impact' });
          }catch(_){}
          await new Promise(r=>setTimeout(r,280));
        }
      }

      for (let i=0;i<n;i++){
        if (specialMissSeq && Number(window.__sqDmdFlowToken || 0) !== myToken) return;
        recordThrow({ kind:'Miss' });
        if (!specialMissSeq){
          await new Promise(r=>setTimeout(r,70));
        }
      }

      if (specialMissSeq){
        setTimeout(()=>{ try{ window.__sqSuppressMissCallouts = false; }catch(_){} }, 120);
      }
      window.__sqDmdBulkMiss = __prevBulk;
    }

    function __sqBindMissXButton(btn){
      __sqSetMissXLabel(btn);
      btn.onclick = ()=>{ try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } const n = __sqMissCountForCurrentThrow(); pressMissN(n); };
    }

    // ----- NUMBER ROUNDS (10–20) -----
    if (r.type === 'number') {
      // Match D/T/B pad design + colours (grid layout + action buttons)
      const dtWrap = document.createElement('div');
      dtWrap.className = 'dtPadWrap';
      dtWrap.style.width = '100%';
      dtWrap.style.boxSizing = 'border-box';

      // @CANONICAL:THROWPAD
      // Left: MISS xN control
      const x3 = document.createElement('button');
      x3.className = 'dtX3';
      x3.type = 'button';

      
      // @CANONICAL:THROWPAD HELPERS
      function __sqMissCountForCurrentThrow(){
        try{
          const dart = (typeof state !== 'undefined' && state && typeof state.currentDart === 'number') ? state.currentDart : 0;
          const remaining = 3 - dart;
          return Math.max(1, Math.min(3, remaining));
        }catch(_){
          return 3;
        }
      }

      function __sqSetMissXLabel(btn){
        try{
          const n = __sqMissCountForCurrentThrow();
          btn.textContent = `MISS\nx${n}`;
          btn.dataset.missN = String(n);
        }catch(_){}
      }

      // @CANONICAL:THROWPAD MISS / xN handler
      // LOCKED working path — do not reintroduce older miss/x3 branches.
      async function pressMissN(n){
        const __prevBulk = !!window.__sqDmdBulkMiss;
        const dart =
          (typeof state !== 'undefined' && state && typeof state.currentDart === 'number') ? state.currentDart :
          (typeof state !== 'undefined' && state && typeof state.currentDartIndex === 'number') ? state.currentDartIndex :
          (typeof state !== 'undefined' && state && typeof state.dartIndex === 'number') ? state.dartIndex : 0;

        const specialMissSeq = (dart >= 0 && dart <= 2 && n >= 1);
        const seqSlots = [' ', ' ', ' '];

        try{
          const rIdx = Number(state?.currentRound || 0);
          const pIdx = Number(state?.currentPlayer || 0);
          const entry = state?.score?.[pIdx]?.[rIdx];
          const darts = Array.isArray(entry?.darts) ? entry.darts.slice(0, dart).filter(Boolean) : [];
          const tokenFor = (d)=>{
            const k = String(d?.kind || d?.type || '').trim();
            const pts = Number(d?.points ?? d?.pts ?? d?.score ?? 0);
            if (/^Miss$/i.test(k) || pts === 0) return 'X';
            if (/^B$/i.test(k) || d?.bull) return 'B';

            const rd = (typeof state !== 'undefined' && state && Array.isArray(state.rounds) && state.rounds[rIdx])
              ? state.rounds[rIdx]
              : (typeof ROUNDS !== 'undefined' ? ROUNDS[rIdx] : null);

            if (rd && rd.type === 'number') {
              const n = Number(rd.target || 0);
              if (n > 0) {
                if (pts === n * 3) return 'T';
                if (pts === n * 2) return 'D';
                if (pts === n) return 'S';
              }
            }
            if (rd && rd.type === 'doubles') return 'D';
            if (rd && rd.type === 'triples') return 'T';
            if (rd && rd.type === 'bull') return 'B';

            if (/^(Triple|T)$/i.test(k)) return 'T';
            if (/^(Double|D)$/i.test(k)) return 'D';
            if (/^(Single|S)$/i.test(k)) return 'S';
            return (k || ' ').slice(0,1).toUpperCase();
          };
          for (let i=0; i<Math.min(3, darts.length); i++) seqSlots[i] = tokenFor(darts[i]);
        }catch(_){}

        if (n >= 2 || specialMissSeq) window.__sqDmdBulkMiss = true;

        // Queue is already cleared by the button bindings before we enter here.
        let myToken = Number(window.__sqDmdFlowToken || 0);
        if (specialMissSeq){
          try{ window.__sqSuppressMissCallouts = true; }catch(_){}
          const base = seqSlots.slice();
          const label = n > 1 ? `MISS x${n}` : 'MISS';

          for (let i=0; i<n; i++){
            if (Number(window.__sqDmdFlowToken || 0) !== myToken) return;
            const idx = Math.min(2, dart + i);
            base[idx] = 'X';
            try{
              const z3 = `${base[0]} / ${base[1]} / ${base[2]}`;
              window.sqDmdShowZones?.({ z2: label, z3, z3Small:true }, { type:'flash', ms:260, fx:'impact' });
            }catch(_){}
            await new Promise(r=>setTimeout(r,280));
          }
        }

        for (let i=0;i<n;i++){
          if (specialMissSeq && Number(window.__sqDmdFlowToken || 0) !== myToken) return;
          recordThrow({ kind:'Miss' });
          if (!specialMissSeq){
            await new Promise(r=>setTimeout(r,70));
          }
        }

        if (specialMissSeq){
          setTimeout(()=>{ try{ window.__sqSuppressMissCallouts = false; }catch(_){} }, 120);
        }
        window.__sqDmdBulkMiss = __prevBulk;
      }

      function __sqBindMissXButton(btn){
        __sqSetMissXLabel(btn);
        btn.onclick = ()=>{ try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } const n = __sqMissCountForCurrentThrow(); pressMissN(n); };
      }
      __sqBindMissXButton(x3);

      // Right: S/D/T + actions
      const right = document.createElement('div');
      right.className = 'dtRight';

      const sdtRow = document.createElement('div');
      sdtRow.className = 'dtBullRow dtScoreRow';
      ['S','D','T'].forEach(k=>{
        const b = document.createElement('button');
        b.className = 'dtBullBtn';
        b.type = 'button';
        b.textContent = k;
        b.dataset.scoreLabel = { S:'Single', D:'Double', T:'Treble' }[k];
        b.setAttribute('aria-label', b.dataset.scoreLabel);
        b.onclick = ()=>{ try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ kind: k }); };
        sdtRow.appendChild(b);
      });

      const actions = document.createElement('div');
      actions.className = 'dtActions';

      const mkAct = (cls, icon, label, onClick) => {
        const b = document.createElement('button');
        b.className = `dtActBtn ${cls}`;
        b.type = 'button';
        b.innerHTML = `<div class="dtIcon">${icon}</div><div class="dtLbl">${label}</div>`;
        b.onclick = onClick;
        return b;
      };

      actions.appendChild(mkAct('miss', '⊘', 'MISS', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ pressMissN(1); }catch(_){ try{ __sqHandleMissTap(); }catch(_){ } } }));
      actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { __sqRunUndoActionWithDmd(); }));
      actions.appendChild(mkAct('skip', '▶▶', 'SKIP', () => { __sqRunSkipActionWithDmd(); }));

      right.appendChild(sdtRow);
      right.appendChild(actions);

      dtWrap.appendChild(x3);
      dtWrap.appendChild(right);
      pad.appendChild(dtWrap);

      // keep xN label in sync with current dart
      try{
        if (window.__sqNumPadX3Obs && typeof window.__sqNumPadX3Obs.disconnect === 'function') {
          window.__sqNumPadX3Obs.disconnect();
        }
        window.__sqNumPadX3Obs = null;
      }catch(_){}

      return;
    }
            // ===== @JS:UI:GAMEPLAY:THROWPAD =====
// ----- DOUBLES / TRIPLES ROUNDS -----
    if (r.type === 'doubles' || r.type === 'triples') {
      padHint.textContent = "";

      const dtWrap = document.createElement('div');
      dtWrap.className = 'dtPadWrap';
      dtWrap.style.width = '100%';
      dtWrap.style.boxSizing = 'border-box';
      dtWrap.style.display = 'grid';
      dtWrap.style.gridTemplateColumns = 'clamp(96px, 18vw, 132px) minmax(0,1fr)';
      dtWrap.style.gap = '8px';
      dtWrap.style.alignItems = 'stretch';
      dtWrap.style.justifyItems = 'stretch';

      // Force D/T pad to use the full width of the scorepad (mirror number-round flex rows)
      try{
        const w = pad && pad.getBoundingClientRect ? pad.getBoundingClientRect().width : 0;
        if (w && Number.isFinite(w)) {
          dtWrap.style.width = w + 'px';
          dtWrap.style.maxWidth = 'none';
          dtWrap.style.marginLeft = '0';
          dtWrap.style.marginRight = '0';
          dtWrap.style.alignSelf = 'stretch';
          dtWrap.style.justifySelf = 'stretch';
        }
      }catch(_){}

      const x3 = document.createElement('button');
      x3.className = 'dtX3';
      x3.type = 'button';

      __sqBindMissXButton(x3);

      const right = document.createElement('div');
      right.className = 'dtRight';
      right.style.width = '100%';

      const scroller = document.createElement('div');
      scroller.className = 'dtScroller';
      scroller.style.width = '100%';
      scroller.style.display = 'flex';
      scroller.style.gap = '8px';
      scroller.style.overflowX = 'auto';
      scroller.style.overflowY = 'hidden';
      scroller.style.WebkitOverflowScrolling = 'touch';
      scroller.style.scrollSnapType = 'x mandatory';
      scroller.style.paddingBottom = '2px';

      for (let s = 1; s <= 20; s++) {
        const b = document.createElement('button');
        b.className = 'dtNumBtn';
        b.textContent = String(s);
        // 6 visible at once (account for 5 gaps of 8px)
        b.style.flex = '0 0 calc((100% - 40px) / 6)';
        b.style.scrollSnapAlign = 'start';
        b.onclick = () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ sector: s }); };
        scroller.appendChild(b);
      }

      const actions = document.createElement('div');
      actions.className = 'dtActions';
      actions.style.width = '100%';

      const mkAct = (cls, icon, label, onClick) => {
        const b = document.createElement('button');
        b.className = `dtActBtn ${cls}`;
        b.type = 'button';
        b.innerHTML = `<div class="dtIcon">${icon}</div><div class="dtLbl">${label}</div>`;
        b.onclick = onClick;
        return b;
      };

      actions.appendChild(mkAct('miss', '⊘', 'MISS', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ pressMissN(1); }catch(_){ try{ __sqHandleMissTap(); }catch(_){ } } }));
      actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { __sqRunUndoActionWithDmd(); }));
      actions.appendChild(mkAct('skip', '▶▶', 'SKIP', () => { __sqRunSkipActionWithDmd(); }));

      right.appendChild(scroller);
      right.appendChild(actions);

      dtWrap.appendChild(x3);
      dtWrap.appendChild(right);
      pad.appendChild(dtWrap);

      // Keep x3 label in sync as darts progress
      try { window.__sqUIMutationBus?.on(()=>__sqSetMissXLabel(x3)); } catch(_) {}
      return;
    }

// ----- BULL ROUND -----
    if (r.type === 'bull') {
      padHint.textContent = '';

      const bWrap = document.createElement('div');
      bWrap.className = 'dtPadWrap';
      bWrap.style.width = '100%';
      bWrap.style.boxSizing = 'border-box';
      bWrap.style.display = 'grid';
      bWrap.style.gridTemplateColumns = 'clamp(96px, 18vw, 132px) minmax(0,1fr)';
      bWrap.style.gap = '8px';
      bWrap.style.alignItems = 'stretch';
      bWrap.style.justifyItems = 'stretch';

      // Force Bull pad to use the full width of the scorepad (mirror number-round flex rows)
      try{
        const w = pad && pad.getBoundingClientRect ? pad.getBoundingClientRect().width : 0;
        if (w && Number.isFinite(w)) {
          bWrap.style.width = w + 'px';
          bWrap.style.maxWidth = 'none';
          bWrap.style.marginLeft = '0';
          bWrap.style.marginRight = '0';
          bWrap.style.alignSelf = 'stretch';
          bWrap.style.justifySelf = 'stretch';
        }
      }catch(_){}

      const x3 = document.createElement('button');
      x3.className = 'dtX3';
      x3.type = 'button';

      __sqBindMissXButton(x3);

      const right = document.createElement('div');
      right.className = 'dtRight';
      right.style.width = '100%';

      const bullRow = document.createElement('div');
      bullRow.className = 'dtBullRow';
      bullRow.style.width = '100%';

      const outerBtn = document.createElement('button');
      outerBtn.className = 'dtBullBtn';
      outerBtn.type = 'button';
      outerBtn.textContent = 'OUTER BULL';
      outerBtn.onclick = () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ bull: 'Outer' }); };
      bullRow.appendChild(outerBtn);

      const innerBtn = document.createElement('button');
      innerBtn.className = 'dtBullBtn inner';
      innerBtn.type = 'button';
      innerBtn.textContent = 'INNER BULL';
      innerBtn.onclick = () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ bull: 'Inner' }); };
      bullRow.appendChild(innerBtn);

      const actions = document.createElement('div');
      actions.className = 'dtActions';
      actions.style.width = '100%';

      const mkAct = (cls, icon, label, onClick) => {
        const b = document.createElement('button');
        b.className = `dtActBtn ${cls}`;
        b.type = 'button';
        b.innerHTML = `<div class="dtIcon">${icon}</div><div class="dtLbl">${label}</div>`;
        b.onclick = onClick;
        return b;
      };

      actions.appendChild(mkAct('miss', '⊘', 'MISS', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ pressMissN(1); }catch(_){ try{ __sqHandleMissTap(); }catch(_){ } } }));
      actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { __sqRunUndoActionWithDmd(); }));
      actions.appendChild(mkAct('skip', '▶▶', 'SKIP', () => { __sqRunSkipActionWithDmd(); }));

      right.appendChild(bullRow);
      right.appendChild(actions);

      bWrap.appendChild(x3);
      bWrap.appendChild(right);
      pad.appendChild(bWrap);

      try { window.__sqUIMutationBus?.on(()=>__sqSetMissXLabel(x3)); } catch(_) {}
      return;
    }
  }

// Finished game: show button to go to leaderboard
  const finishBtn = document.createElement('button');
  finishBtn.className = 'btn good';
  finishBtn.style.minWidth = '220px';
  const __sqVsShadowRetrySave = !!(typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime() && state.shadow && state.shadow.saveFailed === true);
  finishBtn.textContent = __sqVsShadowRetrySave ? 'Retry Save → Leaderboard' : 'Finish Game → Leaderboard';
  finishBtn.onclick = async () => {
    state.finished = false;
    await awardAndShowLeaderboard();
  };
  pad.appendChild(finishBtn);
}

/*****************
 * DIALOGS (Stats / Race / High Scores)
 *****************/

function openStatsHubDialog(){
  try{ if (typeof __sqSetStatsOrigin==='function') __sqSetStatsOrigin('ingame'); }catch(_){ }
  try{ console.debug('[Popup]', window.__sqStatsDebugName || 'In Game Player Stats'); }catch(_){ }
  // Migrated to the shared sqModal factory (audit P5.1); identical visuals,
  // shared close/Escape/stack/focus behaviour.
  const m = sqModal({
    header: (typeof __sqStatsHeader==='function')
      ? __sqStatsHeader('Player Stats', 'Choose a stats view')
      : (()=>{ const h=document.createElement('h3'); h.textContent='Player Stats'; return h; })(),
    maxWidth: '520px',
    closeButton: 'Close',
  });
  m.modal.setAttribute('aria-label', 'Player Stats');
  m.body.style.display='flex';
  m.body.style.flexDirection='column';
  m.body.style.alignItems='center';
  m.body.style.gap='12px';
  m.body.style.paddingTop='10px';
  if (m.footer) m.footer.style.justifyContent='flex-start';

  const mk = (label, cls, fn) => {
    const b = document.createElement('button');
    b.type='button';
    b.className = `sq-navBtn ${cls||''}`.trim();
    b.textContent = label;
    b.onclick = () => { m.close('nav'); fn(); };
    return b;
  };

  // Keep existing actions; just re-skin.
  m.body.appendChild(mk('GAME RACE', 'navOrange', openGameRaceDialog));
  m.body.appendChild(mk('GAME STATS', 'navBlue', openGameStatsDialog));
  m.body.appendChild(mk('MATCH STATS', 'navBlue', openMatchStatsDialog));
  m.body.appendChild(mk('HIGH SCORES (Official)', 'navGreen', openHighScoresDialog));
  m.body.appendChild(mk('LOW SCORES (Official)', 'navGreen', openLowScoresDialog));
}

function openGameStatsDialog(){
  const displayEntries = (typeof __sqRuntimePlayerDisplayEntries === 'function')
    ? __sqRuntimePlayerDisplayEntries()
    : (state.players || []).map((player, index) => ({ player, index }));
  const displayPlayers = displayEntries.map(x => x.player);
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-arcade-dlg';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Game Stats';

  const body = document.createElement('div');
  body.className = 'modal-body';

  const table = document.createElement('table');
  table.className = 'hs-table';

  const thead = document.createElement('thead');
  const trh   = document.createElement('tr');

  const metricTh = document.createElement('th');
  metricTh.textContent = 'Metric';
  trh.appendChild(metricTh);

  displayPlayers.forEach(p => {
    const th = document.createElement('th');
    th.textContent = p.name;
    th.style.textAlign = 'center';
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const statsByPlayer = displayEntries.map(x => computeStatsForPlayerGame(x.index));
  const winsArr = (state.match?.wins || []).slice();

  DISPLAY_METRICS.forEach(m => {
    if (m.sep) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 1 + displayPlayers.length;
      td.textContent = '';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Collect raw numeric values (for highlighting)
    const rowNumeric = displayEntries.map((entry, idx) => {
      if (m.kind === 'wins') return winsArr[entry.index] || 0;
      const v = statsByPlayer[idx][m.key];
      return (typeof v === 'number') ? v : Number.isFinite(Number(v)) ? Number(v) : -Infinity;
    });
    const maxVal = Math.max(...rowNumeric);

    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.className = 'stats-th';
    th.textContent = m.label;
    tr.appendChild(th);

    displayEntries.forEach((entry, idx) => {
      const td = document.createElement('td');
      td.className = 'center num';

      if (m.multi) {
        const list = statsByPlayer[idx][m.key] || [];
        td.innerHTML = `
          <div>1st ${list[0] || '—'}</div>
          <div>2nd ${list[1] || '—'}</div>
          <div>3rd ${list[2] || '—'}</div>
        `;
      } else {
        let val;
        if (m.kind === 'wins') {
          val = winsArr[entry.index] || 0;
        } else {
          const v = statsByPlayer[idx][m.key];
          val = m.fmt ? m.fmt(v) : String(v);
        }
        td.textContent = val;
      }

      // Highlight highest numeric value(s) in the row
      const raw = (m.kind === 'wins') ? (winsArr[entry.index] || 0) : rowNumeric[idx];
      if (!m.multi && raw === maxVal && maxVal !== -Infinity) {
        td.style.color = 'var(--accent-2)';
        td.style.fontWeight = '800';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.appendChild(table);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.onclick = () => {
    overlay.remove();
    openStatsHubDialog();
  };

  footer.appendChild(backBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  modal.tabIndex = 0; modal.focus();

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
}

function openMatchStatsDialog(){
  const displayEntries = (typeof __sqRuntimePlayerDisplayEntries === 'function')
    ? __sqRuntimePlayerDisplayEntries()
    : (state.players || []).map((player, index) => ({ player, index }));
  const displayPlayers = displayEntries.map(x => x.player);
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-arcade-dlg';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Match Stats';

  const body = document.createElement('div');
  body.className = 'modal-body';

  const table = document.createElement('table');
  table.className = 'hs-table';

  const thead = document.createElement('thead');
  const trh   = document.createElement('tr');

  const metricTh = document.createElement('th');
  metricTh.textContent = 'Metric';
  trh.appendChild(metricTh);

  displayPlayers.forEach(p => {
    const th = document.createElement('th');
    th.textContent = p.name;
    th.style.textAlign = 'center';
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const vByP  = displayEntries.map(x => computeStatsForPlayerMatch(x.index));
  const winsArr = (state.match?.wins || []).slice();

  DISPLAY_METRICS.forEach(m => {
    if (m.sep) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 1 + displayPlayers.length;
      td.textContent = '';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Gather raw numeric values for leader highlight
    const rowNumeric = displayEntries.map((entry, idx) => {
      if (m.kind === 'wins') return winsArr[entry.index] || 0;
      const v = vByP[idx][m.key];
      return (typeof v === 'number') ? v : Number.isFinite(Number(v)) ? Number(v) : -Infinity;
    });
    const maxVal = Math.max(...rowNumeric);

    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.textContent = m.label;
    th.className   = 'stats-th';
    tr.appendChild(th);

    displayEntries.forEach((entry, idx) => {
      const td = document.createElement('td');
      td.className = 'center num';

      if (m.multi) {
        const list = vByP[idx][m.key] || [];
        td.innerHTML = `
          <div>1st ${list[0] || '—'}</div>
          <div>2nd ${list[1] || '—'}</div>
          <div>3rd ${list[2] || '—'}</div>
        `;
      } else {
        let val;
        if (m.kind === 'wins') {
          val = winsArr[entry.index] || 0;
        } else {
          const v = vByP[idx][m.key];
          val = m.fmt ? m.fmt(v) : String(v);
        }
        td.textContent = val;
      }

      // Leader highlight
      const raw = (m.kind === 'wins') ? (winsArr[entry.index] || 0) : rowNumeric[idx];
      if (!m.multi && raw === maxVal && maxVal !== -Infinity) {
        td.style.color = 'var(--accent-2)';
        td.style.fontWeight = '800';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.appendChild(table);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.onclick = () => { overlay.remove(); try{ if (typeof openStatsHubDialog === 'function') openStatsHubDialog(); }catch(_){ } };
  footer.appendChild(backBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  modal.tabIndex = 0;
  modal.focus();

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
}
// List all games for a specific player, filtered by optional period
async function cloudListPlayerGames(playerName, sinceIso = null, limit = 200) {
  let q = sb.from(TABLE_PLAYER_GAMES)
    .select('sheet_id, player, score, position, ts, is_practice, rounds')
    .eq('player', playerName)
    .order('ts', { ascending: false })
    .limit(limit);

  if (sinceIso) q = q.gte('ts', sinceIso);

  const { data, error } = await q;
  if (error) {
    markCloudError(error);
    throw error;
  }
  markCloudOk();
  return data || [];
}
// [removed: openPlayerGamesDialog (orphaned)] audit P5.3 batch 2 — dead/shadowed definition, no live callers

/* Official High/Low scores are derived from the `games` table, which is the
   authoritative record. The legacy high_scores / high_scores_sp tables stopped
   being written to and hold a stale, partial subset (they miss the real record
   holders entirely), so reading them showed a handful of very old rows. */
async function __sqScoresFromGames(sinceIso){
  const out = [];
  let games = [];
  try{ if (typeof cloudFetchAllGamesAsLocal === 'function') games = await cloudFetchAllGamesAsLocal(); }catch(_){ games = []; }
  const since = sinceIso ? new Date(sinceIso).getTime() : null;
  for (const g of (Array.isArray(games) ? games : [])){
    try{
      if (typeof isOfficialGame === 'function' && !isOfficialGame(g)) continue;
      const ps = (g && (g.players || g.state?.players)) || [];
      if (!Array.isArray(ps) || ps.length < 2) continue;
      const raw = g.ts || g.created_at || g.inserted_at || g.state?.ts;
      const t = raw ? new Date(raw).getTime() : 0;
      if (since && !(t >= since)) continue;
      const totals = (g && (g.totals || g.state?.totals)) || [];
      for (let i = 0; i < ps.length; i++){
        const nm = String((ps[i] && (ps[i].name || ps[i].fullName || ps[i].displayName)) || '').trim();
        const sc = Number(Array.isArray(totals) ? totals[i] : NaN);
        if (!nm || !Number.isFinite(sc) || sc <= 0) continue;
        out.push({ player_id: (ps[i] && (ps[i].id || ps[i].player_id)) || null, name: nm, score: sc, ts: raw || null, game_id: g.id || null });
      }
    }catch(_){ }
  }
  return out;
}
// Collapse to one row per player: best score for 'high', worst for 'low'.
function __sqScoresBestPerPlayer(rows, mode){
  const best = new Map();
  const high = mode !== 'low';
  for (const r of (rows || [])){
    const key = r.player_id ? 'pid:' + r.player_id : 'nm:' + String(r.name || '').trim().toLowerCase();
    const prev = best.get(key);
    if (!prev || (high ? r.score > prev.score : r.score < prev.score)) best.set(key, r);
  }
  return Array.from(best.values()).sort((a, b) => high ? (b.score - a.score) : (a.score - b.score));
}
async function openHighScoresDialog(){
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop sq-arcade-dlg';
  const modal   = document.createElement('div'); modal.className   = 'modal';
  const title   = document.createElement('h3');  title.textContent = 'High Scores (Official)';
  const body    = document.createElement('div'); body.className    = 'modal-body';

  let period = 'all';

  async function render(){
    body.innerHTML = '';
    try {
      // Compute lower-bound timestamp for this period.
      // For "yesterday" we still query since the start of yesterday, but we then
      // filter rows client-side to keep only that calendar day.
      let since;
      if (period === 'yesterday') {
        const today  = new Date();
        const startY = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        since = startY.toISOString();
      } else {
        since = periodStartIso(period);
      }

      // Derived from games (authoritative) and genuinely filtered by period —
      // the old helper ignored `since`, so every period showed the same list.
      let list = __sqScoresBestPerPlayer(await __sqScoresFromGames(since), 'high').slice(0, 20);

      // If "Yesterday", filter to scores from that day only (local time)
      if (period === 'yesterday') {
        const today   = new Date();
        const startY  = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        const endY    = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        list = (list || []).filter(row => {
          const d = new Date(row.ts);
          if (Number.isNaN(d.getTime())) return false;
          return d >= startY && d < endY;
        });
      }

      if (!list.length){
        const p = document.createElement('p');
        p.textContent = 'No high scores in this period.';
        body.appendChild(p);
        return;
      }

      const table = document.createElement('table'); table.className='hs-table';
      const thead = document.createElement('thead'); const trh = document.createElement('tr');
      ['#','Player','Score','Avg / Round','When'].forEach(h=>{
        const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
      });
      thead.appendChild(trh); table.appendChild(thead);

      const tb = document.createElement('tbody');
      list.forEach((row, idx) => {
        const tr  = document.createElement('tr');

        const td1 = document.createElement('td'); td1.textContent = String(idx + 1);
        const td2 = document.createElement('td'); td2.textContent = row.name;
        const td3 = document.createElement('td'); td3.textContent = String(row.score);

        const td4 = document.createElement('td');
        const avgRound = (typeof MAX_ROUNDS === 'number' && MAX_ROUNDS > 0)
          ? (Number(row.score || 0) / MAX_ROUNDS) : 0;
        td4.textContent = avgRound.toFixed(1);

        const td5 = document.createElement('td');
        const d = new Date(row.ts);
        td5.textContent = !Number.isNaN(d.getTime())
          ? d.toLocaleString(undefined, { year:'2-digit', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' })
          : '';
        td5.style.fontSize = '0.8rem';

        tr.append(td1, td2, td3, td4, td5);

        // click → score sheet (OFFICIAL)
        tr.style.cursor = 'pointer';
        tr.title = 'Open score sheet';
        tr.onclick = () => openScoreSheetFromHighScore(row, /* isPractice */ false);

        tb.appendChild(tr);
      });

      table.appendChild(tb);
      body.appendChild(table);
    } catch (err) {
      console.error(err);
      const p = document.createElement('p');
      p.textContent = 'Failed to load high scores.';
      body.appendChild(p);
    }
  }

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';

  // Three flex regions: left spacer, centred period buttons, right-aligned Back
  const leftRegion = document.createElement('div');
  leftRegion.style.flex = '1';

  const centerRegion = document.createElement('div');
  centerRegion.style.display = 'flex';
  centerRegion.style.gap = '8px';
  centerRegion.style.justifyContent = 'center';

  const rightRegion = document.createElement('div');
  rightRegion.style.flex = '1';
  rightRegion.style.display = 'flex';
  rightRegion.style.justifyContent = 'flex-end';

  footer.append(leftRegion, centerRegion, rightRegion);

  // Period buttons (including Yesterday)
  const periods = [
    { key:'today',     label:'Today' },
    { key:'yesterday', label:'Yesterday' },
    { key:'week',      label:'1 Week' },
    { key:'month',     label:'1 Month' },
    { key:'all',       label:'All Time' },
  ];

  const periodBtns = periods.map(p => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = p.label;
    b.dataset.period = p.key;
    b.onclick = async () => { period = p.key; setActive(); await render(); };
    centerRegion.appendChild(b);
    return b;
  });

  function setActive(){
    periodBtns.forEach(b => {
      if (b.dataset.period === period) b.classList.add('primary');
      else b.classList.remove('primary');
    });
  }

  // Back button on the right-hand side
  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.onclick = () => { overlay.remove(); try{ if (typeof openStatsHubDialog === 'function') openStatsHubDialog(); }catch(_){ } };
  rightRegion.appendChild(backBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  modal.tabIndex = 0; modal.focus();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

  setActive();
  await render();

}
async function openLowScoresDialog(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-arcade-dlg';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Low Scores (Official)';

  const body = document.createElement('div');
  body.className = 'modal-body';

  // Paint the shell (with a loading line) BEFORE awaiting the cloud, so tapping
  // the row always opens something instead of hanging on a blank screen.
  const loadingP = document.createElement('p');
  loadingP.textContent = 'Loading low scores…';
  body.appendChild(loadingP);
  const footer0 = document.createElement('div'); footer0.className = 'modal-footer';
  const close0 = document.createElement('button'); close0.className = 'btn sq-pill'; close0.textContent = 'Back';
  close0.onclick = () => { overlay.remove(); try{ if (typeof openStatsHubDialog === 'function') openStatsHubDialog(); }catch(_){ } }; footer0.appendChild(close0);
  modal.append(title, body, footer0);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();

  try {
    // Derived from games (authoritative), lowest per player first — same source
    // as High Scores so the two views agree. Timed out so it can't hang.
    const rows = await Promise.race([
      __sqScoresFromGames(null),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    const list = __sqScoresBestPerPlayer(rows, 'low').slice(0, 20);
    body.innerHTML = '';

    if (!list.length) {
      const p = document.createElement('p'); 
      p.textContent = 'No scores recorded yet.'; 
      body.appendChild(p); 
    } else {
      const table = document.createElement('table'); 
      table.className = 'hs-table';

      const thead = document.createElement('thead'); 
      const trh   = document.createElement('tr');

      ['#','Player','Score','Avg / Round','When'].forEach(h => {
        const th = document.createElement('th'); 
        th.textContent = h; 
        trh.appendChild(th);
      }); 

      thead.appendChild(trh); 
      table.appendChild(thead);

      const tb = document.createElement('tbody');

      list.forEach((row, idx) => { 
        const tr = document.createElement('tr'); 

        const td1 = document.createElement('td'); 
        td1.textContent = String(idx + 1);

        const td2 = document.createElement('td'); 
        td2.textContent = row.name;

        const td3 = document.createElement('td'); 
        td3.textContent = String(row.score);

        const td4 = document.createElement('td');
        const avgRound = MAX_ROUNDS
          ? (Number(row.score || 0) / MAX_ROUNDS)
          : 0;
        td4.textContent = avgRound.toFixed(1);

        const td5 = document.createElement('td'); 
        const d = new Date(row.ts);
        td5.textContent = !Number.isNaN(d.getTime())
          ? d.toLocaleString(undefined, {
              year: '2-digit',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';
        td5.style.fontSize = '0.8rem';

        tr.append(td1, td2, td3, td4, td5); 
        tb.appendChild(tr);
      });

      table.appendChild(tb); 
      body.appendChild(table);
    }
  } catch (err) {
    console.error(err);
    body.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = (err && err.message === 'timeout')
      ? 'Could not reach the scores service. Check your connection and try again.'
      : 'Failed to load low scores.';
    body.appendChild(p);
  }

  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  overlay.addEventListener('keydown', e => { 
    if (e.key === 'Escape') overlay.remove();
  });
}

// ===== @JS:UI:ANIM_INDICATORS =====
let __sqLastTurnPlayer = null;
let __sqLastRound = null;
let __sqRoundBarScrollBound = false;

function updateTurnBar(animateOverride){
  const bar  = byId('turnBar');
  const wrap = byId('floatWrap');
  if (!bar || !wrap) return;

  bar.style.opacity = '1';

  if (state.finished) {
    bar.style.width = '0px';
    return;
  }

  const pIdx = state.currentPlayer ?? 0;
  const cell = byId('fcoltot-' + pIdx);
  if (!cell) return;

  const head = byId('floatHead');
  const headRect = (head || wrap).getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const left = cellRect.left - headRect.left;
  const width = cellRect.width;
  const barH = (bar.getBoundingClientRect().height || 3);
  const top = (cellRect.bottom - headRect.top) - barH + 1; // flush to bottom of B3

  const animate = (animateOverride != null)
    ? !!animateOverride
    : (__sqLastTurnPlayer !== null && __sqLastTurnPlayer !== pIdx);

  if (!animate) bar.style.transition = 'none';
  else bar.style.transition = 'transform 260ms ease, width 260ms ease';
    bar.style.width = `${Math.max(0, width)}px`;
  bar.style.transform = `translate(${left}px, ${top}px)`;

  if (!animate) requestAnimationFrame(() => {
    bar.style.transition = 'transform 260ms ease, width 260ms ease';
  });

  __sqLastTurnPlayer = pIdx;
}

function updateRoundBar(animateOverride, fromScroll=false){
  const bar  = byId('roundBar');
  const wrap = byId('scoreWrap');
  if (!bar || !wrap) return;

  const rIdx = state.currentRound ?? 0;
  const th = byId('roundth-' + rIdx);
  if (!th) return;

  // Bind scroll tracker once so the bar stays aligned during manual scroll
  if (!__sqRoundBarScrollBound) {
    wrap.addEventListener('scroll', () => {
      // No animation while user scrolls
      updateRoundBar(false, true);
      try{
        const mh = (window.__sqFHMenuH != null ? window.__sqFHMenuH : 48);
        const c = Math.max(0, Math.min(wrap.scrollTop, mh));
        document.documentElement.style.setProperty('--fhCollapse', c + 'px');
      }catch(e){}
    }, { passive:true });
    __sqRoundBarScrollBound = true;
  }

  const wrapRect = wrap.getBoundingClientRect();

  // The "round indicator" is the boundary between the round label column (left)
  // and Player 1's cell (right). Use Player 1 cell's left edge as the anchor.
  let left = null, y = null, h = null;
  const tdP1 = byId('cell-0-' + rIdx);
  if (tdP1) {
    const tdRect = tdP1.getBoundingClientRect();
    left = (tdRect.left - wrapRect.left) - 2; // center the 2px bar on the seam
    y = (tdRect.top - wrapRect.top);
    h = tdRect.height;
  } else {
    // Fallback: right edge of the round header cell
    const thRect = th.getBoundingClientRect();
    left = (thRect.right - wrapRect.left) - 2;
    y = (thRect.top - wrapRect.top);
    h = thRect.height;
  }

  const animate = (animateOverride != null)
    ? !!animateOverride
    : (!fromScroll && __sqLastRound !== null && __sqLastRound !== rIdx);

  if (!animate) bar.style.transition = 'none';
  else bar.style.transition = 'transform 260ms ease, height 260ms ease';

  bar.style.height = `${Math.max(0, h)}px`;
  bar.style.transform = `translate(${left}px, ${y}px)`;

  if (!animate) requestAnimationFrame(() => {
    bar.style.transition = 'transform 260ms ease, height 260ms ease';
  });

  __sqLastRound = rIdx;
}

/* =====================================================================
   LIVE V3 — Premium UI test layout (Figma yJ80MadUOk86xmfuWUEC09 66:626)
   ---------------------------------------------------------------------
   STATUS: PARKED / feature-complete for this phase (2026-07-10). Live in
   test mode only. Safe to leave as-is; the notes below are the handover.

   WHAT IT IS
   A redesigned in-game screen for 2-player Match Play Classic. It is a
   PURE PRESENTATION LAYER — it never touches scoring/engine logic. The
   existing pad + recordThrow + updateUI pipeline stays the engine; V3
   only replaces the layout above the pad and relocates the live DMD
   canvas into its centre panel.

   HOW TO ENABLE (opt-in, never changes the default live screen)
     • localStorage 'sq_livev3_test' = '1'  (in-game menu toggle wires
       this — search tag: sq_livev3_test near line ~48696).
     • Only activates for a 2-player, mode=match, classic, non-turbo,
       non-tournament, non-practice game — see __sqLiveV3Eligible below.
     • When active, <body> gets class 'livev3-on' (CSS scope for the whole
       feature). CSS block search tag: "LIVE V3 — Premium UI test layout".

   ARCHITECTURE (all functions are __sqLiveV3* / __sqV3*; grep by name)
     • __sqLiveV3Sync (window.*)  — called at the end of updateUI; adds/
       removes the panel and the 'livev3-on' body class.
     • __sqLiveV3Render           — builds the whole panel via one
       innerHTML assignment each call, then relocates the DMD canvas into
       #v3DmdSlot. Guarded by a render-signature (panel.dataset.sig) so
       redundant updateUI calls don't cut in-flight animations short.
     • __sqV3Animate(panel)       — runs AFTER each render; diffs the fresh
       state against snapshot window.__sqV3Anim and fires one-shot arcade
       animations ONLY where a value changed (hit/miss/round-done/game-won/
       turn-change/dart-used). This is where sound + FX are triggered.
     • FX helpers: __sqV3FxLayer (persistent #v3fxLayer overlay that
       survives re-renders), __sqV3FlyPlus (sideways "+N" into a total),
       __sqV3Fly (diagonal round-total into history), __sqV3MissShake,
       __sqV3Reduced (prefers-reduced-motion opt-out).
     • Sound/haptics: __sqV3Snd{Hit,Miss,Round,Game} + __sqV3Beep (WebAudio,
       synthesized, no assets) + __sqV3Vibe. Opt-in, persisted to
       localStorage 'sq_livev3_sound' ('0' = muted); topbar toggle #v3SoundBtn.

   FEATURES SHIPPED THIS PHASE
     • Central ROUND SCORE that accumulates; each hit flies a "+N" left/
       right into the active player's total (gold for >=30), which pops.
     • Miss = red shake on the round-score number (no text).
     • Round complete = round total flies diagonally into that player's
       history; older rounds drop one slot.
     • Lit "attract" DMD screen: reticle rings + the round target ghosted
       behind the canvas so the centre is never dead-black.
     • Sound + haptics (see above).
     • Turn-clock: pulsing accent bar on the active card edge (.v3-turnbar).
     • Match progress: won GAMES dot pops gold + label flashes (.v3-windot-win).

   INVARIANTS — DO NOT BREAK
     • Never add scoring/engine logic here; presentation only.
     • Every new animation must be added to the prefers-reduced-motion
       reset (search "prefers-reduced-motion" in the V3 CSS block).
     • Any new field an animation diffs on must be added to the
       window.__sqV3Anim snapshot at the end of __sqV3Animate.
     • Keep everything scoped to body.livev3-on so the default screen is
       untouched.

   KNOWN GAPS / NEXT IDEAS (not started)
     • game-win fanfare + gold-dot path is wired but only fires on an
       actual game win (not exercised by the quick harness test).
     • idle DMD could show richer attract content (rotating reticle,
       last-dart replay) if desired.
===================================================================== */
function __sqLiveV3Enabled(){
  try{ return localStorage.getItem('sq_livev3_test') === '1'; }catch(_){ return false; }
}

function __sqLiveV3Eligible(){
  try{
    if (!__sqLiveV3Enabled()) return false;
    if (!state || !Array.isArray(state.players) || [2, 3, 4].indexOf(state.players.length) < 0) return false;
    const m = state.match || {};
    if (m.tournament) return false;
    if (m.forcePractice || m.practiceType) return false;
    if (String(m.mode || '') === 'turbo' || m.gameMode === 'turbo' || state.gameMode === 'turbo') return false;
    if (String(m.mode || '') !== 'match' && m.gameFormat !== 'match_play') return false;
    if (String(m.gameVariant || 'classic') !== 'classic') return false;
    return true;
  }catch(_){ return false; }
}

function __sqV3Mark(d){
  if (!d) return '-';
  if (d.kind === 'Miss') return 'X';
  if (d.kind === 'S' || d.kind === 'D' || d.kind === 'T') return d.kind;
  if (d.kind === 'Double') return 'D' + (d.sector || '');
  if (d.kind === 'Triple') return 'T' + (d.sector || '');
  if (d.kind === 'B') return d.bull === 'Inner' ? '50' : '25';
  return '-';
}

function __sqV3Marks(entry){
  const ds = (entry && entry.darts) || [];
  return [0,1,2].map(k => __sqV3Mark(ds[k])).join(' / ');
}

function __sqV3RoundLabel(r){
  const def = ROUNDS[r];
  if (!def) return String(r + 1);
  if (def.type === 'number') return String(def.target);
  if (def.type === 'doubles') return 'D';
  if (def.type === 'triples') return 'T';
  return 'B';
}

function __sqV3TotalFor(p){
  let t = 0;
  const b = (state.score && state.score[p]) || [];
  for (const e of b) t += Number((e && e.roundTotal) || 0);
  return t;
}

// Shared per-player accent colour used for BOTH the name text and the race line,
// so a player's name always matches their line on the chart.
function __sqV3PlayerColor(i){
  const PAL = ['#ff8a3c', '#4a90ff', '#2fd06b', '#b06bff'];
  return (state.players && state.players[i] && state.players[i].color) || PAL[i % PAL.length];
}

function __sqV3RoundThrown(entry){
  return !!(entry && entry.darts && entry.darts.some(d => d));
}

// Best-effort personal-best match totals for the PB column (dashes offline).
function __sqLiveV3LoadPBs(){
  if (window.__sqV3PBsLoading || window.__sqV3PBs) return;
  window.__sqV3PBsLoading = true;
  (async () => {
    const map = new Map();
    try{
      if (typeof cloudListHighScoresWithBackfill === 'function'){
        const rows = await cloudListHighScoresWithBackfill(false, 500);
        (rows || []).forEach(r => {
          const n = String((r && r.player) || '').trim().toLowerCase();
          const v = Number((r && (r.best_score ?? r.score ?? r.total)) || 0);
          if (n && v && (!map.has(n) || v > map.get(n))) map.set(n, v);
        });
      }
    }catch(_){ }
    window.__sqV3PBs = map;
    window.__sqV3PBsLoading = false;
    try{ if (map.size && typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync(); }catch(_){ }
  })();
}

// All-time best 3-ROUND AVG and GAME AVG, per player and game-wide, from saved
// official games. Powers the green (personal best) / purple (all-time record)
// average highlighting. Best-effort + async; stays neutral offline.
function __sqV3LoadAvgRecords(){
  if (window.__sqV3AvgRecordsLoading || window.__sqV3AvgRecords) return;
  window.__sqV3AvgRecordsLoading = true;
  (async () => {
    const per = new Map();                 // name(lower) -> { a3, ga }
    let gA3 = 0, gGa = 0;                   // game-wide (all-time) records
    const rc = (Array.isArray(window.ROUNDS) && window.ROUNDS.length) ? window.ROUNDS.length : 14;
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const played = e => {
      if (e == null) return false;
      if (typeof e === 'number') return true;
      if (Array.isArray(e.darts)) return e.darts.some(d => d != null);
      return Number.isFinite(Number(e.roundTotal)) || Number.isFinite(Number(e.total)) || Number.isFinite(Number(e.score));
    };
    const total = e => {
      if (e == null) return 0;
      if (typeof e === 'number') return num(e);
      if (Number.isFinite(Number(e.roundTotal))) return num(e.roundTotal);
      if (Number.isFinite(Number(e.total))) return num(e.total);
      if (Number.isFinite(Number(e.score))) return num(e.score);
      if (Array.isArray(e.darts)) return e.darts.reduce((s, d) => s + (d == null ? 0 : (typeof d === 'number' ? num(d) : num(d.score ?? d.points ?? d.value ?? 0))), 0);
      return 0;
    };
    const entryAt = (board, pIdx, rIdx, pc) => {
      if (Array.isArray(board?.[pIdx])) return board[pIdx]?.[rIdx];
      if (Array.isArray(board?.[rIdx]) && board.length >= rc && board.length !== pc) return board[rIdx]?.[pIdx];
      return null;
    };
    try{
      if (typeof cloudFetchAllGamesAsLocal === 'function'){
        const games = await cloudFetchAllGamesAsLocal();
        for (const g of (Array.isArray(games) ? games : [])){
          try{
            if (typeof isOfficialGame === 'function' && !isOfficialGame(g)) continue;
            const ps = (g && (g.players || g.state?.players)) || [];
            const board = (g && (g.board || g.score || g.state?.board || g.state?.score)) || [];
            if (!Array.isArray(ps) || !ps.length) continue;
            for (let pIdx = 0; pIdx < ps.length; pIdx++){
              const pts = [];
              for (let ri = 0; ri < rc; ri++){ const e = entryAt(board, pIdx, ri, ps.length); if (played(e)) pts.push(total(e)); }
              if (!pts.length) continue;
              const ga = pts.reduce((a, c) => a + c, 0) / pts.length;
              let a3 = 0;
              if (pts.length >= 3){ for (let i = 0; i + 3 <= pts.length; i++){ const m = (pts[i] + pts[i + 1] + pts[i + 2]) / 3; if (m > a3) a3 = m; } }
              const nm = String(ps[pIdx]?.name || ps[pIdx]?.fullName || ps[pIdx]?.displayName || ps[pIdx]?.nick || '').trim().toLowerCase();
              if (!nm) continue;
              const cur = per.get(nm) || { a3: 0, ga: 0 };
              if (a3 > cur.a3) cur.a3 = a3;
              if (ga > cur.ga) cur.ga = ga;
              per.set(nm, cur);
              if (a3 > gA3) gA3 = a3;
              if (ga > gGa) gGa = ga;
            }
          }catch(_){ }
        }
      }
    }catch(_){ }
    window.__sqV3AvgRecords = { per, global: { a3: gA3, ga: gGa } };
    window.__sqV3AvgRecordsLoading = false;
    // Force a re-render so the colours apply the moment records arrive.
    try{ const p = document.getElementById('liveV3Panel'); if (p) p.dataset.sig = ''; if (typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync(); }catch(_){ }
  })();
}
// Classify a live average against the loaded records: '' | 'rec-best' | 'rec-record'.
function __sqV3AvgRecClass(kind, valueNum, completedRounds, nameLower){
  if (valueNum == null || !(completedRounds >= 3)) return '';
  const rec = window.__sqV3AvgRecords; if (!rec) return '';
  const EPS = 0.05;
  const gRec = kind === 'a3' ? (rec.global && rec.global.a3) : (rec.global && rec.global.ga);
  if (gRec && valueNum >= gRec - EPS) return 'rec-record';
  const pr = rec.per && rec.per.get(nameLower);
  const pRec = pr ? (kind === 'a3' ? pr.a3 : pr.ga) : 0;
  if (pRec && valueNum >= pRec - EPS) return 'rec-best';
  return '';
}

function __sqV3FxLayer(){
  let l = document.getElementById('v3fxLayer');
  if (!l){ l = document.createElement('div'); l.id = 'v3fxLayer'; document.body.appendChild(l); }
  return l;
}
function __sqV3Reduced(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Miss — just a red negative shake on the round-score number (no text).
function __sqV3MissShake(anchorEl){
  try{ if (anchorEl) anchorEl.classList.add('v3-shake-red'); }catch(_){ }
}

// A "+N" that slides horizontally from the centre into a player's total.
function __sqV3FlyPlus(fromEl, toEl, text, big){
  try{
    if (!fromEl || !toEl) return;
    if (__sqV3Reduced()){ toEl.classList.add('v3-pop'); return; }
    const layer = __sqV3FxLayer();
    const s = fromEl.getBoundingClientRect();
    const d = toEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'v3-plusfly' + (big ? ' big' : '');
    el.textContent = text;
    el.style.left = (s.left + s.width / 2) + 'px';
    el.style.top = (s.top + s.height / 2) + 'px';
    layer.appendChild(el);
    const dx = (d.left + d.width / 2) - (s.left + s.width / 2);
    const dy = (d.top + d.height / 2) - (s.top + s.height / 2);
    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.68)`;
      el.style.opacity = '0';
    });
    setTimeout(() => {
      try{ el.remove(); toEl.classList.remove('v3-pop'); void toEl.offsetWidth; toEl.classList.add('v3-pop'); }catch(_){ }
    }, 430);
  }catch(_){ }
}

// Fly a value clone diagonally from one element to another, scaling to dest.
function __sqV3Fly(fromEl, toEl, text){
  try{
    if (__sqV3Reduced() || !fromEl || !toEl) return;
    const layer = __sqV3FxLayer();
    const s = fromEl.getBoundingClientRect();
    const d = toEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'v3-fly';
    el.textContent = text;
    el.style.left = s.left + 'px'; el.style.top = s.top + 'px';
    el.style.width = s.width + 'px'; el.style.height = s.height + 'px';
    el.style.fontSize = getComputedStyle(fromEl).fontSize;
    layer.appendChild(el);
    const dx = (d.left + d.width / 2) - (s.left + s.width / 2);
    const dy = (d.top + d.height / 2) - (s.top + s.height / 2);
    const scale = Math.max(.32, Math.min(1, d.height / Math.max(1, s.height)));
    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      el.style.opacity = '.1';
    });
    setTimeout(() => { try{ el.remove(); }catch(_){ } }, 560);
  }catch(_){ }
}

// --- Live V3 sound + haptics: synthesized (no assets), opt-in via toggle ---
var __sqV3Audio = null;
function __sqV3SoundOn(){ try{ return localStorage.getItem('sq_livev3_sound') !== '0'; }catch(_){ return true; } }
function __sqV3SetSound(on){ try{ localStorage.setItem('sq_livev3_sound', on ? '1' : '0'); }catch(_){ } }
function __sqV3Ac(){
  try{
    if (!__sqV3Audio){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      __sqV3Audio = new AC();
    }
    if (__sqV3Audio.state === 'suspended') __sqV3Audio.resume();
    return __sqV3Audio;
  }catch(_){ return null; }
}
// One short synthesized note.
function __sqV3Beep(freq, dur, type, gain, delay){
  try{
    const ac = __sqV3Ac(); if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const d = dur || 0.12;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.13, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + d + 0.02);
  }catch(_){ }
}
function __sqV3Vibe(pattern){ try{ if (navigator.vibrate) navigator.vibrate(pattern); }catch(_){ } }
function __sqV3SndHit(score){
  if (!__sqV3SoundOn()) return;
  const s = Math.max(0, Math.min(60, Number(score) || 0));
  const freq = 520 + s * 8.6;                       // brighter for bigger hits
  __sqV3Beep(freq, 0.10, 'triangle', 0.13);
  if (s >= 30) __sqV3Beep(freq * 1.5, 0.12, 'triangle', 0.10, 0.05);
  __sqV3Vibe(s >= 30 ? [12, 22, 12] : 12);
}
function __sqV3SndMiss(){
  if (!__sqV3SoundOn()) return;
  __sqV3Beep(150, 0.18, 'sawtooth', 0.09);
  __sqV3Beep(104, 0.20, 'sawtooth', 0.07, 0.04);
  __sqV3Vibe([28, 40, 28]);
}
function __sqV3SndRound(){
  if (!__sqV3SoundOn()) return;
  __sqV3Beep(660, 0.10, 'sine', 0.10);
  __sqV3Beep(880, 0.12, 'sine', 0.10, 0.08);
}
function __sqV3SndGame(){
  if (!__sqV3SoundOn()) return;
  [523, 659, 784, 1047].forEach((f, i) => __sqV3Beep(f, 0.16, 'triangle', 0.13, i * 0.10));
  __sqV3Vibe([18, 30, 18, 30, 60]);
}

// Headline combo for a just-completed round (live V3 callout). Mirrors the
// achievement rules; returns the rarest single combo meta, or null.
function __sqV3RoundCombo(entry){
  try{
    if (!entry || !entry.darts) return null;
    const darts = entry.darts;
    if (darts.filter(d => d).length < 3) return null;
    const norm = d => { const k = (d && d.kind) || 'Miss'; if (k==='S') return 'single'; if (k==='D'||k==='Double') return 'double'; if (k==='T'||k==='Triple') return 'treble'; if (k==='B'||k==='Bull') return 'bull'; return 'miss'; };
    let tre=0, dou=0, sin=0; darts.forEach(d => { const nk = norm(d); if (nk==='treble') tre++; else if (nk==='double') dou++; else if (nk==='single') sin++; });
    const mis = darts.filter(d => norm(d)==='miss' || (Number(d && d.points)||0)===0).length;
    const rtot = Number(entry.roundTotal) || 0;
    let code = null;
    if (rtot === 180) code = 'the_180';
    else if (tre === 3) code = 'treble_trouble';
    else if (sin===1 && dou===1 && tre===1) code = 'shanghai';
    else if (dou === 3) code = 'double_down';
    else if (sin===2 && dou===1 && tre===0 && mis===0) code = 'desmond';
    else if (rtot >= 100) code = 'century';
    else if (tre >= 2) code = 'robin_hood';
    else if (mis === 0) code = 'full_house';
    if (!code) return null;
    return (window.SQ_ACH && SQ_ACH.meta) ? SQ_ACH.meta(code) : { code, name: code, icon:'🎯', tier:'gold' };
  }catch(_){ return null; }
}
// Stage a combo/trophy across the whole centre stem (the marquee keeps showing
// the dart that caused it, so the two surfaces tell one story).
function __sqV3StageCombo(name, tier, lab, hold){
  try{
    const big = (tier === 'legendary' || tier === 'gold');
    const dur = hold || (tier === 'legendary' ? 2300 : tier === 'gold' ? 2000 : tier === 'whiff' ? 1500 : 1700);
    const until = performance.now() + dur;
    window.__sqV3Combo = { name: String(name || '').toUpperCase(), tier: tier || 'gold', lab: String(lab || 'COMBO').toUpperCase(), until, big };
    // Keep the round frozen for as long as the celebration runs — otherwise the
    // hold released first and the stem rebuilt twice in quick succession, which
    // is what made the middle feel jumpy.
    try{ if (window.__sqV3Hold){ window.__sqV3Hold.until = Math.max(window.__sqV3Hold.until, until);
      clearTimeout(window.__sqV3HoldT);
      window.__sqV3HoldT = setTimeout(() => { try{ __sqV3ReleaseHold(); }catch(_){ } }, dur + 40); } }catch(_){ }
    // Screen shake for the big ones (Street-Fighter impact).
    if ((big || tier === 'whiff') && !__sqV3Reduced()){
      try{ const p = document.getElementById('liveV3Panel');
        if (p){ p.classList.remove('v3-quake','v3-quake-big'); void p.offsetWidth;
          p.classList.add(tier === 'legendary' ? 'v3-quake-big' : 'v3-quake');
          setTimeout(() => { try{ p.classList.remove('v3-quake','v3-quake-big'); }catch(_){ } }, 900); } }catch(_){ }
    }
    if (tier === 'whiff'){ try{ __sqV3SndMiss(); if (navigator.vibrate && !__sqV3Reduced()) navigator.vibrate([30,60,30,60,50]); }catch(_){ } }
    clearTimeout(window.__sqV3ComboT);
    // Outro: flag the stage as leaving a beat early so it fades/recedes rather
    // than being yanked off, then clear.
    clearTimeout(window.__sqV3ComboOutT);
    window.__sqV3ComboOutT = setTimeout(() => {
      try{ if (window.__sqV3Combo) window.__sqV3Combo.leaving = true;
        const p = document.getElementById('liveV3Panel'); if (p) p.dataset.sig = '';
        if (typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync(); }catch(_){ }
    }, Math.max(0, dur - 420));
    window.__sqV3ComboT = setTimeout(() => {
      window.__sqV3Combo = null;
      window.__sqV3ComboOut = performance.now() + 420;
      try{ const p = document.getElementById('liveV3Panel'); if (p) p.dataset.sig = '';
        if (typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync(); }catch(_){ }
    }, dur + 30);
    // Repaint on the next tick — this is called from inside __sqV3Animate, which
    // itself runs at the end of a render, so syncing synchronously would re-enter
    // the renderer and wipe the event that triggered us.
    setTimeout(() => {
      try{ const p = document.getElementById('liveV3Panel'); if (p) p.dataset.sig = '';
        if (typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync(); }catch(_){ }
    }, 0);
  }catch(_){ }
}
// Release the end-of-round freeze and repaint immediately.
function __sqV3ReleaseHold(){
  if (!window.__sqV3Hold) return;
  window.__sqV3Hold = null;
  try{ clearTimeout(window.__sqV3HoldT); }catch(_){ }
  try{
    const p = document.getElementById('liveV3Panel'); if (p) p.dataset.sig = '';
    if (typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync();
  }catch(_){ }
}
// Any throw-pad press skips the freeze straight away (capture, so it lands
// before the game logic re-renders).
if (!window.__sqV3HoldBound){
  window.__sqV3HoldBound = true;
  try{
    document.addEventListener('pointerdown', function(e){
      if (!window.__sqV3Hold) return;
      const t = e.target && e.target.closest ? e.target.closest('#pad button, .dtPad button') : null;
      if (t) __sqV3ReleaseHold();
    }, true);
  }catch(_){ }
}
// Digital top-bar display: shows TARGET when idle, and combo/trophy callouts
// with an arcade flip. Events are queued in window.__sqV3Disp and rendered by
// __sqV3DisplayTick (driven each frame by the race rAF, so it self-reverts).
// Events QUEUE behind whatever is showing, so the dart that just landed is
// always seen before a combo/trophy callout replaces it.
function __sqV3DisplayEvent(text, gold, lab, hold){
  const st = window.__sqV3Disp || (window.__sqV3Disp = {});
  const ev = { text: String(text || '').toUpperCase(), gold: !!gold, lab: String(lab || '').toUpperCase(), dur: (hold || 1750) };
  (st.queue || (st.queue = [])).push(ev);
}
// Per-dart throw feedback: S / D / T / BULL land as a HIT (green kick), a miss
// lands as MISS (red rumble). Shown on the same top-bar display.
function __sqV3DisplayThrow(dart){
  const st = window.__sqV3Disp || (window.__sqV3Disp = {});
  const k = dart && dart.kind;
  const miss = !dart || k === 'Miss';
  let text = 'MISS';
  if (!miss){
    text = (k === 'T' || k === 'Triple') ? 'TREBLE'
         : (k === 'D' || k === 'Double') ? 'DOUBLE'
         : (k === 'B') ? (dart.bull === 'Inner' ? 'BULL 50' : 'BULL 25')
         : 'SINGLE';
  }
  // A throw preempts anything queued — it is the freshest thing that happened.
  st.queue = [];
  st.event = { text, lab: miss ? 'MISS' : 'HIT', throwKind: miss ? 'miss' : 'hit', until: performance.now() + 1000 };
}
// Idle rotation: TO THROW <name> -> 3RND/GAME AVG -> ROUND PB -> repeat.
function __sqV3IdleSlides(){
  const out = [];
  try{
    const cp = state.currentPlayer || 0;
    const p = (state.players || [])[cp];
    const nm = String((p && (p.name || p.player)) || '').split(' ')[0].toUpperCase();
    if (nm) out.push({ lab: 'TO THROW', val: nm });
    const b = (state.score && state.score[cp]) || [];
    const pts = [];
    b.forEach(e => { if (e && e.darts && e.darts.filter(d => d).length >= 3) pts.push(Number(e.roundTotal || 0)); });
    if (pts.length){
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      out.push({ lab: '3 RND / GAME AVG', val: mean(pts.slice(-3)).toFixed(1) + '  ·  ' + mean(pts).toFixed(1) });
      out.push({ lab: 'ROUND PB', val: String(Math.max(...pts)) });
    }
  }catch(_){ }
  return out.length ? out : [{ lab: 'TARGET', val: '' }];
}
function __sqV3DisplayTick(){
  try{
    const disp = document.getElementById('v3TbDisplay'); if (!disp) return;
    const st = window.__sqV3Disp || (window.__sqV3Disp = {});
    const now = performance.now();
    // Current event finished? Promote the next queued one (combo after the hit).
    if (st.event && now >= st.event.until){
      st.event = null;
      if (st.queue && st.queue.length){
        const nx = st.queue.shift();
        st.event = Object.assign({}, nx, { until: now + (nx.dur || 1750) });
      }
    }
    const ev = st.event || null;
    // Idle rotates through TO THROW / averages / round PB.
    let idleLab = 'TO THROW', idleVal = '';
    if (!ev){
      const slides = __sqV3IdleSlides();
      if (st.slideAt == null || now - st.slideAt > 3200){ st.slideAt = now; st.slideIx = (st.slideIx == null ? 0 : st.slideIx + 1); }
      const s = slides[(st.slideIx || 0) % slides.length];
      idleLab = s.lab; idleVal = s.val;
      if (!idleVal){ idleLab = 'TARGET'; idleVal = disp.dataset.target || ''; }
    } else { st.slideAt = null; }   // resume the rotation where it left off (never restart)
    const mode = ev ? (ev.throwKind ? ev.throwKind : (ev.gold ? 'gold' : 'green')) : 'idle';
    const lab = ev ? (ev.lab || '') : idleLab;
    const val = ev ? ev.text : idleVal;
    const key = mode + '|' + lab + '|' + val;
    // The panel rebuilds its innerHTML on every render, which resets the top bar
    // to the static template markup. Only trust the cached key when the DOM still
    // shows it, otherwise a re-render would leave the stale text stuck forever.
    const labEl0 = disp.querySelector('.v3-tb-lab'), valEl0 = disp.querySelector('.v3-tb-val');
    const domMatches = labEl0 && valEl0 && labEl0.textContent === lab && valEl0.textContent === val;
    if (key === st.shownKey && domMatches) return;
    st.shownKey = key;
    const labEl = labEl0, valEl = valEl0;
    if (labEl) labEl.textContent = lab;
    if (valEl) valEl.textContent = val;
    disp.classList.toggle('gold', mode === 'gold');
    disp.classList.toggle('green', mode === 'green');
    disp.classList.toggle('hit', mode === 'hit');
    disp.classList.toggle('miss', mode === 'miss');
    disp.classList.toggle('event', mode !== 'idle');
    disp.classList.remove('anim'); void disp.offsetWidth; disp.classList.add('anim');
    // Rumble the handset on a miss (where supported).
    if (mode === 'miss'){ try{ if (navigator.vibrate && !__sqV3Reduced()) navigator.vibrate([18, 40, 26]); }catch(_){ } }
    else if (mode === 'hit'){ try{ if (navigator.vibrate && !__sqV3Reduced()) navigator.vibrate(14); }catch(_){ } }
  }catch(_){ }
}

// Diff the fresh render against the previous snapshot and fire one-shot
// arcade animations only where a value actually changed.
function __sqV3Animate(panel){
  try{
    const prev = window.__sqV3Anim || {};
    const cp = state.currentPlayer || 0;
    const r = Math.max(0, Math.min(state.currentRound, MAX_ROUNDS - 1));
    const turnKey = r + ':' + cp;
    const ce = (state.score && state.score[cp] && state.score[cp][r]) || null;
    const roundScore = Number((ce && ce.roundTotal) || 0);
    const NP = (state.players || []).length || 2;
    const totals = Array.from({ length: NP }, (_, i) => __sqV3TotalFor(i));
    const dart = Math.max(0, Math.min(state.currentDart || 0, 3));
    const full = p => { let c = 0; const b = (state.score && state.score[p]) || []; b.forEach(e => { if (e && e.darts && e.darts.filter(d => d).length >= 3) c++; }); return c; };
    const fulls = Array.from({ length: NP }, (_, i) => full(i));
    const wins = (state.match && state.match.wins) || [0, 0];
    const sbNum = panel.querySelector('.v3-sb-num');

    // Round just completed by the previous thrower -> the round total flies
    // diagonally from the centre down into that player's history; older rounds
    // drop down a slot to make room.
    // A round just completed -> freeze the centre stem on that finished round
    // (score + full dart track) for a beat so the result is actually seen before
    // the screen resets for the next thrower. Any pad press releases it early.
    for (let i = 0; i < NP; i++){
      if (fulls[i] > ((prev.fulls && prev.fulls[i]) || 0)){
        try{
          const b = (state.score && state.score[i]) || [];
          const ri = fulls[i] - 1;
          const done = b[ri];
          if (done && done.darts){
            window.__sqV3Hold = { until: performance.now() + 1400, entry: JSON.parse(JSON.stringify(done)) };
            clearTimeout(window.__sqV3HoldT);
            window.__sqV3HoldT = setTimeout(() => { try{ __sqV3ReleaseHold(); }catch(_){ } }, 1420);
          }
        }catch(_){ }
        break;
      }
    }

    const flew = new Array(NP).fill(false);
    for (let i = 0; i < NP; i++){
      if (fulls[i] > ((prev.fulls && prev.fulls[i]) || 0) && prev.cp === i && sbNum){
        const side = panel.querySelector('.v3-side[data-p="' + i + '"]');
        const destRr = side && side.querySelector('.v3-rr');
        const destTot = destRr && destRr.querySelector('.v3-rr-tot');
        if (destRr && destTot){
          const total = destTot.textContent;
          destRr.style.visibility = 'hidden';
          __sqV3Fly(sbNum, destTot, total);
          setTimeout(() => { try{ destRr.style.visibility = ''; destRr.classList.add('v3-rr-land'); }catch(_){ } }, __sqV3Reduced() ? 0 : 470);
          side.querySelectorAll('.v3-rr:nth-child(n+2)').forEach(rr => rr.classList.add('v3-rr-drop'));
          flew[i] = true;
        }
      }
    }

    // Hit -> the centre round score pops and updates (stays central), and a
    // "+N" slides sideways into the active player's total, which pops on land.
    let plusFlyPlayer = -1;
    const totalEls = panel.querySelectorAll('.v3-total');
    if (prev.turnKey === turnKey && roundScore > (prev.roundScore || 0)){
      const delta = roundScore - (prev.roundScore || 0);
      const big = delta >= 30;
      if (sbNum) sbNum.classList.add(big ? 'v3-pop-big' : 'v3-pop');
      // (the old "+N" fly-out from the middle number was removed — overkill now
      // that the stem is the focus; the player's total still pops on its own)
      const marks = panel.querySelector('.v3-sb-marks'); if (marks) marks.classList.add('v3-flash');
      // The active pill lunges ("reaches") on a scoring dart.
      try{
        const hitCard = panel.querySelector('.v3-card.active');
        if (hitCard && !__sqV3Reduced()){ hitCard.classList.remove('v3-card-hit'); void hitCard.offsetWidth; hitCard.classList.add('v3-card-hit');
          setTimeout(() => { try{ hitCard.classList.remove('v3-card-hit'); }catch(_){ } }, 440); }
      }catch(_){ }
      // Announce the dart that just landed on the top-bar display (HIT).
      try{ __sqV3DisplayThrow((ce && ce.darts && ce.darts[Math.max(0, dart - 1)]) || null); }catch(_){ }
      __sqV3SndHit(delta);
    }
    // Miss -> red negative shake (a dart was used but added no points).
    else if (prev.turnKey === turnKey && dart > (prev.dart || 0) && roundScore === (prev.roundScore || 0)){
      if (sbNum) __sqV3MissShake(sbNum);
      const marks = panel.querySelector('.v3-sb-marks'); if (marks) marks.classList.add('v3-flash');
      try{ __sqV3DisplayThrow(null); }catch(_){ }
      __sqV3SndMiss();
    }

    // Totals pop when they climb (the active player's pop is deferred to the
    // moment the sliding "+N" lands, so it is skipped here).
    for (let i = 0; i < NP; i++){
      if (i !== plusFlyPlayer && totals[i] > ((prev.totals && prev.totals[i]) || 0) && totalEls[i]) totalEls[i].classList.add('v3-pop');
    }

    // A completed round that wasn't handled by a fly still slides in.
    let roundCompleted = false;
    for (let i = 0; i < NP; i++){
      if (fulls[i] > ((prev.fulls && prev.fulls[i]) || 0)){
        roundCompleted = true;
        // Live combo callout for the round this player just completed.
        try{
          const b = (state.score && state.score[i]) || []; let last = -1;
          for (let ri = b.length - 1; ri >= 0; ri--){ if (b[ri] && b[ri].darts && b[ri].darts.filter(d => d).length >= 3){ last = ri; break; } }
          if (last >= 0){
            // The dart that COMPLETED the round never reaches the hit branch
            // above (the turn advances in the same tick, so turnKey changes).
            // Show it explicitly first; the combo then queues behind it.
            try{
              const ds0 = (b[last].darts || []);
              for (let k = ds0.length - 1; k >= 0; k--){ if (ds0[k]){ __sqV3DisplayThrow(ds0[k]); break; } }
            }catch(_){ }
            // A whole round missed — call it out (the opposite of a combo).
            try{
              const dsm = (b[last].darts || []);
              if (dsm.length >= 3 && dsm.every(d => d && d.kind === 'Miss')){
                __sqV3StageCombo('ALL THREE MISSED', 'whiff', 'WHIFF');
              }
            }catch(_){ }
            // Trophy: a round of three trebles on the target beats a normal combo.
            let shown = false;
            try{
              const ds = (b[last].darts || []);
              if (ds.length >= 3 && ds.filter(d => d && (d.kind === 'T' || d.kind === 'Triple')).length === 3){
                __sqV3StageCombo('PERFECT ROUND!', 'legendary', 'TROPHY'); shown = true;
              }
            }catch(_){ }
            if (!shown){ const m = __sqV3RoundCombo(b[last]); if (m) __sqV3StageCombo((m.name || '') + '!', (m.tier === 'legendary' ? 'legendary' : m.tier === 'silver' ? 'silver' : 'gold'), 'COMBO'); }
          }
        }catch(_){ }
      }
      if (!flew[i] && fulls[i] > ((prev.fulls && prev.fulls[i]) || 0)){
        const side = panel.querySelector('.v3-side[data-p="' + i + '"]');
        const firstRr = side && side.querySelector('.v3-rr');
        if (firstRr) firstRr.classList.add('v3-rr-new');
      }
    }
    if (roundCompleted && prev.fulls !== undefined) __sqV3SndRound();

    // Game won — pop the newly-lit win dot gold, flash GAMES, sound the fanfare.
    if (prev.wins !== undefined){
      for (let i = 0; i < NP; i++){
        if ((wins[i] || 0) > ((prev.wins && prev.wins[i]) || 0)){
          const side = panel.querySelector('.v3-side[data-p="' + i + '"]');
          const dots = side ? side.querySelectorAll('.v3-windots i') : [];
          const dot = dots[(wins[i] || 0) - 1];
          if (dot) dot.classList.add('v3-windot-win');
          const lab = side && side.querySelector('.v3-wins-lab');
          if (lab) lab.classList.add('v3-flash');
          try{ const nm = String((state.players[i] && (state.players[i].name || state.players[i].player)) || '').split(' ')[0]; __sqV3DisplayEvent((nm || 'PLAYER') + ' WINS!', true, 'WINNER', 3200); }catch(_){ }
          __sqV3SndGame();
        }
      }
    }

    // Turn change — sweep the newly active card in + announce on the DMD.
    if (prev.cp !== undefined && prev.cp !== cp){
      const card = panel.querySelector('.v3-card.active');
      if (card) card.classList.add('v3-card-in');
    }

    // Dart used — flash the dot that just went dark.
    if (prev.turnKey === turnKey && dart > (prev.dart || 0)){
      const dots = panel.querySelectorAll('.v3-dartdots i');
      const goneIdx = 3 - dart;
      if (dots[goneIdx]) dots[goneIdx].classList.add('v3-dot-out');
    }

    window.__sqV3Anim = { turnKey, roundScore, totals, dart, cp, fulls, wins: Array.from({ length: NP }, (_, i) => wins[i] || 0) };
  }catch(_){ }
}

/* ---------- FORM METERS — a true HOT/COLD "form" reading ----------
   Like a Street-Fighter momentum gauge: good shots and combos (hits in a row)
   heat the bar UP; missed shots cool it DOWN. It never resets — it's a live
   reading of current form. Computed deterministically from state.score so it
   survives re-renders and undo. */
function __sqV3FormData(p){
  const b = (state.score && state.score[p]) || [];
  let heat = 45, streak = 0;
  for (let ri = 0; ri < b.length; ri++){
    const e = b[ri]; if (!e || !e.darts) continue;
    for (let d = 0; d < e.darts.length; d++){
      const dart = e.darts[d];
      if (!dart) continue;                                   // not thrown yet
      if (dart.kind === 'Miss'){ streak = 0; heat -= 15; }   // a miss cools the bar
      else {
        streak++;
        const mult = (dart.kind === 'T' || dart.kind === 'Triple') ? 2.2
                   : (dart.kind === 'D' || dart.kind === 'Double') ? 1.6
                   : (dart.kind === 'B') ? 1.8 : 1;
        heat += 6 * mult + Math.min(10, (streak - 1) * 2.2); // combos heat faster
      }
      heat = Math.max(0, Math.min(100, heat));
    }
  }
  return { heat: Math.round(heat), streak };
}
// Apply a heat value to a bar (height + hot/cold classes + 🔥/❄ marker).
function __sqV3FormApply(wrap, heat){
  const fillEl = wrap.querySelector('.v3-ef-fill');
  if (fillEl) fillEl.style.height = heat.toFixed(1) + '%';
  wrap.classList.toggle('cold', heat < 28);
  wrap.classList.toggle('warm', heat >= 52 && heat < 80);
  wrap.classList.toggle('hot', heat >= 80);
  const streak = wrap.querySelector('.v3-ef-streak');
  if (streak){ const t = heat >= 80 ? '🔥' : (heat < 22 ? '❄' : ''); if (streak.textContent !== t) streak.textContent = t; }
}
// Called on each panel render: paint the CURRENT animated value immediately so a
// freshly-rebuilt bar never flashes back to a default height (kills the flicker).
function __sqV3FormView(panel){
  try{
    const cp = state.currentPlayer || 0;
    const NP = (state.players || []).length || 2;
    const st = window.__sqV3Form || (window.__sqV3Form = { disp: [null, null] });
    for (let i = 0; i < NP; i++){
      const wrap = panel.querySelector('.v3-edge-form[data-p="' + i + '"]');
      if (!wrap) continue;
      wrap.classList.toggle('live', (i === cp) && !state.finished);
      if (st.disp[i] == null) st.disp[i] = __sqV3FormData(i).heat;
      __sqV3FormApply(wrap, st.disp[i]);
    }
  }catch(_){ }
}
// Driven every frame by the race rAF: eases each bar toward its target heat, so
// movement is smooth + responsive and the amount/speed reflects the shot (a
// treble climbs fast, a miss cools, a single nudges) — never a fixed-rate snap.
function __sqV3FormTick(){
  try{
    const panel = document.getElementById('liveV3Panel'); if (!panel) return;
    const cp = state.currentPlayer || 0;
    const NP = (state.players || []).length || 2;
    const st = window.__sqV3Form || (window.__sqV3Form = { disp: [null, null], tgt: [null, null] });
    if (!st.tgt) st.tgt = [null, null];
    for (let i = 0; i < NP; i++){
      const wrap = panel.querySelector('.v3-edge-form[data-p="' + i + '"]'); if (!wrap) continue;
      wrap.classList.toggle('live', (i === cp) && !state.finished);
      const target = __sqV3FormData(i).heat;
      // A sharp climb in target heat = a strong combo just landed -> SURGE flash.
      if (st.tgt[i] != null && target - st.tgt[i] >= 16){
        const fillEl = wrap.querySelector('.v3-ef-fill'), trackEl = wrap.querySelector('.v3-ef-track');
        [fillEl, trackEl].forEach(el => { if (!el) return; el.classList.remove('surge'); void el.offsetWidth; el.classList.add('surge'); });
      }
      st.tgt[i] = target;
      if (st.disp[i] == null) st.disp[i] = target;
      else {
        const d = target - st.disp[i];
        // ease toward target; bigger gaps move faster (snappy) but always smooth
        st.disp[i] += d * (Math.abs(d) > 12 ? 0.22 : 0.13);
        if (Math.abs(target - st.disp[i]) < 0.4) st.disp[i] = target;
      }
      __sqV3FormApply(wrap, st.disp[i]);
    }
  }catch(_){ }
}
/* ---------- GAME RACE — the only screen content (animated) ----------
   One rAF loop that always targets the current #v3RaceCanvas (the panel
   re-renders each throw). Draws grid lines + per-player cumulative-score
   lines with glow, pulsing leading dots, and eases the newest segment in. */
var __sqV3RaceState = { raf: 0, last: 0, grow: [null, null], combo: [null, null], burst: [null, null], lastLen: [-1, -1], lastFull: [-1, -1], maxV: 0 };
function __sqV3RaceEnsure(){
  if (!__sqV3RaceState.raf) __sqV3RaceState.raf = requestAnimationFrame(__sqV3RaceFrame);
  // Fetch the all-time high-score (record) pace once so it can be plotted.
  if (window.__sqV3RecordPace === undefined){
    window.__sqV3RecordPace = null;
    try{ if (typeof buildRecordPaceSeries === 'function') buildRecordPaceSeries(MAX_ROUNDS).then(s => { window.__sqV3RecordPace = (s && Array.isArray(s.data)) ? s : null; try{ const p = document.getElementById('liveV3Panel'); if (p) p.dataset.sig = ''; if (typeof window.__sqLiveV3Sync === 'function') window.__sqLiveV3Sync(); }catch(_){ } }).catch(() => {}); }catch(_){ }
  }
}
function __sqV3RaceSeries(){
  const rc = MAX_ROUNDS, cr = Number(state.currentRound || 0);
  const NP = (state.players || []).length || 2;
  return Array.from({ length: NP }, (_, p) => {
    const b = (state.score && state.score[p]) || []; let run = 0; const pts = [];
    for (let r = 0; r < rc; r++){
      const e = b[r];
      const thrown = e && e.darts && e.darts.some(x => x != null);
      if (!thrown && r >= cr){ pts.push(null); continue; }
      run += Number((e && e.roundTotal) || 0); pts.push(run);
    }
    return pts;
  });
}
function __sqV3RaceFrame(){
  const st = __sqV3RaceState; st.raf = 0;
  const canvas = document.getElementById('v3RaceCanvas'); if (!canvas) return;
  st.raf = requestAnimationFrame(__sqV3RaceFrame);
  try{
    if (!(document.body && document.body.dataset.page === 'game')) return;
    __sqV3DisplayTick();                       // keep the top-bar digital readout live
    __sqV3FormTick();                          // smoothly ease the FORM bars (flicker-free)
    const now = performance.now();
    if (now - st.last < 24) return;           // ~40fps
    st.last = now;
    __sqDrawArcadeRace(canvas, null, st, now);
  }catch(_){ }
}

function __sqDrawArcadeRace(canvas, packet, st, now){
    const host = canvas.parentElement || canvas;
    const cssW = Math.max(80, host.clientWidth || 0), cssH = Math.max(60, host.clientHeight || 0);
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(cssW*dpr) || canvas.height !== Math.round(cssH*dpr)){
      canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
    const rc = packet ? packet.labels.length : MAX_ROUNDS;
    const offset = packet ? packet.offset || 0 : 0;
    const NP = packet ? packet.series.length : (state.players || []).length || 2;
    const classicThrowRace = !!(packet && packet.classicThrowRace);
    const turboThrowRace = !!(packet && packet.turboThrowRace);
    const perThrowRace = classicThrowRace || turboThrowRace;
    const series = packet ? packet.series.map(s => {
      const src = perThrowRace && Array.isArray(s.throwData) ? s.throwData : s.data;
      return Array.isArray(src) ? src : [];
    }) : __sqV3RaceSeries();
    const lens = series.map(p => { let n = 0; for (let i = 0; i < p.length; i++) if (p[i] != null) n = i + 1; return n; });
    // Fully-thrown round count per player (all three darts landed) — used to grade
    // a round only once it's complete.
    const fulls = Array.from({ length: NP }, (_, p) => { const b = ((state.score && state.score[p]) || []).slice(offset); let n = 0;
      for (let r = 0; r < b.length; r++){ const e = b[r]; if (e && e.darts && e.darts.length && e.darts.every(x => x != null)) n = r + 1; } return n; });
    for (let p = 0; p < NP; p++){
      // Smooth line growth: ease the newest segment whenever the line extends.
      if (lens[p] !== st.lastLen[p]){ st.grow[p] = { start: now }; st.lastLen[p] = lens[p]; }
      // Great-combo charge-then-zoom: fire once a round COMPLETES as a strong combo
      // (trebles/doubles/bulls weigh heavy; weight >= 6.5 ~ 2+ trebles).
      if (fulls[p] !== st.lastFull[p]){
        if (fulls[p] > st.lastFull[p]){
          let w = 0;
          try{
            const ds = (((state.score && state.score[p]) || [])[fulls[p] - 1 + offset] || {}).darts || [];
            for (let k = 0; k < ds.length; k++){ const d = ds[k]; if (!d) continue;
              w += (d.kind === 'T' || d.kind === 'Triple') ? 3
                 : (d.kind === 'D' || d.kind === 'Double') ? 2
                 : (d.kind === 'B') ? 2
                 : (d.kind === 'Miss') ? 0 : 0.5;
            }
          }catch(_){ }
          if (!perThrowRace && w >= 6.5) st.combo[p] = { start: now, dur: 720, w: w };
        }
        st.lastFull[p] = fulls[p];
      }
    }
    const rec = packet ? packet.record : window.__sqV3RecordPace;
    const records = (packet && Array.isArray(packet.records) ? packet.records : [rec]).filter(r => r && Array.isArray(r.data));
    // Scale the axis to what has actually been PLAYED (plus one round of
    // lookahead), not the whole 14-round record line. Otherwise round 1 is
    // drawn against a ~700 ceiling and every player's line is a flat smudge
    // along the bottom. Early rounds now zoom in so small gaps read clearly.
    const maxSeriesLen = Math.max(1, ...lens);
    const playedTo = perThrowRace ? Math.max(1, Math.ceil(Math.max(0, maxSeriesLen - 1) / 3)) : maxSeriesLen;
    const flat = series.flat().filter(v => v != null);
    for (const record of records) for (const value of record.data.slice(0, playedTo + 1)) if (Number.isFinite(value)) flat.push(value);
    // Generous headroom early (keeps lines mid-panel), tightening as the game fills out.
    const head = 1.35 - 0.27 * Math.min(1, playedTo / rc);
    const targetMax = Math.max(20, ...flat) * head;
    // Smoothly ease the vertical scale so the whole graph grows fluidly.
    st.maxV = st.maxV ? st.maxV + (targetMax - st.maxV) * 0.14 : targetMax;
    const maxV = st.maxV;
    // Classic keeps the High Score key on the same compact row as player keys.
    // Player labels are proportionally constrained only when the available
    // canvas width would otherwise push the gold dash beyond the right edge.
    if (packet) {
      ctx.font = '800 9px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const legendLabels = packet.series.map(s => String(s.name || '').replace(/^Record:/i,'HS').slice(0,12));
      let keyX = 26;
      const singleRowHs = perThrowRace && records.length;
      const keyGap = singleRowHs ? 6 : 12;
      const naturalWidths = legendLabels.map(label => ctx.measureText(label).width);
      let playerScale = 1;
      if (singleRowHs){
        const hsWidth = ctx.measureText('High Score').width;
        const playerWidth = naturalWidths.reduce((sum, width) => sum + width, 0);
        const playerSpace = Math.max(1, (cssW - 12) - keyX - hsWidth - 5 - 18 - (keyGap * legendLabels.length));
        if (playerWidth > playerSpace) playerScale = playerSpace / playerWidth;
      }
      packet.series.forEach((s, i) => {
        const label = legendLabels[i];
        const drawWidth = naturalWidths[i] * playerScale;
        ctx.fillStyle = s.color || '#7bdcff';
        if (playerScale < 1) ctx.fillText(label, keyX, 3, Math.max(1, drawWidth));
        else ctx.fillText(label, keyX, 3);
        keyX += drawWidth + keyGap;
      });
      if (singleRowHs){
        ctx.save();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,224,150,.88)';
        const hsLabel = 'High Score';
        ctx.fillText(hsLabel, keyX, 3);
        const hsDashX = keyX + ctx.measureText(hsLabel).width + 5;
        ctx.setLineDash([5,4]); ctx.strokeStyle = records[0].color || 'rgba(255,214,110,.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hsDashX, 8); ctx.lineTo(hsDashX + 18, 8); ctx.stroke();
        ctx.restore();
      }
    }
    const padL = 26, padR = 12, padT = perThrowRace ? 29 : (packet ? 19 : 8), padB = 18, W = cssW - padL - padR, H = cssH - padT - padB;
    const throwSteps = Math.max(1, rc * 3);
    const XStep = step => padL + (Math.max(0, Math.min(throwSteps, Number(step) || 0)) / throwSteps) * W;
    const X = i => perThrowRace ? XStep((i + 1) * 3) : padL + (rc <= 1 ? 0 : (i / (rc - 1)) * W);
    const Y = v => padT + H - (v / maxV) * H;
    // horizontal value grid + labels: a line every 50, a STRONGER line every 100.
    ctx.font = '800 8px system-ui,sans-serif'; ctx.textBaseline = 'middle';
    const nLines = Math.max(1, Math.floor(H / 24));
    const labelEvery = Math.max(50, Math.ceil(maxV / nLines / 50) * 50);   // thin the labels only when the scale is huge
    for (let val = 0; val <= maxV; val += 50){
      const yy = Y(val), strong = val % 100 === 0;
      ctx.strokeStyle = 'rgba(150,170,210,' + (val === 0 ? .3 : (strong ? .19 : .07)) + ')';
      ctx.lineWidth = strong ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + W, yy); ctx.stroke();
      if (val % labelEvery === 0){ ctx.fillStyle = strong ? 'rgba(184,202,234,.62)' : 'rgba(168,188,224,.4)'; ctx.textAlign = 'right'; ctx.fillText(String(val), padL - 4, yy); }
    }
    // vertical round grid + labels. Classic starts at START and divides every
    // round into three equal throw steps; other modes retain the existing grid.
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const cr = Number(state.currentRound || 0) - offset;
    if (perThrowRace){
      const sx = XStep(0);
      ctx.strokeStyle = 'rgba(150,170,210,.11)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, padT); ctx.lineTo(sx, padT + H); ctx.stroke();
      ctx.font = '800 7px system-ui,sans-serif'; ctx.fillStyle = 'rgba(160,178,208,.58)'; ctx.textAlign = 'center'; ctx.fillText('START', sx, padT + H + 4);
      ctx.font = '800 8px system-ui,sans-serif'; ctx.textAlign = 'center';
      for (let i = 0; i < rc; i++){
        for (let d = 1; d <= 2; d++){
          const subX = XStep(i * 3 + d);
          ctx.strokeStyle = 'rgba(150,170,210,.035)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(subX, padT); ctx.lineTo(subX, padT + H); ctx.stroke();
        }
        const xx = X(i), isCur = i === cr;
        ctx.strokeStyle = isCur ? 'rgba(255,138,20,.4)' : 'rgba(150,170,210,.08)'; ctx.lineWidth = isCur ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + H); ctx.stroke();
        ctx.fillStyle = isCur ? 'rgba(255,190,90,.95)' : 'rgba(160,178,208,.5)'; ctx.fillText(packet ? packet.labels[i] : __sqV3RoundLabel(i), xx, padT + H + 4);
      }
    } else {
      for (let i = 0; i < rc; i++){
        const xx = X(i), isCur = i === cr;
        ctx.strokeStyle = isCur ? 'rgba(255,138,20,.4)' : 'rgba(150,170,210,.07)'; ctx.lineWidth = isCur ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + H); ctx.stroke();
        ctx.fillStyle = isCur ? 'rgba(255,190,90,.95)' : 'rgba(160,178,208,.5)'; ctx.fillText(packet ? packet.labels[i] : __sqV3RoundLabel(i), xx, padT + H + 4);
      }
    }
    // HIGH-SCORE (record) pace — dashed gold reference line to race against
    for (const record of records){
      const recData = record.data;
      const recTo = Math.min(recData.length, rc);                  // plot the complete reference series
      const RP = perThrowRace ? [[XStep(0), Y(0)]] : [];
      for (let i = 0; i < recTo; i++){
        if (recData[i] == null) continue;
        const x = X(i), rawY = Y(recData[i]);
        if (rawY >= padT){ RP.push([x, rawY]); continue; }
        if (RP.length){
          const prev = RP[RP.length - 1], span = rawY - prev[1];
          const t = span ? Math.max(0, Math.min(1, (padT - prev[1]) / span)) : 1;
          RP.push([prev[0] + (x - prev[0]) * t, padT]);
        } else RP.push([x, padT]);
        break;
      }
      if (RP.length >= 2){
        ctx.save();
        ctx.setLineDash([5, 4]); ctx.strokeStyle = record.color || 'rgba(255,214,110,.9)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255,200,90,.6)'; ctx.shadowBlur = 6;
        ctx.beginPath(); RP.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.stroke();
        ctx.restore();
        if (!perThrowRace){
          const tip = RP[RP.length - 1];
          ctx.fillStyle = 'rgba(255,224,150,.95)'; ctx.font = '900 8px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText(String(record.label || 'HS'), Math.min(tip[0] + 3, cssW - 16), tip[1] - 2);
        }
      }
    }
    // player lines (same colours as each player's NAME on their pill)
    const colors = Array.from({ length: NP }, (_, i) => packet ? packet.series[i].color || __sqV3PlayerColor(i) : __sqV3PlayerColor(i));
    series.forEach((pts, pi) => {
      const P = []; for (let i = 0; i < pts.length; i++) if (pts[i] != null) P.push([perThrowRace ? XStep(i) : X(i), Y(pts[i])]);
      if (!P.length) return;
      // Resolve this player's segment animation into an ease + charge amount.
      // A completed great combo (st.combo) overrides the ordinary growth ease with
      // a "charge then zoom": the head holds + builds energy, then snaps out fast.
      const combo = st.combo[pi], grow = st.grow[pi];
      let segT = 1, ease = 1, charge = 0, zoomV = 0;
      if (combo){
        const t = (now - combo.start) / combo.dur;
        const chargeFrac = 0.44;                            // hold + charge, then zoom
        if (t < chargeFrac){ segT = 0; charge = Math.min(1, t / chargeFrac); }
        else { const zt = Math.min(1, (t - chargeFrac) / (1 - chargeFrac)); segT = zt; ease = 1 - Math.pow(1 - zt, 2.6); charge = 1; zoomV = 1 - zt; }
        if (t >= 1){ if (!combo.fired){ combo.fired = true; st.burst[pi] = { start: now, x: P[P.length-1][0], y: P[P.length-1][1] }; } st.combo[pi] = null; }
      } else if (grow){
        const t = (now - grow.start) / 450;
        segT = Math.min(1, t); ease = 1 - Math.pow(1 - segT, 3);
      }
      ctx.setLineDash(perThrowRace ? [1.5,3.5] : (packet && packet.series[pi].dotted ? [5,4] : []));
      ctx.strokeStyle = colors[pi]; ctx.lineWidth = perThrowRace ? 1.7 : 2.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalAlpha = perThrowRace ? 0.58 : 1;
      ctx.shadowColor = colors[pi]; ctx.shadowBlur = perThrowRace ? 4 : 10;
      ctx.beginPath();
      let lx = P[P.length-1][0], ly = P[P.length-1][1], ppx = lx, ppy = ly;
      for (let i = 0; i < P.length; i++){
        let x = P[i][0], y = P[i][1];
        if (i === P.length - 1 && P.length >= 2 && segT < 1){ const px = P[i-1][0], py = P[i-1][1]; ppx = px; ppy = py; x = px + (x-px)*ease; y = py + (y-py)*ease; lx = x; ly = y; }
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      // Comet trail: while a big segment zooms, streak a bright tail behind the head.
      if (combo && zoomV > 0 && P.length >= 2){
        ctx.save();
        const grd = ctx.createLinearGradient(ppx, ppy, lx, ly);
        grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, colors[pi]);
        ctx.strokeStyle = grd; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; ctx.globalAlpha = 0.6 + 0.4 * zoomV;
        ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.restore();
      }
      // Charging glow: before the zoom, energy builds at the held head.
      if (charge > 0 && charge < 1){
        const cr2 = 4 + 6 * charge, a = 0.25 + 0.5 * charge;
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2 + charge;
        ctx.shadowColor = colors[pi]; ctx.shadowBlur = 10 + 18 * charge;
        ctx.beginPath(); ctx.arc(lx, ly, cr2 + (now/60 % 6), 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(lx, ly, cr2 * 0.6, 0, 7); ctx.stroke();
        ctx.restore();
      }
      // pulsing leading dot + halo
      const pr = (3.6 + 1.5 * Math.sin(now/240 + pi)) * (1 + 0.5 * charge * (1 - charge) * 4);
      ctx.fillStyle = colors[pi]; ctx.shadowColor = colors[pi]; ctx.shadowBlur = 14 + 16 * charge;
      ctx.beginPath(); ctx.arc(lx, ly, pr, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = colors[pi]; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(lx, ly, pr + 3 + 2*Math.sin(now/240 + pi), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      // Burst ring on a landed combo — an expanding shockwave that fades out.
      const bu = st.burst[pi];
      if (bu){
        const bt = (now - bu.start) / 520;
        if (bt >= 1){ st.burst[pi] = null; }
        else {
          const rr = 4 + bt * 26, al = (1 - bt);
          ctx.save(); ctx.globalAlpha = al * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * (1 - bt) + 0.6;
          ctx.shadowColor = colors[pi]; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(bu.x, bu.y, rr, 0, 7); ctx.stroke();
          ctx.globalAlpha = al * 0.5; ctx.strokeStyle = colors[pi];
          ctx.beginPath(); ctx.arc(bu.x, bu.y, rr * 0.6, 0, 7); ctx.stroke();
          ctx.restore();
        }
      }
    });
}


// Fetch each player's level once and stamp a "LV n" chip on their V3 card.
async function __sqV3EnsureLevels(panel){
  try{
    if (!window.SQ_XP || typeof SQ_XP.forName !== 'function') return;
    window.__sqV3Levels = window.__sqV3Levels || {};
    const rawName = i => String((state.players[i] && (state.players[i].name || state.players[i].player)) || '').trim();
    let changed = false;
    for (let i = 0; i < (state.players || []).length; i++){
      const n = rawName(i); if (!n) continue;
      const key = n.toLowerCase();
      if (window.__sqV3Levels[key] == null){
        try{ const xr = await SQ_XP.forName(n); window.__sqV3Levels[key] = (xr && Number(xr.total_xp) > 0) ? SQ_XP.levelForXp(xr.total_xp) : 0; }
        catch(_){ window.__sqV3Levels[key] = 0; }
        changed = true;
      }
    }
    if (changed){
      for (let i = 0; i < (state.players || []).length; i++){
        const lvl = window.__sqV3Levels[rawName(i).toLowerCase()];
        if (!lvl) continue;
        const idEl = panel.querySelector('.v3-side[data-p="' + i + '"] .v3-cardtop');
        if (!idEl) continue;
        let chip = idEl.querySelector('.v3-lvl');
        if (!chip){ chip = document.createElement('span'); chip.className = 'v3-lvl'; idEl.appendChild(chip); }
        chip.textContent = 'LV ' + lvl;
      }
    }
  }catch(_){ }
}

function __sqLiveV3Render(){
  const escV3 = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s == null ? '' : s));
  const host = (document.getElementById('liveV2Panel') || {}).parentElement
            || document.querySelector('#game .card.section')
            || document.getElementById('game');
  if (!host) return;

  let panel = document.getElementById('liveV3Panel');
  if (!panel){
    panel = document.createElement('div');
    panel.id = 'liveV3Panel';
    const v2 = document.getElementById('liveV2Panel');
    if (v2) host.insertBefore(panel, v2); else host.prepend(panel);
  }

  const r  = Math.max(0, Math.min(state.currentRound, MAX_ROUNDS - 1));
  const cp = state.currentPlayer || 0;
  const NP = (state.players || []).length || 2;         // 2 or 4 (see __sqLiveV3Eligible)
  const dart = Math.max(0, Math.min(state.currentDart || 0, 3));
  const totals = Array.from({ length: NP }, (_, i) => __sqV3TotalFor(i));
  const topTotal = Math.max(...totals);
  const numAtTop = totals.filter(t => t === topTotal).length;
  const leader = numAtTop > 1 ? -1 : totals.indexOf(topTotal);   // sole leader, or -1 if tied at top
  const wins = (state.match && state.match.wins) || [0, 0];
  const targetWins = Math.max(1, Number(state.match && state.match.targetWins) || 1);
  const pbs = window.__sqV3PBs || new Map();
  if (!window.__sqV3PBs) __sqLiveV3LoadPBs();
  if (!window.__sqV3AvgRecords) __sqV3LoadAvgRecords();

  // Big-total colour: GREEN when a player is leading, PURPLE once their running
  // total is ahead of the all-time record pace at the same number of rounds.
  const recPace = (window.__sqV3RecordPace && Array.isArray(window.__sqV3RecordPace.data)) ? window.__sqV3RecordPace.data : null;
  const totalRecClass = (i) => {
    if (leader !== i) return '';                 // only the player out in front is coloured
    if (recPace){
      const b = (state.score && state.score[i]) || []; let done = 0;
      for (let ri = 0; ri < b.length; ri++){ const e = b[ri]; if (e && e.darts && e.darts.some(d => d != null)) done = ri + 1; }
      if (done > 0){ const rec = recPace[Math.min(done - 1, recPace.length - 1)]; if (rec != null && totals[i] > rec) return 'lead-record'; }  // ahead of world-record pace
    }
    return 'leading';
  };

  const pName = i => String((state.players[i] && (state.players[i].name || state.players[i].player)) || ('P' + (i + 1)));
  const pNick = i => String((state.players[i] && state.players[i].nickname) || '').trim();
  const entryOf = (p, ri) => (state.score && state.score[p] && state.score[p][ri]) || null;

  // Render-signature guard: skip redundant re-renders (updateUI can fire more
  // than once per throw) so in-flight one-shot animations are never cut short.
  const curEntrySig = entryOf(cp, r);
  const sig = [r, cp, dart, NP, (window.__sqV3Hold && performance.now() < window.__sqV3Hold.until) ? 'H' : '-', (window.__sqV3Combo ? (window.__sqV3Combo.leaving ? 'CL' : 'C') : '-'), totals.join(','), Number((curEntrySig && curEntrySig.roundTotal) || 0),
               (wins || []).slice(0, NP).join('x'), state.finished ? 1 : 0,
               Array.from({ length: NP }, (_, i) => pName(i)).join('~')].join('|');
  if (panel.isConnected && panel.dataset.sig === sig && panel.childElementCount) return;
  panel.dataset.sig = sig;

  const winDots = i => {
    let out = '';
    for (let k = 0; k < Math.min(targetWins, 5); k++){
      out += `<i class="${k < (wins[i] || 0) ? 'on' : ''}"></i>`;
    }
    return `<span class="v3-wins"><span class="v3-wins-lab">GAMES</span><span class="v3-windots">${out}</span></span>`;
  };

  const diffBadge = i => {
    // Sole leader: how far ahead of 2nd place. Everyone else: how far behind the top.
    const sorted = [...totals].sort((a, b) => b - a);
    const second = sorted[1] != null ? sorted[1] : 0;
    if (leader === i){ const d = totals[i] - second; return `<span class="v3-diff up">▲ +${d}</span>`; }
    if (totals[i] === topTotal) return '<span class="v3-diff even">EVEN</span>';   // tied at the top
    return `<span class="v3-diff down">▼ ${topTotal - totals[i]}</span>`;
  };

  // A round entry counts as complete once all 3 darts are in, or it is a past
  // round; the active player's in-progress round lives in the centre column.
  const roundComplete = (p, ri, e) => {
    if (!__sqV3RoundThrown(e)) return false;
    const full = e.darts && e.darts.filter(d => d).length >= 3;
    return full || ri < r;
  };

  // Every completed round, most recent first — the outer column scrolls so older
  // scores stay reachable (the bottom grid is gone).
  const lastRounds = (p) => {
    const items = [];
    for (let ri = r; ri >= 0; ri--){
      const e = entryOf(p, ri);
      if (!roundComplete(p, ri, e)) continue;
      const best = __sqV3RoundThrown(entryOf(1 - p, ri)) && Number(e.roundTotal || 0) > Number(entryOf(1 - p, ri).roundTotal || 0);
      items.push(`<div class="v3-rr${best ? ' best' : ''}"><span class="v3-rr-lab">R${ri + 1}</span><span class="v3-rr-tot">${Number(e.roundTotal || 0)}</span><span class="v3-rr-marks">${__sqV3Marks(e).replace(/ \/ /g, '<i>·</i>')}</span></div>`);
    }
    if (!items.length) return '<div class="v3-rr-none">—</div>';
    return items.join('');
  };

  // Averages: 3-dart avg = mean points per completed round; game avg = mean
  // points per dart actually thrown. '--' until there is anything to average.
  // Both averages are in POINTS-PER-ROUND (a round = 3 darts), so the units match.
  //  • 3 ROUND AVG = mean over the player's last up-to-3 completed rounds (form).
  //  • GAME AVG    = mean over every completed round this game.
  const playerAverages = (p) => {
    const b = (state.score && state.score[p]) || [];
    const roundPts = [];
    b.forEach((e, ri) => { if (e && e.darts && roundComplete(p, ri, e)) roundPts.push(Number(e.roundTotal || 0)); });
    const mean = arr => arr.length ? (arr.reduce((a, c) => a + c, 0) / arr.length) : null;
    const game = mean(roundPts);
    const r3 = mean(roundPts.slice(-3));
    return { a3: r3 == null ? '--' : r3.toFixed(1), ga: game == null ? '--' : game.toFixed(1),
             a3n: r3, gan: game, done: roundPts.length };
  };

  const playerCard = (i, area) => {
    const active = i === cp;
    const lr = i % 2 === 0 ? 'p1' : 'p2';               // left column = p1, right = p2
    const col = __sqV3PlayerColor(i);                   // name colour == race line colour
    const __lvl = (window.__sqV3Levels || {})[String(pName(i)).trim().toLowerCase()];
    const lvlChip = __lvl ? `<span class="v3-lvl">LV ${__lvl}</span>` : '';
    const avg = playerAverages(i);
    const nmLower = String(pName(i)).trim().toLowerCase();
    const a3cls = __sqV3AvgRecClass('a3', avg.a3n, avg.done, nmLower);
    const gacls = __sqV3AvgRecClass('ga', avg.gan, avg.done, nmLower);
    return `<div class="v3-side ${lr}" data-p="${i}"${area ? ` style="grid-area:${area}"` : ''}>
      <div class="v3-card ${active ? 'active' : 'waiting'} ${lr}">
        <div class="v3-card-sheen" aria-hidden="true"></div>
        <div class="v3-cardtop">${winDots(i)}${lvlChip}</div>
        <div class="v3-name" style="color:${col}${active ? `;text-shadow:0 0 18px ${col}59` : ''}">${escV3(pName(i).split(' ')[0].toUpperCase())}</div>
        <div class="v3-total ${totalRecClass(i)}">${totals[i]}</div>
        ${diffBadge(i)}
        <div class="v3-foot ${lr}">
          <div class="v3-foot-prev">${lastRounds(i)}</div>
          <div class="v3-foot-div" aria-hidden="true"></div>
          <div class="v3-foot-avgs">
            <div class="v3-avg ${a3cls}"><span class="v3-avg-val">${avg.a3}</span><span class="v3-avg-lab">3 RND AVG</span></div>
            <div class="v3-avg ${gacls}"><span class="v3-avg-val">${avg.ga}</span><span class="v3-avg-lab">GAME AVG</span></div>
          </div>
        </div>
      </div>
    </div>`;
  };
  const edgeForm = (i, area) => `<div class="v3-edge-form ${i % 2 === 0 ? 'p1' : 'p2'}" data-p="${i}"${area ? ` style="grid-area:${area}"` : ''}>
      <div class="v3-ef-track">
        <div class="v3-ef-fill"><span class="v3-ef-tip" aria-hidden="true"></span><span class="v3-ef-spark" aria-hidden="true"></span></div>
        <div class="v3-ef-segs" aria-hidden="true"></div>
      </div>
      <div class="v3-ef-streak" aria-hidden="true"></div>
      <div class="v3-ef-cap">FORM</div>
    </div>`;

  const curEntry = entryOf(cp, r);
  // All three dots start lit; one goes out (right-to-left) after each throw.
  const dartDots = [0,1,2].map(k => `<i class="${k < (3 - dart) ? 'on' : ''}"></i>`).join('');
  const roundDef = ROUNDS[r] || {};
  const targetLabel = roundDef.type === 'number' ? String(roundDef.target)
    : roundDef.type === 'doubles' ? 'DOUBLES'
    : roundDef.type === 'triples' ? 'TREBLES' : 'BULL';
  // Word targets (DOUBLES / TREBLES / BULL) need a smaller size than a 2-digit
  // number or they run off the narrow stem.
  const targetLong = targetLabel.length > 4 ? ' long' : (targetLabel.length > 2 ? ' mid' : '');

  // Centre column (DART indicator + ROUND SCORE). `area` sets its grid-area for
  // the 4-player layout, where it spans both pill rows down the middle.
  // End-of-round freeze: keep showing the round that just finished (score + full
  // dart track) until the hold expires or a pad button is pressed.
  const hold = (window.__sqV3Hold && performance.now() < window.__sqV3Hold.until) ? window.__sqV3Hold : null;
  const stemEntry = hold ? hold.entry : curEntry;
  const stemDart = hold ? 3 : dart;

  // Dart track: one slot per dart. A thrown dart shows what it actually scored
  // (T / D / S / 50 / X); the next slot to throw pulses; the rest sit empty.
  // Replaces the old DART x OF 3 label + pips + separate marks row.
  const trackSlots = [0, 1, 2].map(k => {
    const d = (stemEntry && stemEntry.darts) ? stemEntry.darts[k] : null;
    if (d){
      const mk = __sqV3Mark(d);
      const cls = (d.kind === 'Miss') ? 'miss'
                : (d.kind === 'T' || d.kind === 'Triple') ? 'treble'
                : (d.kind === 'D' || d.kind === 'Double') ? 'double'
                : (d.kind === 'B') ? 'bull' : 'single';
      return `<span class="v3-slot done ${cls}">${escV3(mk)}</span>`;
    }
    const next = (k === stemDart) && !state.finished;
    return `<span class="v3-slot${next ? ' next' : ''}"><i></i></span>`;
  }).join('');

  // Combo takeover: the whole stem becomes the stage for a combo/trophy.
  const cb = (window.__sqV3Combo && performance.now() < window.__sqV3Combo.until) ? window.__sqV3Combo : null;
  const comboStage = cb ? `<div class="v3-combo-stage ${escV3(cb.tier || 'gold')}${cb.big ? ' big' : ''}${cb.leaving ? ' leaving' : ''}">
              <span class="v3-cs-flash" aria-hidden="true"></span>
              <span class="v3-cs-rays" aria-hidden="true"></span>
              <span class="v3-cs-bolts" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
              <span class="v3-cs-ring" aria-hidden="true"></span>
              <span class="v3-cs-ring r2" aria-hidden="true"></span>
              <span class="v3-cs-spark" aria-hidden="true">${'<b></b>'.repeat(10)}</span>
              <span class="v3-cs-lab">${escV3(cb.lab || 'COMBO')}</span>
              <span class="v3-cs-name">${escV3(cb.name || '')}</span>
            </div>` : '';

  const cOut = !cb && window.__sqV3ComboOut && performance.now() < window.__sqV3ComboOut;
  const centreHtml = (area) => `<div class="v3-centre"${area ? ` style="grid-area:${area}"` : ''}>
          <div class="v3-ctop${cb ? ' comboing ' + escV3(cb.tier || 'gold') + (cb.leaving ? ' leaving' : '') : (cOut ? ' combo-out' : '')}">
            <div class="v3-stem-scan" aria-hidden="true"></div>
            ${comboStage}
            <div class="v3-sb-target"><span class="v3-sbt-lab">TARGET</span><span class="v3-sbt-val${targetLong}">${targetLabel}</span></div>
            <div class="v3-scorebox">
              <div class="v3-sb-glow" aria-hidden="true"></div>
              <div class="v3-sb-lab">ROUND SCORE</div>
              <div class="v3-sb-num${hold ? ' v3-held' : ''}">${Number((stemEntry && stemEntry.roundTotal) || 0)}</div>
            </div>
            <div class="v3-darttrack">${trackSlots}</div>
          </div>
        </div>`;

  panel.innerHTML = `
    <div class="v3-topbar">
      <button id="v3SoundBtn" class="v3-tb-snd" type="button" aria-label="Toggle sound"></button>
      <div class="v3-tb-display" id="v3TbDisplay" data-target="${escV3(targetLabel)}">
        <span class="v3-tb-scan" aria-hidden="true"></span>
        <span class="v3-tb-lab">TO THROW</span>
        <span class="v3-tb-val">${escV3(String(pName(cp) || '').split(' ')[0].toUpperCase())}</span>
      </div>
      <button id="v3MenuBtn" class="v3-tb-menu" type="button" aria-label="Game menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
    <div class="v3-body${NP === 4 ? ' v3-4p' : NP === 3 ? ' v3-3p' : ''}">
      <div class="v3-main${NP === 4 ? ' v3-4p' : NP === 3 ? ' v3-3p' : ''}">
        ${NP === 4
          ? `${edgeForm(0, 'f0')}${playerCard(0, 'c0')}${centreHtml('mid')}${playerCard(1, 'c1')}${edgeForm(1, 'f1')}` +
            `${edgeForm(2, 'f2')}${playerCard(2, 'c2')}${playerCard(3, 'c3')}${edgeForm(3, 'f3')}`
          : NP === 3
          ? `${edgeForm(0, 'f0')}${playerCard(0, 'c0')}${centreHtml('mid')}${playerCard(1, 'c1')}${edgeForm(1, 'f1')}` +
            `${edgeForm(2, 'f2')}${playerCard(2, 'c2')}`
          : `${edgeForm(0)}${playerCard(0)}${centreHtml('')}${playerCard(1)}${edgeForm(1)}`}
      </div>
      <div class="v3-screen">
        <div class="v3-race-frame">
          <div class="v3-race-bezel"><canvas id="v3RaceCanvas" class="v3-race"></canvas></div>
        </div>
      </div>
    </div>`;

  // Boot the animated GAME RACE (the only screen content now — dot-matrix removed).
  try{ __sqV3RaceEnsure(); }catch(_){ }

  const sndBtn = document.getElementById('v3SoundBtn');
  if (sndBtn){
    const SND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16.5 8.6a5 5 0 0 1 0 6.8M19 6a8.6 8.6 0 0 1 0 12"/></svg>';
    const SND_ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M17 9.5l4.5 5M21.5 9.5l-4.5 5"/></svg>';
    const paintSnd = () => {
      const on = __sqV3SoundOn();
      sndBtn.innerHTML = on ? SND_ICON : SND_ICON_OFF;
      sndBtn.classList.toggle('muted', !on);
      sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    paintSnd();
    sndBtn.onclick = () => {
      const next = !__sqV3SoundOn();
      __sqV3SetSound(next);
      paintSnd();
      if (next){ __sqV3Ac(); __sqV3SndRound(); }   // confirm within the tap gesture
    };
  }

  const menuBtn = document.getElementById('v3MenuBtn');
  if (menuBtn) menuBtn.onclick = () => {
    try{ if (typeof window.__sqOpenGameMenu106 === 'function') return window.__sqOpenGameMenu106(); }catch(_){ }
    try{ document.getElementById('settingsBtnGame')?.click(); }catch(_){ }
  };

  // Fire one-shot arcade animations for anything that changed this render.
  try{ __sqV3Animate(panel); }catch(_){ }
  try{ __sqV3FormView(panel); }catch(_){ }
  try{ __sqV3EnsureLevels(panel); }catch(_){ }
}

function __sqSkippedRoundState(pIdx, rIdx){
  try{
    const jobs=Array.isArray(state?.__sqCatchUp?.jobs)?state.__sqCatchUp.jobs:[];
    for(const job of jobs){
      if(!job || job.kind!=='absence' || Number(job.playerIndex)!==Number(pIdx)) continue;
      const pending=Array.isArray(job.pendingRounds)?job.pendingRounds:[];
      if(pending.some(x=>Number(x)===Number(rIdx))) return 'pending';
      const scratched=Array.isArray(job.scratchedRounds)?job.scratchedRounds:[];
      if(scratched.some(x=>Number(x)===Number(rIdx))) return 'scratched';
    }
  }catch(_){}
  return '';
}
function __sqIsSkippedRoundCell(pIdx, rIdx){
  return !!__sqSkippedRoundState(pIdx, rIdx);
}

window.__sqLiveV3Sync = function(){
  try{
    const onGame = document.body && document.body.dataset.page === 'game';
    const active = onGame && __sqLiveV3Eligible();
    const panel = document.getElementById('liveV3Panel');
    const v2 = document.getElementById('liveV2Panel');
    if (!active){
      if (panel){ panel.remove(); }
      // Undo the forced hide (LiveV2's own CSS wins again).
      if (v2) v2.style.removeProperty('display');
      document.body.classList.remove('livev3-on');
      return;
    }
    document.body.classList.add('livev3-on');
    // LiveV2's show rules outrank stylesheet hides, so force via inline priority.
    if (v2) v2.style.setProperty('display', 'none', 'important');
    __sqLiveV3Render();
  }catch(e){ try{ console.warn('[SQ] LiveV3 sync failed', e); }catch(_){ } }
};

function updateUI() {
  try {
  try{ if (typeof __sqSyncTurboVisualState === 'function') __sqSyncTurboVisualState(document.body?.dataset?.page || ''); }catch(_){}
  if (!tbody) return;

  // Clear previous highlights
  document.querySelectorAll('.current-cell, .current-col').forEach(el => {
    el.classList.remove('current-cell', 'current-col');
  });

  // Active round label (left column): big + bold only for current round
  try {
    for (let r = 0; r < MAX_ROUNDS; r++) {
      const th = document.getElementById(`roundth-${r}`);
      if (!th) continue;
      th.classList.remove('active-round-label');
    }
    const cr = state.currentRound;
    const thActive = document.getElementById(`roundth-${cr}`);
    if (thActive) thActive.classList.add('active-round-label');
    try{ updateRoundBar(); }catch(_){ }
  } catch(_) {}
// --- Precompute per-round totals to find best round per row ---
  const roundTotals    = Array.from({ length: MAX_ROUNDS }, () => Array(state.players.length).fill(0));
  const roundHasScore  = Array.from({ length: MAX_ROUNDS }, () => Array(state.players.length).fill(false));

  for (let p = 0; p < state.players.length; p++) {
    for (let r = 0; r < MAX_ROUNDS; r++) {
      const entry   = state.score?.[p]?.[r];
      const hasDart = !!(entry && entry.darts && entry.darts.some(d => d));

      if (!entry || !hasDart) continue;

      const rt = entry.roundTotal || 0;
      roundTotals[r][p]   = rt;
      roundHasScore[r][p] = true;
    }
  }

  const maxRoundTotals = roundTotals.map(row =>
    row.length ? Math.max(...row) : 0
  );

  // --- Fill cells: rolling total + (round score) + best-round highlight ---
  for (let p = 0; p < state.players.length; p++) {
    let running = 0;

    for (let r = 0; r < MAX_ROUNDS; r++) {
      const td = byId(`cell-${p}-${r}`);
      if (!td) continue;

      const entry      = state.score?.[p]?.[r];
      const hasDart    = roundHasScore[r][p];
      const roundTotal = hasDart ? (entry?.roundTotal || 0) : 0;
      const skipState  = __sqSkippedRoundState(p, r);
      const hasCatchUpDart = Array.isArray(entry?.darts) && entry.darts.some(d=>d && d.kind!=='Scratch');

      const mainEl = byId(`cell-main-${p}-${r}`);
      const subEl  = byId(`cell-sub-${p}-${r}`);

      if (hasDart) {
        running += roundTotal;
        if (mainEl) mainEl.textContent = String(running);
        if (subEl) {
          subEl.classList.toggle('sq-skip-cell-mark', skipState === 'pending');
          subEl.classList.toggle('sq-skip-cell-scratched', skipState === 'scratched');
          subEl.classList.remove('sub-win');
          if (skipState === 'pending' && !hasCatchUpDart) {
            subEl.textContent = '»»»';
          } else if (skipState === 'scratched') {
            subEl.textContent = 'X';
          } else {
            subEl.textContent = `(${roundTotal})`;
            if (roundTotal > 0 && roundTotal === maxRoundTotals[r]) {
              // highest round score this row – green
              subEl.classList.add('sub-win');
            }
          }
        }
      } else {
        if (mainEl) mainEl.textContent = '–';
        if (subEl) {
          subEl.classList.toggle('sq-skip-cell-mark', skipState === 'pending');
          subEl.classList.toggle('sq-skip-cell-scratched', skipState === 'scratched');
          subEl.textContent = skipState === 'pending' ? '»»»' : (skipState === 'scratched' ? 'X' : '');
          subEl.classList.remove('sub-win');
        }
      }

      td.classList.remove('current-cell', 'current-col');
      if (p === state.currentPlayer) {
        td.classList.add('current-col');
      }
    }
  }

  // Highlight the current cell (round + player)
  const cp = state.currentPlayer;
  const cr = state.currentRound;

  // B2 name color: white by default, Shateki orange for current player's go
  try{
    const nameCells = document.querySelectorAll('#floatThead tr:first-child th.player');
    nameCells.forEach((th, idx) => th.classList.toggle('is-go', idx === cp));
  }catch(_){}
  const currentCell = byId(`cell-${cp}-${cr}`);
  if (currentCell) {
    currentCell.classList.add('current-cell');
    currentCell.classList.add('current-col');
  }
  
 // Current round label in floating header (single column)
const roundLabelEl = byId('froundlabel');
if (roundLabelEl) {
  const lbl = labelForRound(ROUNDS[state.currentRound]) || '';
  // DMD Zone 1 context: keep current round/phase visible
  try{
    if (window.sqDmdShowZ1){
      const prevRaw = (typeof window.__sqDmdLastZ1 === 'string') ? window.__sqDmdLastZ1 : '';
      const prev = prevRaw.includes('\n') ? prevRaw.split(/\n/).pop() : prevRaw;
      const n = parseInt(lbl, 10);
      const z1 = (!Number.isNaN(n) && n > 0) ? (n) :
                 (String(lbl||'').toUpperCase().includes('DOUBLE') ? 'DBL' :
                  String(lbl||'').toUpperCase().includes('TRIPLE') ? 'TRB' :
                  String(lbl||'').toUpperCase().includes('BULL') ? 'BULL' :
                  String(lbl||'').toUpperCase().slice(0,4));
      if (z1 && z1 !== prev) window.sqDmdShowZ1(`ROUND
${z1}`, { type:'hold', ms: 450 });
    }
  }catch(_) {}
  roundLabelEl.innerHTML = `
    <div class="round-now">
      <div class="rn-label">TARGET</div>
      <div class="rn-value">${lbl}</div>
      <div id="fgoDarts" class="go-darts" aria-label="Current go"></div>
    </div>
  `;
  try{
    const goEl = byId('fgoDarts');
    if (goEl) goEl.innerHTML = renderSharedGoIndicatorHTML();

    // Animated C underline (slides between players)
    updateTurnBar();

  } catch(_) {}
}

  // --- update floating header (wins, totals, diffs, turn arrow, throws remaining) ---
  const totals = state.players.map((_, i) => totalScoreForPlayer(i));
  const max    = totals.length ? Math.max(...totals) : 0;
  const targetWins = state.match.targetWins || 1;
  for (let i = 0; i < state.players.length; i++) {
    
    // Totals
    const totalEl = byId('ftotal-' + i);
    if (totalEl) {
      totalEl.textContent = String(totals[i] || 0);
      totalEl.classList.remove('leader-total');
      if (max > 0 && totals[i] === max) {
        // overall leader(s) – green total
        totalEl.classList.add('leader-total');
      }
    }

    // Diff
    const diffEl = byId('fdiff-' + i);
    if (diffEl) {
      const diff = totals[i] - max;
      diffEl.textContent = String(diff);
    }
    // Match progress (wins) – stars for wins, circles for remaining games
    const winsEl = byId('fwins-' + i);
    if (winsEl) {
      const wins = state.match?.wins?.[i] || 0;
      const firstTo = state.match?.targetWins || 1;
      let html = "";
      for (let k = 0; k < firstTo; k++) {
        html += (k < wins) ? "<span class=\"win-star\">★<\/span>" : "<span class=\"win-circle\">○<\/span>";
      }
      winsEl.innerHTML = html;
}
  }

  // --- end-of-game banner ---
 const banner = byId('endBanner');
  if (banner) {
    banner.classList.add('hidden');
    banner.textContent = '';
  }

  // --- match stats table (hidden but kept in sync) ---
  try {
    updateMatchStats();
  } catch (e) {
    console.error(e);
  }

  // --- auto-scroll scoreboard to keep last 4 rounds visible ---
  try { autoScrollScoreboard();
  liveV2Render(); } catch(_){}

  // --- rebuild throw pad + layout + save ---
  buildPad();
  updatePadSpacer();

  // Keep collapsing header + animated indicators aligned even when the user doesn't scroll
  try {
    updateFHCollapse('game');
    requestAnimationFrame(() => {
      try { updateTurnBar(null); } catch(_){ }
      try { updateRoundBar(null, false); } catch(_){ }
    });
  } catch(_){ }

  save();
  } catch (e) {
    console.error('[GAME] updateUI failed:', e);
    try { __sqGameRenderFailsafe(e); } catch(_) {}
  }
  try{ window.__sqLiveV3Sync && window.__sqLiveV3Sync(); }catch(_){ }
}

function __sqGameRenderFailsafe(err){
  // 1) show a visible banner (non-blocking)
  try{
    const game = document.getElementById('game');
    if (game && !game.querySelector('.sq-failsafe-banner')){
      const b = document.createElement('div');
      b.className = 'sq-failsafe-banner';
      b.style.cssText = `
        margin:10px 0 12px;
        padding:10px 12px;
        border-radius:12px;
        border:1px solid rgba(255,120,0,.28);
        background: rgba(120,60,10,.18);
        color: rgba(231,233,245,.92);
        font-weight:800;
        letter-spacing:.02em;
      `;
      b.textContent = 'UI RECOVERY MODE — scoreboard render failed. Controls still live.';
      game.prepend(b);
    }
  }catch(_){ }

  // 2) ensure throw pad stays usable
  try{ buildPad(); }catch(_){ }
  try{ updatePadSpacer(); }catch(_){ }

  // 3) if tbody is empty, create a minimal placeholder so it never looks dead
  try{
    if (!tbody) return;
    if (tbody.children && tbody.children.length) return;

    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 99;
    td.style.padding = '14px 10px';
    td.style.color = 'rgba(231,233,245,.75)';
    td.style.fontWeight = '700';
    td.textContent = 'Scoreboard temporarily unavailable. Keep playing — data is still being recorded.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }catch(_){ }

  // 4) surface the error message in console
  try{
    const msg = String(err?.message || err || '');
    if (msg) console.warn('[GAME] failsafe message:', msg);
  }catch(_){ }
}

/* >>> INSERT THESE TWO NEW FUNCTIONS <<< */
