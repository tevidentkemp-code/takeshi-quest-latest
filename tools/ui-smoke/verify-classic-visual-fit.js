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
    for (const size of [{width:390,height:844},{width:430,height:932},{width:320,height:568},{width:1366,height:936}]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(900);
      const fit = await page.evaluate(() => {
        const panel=document.getElementById('liveV2Panel').getBoundingClientRect();
        const pad=document.getElementById('padBar').getBoundingClientRect();
        const canvas=document.getElementById('v2InfoDmd');
        const host=canvas.parentElement.getBoundingClientRect();
        return {gap:pad.top-panel.bottom, height:host.height, width:host.width, canvasWidth:canvas.getBoundingClientRect().width, overflow:document.documentElement.scrollWidth>innerWidth+1};
      });
      console.log('GEOMETRY', size, fit);
      assert(!fit.overflow, 'no horizontal overflow');
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
      const motion={grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
      __sqDrawArcadeRace(c,{labels:Array.from({length:14},(_,i)=>String(i+10)),series:[{data:[10,...Array(13).fill(null)],color:'#7bdcff'}],record:{data:Array.from({length:14},(_,i)=>(i+1)*50)}},motion,performance.now());
      const max=motion.maxV;host.remove();return max;
    });
    assert(graph<150,'early scores scale against played rounds, not full-game record');
    console.log('PASS beta graph early-round scaling');
    await page.setViewportSize({width:390,height:844});
    for (const type of ['lastDartImg','desmondImg','voldyImg']) {
      await page.evaluate(type=>{window.__sqDmdHardClearQueue?.();window.__imageBounds=[];window.sqDmdShowZones({z2:'',z3:''},{type,ms:1500,amp:3.6});},type);
      await page.waitForTimeout(900);
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
