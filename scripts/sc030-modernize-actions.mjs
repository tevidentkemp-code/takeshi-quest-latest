import fs from 'node:fs';
import crypto from 'node:crypto';

const target = 'src/live-game/live-v2.js';
const evidencePath = process.argv[2] || 'sc030-actions-evidence.json';
const original = fs.readFileSync(target, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const count = (body, needle) => body.split(needle).length - 1;
let next = original;

const helperStart = next.indexOf('  function __sqRunUndoActionWithDmd(){');
const helperEnd = next.indexOf('\n\n  if (!state.finished) {', helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error('SC-030 Undo helper boundaries not found');
let helper = next.slice(helperStart, helperEnd);

const genericHardClear = `    try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }\n    undo();\n\n    const after = Array.isArray(state?.history) ? state.history.length : before;\n`;
if (count(helper, genericHardClear) !== 1) throw new Error('SC-030 generic Undo hard-clear anchor mismatch');
const truthfulUndo = `    undo();\n\n    const after = Array.isArray(state?.history) ? state.history.length : before;\n`;
helper = helper.replace(genericHardClear, truthfulUndo);

const afterGuard = `    const after = Array.isArray(state?.history) ? state.history.length : before;\n    if (after >= before) return;\n\n    try{\n      if (window.__sqDmdV2 && typeof window.__sqDmdV2.emit === 'function'){\n`;
if (count(helper, afterGuard) !== 1) throw new Error('SC-030 Undo baseline-sync anchor mismatch');
const baselineSync = `    const after = Array.isArray(state?.history) ? state.history.length : before;\n    if (after >= before) return;\n\n    // Re-establish the truthful persistent DMD baseline from restored game state\n    // before the transient Undo message takes ownership of presentation.\n    try{\n      const rIdx = Number(state?.currentRound || 0);\n      const pIdx = Number(state?.currentPlayer || 0);\n      const rd = (typeof ROUNDS !== 'undefined' && Array.isArray(ROUNDS)) ? ROUNDS[rIdx] : null;\n      let z1 = String(rIdx + 1);\n      if (rd?.type === 'number') z1 = String(rd.target);\n      else if (rd?.type === 'doubles') z1 = 'DBL';\n      else if (rd?.type === 'triples') z1 = 'TRL';\n      else if (rd?.type === 'bull') z1 = 'BULL';\n      const darts = Array.isArray(state?.score?.[pIdx]?.[rIdx]?.darts)\n        ? state.score[pIdx][rIdx].darts.slice(0, Number(state?.currentDart || 0)).filter(Boolean)\n        : [];\n      const z3 = darts.map(d => {\n        try{ return (typeof __sqV2DartToken === 'function') ? __sqV2DartToken(d, rIdx) : String(d?.kind || ''); }catch(_){ return String(d?.kind || ''); }\n      }).filter(Boolean).join(' / ');\n      const z2 = (typeof getPlayerName === 'function') ? String(getPlayerName(pIdx) || '') : '';\n      window.sqDmdShowZones?.({ z1, z2, z3 }, { type:'hold', ms:1, z3Small:true });\n    }catch(_){ }\n\n    try{\n      if (window.__sqDmdV2 && typeof window.__sqDmdV2.emit === 'function'){\n`;
helper = helper.replace(afterGuard, baselineSync);

const skipHelper = `\n\n  // SC-030 responsiveness: gameplay state changes immediately; DMD feedback is\n  // presentation-only and must never hold input hostage. Vs Shadow keeps its\n  // existing specialised timing until that mode has dedicated cloud-backed QA.\n  function __sqRunSkipActionWithDmd(){\n    const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') && __sqIsVsShadowRuntime();\n    if (isVsShadow){\n      try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }\n      try{ window.__sqSkipInProgress = true; }catch(_){ }\n      try{ window.sqDmdShowZones?.({ z2:'SKIP GO', z3:'>>>' }, { type:'flash', ms:500, fx:'impact' }); }catch(_){ }\n      setTimeout(() => {\n        try{ missGo(); }catch(_){ }\n        setTimeout(() => { try{ window.__sqSkipInProgress = false; }catch(_){ } }, 120);\n      }, 500);\n      return;\n    }\n\n    const before = {\n      history: Array.isArray(state?.history) ? state.history.length : 0,\n      player: Number(state?.currentPlayer || 0),\n      round: Number(state?.currentRound || 0),\n      dart: Number(state?.currentDart || 0),\n      finished: !!state?.finished\n    };\n\n    try{ window.__sqSkipInProgress = true; }catch(_){ }\n    try{ missGo(); }catch(_){ }\n    finally { try{ window.__sqSkipInProgress = false; }catch(_){ } }\n\n    const afterHistory = Array.isArray(state?.history) ? state.history.length : before.history;\n    const changed = afterHistory > before.history ||\n      Number(state?.currentPlayer || 0) !== before.player ||\n      Number(state?.currentRound || 0) !== before.round ||\n      Number(state?.currentDart || 0) !== before.dart ||\n      !!state?.finished !== before.finished;\n    if (!changed) return;\n\n    let nextName = '';\n    try{\n      if (!state.finished && typeof getPlayerName === 'function') nextName = String(getPlayerName(Number(state.currentPlayer || 0)) || '');\n    }catch(_){ }\n\n    try{\n      if (window.__sqDmdV2 && typeof window.__sqDmdV2.emit === 'function'){\n        window.__sqDmdV2.emit({ kind:'SKIP', player:nextName });\n      } else {\n        window.sqDmdShowZones?.({ z2:'TURN SKIPPED', z3:(nextName ? (nextName + ' UP') : '') }, { type:'hold', ms:500 });\n      }\n    }catch(_){ }\n  }`;

next = next.slice(0, helperStart) + helper + skipHelper + next.slice(helperEnd);

const oldSkip = `      actions.appendChild(mkAct('skip', '▶▶', 'SKIP', () => {\n        try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }\n        try{ window.__sqSkipInProgress = true; }catch(_){ }\n        try{ window.sqDmdShowZones?.({ z2:'SKIP GO', z3:'>>>' }, { type:'flash', ms:500, fx:'impact' }); }catch(_){ }\n        setTimeout(() => {\n          try{ missGo(); }catch(_){ }\n          setTimeout(() => { try{ window.__sqSkipInProgress = false; }catch(_){ } }, 120);\n        }, 500);\n      }));`;
const skipCount = count(next, oldSkip);
if (skipCount !== 3) throw new Error(`SC-030 expected 3 legacy Skip handlers, found ${skipCount}`);
next = next.split(oldSkip).join(`      actions.appendChild(mkAct('skip', '▶▶', 'SKIP', () => { __sqRunSkipActionWithDmd(); }));`);

if (count(next, 'function __sqRunSkipActionWithDmd(){') !== 1) throw new Error('SC-030 shared Skip helper count mismatch');
if (count(next, "mkAct('skip', '▶▶', 'SKIP', () => { __sqRunSkipActionWithDmd(); })") !== 3) throw new Error('SC-030 Skip handler adoption mismatch');
if (count(next, 'function __sqRunUndoActionWithDmd(){') !== 1) throw new Error('SC-030 Undo helper count changed unexpectedly');

fs.writeFileSync(target, next, 'utf8');
fs.writeFileSync(evidencePath, JSON.stringify({
  schemaVersion: 1,
  target,
  oldSha256: sha(original),
  newSha256: sha(next),
  replacedSkipHandlers: 3,
  skipHelperCount: 1,
  undoHelperCount: 1,
  nonVsSkipDelayRemoved: true,
  nonVsUndoHardClearRemoved: true,
  undoBaselineResyncAdded: true,
  vsShadowLegacyTimingPreserved: true,
  scoringFunctionChanged: false,
  rulesChanged: false,
  persistentDataChanged: false
}, null, 2) + '\n');
console.log('SC-030 responsive actions patch prepared successfully');
