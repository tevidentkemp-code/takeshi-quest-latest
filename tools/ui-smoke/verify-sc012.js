// SC-012 regression: selected-target all-player rankings + Spider player comparison.
const fs = require('fs');
const path = require('path');
const H = require('./harness');
let failures = 0;
function check(name, ok, detail){ if(!ok) failures++; console.log((ok?'PASS':'FAIL')+'  '+name+(ok||!detail?'':'  — '+detail)); }
const norm = s => String(s == null ? '' : s).replace(/\s+/g,' ').trim();

function sourceGuards(){
  const src = fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
  check('board inspect receives global rank data', /__sqWireBoardInspect\(heatPanel, tablePanel, rows, 'hit', globalRanks, name\)/.test(src) && /__sqWireBoardInspect\(heatPanel, tablePanel, rows, 'points', globalRanks, name\)/.test(src));
  check('selected-target ranking panel exists', /sq-target-global-ranking/.test(src) && /Target ' \+ k \+ ' - all players/.test(src));
  check('global ranking rows preserve player names', /playerName:String\(r\.player_name \|\| r\.player_key \|\| ''\)/.test(src));
  check('Spider comparison dropdown exists', /sq-spider-compare-select/.test(src) && /Compare player/.test(src));
  check('Spider comparison is non-colour-only', /setLineDash\(\[8,5\]\)/.test(src) && /strokeRect\(p\.x - 3\.5/.test(src) && /dashed #7dd3fc/.test(src));
  check('both Spider payloads include compare players', (src.match(/comparePlayers:__sqBuildTargetComparePlayers/g)||[]).length === 2);
}

function fixture(){
  const names = ['Thom','Alex','Sam','Chris','Doheny','Eddy','Liam','Nick','Jerry','Ash','Jo','Mia'];
  const hitKeys = ['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
  const hit = [];
  const points = [];
  names.forEach((name, pi) => {
    const keys = pi < 3 ? hitKeys : ['14'];
    keys.forEach((key, ki) => {
      const sort = /^\d+$/.test(key) ? Number(key) : ({D:21,T:22,B:23}[key]);
      const throws = 90 + pi * 9 + ki * 3;
      let pct = Math.max(5, 58 - pi * 2.6 + (sort % 5));
      if (name === 'Thom' && key === '14') pct = 50.31;
      const hits = Math.round(throws * pct / 100);
      hit.push({player_key:name.toLowerCase(),player_name:name,target_key:key,target_label:key,target_sort:sort,throws,hits,hit_pct:pct,source_games:Math.max(1,Math.round(throws/3))});
    });
    const pkeys = pi < 3 ? Array.from({length:11},(_,i)=>10+i) : [14];
    pkeys.forEach((target, ki) => {
      const throws = 90 + pi * 9 + ki * 3;
      let pct = Math.max(3, 34 - pi * 1.25 + ((target-10)%4));
      if (name === 'Thom' && target === 14) pct = 21.05;
      const max = target * 3 * throws;
      const actual = Math.round(max * pct / 100);
      points.push({player_key:name.toLowerCase(),player_name:name,target_number:target,target_label:String(target),throws,actual_points:actual,max_points:max,points_pct:pct,source_games:Math.max(1,Math.round(throws/3))});
    });
  });
  return { names, hit, points };
}

async function install(page){
  const fx = fixture();
  await page.evaluate((FX) => {
    window.cloudListPlayers = async () => FX.names.map(name => ({name}));
    const base = { v_player_target_hit_pct:FX.hit, v_player_target_points_pct:FX.points };
    function query(table){
      let rows = (base[table] || []).map(r => ({...r}));
      let lim = null, range = null;
      const q = {
        select(){ return q; },
        eq(field,val){ rows = rows.filter(r => String(r[field]) === String(val)); return q; },
        ilike(field,val){ const needle=String(val).replace(/%/g,'').toLowerCase(); rows = rows.filter(r => String(r[field]||'').toLowerCase().includes(needle)); return q; },
        in(field,vals){ const set=new Set((vals||[]).map(String)); rows=rows.filter(r=>set.has(String(r[field]))); return q; },
        gt(field,val){ rows=rows.filter(r=>Number(r[field])>Number(val)); return q; },
        order(){ return q; },
        limit(n){ lim=Number(n); return q; },
        range(a,b){ range=[Number(a),Number(b)]; return q; },
        then(resolve){ let out=rows.slice(); if(range) out=out.slice(range[0],range[1]+1); if(Number.isFinite(lim)) out=out.slice(0,lim); resolve({data:out,error:null}); },
        catch(){ return q; }
      };
      return q;
    }
    const fake={from:table=>query(table)};
    window.sb=fake; window.__sb=fake;
  }, fx);
}

async function inspectMode(page, mode){
  await page.evaluate(m => {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    if (m === 'hit') window.openPlayerTargetHitDialog('Thom');
    else window.openPlayerTargetPointsDialog('Thom');
  }, mode);
  await page.waitForTimeout(900);
  const tableSel = mode === 'hit' ? '.sq-target-hit-table-panel' : '.sq-target-points-table-panel';
  await page.evaluate(sel => {
    const rows=Array.from(document.querySelectorAll(sel+' tbody tr'));
    const tr=rows.find(r => String(r.cells[0]?.textContent||'').trim()==='14');
    if(tr) tr.click();
  }, tableSel);
  await page.waitForTimeout(250);
  const rank = await page.evaluate(() => {
    const p=document.querySelector('.sq-target-global-ranking');
    if(!p) return null;
    const cur=p.querySelector('tr[data-current-player="1"]');
    const r=p.getBoundingClientRect();
    return {display:getComputedStyle(p).display, text:p.textContent, rows:p.querySelectorAll('tbody tr').length, current:cur&&cur.textContent, scrollHeight:p.scrollHeight, clientHeight:p.clientHeight, right:r.right, vw:innerWidth, overflowY:getComputedStyle(p).overflowY};
  });
  check(mode+' selected target opens ranking panel', !!rank && rank.display !== 'none', JSON.stringify(rank));
  check(mode+' ranking panel lists all fixture players', !!rank && rank.rows === 12, rank && String(rank.rows));
  check(mode+' current player is identifiable', !!rank && /Thom/i.test(rank.current||''), rank && rank.current);
  check(mode+' ranking table is mobile-contained and scrollable', !!rank && rank.right <= rank.vw + 1 && rank.clientHeight <= 160 && rank.scrollHeight > rank.clientHeight && /auto|scroll/.test(rank.overflowY), JSON.stringify(rank));
  check(mode+' selected target ranking heading is correct', !!rank && /Target 14 - all players/i.test(rank.text||''), rank && norm(rank.text).slice(0,160));

  await page.evaluate(() => {
    const b=document.querySelector('button[data-target-pct-action="spider"]');
    if(b) b.click();
  });
  await page.waitForTimeout(350);
  const initial = await page.evaluate(() => {
    const sel=document.querySelector('.sq-spider-compare-select');
    return sel ? {opts:Array.from(sel.options).map(o=>o.textContent), aria:sel.getAttribute('aria-label')} : null;
  });
  check(mode+' Spider has comparison dropdown', !!initial && /Compare player/i.test(initial.aria||''), JSON.stringify(initial));
  check(mode+' Spider dropdown contains all fixture players', !!initial && ['Thom','Alex','Sam','Mia'].every(n=>initial.opts.includes(n)) && initial.opts.length===13, initial && initial.opts.join(', '));

  await page.evaluate(() => {
    const sel=document.querySelector('.sq-spider-compare-select');
    if(!sel) return;
    const op=Array.from(sel.options).find(o=>o.textContent==='Alex');
    if(!op) return;
    sel.value=op.value; sel.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForTimeout(150);
  const compared = await page.evaluate(() => {
    const c=document.querySelector('.modal-backdrop:last-of-type canvas');
    const leg=document.querySelector('.sq-spider-compare-legend');
    const lines=leg ? Array.from(leg.querySelectorAll('i')).map(i=>getComputedStyle(i).borderTopStyle) : [];
    return {compare:c&&c.dataset.sqCompare, state:c&&c.__sqSpider&&c.__sqSpider.compare&&c.__sqSpider.compare.name, legend:leg&&leg.textContent, styles:lines};
  });
  check(mode+' Spider applies selected comparison series', compared.compare==='Alex' && compared.state==='Alex', JSON.stringify(compared));
  check(mode+' Spider labels both players', /Thom/.test(compared.legend||'') && /Alex/.test(compared.legend||''), compared.legend);
  check(mode+' Spider comparison uses solid vs dashed legend', compared.styles.includes('solid') && compared.styles.includes('dashed'), JSON.stringify(compared.styles));
}

(async()=>{
  sourceGuards();
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  await H.boot(page,{settle:2200});
  await install(page);
  await inspectMode(page,'hit');
  await inspectMode(page,'points');
  const errs=consoleErrs.filter(e=>!/favicon|Failed to load resource|net::/i.test(e));
  check('no unexpected console errors', errs.length===0, errs.slice(0,5).join(' | '));
  await browser.close();
  console.log(failures?`\n${failures} FAILURES`:'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{ console.error('CRASH',e); process.exit(2); });
