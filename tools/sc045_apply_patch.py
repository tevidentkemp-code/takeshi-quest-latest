from pathlib import Path
import re, json, hashlib

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 literal match, found {count}')
    return text.replace(old, new, 1)

def sub_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 regex match, found {count}')
    return out

# ---------------------------------------------------------------------------
# src/game/engine.js — presentation-only trigger language, PB line and turn intro
# ---------------------------------------------------------------------------
path = 'src/game/engine.js'
engine = read(path)

helper = r'''// >>> PATCH:SC045_DMD_ARCADE_PRESENTATION_HELPERS START
// Presentation-only DMD helpers. Persistent PB truth is read from the verified
// official PB view; no scoring/game-state/persistence writes occur here.
(function(){
  if (window.__sqSc045DmdHelpers) return;
  window.__sqSc045DmdHelpers = true;

  const normName = (v) => String(v == null ? '' : v).trim().toLowerCase();
  const officialMode = () => {
    try { if (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime()) return false; } catch(_){}
    let mode = '';
    try { mode = String((typeof __sqComputeGameMode === 'function' ? __sqComputeGameMode() : '') || state?.gameMode || state?.mode || state?.match?.mode || state?.match?.gameMode || '').toLowerCase(); } catch(_){}
    if (mode) return mode === 'official' || mode === 'classic';
    try { return (state?.players?.length || 0) >= 2 && state?.isPractice !== true && state?.is_practice !== true; } catch(_) { return false; }
  };

  window.__sqDmdPbCache = window.__sqDmdPbCache || { byId:new Map(), byName:new Map(), ts:0, loaded:false, promise:null };
  window.__sqDmdPrimePbCache = async function(force=false){
    const c = window.__sqDmdPbCache;
    if (!officialMode()) return c;
    if (!force && c.loaded && (Date.now() - Number(c.ts || 0)) < 300000) return c;
    if (c.promise) return c.promise;
    c.promise = (async()=>{
      try{
        const client = window.sb || (typeof sb !== 'undefined' ? sb : null);
        if (!client || typeof client.from !== 'function') return c;
        const res = await client.from('v_player_best_official_ranked').select('player_id,player_name,best_score');
        if (res && res.error) return c;
        const byId = new Map(), byName = new Map();
        (Array.isArray(res?.data) ? res.data : []).forEach(row => {
          const score = Number(row?.best_score);
          if (!Number.isFinite(score)) return;
          if (row?.player_id) byId.set(String(row.player_id), score);
          const nk = normName(row?.player_name);
          if (nk) byName.set(nk, score);
        });
        c.byId = byId; c.byName = byName; c.ts = Date.now(); c.loaded = true;
      }catch(_){}
      return c;
    })().finally(()=>{ c.promise = null; });
    return c.promise;
  };

  window.__sqDmdPbForPlayer = function(player){
    if (!officialMode()) return null;
    const c = window.__sqDmdPbCache;
    if (!c || !c.loaded) return null;
    try{
      const id = player && (player.id || player.player_id);
      if (id && c.byId?.has(String(id))) return Number(c.byId.get(String(id)));
      const name = normName(typeof player === 'string' ? player : (player?.name || player?.full || player?.nickname || ''));
      if (name && c.byName?.has(name)) return Number(c.byName.get(name));
    }catch(_){}
    return null;
  };

  window.__sqDmdBuildPreThrowInfo = function(playerIdx){
    try{
      const players = Array.isArray(state?.players) ? state.players : [];
      const pCount = Math.max(1, players.length || 1);
      const idx = Math.max(0, Math.min(pCount - 1, Number(playerIdx) || 0));
      const totalFor = (i) => (Array.isArray(state?.score?.[i]) ? state.score[i] : []).reduce((sum,row)=>sum + Number(row?.roundTotal || 0), 0);
      const totals = players.map((_,i)=>totalFor(i));
      const total = Number(totals[idx] || 0);
      const above = totals.filter(v => Number(v || 0) > total).length;
      const pos = 1 + above;
      const leader = totals.length ? Math.max(...totals.map(v=>Number(v || 0))) : total;
      const lower = Array.from(new Set(totals.map(v=>Number(v || 0)))).filter(v=>v < total).sort((a,b)=>b-a)[0];
      const diffVal = total >= leader ? (Number.isFinite(lower) ? total - lower : 0) : total - leader;
      const diffTxt = `${diffVal >= 0 ? '+' : ''}${diffVal}`;
      const pb = window.__sqDmdPbForPlayer?.(players[idx]);
      const pbTxt = Number.isFinite(Number(pb)) ? String(Math.round(Number(pb))) : '—';
      return [
        `SCORE: ${total}  PB: ${pbTxt}`,
        `POS: ${pos}/${pCount} • DIFF: ${diffTxt}`
      ];
    }catch(_){ return ['SCORE: 0  PB: —']; }
  };

  window.__sqDmdShowTurnIntro = function(first=false){
    try{
      if (!state || state.finished || Number(state.currentDart || 0) !== 0) return false;
      const players = Array.isArray(state.players) ? state.players : [];
      const idx = Number(state.currentPlayer || 0);
      const p = players[idx];
      if (!p) return false;
      const name = (typeof p === 'string' ? p : (p.name || p.full || p.nickname || p.code || p.initials || `P${idx+1}`)).toString().trim();
      if (!name || typeof window.sqDmdShowZones !== 'function') return false;
      try{ window.__sqDmdPrimePbCache?.(); }catch(_){}
      const round = Number(state.currentRound || 0), dart = Number(state.currentDart || 0), hist = Array.isArray(state.history) ? state.history.length : 0;
      window.sqDmdShowZones({ z2:name, z3:(first ? 'TO THROW FIRST' : 'TO THROW') }, { type:'wipe', ms:820, fx:'impact', z3Small:true });
      setTimeout(()=>{
        try{
          if (state.finished || Number(state.currentPlayer || 0) !== idx || Number(state.currentRound || 0) !== round || Number(state.currentDart || 0) !== dart || (Array.isArray(state.history) ? state.history.length : 0) !== hist) return;
          window.sqDmdShowZones?.({ z2:name, z3:'' }, { type:'hold', ms:1 });
          window.__sqDmdStartPreThrow?.(name, window.__sqDmdBuildPreThrowInfo?.(idx) || []);
        }catch(_){}
      }, 840);
      return true;
    }catch(_){ return false; }
  };
})();
// <<< PATCH:SC045_DMD_ARCADE_PRESENTATION_HELPERS END

'''
engine = replace_once(engine, '// ===== @SEC:JS:GAME:ENGINE =====\n', '// ===== @SEC:JS:GAME:ENGINE =====\n' + helper, 'engine helper insertion')

