/** Representative, in-memory PostgreSQL fixture. Never connects to production. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function setupFixture({ auditDir = process.env.SC004_AUDIT_DIR,
  pgliteModule = process.env.SC004_PGLITE_MODULE } = {}) {
  if (!auditDir || !pgliteModule) throw new Error('Set SC004_AUDIT_DIR and SC004_PGLITE_MODULE to the captured read-only preimages and PGlite module.');
  const { PGlite } = await import(pathToFileURL(pgliteModule).href);
  const read = name => JSON.parse(fs.readFileSync(path.join(auditDir, name), 'utf8'));
  const schema = read('functions-schema-preimage.json');
  const catalog = read('database-catalog-preimage.json');
  const indexes = read('indexes-preimage.json');
  const view = read('views-sequences-preimage.json').view_write_paths[0];
  const db = new PGlite();
  const qi = s => '"' + s.replaceAll('"', '""') + '"';
  const tables = catalog.relations.filter(r => r.schema === 'public' && r.kind === 'r');
  try {
    await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
    // Exact columns required by the candidate, not an Auth implementation.
    await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean,email_confirmed_at timestamptz,deleted_at timestamptz); CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),not_after timestamptz); REVOKE ALL ON SCHEMA auth FROM PUBLIC,anon,authenticated;');
    for (const seq of ['players_archive_id_seq','high_scores_id_seq','high_scores_sp_id_seq','game_events_id_seq']) await db.exec('CREATE SEQUENCE public.' + qi(seq));
    for (const table of tables) {
      const cols = schema.columns.filter(c => c.table_schema === 'public' && c.table_name === table.name);
      const ddl = cols.map(c => {
        let type = c.data_type === 'ARRAY' ? c.udt_name.slice(1) + '[]' : c.data_type;
        let d = qi(c.column_name) + ' ' + type;
        if (c.is_generated === 'ALWAYS') d += ' GENERATED ALWAYS AS (' + c.generation_expression + ') STORED';
        else if (c.column_default) d += ' DEFAULT ' + c.column_default;
        if (c.is_nullable === 'NO') d += ' NOT NULL';
        return d;
      }).join(', ');
      await db.exec('CREATE TABLE public.' + qi(table.name) + ' (' + ddl + ')');
    }
    for (const c of schema.constraints.filter(c => tables.some(t => t.name === c.table) && c.type !== 'f')) await db.exec('ALTER TABLE public.' + qi(c.table) + ' ADD CONSTRAINT ' + qi(c.name) + ' ' + c.definition);
    const names = new Set(schema.constraints.map(c => c.name));
    for (const i of indexes.filter(i => i.schemaname === 'public' && i.indexdef.startsWith('CREATE UNIQUE') && !names.has(i.indexname))) await db.exec(i.indexdef);
    for (const c of schema.constraints.filter(c => tables.some(t => t.name === c.table) && c.type === 'f')) await db.exec('ALTER TABLE public.' + qi(c.table) + ' ADD CONSTRAINT ' + qi(c.name) + ' ' + c.definition);
    for (const t of tables) await db.exec('ALTER TABLE public.' + qi(t.name) + ' ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.' + qi(t.name) + ' TO anon,authenticated,service_role;');
    await db.exec('GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated,service_role');
    for (const p of catalog.policies.filter(p => p.schemaname === 'public')) {
      let sql = 'CREATE POLICY ' + qi(p.policyname) + ' ON public.' + qi(p.tablename) + ' AS ' + p.permissive + ' FOR ' + p.cmd + ' TO ' + p.roles.map(r => r === 'public' ? 'PUBLIC' : qi(r)).join(',');
      if (p.qual) sql += ' USING (' + p.qual + ')';
      if (p.with_check) sql += ' WITH CHECK (' + p.with_check + ')';
      await db.exec(sql);
    }
    await db.exec('CREATE VIEW public.v_games_visible AS ' + view.definition + '; GRANT SELECT,INSERT,UPDATE,DELETE ON public.v_games_visible TO anon,authenticated,service_role');
    const needed = new Set(['log_player_go','sq_admin_archive_game','sq_admin_reinstate_game','sq_admin_purge_game','fn_push_high_scores','match_players_autolink','players_rename_merge_trigger','rename_player_merge','merge_player_name_everywhere']);
    for (const f of schema.functions.filter(f => needed.has(f.name))) {
      await db.exec(f.definition);
      const signature = 'public.' + qi(f.name) + '(' + f.identity + ')';
      await db.exec('REVOKE EXECUTE ON FUNCTION ' + signature + ' FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION ' + signature + ' TO service_role');
      if (f.anon_execute) await db.exec('GRANT EXECUTE ON FUNCTION ' + signature + ' TO anon');
      if (f.authenticated_execute) await db.exec('GRANT EXECUTE ON FUNCTION ' + signature + ' TO authenticated');
    }
    for (const t of schema.triggers) await db.exec(t.definition);
    // Synthetic historical records deliberately have no registry/controller.
    await db.exec("INSERT INTO players(id,name,initials,avatar_id) VALUES ('00000000-0000-4000-8000-000000000201','SYNTHETIC_A','OLD',1),('00000000-0000-4000-8000-000000000202','SYNTHETIC_B','B',2),('00000000-0000-4000-8000-000000000203','SYNTHETIC_C','C',3); INSERT INTO matches(id,total_games,players,wins,history) VALUES ('00000000-0000-4000-8000-000000000001',3,'[]','[]','[]'); INSERT INTO games(id,match_id,game_number,state,finished) VALUES ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001',1,'{}',true);");
    for (const file of ['gameplay.sql','lifecycle.sql','admin-command.sql','commentary-authority.sql']) await db.exec(fs.readFileSync(path.join(root, 'docs/backend/sc004-build', file), 'utf8'));
    await db.exec('SELECT public.sq_sc004_set_hold(false)');
    for (const t of tables) await db.exec('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.'+qi(t.name)+' FROM anon,authenticated');
    await db.exec('REVOKE INSERT,UPDATE,DELETE ON public.v_games_visible FROM anon,authenticated; REVOKE EXECUTE ON FUNCTION public.log_player_go(uuid,uuid,integer,integer,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated; DROP FUNCTION public.log_player_go(uuid,uuid,integer,integer,uuid,timestamptz,timestamptz,text,boolean,text)');
  } catch (error) { await db.close(); throw error; }
  async function asRole(role, sql, values = []) {
    await db.exec('SET ROLE ' + qi(role));
    try { return await db.query(sql, values); }
    finally { await db.exec('RESET ROLE'); }
  }
  async function command(action, hash, body, issueHash = null, adminUser = null, adminSession = null) {
    const envelope = { ...body, request_id: body.request_id || crypto.randomUUID() };
    const result = await asRole('service_role', 'SELECT public.sq_sc004_command($1,$2,$3::jsonb,$4,$5::uuid,$6::uuid) AS result', [action,hash,JSON.stringify(envelope),issueHash,adminUser,adminSession]);
    return result.rows[0].result;
  }
  async function rpcAdapter(args) {
    return command(args.p_action,args.p_token_hash,args.p_body,args.p_issue_hash,args.p_admin_user,args.p_admin_session);
  }
  return { db, command, rpcAdapter, asRole, schema, catalog, tables, qi,
    replay: { baseTables: tables.length, uniqueIndexes: indexes.filter(i => i.schemaname === 'public' && i.indexdef.startsWith('CREATE UNIQUE')).length, triggers: schema.triggers.length,
      limitation: 'Synthetic rows; captured public schema/policies/unique indexes/constraints/all 3 triggers. Auth users/sessions are minimal column fixtures, not real Auth. No production, PostgREST, Edge deployment, Realtime or browser scoring invocation.' } };
}
