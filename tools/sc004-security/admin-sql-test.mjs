/** Schema-level admin contract checks only. Actual Auth/Edge checks run separately. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setupFixture } from './build-fixture.mjs';
import { runAdminCases,runLegacyRecoveryCases } from './admin-platform-cases.mjs';
const results=[];let f;
const check=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});}console.log((results.at(-1).pass?'PASS ':'FAIL ')+name+(results.at(-1).pass?'':' — '+results.at(-1).message));};
try{
  f=await setupFixture();const u=crypto.randomUUID(),session=crypto.randomUUID(),ordinary=crypto.randomUUID(),anonUser=crypto.randomUUID();
  await f.db.query('INSERT INTO auth.users(id,is_anonymous,email_confirmed_at) VALUES($1,false,now()),($2,false,now()),($3,true,now())',[u,ordinary,anonUser]);
  await f.db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[session,u]);
  await f.db.query('INSERT INTO private.sc004_admins(user_id,enabled) VALUES($1,true)',[u]);
  const raw=async(b,actor=u,sid=session,role='service_role')=>(await f.asRole(role,'SELECT public.sq_sc004_admin($1::jsonb,$2::uuid,$3::uuid) r',[JSON.stringify(b),actor,sid])).rows[0].r;
  const admin=async b=>raw({...b,request_id:crypto.randomUUID()});
  const sql=async q=>{if(!q.trim().startsWith('SELECT')){await f.db.exec(q);return '';}const r=await f.db.query(q),v=r.rows.length===1?Object.values(r.rows[0])[0]:'';return typeof v==='object'?JSON.stringify(v):String(v);};
  await check('Anonymous and authenticated DB roles cannot execute privileged admin RPC',async()=>{for(const role of ['anon','authenticated'])await assert.rejects(()=>raw({operation:'status'},u,session,role),e=>e.code==='42501');});
  await check('Live permanent allowlist principal and matching current session are mandatory',async()=>{
    await assert.rejects(()=>raw({operation:'status'},ordinary,session),e=>e.code==='42501');
    await assert.rejects(()=>raw({operation:'status'},u,crypto.randomUUID()),e=>e.code==='42501');
    await f.db.query('UPDATE auth.sessions SET not_after=now()-interval \'1 second\' WHERE id=$1',[session]);await assert.rejects(()=>raw({operation:'status'}),e=>e.code==='42501');await f.db.query('UPDATE auth.sessions SET not_after=NULL WHERE id=$1',[session]);
    await f.db.query('UPDATE auth.users SET is_anonymous=true WHERE id=$1',[u]);await assert.rejects(()=>raw({operation:'status'}),e=>e.code==='42501');await f.db.query('UPDATE auth.users SET is_anonymous=false WHERE id=$1',[u]);
  });
  await check('Safe hold allows verified status but rejects admin mutations with SQL55000',async()=>{
    await f.db.exec('UPDATE private.sc004_write_control SET held=true');assert.equal((await admin({operation:'status'})).ok,true);await assert.rejects(()=>admin({operation:'dedupe_scores',scope:'league'}),e=>e.code==='55000');await f.db.exec('UPDATE private.sc004_write_control SET held=false');
  });
  await runAdminCases({admin,sql,check,run:'schema-'+crypto.randomUUID().slice(0,8)});
  const recoveryQueue=new Map();
  const recover=async(mid,settings={})=>{const b={operation:'recover_legacy',match_id:mid,...settings,request_id:crypto.randomUUID()},hash=crypto.randomUUID().replaceAll('-','').repeat(2);const r=(await f.asRole('service_role','SELECT public.sq_sc004_admin($1::jsonb,$2::uuid,$3::uuid,$4) r',[JSON.stringify(b),u,session,hash])).rows[0].r;recoveryQueue.set(mid,{b,hash,r});return r;};
  await runLegacyRecoveryCases({recover,command:async(action,mid,body={})=>f.command(action,recoveryQueue.get(mid).hash,{...body,match_id:mid}),complete:async(mid,body)=>f.command('complete_game',recoveryQueue.get(mid).hash,{...body,match_id:mid}),sql,check,run:'schema-'+crypto.randomUUID().slice(0,8)});
  await check('Legacy recovery exact request is stable; unknown, replacement, changed key and revoked deny',async()=>{
    const [mid,{b,hash,r}]=[...recoveryQueue][0];
    const call=async(b,hash)=>(await f.asRole('service_role','SELECT public.sq_sc004_admin($1::jsonb,$2::uuid,$3::uuid,$4) r',[JSON.stringify(b),u,session,hash])).rows[0].r;
    assert.deepEqual(await call(b,hash),r);await assert.rejects(()=>call(b,'f'.repeat(64)),e=>e.code==='23505');
    await assert.rejects(()=>call({...b,request_id:crypto.randomUUID()},hash),e=>e.code==='23505');
    await assert.rejects(()=>call({...b,match_id:crypto.randomUUID(),request_id:crypto.randomUUID()},hash),e=>e.code==='P0002');
    await f.db.query('UPDATE private.sc004_controllers SET revoked_at=now() WHERE match_id=$1',[mid]);await assert.rejects(()=>call(b,hash),e=>e.code==='42501');
  });
  await check('Admin retry caches exact receipt, conflicting request fails and revocation overrides cache',async()=>{
    const b={operation:'dedupe_scores',scope:'practice',request_id:crypto.randomUUID()};const r=await raw(b);assert.deepEqual(await raw(b),r);
    await assert.rejects(()=>raw({...b,scope:'league'}),e=>e.code==='23505');
    await f.db.query('UPDATE private.sc004_admins SET revoked_at=now() WHERE user_id=$1',[u]);await assert.rejects(()=>raw(b),e=>e.code==='42501');await f.db.query('UPDATE private.sc004_admins SET revoked_at=NULL WHERE user_id=$1',[u]);
  });
} catch(e){results.push({name:'setup',pass:false,code:e.code,message:e.message});console.error('SETUPFAIL',e.code,e.message);}finally{await f?.db.close();}
const result={captured_at:new Date().toISOString(),environment:'in-memory PostgreSQL exact captured18-table schema replay',auth:'minimal synthetic Auth column fixture only; not real Supabase Auth acceptance',productionWrites:false,counts:{passed:results.filter(r=>r.pass).length,total:results.length},results};
if(process.env.SC004_ADMIN_RESULTS)fs.writeFileSync(process.env.SC004_ADMIN_RESULTS,JSON.stringify(result,null,2)+'\n');
if(results.some(r=>!r.pass))process.exitCode=1;
