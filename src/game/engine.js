// ===== @SEC:JS:GAME:ENGINE =====
// @CANONICAL:GAMEPLAY_RECORD_THROW_BASE
function recordThrow(spec){
  try{ window.__sqDmdStopPreThrow?.(); }catch(_){ }
  // Ignore input if game is finished or in sudden death
  if (state.finished || state.suddenDeath.active) return;
  if (typeof __sqVsShadowCurrentPlayerIsShadow === 'function' && __sqVsShadowCurrentPlayerIsShadow()) {
    if (typeof __sqHandleVsShadowManualShadowInput === 'function') __sqHandleVsShadowManualShadowInput('recordThrow');
    return;
  }

  const rIndex    = state.currentRound;
  const pIndex    = state.currentPlayer;
  const dartIndex = state.currentDart;

  if (rIndex < 0 || rIndex >= MAX_ROUNDS) return;
  if (pIndex < 0 || pIndex >= state.players.length) return;
  if (dartIndex < 0 || dartIndex > 2) return;

  const wasFinished = state.finished;

  const board = state.score[pIndex];
  if (!board) return;
  const entry = board[rIndex];
  if (!entry) return;
  if (!entry.darts) entry.darts = [null, null, null];

  const roundDef = ROUNDS[rIndex];

  let points = 0;
  let hitKey = null;
  let dartObj;

  if (spec.kind === 'Miss') {
    dartObj = { kind: 'Miss', points: 0 };
  } else if (roundDef.type === 'number') {
    const base = roundDef.target;
    if (spec.kind === 'S')      points = base;
    else if (spec.kind === 'D') points = base * 2;
    else if (spec.kind === 'T') points = base * 3;

    dartObj = { kind: spec.kind, points };
    hitKey  = String(base);
  } else if (roundDef.type === 'doubles' || roundDef.type === 'triples') {
    const sector = spec.sector || 0;
    if (!sector) {
      dartObj = { kind: 'Miss', points: 0 };
    } else {
      const mult = roundDef.type === 'doubles' ? 2 : 3;
      points = sector * mult;
      dartObj = {
        kind: roundDef.type === 'doubles' ? 'Double' : 'Triple',
        sector,
        points
      };
      hitKey = String(sector);
    }
  } else if (roundDef.type === 'bull') {
    const bull = spec.bull || 'Outer';
    points = bull === 'Inner' ? 50 : 25;
    dartObj = { kind: 'B', bull, points };
    hitKey  = 'B';
  } else {
    dartObj = { kind: 'Miss', points: 0 };
  }

  // Write dart
  entry.darts[dartIndex] = dartObj;
  entry.roundTotal =
    (entry.darts[0]?.points || 0) +
    (entry.darts[1]?.points || 0) +
    (entry.darts[2]?.points || 0);

  /* >>> PATCH:SQ_DMD_STAGE2_THROW_QUALITY START */
// Stage 2: Throw-quality scenes + Zone layout responsibilities
// Z1 = current round/phase, Z2 = main callout, Z3 = per-turn throw sequence (S20 / X / T18)
try {
  const pCode = (state.players?.[pIndex]?.initials || state.players?.[pIndex]?.code || state.players?.[pIndex] || '').toString().trim().toUpperCase();
  const pm = (window.__sqDmdGetPlayerMeta ? window.__sqDmdGetPlayerMeta(pCode) : null);
  const who = (pm && pm.code) ? pm.code : (pCode || '');
  const kind = (dartObj && dartObj.kind) ? String(dartObj.kind) : '';
  const pts  = (dartObj && typeof dartObj.points === 'number') ? dartObj.points : (points||0);

  // ----- Zone 1: round/phase -----
  let z1 = '';
  if (roundDef?.type === 'number') z1 = `${roundDef.target}`;
  else if (roundDef?.type === 'doubles') z1 = 'DBL';
  else if (roundDef?.type === 'triples') z1 = 'TRL';
  else if (roundDef?.type === 'bull') z1 = 'BULL';
  else z1 = `${(rIndex+1)}`;

  z1 = `ROUND\n${z1}`;

  // ----- Zone 3: per-turn sequence (most informative) -----
  function fmtToken(d){
    if (!d) return '';
    const k = String(d.kind || d.type || '').trim();
    const pts = Number(d.points ?? d.pts ?? d.score ?? 0);
    if (/^Miss$/i.test(k) || pts === 0) return 'X';
    if (/^B$/i.test(k) || d.bull) {
      const b = (d.bull === 'Inner') ? 50 : 25;
      return `B${b}`;
    }

    // Infer multiplier from round + points first; kind strings are not always trustworthy.
    if (roundDef && roundDef.type === 'number') {
      const n = Number(roundDef.target || 0);
      if (n > 0) {
        if (pts === n * 3) return `T${n}`;
        if (pts === n * 2) return `D${n}`;
        if (pts === n) return `S${n}`;
      }
    }
    if (roundDef && roundDef.type === 'doubles') {
      const s = Number(d.sector || 0);
      return s ? `D${s}` : (pts > 0 ? 'D' : 'X');
    }
    if (roundDef && roundDef.type === 'triples') {
      const s = Number(d.sector || 0);
      return s ? `T${s}` : (pts > 0 ? 'T' : 'X');
    }
    if (roundDef && roundDef.type === 'bull') {
      return d.bull === 'Inner' ? 'B50' : 'B25';
    }

    if (/^(Triple|T)$/i.test(k)) return `T${d.sector || ''}`.trim() || 'T';
    if (/^(Double|D)$/i.test(k)) return `D${d.sector || ''}`.trim() || 'D';
    if (/^(Single|S)$/i.test(k)) return `S${d.sector || ''}`.trim() || 'S';
    return k.toUpperCase();
  }
  const seq = entry.darts
    .filter((_, i)=> i <= dartIndex)
    .map(fmtToken)
    .filter(Boolean)
    .join(' / ');

  
  // @CANONICAL:DMD
  // CANONICAL DMD COMBO BLOCK
// >>> PATCH:SQ_DMD_VOLDY_TRIGGER START
  const __isDoublesRound = (roundDef && roundDef.type === 'doubles');
  const __isTriplesRound = (roundDef && roundDef.type === 'triples');
  const __sector = (dartObj && typeof dartObj.sector === 'number') ? dartObj.sector : (dartObj && typeof dartObj.segment === 'number' ? dartObj.segment : (dartObj && dartObj.sector ? Number(dartObj.sector) : 0));
  const __low1234 = (__sector === 1 || __sector === 2 || __sector === 3 || __sector === 4);
  const __hitIsD = (kind === 'Double' || kind === 'D');
  const __hitIsT = (kind === 'Triple' || kind === 'T');
  const __voldyHit = (__low1234 && ((__isDoublesRound && __hitIsD) || (__isTriplesRound && __hitIsT)));
  // <<< PATCH:SQ_DMD_VOLDY_TRIGGER END
// ----- Per-turn counters (triple/double/single escalation) -----
  try {
    const turnKey = `${pIndex}|${rIndex}|${entry && entry.gameRoundId ? entry.gameRoundId : ''}`;
    if (!window.__sqDmdTurnKey || window.__sqDmdTurnKey !== turnKey || dartIndex === 0) {
      window.__sqDmdTurnKey = turnKey;
      window.__sqDmdTripleCount = 0;
      window.__sqDmdDoubleCount = 0;
      window.__sqDmdSingleCount = 0;
    }
  } catch(_) {}

  const __priorDarts = Array.isArray(entry && entry.darts) ? entry.darts.slice(0, dartIndex) : [];
  const __kindFor = (d) => {
    if (!d) return '';
    const k = String(d.kind || d.type || '').trim();
    const p0 = Number(d.points ?? d.pts ?? d.score ?? 0);
    if (/^Miss$/i.test(k) || p0 === 0) return 'Miss';
    if (/^(Triple|T)$/i.test(k)) return 'T';
    if (/^(Double|D)$/i.test(k)) return 'D';
    if (/^(Single|S)$/i.test(k)) return 'S';
    return k;
  };
  const __thirdMissAfterTwoTriples = (
    dartIndex === 2 &&
    (kind === 'Miss' || pts === 0) &&
    __priorDarts.length >= 2 &&
    __kindFor(__priorDarts[0]) === 'T' &&
    __kindFor(__priorDarts[1]) === 'T'
  );
  const __thirdMissAfterTwoDoubles = (
    dartIndex === 2 &&
    (kind === 'Miss' || pts === 0) &&
    __priorDarts.length >= 2 &&
    __kindFor(__priorDarts[0]) === 'D' &&
    __kindFor(__priorDarts[1]) === 'D'
  );
  const __thirdIsScoringAfterTwoMisses = (
    dartIndex === 2 &&
    kind !== 'Miss' &&
    pts > 0 &&
    __priorDarts.length >= 2 &&
    __kindFor(__priorDarts[0]) === 'Miss' &&
    __kindFor(__priorDarts[1]) === 'Miss'
  );

  // Last Dart Hero image only for a bigger final-dart rescue:
  // Double / Triple / any Bull. Singles still use text-only.
  const __lastDartHeroImageHit = (
    __thirdIsScoringAfterTwoMisses &&
    (
      kind === 'Double' || kind === 'D' ||
      kind === 'Triple' || kind === 'T' ||
      kind === 'B'
    )
  );

  const __turnKindsAll = __priorDarts.concat([dartObj]).map(__kindFor);
  const __turnKinds = __turnKindsAll.filter(k => k && k !== 'Miss');
  const __hasS = __turnKinds.includes('S');
  const __hasD = __turnKinds.includes('D');
  const __hasT = __turnKinds.includes('T');
  const __isShanghai = (dartIndex === 2 && __hasS && __hasD && __hasT);
  const __isDesmondDelight = (
    dartIndex === 2 &&
    __turnKindsAll.filter(k => k === 'S').length === 2 &&
    __turnKindsAll.filter(k => k === 'D').length === 1 &&
    !__hasT &&
    !__turnKindsAll.includes('Miss')
  );

  const __turnDarts = Array.isArray(entry && entry.darts) ? entry.darts.slice(0, dartIndex + 1) : [];
  const __roundTotalNow = __turnDarts.reduce((s,d)=> s + Number(d && (d.points ?? d.pts ?? d.score) || 0), 0);
  const __distinctKinds = Array.from(new Set(__turnKinds));
  const __isDirtyTurn = (
    dartIndex === 2 &&
    __roundTotalNow > 0 &&
    __roundTotalNow <= 30 &&
    !__isShanghai &&
    !__isDesmondDelight &&
    __distinctKinds.length >= 2
  );

  function __sqQueueComboPhrase(phrase, opts){
    try{
      if (!window.sqDmdShowZones) return false;
      const words = String(phrase || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
      if (!words.length) return false;

      try{
        if (typeof q !== 'undefined' && Array.isArray(q)) q.length = 0;
        if (typeof active !== 'undefined' && active && active.type !== 'idle') active.ms = 0;
      }catch(_){}

      const withImage = !!(opts && opts.imageType);
      const stepMs = Number((opts && opts.stepMs) || 340);
      const finalHoldMs = stepMs + 500;
      const rz2 = String((opts && opts.restoreZ2) ?? '');
      const rz3 = String((opts && opts.restoreZ3) ?? '');

      if (withImage){
        window.sqDmdShowZones({ z2:'', z3:'' }, { type: opts.imageType, ms: Number(opts.imageMs || 900), amp: Number(opts.amp || 3.0) });
      }

      if (words.length === 1){
        window.sqDmdShowZones({ z2: words[0], z3:'' }, { type:'flash', ms: finalHoldMs, fx:'impact' });
      } else if (words.length === 2){
        window.sqDmdShowZones({ z2: words[0], z3:'' }, { type:'flash', ms: stepMs, fx:'impact' });
        window.sqDmdShowZones({ z2: words[0], z3: words[1] }, { type:'flash', ms: finalHoldMs, fx:'impact' });
      } else {
        window.sqDmdShowZones({ z2: words[0], z3:'' }, { type:'flash', ms: stepMs, fx:'impact' });
        window.sqDmdShowZones({ z2: words.slice(0, -1).join(' '), z3:'' }, { type:'flash', ms: stepMs, fx:'impact' });
        window.sqDmdShowZones({ z2: words.slice(0, -1).join(' '), z3: words[words.length - 1] }, { type:'flash', ms: finalHoldMs, fx:'impact' });
      }

      // Restore normal score/sequence view after combo completes.
      window.sqDmdShowZones({ z2: rz2, z3: rz3 }, { type:'hold', ms: 1 });
      return true;
    }catch(_){
      return false;
    }
  }

  // ----- Zone 2: main callout + FX -----
  let z2 = '';
  let fx = { type:'flash', ms:650 };
  let __queueOnlyCombo = false;

  if (kind === 'Miss' || pts === 0) {
    if (window.__sqSuppressMissCallouts || window.__sqSkipInProgress) {
      __queueOnlyCombo = true;
    } else if (__thirdMissAfterTwoTriples || __thirdMissAfterTwoDoubles) {
      __queueOnlyCombo = __sqQueueComboPhrase('Boooooo!!', { stepMs: 300, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
      if (!__queueOnlyCombo) {
        z2 = 'Boooooo!!';
        fx = { type:'flash', ms:300, fx:'impact' };
      }
    } else {
      z2 = 'MISS';
      fx = { type:'flash', ms:650, fx:'smear' };
    }

  } else if (__isDesmondDelight) {
    __queueOnlyCombo = __sqQueueComboPhrase('DESMOND DELIGHT', { imageType:'desmondImg', imageMs:950, amp:3.6, stepMs:280, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    if (!__queueOnlyCombo) {
      z2 = 'DESMOND DELIGHT';
      fx = { type:'desmondImg', ms:950, amp:3.6 };
    }

  } else if (__isShanghai) {
    __queueOnlyCombo = __sqQueueComboPhrase('SHANGHAI', { stepMs: 320, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    if (!__queueOnlyCombo) {
      z2 = 'SHANGHAI';
      fx = { type:'flash', ms:320, fx:'impact' };
    }

  } else if (__thirdIsScoringAfterTwoMisses) {
    __queueOnlyCombo = __sqQueueComboPhrase(
      'LAST DART HERO',
      (__lastDartHeroImageHit
        ? { imageType:'lastDartImg', imageMs:900, amp:3.4, stepMs:260, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) }
        : { stepMs:260, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) })
    );
    if (!__queueOnlyCombo) {
      z2 = 'LAST DART HERO';
      fx = { type:'flash', ms:260, fx:'impact' };
    }

  } else if (kind === 'B') {
    z2 = `${who ? (who+': ') : ''}${dartObj.bull === 'Inner' ? 'INNER BULL!' : 'OUTER BULL!'}`;
    fx = { type:'shake', amp:2.2, ms:900, fx:'impact' };

  } else if (kind === 'Triple' || kind === 'T') {
    window.__sqDmdTripleCount = (window.__sqDmdTripleCount||0) + 1;
    const n = window.__sqDmdTripleCount;
    if (n === 1) {
      z2 = 'TRIPLE!';
      fx = { type:'shake', amp:2.3, ms:900, fx:'impact' };
    } else if (n === 2) {
      __queueOnlyCombo = __sqQueueComboPhrase('TREBLE TROUBLE', { stepMs: 250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
      if (!__queueOnlyCombo) { z2 = 'TREBLE TROUBLE'; fx = { type:'flash', ms:250, fx:'impact' }; }
    } else {
      __queueOnlyCombo = __sqQueueComboPhrase('MAXI MAYHEM', { stepMs: 250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
      if (!__queueOnlyCombo) { z2 = 'MAXI MAYHEM'; fx = { type:'flash', ms:250, fx:'impact' }; }
    }

  } else if (kind === 'Double' || kind === 'D') {
    window.__sqDmdDoubleCount = (window.__sqDmdDoubleCount||0) + 1;
    const n = window.__sqDmdDoubleCount;
    if (n === 1) {
      z2 = 'DOUBLE!';
      fx = { type:'flash', ms:800, fx:'impact' };
    } else if (n === 2) {
      __queueOnlyCombo = __sqQueueComboPhrase('DOUBLE LOCK', { stepMs: 250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
      if (!__queueOnlyCombo) { z2 = 'DOUBLE LOCK'; fx = { type:'flash', ms:250, fx:'impact' }; }
    } else {
      __queueOnlyCombo = __sqQueueComboPhrase('DOUBLE DEVIL', { stepMs: 250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
      if (!__queueOnlyCombo) { z2 = 'DOUBLE DEVIL'; fx = { type:'flash', ms:250, fx:'impact' }; }
    }

  } else if (__isDirtyTurn) {
    __queueOnlyCombo = __sqQueueComboPhrase('UGLY BUT IT COUNTS', { stepMs: 250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    if (!__queueOnlyCombo) {
      z2 = 'UGLY BUT IT COUNTS';
      fx = { type:'flash', ms:250, fx:'impact' };
    }

  } else if (pts >= 60) {
    z2 = `${who ? (who+': ') : ''}POWER DART`;
    fx = { type:'shake', amp:2.0, ms:850, fx:'impact' };

  } else {
    window.__sqDmdSingleCount = (window.__sqDmdSingleCount||0) + 1;
    const n = window.__sqDmdSingleCount;
    if (n >= 3 && dartIndex === 2) {
      const pool = ['STEADY HAND', 'DOING THE BASICS', 'SLOW AND STEADY'];
      const pick = pool[Math.abs((pIndex||0) + (rIndex||0) + Number(entry?.roundTotal||0)) % pool.length];
      __queueOnlyCombo = __sqQueueComboPhrase(pick, { stepMs: 250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
      if (!__queueOnlyCombo) {
        z2 = pick;
        fx = { type:'flash', ms:250, fx:'impact' };
      }
    } else {
      z2 = 'SINGLE';
      fx = { type:'wipe', ms:650, fx:'smear' };
    }
  }

  // Render all three zones; Z3 always shows the running sequence unless a queued combo owns the display.
  if (window.sqDmdShowZones) {
    // >>> PATCH:SQ_DMD_VOLDY_ENQUEUE START
    if (__voldyHit) {
      try{ window.__sqPlayVoldyLaugh && window.__sqPlayVoldyLaugh(); }catch(_){ }
      __queueOnlyCombo = __sqQueueComboPhrase('HAHA HA HAH!', { imageType:'voldyImg', imageMs:900, amp:2.8, stepMs:300, restoreZ2:String(z2 || ''), restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) }) || __queueOnlyCombo;
    }
    // <<< PATCH:SQ_DMD_VOLDY_ENQUEUE END
    if (!__queueOnlyCombo) {
      window.sqDmdShowZones({ z1, z2, z3: (window.__sqDmdBulkMiss ? '' : seq) }, fx);
    }
    // >>> PATCH:SQ_DMD_CLEAR_Z3_ENDTURN
    // End-of-turn behaviour:
    // - After 3rd dart, run Stage 3 round-end banner/roll-up, then clear Z3.
    if (typeof dartIndex === 'number' && dartIndex === 2) {
      try {
        const roundTotal = (entry && entry.darts) ? entry.darts.reduce((s,d)=> s + (d?.points||0), 0) : 0;

        // Stage 3: post-turn sequence:
// ROUND SCORE (score) -> (if round completes: ROUND <n> COMPLETE -> NEXT UP.. <next target> -> <player> TO THROW FIRST)
// else: NEXT UP -> <player>
const holdNameMs = 240; // tiny settle
const baseDelay = 180;  // let last-dart callout land
setTimeout(() => {
  try {
    const players = state.players || [];
    const pCount = players.length || 1;

    const thisPlayerIdx = pIndex;
    const thisRoundIdx  = rIndex;

    const nextPlayerIdx = (thisPlayerIdx < pCount - 1) ? (thisPlayerIdx + 1) : 0;

    const willAdvanceRound = (thisPlayerIdx === pCount - 1) && (thisRoundIdx < MAX_ROUNDS - 1) && !state.finished;
    const currDef = (typeof ROUNDS !== 'undefined' && ROUNDS[thisRoundIdx]) ? ROUNDS[thisRoundIdx] : null;
    const nextDef = (typeof ROUNDS !== 'undefined' && ROUNDS[thisRoundIdx + 1]) ? ROUNDS[thisRoundIdx + 1] : null;

    function roundLabel(def){
      if (!def) return '';
      if (def.type === 'number') return String(def.target);
      if (def.type === 'doubles') return 'DBL';
      if (def.type === 'triples') return 'TRL';
      if (def.type === 'bull') return 'BULL';
      return '';
    }

    function playerLabel(idx){
      const p = players[idx];
      if (!p) return '';
      if (typeof p === 'string') return p;
      try{
        if (typeof __sqVsShadowDisplayLabelForPlayer === 'function') {
          const shadowLabel = __sqVsShadowDisplayLabelForPlayer(p, { dmd:true });
          if (shadowLabel) return shadowLabel;
        }
      }catch(_){ }
      return (p.name || p.full || p.nickname || p.code || p.initials || '').toString();
    }

    const nextName = playerLabel(nextPlayerIdx).trim() || `P${nextPlayerIdx+1}`;

    // --- Build next-player info lines (Zone C) ---
    function sumPlayerTotal(idx){
      let tot = 0;
      for (let r=0; r<MAX_ROUNDS; r++){
        tot += (state.score?.[idx]?.[r]?.roundTotal || 0);
      }
      return tot;
    }
    function countPlayerDarts(idx){
      let c = 0;
      for (let r=0; r<MAX_ROUNDS; r++){
        const darts = state.score?.[idx]?.[r]?.darts || [];
        for (let d=0; d<darts.length; d++){
          if (darts[d]) c++;
        }
      }
      return c;
    }
    function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }

    const totals = players.map((_,i)=>sumPlayerTotal(i));
    const nextTotal = totals[nextPlayerIdx] || 0;

    const sorted = totals
      .map((v,i)=>({i,v}))
      .sort((a,b)=> (b.v - a.v) || (a.i - b.i));
    const pos = (sorted.findIndex(x=>x.i===nextPlayerIdx) + 1) || 1;

    const dartsThrown = countPlayerDarts(nextPlayerIdx);
    const avgMatch = dartsThrown ? (nextTotal * 3 / dartsThrown) : 0;

    // Month average (if available in saved player meta)
    let avgMonthTxt = '--';
    try{
      const nm = nextName;
      const meta = (typeof __sqFindSavedPlayerMetaByName === 'function') ? __sqFindSavedPlayerMetaByName(nm) : null;
      const m = meta && (meta.avgMonth || meta.avg_month || meta.month3da || meta.month_3da);
      if (typeof m === 'number' && isFinite(m)) avgMonthTxt = fmt1(m);
      else if (typeof m === 'string' && m.trim()) avgMonthTxt = m.trim();
    }catch(_){}

    function fmtTokenForRound(def, d){
      if (!d || !d.kind) return '';
      const k = String(d.kind);
      if (k === 'Miss') return 'X';
      if (k === 'B') return (d.bull === 'Inner') ? 'B50' : 'B25';
      if (k === 'S' || k === 'D' || k === 'T') {
        const n = (def && def.type === 'number') ? def.target : (d.sector || '');
        return `${k}${n}`.trim();
      }
      if (k === 'Double') return `D${d.sector||''}`.trim();
      if (k === 'Triple') return `T${d.sector||''}`.trim();
      return k.toUpperCase();
    }

    let best = { total: -1, label:'', seq:'' };
    for (let r=0; r<MAX_ROUNDS; r++){
      const e = state.score?.[nextPlayerIdx]?.[r];
      if (!e) continue;
      const t = e.roundTotal || 0;
      if (t > best.total){
        const def = (typeof ROUNDS !== 'undefined' && ROUNDS[r]) ? ROUNDS[r] : null;
        const lbl = def ? (def.type === 'number' ? `${def.target}s` : roundLabel(def)) : `${r+1}`;
        const seq = (e.darts || []).filter(Boolean).map(d=>fmtTokenForRound(def,d)).filter(Boolean).join(' / ');
        best = { total: t, label: lbl, seq };
      }
    }

    const completedRounds = willAdvanceRound ? (thisRoundIdx + 1) : thisRoundIdx; // complete rounds only
    const rndAvg = completedRounds > 0 ? (nextTotal / completedRounds) : nextTotal;
    const leader = (sorted[0] && typeof sorted[0].v==='number') ? sorted[0].v : nextTotal;
    const second = (sorted[1] && typeof sorted[1].v==='number') ? sorted[1].v : leader;
    const diffVal = (pos===1) ? (leader - second) : (nextTotal - leader);
    const diffTxt = (diffVal>=0?'+':'') + String(diffVal);
    const infoLines = [
      `SCORE: ${nextTotal}`,
      `POS: ${pos}/${pCount} • DIFF: ${diffTxt}`,
      `RND AVG: ${fmt1(rndAvg)}`
    ];

    // 1) ROUND SCORE + score below (Z3)
    window.sqDmdShowZones?.({ z2: 'ROUND SCORE', z3: String(roundTotal), z3Small:true, type:'roll' }, { type:'flash', ms:650, fx:'impact' });

    // 2) Branch: round completed vs normal next player
    if (willAdvanceRound) {
      const currLbl = roundLabel(currDef);
      const nextLbl = nextDef ? (nextDef.type === 'number' ? `${nextDef.target}s` : roundLabel(nextDef)) : '';
      setTimeout(()=>{
        try{
          window.sqDmdShowZones?.({ z2: `ROUND ${currLbl}`, z3:'COMPLETE', z3Small:true, type:'roll' }, { type:'flash', ms:720, fx:'smear' });
        }catch(_){}
      }, 850);

      setTimeout(()=>{
        try{
          window.sqDmdShowZones?.({ z2: `NEXT UP.. ${nextLbl}`, z3:'' }, { type:'flash', ms:760, fx:'smear' });
        }catch(_){}
      }, 1700);

      setTimeout(()=>{
        try{
          window.sqDmdShowZones?.({ z2: nextName, z3:'TO THROW FIRST' }, { type:'wipe', ms:820, fx:'impact', z3Small:true });
        }catch(_){}
      }, 2550);

      setTimeout(()=>{
        try{
          window.sqDmdShowZones?.({ z2: nextName, z3:'' }, { type:'hold', ms:1 });
          window.__sqDmdStartPreThrow?.(nextName, infoLines);
        }catch(_){}
      }, 3300);
    } else {
      setTimeout(()=>{
        try{
          window.sqDmdShowZones?.({ z2: 'NEXT UP', z3:'' }, { type:'flash', ms:620, fx:'smear' });
        }catch(_){}
      }, 850);

      setTimeout(()=>{
        try{
          window.sqDmdShowZones?.({ z2: nextName, z3:'' }, { type:'hold', ms:1 });
          window.__sqDmdStartPreThrow?.(nextName, infoLines);
        }catch(_){}
      }, 1500);
    }
  } catch(_){}
}, baseDelay);} catch(_){}
    }
    // <<< PATCH:SQ_DMD_CLEAR_Z3_ENDTURN
  } else if (window.sqDmdShow) {
    window.sqDmdShow(z2, seq, fx);
  }
} catch(_e) {}
/* <<< PATCH:SQ_DMD_STAGE2_THROW_QUALITY END */
/* >>> PATCH:SQ_DMD_PRETHROW_INFO_MODE START */
/* >>> PATCH:DMD_PRETHROW_NAME_ROTATE START */
// Pre-throw info mode: keep player name pinned in Z2 and cycle stats in Z3 until next throw occurs.
(function(){
  if (window.__sqDmdPreThrowInit) return;
  window.__sqDmdPreThrowInit = true;

  let _timer = null;
  let _lines = [];
  let _i = 0;
  let _name = '';
  let _full = '';
  let _nick = '';
  let _showNick = false;
  let _lastFlip = 0;
    try { window.__sqDmdPinnedZ2Text = ''; } catch(_){}

  window.__sqDmdStopPreThrow = function(){
    try { if (_timer && window.SQ && SQ.boot && SQ.boot.poller) SQ.boot.poller.unregister(_timer); } catch(_){}
    _timer = null;
    _lines = [];
    _i = 0;
    _name = '';
    try { window.__sqDmdNoScrollZ2 = false; } catch(_){}
    try { window.__sqDmdZ3Small = false; } catch(_){}
    try { /* no idle marquee in prethrow */ } catch(_){}
  };

  window.__sqDmdStartPreThrow = function(playerName, lines){
    try { window.__sqDmdStopPreThrow(); } catch(_){ }
    _name = (playerName || '').toString();
    try{
      const code = _name.trim().toUpperCase();
      const pm = (window.__sqDmdGetPlayerMeta ? window.__sqDmdGetPlayerMeta(code) : null);
      _full = (pm && pm.full) ? String(pm.full) : _name;
      _nick = (pm && pm.nick) ? String(pm.nick) : '';
      if (_nick && _full && _nick.toUpperCase() === _full.toUpperCase()) _nick = '';
    }catch(_){ _full = _name; _nick = ''; }
    _showNick = false;
    _lastFlip = performance.now();
    try { window.__sqDmdPinnedZ2Text = _full || _name; } catch(_){ }
    _lines = Array.isArray(lines) ? lines.filter(Boolean).map(String) : [];
    _i = 0;

    // Lock: no idle scroll while waiting for input; smaller Z3 text for stats.
    try { window.__sqDmdNoScrollZ2 = true; } catch(_){}
    try { window.__sqDmdZ3Small = true; } catch(_){}
    try { window.sqDmdSetIdle && window.sqDmdSetIdle(""); } catch(_){}

    // Show first line immediately (no animation)
    try{
      const first = _lines.length ? _lines[0] : '';
      window.sqDmdShowZones?.({ z2: _name, z3: first }, { type:'hold', ms:1, z3Small:true });
    }catch(_){}

    if (_lines.length <= 1) return;

    // Slower cycle + "roll up" on each new stat line
    _timer = 'dmdInfoCycle';
    try{
      if (window.SQ && SQ.boot && SQ.boot.poller){
        SQ.boot.poller.register(_timer, ()=>{
          try{
            const now = performance.now();
            if (_nick && (now - _lastFlip) >= 1000){
              _showNick = !_showNick;
              _lastFlip = now;
              try{ window.__sqDmdPinnedZ2Text = (_showNick ? _nick : _full) || _name; window.__sqDmdNoScrollZ2 = true; }catch(_){ }
              try{ window.sqDmdShowZones?.({ z2: (_showNick ? _nick : _full) || _name }, { type:'hold', ms:1 }); }catch(_){ }
            }
            _i = (_i + 1) % _lines.length;
            window.sqDmdShowZones?.({ z3: _lines[_i] }, { type:'roll', ms:520, z3Small:true });
          }catch(_){}
        }, 3200, { immediate:false });
      }
    }catch(_){}
};
})();
/* <<< PATCH:DMD_PRETHROW_NAME_ROTATE END */
/* <<< PATCH:SQ_DMD_PRETHROW_INFO_MODE END */

  // flag if we just completed the 3rd dart in this round (used for GIF triggers)
  const __completedRoundNow = (state.currentDart === 2);

  // UI: hold the completed go's dart symbols for 1s, then reset to arrows for the next player's go
  if (dartIndex === 2) {
    try {
      state.uiLastGo = {
        player: pIndex,
        darts: (entry.darts || []).slice(0, 3),
        showUntil: Date.now() + 1000
      };
      state.__uiLastGoToken = (state.__uiLastGoToken || 0) + 1;
      const __tok = state.__uiLastGoToken;
      setTimeout(() => {
        try {
          if (state.__uiLastGoToken === __tok) updateUI();
        } catch(_) {}
      }, 1050);
    } catch(_) {}
  }

  // History (for Undo)
  state.history.push({
    player:    pIndex,
    round:     rIndex,
    dartIndex: dartIndex,
    throw:     dartObj
  });

  // Match aggregates
  ensureMatchAgg();

  if (hitKey && points > 0) {
    const hitsMap =
      state.matchAgg.hits[pIndex] ||
      (state.matchAgg.hits[pIndex] = {});
    hitsMap[hitKey] = (hitsMap[hitKey] || 0) + 1;
  }

  // Recompute 60+/100+/140+ for this player
  recomputeMatchAggTotalsForPlayer(pIndex);

{
  }
  // Advance dart / player / round
  if (state.currentDart < 2) {
    state.currentDart++;
  } else {
    state.currentDart = 0;
    if (state.currentPlayer < state.players.length - 1) {
      state.currentPlayer++;
    } else {
      state.currentPlayer = 0;
      if (state.currentRound < MAX_ROUNDS - 1) {
        state.currentRound++;
      } else {
        // Game done – completion dialog will open
        state.finished = true;
      }
    }
  }

  updateUI();

  if (dartIndex === 2 &&
      typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime() &&
      typeof __sqIsShadowPlayer === 'function' && !__sqIsShadowPlayer(state.players && state.players[pIndex]) &&
      typeof __sqVsShadowCurrentPlayerIsShadow === 'function' && __sqVsShadowCurrentPlayerIsShadow() &&
      Number(state.currentRound) === Number(rIndex) &&
      Number(state.currentDart) === 0 &&
      !state.finished) {
    try{ __sqScheduleVsShadowAutoTurn(rIndex); }catch(e){ try{ console.warn('[SQ] Vs Shadow auto-turn hook failed', e); }catch(_){ } }
  }

  if (!wasFinished && state.finished) {
    openGameCompleteDialog();
  }
}
function recomputeMatchAggTotalsForPlayer(pIdx){
  ensureMatchAgg();

  let c60  = 0;
  let c100 = 0;
  let c140 = 0;

  for (let r = 0; r < MAX_ROUNDS; r++) {
    const rt =
      state.score?.[pIdx]?.[r]?.roundTotal ||
      0;

    if (rt >= 60)  c60++;
    if (rt >= 100) c100++;
    if (rt >= 140) c140++;
  }

  state.matchAgg.totals60[pIdx]  = c60;
  state.matchAgg.totals100[pIdx] = c100;
  state.matchAgg.totals140[pIdx] = c140;
}
function recomputeMatchAggHitsForPlayer(pIdx){
  ensureMatchAgg();

  const map = {};

  for (let r = 0; r < MAX_ROUNDS; r++) {
    const roundDef = ROUNDS[r];
    const entry = state.score?.[pIdx]?.[r];
    if (!entry) continue;

    const darts = entry.darts || [];
    darts.forEach(dart => {
      if (!dart || !(dart.points > 0)) return;

      let key = null;

      if (roundDef.type === 'number') {
        key = String(roundDef.target);
      } else if (roundDef.type === 'doubles' || roundDef.type === 'triples') {
        if (dart.sector) key = String(dart.sector);
      } else if (roundDef.type === 'bull') {
        key = 'B';
      }

      if (key) {
        map[key] = (map[key] || 0) + 1;
      }
    });
  }

  state.matchAgg.hits[pIdx] = map;
}

function undo(){
  if (!state.history.length) {
    toast('Nothing to undo');
    return;
  }

  const last = state.history[state.history.length - 1];
  if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) {
    const shadow = state.shadow || {};
    const lastIsRealDart = !!(last && last.type !== 'shadowAutoTurn' && typeof __sqIsShadowPlayer === 'function' && !__sqIsShadowPlayer(state.players && state.players[last.player]));
    const shadowDartsStarted = (typeof __sqVsShadowShadowDartsStarted === 'function') ? __sqVsShadowShadowDartsStarted(Number(state.currentRound)) : false;
    if (last && last.type === 'shadowAutoTurn') {
      if (typeof __sqUndoVsShadowCompletedAutoTurn === 'function') {
        __sqUndoVsShadowCompletedAutoTurn();
      } else {
        try{ toast(__SQ_VS_SHADOW_UNDO_BLOCK_REASON); }catch(_){ }
      }
      return;
    }
    if (shadow.autoTurnPending && lastIsRealDart && !shadowDartsStarted) {
      try{ __sqClearVsShadowTimers('undo-real-before-shadow'); }catch(_){ }
    } else if (shadow.autoTurnPending || shadow.autoTurnInProgress || ((typeof __sqVsShadowCurrentPlayerIsShadow === 'function' && __sqVsShadowCurrentPlayerIsShadow()) && (!lastIsRealDart || shadowDartsStarted))) {
      try{ toast(__SQ_VS_SHADOW_UNDO_BLOCK_REASON); }catch(_){ }
      return;
    }
  }

  state.history.pop();
  const { player, round, dartIndex } = last;

  const entry = state.score?.[player]?.[round];
  if (!entry) {
    updateUI();
    return;
  }

  state.currentPlayer = player;
  state.currentRound  = round;
  state.currentDart   = dartIndex;
  state.finished      = false;

  entry.darts[dartIndex] = null;
  entry.roundTotal =
    (entry.darts[0]?.points || 0) +
    (entry.darts[1]?.points || 0) +
    (entry.darts[2]?.points || 0);

  recomputeMatchAggHitsForPlayer(player);
  recomputeMatchAggTotalsForPlayer(player);

  updateUI();
}

function missGo(){
  if (state.finished || state.suddenDeath.active) return;
  if (typeof __sqVsShadowCurrentPlayerIsShadow === 'function' && __sqVsShadowCurrentPlayerIsShadow()) {
    if (typeof __sqHandleVsShadowManualShadowInput === 'function') __sqHandleVsShadowManualShadowInput('missGo');
    return;
  }
  // >>> PATCH:DMD_SUPPRESS_MISS_SEQ START
  // Bulk-miss actions (Skip Go / MISS xN) should NOT show X / X / X in Zone 3.
  // We set a short-lived flag consumed by the DMD renderer inside recordThrow.
  const __prevBulk = !!window.__sqDmdBulkMiss;
  window.__sqDmdBulkMiss = true;
  // >>> PATCH:DMD_SUPPRESS_MISS_SEQ END

  const startPlayer = state.currentPlayer;
  const startRound  = state.currentRound;

  while (
    !state.finished &&
    !state.suddenDeath.active &&
    state.currentPlayer === startPlayer &&
    state.currentRound === startRound &&
    state.currentDart < 3
  ) {
    recordThrow({ kind: 'Miss' });
  }

  // >>> PATCH:DMD_SUPPRESS_MISS_SEQ START
  window.__sqDmdBulkMiss = __prevBulk;
  // >>> PATCH:DMD_SUPPRESS_MISS_SEQ END
}/* >>> PATCH:SQ_DMD_MISS_X3_FAST START */
// MISS button behavior:
// - Single tap: record 1 miss + quick "MISS" flash
// - Triple tap OR "SKIP GO": play "MISS" + "X / X / X" animation, then record remaining misses for the turn
//
// NOTE: Keep all DMD calls best-effort; never block gameplay on animation.
function __sqDmdPlayMissXXX(){
  try{
    // Punchy: show MISS then build Xs quickly in Zone 3
    try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'' }, {type:'flash', ms:180, fx:'pop'}); }catch(_){}
    setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'X' }, {type:'flash', ms:140, fx:'pop'}); }catch(_){ } }, 90);
    setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'X / X' }, {type:'flash', ms:160, fx:'pop'}); }catch(_){ } }, 170);
    setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'X / X / X' }, {type:'flash', ms:200, fx:'pop'}); }catch(_){ } }, 260);
  }catch(_){}
}
try{ window.__sqDmdPlayMissXXX = __sqDmdPlayMissXXX; }catch(_){ }

