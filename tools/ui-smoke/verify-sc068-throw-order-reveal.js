const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');

async function fixture(ctx){
  // Empty read fixtures keep unrelated record warming offline. No mutation
  // method reaches Supabase, and the sequence never receives invented records.
  await ctx.route('**.supabase.co/rest/v1/**',r=>{
    const method=r.request().method();
    const url=new URL(r.request().url());
    const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS, POST','access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info, accept-profile'};
    if(method==='OPTIONS')return r.fulfill({status:204,headers,body:''});
    if(method==='GET')return r.fulfill({status:200,headers,contentType:'application/json',body:'[]'});
    if(method==='HEAD')return r.fulfill({status:200,headers:{...headers,'content-range':'*/0','access-control-expose-headers':'content-range'},body:''});
    // This exact POST is the existing read-only P/G rank RPC. Empty rows keep
    // rank unavailable; all write RPCs and table mutations remain blocked.
    if(method==='POST'&&url.pathname==='/rest/v1/rpc/sq_rank_score')return r.fulfill({status:200,headers,contentType:'application/json',body:'[]'});
    return r.abort('failed');
  });
  // The old DMD primes this audio URL on any setup tap. Use a valid silent PCM
  // fixture so an unrelated blocked media request cannot mask app console QA.
  const wav=Buffer.alloc(204);wav.write('RIFF',0);wav.writeUInt32LE(196,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(160,40);
  await ctx.route('https://www.101soundboards.com/sounds/23923970-voldemort-laugh',r=>r.fulfill({status:200,contentType:'audio/wav',body:wav,headers:{'access-control-allow-origin':'*'}}));
}
async function seed(page,count=2,kind='classic'){
  await page.evaluate(({count,kind})=>{
    if(window.__sqThrowOrderRevealPending)throw Error('Previous reveal leaked');
    document.querySelectorAll('.modal-backdrop').forEach(n=>n.remove());
    const token=Number(state.__gameToken||0);
    state=JSON.parse(JSON.stringify(baseState));state.__gameToken=token;
    const names=['ALEX','MIA','SAM','JO','LEE'],avatars=[17,21,3,10,9];
    state.players=Array.from({length:count},(_,i)=>({id:'00000000-0000-4000-8000-00000000000'+i,name:names[i],initials:names[i].slice(0,2),avatar_id:avatars[i],color:'#ff7a00'}));
    assignUniqueColors(state.players);
    const practice=kind.startsWith('practice')||kind==='training'||kind==='vsshadow';
    const turbo=kind.includes('turbo');
    state.match={id:'sc068-'+count+'-'+kind+'-'+token,gameNumber:1,targetWins:3,wins:Array(count).fill(0),history:[],mode:practice?'practice':turbo?'turbo':'match',gameFormat:'match_play',gameVariant:turbo?'turbo':'classic',forcePractice:practice,practiceType:practice?(kind==='training'||kind==='vsshadow'?kind:turbo?'turbo':'classic'):null};
    if(!practice)state.match.autoRotateOrder=true;
    state.gameFormat='match_play';state.gameVariant=turbo?'turbo':'classic';
    state.startTarget=turbo?'17':'10';state.strictTimer=turbo;state.throwLimitSeconds=turbo?20:null;
    window.__sqSelectedMode=practice?'practice':'match';window.__sqPracticeGameType=state.match.practiceType||'classic';
    window.__sqTurboPreStartArmed=false;window.__sqTurboPreStartReleased=true;window.__sqTurboPreStartShowing=false;
    show('players');showPlayerOrderDialog();
  },{count,kind});
  await page.waitForSelector('.modal-throworder:not(.modal-throworder-amend)');
}
async function read(page){return page.evaluate(()=>({token:Number(state.__gameToken||0),history:state.history.length,page:document.body.dataset.page,starts:window.__sqSc068Starts,pending:!!window.__sqThrowOrderRevealPending,players:state.players.map(p=>({id:p.id,name:__sqPlayerPretty(p),avatar:__sqAvatarIdForPlayer(p)})),timer:__sqTurboTimerStatus()}));}
async function confirm(page,repeated=false){
  return page.evaluate(repeated=>{
    window.__sqSc068Trace={start:performance.now(),beats:[],end:null};
    const observe=new MutationObserver(()=>{
      const stage=document.querySelector('.sq-throw-order-stage');
      if(stage&&!stage.__sqTestListening){stage.__sqTestListening=true;stage.addEventListener('animationstart',e=>{if(e.target.classList.contains('sq-throw-order-beat'))window.__sqSc068Trace.beats.push({label:e.target.textContent,at:performance.now()-window.__sqSc068Trace.start});});}
      if(!window.__sqThrowOrderRevealPending){window.__sqSc068Trace.end=performance.now()-window.__sqSc068Trace.start;observe.disconnect();}
    });
    observe.observe(document.body,{childList:true});
    const button=document.querySelector('.modal-throworder:not(.modal-throworder-amend) .to-start');
    button.click();if(repeated){button.click();button.onclick();}
    return {pending:!!window.__sqThrowOrderRevealPending,token:Number(state.__gameToken||0),at:performance.now()};
  },repeated);
}
async function playable(page){await page.waitForFunction(()=>!window.__sqThrowOrderRevealPending&&document.body.dataset.page==='game'&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');}
async function finish(page){await page.waitForFunction(()=>!window.__sqThrowOrderRevealPending);await playable(page);}
async function settledLineup(page,measureScroll=false){
  // Snapshot readiness and geometry in one browser turn. CSS begins at its
  // first painted frame; a later controller round trip may reach the 2200ms
  // handoff. The independent deadline and every final-bounds assertion remain.
  const handle=await page.waitForFunction(measureScroll=>{
    const stage=document.querySelector('.sq-throw-order-stage');
    if(!stage)return null;
    const beats=[...stage.querySelectorAll('.sq-throw-order-beat')];
    if(!beats.every(n=>{const a=n.getAnimations();return a.length===1&&a[0].playState==='finished';}))return null;
    const r=stage.getBoundingClientRect(),skip=stage.querySelector('.sq-throw-order-skip').getBoundingClientRect();
    const fighters=[...stage.querySelectorAll('.sq-throw-order-fighter')];
    const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
    const portraits=fighters.map(f=>rect(f.querySelector('.sq-throw-order-portrait').getBoundingClientRect()));
    const separators=[...stage.querySelectorAll('.sq-throw-order-vs')].map(v=>{const range=document.createRange();range.selectNodeContents(v);return rect(range.getBoundingClientRect());});
    const fit={left:r.left,right:r.right,bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,
      skip:{top:skip.top,bottom:skip.bottom,width:skip.width,height:skip.height},
      labels:fighters.map(f=>f.querySelector('.sq-throw-order-name').textContent),
      avatars:fighters.map(f=>Number(f.querySelector('.sq-throw-order-portrait').dataset.avatarId)),
      overlaps:separators.some(t=>portraits.some(p=>t.left<p.right&&t.right>p.left&&t.top<p.bottom&&t.bottom>p.top)),portraits,separators,
      animationStates:beats.map(n=>{const a=n.getAnimations()[0];return{name:n.textContent,state:a.playState,duration:a.effect.getComputedTiming().duration,transform:getComputedStyle(n).transform};}),
      settledAt:performance.now()-window.__sqSc068Trace.start,children:fighters.map(f=>[...f.children].map(n=>n.className)),vs:stage.querySelectorAll('.sq-throw-order-vs').length,format:stage.querySelector('.sq-throw-order-format').textContent};
    if(measureScroll){
      const button=stage.querySelector('.sq-throw-order-skip');
      stage.scrollTop=0;const first=button.getBoundingClientRect();stage.scrollTop=stage.scrollHeight;const last=button.getBoundingClientRect();
      fit.longFit={scroll:stage.scrollHeight>stage.clientHeight,first:{top:first.top,bottom:first.bottom,width:first.width,height:first.height},last:{top:last.top,bottom:last.bottom}};
    }
    return fit;
  },measureScroll);
  const fit=await handle.jsonValue();await handle.dispose();return fit;
}
async function shot(page,name){if(process.env.SQ_SCREENSHOTS){fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,name+'.png')});}}

