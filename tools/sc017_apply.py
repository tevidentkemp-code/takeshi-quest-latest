from pathlib import Path

INDEX = Path('index.html')
SMOKE = Path('tools/ui-smoke/verify-classic-visual-fit.js')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


html = INDEX.read_text(encoding='utf-8')

# 1) Keep the existing score boxes untouched and add one compact average strip
#    per player as a second grid row beneath them.
old = '''  const scoreBoxes = Array.from({length: Math.max(1, Math.min(6, pCount))}).map((_,i)=>`
    <div class=\"v2ScoreBox\" data-p=\"${i}\">
      <div class=\"v2Initial\" id=\"v2Init${i}\">${escapeHtml(String.fromCharCode(65+i))}</div>
      <div class=\"v2Total\" id=\"v2Total${i}\">0</div>
      <div class=\"v2Sub\" id=\"v2Sub${i}\">0</div>
      <div class=\"v2WinDots\" id=\"v2WinDots${i}\"></div>
    </div>
  `).join(\"\");

  panel.innerHTML = `'''
new = '''  const scoreBoxes = Array.from({length: Math.max(1, Math.min(6, pCount))}).map((_,i)=>`
    <div class=\"v2ScoreBox\" data-p=\"${i}\">
      <div class=\"v2Initial\" id=\"v2Init${i}\">${escapeHtml(String.fromCharCode(65+i))}</div>
      <div class=\"v2Total\" id=\"v2Total${i}\">0</div>
      <div class=\"v2Sub\" id=\"v2Sub${i}\">0</div>
      <div class=\"v2WinDots\" id=\"v2WinDots${i}\"></div>
    </div>
  `).join(\"\");
  const miniAvgBoxes = Array.from({length: Math.max(1, Math.min(6, pCount))}).map((_,i)=>`
    <div class=\"v2MiniAvg\" data-p=\"${i}\" aria-label=\"Player averages\">
      <span class=\"v2MiniMetric\"><span class=\"v2MiniLab\">3R AV</span><strong id=\"v2Mini3R${i}\">–</strong></span>
      <span class=\"v2MiniMetric\"><span class=\"v2MiniLab\">MTC AV</span><strong id=\"v2MiniMtc${i}\">–</strong></span>
    </div>
  `).join(\"\");

  panel.innerHTML = `'''
html = replace_once(html, old, new, 'mini-average markup definition')

old = '''        <div class=\"v2ScoreGrid\">
          ${scoreBoxes}
        </div>'''
new = '''        <div class=\"v2ScoreGrid\">
          ${scoreBoxes}
          ${miniAvgBoxes}
        </div>'''
html = replace_once(html, old, new, 'mini-average markup mount')

# 2) Compact attached strip. The score card keeps its existing flat lower edge;
#    the strip completes the player block without introducing another glow state.
old = '''.livev2panel .v2Sub.trailing{
  opacity: .85;
  color: rgba(255,90,90,.88);
}

/* Averages box (under 3-round viewport) */'''
new = '''.livev2panel .v2Sub.trailing{
  opacity: .85;
  color: rgba(255,90,90,.88);
}

/* SC-017: compact live averages directly beneath each player information cell. */
.livev2panel .v2MiniAvg{
  min-height:24px;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  align-items:stretch;
  background:rgba(7,13,24,.96);
  border:1px solid rgba(139,166,210,.20);
  border-top:0;
  border-radius:0 0 8px 8px;
  overflow:hidden;
  font-variant-numeric:tabular-nums;
}
.livev2panel .v2MiniMetric{
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:4px;
  padding:3px 3px 2px;
  white-space:nowrap;
}
.livev2panel .v2MiniMetric + .v2MiniMetric{border-left:1px solid rgba(139,166,210,.14);}
.livev2panel .v2MiniLab{
  font-size:7px;
  line-height:1;
  font-weight:800;
  letter-spacing:.035em;
  color:rgba(180,196,222,.66);
}
.livev2panel .v2MiniMetric strong{
  font-size:10px;
  line-height:1;
  font-weight:900;
  color:rgba(245,248,255,.94);
}
body.livev2-on[data-page=\"game\"] #liveV2Panel .v2MiniAvg[data-p]{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035);
}

/* Averages box (under 3-round viewport) */'''
html = replace_once(html, old, new, 'mini-average CSS')