function __sqHandleMissTap(){
  try{
    // Instant MISS: no triple-tap helper (keeps gameplay snappy).
    try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'' }, { type:'flash', ms:220, fx:'pop' }); }catch(_){ }
    try{ recordThrow({ kind:'Miss' }); }catch(_){ }
  }catch(_){ }
}
/* <<< PATCH:SQ_DMD_MISS_X3_FAST END */
  /*****************
   * TENOR GIF OVERLAY (plays once, then cleans up)
   *****************/
  function ensureTenorOverlayStyles(){
    if (document.getElementById('tenorOverlayStyles')) return;
    const st = document.createElement('style');
    st.id = 'tenorOverlayStyles';
    st.textContent = `
      .gif-overlay{
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 9999;
        background: transparent;
      }
      .gif-overlay .tenor-gif-embed{
        max-width: 80vw;
        width: 60vw;
        pointer-events: none;
      }
      @media (max-width: 600px){
        .gif-overlay .tenor-gif-embed{ width: 88vw; }
      }
    `;
    document.head.appendChild(st);
  }

  // Inject a Tenor embed DIV and (re)load Tenor's script so it renders even when added dynamically.
  function showTenorOnce(postId, durationMs = 2600){
    try{
      ensureTenorOverlayStyles();
      const overlay = document.createElement('div');
      overlay.className = 'gif-overlay';
      overlay.innerHTML = `
        &lt;div class="tenor-gif-embed"
             data-postid="${postId}"
             data-share-method="host"
             data-aspect-ratio="1.777"
             data-width="100%"&gt;&lt;/div&gt;`;
      document.body.appendChild(overlay);

      // Force Tenor to parse the newly injected embed by adding a fresh script tag.
      const s = document.createElement('script');
      s.src = 'https://tenor.com/embed.js';
      s.async = true;
      s.onload = () => {
        setTimeout(() => {
          try { overlay.remove(); } catch(_) {}
          try { s.remove(); } catch(_) {}
        }, durationMs);
      };
      document.body.appendChild(s);
    } catch (e){
      console.warn('showTenorOnce error', e);
    }
  }