(async()=>{
  const {browser,ctx,page,consoleErrs}=await H.launch({width:390,height:844});
  const evidence=[];
  const transport=[];const requestReceipt=new Map();
  page.on('request',request=>{const u=new URL(request.url());const item={at:Date.now(),method:request.method(),path:u.pathname,query:[...u.searchParams].filter(([key])=>!/token|key|credential/i.test(key))};transport.push(item);requestReceipt.set(request,item);});
  page.on('requestfinished',request=>{const item=requestReceipt.get(request);if(item)item.finished=Date.now();});
  page.on('requestfailed',request=>{const item=requestReceipt.get(request);if(item){item.failed=Date.now();item.error=request.failure()?.errorText;}});
  const reads=new Set();let readRevision=0;
  const isRead=request=>{
    const u=new URL(request.url());return u.host.endsWith('.supabase.co')&&
      (['GET','HEAD','OPTIONS'].includes(request.method())||(request.method()==='POST'&&u.pathname==='/rest/v1/rpc/sq_rank_score'));
  };
  page.on('request',request=>{if(isRead(request)){reads.add(request);readRevision++;}});
  page.on('requestfinished',request=>reads.delete(request));page.on('requestfailed',request=>reads.delete(request));
  const boot=async()=>{
    // A new document must not cancel the old document's in-flight read fixture.
    // Require an actual request-free animation frame; cached load-state events
    // can already have fired before later record warming starts.
    const deadline=Date.now()+8000;
    for(;;){
      const revision=readRevision;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
      if(reads.size===0&&readRevision===revision)break;
      assert(Date.now()<deadline,'Read fixtures did not drain before reload');
    }
    await H.boot(page,{settle:1000});
  };
  try{
    await fixture(ctx);
    // A controlled clock offset exercises the existing 20s cutoff without
    // replacing its formula, key, RAF cadence or canonical Miss implementation.
    await ctx.addInitScript(()=>{const real=performance.now.bind(performance);window.__sqSc068Offset=0;performance.now=()=>real()+window.__sqSc068Offset;});
    await boot();
    assert.equal(await page.evaluate(()=>typeof __sqRevealConfirmedThrowOrder),'function');
    await page.evaluate(()=>{window.__sqSc068Starts=0;const start=startNewGame;startNewGame=function(setOrder){if(setOrder)window.__sqSc068Starts++;return start.apply(this,arguments);};});

    // Complete the actual setup journey once; the mobile matrix below changes
    // only its roster fixture and exercises the same live confirmation owner.
    await H.toMatchCard(page);await H.addGuests(page,['Setup Alpha','Setup Beta']);
    await page.click('#startMatchBtn');await page.waitForSelector('#mlStartBtn');
    await page.evaluate(()=>document.querySelector('#mlGrid .mlw-seg[data-value="3"]').dispatchEvent(new MouseEvent('click',{bubbles:true})));
    await page.click('#mlStartBtn');await page.waitForSelector('.modal-throworder');
    const setupBefore=await read(page);await confirm(page,true);assert((await read(page)).pending);
    await page.locator('.sq-throw-order-skip').click();await playable(page);
    const setupAfter=await read(page);assert.deepEqual(setupAfter.players,setupBefore.players);assert.equal(setupAfter.starts,setupBefore.starts+1);assert.equal(setupAfter.history,0);

    // Real confirmation and ordering controls at every required player count
    // and mobile width. Only portrait/name are inside each ordered entrant.
    for(const width of [320,390,430])for(const count of [2,3,4,5]){
      await page.setViewportSize({width,height:844});await seed(page,count);
      await page.locator('.modal-throworder .to-row').first().locator('.to-arrow-btn').nth(1).click();
      const before=await read(page);const initial=await confirm(page,true);assert(initial.pending);assert.equal(initial.token,before.token);
      const fit=await settledLineup(page);
      assert(!fit.overflow&&fit.left>=0&&fit.right<=width&&fit.bottom<=844,'Reveal exceeds viewport: '+JSON.stringify(fit));
      assert(fit.skip.width>=44&&fit.skip.height>=44);
      assert(fit.settledAt<2200&&fit.animationStates.every(a=>a.state==='finished'&&a.duration===180),'Lineup did not settle before handoff: '+JSON.stringify(fit));
      if(fit.overlaps)await shot(page,'sc068-failed-overlap-'+width+'-'+count);
      assert(!fit.overlaps,'VS covers a portrait at '+width+'/'+count+': '+JSON.stringify(fit));
      assert.deepEqual(fit.labels,before.players.map(p=>p.name));assert.deepEqual(fit.avatars,before.players.map(p=>p.avatar));
      assert(fit.children.every(c=>c.length===2&&c[0]==='sq-throw-order-portrait'&&c[1]==='sq-throw-order-name'));
      assert.equal(fit.vs,count-1);assert.equal(fit.format,count>2?'FREE FOR ALL':'HEAD TO HEAD');
      if(count===5)await shot(page,'sc068-lineup-'+width);
      await finish(page);const after=await read(page);const trace=await page.evaluate(()=>window.__sqSc068Trace);
      assert.equal(after.token,before.token+1);assert.equal(after.starts,before.starts+1,'Repeated confirmation started twice');assert.equal(after.history,0);
      assert.deepEqual(after.players,before.players,'Start changed confirmed UUID/avatar/order');
      assert(trace.end>=2100&&trace.end<2400,'Introduction exceeded its 2.4s budget: '+JSON.stringify(trace));
      assert.deepEqual(trace.beats.map(b=>b.label),before.players.flatMap((p,i)=>i?['VS',p.name]:[p.name]),'Picture→VS beats changed');
      evidence.push({width,count,fit,trace});
    }
    await page.setViewportSize({width:320,height:568});await seed(page,5);await confirm(page);const short=(await settledLineup(page)).skip;
    assert(short.top>=0&&short.bottom<=568);await shot(page,'sc068-lineup-320-short');await finish(page);

    await seed(page,5);
    await page.evaluate(()=>{Object.assign(state.players[0],{name:'Alexandria Worthington-Smythe',first_name:'Alexandria',last_name:'Worthington-Smythe',nickname:'THE MIDNIGHT CHAMPION OF THE LONG ARCADE LINEUP'});});
    const longBefore=await read(page);await confirm(page);const longSnapshot=await settledLineup(page,true);
    assert.deepEqual(longSnapshot.labels,longBefore.players.map(p=>p.name),'Long saved identity was shortened');
    const longFit=longSnapshot.longFit;
    await shot(page,'sc068-long-saved-name-320-short');
    assert(longFit.first.top>=0&&longFit.first.bottom<=568&&longFit.last.top>=0&&longFit.last.bottom<=568,'Wrapped name hides Skip: '+JSON.stringify(longFit));
    assert(longFit.first.width>=44&&longFit.first.height>=44);evidence.push({longSavedName:longBefore.players[0],longFit});await finish(page);

    await seed(page,3);const skipBefore=await read(page);await confirm(page);await page.waitForTimeout(250);
    const skipAt=await page.evaluate(()=>{const at=performance.now();document.querySelector('.sq-throw-order-skip').click();document.querySelector('.sq-throw-order-skip')?.click();return {elapsed:performance.now()-at,pending:!!window.__sqThrowOrderRevealPending,starts:window.__sqSc068Starts};});
    assert(!skipAt.pending&&skipAt.elapsed<100);assert.equal(skipAt.starts,skipBefore.starts+1);await playable(page);
    await page.emulateMedia({reducedMotion:'reduce'});await seed(page,5);const reduced=await confirm(page);assert(!reduced.pending);assert.equal(await page.locator('.sq-throw-order-reveal').count(),0);await playable(page);await page.emulateMedia({reducedMotion:'no-preference'});
    // Force a real missing sprite in a fresh document, before it can be cached.
    let missingSpriteReads=0;
    await ctx.route('**/assets/avatars/avatar-sprite.webp',r=>{missingSpriteReads++;return r.fulfill({status:200,contentType:'image/webp',body:''});});
    await boot();await seed(page,2);const assetBefore=await read(page);await confirm(page);await finish(page);
    assert.equal((await read(page)).token,assetBefore.token+1);assert(missingSpriteReads>0,'Missing-artwork fixture was cached');await ctx.unroute('**/assets/avatars/avatar-sprite.webp');
    await page.evaluate(()=>{window.__sqSc068Starts=0;const start=startNewGame;startNewGame=function(setOrder){if(setOrder)window.__sqSc068Starts++;return start.apply(this,arguments);};});

    // Escape/removal/page navigation/pagehide and a replaced game token cannot
    // run a stale start callback. Cancellation leaves the existing game intact.
    for(const action of ['escape','removed','navigation','pagehide','stale']){
      await seed(page,2);const before=await read(page);await confirm(page);
      if(action==='escape')await page.keyboard.press('Escape');
      else await page.evaluate(action=>{if(action==='removed')document.querySelector('.sq-throw-order-reveal').remove();if(action==='navigation')show('details');if(action==='pagehide')window.dispatchEvent(new Event('pagehide'));if(action==='stale')state.__gameToken++;},action);
      await page.waitForFunction(()=>!window.__sqThrowOrderRevealPending);
      assert.equal(await page.locator('.sq-throw-order-reveal').count(),0);const after=await read(page);
      assert.equal(after.starts,before.starts,action+' started a stale game');assert.equal(after.token,before.token+(action==='stale'?1:0));
      assert.equal(after.history,0);
    }
    // Synthetic pagehide intentionally stops the existing RAF, so reboot for
    // the clock proofs rather than secretly restarting its private lifecycle.
    await boot();await page.evaluate(()=>{window.__sqSc068Starts=0;const start=startNewGame;startNewGame=function(setOrder){if(setOrder)window.__sqSc068Starts++;return start.apply(this,arguments);};});
    for(const kind of ['turbo','practice-turbo']){
      await seed(page,2,kind);const before=await read(page);await confirm(page);
      await page.evaluate(()=>recordThrow({kind:'Miss'}));assert.equal((await read(page)).history,0,'Canonical input scored during reveal');
      await page.locator('.sq-throw-order-skip').click();await playable(page);
      const ready=await read(page);assert(!ready.timer.active&&ready.timer.timer===null,'Initial Turbo ready gate started a clock');
      await page.waitForSelector('.sq-turbo-ready-start');await page.waitForTimeout(300);assert.equal((await read(page)).history,0);
      await page.click('.sq-turbo-ready-start');await page.waitForTimeout(2300);
      const running=await read(page);assert(running.timer.active&&running.timer.timer.elapsedMs>=2000);assert.equal(running.token,before.token+1);
      if(kind==='practice-turbo')assert.equal(await page.evaluate(()=>__sqComputeGameMode()),'practice');
      await page.evaluate(()=>showPlayerOrderDialog());await confirm(page);await page.waitForTimeout(300);
      const pending=await read(page);assert(!pending.timer.active&&pending.timer.timer.elapsedMs>running.timer.timer.elapsedMs,'Pending reveal discarded the existing timer');
      await page.keyboard.press('Escape');await page.waitForTimeout(150);const cancelled=await read(page);
      assert(cancelled.timer.active&&cancelled.timer.timer.elapsedMs>pending.timer.timer.elapsedMs,'Cancellation granted fresh time');
      assert.equal(cancelled.token,running.token);assert.equal(cancelled.history,0);
      evidence.push({kind,running,pending,cancelled});
      // Put that same visit beyond 20s only after the pending flag is set.
      await page.evaluate(()=>showPlayerOrderDialog());await confirm(page);
      await page.evaluate(()=>{window.__sqSc068Offset+=20000;recordThrow({kind:'Miss'});});await page.waitForTimeout(150);
      assert.equal((await read(page)).history,0,'Old strict timer auto-scored behind the reveal');
      await page.keyboard.press('Escape');await page.waitForFunction(()=>state.history.length===3);
      assert.equal(await page.evaluate(()=>state.currentPlayer),1,'Cancellation failed to resume the original elapsed cutoff');
      await page.evaluate(()=>window.__sqSc068Offset=0);
      await page.evaluate(()=>showPlayerOrderDialog());await confirm(page);await page.locator('.sq-throw-order-skip').click();await playable(page);
      assert(!((await read(page)).timer.active));assert.equal((await read(page)).history,0,'Restart retained prior auto-Misses');
      assert(await page.locator('.sq-turbo-ready-start').isVisible(),'Restart bypassed existing READY');
    }

    // The helper is not adopted by resume, amendment or direct AUTO starts.
    await seed(page,3);await confirm(page);await page.locator('.sq-throw-order-skip').click();await playable(page);
    const amendBefore=await read(page);await page.evaluate(()=>showPlayerOrderDialog({amend:true}));
    await page.locator('.modal-throworder-amend .to-row').first().locator('.to-arrow-btn').nth(1).click();await page.getByRole('button',{name:'APPLY CORRECTION',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.modal-throworder-amend'));assert.equal((await read(page)).starts,amendBefore.starts);assert.equal(await page.locator('.sq-throw-order-reveal').count(),0);
    const amended=(await read(page)).players;
    await page.evaluate(()=>{state.finished=true;state.gameAwarded=true;state.match.gameNumber=2;state.match.history=[{totals:state.players.map((_,i)=>100+i),board:JSON.parse(JSON.stringify(state.score))}];showLeaderboard();show('leaderboard');});
    await page.click('#nextGameBtn');await playable(page);assert.equal(await page.locator('.sq-throw-order-reveal').count(),0);assert.deepEqual((await read(page)).players,amended.slice(1).concat(amended[0]));
    await page.evaluate(()=>{recordThrow({kind:'S'});save();});const saved=await read(page);await boot();await page.click('#resumeBtn');await playable(page);assert.equal(await page.locator('.sq-throw-order-reveal').count(),0);assert.deepEqual((await read(page)).players,saved.players);assert.equal((await read(page)).history,saved.history);
    for(const kind of ['training','vsshadow','practice-classic']){
      await seed(page,kind==='practice-classic'?1:2,kind);const before=await read(page);await confirm(page);assert(!(await read(page)).pending,kind+' adopted the reveal');await playable(page);assert.equal((await read(page)).token,before.token+1);
    }
    assert.deepEqual(consoleErrs,[],'Unexpected console/page errors');
    if(process.env.SQ_SCREENSHOTS)fs.writeFileSync(path.join(process.env.SQ_SCREENSHOTS,'sc068-measurements.json'),JSON.stringify(evidence,null,2));
    console.log('SC-068 PASS: exact ordered identities, picture→VS beats, 2–5/mobile/Skip/reduced/assets, stale lifecycle, preserved Turbo elapsed/READY, amendment/AUTO/resume/mode isolation');
  }catch(error){
    if(process.env.SQ_SCREENSHOTS){
      fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
      const state=await page.evaluate(()=>({page:document.body.dataset.page,pending:!!window.__sqThrowOrderRevealPending,scripts:[...document.scripts].map(s=>s.src),ready:document.readyState})).catch(()=>null);
      fs.writeFileSync(path.join(process.env.SQ_SCREENSHOTS,'sc068-failure-receipt.json'),JSON.stringify({error:String(error),state,transport,consoleErrs},null,2));
      await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'sc068-failure.png')}).catch(()=>{});
    }
    throw error;
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