combo_block = r'''// >>> PATCH:SQ_DMD_VOLDY_TRIGGER START
  const __isDoublesRound = (roundDef && roundDef.type === 'doubles');
  const __isTriplesRound = (roundDef && roundDef.type === 'triples');
  const __sector = (dartObj && typeof dartObj.sector === 'number') ? dartObj.sector : (dartObj && typeof dartObj.segment === 'number' ? dartObj.segment : (dartObj && dartObj.sector ? Number(dartObj.sector) : 0));
  const __low12345 = (__sector >= 1 && __sector <= 5);
  const __hitIsD = (kind === 'Double' || kind === 'D');
  const __hitIsT = (kind === 'Triple' || kind === 'T');
  const __voldyHit = (__low12345 && ((__isDoublesRound && __hitIsD) || (__isTriplesRound && __hitIsT)));
  // <<< PATCH:SQ_DMD_VOLDY_TRIGGER END

  // ----- Per-turn counters (presentation only) -----
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
    if (/^B$/i.test(k)) return 'B';
    return k;
  };
  const __thirdMissAfterTwoTriples = (dartIndex === 2 && (kind === 'Miss' || pts === 0) && __kindFor(__priorDarts[0]) === 'T' && __kindFor(__priorDarts[1]) === 'T');
  const __thirdMissAfterTwoDoubles = (dartIndex === 2 && (kind === 'Miss' || pts === 0) && __kindFor(__priorDarts[0]) === 'D' && __kindFor(__priorDarts[1]) === 'D');
  const __thirdIsScoringAfterTwoMisses = (dartIndex === 2 && kind !== 'Miss' && pts > 0 && __kindFor(__priorDarts[0]) === 'Miss' && __kindFor(__priorDarts[1]) === 'Miss');
  const __lastDartHeroImageHit = (__thirdIsScoringAfterTwoMisses && (kind === 'Double' || kind === 'D' || kind === 'Triple' || kind === 'T' || kind === 'B'));
  const __turnKindsAll = __priorDarts.concat([dartObj]).map(__kindFor);
  const __turnKinds = __turnKindsAll.filter(k => k && k !== 'Miss');
  const __hasS = __turnKinds.includes('S'), __hasD = __turnKinds.includes('D'), __hasT = __turnKinds.includes('T');
  const __isShanghai = (dartIndex === 2 && __hasS && __hasD && __hasT);
  const __isDesmondDelight = (dartIndex === 2 && __turnKindsAll.filter(k => k === 'S').length === 2 && __turnKindsAll.filter(k => k === 'D').length === 1 && !__hasT && !__turnKindsAll.includes('Miss'));
  const __turnDarts = Array.isArray(entry && entry.darts) ? entry.darts.slice(0, dartIndex + 1) : [];
  const __roundTotalNow = __turnDarts.reduce((s,d)=> s + Number(d && (d.points ?? d.pts ?? d.score) || 0), 0);
  const __distinctKinds = Array.from(new Set(__turnKinds));
  const __isDirtyTurn = (dartIndex === 2 && __roundTotalNow > 0 && __roundTotalNow <= 30 && !__isShanghai && !__isDesmondDelight && __distinctKinds.length >= 2);
  const __isScratchVisit = (dartIndex === 2 && __roundTotalNow === 0);

  function __sqQueueComboPhrase(phrase, opts){
    try{
      if (!window.sqDmdShowZones) return false;
      const words = String(phrase || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
      if (!words.length) return false;
      try{ if (typeof q !== 'undefined' && Array.isArray(q)) q.length = 0; if (typeof active !== 'undefined' && active && active.type !== 'idle') active.ms = 0; }catch(_){}
      const withImage = !!(opts && opts.imageType);
      const stepMs = Number((opts && opts.stepMs) || 340);
      const finalHoldMs = stepMs + 500;
      const rz2 = String((opts && opts.restoreZ2) ?? '');
      const rz3 = String((opts && opts.restoreZ3) ?? '');
      if (withImage) window.sqDmdShowZones({ z2:'', z3:'' }, { type: opts.imageType, ms: Number(opts.imageMs || 900), amp: Number(opts.amp || 3.0) });
      if (opts && opts.wholePhrase) {
        window.sqDmdShowZones({ z2:String(phrase || '').toUpperCase(), z3:'' }, { type:'flash', ms:Number(opts.phraseMs || finalHoldMs), fx:'impact' });
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
      if (opts && opts.afterType) window.sqDmdShowZones({ z2:'', z3:'' }, { type:opts.afterType, ms:Number(opts.afterMs || 1000), amp:Number(opts.afterAmp || 0) });
      window.sqDmdShowZones({ z2:rz2, z3:rz3 }, { type:'hold', ms:1 });
      return true;
    }catch(_){ return false; }
  }

  function __sqQueueTwoBeat(first, second, opts){
    try{
      if (!window.sqDmdShowZones) return false;
      const rz2 = String((opts && opts.restoreZ2) ?? ''), rz3 = String((opts && opts.restoreZ3) ?? '');
      window.sqDmdShowZones({ z2:String(first || '').toUpperCase(), z3:'' }, { type:'flash', ms:Number((opts && opts.firstMs) || 620), fx:'impact' });
      window.sqDmdShowZones({ z2:String(second || '').toUpperCase(), z3:'' }, { type:'flash', ms:Number((opts && opts.secondMs) || 720), fx:'impact' });
      window.sqDmdShowZones({ z2:rz2, z3:rz3 }, { type:'hold', ms:1 });
      return true;
    }catch(_){ return false; }
  }

  let z2 = '';
  let fx = { type:'flash', ms:650 };
  let __queueOnlyCombo = false;

  if (kind === 'Miss' || pts === 0) {
    if (window.__sqSuppressMissCallouts || window.__sqSkipInProgress) {
      __queueOnlyCombo = true;
    } else if (__thirdMissAfterTwoTriples || __thirdMissAfterTwoDoubles) {
      z2 = 'AWKWARD';
      fx = { type:'shake', amp:3.0, ms:900, fx:'impact' };
    } else if (__isScratchVisit) {
      z2 = 'SCRATCH';
      fx = { type:'flash', ms:760, fx:'smear' };
    } else {
      z2 = 'MISS';
      fx = { type:'flash', ms:650, fx:'smear' };
    }
  } else if (__isDesmondDelight) {
    __queueOnlyCombo = __sqQueueComboPhrase('DESMOND DELIGHT', { imageType:'desmondImg', imageMs:950, amp:3.6, stepMs:280, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
  } else if (__isShanghai) {
    __queueOnlyCombo = __sqQueueComboPhrase('SHANGHAI', { stepMs:320, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
  } else if (__thirdIsScoringAfterTwoMisses) {
    __queueOnlyCombo = __sqQueueComboPhrase('LAST DART HERO', (__lastDartHeroImageHit ? { imageType:'lastDartImg', imageMs:900, amp:3.4, stepMs:260, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) } : { stepMs:260, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) }));
  } else if (__voldyHit) {
    try{ window.__sqPlayVoldyLaugh && window.__sqPlayVoldyLaugh(); }catch(_){}
    __queueOnlyCombo = __sqQueueComboPhrase('HAHA HA HAHAA!', { imageType:'voldyImg', imageMs:900, amp:2.8, stepMs:300, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
  } else if (kind === 'B') {
    if (dartObj.bull === 'Inner') {
      __queueOnlyCombo = __sqQueueComboPhrase('BULLSEYE', { wholePhrase:true, phraseMs:700, afterType:'bullseyeHit', afterMs:1100, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    } else {
      z2 = 'OUTER!';
      fx = { type:'shake', amp:2.0, ms:760, fx:'impact' };
    }
  } else if (kind === 'Triple' || kind === 'T') {
    window.__sqDmdTripleCount = (window.__sqDmdTripleCount||0) + 1;
    const n = window.__sqDmdTripleCount;
    if (n === 1) {
      z2 = 'TREBLE!';
      fx = { type:'shake', amp:2.3, ms:850, fx:'impact' };
    } else if (n === 2 && dartIndex === 1) {
      z2 = 'CAN HE......?';
      fx = { type:'anticipationEyes', ms:1150, fx:'impact' };
    } else if (n === 2 && dartIndex === 2) {
      __queueOnlyCombo = __sqQueueTwoBeat('TWO TREBLES', 'NICE FINISH', { restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    } else {
      __queueOnlyCombo = __sqQueueComboPhrase('MAXI MAYHEM!', { stepMs:250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    }
  } else if (kind === 'Double' || kind === 'D') {
    window.__sqDmdDoubleCount = (window.__sqDmdDoubleCount||0) + 1;
    const n = window.__sqDmdDoubleCount;
    if (n === 1) {
      z2 = 'DOUBLE!';
      fx = { type:'flash', ms:800, fx:'impact' };
    } else if (n === 2 && dartIndex === 1) {
      z2 = 'HOLD UP....';
      fx = { type:'anticipationEyes', ms:1150, fx:'impact' };
    } else if (n === 2 && dartIndex === 2) {
      z2 = 'TWO DOUBLES!';
      fx = { type:'flash', ms:850, fx:'impact' };
    } else {
      __queueOnlyCombo = __sqQueueComboPhrase('GET IN THE SEA!!', { wholePhrase:true, phraseMs:760, afterType:'dolphinSwim', afterMs:2000, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    }
  } else if (__isDirtyTurn) {
    __queueOnlyCombo = __sqQueueComboPhrase('UGLY BUT IT COUNTS', { stepMs:250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
  } else {
    window.__sqDmdSingleCount = (window.__sqDmdSingleCount||0) + 1;
    const n = window.__sqDmdSingleCount;
    if (n >= 3 && dartIndex === 2) {
      const pool = ['STEADY HAND', 'DOING THE BASICS', 'SLOW AND STEADY', 'MAKING BANK', 'EASY MONEY', 'BASIC BITCH'];
      const key = String(pIndex);
      let pickIndex = Math.abs((pIndex||0) + (rIndex||0) + Number(entry?.roundTotal||0)) % pool.length;
      const lastMap = window.__sqDmdLastSinglePhraseByPlayer || (window.__sqDmdLastSinglePhraseByPlayer = Object.create(null));
      if (lastMap[key] === pool[pickIndex]) pickIndex = (pickIndex + 1) % pool.length;
      const pick = pool[pickIndex];
      lastMap[key] = pick;
      __queueOnlyCombo = __sqQueueComboPhrase(pick, { stepMs:250, restoreZ2:'', restoreZ3:(window.__sqDmdBulkMiss ? '' : seq) });
    } else {
      z2 = 'SINGLE';
      fx = { type:'wipe', ms:650, fx:'smear' };
    }
  }

'''
engine = sub_once(
    engine,
    r'// >>> PATCH:SQ_DMD_VOLDY_TRIGGER START.*?(?=  // Render all three zones; Z3 always shows the running sequence unless a queued combo owns the display\.)',
    combo_block,
    'engine DMD combo block',
    re.S
)
# Old post-selection Voldy enqueue is now owned inside the new priority chain.
engine = sub_once(engine, r'\n\s*// >>> PATCH:SQ_DMD_VOLDY_ENQUEUE START.*?// <<< PATCH:SQ_DMD_VOLDY_ENQUEUE END\n', '\n', 'remove old engine Voldy enqueue', re.S)
engine = engine.replace("z1 = 'TRL';", "z1 = 'TRB';")
engine = engine.replace("return 'TRL';", "return 'TRB';")
engine = replace_once(engine, "const nextLbl = nextDef ? (nextDef.type === 'number' ? `${nextDef.target}s` : roundLabel(nextDef)) : '';", "const nextLbl = nextDef ? (nextDef.type === 'number' ? `${nextDef.target}` : roundLabel(nextDef)) : '';", 'next target label')
engine = replace_once(engine, "window.sqDmdShowZones?.({ z2: nextName, z3:'TO THROW FIRST' }, { type:'wipe', ms:820, fx:'impact', z3Small:true });", "window.sqDmdShowZones?.({ z2: nextName, z3:'TO THROW' }, { type:'wipe', ms:820, fx:'impact', z3Small:true });", 'round transition TO THROW')
engine = sub_once(engine, r'const infoLines = \[\n\s*`SCORE: \$\{nextTotal\}`,\n\s*`POS: \$\{pos\}/\$\{pCount\} • DIFF: \$\{diffTxt\}`,\n\s*`RND AVG: \$\{fmt1\(rndAvg\)\}`\n\s*\];', "const infoLines = (typeof window.__sqDmdBuildPreThrowInfo === 'function')\n      ? window.__sqDmdBuildPreThrowInfo(nextPlayerIdx)\n      : [`SCORE: ${nextTotal}  PB: —`, `POS: ${pos}/${pCount} • DIFF: ${diffTxt}`];", 'engine prethrow info lines')