# 3) One helper mirrors the existing completed-round semantics. It is display-only.
old = '''function __sqFmtAvg(n){
  if(!Number.isFinite(+n)) return \"–\";
  const v = Math.round((+n) * 10) / 10;
  return (Math.abs(v - Math.round(v)) < 1e-9) ? String(Math.round(v)) : v.toFixed(1);
}

function __sqSetupLiveV2Sizing(panel){'''
new = '''function __sqFmtAvg(n){
  if(!Number.isFinite(+n)) return \"–\";
  const v = Math.round((+n) * 10) / 10;
  return (Math.abs(v - Math.round(v)) < 1e-9) ? String(Math.round(v)) : v.toFixed(1);
}

function __sqV2LiveAveragePair(pIdx, currentRound){
  try{
    const vals = [];
    const cr = Math.max(0, Number(currentRound) || 0);
    for(let r = 0; r <= cr; r++){
      const entry = state.score?.[pIdx]?.[r];
      const done = (r < cr) || (entry && entry.darts && entry.darts[2] != null);
      if(!done) continue;
      const v = getPerRoundScore(r, pIdx);
      if(Number.isFinite(+v)) vals.push(+v);
    }
    const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : NaN;
    return { r3: mean(vals.slice(-3)), mtc: mean(vals), count: vals.length };
  }catch(_){ return { r3:NaN, mtc:NaN, count:0 }; }
}

function __sqSetupLiveV2Sizing(panel){'''
html = replace_once(html, old, new, 'live average helper')

# 4) Paint the new values immediately after the existing score-card active state.
old = '''  panel.querySelectorAll(\".v2ScoreBox\").forEach((el)=>{
    const p = parseInt(el.getAttribute(\"data-p\") || \"0\", 10);
    el.classList.toggle(\"active\", p === turn);
  });

  // Solo Practice: PB/WR total + rolling pace and live variance beside the player score pill.'''
new = '''  panel.querySelectorAll(\".v2ScoreBox\").forEach((el)=>{
    const p = parseInt(el.getAttribute(\"data-p\") || \"0\", 10);
    el.classList.toggle(\"active\", p === turn);
  });

  // SC-017: duplicate the canonical live 3R/MTC averages beneath each player card.
  for(let i=0; i<pCount; i++){
    const av = __sqV2LiveAveragePair(i, cr);
    const a3 = document.getElementById('v2Mini3R' + i);
    const mt = document.getElementById('v2MiniMtc' + i);
    if(a3) a3.textContent = __sqFmtAvg(av.r3);
    if(mt) mt.textContent = __sqFmtAvg(av.mtc);
  }

  // Solo Practice: PB/WR total + rolling pace and live variance beside the player score pill.'''
html = replace_once(html, old, new, 'live average paint')

# 5) Reclaim the new strip's vertical footprint from B3. At 320x568 this still
#    leaves an 82px+ race viewport after the pager-dot reserve.
old = '''  --sqV2InfoH:var(--sqClassicRaceHeight,clamp(126px,16vh,150px)) !important;'''
new = '''  --sqV2InfoH:var(--sqClassicRaceHeight,clamp(104px,13vh,126px)) !important;'''
html = replace_once(html, old, new, 'classic race height')

# 6) Plot the complete HS series across all rounds. It does NOT participate in
#    scale selection beyond played+1 (above), and off-scale future HS values ride
#    the chart ceiling so the full reference remains visible without bunching players.
old = '''      const recTo = Math.min(recData.length, rc, playedTo + 1);   // never past the scaled range
      const RP = []; for (let i = 0; i < recTo; i++){ if (recData[i] != null) RP.push([X(i), Y(recData[i])]); }'''
new = '''      const recTo = Math.min(recData.length, rc);                  // plot the complete reference series
      const RP = []; for (let i = 0; i < recTo; i++){ if (recData[i] != null) RP.push([X(i), Math.max(padT, Y(recData[i]))]); }'''
html = replace_once(html, old, new, 'full high-score reference')

INDEX.write_text(html, encoding='utf-8')

