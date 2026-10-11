// SC-060: isolated Test Lab is GENERATED from normal production source.
// Never place a dev panel or an offline mock inside the public dist build.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const prod=path.join(root,'dist');
const lab=path.join(root,'test-lab-dist');
const htmlFile=path.join(prod,'index.html');
const fixtureFile=path.join(root,'tools/ui-smoke/security-fixture.js');
const sources=[
  ['test-lab/network-guard.js','network-guard.js'],
  ['test-lab/dev-panel.js','dev-panel.js'],
  ['test-lab/panel.css','panel.css']
];
function fail(message){throw new Error('SC-060 Lab build refused: '+message);}
function assertOne(value,fragment,name){
  if(value.split(fragment).length!==2)fail(name+' anchor missing or repeated');
}
if(!fs.existsSync(htmlFile))fail('normal npm run build must complete first');
if(!fs.existsSync(fixtureFile))fail('existing SC004 test fixture not found');
for(const [source] of sources)if(!fs.existsSync(path.join(root,source)))fail('missing '+source);

const raw=fs.readFileSync(htmlFile,'utf8');
assertOne(raw,'<head>','document head');
assertOne(raw,'</body>','document body');
if(raw.includes('__SQ_TEST_LAB')||raw.includes('/lab/network-guard.js'))
  fail('production build was contaminated by Test Lab code');
const fixture=fs.readFileSync(fixtureFile,'utf8');
const begin='await context.addInitScript(() => {';
const finish='\n  });\n}';
assertOne(fixture,begin,'existing security fixture callback');
assertOne(fixture,finish,'existing security fixture closure');
const inner=fixture.slice(fixture.indexOf(begin)+begin.length,fixture.indexOf(finish));
if(!inner.includes('sc004-ui-fixture.invalid')||!inner.includes("else if(action==='reserve_game')"))
  fail('offline SC004 fixture contract changed; inspect before rebuilding');

const bootstrap=[
 '<!-- SC060_TEST_LAB_BOOT; NEVER PRESENT IN PRODUCTION -->',
 '<meta name="robots" content="noindex,nofollow,noarchive">',
 '<meta http-equiv="Content-Security-Policy" content="connect-src \'self\'; form-action \'none\'; object-src \'none\'; worker-src \'self\' blob:">',
 '<script src="./lab/network-guard.js"></script>',
 '<script src="./lab/offline-control.js"></script>',
 '<!-- /SC060_TEST_LAB_BOOT -->'
].join('\n');
const changed=raw.replace('<head>','<head>\n'+bootstrap+'\n')
  .replace('</body>','<script src="./lab/dev-panel.js"></script>\n</body>');
const goodOrder=changed.indexOf('network-guard.js')<changed.indexOf('inline-001.js') &&
  changed.indexOf('offline-control.js')<changed.indexOf('inline-001.js');
if(!goodOrder)fail('offline guard/fixture must run before application JS');
fs.rmSync(lab,{recursive:true,force:true});
fs.cpSync(prod,lab,{recursive:true,force:true});
fs.writeFileSync(path.join(lab,'index.html'),changed,'utf8');
fs.mkdirSync(path.join(lab,'lab'),{recursive:true});
for(const [source,dest] of sources){
  fs.copyFileSync(path.join(root,source),path.join(lab,'lab',dest));
}
fs.writeFileSync(path.join(lab,'lab','offline-control.js'),
  '// SC-060: extracted exactly from existing UI security fixture; never production.\n(function(){\n'+inner+'\n})();\n','utf8');
let sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'';
if(!sha){try{sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch(_){}}
if(!/^[0-9a-f]{40}$/.test(sha))sha='unknown';
const info={lab:true,sha,builtAt:new Date().toISOString(),isolated:true,
  source:'tevidentkemp-code/takeshi-quest-latest',build:'test-lab-dist'};
fs.writeFileSync(path.join(lab,'lab','build-info.json'),
  JSON.stringify(info,null,2)+'\n','utf8');
if(fs.readFileSync(htmlFile,'utf8')!==raw)fail('production dist changed during Lab materialization');
console.log('SC-060 Lab materialization PASS: identical app source, offline fixture, isolated output, '+sha.slice(0,8));
