from pathlib import Path


def replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


path = Path('index.html')
s = path.read_text(encoding='utf-8')

# 1) Add a compact average strip after the existing wins-dot element. Accept either
# escaped or unescaped HTML quotes because this single-file app contains both styles.
needles = [
    '<div class="v2WinDots" id="v2WinDots${i}"></div>',
    '<div class=\\"v2WinDots\\" id=\\"v2WinDots${i}\\"></div>',
]
found = [(n, s.count(n)) for n in needles if s.count(n)]
if len(found) != 1 or found[0][1] != 1:
    raise SystemExit(f'player average strip markup anchor mismatch: {found}')
needle = found[0][0]
mini = '''
      <div class="v2MiniAvg" aria-label="Player 3-dart averages">
        <span class="v2MiniAvgMetric"><span class="v2MiniAvgLab">3R AV</span><span class="v2MiniAvgVal" id="v2Mini3R${i}">–</span></span>
        <span class="v2MiniAvgMetric"><span class="v2MiniAvgLab">MTC AV</span><span class="v2MiniAvgVal" id="v2MiniMtc${i}">–</span></span>
      </div>'''
s = s.replace(needle, needle + mini, 1)

# 2) Tight, neutral styling. Existing 12px B1/B2 gap becomes 24px to clear the 20px
# strip. B3/Game Race is trimmed by a matching ~12-14px across portrait sizes.
css_marker = '/* Averages box (under 3-round viewport) */'
css = '''/* >>> PATCH:SC017_PLAYER_AVG_STRIP START */
.livev2panel .v2Scores{
  margin-bottom: 24px;
}
.livev2panel .v2ScoreBox{
  position: relative;
}
.livev2panel .v2MiniAvg{
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 3px);
  height: 20px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0,1fr) minmax(0,1fr);
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.045);
  color: rgba(245,247,255,.88);
  pointer-events: none;
}
.livev2panel .v2MiniAvgMetric{
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.livev2panel .v2MiniAvgMetric + .v2MiniAvgMetric{
  border-left: 1px solid rgba(255,255,255,.08);
}
.livev2panel .v2MiniAvgLab{
  font-size: 7px;
  font-weight: 800;
  letter-spacing: .02em;
  color: rgba(184,192,204,.76);
}
.livev2panel .v2MiniAvgVal{
  font-size: 10px;
  font-weight: 900;
  color: rgba(247,248,250,.96);
}
.livev2panel[style*="--sqV2P: 5"] .v2MiniAvgMetric,
.livev2panel[style*="--sqV2P: 6"] .v2MiniAvgMetric{
  flex-direction: column;
  gap: 0;
}
.livev2panel[style*="--sqV2P: 5"] .v2MiniAvgLab,
.livev2panel[style*="--sqV2P: 6"] .v2MiniAvgLab{ font-size: 6px; }
.livev2panel[style*="--sqV2P: 5"] .v2MiniAvgVal,
.livev2panel[style*="--sqV2P: 6"] .v2MiniAvgVal{ font-size: 8px; }
body.livev2-on[data-page="game"] #liveV2Panel{
  --sqV2InfoH: clamp(198px, 24.5vh, 248px);
}
/* <<< PATCH:SC017_PLAYER_AVG_STRIP END */

'''
if s.count(css_marker) != 1:
    raise SystemExit(f'average strip CSS marker: expected exactly 1 match, found {s.count(css_marker)}')
s = s.replace(css_marker, css + css_marker, 1)

# 3) Helper exactly mirrors the existing B3 definition: completed rounds only;
# 3R = last three completed rounds, MTC = all completed rounds in the current game.
helper_marker = 'function __sqSetupLiveV2Sizing(panel){'
helper = '''function __sqV2PlayerAverages(pIdx, currentRound){
  try{
    const cr0 = Math.max(0, Number.isFinite(+currentRound) ? +currentRound : 0);
    const done = [];
    for(let r=0; r<=cr0; r++){
      const entry = state.score?.[pIdx]?.[r];
      const complete = (r < cr0) || (entry && entry.darts && entry.darts[2] != null);
      if(complete) done.push(r);
    }
    const meanFor = (rounds)=>{
      let sum = 0, n = 0;
      rounds.forEach((r)=>{
        const v = getPerRoundScore(r, pIdx);
        if(Number.isFinite(+v)){ sum += +v; n++; }
      });
      return n ? (sum / n) : NaN;
    };
    return { r3: meanFor(done.slice(-3)), mtc: meanFor(done) };
  }catch(_){ return { r3: NaN, mtc: NaN }; }
}

'''
if s.count(helper_marker) != 1:
    raise SystemExit(f'average helper marker: expected exactly 1 match, found {s.count(helper_marker)}')
