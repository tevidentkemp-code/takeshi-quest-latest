/** Transport cache contract only. Fake network receipts exercise persistence;
 * these tests make no Auth, SQL, browser or deployed authorization claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSc004Client} from '../../src/services/sc004-client.mjs';
const results=[];
const check=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,message:e.message});}console.log((results.at(-1).pass?'PASS ':'FAIL ')+name+(results.at(-1).pass?'':' — '+results.at(-1).message));};
const keys={credentials:'sq.security.match-credentials.v1',pending:'sq.security.pending-completions.v1',starts:'sq.security.pending-starts.v1',go:'sq.security.pending-go.v1'};
function cache(){const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
const entries=(store,key)=>JSON.parse(store.getItem(key)||'{}');
const offline=async()=>{throw new Error('Intentional transport failure');};
const issue=(id)=>({ok:true,match_id:id,capability:'sqmc1_'+'A'.repeat(43),expires_at:new Date(Date.now()+3600000).toISOString()});
const make=(storage,fetchImpl=offline)=>createSc004Client({endpoint:'https://cache-contract.invalid/functions/v1/sq-match-control',publicKey:'sb_publishable_fixture',storage,fetchImpl,requestTimeoutMs:1000});
function scopes(store){const ids=[crypto.randomUUID(),crypto.randomUUID()];store.setItem(keys.credentials,JSON.stringify(Object.fromEntries(ids.map(id=>[id,{...issue(id)}]))));return ids;}
await check('Two existing clients preserve both offline completion envelopes and exact request IDs',async()=>{
  const store=cache(),ids=scopes(store),games=ids.map(()=>crypto.randomUUID()),clients=[make(store),make(store)];
  await Promise.all(clients.map((c,i)=>assert.rejects(()=>c.completeGame(ids[i],{game_id:games[i],state:{},totals:[]}),e=>e.code==='network_unavailable')));
  const before=entries(store,keys.pending);assert.equal(Object.keys(before).length,2);
  const retryIds=[];const reloaded=make(store,async(_,init)=>{retryIds.push(JSON.parse(init.body).request_id);throw new Error('Still offline');});
  assert.equal(reloaded.pendingCompletions().length,2);
  for(const game of games)await assert.rejects(()=>reloaded.retryCompletion(game),e=>e.code==='network_unavailable');
  assert.deepEqual(retryIds,games.map(id=>before[id].request_id));assert.deepEqual(entries(store,keys.pending),before);
});
await check('Concurrent successful issuance merges both credentials without exposing secrets in receipts',async()=>{
  const store=cache(),issued=[crypto.randomUUID(),crypto.randomUUID()];let next=0;
  const fetchImpl=async()=>new Response(JSON.stringify(issue(issued[next++])),{status:200});
  const clients=[make(store,fetchImpl),make(store,fetchImpl)];
  const receipts=await Promise.all(clients.map((c,i)=>c.createMatch({mode:'practice',roster:[{name:'CACHE_'+i}],target_wins:1,match_format:'single'},crypto.randomUUID())));
  assert.equal(Object.keys(entries(store,keys.credentials)).length,2);assert(receipts.every(r=>!('capability'in r)));
  const reloaded=make(store);assert(issued.every(id=>reloaded.hasController(id)));assert.equal(Object.keys(entries(store,keys.starts)).length,0);
});
await check('Two pending initiations remain durable with stable distinct initiation request IDs',async()=>{
  const store=cache(),clients=[make(store),make(store)],ids=[crypto.randomUUID(),crypto.randomUUID()],bodies=ids.map((_,i)=>({mode:'practice',roster:[{name:'START_'+i}],target_wins:1,match_format:'single'}));
  await Promise.all(clients.map((c,i)=>assert.rejects(()=>c.createMatch(bodies[i],ids[i]),e=>e.code==='network_unavailable')));
  const before=entries(store,keys.starts);assert.equal(Object.keys(before).length,2);
  const retryIds=[];const reloaded=make(store,async(_,init)=>{retryIds.push(JSON.parse(init.body).request_id);throw new Error('Still offline');});
  for(let i=0;i<2;i++)await assert.rejects(()=>reloaded.createMatch(bodies[i],ids[i]),e=>e.code==='network_unavailable');
  assert.deepEqual(retryIds,ids.map(id=>before[id].request_id));assert.deepEqual(entries(store,keys.starts),before);
});
await check('Shared go queues preserve both pending events and reject conflicting retry payloads',async()=>{
  const store=cache(),ids=scopes(store),clients=[make(store),make(store)],bodies=ids.map(()=>({game_id:crypto.randomUUID(),player_id:crypto.randomUUID(),round_number:1,go_number:1,started_at:'2026-10-03T12:00:00Z',ended_at:'2026-10-03T12:00:01Z'}));
  await Promise.all(clients.map((c,i)=>assert.rejects(()=>c.logGo(ids[i],bodies[i]),e=>e.code==='network_unavailable')));
  assert.equal(Object.keys(entries(store,keys.go)).length,2);
  await assert.rejects(()=>clients[0].logGo(ids[0],{...bodies[0],ended_at:'2026-10-03T12:00:02Z'}),e=>e.code==='pending_go_conflict');
  assert.equal(Object.keys(entries(store,keys.go)).length,2);
});
await check('Accepted completion removal preserves another client queue added while the first request is in flight',async()=>{
  const store=cache(),ids=scopes(store),games=ids.map(()=>crypto.randomUUID());let release,started;
  const sent=new Promise(r=>started=r),response=new Promise(r=>release=r);
  const first=make(store,async()=>{started();await response;return new Response(JSON.stringify({ok:true,id:games[0],game_id:games[0],match_id:ids[0]}),{status:200});});
  const second=make(store),save=first.completeGame(ids[0],{game_id:games[0],state:{},totals:[]});await sent;
  await assert.rejects(()=>second.completeGame(ids[1],{game_id:games[1],state:{},totals:[]}),e=>e.code==='network_unavailable');
  release();await save;const remaining=entries(store,keys.pending);assert.deepEqual(Object.keys(remaining),[games[1]]);
});
const report={captured_at:new Date().toISOString(),environment:'Node transport cache with explicit fake network receipts',authorizationAcceptance:false,counts:{passed:results.filter(r=>r.pass).length,total:results.length},results};
if(process.env.SC004_CACHE_RESULTS)fs.writeFileSync(process.env.SC004_CACHE_RESULTS,JSON.stringify(report,null,2)+'\n');
if(results.some(r=>!r.pass))process.exitCode=1;