# Smoke coverage: validate mini averages after one completed round and prove the
# dashed record reference reaches the final X position while remaining in-bounds.
js = SMOKE.read_text(encoding='utf-8')
old = '''    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(650);
    assert(await page.locator('#liveV2Panel .v2Total').allTextContents().then(v=>v.some(x=>Number(x)>0)), 'score totals update');
    console.log('PASS score totals update after a real button press');'''
new = '''    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(650);
    assert(await page.locator('#liveV2Panel .v2Total').allTextContents().then(v=>v.some(x=>Number(x)>0)), 'score totals update');
    console.log('PASS score totals update after a real button press');
    assert.equal(await page.locator('#liveV2Panel .v2MiniAvg').count(), 2, 'one mini-average strip per player');
    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('3R AV'), '3R AV label present');
    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('MTC AV'), 'MTC AV label present');
    await page.locator('#pad .dtBullBtn').first().click();
    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(500);
    const miniAv = await page.evaluate(() => ({
      r3: document.getElementById('v2Mini3R0')?.textContent || '',
      mtc: document.getElementById('v2MiniMtc0')?.textContent || ''
    }));
    assert(miniAv.r3 && miniAv.r3 !== '–', '3R AV populated after a completed round');
    assert.equal(miniAv.r3, miniAv.mtc, '3R AV and MTC AV agree after the first completed round');
    console.log('PASS compact 3R AV / MTC AV strip');'''
js = replace_once(js, old, new, 'smoke mini averages')

old = '''    // Use the shared visual renderer with synthetic fixtures, never database rows.
    const graph = await page.evaluate(() => {
      const c=document.createElement('canvas'); const host=document.createElement('div');
      host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
      const motion={grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
      __sqDrawArcadeRace(c,{labels:Array.from({length:14},(_,i)=>String(i+10)),series:[{data:[10,...Array(13).fill(null)],color:'#7bdcff'}],record:{data:Array.from({length:14},(_,i)=>(i+1)*50)}},motion,performance.now());
      const max=motion.maxV;host.remove();return max;
    });
    assert(graph<150,'early scores scale against played rounds, not full-game record');
    console.log('PASS beta graph early-round scaling');'''
new = '''    // Use the shared visual renderer with synthetic fixtures, never database rows.
    const graph = await page.evaluate(() => {
      const c=document.createElement('canvas'); const host=document.createElement('div');
      host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
      const ctx=c.getContext('2d'); const dashed=[]; let dash=[]; let path=[];
      const setDash=ctx.setLineDash.bind(ctx), begin=ctx.beginPath.bind(ctx), move=ctx.moveTo.bind(ctx), line=ctx.lineTo.bind(ctx), stroke=ctx.stroke.bind(ctx);
      ctx.setLineDash=(v)=>{dash=Array.from(v||[]);return setDash(v);};
      ctx.beginPath=()=>{path=[];return begin();};
      ctx.moveTo=(x,y)=>{path.push([x,y]);return move(x,y);};
      ctx.lineTo=(x,y)=>{path.push([x,y]);return line(x,y);};
      ctx.stroke=()=>{if(dash.join(',')==='5,4'&&path.length)dashed.push(path.slice());return stroke();};
      const motion={grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
      __sqDrawArcadeRace(c,{labels:Array.from({length:14},(_,i)=>String(i+10)),series:[{data:[10,...Array(13).fill(null)],color:'#7bdcff'}],record:{data:Array.from({length:14},(_,i)=>(i+1)*50)}},motion,performance.now());
      const recordPath=dashed.sort((a,b)=>b.length-a.length)[0]||[];
      const out={max:motion.maxV,last:recordPath[recordPath.length-1]||null,minY:recordPath.length?Math.min(...recordPath.map(p=>p[1])):null};
      host.remove();return out;
    });
    assert(graph.max<150,'early scores scale against played rounds, not full-game record');
    assert(graph.last&&graph.last[0]>370,'high-score reference reaches the final round');
    assert(graph.minY>=18,'off-scale high-score continuation stays visibly inside the chart');
    console.log('PASS local graph scale with full high-score reference');'''
js = replace_once(js, old, new, 'smoke full HS reference')

SMOKE.write_text(js, encoding='utf-8')
print('SC-017 patch applied')