old_normal = r'''      setTimeout(()=>{
        if (!__sqDmdStage3Current()) return;
        try{
          window.sqDmdShowZones?.({ z2: 'NEXT UP', z3:'' }, { type:'flash', ms:620, fx:'smear' });
        }catch(_){}
      }, 850);

      setTimeout(()=>{
        if (!__sqDmdStage3Current()) return;
        try{
          window.sqDmdShowZones?.({ z2: nextName, z3:'' }, { type:'hold', ms:1 });
          window.__sqDmdStartPreThrow?.(nextName, infoLines);
        }catch(_){}
      }, 1500);'''
new_normal = r'''      setTimeout(()=>{
        if (!__sqDmdStage3Current()) return;
        try{
          window.sqDmdShowZones?.({ z2: 'NEXT UP', z3:'' }, { type:'flash', ms:620, fx:'smear' });
        }catch(_){}
      }, 850);

      setTimeout(()=>{
        if (!__sqDmdStage3Current()) return;
        try{ window.sqDmdShowZones?.({ z2: nextName, z3:'TO THROW' }, { type:'wipe', ms:700, fx:'impact', z3Small:true }); }catch(_){}
      }, 1500);

      setTimeout(()=>{
        if (!__sqDmdStage3Current()) return;
        try{
          window.sqDmdShowZones?.({ z2: nextName, z3:'' }, { type:'hold', ms:1 });
          window.__sqDmdStartPreThrow?.(nextName, infoLines);
        }catch(_){}
      }, 2250);'''
