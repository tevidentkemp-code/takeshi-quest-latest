/** Real isolated rollback acceptance. Run prepare, held, recovered around the
 * operator's actual app/Edge restoration and restricted function recovery.
 * The state file contains synthetic credentials and must never be published.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createClient } from '../ui-smoke/node_modules/@supabase/supabase-js/dist/index.mjs';
const phase=process.argv[2];
const expectedPhases=['prepare','held','recovered'];
if(!expectedPhases.includes(phase))throw new Error('Expected prepare, held or recovered.');
const manifestPath=process.env.SC004_ROLLBACK_MANIFEST;
if(!manifestPath)throw new Error('SC004_ROLLBACK_MANIFEST is required.');
const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes),anchorRoot=path.dirname(path.resolve(manifestPath));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.match(manifest.candidate_head||'',/^[a-f0-9]{40}$/,'Frozen candidate HEAD is required.');
assert(manifest.files&&typeof manifest.files==='object','Frozen file manifest is required.');
for(const [file,hash] of Object.entries(manifest.files)){
  const target=path.resolve(anchorRoot,file);
  assert(target.startsWith(anchorRoot+path.sep),'Frozen file must remain inside the anchor.');
  assert.match(hash,/^[a-f0-9]{64}$/,'Invalid frozen file digest.');
  assert.equal(sha256(fs.readFileSync(target)),hash,'Frozen artifact mismatch: '+file);
}
const anchor={candidate_head:manifest.candidate_head,manifest_sha256:sha256(manifestBytes)};
// Use the verified compatible transport, rather than the current checkout's client.
const {createSc004Client}=await import(pathToFileURL(path.join(anchorRoot,'app/src/services/sc004-client.mjs')).href);
const recoveryBytes=fs.readFileSync(path.join(anchorRoot,'restricted-recovery.sql'));
const guardBlocks=recoveryBytes.toString('utf8').match(/^DO \$check\$[\s\S]*?^END \$check\$;/gm);
assert.equal(guardBlocks?.length,1,'Expected one complete frozen recovery assertion block.');
const readonlyGuard=guardBlocks[0];
const config=JSON.parse(fs.readFileSync(process.env.SC004_LOCAL_ENV,'utf8'));
const url=config.API_URL||config.api_url,key=config.ANON_KEY||config.anon_key;
if(url!=='http://127.0.0.1:54821')throw new Error('Only the dedicated isolated local stack is allowed.');
const statePath=process.env.SC004_ROLLBACK_STATE,resultPath=process.env.SC004_ROLLBACK_RESULTS;
if(!statePath||!resultPath)throw new Error('Private state and public evidence paths are required.');
const state=phase==='prepare'?{storage:{},run:randomUUID().slice(0,8),run_id:randomUUID(),anchor}:JSON.parse(fs.readFileSync(statePath,'utf8'));
assert.match(state.run_id||'',/^[a-f0-9-]{36}$/,'Rollback run identity is required.');
assert.deepEqual(state.anchor,anchor,'Rollback state must use the same frozen anchor.');
const identity={run_id:state.run_id,...anchor};
const evidence=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath,'utf8')):{environment:'isolated-real-local-supabase',productionWrites:false,identity,expected_phases:expectedPhases,phases:[]};
assert.deepEqual(evidence.identity,identity,'Evidence must belong to the same rollback run and anchor.');
assert.deepEqual(evidence.expected_phases,expectedPhases);
assert.deepEqual(evidence.phases.map(p=>p.phase),expectedPhases.slice(0,expectedPhases.indexOf(phase)),'Rollback phases must run once, in order.');
for(const previous of evidence.phases)assert.deepEqual(previous.identity,identity,'Every platform phase must use the same rollback run and anchor.');
assert(evidence.phases.every(p=>p.checks.every(c=>c.pass)),'A failed phase cannot be reused as acceptance evidence.');
const persist=()=>{fs.writeFileSync(statePath,JSON.stringify(state),{mode:0o600});fs.chmodSync(statePath,0o600);};
const storage={getItem:k=>state.storage[k]??null,setItem:(k,v)=>{state.storage[k]=v;persist();},removeItem:k=>{delete state.storage[k];persist();}};
const authConfig={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const read=createClient(url,key,authConfig),auth=createClient(url,key,authConfig);
const credentials=JSON.parse(fs.readFileSync(process.env.SC004_BROWSER_AUTH_FILE,'utf8'));
const must=({data,error})=>{if(error)throw new Error(error.code||'Supabase request failed');return data;};
const signed=must(await auth.auth.signInWithPassword({email:credentials.email,password:credentials.password}));
let failBeforeSend=false;
const client=createSc004Client({endpoint:url+'/functions/v1/sq-match-control',publicKey:key,allowLocalFixture:true,storage,getAdminToken:async()=>signed.session.access_token,fetchImpl:async(target,init)=>{
  if(failBeforeSend)throw new Error('Deliberate transport interruption for recovery rehearsal');
  return fetch(target,{...init,headers:{...init.headers,Origin:'http://127.0.0.1:8127'}});
}});
const ql=v=>"'"+String(v).replaceAll("'","''")+"'";
const sql=q=>execFileSync('docker',['--host',process.env.SC004_DOCKER_HOST||'unix:///Users/Thom/.colima/sc004/docker.sock','exec','-i','supabase_db_sc004-supabase-local','psql','-U','postgres','-d','postgres','-At','--set','ON_ERROR_STOP=on','-c',q],{encoding:'utf8'}).trim();
const checks=[];
async function check(name,fn){try{const detail=await fn();checks.push({name,pass:true,...(detail?{evidence:detail}:{})});console.log('PASS '+name);}catch(e){checks.push({name,pass:false,code:e.code,message:String(e.message).slice(0,400)});console.log('FAIL '+name);}}
const board=()=>[0,1].map(pi=>Array.from({length:14},(_,ri)=>{const points=pi?0:ri<11?ri+10:ri===11?20:ri===12?30:25;return{darts:[{kind:pi?'Miss':ri<11?'S':ri===11?'Double':ri===12?'Triple':'B',points,...(!pi&&ri===13?{bull:'Outer'}:!pi&&ri>=11?{sector:10}:{})},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:points};}));
const accepted=async id=>must(await read.from('games').select('id,match_id,game_number,state,totals,created_at').eq('id',id).single());
await check('Actual enrolled Auth remains available for rollback administration',async()=>assert.equal((await client.admin({operation:'status'})).ok,true));
if(phase==='prepare'){
  await check('Prepare real accepted history and a distinct live pending game',async()=>{
    state.players=await Promise.all(['A','B'].map(s=>client.createPlayer({name:'SC004_ROLLBACK_'+state.run+'_'+s})));
    state.match=await client.createMatch({mode:'official',roster:state.players.map(p=>({id:p.id})),target_wins:3,match_format:'series'},crypto.randomUUID());
    state.first=await client.command('reserve_game',state.match.match_id,{game_number:1});
    const payload={state:{players:state.match.roster,board:board(),mode:'official'},totals:[240,0],winner_indexes:[0]};
    await client.completeGame(state.match.match_id,{...payload,game_id:state.first.game_id});
    state.acceptedBefore=await accepted(state.first.game_id);
    state.pending=await client.command('reserve_game',state.match.match_id,{game_number:2});
    state.pendingBody={...payload,game_id:state.pending.game_id};
    state.training=await client.createTraining({player:{id:state.players[0].id,name:state.players[0].name},mode:'standard',length:10,config:{}},crypto.randomUUID());
    state.trainingBody={player_name:state.players[0].name,mode:'standard',length:10,rounds_played:1,config:{},results:[{target:20,req:'any',darts:['double'],hits:1,points:40}],total_points:40,total_darts:1,total_hits:1,hit_pct:100};
    persist();
  });
  await check('Interrupted game and training saves remain in durable recovery queues',async()=>{
    failBeforeSend=true;
    try{
      await assert.rejects(()=>client.completeGame(state.match.match_id,state.pendingBody),e=>e.code==='network_unavailable');
      await assert.rejects(()=>client.completeTraining(state.training.training_id,state.trainingBody),e=>e.code==='network_unavailable');
    }finally{failBeforeSend=false;}
    assert.equal(client.pendingCompletions().length,1);assert.equal(client.pendingTraining().length,1);
    state.pendingQueueBefore=state.storage['sq.security.pending-completions.v1'];persist();
  });
}else{
  await check('The restored service recognizes the original match and training capabilities',async()=>{
    assert.equal((await client.command('resume',state.match.match_id)).match_id,state.match.match_id);
    assert.equal((await client.command('resume_training',state.training.training_id)).training_id,state.training.training_id);
    assert.deepEqual(await accepted(state.first.game_id),state.acceptedBefore);
  });
  await check('Restricted database recovery has not restored table, view or RPC mutation',async()=>{
    // Extract only the frozen DO assertion. This never changes the hold or grants.
    // The complete original guard includes legacy RPCs, sequences and private ACLs.
    sql('BEGIN TRANSACTION READ ONLY;\n'+readonlyGuard+'\nROLLBACK;');
    for(const token of [null,signed.session.access_token])for(const table of ['games','v_games_visible']){
      const headers={apikey:key,...(token?{Authorization:'Bearer '+token}:{})};
      const r=await fetch(url+'/rest/v1/'+table+'?id=eq.'+state.first.game_id,{method:'DELETE',headers});assert([401,403].includes(r.status));
    }
    return{restricted_recovery_sha256:sha256(recoveryBytes),readonly_assertion_sha256:sha256(readonlyGuard),roles:['anon','authenticated']};
  });
  if(phase==='held')await check('During actual rollback the hold rejects queued writes and keeps both payloads',async()=>{
    await assert.rejects(()=>client.retryCompletion(state.pending.game_id),e=>e.status===503);
    await assert.rejects(()=>client.completeTraining(state.training.training_id,state.trainingBody),e=>e.status===503);
    assert.equal(client.pendingCompletions().length,1);assert.equal(client.pendingTraining().length,1);
    assert.equal(state.storage['sq.security.pending-completions.v1'],state.pendingQueueBefore,'The hold must preserve both exact queued request envelopes.');
    assert.equal(sql(`SELECT count(*) FROM public.games WHERE id=${ql(state.pending.game_id)}`),'0');
    assert.equal(sql(`SELECT count(*) FROM public.training_sessions WHERE id=${ql(state.training.training_id)}`),'0');
  });
  if(phase==='recovered')await check('After restoration the same queues commit once without replacing accepted history',async()=>{
    const receipt=await client.retryCompletion(state.pending.game_id);assert.equal(receipt.game_id,state.pending.game_id);
    await client.completeTraining(state.training.training_id,state.trainingBody);
    await client.completeGame(state.match.match_id,state.pendingBody);
    await client.completeTraining(state.training.training_id,state.trainingBody);
    assert.equal(client.pendingCompletions().length,0);assert.equal(client.pendingTraining().length,0);
    assert.equal(sql(`SELECT count(*) FROM public.games WHERE match_id=${ql(state.match.match_id)}`),'2');
    assert.equal(sql(`SELECT count(*) FROM public.training_sessions WHERE id=${ql(state.training.training_id)}`),'1');
    assert.deepEqual(await accepted(state.first.game_id),state.acceptedBefore);
    assert.equal(sql(`SELECT wins::text FROM public.matches WHERE id=${ql(state.match.match_id)}`),'[2, 0]');
  });
}
evidence.phases.push({phase,identity,captured_at:new Date().toISOString(),checks});
evidence.complete=evidence.phases.length===expectedPhases.length;
evidence.passed=evidence.complete&&evidence.phases.every(p=>p.checks.every(c=>c.pass));
fs.writeFileSync(resultPath,JSON.stringify(evidence,null,2)+'\n');persist();
if(checks.some(c=>!c.pass))process.exitCode=1;
