// Actual scorer -> embedded TV -> spectator, with isolated offline transport.
// Observe native CSS motion/canvas output; never replace the scorer or animator.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');
const app=new URL(H.APP_URL);
assert(['localhost','127.0.0.1','[::1]'].includes(app.hostname),'Use a local source/dist server');
const people=[
  {name:'Archi Skinner',first_name:'Archi',last_name:'Skinner',nickname:'The Nasher'},
  {name:'Élodie O’Neill',first_name:'Élodie',last_name:'O’Neill',nickname:'Double "20"'},
  {name:'Jean-Luc García',first_name:'Jean-Luc',last_name:'García',nickname:'Dart 007'},
  {name:'Alexandria Worthington',first_name:'Alexandria',last_name:'Worthington',nickname:'The "Long Shot" 9'},
  {name:'Alex 2',first_name:'Alex',last_name:'2',nickname:''},
].map((p,i)=>({...p,id:String(i+1).repeat(8)+'-'+String(i+1).repeat(4)+'-4'+String(i+1).repeat(3)+'-8'+String(i+1).repeat(3)+'-'+String(i+1).repeat(12),initials:'P'+(i+1)}));
const identities=[
  {name:'Archi Skinner',shortName:'Archi S',nickname:'The Nasher'},
  {name:'Élodie O’Neill',shortName:'Élodie O',nickname:'Double "20"'},
  {name:'Jean-Luc García',shortName:'Jean-Luc G',nickname:'Dart 007'},
  {name:'Alexandria Worthington',shortName:'Alexandria W',nickname:'The "Long Shot" 9'},
  {name:'Alex 2',shortName:'Alex 2',nickname:''},
];
const current='.name-slot > .thrower-identity:not(.departing-name)';
const out=process.env.SQ_SCREENSHOTS||path.join(__dirname,'../../qa-artifacts/tv-identity');
const receipt={browser:process.env.SQ_BROWSER||'chromium',url:H.APP_URL,initialization:[],geometry:[],motion:[],race:[],lifecycle:[]};
fs.mkdirSync(out,{recursive:true});

