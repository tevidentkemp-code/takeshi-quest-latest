const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/?sc025=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.__sqTrophyDetail==='function' && typeof window.__sqMisfireDetail==='function' && typeof window.__sqLeagueAverageRows==='function');

  await page.evaluate(()=>{
    const directory=[
      {player_id:'p1',name:'Alex S',games_played:12},
      {player_id:'p2',name:'Sam T',games_played:2},
      {player_id:'p3',name:'Zero G',games_played:0},
    ];
    window.SQ_ACH.playerDirectory=async()=>directory.map(r=>({...r}));
    const base=window.sb;
    window.__sc025Calls={};
    window.sb=window.__sb={
      from(table){
        window.__sc025Calls[table]=(window.__sc025Calls[table]||0)+1;
        if(table!=='v_ach_base' && table!=='v_ach_david_goliath' && table!=='v_player_misfires') return base.from(table);
        let code='';
        const q={
          select(){return q;}, eq(col,val){if(col==='code') code=String(val||''); return q;},
          then(resolve){
            if(table==='v_ach_david_goliath') return resolve({data:[],error:null});
            if(table==='v_ach_base'){
              const milestone=code==='score_100';
              return resolve({data:[
                {player_id:'p1',code:code||'giant_slayer',cnt:milestone?1:3,xp:milestone?30:30},
                {player_id:'p2',code:code||'giant_slayer',cnt:milestone?1:2,xp:milestone?30:20},
                {player_id:'p3',code:code||'giant_slayer',cnt:milestone?1:1,xp:milestone?30:10},
              ],error:null});
            }
            resolve({data:[{player_id:'p1',cnt:3},{player_id:'p2',cnt:2},{player_id:'p3',cnt:1}],error:null});
          }, catch(){return q;}
        }; return q;
      }
    };
  });

  async function read(selector,rowSelector,valueSelector){
    return page.evaluate(({selector,rowSelector,valueSelector})=>{
      const d=document.querySelector(selector); if(!d) return null;
      const sw=d.querySelector('.pp-league-mode-switch');
      return {
        switchDisplay:sw?getComputedStyle(sw).display:null,
        buttons:Array.from(d.querySelectorAll('.pp-league-mode-btn')).map(b=>({text:(b.textContent||'').trim(),mode:b.dataset.leagueMode,pressed:b.getAttribute('aria-pressed')})),
        rows:Array.from(d.querySelectorAll(rowSelector)).map(r=>({name:(r.querySelector(rowSelector.includes('misfire')?'.pp-misfire-lb-name':'.pp-trophy-lb-name')||{}).textContent||'',value:(r.querySelector(valueSelector)||{}).textContent||'',games:Number(r.dataset.games||0)}))
      };
    },{selector,rowSelector,valueSelector});
  }

  await page.evaluate(()=>window.__sqTrophyDetail('giant_slayer',{giant_slayer:{cnt:3,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===3);
  let t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.deepEqual(t.buttons.map(x=>x.text),['ALL TIME','AVERAGE']); assert.equal(t.buttons[0].pressed,'true');
  assert.equal(t.rows[0].name,'Alex S'); assert.equal(t.rows[0].value,'×3');
  await page.click('.pp-trophy-detail [data-league-mode="average"]');
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.equal(t.rows[0].name,'Sam T'); assert.equal(t.rows[0].value,'1.000 / game'); assert.equal(t.rows[1].value,'0.250 / game'); assert.equal(t.rows[2].value,'—');
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));

  // One-time milestones deliberately remain all-time only; dividing a single
  // unlock by games played would rank newer players above veterans for the same achievement.
  await page.evaluate(()=>window.__sqTrophyDetail('score_100',{score_100:{cnt:1,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===3);
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.equal(t.switchDisplay,'none');
  assert.equal(t.rows[0].value,'✓');
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));

  await page.evaluate(()=>window.__sqMisfireDetail('bull_blind',{bull_blind:{cnt:3}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-misfire-detail .pp-misfire-lb-row').length===3);
  let m=await read('.pp-misfire-detail','.pp-misfire-lb-row','.pp-misfire-lb-count');
  assert.deepEqual(m.buttons.map(x=>x.text),['ALL TIME','AVERAGE']); assert.equal(m.rows[0].name,'Alex S'); assert.equal(m.rows[0].value,'×3');
  await page.click('.pp-misfire-detail [data-league-mode="average"]');
  m=await read('.pp-misfire-detail','.pp-misfire-lb-row','.pp-misfire-lb-count');
  assert.equal(m.rows[0].name,'Sam T'); assert.equal(m.rows[0].value,'1.000 / game'); assert.equal(m.rows[2].value,'—');

  const calls=await page.evaluate(()=>({...window.__sc025Calls}));
  assert(calls.v_ach_base>=2,'trophy details must use v_ach_base');
  assert(calls.v_ach_david_goliath>=2,'trophy details must include v_ach_david_goliath');
  assert(!calls.v_player_achievements,'trophy details must not use combined v_player_achievements');
  assert(calls.v_player_misfires>=1,'misfire detail must use v_player_misfires');

  await page.setViewportSize({width:320,height:844});
  const fit=await page.evaluate(()=>{const d=document.querySelector('.pp-misfire-detail'),s=d.querySelector('.pp-league-mode-switch'); const dr=d.getBoundingClientRect(),sr=s.getBoundingClientRect(); return dr.left>=-1&&dr.right<=innerWidth+1&&sr.left>=dr.left-1&&sr.right<=dr.right+1;});
  assert(fit,'SC-025 controls overflow 320px modal');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('SC-025 split-source ALL TIME / AVERAGE league regression: PASS');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
