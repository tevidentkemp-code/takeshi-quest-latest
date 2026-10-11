// SC063 critical-history ordering: actual service/history/owner source with
// controlled transport/native Promises. No browser/SQL/performance claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const sourcePath = process.argv[2] || fileURLToPath(new URL('../../src/ui/modals.js', import.meta.url));
const source = fs.readFileSync(sourcePath, 'utf8');
const bootPath = process.argv[3] || fileURLToPath(new URL('../../src/app/boot.js', import.meta.url));
const bootSource = fs.readFileSync(bootPath, 'utf8');
const registerStart = bootSource.indexOf('  window.sqModal.register = function(');
const registerEnd = bootSource.indexOf('  // Registered dialogs may close', registerStart);
const observerStart = bootSource.indexOf('  try{\n    new MutationObserver', registerEnd);
const observerEnd = bootSource.indexOf('\n})();', observerStart);
assert(registerStart >= 0 && registerEnd > registerStart && observerStart > registerEnd && observerEnd > observerStart, 'Actual shared modal register/removal observer anchors');
const registerSource = bootSource.slice(registerStart, registerEnd).trim();
const observerSource = bootSource.slice(observerStart, observerEnd).trim();
// Frozen e345 counterfactual primary: XP-first without the history barrier.
// Every remaining service, history and owner implementation is actual source.
const originalPrimary = `function __sqPlayerStatsPrimary(name, mayStartSecondaries){
  const xp = SQ_XP.forNameState(name);
  const settled = xp.then(() => {}, () => {});
  const start = source => settled.then(() => {
    if (typeof mayStartSecondaries !== 'function' || !mayStartSecondaries()){
      throw new Error('Player statistics request is no longer active');
    }
    return source(name);
  });
  const games = start(__sqPlayerStatsGameSummary); games.catch(() => {});
  const rank = start(__sqPlayerStatsRankSource); rank.catch(() => {});
  return {
    xp,
    phase:'Loading player statistics…', phaseNodes:new Set(),
    games,
    rank
  };
}`;
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function fn(text, name) {
  if (name === '__sqBuildPlayerStatsProfile') { const start = text.indexOf('async function __sqBuildPlayerStatsProfile('); const end = text.indexOf('// [removed: openPlayerDTBDialog', start); assert(start >= 0 && end > start); return text.slice(start, end).trim(); }
  const match = text.match(new RegExp('^(?:async )?function ' + name + '\\([^\\n]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert(match, 'Actual function missing: ' + name); return match[0];
}
function windowFn(name) {
  const match = source.match(new RegExp('^window\\.' + name + ' = (?:async )?function ' + name + '\\([^\\n]*\\)\\{[\\s\\S]*?^};', 'm'));
  assert(match, 'Actual modal missing: ' + name); return match[0];
}
const canonical = ['__sqPlayerStatsPrimary', '__sqPlayerStatsPrimaryMetrics', '__sqPlayerStatsHubShell', '__sqBuildPlayerStatsProfile', '__sqStatsSourceDeadline', '__sqPlayerStatsSourceMessage', '__sqPlayerStatsXpHost', '__sqPlayerStatsHistory', '__sqPlayerStatsKey'].map(name => fn(source, name));
const xpService = source.slice(source.indexOf('const SQ_XP = {'), source.indexOf('window.SQ_XP = SQ_XP;') + 'window.SQ_XP = SQ_XP;'.length);
assert(xpService.startsWith('const SQ_XP = {'));
const notice = source.match(/    const notice = \(\) => \{[\s\S]*?\n    };/)?.[0];
assert(notice, 'Actual analytics alternate-navigation notice missing');
// The actual positive split-source and lightweight identity-directory methods.
// Only unrelated trophy presentation/catalogue methods are omitted.
const achMethods = ['playerDirectory', 'playerForName', '_mergeSourceRows', '_sourceRows', '_metaForRows', 'forPlayerId'].map(name => {
  const match = source.match(new RegExp('^SQ_ACH\\.' + name + ' = (?:async )?function\\([^\\n]*\\)\\{[\\s\\S]*?^};', 'm'));
  assert(match, 'Actual positive source method: ' + name); return match[0];
});
const misfireService = source.slice(source.indexOf('const SQ_MISFIRE = {'), source.indexOf('\n};', source.indexOf('const SQ_MISFIRE = {')) + 3);
assert(misfireService.startsWith('const SQ_MISFIRE = {') && misfireService.endsWith('};'));
const historyServices = 'const SQ_ACH = {};\n' + achMethods.join('\n') + '\nwindow.SQ_ACH=SQ_ACH;\n' + misfireService + '\nwindow.SQ_MISFIRE=SQ_MISFIRE;';
const flush = async () => { for (let n = 0; n < 80; n++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.nodeType = 1; this.ownerDocument = doc; this.children = []; this.parentElement = null; this.style = {}; this.attributes = {}; this.dataset = {}; this.value = ''; this.disabled = false; this.textContent = ''; this._class = ''; this._html = ''; this.events = new Map(); this.classList = { toggle: (name, on) => { const names = new Set(this._class.split(/\s+/).filter(Boolean)); (on ?? !names.has(name)) ? names.add(name) : names.delete(name); this._class = [...names].join(' '); }, add: name => this.classList.toggle(name, true), contains: name => this._class.split(/\s+/).includes(name) }; }
  set className(value) { this._class = value; } get className() { return this._class; }
  set innerHTML(value) { this.replaceChildren(); this._html = value; } get innerHTML() { return this._html; }
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
function environment({ primarySource = fn(source, '__sqPlayerStatsPrimary'), neverGames = false, neverRank = false, unexpectedXp = false, gamesError = null, rankError = null, removalObserver = false, hubSource = windowFn('openPlayerStatsHub'), knownPlayers = [{name:'Thom',raw:{id:'11111111-1111-4111-8111-111111111111'}},{name:'Chris',raw:{player_id:'22222222-2222-4222-8222-222222222222'}}] } = {}) {
  const doc = { createElement: tag => new Element(tag, doc) }; doc.body = doc.createElement('body'); doc.querySelectorAll = selector => doc.body.querySelectorAll(selector); doc.querySelector = selector => doc.body.querySelector(selector); doc.contains = node => !!node?.isConnected;
  let queued = false; const removed = []; doc.notifyRemoval = node => { if (!doc.removalCallback) return; removed.push(node); if (!queued) { queued = true; queueMicrotask(() => { queued = false; doc.removalCallback([{ removedNodes: removed.splice(0) }]); }); } };
  const calls = [], queries = [], primaries = [], views = [], timers = new Map(); let nextTimer = 1;
  const makeNode = (tag = 'div') => doc.createElement(tag);
  const context = { document: doc, MutationObserver: class { constructor(callback) { doc.removalCallback = callback; } observe() {} }, console: { debug() {}, warn() {}, error() {} }, Set, Map, Date, Number, String, Array, Promise, Error,
    setTimeout(callback, ms) { const id = nextTimer++; timers.set(id, { callback, ms }); return id; }, clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    __sqPlayerStatsGameSummary(name) { calls.push({ source: 'games', name }); return gamesError ? Promise.reject(gamesError) : neverGames ? new Promise(() => {}) : Promise.resolve({ __allGamesNorm: [], games: [], scores: [], GAMES: 0, TOTAL: 0, AVG: 0, PB: 0, LOW: 0 }); },
    __sqPlayerStatsRankSource(name) { calls.push({ source: 'rank', name }); return rankError ? Promise.reject(rankError) : neverRank ? new Promise(() => {}) : Promise.resolve({ available: true, dbPower: null, savedRows: [] }); },
    __sqBuildPlayerAchievementsView: async () => ({ profile: makeNode(), tabs: [], showTab(host) { host.replaceChildren(makeNode()); } }),
    __sqPlayerStatsView(profile) { const tabs = Array.from({ length: 3 }, () => makeNode('button')); profile.append(...tabs); const view = { profile, tabs, showTab(host) { host.replaceChildren(makeNode()); } }; views.push(view); return view; },
    __sqPlayerStatsHero(name, nick, tiles, primary) { const node = makeNode(); if (tiles) node.appendChild(tiles); node.appendChild(context.__sqPlayerStatsXpHost(name, true, primary)); return node; },
    __sqBuildPlayerXpPanel(row) { const node = makeNode(); node.dataset.xp = String(row.total_xp); return node; }, __sqXpChip() { return makeNode(); }, __sqXpBar() { return makeNode(); },
    __sqStatsArcade() {}, __sqGoBackToStatsMain(name) { calls.push({ source: 'return', name }); }, __sqPlayerStatsActiveName: () => '', __sqPlayerStatsKey: name => String(name).toLowerCase(),
    __sqSetPlayerStatsSelectedName(name) { context.__sqPlayerStatsSelectedName = name; return name; }, __sqLoadPlayerStatsPlayers: async () => knownPlayers,
    openPlayerLatestMatchesDialog(name) { calls.push({ source: 'navigation', name }); }, openXpLeaderboard() { calls.push({ source: 'ladder' }); }, openPlayerStatsSelect() { calls.push({ source: 'picker' }); },
    __sqPlayerStatsPlayers: knownPlayers,
    sb: { from(table) {
      assert(['v_player_xp','v_player_base_xp','v_ach_base','v_ach_david_goliath','v_player_misfires'].includes(table), 'Owned actual read table');
      const q = { table, field:null, value:null, limitValue:null, columns:null, pending:deferred(), observed:false, filters:[],
        select(columns) { q.columns=columns; return q; },
        ilike(field,value) { q.field=field; q.value=value; q.filters.push([field,value]); return q; },
        eq(field,value) { q.field=field; q.value=value; q.filters.push([field,value]); return q; },
        limit(value) { q.limitValue=value; q.observed=true; calls.push({source:'xp-query',name:q.value}); return q.pending.promise; },
        then(resolve,reject) { q.observed=true; return q.pending.promise.then(resolve,reject); }
      };
      queries.push(q); if(table!=='v_player_xp') calls.push({source:'history-query',table}); return q;
    } }

  };
  context.window = context; vm.createContext(context);
  vm.runInContext(xpService + '\n' + historyServices + '\n' + canonical.filter(text => !text.startsWith('function __sqPlayerStatsPrimary(')).join('\n') + '\n' + primarySource + '\n' + windowFn('openPlayerStatsDialog') + '\n' + hubSource, context);
  if (removalObserver) vm.runInContext('var stack = window.__sqModalStack = []; window.sqModal = {};\n' + registerSource + '\n' + observerSource, context);
  const originalPrimary = context.__sqPlayerStatsPrimary;
  context.__sqPlayerStatsPrimary = (...args) => { const value = originalPrimary(...args); primaries.push(value); return value; };
  const originalXp = context.SQ_XP.forNameState.bind(context.SQ_XP); const xpPromises = [];
  context.SQ_XP.forNameState = (name, force) => { calls.push({ source: 'xp-service', name, force: !!force }); const promise = unexpectedXp ? Promise.reject(Error('unexpected XP source rejection')) : originalXp(name, force); xpPromises.push(promise); return promise; };
  return { context, doc, calls, queries, primaries, views, timers, xpPromises,
    resolve(name = 'Thom', result = { data: [{ name, total_xp: 0 }], error: null }) { const query = queries.find(item => item.table === 'v_player_xp' && item.value === name && !item.done); assert(query, 'Actual XP query pending'); query.done = true; query.pending.resolve(result); },
    count(table) { return queries.filter(q=>q.table===table).length; },
    complete(table, result={data:[],error:null}, index=0) { const q=queries.filter(q=>q.table===table&&!q.done)[index]; assert(q, 'Actual source query pending: '+table); q.done=true; q.pending.resolve(result); },
    reject(table, error=Error('controlled source transport rejection')) { const q=queries.find(q=>q.table===table&&!q.done); assert(q); q.done=true; q.pending.reject(error); },
    fire(ms) { const matches = [...timers].filter(([, job]) => job.ms === ms); for (const [id, job] of matches) { timers.delete(id); job.callback(); } },
    hub() { return doc.body.querySelector('.sq-player-stats-hub')?.closest('.modal-backdrop'); }, child() { return doc.body.querySelector('.sq-player-stats-content')?.closest('.modal-backdrop'); },
    secondaryNames() { return calls.filter(c => ['games', 'rank'].includes(c.source)).map(c => c.source + ':' + c.name); }
  };
}
const results=[];
async function test(name,run){const evidence=await run();results.push({name,status:'PASS',...evidence});}
const cancelMessage=/Player statistics request is no longer active/;
const id=name=>name==='Chris'?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111';
const packet=data=>({data,error:null});
const historyTables=['v_ach_base','v_ach_david_goliath','v_player_misfires'];
const plain=value=>JSON.parse(JSON.stringify(value));
const historyCount=e=>e.queries.filter(q=>historyTables.includes(q.table)).length;
function completePositive(e,base=[],dg=[]){e.complete('v_ach_base',packet(base));e.complete('v_ach_david_goliath',packet(dg));}
function completeHistories(e){completePositive(e);e.complete('v_player_misfires');}
async function xpReady(e,p,result=packet([{name:'Thom',player_id:id('Thom'),total_xp:0}]),name='Thom'){e.resolve(name,result);await p.xp;await flush();}
async function done(e,p){await Promise.all([p.games,p.rank]);await flush();assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);}
// Existing pending-history owner cases explicitly advance the unchanged1200 Hub queue.
// The additive lazy-intent suite covers closing before that queue and XP-only intent.
async function bootHub(e){e.context.openPlayerStatsHub('Thom');await flush();assert(e.hub()?.isConnected);assert.equal(e.primaries.length,1);e.fire(1200);await flush();return e.primaries[0];}
function button(root,name){const found=root.querySelectorAll('button').find(b=>b.textContent===name||b.getAttribute('aria-label')===name);assert(found,'Actual control: '+name);return found;}
function row(root,name){const found=root.querySelectorAll('button').find(b=>b.innerHTML.includes('>'+name+'</span>'));assert(found,'Actual menu row: '+name);return found;}
await test('e345 negative control dispatches games/rank despite already-started unresolved canonical histories',async()=>{
 const e=environment({primarySource:originalPrimary});const p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);const history=e.context.__sqPlayerStatsHistory('Thom',p);await flush();assert.equal(historyCount(e),3);await xpReady(e,p);assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);let finished=false;Promise.all([history.positive,history.misfires]).then(()=>finished=true);await flush();assert.equal(finished,false);completeHistories(e);await Promise.all([history.positive,history.misfires]);return{oldHistoryOverlapReproduced:true};
});
await test('unresolved initial XP starts no automatic history or games/rank',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);assert.equal(p.xp,e.xpPromises[0]);await flush();assert.equal(historyCount(e),0);assert.deepEqual(e.secondaryNames(),[]);await xpReady(e,p);assert.equal(historyCount(e),3);assert.deepEqual(e.secondaryNames(),[]);completeHistories(e);await done(e,p);return{originalXpPromiseRetained:true};
});
await test('positive success cannot release games/rank while Misfires independently remain pending',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);completePositive(e,[{player_id:id('Thom'),code:'bullseye',cnt:2,xp:50}]);await p.history.positive;await flush();assert.deepEqual(e.secondaryNames(),[]);assert.equal(p.history.positiveState.map.bullseye.cnt,2);e.complete('v_player_misfires',packet([{code:'bounce_out',cnt:3}]));await done(e,p);assert.equal(p.history.misfiresState.map.bounce_out.cnt,3);return{};
});
await test('Misfire success cannot release games/rank while positive history remains pending',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);e.complete('v_player_misfires',packet([{code:'volde_deux',cnt:4}]));await p.history.misfires;await flush();assert.deepEqual(e.secondaryNames(),[]);completePositive(e);await done(e,p);return{};
});
for(const waiting of ['v_ach_base','v_ach_david_goliath'])await test('actual positive split waits independently for '+waiting,async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);e.complete(waiting==='v_ach_base'?'v_ach_david_goliath':'v_ach_base');e.complete('v_player_misfires');await flush();assert.deepEqual(e.secondaryNames(),[]);e.complete(waiting);await done(e,p);return{parallelSplitSources:true};
});
await test('two automatic barrier callbacks share each actual history Promise and dispatch all three reads once',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);const h=e.context.__sqPlayerStatsHistory('Thom',p);assert.equal(h.positive,p.history.positive);assert.equal(h.misfires,p.history.misfires);await flush();for(const table of historyTables)assert.equal(e.count(table),1);assert.equal(e.count('v_player_xp'),1);assert.equal(e.count('v_player_base_xp'),0);completeHistories(e);await done(e,p);return{historyRequests:3,selectedXpRequests:1,noAdditionalXp:true};
});
await test('actual source projection/player filters and distinct-code trophy calculations remain exact',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);for(const q of e.queries.filter(q=>historyTables.includes(q.table))){assert(q.observed);assert.deepEqual(q.filters,[['player_id',id('Thom')]]);assert.equal(q.columns,q.table==='v_player_misfires'?'code,cnt':'player_id,code,cnt,xp');}
 const base=Array.from({length:20},(_,n)=>({player_id:id('Thom'),code:'code_'+n,cnt:1,xp:10}));completePositive(e,base,[{player_id:id('Thom'),code:'code_0',cnt:2,xp:30}]);e.complete('v_player_misfires',packet([{code:'volde_trois',cnt:7}]));await done(e,p);assert.deepEqual(plain(p.history.positiveState.map.code_0),{cnt:3,xp:40});assert.deepEqual(plain(p.history.positiveState.map.collector),{cnt:1,xp:150});assert.deepEqual(plain(p.history.positiveState.map.trophy_hunter),{cnt:1,xp:350});assert.equal(p.history.misfiresState.map.volde_trois.cnt,7);return{canonicalMetaThresholdsPreserved:true};
});
await test('genuine zero/empty available histories release sources without fabricated occurrence rows',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);completeHistories(e);await done(e,p);assert(p.history.positiveState.available&&p.history.misfiresState.available);assert.deepEqual(plain(p.history.positiveState.map),{});assert.deepEqual(plain(p.history.misfiresState.map),{});assert.equal((await p.xp).row.total_xp,0);return{availableEmptyDistinctFromUnavailable:true};
});
await test('unavailable initial XP remains unavailable while actual histories independently settle then permit sources',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p,{data:null,error:{code:'57014'}});assert.equal((await p.xp).available,false);assert.equal((await p.xp).row,null);assert.equal(historyCount(e),3);assert.deepEqual(e.secondaryNames(),[]);completeHistories(e);await done(e,p);return{noXpSuccessRequirement:true};
});
await test('unexpected XP rejection remains original rejection and still waits the real history pair',async()=>{
 const e=environment({unexpectedXp:true}),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await assert.rejects(p.xp,/unexpected XP/);await flush();assert.equal(historyCount(e),3);assert.deepEqual(e.secondaryNames(),[]);completeHistories(e);await done(e,p);return{rejectionNotReplaced:true};
});
for(const failing of historyTables)await test('actual '+failing+' query error retains unavailable truth and settlement permits later sources',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);for(const table of historyTables)e.complete(table,table===failing?{data:null,error:{code:'57014'}}:packet([]));await done(e,p);assert.equal(p.history[failing==='v_player_misfires'?'misfiresState':'positiveState'].available,false);return{sourceErrorRetained:true};
});
await test('rejected native history transports become unavailable through unchanged actual service catches',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);for(const table of historyTables)e.reject(table);await done(e,p);assert.equal(p.history.positiveState.available,false);assert.equal(p.history.misfiresState.available,false);return{actualErrorConversionUnchanged:true};
});
await test('cached rejected history Promise settles the allSettled barrier without changing rejection',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);const error=Error('historical rejected positive Promise');const rejected=Promise.reject(error);rejected.catch(()=>{});p.history={player:Promise.resolve({player_id:id('Thom')}),positive:rejected,misfires:Promise.resolve({available:true,map:{}})};await xpReady(e,p);await done(e,p);await assert.rejects(p.history.positive,x=>x===error);assert.equal(historyCount(e),0);return{notSuccessOnlyBarrier:true};
});
await test('never-settling actual history reads use the existing10000ms deadline before one secondary dispatch',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);assert.equal([...e.timers.values()].filter(t=>t.ms===10000).length,3);assert.deepEqual(e.secondaryNames(),[]);e.fire(10000);await done(e,p);assert.equal(p.history.positiveState.available,false);assert.equal(p.history.misfiresState.available,false);assert.equal(e.timers.size,0);return{deadlineMs:10000,underlyingReadsNotCancelled:true};
});
for(const timeoutSource of ['positive','misfires'])await test('only '+timeoutSource+' times out; late underlying rows do not repeat dispatch or replace failed truth',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);if(timeoutSource==='positive')e.complete('v_player_misfires');else completePositive(e);await flush();assert.deepEqual(e.secondaryNames(),[]);e.fire(10000);await done(e,p);const state=p.history[timeoutSource+'State'];assert.equal(state.available,false);if(timeoutSource==='positive')completePositive(e,[{player_id:id('Thom'),code:'late',cnt:999,xp:999}]);else e.complete('v_player_misfires',packet([{code:'late',cnt:999}]));await flush();assert.equal(p.history[timeoutSource+'State'],state);assert.deepEqual(plain(state.map),{});assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);return{lateTransportStillUncancelled:true};
});
await test('fresh actual XP cache still starts canonical-ID history without XP or identity-directory reads',async()=>{
 const e=environment(),xp={name:'Thom',player_id:id('Thom'),total_xp:0};Object.assign(e.context.SQ_XP,{_cache:[xp],_cacheAt:Date.now(),_allAvailable:true});const p=e.context.__sqPlayerStatsPrimary(' Thom ',()=>true);await p.xp;await flush();assert.equal((await p.xp).row,xp);assert.equal(e.count('v_player_xp'),0);assert.equal(e.count('v_player_base_xp'),0);assert.equal(historyCount(e),3);completeHistories(e);await Promise.all([p.games,p.rank]);assert.deepEqual(e.secondaryNames(),['games: Thom ','rank: Thom ']);return{normalisedKnownIdLookup:true};
});
await test('unknown canonical identity uses actual lightweight directory then histories with no additional full XP',async()=>{
 const e=environment({knownPlayers:[]}),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);assert.equal(e.count('v_player_base_xp'),1);assert.equal(historyCount(e),0);assert.deepEqual(e.secondaryNames(),[]);const q=e.queries.find(q=>q.table==='v_player_base_xp');assert.equal(q.columns,'player_id,name,games_played');e.complete('v_player_base_xp',packet([{player_id:id('Thom'),name:'  tHoM  ',games_played:3}]));await flush();assert.equal(historyCount(e),3);completeHistories(e);await done(e,p);assert.equal(e.count('v_player_xp'),1);return{fallbackDirectoryIsBaseXpOnly:true};
});
for(const outcome of ['error','no-matching-positive-games','deadline'])await test('identity directory '+outcome+' settles unavailable histories without invented ID or occurrence requests',async()=>{
 const e=environment({knownPlayers:[]}),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);if(outcome==='deadline')e.fire(10000);else e.complete('v_player_base_xp',outcome==='error'?{data:null,error:{code:'57014'}}:packet([{player_id:id('Thom'),name:'Thom',games_played:0}]));await done(e,p);assert.equal(historyCount(e),0);assert.equal(p.history.positiveState.available,false);assert.equal(p.history.misfiresState.available,false);assert.equal(e.count('v_player_xp'),1);return{noFabricatedIdentity:true};
});
await test('existing identity-directory cache is reused without timestamp renewal or extra read',async()=>{
 const e=environment({knownPlayers:[]}),rows=[{player_id:id('Thom'),name:'Thom',games_played:5}],at=Date.now();Object.assign(e.context.SQ_ACH,{_playerDirectoryCache:rows,_playerDirectoryCacheAt:at});const p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);assert.equal(e.count('v_player_base_xp'),0);assert.equal(e.context.SQ_ACH._playerDirectoryCache,rows);assert.equal(e.context.SQ_ACH._playerDirectoryCacheAt,at);completeHistories(e);await done(e,p);return{};
});
await test('standalone profile history may start before XP and is reused by the automatic barrier',async()=>{
 const e=environment();const pending=e.context.__sqBuildPlayerStatsProfile('Thom',null,()=>true),p=e.primaries[0];await flush();assert.equal(historyCount(e),3);assert.equal(e.count('v_player_xp'),1);assert.deepEqual(e.secondaryNames(),[]);const positive=p.history.positive,misfires=p.history.misfires;await xpReady(e,p);assert.equal(p.history.positive,positive);assert.equal(p.history.misfires,misfires);for(const t of historyTables)assert.equal(e.count(t),1);completeHistories(e);await pending;await done(e,p);return{universalHistoryXpGatingClaimed:false};
});
await test('successful cached history is reused; failed cached history is not silently retried by automatic sources',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);const positive={available:true,map:{bullseye:{cnt:2,xp:50}}},misfires={available:false,map:{}};p.history={player:Promise.resolve({player_id:id('Thom')}),positive:Promise.resolve(positive),positiveState:positive,misfires:Promise.resolve(misfires),misfiresState:misfires};const old=p.history.misfires;await xpReady(e,p);await done(e,p);assert.equal(historyCount(e),0);assert.equal(p.history.misfires,old);assert.equal(p.history.misfiresState,misfires);return{noImplicitForceRetry:true};
});
await test('explicit history Retry refreshes only failed actual source and preserves successful sibling Promise',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);completePositive(e);e.complete('v_player_misfires',{data:null,error:{code:'57014'}});await done(e,p);const positive=p.history.positive,old=p.history.misfires;const retry=e.context.__sqPlayerStatsHistory('Thom',p,true);await flush();assert.equal(retry.positive,positive);assert.notEqual(retry.misfires,old);assert.equal(e.count('v_ach_base'),1);assert.equal(e.count('v_ach_david_goliath'),1);assert.equal(e.count('v_player_misfires'),2);assert.equal(e.count('v_player_xp'),1);e.complete('v_player_misfires',packet([{code:'bounce_out',cnt:5}]));const value=await retry.misfires;assert.equal(value.map.bounce_out.cnt,5);assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);return{explicitRetryRemainsIndependent:true};
});
await test('forced XP Retry remains independent of captured initial history barrier and preserves force request',async()=>{
 const e=environment(),p=await bootHub(e);await xpReady(e,p,{data:null,error:{code:'57014'}});const host=e.hub().querySelector('.pp-progression');button(host,'Retry').onclick();await flush();assert.equal(p.xp,e.xpPromises[1]);assert.deepEqual(e.calls.filter(c=>c.source==='xp-service').map(c=>c.force),[false,true]);assert.deepEqual(e.secondaryNames(),[]);completeHistories(e);await Promise.all([p.games,p.rank]);assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);let retried=false;p.xp.then(()=>retried=true);await flush();assert.equal(retried,false);e.resolve();await p.xp;return{completeRetryIsolationClaimed:false};
});
await test('closed hub before XP settlement starts neither history nor games/rank',async()=>{
 const e=environment(),p=await bootHub(e);button(e.hub(),'Close').onclick();await xpReady(e,p);await assert.rejects(p.games,cancelMessage);await assert.rejects(p.rank,cancelMessage);assert.equal(historyCount(e),0);assert.deepEqual(e.secondaryNames(),[]);return{};
});
await test('hub Close while histories pending does not cancel started reads and suppresses both deferred sources',async()=>{
 const e=environment(),p=await bootHub(e);await xpReady(e,p);assert.equal(historyCount(e),3);button(e.hub(),'Close').onclick();completeHistories(e);await assert.rejects(p.games,cancelMessage);await assert.rejects(p.rank,cancelMessage);assert.deepEqual(e.secondaryNames(),[]);assert(p.history.positiveState.available&&p.history.misfiresState.available);return{startedHistoryReadsNotCancelled:true};
});
await test('player switch during old history supersedes its owner; only current player metrics start',async()=>{
 const e=environment(),old=await bootHub(e);await xpReady(e,old);const select=e.hub().querySelector('select');select.value='Chris';select.onchange();await flush();const current=e.primaries[1];e.fire(1200);await flush();await xpReady(e,current,packet([{name:'Chris',player_id:id('Chris'),total_xp:1}]),'Chris');for(const table of historyTables){assert.equal(e.count(table),2);e.complete(table);e.complete(table);}await assert.rejects(old.games,cancelMessage);await assert.rejects(old.rank,cancelMessage);await Promise.all([current.games,current.rank]);assert.deepEqual(e.secondaryNames(),['games:Chris','rank:Chris']);return{};
});
await test('leaving pending hub through Latest Matches suppresses games/rank after history settlement',async()=>{
 const e=environment(),p=await bootHub(e);await xpReady(e,p);row(e.hub(),'Latest Matches').onclick();completeHistories(e);await assert.rejects(p.games,cancelMessage);await assert.rejects(p.rank,cancelMessage);assert.deepEqual(e.secondaryNames(),[]);return{};
});
await test('missing owner fails before history start and never supplies fake metrics',async()=>{
 const e=environment(),p=e.context.__sqPlayerStatsPrimary('Thom');await xpReady(e,p);await assert.rejects(p.games,cancelMessage);await assert.rejects(p.rank,cancelMessage);assert.equal(historyCount(e),0);assert.deepEqual(e.secondaryNames(),[]);return{};
});
for(const tab of [1,2])await test('detached hub with connected shared '+(tab===1?'XP':'Achievements')+' child retains owner across pending history',async()=>{
 const e=environment({removalObserver:true}),p=await bootHub(e),hub=e.hub();await xpReady(e,p);e.views[0].tabs[tab].onclick();await flush();assert(!hub.isConnected&&e.child()?.isConnected);assert.equal(historyCount(e),3);completeHistories(e);await done(e,p);assert.equal(e.primaries.length,1);return{actualModalOwnerWithControlledViewMount:true};
});
await test('shared child Back during pending histories restores original hub and reuses one primary',async()=>{
 const e=environment({removalObserver:true}),p=await bootHub(e),hub=e.hub();await xpReady(e,p);e.views[0].tabs[1].onclick();await flush();button(e.child(),'Back').onclick();await flush();assert(hub.isConnected);completeHistories(e);await done(e,p);assert.equal(e.primaries.length,1);return{};
});
await test('actual removal observer successor guard invalidates old pending-history owner without reviving its hub',async()=>{
 const e=environment({removalObserver:true}),old=await bootHub(e),hub=e.hub();await xpReady(e,old);e.views[0].tabs[1].onclick();await flush();e.child().remove();e.context.openPlayerStatsHub('Thom');await flush();assert(!hub.isConnected);assert.equal(e.doc.querySelectorAll('.sq-player-stats-hub').length,1);const current=e.primaries[1];e.fire(1200);await current.xp;await flush();for(const table of historyTables){assert.equal(e.count(table),2);e.complete(table);e.complete(table);}await assert.rejects(old.games,cancelMessage);await assert.rejects(old.rank,cancelMessage);await Promise.all([current.games,current.rank]);assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);return{actualRegisterWithControlledObserverDelivery:true};
});
await test('after histories settle original games/rank rejection values are retained',async()=>{
 const gamesError=Error('original games failure'),rankError=Error('original rank failure'),e=environment({gamesError,rankError}),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);completeHistories(e);await assert.rejects(p.games,x=>x===gamesError);await assert.rejects(p.rank,x=>x===rankError);assert.equal((await p.xp).available,true);return{secondaryFailuresUntouched:true};
});
await test('never-settling games/rank cannot hold already successful XP or available history results',async()=>{
 const e=environment({neverGames:true,neverRank:true}),p=e.context.__sqPlayerStatsPrimary('Thom',()=>true);await xpReady(e,p);completeHistories(e);await Promise.all([p.history.positive,p.history.misfires]);await flush();assert.equal((await p.xp).available,true);assert(p.history.positiveState.available&&p.history.misfiresState.available);assert.deepEqual(e.secondaryNames(),['games:Thom','rank:Thom']);let finished=false;Promise.all([p.games,p.rank]).then(()=>finished=true);await flush();assert.equal(finished,false);return{};
});
assert.equal(results.length,40,'Forty independently bounded ordering/transport/owner cases');
console.log(JSON.stringify({status:'PASS',cases:results.length,sourcePath,sourceSHA256:hash(source),bootPath,bootSourceSHA256:hash(bootSource),extractedSourceSHA256:hash(canonical.join('\n')+xpService+historyServices+windowFn('openPlayerStatsDialog')+windowFn('openPlayerStatsHub')),originalPrimarySHA256:hash(originalPrimary),scope:'Actual extracted primary/history/SQ_XP/positive/Misfire/identity/deadline/modal owner code with native Promises and controlled transport/timer/DOM; actual register callbacks use controlled observer microtask delivery. No browser/SQL/API or timing gain claim.',unchangedDeadlineMs:10000,originalPrimary32Separate:true,standaloneHistoryCanStartBeforeXp:true,explicitRetryOverlapStillPossible:true,criticalHTTP500AcceptanceStillFatal:true,results},null,2));