async function observeDisplay(display){
  await display.evaluate(()=>{
    const q=window.__tvIdentityQa;
    if(!q)throw new Error('Native TV recorder missing in '+location.href);
    if(!q.initialization.beforeTvScript)throw new Error('Native TV recorder was installed after TV runtime initialization');
    if(q.installed)return;
    q.installed=true;q.captures={};q.targets=new WeakMap();
    const describe=element=>{
      const style=getComputedStyle(element);
      const slot=element.closest('.name-slot').getBoundingClientRect();
      const title=element.querySelector('h2'),nickname=element.querySelector('.nickname');
      const content=[title.querySelector('canvas')||title,...(nickname?[nickname]:[])].map(el=>el.getBoundingClientRect());
      return {name:element.querySelector('h2')?.textContent,nickname:element.querySelector('.nickname')?.textContent||'',
        generic:element.classList.contains('thrower-identity'),x:new DOMMatrixReadOnly(style.transform).m41,
        width:element.getBoundingClientRect().width,opacity:Number(style.opacity),
        verticalFits:content.every(r=>r.y>=slot.y-1&&r.bottom<=slot.bottom+1)};
    };
    document.addEventListener('animationend',event=>{
      const owner=q.targets.get(event.target);
      if(owner&&['name-arrive','name-depart'].includes(event.animationName)){
        owner.ends.push({animation:event.animationName,...describe(event.target)});
      }
    },true);
    const original=window.showTvFrame;
    document.addEventListener('animationstart',event=>{
      const capture=q.targets.get(event.target);
      if(event.animationName!=='name-arrive'||capture?.label!=='visit finished'||capture.refresh)return;
      // Exercise two incoming display-only record/timer frames during a real
      // native handover. Do not seek, pause, finish or replace its animations.
      capture.refresh={started:true};
      const saved=state,slot=document.querySelector('.name-slot'),incoming=slot.querySelector('.arriving-name');
      const phases=()=>slot.getAnimations({subtree:true}).filter(a=>['name-arrive','name-depart'].includes(a.animationName)).map(a=>({name:a.animationName,start:a.startTime,time:a.currentTime}));
      const before=phases(),records={...saved.records,world:[...saved.records.world]};records.world[0]=90;
      original.call(window,{...saved,records,returnSeconds:19});
      original.call(window,{...saved,records,returnSeconds:18});
      original.call(window,saved);
      capture.refresh={sameSlot:document.querySelector('.name-slot')===slot,sameIncoming:slot.querySelector('.arriving-name')===incoming,before,after:phases()};
    },true);
    window.showTvFrame=function(next){
      const result=Reflect.apply(original,this,arguments);
      if(q.arm&&next.identities?.[next.thrower]?.name===q.arm.to){
        const slot=document.querySelector('.name-slot');
        const incoming=slot?.querySelector('.thrower-identity:not(.departing-name)');
        const outgoing=slot?.querySelector('.departing-name');
        const capture={label:q.arm.label,incoming:incoming&&describe(incoming),outgoing:outgoing&&describe(outgoing),
          native:slot?.getAnimations({subtree:true}).filter(a=>['name-arrive','name-depart'].includes(a.animationName)).map(a=>({
            name:a.animationName,generic:a.effect.target.classList.contains('thrower-identity'),
            duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay,playState:a.playState
          }))||[],ends:[]};
        q.captures[q.arm.label]=capture;
        if(incoming)q.targets.set(incoming,capture);
        if(outgoing)q.targets.set(outgoing,capture);
        q.arm=null;
      }
      return result;
    };
  });
}
async function identity(display,index){
  await display.waitForFunction(expected=>document.querySelector('.name-slot > .thrower-identity:not(.departing-name) h2')?.textContent===expected,identities[index].name,{polling:100});
  const actual=await display.evaluate(()=>{
    const node=document.querySelector('.name-slot > .thrower-identity:not(.departing-name)');
    return {identities:state.identities,name:node.querySelector('h2').textContent,nickname:node.querySelector('.nickname')?.textContent||'',
      nicknames:node.querySelectorAll('.nickname').length,sub:document.querySelector('.centre-head .sub')?.textContent,
      round:[...document.querySelectorAll('.round-table .name')].map(el=>el.textContent),
      standings:[...document.querySelectorAll('.standings tr[data-player]')].sort((a,b)=>Number(a.dataset.player)-Number(b.dataset.player)).map(el=>el.querySelector('.name').textContent)};
  });
  assert.deepEqual(actual.identities,identities,'Display identity contract');
  assert.equal(actual.name,identities[index].name);
  assert.equal(actual.nickname,identities[index].nickname);
  assert.equal(actual.nicknames,identities[index].nickname?1:0,'No invented or duplicated nickname');
  assert.equal(actual.sub.toUpperCase(),'TO THROW');
  assert.deepEqual(actual.round,identities.map(p=>p.shortName),'Compact round-table identities');
  assert.deepEqual(actual.standings,identities.map(p=>p.shortName),'Compact standings identities');
  return actual;
}
async function settled(display){
  await display.waitForFunction(()=>!document.querySelector('.departing-name')&&
    !document.querySelector('.name-slot')?.getAnimations({subtree:true}).some(a=>['name-arrive','name-depart'].includes(a.animationName)&&a.playState==='running'),null,{polling:100});
}
async function geometry(display){
  await settled(display);
  await display.evaluate(()=>document.fonts.ready);
  return display.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const inside=(a,b)=>a.x>=b.x-1&&a.right<=b.right+1&&a.y>=b.y-1&&a.bottom<=b.bottom+1;
    const node=document.querySelector('.name-slot > .thrower-identity:not(.departing-name)');
    const head=document.querySelector('.centre-head'),slot=document.querySelector('.name-slot'),title=node.querySelector('h2'),nickname=node.querySelector('.nickname'),sub=head.querySelector('.sub');
    const textBox=el=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};};
    const labels=[...document.querySelectorAll('.round-table .name,.standings .name'),title,...(nickname?[nickname]:[])].map(el=>{
      const canvas=el.querySelector('canvas');
      return {text:el.textContent,scroll:el.scrollWidth,client:el.clientWidth,
        fits:el.scrollWidth<=el.clientWidth+1&&inside(canvas?rect(canvas):textBox(el),rect(el.closest('th')||node))};
    });
    return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
      header:rect(head),identity:rect(node),slot:rect(slot),title:rect(title),nickname:nickname&&rect(nickname),sub:rect(sub),
      titleFont:parseFloat(getComputedStyle(title).fontSize),nicknameFont:nickname&&parseFloat(getComputedStyle(nickname).fontSize),
      headerContained:inside(rect(node),rect(head))&&inside(rect(sub),rect(head)),labels};
  });
}
async function pulse(display,label){
  await display.waitForFunction(()=>window.__tvIdentityQa.pending.size===0,null,{polling:100});
  const result=await display.evaluate(async()=>{
    const q=window.__tvIdentityQa,canvas=document.getElementById('raceActive'),base=document.getElementById('race');
    const before={raf:q.rafCalls,draws:q.draws,base:base.toDataURL(),overlay:canvas.toDataURL()};
    const samples=[];
    for(let i=0;i<6;i++){samples.push(Number(getComputedStyle(canvas).opacity));await new Promise(r=>setTimeout(r,100));}
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let coloured=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>20&&(pixels[i]!==pixels[i+1]||pixels[i+1]!==pixels[i+2]))coloured++;
    const colour=i=>document.querySelector('.standings tr[data-player="'+i+'"] .position').style.getPropertyValue('--trace').trim();
    const lastStroke=colour=>q.strokes.findLast(s=>s.canvas==='race'&&s.colour===colour);
    return {active:canvas.dataset.player,coloured,samples,pulses:canvas.getAnimations().filter(a=>a.animationName==='race-active-pulse').map(a=>({state:a.playState,iterations:a.effect.getTiming().iterations===Infinity?'infinite':a.effect.getTiming().iterations})),
      leader:document.querySelector('.standings tr.leading')?.dataset.player,activeStyle:lastStroke(colour(1)),leaderStyle:lastStroke(colour(0)),inactiveStyle:lastStroke(colour(2)),
      stableBase:base.toDataURL()===before.base,stableOverlay:canvas.toDataURL()===before.overlay,extraRaf:q.rafCalls-before.raf,extraDraws:q.draws-before.draws,pending:q.pending.size};
  });
  receipt.race.push({label,...result});
  assert.equal(result.active,'1');assert.equal(result.leader,'0');
  assert(result.coloured>0,'Active trace contains rendered coloured pixels');
  assert.equal(result.pulses.length,1,'Exactly one active trace pulse');
  assert.equal(result.pulses[0].state,'running');assert.equal(result.pulses[0].iterations,'infinite');
  assert(Math.max(...result.samples)-Math.min(...result.samples)>.02,'Native opacity changes over time');
  assert(result.activeStyle&&result.leaderStyle&&result.inactiveStyle,'Actual base traces were painted');
  assert(result.activeStyle.width>result.leaderStyle.width&&result.leaderStyle.width>result.inactiveStyle.width,'Active trace and static leader remain distinct');
  assert(result.stableBase&&result.stableOverlay,'Pulse must not repeatedly redraw either canvas');
  assert.equal(result.extraDraws,0);assert.equal(result.extraRaf,0);assert.equal(result.pending,0);
}

