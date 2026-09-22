import assert from 'node:assert/strict';
import fs from 'node:fs';

const live=fs.readFileSync('src/live-game/live-v2.js','utf8');
const css=fs.readFileSync('src/styles/live-game/v2-panel.css','utf8');

assert(live.includes('const __SQ_QUICK_ENTRY_HOLD_MS = 360;'), 'prototype hold threshold must be explicit');
assert(live.includes("if (remaining >= 2) opts.push({ id:'x2'"), 'x2 option must be remaining-dart gated');
assert(live.includes("if (remaining >= 3) opts.push({ id:'x3'"), 'x3 option must be remaining-dart gated');
assert(live.includes("if (dart >= 1)"), 'RH must require a previous dart');
assert(live.includes("id:'rh', label:'RH', count:1, spec:rhSpec"), 'RH must use exact previous-dart spec');
assert(live.includes("recordThrow(Object.assign({}, spec || {}));"), 'quick entry must use canonical recordThrow once per repeated dart');
assert(!live.includes('type:\'quickEntry\''), 'quick entry must not invent a batch history type');
assert(live.includes("__sqBindQuickEntryHold(b, ()=>({ kind:k }));"), 'S/D/T must own the hold gesture');
assert(live.includes("btn.addEventListener('pointerup',(e)=>finish(e,true));"), 'release must be the commit boundary');
assert(live.includes("btn.addEventListener('pointercancel',(e)=>finish(e,false));"), 'pointer cancellation must cancel quick entry');
assert(live.includes("const opt=hit ? options.find(o=>o.id===hit.dataset.qe) : null;"), 'release outside an option must not commit');
assert(live.includes('window.__sqQuickSuppressClick = {'), 'gesture must arm compatibility-click suppression');
assert(live.includes('until: performance.now() + 180'), 'compatibility-click suppression must stay narrowly time-bounded');
assert(live.includes('if (Math.hypot(dx,dy) > 18) return;'), 'compatibility-click suppression must be release-coordinate scoped');
assert(!live.includes('__sqQuickSuppressClickUntil'), 'broad time-only click dead zone must not return');
assert(css.includes('min-width:56px;') && css.includes('min-height:48px;'), 'quick targets must remain >=48px high and comfortably touchable');
assert(css.includes('@media (prefers-reduced-motion:reduce)'), 'prototype must respect reduced motion');

console.log('SXP-04 Gate 3 quick-entry contract PASS.');
