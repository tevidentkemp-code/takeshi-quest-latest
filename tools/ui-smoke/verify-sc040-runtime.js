const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');
const {installAdminUiFixture}=require('./admin-ui-fixture');
const out = process.env.SQ_SCREENSHOTS || path.join(__dirname, '../../output/playwright/sc040');
fs.mkdirSync(out, {recursive:true});
(async () => {
  const {browser, page, consoleErrs} = await H.launch();
  let missing = false, deny = false, zero = false, delayPatch = false;
  let rows = [{id:'11111111-1111-4111-8111-111111111111',name:'Legacy Player',first_name:'Legacy',last_name:'Player',initials:'LP',nickname:'Original',avatar_id:null,deleted_at:null,created_at:'2026-01-01T00:00:00Z'}];
  const writes = [];
  // Offline UI data effects only. Actual Auth acceptance uses the real-local suite.
  await page.exposeFunction('__sc040Command',async (request,authorization)=>{
    const {action,body}=request;
    const profile=action==='create_player'?body:body.profile;
    if(action==='admin_action'){
      assert.equal(authorization,'Bearer sc004-ui-fixture-admin','profile fixture requires the explicit offline admin credential');
      assert.equal(body.operation,'update_player','avatar editing retains the actual admin command operation');
      assert.equal(body.player_id,'22222222-2222-4222-8222-222222222222','avatar editing addresses the exact saved profile');
      assert.match(request.request_id,/^[a-f0-9-]{36}$/i,'profile command retains its request envelope');
    }
    writes.push({method:action,payload:profile,authorization,operation:body.operation});
    if(profile?.avatar_id!=null&&missing)return {status:400,body:{ok:false,code:'operation_failed'}};
    if(action==='admin_action'&&deny)return {status:403,body:{ok:false,code:'permission_denied'}};
    if(action==='create_player'){
      const row={...profile,id:'22222222-2222-4222-8222-222222222222',deleted_at:null,created_at:'2026-09-20T00:00:00Z'};rows.push(row);
      return {status:200,body:{ok:true,...row}};
    }
    if(delayPatch)await new Promise(resolve=>setTimeout(resolve,250));
    const row=zero?null:rows.find(p=>p.id===body.player_id||p.name===body.player_name);
    if(row)Object.assign(row,profile);
    return {status:200,body:{ok:true,player:row}};
  });
  await page.addInitScript(()=>{
    const prior=window.fetch;
    window.fetch=async function(target,init){
      if(String(target)===window.SQ_SECURITY_CONFIG?.endpoint){
        const request=JSON.parse(init.body||'{}');
        if(request.action==='create_player'||request.action==='admin_action'){
          if(request.action==='admin_action'&&init.headers.Authorization!=='Bearer sc004-ui-fixture-admin')return new Response(JSON.stringify({ok:false,code:'permission_denied'}),{status:403});
          const result=await window.__sc040Command(request,init.headers.Authorization||null);return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
        }
      }
      return prior(target,init);
    };
  });
  const playerRoute=async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname!=='/rest/v1/players'||req.method()!=='GET')return route.abort();
    let selected = rows.filter(p => (!url.searchParams.has('id') || 'eq.'+p.id === url.searchParams.get('id')) && (!url.searchParams.has('name') || 'eq.'+p.name === url.searchParams.get('name')) && (!url.searchParams.has('deleted_at') || p.deleted_at === null));
    const single = (req.headers().accept || '').includes('vnd.pgrst.object');
    return route.fulfill({status:200,json:single ? selected[0] || null : selected});
  };
  await page.route('**/rest/v1/players*', playerRoute);
  try {
    await H.boot(page);
    await page.evaluate(()=>syncSavedPlayersFromCloud());
    const legacy = await page.evaluate(()=>({id:__sqAvatarIdForPlayer(getSavedPlayers()[0]),raw:getSavedPlayers()[0].avatar_id}));
    assert.equal(legacy.raw,null,'cache preserves canonical NULL');
    await page.reload(); await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(()=>__sqAvatarIdForPlayer(getSavedPlayers()[0])),legacy.id,'legacy fallback survives reload');
    await page.evaluate(()=>showAddPlayerDialog(0));
    assert.equal(await page.locator('#newPlayerAvatarPicker [role=radio]').count(),32);
    await page.locator('#newPlayerAvatarPicker [data-avatar-id="1"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#newPlayerAvatarPicker [aria-checked=true]').getAttribute('data-avatar-id'),'32');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#newPlayerAvatarPicker [aria-checked=true]').getAttribute('data-avatar-id'),'2');
    await page.fill('#newPlayerFirst','Avatar'); await page.fill('#newPlayerLast','Tester');
    await page.locator('#newPlayerAvatarPicker [data-avatar-id="9"]').click();
    await page.screenshot({path:path.join(out,'create-390.png')});
    missing = true;
    await page.click('#savePlayerBtn'); await page.waitForTimeout(400);
    assert.equal(rows.length,1,'missing migration must not silently create partial profile');
    assert.equal(writes.length,1,'no fallback write after rejected avatar');
    assert(await page.locator('#addPlayerModal').isVisible(),'failed save keeps selection open');
    missing=false;
    await page.click('#savePlayerBtn');
    await page.waitForFunction(()=>getSavedPlayers().some(p=>p.name==='Avatar Tester' && p.avatar_id===9));
    assert.equal(rows[1].avatar_id,9);
    console.log('PASS create, rejected schema write, keyboard navigation, cache and reload');
    const openHub = async () => {
      await page.evaluate(()=>window.openPlayerHubGate());
      await page.selectOption('#playerHubSelect',{label:'Avatar Tester — "'+rows[1].nickname+'"'}).catch(()=>page.selectOption('#playerHubSelect','0'));
      // Resolve by actual fixture name, independent of list sorting.
      await page.selectOption('#playerHubSelect',await page.locator('#playerHubSelect option').evaluateAll(opts=>opts.find(o=>o.textContent.startsWith('Avatar Tester')).value));
      await installAdminUiFixture(page);
      await page.locator('#playerHubGateOverlay').getByRole('button',{name:'Edit profile',exact:true}).click();
      await page.waitForSelector('#playerHubEditorOverlay');
    };
    await openHub();
    assert.equal(await page.locator('#playerHubEditorOverlay [aria-checked=true]').getAttribute('data-avatar-id'),'9');
    await page.locator('#playerHubEditorOverlay [data-avatar-id="29"]').click();
    delayPatch=true;
    await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Save',exact:true}).click();
    await page.waitForTimeout(60);
    const hubPending = await page.locator('#playerHubEditorOverlay').evaluate(el => {
      const save = Array.from(el.querySelectorAll('button')).find(b => b.textContent.trim() === 'Saving…');
      return {
        busy: el.getAttribute('aria-busy'),
        saveText: save && save.textContent.trim(),
        saveDisabled: !!(save && save.disabled),
        status: el.querySelector('[role="status"]')?.textContent || ''
      };
    });
    assert.equal(hubPending.busy,'true');
    assert.equal(hubPending.saveText,'Saving…');
    assert.equal(hubPending.saveDisabled,true);
    assert.match(hubPending.status,/Saving profile/i);
    delayPatch=false;
    await page.waitForFunction(() => {
      const el=document.getElementById('playerHubEditorOverlay');
      return !!el && Array.from(el.querySelectorAll('button')).some(b => b.textContent.trim() === 'Saved ✓');
    }, { timeout:4000 });
    const hubSaved = await page.locator('#playerHubEditorOverlay').evaluate(el => ({
      status: el.querySelector('[role="status"]')?.textContent || '',
      saved: Array.from(el.querySelectorAll('button')).some(b => b.textContent.trim() === 'Saved ✓')
    }));
    assert.equal(hubSaved.saved,true);
    assert.match(hubSaved.status,/Profile saved/i);
    assert.equal(writes.find(w=>w.method==='admin_action')?.authorization,'Bearer sc004-ui-fixture-admin');
    assert.equal(writes.find(w=>w.method==='admin_action')?.operation,'update_player');
    await page.waitForSelector('#playerHubEditorOverlay',{state:'detached'});
    assert.equal(rows[1].avatar_id,29);
    await openHub();
    await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Back',exact:true}).click();
    assert(await page.locator('#playerHubGateOverlay').isVisible(),'Back restores gate');
    await page.locator('#playerHubGateOverlay').getByRole('button',{name:'Return',exact:true}).click();
    await openHub();
    for(const width of [320,390,430,1280]) {
      await page.setViewportSize({width,height:844});
      const bounds=await page.locator('#playerHubEditorOverlay .modal').boundingBox();
      assert(bounds.y>=0 && bounds.y+bounds.height<=845,'editor fits viewport '+width);
      const target=await page.locator('#playerHubEditorOverlay [role=radio]').first().boundingBox();
      assert(target.width>=44 && target.height>=44,'44px avatar targets '+width);
      await page.screenshot({path:path.join(out,`hub-${width}.png`)});
    }
    await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Close',exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    deny=true;
    const reject=await page.evaluate(async()=>{try{await cloudUpdatePlayerProfile({id:'22222222-2222-4222-8222-222222222222'},{avatar_id:4});return false;}catch(_){return true;}});
    assert(reject); assert.equal(rows[1].avatar_id,29);
    deny=false;zero=true;
    assert(await page.evaluate(async()=>{try{await cloudUpdatePlayerProfile({id:'22222222-2222-4222-8222-222222222222'},{avatar_id:4});return false;}catch(_){return true;}}));
    zero=false;
    console.log('PASS Hub edit, Back/Close, responsive targets, denied/zero-row writes');
    // Separate browser context/device: no inherited local storage.
    const other = await H.launch();
    try {
      await other.page.route('**/rest/v1/players*', playerRoute);
      await H.boot(other.page);
      await other.page.evaluate(()=>syncSavedPlayersFromCloud());
      assert.equal(await other.page.evaluate(()=>getSavedPlayers().find(p=>p.name==='Avatar Tester').avatar_id),29);
    } finally { await other.browser.close(); }
    await H.toMatchCard(page);
    await page.evaluate(()=>showSelectPlayerDialog(0));
    assert.equal(await page.locator('#spPlayerList .sp2-row').filter({hasText:'AVATAR TESTER'}).locator('[data-avatar-id]').getAttribute('data-avatar-id'),'29');
    assert((await page.locator('#spPlayerList .sp2-row').filter({hasText:'AVATAR TESTER'}).locator('[data-avatar-id]').evaluate(el=>el.getBoundingClientRect().width)) >= 43.5,'Select Player avatar should render at 44px');
    await page.locator('#spPlayerList .sp2-row').filter({hasText:'AVATAR TESTER'}).click();
    await page.click('#confirmSelectPlayerBtn');
    assert.equal(await page.locator('#msPlayersList [data-avatar-id]').first().getAttribute('data-avatar-id'),'29');
    assert((await page.locator('#msPlayersList [data-avatar-id]').first().evaluate(el=>el.getBoundingClientRect().width)) <= 36.5,'Match Setup avatar size must remain unchanged');
    await H.addGuests(page,['Beta']);
    assert.equal(await page.locator('#msPlayersList [data-avatar-id]').first().getAttribute('data-avatar-id'),'29');
    assert.equal(await page.locator('.sq-gc-celebration-sprite').count(),0,'celebration art must not render during match setup');
    await page.click('#startMatchBtn'); await page.waitForTimeout(500);
    const pickedLength = await page.evaluate(() => {
      const seg = document.querySelector('#mlGrid .mlw-seg[data-value="3"]');
      if (!seg) return false;
      seg.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      return true;
    });
    assert(pickedLength,'FT3 match-length segment missing');
    await page.click('#mlStartBtn');
    await page.waitForSelector('.modal-throworder');
    assert.equal(await page.locator('.modal-throworder .to-row').first().locator('[data-avatar-id]').getAttribute('data-avatar-id'),'29');
    assert((await page.locator('.modal-throworder .to-row').first().locator('[data-avatar-id]').evaluate(el=>el.getBoundingClientRect().width)) >= 43.5,'Throw Order avatar should render at least 44px on mobile');
    assert.equal(await page.locator('.modal-throworder .to-row [data-avatar-id]').count(),2,'every Throw Order player must show an avatar');
    assert.equal(await page.locator('.sq-gc-celebration-sprite').count(),0,'celebration art must not render in Throw Order');
    await page.click('.modal-throworder .to-start');
    await page.waitForFunction(()=>document.body.dataset.page==='game',{timeout:15000});
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.sq-gc-celebration-sprite').count(),0,'celebration art must not render during live play');
    assert.equal(await page.evaluate(()=>state.players.find(p=>p.name==='Avatar Tester').avatar_id),29);
    assert((await page.evaluate(()=>state.players.map(p=>p.avatar_id))).every(Number.isInteger));
    await page.evaluate(()=>{
      state.players[0].avatar_id=3;state.players[1].avatar_id=29;
      state.score=state.players.map((_,i)=>Array.from({length:14},()=>({roundTotal:i?20:10,darts:[{kind:'S',points:i?20:10},{kind:'Miss',points:0},{kind:'Miss',points:0}]})));
      state.currentRound=13;state.finished=true;state.gameAwarded=false;
      openGameCompleteDialog();
    });
    await page.waitForSelector('.sq-gc-celebration-sprite');
    assert.equal(await page.locator('.sq-gc-celebration-sprite').getAttribute('data-avatar-id'),'29');
    await page.screenshot({path:path.join(out,'winner-390.png')});
    // A resolved tied game must use the shootout winner, not the first tied row.
    await page.evaluate(()=>{
      document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(el=>el.remove());
      state.score[1]=JSON.parse(JSON.stringify(state.score[0]));
      state._decider={resolved:true,winner:1,gameToken:state.__gameToken||0};
      delete state.__sqGameCompleteOpen;
      openGameCompleteDialog();
    });
    await page.waitForSelector('.sq-gc-celebration-sprite');
    assert.equal(await page.locator('.sq-gc-celebration-sprite').getAttribute('data-avatar-id'),'29');
    assert.equal(consoleErrs.filter(x=>x.startsWith('pageerror:')).length,0,JSON.stringify(consoleErrs.filter(x=>x.startsWith('pageerror:'))));
    console.log('PASS fresh-cache canonical fetch, Select Player + Match Setup + Throw Order avatars, live celebration boundary, match state, actual second-player winner and no uncaught errors');
    console.log('SC-040 browser acceptance PASS (production network blocked)');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
