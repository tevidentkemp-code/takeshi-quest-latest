const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

(async () => {
  const { browser, page, consoleErrs } = await H.launch({width:390,height:844});
  const output = path.resolve(process.env.SQ_EVIDENCE || 'output/playwright/sc032-ownership');
  fs.mkdirSync(output, {recursive:true});
  try {
    await page.addInitScript(() => {
      window.__writerCounts = {v2:0,v3:0};
      window.__originalCanvasMethods = {};
      for (const method of ['drawImage','fillRect','clearRect']) {
        const original = CanvasRenderingContext2D.prototype[method];
        window.__originalCanvasMethods[method] = original;
        CanvasRenderingContext2D.prototype[method] = function(...args) {
          if (this.canvas.id === 'sqDmdCanvas') {
            const stack = new Error().stack || '';
            const kind = stack.includes('inline-007.js') ? 'v2' : 'v3';
            window.__writerCounts[kind]++;
          }
          return original.apply(this,args);
        };
      }
    });
    await H.boot(page);
    await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page);
    const check = async (selected, active) => {
      await page.evaluate(({selected,active}) => {
        window.__sqDmdOwnership.select(selected);
        if (active) window.__sqDmdV2.emit({kind:'HIT_TREBLE',points:30,target:10});
        window.__writerCounts = {v2:0,v3:0};
      },{selected,active});
      await page.waitForTimeout(180);
      const counts = await page.evaluate(() => window.__writerCounts);
      assert.equal(counts[selected === 'v2' ? 'v3' : 'v2'],0, `${selected} exclusive writes`);
      if (active || selected === 'v2') assert(counts[selected] > 0, `${selected} actually draws`);
    };
    await check('v2',false); await check('v3',false);
    await check('v3',true); await check('v2',false); await check('v3',false);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(()=>window.__sqDmdOwnership.snapshot().owner),'v3');
    await page.evaluate(()=>window.__sqDmdV2.emit({kind:'UNDO'}));
    assert.equal(await page.evaluate(()=>window.__sqDmdOwnership.snapshot().owner),'v2');
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(()=>window.__sqDmdOwnership.snapshot().owner),'v3');
    // Preserve semantic identity even if every rendered word is changed.
    await page.evaluate(()=>window.__sqDmdOwnership.render({z2:'MISS',z3:'arbitrary copy'},
      {eventKind:'HIT_DOUBLE',eventData:{points:20,target:10}}));
    assert.equal(await page.evaluate(()=>window.__sqDmdV3.active.sceneId),'DOUBLE');
    await page.evaluate(()=>window.__sqDmdOwnership.restoreIdle());
    for (const width of [320,390,430]) {
      await page.setViewportSize({width,height:932}); await page.waitForTimeout(250);
      await page.evaluate(()=>window.__sqDmdOwnership.restoreIdle());
      await page.screenshot({path:path.join(output,`baseline-${width}.png`)});
      assert(await page.evaluate(()=>[...window.__sqDmdV3.outputCanvas.getContext('2d').getImageData(0,0,640,160).data]
        .filter((v,i)=>i%4===0&&v>150).length>100), 'baseline has visible text');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
      for (const scene of ['SINGLE','DOUBLE','TREBLE','OUTER_BULL','BULLSEYE','MISS']) {
        await page.evaluate(scene=>window.__sqDmdV3.renderAt(scene,180,{points:30,target:10,total:60}),scene);
        await page.screenshot({path:path.join(output,`${scene}-${width}.png`)});
      }
      await page.evaluate(()=>window.__sqDmdV3.renderAt('TREBLE',180,{points:30,target:10,total:60},{reducedMotion:true}));
      await page.screenshot({path:path.join(output,`reduced-treble-${width}.png`)});
    }
    // Remove write instrumentation before measuring actual renderer cost.
    const metrics = await page.evaluate(async () => {
      Object.assign(CanvasRenderingContext2D.prototype, window.__originalCanvasMethods);
      window.__sqDmdV2.clear({restore:false});
      window.__sqDmdOwnership.restoreIdle();
      const engine = window.__sqDmdV3;
      const samples=[];
      for(let i=0;i<180;i++) {
        await new Promise(requestAnimationFrame);
        const start=performance.now();
        const scenes=['PLAYER_UP','SINGLE','DOUBLE','TREBLE','OUTER_BULL','BULLSEYE','MISS'];
        engine.renderAt(scenes[i%scenes.length],180,{player:'ALPHA',points:30,total:60,target:10},{reducedMotion:false});
        const elapsed=performance.now()-start;
        if(i>=30) samples.push(elapsed);
      }
      samples.sort((a,b)=>a-b);
      const percentile=p=>samples[Math.ceil(samples.length*p)-1];
      return {median:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:samples.at(-1),over50:samples.filter(v=>v>=50).length};
    });
    fs.writeFileSync(path.join(output,'performance.json'),JSON.stringify(metrics,null,2));
    assert(metrics.p95<8,JSON.stringify(metrics));
    assert(metrics.p99<16.67,JSON.stringify(metrics));
    assert.equal(metrics.over50,0);
    const unexpected = consoleErrs.filter(error=>! /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(error));
    assert.deepEqual(unexpected,[]);
    console.log('PASS ownership, active/idle switching, fallback, semantic copy independence, mobile geometry',metrics);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
