from pathlib import Path

p=Path('tools/ui-smoke/verify-sc025.js')
s=p.read_text()

def repl(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 anchor, found {n}')
    s=s.replace(old,new,1)

repl("""    window.sb=window.__sb={
      from(table){
        window.__sc027Calls[table]=(window.__sc027Calls[table]||0)+1;
        if(table!=='v_ach_base' && table!=='v_ach_david_goliath' && table!=='v_player_misfires') return base.from(table);
        let code='';
""","""    const scoreRows=[
      {game_id:'g1',ts:'2026-01-01T10:00:00Z',player_id:'p1',player_id_alt:'',player_name:'Alex S',score:150},
      {game_id:'g2',ts:'2026-01-02T10:00:00Z',player_id:'p1',player_id_alt:'',player_name:'Alex S',score:250},
      {game_id:'g3',ts:'2026-01-03T10:00:00Z',player_id:'p2',player_id_alt:'',player_name:'Sam T',score:180},
      {game_id:'g4',ts:'2026-01-04T10:00:00Z',player_id:'p2',player_id_alt:'',player_name:'Sam T',score:220},
      {game_id:'g5',ts:'2026-01-05T10:00:00Z',player_id:'p2',player_id_alt:'',player_name:'Sam T',score:330},
      {game_id:'g6',ts:'2026-01-06T10:00:00Z',player_id:'p3',player_id_alt:'',player_name:'Short S',score:150},
      {game_id:'g7',ts:'2026-01-07T10:00:00Z',player_id:'p3',player_id_alt:'',player_name:'Short S',score:250},
      {game_id:'g8',ts:'2026-01-08T10:00:00Z',player_id:'p3',player_id_alt:'',player_name:'Short S',score:350},
      {game_id:'g9',ts:'2026-01-09T10:00:00Z',player_id:'p3',player_id_alt:'',player_name:'Short S',score:450},
    ];
    window.sb=window.__sb={
      from(table){
        window.__sc027Calls[table]=(window.__sc027Calls[table]||0)+1;
        if(table==='v_player_game_scores_official_clean'){
          let threshold=0;
          const q={
            select(){return q;},
            gte(col,val){if(col==='score') threshold=Number(val)||0; return q;},
            order(){return q;},
            range(){return Promise.resolve({data:scoreRows.filter(r=>Number(r.score)>=threshold),error:null});}
          };
          return q;
        }
        if(table!=='v_ach_base' && table!=='v_ach_david_goliath' && table!=='v_player_misfires') return base.from(table);
        let code='';
""",'score milestone mock source')

repl("""  await page.evaluate(()=>window.__sqTrophyDetail('score_100',{score_100:{cnt:1,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===4);
""","""  await page.evaluate(()=>window.__sqTrophyDetail('score_100',{score_100:{cnt:1,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===3);
""",'score milestone row count')

repl("""  assert.equal(t.rows[2].name,'Alex S'); assert.equal(t.rows[2].value,'2');
  assert.equal(t.rows[3].name,'Zero G'); assert.equal(t.rows[3].value,'0');
""","""  assert.equal(t.rows[2].name,'Alex S'); assert.equal(t.rows[2].value,'2');
""",'remove zero-game all-time row')

repl("""  assert.equal(t.rows[2].name,'Short S'); assert.equal(t.rows[2].value,'80.0%'); assert.equal(t.rows[2].rank,'—'); assert.equal(t.rows[2].ineligible,true);
  assert.equal(t.rows[3].name,'Zero G'); assert.equal(t.rows[3].value,'—'); assert.equal(t.rows[3].rank,'—'); assert.equal(t.rows[3].ineligible,true);
""","""  assert.equal(t.rows[2].name,'Short S'); assert.equal(t.rows[2].value,'80.0%'); assert.equal(t.rows[2].rank,'—'); assert.equal(t.rows[2].ineligible,true);
""",'remove zero-game average row')

repl("""  assert(calls.v_ach_base>=2,'trophy and milestone details must use v_ach_base');
  assert(calls.v_ach_david_goliath>=2,'trophy and milestone details must include v_ach_david_goliath');
""","""  assert(calls.v_ach_base>=1,'positive trophy details must use v_ach_base');
  assert(calls.v_ach_david_goliath>=1,'positive trophy details must include v_ach_david_goliath');
  assert(calls.v_player_game_scores_official_clean>=1,'score milestones must use the clean official game-score source');
""",'source assertions')

p.write_text(s)