function __sqComputeGameMode(){
  try {
    const players = state.players || [];
    if (typeof window.__sqIsTurboRuntimeState === 'function' && window.__sqIsTurboRuntimeState(state)) return 'turbo';
    const forcePractice = !!(state.match && (state.match.forcePractice === true || state.match.mode === 'practice'));
    let allRegistered = true;
    try {
      allRegistered = players.length ? players.every(p => !!__sqFindSavedPlayerMetaByName(p && p.name)) : false;
    } catch(_) { allRegistered = false; }

    if (forcePractice) return 'practice';
    if (players.length === 1) return 'practice';
    if (players.length >= 2 && !allRegistered) return 'practice';
    if (players.length >= 2 && allRegistered) return 'official';
    return 'practice';
  } catch(_) {
    return ((state.players?.length || 0) >= 2) ? 'official' : 'practice';
  }
}

// --- GAME LOGGING TO SUPABASE (real) + HIGH SCORES ---
async function recordFullGameToSupabase(createdAtOverride) {
  let __sqVsShadowPracticeMatchCleanupId = null;
  try {
    if (typeof __sqVsShadowCompletionBlocked === 'function' && __sqVsShadowCompletionBlocked()) {
      try{ __sqVsShadowBlockPhase2C(__SQ_VS_SHADOW_COMPLETION_BLOCK_REASON); }catch(_){ }
      return null;
    }
    const runtimePlayers = Array.isArray(state.players) ? state.players : [];
    const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
    const persistPlayers = (typeof __sqRealPlayersOnly === 'function') ? __sqRealPlayersOnly(runtimePlayers) : runtimePlayers;
    const isOfficial = !isVsShadow && (persistPlayers.length >= 2);

    // Prefer caller-provided timestamp, then global backdate (if present), else now.
    const ts =
      (typeof createdAtOverride !== 'undefined' && createdAtOverride) ? createdAtOverride :
      (typeof _tsOverride       !== 'undefined' && _tsOverride)       ? _tsOverride       :
      new Date().toISOString();

    if (isOfficial) {
      try {
        await upsertMatchToSupabase(ts);
      } catch (e) {
        console.warn('match upsert failed', e);
      }
    }

    const runtimeTotals = runtimePlayers.map((_, i) => totalScoreForPlayer(i));
    const totals     = (typeof __sqRealOnlyTotals === 'function') ? __sqRealOnlyTotals(runtimeTotals, runtimePlayers) : runtimeTotals;
    const boardClone = (typeof __sqRealOnlyBoard === 'function') ? __sqRealOnlyBoard(state.score || [], runtimePlayers) : JSON.parse(JSON.stringify(state.score || []));
    const gameMode   = isVsShadow ? 'practice' : ((typeof __sqComputeGameMode === 'function') ? __sqComputeGameMode() : (isOfficial ? 'official' : 'practice'));
    const isPractice = isVsShadow || (gameMode === 'practice');
    const isTurbo    = (gameMode === 'turbo');
    const turboRules = (state && state.match && state.match.tournamentRules) || (state && state.tournamentRules) || {};
    const matchState = (state && state.match) || {};
    const isActualTournament = !!(matchState.tournament === true || matchState.tournamentType || matchState.tournamentSize || matchState.tournamentMatch || state?.__sqTournamentDraft || state?.__sqTournamentActive);
    const isMatchPlayTurbo = !!(isTurbo && !isActualTournament && (
      String(matchState.gameFormat || state?.gameFormat || '').toLowerCase() === 'match_play' ||
      String(matchState.gameVariant || state?.gameVariant || '').toLowerCase() === 'turbo' ||
      String(matchState.mode || matchState.gameMode || state?.mode || state?.gameMode || '').toLowerCase() === 'turbo' ||
      String(matchState.startTarget || state?.startTarget || '').toLowerCase() === '17'
    ));

    // >>> PATCH:practice-save-v4-recordfull-dedupe START
    // recordFullGameToSupabase is still called from awardAndShowLeaderboard after
    // the direct practice save wrapper. For practice games, do not let a stale
    // state.match.id + game_number=1 reinsert collide with games_pkey. Dedupe by
    // the completed board fingerprint, not by session-level booleans.
    function __sqRecordFullPracticeKey(){
      try{
        var names = (persistPlayers || []).map(function(p){ return String((p && p.name) || '').trim().toLowerCase(); }).join('|');
        var totalStr = (totals || []).map(function(x){ return Number(x)||0; }).join('|');
        var boardStr = JSON.stringify(boardClone || []);
        var token = (state && state.__gameToken != null) ? String(state.__gameToken) : '';
        return ['practice-v3', token, names, totalStr, boardStr].join('::');
      }catch(_){ return ''; }
    }

    const __practiceSaveKeyForRecordFull = isPractice ? __sqRecordFullPracticeKey() : '';
    if (isPractice && state && state.__sqPracticeSavedToGames && state.__sqPracticeSavedKeyV2 && state.__sqPracticeSavedKeyV2 === __practiceSaveKeyForRecordFull) {
      try{ console.info('[SQ] recordFullGameToSupabase skipped: practice game already saved by direct practice path', { saveKey: __practiceSaveKeyForRecordFull }); }catch(_){ }
      return null;
    }
    if (isPractice && state && (state.__sqPracticeSavedToGames || state.__sqPracticeCloudSavedV2) && state.__sqPracticeSavedKeyV2 && state.__sqPracticeSavedKeyV2 !== __practiceSaveKeyForRecordFull) {
      try{ console.info('[SQ] recordFullGameToSupabase clearing stale practice save flags for new completed game'); }catch(_){ }
      try{
        delete state.__sqPracticeSavedToGames;
        delete state.__sqPracticeCloudSavedV2;
        delete state.__sqPracticeSaveMatchIdV2;
      }catch(_){ }
    }
    // <<< PATCH:practice-save-v4-recordfull-dedupe END

    // Supabase games.match_id is NOT NULL in the current schema.
    // Practice therefore gets a real lightweight match row, but remains practice via state.mode/is_practice.
    let practiceMatchId = null;
    if (isPractice) {
      try {
        // Practice rows use a fresh lightweight match id per completed game.
        // Reusing state.match.id with game_number=1 causes games_pkey collisions
        // across back-to-back practice games in the current schema.
        practiceMatchId = ((crypto && crypto.randomUUID) ? crypto.randomUUID() : ('practice-' + Date.now() + '-' + Math.random().toString(36).slice(2,8)));
        state.match = Object.assign({}, state.match || {}, {
          id: practiceMatchId,
          mode: 'practice',
          forcePractice: true,
          createdAtIso: state?.match?.createdAtIso || ts,
          history: Array.isArray(state?.match?.history) ? state.match.history : [],
          wins: isVsShadow
            ? Array.from({ length: persistPlayers.length }, () => 0)
            : (Array.isArray(state?.match?.wins) ? state.match.wins : [])
        });
        const practiceMatchPayload = {
          id: practiceMatchId,
          created_at: state.match.createdAtIso || ts,
          total_games: isVsShadow ? 1 : Math.max(1, state.match.history.length || 1),
          players: persistPlayers.map(p => ({ name: p.name })),
          wins: isVsShadow
            ? Array.from({ length: persistPlayers.length }, () => 0)
            : ((typeof __sqRealOnlyArray === 'function') ? __sqRealOnlyArray(state.match.wins || [], runtimePlayers) : (state.match.wins || []).slice()),
          history: [{ totals: totals.slice(), mode: 'practice' }]
        };
        if (isVsShadow && typeof __sqAssertNoShadowPersistPayload === 'function' && !__sqAssertNoShadowPersistPayload(practiceMatchPayload, 'recordFullGameToSupabase:matches')) {
          throw new Error('Vs Shadow save blocked: Shadow data cannot be persisted.');
        }
        if (isVsShadow) __sqVsShadowPracticeMatchCleanupId = practiceMatchId;
        await sb.from(TABLE_MATCHES).upsert(practiceMatchPayload);
      } catch (e) {
        if (isVsShadow && /Vs Shadow save blocked/i.test(String(e && (e.message || e)))) throw e;
        if (isVsShadow) throw e;
        console.warn('[SQ] practice match upsert failed', e);
      }
    }

    const payload = {
      match_id:   isPractice ? practiceMatchId : (isOfficial ? (state.match?.id || null) : practiceMatchId),
      game_number: isPractice ? 1 : (state.match?.history?.length ? state.match.history.length : 1),
      created_at: ts, // finish time (or backdated override)
      state:      {
        players: persistPlayers.map(p => ({ name: p.name })),
        board: boardClone,
        mode: gameMode,
        gameMode: gameMode,
        gameFormat: isMatchPlayTurbo ? 'match_play' : undefined,
        gameVariant: isMatchPlayTurbo ? 'turbo' : undefined,
        tournament: isMatchPlayTurbo ? false : undefined,
        is_practice: isPractice,
        total_players: persistPlayers.length,
        match_id: isPractice ? practiceMatchId : (state.match?.id || null),
        tournamentType: (isTurbo && isActualTournament) ? 'turbo' : (state?.match?.tournamentType || state?.tournamentType || undefined),
        tournamentRules: (isTurbo && isActualTournament) ? Object.assign({ strictTimer:true, throwLimitSeconds:20, startTarget:'17' }, turboRules || {}) : undefined,
        strictTimer: isTurbo ? true : undefined,
        throwLimitSeconds: isTurbo ? 20 : undefined,
        startTarget: isTurbo ? '17' : undefined,
        schema_version: isPractice ? 2 : undefined
      },
      totals,
      finished:   true
    };

    if (isVsShadow && typeof __sqAssertNoShadowPersistPayload === 'function' && !__sqAssertNoShadowPersistPayload(payload, 'recordFullGameToSupabase:games')) {
      throw new Error('Vs Shadow save blocked: Shadow data cannot be persisted.');
    }

    const { data: _gRow, error } = await sb.from(TABLE_GAMES).insert(payload).select('id, created_at').single();
    if (error) {
      // If the direct practice save path already inserted this exact completed game,
      // do not surface a scary duplicate-key failure from the later leaderboard path.
      if (isPractice && (error.code === '23505' || String(error.message || '').toLowerCase().indexOf('duplicate key') >= 0)) {
        try{ console.warn('[SQ] recordFullGameToSupabase skipped duplicate practice insert', error); }catch(_){ }
        return null;
      }
      throw error;
    }
    __sqVsShadowPracticeMatchCleanupId = null;
    const _gameId = _gRow && _gRow.id ? _gRow.id : null;
    try { if (typeof __sqClearRecoveryCachesAfterCompletedSave === 'function') __sqClearRecoveryCachesAfterCompletedSave('recordFullGameToSupabase'); } catch(_) {}
    try { if (typeof window.__sqClearGamesTruthCache === 'function') window.__sqClearGamesTruthCache('recordFullGameToSupabase'); } catch(_) {}

    // >>> PATCH:HS_TS_ALIGN START
    // Write HS rows with the SAME ts as the game row, so deletes and audits remain consistent.
    try { if (typeof cloudSaveHighScoresForGame === 'function') await cloudSaveHighScoresForGame(runtimeTotals, ts, _gameId); } catch(_e) {}
    // <<< PATCH:HS_TS_ALIGN END
  } catch (e) {
    if (__sqVsShadowPracticeMatchCleanupId) {
      try {
        const cleanup = await sb.from(TABLE_MATCHES).delete().eq('id', __sqVsShadowPracticeMatchCleanupId);
        if (cleanup && cleanup.error) console.warn('[SQ] Vs Shadow practice match cleanup failed', cleanup.error);
      } catch (cleanupErr) {
        console.warn('[SQ] Vs Shadow practice match cleanup threw', cleanupErr);
      }
    }
    console.error('recordFullGameToSupabase failed', e);
    throw e;
  }
}

