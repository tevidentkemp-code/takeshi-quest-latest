import assert from 'node:assert/strict';
import fs from 'node:fs';

const state = fs.readFileSync('src/app/state.js','utf8');
const router = fs.readFileSync('src/app/router-ui.js','utf8');
const live = fs.readFileSync('src/live-game/live-v2.js','utf8');
const padCompat = fs.readFileSync('src/legacy/scripts/inline-008.js','utf8');
const css = fs.readFileSync('src/styles/live-game/v2-panel.css','utf8');
const stage = fs.readFileSync('src/styles/live-game/classic-stage1.css','utf8');

assert(state.includes('function __sqGcXpStartPrefetch()'), 'XP prefetch helper must exist');
assert(/try\{\s*__sqGcXpStartPrefetch\(\);\s*\}catch\(_\)\{\s*\}/.test(state), 'Game Winner flow must start XP prefetch');
assert(state.includes('const prefetchedXp = await __sqGcXpStartPrefetch();'), 'Rewards reveal must consume the prefetched batch');
assert(!state.includes('await SQ_XP.forName(players[p].rawName || nm)'), 'Rewards reveal must not serially fetch XP per player');
assert(state.includes('Promise.all(players.map(async name =>'), 'XP prefetch must read player XP in parallel');
assert(state.includes('Promise.all(rows.map(row => __sqGcXpRow(panel, row, reduced)))'), 'XP row reveals must no longer serialize per player');
assert(state.includes('const gained = Math.round(totals[p] * SQ_XP.W.point) + SQ_XP.W.game + (won ? SQ_XP.W.gameWin : 0) + trophyXp;'),
  'canonical XP gained formula must remain unchanged');

for (const id of ['v2QuickMenu','v2QuickTv','v2QuickSound']) {
  assert(router.includes('id="'+id+'"'), id+' markup must exist');
  assert(live.includes("#"+id) || live.includes("'"+id+"'"), id+' must be bound in Live V2');
}
assert(live.includes("window.__sqOpenGameMenu106"), 'Menu quick control must reuse canonical game menu');
assert(live.includes("window.__sqTvModeToggle"), 'TV quick control must reuse canonical TV toggle');
assert(live.includes("__sqV3SetSound"), 'Sound quick control must reuse canonical sound preference');
assert(padCompat.includes("if (settings) settings.remove();"), 'legacy helper must remove bottom Settings control');
assert(padCompat.includes("repeat(3,minmax(0,1fr))"), 'legacy helper must keep three equal action columns');
assert(stage.includes('#settingsBtnGamePad') && stage.includes('display:none !important'), 'pad Settings must remain hidden');
assert(css.includes('.livev2panel .v2QuickRail'), 'quick rail styling must exist');
assert(css.includes('min-width:44px') && css.includes('min-height:44px'), 'quick rail must preserve >=44px touch targets');

console.log('SXP-04 side quest static regression PASS: XP prefetch/reveal optimization + Menu/TV/Sound rail + full-size Skip; XP formula unchanged.');