engine = replace_once(engine, old_normal, new_normal, 'normal NEXT UP sequence')
write(path, engine)

# ---------------------------------------------------------------------------
# src/app/router-ui.js — initial turn intro + Vs Shadow parity
# ---------------------------------------------------------------------------
path = 'src/app/router-ui.js'
router = read(path)
show_anchor = "    try { if (typeof updateUI === 'function') updateUI(); } catch(_) {}\n"
show_insert = show_anchor + r'''    try{
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
'''
router = replace_once(router, show_anchor, show_insert, 'initial DMD turn intro')
router = router.replace("return 'TRL';", "return 'TRB';")

new_vs_callout = r'''function __sqVsShadowDmdCalloutForDart(dart, dartIndex, entry, roundDef){
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

'''
router = sub_once(router, r'function __sqVsShadowDmdCalloutForDart\(dart, dartIndex, entry, roundDef\)\{.*?(?=function __sqShowVsShadowDartFeedback)', new_vs_callout, 'Vs Shadow callout function', re.S)

# Extend the existing Vs Shadow phrase queue with whole-phrase and after-scene support.
router = replace_once(router,
"""    if (o.imageType) {
      window.sqDmdShowZones({ z2:'', z3:'' }, { type:o.imageType, ms:Number(o.imageMs || 900), amp:Number(o.amp || 3.0) });
    }
    if (words.length === 1) {""",
"""    if (o.imageType) {
      window.sqDmdShowZones({ z2:'', z3:'' }, { type:o.imageType, ms:Number(o.imageMs || 900), amp:Number(o.amp || 3.0) });
    }
    if (o.wholePhrase) {
      window.sqDmdShowZones({ z2:String(phrase || '').toUpperCase(), z3:'' }, { type:'flash', ms:Number(o.phraseMs || finalHoldMs), fx:'impact' });
    } else if (words.length === 1) {""", 'Vs Shadow whole phrase support')
