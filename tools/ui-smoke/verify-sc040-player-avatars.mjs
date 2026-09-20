import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const util=fs.readFileSync('src/app/util.js','utf8');
const router=fs.readFileSync('src/app/router-ui.js','utf8');
const post=fs.readFileSync('src/live-game/postgame-flow.mjs','utf8');
const add=fs.readFileSync('src/ui/modals/setup/add-player-modal.html','utf8');
const css=fs.readFileSync('src/styles/setup/match-setup-base.css','utf8');
const mig=fs.readFileSync('supabase/migrations/20260920162000_sc040_player_avatar_identity.sql','utf8');
assert(util.includes('const SQ_AVATAR_COUNT = 29;'));
assert(util.includes('const SQ_AVATAR_AUTO_ASSIGN_COUNT = 20;'));
assert(util.includes('__sqAvatarAutoAssignId'));
assert(router.includes("__sqAvatarAutoAssignId('new-player')"));
assert(util.includes('avatar-sprite.webp'));
assert(util.includes('avatar_id'));
assert(router.includes('newPlayerAvatarPicker'));
assert(router.includes('avatar_id: __sqAvatarIdForPlayer'));
assert(util.includes('__sqEnhancePlayerHubAvatarEditor'));
assert(fs.readFileSync('src/legacy/scripts/inline-008.js','utf8').includes('__sqEnhancePlayerHubAvatarEditor(overlay, player)'));
assert(post.includes('celebration-sprite.webp'));
assert(post.includes('sq-gc-celebration-sprite'));
assert(add.includes('id="newPlayerAvatarPicker"'));
assert(css.includes('.sq-avatar-picker'));
assert(mig.includes('between 1 and 29'));
assert(fs.statSync('assets/avatars/avatar-sprite.webp').size > 100000);
assert(fs.statSync('assets/avatars/celebration-sprite.webp').size > 500000);
console.log('SC-040 avatar identity static QA passed.');

const context = vm.createContext({window:{}});
vm.runInContext(util.slice(util.indexOf('/* ===== SC-040 PLAYER AVATAR IDENTITY'), util.indexOf('/* ===== /SC-040 PLAYER AVATAR IDENTITY')), context);
const api = context.window;
const seed = '11111111-1111-4111-8111-111111111111';
const fallback = api.__sqAvatarIdForPlayer({id:seed,avatar_id:null});
assert.equal(api.SQ_AVATAR_AUTO_ASSIGN_COUNT,20);
assert(fallback >= 1 && fallback <= 20,'automatic fallback must stay inside AI-generated pool');
assert.equal(api.__sqAvatarIdForPlayer({id:seed,name:'Renamed',avatar_id:null}),fallback);
for (const sample of ['',seed,'alpha','beta','guest-player','another-player']){
  const id = api.__sqAvatarAutoAssignId(sample);
  assert(id >= 1 && id <= 20,'automatic assignment escaped AI-generated pool: '+id);
}
for (const value of [null,undefined,0,-1,30,1.5,'1oops',{},true]){
  const id = api.__sqNormalizeAvatarId(value,seed);
  assert.equal(id,fallback);
  assert(id >= 1 && id <= 20,'invalid avatar fallback escaped AI-generated pool');
}
for (let id=21; id<=29; id++){
  assert.equal(api.__sqNormalizeAvatarId(id,seed),id,'explicit/manual photo-derived selection must remain stable');
  assert.equal(api.__sqAvatarIdForPlayer({id:seed,avatar_id:id}),id,'persisted explicit avatar must be preserved');
}
const positions = new Set();
for(let id=1;id<=29;id++){
  assert.equal(api.__sqNormalizeAvatarId(id),id);
  const pos=api.__sqAvatarSpritePosition(id);
  assert(pos.x>=0 && pos.x<=100 && pos.y>=0 && pos.y<=100);
  positions.add(`${pos.col}:${pos.row}`);
}
assert.equal(positions.size,29);
assert(!positions.has('5:4'),'reserved blank sprite cell must never be selected');
console.log('SC-040 identity contracts PASS: 29 paired positions, AI-only automatic fallback (1-20), explicit 21-29 preserved, blank excluded.');
