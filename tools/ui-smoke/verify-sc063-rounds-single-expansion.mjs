// Local disposable PostgreSQL only. Never opens a browser or a production connection.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const forwardPath='supabase/migrations/20261003191500_sc063_rounds_single_expansion.sql';
const rollbackPath='supabase/rollbacks/sc063_rounds_single_expansion.sql';
const forward=fs.readFileSync(forwardPath,'utf8');
const rollback=fs.readFileSync(rollbackPath,'utf8');
const fixtureBytes=fs.readFileSync('tools/ui-smoke/fixtures/sc063-rounds-synthetic.json','utf8');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const originalHash='be18c389f58aadad4c32e1d8911be6741dd66dbc3f1450003e398ca32ccbd80d';
const candidateHash='341c072314ec410da7e898caca61271601596ca57e9a6d4466154de3871d41e2';
assert.equal(hash(fixtureBytes),'c6d7ff7449fa6b96e9569fb88242543977433ae13e70945d02f0a4734a85d5ab','Frozen 115 input/expected-outcome packet');
const fixtures=JSON.parse(fixtureBytes);
assert.equal(fixtures.length,115);
assert.equal(new Set(fixtures.map(f=>f.id)).size,115);

function viewBody(sql) {
  const matches=[...sql.matchAll(/EXECUTE \$sc063_view\$CREATE OR REPLACE VIEW public\.v_ach_rounds WITH \(security_invoker=true\) AS\n([\s\S]*?)\n\$sc063_view\$;/g)];
  assert.equal(matches.length,1,'Only the established rounds view is replaced');
  return matches[0][1].trim();
}
const original=viewBody(rollback),candidate=viewBody(forward);
assert.equal(hash(candidate),'e087e058a8e1b583b2df8acd13569f006e90a0f0f1994621ed083f28cef06924','Frozen PG17-equivalent materialized-darts body');
for(const sql of [forward,rollback]) {
  const executable=sql.replace(/^\s*--.*$/gm,'');
  assert.equal((executable.match(/CREATE OR REPLACE/gi)||[]).length,1);
  assert.doesNotMatch(executable,/\b(?:grant|revoke|alter|drop|insert|update|delete|truncate|create\s+(?:function|table|index|schema|role))\b|SET\s+(?:LOCAL\s+)?(?:ROLE|statement_timeout)|security\s+definer/i);
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/^COMMIT;$/m);
  assert.match(sql,/SELECT 1 FROM public\.v_ach_rounds WHERE false;/);
  assert.match(sql,/after_object IS DISTINCT FROM before_object/);
  assert(sql.includes(originalHash)&&sql.includes(candidateHash),'Both canonical digest guards remain');
}
assert.equal((candidate.match(/jsonb_array_elements\(b\.rj -> 'darts'::text\)/g)||[]).length,1,'One per-round JSON expansion');
assert.equal((candidate.match(/FROM darts d/g)||[]).length,7,'Seven original scalar count predicates retain their order');
assert.doesNotMatch(candidate,/\bFILTER\b/i,'Rejected FILTER evaluation-order model must not return');

const db=new PGlite();
const rowsSorted=rows=>rows.map(row=>JSON.stringify(row)).sort();
const types=fields=>Object.fromEntries(fields.map(f=>[f.name,({16:'boolean',23:'integer',2950:'uuid'})[f.dataTypeID]??String(f.dataTypeID)]));
const definition=async()=> (await db.query("SELECT pg_get_viewdef('public.v_ach_rounds'::regclass,true) AS definition")).rows[0].definition;
const metadata=async()=> (await db.query(`SELECT jsonb_build_object(
  'oid',c.oid,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
  'options',c.reloptions,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) AS object
  FROM pg_class c WHERE c.oid='public.v_ach_rounds'::regclass`)).rows[0].object;
async function execute(sql,params=[]) {
  try {const r=await db.query(sql,params);return {rows:r.rows,types:types(r.fields),sqlstate:null};}
  catch(error) {return {sqlstate:error.code};}
}
async function apply(sql) {
  try {await db.exec(sql);}
  catch(error) {await db.exec('ROLLBACK');throw error;}
}
async function refused(sql,label) {
  const before=await definition();
  const meta=await metadata();
  let caught;
  await assert.rejects(apply(sql),error=>{caught=error;return error.code==='P0001'&&error.message.includes('refused');},label);
  assert.equal(await definition(),before,label+' cannot replace a drifted source');
  assert.deepEqual(await metadata(),meta,label+' cannot change identity/security');
  return caught;
}
async function runFixtures() {
  for(const f of fixtures) {
    let oldQuery,newQuery,params;
    if(f.kind==='sqlnull') {
      const projection=original.slice(original.indexOf('COALESCE((b.rj'),original.indexOf('\n   FROM base b'));
      const lateral=candidate.slice(candidate.indexOf('     CROSS JOIN LATERAL ('));
      oldQuery='WITH b(rj) AS (VALUES (NULL::jsonb)) SELECT '+projection+' FROM b';
      newQuery='WITH b(rj) AS (VALUES (NULL::jsonb)) SELECT stats.* FROM b\n'+lateral;
      params=[];
    } else {
      const flags={finished:true,is_practice:false,is_tiebreak:false,...f.flags};
      const prefix=`WITH games AS (SELECT $1::uuid AS id,$2::uuid AS match_id,$3::boolean AS finished,$4::boolean AS is_practice,$5::boolean AS is_tiebreak,$6::jsonb AS state ${f.emptyGames?'WHERE false':''}),
        v_name_resolver(nm,player_id) AS (VALUES ('thom'::text,$7::uuid),('aliasname'::text,$7::uuid)), fixture_rounds AS (`;
      params=[f.gameId,f.matchId,flags.finished,flags.is_practice,flags.is_tiebreak,f.sqlNull?null:JSON.stringify(f.state),f.playerId];
      oldQuery=prefix+original.replace(/;$/,'')+') SELECT * FROM fixture_rounds';
      newQuery=prefix+candidate.replace(/;$/,'')+') SELECT * FROM fixture_rounds';
    }
    const old=await execute(oldQuery,params),newer=await execute(newQuery,params);
    assert.equal(old.sqlstate,f.expectedSQLSTATE,f.id+' captured original SQLSTATE');
    assert.deepEqual(newer,old,f.id+' complete typed rows / SQLSTATE equality');
    if(!old.sqlstate) {
      assert.deepEqual(rowsSorted(old.rows),rowsSorted(f.expectedRows),f.id+' frozen full-row oracle');
      assert.deepEqual(old.types,f.expectedTypes,f.id+' original returned field types');
    }
  }
}

