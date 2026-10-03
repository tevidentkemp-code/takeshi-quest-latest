/** Read-only fingerprints for the dedicated real local rollback rehearsal. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const config=JSON.parse(fs.readFileSync(process.env.SC004_LOCAL_ENV,'utf8'));
if((config.API_URL||config.api_url)!=='http://127.0.0.1:54821')throw new Error('Only the dedicated local stack is allowed.');
const [destination]=process.argv.slice(2);
if(!destination)throw new Error('A public fingerprint receipt path is required.');
const sql=q=>execFileSync('docker',['--host',process.env.SC004_DOCKER_HOST||'unix:///Users/Thom/.colima/sc004/docker.sock','exec','-i','supabase_db_sc004-supabase-local','psql','-X','-U','postgres','-d','postgres','-At','--set','ON_ERROR_STOP=on','-c',q],{encoding:'utf8'}).trim();
const existing=JSON.parse(sql("SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='private' AND tablename LIKE 'sc004_%' AND tablename<>'sc004_write_control'"));
// Use catalog-verified identifiers; never interpolate an external table name.
const state={};
for(const name of existing){
  if(!/^sc004_[a-z_]+$/.test(name))throw new Error('Unexpected private identifier');
  state[name]=JSON.parse(sql(`SELECT json_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text)) FROM private."${name}" t`));
}
const functions=JSON.parse(sql("SELECT json_agg(json_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'md5',md5(pg_get_functiondef(p.oid))) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')"));
const held=sql('SELECT held FROM private.sc004_write_control WHERE singleton')==='t';
fs.writeFileSync(destination,JSON.stringify({captured_at:new Date().toISOString(),environment:'isolated-real-local-supabase',productionWrites:false,held,functions,private_state:state},null,2)+'\n');
console.log(JSON.stringify({held,functions:functions.length,private_tables:existing.length,destination}));
