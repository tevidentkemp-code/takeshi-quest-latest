import assert from 'node:assert/strict';
import fs from 'node:fs';

const live=fs.readFileSync('src/live-game/live-v2.js','utf8');
const css=fs.readFileSync('src/styles/live-game/v2-panel.css','utf8');

assert(live.includes('function __sqQuickEntrySpecEquals(a,b)'), 'RH exact-spec matcher missing');
assert(live.includes('if (rhSpec && __sqQuickEntrySpecEquals(baseSpec, rhSpec))'),
  'RH must only appear on the held button matching the immediately previous dart');
assert(live.includes("if (remaining >= 2) opts.push({ id:'x2'"), 'x2 remaining-dart gate missing');
assert(live.includes("if (remaining >= 3) opts.push({ id:'x3'"), 'x3 remaining-dart gate missing');
assert(live.includes("btn.style.webkitUserSelect = 'none';"), 'iPhone hold must suppress native selection');
assert(live.includes("btn.style.webkitTouchCallout = 'none';"), 'iPhone hold must suppress native touch callout');

const quickStart=css.indexOf('.sqQuickEntryPopover');
const quickMedia=css.indexOf('@media (prefers-reduced-motion:reduce)', quickStart);
const quickCss=css.slice(quickStart, quickMedia >= 0 ? quickMedia + 250 : quickStart + 5000);
assert(quickCss.includes('-webkit-backdrop-filter:none;') && quickCss.includes('backdrop-filter:none;'),
  'quick-entry fixed overlay must not use backdrop filtering on iPhone');
assert(!quickCss.includes('backdrop-filter:blur('), 'quick-entry blur compositor path must not return');
assert(!quickCss.includes('scale(1.045)'), 'quick-entry target must not scale during hold/slide');
assert(!quickCss.includes('sqQuickEntryIn'), 'quick-entry scale/transform entrance animation must not return');
assert(quickCss.includes('-webkit-touch-callout:none;'), 'quick-entry UI must suppress iOS callout');
assert(quickCss.includes('-webkit-user-select:none;'), 'quick-entry UI must suppress iOS selection');

console.log('SXP-04 Gate 5 iPhone correction contract PASS: stable no-zoom layer + exact-button RH eligibility.');