// Multi-player -> League (TABLE_HS_LEAGUE), single-player -> Practice (TABLE_HS_PRACTICE).
async function recordGameToHighScores() {
  // Deprecated: high scores are now written in recordFullGameToSupabase() with aligned ts.
  // Keeping this as a harmless no-op to avoid duplicate / drifted HS rows.
  return;
}

async function awardAndShowLeaderboard(){
  // prevent double-award if called twice for same game
  if (state.gameAwarded) {
    showLeaderboard();
    return;
  }
  const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
  if (typeof __sqVsShadowCompletionBlocked === 'function' && __sqVsShadowCompletionBlocked()) {
    try{ state.finished = false; state.gameAwarded = false; }catch(_){ }
    try{ __sqVsShadowBlockPhase2C(__SQ_VS_SHADOW_COMPLETION_BLOCK_REASON); }catch(_){ }
    return;
  }
  if (!isVsShadow) state.gameAwarded = true;

  const totals  = state.players.map((_,i)=> totalScoreForPlayer(i));
  const max     = Math.max(...totals);
  let winners = totals.map((t,i)=> t===max?i:null).filter(x=>x!==null);
  // Decider shootout override: only ONE winner is awarded a win; scores/stats remain unchanged
  if (state._decider && state._decider.resolved && typeof state._decider.winner === 'number') {
    winners = [state._decider.winner];
  }
  if (isVsShadow && typeof __sqRealOnlyWinnerIndexes === 'function') {
    winners = __sqRealOnlyWinnerIndexes(winners, state.players || []);
  }

// before recordFullGameToSupabase();
  if (!isVsShadow && (state.players?.length || 0) >= 2) {
    try { await upsertMatchToSupabase(); } catch (e) { console.warn(e); }
  }

  // Ensure wins array exists
  const awardPlayerCount = isVsShadow && typeof __sqRealPlayersOnly === 'function'
    ? __sqRealPlayersOnly(state.players || []).length
    : state.players.length;
  if (!state.match.wins || state.match.wins.length !== awardPlayerCount) {
    state.match.wins = Array.from({length: awardPlayerCount}, () => 0);
  }
  if (!isVsShadow) winners.forEach(i => state.match.wins[i]++);

  // Snapshot board for history/stats
  const boardClone = JSON.parse(JSON.stringify(state.score));
  const historyTotals = isVsShadow && typeof __sqRealOnlyTotals === 'function' ? __sqRealOnlyTotals(totals, state.players || []) : totals.slice();
  const historyBoard = isVsShadow && typeof __sqRealOnlyBoard === 'function' ? __sqRealOnlyBoard(boardClone, state.players || []) : boardClone;

  if (isVsShadow) {
    try {
      if (state.shadow) {
        state.shadow.saveFailed = false;
        state.shadow.saveInFlight = true;
        state.shadow.lastSaveError = '';
      }
      await recordFullGameToSupabase();
      if (state.shadow) state.shadow.saveInFlight = false;
      state.gameAwarded = true;
    } catch (e) {
      console.error(e);
      try {
        state.finished = true;
        state.gameAwarded = false;
        if (state.shadow) {
          state.shadow.saveInFlight = false;
          state.shadow.saveFailed = true;
          state.shadow.lastSaveError = String((e && (e.message || e.details || e.hint)) || e || 'Save failed');
        }
        delete state.__sqPracticeSavedToGames;
        delete state.__sqPracticeCloudSavedV2;
        delete state.__sqPracticeSavedKeyV2;
        delete state.__sqPracticeSaveMatchIdV2;
      } catch(_) {}
      try{ toast('Vs Shadow save failed. Your completed game is still on screen; retry Finish Game.'); }catch(_){ }
      try{ window.sqDmdShowZones?.({ z2:'SAVE FAILED', z3:'RETRY FINISH' }, { type:'flash', ms:1200, fx:'impact', z3Small:true }); }catch(_){ }
      try{ show('game'); }catch(_){ }
      try{ updateUI(); }catch(_){ }
      return;
    }
  }

  state.match.history.push({ totals: historyTotals, board: historyBoard });

  // Long-term local logs
  logCompletedGame(historyTotals, isVsShadow ? [] : winners, historyBoard);

  const targetWins = state.match.targetWins || 1;
  const gamesPlayedNow = Array.isArray(state.match.history) ? state.match.history.length : 0;
  const maxWins    = state.match.wins.length ? Math.max(...state.match.wins) : 0;
  const matchDone  = isVsShadow ? (gamesPlayedNow >= targetWins) : (maxWins >= targetWins);

  if (!isVsShadow && matchDone && !state.match.completedLogged) {
    logCompletedMatch();
    state.match.completedLogged = true;
  }

  // Cloud writes (best-effort for legacy modes; Vs Shadow must fail closed above)
  if (!isVsShadow) {
    try { await recordFullGameToSupabase(); } catch (e) {
      console.error(e); toast('Game saved to local only (cloud failed)');
    }
  }
  try { await recordGameToHighScores(); } catch (e) {
    console.error(e);
  }

  state.match.gameNumber = state.match.history.length + 1;

  save();
  showLeaderboard();
}
// next line should exist already in your file:
const lbTable = byId('lbTable');
const lbTHead = lbTable ? lbTable.querySelector('thead') : null;
const lbTBody = lbTable ? lbTable.querySelector('tbody') : null;
const lbMatchInfo = byId('lbMatchInfo');
const nextGameBtn=byId('nextGameBtn'); 
const gameScoresBtn=byId('gameScoresBtn'); 
const newMatchBtn=byId('newMatchBtn'); 
const gamesRemainTag=byId('gamesRemainTag');

const lbGameStatsBtn  = byId('lbGameStatsBtn');
const lbMatchStatsBtn = byId('lbMatchStatsBtn');
const lbGameRaceBtn   = byId('lbGameRaceBtn');

function updateLeaderboardTable(){
  if (!lbTable || !lbTHead || !lbTBody) return;
  lbTHead.innerHTML = '';
  lbTBody.innerHTML = '';

  const gamesPlayed = state.match.history.length;
  const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
  const displayPlayers = isVsShadow && typeof __sqRealPlayersOnly === 'function'
    ? __sqRealPlayersOnly(state.players || [])
    : (state.players || []);

  // Build a "vertical" leaderboard:
  //   columns = players
  //   rows    = G1..Gn, RND AVG, TOTAL POINTS, WINS

  // ---------- colgroup ----------
  let colgroup = lbTable.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    lbTable.insertBefore(colgroup, lbTable.firstChild);
  }
  colgroup.innerHTML = '';

  // Row-label column
  const cRow = document.createElement('col');
  cRow.style.width = '120px';
  colgroup.appendChild(cRow);

  // One column per player
  const playerCols = Math.max(displayPlayers.length, 1);
  for (let i = 0; i < playerCols; i++){
    const c = document.createElement('col');
    c.style.width = (displayPlayers.length <= 2 ? 'calc((100% - 120px)/2)' : 'calc((100% - 120px)/' + playerCols + ')');
    colgroup.appendChild(c);
  }

  // ---------- gather data ----------
  const perPlayer = displayPlayers.map((player, idx) => {
    let total = 0;
    const perGame = [];
    for (let g = 0; g < gamesPlayed; g++){
      const t = (state.match.history[g]?.totals?.[idx]) || 0;
      perGame.push(t);
      total += t;
    }

    // "RND AVG" = three-dart average across the whole match (same calc as old Match %)
    let thrown = 0;
    for (let g = 0; g < gamesPlayed; g++){
      const board = state.match.history[g]?.board?.[idx];
      if (!board) continue;
      for (let r = 0; r < MAX_ROUNDS; r++){
        const darts = board[r]?.darts || [];
        for (const d of darts){ if (d !== null) thrown++; }
      }
    }
    const rndAvg = thrown ? (total / thrown) * 3 : 0;

    return {
      name: (__sqComputeInitialsFromName(player.name) || ('P' + (idx+1))),
      color: player.color || '#fff',
      perGame,
      total,
      rndAvg,
      wins: state.match.wins[idx] || 0
    };
  });

  // ---------- header row ----------
  const trh = document.createElement('tr');

  const th0 = document.createElement('th');
  th0.scope = 'col';
  th0.textContent = '';
  th0.className = 'lb-rowhdr';
  trh.appendChild(th0);

  perPlayer.forEach(p => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = 'center';
    th.textContent = p.name;
    th.style.color = p.color;
    trh.appendChild(th);
  });

  lbTHead.appendChild(trh);

  // helper to add a row
  function addRow(label, values, opts={}){
    const tr = document.createElement('tr');

    const tdLabel = document.createElement('td');
    tdLabel.className = 'lb-rowlabel';
    tdLabel.textContent = label;
    if (opts.click) {
      tdLabel.style.cursor = 'pointer';
      tdLabel.title = opts.title || '';
      tdLabel.onclick = opts.click;
    }
    tr.appendChild(tdLabel);

    values.forEach(v => {
      const td = document.createElement('td');
      td.className = 'center num';
      td.textContent = v;
      tr.appendChild(td);
    });

    lbTBody.appendChild(tr);
  }

  // Rows: G1..Gn (clickable to open score sheet)
  for (let g = 0; g < gamesPlayed; g++){
    addRow('G' + (g+1),
      perPlayer.map(p => String(p.perGame[g] || 0)),
      { click: () => openScoreSheetFromHistory(g), title: 'Open Game ' + (g+1) + ' score sheet' }
    );
  }

  // AVG
  addRow('AVG', perPlayer.map(p => p.rndAvg.toFixed(1)));

  // PTS
  addRow('PTS', perPlayer.map(p => String(p.total)));

  // WINS
  addRow('WINS', perPlayer.map(p => String(p.wins)));
}

function showLeaderboard() {
  // Build table
  updateLeaderboardTable();

  // Decide which CTA to show
  const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false;
  const targetWins = state.match?.targetWins || 1;
  const winsArr    = state.match?.wins || [];
  const gamesPlayed = state.match?.history?.length || 0;
  const maxWins    = winsArr.length ? Math.max(...winsArr) : 0;
  const matchDone  = isVsShadow ? (gamesPlayed >= targetWins) : (maxWins >= targetWins);

  // NEXT GAME button
  if (nextGameBtn) {
    nextGameBtn.classList.toggle('hidden', matchDone);
    nextGameBtn.onclick = () => {
      if (isVsShadow) {
        const nextIndex = state.match?.history?.length || 0;
        const games = Array.isArray(state.shadow && state.shadow.games) ? state.shadow.games : [];
        if (nextIndex >= games.length || !__sqRefreshVsShadowRuntimePlayerForGame(nextIndex)) {
          try{ toast('No next Shadow source is available.'); }catch(_){ }
          return;
        }
        state.finished = false;
        state.gameAwarded = false;
        try{ delete state.__sqGameCompleteOpen; }catch(_){ }
        startNewGame(true);
        return;
      }
      state.finished = false;
      startNewGame();      // opens throw-order dialog, then goes to Game
    };
  }

  // END MATCH button
  if (newMatchBtn) {
    newMatchBtn.classList.toggle('hidden', !matchDone);
    newMatchBtn.onclick = () => {
      // reset to the initial start screen, not Match Setup
      state = JSON.parse(JSON.stringify(baseState));
      save();
      if (typeof navigateToStartScreen === 'function') navigateToStartScreen();
      else show('details');
    };
  }

  // Optional info line
  if (lbMatchInfo) {
    const toWin = Math.max(0, targetWins - maxWins);
    lbMatchInfo.textContent = isVsShadow
      ? (matchDone ? `Match complete — ${gamesPlayed}/${targetWins} games` : `Games: ${gamesPlayed}/${targetWins}`)
      : (matchDone
        ? `Match complete — first to ${targetWins}`
        : `Games: ${gamesPlayed} · First to ${targetWins} · ${toWin} to win`);
    lbMatchInfo.parentElement?.classList.remove('hidden');
  }

  // Tournament completed-match leaderboard: direct source-level patch (not wrapper dependent).
  try { if (window.__sqFix83PatchTournamentLeaderboardNow) window.__sqFix83PatchTournamentLeaderboardNow(); } catch(_) {}

  // Show the screen
  show('leaderboard');

  // Re-apply after the leaderboard and Premier League injector finish rendering.
  try { [0, 80, 250, 700].forEach(ms => setTimeout(function(){ try{ if (window.__sqFix83PatchTournamentLeaderboardNow) window.__sqFix83PatchTournamentLeaderboardNow(); }catch(_){} }, ms)); } catch(_) {}
}

