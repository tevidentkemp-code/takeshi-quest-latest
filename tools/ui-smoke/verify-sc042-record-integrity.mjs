import fs from 'node:fs';
import assert from 'node:assert/strict';

const core=fs.readFileSync('src/legacy/quarantine/core-pre-modals.js','utf8');
const rhs=fs.readFileSync('src/legacy/scripts/inline-026.js','utf8');
const late=fs.readFileSync('src/legacy/scripts/inline-047.js','utf8');
const modals=fs.readFileSync('src/ui/modals.js','utf8');
const engine=fs.readFileSync('src/game/engine.js','utf8');
const appState=fs.readFileSync('src/app/state.js','utf8');
const dmdRenderer=fs.readFileSync('src/legacy/scripts/inline-007.js','utf8');
const leaderboardPatch=fs.readFileSync('src/legacy/scripts/inline-045.js','utf8');
const postgameFlow=fs.readFileSync('src/live-game/postgame-flow.mjs','utf8');
const leaderboardCss=fs.readFileSync('src/styles/tournament/leaderboard-bracket.css','utf8');

assert(core.includes('const isGamePB = score > 0 && score > priorGameBest;'));
assert(core.includes('const isGameRecord = score > 0 && score > globalGameBest;'));
assert(core.includes("if (isGameRecord) pushEvent(ts, `NEW GAME RECORD SCORE - ${nm} - ${score} 🥇`, 'game_record');\n              else if (isGamePB) pushEvent(ts, `GAME PB - ${nm} (${score})`, 'game_pb');"));
assert(core.includes('const isRoundPB = total > priorRoundPB;'));
assert(core.includes('const isRoundRecord = total > priorRoundWR;'));
assert(core.includes("if (isRoundRecord) pushEvent(ts, `ROUND WR / ${roundKey} - ${nm} (${total}) - ${counts}`, 'round_wr');\n                else if (isRoundPB) pushEvent(ts, `ROUND PB / ${roundKey} - ${nm} (${total}) - ${counts}`, 'round_pb');"));

assert(rhs.includes("replace(/\\s+x\\d+\\s*$/i,'')"));
assert(rhs.includes("var holder=holders.join(' / ');"));

assert(modals.includes(".filter(r => r.player_id && r.games_played > 0);"));
assert(modals.includes("SQ_ACH.scoreMilestoneThreshold = function(code)"));
assert(modals.includes("SB.from('v_player_game_scores_official_clean')"));
assert(modals.includes(".gte('score', threshold)"));
assert(modals.includes("? await SQ_ACH.forScoreMilestone(code)"));

assert(late.includes('installSc042MilestoneFamilyHotfix'));
assert(late.includes("ACH.forMilestoneProgress = async function(code)"));
assert(late.includes("SB.from('v_ach_rounds')"));
assert(late.includes("const volumeCodes = new Set(['regular','veteran','centurion'])"));
assert(late.includes("const sweepCodes = new Set(['double_sweep','treble_sweep'])"));
assert(late.includes("const metaCodes = new Set(['collector','trophy_hunter'])"));
assert(late.includes("ACH.forMilestones = () => ACH.forMilestoneProgress(code);"));
assert(late.includes("target >= 10 && target <= 20"));
assert(late.includes("Math.max(0, Number(r && r.bull_any) || 0)"));

assert(engine.includes("window.sqDmdShowZones?.({ z2:'NEXT UP', z3:String(nextLbl || '').toUpperCase() }"));
assert(!engine.includes('NEXT UP.. ${nextLbl}'));
assert(engine.includes('window.__sqDmdHardClearQueue?.();'));
assert(appState.includes("window.sqDmdShowZones?.({ z2:'GAME OVER', z3:'' }, { type:'pulseFull'"));
assert(!appState.includes("z2:'GAME OVER', z3:'' }, { type:'marqueeFull'"));
assert(dmdRenderer.includes("active.type === 'pulseFull'"));
assert(dmdRenderer.includes("Math.sin((age / 2200)"));
assert(leaderboardPatch.includes("statsFinal.style.setProperty('display','none','important')"));
assert(leaderboardPatch.includes("__sqModernGameScoresWired"));
assert(leaderboardPatch.includes("__sqOpenMatchGameScores"));
assert(postgameFlow.includes("function openMatchGameScores(st = getState())"));
assert(postgameFlow.includes("sq-pg-history-scorecard"));
assert(postgameFlow.includes("window.__sqOpenMatchGameScores"));
assert(leaderboardCss.includes('border-spacing:0 8px!important'));
assert(leaderboardCss.includes('linear-gradient(165deg,#1a2030 0%,#10141f 100%)'));
assert(leaderboardCss.includes('border-left:3px solid rgba(255,122,0,.82)!important'));

console.log('SC-042 static record + milestone-family + postgame presentation contract: PASS');
