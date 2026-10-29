import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/app/util.js', 'utf8');
const start = source.indexOf('// Halloween names are display-only');
const end = source.indexOf('\nfunction __sqPlayerPretty', start);
assert(start >= 0 && end > start, 'Halloween helpers found');
let active = true, listener;
const textNodes = [], labelNodes = [];
const document = {
  addEventListener(type, handler) { if (type === 'sq:halloween-change') listener = handler; },
  querySelectorAll(selector) { return selector === '[data-sq-halloween-original]' ? textNodes : labelNodes; }
};
const context = { document, window: { __sqHalloweenActive: () => active }, Set, Math };
vm.runInNewContext(`let _sqPlayerDir = { byId:{}, byName:{}, list:[] };\n${source.slice(start, end)}\nglobalThis.halloweenTest = { nickname:__sqHalloweenNickname, epithet:__sqHalloweenEpithet, text:__sqSetHalloweenText, label:__sqSetHalloweenLabel, setDirectory(value){ _sqPlayerDir = value; } };`, context);
const {nickname, epithet, text, label, setDirectory} = context.halloweenTest;
const players = Array.from({length: 100}, (_, i) => ({name:`Player ${i}`, id:`id-${i}`}));
const aliases = players.map(nickname);
assert.equal(new Set(aliases).size, players.length, 'aliases remain distinct even when the finite epithet list repeats');
assert(new Set(players.map(epithet)).size < players.length, 'test exercises repeated epithets');
assert.equal(nickname({name:'Guest Ellen'}), nickname('Guest Ellen'), 'guest alias is stable across forms');
const alice = {name:'Alice Example', id:'saved-1', nickname:'Ace'};
const aliceBefore = JSON.stringify(alice);
setDirectory({list:[alice], byId:{'saved-1':alice}, byName:{'alice example':alice}});
assert.equal(nickname(alice), nickname({name:alice.name}), 'saved player alias is stable by name');
assert.equal(nickname(alice), nickname('saved-1'), 'saved player alias is stable by ID');
assert.equal(JSON.stringify(alice), aliceBefore, 'player identity is not changed');
const twins = [{name:'Sam Example',id:'one'},{name:'Sam Example',id:'two'}];
setDirectory({list:twins, byId:{one:twins[0],two:twins[1]}, byName:{'sam example':twins[0]}});
assert.notEqual(nickname(twins[0]), nickname(twins[1]), 'same-name registered players with known IDs are distinct');
const textNode = {dataset:{}, textContent:'', hidden:false};
const labelNode = {dataset:{}, attributes:{title:'Existing title'}, setAttribute(k,v){this.attributes[k]=v;}, getAttribute(k){return this.attributes[k] ?? null;}, hasAttribute(k){return Object.hasOwn(this.attributes,k);}, removeAttribute(k){delete this.attributes[k];}};
textNodes.push(textNode); labelNodes.push(labelNode);
text(textNode,'Original', 'Seasonal'); label(labelNode,'AB', 'Seasonal');
assert.equal(textNode.textContent, 'Seasonal'); assert.equal(labelNode.attributes.title, 'Seasonal'); assert.equal(labelNode.attributes['aria-label'], 'Seasonal');
active = false; listener();
assert.equal(textNode.textContent, 'Original'); assert.equal(labelNode.attributes.title, 'Existing title'); assert(!('aria-label' in labelNode.attributes), 'absent aria-label is removed again');
console.log('Halloween aliases: distinct players, identity resolution, guests, saved data, and expiry PASS');
