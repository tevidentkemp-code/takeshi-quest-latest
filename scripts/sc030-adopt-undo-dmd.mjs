import fs from 'node:fs';
import crypto from 'node:crypto';

const target = 'src/live-game/live-v2.js';
const evidencePath = process.argv[2] || 'sc030-undo-patch-evidence.json';
const source = fs.readFileSync(target, 'utf8');

const insertAnchor = "  padHint.textContent = state.finished ? 'Game finished.' : '';\n\n  if (!state.finished) {";
const helper = `  padHint.textContent = state.finished ? 'Game finished.' : '';\n\n  // SC-030: one verified Undo/DMD path for all Live V2 pad layouts.\n  // Scoring/state restoration stays owned by undo(); this helper only decides\n  // whether a presentation event is truthful after that state transition.\n  function __sqRunUndoActionWithDmd(){\n    const isVsShadow = (typeof __sqIsVsShadowRuntime === 'function') && __sqIsVsShadowRuntime();\n\n    // Preserve the existing Vs Shadow presentation path exactly. Its undo\n    // helper has mode-specific block/restore messages which must not be\n    // overwritten by the generic DMD V2 event.\n    if (isVsShadow){\n      try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }\n      try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }\n      undo();\n      return;\n    }\n\n    const before = Array.isArray(state?.history) ? state.history.length : 0;\n    if (before <= 0){\n      undo();\n      return;\n    }\n\n    try{ window.__sqDmdHardClearQueue?.(); }catch(_){ }\n    undo();\n\n    const after = Array.isArray(state?.history) ? state.history.length : before;\n    if (after >= before) return;\n\n    try{\n      if (window.__sqDmdV2 && typeof window.__sqDmdV2.emit === 'function'){\n        window.__sqDmdV2.emit({ kind:'UNDO' });\n      } else {\n        window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120});\n      }\n    }catch(_){ }\n  }\n\n  if (!state.finished) {`;

const oldHandler = "actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ } undo(); }));";
const newHandler = "actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { __sqRunUndoActionWithDmd(); }));";

function count(haystack, needle){
  return haystack.split(needle).length - 1;
}

if (count(source, insertAnchor) !== 1) throw new Error('SC-030 Undo helper insertion anchor must occur exactly once');
if (count(source, oldHandler) !== 3) throw new Error('SC-030 expected exactly three legacy Live V2 Undo handlers');
if (source.includes('__sqRunUndoActionWithDmd')) throw new Error('SC-030 Undo helper already present; refusing double patch');

let patched = source.replace(insertAnchor, helper);
patched = patched.split(oldHandler).join(newHandler);

if (count(patched, newHandler) !== 3) throw new Error('SC-030 failed to replace all three Undo handlers');
if (count(patched, oldHandler) !== 0) throw new Error('SC-030 legacy Undo handler remains after patch');
if (count(patched, 'function __sqRunUndoActionWithDmd()') !== 1) throw new Error('SC-030 Undo helper count mismatch');

fs.writeFileSync(target, patched, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
fs.writeFileSync(evidencePath, JSON.stringify({
  schemaVersion: 1,
  target,
  oldSha256: sha(source),
  newSha256: sha(patched),
  replacedHandlers: 3,
  helperCount: 1,
  vsShadowPreservedLegacyPresentation: true,
  scoringFunctionChanged: false
}, null, 2) + '\n');
console.log(`SC-030 Undo adoption prepared: ${sha(source)} -> ${sha(patched)}`);
