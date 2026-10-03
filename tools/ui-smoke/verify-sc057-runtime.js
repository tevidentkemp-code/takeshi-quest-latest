const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');
const {installAdminUiFixture}=require('./admin-ui-fixture');
const OUT=process.env.SQ_SCREENSHOTS||path.join(__dirname,'../../output/playwright/sc057');
fs.mkdirSync(OUT,{recursive:true});

(async()=>{
  const {browser,ctx,page,consoleErrs}=await H.launch({width:390,height:844});
  let range=29,denied=false,zero=false,serial=0;
  const writes=[];
  let rows=[{id:'11111111-1111-4111-8111-111111111111',name:'Legacy Twenty Nine',first_name:'Legacy',last_name:'Twenty Nine',initials:'L29',avatar_id:29,deleted_at:null}];
  // Offline UI data effects only; real Auth/DB acceptance remains a separate suite.
  // Keep the production command envelope and credential construction exercised.
  await page.exposeFunction('__sc057Command',async(request,authorization)=>{
    const {action,body}=request;
    assert.match(request.request_id,/^[a-f0-9-]{36}$/i,'profile write retains its command request ID');
    const payload=action==='create_player'?body:body.profile;
    if(action==='admin_action'){
      assert.equal(authorization,'Bearer sc004-ui-fixture-admin','profile edit requires the explicit offline credential');
      assert.equal(body.operation,'update_player','profile edit retains the current admin operation');
      assert.equal(body.player_id,rows.find(p=>p.name==='Append 30')?.id,'profile edit addresses the exact saved UUID');
    }
    writes.push({method:action,payload,authorization,operation:body.operation});
    if(payload?.avatar_id>range)return {status:400,body:{ok:false,code:'operation_failed',message:'players_avatar_id_range'}};
    if(denied)return {status:403,body:{ok:false,code:'permission_denied'}};
    if(action==='create_player'){
      const row={...payload,id:'22222222-2222-4222-8222-'+String(++serial).padStart(12,'0'),deleted_at:null};
      rows.push(row);return {status:200,body:{ok:true,...row}};
    }
    const row=zero?null:rows.find(p=>p.id===body.player_id);
    if(row)Object.assign(row,payload);
    return {status:200,body:{ok:true,player:row}};
  });
  await page.addInitScript(()=>{
    const prior=window.fetch;
    window.fetch=async function(target,init){
      if(String(target)===window.SQ_SECURITY_CONFIG?.endpoint){
        const request=JSON.parse(init.body||'{}');
        if(request.action==='create_player'||request.action==='admin_action'){
          const result=await window.__sc057Command(request,init.headers.Authorization||null);
          return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
        }
      }
      return prior(target,init);
    };
  });
  const offline=async route=>{
    const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),method=req.method();
    if(table==='players'){
      // initialCloudCheck is a cross-origin GET with Supabase request headers.
      // Keep its exact offline response/preflight readable in Linux WebKit.
      const health=url.searchParams.get('select')==='id'&&url.searchParams.get('limit')==='1';
      const transport=health?{headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'accept-profile, apikey, authorization, cache-control, pragma, x-client-info'}}:{};
      if(health&&method==='OPTIONS')return route.fulfill({status:204,body:'',...transport});
      if(health&&method==='HEAD')return route.fulfill({status:503,body:'',...transport});
      assert(!['POST','PATCH','DELETE'].includes(method),'profile fixture must never permit retired direct REST writes');
      let selected=rows.filter(p=>(!url.searchParams.has('id')||'eq.'+p.id===url.searchParams.get('id'))&&(!url.searchParams.has('name')||'eq.'+p.name===url.searchParams.get('name')));
      const single=(req.headers().accept||'').includes('vnd.pgrst.object');
      return route.fulfill({status:200,json:single?selected[0]||null:selected,...transport});
    }
    // Exact read-only owners warmed by game start/post-game. Empty histories
    // are isolated fixtures; every other production request stays blocked.
    const commentary=table==='v_player_game_scores_official_clean'&&url.searchParams.get('select')==='game_id,ts,player_index,player_name,score'&&url.searchParams.get('limit')==='260';
    const legacyRecord=['high_scores','high_scores_sp'].includes(table)&&url.searchParams.get('select')==='player_id,name,score,ts,game_id'&&url.searchParams.get('limit')==='1';
    const postgame=['v_player_best_official_ranked','v_player_xp','v_player_achievements'].includes(table);
    if(method==='GET'&&(commentary||legacyRecord||postgame))return route.fulfill({status:200,json:[]});
    if(method==='HEAD'&&['high_scores','high_scores_sp'].includes(table)&&url.searchParams.get('select')==='game_id'&&url.searchParams.get('limit')==='1')return route.fulfill({status:503,body:''});
    return route.abort('failed');
  };
  await ctx.route('**.supabase.co/rest/v1/**',offline);
  const checkArt=async(locator,id,winner=false)=>{
    await locator.waitFor({state:'visible'});
    const art=await locator.evaluate(el=>({id:el.dataset.avatarId,layout:el.dataset.avatarLayout,image:getComputedStyle(el).backgroundImage,size:getComputedStyle(el).backgroundSize}));
    assert.equal(art.id,String(id));
    assert.equal(art.layout,id>29?'standalone':'sprite');
    assert.equal(art.size,id>29?'100% 100%':'600% 500%');
    const asset=id>29?(winner?'winner':'avatar')+'-'+id+'.webp':(winner?'celebration-sprite.webp':'avatar-sprite.webp');
    assert(art.image.includes('/assets/avatars/'+asset));
    const image=await locator.evaluate(async el=>{const img=new Image();img.src=getComputedStyle(el).backgroundImage.slice(5,-2);await img.decode();return [img.naturalWidth,img.naturalHeight];});
    const expected=id>29?(winner?[1122,1402]:[1254,1254]):(winner?[2880,3000]:[1536,1280]);
    assert.deepEqual(image,expected,'actual rendered asset must load/decode at its preserved dimensions');
  };
  const openHub=async name=>{
    await page.evaluate(()=>window.openPlayerHubGate());
    const option=await page.locator('#playerHubSelect option').evaluateAll((opts,n)=>opts.find(o=>o.textContent.startsWith(n)).value,name);
    await page.selectOption('#playerHubSelect',option);
    await installAdminUiFixture(page);
    await page.locator('#playerHubGateOverlay').getByRole('button',{name:'Edit profile',exact:true}).click();
    await page.waitForSelector('#playerHubEditorOverlay');
  };
  try{
    await H.boot(page,{settle:1200});
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const id of [30,31,32]){
      await page.evaluate(()=>showAddPlayerDialog(0));
      assert.equal(await page.locator('#newPlayerAvatarPicker [role=radio]').count(),32);
      await page.fill('#newPlayerFirst','Append');await page.fill('#newPlayerLast',String(id));
      await page.locator('#newPlayerAvatarPicker [data-avatar-id="'+id+'"]').click();
      await checkArt(page.locator('#newPlayerAvatarPicker [data-avatar-id="'+id+'"]'),id);
      if(id===30){
        await page.click('#savePlayerBtn');
        await page.waitForFunction(()=>/Save failed/.test(document.getElementById('npSaveStatus')?.textContent||''));
        assert.equal(rows.length,1);assert.equal(writes.length,1,'old range failure must not issue a fallback write');
        assert(await page.locator('#addPlayerModal').isVisible());
        assert.equal(await page.locator('#newPlayerAvatarPicker [aria-checked=true]').getAttribute('data-avatar-id'),'30');
        assert.equal(await page.inputValue('#newPlayerLast'),'30');
        range=32;
      }
      await page.click('#savePlayerBtn');
      await page.waitForFunction(n=>getSavedPlayers().some(p=>p.name==='Append '+n&&p.avatar_id===n),id);
      await page.waitForSelector('#addPlayerModal',{state:'hidden'});
    }
    const target=rows.find(p=>p.name==='Append 30');
    for(const id of [31,32,30]){
      await openHub('Append 30');
      await page.locator('#playerHubEditorOverlay [data-avatar-id="'+id+'"]').click();
      await checkArt(page.locator('#playerHubEditorOverlay [data-avatar-id="'+id+'"]'),id);
      await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Save',exact:true}).click();
      await page.waitForSelector('#playerHubEditorOverlay',{state:'detached'});
      assert.equal(target.avatar_id,id);
    }
    await openHub('Append 30');
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});
      for(const id of [29,30,31,32]){
        const choice=page.locator('#playerHubEditorOverlay [data-avatar-id="'+id+'"]');
        await choice.scrollIntoViewIfNeeded();await checkArt(choice,id);
        const bounds=await choice.boundingBox();assert(bounds.width>=44&&bounds.height>=44);
      }
      await page.screenshot({path:path.join(OUT,'picker-'+width+'.png')});
    }
    await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Close',exact:true}).click();
    for(const failure of ['denied','zero']){
      await openHub('Append 30');
      await page.locator('#playerHubEditorOverlay [data-avatar-id="32"]').click();
      denied=failure==='denied';zero=failure==='zero';const before=writes.length;
      await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Save',exact:true}).click();
      await page.waitForFunction(()=>/Save failed/.test(document.querySelector('#playerHubEditorOverlay [role=status]')?.textContent||''));
      assert.equal(writes.length,before+1);assert.equal(target.avatar_id,30,'rejected edit cannot change canonical choice');
      assert(await page.locator('#playerHubEditorOverlay').isVisible());
      await page.locator('#playerHubEditorOverlay').getByRole('button',{name:'Close',exact:true}).click();
      denied=false;zero=false;
    }
    await page.reload();await H.boot(page,{settle:1200});
    await page.evaluate(()=>syncSavedPlayersFromCloud());
    assert.deepEqual(await page.evaluate(()=>getSavedPlayers().filter(p=>/^Append /.test(p.name)).map(p=>p.avatar_id).sort()),[30,31,32]);
    assert.equal(rows[0].avatar_id,29,'existing explicit identity must remain unchanged');
    console.log('PASS actual Create30/31/32, Edit31/32/30, old-range rejection/no fallback, denied/zero-row edit, refresh canonical IDs, mobile picker and original29');
    await page.setViewportSize({width:390,height:844});await H.toMatchCard(page);
    for(const name of ['Append 30','Append 31']){
      await page.evaluate(()=>showSelectPlayerDialog(0));
      const row=page.locator('#spPlayerList .sp2-row').filter({hasText:name.toUpperCase()});
      await checkArt(row.locator('[data-avatar-id]'),Number(name.split(' ')[1]));
      await row.click();await page.click('#confirmSelectPlayerBtn');
    }
    for(const id of [30,31])await checkArt(page.locator('#msPlayersList [data-avatar-id="'+id+'"]'),id);
    await page.click('#startMatchBtn');await page.waitForSelector('#mlStartBtn');
    await page.locator('#mlGrid .mlw-seg[data-value="3"]').dispatchEvent('click');await page.click('#mlStartBtn');
    await page.waitForSelector('.modal-throworder');
    for(const id of [30,31])await checkArt(page.locator('.modal-throworder [data-avatar-id="'+id+'"]'),id);
    await page.click('.modal-throworder .to-start');
    await page.waitForFunction(()=>document.body.dataset.page==='game'&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');
    assert.deepEqual(await page.evaluate(()=>state.players.map(p=>p.avatar_id)),[30,31]);
    assert.equal(await page.locator('.sq-gc-celebration-sprite').count(),0,'winner artwork must not leak into live play');
    await page.evaluate(()=>window.__sqOpenGameMenu106());
    await page.locator('.sq-menu106-row').filter({hasText:'Add Player'}).first().click();
    await page.waitForFunction(()=>!document.querySelector('.sq-add-player-loading'));
    const lateFixture=rows.find(p=>p.name==='Append 32');
    assert.equal(lateFixture.id,'22222222-2222-4222-8222-000000000003');
    assert.equal(lateFixture.avatar_id,32);
    const late=await page.evaluate(()=>{
      const p=getSavedPlayers().find(p=>p.name==='Append 32');
      return {id:p.id,avatar:p.avatar_id,label:__ms2DisplayName(p),pretty:__sqPlayerPretty(p)};
    });
    assert.equal(late.id,lateFixture.id);assert.equal(late.avatar,32);
    const lateBefore=await page.evaluate(()=>state.players.map(p=>({id:p.id,avatar_id:p.avatar_id})));
    const lateRow=page.locator('.sq-add-player-modal .sq-menu106-row').filter({hasText:late.label});
    await lateRow.waitFor({state:'visible'});
    assert.equal(await lateRow.count(),1);await checkArt(lateRow.locator('[data-avatar-id]'),32);
    await lateRow.click();
    assert((await page.locator('.sq-confirm-bd .modal-body').textContent()).includes(late.pretty),'confirmation retains full canonical identity');
    assert.deepEqual(await page.evaluate(()=>state.players.map(p=>({id:p.id,avatar_id:p.avatar_id}))),lateBefore,'late choice waits for confirmation');
    await page.locator('.sq-confirm-bd .sq-endmatch-yes').click();
    await page.waitForFunction(()=>state.players.length===3);
    assert.deepEqual(await page.evaluate(()=>state.players.map(p=>p.avatar_id)),[30,31,32]);
    const identities=await page.evaluate(()=>state.players.map(p=>({id:p.id,avatar_id:p.avatar_id})));
    assert.deepEqual(identities,lateBefore.concat([{id:lateFixture.id,avatar_id:32}]),'confirmed late append preserves exact UUID/avatar');
    console.log('PASS actual Select/setup/Throw Order/live identity and confirmed registered late join');
    for(const width of [320,390,430])for(const [index,id] of [30,31,32].entries()){
      await page.setViewportSize({width,height:844});
      await page.evaluate(winner=>{
        document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(el=>el.remove());
        state.score=state.players.map((_,i)=>Array.from({length:14},()=>({roundTotal:i===winner?20:10,darts:[{kind:'S',points:i===winner?20:10},{kind:'Miss',points:0},{kind:'Miss',points:0}]})));
        state.currentRound=13;state.finished=true;state.gameAwarded=false;state.match.targetWins=3;
        state.match.wins=state.players.map((_,i)=>i===winner?2:0);delete state._decider;delete state.__sqGameCompleteOpen;
        openGameCompleteDialog();
      },index);
      await checkArt(page.locator('.sq-gc-celebration-sprite'),id,true);
      await page.screenshot({path:path.join(OUT,'game-winner-'+id+'-'+width+'.png')});
      await page.locator('.sq-pg-next').click();await page.locator('.sq-pg-next').click();
      await page.waitForSelector('.gc-xp-avatar-sprite');
      for(const portrait of [30,31,32])await checkArt(page.locator('.gc-xp-avatar-sprite[data-avatar-id="'+portrait+'"]'),portrait);
      await page.waitForFunction(()=>{const b=document.querySelector('.sq-pg-next');return b&&!b.disabled&&/MATCH WIN/.test(b.textContent);});
      await page.locator('.sq-pg-next').click();
      await page.waitForSelector('.sq-pg-match-win:not([hidden])');
      await checkArt(page.locator('.sq-pg-match-celebration'),id,true);
      for(const other of [30,31,32].filter(n=>n!==id))await checkArt(page.locator('.sq-pg-opponent-avatar[data-avatar-id="'+other+'"]'),other);
      await page.screenshot({path:path.join(OUT,'match-winner-'+id+'-'+width+'.png')});
      assert.deepEqual(await page.evaluate(()=>state.players.map(p=>({id:p.id,avatar_id:p.avatar_id}))),identities,'presentation must not mutate identity');
    }
    // The established resolved shootout chooses its true winner even on equal totals.
    await page.evaluate(()=>{
      document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(el=>el.remove());
      state.score[0]=JSON.parse(JSON.stringify(state.score[1]));state.score[2]=JSON.parse(JSON.stringify(state.score[1]));
      state._decider={resolved:true,winner:1,gameToken:state.__gameToken||0};delete state.__sqGameCompleteOpen;openGameCompleteDialog();
    });
    await checkArt(page.locator('.sq-gc-celebration-sprite'),31,true);
    assert.equal(consoleErrs.filter(x=>x.startsWith('pageerror:')).length,0,JSON.stringify(consoleErrs.filter(x=>x.startsWith('pageerror:'))));
    console.log('SC-057 browser PASS: all approved game/match winners, opponent and XP portraits, resolved shootout,320/390/430 full assets and strict pageerrors empty. Production traffic blocked.');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
