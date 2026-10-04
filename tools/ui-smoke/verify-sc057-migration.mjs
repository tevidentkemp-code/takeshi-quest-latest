import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const old = fs.readFileSync('supabase/migrations/20260920162000_sc040_player_avatar_identity.sql','utf8');
const up = fs.readFileSync('supabase/migrations/20261003170000_sc057_avatar_catalogue_extension.sql','utf8');
const down = fs.readFileSync('supabase/rollbacks/sc057_avatar_catalogue_extension.sql','utf8');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.players (
      id uuid primary key default gen_random_uuid(), name text not null,
      created_at timestamptz not null default now(), initials text, first_name text,
      last_name text, nickname text, deleted_at timestamptz,
      constraint players_name_unique unique(name)
    );
    grant all on public.players to anon, authenticated, service_role;
    alter table public.players enable row level security;
    create policy players_select_anon on public.players for select to anon using(true);
    create policy players_insert_anon on public.players for insert to anon with check(true);
    create policy players_update_anon on public.players for update to anon using(true) with check(true);
    create policy players_delete_anon on public.players for delete to anon using(true);
  `);
  await db.exec(old);
  await db.query("insert into public.players(name,avatar_id) values ('legacy-null',null),('legacy-1',1),('legacy-29',29)");
  const shape = async () => (await db.query(`select jsonb_build_object(
    'table',(select jsonb_build_object('rls',relrowsecurity,'force_rls',relforcerowsecurity,'acl',relacl::text) from pg_class where oid='public.players'::regclass),
    'columns',(select jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull,'acl',attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) order by attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.players'::regclass and a.attnum>0 and not a.attisdropped),
    'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='players'),
    'other_constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid,true)) order by conname) from pg_constraint where conrelid='public.players'::regclass and conname<>'players_avatar_id_range')
  ) as value`)).rows[0].value;
  const assignments = async () => (await db.query("select name,avatar_id from public.players order by name")).rows;
  const constraint = async () => (await db.query("select pg_get_constraintdef(oid,true) as definition,convalidated from pg_constraint where conrelid='public.players'::regclass and conname='players_avatar_id_range'")).rows[0];
  const comment = async () => (await db.query("select col_description('public.players'::regclass,attnum) as value from pg_attribute where attrelid='public.players'::regclass and attname='avatar_id'")).rows[0].value;
  const beforeShape = await shape(), beforeRows = await assignments(), beforeConstraint = await constraint(), beforeComment = await comment();
  await assert.rejects(db.query("update public.players set avatar_id=30 where name='legacy-29'"), /players_avatar_id_range/);
  await db.exec(up);
  assert.deepEqual(await shape(),beforeShape,'column/default/ACL/RLS/policies/other constraints must not change');
  assert.deepEqual(await assignments(),beforeRows,'old saved choices must not change');
  assert.deepEqual(await constraint(),{definition:'CHECK (avatar_id IS NULL OR avatar_id >= 1 AND avatar_id <= 32)',convalidated:true});
  assert.match(await comment(),/1\.\.32/);
  await db.exec(up);
  assert.deepEqual(await shape(),beforeShape,'reapplication must preserve security/column shape');
  for (const value of [null,1,29,30,31,32]) {
    await db.query("update public.players set avatar_id=$1 where name='legacy-29'",[value]);
    assert.equal((await db.query("select avatar_id from public.players where name='legacy-29'")).rows[0].avatar_id,value);
  }
  for (const value of [0,-1,33,32767]) await assert.rejects(db.query("update public.players set avatar_id=$1 where name='legacy-29'",[value]),/players_avatar_id_range/);
  const savedNewRows = await assignments();
  await assert.rejects(db.exec(down),/saved appended avatar identities must be preserved/);
  await db.exec('rollback');
  assert.deepEqual(await assignments(),savedNewRows,'blocked rollback must preserve appended assignments');
  assert.match((await constraint()).definition,/<= 32/);
  assert.deepEqual(await shape(),beforeShape);
  await db.query("update public.players set avatar_id=29 where name='legacy-29'");
  await db.exec(down);
  assert.deepEqual(await assignments(),beforeRows);
  assert.deepEqual(await constraint(),beforeConstraint,'rollback must restore the exact captured named check');
  assert.equal(await comment(),beforeComment,'rollback must restore the original column comment');
  assert.deepEqual(await shape(),beforeShape);
  await db.exec(down);
  await db.exec(up);
  await db.exec(`begin; set local role anon;
    insert into public.players(name,avatar_id) values ('synthetic-30',30),('synthetic-31',31),('synthetic-32',32);
    update public.players set avatar_id=29 where name like 'synthetic-%'; rollback;`);
  assert.deepEqual(await assignments(),beforeRows,'anon representative insert/update rollback leaves zero committed synthetic rows');
  assert.deepEqual(await shape(),beforeShape);
  await db.exec('alter table public.players drop constraint players_avatar_id_range; alter table public.players add constraint players_avatar_id_range check(avatar_id is null or avatar_id >= 1 and avatar_id <= 33)');
  await assert.rejects(db.exec(up),/verified avatar range constraint has changed/);
  await db.exec('rollback');
  assert.match((await constraint()).definition,/<= 33/,'drift guard must not overwrite an unexpected constraint');
  console.log('SC-057 LOCAL database contracts PASS: forward/reapply, accepted NULL/1/29/30/31/32, rejected integer0/-1/33/32767, original choices and ACL/RLS/policies/column shape unchanged, exact rollback/reapply, new-ID rollback abort, anon zero-committed-row insert/update, drift guard. Production remains unapplied.');
} finally { await db.close(); }
