// Real source/dist rendering; the shared harness prevents production traffic.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
// Complete groups keep hosted WebKit within the existing 180s command budget.
const qaPart = process.env.SQ_SC070_PART || 'all';
const expectedCases = {all:62,layout:26,numerical:36,identity:12,records:14,'numeric-doubles':12,'numeric-triples':12,'numeric-bull':12};
const numericRoundParts = {11:'numeric-doubles',12:'numeric-triples',13:'numeric-bull'};
assert(Object.hasOwn(expectedCases,qaPart),'Invalid SQ_SC070_PART: '+qaPart);
const inPart = part => qaPart==='all'||qaPart===part||(qaPart==='layout'&&['identity','records'].includes(part))||(part==='numerical'&&qaPart.startsWith('numeric-'));
const qaStarted = Date.now();
const widths = [320,390,430];
const shots = process.env.SQ_SCREENSHOTS;
let cases = 0;
async function frames(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));}
async function settled(page,round){
  await page.waitForFunction(r=>document.querySelector('#v2Rows .v2Badge.liveRow')?.dataset.round===String(r),round);
  await page.waitForFunction(()=>[document.getElementById('liveV2Panel').__sqV2Wall?.animation,...document.getElementById('v2Rows').getAnimations()].every(a=>!a||(!a.pending&&!['running','paused'].includes(a.playState))));
  await frames(page);
}
async function seed(page,count=5,mode='match'){
  await page.evaluate(({count,mode})=>{
    const token=Number(state.__gameToken||0);state=JSON.parse(JSON.stringify(baseState));state.__gameToken=token;
    state.players=Array.from({length:count},(_,i)=>({id:'sc070-'+i,name:'PLAYER '+String.fromCharCode(65+i),initials:'P'+(i+1),avatar_id:i+1}));assignUniqueColors(state.players);
    state.match={id:'sc070-offline',gameNumber:1,targetWins:3,autoRotateOrder:true,wins:Array(count).fill(0),history:[],mode:'match',gameFormat:'match_play',gameVariant:'classic'};
    if(mode==='practice')Object.assign(state.match,{mode:'practice',forcePractice:true,isPractice:true});
    if(mode==='tournament')Object.assign(state.match,{tournament:true,tournamentType:'classic',tournamentRules:{startRoundIndex:0,strictTimer:false}});
    if(mode==='turbo')Object.assign(state.match,{mode:'turbo',gameVariant:'turbo',startTarget:'17',strictTimer:true,throwLimitSeconds:20});
    startNewGame(count>1?false:true);
  },{count,mode});
  if(count>1)await page.click('.to-start');
  if(count>1)await page.waitForFunction(()=>window.__sqThrowOrderRevealPending!==true);
  try{await page.waitForFunction(()=>document.body.dataset.page==='game'&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');}
  catch(error){console.error('SC070 fixture deadline '+JSON.stringify(await page.evaluate(()=>({page:document.body.dataset.page,round:state.currentRound,history:state.history.length,overlay:document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden'),visible:document.visibilityState,tableRows:document.querySelectorAll('#tbody tr').length}))));throw error;}
  if(mode==='turbo'){
    await page.waitForFunction(()=>document.body.dataset.page==='game');assert.equal(await page.evaluate(()=>state.currentRound),7);
    await page.click('.sq-turbo-ready-start');await page.waitForFunction(()=>window.__sqTurboTimerStatus().active&&document.querySelector('.sqTurboTimerActive'));
  }
}
async function advance(page,round){
  await page.evaluate(round=>{let guard=0;while(state.currentRound<round&&guard++<250){const r=state.currentRound;recordThrow(r===11?{kind:'D',sector:20}:r===12?{kind:'T',sector:20}:{kind:'T',number:ROUNDS[r].target});}if(state.currentRound!==round)throw new Error('Canonical fixture did not reach requested round');},round);
  await settled(page,round);
}
async function identity(page,long=false,maxWins=false,widest=false){
  await page.evaluate(({long,maxWins,widest})=>{state.players.forEach((p,i)=>p.name=widest?['WWWWWWWWWWWW','WWWWWWWWWWWM','WWWWWWWWWWWA','WWWWWWWWWWWB','WWWWWWWWWWWC'][i]:long?'WWWWWWWWWWW'+String.fromCharCode(65+i):'PLAYER '+String.fromCharCode(65+i));if(maxWins){state.match.targetWins=5;state.match.wins=[4,3,2,1,0];}updateUI();},{long,maxWins,widest});await frames(page);
}
async function observer(page){
  await page.evaluate(()=>{
    const c=document.getElementById('v2InfoDmd'),ctx=c.getContext('2d');window.__sc070Legend=new Map();window.__sc070Packet=null;
    const ids=window.__sc070Ids||(window.__sc070Ids={canvases:new WeakMap(),contexts:new WeakMap(),next:0});
    const id=(map,value)=>{if(!value||!['object','function'].includes(typeof value))return null;if(!map.has(value))map.set(value,++ids.next);return map.get(value);};
    const d=window.__sc070Diag={at:performance.now(),initialCanvas:id(ids.canvases,c),initialContext:id(ids.contexts,ctx),drawCount:0,nativeTextCount:0,frameCount:0,draws:[],text:[],frames:[]};
    if(!window.__sc070NativeText){
      window.__sc070NativeText=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){
        const d=window.__sc070Diag;
        if(d && this.canvas?.id==='v2InfoDmd'){
          d.nativeTextCount++;
          d.text.push({at:performance.now(),text,x,y,font:this.font,align:this.textAlign,width:this.measureText(text).width,maxWidth,canvas:id(ids.canvases,this.canvas),context:id(ids.contexts,this),connected:this.canvas.isConnected,currentCanvas:this.canvas===document.getElementById('v2InfoDmd')});
          if(d.text.length>100)d.text.shift();
        }
        return window.__sc070NativeText.apply(this,arguments);
      };
    }
    if(!window.__sc070NativeRaf){
      window.__sc070NativeRaf=requestAnimationFrame;
      window.requestAnimationFrame=function(callback){
        const d=window.__sc070Diag,item={queued:performance.now(),name:callback.name};
        if(d){d.frames.push(item);if(d.frames.length>80)d.frames.shift();}
        return window.__sc070NativeRaf.call(this,function(){item.called=performance.now();if(d)d.frameCount++;return callback.apply(this,arguments);});
      };
    }
    if(!window.__sc070DrawNative){window.__sc070DrawNative=__sqDrawArcadeRace;__sqDrawArcadeRace=function(canvas,packet,st,now){
      if(packet)window.__sc070Packet=JSON.stringify(packet);
      const context=canvas?.getContext?.('2d'),d=window.__sc070Diag,item={start:performance.now(),canvas:id(ids.canvases,canvas),context:id(ids.contexts,context),canvasId:canvas?.id,connected:canvas?.isConnected,currentCanvas:canvas===document.getElementById('v2InfoDmd'),packetNames:Array.isArray(packet?.series)?packet.series.map(s=>s?.name):null,ctxHook:!!context?.__sc070FillNative,maxV:st?.maxV,lastLen:Array.isArray(st?.lastLen)?st.lastLen.slice():st?.lastLen,lastFull:Array.isArray(st?.lastFull)?st.lastFull.slice():st?.lastFull};
      if(d){d.drawCount++;d.draws.push(item);if(d.draws.length>24)d.draws.shift();}
      try{return window.__sc070DrawNative.apply(this,arguments);}finally{item.end=performance.now();}
    };}
    if(!ctx.__sc070FillNative){ctx.__sc070FillNative=ctx.fillText;ctx.fillText=function(text,x,y,maxWidth){if(this.font.includes('9px')&&this.textAlign==='left'&&y<40){const natural=this.measureText(text).width;window.__sc070Legend.set(text,{text,x,y,end:x+(maxWidth===undefined?natural:Math.min(natural,maxWidth)),natural,font:this.font,color:this.fillStyle,compressed:maxWidth!==undefined});}return ctx.__sc070FillNative.apply(this,arguments);};}
  });
  const at=Date.now();let stage='packet';
  try{
  await page.waitForFunction(()=>{try{const p=JSON.parse(window.__sc070Packet);return p.series.length===state.players.length&&p.series.every((s,i)=>s.name===state.players[i].name);}catch(_){return false;}});
  stage='clear';await page.evaluate(()=>window.__sc070Legend.clear());stage='frames';await frames(page);stage='legend';await page.waitForFunction(()=>window.__sc070Legend.size>=state.players.length);
  }catch(error){
    try{
      console.error('SC070 native observer deadline '+JSON.stringify({stage,waitStarted:at,observedAt:Date.now(),diagnostic:await page.evaluate(()=>{
        const c=document.getElementById('v2InfoDmd'),ctx=c?.getContext('2d'),ids=window.__sc070Ids;
        return{at:performance.now(),timeOrigin:performance.timeOrigin,page:document.body.dataset.page,ready:document.readyState,visibility:document.visibilityState,hidden:document.hidden,bodyClasses:document.body.className,fonts:document.fonts.status,canvas:c?{identity:ids.canvases.get(c),context:ids.contexts.get(ctx),connected:c.isConnected,rect:c.getBoundingClientRect().toJSON(),width:c.width,height:c.height,ctxHook:!!ctx.__sc070FillNative}:null,packet:window.__sc070Packet?JSON.parse(window.__sc070Packet):null,map:[...window.__sc070Legend.values()],players:state.players.map(p=>p.name),gameToken:state.__gameToken,history:state.history.length,animations:document.getElementById('v2Rows').getAnimations().map(a=>({pending:a.pending,state:a.playState,time:a.currentTime})),renderRaf:window.__sqV2RaceRaf,native:window.__sc070Diag};
      }),pageErrors:(page.__sc070ConsoleErrors||[]).filter(e=>e.startsWith('pageerror:'))}));
    }catch(diagnosticError){console.error('SC070 diagnostic read failed '+String(diagnosticError));}
    throw error;
  }
}
async function measure(page){return page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const inside=(a,b)=>a.x>=b.x-.25&&a.right<=b.right+.25&&a.y>=b.y-.25&&a.bottom<=b.bottom+.25;
  const textRect=e=>{if(!e?.textContent)return null;const r=document.createRange();r.selectNodeContents(e);return rect(r);};
  const panel=document.getElementById('liveV2Panel'),badges=[...document.querySelectorAll('#v2Rows .v2Badge')],li=badges.findIndex(b=>b.classList.contains('liveRow'));
  const headers=[...panel.querySelectorAll('.v2ScoreBox')].map((b,i)=>{const t=b.querySelector('.v2Total'),tr=textRect(t),br=rect(b),dots=[...b.querySelectorAll('.v2WinDot')].map(d=>({rect:rect(d),on:d.classList.contains('on')}));return{text:t.textContent,truth:getPlayerTotal(i),rect:br,textRect:tr,totalContained:inside(tr,br),font:getComputedStyle(t).fontSize,digits:t.dataset.totalDigits,wins:dots,winsContained:dots.every(d=>inside(d.rect,br))};});
  const cells=[...document.querySelectorAll('#v2Rows .v2Cell.liveRow')].map(c=>{const cr=rect(c),n=c.querySelector('.v2CellNum')||c.querySelector('.v2CellScore'),nr=textRect(n),dots=[...c.querySelectorAll('.v2Dot')].map(d=>{const dr=rect(d),tr=textRect(d);return{text:d.textContent,state:d.dataset.shotState,classes:d.className,rect:dr,textRect:tr,font:getComputedStyle(d).fontSize,contained:inside(dr,cr),textContained:!tr||inside(tr,dr)};});return{rect:cr,total:n?.textContent,totalRect:nr,totalContained:!nr||inside(nr,cr),dots,noDotOverlap:dots.every((a,i)=>dots.slice(i+1).every(b=>a.rect.right<=b.rect.x+.25||b.rect.right<=a.rect.x+.25||a.rect.bottom<=b.rect.y+.25||b.rect.bottom<=a.rect.y+.25)),totalAboveDots:!nr||nr.bottom<=Math.min(...dots.map(d=>d.rect.y))+.25};});
  const averages=[...panel.querySelectorAll('.v2MiniAvg')].map(a=>({height:rect(a).height,metrics:[...a.querySelectorAll('.v2MiniMetric')].map(m=>{const l=m.querySelector('.v2MiniLab'),v=m.querySelector('strong');return{label:l.textContent,value:v.textContent,font:getComputedStyle(v).fontSize,contained:inside(rect(l),rect(m))&&inside(rect(v),rect(m))};})}));
  return{width:innerWidth,count:state.players.length,round:state.currentRound,score:JSON.stringify(state.score),players:JSON.stringify(state.players),history:JSON.stringify(state.history),wins:[...state.match.wins],headers,cells,averages,currentHeight:rect(badges[li]).height,pitch:rect(badges[li-1]).y-rect(badges[li-2]).y,legend:[...window.__sc070Legend.values()],packet:JSON.parse(window.__sc070Packet),canvasWidth:document.getElementById('v2InfoDmd').parentElement.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth};
});}
function fit(r,numeric=false){
  assert.equal(r.count,5);assert(!r.overflow);assert(r.headers.every(h=>h.rect.height===98&&h.totalContained&&h.winsContained&&h.text===String(h.truth)),'Full totals/wins must fit');
  assert(r.headers.every((h,i)=>h.wins.filter(d=>d.on).length===r.wins[i]&&h.wins.every(d=>Math.abs(d.rect.width-d.rect.height)<.25)),'Game-win states/circles changed');
  assert.equal(r.currentHeight,68);assert.equal(r.pitch,r.width===430?31:30.1875);
  assert(r.averages.every(a=>a.height===48&&a.metrics.every(m=>m.contained&&m.font==='12px')),'GAV/MAV values must fit');
  assert(r.cells.every(c=>c.dots.every(d=>d.contained)),'Darts leave player cell');
  assert(r.legend.length>=5&&r.legend.every(l=>l.x>=26&&l.end<=r.canvasWidth-12+.25&&!l.compressed),'Whole natural-width keys must fit');
  assert(new Set(r.legend.map(l=>l.y)).size<=3,'Legend exceeds approved three rows');
  assert.deepEqual(r.packet.series.map(s=>s.name),JSON.parse(r.players).map(p=>p.name),'Names changed');
  assert.deepEqual(r.packet.series.map(s=>s.color),JSON.parse(r.players).map(p=>p.color),'Race identity colours changed');
  const board=JSON.parse(r.score);
  r.headers.forEach((h,i)=>{const darts=board[i].flatMap(e=>e.darts.filter(Boolean)),sum=darts.reduce((n,d)=>n+Number(d.points||0),0),avg=Math.round(sum*30/darts.length)/10;assert.equal(h.truth,sum,'Full total differs from canonical darts');assert.equal(r.cells[i].total,String(board[i][r.round].roundTotal),'Round total differs from canonical darts');r.averages[i].metrics.forEach(m=>assert.equal(Number(m.value),avg,'GAV/MAV changed'));if(r.packet.classicThrowRace||r.packet.turboThrowRace)assert.equal(r.packet.series[i].throwData.at(-1),sum,'Race cumulative data changed');});
  if(numeric)assert(r.cells.every(c=>c.totalContained&&c.noDotOverlap&&c.totalAboveDots&&c.dots.every(d=>d.textContained&&d.font==='9px')),'Full numerical tokens must fit without overlap');
}
async function read(page,key,numeric=false){
  await observer(page);const before=await page.evaluate(()=>JSON.stringify({score:state.score,players:state.players,history:state.history,wins:state.match.wins}));const r=await measure(page);fit(r,numeric);await frames(page);
  assert.equal(await page.evaluate(()=>JSON.stringify({score:state.score,players:state.players,history:state.history,wins:state.match.wins})),before,'Presentation mutated canonical state');
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,key+'.png')});fs.writeFileSync(path.join(shots,key+'.json'),JSON.stringify(r,null,2));}
  console.log('PASS '+key);cases++;return r;
}
(async()=>{
  const{browser,ctx,page,consoleErrs}=await H.launch({width:390,height:844});page.__sc070ConsoleErrors=consoleErrs;
  try{
    await ctx.route('**.supabase.co/rest/v1/**',r=>{const method=r.request().method(),headers={'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'*/0'};if(method==='GET')return r.fulfill({status:200,headers,contentType:'application/json',body:'[]'});if(method==='HEAD')return r.fulfill({status:200,headers,body:''});if(method==='OPTIONS')return r.fulfill({status:204,headers:{...headers,'access-control-allow-methods':'GET,HEAD,OPTIONS','access-control-allow-headers':r.request().headers()['access-control-request-headers']||'apikey,authorization,content-type,x-client-info'},body:''});return r.abort('failed');});
    await H.boot(page,{settle:800});
    if(inPart('identity')){
    for(const mode of ['match','turbo'])for(const width of widths)for(const long of [false,true]){
      await page.setViewportSize({width,height:844});await seed(page,5,mode);await advance(page,mode==='turbo'?9:8);await identity(page,long,true,mode==='match'&&long);
      await page.evaluate(()=>{for(const kind of ['S','D','T','Miss','S','D','T','Miss','S','T','D','Miss','S'])recordThrow({kind,number:ROUNDS[state.currentRound].target});});await settled(page,mode==='turbo'?9:8);
      const r=await read(page,mode+'-'+width+'-'+(long?'long':'ordinary'));if(mode==='match')assert.equal(r.headers[0].truth,1080,'Actual canonical1080 fixture changed');
    }
    }
    if(inPart('numerical')){
    for(const mode of ['match','turbo','practice','tournament'])for(const round of [11,12,13])for(const width of widths){
      if(qaPart.startsWith('numeric-')&&qaPart!==numericRoundParts[round])continue;
      await page.setViewportSize({width,height:844});await seed(page,5,mode);await advance(page,round);await identity(page,true,true);
      await page.evaluate(r=>{[20,10,17,0,20,10,17,0,20,17,10,0,20,10].forEach((v,i)=>recordThrow(!v?{kind:'Miss'}:r===13?{kind:'B',bull:i%2?'Outer':'Inner'}:{kind:r===11?'D':'T',sector:v}));},round);await settled(page,round);
      const r=await read(page,mode+'-numeric-'+round+'-'+width,true),tokens=r.cells.flatMap(c=>c.dots.map(d=>d.text));for(const token of round===11?['D20','D10','D17','X']:round===12?['T20','T10','T17','X']:['50','25','X'])assert(tokens.includes(token),'Real canonical token missing: '+token);
    }
    }
    if(inPart('records')){
    for(const width of widths){
      await page.setViewportSize({width,height:844});await seed(page);await advance(page,13);await identity(page,true,true);await page.evaluate(()=>{for(let i=0;i<14;i++)recordThrow({kind:'B',bull:'Inner'});});await settled(page,13);
      const r=await read(page,'canonical-1935-'+width,true);assert.equal(r.headers[0].truth,1935,'Canonical maximum must be fully visible');
    }
    await page.evaluate(()=>{window.__sc070ReferenceNative=__sqBuildRaceReferenceSeriesForCurrentMode;__sqBuildRaceReferenceSeriesForCurrentMode=async()=>{let sum=0;return{label:'High Score',color:'rgba(255,214,110,.9)',data:Array.from({length:14},(_,r)=>{sum+=r<11?(10+r)*9:r===11?120:r===12?180:150;return sum;})};};});
    for(const width of widths){
      await page.setViewportSize({width,height:844});await seed(page);await advance(page,8);await identity(page,true);const r=await read(page,'high-score-'+width);const hs=r.legend.find(l=>l.text==='High Score');assert(hs&&hs.end+23<=r.canvasWidth-12,'High Score label and gold dash must fit');assert.equal(r.packet.record.data.at(-1),1935,'Reference values changed');
    }
    await page.evaluate(()=>__sqBuildRaceReferenceSeriesForCurrentMode=window.__sc070ReferenceNative);
    for(const count of [1,2,3,4,6])for(const width of count===1||count===6?[320,390]:[390]){
      await page.setViewportSize({width,height:844});await seed(page,count===6?5:count,count===1?'practice':'match');await advance(page,8);
      if(count===6){await page.evaluate(()=>{state.players.push({id:'sc070-historic-6',name:'HISTORIC SIX',initials:'H6',color:'#abcdef'});state.score.push(JSON.parse(JSON.stringify(state.score[0])));state.match.wins.push(0);ensureMatchAgg();updateUI();});await settled(page,8);}
      await identity(page,true);await observer(page);const r=await measure(page);assert.equal(r.count,count);assert(r.headers.every(h=>h.digits===undefined),'Other count gained total fitting marker');assert(r.legend.every(l=>l.y===3),'Other count gained wrapped legend');assert.equal(await page.locator('#liveV2Panel').getAttribute('data-pcount'),String(count));if(count===1||count===6)assert.equal(await page.locator('.v2RowsWrap').evaluate(e=>getComputedStyle(e).maxHeight),width===320?'206px':count===1?'230px':'175px');console.log('PASS protected-count-'+count+'-'+width);cases++;
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:844});await seed(page);await advance(page,12);await identity(page,true,true);await read(page,'reduced-motion-triplets',true);assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0);
    }
    assert.equal(cases,expectedCases[qaPart],'Complete focused group coverage changed');
    assert.deepEqual(consoleErrs.filter(e=>e.startsWith('pageerror:')),[],'Unexpected page errors');console.log('SC070 five-player fit PASS '+cases+' cases ('+qaPart+', '+(Date.now()-qaStarted)+'ms); production writes blocked');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
