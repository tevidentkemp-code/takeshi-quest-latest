const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/?sc027=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.__sqTrophyDetail==='function' && typeof window.__sqMisfireDetail==='function' && typeof window.__sqLeagueAverageRows==='function' && typeof window.__sqLeagueAverageEligible==='function');

  await page.evaluate(()=>{
    const directory=[
      {player_id:'p1',name:'Alex S',games_played:12},
      {player_id:'p2',name:'Sam T',games_played:8},
      {player_id:'p3',name:'Short S',games_played:5},
      {player_id:'p4',name:'Zero G',games_played:0},
    ];
    window.SQ_ACH.playerDirectory=async()=>directory.map(r=>({...r}));
    const base=window.sb;
    window.__sc027Calls={};
    const milestoneRows=[
      {player_id:'p1',code:'score_100',cnt:1,xp:30},
      {player_id:'p1',code:'score_200',cnt:1,xp:30},
      {player_id:'p2',code:'score_100',cnt:1,xp:30},
      {player_id:'p2',code:'score_200',cnt:1,xp:30},
      {player_id:'p2',code:'score_300',cnt:1,xp:30},
      {player_id:'p3',code:'score_100',cnt:1,xp:30},
      {player_id:'p3',code:'score_200',cnt:1,xp:30},
      {player_id:'p3',code:'score_300',cnt:1,xp:30},
      {player_id:'p3',code:'score_400',cnt:1,xp:30},
    ];
    window.sb=window.__sb={
      from(table){
        window.__sc027Calls[table]=(window.__sc027Calls[table]||0)+1;
        if(table!=='v_ach_base' && table!=='v_ach_david_goliath' && table!=='v_player_misfires') return base.from(table);
        let code='';
        const q={
          select(){return q;},
          eq(col,val){if(col==='code') code=String(val||''); return q;},
          then(resolve){
            if(table==='v_ach_david_goliath') return resolve({data:[],error:null});
            if(table==='v_ach_base'){
              if(!code) return resolve({data:milestoneRows,error:null});
              if(code==='giant_slayer') return resolve({data:[
                {player_id:'p1',code,cnt:3,xp:30},
                {player_id:'p2',code,cnt:4,xp:40},
                {player_id:'p3',code,cnt:10,xp:100},
                {player_id:'p4',code,cnt:1,xp:10},
              ],error:null});
              return resolve({data:[],error:null});
            }
            resolve({data:[
              {player_id:'p1',cnt:3},
              {player_id:'p2',cnt:4},
              {player_id:'p3',cnt:10},
              {player_id:'p4',cnt:1},
            ],error:null});
          },
          catch(){return q;}
        };
        return q;
      }
    };
  });

  async function read(selector,rowSelector,valueSelector){
    return page.evaluate(({selector,rowSelector,valueSelector})=>{
      const d=document.querySelector(selector); if(!d) return null;
      const sw=d.querySelector('.pp-league-mode-switch');
      const misfire=rowSelector.includes('misfire');
      return {
        switchDisplay:sw?getComputedStyle(sw).display:null,
        buttons:Array.from(d.querySelectorAll('.pp-league-mode-btn')).map(b=>({text:(b.textContent||'').trim(),mode:b.dataset.leagueMode,pressed:b.getAttribute('aria-pressed')})),
        rows:Array.from(d.querySelectorAll(rowSelector)).map(r=>({
          name:(r.querySelector(misfire?'.pp-misfire-lb-name':'.pp-trophy-lb-name')||{}).textContent||'',
          value:(r.querySelector(valueSelector)||{}).textContent||'',
          rank:(r.querySelector(misfire?'.pp-misfire-lb-rank':'.pp-trophy-lb-rank')||{}).textContent||'',
          games:Number(r.dataset.games||0),
          ineligible:r.classList.contains('is-average-ineligible'),
          opacity:getComputedStyle(r).opacity,
        }))
      };
    },{selector,rowSelector,valueSelector});
  }

  await page.evaluate(()=>window.__sqTrophyDetail('giant_slayer',{giant_slayer:{cnt:3,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===4);
  let t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.deepEqual(t.buttons.map(x=>x.text),['ALL TIME','AVERAGE']);
  assert.equal(t.buttons[0].pressed,'true');
  assert.equal(t.rows[0].name,'Short S'); assert.equal(t.rows[0].value,'×10');
  await page.click('.pp-trophy-detail [data-league-mode="average"]');
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.equal(t.rows[0].name,'Sam T'); assert.equal(t.rows[0].value,'50.0%'); assert.equal(t.rows[0].rank,'#1'); assert.equal(t.rows[0].ineligible,false);
  assert.equal(t.rows[1].name,'Alex S'); assert.equal(t.rows[1].value,'25.0%'); assert.equal(t.rows[1].rank,'#2');
  assert.equal(t.rows[2].name,'Short S'); assert.equal(t.rows[2].value,'200.0%'); assert.equal(t.rows[2].rank,'—'); assert.equal(t.rows[2].ineligible,true); assert(Number(t.rows[2].opacity)<0.5);
  assert.equal(t.rows[3].value,'—'); assert.equal(t.rows[3].rank,'—'); assert.equal(t.rows[3].ineligible,true);
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));

  await page.evaluate(()=>window.__sqTrophyDetail('score_100',{score_100:{cnt:1,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===4);
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.notEqual(t.switchDisplay,'none');
  assert.deepEqual(t.buttons.map(x=>x.text),['ALL TIME','AVERAGE']);
  assert.equal(t.rows[0].name,'Short S'); assert.equal(t.rows[0].value,'4');
  assert.equal(t.rows[1].name,'Sam T'); assert.equal(t.rows[1].value,'3');
  assert.equal(t.rows[2].name,'Alex S'); assert.equal(t.rows[2].value,'2');
  assert.equal(t.rows[3].name,'Zero G'); assert.equal(t.rows[3].value,'0');
  await page.click('.pp-trophy-detail [data-league-mode="average"]');
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.equal(t.rows[0].name,'Sam T'); assert.equal(t.rows[0].value,'37.5%'); assert.equal(t.rows[0].rank,'#1');
  assert.equal(t.rows[1].name,'Alex S'); assert.equal(t.rows[1].value,'16.7%'); assert.equal(t.rows[1].rank,'#2');
  assert.equal(t.rows[2].name,'Short S'); assert.equal(t.rows[2].value,'80.0%'); assert.equal(t.rows[2].rank,'—'); assert.equal(t.rows[2].ineligible,true);
  assert.equal(t.rows[3].name,'Zero G'); assert.equal(t.rows[3].value,'—'); assert.equal(t.rows[3].rank,'—'); assert.equal(t.rows[3].ineligible,true);
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));

  await page.evaluate(()=>window.__sqMisfireDetail('bull_blind',{bull_blind:{cnt:3}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-misfire-detail .pp-misfire-lb-row').length===4);
  let m=await read('.pp-misfire-detail','.pp-misfire-lb-row','.pp-misfire-lb-count');
  assert.deepEqual(m.buttons.map(x=>x.text),['ALL TIME','AVERAGE']);
  assert.equal(m.rows[0].name,'Short S'); assert.equal(m.rows[0].value,'×10');
  await page.click('.pp-misfire-detail [data-league-mode="average"]');
  m=await read('.pp-misfire-detail','.pp-misfire-lb-row','.pp-misfire-lb-count');
  assert.equal(m.rows[0].name,'Sam T'); assert.equal(m.rows[0].value,'50.0%'); assert.equal(m.rows[0].rank,'#1');
  assert.equal(m.rows[1].name,'Alex S'); assert.equal(m.rows[1].value,'25.0%'); assert.equal(m.rows[1].rank,'#2');
  assert.equal(m.rows[2].name,'Short S'); assert.equal(m.rows[2].value,'200.0%'); assert.equal(m.rows[2].rank,'—'); assert.equal(m.rows[2].ineligible,true);

  const calls=await page.evaluate(()=>({...window.__sc027Calls}));
  assert(calls.v_ach_base>=2,'trophy and milestone details must use v_ach_base');
  assert(calls.v_ach_david_goliath>=2,'trophy and milestone details must include v_ach_david_goliath');
  assert(!calls.v_player_achievements,'positive details must not use combined v_player_achievements');
  assert(calls.v_player_misfires>=1,'misfire detail must use v_player_misfires');

  await page.setViewportSize({width:320,height:844});
  const fit=await page.evaluate(()=>{const d=document.querySelector('.pp-misfire-detail'),s=d.querySelector('.pp-league-mode-switch'); const dr=d.getBoundingClientRect(),sr=s.getBoundingClientRect(); return dr.left>=-1&&dr.right<=innerWidth+1&&sr.left>=dr.left-1&&sr.right<=dr.right+1;});
  assert(fit,'SC-027 controls overflow 320px modal');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('SC-027 milestone + percentage ALL TIME / AVERAGE regression: PASS');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
