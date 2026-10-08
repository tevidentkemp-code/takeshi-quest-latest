// SC063 directory warm-read regression. Actual directory + XP/cache/service;
// modeled DOM/cloud seams; native directory geometry/observer acceptance separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const sourcePath = process.argv[2] || fileURLToPath(new URL('../../src/ui/modals.js', import.meta.url));
const source = fs.readFileSync(sourcePath,'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function fn(name) { const m=source.match(new RegExp('^(?:async )?function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?^\\}','m')); assert(m,name);return m[0]; }
const directory=source.match(/^window.openPlayerStatsSelect = function openPlayerStatsSelect\(\)\{[\s\S]*?^};/m)?.[0];assert(directory);
assert(!directory.includes("cloudFetchAllGamesAsLocal().catch(function(){});"),'Ignored warm request removed');
const prewarmLine="  try{ if (typeof cloudFetchAllGamesAsLocal === 'function') cloudFetchAllGamesAsLocal().catch(function(){}); }catch(_){ }\n";
const namesWarm="  try{ if (typeof cloudListPlayers === 'function') cloudListPlayers().catch?.(function(){}); }catch(_){ }\n";
assert.equal(directory.split(namesWarm).length,2);
const originalDirectory=directory.replace('  // Warm player names for the directory; full games load with the profile.','  // Warm the caches so the hub + profile open instantly after a name is picked.').replace(namesWarm,namesWarm+prewarmLine);
const xp=source.slice(source.indexOf('const SQ_XP = {'),source.indexOf('window.SQ_XP = SQ_XP;')+'window.SQ_XP = SQ_XP;'.length);
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.nodeType = 1; this.ownerDocument = doc; this.children = []; this.parentElement = null; this.style = {}; this.attributes = {}; this.dataset = {}; this.disabled = false; this.value = ''; this.textContent = ''; this._class = ''; this._html = ''; this.events = new Map(); this.classList = { toggle: (name, on) => { const names = new Set(this._class.split(/\s+/).filter(Boolean)); (on ?? !names.has(name)) ? names.add(name) : names.delete(name); this._class = [...names].join(' '); }, add: name => this.classList.toggle(name, true), contains: name => this._class.split(/\s+/).includes(name) }; }
  set textContent(value) { this.replaceChildren(); this._text = String(value); } get textContent() { return (this._text || '') + this.children.map(child => child.textContent).join(''); }
  scrollTo(options) { this.scrollTop = options.top; } getBoundingClientRect() { return { top:0, height:20 }; }
  set className(value) { this._class = value; } get className() { return this._class; }
  set innerHTML(value) { this.replaceChildren(); this._html = value; if (value.includes('ps-pick-star')) { const star = new Element('button', this.ownerDocument); const match = value.match(/class="(ps-pick-star[^"]*)"/); star.className = match ? match[1] : 'ps-pick-star'; star.textContent = '☆'; this.appendChild(star); } } get innerHTML() { return this._html; }
  get parentNode() { return this.parentElement; } get firstElementChild() { return this.children[0] || null; }
  get isConnected() { if (this === this.ownerDocument.body) return true; return !!this.parentElement?.isConnected; }
  appendChild(node) { node.remove(); this.children.push(node); node.parentElement = this; return node; }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  replaceChildren(...nodes) { for (const old of [...this.children]) old.remove(); this.append(...nodes); }
  remove() { if (!this.parentElement) return; const wasConnected = this.isConnected, parent = this.parentElement; parent.children.splice(parent.children.indexOf(this), 1); this.parentElement = null; if (wasConnected && this.ownerDocument.notifyRemoval) this.ownerDocument.notifyRemoval(this); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  removeChild(node) { node.remove(); return node; }
  replaceWith(node) { const parent = this.parentElement; if (!parent) return; const index = parent.children.indexOf(this); this.remove(); node.remove(); parent.children.splice(index, 0, node); node.parentElement = parent; }
  insertBefore(node, before) { node.remove(); const index = this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, node); node.parentElement = this; }
  setAttribute(key, value) { this.attributes[key] = value; } getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, callback) { const values = this.events.get(name) || []; values.push(callback); this.events.set(name, values); }
  focus() { this.ownerDocument.activeElement = this; }
  matches(selector) { if (selector.startsWith('.')) return this.classList.contains(selector.slice(1)); const attr = selector.match(/^\[([^=]+)=(?:["']?)([^"'\]]+)(?:["']?)\]$/); if (attr) return this.attributes[attr[1]] === attr[2]; return this.tagName.toLowerCase() === selector; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  cloneNode(deep) { const node = new Element(this.tagName, this.ownerDocument); node.className = this.className; node.textContent = this.textContent; node.attributes = { ...this.attributes }; if (deep) node.append(...this.children.map(child => child.cloneNode(true))); return node; }
}
function environment({control=false,playersError=false}={}){
  const doc={createElement:tag=>new Element(tag,doc)};doc.body=doc.createElement('body');doc.querySelectorAll=s=>doc.body.querySelectorAll(s);doc.querySelector=s=>doc.body.querySelector(s);
  const calls=[],queries=[],timers=new Map(),storage=new Map();let id=1;
  const context={window:null,document:doc,console:{warn(){},error(){}},Promise,Map,Set,Array,String,Number,Date,Math,
    setTimeout(fn,ms){const n=id++;timers.set(n,{fn,ms});return n;},clearTimeout(n){timers.delete(n);},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:true}),
    cloudListPlayers:async()=>{calls.push({source:'players'});if(playersError)throw Error('directory source unavailable');return[{name:'Sam T',nickname:'Hammer'},{name:'Alex S',nickname:'Atomic'},{name:'Jo R'}];},
    cloudFetchAllGamesAsLocal:()=>{calls.push({source:'full-games'});return Promise.resolve([]);},
    openPlayerStatsHub(name){calls.push({source:'selected',name});context.selectedXP=context.SQ_XP.forNameState(name);},
    sb:{from(table){assert.equal(table,'v_player_xp');const q={limitValue:null,name:null,pending:deferred(),select(columns){assert.equal(columns,'*');return q;},ilike(field,name){assert.equal(field,'name');q.name=name;return q;},eq(){throw Error('Unexpected ID route in directory fixture');},limit(n){q.limitValue=n;return q;},then(resolve,reject){return q.pending.promise.then(resolve,reject);}};queries.push(q);return q;}}
  };
  context.window=context;vm.createContext(context);vm.runInContext(xp+'\n'+['__sqStatsSourceDeadline','__sqPlayerStatsSourceMessage','__sqPlayerStatsKey','__sqPlayerStatsNameOf','__sqSetPlayerStatsSelectedName','__sqLoadPlayerStatsPlayers'].map(fn).join('\n')+'\n'+(control?originalDirectory:directory),context);
  const all=context.SQ_XP.all.bind(context.SQ_XP);context.SQ_XP.all=force=>{calls.push({source:'all-XP',force:!!force});return all(force);};
  return{context,doc,calls,queries,storage,timers,open:()=>context.openPlayerStatsSelect(),root:()=>doc.querySelector('.sq-player-stats-directory'),names:()=>doc.querySelectorAll('.menu-row').map(row=>row.getAttribute('aria-label').replace('Choose player ','')),rows:()=>doc.querySelectorAll('.menu-row'),chip:type=>doc.querySelectorAll('.ps-pick-chip').find(node=>node.dataset.f===type),resolveAll(result){const q=queries.find(q=>q.limitValue===null&&!q.done);assert(q,'Full-XP query pending');q.done=true;q.pending.resolve(result);},resolveSelected(result){const q=queries.find(q=>q.limitValue===1&&!q.done);assert(q,'Selected-XP query pending');q.done=true;q.pending.resolve(result);}};
}
const results=[];async function test(name,run){const detail=await run();results.push({name,status:'PASS',...detail});}
async function mount(e){e.open();await flush();assert(e.root()?.isConnected);}
function button(root,label){const value=root.querySelectorAll('button').find(node=>node.textContent===label||node.getAttribute('aria-label')===label);assert(value,label);return value;}
await test('captured original directory dispatches ignored full-history preload',async()=>{const e=environment({control:true});await mount(e);assert.equal(e.calls.filter(c=>c.source==='full-games').length,1);return{negativeControlObserved:true};});
await test('candidate mounts alphabetical directory before Top without full-game preload',async()=>{const e=environment();await mount(e);assert.deepEqual(e.names(),['Alex S','Jo R','Sam T']);assert.equal(e.calls.filter(c=>c.source==='full-games').length,0);assert.equal(e.calls.filter(c=>c.source==='players').length,2);assert.equal(e.chip('top').disabled,false);assert.deepEqual(e.calls.filter(c=>c.source==='all-XP'),[]);e.chip('top').onclick();await flush();assert(e.chip('top').disabled);assert.deepEqual(e.calls.filter(c=>c.source==='all-XP').map(c=>c.force),[false]);return{playerNameWarmAndCanonicalLoadRetained:true};});
await test('healthy all-XP Top sorting preserves authoritative zero and descending positive values',async()=>{const e=environment();await mount(e);e.chip('top').onclick();await flush();e.resolveAll({data:[{name:'Sam T',total_xp:300},{name:'Jo R',total_xp:151},{name:'Alex S',total_xp:0}],error:null});await flush();assert.equal(e.chip('top').disabled,false);e.chip('top').onclick();assert.deepEqual(e.names(),['Sam T','Jo R','Alex S']);assert(!e.rows()[2].innerHTML.includes('LV '));assert(e.rows()[0].innerHTML.includes('LV '));return{genuineZeroNotFailure:true};});
await test('all-XP failure stays unavailable; Retry uses forced fresh source and recovers true zero',async()=>{const e=environment();await mount(e);e.chip('top').onclick();await flush();e.resolveAll({data:null,error:{code:'57014'}});await flush();assert(e.chip('top').disabled);const status=e.root().querySelector('.ps-pick-source');assert(/unavailable/.test(status.textContent));button(status,'Retry').onclick();await flush();assert.equal(e.queries.length,2);e.resolveAll({data:[{name:'Alex S',total_xp:0}],error:null});await flush();assert.equal(e.chip('top').disabled,false);assert(!/unavailable/.test(status.textContent));assert.deepEqual(e.calls.filter(c=>c.source==='all-XP').map(c=>c.force),[false,true]);return{failureNotTurnedIntoZero:true};});
await test('search, favourite persistence and alphabet focus remain canonical before XP resolves',async()=>{const e=environment();await mount(e);e.rows()[0].querySelector('.ps-pick-star').onclick({stopPropagation(){}});assert.deepEqual(JSON.parse(e.storage.get('sq_stats_fav_players_v1')),['alex s']);e.chip('fav').onclick();assert.deepEqual(e.names(),['Alex S']);e.chip('all').onclick();const search=e.root().querySelector('.ps-pick-search');search.value='Hammer';for(const cb of search.events.get('input'))cb();assert.deepEqual(e.names(),['Sam T']);button(e.root(),'Jump to names beginning with S').onclick();assert.equal(e.doc.activeElement,e.rows()[0]);assert.equal(e.calls.filter(c=>c.source==='selected').length,0);return{};});
for(const action of ['Back','Close'])await test('directory '+action+' exits; late all-XP cannot reopen it',async()=>{const e=environment();await mount(e);e.chip('top').onclick();await flush();button(e.root(),action).onclick();assert(!e.root());e.resolveAll({data:[{name:'Alex S',total_xp:151}],error:null});await flush();assert(!e.root());assert.equal(e.context.SQ_XP._allAvailable,true);assert.equal(e.calls.filter(c=>c.source==='full-games').length,0);return{alreadyStartedXPNotCancelled:true};});
await test('selecting before all-XP settles starts selected XP independently',async()=>{const e=environment();await mount(e);e.chip('top').onclick();await flush();e.rows()[0].onclick({target:null});await flush();assert(!e.root());assert.equal(e.queries.length,2);assert.equal(e.queries[0].limitValue,null);assert.equal(e.queries[1].limitValue,1);e.resolveSelected({data:[{name:'Alex S',total_xp:151}],error:null});const value=await e.context.selectedXP;assert(value.available&&value.row.total_xp===151);assert.equal(e.queries[0].done,undefined);assert.equal(e.calls.filter(c=>c.source==='full-games').length,0);return{selectedDoesNotJoinPendingDirectoryXP:true};});
await test('selecting after failed all-XP performs genuine selected read independently',async()=>{const e=environment();await mount(e);e.chip('top').onclick();await flush();e.resolveAll({data:null,error:{code:'57014'}});await flush();e.rows()[0].onclick({target:null});await flush();assert.equal(e.queries.length,2);e.resolveSelected({data:[{name:'Alex S',total_xp:0}],error:null});const value=await e.context.selectedXP;assert(value.available&&value.row.total_xp===0);return{};});
await test('completed authoritative directory XP cache retains existing selected-row reuse',async()=>{const e=environment();await mount(e);e.chip('top').onclick();await flush();const row={name:'Alex S',total_xp:0};e.resolveAll({data:[row],error:null});await flush();e.rows()[0].onclick({target:null});const value=await e.context.selectedXP;assert.equal(e.queries.length,1);assert.equal(value.row,row);assert(value.available);return{cacheSemanticsUnchanged:true};});
await test('player directory failure remains explicit and does not start XP or full-game reads',async()=>{const e=environment({playersError:true});e.open();await flush();assert(/Player list is unavailable/.test(e.root().textContent));assert.equal(e.queries.length,0);assert.equal(e.calls.filter(c=>c.source==='full-games').length,0);return{};});
console.log(JSON.stringify({status:'SC063 DIRECTORY WARM-READ CONTROLLED REGRESSION PASS',cases:results.length,sourcePath,sourceSHA256:hash(source),results,scope:'Actual directory/XP service with lightweight DOM/query transport model; native rendering/manager/lifecycle and public reliability separate',browserRuns:[],SQLRuns:[],budgetsChanged:[],performanceClaim:false},null,2));
