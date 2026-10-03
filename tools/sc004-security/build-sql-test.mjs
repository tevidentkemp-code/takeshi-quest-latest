/** Local PostgreSQL contract checks; do not substitute for real platform acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setupFixture } from './build-fixture.mjs';
import { createSc004Handler, createCapabilityIssuer } from '../../supabase/functions/_shared/sc004-handler.mjs';
const f = await setupFixture();
const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, pass:true }); } catch (e) { results.push({name,pass:false,code:e.code,message:e.message}); } console.log(`${results.at(-1).pass ? 'PASS' : 'FAIL'} ${name}${results.at(-1).pass?'':' '+results.at(-1).message}`); }
const issueCapability = await createCapabilityIssuer('a'.repeat(64));
const h=createSc004Handler({command:f.rpcAdapter,issueCapability});
async function invoke(action,body={},cap,request=crypto.randomUUID()) {
 const headers={'content-type':'application/json'}; if(cap)headers['x-sq-match-controller']=cap;
 const r=await h(new Request('http://localhost/sc004',{method:'POST',headers,body:JSON.stringify({action,request_id:request,body})}));
 return{status:r.status,data:await r.json()};
}
const A='00000000-0000-4000-8000-000000000201',B='00000000-0000-4000-8000-000000000202';
let a,b,slot,payload,t;
try {
await check('Exact server issuance retry recovers same secret and match',async()=>{
 const id=crypto.randomUUID(),body={mode:'official',roster:[{id:A},{id:B}],target_wins:3,match_format:'series',rules:{}};
 const first=await invoke('create_match',body,null,id),second=await invoke('create_match',body,null,id);assert.equal(first.status,200);assert.deepEqual(first,second);a=first.data;
 assert.equal((await invoke('create_match',{...body,target_wins:5},null,id)).status,409);
 b=(await invoke('create_match',body)).data;
});
await check('Missing, JSON-null and wrong-type authority fields fail before persistence',async()=>{
 const base={mode:'official',roster:[{id:A},{id:B}],target_wins:1,rules:{}};
 for(const roster of [undefined,null,{},[null]])assert.equal((await invoke('create_match',{...base,roster})).status,400);
 for(const rules of [null,{gameFormat:null},{gameVariant:null},{startTarget:null}])assert.equal((await invoke('create_match',{...base,rules})).status,400);
 for(const name of [undefined,null,42,{}])assert.equal((await invoke('create_player',{name})).status,400);
 for(const config of [undefined,null,[]])assert.equal((await invoke('create_training',{player:{id:A,name:'SYNTHETIC_A'},mode:'standard',length:10,config})).status,400);
 const m=(await invoke('create_match',base)).data;
 const sl=(await invoke('reserve_game',{match_id:m.match_id,game_number:1},m.capability)).data;
 const board=Array.from({length:2},()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0})));
 const completion={match_id:m.match_id,game_id:sl.game_id,state:{players:m.roster,board,mode:'official'}};
 for(const totals of [undefined,null,[null,null],['0','0']])assert.equal((await invoke('complete_game',{...completion,totals},m.capability)).status,400);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM games WHERE id=$1',[sl.game_id])).rows[0].n,0);
});
await check('Trusted rule metadata preserves omitted fields and rejects contradictory completion',async()=>{
 const rules={gameFormat:'match_play',gameVariant:'classic',strictTimer:false};
 const m=(await invoke('create_match',{mode:'official',roster:[{id:A},{id:B}],target_wins:1,rules})).data;
 const sl=(await invoke('reserve_game',{match_id:m.match_id,game_number:1},m.capability)).data;
 const board=Array.from({length:2},()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0})));
 const p={match_id:m.match_id,game_id:sl.game_id,state:{players:m.roster,board,mode:'official'},totals:[0,0]};
 assert.equal((await invoke('complete_game',{...p,state:{...p.state,gameVariant:'turbo'}},m.capability)).status,400);
 assert.equal((await invoke('complete_game',p,m.capability)).status,200);
 assert.equal((await f.db.query('SELECT state->>\'gameVariant\' v FROM games WHERE id=$1',[sl.game_id])).rows[0].v,'classic');
 const one=(await invoke('create_match',{mode:'official',roster:[{id:A},{id:B}],target_wins:3,match_format:'series'})).data;
 const reduced=await invoke('update_roster',{match_id:one.match_id,roster:[{id:A,display_name:'MATCH ONLY'}]},one.capability);assert.equal(reduced.status,200);assert.equal(reduced.data.mode,'practice');assert.equal(reduced.data.roster[0].display_name,'MATCH ONLY');
});
await check('No controller and cross-match controller denied',async()=>{
 assert.equal((await invoke('reserve_game',{match_id:a.match_id,game_number:1})).status,401);
 assert.equal((await invoke('reserve_game',{match_id:b.match_id,game_number:1},a.capability)).status,403);
});
await check('Registry-only scope denies historical UUID adoption',async()=>{
 assert.equal((await invoke('resume',{match_id:'00000000-0000-4000-8000-000000000001'},a.capability)).status,403);
});
await check('Roster display changes stay match scoped; pending reset retains minted ID',async()=>{
 const changed=await invoke('update_roster',{match_id:a.match_id,roster:[{id:A,name:'SYNTHETIC_A',initials:'ONLY'},{id:B}]},a.capability);assert.equal(changed.status,200);a.roster=changed.data.roster;
 assert.equal((await f.db.query('SELECT initials FROM players WHERE id=$1',[A])).rows[0].initials,'OLD');
 slot=(await invoke('reserve_game',{match_id:a.match_id,game_number:1},a.capability)).data;
 assert.equal((await invoke('reset_game',{match_id:a.match_id,game_id:slot.game_id},a.capability)).data.game_id,slot.game_id);
});
await check('Canonical completion atomically records game, HS, wins; retry immutable',async()=>{
 const board=Array.from({length:2},()=>Array.from({length:14},()=>({darts:[{kind:'S',points:10},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:10})));
 payload={match_id:a.match_id,game_id:slot.game_id,state:{players:a.roster,board,mode:'official'},totals:[140,140],winner_indexes:[0]};
 const done=await invoke('complete_game',payload,a.capability);assert.equal(done.status,200);assert.deepEqual(done,await invoke('complete_game',payload,a.capability));
 assert.equal((await f.db.query('SELECT count(*)::int n FROM high_scores_sp WHERE game_id=$1',[slot.game_id])).rows[0].n,2);
 assert.equal((await f.db.query('SELECT wins FROM matches WHERE id=$1',[a.match_id])).rows[0].wins[0],1);
 assert.equal((await invoke('complete_game',{...payload,totals:[0,0]},a.capability)).status,409);
 assert.equal((await invoke('reset_game',{match_id:a.match_id,game_id:slot.game_id},a.capability)).status,403);
});
await check('Cleaned game holes cannot advance or revive behind a later slot',async()=>{
 const m=(await invoke('create_match',{mode:'official',roster:[{id:A},{id:B}],target_wins:3,match_format:'series'})).data;
 const one=(await invoke('reserve_game',{match_id:m.match_id,game_number:1},m.capability)).data;
 assert.equal((await invoke('cleanup_game',{match_id:m.match_id,game_id:one.game_id},m.capability)).status,200);
 assert.equal((await invoke('reserve_game',{match_id:m.match_id,game_number:2},m.capability)).status,400);
 assert.equal((await invoke('reset_game',{match_id:m.match_id,game_id:one.game_id},m.capability)).status,200);
 assert.equal((await f.db.query("SELECT count(*)::int n FROM private.sc004_slots WHERE match_id=$1 AND status='pending'",[m.match_id])).rows[0].n,1);
 // A stale pre-fix registry with a later slot must still fail closed on reset.
 await f.db.query("UPDATE private.sc004_slots SET status='cleaned' WHERE game_id=$1",[one.game_id]);
 await f.db.query("INSERT INTO private.sc004_slots(match_id,game_number) VALUES($1,2)",[m.match_id]);
 assert.equal((await invoke('reset_game',{match_id:m.match_id,game_id:one.game_id},m.capability)).status,403);
});
await check('Numeric and timestamp overflow return malformed-input 400',async()=>{
 assert.equal((await invoke('reserve_game',{match_id:a.match_id,game_number:2147483648},a.capability)).status,400);
 assert.equal((await invoke('create_match',{mode:'official',roster:[{id:A},{id:B}],target_wins:2147483648})).status,400);
 assert.equal((await invoke('log_go',{match_id:a.match_id,game_id:slot.game_id,player_id:A,round_number:1,go_number:1,started_at:'2026-10-99T10:00:00Z',ended_at:'2026-10-99T10:00:10Z'},a.capability)).status,400);
});
await check('Accepted player go and event derive exact game/player scope',async()=>{
 assert.equal((await invoke('log_go',{match_id:a.match_id,game_id:slot.game_id,player_id:A,round_number:1,go_number:1,started_at:'2026-10-03T10:00:00Z',ended_at:'2026-10-03T10:00:10Z'},a.capability)).status,200);
 const event={match_id:a.match_id,game_id:slot.game_id,event:{player_id:A,round_index:0,dart_index:0}};
 const e=await invoke('append_event',event,a.capability);assert.equal(e.status,200);assert.deepEqual(e,await invoke('append_event',event,a.capability));
 assert.equal((await f.db.query('SELECT points FROM game_events WHERE id=$1',[e.data.event_id])).rows[0].points,10);
});
await check('Practice guest series updates wins; VsShadow persists Practice real player only',async()=>{
 const series=(await invoke('create_match',{mode:'practice',match_format:'series',roster:[{name:'GUEST_A'},{name:'GUEST_B'}],target_wins:3,rules:{}})).data;
 const sl=(await invoke('reserve_game',{match_id:series.match_id,game_number:1},series.capability)).data;
 const p={...payload,match_id:series.match_id,game_id:sl.game_id,state:{...payload.state,players:series.roster,mode:'practice'}};
 assert.equal((await invoke('complete_game',p,series.capability)).status,200);assert.equal((await f.db.query('SELECT wins FROM matches WHERE id=$1',[series.match_id])).rows[0].wins[0],1);
 const shadow=(await invoke('create_match',{mode:'vs_shadow',match_format:'single',roster:[{id:A}],target_wins:1,rules:{}})).data;
 const ss=(await invoke('reserve_game',{match_id:shadow.match_id,game_number:1},shadow.capability)).data;
 const shadowPayload={match_id:shadow.match_id,game_id:ss.game_id,state:{players:shadow.roster,board:[payload.state.board[0]],mode:'practice',gameMode:'practice'},totals:[140]};
 assert.equal((await invoke('complete_game',{...shadowPayload,state:{...shadowPayload.state,gameMode:'official'}},shadow.capability)).status,400);
 assert.equal((await invoke('complete_game',shadowPayload,shadow.capability)).status,200);
 assert.equal((await f.db.query('SELECT state->>\'mode\' mode FROM games WHERE id=$1',[ss.game_id])).rows[0].mode,'practice');
});
await check('Training issues separate scope, binds setup, validates aggregate and retry',async()=>{
 t=(await invoke('create_training',{player:{id:A,name:'SYNTHETIC_A'},mode:'standard',length:10,config:{}})).data;
 assert(t.training_id&&t.capability); const p={player_name:'SYNTHETIC_A',mode:'standard',length:10,rounds_played:1,config:{},results:[{target:10,req:'any',darts:['single','miss','miss'],hits:1,points:10}],total_points:10,total_darts:3,total_hits:1,hit_pct:33.3};
 const done=await invoke('complete_training',{training_id:t.training_id,payload:p},t.capability); assert.equal(done.status,200);assert.deepEqual(done,await invoke('complete_training',{training_id:t.training_id,payload:p},t.capability));
 assert.equal((await invoke('complete_training',{training_id:t.training_id,payload:{...p,player_name:'OTHER'}},t.capability)).status,409);
 assert.equal((await invoke('complete_training',{training_id:t.training_id,payload:p},a.capability)).status,403);
});
await check('Malformed board metadata and mismatched Training target/sections cannot persist',async()=>{
 const m=(await invoke('create_match',{mode:'official',roster:[{id:A},{id:B}],target_wins:1})).data;
 const sl=(await invoke('reserve_game',{match_id:m.match_id,game_number:1},m.capability)).data;
 const p={...payload,match_id:m.match_id,game_id:sl.game_id,state:{...payload.state,players:m.roster,board:structuredClone(payload.state.board)}};
 p.state.board[0][0].unexpected='persisted';assert.equal((await invoke('complete_game',p,m.capability)).status,400);
 const tr=(await invoke('create_training',{player:{id:A,name:'SYNTHETIC_A'},mode:'select',length:10,config:{targets:[{kind:'number',n:10,req:'single'}]}})).data;
 const data={player_name:'SYNTHETIC_A',mode:'select',length:10,rounds_played:1,config:{targets:[{kind:'number',n:10,req:'single'}]},results:[{target:20,req:null,darts:['miss','miss','miss'],points:180,hits:3}],total_points:180,total_darts:3,total_hits:3,hit_pct:100};
 assert.equal((await invoke('complete_training',{training_id:tr.training_id,payload:data},tr.capability)).status,400);
 data.results=[{target:10,req:'single',darts:['miss','miss','miss'],points:180,hits:3}];assert.equal((await invoke('complete_training',{training_id:tr.training_id,payload:data},tr.capability)).status,400);
 data.results=[{target:10,req:'single',darts:['single','miss'],points:10,hits:1}];Object.assign(data,{total_points:10,total_darts:2,total_hits:1,hit_pct:50});assert.equal((await invoke('complete_training',{training_id:tr.training_id,payload:data},tr.capability)).status,200);
});
await check('Commentary claim binds actor and revocation before commit denies writes',async()=>{
 const hash=(await f.db.query('SELECT token_hash FROM private.sc004_controllers WHERE match_id=$1',[a.match_id])).rows[0].token_hash;
 const claim=(await f.asRole('service_role',"SELECT public.sq_sc004_commentary_claim($1,$2::uuid,'studio_intro',NULL,NULL) result",[hash,slot.game_id])).rows[0].result;assert(claim.claim_id);
 await f.db.query('UPDATE private.sc004_controllers SET revoked_at=now() WHERE match_id=$1',[a.match_id]);
 await assert.rejects(()=>f.asRole('service_role','SELECT public.sq_sc004_commentary_commit($1::uuid,$2::jsonb)',[claim.claim_id,JSON.stringify([{speaker:'SARAH',text:'Test',intensity:1},{speaker:'WADE',text:'Test',intensity:1},{speaker:'MICKY',text:'Test',intensity:1}])]),e=>e.code==='42501');
 await f.db.query('UPDATE private.sc004_controllers SET revoked_at=NULL WHERE match_id=$1',[a.match_id]);
});
await check('Same-token renew and resume; expiry fails closed',async()=>{
 assert.equal((await invoke('renew',{match_id:a.match_id},a.capability)).status,200);assert.equal((await invoke('resume',{match_id:a.match_id},a.capability)).status,200);
 await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()-interval '1 second' WHERE match_id=$1",[b.match_id]);assert.equal((await invoke('renew',{match_id:b.match_id},b.capability)).status,403);
});
await check('Restricted hold pauses valid controller lifetime and never revives prior expiry',async()=>{
 await f.asRole('service_role','SELECT public.sq_sc004_set_hold(true)');
 await f.db.exec("UPDATE private.sc004_write_control SET held_at=now()-interval '2 hours'");
 await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()-interval '1 hour' WHERE match_id=$1",[a.match_id]);
 await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()-interval '3 hours' WHERE match_id=$1",[b.match_id]);
 assert.equal((await invoke('resume',{match_id:a.match_id},a.capability)).status,200);assert.equal((await invoke('resume',{match_id:b.match_id},b.capability)).status,403);
 await f.asRole('service_role','SELECT public.sq_sc004_set_hold(false)');
 assert.equal((await invoke('resume',{match_id:a.match_id},a.capability)).status,200);assert.equal((await invoke('resume',{match_id:b.match_id},b.capability)).status,403);
});
await check('Consumed issuance cannot rebind an old secret after cleanup, expiry or prune',async()=>{
 const request=crypto.randomUUID(),body={mode:'official',roster:[{id:A},{id:B}],target_wins:1};
 const m=(await invoke('create_match',body,null,request)).data;
 assert.equal((await invoke('cleanup_match',{match_id:m.match_id},m.capability)).status,200);
 assert.equal((await invoke('create_match',body,null,request)).status,403,'cleanup replay');
 const expiredRequest=crypto.randomUUID(),expired=(await invoke('create_match',body,null,expiredRequest)).data;
 await f.db.query("UPDATE private.sc004_controllers SET expires_at=now()-interval '1 second' WHERE match_id=$1",[expired.match_id]);
 assert.equal((await invoke('create_match',body,null,expiredRequest)).status,403,'expired/pruned replay');
 await f.asRole('service_role','SELECT public.sq_sc004_prune_expired_empty(100)');
 assert.equal((await invoke('create_match',body,null,expiredRequest)).status,403,'expired/pruned replay');
 const trainingRequest=crypto.randomUUID(),trainingBody={player:{id:A,name:'SYNTHETIC_A'},mode:'standard',length:10,config:{}};
 const training=(await invoke('create_training',trainingBody,null,trainingRequest)).data;
 await f.db.query('UPDATE private.sc004_training_controls SET revoked_at=now() WHERE training_id=$1',[training.training_id]);
 assert.equal((await invoke('create_training',trainingBody,null,trainingRequest)).status,403,'revoked training replay');
});
await check('Own empty cleanup, idempotent visit, held writes deny with deliberate503',async()=>{
 const empty=(await invoke('create_match',{mode:'official',roster:[{id:A},{id:B}],target_wins:1})).data;assert.equal((await invoke('cleanup_match',{match_id:empty.match_id},empty.capability)).status,200);
 const device=crypto.randomUUID();assert.equal((await invoke('visit',{device_id:device,day:'1900-01-01'})).status,200);assert.equal((await invoke('visit',{device_id:device})).status,200);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM app_logons WHERE device_id=$1',[device])).rows[0].n,1);
 await f.db.exec('UPDATE private.sc004_write_control SET held=true');assert.equal((await invoke('visit',{device_id:device})).status,503);assert.equal((await invoke('resume',{match_id:a.match_id},a.capability)).status,200);
});
} finally { await f.db.close(); }
const artifact={environment:'in-memory PostgreSQL schema fixture, not real Supabase acceptance',productionWrites:false,counts:{passed:results.filter(x=>x.pass).length,total:results.length},results};
if(process.env.SC004_BUILD_SQL_RESULTS)fs.writeFileSync(process.env.SC004_BUILD_SQL_RESULTS,JSON.stringify(artifact,null,2)+'\n');
if(results.some(x=>!x.pass))process.exitCode=1;
