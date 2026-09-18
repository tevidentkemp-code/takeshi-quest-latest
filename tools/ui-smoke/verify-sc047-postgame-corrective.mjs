import fs from 'node:fs';
import assert from 'node:assert/strict';

const state = fs.readFileSync('src/app/state.js','utf8');
const engine = fs.readFileSync('src/game/engine.js','utf8');
const renderer = fs.readFileSync('src/legacy/scripts/inline-007.js','utf8');
const fix170 = fs.readFileSync('src/legacy/scripts/inline-045.js','utf8');
const postgame = fs.readFileSync('src/live-game/postgame-flow.mjs','utf8');

assert.match(state, /GAME OVER[\s\S]{0,160}type:'pulseCenter'/, 'Game Complete must emit centred pulseCenter GAME OVER');
assert.doesNotMatch(state, /GAME OVER[\s\S]{0,160}type:'marqueeFull'/, 'Game Complete must not emit scrolling marqueeFull');
assert.match(renderer, /active\.type === 'pulseCenter'/, 'DMD renderer missing pulseCenter');
assert.doesNotMatch(fix170, /appendChild\(statsFinal\)/, 'Leaderboard must not relocate STATS into actions');
assert.match(fix170, /statsFinal\.style\.display = 'none'/, 'Leaderboard STATS must be hidden');
assert.match(postgame, /function openGameScorecardDialog/, 'shared Game Scorecard dialog missing');
assert.match(postgame, /buildScorecard\(modal, st\)/, 'Leaderboard Game Scores must reuse the post-game scorecard builder');
assert.match(postgame, /__sqOpenGameScorecardDialog = openGameScorecardDialog/, 'scorecard dialog hook missing');
assert.match(engine, /__sqOpenGameScorecardDialog/, 'legacy Game Scores entry point does not delegate to modern scorecard');
assert.match(engine, /z2:'NEXT UP', z3:String\(nextLbl \|\| ''\)\.toUpperCase\(\)/, 'NEXT UP / target two-row contract missing');
assert.doesNotMatch(engine, /NEXT UP\.\./, 'old NEXT UP ellipsis remains');
console.log('SC-047 POST-GAME CORRECTIVE STATIC: ALL PASS');