router = replace_once(router,
"""    window.sqDmdShowZones({ z2:restoreZ2, z3:restoreZ3 }, { type:'hold', ms:1 });
    return true;""",
"""    if (o.afterType) window.sqDmdShowZones({ z2:'', z3:'' }, { type:o.afterType, ms:Number(o.afterMs || 1000), amp:Number(o.afterAmp || 0) });
    window.sqDmdShowZones({ z2:restoreZ2, z3:restoreZ3 }, { type:'hold', ms:1 });
    return true;""", 'Vs Shadow after-scene support')
router = replace_once(router,
"""    const callout = __sqVsShadowDmdCalloutForDart(dart, dartIndex, entry, roundDef);
    if (callout && callout.phrase) {""",
"""    const callout = __sqVsShadowDmdCalloutForDart(dart, dartIndex, entry, roundDef);
    if (callout && Array.isArray(callout.beats) && callout.beats.length >= 2) {
      window.sqDmdShowZones({ z2:String(callout.beats[0] || '').toUpperCase(), z3:'' }, { type:'flash', ms:620, fx:'impact' });
      window.sqDmdShowZones({ z2:String(callout.beats[1] || '').toUpperCase(), z3:'' }, { type:'flash', ms:720, fx:'impact' });
      window.sqDmdShowZones({ z2:'', z3:seq }, { type:'hold', ms:1 });
      return;
    }
    if (callout && callout.phrase) {""", 'Vs Shadow beat support')

# Replace Vs Shadow prethrow stats with shared PB/position information where available.
router = sub_once(router, r"return \[\n\s*'SCORE: ' \+ total,\n\s*'POS: ' \+ pos \+ '/' \+ pCount,\n\s*'RND AVG: ' \+ avgTxt\n\s*\];", "return (typeof window.__sqDmdBuildPreThrowInfo === 'function') ? window.__sqDmdBuildPreThrowInfo(realIndex) : ['SCORE: ' + total + '  PB: —', 'POS: ' + pos + '/' + pCount];", 'Vs Shadow prethrow info')
write(path, router)

# ---------------------------------------------------------------------------
# src/live-game/live-v2.js — DMD round label vocabulary only
# ---------------------------------------------------------------------------
path = 'src/live-game/live-v2.js'
live = read(path)
live = live.replace("else if (rd?.type === 'triples') z1 = 'TRL';", "else if (rd?.type === 'triples') z1 = 'TRB';")
live = live.replace("String(lbl||'').toUpperCase().includes('TRIPLE') ? 'TRL' :", "String(lbl||'').toUpperCase().includes('TRIPLE') ? 'TRB' :")
write(path, live)

# ---------------------------------------------------------------------------
# src/app/state.js — Decider/tiebreak first-throw wording only; no rules change
# ---------------------------------------------------------------------------
path = 'src/app/state.js'
statejs = read(path)
render_anchor = """  function render(){
    const rDef = R[dec.round];
    const liveP = dec.participants[dec.turn];
"""
render_new = render_anchor + r'''    try{
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
'''
statejs = replace_once(statejs, render_anchor, render_new, 'Decider first throw wording')
write(path, statejs)

# ---------------------------------------------------------------------------
# src/legacy/scripts/inline-007.js — actual classic pinball dot-matrix renderer
# ---------------------------------------------------------------------------
path = 'src/legacy/scripts/inline-007.js'
renderer = read(path)
old_z1 = r'''function drawZ1Target(z1Text, rect){
  const t = (z1Text || "").toString().toUpperCase().trim();
  if (!t) return;

  // Zone 1 is target-only. If callers pass "ROUND\n12", we still only render the target.
  const parts = t.split(/\n/).filter(Boolean);
  const target = (parts.length ? parts[parts.length - 1] : t).trim();
  if (!target) return;

  // Bigger, perfectly centered target (no label).
  drawTextInRect(target, rect, 48, "center", "middle", 700);
}
'''
new_z1 = r'''function drawZ1Target(z1Text, rect){
  const t = (z1Text || "").toString().toUpperCase().trim();
  if (!t) return;
  const parts = t.split(/\n/).filter(Boolean);
  const target = (parts.length ? parts[parts.length - 1] : t).trim();
  if (!target) return;

  // SC-045: make the visible pinball indicator actually read ROUND + target.
  // The label stays small and the target remains the dominant element.
  const top = { x:rect.x, y:rect.y + 3, w:rect.w, h:42 };
  const body = { x:rect.x, y:rect.y + 38, w:rect.w, h:rect.h - 38 };
  drawTextInRect('ROUND', top, 15, "center", "middle", 800);
  drawTextInRect(target, body, 46, "center", "middle", 750);
}
'''
renderer = replace_once(renderer, old_z1, new_z1, 'visible ROUND label')

