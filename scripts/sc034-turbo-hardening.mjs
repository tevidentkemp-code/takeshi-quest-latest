import fs from 'node:fs';
import crypto from 'node:crypto';

const fail=(m)=>{throw new Error('SC-034 Turbo hardening: '+m);};
const replaceOnce=(text,from,to,label)=>{
  const i=text.indexOf(from);
  if(i<0)fail(label+' anchor missing');
  if(text.indexOf(from,i+1)>=0)fail(label+' anchor not unique');
  return text.slice(0,i)+to+text.slice(i+from.length);
};
const sha256=(s)=>crypto.createHash('sha256').update(s).digest('hex');

const menuPath='src/legacy/scripts/inline-030.js';
let menu=fs.readFileSync(menuPath,'utf8');
menu=replaceOnce(menu,
`    var joinedRound=Math.max(0,Number(state.currentRound||0));
    var allMissed=Array.from({length:joinedRound},function(_,i){return i;});
    var pending=allMissed.slice(-3);`,
`    var joinedRound=Math.max(0,Number(state.currentRound||0));
    var liveMode=String(
      state.gameMode ||
      (state.match && (state.match.gameMode || state.match.gameVariant || state.match.mode)) ||
      ''
    ).toLowerCase();
    var firstPlayableRound=(liveMode==='turbo')?7:0;
    var missedCount=Math.max(0,joinedRound-firstPlayableRound);
    var allMissed=Array.from({length:missedCount},function(_,i){return firstPlayableRound+i;});
    var pending=allMissed.slice(-3);`,
'Turbo playable-round boundary');
fs.writeFileSync(menuPath,menu);

const testPath='tools/ui-smoke/verify-sc034-add-player.js';
let test=fs.readFileSync(testPath,'utf8');
const marker='    // Persist and reload during an active catch-up sequence.';
const turbo=String.raw`    // Turbo begins at 17s. Before the first 17s dart a late player may join,
    // but Classic rounds 10-16 never existed and must not become catch-up work.
    await page.evaluate(() => {
      const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
      state.players = [
        {id:'ta',name:'TURBO A',initials:'TA'},
        {id:'tb',name:'TURBO B',initials:'TB'}
      ];
      state.score = [mk(),mk()];
      state.match = {
        mode:'turbo', gameMode:'turbo', gameVariant:'turbo',
        gameFormat:'match_play', gameNumber:1, wins:[0,0], history:[]
      };
      state.gameMode='turbo';
      state.matchAgg={hits:[{},{}],totals60:[0,0],totals100:[0,0],totals140:[0,0]};
      state.currentRound=7; state.currentPlayer=0; state.currentDart=0;
      state.history=[]; state.finished=false; delete state.__sqCatchUp;
    });
    const turboAdded = await page.evaluate(() =>
      window.__sqAppendLatePlayer({id:'tc',name:'TURBO C',initials:'TC'}, 'registered')
    );
    assert(turboAdded === true, 'Turbo late player should be addable before first 17s dart');
    const turboState = await page.evaluate(() => ({
      players:state.players.map(p=>p.name),
      job:JSON.parse(JSON.stringify(state.__sqCatchUp?.jobs?.[0]||null))
    }));
    assert(turboState.players.join('|') === 'TURBO A|TURBO B|TURBO C', 'Turbo late player must be final thrower');
    assert(turboState.job && turboState.job.pendingRounds.length === 0, 'Turbo must not invent Classic catch-up rounds');
    assert(turboState.job && turboState.job.scratchedRounds.length === 0, 'Turbo must not invent Classic scratched rounds');
    await page.evaluate(() => { delete state.gameMode; });

`;
if(!test.includes(marker))fail('Turbo test insertion marker missing');
test=test.replace(marker,turbo+marker);
fs.writeFileSync(testPath,test);

const manifestPath='src/legacy/migration-manifest.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const entry=(manifest.scripts||[]).find(x=>x.file===menuPath);
if(!entry)fail('inline-030 migration entry missing');
entry.sha256=sha256(menu);
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');

console.log('SC-034 Turbo hardening applied.');