(async()=>{
  const {browser,ctx,page,consoleErrs}=await H.launch({width:1440,height:810},{emptyCloudReads:true});
  let watcher,view;const blockedWrites=[];
  try{
    await ctx.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url()),method=request.method();
      if(url.hostname.endsWith('.supabase.co')){
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':request.headers()['access-control-request-headers']||'*','access-control-allow-methods':'GET, HEAD, OPTIONS, POST'};
        if(url.pathname==='/rest/v1/rpc/sq_rank_score'&&['POST','OPTIONS'].includes(method))return route.fulfill({status:method==='OPTIONS'?204:200,headers,contentType:'application/json',body:method==='OPTIONS'?'':'[]'});
        if(!['GET','HEAD','OPTIONS'].includes(method)){blockedWrites.push(method+' '+url.pathname);return route.abort('failed');}
        if(url.pathname==='/rest/v1/players')return route.fulfill({status:method==='OPTIONS'?204:200,headers,contentType:'application/json',body:method==='GET'?JSON.stringify(people):''});
        return route.fallback();
      }
      if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase'))return route.fallback();
      if(url.origin===app.origin&&['GET','HEAD','OPTIONS'].includes(method))return route.fallback();
      return route.abort('failed');
    });
    await ctx.routeWebSocket('**/*',socket=>socket.close());
    await ctx.addInitScript(()=>{
      // Child documents can be initialized before their final URL is available.
      // Install once in every new document, before application scripts; only the
      // two TV documents are read below. Never create/reset counters afterwards.
      if(window.__tvIdentityQa)return;
      const q=window.__tvIdentityQa={pending:new Set(),rafCalls:0,draws:0,strokes:[],
        initialization:{url:location.href,readyState:document.readyState,beforeTvScript:typeof window.showTvFrame==='undefined'}};
      const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
      window.requestAnimationFrame=function(callback){let id;id=Reflect.apply(request,this,[function(){q.pending.delete(id);q.rafCalls++;return Reflect.apply(callback,this,arguments);}]);q.pending.add(id);return id;};
      window.cancelAnimationFrame=function(id){q.pending.delete(id);return Reflect.apply(cancel,this,arguments);};
      const stroke=CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke=function(){
        if(['race','raceActive'].includes(this.canvas.id)){
          q.draws++;q.strokes.push({canvas:this.canvas.id,colour:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha});
          if(q.strokes.length>200)q.strokes.shift();
        }
        return Reflect.apply(stroke,this,arguments);
      };
    });
    await H.boot(page,{settle:800});
    await page.evaluate(async players=>{
      state.players=players.map(p=>({...p}));assignUniqueColors(state.players);
      setSavedPlayers(state.players.map(p=>({...p,_src:'cloud-cache'})));
      Object.assign(state.match,{mode:'official',gameFormat:'match_play',gameVariant:'classic',targetWins:3});
      await startNewGame(true);
    },people);
    await page.waitForFunction(()=>document.body.dataset.page==='game'&&!state.__sqSecurityPreparing&&!window.__sqSecurityInputBlocked&&window.SQ_GAMEPLAY.canThrow()&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true',null,{polling:100});
    assert.equal(await page.evaluate(()=>state.__sqGameControl.mode),'official');
    const playerTruth=await page.evaluate(()=>JSON.stringify(state.players));
    const canonical=()=>page.evaluate(()=>JSON.stringify([state.players,state.score,state.history,state.currentRound,state.currentPlayer,state.currentDart]));
    await page.evaluate(()=>window.__sqTvModeToggle(true));
    await page.frameLocator('#sqTvModeOverlay iframe').locator('[data-dart="Single"]').waitFor();
    view=page.frames().find(frame=>new URL(frame.url()).pathname.endsWith('/assets/tv/arcade.html'));
    const opened=ctx.waitForEvent('page');await page.locator('#sqTvWatch').click();watcher=await opened;
    watcher.on('pageerror',e=>consoleErrs.push('pageerror: spectator '+String(e)));
    await watcher.locator('.running-total').first().waitFor();
    assert.equal(await watcher.locator('.scorepad').count(),0);
    await Promise.all([observeDisplay(view),observeDisplay(watcher),view.evaluate(()=>document.fonts.ready),watcher.evaluate(()=>document.fonts.ready)]);
    for(const [index,display] of [view,watcher].entries()){
      receipt.initialization.push({surface:index?'spectator':'scorer',...await display.evaluate(()=>window.__tvIdentityQa.initialization)});
    }
    await Promise.all([identity(view,0),identity(watcher,0)]);
    const displays=()=>[view,watcher];
    const arm=async(label,to)=>Promise.all(displays().map(display=>display.evaluate(({label,to})=>window.__tvIdentityQa.arm={label,to},{label,to:identities[to].name})));
    const forward=async(label,selector,from,to)=>{
      await arm(label,to);
      if(typeof selector==='function')await selector();else await view.locator(selector).click();
      for(const [index,display] of displays().entries()){
        await display.waitForFunction(label=>window.__tvIdentityQa.captures[label]?.ends.length===2,label,{polling:100});
        const result=await display.evaluate(label=>window.__tvIdentityQa.captures[label],label);
        receipt.motion.push({surface:index?'spectator':'scorer',...result});
        assert.equal(result.outgoing.name,identities[from].name);assert.equal(result.incoming.name,identities[to].name);
        assert.equal(result.outgoing.nickname,identities[from].nickname);assert.equal(result.incoming.nickname,identities[to].nickname);
        assert(result.outgoing.generic&&result.incoming.generic&&result.native.length===2&&result.native.every(a=>a.generic),'Animate the complete generic identity');
        assert(result.outgoing.verticalFits&&result.incoming.verticalFits,'Both identities fit vertically during the handover');
        assert(result.incoming.x>result.incoming.width/2,'New identity enters from the right');
        assert(result.ends.find(e=>e.animation==='name-depart').x<-result.outgoing.width/2,'Old identity leaves to the left');
        assert(Math.abs(result.ends.find(e=>e.animation==='name-arrive').x)<1,'Incoming identity settles centrally');
        if(label==='visit finished'){
          const refresh=result.refresh;
          assert(refresh?.sameSlot&&refresh.sameIncoming&&refresh.before.length,'In-flight refresh retained the native identity');
          for(const before of refresh.before){
            const after=refresh.after.find(a=>a.name===before.name);
            assert(after,'In-flight refresh removed a handover animation');
            if(before.start!==null)assert(Math.abs(after.start-before.start)<1,'Refresh restarted the native animation phase');
            else assert(after.time>=before.time,'Refresh rewound pending native motion');
          }
        }
        await identity(display,to);
      }
    };
    await view.locator('[data-dart="Double"]').click();await view.locator('[data-dart="Single"]').click();
    await forward('visit finished','[data-dart="Treble"]',0,1);
    await forward('Skip Go','[data-action="skip"]',1,2);
    assert.equal(await page.evaluate(()=>state.history.at(-1)?.type),'absenceSkip');
    await arm('Undo',1);await view.locator('[data-action="undo"]').click();
    for(const display of displays()){
      await identity(display,1);
      const undo=await display.evaluate(()=>window.__tvIdentityQa.captures.Undo);
      receipt.motion.push({label:'Undo',...undo});
      assert.equal(undo.native.length,0,'Undo restores truth without a completed-go animation');
      assert.equal(undo.outgoing,null);assert(Math.abs(undo.incoming.x)<1);
    }
    assert.equal(await page.evaluate(()=>state.history.length),3);
    await view.locator('[data-dart="Single"]').click();
    await watcher.waitForFunction(()=>state.historyLength===4,null,{polling:100});
    // Allow only the existing finite score-growth animation to complete.
    await page.waitForTimeout(800);
    const beforePulse=await canonical();
    await pulse(view,'scorer');await pulse(watcher,'spectator');
    assert.equal(await canonical(),beforePulse,'Race presentation changed the canonical board');
    for(const display of displays()){
      const refresh=await display.evaluate(()=>{
        const original=state,slot=document.querySelector('.name-slot'),node=slot.querySelector('.thrower-identity');
        const records={...original.records,world:[...original.records.world]};records.world[0]=90;
        window.showTvFrame({...original,records,returnSeconds:19});
        const recordSame=document.querySelector('.name-slot')===slot&&slot.querySelector('.thrower-identity')===node;
        window.showTvFrame({...original,records,returnSeconds:18});
        const timerSame=document.querySelector('.name-slot')===slot&&slot.querySelector('.thrower-identity')===node;
        window.showTvFrame(original);
        return {recordSame,timerSame,handovers:document.querySelectorAll('.departing-name').length};
      });
      assert(refresh.recordSame&&refresh.timerSame&&refresh.handovers===0,'Same-player record/timer frames retain identity without replay');
    }
    assert.equal(await canonical(),beforePulse,'Display-only refresh changed canonical state');
    await page.evaluate(()=>{recordThrow({kind:'Miss'});recordThrow({kind:'Miss'});});
    await Promise.all(displays().map(display=>identity(display,2)));
    await page.evaluate(()=>{for(let i=0;i<3;i++)recordThrow({kind:'Miss'});});
    await Promise.all(displays().map(display=>identity(display,3)));
    const beforeLayout=await canonical();
    for(const size of [{width:320,height:844},{width:390,height:844},{width:430,height:844},{width:1440,height:810},{width:1920,height:1080}]){
      await page.setViewportSize(size);await watcher.setViewportSize(size);
      for(const [index,display] of displays().entries()){
        const measurement=await geometry(display);
        receipt.geometry.push({surface:index?'spectator':'scorer',...measurement});
        assert(measurement.scrollWidth<=measurement.width,'Horizontal viewport overflow');
        if(size.width>size.height)assert(measurement.scrollHeight<=measurement.height+1,'Landscape vertical overflow');
        assert(measurement.headerContained&&measurement.labels.every(l=>l.fits),'Full identities must fit without clipping');
        assert(measurement.nicknameFont<measurement.titleFont,'Nickname is secondary');
        assert(measurement.title.bottom<=measurement.nickname.y+1&&measurement.nickname.bottom<=measurement.sub.y+1,'Name, nickname, TO THROW order');
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Scorer overlay/nav horizontal overflow');
      await page.screenshot({path:path.join(out,'scorer-'+size.width+'x'+size.height+'.png')});
      await watcher.screenshot({path:path.join(out,'spectator-'+size.width+'x'+size.height+'.png'),fullPage:true});
    }
    assert.equal(await canonical(),beforeLayout,'Viewport changes mutated game state');
    await view.locator('[data-dart="Miss"]').click();await view.locator('[data-dart="Miss"]').click();
    await forward('nickname omitted','[data-dart="Miss"]',3,4);
    // Two real completed/skip transitions in one task: the final departure must
    // belong to the most recent player, not the older still-animating identity.
    await forward('rapid supersession',()=>view.evaluate(()=>{
      for(let i=0;i<3;i++)document.querySelector('[data-dart="Miss"]').click();
      document.querySelector('[data-action="skip"]').click();
    }),0,1);
    await view.locator('[data-action="undo"]').click();
    await Promise.all(displays().map(display=>identity(display,0)));
    await page.emulateMedia({reducedMotion:'reduce'});await watcher.emulateMedia({reducedMotion:'reduce'});
    for(const display of displays())await display.waitForFunction(()=>document.querySelector('#screen').dataset.motion==='off',null,{polling:100});
    await arm('reduced motion visit',1);
    await view.evaluate(()=>{for(let i=0;i<3;i++)document.querySelector('[data-dart="Miss"]').click();});
    for(const display of displays()){
      await identity(display,1);
      const staticState=await display.evaluate(()=>({capture:window.__tvIdentityQa.captures['reduced motion visit'],pulse:document.getElementById('raceActive').getAnimations().length,display:getComputedStyle(document.getElementById('raceActive')).display}));
      receipt.lifecycle.push({label:'reduced motion',...staticState});
      assert.equal(staticState.capture.native.length,0);assert.equal(staticState.capture.outgoing,null);
      assert.equal(staticState.pulse,0);assert.equal(staticState.display,'none');
    }
    await page.emulateMedia({reducedMotion:'no-preference'});await watcher.emulateMedia({reducedMotion:'no-preference'});
    const beforeClose=await page.evaluate(()=>{
      const doc=document.querySelector('#sqTvModeOverlay iframe').contentDocument;
      for(let i=0;i<3;i++)doc.querySelector('[data-dart="Miss"]').click();
      const board=JSON.stringify([state.players,state.score,state.history,state.currentRound,state.currentPlayer,state.currentDart]);
      document.getElementById('sqTvExit').click();
      return board;
    });
    await watcher.getByText('Waiting for the scorer to reopen TV mode').waitFor();
    const closed=await watcher.evaluate(()=>({hidden:document.getElementById('screen').hidden,pending:window.__tvIdentityQa.pending.size,pulses:document.getElementById('raceActive').getAnimations().length}));
    receipt.lifecycle.push({label:'closed during handover',...closed});assert(closed.hidden);assert.equal(closed.pending,0);assert.equal(closed.pulses,0);
    assert.equal(await canonical(),beforeClose,'Closing TV changed the board');
    await page.evaluate(()=>window.__sqTvModeToggle(true));
    await page.frameLocator('#sqTvModeOverlay iframe').locator('[data-dart="Single"]').waitFor();
    view=page.frames().find(frame=>new URL(frame.url()).pathname.endsWith('/assets/tv/arcade.html'));
    await watcher.waitForFunction(()=>!document.getElementById('screen').hidden&&state?.thrower===2,null,{polling:100});
    await Promise.all([identity(view,2),identity(watcher,2)]);
    assert.equal(await watcher.locator('#raceActive[data-player="2"]').count(),1,'Spectator resumes the same active player once');
    const reopened=await watcher.evaluate(()=>({departing:document.querySelectorAll('.departing-name').length,
      handovers:document.querySelector('.name-slot').getAnimations({subtree:true}).filter(a=>['name-arrive','name-depart'].includes(a.animationName)).length}));
    receipt.lifecycle.push({label:'reopened static',...reopened});assert.equal(reopened.departing,0);assert.equal(reopened.handovers,0);
    await page.evaluate(()=>{for(let i=0;i<230&&!state.finished;i++)recordThrow({kind:'Miss'});if(!state.finished)throw new Error('Fixture did not finish');});
    await watcher.getByRole('heading',{name:'Game winner',exact:true}).waitFor();
    await watcher.waitForFunction(()=>window.__tvIdentityQa.pending.size===0,null,{polling:100});
    const finished=await watcher.evaluate(()=>({active:document.querySelector('#raceActive').dataset.player||null,pulses:document.querySelector('#raceActive').getAnimations().length,pending:window.__tvIdentityQa.pending.size}));
    receipt.lifecycle.push({label:'finished',...finished});assert.equal(finished.active,null);assert.equal(finished.pulses,0);assert.equal(finished.pending,0);
    assert.deepEqual(await page.evaluate(()=>[state.history.length,state.__sqGameControl.mode]),[210,'official']);
    assert.equal(await page.evaluate(()=>JSON.stringify(state.players)),playerTruth,'TV changed canonical player identities');
    assert.deepEqual(blockedWrites,[],'Unexpected attempted production mutations');
    assert.deepEqual(consoleErrs.filter(e=>e.startsWith('pageerror:')),[],'Unexpected page errors');
    receipt.status='PASS';
    console.log('PASS TV full/compact identities, nicknames, five viewports, native visit/Skip handovers, static Undo/reduced motion, race pulse without redraw, spectator and completion');
  }catch(error){
    receipt.status='FAIL';receipt.error=String(error);
    await page.screenshot({path:path.join(out,'failure-scorer.png')}).catch(()=>{});
    if(watcher)await watcher.screenshot({path:path.join(out,'failure-spectator.png'),fullPage:true}).catch(()=>{});
    throw error;
  }finally{
    receipt.blockedWrites=blockedWrites;
    fs.writeFileSync(path.join(out,'identity-motion-receipt.json'),JSON.stringify(receipt,null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
