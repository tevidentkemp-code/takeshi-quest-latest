import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';

const util=fs.readFileSync('src/app/util.js','utf8');
const context=vm.createContext({window:{}});
vm.runInContext(util.slice(util.indexOf('/* ===== SC-040 PLAYER AVATAR IDENTITY'),util.indexOf('/* ===== /SC-040 PLAYER AVATAR IDENTITY')),context);
const api=context.window;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(digest('assets/avatars/avatar-sprite.webp'),'c24139d80247d43fa153afeb4a02de5a3061f0a92abada42d16f29896a575f12');
assert.equal(digest('assets/avatars/celebration-sprite.webp'),'96b90f87c284a74a038d6500b493ff9b016bcb94e7a11ec84107bdbc8aba953f');
for(let id=1;id<=29;id++){
  const p=api.__sqAvatarSpritePosition(id);
  assert.equal(p.col,(id-1)%6);
  assert.equal(p.row,Math.floor((id-1)/6));
  assert.equal(p.x,(p.col/5)*100);
  assert.equal(p.y,(p.row/4)*100);
  for(const celebration of [false,true]){
    const el={dataset:{},style:{}};
    (celebration?api.__sqApplyCelebrationSprite:api.__sqApplyAvatarSprite)(el,id);
    assert.equal(el.dataset.avatarId,String(id));
    assert.equal(el.dataset.avatarLayout,'sprite');
    assert.equal(el.style.backgroundSize,'600% 500%');
    assert.equal(el.style.backgroundPosition,p.x.toFixed(4)+'% '+p.y.toFixed(4)+'%');
    assert.match(el.style.backgroundImage,celebration?/celebration-sprite\.webp/:/avatar-sprite\.webp/);
  }
}
for(const id of [30,31,32]){
  assert.equal(api.__sqAvatarIdForPlayer({id:'stable-id',avatar_id:id}),id);
  assert.equal(api.__sqAvatarSpritePosition(id),null,'standalone artwork must not acquire a blank/outside sprite coordinate');
  for(const celebration of [false,true]){
    const el={dataset:{},style:{}};
    (celebration?api.__sqApplyCelebrationSprite:api.__sqApplyAvatarSprite)(el,id);
    const file=(celebration?'winner':'avatar')+'-'+id+'.webp';
    assert.equal(el.dataset.avatarId,String(id));
    assert.equal(el.dataset.avatarLayout,'standalone');
    assert.equal(el.style.backgroundImage,'url("./assets/avatars/'+file+'")');
    assert.equal(el.style.backgroundSize,'100% 100%');
    assert.equal(el.style.backgroundPosition,'center');
    assert(fs.statSync('assets/avatars/'+file).size>10000);
  }
}
for(const value of [null,undefined,0,-1,33,1.5,'1oops',{},true]){
  const id=api.__sqNormalizeAvatarId(value,'stable-id');
  assert(id>=1&&id<=20,'invalid/missing identities remain in the original automatic pool');
}
for(let seed=0;seed<1000;seed++){
  const id=api.__sqAvatarAutoAssignId('seed-'+seed);
  assert(id>=1&&id<=20);
}
const reusable={dataset:{},style:{}};
api.__sqApplyAvatarSprite(reusable,32);
api.__sqApplyAvatarSprite(reusable,29);
assert.equal(reusable.dataset.avatarLayout,'sprite');
assert.equal(reusable.style.backgroundSize,'600% 500%');
assert.match(reusable.style.backgroundImage,/avatar-sprite\.webp/);
console.log('SC-057 artwork contracts PASS: original sprite bytes and all29 paired coordinates preserved, only manual30–32 standalone pairs, recycled element restore and original autoassign20.');
