/** Generates functions-only refresh/recovery from the reviewed deployable SQL. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'docs/backend/sc004-build');
const sections=[];
for(const file of ['gameplay.sql','lifecycle.sql','admin-command.sql','commentary-authority.sql']){
 const source=fs.readFileSync(path.join(dir,file),'utf8');
 for(const match of source.matchAll(/CREATE(?: OR REPLACE)? FUNCTION[\s\S]*?\$f\$;\n(?:REVOKE[^;]*;\n|GRANT[^;]*;\n)*/g))sections.push(match[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
}
const definitions=sections.join('\n')+'\nDROP FUNCTION IF EXISTS public.sq_sc004_admin(jsonb,uuid,uuid);\n';
fs.writeFileSync(path.join(dir,'function-refresh.sql'),'-- Coordinated functions-only refresh. Schema, registries, capabilities and receipts survive.\nBEGIN;\n'+definitions+'COMMIT;\n');
fs.writeFileSync(path.join(dir,'function-recovery.sql'),'-- Restricted-safe secure function recovery. No anonymous policies/grants restored.\nBEGIN;\nSELECT public.sq_sc004_set_hold(true);\n'+definitions+'COMMIT;\n-- Verify restricted acceptance before separately SELECT public.sq_sc004_set_hold(false);\n');
const command=sections.find(s=>s.startsWith('CREATE OR REPLACE FUNCTION public.sq_sc004_command('));
if(!command)throw new Error('Missing reviewed dispatcher.');
fs.writeFileSync(path.join(dir,'dispatcher-refresh.sql'),'-- Exact current dispatcher; use full function-refresh.sql for coordinated final refresh.\n'+command);
console.log(JSON.stringify({functions:sections.length,publicFunctions:sections.filter(s=>s.includes('FUNCTION public.')).length}));
