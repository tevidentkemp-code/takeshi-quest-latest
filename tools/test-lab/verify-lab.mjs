// SC-060 Test Lab static/provenance/security build acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Script } from 'node:vm';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main=read('dist/index.html');
const lab=read('test-lab-dist/index.html');
const marker='<!-- SC060_TEST_LAB_BOOT; NEVER PRESENT IN PRODUCTION -->';
const contentPolicy="connect-src 'self'; form-action 'none'; object-src 'none'; worker-src 'self' blob:";
assert(!main.includes(marker)&&!main.includes('./lab/network-guard.js'),'production HTML contains Lab');
assert(!fs.existsSync(path.join(root,'dist/lab')),'Lab files copied into production dist');
assert(lab.includes(marker),'Lab HTML missing environment boot tag');
assert(lab.includes(contentPolicy),'Lab output must block external network at CSP level');
assert(lab.indexOf('network-guard.js')<lab.indexOf('inline-001.js'),'Lab guard must load before app');
assert(lab.indexOf('offline-control.js')<lab.indexOf('inline-001.js'),'Offline SC004 must load before app');
assert(lab.includes('lab/dev-panel.js'),'Lab output missing controls');
const prefix=[
 '<!-- SC060_TEST_LAB_BOOT; NEVER PRESENT IN PRODUCTION -->',
 '<meta name="robots" content="noindex,nofollow,noarchive">',
 '<meta http-equiv="Content-Security-Policy" content="connect-src \'self\'; form-action \'none\'; object-src \'none\'; worker-src \'self\' blob:">',
 '<script src="./lab/network-guard.js"></script>',
 '<script src="./lab/offline-control.js"></script>',
 '<!-- /SC060_TEST_LAB_BOOT -->'
].join('\n');
const parity=lab.replace('<head>\n'+prefix+'\n','<head>')
  .replace('<script src="./lab/dev-panel.js"></script>\n</body>','</body>');
assert.equal(parity,main,'Lab must be identical current production build plus isolated injector');
const guard=read('test-lab-dist/lab/network-guard.js');
const fixture=read('test-lab-dist/lab/offline-control.js');
const panel=read('test-lab-dist/lab/dev-panel.js');
for(const [name,js] of [['guard',guard],['offline match',fixture],['dev panel',panel]])
  assert.doesNotThrow(()=>new Script(js),name+' has syntax errors');
assert(guard.includes('__SQ_TEST_LAB')&&guard.includes('.supabase.co')&&guard.includes("method==='GET'"),'offline guard missing');
assert(fixture.includes('sc004-ui-fixture.invalid')&&fixture.includes("action==='reserve_game'"),'real security UI fixture not used');
for(const label of ['quick2','quick5','last','end','xp','won','lost','feed','reset'])
  assert(panel.includes(label),'missing Lab action '+label);
const info=JSON.parse(read('test-lab-dist/lab/build-info.json'));
assert.equal(info.lab,true);assert.equal(info.isolated,true);
const vercel=JSON.parse(read('vercel.json'));
assert.equal(vercel.buildCommand,'npm run build && node scripts/build-test-lab.mjs');
assert.equal(vercel.outputDirectory,'test-lab-dist');
assert(vercel.headers.some(x=>x.headers?.some(h=>h.key==='Content-Security-Policy'&&h.value.includes("connect-src 'self'"))),'missing server-side CSP');
assert.equal(JSON.parse(read('package.json')).scripts.build,'npm run materialize && vite build');
console.log('SC-060 PASS: production/lab build isolation, CSP, offline fixture, 9 controls, source parity, static syntax, release provenance');