function openGameScoresDialog() {
  if (!state.match || !Array.isArray(state.match.history) || !state.match.history.length) {
    toast('No completed games yet.');
    return;
  }
  const displayPlayers = (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime() && typeof __sqRealPlayersOnly === 'function')
    ? __sqRealPlayersOnly(state.players || [])
    : (state.players || []);

  // Migrated to the shared sqModal factory (audit P5.1). Keeps the simple
  // h3 title look; gains stack/Escape/focus behaviour.
  const m = sqModal({ closeButton: 'Close' });
  m.modal.setAttribute('aria-label', 'Game Scores');
  const title = document.createElement('h3');
  title.textContent = 'Game Scores';
  m.modal.insertBefore(title, m.body);
  const body = m.body;

  state.match.history.forEach((game, idx) => {
    const heading = document.createElement('h4');
    heading.textContent = `Game ${idx + 1}`;
    heading.style.margin = '8px 0 4px';
    body.appendChild(heading);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.style.marginBottom = '8px';

    const table = document.createElement('table');
    table.className = 'hs-table';

    // Header row: Round + each player
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    const thRound = document.createElement('th');
    thRound.textContent = 'Round';
    trHead.appendChild(thRound);

    displayPlayers.forEach(p => {
      const th = document.createElement('th');
      th.textContent = p.name;
      th.style.textAlign = 'center';
      trHead.appendChild(th);
    });

    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const board = game.board || [];
    const runningTotals = displayPlayers.map(() => 0);

    for (let r = 0; r < MAX_ROUNDS; r++) {
      const tr = document.createElement('tr');

      const roundDef = ROUNDS[r];
      const roundTh = document.createElement('th');
      roundTh.textContent =
        roundDef.type === 'number'
          ? (roundDef.target + 's')
          : (roundDef.type === 'doubles'
              ? "D"
              : (roundDef.type === 'triples' ? "T" : 'B'));
      tr.appendChild(roundTh);

      for (let p = 0; p < displayPlayers.length; p++) {
        const td = document.createElement('td');
        td.className = 'center num';

        const entry = board[p]?.[r];
        const hasDarts = entry && entry.darts && entry.darts.some(d => d);
        const rt = entry?.roundTotal || 0;

        if (hasDarts) {
          runningTotals[p] += rt;

          const main = document.createElement('div');
          main.className = 'cell-main';
          main.textContent = String(runningTotals[p]);

          const sub = document.createElement('div');
          sub.className = 'cell-sub';
          sub.textContent = rt ? `(${rt})` : '';

          td.appendChild(main);
          td.appendChild(sub);
        } else {
          td.textContent = '–';
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  });
}

if (gameScoresBtn) gameScoresBtn.addEventListener('click', openGameScoresDialog);

/*****************
 * SCROLL SYNC (keeps columns aligned)
 *****************/
let _scrollSyncSet=false; 
function setupScrollSync(){ 
  if(_scrollSyncSet) return; 
  const sw=byId('scoreWrap'), st=byId('statsWrap'), fh=byId('floatWrap'), ms=byId('mstatsWrap'); 
  if(!sw||!st||!fh||!ms) return; 
  let syncing=false; 
  function mirror(from){ 
    if(syncing) return; syncing=true; 
    const x=from.scrollLeft; [sw,st,fh,ms].forEach(el=>{ if(el!==from) el.scrollLeft=x; }); syncing=false; 
  } 
  [sw,st,fh,ms].forEach(el=> el.addEventListener('scroll',()=>mirror(el),{passive:true})); 
  _scrollSyncSet=true; 
  requestAnimationFrame(()=>{ 
    // Safely resolve header elements even if global refs (thead, statsThead, floatThead) are undefined
    const thead      = document.querySelector('#scoreWrap thead')  || document.querySelector('#scoreTable thead') || window.thead      || null;
    const statsThead = document.querySelector('#statsWrap thead')  || window.statsThead  || null;
    const floatThead = document.querySelector('#floatWrap thead')  || window.floatThead  || null;
    const sRow=thead?.querySelector('tr'), tRow=statsThead?.querySelector('tr'), fRow=floatThead?.querySelector('tr'); 
    if(!sRow||!tRow||!fRow) return; 
    const sCells=sRow.children, tCells=tRow.children, fCells=fRow.children; 
    const leftW=sCells[0].getBoundingClientRect().width; 
    document.documentElement.style.setProperty('--left-col-w', leftW+'px'); 
    const n=Math.min(sCells.length,tCells.length,fCells.length); 
    for(let i=1;i<n;i++){ 
      const w=sCells[i].getBoundingClientRect().width; 
      [tCells[i], fCells[i]].forEach(cell=>{ if(cell){ cell.style.width=w+'px'; cell.style.minWidth=w+'px'; cell.style.maxWidth=w+'px'; } }); 
    } 
  }); 
}

/*****************
 * START/RESET + ORDER DIALOG
 *****************/
function buildEverything(){ 
  buildScoreHeader(); 
  buildScoreBody(); 
  buildFloatingHeader(); 
  buildStatsHeader(); 
  buildStatsBody(); 
  buildMatchStatsHeader(); 
  buildMatchStatsBody(); 
  setupScrollSync(); 
}

// >>> PATCH:SQ_BUILD_CHUNK_V1 START
function __sqYieldToPaint(){
  return new Promise((resolve)=>{
    requestAnimationFrame(()=>setTimeout(resolve, 0));
  });
}

// Chunked DOM builder to reduce long-tasks on Mobile Safari.
// Does NOT change layout logic; it just yields between large build steps.
async function buildEverythingChunked(){
  await __sqYieldToPaint();
  buildScoreHeader();
  await __sqYieldToPaint();
  buildScoreBody();
  await __sqYieldToPaint();
  buildFloatingHeader();
  await __sqYieldToPaint();
  buildStatsHeader();
  await __sqYieldToPaint();
  buildStatsBody();
  await __sqYieldToPaint();
  buildMatchStatsHeader();
  await __sqYieldToPaint();
  buildMatchStatsBody();
  await __sqYieldToPaint();
  setupScrollSync();
}
// <<< PATCH:SQ_BUILD_CHUNK_V1 END

// >>> PATCH:SQ_GAME_ENSURE_BUILD_V1 START
function ensureGameBuilt(){
  try{
    if (!window.state || !state.players || !state.players.length) return;
    const hasHead = !!(thead && thead.querySelector('tr'));
    const hasCells = !!document.getElementById('cell-0-0');
    if (!hasHead || !hasCells){
      try{ buildEverything(); }catch(e){ console.error('[GAME] buildEverything failed', e); }
    } else {
      // still ensure scroll sync is attached (safe idempotent)
      try{ setupScrollSync(); }catch(_){}
    }
  }catch(_){}
}
// <<< PATCH:SQ_GAME_ENSURE_BUILD_V1 END

// GLOBAL — record pace (#1 official game score) from Supabase games truth
// >>> PATCH:FIX22_RACE_HS_GAMES_TRUTH START
async function buildRecordPaceSeries(roundsCount) {
  try {
    const rc = Math.max(1, Number(roundsCount) || 14);

    function safeName(v){ return String(v || '').trim(); }
    function valNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

    function gamePlayers(g){
      const ps = g && (g.players || g.state?.players);
      return Array.isArray(ps) ? ps : [];
    }

    function gameBoard(g){
      const b = g && (g.board || g.score || g.state?.board || g.state?.score);
      return Array.isArray(b) ? b : [];
    }

    function roundTotalFromEntry(entry){
      if (!entry) return 0;
      if (typeof entry === 'number') return valNum(entry);
      if (Number.isFinite(Number(entry.roundTotal))) return valNum(entry.roundTotal);
      if (Number.isFinite(Number(entry.total))) return valNum(entry.total);
      if (Number.isFinite(Number(entry.score))) return valNum(entry.score);
      if (Array.isArray(entry.darts)){
        return entry.darts.reduce((sum, d)=>{
          if (d == null) return sum;
          if (typeof d === 'number') return sum + valNum(d);
          if (Number.isFinite(Number(d.score))) return sum + valNum(d.score);
          if (Number.isFinite(Number(d.points))) return sum + valNum(d.points);
          if (Number.isFinite(Number(d.value))) return sum + valNum(d.value);
          return sum;
        }, 0);
      }
      return 0;
    }

    function playerRoundEntry(board, pIdx, rIdx, playerCount){
      if (Array.isArray(board?.[pIdx])) return board[pIdx]?.[rIdx];
      if (Array.isArray(board?.[rIdx]) && board.length >= rc && board.length !== playerCount) return board[rIdx]?.[pIdx];
      return null;
    }

    function cumulativeFor(g, pIdx){
      const ps = gamePlayers(g);
      const board = gameBoard(g);
      const data = [];
      let running = 0;
      for (let r = 0; r < rc; r++){
        running += roundTotalFromEntry(playerRoundEntry(board, pIdx, r, ps.length));
        data.push(running);
      }
      return data;
    }

    function totalFor(g, pIdx){
      const totals = g && (g.totals || g.state?.totals);
      const fromTotals = Array.isArray(totals) ? Number(totals[pIdx]) : NaN;
      if (Number.isFinite(fromTotals) && fromTotals > 0) return fromTotals;
      const data = cumulativeFor(g, pIdx);
      return data.length ? valNum(data[data.length - 1]) : 0;
    }

    function gameTime(g){
      const raw = g && (g.ts || g.created_at || g.inserted_at || g.updated_at || g.state?.ts);
      const t = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    }

    // Games are the authoritative source for the race pace. HS tables can be stale/partial.
    let games = [];
    try {
      games = await cloudFetchAllGamesAsLocal();
    } catch (e) {
      console.error('cloudFetchAllGamesAsLocal failed in buildRecordPaceSeries', e);
      games = [];
    }

    let best = null;
    for (const g of (Array.isArray(games) ? games : [])){
      try{
        if (typeof isOfficialGame === 'function' && !isOfficialGame(g)) continue;
        const ps = gamePlayers(g);
        if (!ps.length) continue;
        for (let pIdx = 0; pIdx < ps.length; pIdx++){
          const total = totalFor(g, pIdx);
          if (!Number.isFinite(total) || total <= 0) continue;
          const name = safeName(ps[pIdx]?.name || ps[pIdx]?.fullName || ps[pIdx]?.displayName || ps[pIdx]?.nick || ('P' + (pIdx + 1)));
          const data = cumulativeFor(g, pIdx);
          if (!data.some(v => Number(v) > 0)) continue;
          const candidate = { game:g, playerIndex:pIdx, name, total, data, ts:gameTime(g) };
          if (!best || candidate.total > best.total || (candidate.total === best.total && candidate.ts > best.ts)){
            best = candidate;
          }
        }
      }catch(_){ }
    }

    if (best){
      return {
        name: `Record: ${best.name} (${best.total})`,
        color: '#ffffff',
        data: best.data,
        dotted: true
      };
    }

    // Last-resort fallback: old HS table path, only used when games cannot provide board history.
    const list = await cloudListHighScoresWithBackfill(false, 1);
    if (!list || !list.length) return null;
    const top = list[0];
    const target = Number(top.score) || 0;
    let found = null;
    try {
      if (typeof findGameForHighScoreCloudFirst === 'function') {
        found = await findGameForHighScoreCloudFirst({ name: top.name, score: target, ts: top.ts }, false);
      }
    } catch (e) {
      console.error('findGameForHighScoreCloudFirst failed', e);
    }
    if (!found || !found.game) return null;
    const data = cumulativeFor(found.game, found.playerIndex || 0);
    if (!data.some(v => Number(v) > 0)) return null;
    return {
      name: `Record: ${top.name} (${target})`,
      color: '#ffffff',
      data,
      dotted: true
    };
  } catch (e) {
    console.error('buildRecordPaceSeries failed', e);
    return null;
  }
}
// <<< PATCH:FIX22_RACE_HS_GAMES_TRUTH END
// >>> PATCH:FIX172_TURBO_RACE_DB_REFERENCE START
async function __sqBuildTurboRecordPaceSeries(roundsCount, startRoundIndex) {
  try {
    const start = Math.max(0, Number(startRoundIndex ?? 7) || 7);
    const end = Math.max(start, Math.min(Math.max(1, Number(roundsCount) || 14) - 1, 13));
    const cacheKey = start + '|' + end;
    const cached = window.__sqTurboRaceRecordCache;
    if (cached && cached.key === cacheKey && (Date.now() - (cached.ts || 0)) < 60000) return cached.value;
    if (cached && cached.key === cacheKey && cached.promise) return cached.promise;

    const client = (() => {
      try { if (typeof ensureCloudInit === 'function') ensureCloudInit(); } catch(_) {}
      try { if (window.sb && typeof window.sb.from === 'function') return window.sb; } catch(_) {}
      try { if (typeof sb !== 'undefined' && sb && typeof sb.from === 'function') return sb; } catch(_) {}
      return null;
    })();
    if (!client) return null;

    const promise = (async function(){
      // The live Turbo leaderboard sources were verified against the current Supabase schema.
      // v_top50_scores_turbo_clean is mode-isolated and already ordered as the all-time
      // Turbo score table; it identifies the same record as the heavier Turbo league view.
      const hs = await client.from('v_top50_scores_turbo_clean')
        .select('player_name,score,ts,game_id')
        .order('score', { ascending:false })
        .order('ts', { ascending:false })
        .limit(1);
      if (hs && hs.error) throw hs.error;
      const topRow = Array.isArray(hs && hs.data) ? hs.data[0] : null;
      const top = topRow ? {
        player:String(topRow.player_name || '').trim(),
        best_score:Number(topRow.score || 0),
        best_ts:topRow.ts || '',
        game_id:topRow.game_id || ''
      } : null;
      if (!top || !top.player || !top.game_id || !Number.isFinite(top.best_score) || top.best_score <= 0) return null;

      let rr = await client.from('mv_player_round_scores_mode_clean_app')
        .select('mode_key,player,player_key,game_id,created_at,round_index,round_score')
        .eq('mode_key', 'turbo')
        .eq('game_id', top.game_id)
        .gte('round_index', start)
        .lte('round_index', end)
        .order('round_index', { ascending:true });
      let rows = Array.isArray(rr && rr.data) ? rr.data : [];
      if ((rr && rr.error) || !rows.length) {
        rr = await client.from('v_player_round_scores_mode_clean')
          .select('mode_key,player,player_key,game_id,created_at,round_index,round_score')
          .eq('mode_key', 'turbo')
          .eq('game_id', top.game_id)
          .gte('round_index', start)
          .lte('round_index', end)
          .order('round_index', { ascending:true });
        rows = Array.isArray(rr && rr.data) ? rr.data : [];
      }
      if (rr && rr.error) throw rr.error;

      if (!rows.length) return null;
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const topPlayer = norm(top.player);
      const byPlayer = new Map();
      rows.forEach(function(r){
        const player = String(r.player || '').trim();
        const key = norm(r.player_key || player);
        if (!key) return;
        let bucket = byPlayer.get(key);
        if (!bucket) {
          bucket = { player:player || String(r.player_key || ''), key:key, roundScores:new Map(), total:0 };
          byPlayer.set(key, bucket);
        }
        const roundIndex = Number(r.round_index);
        const score = Number(r.round_score || 0);
        if (!Number.isFinite(roundIndex) || roundIndex < start || roundIndex > end) return;
        bucket.roundScores.set(roundIndex, score);
        bucket.total += score;
      });
      let best = null;
      byPlayer.forEach(function(bucket){
        if (!best) best = bucket;
        if (topPlayer && (bucket.key === topPlayer || norm(bucket.player) === topPlayer)) best = bucket;
        else if (!topPlayer && bucket.total > (best.total || 0)) best = bucket;
      });
      if (!best) return null;
      let running = 0;
      const data = [];
      for (let r = start; r <= end; r++) {
        running += Number(best.roundScores.get(r) || 0);
        data.push(running);
      }
      if (!data.some(function(v){ return Number(v) > 0; })) return null;
      const total = Number(top.best_score || best.total || running) || running;
      return {
        name: 'Turbo HS: ' + (best.player || top.player || 'Record') + ' (' + total + ')',
        label: 'THS',
        color: 'rgba(0,245,255,.82)',
        data: data,
        dotted: true
      };
    })();

    window.__sqTurboRaceRecordCache = { key:cacheKey, ts:Date.now(), promise:promise, value:null };
    const value = await promise;
    window.__sqTurboRaceRecordCache = { key:cacheKey, ts:Date.now(), promise:null, value:value };
    return value;
  } catch (e) {
    try { console.warn('[SQ] Turbo race reference unavailable', e); } catch(_) {}
    return null;
  }
}
// <<< PATCH:FIX172_TURBO_RACE_DB_REFERENCE END
// >>> PATCH:FIX173_RACE_REFERENCE_MODE_RESOLVER START
function __sqIsTurboRaceRuntimeState(src) {
  try {
    src = src || window.state || {};
    const m = src.match || {};
    const draft = window.__sqTournamentDraft || src.__sqTournamentDraft || null;
    const activeTournament = src.__sqTournamentActive || window.__sqTournamentActive || null;
    const rules = m.tournamentRules || src.tournamentRules || (draft && draft.rules) || {};
    if (typeof __sqIsTurboVisualRuntime === 'function' && __sqIsTurboVisualRuntime()) return true;
    if (document.body && document.body.dataset && document.body.dataset.page === 'game') {
      if (document.body.classList && document.body.classList.contains('sq-mode-turbo')) return true;
      if (String(document.body.getAttribute('data-sq-variant') || '').toLowerCase() === 'turbo') return true;
    }
    const values = [
      src.gameVariant,
      src.variant,
      src.mode,
      src.gameMode,
      src.game_mode,
      src.gameFormat,
      src.startTarget,
      m.gameVariant,
      m.variant,
      m.mode,
      m.gameMode,
      m.game_mode,
      m.gameFormat,
      m.startTarget,
      rules.gameVariant,
      rules.mode,
      rules.gameMode,
      rules.startTarget,
      window.__sqSelectedMatchVariant,
      activeTournament && activeTournament.type
    ].map(function(v){ return String(v == null ? '' : v).trim().toLowerCase(); });
    if (values.indexOf('turbo') >= 0 || values.indexOf('17') >= 0) return true;
    if (src.strictTimer === true || m.strictTimer === true || rules.strictTimer === true) return true;
    if (Number(src.throwLimitSeconds || m.throwLimitSeconds || rules.throwLimitSeconds || 0) === 20) return true;
    const legacyType = String(m.tournamentType || m.type || src.tournamentType || (draft && draft.type) || (activeTournament && activeTournament.type) || '').trim().toLowerCase();
    return legacyType === 'turbo';
  } catch(_) {
    return false;
  }
}
function __sqTurboRaceStartIndex(src, roundsCount) {
  try {
    src = src || window.state || {};
    const m = src.match || {};
    const draft = window.__sqTournamentDraft || src.__sqTournamentDraft || null;
    const rules = m.tournamentRules || src.tournamentRules || (draft && draft.rules) || {};
    const rc = Math.max(1, Number(roundsCount) || 14);
    const n = Number(rules.startRoundIndex ?? src.startRoundIndex ?? m.startRoundIndex ?? 7);
    return Math.max(0, Math.min(rc - 1, Number.isFinite(n) ? n : 7));
  } catch(_) {
    return 7;
  }
}
async function __sqBuildRaceReferenceSeriesForCurrentMode(roundsCount, startRoundIndex) {
  try {
    const rc = Math.max(1, Number(roundsCount) || 14);
    const start = __sqTurboRaceStartIndex(window.state, rc);
    if (__sqIsTurboRaceRuntimeState(window.state)) {
      return (typeof __sqBuildTurboRecordPaceSeries === 'function')
        ? await __sqBuildTurboRecordPaceSeries(rc, startRoundIndex ?? start)
        : null;
    }
    return (typeof buildRecordPaceSeries === 'function')
      ? await buildRecordPaceSeries(rc).catch(function(){ return null; })
      : null;
  } catch(_) {
    return null;
  }
}
// <<< PATCH:FIX173_RACE_REFERENCE_MODE_RESOLVER END
async function openGameRaceDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-arcade-dlg';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Game Race';

  const body = document.createElement('div');
  body.className = 'modal-body';

  const info = document.createElement('p');
  info.textContent = 'Round-by-round cumulative scores. Dotted line shows the #1 high score pace.';
  info.style.fontSize = '0.82rem';
  info.style.color = '#a8acc3';
  info.style.marginBottom = '6px';
  body.appendChild(info);

  const canvas = document.createElement('canvas');
  canvas.width  = 640;
  canvas.height = 320;
  canvas.style.width  = '100%';
  canvas.style.height = 'auto';
  body.appendChild(canvas);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';
  backBtn.onclick = () => {
    overlay.remove();
    openStatsHubDialog();
  };

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn sq-pill';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => overlay.remove();

  footer.append(backBtn, closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  modal.tabIndex = 0;
  modal.focus();

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.remove();
  });

  // --- Build series for current game ---
  const fullRoundsCount = MAX_ROUNDS;
  const isTurboRace = (typeof __sqIsTurboRaceRuntimeState === 'function') ? __sqIsTurboRaceRuntimeState(state) : false;
  const displayStartRound = isTurboRace && typeof __sqTurboRaceStartIndex === 'function'
    ? __sqTurboRaceStartIndex(state, fullRoundsCount)
    : 0;
  const roundsCount = isTurboRace ? Math.max(1, fullRoundsCount - displayStartRound) : fullRoundsCount;
  const series = [];
  const displayEntries = (typeof __sqRuntimePlayerDisplayEntries === 'function')
    ? __sqRuntimePlayerDisplayEntries()
    : (state.players || []).map((player, index) => ({ player, index }));

  for (const entryInfo of displayEntries) {
    const p = entryInfo.index;
    const player = entryInfo.player;
    const data = [];
    let running = 0;

    for (let r = 0; r < roundsCount; r++) {
      const sourceRound = displayStartRound + r;
      const entry = state.score?.[p]?.[sourceRound];
      const rt = entry ? (entry.roundTotal || 0) : 0;
      running += rt;
      data.push(running);
    }

    series.push({
      name: (typeof __sqVsShadowDisplayLabelForPlayer === 'function' && __sqVsShadowDisplayLabelForPlayer(player, { graph:true })) || player.name,
      color: player.color || '#7bdcff',
      data,
      dotted: false
    });
  }
// --- Add dotted #1 high score line using the actual round-by-round board ---
const recordSeries = (typeof __sqBuildRaceReferenceSeriesForCurrentMode === 'function')
  ? await __sqBuildRaceReferenceSeriesForCurrentMode(fullRoundsCount, displayStartRound)
  : (isTurboRace ? null : await buildRecordPaceSeries(fullRoundsCount));
if (recordSeries) {
  series.push(recordSeries);
  if (isTurboRace) info.textContent = 'Round-by-round cumulative Turbo scores. Dotted line shows THS pace.';
} else {
  info.textContent = 'Round-by-round cumulative scores.'; // no fake line
}

  // If no data at all, just bail
  const anyPoints = series.some(s => s.data.some(v => v > 0));
  if (!anyPoints) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#a8acc3';
    ctx.font = '12px system-ui';
    ctx.fillText('No scoring data yet for this game.', 20, 40);
    return;
  }

  // --- Draw chart ---
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const marginLeft = 40;
  const marginRight = 10;
  const marginTop = 20;
  const marginBottom = 30;

  ctx.clearRect(0, 0, w, h);

  const maxY = Math.max(
    ...series.flatMap(s => s.data),
    10
  );

  const plotW = w - marginLeft - marginRight;
  const plotH = h - marginTop - marginBottom;

  function xForRound(r) {
    if (roundsCount <= 1) return marginLeft;
    const t = r / (roundsCount - 1);
    return marginLeft + t * plotW;
  }

  function yForScore(v) {
    const t = v / maxY;
    return marginTop + (1 - t) * plotH;
  }

  // Grid + axes
  ctx.strokeStyle = '#2b3050';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop);
  ctx.lineTo(marginLeft, marginTop + plotH);
  ctx.stroke();

  // X-axis
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop + plotH);
  ctx.lineTo(marginLeft + plotW, marginTop + plotH);
  ctx.stroke();

  ctx.fillStyle = '#a8acc3';
  ctx.font = '10px system-ui';

  // Y labels (4 ticks)
  for (let i = 0; i <= 4; i++) {
    const v = (maxY / 4) * i;
    const y = yForScore(v);
    ctx.fillText(String(Math.round(v)), 4, y + 3);

    ctx.strokeStyle = 'rgba(43,48,80,0.4)';
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + plotW, y);
    ctx.stroke();
  }

  // X labels (rounds)
  ctx.textAlign = 'center';
  for (let r = 0; r < roundsCount; r++) {
    const x = xForRound(r);
    const round = ROUNDS[displayStartRound + r] || ROUNDS[r] || {};
    const label = round.type === 'number'
      ? String(round.target)
      : (round.type === 'doubles'
          ? 'D'
          : (round.type === 'triples' ? 'T' : 'B'));
    ctx.fillText(label, x, marginTop + plotH + 12);
  }
  ctx.textAlign = 'left';

  // Lines
  series.forEach(s => {
    if (!s.data || !s.data.length) return;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.setLineDash(s.dotted ? [5, 4] : []);

    // pick line colour
    ctx.strokeStyle = s.color || '#7bdcff';

    s.data.forEach((v, idx) => {
      const x = xForRound(idx);
      const y = yForScore(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });

  // Legend
  let legendX = marginLeft;
  let legendY = marginTop - 6;

  series.forEach(s => {
    ctx.setLineDash(s.dotted ? [5, 4] : []);
    ctx.strokeStyle = s.color || '#7bdcff';
    ctx.lineWidth = 2;

    const lineW = 24;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + lineW, legendY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = '#e7e9f5';
    ctx.font = '10px system-ui';
    ctx.fillText(' ' + s.name, legendX + lineW + 4, legendY + 3);

    legendY += 14;
  });
}

// Throw order selection
function showPlayerOrderDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal modal-throworder';

  const top = document.createElement('div');
  top.className = 'to-top';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'to-titles';

  const h = document.createElement('div');
  h.className = 'to-title';
  h.textContent = 'THROW ORDER';

  const sub = document.createElement('div');
  sub.className = 'to-subtitle';
  // match length is already chosen; show current game index if available
  const gnum = (state && typeof state.gameNumber === 'number' && state.gameNumber > 0) ? state.gameNumber : 1;
  sub.textContent = 'DECIDE THE LINEUP FOR GAME ' + gnum;

  titleWrap.append(h, sub);
  top.append(titleWrap);

  const body = document.createElement('div');
  body.className = 'to-body';

  const list = document.createElement('div');
  list.className = 'to-list';

  function initialsForPlayer(p){
    return __sqNormalizeInitials(p && p.initials, p && p.name);
  }

  function render(){
    list.innerHTML = '';
    state.players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'to-row';

      const rank = document.createElement('div');
      rank.className = 'to-rank';
      rank.textContent = '#' + (i+1);

      const badge = document.createElement('div');
      badge.className = 'to-badge';
      badge.textContent = initialsForPlayer(p) || (String(p.name||'').trim().slice(0,2).toUpperCase());

      const meta = document.createElement('div');
      meta.className = 'to-meta';

      const nm = document.createElement('div');
      nm.className = 'to-name';
      nm.textContent = (__sqPlayerPretty(p) || String(p.name || '').trim() || ('Player ' + (i+1)));

      const small = document.createElement('div');
      small.className = 'to-small';
      small.textContent = (i === 0) ? 'THROWS FIRST' : '';

      meta.append(nm, small);

      const arrows = document.createElement('div');
      arrows.className = 'to-arrows';

      const up = document.createElement('button');
      up.className = 'to-arrow-btn';
      up.type = 'button';
      up.innerHTML = '↑';
      up.disabled = (i === 0);

      const down = document.createElement('button');
      down.className = 'to-arrow-btn';
      down.type = 'button';
      down.innerHTML = '↓';
      down.disabled = (i === state.players.length - 1);

      up.onclick = () => { if (i > 0) { swapPlayers(i, i-1); render(); } };
      down.onclick = () => { if (i < state.players.length - 1) { swapPlayers(i, i+1); render(); } };

      arrows.append(up, down);

      row.append(rank, badge, meta, arrows);
      list.appendChild(row);
    });
  }

  render();
  body.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'to-actions';

  const startBtn = document.createElement('button');
  const __mode = (window.__sqSelectedMode || 'match');
  // Match Setup CTA sizing/typography consistency
  startBtn.className = (__mode === 'practice') ? 'btn to-start to-blueLight practice-cta' : 'btn to-start practice-cta';
  startBtn.type = 'button';
  startBtn.innerHTML = 'START GAME <span class="to-start-ic">▶</span>';
  startBtn.onclick = () => { overlay.remove(); startNewGame(true); };

  const backBtn = document.createElement('button');
  backBtn.className = 'btn to-back ms2-back';
  backBtn.type = 'button';
  backBtn.innerHTML = '<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>';
  backBtn.onclick = () => overlay.remove();

  actions.append(startBtn, backBtn);

  modal.append(top, body, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();
}

