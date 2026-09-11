// Real UI journeys, with all production data traffic blocked by the harness.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
(async () => {
  const {browser, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await page.addInitScript(() => {
      window.__imageBounds = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(im,...a){
        if (this.canvas.width === 640 && this.canvas.height === 160 && im instanceof HTMLImageElement && a.length === 4) {
          window.__imageBounds.push(a);
        }
        return draw.call(this,im,...a);
      };
    });
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['QA ALPHA','QA BETA']);
    await H.startMatch(page);
    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(650);
    assert(await page.locator('#liveV2Panel .v2Total').allTextContents().then(v=>v.some(x=>Number(x)>0)), 'score totals update');
    console.log('PASS score totals update after a real button press');
    assert.equal(await page.locator('#liveV2Panel .v2MiniAvg').count(), 2, 'one mini-average strip per player');
    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('3AV'), '3AV label present');
    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('MAV'), 'MAV label present');
    const avgAttachGap = await page.evaluate(() => {
      const score=document.querySelector('#liveV2Panel .v2ScoreBox[data-p="0"]')?.getBoundingClientRect();
      const avg=document.querySelector('#liveV2Panel .v2MiniAvg[data-p="0"]')?.getBoundingClientRect();
      return score&&avg ? Math.abs(avg.top-score.bottom) : 999;
    });
    assert(avgAttachGap<2,'mini-average strip attaches directly below player cell');
    const miniAv = await page.evaluate(async () => {
      const pIdx = 0;
      const cr = Number(state.currentRound || 0);
      const beforeEntry = structuredClone(state.score?.[pIdx]?.[cr] || { darts:[], roundTotal:0 });
      const beforeDart = state.currentDart;
      try{
        state.score[pIdx][cr] = {
          darts:[
            { kind:'S', points:10 },
            { kind:'S', points:10 },
            { kind:'S', points:10 }
          ],
          roundTotal:30
        };
        state.currentDart = 3;
        const pair = __sqV2LiveAveragePair(pIdx, cr);
        liveV2Render();
        await new Promise(resolve => setTimeout(resolve, 140));
        return {
          pairR3: __sqFmtAvg(pair.r3),
          pairMtc: __sqFmtAvg(pair.mtc),
          r3: document.getElementById('v2Mini3R0')?.textContent || '',
          mtc: document.getElementById('v2MiniMtc0')?.textContent || ''
        };
      } finally {
        state.score[pIdx][cr] = beforeEntry;
        state.currentDart = beforeDart;
        liveV2Render();
        await new Promise(resolve => setTimeout(resolve, 140));
      }
    });
    assert.equal(miniAv.pairR3, '30', '3R helper uses completed-round score');
    assert.equal(miniAv.pairMtc, '30', 'MTC helper uses completed-round score');
    assert.equal(miniAv.r3, miniAv.pairR3, 'rendered 3AV matches helper');
    assert.equal(miniAv.mtc, miniAv.pairMtc, 'rendered MAV matches helper');
    console.log('PASS doubled 3AV / MAV strip');
    for (const size of [{width:390,height:844},{width:430,height:932},{width:320,height:568},{width:1366,height:936}]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(900);
      const fit = await page.evaluate(() => {
        const panel=document.getElementById('liveV2Panel').getBoundingClientRect();
        const pad=document.getElementById('padBar').getBoundingClientRect();
        const canvas=document.getElementById('v2InfoDmd');
        const host=canvas.parentElement.getBoundingClientRect();
        const mini=document.querySelector('#liveV2Panel .v2MiniAvg[data-p="0"]');
        const miniRect=mini?.getBoundingClientRect();
        const miniMetrics=[...document.querySelectorAll('#liveV2Panel .v2MiniMetric')];
        return {gap:pad.top-panel.bottom, height:host.height, width:host.width, canvasWidth:canvas.getBoundingClientRect().width, overflow:document.documentElement.scrollWidth>innerWidth+1, miniHeight:miniRect?.height||0, miniOverflow:miniMetrics.some(el=>el.scrollWidth>el.clientWidth+1)};
      });
      console.log('GEOMETRY', size, fit);
      assert(!fit.overflow, 'no horizontal overflow');
      assert(!fit.miniOverflow, '3AV / MAV metrics fit their rectangle width');
      assert(fit.miniHeight>=47.5 && fit.miniHeight<=49.5, 'mini-average rectangle is doubled from 24px to 48px');
      assert(Math.abs(fit.canvasWidth-fit.width)<2,'canvas fits actual host width');
      if (size.height>=800) assert(fit.gap>=5 && fit.gap<=18,'panel reaches fixed controls with clearance');
      assert(fit.height>=80,'graph retains readable height');
      if (process.env.SQ_SCREENSHOTS) {
        fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`classic-fit-${size.width}.png`)});
      }
    }
    // Use the shared visual renderer with synthetic fixtures, never database rows.
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
      const topY=19; const out={max:motion.maxV,last:recordPath[recordPath.length-1]||null,topHits:recordPath.filter(p=>Math.abs(p[1]-topY)<.75).length,pathLen:recordPath.length};
      host.remove();return out;
    });
    assert(graph.max<150,'early scores scale against played rounds, not full-game record');
    assert(graph.last&&Math.abs(graph.last[1]-19)<.75,'high-score reference terminates at chart ceiling');
    assert.equal(graph.topHits,1,'high-score reference hits the chart ceiling once without a horizontal plateau');
    assert(graph.pathLen<14,'off-scale high-score continuation is not drawn across later rounds');
    console.log('PASS local graph scale with clipped high-score reference');

    const sc021 = await page.evaluate(() => {
      function inspect(classicThrowRace){
        const c=document.createElement('canvas'); const host=document.createElement('div');
        host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
        const ctx=c.getContext('2d'), texts=[], strokes=[]; let dash=[], path=[];
        const setDash=ctx.setLineDash.bind(ctx), begin=ctx.beginPath.bind(ctx), move=ctx.moveTo.bind(ctx), line=ctx.lineTo.bind(ctx), stroke=ctx.stroke.bind(ctx), fillText=ctx.fillText.bind(ctx);
        ctx.setLineDash=(v)=>{dash=Array.from(v||[]);return setDash(v);};
        ctx.beginPath=()=>{path=[];return begin();};
        ctx.moveTo=(x,y)=>{path.push([x,y]);return move(x,y);};
        ctx.lineTo=(x,y)=>{path.push([x,y]);return line(x,y);};
        ctx.stroke=()=>{strokes.push({dash:dash.slice(),path:path.slice(),style:String(ctx.strokeStyle)});return stroke();};
        ctx.fillText=(t,x,y,...rest)=>{texts.push({text:String(t),x,y});return fillText(t,x,y,...rest);};
        const labels=['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
        const motion={grow:[],combo:[],burst:[],lastLen:[classicThrowRace?4:1],lastFull:[0],maxV:0};
        __sqDrawArcadeRace(c,{
          labels,offset:0,classicThrowRace,
          series:[{name:'QA',color:'#7bdcff',data:[30,...Array(13).fill(null)],throwData:[0,10,10,30],dotted:false}],
          record:{label:'HS',color:'rgba(255,214,110,.92)',data:Array.from({length:14},(_,i)=>(i+1)*50)}
        },motion,performance.now()+1000);
        const player=strokes.filter(s=>s.dash.join(',')==='1.5,3.5').sort((a,b)=>b.path.length-a.path.length)[0]||{path:[]};
        const record=strokes.filter(s=>s.dash.join(',')==='5,4'&&s.path.length>2).sort((a,b)=>b.path.length-a.path.length)[0]||{path:[]};
        const start=texts.find(t=>t.text==='START'), ten=texts.find(t=>t.text==='10');
        const out={
          texts:texts.map(t=>t.text),start,ten,player:player.path,record:record.path,
          topHits:record.path.filter(p=>Math.abs(p[1]-(classicThrowRace?25:19))<.75).length,
          dotted:strokes.some(s=>s.dash.join(',')==='1.5,3.5')
        };
        host.remove(); return out;
      }
      return {classic:inspect(true),legacy:inspect(false)};
    });
    assert(sc021.classic.texts.includes('START'),'Classic race labels START origin');
    assert(sc021.classic.texts.includes('High Score'),'Classic race moves High Score into legend');
    assert(!sc021.classic.texts.includes('HS'),'Classic race removes in-chart HS tip');
    assert(sc021.classic.start && sc021.classic.ten && sc021.classic.start.x < sc021.classic.ten.x,'10 is first target notch after START');
    assert(sc021.classic.dotted,'Classic player trajectory is faint dotted');
    assert.equal(sc021.classic.player.length,4,'START plus three throw positions are plotted');
    const dx1=sc021.classic.player[1][0]-sc021.classic.player[0][0], dx2=sc021.classic.player[2][0]-sc021.classic.player[1][0], dx3=sc021.classic.player[3][0]-sc021.classic.player[2][0];
    assert(Math.max(dx1,dx2,dx3)-Math.min(dx1,dx2,dx3)<0.75,'three throw steps are evenly spaced');
    assert(Math.abs(sc021.classic.player[2][1]-sc021.classic.player[1][1])<0.75,'miss advances horizontally without changing Y');
    assert(sc021.classic.player[3][1] < sc021.classic.player[2][1],'scoring dart advances horizontally and upward');
    assert.equal(sc021.classic.topHits,1,'Classic high-score reference still terminates once at chart ceiling');
    assert(!sc021.legacy.texts.includes('START') && !sc021.legacy.texts.includes('High Score') && !sc021.legacy.dotted,'non-Classic renderer path stays unchanged');
    console.log('PASS SC-021 START / per-throw motion / dotted trajectory / HS legend isolation');

    await page.setViewportSize({width:390,height:844});
    for (const type of ['lastDartImg','desmondImg','voldyImg']) {
      await page.evaluate(type=>{window.__sqDmdHardClearQueue?.();window.__imageBounds=[];window.sqDmdShowZones({z2:'',z3:''},{type,ms:1500,amp:3.6});},type);
      await page.waitForFunction(() => Array.isArray(window.__imageBounds) && window.__imageBounds.length > 0, undefined, {timeout:4000,polling:50});
      const boxes=await page.evaluate(()=>window.__imageBounds);
      assert(boxes.length>0,type+' drew frames');
      assert(boxes.every(([x,y,w,h])=>x>=0&&y>=0&&x+w<=640&&y+h<=160),type+' stays inside display');
      console.log('PASS '+type+' animation bounds');
      if (process.env.SQ_SCREENSHOTS) await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`classic-${type}.png`)});
    }
    await page.evaluate(()=>{window.__sqDmdHardClearQueue?.();window.sqDmdShowZones({z2:'DESMOND DELIGHT',z3:'LAST DART HERO'},{type:'hold',ms:2000});});
    await page.waitForTimeout(400);
    if (process.env.SQ_SCREENSHOTS) await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'classic-long-callout.png')});
    assert(!consoleErrs.some(x=>x.startsWith('pageerror:')),consoleErrs.filter(x=>x.startsWith('pageerror:')).join('\n'));
    console.log('PASS no uncaught browser errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});