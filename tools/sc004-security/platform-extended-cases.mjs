/** Additional cases against the isolated real platform. No Auth/DB mocks. */
import assert from 'node:assert/strict';
import { createClient } from '../ui-smoke/node_modules/@supabase/supabase-js/dist/index.mjs';
const ql=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function runExtendedCases({check,client,sql,invoke,cap,read,must,service,createAuthUser,ordinaryJWT,url,key,fetchApi,run,players}) {
  const fresh=()=>client.createMatch({mode:'official',roster:players.map(p=>({id:p.id})),target_wins:3,match_format:'series'},crypto.randomUUID());
  await check('Concurrent exact public issuance returns one identity and one controller',async()=>{
    const id=crypto.randomUUID(),body={mode:'official',roster:players.map(p=>({id:p.id})),target_wins:3,match_format:'series'};
    const replies=await Promise.all(Array.from({length:4},()=>invoke('create_match',body,null,null,id)));
    assert(replies.every(r=>r.status===200),JSON.stringify(replies.map(r=>({status:r.status,error:r.data?.error}))));
    assert.equal(new Set(replies.map(r=>r.data.match_id)).size,1);
    assert.equal(new Set(replies.map(r=>r.data.capability)).size,1);
    assert.match(replies[0].data.capability,/^sqmc1_[A-Za-z0-9_-]{43}$/);
    assert.equal(sql(`SELECT count(*) FROM private.sc004_controllers WHERE match_id=${ql(replies[0].data.match_id)}`),'1');
    assert.equal((await invoke('create_match',{...body,target_wins:5},null,null,id)).status,409);
  });
  await check('Game reservation and reset cannot create concurrent or reordered pending slots',async()=>{
    const m=await fresh(),first=await client.command('reserve_game',m.match_id,{game_number:1});
    await assert.rejects(()=>client.command('reserve_game',m.match_id,{game_number:2}),e=>[400,409].includes(e.status));
    await client.command('cleanup_game',m.match_id,{game_id:first.game_id});
    // A cleaned earlier slot must not permit skipping the unaccepted first game.
    await assert.rejects(()=>client.command('reserve_game',m.match_id,{game_number:2}),e=>[400,409].includes(e.status));
    await client.command('reset_game',m.match_id,{game_id:first.game_id});
    assert.equal(sql(`SELECT count(*) FROM private.sc004_slots WHERE match_id=${ql(m.match_id)} AND status='pending'`),'1');
  });
  await check('Consumed creation requests cannot rebind cleaned or expired controller secrets',async()=>{
    const id=crypto.randomUUID(),body={mode:'official',roster:players.map(p=>({id:p.id})),target_wins:3,match_format:'series'};
    const first=await invoke('create_match',body,null,null,id);assert.equal(first.status,200);
    assert.equal((await invoke('cleanup_match',{match_id:first.data.match_id},first.data.capability)).status,200);
    const retry=await invoke('create_match',body,null,null,id);assert([403,409].includes(retry.status));
    assert.equal(sql(`SELECT count(*) FROM private.sc004_controllers WHERE match_id=${ql(first.data.match_id)}`),'0');
    const trainingId=crypto.randomUUID(),setup={player:{id:players[0].id,name:players[0].name},mode:'standard',length:10,config:{}};
    const training=await invoke('create_training',setup,null,null,trainingId);assert.equal(training.status,200);
    sql(`UPDATE private.sc004_training_controls SET expires_at=clock_timestamp()-interval '1 second' WHERE training_id=${ql(training.data.training_id)}`);
    assert.equal((await invoke('create_training',setup,null,null,trainingId)).status,403);
  });
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
  await check('Real commentary Edge fixture publishes authorized lines through actual Realtime',async()=>{
    const m=await fresh(),slot=await client.command('reserve_game',m.match_id,{game_number:1});
    const realtime=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const received=new Set();let resolveLines;const lines=new Promise(resolve=>resolveLines=resolve);
    let joined=false,databaseReady=false,ready;
    const channel=realtime.channel('commentary-'+run).on('system',{},message=>{if(message.status==='ok'&&message.message==='Subscribed to PostgreSQL'){databaseReady=true;ready?.();}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'game_commentary',filter:'game_id=eq.'+slot.game_id},payload=>{
      received.add(payload.new.id);if(received.size===3)resolveLines();
    });
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Commentary Realtime database subscribe timeout')),15000);ready=()=>{if(joined&&databaseReady){clearTimeout(timer);resolve();}};channel.subscribe(status=>{if(status==='SUBSCRIBED'){joined=true;ready();}else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(new Error(status));}});});
    try {
    const r=await fetchApi(url+'/functions/v1/commentary-fixture',{method:'POST',headers:{apikey:key,'Content-Type':'application/json','X-SQ-Match-Controller':cap(m.match_id)},body:JSON.stringify({game_id:slot.game_id,mode:'studio_intro'})});
    const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.equal(body.ok,true);
    assert.equal(must(await read.from('game_commentary').select('id').eq('game_id',slot.game_id)).length,3);
    const again=await fetchApi(url+'/functions/v1/commentary-fixture',{method:'POST',headers:{apikey:key,'Content-Type':'application/json','X-SQ-Match-Controller':cap(m.match_id)},body:JSON.stringify({game_id:slot.game_id,mode:'studio_intro'})});
    assert.equal(again.status,200);assert.equal(must(await read.from('game_commentary').select('id').eq('game_id',slot.game_id)).length,3);
    await Promise.race([lines,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Commentary Realtime events timeout')),15000))]);
    assert.equal(received.size,3);
    } finally {await realtime.removeChannel(channel);}
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