proc = r'''
  // >>> PATCH:SC045_PINBALL_PROCEDURAL_SCENES START
  // Procedural DMD scenes: deliberately graphic/abstract like classic pinball
  // animations. They are authored directly into the 640x160 native buffer,
  // then pass through the existing amber dot threshold/mask.
  const __sqSc045ReducedMotion = () => {
    try{ return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }catch(_){ return false; }
  };
  const __sqSc045DrawDolphin = (cx, cy, scale, flip) => {
    const sx = flip ? -1 : 1;
    nctx.save(); nctx.translate(cx, cy); nctx.scale(sx * scale, scale);
    nctx.lineWidth = 5; nctx.strokeStyle = 'rgba(255,255,255,1)'; nctx.fillStyle = 'rgba(255,255,255,1)';
    nctx.beginPath();
    nctx.moveTo(-52, 3); nctx.quadraticCurveTo(-16, -28, 30, -8); nctx.quadraticCurveTo(50, 0, 62, -5);
    nctx.quadraticCurveTo(47, 12, 19, 15); nctx.quadraticCurveTo(-18, 25, -52, 3); nctx.closePath(); nctx.stroke();
    nctx.beginPath(); nctx.moveTo(-3,-18); nctx.lineTo(11,-38); nctx.lineTo(21,-13); nctx.closePath(); nctx.fill();
    nctx.beginPath(); nctx.moveTo(-52,3); nctx.lineTo(-72,-13); nctx.lineTo(-66,4); nctx.lineTo(-74,20); nctx.closePath(); nctx.fill();
    nctx.beginPath(); nctx.arc(36,-7,3.2,0,Math.PI*2); nctx.fill();
    nctx.restore();
  };
  // <<< PATCH:SC045_PINBALL_PROCEDURAL_SCENES END
'''
renderer = replace_once(renderer, "\n  function drawNative(now) {", proc + "\n  function drawNative(now) {", 'procedural scene helper insertion')

scene_cases = r'''
    // >>> PATCH:SC045_PINBALL_SCENE_TYPES START
    if (active && active.type === 'anticipationEyes') {
      const age = Math.max(0, now - active.start);
      const reduce = __sqSc045ReducedMotion();
      const t = (z2t || '').toUpperCase();
      const px = Math.max(30, TEXT.topPx - 4);
      const w = measureTextPx(t, px, 800);
      const dur = Math.max(500, Number(active.ms || 1150));
      const p = reduce ? .46 : Math.max(0, Math.min(1, age / dur));
      const x = Math.round(NATIVE_W - p * (NATIVE_W + w + 90));
      const y = Math.floor(NATIVE_H/2 + px*.25);
      drawTextPx(t, x, y, px, 800);
      const ex = reduce ? Math.round(NATIVE_W*.78) : Math.round(x + w + 38);
      const ey = Math.round(NATIVE_H*.52 + (reduce ? 0 : Math.sin(age*.012)*5));
      nctx.lineWidth = 5; nctx.strokeStyle = 'rgba(255,255,255,1)'; nctx.fillStyle = 'rgba(255,255,255,1)';
      [0,42].forEach(off=>{ nctx.beginPath(); nctx.ellipse(ex+off,ey,16,25,0,0,Math.PI*2); nctx.stroke(); nctx.beginPath(); nctx.arc(ex+off + (reduce?0:Math.sin(age*.018)*5),ey+2,5,0,Math.PI*2); nctx.fill(); });
      thresholdNativeToAmber(); return;
    }
    if (active && active.type === 'dolphinSwim') {
      const age = Math.max(0, now - active.start), reduce = __sqSc045ReducedMotion();
      const dur = Math.max(1000, Number(active.ms || 2000));
      const p = reduce ? .52 : Math.max(0, Math.min(1, age / dur));
      const x1 = reduce ? NATIVE_W*.38 : -80 + p*(NATIVE_W+160);
      const x2 = reduce ? NATIVE_W*.68 : NATIVE_W+90 - p*(NATIVE_W+180);
      __sqSc045DrawDolphin(x1, NATIVE_H*.46 + (reduce?0:Math.sin(age*.010)*18), .72, false);
      __sqSc045DrawDolphin(x2, NATIVE_H*.66 + (reduce?0:Math.cos(age*.012)*16), .55, true);
      nctx.lineWidth = 4; nctx.strokeStyle = 'rgba(255,255,255,1)';
      for(let i=0;i<3;i++){ const bx=(x1-70)-(i*20); nctx.beginPath(); nctx.arc(bx, NATIVE_H*.70, 10+i*3, Math.PI*1.05, Math.PI*1.85); nctx.stroke(); }
      thresholdNativeToAmber(); return;
    }
    if (active && active.type === 'bullseyeHit') {
      const age = Math.max(0, now - active.start), reduce = __sqSc045ReducedMotion();
      const cx = Math.round(NATIVE_W*.34), cy = Math.round(NATIVE_H*.52);
      nctx.strokeStyle = 'rgba(255,255,255,1)'; nctx.fillStyle = 'rgba(255,255,255,1)';
      [50,34,18,6].forEach((r,i)=>{ nctx.lineWidth = i===3 ? 5 : 3; nctx.beginPath(); nctx.arc(cx,cy,r,0,Math.PI*2); nctx.stroke(); });
      nctx.beginPath(); nctx.moveTo(cx-55,cy); nctx.lineTo(cx+55,cy); nctx.moveTo(cx,cy-55); nctx.lineTo(cx,cy+55); nctx.stroke();
      const p = reduce ? 1 : Math.max(0, Math.min(1, age/620));
      const tipX = Math.round(NATIVE_W - 24 - p*(NATIVE_W - 24 - cx));
      const tipY = Math.round(cy - 28 + p*28);
      nctx.lineWidth=6; nctx.beginPath(); nctx.moveTo(tipX+74,tipY-12); nctx.lineTo(tipX,tipY); nctx.stroke();
      nctx.beginPath(); nctx.moveTo(tipX,tipY); nctx.lineTo(tipX+16,tipY-7); nctx.lineTo(tipX+13,tipY+7); nctx.closePath(); nctx.fill();
      nctx.beginPath(); nctx.moveTo(tipX+62,tipY-10); nctx.lineTo(tipX+82,tipY-28); nctx.lineTo(tipX+78,tipY-7); nctx.lineTo(tipX+91,tipY+7); nctx.lineTo(tipX+64,tipY+1); nctx.closePath(); nctx.fill();
      if (p >= .98 && !reduce) { for(let a=0;a<8;a++){ const ang=a*Math.PI/4; nctx.beginPath(); nctx.moveTo(cx+Math.cos(ang)*12,cy+Math.sin(ang)*12); nctx.lineTo(cx+Math.cos(ang)*72,cy+Math.sin(ang)*72); nctx.stroke(); } }
      thresholdNativeToAmber(); return;
    }
    // <<< PATCH:SC045_PINBALL_SCENE_TYPES END

'''
renderer = replace_once(renderer, "        // >>> PATCH:SQ_DMD_MARQUEE_FULL START", scene_cases + "        // >>> PATCH:SQ_DMD_MARQUEE_FULL START", 'renderer scene cases')
renderer = renderer.replace('type: o.type || "hold", // hold | flash | wipe | shake | roll | idle', 'type: o.type || "hold", // hold | flash | wipe | shake | roll | idle | anticipationEyes | dolphinSwim | bullseyeHit')
write(path, renderer)

