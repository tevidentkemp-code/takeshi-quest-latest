import fs from 'node:fs';
import assert from 'node:assert/strict';

const core=fs.readFileSync('src/legacy/quarantine/core-pre-modals.js','utf8');
const rhs=fs.readFileSync('src/legacy/scripts/inline-026.js','utf8');
const late=fs.readFileSync('src/legacy/scripts/inline-047.js','utf8');
const modals=fs.readFileSync('src/ui/modals.js','utf8');

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

console.log('SC-042 static record + milestone-family integrity contract: PASS');
