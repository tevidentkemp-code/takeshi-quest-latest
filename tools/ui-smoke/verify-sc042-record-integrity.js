const H = require('./harness');
const assert = require('assert');

(async()=>{
  const {browser,page}=await H.launch({width:390,height:844});
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  await H.boot(page);
  await page.waitForFunction(()=>window.SQ_ACH && typeof window.SQ_ACH.forScoreMilestone==='function' && typeof window.SQ_ACH.forMilestoneProgress==='function' && typeof window.openRoundHighScoresDialog==='function');

  await page.evaluate(()=>{
    const directory=[
      {player_id:'p1',name:'Alex S',games_played:12},
      {player_id:'p2',name:'Sam T',games_played:8},
      {player_id:'p3',name:'Short S',games_played:5},
      {player_id:'p0',name:'Zero G',games_played:0},
    ];
    const scoreRows=[
      {game_id:'g1',ts:'2026-01-01T10:00:00Z',player_id:'p1',player_id_alt:'',player_name:'Alex S',score:410},
      {game_id:'g2',ts:'2026-01-02T10:00:00Z',player_id:'p1',player_id_alt:'',player_name:'Alex S',score:520},
      {game_id:'g3',ts:'2026-01-03T10:00:00Z',player_id:'p1',player_id_alt:'',player_name:'Alex S',score:630},
      {game_id:'g4',ts:'2026-01-04T10:00:00Z',player_id:'p2',player_id_alt:'',player_name:'Sam T',score:420},
      {game_id:'g5',ts:'2026-01-05T10:00:00Z',player_id:'p2',player_id_alt:'',player_name:'Sam T',score:530},
      {game_id:'g6',ts:'2026-01-06T10:00:00Z',player_id:'p3',player_id_alt:'',player_name:'Short S',score:440},
    ];
    const milestoneRoundRows=[
      {game_id:'m1',pidx:0,player_id:'p1',ridx:0,target:10,trebles:1,doubles:1,bull_any:2},
      {game_id:'m1',pidx:0,player_id:'p1',ridx:1,target:11,trebles:0,doubles:1,bull_any:1},
      {game_id:'m2',pidx:0,player_id:'p1',ridx:2,target:12,trebles:1,doubles:1,bull_any:1},
      {game_id:'m3',pidx:0,player_id:'p1',ridx:3,target:10,trebles:0,doubles:1,bull_any:0},
      {game_id:'m1',pidx:1,player_id:'p2',ridx:0,target:10,trebles:1,doubles:1,bull_any:1},
      {game_id:'m1',pidx:1,player_id:'p2',ridx:1,target:11,trebles:1,doubles:0,bull_any:1},
      {game_id:'m2',pidx:1,player_id:'p2',ridx:2,target:12,trebles:1,doubles:0,bull_any:0},
      {game_id:'m1',pidx:2,player_id:'p3',ridx:0,target:10,trebles:0,doubles:1,bull_any:1},
      {game_id:'m2',pidx:2,player_id:'p3',ridx:10,target:20,trebles:1,doubles:1,bull_any:0},
      {game_id:'m0',pidx:0,player_id:'p0',ridx:0,target:10,trebles:1,doubles:1,bull_any:99},
    ];
    const trophySourceRows=[
      {player_id:'p1',code:'the_180',cnt:1,xp:50},
      {player_id:'p1',code:'maximum',cnt:2,xp:40},
      {player_id:'p1',code:'score_400',cnt:1,xp:200},
      {player_id:'p1',code:'collector',cnt:1,xp:150},
      {player_id:'p2',code:'the_180',cnt:1,xp:50},
      {player_id:'p2',code:'maximum',cnt:1,xp:40},
      {player_id:'p2',code:'trophy_hunter',cnt:1,xp:350},
      {player_id:'p3',code:'the_180',cnt:1,xp:50},
      {player_id:'p0',code:'the_180',cnt:1,xp:50},
    ];
    const roundRows=[
      {mode:'official',round_key:'20',round_label:'20',target_sort:11,wr_points:140,darts:'T / T / S',holder:'Chris x2 / Grant x3',holders:'Chris x2 / Grant x3',tie_count:2,darts_detail:'T / T / S',game_id:'rg1',first_created_at:'2026-01-01T10:00:00Z',created_at:'2026-01-02T10:00:00Z',source_view_version:'fixture'}
    ];
    window.SQ_ACH.playerDirectory=async()=>directory.map(r=>({...r}));
    window.SQ_ACH._sourceRows=async()=>({available:true,rows:trophySourceRows.map(r=>({...r}))});
    const base=window.sb;
    window.sb=window.__sb={
      from(table){
        if(table==='v_player_game_scores_official_clean'){
          let threshold=0;
          const q={
            select(){return q;},
            gte(col,val){if(col==='score')threshold=Number(val)||0;return q;},
            order(){return q;},
            range(){return Promise.resolve({data:scoreRows.filter(r=>Number(r.score)>=threshold),error:null});}
          };
          return q;
        }
        if(table==='v_ach_rounds'){
          const q={
            select(){return q;},
            order(){return q;},
            range(start,end){return Promise.resolve({data:milestoneRoundRows.slice(start,end+1).map(r=>({...r})),error:null});}
          };
          return q;
        }
        if(table==='v_round_high_scores_official_clean_app'){
          const q={
            select(){return q;},
            order(){return Promise.resolve({data:roundRows.map(r=>({...r})),error:null});}
          };
          return q;
        }
        return base.from(table);
      }
    };
  });

  const milestones=await page.evaluate(async()=>({
    m400:await window.SQ_ACH.forScoreMilestone('score_400'),
    m500:await window.SQ_ACH.forScoreMilestone('score_500'),
    m600:await window.SQ_ACH.forScoreMilestone('score_600'),
    bull:await window.SQ_ACH.forMilestoneProgress('bull_club'),
    doubles:await window.SQ_ACH.forMilestoneProgress('double_sweep'),
    trebles:await window.SQ_ACH.forMilestoneProgress('treble_sweep'),
    regular:await window.SQ_ACH.forMilestoneProgress('regular'),
    collector:await window.SQ_ACH.forMilestoneProgress('collector'),
  }));
  assert.deepEqual(milestones.m400.map(r=>[r.name,r.cnt]),[['Alex S',3],['Sam T',2],['Short S',1]]);
  assert.deepEqual(milestones.m500.map(r=>[r.name,r.cnt]),[['Alex S',2],['Sam T',1]]);
  assert.deepEqual(milestones.m600.map(r=>[r.name,r.cnt]),[['Alex S',1]]);
  assert.deepEqual(milestones.bull.map(r=>[r.name,r.cnt]),[['Alex S',4],['Sam T',2],['Short S',1]]);
  assert.deepEqual(milestones.doubles.map(r=>[r.name,r.cnt]),[['Alex S',3],['Short S',2],['Sam T',1]]);
  assert.deepEqual(milestones.trebles.map(r=>[r.name,r.cnt]),[['Sam T',3],['Alex S',2],['Short S',1]]);
  assert.deepEqual(milestones.regular.map(r=>[r.name,r.cnt]),[['Alex S',12],['Sam T',8],['Short S',5]]);
  assert.deepEqual(milestones.collector.map(r=>[r.name,r.cnt]),[['Alex S',3],['Sam T',2],['Short S',1]]);
  assert(!Object.values(milestones).flat().some(r=>r.name==='Zero G'),'zero-game identity leaked into milestone progress board');

  async function assertDetail(code, expected){
    await page.evaluate(c=>window.__sqTrophyDetail(c,{[c]:{cnt:1,xp:200}}),code);
    await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length>0);
    const rows=await page.evaluate(()=>Array.from(document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row')).map(r=>({name:(r.querySelector('.pp-trophy-lb-name')||{}).textContent||'',value:(r.querySelector('.pp-trophy-lb-value')||{}).textContent||''})));
    assert.deepEqual(rows.map(r=>[r.name,r.value]),expected);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));
  }
  await assertDetail('score_400',[['Alex S','3'],['Sam T','2'],['Short S','1']]);
  await assertDetail('bull_club',[['Alex S','4'],['Sam T','2'],['Short S','1']]);
  await assertDetail('double_sweep',[['Alex S','3'],['Short S','2'],['Sam T','1']]);
  await assertDetail('treble_sweep',[['Sam T','3'],['Alex S','2'],['Short S','1']]);

  await page.evaluate(()=>window.openRoundHighScoresDialog('official'));
  await page.waitForFunction(()=>document.querySelectorAll('.rh-holder').length>0);
  const holders=await page.evaluate(()=>Array.from(document.querySelectorAll('.rh-holder')).map(e=>(e.textContent||'').trim()).filter(Boolean));
  assert(holders.includes('Chris / Grant'),`clean holder line missing: ${JSON.stringify(holders)}`);
  assert(!holders.some(h=>/\bx\d+\b/i.test(h)),`repeat-count suffix leaked: ${JSON.stringify(holders)}`);

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('SC-042 record + milestone-family integrity runtime: PASS');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