function startNewGame(setOrder=false){
  try{ if (typeof __sqClearVsShadowTimers === 'function') __sqClearVsShadowTimers('startNewGame'); }catch(_){ }
  try{
    const savedVsShadow = (typeof __sqSavedStateIsVsShadow === 'function') ? __sqSavedStateIsVsShadow(state) : false;
    const shadowReady = !!(state && state.shadow && /^runtime_phase/i.test(String(state.shadow.status || '')) && state.shadow.autoTurnEnabled === true);
    if (savedVsShadow && !shadowReady) __sqSanitizeVsShadowForGenericStart('startNewGame-stale-shadow');
  }catch(_){ }
  if(!setOrder){
    try{ if (typeof __sqSanitizeVsShadowForGenericStart === 'function') __sqSanitizeVsShadowForGenericStart('startNewGame-generic'); }catch(_){ }
    showPlayerOrderDialog();
    return;
  }

  // >>> PATCH:practice-multi-game-save-reset START
  // Practice save guards are per completed game, not per practice session/match.
  // Reset them whenever a fresh game starts so back-to-back practice games each get
  // their own Supabase games row and history entry.
  try{
    delete state.__sqPracticeCloudSavedV2;
    delete state.__sqPracticeSavedToGames;
    delete state.__sqPracticeSaveInFlightV2;
    delete state.__sqPracticeSaveMatchIdV2;
    delete state.__sqPracticeSavedKeyV2;
    delete state.__sqPracticeSaveInFlightKeyV2;
    delete state.__sqGameCompleteOpen;
  }catch(_){ }
  // <<< PATCH:practice-multi-game-save-reset END

  state.__gameToken = (state.__gameToken || 0) + 1;
  state._decider = null;
  state.score = Array.from({length:state.players.length},
    ()=>Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0})));
  state.currentRound = 0;
  state.currentPlayer = 0;
  state.currentDart = 0;
  state.history = [];
  state.finished = false;
  state.suddenDeath = {active:false,participants:[],turnIndex:0,throws:[],round:1};
  state.gameAwarded = false;
  ensureMatchAgg();
  
__sqShowGameLoadOverlay('Preparing Live Game');
__sqAfterPaint(async ()=>{
  try{
    show('game');
    await buildEverythingChunked();
    updateUI();
    if (!(typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime())) save();
  } finally {
    __sqHideGameLoadOverlay();
  }
});
}

function restartGame() {
  if (!confirm('Are you sure you want to restart this game? All progress will be lost.')) return;
  try{ if (typeof __sqClearVsShadowTimers === 'function') __sqClearVsShadowTimers('restartGame'); }catch(_){ }
  state.finished = false;
  state.suddenDeath = {active:false, participants:[], turnIndex:0, throws:[], round:1};
  if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) {
    startNewGame(true);
    return;
  }
  startNewGame();
  show('game'); updateUI();
}

