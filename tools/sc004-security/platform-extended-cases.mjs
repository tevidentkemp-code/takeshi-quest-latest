/** Additional cases against the isolated real platform. No Auth/DB mocks. */
import assert from 'node:assert/strict';
const ql=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function runExtendedCases({check,client,sql,invoke,cap,read,must,service,createAuthUser,ordinaryJWT,url,key,fetchApi,run,players}) {
  const fresh=()=>client.createMatch({mode:'official',roster:players.map(p=>({id:p.id})),target_wins:3,match_format:'series'},crypto.randomUUID());
  let live,expired,revoked;
  await check('Real lifecycle refuses expired, revoked, and forged controllers',async()=>{
    live=await fresh();expired=await fresh();revoked=await fresh();
    sql(`UPDATE private.sc004_controllers SET expires_at=clock_timestamp()-interval '1 second' WHERE match_id=${ql(expired.match_id)}`);
    await assert.rejects(()=>client.command('renew',expired.match_id),e=>e.status===403);
    const revokedSecret=cap(revoked.match_id);
    await client.command('revoke_controller',revoked.match_id);
    assert.equal((await invoke('resume',{match_id:revoked.match_id},revokedSecret)).status,403);
    assert.equal((await invoke('resume',{match_id:live.match_id},'sqmc1_'+'a'.repeat(43))).status,403);
  });
  await check('Trusted write hold preserves live reconnect and receipts without reviving expired scopes',async()=>{
    const before=sql(`SELECT expires_at FROM private.sc004_controllers WHERE match_id=${ql(live.match_id)}`);
    sql('SELECT public.sq_sc004_set_hold(true)');
    try {
      assert.equal((await client.command('resume',live.match_id)).match_id,live.match_id);
      await assert.rejects(()=>client.command('reserve_game',live.match_id,{game_number:1}),e=>e.status===503);
      await assert.rejects(()=>client.command('resume',expired.match_id),e=>e.status===403);
    }finally{sql('SELECT public.sq_sc004_set_hold(false)');}
    assert.equal(sql(`SELECT (expires_at>${ql(before)}::timestamptz)::text FROM private.sc004_controllers WHERE match_id=${ql(live.match_id)}`),'true');
    await assert.rejects(()=>client.command('renew',expired.match_id),e=>e.status===403);
    await client.command('reserve_game',live.match_id,{game_number:1});
  });
  await check('Actual Auth session deletion immediately invalidates an otherwise signed admin token',async()=>{
    const user=await createAuthUser('session');
    sql(`INSERT INTO private.sc004_admins(user_id,enabled) VALUES(${ql(user.id)},true)`);
    assert.equal((await invoke('admin_action',{operation:'status'},null,user.jwt)).status,200);
    const claims=JSON.parse(Buffer.from(user.jwt.split('.')[1],'base64url'));
    sql(`DELETE FROM auth.sessions WHERE id=${ql(claims.session_id)}`);
    const denied=await invoke('admin_action',{operation:'status'},null,user.jwt);
    assert([401,403].includes(denied.status));
  });
  await check('User-editable Auth metadata never grants admin authority',async()=>{
    const claims=JSON.parse(Buffer.from(ordinaryJWT.split('.')[1],'base64url'));
    must(await service.auth.admin.updateUserById(claims.sub,{user_metadata:{role:'admin',is_admin:true,__sqAdminAuthed:true}}));
    assert.equal((await invoke('admin_action',{operation:'status'},null,ordinaryJWT)).status,403);
  });
  await check('Visit telemetry is create-only and deduplicated by server day and device',async()=>{
    const device_id=crypto.randomUUID();
    await client.visit({device_id});await client.visit({device_id});
    assert.equal(sql(`SELECT count(*) FROM public.app_logons WHERE device_id=${ql(device_id)}`),'1');
    const denied=await invoke('visit',{device_id,created_at:'2000-01-01'});assert.equal(denied.status,400);
  });
  for(const mode of ['standard','tdb','select'])await check(`Actual ${mode} training persists partial-go aggregates once and denies cross-session control`,async()=>{
    const config=mode==='select'?{targets:[{kind:'number',n:20,req:'double'}]}:{};
    const setup={player:{id:players[0].id,name:players[0].name},mode,length:10,config};
    const a=await client.createTraining(setup,crypto.randomUUID());
    const b=await client.createTraining(setup,crypto.randomUUID());
    assert.equal((await invoke('resume_training',{training_id:b.training_id},cap(a.training_id))).status,403);
    const req=mode==='standard'?'any':mode==='tdb'?'dt':'double';
    const payload={player_name:players[0].name,mode,length:10,rounds_played:1,config,results:[{target:20,req,darts:['double'],hits:1,points:40}],total_points:40,total_darts:1,total_hits:1,hit_pct:100};
    const result=await client.completeTraining(a.training_id,payload);
    assert.equal(result.training_id,a.training_id);await client.completeTraining(a.training_id,payload);
    assert.equal(sql(`SELECT count(*) FROM public.training_sessions WHERE id=${ql(a.training_id)} AND total_darts=1 AND total_points=40`),'1');
    const r=await invoke('complete_training',{training_id:a.training_id,payload:{...payload,total_points:999}},cap(a.training_id));assert.equal(r.status,409);
    const malformed=await invoke('complete_training',{training_id:b.training_id,payload:{...payload,total_hits:3}},cap(b.training_id));assert.equal(malformed.status,400);
  });
  await check('Real commentary Edge fixture emits Realtime lines only for the authorized game',async()=>{
    const m=await fresh(),slot=await client.command('reserve_game',m.match_id,{game_number:1});
    const r=await fetchApi(url+'/functions/v1/commentary-fixture',{method:'POST',headers:{apikey:key,'Content-Type':'application/json','X-SQ-Match-Controller':cap(m.match_id)},body:JSON.stringify({game_id:slot.game_id,mode:'studio_intro'})});
    const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.equal(body.ok,true);
    assert.equal(must(await read.from('game_commentary').select('id').eq('game_id',slot.game_id)).length,3);
    const again=await fetchApi(url+'/functions/v1/commentary-fixture',{method:'POST',headers:{apikey:key,'Content-Type':'application/json','X-SQ-Match-Controller':cap(m.match_id)},body:JSON.stringify({game_id:slot.game_id,mode:'studio_intro'})});
    assert.equal(again.status,200);assert.equal(must(await read.from('game_commentary').select('id').eq('game_id',slot.game_id)).length,3);
  });
  await check('Controller revocation during real Edge model wait prevents commentary commit',async()=>{
    const m=await fresh(),slot=await client.command('reserve_game',m.match_id,{game_number:1});
    const reply=fetchApi(url+'/functions/v1/commentary-fixture',{method:'POST',headers:{apikey:key,'Content-Type':'application/json','X-SQ-Match-Controller':cap(m.match_id)},body:JSON.stringify({game_id:slot.game_id,mode:'studio_intro'})});
    const deadline=Date.now()+10000;let claimed=false;
    while(Date.now()<deadline){
      if(sql(`SELECT count(*) FROM private.sc004_commentary_claims WHERE game_id=${ql(slot.game_id)}`)==='1'){claimed=true;break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(claimed,'Actual Edge must acquire its SQL claim before revocation');
    await client.command('revoke_controller',m.match_id);
    assert.equal((await reply).status,403);
    assert.equal(must(await read.from('game_commentary').select('id').eq('game_id',slot.game_id)).length,0);
  });
  await check('Retired PIN Edge endpoint is closed even with an old PIN payload',async()=>{
    const r=await fetchApi(url+'/functions/v1/sq-admin-maintenance',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({action:'login',pin:'1111'})});
    assert.equal(r.status,410);
  });
}
