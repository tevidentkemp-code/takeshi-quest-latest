import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setupFixture } from './fixture.mjs';
import { createSc004Handler } from '../../docs/backend/sc004-proposal/handler.mjs';
import { createSc004Client } from '../../docs/backend/sc004-proposal/client-adapter.mjs';

const results = [];
let f;
try { f = await setupFixture(); }
catch(e) { console.error(JSON.stringify({stage:'fixture setup',code:e.code,message:e.message,position:e.position}));process.exit(2); }
async function check(name, work) {
  try { await work(); results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, code: e.code, message: e.message }); }
  console.log((results.at(-1).pass ? 'PASS ' : 'FAIL ') + name);
}
async function denied(work, code) {
  await assert.rejects(work, e => e.code === code);
}
const A='00000000-0000-4000-8000-000000000201', B='00000000-0000-4000-8000-000000000202', C='00000000-0000-4000-8000-000000000203';
const oldMatch='00000000-0000-4000-8000-000000000001', oldGame='00000000-0000-4000-8000-000000000101';
const admin='00000000-0000-4000-8000-000000000401', session='00000000-0000-4000-8000-000000000501';
const verifiedUser={ id:admin,is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00Z' };
const claims={ sub:admin,role:'authenticated',session_id:session,iss:'fixtureissuer',exp:Math.floor(Date.now()/1000)+3600,is_anonymous:false };
const token='e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.fixtureSignature';
const handler=createSc004Handler({ command:f.rpcAdapter,expectedAuthIssuer:'fixtureissuer',getUser:async jwt=>jwt===token?{data:{user:verifiedUser},error:null}:{data:{user:null},error:{message:'fixture denied'}} });
const cache=new Map();const storage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
let loseNextCompletion=false;
const fetchImpl=async (url, init)=>{
  const response=await handler(new Request(url,init));
  if(loseNextCompletion && JSON.parse(init.body).action==='complete_game' && response.ok){loseNextCompletion=false;throw new Error('simulated lost response after actual commit');}
  return response;
};
const client=createSc004Client({endpoint:'http://localhost/sc004',publicKey:'sb_publishable_fixture',allowLocalFixture:true,fetchImpl,storage,getAdminToken:async()=>token});
const invoke=async (action,body={},capability)=>{
  const h={'content-type':'application/json'};if(capability)h['x-sq-match-controller']=capability;
  const response=await handler(new Request('http://localhost/sc004',{method:'POST',headers:h,body:JSON.stringify({action,request_id:crypto.randomUUID(),body})}));
  return {status:response.status,data:await response.json()};
};
const row=(points=0)=>({darts:Array.from({length:3},()=>points?{kind:'S',points}:{kind:'Miss',points:0}),roundTotal:points*3});
const board=(n,points=10)=>Array.from({length:n},()=>Array.from({length:14},()=>row(points)));
const bodyFor=(match,slot)=>({game_id:slot.game_id,state:{players:match.roster,board:board(match.roster.length),mode:match.mode},totals:match.roster.map(()=>420)});
let m1,m2,slot1,receipt,firstPayload;
try {
  await check('All 18 tables deny direct INSERT/UPDATE/DELETE/TRUNCATE to anon and authenticated',async()=>{
    let assertions=0;
    for(const role of ['anon','authenticated'])for(const table of f.tables){
      const column=f.schema.columns.find(c=>c.table_schema==='public'&&c.table_name===table.name).column_name;
      for(const sql of ['INSERT INTO public.'+f.qi(table.name)+' DEFAULT VALUES','UPDATE public.'+f.qi(table.name)+' SET '+f.qi(column)+'='+f.qi(column)+' WHERE false','DELETE FROM public.'+f.qi(table.name)+' WHERE false','TRUNCATE public.'+f.qi(table.name)]){
        await denied(()=>f.asRole(role,sql),'42501');assertions++;
      }
    }
    assert.equal(assertions,144);
  });
  await check('Both log_player_go overloads deny anon and authenticated EXECUTE individually',async()=>{
    for(const role of ['anon','authenticated']){
      await denied(()=>f.asRole(role,"SELECT public.log_player_go($1::uuid,$2::uuid,1,1,now(),now())",[oldGame,A]),'42501');
      await denied(()=>f.asRole(role,"SELECT public.log_player_go($1::uuid,$2::uuid,1,1,gen_random_uuid(),now(),now(),'completed',true,'fixture')",[oldGame,A]),'42501');
    }
  });
  await check('Writable owner view blocks every write and preserves existing SELECT',async()=>{
    for(const role of ['anon','authenticated'])for(const sql of ['UPDATE public.v_games_visible SET finished=true WHERE false','DELETE FROM public.v_games_visible WHERE false','INSERT INTO public.v_games_visible DEFAULT VALUES'])await denied(()=>f.asRole(role,sql),'42501');
    assert.equal((await f.asRole('anon','SELECT id FROM public.v_games_visible')).rows.length,1);
  });
  await check('Direct service RPC denies public role despite guessed request and registry hashes',async()=>{
    await denied(()=>f.asRole('anon',"SELECT public.sq_sc004_command('resume',$1,$2::jsonb)",['a'.repeat(64),JSON.stringify({match_id:oldMatch,request_id:crypto.randomUUID()})]),'42501');
  });
  await check('Private registry and Auth session tables inaccessible to public roles',async()=>{
    for(const role of ['anon','authenticated'])for(const table of ['private.sc004_controllers','private.sc004_slots','private.sc004_admins','auth.users','auth.sessions'])await denied(()=>f.asRole(role,'SELECT * FROM '+table),'42501');
  });
  await check('Protected mutation without controller is denied before SQL',async()=>{
    assert.equal((await invoke('reserve_game',{match_id:oldMatch,game_number:1})).status,401);
  });
  await check('Guessed well-formed capability cannot claim historical match',async()=>{
    assert.equal((await invoke('reserve_game',{match_id:oldMatch,game_number:1},'sqmc1_'+'A'.repeat(43))).status,403);
  });
  await check('Current client -> handler -> actual SQL creates new match and stores only capability hash server-side',async()=>{
    m1=await client.createMatch({mode:'official',roster:[{id:A},{id:B}],target_wins:3});
    m2=await client.createMatch({mode:'official',roster:[{id:A},{id:B}],target_wins:1});
    assert.notEqual(m1.match_id,oldMatch);assert.notEqual(m2.match_id,m1.match_id);assert.equal(m1.capability,undefined);
    const r=(await f.db.query('SELECT token_hash,match_id FROM private.sc004_controllers')).rows;
    assert.equal(r.length,2);assert(r.every(x=>/^[a-f0-9]{64}$/.test(x.token_hash)));
    assert(!JSON.stringify(r).includes('sqmc1_'));
  });
  await check('Match A controller cannot alter Match B even with known IDs',async()=>{
    const hash=(await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[m1.match_id])).rows[0].token_hash;
    await denied(()=>f.command('reserve_game',hash,{match_id:m2.match_id,game_number:1}),'42501');
    await assert.rejects(()=>client.command('reserve_game',m1.match_id,{match_id:m2.match_id,game_number:1}),e=>e.code==='scope_denied');
  });
  await check('Low-friction registration creates a new stable player without modifying same-name profile',async()=>{
    const player=await client.createPlayer({name:'SYNTHETIC_NEW',initials:'NEW',avatar_id:4});assert.match(player.id,/^[0-9a-f-]{36}$/);
    await assert.rejects(()=>client.createPlayer({name:'SYNTHETIC_A',initials:'BAD'}),e=>e.status===409);
    assert.equal((await f.db.query('SELECT initials FROM players WHERE id=$1',[A])).rows[0].initials,'OLD');
    assert.equal((await invoke('create_player',{id:A,name:'FAKE'})).status,400);
  });
  await check('Roster join, reorder, removal and scoped display edit preserve persistent profiles',async()=>{
    const roster=[{id:B,name:'SYNTHETIC_B',initials:'B2',avatar_id:5,nickname:'MATCH ONLY'},{id:A,name:'SYNTHETIC_A'},{id:C,name:'SYNTHETIC_C'}];
    const changed=await client.command('update_roster',m1.match_id,{roster});assert.equal(changed.roster.length,3);assert.equal(changed.roster[0].id,B);
    const smaller=await client.command('update_roster',m1.match_id,{roster:changed.roster.slice(0,2)});m1={...m1,roster:smaller.roster};
    assert.equal((await f.db.query('SELECT initials,avatar_id,nickname FROM players WHERE id=$1',[B])).rows[0].initials,'B');
    await assert.rejects(()=>client.command('update_roster',m1.match_id,{roster:[{id:A,name:'RENAMED'},{id:B}]}),e=>e.status===400);
  });
  await check('Resume/reconnect uses credential cache as proof only when live registry accepts it',async()=>{
    const reconnect=createSc004Client({endpoint:'http://localhost/sc004',publicKey:'sb_publishable_fixture',allowLocalFixture:true,fetchImpl,storage});
    const r=await reconnect.command('resume',m1.match_id);assert.deepEqual(r.roster,m1.roster);
    const before=(await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[m1.match_id])).rows[0].token_hash;
    await reconnect.command('renew',m1.match_id);
    assert.equal((await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[m1.match_id])).rows[0].token_hash,before);
  });
  await check('Game reservation is server-assigned, sequential and retry-idempotent',async()=>{
    slot1=await client.command('reserve_game',m1.match_id,{game_number:1});
    assert.deepEqual(await client.command('reserve_game',m1.match_id,{game_number:1}),slot1);
    await assert.rejects(()=>client.command('reserve_game',m1.match_id,{game_number:3}),e=>e.status===400);
    await assert.rejects(()=>client.command('reserve_game',m1.match_id,{game_number:2}),e=>e.status===400);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[slot1.game_id])).rows[0].n,0);
  });
  await check('Malformed boards, forged stats and nested foreign-match IDs are denied without commit',async()=>{
    const hash=(await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[m1.match_id])).rows[0].token_hash;
    const base={...bodyFor(m1,slot1),match_id:m1.match_id};
    const missing=structuredClone(base);delete missing.state.board[0][0].darts;
    await denied(()=>f.command('complete_game',hash,missing),'22023');
    const aggregate=structuredClone(base);aggregate.state.board[0][0].roundTotal=180;aggregate.totals[0]+=150;
    await denied(()=>f.command('complete_game',hash,aggregate),'22023');
    await denied(()=>f.command('complete_game',hash,{...base,stats:{player_id:C,score:999}}),'22023');
    await denied(()=>f.command('complete_game',hash,{...base,state:{...base.state,matchId:m2.match_id}}),'42501');
    assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[slot1.game_id])).rows[0].n,0);
  });
  await check('Lost completion response resumes exact payload and produces one game and one score per player',async()=>{
    firstPayload=bodyFor(m1,slot1);loseNextCompletion=true;
    await assert.rejects(()=>client.completeGame(m1.match_id,firstPayload),e=>e.code==='network_unavailable');
    assert.equal(client.pendingCompletions().length,1);
    const reconnect=createSc004Client({endpoint:'http://localhost/sc004',publicKey:'sb_publishable_fixture',allowLocalFixture:true,fetchImpl,storage});
    receipt=await reconnect.retryCompletion(slot1.game_id);assert.equal(receipt.game_id,slot1.game_id);assert.equal(reconnect.pendingCompletions().length,0);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[slot1.game_id])).rows[0].n,1);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM high_scores_sp WHERE game_id=$1',[slot1.game_id])).rows[0].n,2);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM high_scores WHERE game_id=$1',[slot1.game_id])).rows[0].n,0);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM high_scores_sp hs JOIN games g ON g.id=hs.game_id WHERE g.id=$1 AND hs.ts=g.created_at',[slot1.game_id])).rows[0].n,2);
  });
  await check('Conflicting completion cannot overwrite accepted throws or scores',async()=>{
    const hash=(await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[m1.match_id])).rows[0].token_hash;
    await denied(()=>f.command('complete_game',hash,{...firstPayload,match_id:m1.match_id,totals:[1,2]}),'23505');
    assert.deepEqual((await f.db.query('SELECT totals FROM games WHERE id=$1',[slot1.game_id])).rows[0].totals,[420,420]);
    assert.deepEqual((await f.db.query('SELECT wins FROM matches WHERE id=$1',[m1.match_id])).rows[0].wins,[1,1]);
  });
  await check('Approved six-argument go wrapper records frozen-roster event and accepts exact retry only',async()=>{
    const go={game_id:slot1.game_id,player_id:B,round_number:1,go_number:1,started_at:'2026-01-01T00:00:00Z',ended_at:'2026-01-01T00:00:01Z'};
    assert.equal((await client.command('log_go',m1.match_id,go)).ok,true);await client.command('log_go',m1.match_id,go);
    await assert.rejects(()=>client.command('log_go',m1.match_id,{...go,ended_at:'2026-01-01T00:00:02Z'}),e=>e.status===409);
    await client.command('update_roster',m1.match_id,{roster:[...m1.roster,{id:C,name:'SYNTHETIC_C'}]});
    await assert.rejects(()=>client.command('log_go',m1.match_id,{...go,player_id:C}),e=>e.status===400);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM player_go_events WHERE game_id=$1',[slot1.game_id])).rows[0].n,1);
  });
  await check('Own failed-save cleanup changes pending slot only; completed and foreign games protected',async()=>{
    const pending=await client.command('reserve_game',m1.match_id,{game_number:2});
    await client.command('cleanup_game',m1.match_id,{game_id:pending.game_id});
    await client.command('cleanup_game',m1.match_id,{game_id:pending.game_id});
    assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[pending.game_id])).rows[0].n,0);
    await assert.rejects(()=>client.command('cleanup_game',m1.match_id,{game_id:slot1.game_id}),e=>e.status===403);
    await assert.rejects(()=>client.command('cleanup_game',m1.match_id,{game_id:oldGame}),e=>e.status===403);
  });
  await check('Accepted participant replacement and late joins after Game2 reservation are denied',async()=>{
    await assert.rejects(()=>client.command('update_roster',m1.match_id,{roster:[{id:A},{id:C}]}),e=>e.status===400);
    const existing=await client.command('resume',m1.match_id);
    const next=(await f.db.query("SELECT id,name FROM players WHERE name='SYNTHETIC_NEW'")).rows[0];
    await assert.rejects(()=>client.command('update_roster',m1.match_id,{roster:[...existing.roster,next]}),e=>e.status===400);
    const reordered=await client.command('update_roster',m1.match_id,{roster:[...existing.roster].reverse()});assert.equal(reordered.roster[0].id,C);
    assert.deepEqual((await f.db.query('SELECT state FROM games WHERE id=$1',[slot1.game_id])).rows[0].state.players,firstPayload.state.players);
  });
  await check('Practice, Turbo and Vs Shadow persist correct isolated scores and real players',async()=>{
    for(const mode of ['practice','turbo','vs_shadow']){
      const roster=mode==='turbo'?[{id:A},{id:B}]:[{id:A}];
      const match=await client.createMatch({mode,roster,target_wins:mode==='turbo'?3:undefined});
      const slot=await client.command('reserve_game',match.match_id,{game_number:1});
      const payload=bodyFor(match,slot);
      if(mode==='turbo'){
        payload.state.board=Array.from({length:2},()=>Array.from({length:14},(_,i)=>i<7?{darts:[null,null,null],roundTotal:0}:row(10)));
        payload.totals=[210,210];payload.state.gameFormat='match_play';payload.state.gameVariant='turbo';payload.state.startTarget='17';payload.state.strictTimer=true;payload.state.throwLimitSeconds=20;
      }
      await client.completeGame(match.match_id,payload);
      const official=(await f.db.query('SELECT count(*)::int n FROM high_scores_sp WHERE game_id=$1',[slot.game_id])).rows[0].n;
      const practice=(await f.db.query('SELECT count(*)::int n FROM high_scores WHERE game_id=$1',[slot.game_id])).rows[0].n;
      assert.equal(official,0);assert.equal(practice,mode==='turbo'?0:1);
      if(mode!=='turbo')await assert.rejects(()=>client.command('reserve_game',match.match_id,{game_number:2}),e=>e.status===400);
      assert(!JSON.stringify((await f.db.query('SELECT state FROM games WHERE id=$1',[slot.game_id])).rows[0]).includes('"name":"Shadow"'));
    }
  });
  await check('Saved-player positive-score eligibility excludes guest and zero high-score rows',async()=>{
    const match=await client.createMatch({mode:'practice',roster:[{id:A},{id:B},{name:'SYNTHETIC_GUEST'}]});
    const slot=await client.command('reserve_game',match.match_id,{game_number:1});
    const payload=bodyFor(match,slot);payload.state.board[1]=Array.from({length:14},()=>row(0));payload.totals=[420,0,420];
    await client.completeGame(match.match_id,payload);
    const scores=(await f.db.query('SELECT player_id,score FROM high_scores WHERE game_id=$1',[slot.game_id])).rows;
    assert.deepEqual(scores,[{player_id:A,score:420}]);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM high_scores_sp WHERE game_id=$1',[slot.game_id])).rows[0].n,0);
  });
  await check('Turbo permits guests while Vs Shadow permits exactly one real player',async()=>{
    const turbo=await client.createMatch({mode:'turbo',roster:[{id:A},{name:'SYNTHETIC_TURBO_GUEST'}],target_wins:3});assert.equal(turbo.roster[1].id,null);
    await assert.rejects(()=>client.createMatch({mode:'vs_shadow',roster:[{id:A},{id:B}]}),e=>e.status===400);
    await assert.rejects(()=>client.createMatch({mode:'vs_shadow',roster:[{name:'Shadow'}]}),e=>e.status===400);
  });
  await check('Expired and revoked controllers fail live registry recheck; cache cannot revive them',async()=>{
    await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()-interval '1 second' WHERE match_id=$1",[m2.match_id]);
    await assert.rejects(()=>client.command('resume',m2.match_id),e=>e.status===403);
    await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()+interval '1 hour' WHERE match_id=$1",[m2.match_id]);
    await client.command('revoke_controller',m2.match_id);
    const hash=(await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[m2.match_id])).rows[0].token_hash;
    await denied(()=>f.command('resume',hash,{match_id:m2.match_id}),'42501');
  });
  await check('Empty controller-created match cleanup removes private pending scope and never accepted history',async()=>{
    const empty=await client.createMatch({mode:'vs_shadow',roster:[{id:A}]});
    await client.command('reserve_game',empty.match_id,{game_number:1});
    await client.command('cleanup_match',empty.match_id);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM matches WHERE id=$1',[empty.match_id])).rows[0].n,0);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM private.sc004_slots WHERE match_id=$1',[empty.match_id])).rows[0].n,0);
    await assert.rejects(()=>client.command('cleanup_match',m1.match_id),e=>e.status===403);
    const orphan=await client.createMatch({mode:'practice',roster:[{id:A}]});
    await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()-interval '1 second' WHERE match_id=$1",[orphan.match_id]);
    const removed=(await f.asRole('service_role','SELECT public.sq_sc004_prune_expired_empty(100) AS n')).rows[0].n;assert.equal(removed,1);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM matches WHERE id=$1',[orphan.match_id])).rows[0].n,0);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[oldGame])).rows[0].n,1);
    await denied(()=>f.asRole('anon','SELECT public.sq_sc004_prune_expired_empty(100)'),'42501');
  });
  await check('Recovery cache enqueue failure prevents submission; acknowledgement failure retains exact retry',async()=>{
    let failMode=null;
    const separateCache=new Map();
    const unreliable={getItem:k=>separateCache.get(k)||null,setItem:(k,v)=>{
      if(k.includes('pending-completions')&&((failMode==='enqueue'&&v!=='{}')||(failMode==='ack'&&v==='{}'))){failMode=null;throw new Error('synthetic storage write failure');}
      separateCache.set(k,v);
    }};
    const recovery=createSc004Client({endpoint:'http://localhost/sc004',publicKey:'sb_publishable_fixture',allowLocalFixture:true,fetchImpl,storage:unreliable});
    const match=await recovery.createMatch({mode:'practice',roster:[{id:A}]});const slot=await recovery.command('reserve_game',match.match_id,{game_number:1});const payload=bodyFor(match,slot);
    failMode='enqueue';await assert.rejects(()=>recovery.completeGame(match.match_id,payload),e=>e.code==='recovery_cache_unavailable');
    assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[slot.game_id])).rows[0].n,0);assert.equal(recovery.pendingCompletions().length,0);
    failMode='ack';await assert.rejects(()=>recovery.completeGame(match.match_id,payload),e=>e.code==='recovery_cache_unavailable');
    assert.equal(recovery.pendingCompletions().length,1);await recovery.retryCompletion(slot.game_id);assert.equal(recovery.pendingCompletions().length,0);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM high_scores WHERE game_id=$1',[slot.game_id])).rows[0].n,1);
  });
  await check('Admin and commentary cannot be authorized by controller, UI flags or arbitrary JSON authority',async()=>{
    assert.equal((await invoke('admin_action',{operation:'purge',game_id:oldGame})).status,401);
    assert.equal((await invoke('admin_action',{operation:'purge',game_id:oldGame,is_admin:true})).status,400);
    assert.equal((await invoke('commentary_generate',{game_id:oldGame})).status,400);
  });
  await check('Admin requires permanent confirmed user, allowlist and live matching session every request',async()=>{
    await f.db.query('INSERT INTO auth.users(id,is_anonymous,email_confirmed_at) VALUES($1,false,now())',[admin]);
    await f.db.query('INSERT INTO auth.sessions(id,user_id,not_after) VALUES($1,$2,now()+interval \'1 hour\')',[session,admin]);
    await assert.rejects(()=>client.admin({operation:'archive',game_id:oldGame}),e=>e.status===403);
    await f.db.query('INSERT INTO private.sc004_admins(user_id,enabled) VALUES($1,true)',[admin]);
    assert.equal((await client.admin({operation:'archive',game_id:oldGame})).ok,true);
    assert.notEqual((await f.db.query('SELECT archived_at FROM games WHERE id=$1',[oldGame])).rows[0].archived_at,null);
    await f.db.query('UPDATE private.sc004_admins SET enabled=false WHERE user_id=$1',[admin]);
    await assert.rejects(()=>client.admin({operation:'reinstate',game_id:oldGame}),e=>e.status===403);
    await f.db.query('UPDATE private.sc004_admins SET enabled=true WHERE user_id=$1',[admin]);
    await f.db.query('UPDATE auth.sessions SET not_after=now()-interval \'1 second\' WHERE id=$1',[session]);
    await assert.rejects(()=>client.admin({operation:'reinstate',game_id:oldGame}),e=>e.status===403);
    await f.db.query('UPDATE auth.sessions SET not_after=now()+interval \'1 hour\' WHERE id=$1',[session]);
    await f.db.query('UPDATE auth.users SET is_anonymous=true WHERE id=$1',[admin]);
    await assert.rejects(()=>client.admin({operation:'reinstate',game_id:oldGame}),e=>e.status===403);
    await f.db.query('UPDATE auth.users SET is_anonymous=false WHERE id=$1',[admin]);
    await client.admin({operation:'reinstate',game_id:oldGame});
    await client.admin({operation:'update_player',player_id:A,profile:{initials:'ADM'}});
    assert.equal((await f.db.query('SELECT initials FROM players WHERE id=$1',[A])).rows[0].initials,'ADM');
    assert.equal((await f.db.query('SELECT count(*)::int n FROM private.sc004_admin_audit')).rows[0].n,3);
  });
  await check('Safe hold rejects writes, preserves reads/resume/pending payload; trusted resumption retains closure',async()=>{
    const heldCache=new Map([...cache].filter(([k])=>!k.includes('pending-completions')));
    const heldStorage={getItem:k=>heldCache.get(k)||null,setItem:(k,v)=>heldCache.set(k,v)};
    const heldClient=createSc004Client({endpoint:'http://localhost/sc004',publicKey:'sb_publishable_fixture',allowLocalFixture:true,fetchImpl,storage:heldStorage});
    const active=await heldClient.command('resume',m1.match_id);const slot=await heldClient.command('reserve_game',m1.match_id,{game_number:3});
    const payload=bodyFor(active,slot);
    await f.db.exec('UPDATE private.sc004_write_control SET held=true');
    assert.equal((await heldClient.command('resume',m1.match_id)).ok,true);
    await assert.rejects(()=>heldClient.completeGame(m1.match_id,payload),e=>e.status===503);
    assert.equal(heldClient.pendingCompletions().length,1);
    await assert.rejects(()=>heldClient.command('reserve_game',m1.match_id,{game_number:4}),e=>e.status===503);
    assert.equal((await f.asRole('anon','SELECT id FROM v_games_visible WHERE id=$1',[slot1.game_id])).rows.length,1);
    const pending=await heldClient.command('resume',m1.match_id);assert(pending.games.some(g=>g.status==='cleaned'));
    await denied(()=>f.asRole('anon','DELETE FROM games WHERE id=$1',[slot1.game_id]),'42501');
    await f.db.exec('UPDATE private.sc004_write_control SET held=false');
    const reconnect=createSc004Client({endpoint:'http://localhost/sc004',publicKey:'sb_publishable_fixture',allowLocalFixture:true,fetchImpl,storage:heldStorage});
    assert.equal((await reconnect.retryCompletion(slot.game_id)).game_id,slot.game_id);assert.equal(reconnect.pendingCompletions().length,0);
    await denied(()=>f.asRole('anon','UPDATE players SET initials=$1 WHERE id=$2',['UNSAFE',A]),'42501');
  });
} finally {
  const summary={ scope:'Isolated representative proposal. Not SEC-05 cutover acceptance.',executed_at:new Date().toISOString(),engine:(await f.db.query('SELECT version() version')).rows[0].version,
    replay:f.replay,results,passed:results.filter(x=>x.pass).length,total:results.length,
    limitations:['No deployed Edge/PostgREST/Auth/Realtime or current frontend activation.','Synthetic Auth verifier seam tests request/SQL checks, not real token validation or enrolled production admin.','Training/telemetry, full 21 admin replacement routes, full tournament/provenance parity and production safe rollback are not complete.','Controller possession authorizes score submission; fixture checks aggregate consistency, not physical dart truth or a replacement scoring engine.','Lost initial capability response cannot be recovered from public IDs; proposed trusted expired-empty pruning is tested, with no scheduled production job.','First-game late-join timing before17s requires current frontend rule verification; no client phase input is treated as server proof.','Storage recovery tests cover a single writer and a reload; concurrent tabs/instances can reintroduce stale queues and need a coordinated cache contract.'] };
  if(process.env.SC004_RESULTS_PATH)fs.writeFileSync(process.env.SC004_RESULTS_PATH,JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({passed:summary.passed,total:summary.total,replay:summary.replay}));
  await f.db.close();process.exitCode=results.every(x=>x.pass)?0:1;
}