function swapPlayers(i, j) {
  // Swap players themselves
  [state.players[i], state.players[j]] = [state.players[j], state.players[i]];

  // Swap match wins
  if (state.match && Array.isArray(state.match.wins)) {
    [state.match.wins[i], state.match.wins[j]] =
      [state.match.wins[j], state.match.wins[i]];
  }

  // Swap per-game totals already stored
  if (state.match && Array.isArray(state.match.history)) {
    state.match.history.forEach(g => {
      if (g && Array.isArray(g.totals)) {
        [g.totals[i], g.totals[j]] = [g.totals[j], g.totals[i]];
      }
    });
  }

  // Swap matchAgg stats so favourites / 60+ / 100+ / 140+ stay with the player
  if (state.matchAgg) {
    if (Array.isArray(state.matchAgg.hits)) {
      [state.matchAgg.hits[i], state.matchAgg.hits[j]] =
        [state.matchAgg.hits[j], state.matchAgg.hits[i]];
    }
    ['totals60', 'totals100', 'totals140'].forEach(key => {
      if (Array.isArray(state.matchAgg[key])) {
        [state.matchAgg[key][i], state.matchAgg[key][j]] =
          [state.matchAgg[key][j], state.matchAgg[key][i]];
      }
    });
  }
}
/*****************
 * ADMIN HUB + ADMIN PANELS
 *****************/
 function findGameForHighScore(row) {
  const games = getGameLog();
  if (!games || !games.length) return null;

  const targetName  = row.name;
  const targetScore = Number(row.score) || 0;
  const targetTs    = row.ts ? new Date(row.ts).getTime() : null;
  const windowMs    = 5 * 60 * 1000; // 5 minutes either side

  for (const g of games) {
    if (!g || !Array.isArray(g.players) || !Array.isArray(g.totals)) continue;

    const pIdx = g.players.findIndex(p => p && p.name === targetName);
    if (pIdx === -1) continue;

    const scoreHere = Number(g.totals[pIdx] || 0);
    if (scoreHere !== targetScore) continue;

    if (targetTs && g.ts) {
      const gt = new Date(g.ts).getTime();
      if (Math.abs(gt - targetTs) > windowMs) continue;
    }

    // Found a matching game + player index
    return { game: g, playerIndex: pIdx };
  }

  return null;
}
 
 function deleteLocalStatsForHighScore(row) {
  const games = getGameLog();
  if (!games || !games.length) return;

  const targetName  = row.name;
  const targetScore = Number(row.score) || 0;
  const targetTs    = row.ts ? new Date(row.ts).getTime() : null;
  const windowMs    = 5 * 60 * 1000; // 5 minutes either side

  const filtered = [];

  for (const g of games) {
    let matches = false;

    if (g && Array.isArray(g.players) && Array.isArray(g.totals)) {
      g.players.forEach((p, idx) => {
        if (!p) return;
        if (p.name !== targetName) return;

        const scoreHere = Number(g.totals[idx] || 0);
        if (scoreHere !== targetScore) return;

        if (targetTs && g.ts) {
          const gt = new Date(g.ts).getTime();
          if (Math.abs(gt - targetTs) <= windowMs) {
            matches = true;
          }
        } else {
          matches = true;
        }
      });
    }

    if (!matches) filtered.push(g);
  }

  if (filtered.length !== games.length) {
    setGameLog(filtered);
  }
}
// ------- High Score → Score Sheet (cloud-first) -------

// Try to find the exact game in Supabase by timestamp ±10min + name + score.
// Falls back to local getGameLog() via findGameForHighScore().
async function findGameForHighScoreCloudFirst(row, isPractice = false){
  const ts = row?.ts ? new Date(row.ts) : null;

  // 1) Cloud window query
  if (ts && window.sb) {
    const pad = 10 * 60 * 1000; // ±10 min
    const fromIso = new Date(ts.getTime() - pad).toISOString();
    const toIso   = new Date(ts.getTime() + pad).toISOString();

    try {
      const { data, error } = await sb
        .from(TABLE_GAMES)
        .select('id, created_at, state, totals, match_id')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      const candidates = (data || []);
      for (const g of candidates) {
        const players = (g?.state?.players || []).map(p => (typeof p === 'string' ? { name:p } : p));
        const totals  = Array.isArray(g?.totals) ? g.totals : [];

        // Practice vs Official sanity check (optional but helps)
        const isSingle = players.length === 1 || !g.match_id;
        if (isPractice && !isSingle) continue;
        if (!isPractice && isSingle) continue;

        const pIdx = players.findIndex(p => p && eqName(p.name, row.name));
        if (pIdx === -1) continue;
        if (Number(totals[pIdx] || 0) !== Number(row.score || 0)) continue;

        // Convert to local shape the rest of the code expects
        const local = {
          id: g.id || null,
          ts: g.created_at || null,
          players,
          totals: totals.slice(),
          winners: [], // not needed for the sheet
          board: g?.state?.board || null
        };
        return { game: local, playerIndex: pIdx };
      }
    } catch (e) {
      console.error('cloud lookup for high-score row failed', e);
    }
  }

  // 2) Local fallback
  const local = findGameForHighScore(row);
  if (local) return { game: local.game, playerIndex: local.playerIndex };

  return null;
}

