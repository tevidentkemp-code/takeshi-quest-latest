import assert from 'node:assert/strict';
import { createCommentaryEngine, GAP_MOCK_START, MODES, VERSION } from '../../src/live-game/dmd/commentary.mjs';

const miss={kind:'Miss',points:0};
const hit=(points=10)=>({kind:'S',points});

function historyForVisits(player, visitHitPatterns){
  const out=[];
  visitHitPatterns.forEach((pattern,round)=>{
    pattern.forEach((points,dartIndex)=>{
      out.push({player,round,dartIndex,throw:points>0?hit(points):miss});
    });
  });
  return out;
}
function scoreFromTotals(totals, round=0){
  return totals.map(total=>Array.from({length:round+1},(_,r)=>({
    roundTotal:r===round?total:0,
    darts:r===round?[hit(total),null,null]:[]
  })));
}
function ctx(overrides={}){
  return {
    pIndex:0,rIndex:0,dartIndex:0,dart:miss,
    players:[{name:'Alpha'},{name:'Beta'}],
    score:scoreFromTotals([0,0]),
    history:[],
    matchHistory:[],
    mode:'official',
    ...overrides
  };
}

assert.equal(VERSION,'1.0.0-sc052');
assert.equal(GAP_MOCK_START,50);

{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const h=historyForVisits(0,[[0,0,0],[0,0]]);
  const b=engine.dart(ctx({history:h,dartIndex:2,dart:miss}));
  assert.equal(b?.reason,'miss_6','sixth consecutive miss must trigger tier 6');
  assert.equal(b?.streak,6);
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const h=historyForVisits(0,[[0,0,0],[0,0,0],[0,0]]);
  const b=engine.dart(ctx({history:h,rIndex:2,dartIndex:2,dart:miss}));
  assert.equal(b?.reason,'miss_9','ninth consecutive miss must trigger tier 9');
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const h=historyForVisits(0,[[0,0,0],[0,0,0],[0,0,0],[0,0]]);
  const b=engine.dart(ctx({history:h,rIndex:3,dartIndex:2,dart:miss}));
  assert.equal(b?.reason,'miss_12','twelfth consecutive miss must trigger tier 12');
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const at49=engine.dart(ctx({
    score:scoreFromTotals([51,100]),
    dartIndex:0,
    dart:miss
  }));
  assert.equal(at49,null,'49 behind must not trigger gap mock');

  const at50=engine.dart(ctx({
    score:scoreFromTotals([50,100]),
    dartIndex:0,
    dart:miss
  }));
  assert.equal(at50?.reason,'behind_miss','50 behind must begin gap mock');
  assert.equal(at50?.gap,50);
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const h=historyForVisits(0,[
    [10,0,0],
    [11,0,0],
    [12,0]
  ]);
  const score=[
    [
      {roundTotal:10,darts:[hit(10),miss,miss]},
      {roundTotal:11,darts:[hit(11),miss,miss]},
      {roundTotal:12,darts:[hit(12),miss,miss]}
    ],
    [
      {roundTotal:0,darts:[]},
      {roundTotal:0,darts:[]},
      {roundTotal:0,darts:[]}
    ]
  ];
  const b=engine.visit(ctx({history:h,score,rIndex:2,dartIndex:2,dart:miss}));
  assert.equal(b?.reason,'one_hit_streak_3','third one-hit visit must trigger one-dart story');
  assert.equal(b?.oneHitStreak,3);
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const score=[
    [{roundTotal:10,darts:[hit(4),hit(3),hit(3)]}],
    [{roundTotal:60,darts:[hit(60),null,null]}]
  ];
  const h=historyForVisits(0,[[4,3]]);
  const b=engine.visit(ctx({history:h,score,dartIndex:2,dart:hit(3)}));
  assert.equal(b?.reason,'far_behind','50 behind at visit end must be mocked');
  assert.equal(b?.gap,50);
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const score=[
    [{roundTotal:50,darts:[hit(20),hit(20),hit(10)]}],
    [{roundTotal:100,darts:[hit(40),hit(30),hit(30)]}]
  ];
  const before=JSON.stringify(score);
  const b=engine.round(ctx({score,rIndex:0}));
  assert.equal(b?.reason,'round_far_behind','end-of-round mock begins at exactly 50 points');
  assert.equal(b?.gap,50);
  assert.equal(JSON.stringify(score),before,'commentary must not mutate canonical score state');
}
{
  const engine=createCommentaryEngine({mode:MODES.BRUTAL});
  const score=[
    [10,10,10,10,10].map(v=>({roundTotal:v,darts:[hit(v)]})),
    [9,9,9,9,9].map(v=>({roundTotal:v,darts:[hit(v)]}))
  ];
  const b=engine.round(ctx({score,rIndex:4}));
  assert.equal(b?.reason,'round_close','late round with <=10 gap should enter choke-zone story');
}
{
  const engine=createCommentaryEngine({
    mode:MODES.BRUTAL,
    historyRows:[
      {game_id:'g2',ts:'2026-09-20',player_name:'Alpha',score:120},
      {game_id:'g2',ts:'2026-09-20',player_name:'Beta',score:200},
      {game_id:'g1',ts:'2026-09-19',player_name:'Alpha',score:140},
      {game_id:'g1',ts:'2026-09-19',player_name:'Beta',score:210}
    ]
  });
  const score=[
    [{roundTotal:10,darts:[hit(4),hit(3),hit(3)]}],
    [{roundTotal:70,darts:[hit(70),null,null]}]
  ];
  const h=historyForVisits(0,[[4,3]]);
  const b=engine.visit(ctx({history:h,score,dartIndex:2,dart:hit(3)}));
  assert.equal(b?.reason,'history_h2h_repeat','repeated historical opponent dominance should become a callback');
}
{
  let reads=0;
  const host={
    sb:{
      from(){
        reads++;
        const q={
          select(){return q;},
          order(){return q;},
          limit(){return Promise.resolve({data:[],error:null});}
        };
        return q;
      }
    }
  };
  const engine=createCommentaryEngine({mode:MODES.BRUTAL,host});
  await engine.warmHistory([{name:'Alpha'},{name:'Beta'}],'official');
  await engine.warmHistory([{name:'Alpha'},{name:'Beta'}],'official');
  assert.equal(reads,1,'empty history must be prefetched at most once per player set');
}
{
  const engine=createCommentaryEngine({mode:MODES.OFF});
  assert.equal(engine.dart(ctx({score:scoreFromTotals([0,100])})),null,'OFF mode must emit no commentary');
}

console.log('SC-052 DMD brutal commentary unit acceptance PASS');