s = s.replace(helper_marker, helper + helper_marker, 1)

# 4) Update the strip in the existing totals loop, just before active-player highlighting.
loop_end = '  // Highlight active player on totals'
if s.count(loop_end) != 1:
    raise SystemExit(f'player totals loop end marker: expected 1 match, found {s.count(loop_end)}')
cut = s.index(loop_end)
prior = s[:cut]
close = '\n  }\n\n'
close_at = prior.rfind(close)
if close_at < 0:
    raise SystemExit('player totals loop closing brace not found')
update = '''
    const __miniAvg = __sqV2PlayerAverages(i, cr);
    const __mini3R = document.getElementById("v2Mini3R" + i);
    const __miniMtc = document.getElementById("v2MiniMtc" + i);
    if(__mini3R) __mini3R.textContent = __sqFmtAvg(__miniAvg.r3);
    if(__miniMtc) __miniMtc.textContent = __sqFmtAvg(__miniAvg.mtc);'''
s = s[:close_at] + update + s[close_at:]

# 5) Decouple drawn reference extent from Y-axis scale. The full record/PB/WR path is
# constructed through every round, while maxV above remains based on players + one lookahead.
s = replace_one(
    s,
    'const recTo = Math.min(recData.length, rc, playedTo + 1);   // never past the scaled range',
    'const recTo = Math.min(recData.length, rc);   // full reference path; Y-axis remains local to played rounds',
    'full high-score reference path',
)

path.write_text(s, encoding='utf-8')

# Extend the existing focused visual-fit regression rather than creating another suite.
tpath = Path('tools/ui-smoke/verify-classic-visual-fit.js')
t = tpath.read_text(encoding='utf-8')

old = """    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(650);
    assert(await page.locator('#liveV2Panel .v2Total').allTextContents().then(v=>v.some(x=>Number(x)>0)), 'score totals update');
    console.log('PASS score totals update after a real button press');"""
new = """    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(650);
    assert(await page.locator('#liveV2Panel .v2Total').allTextContents().then(v=>v.some(x=>Number(x)>0)), 'score totals update');
    console.log('PASS score totals update after a real button press');
    await page.locator('#pad .dtBullBtn').first().click();
    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(500);
    const miniAvgs = await page.evaluate(() => ({
      r3: document.getElementById('v2Mini3R0')?.textContent || '',
      mtc: document.getElementById('v2MiniMtc0')?.textContent || '',
      box: document.querySelector('.v2ScoreBox[data-p="0"]')?.getBoundingClientRect() || null,
      mini: document.querySelector('.v2ScoreBox[data-p="0"] .v2MiniAvg')?.getBoundingClientRect() || null,
      rows: document.querySelector('.v2RowsWrap')?.getBoundingClientRect() || null
    }));
    assert(miniAvgs.r3 && miniAvgs.r3 !== '–', '3R AV appears after a completed round');
    assert(miniAvgs.mtc && miniAvgs.mtc !== '–', 'MTC AV appears after a completed round');
    assert.equal(miniAvgs.r3, miniAvgs.mtc, 'single completed round yields matching 3R and MTC averages');
    assert(miniAvgs.box && miniAvgs.mini && miniAvgs.rows, 'average-strip geometry is measurable');
    assert(miniAvgs.mini.top >= miniAvgs.box.bottom, 'average strip sits below player info cell');
    assert(miniAvgs.mini.bottom <= miniAvgs.rows.top + 2, 'average strip does not overlap round rows');
    console.log('PASS compact 3R AV / MTC AV strip');"""
