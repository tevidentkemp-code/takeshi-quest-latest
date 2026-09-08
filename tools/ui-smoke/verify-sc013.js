// SC-013 regression: nonlinear Spider scale + 10-game target ranking/comparison eligibility.
const fs = require('fs');
const path = require('path');
const H = require('./harness');
let failures = 0;
function check(name, ok, detail){ if(!ok) failures++; console.log((ok?'PASS':'FAIL')+'  '+name+(ok||!detail?'':'  — '+detail)); }

function sourceGuards(){
  const src = fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
  check('Spider nonlinear radius helper exists', /function __sqSpiderRadiusNorm\(valuePct\)/.test(src));
  check('Spider scale anchors 25=0.5, 75=0.75, 100=1', /if \(p <= 25\) return \(p \/ 25\) \* 0\.5/.test(src) && /0\.5 \+ \(\(p - 25\) \/ 50\) \* 0\.25/.test(src) && /0\.75 \+ \(\(p - 75\) \/ 25\) \* 0\.25/.test(src));
  check('base and comparison Spider share nonlinear transform', (src.match(/__sqSpiderRadiusNorm\(/g)||[]).length >= 5 && /var v = __sqSpiderRadiusNorm\(raw\)/.test(src));
  check('target eligibility threshold is 10 games', /var __SQ_TARGET_MIN_GAMES = 10/.test(src) && /__sqFilterTargetEligiblePlayers/.test(src));
  check('both global rank paths apply player eligibility', (src.match(/allRows = __sqFilterTargetEligiblePlayers\(allRows\)/g)||[]).length === 2);
  check('Hit global rank fetch includes source_games', /target_sort,throws,hits,hit_pct,source_games/.test(src));
  check('ranking heading states 10+ games', /Target ' \+ k \+ ' - 10\+ games/.test(src));
}

function fixture(){
  const names = ['Thom','Alex','Sam','Chris','Mia','Low'];
  const hitKeys = ['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
  const pointsKeys = Array.from({length:11},(_,i)=>10+i);
  const maxGames = {Thom:12, Alex:12, Sam:11, Chris:10, Mia:9, Low:2};
  const hit = [], points = [];
  names.forEach((name, pi) => {
    hitKeys.forEach((key, ki) => {
      const sort = /^\d+$/.test(key) ? Number(key) : ({D:21,T:22,B:23}[key]);
      let pct = 42 - pi * 3 + (ki % 4);
      if (name === 'Thom' && key === '10') pct = 25;
      if (name === 'Thom' && key === '11') pct = 75;
      if (name === 'Thom' && key === '12') pct = 100;
      const sg = (name === 'Alex' && key === '14') ? 8 : maxGames[name];
      const throws = Math.max(3, sg * 3);
      hit.push({player_key:name.toLowerCase(),player_name:name,target_key:key,target_label:key,target_sort:sort,throws,hits:Math.round(throws*pct/100),hit_pct:pct,source_games:sg});
    });
    pointsKeys.forEach((target, ki) => {
      let pct = 30 - pi * 2 + (ki % 4);
      if (name === 'Thom' && target === 10) pct = 25;
      if (name === 'Thom' && target === 11) pct = 75;
      if (name === 'Thom' && target === 12) pct = 100;
      const sg = (name === 'Alex' && target === 14) ? 8 : maxGames[name];
      const throws = Math.max(3, sg * 3);
      const max = target * 3 * throws;
      points.push({player_key:name.toLowerCase(),player_name:name,target_number:target,target_label:String(target),throws,actual_points:Math.round(max*pct/100),max_points:max,points_pct:pct,source_games:sg});
    });
  });
  return {names,hit,points};
}

async function install(page){
  const fx=fixture();
  await page.evaluate(FX => {
    window.cloudListPlayers = async () => FX.names.map(name=>({name}));
    const base={v_player_target_hit_pct:FX.hit,v_player_target_points_pct:FX.points};
    function query(table){
      let rows=(base[table]||[]).map(r=>({...r}));
      let lim=null, range=null;
      const q={
        select(){return q;},
        eq(field,val){rows=rows.filter(r=>String(r[field])===String(val));return q;},
        ilike(field,val){const needle=String(val).replace(/%/g,'').toLowerCase();rows=rows.filter(r=>String(r[field]||'').toLowerCase().includes(needle));return q;},
        in(field,vals){const set=new Set((vals||[]).map(String));rows=rows.filter(r=>set.has(String(r[field])));return q;},
        gt(field,val){rows=rows.filter(r=>Number(r[field])>Number(val));return q;},
        order(){return q;},
        limit(n){lim=Number(n);return q;},
        range(a,b){range=[Number(a),Number(b)];return q;},
        then(resolve){let out=rows.slice();if(range)out=out.slice(range[0],range[1]+1);if(Number.isFinite(lim))out=out.slice(0,lim);resolve({data:out,error:null});},
        catch(){return q;}
      };
      return q;
    }
    const fake={from:table=>query(table)};
    window.sb=fake; window.__sb=fake;
  },fx);
}

async function inspectMode(page, mode){
  await page.evaluate(m=>{
    document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove());
    if(m==='hit') window.openPlayerTargetHitDialog('Thom');
    else window.openPlayerTargetPointsDialog('Thom');
  },mode);
  await page.waitForTimeout(900);
  const tableSel=mode==='hit'?'.sq-target-hit-table-panel':'.sq-target-points-table-panel';
  await page.evaluate(sel=>{
    const tr=Array.from(document.querySelectorAll(sel+' tbody tr')).find(r=>String(r.cells[0]?.textContent||'').trim()==='14');
    if(tr) tr.click();
  },tableSel);
  await page.waitForTimeout(250);
  const rank=await page.evaluate(()=>{
    const p=document.querySelector('.sq-target-global-ranking');
    if(!p)return null;
    return {heading:p.querySelector('.sq-target-global-ranking-head')?.textContent||'',names:Array.from(p.querySelectorAll('tbody tr')).map(r=>String(r.cells[1]?.textContent||'').trim()),rows:p.querySelectorAll('tbody tr').length};
  });
  check(mode+' ranking uses 10-game eligible population', !!rank && rank.rows===4 && ['Thom','Alex','Sam','Chris'].every(n=>rank.names.some(x=>x.includes(n))), JSON.stringify(rank));
  check(mode+' ranking includes exact 10-game boundary', !!rank && rank.names.some(x=>x.includes('Chris')), JSON.stringify(rank));
  check(mode+' ranking uses player-level eligibility, not target-row games', !!rank && rank.names.some(x=>x.includes('Alex')), JSON.stringify(rank));
  check(mode+' ranking excludes under-10 players', !!rank && !rank.names.some(x=>/Mia|Low/.test(x)), JSON.stringify(rank));
  check(mode+' ranking heading says 10+ games', !!rank && /10\+ games/i.test(rank.heading), rank&&rank.heading);

  await page.evaluate(()=>{
    window.__sc013ArcCalls=[];
    const proto=CanvasRenderingContext2D.prototype;
    if(!proto.__sc013OrigArc){
      proto.__sc013OrigArc=proto.arc;
      proto.arc=function(x,y,r){
        if(r>=3 && r<=6 && window.__sc013ArcCalls) window.__sc013ArcCalls.push({x,y,r});
        return proto.__sc013OrigArc.apply(this,arguments);
      };
    }
  });
  await page.evaluate(()=>{const b=document.querySelector('button[data-target-pct-action="spider"]');if(b)b.click();});
  await page.waitForTimeout(1000);
  const spider=await page.evaluate(()=>{
    const c=document.querySelector('.modal-backdrop:last-of-type canvas');
    const sel=document.querySelector('.sq-spider-compare-select');
    if(!c||!sel)return null;
    const cx=c.width/2,cy=c.height/2,R=Math.min(c.width,c.height)*0.355;
    const norms=(window.__sc013ArcCalls||[]).map(p=>Math.hypot(p.x-cx,p.y-cy)/R).filter(v=>Number.isFinite(v));
    return {opts:Array.from(sel.options).map(o=>o.textContent),norms};
  });
  check(mode+' Spider comparison includes only eligible players', !!spider && ['Thom','Alex','Sam','Chris'].every(n=>spider.opts.includes(n)) && !spider.opts.includes('Mia') && !spider.opts.includes('Low') && spider.opts.length===5, spider&&spider.opts.join(', '));
  const near=(arr,v,t=.035)=>Array.isArray(arr)&&arr.some(x=>Math.abs(x-v)<=t);
  check(mode+' Spider maps 25% to roughly half radius', !!spider && near(spider.norms,.5), spider&&JSON.stringify(spider.norms.slice(0,20)));
  check(mode+' Spider maps 75% to roughly three-quarter radius', !!spider && near(spider.norms,.75), spider&&JSON.stringify(spider.norms.slice(0,20)));
  check(mode+' Spider maps 100% to edge', !!spider && near(spider.norms,1), spider&&JSON.stringify(spider.norms.slice(0,20)));
}

(async()=>{
  sourceGuards();
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  await H.boot(page,{settle:2200});
  await install(page);
  await inspectMode(page,'hit');
  await inspectMode(page,'points');
  const errs=consoleErrs.filter(e=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors',errs.length===0,errs.slice(0,5).join(' | '));
  await browser.close();
  console.log(failures?`\n${failures} FAILURES`:'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