# ---------------------------------------------------------------------------
# Exact intentional legacy patch evidence for inline-007
# ---------------------------------------------------------------------------
manifest_path = ROOT / 'src/legacy/intentional-patches.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
raw = (ROOT / 'src/legacy/scripts/inline-007.js').read_bytes()
sha = hashlib.sha256(raw).hexdigest()
found = False
for item in manifest.get('patches', []):
    if item.get('file') == 'src/legacy/scripts/inline-007.js':
        item['sha256'] = sha
        item['bytes'] = len(raw)
        item['task'] = 'SC-045 DMD arcade language + procedural pinball scenes'
        item['reason'] = 'Implement the approved dart-position-aware DMD vocabulary and procedural amber-dot eyes, dolphin and bullseye-hit scenes while preserving the existing renderer API and interruption boundary.'
        item['protectedBehaviour'] = 'Presentation only: scoring, game rules, player order, mode routing, Supabase writes/schema/RLS, ranking, XP and persistence semantics are untouched. New scenes remain interruptible through the existing DMD queue/flow-token clear path.'
        found = True
        break
if not found:
    raise SystemExit('intentional patch entry for inline-007 not found')
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

# ---------------------------------------------------------------------------
# Dedicated static and browser QA
# ---------------------------------------------------------------------------
static_test = r'''import fs from 'node:fs';
import assert from 'node:assert/strict';
const engine = fs.readFileSync('src/game/engine.js','utf8');
const router = fs.readFileSync('src/app/router-ui.js','utf8');
const live = fs.readFileSync('src/live-game/live-v2.js','utf8');
const renderer = fs.readFileSync('src/legacy/scripts/inline-007.js','utf8');
const state = fs.readFileSync('src/app/state.js','utf8');
for (const s of ['TREBLE!','CAN HE......?','TWO TREBLES','NICE FINISH','MAXI MAYHEM!','AWKWARD','HOLD UP....','TWO DOUBLES!','GET IN THE SEA!!','OUTER!','BULLSEYE','MAKING BANK','EASY MONEY','BASIC BITCH','HAHA HA HAHAA!','SCRATCH']) assert(engine.includes(s), `engine missing ${s}`);
for (const type of ['anticipationEyes','dolphinSwim','bullseyeHit']) assert(renderer.includes(`active.type === '${type}'`), `renderer missing ${type}`);
assert(engine.includes("__sector >= 1 && __sector <= 5"), 'engine Voldy range must be 1-5');
assert(router.includes("sector >= 1 && sector <= 5"), 'Vs Shadow Voldy range must be 1-5');
assert(!engine.includes("z1 = 'TRL'"), 'engine DMD must not emit TRL');
assert(!router.includes("return 'TRL'"), 'Vs Shadow DMD must not emit TRL');
assert(!live.includes("z1 = 'TRL'"), 'Live V2 DMD must not emit TRL');
assert(engine.includes("v_player_best_official_ranked"), 'PB must use verified official PB view');
assert(engine.includes("SCORE: ${total}  PB: ${pbTxt}"), 'prethrow SCORE/PB line missing');
assert(engine.includes("z3:'TO THROW'"), 'ordinary next player must say TO THROW');
assert(router.includes("__sqDmdShowTurnIntro?.(true)"), 'first-game TO THROW FIRST intro missing');
assert(state.includes("first ? 'TO THROW FIRST' : 'TO THROW'"), 'tiebreak first-throw wording missing');
const combo = engine.slice(engine.indexOf('// >>> PATCH:SQ_DMD_VOLDY_TRIGGER START'), engine.indexOf('// Render all three zones;'));
assert(!combo.includes('POWER DART'), 'POWER DART must be retired from canonical live DMD trigger block');
console.log('SC-045 DMD ARCADE STATIC: ALL PASS');
'''
write('tools/ui-smoke/verify-sc045-dmd-arcade.mjs', static_test)

