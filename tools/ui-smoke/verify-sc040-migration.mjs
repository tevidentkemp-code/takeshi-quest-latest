import assert from 'node:assert/strict';
import fs from 'node:fs';
// Isolated test database only. No network or production database credentials.
const { PGlite } = await import(process.env.SQ_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec("create table public.players(id uuid primary key, name text not null); insert into public.players values ('11111111-1111-4111-8111-111111111111','Legacy'); alter table public.players enable row level security;");
  const up = fs.readFileSync('supabase/migrations/20260920162000_sc040_player_avatar_identity.sql','utf8');
  await db.exec(up); await db.exec(up);
  assert.equal((await db.query('select avatar_id from public.players')).rows[0].avatar_id,null);
  for (const id of [1,29,null]) await db.query('update public.players set avatar_id=$1',[id]);
  for (const id of [0,30,-1]) await assert.rejects(db.query('update public.players set avatar_id=$1',[id]));
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.players'::regclass")).rows[0].relrowsecurity,true);
  await db.exec(fs.readFileSync('supabase/rollbacks/sc040_player_avatar_identity.sql','utf8'));
  assert.deepEqual((await db.query('select * from public.players')).rows,[{id:'11111111-1111-4111-8111-111111111111',name:'Legacy'}]);
  await db.exec(up);
  console.log('SC-040 migration PASS: apply/reapply, nullable legacy, valid bounds, invalid rejection, RLS preserved, rollback preserves row, reapply after rollback. Isolated PGlite only.');
} finally { await db.close(); }
