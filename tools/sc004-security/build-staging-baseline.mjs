/** Reconstruct a schema-only isolated baseline from the current read-only catalog.
 * Never sends SQL or opens a database. Refuses a production target identity.
 * Auth remains the real Supabase platform schema; no Auth fixture is generated.
 */
import fs from 'node:fs';
const [catalogPath, outputPath, targetProject] = process.argv.slice(2);
if (!catalogPath || !outputPath || !targetProject || targetProject === 'vvfqumgtasuacpggdmxx') {
  throw new Error('Usage: node build-staging-baseline.mjs catalog.json output.sql NONPRODUCTION_PROJECT');
}
const c = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const qi = v => '"' + String(v).replaceAll('"', '""') + '"';
const ql = v => "'" + String(v).replaceAll("'", "''") + "'";
const name = t => qi(t.schema) + '.' + qi(t.name);
const out = [
  '-- SC004 isolated schema-only replay. Source captured ' + c.captured_at,
  '-- Nonproduction target: ' + targetProject,
  'BEGIN;',
  "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'baseline target is not empty'; END IF; END $$;",
  'SET LOCAL check_function_bodies = off;',
  'CREATE SCHEMA IF NOT EXISTS private;',
  'CREATE SCHEMA IF NOT EXISTS legacy;',
  'REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;',
];
const tables = c.tables.filter(t => ['r', 'p'].includes(t.kind));
const identities = c.columns.filter(a => a.identity);
for (const s of c.sequences) {
  if (identities.some(a => a.schema === s.schemaname && s.sequencename === a.table + '_' + a.name + '_seq')) continue;
  out.push(`CREATE SEQUENCE ${qi(s.schemaname)}.${qi(s.sequencename)} AS ${s.data_type} START WITH ${s.start_value} INCREMENT BY ${s.increment_by} MINVALUE ${s.min_value} CACHE ${s.cache_size} ${s.cycle ? 'CYCLE' : 'NO CYCLE'};`);
}
for (const t of tables) {
  const dropped = [];
  const cols = [];
  let position = 1;
  for (const a of c.columns.filter(a => a.schema === t.schema && a.table === t.name).sort((a,b)=>a.position-b.position)) {
    while (position < a.position) {
      const placeholder = '__sc004_dropped_' + position++;
      dropped.push(placeholder); cols.push(qi(placeholder) + ' text');
    }
    let sql = qi(a.name) + ' ' + a.type;
    if (a.identity) sql += ' GENERATED ' + (a.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT') + ' AS IDENTITY';
    else if (a.generated) sql += ' GENERATED ALWAYS AS (' + a.default + ') STORED';
    else if (a.default) sql += ' DEFAULT ' + a.default;
    if (a.not_null) sql += ' NOT NULL';
    cols.push(sql); position++;
  }
  out.push(`CREATE TABLE ${name(t)} (\n  ${cols.join(',\n  ')}\n);`);
  for (const placeholder of dropped) out.push(`ALTER TABLE ${name(t)} DROP COLUMN ${qi(placeholder)};`);
}
for (const x of c.constraints.filter(x => x.type !== 'f')) {
  out.push(`ALTER TABLE ${qi(x.schema)}.${qi(x.table)} ADD CONSTRAINT ${qi(x.name)} ${x.definition};`);
}
const earlyIndexes = new Set();
for (const i of c.indexes.filter(i => i.indexdef.startsWith('CREATE UNIQUE') && tables.some(t => t.schema === i.schemaname && t.name === i.tablename))) {
  if (c.constraints.some(x => x.schema === i.schemaname && x.table === i.tablename && x.name === i.indexname)) continue;
  out.push(i.indexdef + ';'); earlyIndexes.add(i.schemaname + '.' + i.indexname);
}
for (const x of c.constraints.filter(x => x.type === 'f')) out.push(`ALTER TABLE ${qi(x.schema)}.${qi(x.table)} ADD CONSTRAINT ${qi(x.name)} ${x.definition};`);
for (const f of c.functions) out.push(f.definition + ';');
const done = new Set(tables.map(t => t.schema + '.' + t.name));
const pending = [...c.views];
while (pending.length) {
  const idx = pending.findIndex(v => (v.dependencies || []).every(d => done.has(d)));
  if (idx < 0) throw new Error('Unresolved view dependencies: ' + pending.map(v => v.name).join(','));
  const v = pending.splice(idx,1)[0];
  const t = c.tables.find(t => t.schema === v.schema && t.name === v.name);
  out.push(`CREATE ${v.kind === 'm' ? 'MATERIALIZED ' : ''}VIEW ${name(v)}${t.options?.length ? ' WITH ('+t.options.join(',')+')' : ''} AS ${v.definition.replace(/;\s*$/, '')};`);
  done.add(v.schema + '.' + v.name);
}
for (const i of c.indexes) {
  if (earlyIndexes.has(i.schemaname + '.' + i.indexname)) continue;
  if (c.constraints.some(x => x.schema === i.schemaname && x.table === i.tablename && x.name === i.indexname)) continue;
  out.push(i.indexdef + ';');
}
for (const t of c.triggers) out.push(t.definition + ';');
for (const t of tables) {
  if (t.rls) out.push(`ALTER TABLE ${name(t)} ENABLE ROW LEVEL SECURITY;`);
  if (t.force_rls) out.push(`ALTER TABLE ${name(t)} FORCE ROW LEVEL SECURITY;`);
}
for (const p of c.policies) {
  out.push(`CREATE POLICY ${qi(p.policyname)} ON ${qi(p.schemaname)}.${qi(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r => r === 'public' ? 'PUBLIC' : qi(r)).join(',')}${p.qual ? ' USING ('+p.qual+')' : ''}${p.with_check ? ' WITH CHECK ('+p.with_check+')' : ''};`);
}
const codes = {a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',U:'USAGE',X:'EXECUTE',C:'CREATE'};
function acl(sqlObject, acl) {
  out.push(`REVOKE ALL ON ${sqlObject} FROM PUBLIC,anon,authenticated,service_role;`);
  for (const item of acl || []) {
    const [, role, perms] = item.match(/^(.*?)=([^/]+)\//) || [];
    if (role === undefined) throw new Error('Unrecognized ACL');
    if (role === 'postgres') continue;
    const grantee = role === '' ? 'PUBLIC' : qi(role);
    for (const match of perms.matchAll(/([arwdDxtmUXC])(\*)?/g)) out.push(`GRANT ${codes[match[1]]} ON ${sqlObject} TO ${grantee}${match[2] ? ' WITH GRANT OPTION' : ''};`);
  }
}
for (const t of c.tables) acl((t.kind === 'S' ? 'SEQUENCE ' : 'TABLE ') + name(t), t.acl);
for (const f of c.functions) acl('FUNCTION '+name(f)+'('+f.identity_arguments+')', f.acl || ['=X/postgres']);
for (const n of c.schema_acl) acl('SCHEMA '+qi(n.name),n.acl || []);
// The platform creates its own managed Realtime schema/partitions. Only replay
// application publication members captured from the application schemas.
for (const p of (c.publication_tables || []).filter(p => ['public','private','legacy'].includes(p.schemaname))) {
  out.push(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname=${ql(p.pubname)}) THEN CREATE PUBLICATION ${qi(p.pubname)}; END IF; END $$;`);
  out.push(`ALTER PUBLICATION ${qi(p.pubname)} ADD TABLE ${qi(p.schemaname)}.${qi(p.tablename)};`);
}
out.push('COMMIT;');
fs.writeFileSync(outputPath,out.join('\n\n')+'\n');
console.log(JSON.stringify({targetProject,tables:tables.length,views:c.views.length,functions:c.functions.length,triggers:c.triggers.length,policies:c.policies.length,bytes:fs.statSync(outputPath).size,productionDataCopied:false,authMocked:false}));
