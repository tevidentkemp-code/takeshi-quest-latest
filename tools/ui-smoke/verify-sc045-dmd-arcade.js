const assert = require('assert/strict');
const H = require('./harness');
const fs = require('fs');
const path = require('path');

function diffRatio(a,b){
  const n=Math.min(a.length,b.length); let d=Math.abs(a.length-b.length);
  for(let i=0;i<n;i++) if(a[i]!==b[i]) d++;
  return d/Math.max(1,Math.max(a.length,b.length));
}

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ARCADE A','ARCADE B']); await H.startMatch(page);
    await page.waitForFunction(()=>typeof window.sqDmdShowZones==='function' && typeof window.recordThrow==='function');
    const out=process.env.SQ_SCREENSHOTS || path.join(process.cwd(),'qa-artifacts-sc045'); fs.mkdirSync(out,{recursive:true});

    await page.evaluate(()=>{
      window.__sc045Writes=[];
      const original=window.sqDmdShowZones;
      window.sqDmdShowZones=function(z,o){ window.__sc045Writes.push({z2:String(z?.z2||''),z3:String(z?.z3||''),type:String(o?.type||''),ms:Number(o?.ms||0)}); return original.apply(this,arguments); };
    });
    await page.evaluate(()=>recordThrow({kind:'T'}));
    let writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>w.z2==='TREBLE!'),'first treble => TREBLE!');
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.__sc045Writes=[]; recordThrow({kind:'T'}); });
    writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>w.z2==='CAN HE......?' && w.type==='anticipationEyes'),'dart-2 second treble => anticipation scene');
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.__sc045Writes=[]; recordThrow({kind:'T'}); });
    writes=await page.evaluate(()=>window.__sc045Writes.slice());
    assert(writes.some(w=>/MAXI/.test(w.z2+' '+w.z3)),'third treble => MAXI MAYHEM');

    async function metrics(){
      return page.evaluate(()=>{
        const c=document.getElementById('sqDmdCanvas'); const ctx=c.getContext('2d'); const img=ctx.getImageData(0,0,c.width,c.height); const d=img.data;
        const gw=64, gh=16, sig=new Uint8Array(gw*gh);
        let lit=0,minX=c.width,minY=c.height,maxX=-1,maxY=-1;
        for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
          const i=(y*c.width+x)*4, r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
          const amber=a>80 && r>110 && g>45 && b<130 && r>g*1.18;
          if(!amber) continue;
          lit++; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
          const bx=Math.min(gw-1,Math.floor(x/c.width*gw)), by=Math.min(gh-1,Math.floor(y/c.height*gh)); sig[by*gw+bx]=1;
        }
        const bbox=maxX>=0?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:{x:0,y:0,w:0,h:0};
        return {w:c.width,h:c.height,lit,ratio:lit/Math.max(1,c.width*c.height),bbox,signature:Array.from(sig).join('')};
      });
    }

    // Capture a frame and its metrics inside the same browser animation-frame callback.
    // This avoids CI/IPC/screenshot latency turning a requested 930ms sample into a
    // post-scene sample after a 1100ms animation has legitimately completed.
    async function sampleScene(scene,targetMs){
      return page.evaluate(({scene,targetMs})=>new Promise(resolve=>{
        window.__sqDmdHardClearQueue?.();
        window.sqDmdStop();
        const started=performance.now();
        window.sqDmdShowZones({z2:scene.z2,z3:''},{type:scene.type,ms:scene.ms});
        const grab=()=>{
          const elapsed=performance.now()-started;
          if(elapsed<targetMs){ requestAnimationFrame(grab); return; }
          const c=document.getElementById('sqDmdCanvas'); const ctx=c.getContext('2d'); const img=ctx.getImageData(0,0,c.width,c.height); const d=img.data;
          const gw=64, gh=16, sig=new Uint8Array(gw*gh);
          let lit=0,minX=c.width,minY=c.height,maxX=-1,maxY=-1;
          for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
            const i=(y*c.width+x)*4, r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
            const amber=a>80 && r>110 && g>45 && b<130 && r>g*1.18;
            if(!amber) continue;
            lit++; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
            const bx=Math.min(gw-1,Math.floor(x/c.width*gw)), by=Math.min(gh-1,Math.floor(y/c.height*gh)); sig[by*gw+bx]=1;
          }
          const bbox=maxX>=0?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:{x:0,y:0,w:0,h:0};
          resolve({w:c.width,h:c.height,lit,ratio:lit/Math.max(1,c.width*c.height),bbox,signature:Array.from(sig).join(''),elapsed,png:c.toDataURL('image/png')});
        };
        requestAnimationFrame(grab);
      }),{scene,targetMs});
    }

    const scenes=[
      {type:'anticipationEyes',ms:1150,z2:'CAN HE......?',times:[220,520,850]},
      {type:'dolphinSwim',ms:2000,z2:'',times:[350,950,1550]},
      {type:'bullseyeHit',ms:1100,z2:'',times:[180,620,930]}
    ];

    await page.emulateMedia({reducedMotion:'no-preference'});
    for(const scene of scenes){
      let prev=null, maxMotion=0;
      for(let i=0;i<scene.times.length;i++){
        const m=await sampleScene(scene,scene.times[i]);
        const evidenceName=`sc045-${scene.type}-frame${i+1}.png`;
        fs.writeFileSync(path.join(out,evidenceName),Buffer.from(String(m.png).split(',')[1]||'','base64'));
        console.log('SC045_VISUAL_METRIC', JSON.stringify({scene:scene.type,frame:i+1,targetMs:scene.times[i],actualMs:Number(m.elapsed.toFixed(1)),ratio:m.ratio,bbox:m.bbox,canvas:{w:m.w,h:m.h},evidence:evidenceName}));
        assert(m.elapsed<scene.ms,`${scene.type} sample ${i+1} was captured after scene duration: actual=${m.elapsed} duration=${scene.ms}`);
        assert(m.ratio>0.004,`${scene.type} frame ${i+1} too faint: ${m.ratio}`);
        assert(m.ratio<0.34,`${scene.type} frame ${i+1} overfilled: ${m.ratio}`);
        assert(m.bbox.w>m.w*0.18,`${scene.type} frame ${i+1} lacks horizontal visual presence: ${JSON.stringify(m.bbox)} canvas=${m.w}x${m.h}`);
        assert(m.bbox.h>m.h*0.14,`${scene.type} frame ${i+1} lacks vertical visual presence: ${JSON.stringify(m.bbox)} canvas=${m.w}x${m.h}`);
        if(prev) maxMotion=Math.max(maxMotion,diffRatio(prev,m.signature));
        prev=m.signature;
      }
      assert(maxMotion>0.018,`${scene.type} must visibly animate across staged frames (motion=${maxMotion})`);
    }

    // Duration contract: a deliberately long special scene must still be active well
    // beyond the renderer's ordinary 900ms hold default. This proves opts.ms survives
    // the queue/controller path rather than silently falling back to holdMs.
    const durationProbe=await sampleScene({type:'bullseyeHit',ms:1800,z2:''},1150);
    assert(durationProbe.elapsed<1800,'duration probe sampled after requested scene lifetime');
    assert(durationProbe.bbox.w>durationProbe.w*0.18,`special-scene ms option was lost before 1150ms: ${JSON.stringify(durationProbe.bbox)}`);
    fs.writeFileSync(path.join(out,'sc045-bullseye-duration-probe.png'),Buffer.from(String(durationProbe.png).split(',')[1]||'','base64'));

    // Reduced-motion is not a blank/less-readable fallback: it must remain bold and essentially static.
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const scene of scenes){
      await page.evaluate(s=>{ window.__sqDmdHardClearQueue?.(); window.sqDmdStop(); window.sqDmdShowZones({z2:s.z2,z3:''},{type:s.type,ms:Math.max(s.ms,1400)}); },scene);
      await page.waitForTimeout(180); const a=await metrics();
      await page.waitForTimeout(260); const b=await metrics();
      await page.locator('#sqDmdWrap').screenshot({path:path.join(out,`sc045-${scene.type}-reduced.png`)});
      assert(a.ratio>0.004,`${scene.type} reduced-motion art must remain visible`);
      assert(diffRatio(a.signature,b.signature)<0.09,`${scene.type} reduced-motion fallback should be essentially static`);
    }

    // Visibility gate across supported phone widths and a desktop/cabinet viewport.
    // Desktop respects the existing canonical game-shell width: DMD CSS explicitly says
    // add height, do not change width. The gate therefore proves substantial readable
    // desktop size without forcing SC-045 to redesign the gameplay shell.
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const vp of [{w:320,h:844},{w:390,h:844},{w:430,h:900},{w:1366,h:900}]){
      await page.setViewportSize({width:vp.w,height:vp.h});
      await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.sqDmdStop(); window.sqDmdShowZones({z2:'CAN HE......?',z3:''},{type:'anticipationEyes',ms:1600}); });
      await page.waitForTimeout(160);
      const box=await page.locator('#sqDmdWrap').boundingBox();
      const m=await metrics();
      await page.locator('#sqDmdWrap').screenshot({path:path.join(out,`sc045-visibility-${vp.w}.png`)});
      const minWidth=vp.w<=430 ? vp.w-24 : 500;
      assert(box && box.width>=minWidth,`DMD too narrow at ${vp.w}px: ${box?.width}; expected >=${minWidth}`);
      assert(box && box.x>=0 && box.x+box.width<=vp.w+1,`DMD overflows viewport at ${vp.w}px: ${JSON.stringify(box)}`);
      assert(m.ratio>0.004,`DMD art invisible at ${vp.w}px`);
    }

    // Round/target information must remain legible alongside the upgraded art system.
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{ window.__sqDmdHardClearQueue?.(); window.sqDmdSetRoundTarget?.('TRB'); window.sqDmdShowZones({z2:'ARCADE A',z3:'TO THROW'},{type:'hold',ms:1000}); });
    await page.waitForTimeout(120);
    await page.locator('#sqDmdWrap').screenshot({path:path.join(out,'sc045-round-trb-visibility.png')});

    const unexpected=consoleErrs.filter(e=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(e));
    assert.deepEqual(unexpected,[],unexpected.join('\n'));
    console.log('SC-045 DMD ARCADE + PROFESSIONAL ART/VISIBILITY QA: ALL PASS');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