// Render a single game's score sheet (round-by-round) in a modal.
// Optionally highlight one player's column (e.g. the high-score row owner).
function openSingleGameScoreSheet(game, highlightIdx = -1){
  if (!game || !Array.isArray(game.players) || !game.board) {
    toast('Score sheet not available for this row yet.');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  const when  = game.ts ? new Date(game.ts).toLocaleString() : '';
  title.textContent = `Score Sheet${when ? ' — ' + when : ''}`;

  const body = document.createElement('div');
  body.className = 'modal-body';

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'hs-table';

  // Header
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  const thRound = document.createElement('th');
  thRound.textContent = 'Round';
  trh.appendChild(thRound);

  game.players.forEach((p, idx) => {
    const th = document.createElement('th');
    th.textContent = p.name;
    th.style.textAlign = 'center';
    if (idx === highlightIdx) {
      th.style.color = 'var(--accent-2)';
      th.style.fontWeight = '900';
    }
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  const runningTotals = game.players.map(() => 0);

  for (let r = 0; r < MAX_ROUNDS; r++) {
    const tr = document.createElement('tr');

    const roundDef = ROUNDS[r];
    const roundTh = document.createElement('th');
    roundTh.textContent =
      roundDef.type === 'number'
        ? (roundDef.target + 's')
        : (roundDef.type === 'doubles' ? "D" : (roundDef.type === 'triples' ? "T" : 'B'));
    tr.appendChild(roundTh);

    for (let p = 0; p < game.players.length; p++) {
      const td = document.createElement('td');
      td.className = 'center num';

      const entry = game.board?.[p]?.[r];
      const hasDarts = entry && entry.darts && entry.darts.some(d => d);
      const rt = entry?.roundTotal || 0;

      if (hasDarts) {
        runningTotals[p] += rt;
        const main = document.createElement('div');
        main.className = 'cell-main';
        main.textContent = String(runningTotals[p]);

        const sub = document.createElement('div');
        sub.className = 'cell-sub';
        sub.textContent = rt ? `(${rt})` : '';

        td.appendChild(main);
        td.appendChild(sub);
      } else {
        td.textContent = '–';
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn sq-pill';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => overlay.remove();
  footer.appendChild(closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.tabIndex = 0;
  modal.focus();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
}

// ===== Public High Scores (League / Practice) =====
if (typeof window.openScoreSheetFromHighScore !== 'function') {
  window.openScoreSheetFromHighScore = async function(row, isPractice){
    try{
      const match = await findGameForHighScoreCloudFirst(row, isPractice);
      if (match && match.game) {
        openSingleGameScoreSheet(match.game, match.playerIndex);
      } else {
        toast('Score sheet not available for this row yet.');
      }
    }catch(e){
      console.error('openScoreSheetFromHighScore failed', e);
      toast('Could not open score sheet.');
    }
  };
}

async function openHighScoresMenuDialog(){
  const overlay = document.createElement('div'); overlay.className='modal-backdrop';
  const modal   = document.createElement('div'); modal.className='modal';
  const title   = document.createElement('h3');  title.textContent='High Scores';
  const body    = document.createElement('div'); body.className='modal-body';
  const footer  = document.createElement('div'); footer.className='modal-footer';

  // Tabs
  const tabs = document.createElement('div');
  tabs.style.display = 'flex';
  tabs.style.gap = '8px';
  tabs.style.marginBottom = '10px';

  const leagueBtn   = document.createElement('button'); leagueBtn.className='btn primary'; leagueBtn.textContent='League';
  const practiceBtn = document.createElement('button'); practiceBtn.className='btn';           practiceBtn.textContent='Practice';
  tabs.append(leagueBtn, practiceBtn);

  const status = document.createElement('div');
  status.className = 'muted';
  status.style.fontSize = '0.85rem';
  status.style.margin = '6px 0 8px 0';

  body.append(tabs, status);

  const tableHost = document.createElement('div'); tableHost.className='table-wrap';
  body.appendChild(tableHost);

  async function render(isPractice){
    tableHost.innerHTML = '';
    status.textContent = '';

    // visual tabs
    leagueBtn.className   = isPractice ? 'btn' : 'btn primary';
    practiceBtn.className = isPractice ? 'btn primary' : 'btn';

    try{
      if (!ensureCloudInit()){
        status.textContent = 'Cloud not initialised — check keys or network.';
        return;
      }
    }catch(_){}

    let list = [];
    try{
      list = await cloudListHighScores(!!isPractice, 50);
    }catch(e){
      console.error('cloudListHighScores failed', e);
      status.textContent = (e && e.message) ? `Failed to load: ${e.message}` : 'Failed to load high scores.';
      return;
    }

    if (!list || !list.length){
      const p=document.createElement('p');
      p.textContent='No high scores yet.';
      tableHost.appendChild(p);
      return;
    }

    const table=document.createElement('table'); table.className='hs-table';
    const thead=document.createElement('thead'); const trh=document.createElement('tr');
    ['#','Player','Score','Avg / Round','When'].forEach(h=>{
      const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    const tb=document.createElement('tbody');
    list.forEach((row, idx) => {
      const tr=document.createElement('tr');

      const td1=document.createElement('td'); td1.textContent=String(idx+1);
      const td2=document.createElement('td'); td2.textContent=String(row.name || '');
      const td3=document.createElement('td'); td3.textContent=String(row.score || 0);
      const td4=document.createElement('td');
      const avgRound = MAX_ROUNDS ? (Number(row.score||0)/MAX_ROUNDS) : 0;
      td4.textContent = avgRound.toFixed(1);

      const td5=document.createElement('td');
      const d=new Date(row.ts);
      td5.textContent = !Number.isNaN(d.getTime())
        ? d.toLocaleString(undefined,{year:'2-digit',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})
        : '';

      tr.append(td1,td2,td3,td4,td5);

      tr.style.cursor='pointer';
      tr.title='Open score sheet';
      tr.onclick = ()=> window.openScoreSheetFromHighScore(row, !!isPractice);

      tb.appendChild(tr);
    });

    table.appendChild(tb);
    tableHost.appendChild(table);
  }

  // footer
  const backBtn=document.createElement('button'); backBtn.className='btn sq-pill'; backBtn.textContent='Back';
  backBtn.onclick=()=> overlay.remove();
  const closeBtn=document.createElement('button'); closeBtn.className='btn sq-pill'; closeBtn.textContent='Close';
  closeBtn.onclick=()=> overlay.remove();
  footer.append(backBtn, closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e=>{ if(e.key==='Escape') overlay.remove(); });
  modal.tabIndex=0; modal.focus();

  // wire tabs
  leagueBtn.onclick   = ()=> render(false);
  practiceBtn.onclick = ()=> render(true);

  // initial
  await render(false);
}

async function openHighScoresAdminDialog(single=false){ 
  const overlay = document.createElement('div'); overlay.className='modal-backdrop'; 
  const modal   = document.createElement('div'); modal.className='modal'; 
  const title   = document.createElement('h3'); title.textContent=`High Scores — Admin (${single?'Practice':'League'})`; 
  const body    = document.createElement('div'); body.className='modal-body'; 
  const footer  = document.createElement('div'); footer.className='modal-footer';

  async function render(){
    body.innerHTML = '';
    try{
      const list = await cloudListHighScores(single, 50);
      if(!list.length){
        const p=document.createElement('p'); p.textContent='No high scores.'; body.appendChild(p); return;
      }

      const table=document.createElement('table'); table.className='hs-table compact';
      const thead=document.createElement('thead'); const trh=document.createElement('tr');
      ['#','Player','Score','Avg / Round','When','Actions'].forEach(h=>{
        const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
      });
      thead.appendChild(trh); table.appendChild(thead);

      const tb=document.createElement('tbody');
      list.forEach((row, idx) => {
        const tr=document.createElement('tr');

        const td1=document.createElement('td'); td1.textContent=String(idx+1);
        const td2=document.createElement('td'); td2.textContent=row.name;
        const td3=document.createElement('td'); td3.textContent=String(row.score);

        const td4=document.createElement('td');
        const avgRound = MAX_ROUNDS ? (Number(row.score||0)/MAX_ROUNDS) : 0;
        td4.textContent = avgRound.toFixed(1);

        const td5=document.createElement('td');
        const d=new Date(row.ts);
        td5.textContent = !Number.isNaN(d.getTime())
          ? d.toLocaleString(undefined,{year:'2-digit',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})
          : '';
        td5.style.fontSize='0.8rem';

        const td6=document.createElement('td'); td6.className='center';
        const del=document.createElement('button'); del.className='btn small danger'; del.textContent='Delete';
        del.onclick = async () => {
          if (!confirm('Delete this high score?')) return;
          try { await cloudDeleteHighScore(row, single); await render(); }
          catch(e){ console.error(e); toast('Delete failed'); }
        };
        td6.appendChild(del);

        tr.append(td1,td2,td3,td4,td5,td6);

        // click → score sheet
        tr.style.cursor='pointer';
        tr.title='Open score sheet';
        tr.onclick = (e)=> {
          if (e.target === del) return;           // don’t open when pressing Delete
          openScoreSheetFromHighScore(row, single);
        };

        tb.appendChild(tr);
      });

      table.appendChild(tb); 
      body.appendChild(table);
    } catch(err){
      console.error(err);
      const p=document.createElement('p'); p.textContent='Failed to load.'; body.appendChild(p);
    }
  }

  await render();

  const backBtn=document.createElement('button');
  backBtn.className='btn';
  backBtn.textContent='Back';
  backBtn.onclick=()=>{ overlay.remove(); openAdminHub(); };
  const closeBtn=document.createElement('button'); 
  closeBtn.className='btn'; 
  closeBtn.textContent='Exit'; 
  closeBtn.onclick=()=>overlay.remove(); 
  footer.append(backBtn, closeBtn);

  modal.append(title, body, footer); 
  overlay.appendChild(modal); 
  document.body.appendChild(overlay); 

  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e=>{ if(e.key==='Escape') overlay.remove(); }); 
  modal.tabIndex=0; modal.focus(); 
}
// League Low Scores — Admin dialog
async function openLeagueLowsAdminDialog(){
  const overlay = document.createElement('div'); overlay.className='modal-backdrop';
  const modal   = document.createElement('div'); modal.className='modal';
  const title   = document.createElement('h3');  title.textContent='League Low Scores — Admin';
  const body    = document.createElement('div'); body.className='modal-body';
  const footer  = document.createElement('div'); footer.className='modal-footer';

  async function render(){
    body.innerHTML = '';

    try{
      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()){
        const p = document.createElement('p');
        p.textContent = 'Cloud not initialised.';
        body.appendChild(p);
        return;
      }
    }catch(_){}

      // >>> PATCH:MOT3_2_LLS_FILTER_SAVED START
  let __llsSavedSet = null;
  try{
    const __ps = await (typeof cloudListPlayers === 'function' ? cloudListPlayers() : []);
    __llsSavedSet = new Set((__ps||[]).map(p=>String(p?.name||'').trim().toLowerCase()).filter(Boolean));
  }catch(_){ __llsSavedSet = null; }
  // <<< PATCH:MOT3_2_LLS_FILTER_SAVED END

// Derived low scores from official games (no dedicated table required)
    let rows = [];
    try{
      const games = await cloudFetchAllGamesAsLocal();
      (games||[]).filter(isOfficialGame).forEach(g=>{
        const ts = g.ts || g.created_at || g.inserted_at || (g.meta && (g.meta.ts || g.meta.date)) || null;
        const players = Array.isArray(g.players) ? g.players : [];
        const totals  = Array.isArray(g.totals)  ? g.totals  : [];
        players.forEach((p,i)=>{
          const name = (typeof p==='string') ? p : (p && p.name) ? p.name : '';
          if (!name) return;
          const __k = String(name).trim().toLowerCase();
          const __savedSet = (typeof __llsSavedSet !== "undefined" ? __llsSavedSet : (window.__llsSavedSet || null));
          if (__savedSet && !__savedSet.has(__k)) return;
          rows.push({ name, score: Number(totals[i]||0), ts, __game: g });
        });
      });
      rows.sort((a,b)=> (a.score-b.score) || (Date.parse(a.ts||'')-Date.parse(b.ts||'')));
      rows = rows.slice(0, 50);
    }catch(e){
      console.error('League low scores derived fetch failed', e);
      const p = document.createElement('p');
      p.textContent = 'Failed to load league low scores.';
      body.appendChild(p);
      return;
    }

    if (!rows.length){
      const p = document.createElement('p');
      p.textContent = 'No league low scores found.';
      body.appendChild(p);
      return;
    }

    const table = document.createElement('table'); table.className='hs-table compact';
    const thead = document.createElement('thead'); const trh=document.createElement('tr');
    ['#','Player','Score','When','Actions'].forEach(h=>{
      const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    const tb = document.createElement('tbody');

    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');

      const td1 = document.createElement('td'); td1.textContent = String(idx+1);
      const td2 = document.createElement('td'); td2.textContent = row.name || '';
      const td3 = document.createElement('td'); td3.textContent = String(row.score ?? '');

      const td4 = document.createElement('td');
      const d   = new Date(row.ts);
      td4.textContent = !Number.isNaN(d.getTime())
        ? d.toLocaleString(undefined,{year:'2-digit',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})
        : '';
      td4.style.fontSize = '0.8rem';

      const td5 = document.createElement('td'); td5.className='center';
      const del = document.createElement('button'); del.className='btn small danger'; del.textContent='Delete';
      del.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete ${row.name}'s low score of ${row.score}?`)) return;
        try{
          // Derived list: delete the underlying game instead
          if (!row.__game) throw new Error('Missing game for delete');
          await cloudDeleteGameCascade(Object.assign({}, row.__game, { ts: row.ts }));// >>> PATCH:MOT3_2_LLS_DELETE_TS

          if (typeof toast === 'function') toast('Deleted');
          await render();
        }catch(err){
          console.error('Delete league low score failed', err);
          if (typeof toast === 'function') toast('Delete failed');
        }
      };
      td5.appendChild(del);

      tr.append(td1, td2, td3, td4, td5);
      tb.appendChild(tr);
    });

    table.appendChild(tb);
    body.appendChild(table);
  }

  await render();

  const backBtn  = document.createElement('button'); backBtn.className='btn'; backBtn.textContent='Back';
  backBtn.onclick = ()=>{ overlay.remove(); if (typeof openAdminHub === 'function') openAdminHub(); };
  const closeBtn = document.createElement('button'); closeBtn.className='btn'; closeBtn.textContent='Exit';
  closeBtn.onclick = ()=> overlay.remove();
  footer.append(backBtn, closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e=>{ if(e.key==='Escape') overlay.remove(); });
  modal.tabIndex=0; modal.focus();
}

// All Games dialog (cloud-only, with Delete and re-render)
async function openAllGamesDialog(){
  const overlay = document.createElement('div'); overlay.className='modal-backdrop';
  const modal   = document.createElement('div'); modal.className='modal';
  const title   = document.createElement('h3');  title.textContent='All Games';
  const body    = document.createElement('div'); body.className='modal-body';
  const footer  = document.createElement('div'); footer.className='modal-footer';

  // >>> PATCH:MOT3_2_ALLGAMES_TOTS START
  const toTS = (g)=>{
    const t = g?.ts || g?.created_at || g?.inserted_at || (g?.meta && (g.meta.ts || g.meta.date)) || null;
    const n = t ? Date.parse(t) : NaN;
    return Number.isFinite(n) ? n : 0;
  };
  // <<< PATCH:MOT3_2_ALLGAMES_TOTS END

  // Header with filter controls (top-right)
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex; gap:6px;';
  const officialBtn = document.createElement('button'); officialBtn.className='btn primary'; officialBtn.textContent='Official';
  const turboBtn = document.createElement('button'); turboBtn.className='btn';             turboBtn.textContent='Turbo';
  const practiceBtn = document.createElement('button'); practiceBtn.className='btn';          practiceBtn.textContent='Practice';
  const archivedBtn = document.createElement('button'); archivedBtn.className='btn';         archivedBtn.textContent='Archived';
  controls.append(officialBtn, turboBtn, practiceBtn, archivedBtn);
  header.append(title, controls);

  // Filter state + saved players cache
  let filterMode = 'official';
  let savedSet = null;
  async function getSavedSet(){
    try{
      if (savedSet) return savedSet;
      const players = await (typeof cloudListPlayers === 'function' ? cloudListPlayers() : []);
      savedSet = new Set((players||[]).map(p => String(p?.name || '').trim().toLowerCase()).filter(Boolean));
      return savedSet;
    }catch(_){
      savedSet = new Set();
      return savedSet;
    }
  }

  // Wire filter buttons
  officialBtn.onclick = async ()=>{
    filterMode = 'official';
    officialBtn.className = 'btn primary';
    turboBtn.className = 'btn';
    practiceBtn.className = 'btn';
    archivedBtn.className = 'btn';
    await render();
  };
  turboBtn.onclick = async ()=>{
    filterMode = 'turbo';
    turboBtn.className = 'btn primary';
    officialBtn.className = 'btn';
    practiceBtn.className = 'btn';
    archivedBtn.className = 'btn';
    await render();
  };

  practiceBtn.onclick = async ()=>{
    filterMode = 'practice';
    practiceBtn.className = 'btn primary';
    officialBtn.className = 'btn';
    turboBtn.className = 'btn';
    archivedBtn.className = 'btn';
    await render();
  };
  archivedBtn.onclick = async ()=>{
    filterMode = 'archived';
    archivedBtn.className = 'btn primary';
    officialBtn.className = 'btn';
    turboBtn.className = 'btn';
    practiceBtn.className = 'btn';
    await render();
  };

  async function render(){
    body.innerHTML = '';

    // Build list (cloud games only; no synthetic backfill here to avoid duplicates)
    let cloudGames = [];
    try { cloudGames = await cloudFetchAllGamesAsLocal(); } catch(e){ console.error(e); cloudGames = []; }

    // >>> PATCH:MOT3_3_ALLGAMES_FILTER_ACTIVE_START
    const saved = await getSavedSet();

    const norm = (s)=>String(s||'').trim().toLowerCase();
    const playerNames = (g)=> (Array.isArray(g?.players)? g.players: []).map(p=>{
      if (typeof p === 'string') return p;
      return (p && p.name) ? p.name : '';
    }).filter(Boolean);

    const hasAnySavedPlayer = (g)=>{
      if (!saved || !saved.size) return false;
      return playerNames(g).some(nm => saved.has(norm(nm)));
    };

    const isExplicitPractice = (g)=>{
      return (g?.mode === 'practice' || g?.is_practice === true || g?.isPractice === true);
    };

    const isTurboAdmin = (g)=>{
      const st = g?.state || {};
      const m = g?.match || st?.match || {};
      const rules = g?.tournamentRules || st?.tournamentRules || m?.tournamentRules || {};
      return String(g?.tournamentType || st?.tournamentType || m?.tournamentType || '').toLowerCase() === 'turbo'
        || rules.strictTimer === true
        || Number(rules.throwLimitSeconds || 0) === 20
        || String(rules.startTarget || '').toLowerCase() === '17';
    };

    const isSinglePlayer = (g)=>{
      const pls = playerNames(g);
      return pls.length < 2;
    };

    // OFFICIAL:
    // - NOT practice
    // - 2+ players
    // - at least ONE saved player (allows mixes with guests)
    const isOfficialAdmin = (g)=>{
      if (!g) return false;
      if (isTurboAdmin(g)) return false;
      if (isExplicitPractice(g)) return false;
      if (isSinglePlayer(g)) return false;
      return hasAnySavedPlayer(g);
    };

    let gamesAll = (cloudGames || []).filter(Boolean).sort((a,b)=> toTS(b) - toTS(a));

    // Archived handling: archived games must be invisible in Official/Practice lists,
    // but viewable under the Admin "Archived" tab.
    const isArchivedGame = (g)=> !!(g && (g.archived_at || g.archivedAt));
    const gamesActive = gamesAll.filter(g => !isArchivedGame(g));
    const gamesArchived = gamesAll.filter(g => isArchivedGame(g));
    // PRACTICE:
    // - ALL explicit practice games (solo or multi)
    // - ALL single-player games (treated as practice bucket)
    // - multiplayer non-practice games where nobody is saved (guest-only / unregistered)
    const isPracticeAdmin = (g)=>{
      if (!g) return false;
      if (isTurboAdmin(g)) return false;
      if (isExplicitPractice(g)) return true;
      if (isSinglePlayer(g)) return true;
      // non-practice multiplayer: include only if nobody is saved
      return !hasAnySavedPlayer(g);
    };

    let games = [];
    if (filterMode === 'archived') {
      games = gamesArchived;
    } else if (filterMode === 'turbo') {
      games = gamesActive.filter(g => isTurboAdmin(g));
    } else {
      games = gamesActive.filter(g => {
        return (filterMode === 'official') ? isOfficialAdmin(g) : isPracticeAdmin(g);
      });
    }

    // If there are no saved players available, official should show none (avoid leaking guest-only games into official).
    if (filterMode === 'official' && (!saved || !saved.size)) {
      const p=document.createElement('p');
      p.textContent='No saved players found. Official games require at least one saved player.';
      body.appendChild(p);
      return;
    }

    // IMPORTANT: Do NOT synthesize "practice" games from any high_scores tables.
    // Those tables are per-player score records and can legitimately contain scores from official matches.
    // Practice tab must reflect actual games only (TABLE_GAMES):
    //   - explicit practice games, OR
    //   - multiplayer games with no saved/registered players.
// <<< PATCH:MOT3_3_ALLGAMES_FILTER_ACTIVE_END

    if (!games.length){
      const p=document.createElement('p'); p.textContent='No games found.'; body.appendChild(p); return;
    }

    const table=document.createElement('table'); table.className='hs-table';

    // Column layout: # | When | Players | Totals | Actions
    const colgroup = document.createElement('colgroup');
    const cIdx = document.createElement('col'); cIdx.style.width = '3ch'; colgroup.appendChild(cIdx); // #
    colgroup.appendChild(document.createElement('col')); // When
    colgroup.appendChild(document.createElement('col')); // Players
    colgroup.appendChild(document.createElement('col')); // Totals
    const cAct = document.createElement('col'); cAct.style.width = '88px'; colgroup.appendChild(cAct); // Actions
    table.appendChild(colgroup);

    const thead=document.createElement('thead'); const trh=document.createElement('tr');
    ['#','When','Players','Totals',''].forEach((h,i)=>{
      const th=document.createElement('th'); th.textContent=h;
      if(i===0) th.style.width='3ch';   // # column
      if(i===4) th.style.width=(filterMode==='archived' ? '190px' : '110px');  // actions column
      trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    const tb=document.createElement('tbody');
    games.forEach((g, idx)=>{
      const tr=document.createElement('tr');

      const td1=document.createElement('td'); td1.textContent=String(idx+1); td1.style.width='3ch';
      const td2 = document.createElement('td');
      const tsVal = g.ts || g.created_at || g.inserted_at || (g.meta && (g.meta.ts || g.meta.date)) || null;
      td2.textContent = (window.fmtWhen && tsVal) ? window.fmtWhen(tsVal) : '';
      const td3=document.createElement('td'); td3.textContent=(g.players||[]).map(p=> (typeof p==='string'?p:(p&&p.name)||'')).filter(Boolean).join(', ');
      const td4=document.createElement('td'); td4.textContent=(g.totals||[]).join(' · ');

      // Action buttons (Archive / Reinstate / Delete)
      const tdDel=document.createElement('td'); tdDel.className='center'; tdDel.style.display='flex'; tdDel.style.justifyContent='center'; tdDel.style.gap='10px'; tdDel.style.whiteSpace='nowrap';

      if (filterMode === 'archived') {
        const reinBtn=document.createElement('button'); reinBtn.className='btn small'; reinBtn.textContent='Reinstate';
        reinBtn.title='Reinstate this archived game (make visible again everywhere)';
        reinBtn.onclick = async (e)=>{
          e.stopPropagation();
          if (!confirm('Reinstate this archived game?')) return;
          try { await cloudReinstateGame(g); toast('Reinstated'); await render(); }
          catch(err){ console.error(err); toast('Reinstate failed'); }
        };

        const delBtn=document.createElement('button'); delBtn.className='btn small danger'; delBtn.textContent='Delete';
        delBtn.title='PERMANENTLY delete this game and all related data';
        delBtn.onclick = async (e)=>{
          e.stopPropagation();
          const msg = `PERMANENT DELETE

This removes the game and related data everywhere (including high scores).

Type DELETE to confirm:`;
          const typed = prompt(msg);
          if ((typed || '').trim().toUpperCase() !== 'DELETE') return;
          try { await cloudPurgeGameCascade(g); toast('Deleted'); await render(); }
          catch(err){ console.error(err); toast('Delete failed'); }
        };

        tdDel.appendChild(reinBtn);
        tdDel.appendChild(document.createTextNode(' '));
        tdDel.appendChild(delBtn);
      } else {
        const archBtn=document.createElement('button'); archBtn.className='btn small danger'; archBtn.textContent='Archive';
        archBtn.title='Archive this game (remove from all user-visible stats and lists)';
        archBtn.onclick = async (e)=>{
          e.stopPropagation();
          if (!confirm('Archive this game? (It will disappear from stats/high scores everywhere)')) return;
          try { await cloudArchiveGame(g); toast('Archived'); await render(); }
          catch(err){ console.error(err); toast('Archive failed'); }
        };
        tdDel.appendChild(archBtn);
      }

      tr.style.cursor='pointer';
      tr.title='Open score sheet';
      tr.onclick=()=>{ if (typeof openSingleGameScoreSheet === 'function') openSingleGameScoreSheet(g); };

      tr.append(td1, td2, td3, td4, tdDel); tb.appendChild(tr);
    });

    table.appendChild(tb); body.appendChild(table);
  }

  // Footer
  const backBtn=document.createElement('button'); backBtn.className='btn sq-pill'; backBtn.textContent='Back';
  backBtn.onclick=()=>{ overlay.remove(); if (typeof openAdminHub==='function') openAdminHub(); };
  const closeBtn=document.createElement('button'); closeBtn.className='btn sq-pill'; closeBtn.textContent='Close';
  closeBtn.onclick=()=> overlay.remove();
  footer.append(backBtn, closeBtn);

  modal.append(header, body, footer); overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e=>{ if(e.key==='Escape') overlay.remove(); });
  modal.tabIndex=0; modal.focus();

  await render();
}

// LEGACY ROUND HIGH SCORES DYNAMIC IMPLEMENTATION — QUARANTINED
// Superseded by v82, v85, and final Fix97/Fix102 path.
// Do not patch this block for current UI unless caller tracing proves it is active.
// [removed: openRoundHighScoresDialog base def (self-quarantined)] audit P5.3 batch 3 — shadowed by later canonical definition
// Delete a game (by timestamp) and its related high-score rows from Supabase
async function cloudDeleteGameCascade(g){
  if (!ensureCloudInit()) throw new Error('Cloud not initialised');

  const gameId = g?.id || g?.game_id || null;
  const ts = g?.ts || g?.created_at || null;
  if (!gameId && !ts) throw new Error('Missing game id/timestamp for delete');

  // 1) Delete the game row (prefer id)
  if (gameId){
    const { error } = await sb.from(TABLE_GAMES).delete().eq('id', gameId);
    if (error) throw error;
  } else {
    // fallback by exact timestamp, then ±2min
    try {
      const { error } = await sb.from(TABLE_GAMES).delete().eq('created_at', ts);
      if (error) throw error;
    } catch (e) {
      const pad = 2 * 60 * 1000;
      const fromIso = new Date(new Date(ts).getTime() - pad).toISOString();
      const toIso   = new Date(new Date(ts).getTime() + pad).toISOString();
      const { error } = await sb.from(TABLE_GAMES).delete().gte('created_at', fromIso).lte('created_at', toIso);
      if (error) throw error;
    }
  }

  // 2) Delete related HS rows (prefer game_id). If schema lacks game_id, fall back to legacy delete.
  const isSingle = (g?.players || []).length === 1;
  const table = isSingle ? TABLE_HS_PRACTICE : TABLE_HS_LEAGUE;

  if (gameId){
    try{
      const { error } = await sb.from(table).delete().eq('game_id', gameId);
      if (error) throw error;
      return;
    }catch(e){
      const msg  = String(e?.message || '');
      const code = String(e?.code || '');
      const missingCol = (code === '42703') || /game_id/i.test(msg);
      if (!missingCol) throw e;
      // else fall through to legacy matching
    }
  }

  const players = g?.players || [];
  const totals  = g?.totals  || [];
  const tasks = players.map((p,i)=>{
    const row = { name: p?.name || '', score: Number(totals[i]||0), ts: ts };
    return cloudDeleteHighScore(row, isSingle).catch(()=>{});
  });
  await Promise.all(tasks);
}

  /*****************
   * CLOUD INIT HELPER
   *****************/