browser_test = r'''const assert = require('assert/strict');
const H = require('./harness');
const fs = require('fs');
const path = require('path');
(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ARCADE A','ARCADE B']); await H.startMatch(page);
    await page.waitForFunction(()=>typeof window.sqDmdShowZones==='function' && typeof window.recordThrow==='function');
    await page.evaluate(()=>{
      window.__sc045Writes=[];
      const original=window.sqDmdShowZones;
      window.sqDmdShowZones=function(z,o){ window.__sc045Writes.push({z2:String(z?.z2||''),z3:String(z?.z3||''),type:String(o?.type||'')}); return original.apply(this,arguments); };
    });
    await page.evaluate(()=>recordThrow({kind:'T'}));
    let writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>w.z2==='TREBLE!'),'first treble => TREBLE!');
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.__sc045Writes=[]; recordThrow({kind:'T'}); });
    writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>w.z2==='CAN HE......?' && w.type==='anticipationEyes'),'dart-2 second treble => anticipation scene');
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.__sc045Writes=[]; recordThrow({kind:'T'}); });
    writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>/MAXI/.test(w.z2+' '+w.z3)),'third treble => MAXI MAYHEM');

    const out=process.env.SQ_SCREENSHOTS || path.join(process.cwd(),'qa-artifacts-sc045'); fs.mkdirSync(out,{recursive:true});
    for(const [type,ms] of [['anticipationEyes',1150],['dolphinSwim',2000],['bullseyeHit',1100]]){
      await page.evaluate(({type,ms})=>{ window.sqDmdStop(); window.sqDmdShowZones({z2:type==='anticipationEyes'?'CAN HE......?':'',z3:''},{type,ms}); },{type,ms});
      await page.waitForTimeout(type==='anticipationEyes'?350:550);
      const lit=await page.evaluate(()=>{ const c=document.getElementById('sqDmdCanvas'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>20)n++; return n; });
      assert(lit>30, `${type} must visibly render amber dots`);
      await page.screenshot({path:path.join(out,`sc045-${type}.png`),fullPage:false});
    }
    const unexpected=consoleErrs.filter(e=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(e));
    assert.deepEqual(unexpected,[],unexpected.join('\n'));
    console.log('SC-045 DMD ARCADE RUNTIME: ALL PASS');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
'''
write('tools/ui-smoke/verify-sc045-dmd-arcade.js', browser_test)

workflow = r'''name: SC-045 DMD arcade QA
on:
  pull_request:
    paths:
      - src/game/engine.js
      - src/app/router-ui.js
      - src/app/state.js
      - src/live-game/live-v2.js
      - src/legacy/scripts/inline-005.js
      - src/legacy/scripts/inline-007.js
      - src/legacy/intentional-patches.json
      - tools/ui-smoke/verify-sc045-dmd-arcade.mjs
      - tools/ui-smoke/verify-sc045-dmd-arcade.js
      - .github/workflows/sc045-dmd-arcade-qa.yml
  workflow_dispatch:
permissions:
  contents: read
jobs:
  qa:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 2
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version-file: .node-version
      - name: Install architecture tooling
        run: npm ci --prefix scripts --ignore-scripts
      - name: Static presentation contract
        run: |
          node tools/ui-smoke/verify-sc045-dmd-arcade.mjs
          node --check src/game/engine.js
          node --check src/app/router-ui.js
          node --check src/app/state.js
          node --check src/live-game/live-v2.js
          node --check src/legacy/scripts/inline-007.js
          node scripts/verify-modularization.mjs
      - name: Build exact candidate
        run: |
          npm ci --ignore-scripts --no-audit --no-fund
          npm run build
          npm run verify:dist
      - name: Install browser QA
        working-directory: tools/ui-smoke
        run: |
          npm ci --ignore-scripts
          npx playwright install --with-deps chromium
      - name: Source and dist arcade runtime
        shell: bash
        run: |
          set -euo pipefail
          python3 -m http.server 8123 --bind 127.0.0.1 >/tmp/sc045-source.log 2>&1 & spid=$!
          python3 -m http.server 8124 --bind 127.0.0.1 --directory dist >/tmp/sc045-dist.log 2>&1 & dpid=$!
          trap 'kill "$spid" "$dpid" || true' EXIT
          export SQ_APP_URL=http://127.0.0.1:8123/index.html
          export SQ_SCREENSHOTS=${{ github.workspace }}/qa-artifacts-sc045-source
          node tools/ui-smoke/verify-sc045-dmd-arcade.js
          node tools/ui-smoke/verify-sc032-dmd-runtime.js
          node tools/ui-smoke/verify-sc030-reduced-motion-runtime.js
          node tools/ui-smoke/verify-sc030-actions-runtime.js
          node tools/ui-smoke/verify-sc030-undo-runtime.js
          node tools/ui-smoke/verify-classic-visual-fit.js
          export SQ_APP_URL=http://127.0.0.1:8124/index.html
          export SQ_SCREENSHOTS=${{ github.workspace }}/qa-artifacts-sc045-dist
          node tools/ui-smoke/verify-sc045-dmd-arcade.js
          node tools/ui-smoke/verify-sc032-dmd-runtime.js
          node tools/ui-smoke/verify-sc030-reduced-motion-runtime.js
          node tools/ui-smoke/verify-sc030-actions-runtime.js
          node tools/ui-smoke/verify-sc030-undo-runtime.js
          node tools/ui-smoke/verify-classic-visual-fit.js
      - name: Whitespace
        run: git diff --check HEAD^ HEAD
      - name: Keep visual evidence
        if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: sc045-dmd-arcade-evidence
          retention-days: 14
          path: |
            qa-artifacts-sc045-source/
            qa-artifacts-sc045-dist/
'''
write('.github/workflows/sc045-dmd-arcade-qa.yml', workflow)

# Materialized source must be regenerated by the writer workflow after this script.
print('SC-045 patch source edits complete')
