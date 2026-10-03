/** Real local Supabase integration: Auth, Edge, PostgREST and Realtime.
 * Refuses every remote URL. Never creates a production test account or writes production.
 * Secrets are read from a chmod-600 local CLI status file and never included in results.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '../ui-smoke/node_modules/@supabase/supabase-js/dist/index.mjs';
import { createSc004Client } from '../../src/services/sc004-client.mjs';
import { runAdminCases, runLegacyRecoveryCases } from './admin-platform-cases.mjs';
import { runExtendedCases } from './platform-extended-cases.mjs';
import { runAvatarCases } from './avatar-platform-cases.mjs';
const cfg = JSON.parse(fs.readFileSync(process.env.SC004_LOCAL_ENV, 'utf8'));
const url = cfg.API_URL || cfg.api_url;
if (!/^http:\/\/127\.0\.0\.1:54821$/.test(url)) throw new Error('This suite only accepts the isolated SC004 local stack.');
const key = cfg.ANON_KEY || cfg.anon_key;
const serviceKey = cfg.SERVICE_ROLE_KEY || cfg.service_role_key;
const dockerHost = process.env.SC004_DOCKER_HOST || 'unix:///Users/Thom/.colima/sc004/docker.sock';
const container = 'supabase_db_sc004-supabase-local';
const outPath = process.env.SC004_RESULTS_PATH;
if (!outPath) throw new Error('SC004_RESULTS_PATH is required.');
const authOptions = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service = createClient(url,serviceKey,authOptions);
const read = createClient(url,key,authOptions);
const run = crypto.randomUUID().slice(0,8);
const ql = v => "'"+String(v).replaceAll("'","''")+"'";
const sql = query => execFileSync('docker',['--host',dockerHost,'exec','-i',container,'psql','-U','postgres','-d','postgres','-At','--set','ON_ERROR_STOP=on','-c',query],{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const results=[];
const save=()=>fs.writeFileSync(outPath,JSON.stringify({captured_at:new Date().toISOString(),environment:'isolated-real-local-supabase',productionWrites:false,auth:'real Auth API-created permanent users and signed sessions',counts:{passed:results.filter(x=>x.pass).length,total:results.length},results},null,2));
async function check(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});}save();console.log((results.at(-1).pass?'PASS ':'FAIL ')+name+(results.at(-1).pass?'':' — '+results.at(-1).message));}
const must=({data,error})=>{if(error)throw error;return data;};
const cache=()=>{const map=new Map();return{map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const endpoint=url+'/functions/v1/sq-match-control';
const origin='http://127.0.0.1:8127';
const fetchApi=(target,init={})=>fetch(target,{...init,headers:{...init.headers,Origin:origin}});
let adminJWT,ordinaryJWT;
const store=cache();
let loseResponse=false;
const client=createSc004Client({endpoint,publicKey:key,allowLocalFixture:true,storage:store,getAdminToken:async()=>adminJWT,fetchImpl:async(target,init)=>{const r=await fetchApi(target,init);if(loseResponse&&JSON.parse(init.body).action==='complete_game'&&r.ok){loseResponse=false;throw new Error('Deliberately lose reply after real commit');}return r;}});
const invoke=async(action,body={},capability,jwt,requestId=crypto.randomUUID())=>{
  const headers={'Content-Type':'application/json',apikey:key};
  if(capability)headers['X-SQ-Match-Controller']=capability;
  if(jwt)headers.Authorization='Bearer '+jwt;
  const r=await fetchApi(endpoint,{method:'POST',headers,body:JSON.stringify({action,request_id:requestId,body})});
  return {status:r.status,data:await r.json()};
};
const denied=r=>assert([400,401,403,404].includes(r.status),JSON.stringify({status:r.status,data:r.data}));
const cap=id=>JSON.parse(store.getItem('sq.security.match-credentials.v1'))[id].capability;
async function createAuthUser(label){
  const email=`sc004-${label}-${run}@example.invalid`,password=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')+'Aa9!';
  const user=must(await service.auth.admin.createUser({email,password,email_confirm:true})).user;
  const authClient=createClient(url,key,authOptions);
  const signed=must(await authClient.auth.signInWithPassword({email,password}));
  assert.equal(signed.user.id,user.id);assert.equal(signed.user.is_anonymous,false);
  return {id:user.id,jwt:signed.session.access_token,email,password};
}
let admin,ordinary,a,b,c,match,other,slot,receipt;
await check('Real Edge starts fail-closed while the database write hold is active',async()=>{
  const r=await invoke('create_player',{name:'SC004_held_'+run});
  assert.equal(r.status,503);
  sql('SELECT public.sq_sc004_set_hold(false)');
});
await check('Actual permanent Auth users authenticate; exact server allowlist grants admin only',async()=>{
  admin=await createAuthUser('admin');ordinary=await createAuthUser('ordinary');adminJWT=admin.jwt;ordinaryJWT=ordinary.jwt;
  sql(`INSERT INTO private.sc004_admins(user_id,enabled) VALUES(${ql(admin.id)}::uuid,true)`);
  const claims=JSON.parse(Buffer.from(adminJWT.split('.')[1],'base64url'));
  assert.equal(claims.role,'authenticated');assert.equal(claims.sub,admin.id);
  assert.equal(sql(`SELECT count(*) FROM auth.sessions WHERE id=${ql(claims.session_id)}::uuid AND user_id=${ql(admin.id)}::uuid`),'1');
  const status=await client.admin({operation:'status'});assert.equal(status.ok,true);
  if(process.env.SC004_BROWSER_AUTH_FILE)fs.writeFileSync(process.env.SC004_BROWSER_AUTH_FILE,JSON.stringify({email:admin.email,password:admin.password,user_id:admin.id,ordinaryEmail:ordinary.email,ordinaryPassword:ordinary.password}),{mode:0o600});
});
await check('Actual Edge rejects controller-free mutation and ordinary authenticated admin',async()=>{
  assert(ordinaryJWT,'Ordinary Auth session required for this case');
  denied(await invoke('reserve_game',{match_id:crypto.randomUUID(),game_number:1}));
  denied(await invoke('admin_action',{operation:'status'},null,ordinaryJWT));
});
await check('Public create-only registration succeeds and duplicate name cannot edit profile',async()=>{
  a=await client.createPlayer({name:`SC004_A_${run}`,initials:'A',avatar_id:1});
  b=await client.createPlayer({name:`SC004_B_${run}`,initials:'B',avatar_id:2});
  c=await client.createPlayer({name:`SC004_C_${run}`,initials:'C',avatar_id:3});
  await assert.rejects(()=>client.createPlayer({name:`SC004_A_${run}`,initials:'EVIL'}),e=>e.status===409);
  const row=must(await read.from('players').select('initials').eq('id',a.id).single());assert.equal(row.initials,'A');
});
await runAvatarCases({client,read,check,run});
await check('Real Edge and PostgreSQL issue independent server-scoped match controllers',async()=>{
  match=await client.createMatch({mode:'official',match_format:'series',roster:[{id:a.id},{id:b.id}],target_wins:3},crypto.randomUUID());
  other=await client.createMatch({mode:'official',match_format:'series',roster:[{id:a.id},{id:b.id}],target_wins:3},crypto.randomUUID());
  assert.notEqual(match.match_id,other.match_id);assert.equal(match.capability,undefined);
  assert.match(cap(match.match_id),/^sqmc1_[A-Za-z0-9_-]{43}$/);
});
await check('Cross-match capability, public UUID adoption and forged admin deny',async()=>{
  denied(await invoke('reserve_game',{match_id:other.match_id,game_number:1},cap(match.match_id)));
  denied(await invoke('create_match',{match_id:match.match_id,mode:'official',roster:[{id:a.id},{id:b.id}],target_wins:3}));
  const payload=JSON.parse(Buffer.from(adminJWT.split('.')[1],'base64url'));payload.sub=ordinary.id;
  const forged=adminJWT.split('.')[0]+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+adminJWT.split('.')[2];
  denied(await invoke('admin_action',{operation:'archive',game_id:crypto.randomUUID()},null,forged));
});
await check('Roster join/order/display edit remains scoped and resumes from the same credential',async()=>{
  const changed=await client.command('update_roster',match.match_id,{roster:[{id:b.id,initials:'B2'},{id:a.id},{id:c.id}]});
  match.roster=changed.roster;assert.equal(changed.roster.length,3);
  assert.equal(must(await read.from('players').select('initials').eq('id',b.id).single()).initials,'B');
  const reconnect=createSc004Client({endpoint,publicKey:key,allowLocalFixture:true,storage:store,fetchImpl:fetchApi});
  assert.deepEqual((await reconnect.command('resume',match.match_id)).roster,match.roster);
  await reconnect.command('renew',match.match_id);
  slot=await client.command('reserve_game',match.match_id,{game_number:1});
});
if(process.env.SC004_CLOSURE_SQL){
  await check('Additive Auth/admin/controller proof precedes exact guarded closure',async()=>{
    assert(results.every(x=>x.pass),'No closure after a failed additive proof');
    sql('SELECT public.sq_sc004_set_hold(true)');
    const closure=fs.readFileSync(process.env.SC004_CLOSURE_SQL,'utf8');
    execFileSync('docker',['--host',dockerHost,'exec','-i',container,'psql','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=on'],{input:closure,encoding:'utf8',maxBuffer:8*1024*1024});
    sql('SELECT public.sq_sc004_set_hold(false)');
  });
  // Downstream fixtures assume restricted privileges. Keep the hold and stop
  // immediately if the exact closure guard rejected drift.
  if(!results.at(-1).pass){save();process.exit(1);}
}
if(process.env.SC004_PHASE==='additive') {
  save();process.exit(results.every(x=>x.pass)?0:1);
}
const board=(n)=>Array.from({length:n},(_,pi)=>Array.from({length:14},(_,ri)=>{
  const points=pi===0?(ri<11?ri+10:ri===11?20:ri===12?30:25):0;
  return{darts:[{kind:pi?'Miss':ri<11?'S':ri===11?'Double':ri===12?'Triple':'B',points,...(!pi&&ri===13?{bull:'Outer'}:!pi&&ri>=11?{sector:10}:{})},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:points};
}));
await check('Accepted completion persists actual scores atomically; lost reply retries idempotently',async()=>{
  const body={game_id:slot.game_id,state:{players:match.roster,board:board(match.roster.length),mode:'official'},totals:[240,0,0],winner_indexes:[0]};
  loseResponse=true;try{await assert.rejects(()=>client.completeGame(match.match_id,body),e=>e.code==='network_unavailable');}finally{loseResponse=false;}
  assert.equal(client.pendingCompletions().length,1);
  receipt=await client.retryCompletion(slot.game_id);assert.equal(receipt.game_id,slot.game_id);assert.equal(client.pendingCompletions().length,0);
  const row=must(await read.from('games').select('id,match_id,totals,finished').eq('id',slot.game_id).single());
  assert.equal(row.match_id,match.match_id);assert.deepEqual(row.totals,[240,0,0]);assert.equal(row.finished,true);
  assert.equal(must(await read.from('high_scores_sp').select('game_id').eq('game_id',slot.game_id)).length,1);
  const conflict={...body,totals:[999,0,0]};await assert.rejects(()=>client.completeGame(match.match_id,conflict),e=>e.status===409);
});
if(!results.at(-1).pass){save();process.exit(1);}
await check('Authorized go event accepts exact retry and rejects a foreign player',async()=>{
  const body={game_id:slot.game_id,player_id:b.id,round_number:1,go_number:1,started_at:new Date().toISOString(),ended_at:new Date().toISOString()};
  await client.command('log_go',match.match_id,body);await client.command('log_go',match.match_id,body);
  assert.equal(must(await read.from('player_go_events').select('game_id').eq('game_id',slot.game_id)).length,1);
  denied(await invoke('log_go',{...body,match_id:match.match_id,player_id:crypto.randomUUID()},cap(match.match_id)));
});
await check('Authorized event writes derive identity and points only from the accepted board',async()=>{
  const body={match_id:match.match_id,game_id:slot.game_id,event:{player_id:b.id,round_index:0,dart_index:0}};
  const first=await invoke('append_event',body,cap(match.match_id));assert.equal(first.status,200);
  const again=await invoke('append_event',body,cap(match.match_id));assert.equal(again.data.event_id,first.data.event_id);
  assert.equal((await invoke('append_event',{...body,event:{...body.event,points:999}},cap(match.match_id))).status,400);
  assert.equal((await invoke('append_event',{...body,game_id:crypto.randomUUID()},cap(match.match_id))).status,403);
  const event=must(await read.from('game_events').select('points,player_id').eq('id',first.data.event_id).single());
  assert.equal(event.points,10);assert.equal(event.player_id,b.id);
});
await check('Only own pending slot and empty match can be cleaned; accepted game survives',async()=>{
  const pending=await client.command('reserve_game',other.match_id,{game_number:1});
  denied(await invoke('cleanup_game',{match_id:match.match_id,game_id:pending.game_id},cap(match.match_id)));
  await client.command('cleanup_game',other.match_id,{game_id:pending.game_id});await client.command('cleanup_match',other.match_id);
  await assert.rejects(()=>client.command('cleanup_game',match.match_id,{game_id:slot.game_id}),e=>[400,403].includes(e.status));
  assert.equal(must(await read.from('games').select('id').eq('id',slot.game_id)).length,1);
});
await check('Direct real PostgREST table and writable-view mutation deny for anon and ordinary Auth',async()=>{
  const catalog=JSON.parse(fs.readFileSync(process.env.SC004_CATALOG,'utf8'));
  const tables=catalog.tables.filter(t=>t.schema==='public'&&t.kind==='r').map(t=>t.name).concat('v_games_visible');
  let n=0;
  for(const jwt of [null,ordinaryJWT])for(const table of tables){
    const column=table==='v_games_visible'?'id':catalog.columns.find(c=>c.schema==='public'&&c.table===table&&!c.generated).name;
    for(const method of ['POST','PATCH','DELETE']){
      const headers={apikey:key,'Content-Type':'application/json',Prefer:'return=representation'};if(jwt)headers.Authorization='Bearer '+jwt;
      const r=await fetch(url+'/rest/v1/'+table+(method==='POST'?'':'?'+column+'=is.null'),{method,headers,...(method==='DELETE'?{}:{body:JSON.stringify({[column]:null})})});
      const data=await r.json();assert([401,403].includes(r.status),JSON.stringify({table,method,status:r.status,code:data?.code}));n++;
    }
  }
  assert.equal(n,114);
});
await check('Actual Data API denies both go signatures, merge RPC and private command access',async()=>{
  for(const jwt of [null,ordinaryJWT]){
    const headers={apikey:key,'Content-Type':'application/json'};if(jwt)headers.Authorization='Bearer '+jwt;
    for(const [rpc,args] of [
      ['log_player_go',{p_game_id:slot.game_id,p_player_id:a.id,p_round_number:1,p_go_number:1,p_started_at:new Date().toISOString(),p_ended_at:new Date().toISOString()}],
      ['sq_sc004_command',{p_action:'resume',p_token_hash:'a'.repeat(64),p_body:{match_id:match.match_id}}],
    ]){const r=await fetch(url+'/rest/v1/rpc/'+rpc,{method:'POST',headers,body:JSON.stringify(args)});const d=await r.json();assert([401,403].includes(r.status),JSON.stringify({rpc,status:r.status,code:d.code}));}
  }
  assert.equal(sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='log_player_go' AND p.pronargs=10"),'0');
  assert.equal(sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('rename_player_merge','merge_player_name_everywhere') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))"),'0');
});
await check('Existing commentary Edge denies anonymous and foreign game before model/service writes',async()=>{
  for(const capability of [null,cap(match.match_id)]){
    const headers={apikey:key,'Content-Type':'application/json'};if(capability)headers['X-SQ-Match-Controller']=capability;
    const r=await fetchApi(url+'/functions/v1/commentary_generate',{method:'POST',headers,body:JSON.stringify({game_id:crypto.randomUUID(),mode:'studio_intro'})});assert([401,403].includes(r.status));
  }
});
await check('Verified admin profile/archive/reinstate use actual Auth session and exact game ID',async()=>{
  await client.admin({operation:'update_player',player_id:a.id,profile:{initials:'AD'}});
  assert.equal(must(await read.from('players').select('initials').eq('id',a.id).single()).initials,'AD');
  await client.admin({operation:'archive',game_id:slot.game_id});
  await client.admin({operation:'reinstate',game_id:slot.game_id});
  assert.equal(must(await read.from('v_games_visible').select('id').eq('id',slot.game_id)).length,1);
});
await check('Real Realtime subscription receives published commentary without public write authority',async()=>{
  const realtime=createClient(url,key,{...authOptions,realtime:{params:{eventsPerSecond:10}}});
  const marker='SC004 realtime '+run;
  let resolveEvent;const event=new Promise(resolve=>resolveEvent=resolve);
  let joined=false,databaseReady=false,ready;
  const channel=realtime.channel('sc004-'+run).on('system',{},message=>{if(message.status==='ok'&&message.message==='Subscribed to PostgreSQL'){databaseReady=true;ready?.();}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'game_commentary'},payload=>{if(JSON.stringify(payload).includes(marker))resolveEvent(payload);});
  // A channel join can precede the PostgreSQL subscription acknowledgement.
  // Start the write only after both real platform readiness events arrive.
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Realtime database subscribe timeout')),15000);ready=()=>{if(joined&&databaseReady){clearTimeout(timer);resolve();}};channel.subscribe(status=>{if(status==='SUBSCRIBED'){joined=true;ready();}else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(new Error(status));}});});
  try{
    // A trusted fixture producer; the same table/publication is used by authorized commentary.
    const cols=sql("SELECT jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable,'default',column_default)) FROM information_schema.columns WHERE table_schema='public' AND table_name='game_commentary'");
    const schema=JSON.parse(cols),row={};
    for(const c of schema){if(c.name==='game_id')row[c.name]=slot.game_id;else if(['text','commentary','content'].includes(c.name))row[c.name]=marker;else if(c.nullable==='NO'&&!c.default){if(c.type==='text')row[c.name]=marker;else if(c.type==='integer')row[c.name]=1;else if(c.type==='jsonb')row[c.name]={marker};}}
    must(await service.from('game_commentary').insert(row));
    await Promise.race([event,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Realtime event timeout')),15000))]);
  }finally{await realtime.removeChannel(channel);}
});
await check('Server allowlist revoke immediately denies a still-signed admin JWT',async()=>{
  sql(`UPDATE private.sc004_admins SET enabled=false WHERE user_id=${ql(admin.id)}::uuid`);
  await assert.rejects(()=>client.admin({operation:'update_player',player_id:a.id,profile:{initials:'BAD'}}),e=>e.status===403);
  sql(`UPDATE private.sc004_admins SET enabled=true WHERE user_id=${ql(admin.id)}::uuid`);
});
await runAdminCases({admin:body=>client.admin(body),sql,check,run});
await runLegacyRecoveryCases({recover:(id,settings)=>client.recoverLegacyMatch(id,settings),command:(...args)=>client.command(...args),complete:(id,body)=>client.completeGame(id,body),sql,check,run});
await runExtendedCases({check,client,sql,invoke,cap,read,must,service,createAuthUser,ordinaryJWT,url,key,fetchApi,run,players:[a,b]});
save();console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,total:results.length}));
process.exit(results.every(x=>x.pass)?0:1);