t = replace_one(t, old, new, 'test average insertion')

old = "return {gap:pad.top-panel.bottom, height:host.height, width:host.width, canvasWidth:canvas.getBoundingClientRect().width, overflow:document.documentElement.scrollWidth>innerWidth+1};"
new = "return {gap:pad.top-panel.bottom, height:host.height, pagerHeight:document.querySelector('.v2InfoPager')?.getBoundingClientRect().height || 0, width:host.width, canvasWidth:canvas.getBoundingClientRect().width, overflow:document.documentElement.scrollWidth>innerWidth+1};"
t = replace_one(t, old, new, 'test pager geometry')

old = "      assert(fit.height>=80,'graph retains readable height');"
new = """      assert(fit.height>=80,'graph retains readable height');
      if (size.width===390 && size.height===844) assert(fit.pagerHeight<210,'Game Race/B3 panel height reduced to make room for average strip');
      if (size.width===320 && size.height===568) assert(fit.pagerHeight<205,'short-screen Game Race/B3 panel height reduced');"""
t = replace_one(t, old, new, 'test reduced graph height')

old = """    const graph = await page.evaluate(() => {
      const c=document.createElement('canvas'); const host=document.createElement('div');
      host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
      const motion={grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
      __sqDrawArcadeRace(c,{labels:Array.from({length:14},(_,i)=>String(i+10)),series:[{data:[10,...Array(13).fill(null)],color:'#7bdcff'}],record:{data:Array.from({length:14},(_,i)=>(i+1)*50)}},motion,performance.now());
      const max=motion.maxV;host.remove();return max;
    });
    assert(graph<150,'early scores scale against played rounds, not full-game record');
    console.log('PASS beta graph early-round scaling');"""
new = """    const graph = await page.evaluate(() => {
      const proto=CanvasRenderingContext2D.prototype;
      const oldDash=proto.setLineDash, oldLine=proto.lineTo;
      let dashed=false; const recordXs=[];
      proto.setLineDash=function(v){ dashed=Array.isArray(v)&&v.length===2&&v[0]===5&&v[1]===4; return oldDash.call(this,v); };
      proto.lineTo=function(x,y){ if(dashed) recordXs.push(x); return oldLine.call(this,x,y); };
      const c=document.createElement('canvas'); const host=document.createElement('div');
      host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
      try{
        const motion={grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
        __sqDrawArcadeRace(c,{labels:Array.from({length:14},(_,i)=>String(i+10)),series:[{data:[10,...Array(13).fill(null)],color:'#7bdcff'}],record:{data:Array.from({length:14},(_,i)=>(i+1)*50)}},motion,performance.now());
        return {max:motion.maxV,maxRecordX:recordXs.length?Math.max(...recordXs):0};
      } finally { proto.setLineDash=oldDash; proto.lineTo=oldLine; host.remove(); }
    });
    assert(graph.max<150,'early scores scale against played rounds, not full-game record');
    assert(graph.maxRecordX>360,'high-score reference path is plotted through the final round');
    console.log('PASS beta graph local scale + full high-score path');"""
t = replace_one(t, old, new, 'test graph replacement')

anchor = """    await page.setViewportSize({width:390,height:844});
    for (const type of ['lastDartImg','desmondImg','voldyImg']) {"""
insert = """    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(250);
    const statsFit = await page.evaluate(() => {
      const card=document.getElementById('v2InfoCell');
      const grid=document.getElementById('v2Avg');
      const last=grid&&grid.lastElementChild;
      if(!card||!grid||!last)return null;
      const c=card.getBoundingClientRect(), l=last.getBoundingClientRect();
      return {cardBottom:c.bottom,lastBottom:l.bottom};
    });
    assert(statsFit && statsFit.lastBottom<=statsFit.cardBottom+2,'Game Stats rows remain inside B3 after height reduction');
    console.log('PASS reduced B3 keeps Game Stats content contained');
    for (const type of ['lastDartImg','desmondImg','voldyImg']) {"""
t = replace_one(t, anchor, insert, 'test stats-fit insertion')
tpath.write_text(t, encoding='utf-8')