try {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE TABLE public.games(id uuid,match_id uuid,is_tiebreak boolean,finished boolean,is_practice boolean,state jsonb);
    CREATE TABLE public.v_name_resolver(nm text,player_id uuid);
    CREATE VIEW public.v_ach_rounds WITH (security_invoker=true) AS ${original}
    GRANT ALL ON public.v_ach_rounds TO anon,authenticated,service_role;`);
  assert.equal(hash(await definition()),originalHash,'Local PG18 deparser matches the captured PG17 source exactly');
  const baseline=await metadata();
  await runFixtures();

  const representative=fixtures[0];
  await db.query('INSERT INTO games VALUES ($1,$2,false,true,false,$3)',[representative.gameId,representative.matchId,JSON.stringify(representative.state)]);
  await db.query('INSERT INTO v_name_resolver VALUES ($1,$2)',['thom',representative.playerId]);
  const dataBefore=(await db.query('SELECT * FROM games')).rows;
  const outputBefore=await db.query('SELECT * FROM public.v_ach_rounds');
  await db.exec('CREATE VIEW public.sc063_fixture_dependent AS SELECT * FROM public.v_ach_rounds');
  const dependentBefore=(await db.query("SELECT oid,pg_get_viewdef(oid,true) AS definition FROM pg_class WHERE oid='public.sc063_fixture_dependent'::regclass")).rows;
  const incorrectPostGuard=forward.replace("IS DISTINCT FROM '"+candidateHash+"' THEN","IS DISTINCT FROM '"+'0'.repeat(64)+"' THEN");
  assert.notEqual(incorrectPostGuard,forward);
  const postRefusal=await refused(incorrectPostGuard,'Post-replacement guard failure rolls back atomically');
  assert(postRefusal.detail.includes('observed_definition_sha256='+candidateHash),'Credential-free deparser diagnosis survives rollback');
  assert(postRefusal.detail.includes('changed_metadata={}'),'Unchanged metadata is not dumped in diagnostic detail');
  await apply(forward);
  assert.equal(hash(await definition()),candidateHash,'Exact canonical candidate installed by the real migration');
  assert.deepEqual(await metadata(),baseline,'Forward preserves owner/ACL/options/columns/RLS/OID');
  assert.deepEqual((await db.query('SELECT * FROM public.v_ach_rounds')).rows,outputBefore.rows,'Installed view preserves full representative output');
  assert.deepEqual((await db.query('SELECT * FROM public.sc063_fixture_dependent')).rows,outputBefore.rows,'Existing dependent view continues to read the same rows');
  assert.deepEqual((await db.query('SELECT * FROM games')).rows,dataBefore,'Forward changes no data');
  await refused(forward,'Repeat forward on candidate');
  await apply(rollback);
  assert.equal(hash(await definition()),originalHash,'Exact original definition recovered');
  assert.deepEqual(await metadata(),baseline,'Rollback preserves owner/ACL/options/columns/RLS/OID');
  assert.deepEqual((await db.query("SELECT oid,pg_get_viewdef(oid,true) AS definition FROM pg_class WHERE oid='public.sc063_fixture_dependent'::regclass")).rows,dependentBefore,'Dependent identity and definition retained');
  assert.deepEqual((await db.query('SELECT * FROM games')).rows,dataBefore,'Recovery changes no data');
  await refused(rollback,'Rollback on original');

  await db.exec('REVOKE SELECT ON public.v_ach_rounds FROM anon');
  await refused(forward,'ACL drift');
  await db.exec('GRANT SELECT ON public.v_ach_rounds TO anon');
  await db.exec('ALTER VIEW public.v_ach_rounds SET (security_invoker=false)');
  await refused(forward,'Security option drift');
  await db.exec('ALTER VIEW public.v_ach_rounds SET (security_invoker=true)');
  await db.exec('CREATE OR REPLACE VIEW public.v_ach_rounds WITH (security_invoker=true) AS '+original.replace('10 + b.ridx','11 + b.ridx'));
  await refused(forward,'Original definition drift');
  await db.exec('CREATE OR REPLACE VIEW public.v_ach_rounds WITH (security_invoker=true) AS '+original);
  await apply(forward);
  await db.exec('CREATE OR REPLACE VIEW public.v_ach_rounds WITH (security_invoker=true) AS '+candidate.replace('10 + b.ridx','11 + b.ridx'));
  await refused(rollback,'Candidate definition drift');
  const engine=(await db.query('SELECT version() AS version')).rows[0].version;
  console.log(JSON.stringify({status:'PASS',engine,fixtures:fixtures.length,fullTypedRowsAndSQLSTATE:true,forwardRecovery:'PASS',refusalCases:7,scope:'Disposable local PGlite only; no live connection or application. PG17 live/API timing remains a separate acceptance gate.'},null,2));
} finally {await db.close();}
