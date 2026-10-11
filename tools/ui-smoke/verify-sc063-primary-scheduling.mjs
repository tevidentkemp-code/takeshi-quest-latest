// Controlled SC-063 ordering and owner regression. Executes canonical source;
// no browser, database connection, scoring substitute or performance claim.
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
// Frozen current-main d763df1 control: demonstrate the observed overlap.
const originalPrimary = `function __sqPlayerStatsPrimary(name){
  const games = __sqPlayerStatsGameSummary(name); games.catch(() => {});
  return {
    xp:SQ_XP.forNameState(name),
    phase:'Loading player statistics…', phaseNodes:new Set(),
    games,
    rank:__sqPlayerStatsRankSource(name)
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
const canonical = ['__sqPlayerStatsPrimary', '__sqPlayerStatsPrimaryMetrics', '__sqPlayerStatsHubShell', '__sqBuildPlayerStatsProfile', '__sqStatsSourceDeadline', '__sqPlayerStatsSourceMessage', '__sqPlayerStatsXpHost'].map(name => fn(source, name));
const xpService = source.slice(source.indexOf('const SQ_XP = {'), source.indexOf('window.SQ_XP = SQ_XP;') + 'window.SQ_XP = SQ_XP;'.length);
assert(xpService.startsWith('const SQ_XP = {'));
const notice = source.match(/    const notice = \(\) => \{[\s\S]*?\n    };/)?.[0];
assert(notice, 'Actual analytics alternate-navigation notice missing');
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.nodeType = 1; this.ownerDocument = doc; this.children = []; this.parentElement = null; this.style = {}; this.attributes = {}; this.dataset = {}; this.value = ''; this.textContent = ''; this._class = ''; this._html = ''; this.events = new Map(); this.classList = { toggle: (name, on) => { const names = new Set(this._class.split(/\s+/).filter(Boolean)); (on ?? !names.has(name)) ? names.add(name) : names.delete(name); this._class = [...names].join(' '); }, add: name => this.classList.toggle(name, true), contains: name => this._class.split(/\s+/).includes(name) }; }
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
function environment({ primarySource = fn(source, '__sqPlayerStatsPrimary'), neverGames = false, neverRank = false, unexpectedXp = false, gamesError = null, rankError = null, removalObserver = false, hubSource = windowFn('openPlayerStatsHub') } = {}) {
  const doc = { createElement: tag => new Element(tag, doc) }; doc.body = doc.createElement('body'); doc.querySelectorAll = selector => doc.body.querySelectorAll(selector); doc.querySelector = selector => doc.body.querySelector(selector); doc.contains = node => !!node?.isConnected;
  let queued = false; const removed = []; doc.notifyRemoval = node => { if (!doc.removalCallback) return; removed.push(node); if (!queued) { queued = true; queueMicrotask(() => { queued = false; doc.removalCallback([{ removedNodes: removed.splice(0) }]); }); } };
  const calls = [], queries = [], primaries = [], views = [], timers = new Map(); let nextTimer = 1;
  const makeNode = (tag = 'div') => doc.createElement(tag);
  const context = { document: doc, MutationObserver: class { constructor(callback) { doc.removalCallback = callback; } observe() {} }, console: { debug() {}, warn() {}, error() {} }, Set, Map, Date, Number, String, Array, Promise, Error,
    setTimeout(callback, ms) { const id = nextTimer++; timers.set(id, { callback, ms }); return id; }, clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    __sqPlayerStatsGameSummary(name) { calls.push({ source: 'games', name }); return gamesError ? Promise.reject(gamesError) : neverGames ? new Promise(() => {}) : Promise.resolve({ __allGamesNorm: [], games: [], scores: [], GAMES: 0, TOTAL: 0, AVG: 0, PB: 0, LOW: 0 }); },
    __sqPlayerStatsRankSource(name) { calls.push({ source: 'rank', name }); return rankError ? Promise.reject(rankError) : neverRank ? new Promise(() => {}) : Promise.resolve({ available: true, dbPower: null, savedRows: [] }); },
    __sqPlayerStatsHistory(name, primary) { const sources = { positive: Promise.resolve({ available: true, map: {} }), misfires: Promise.resolve({ available: true, map: {} }) }; if (typeof primary.historyReadyResolve === 'function'){ primary.historyReadyResolve(); primary.historyReadyResolve=null; } return sources; },
    __sqBuildPlayerAchievementsView: async () => ({ profile: makeNode(), tabs: [], showTab(host) { host.replaceChildren(makeNode()); } }),
    __sqPlayerStatsView(profile) { const tabs = Array.from({ length: 3 }, () => makeNode('button')); profile.append(...tabs); const view = { profile, tabs, showTab(host) { host.replaceChildren(makeNode()); } }; views.push(view); return view; },
    __sqPlayerStatsHero(name, nick, tiles, primary) { const node = makeNode(); if (tiles) node.appendChild(tiles); node.appendChild(context.__sqPlayerStatsXpHost(name, true, primary)); return node; },
    __sqBuildPlayerXpPanel(row) { const node = makeNode(); node.dataset.xp = String(row.total_xp); return node; }, __sqXpChip() { return makeNode(); }, __sqXpBar() { return makeNode(); },
    __sqStatsArcade() {}, __sqGoBackToStatsMain(name) { calls.push({ source: 'return', name }); }, __sqPlayerStatsActiveName: () => '', __sqPlayerStatsKey: name => String(name).toLowerCase(),
    __sqSetPlayerStatsSelectedName(name) { context.__sqPlayerStatsSelectedName = name; return name; }, __sqLoadPlayerStatsPlayers: async () => [{ name: 'Thom' }, { name: 'Chris' }],
    openPlayerLatestMatchesDialog(name) { calls.push({ source: 'navigation', name }); }, openXpLeaderboard() { calls.push({ source: 'ladder' }); }, openPlayerStatsSelect() { calls.push({ source: 'picker' }); },
    sb: { from(table) { assert.equal(table, 'v_player_xp'); const q = { field: null, value: null, limitValue: null, pending: deferred(), select(columns) { assert.equal(columns, '*'); return q; }, ilike(field, value) { q.field = field; q.value = value; return q; }, eq(field, value) { q.field = field; q.value = value; return q; }, limit(value) { q.limitValue = value; queries.push(q); calls.push({ source: 'xp-query', name: q.value }); return q.pending.promise; } }; return q; } }
  };
  context.window = context; vm.createContext(context);
  vm.runInContext(xpService + '\n' + canonical.filter(text => !text.startsWith('function __sqPlayerStatsPrimary(')).join('\n') + '\n' + primarySource + '\n' + windowFn('openPlayerStatsDialog') + '\n' + hubSource, context);
  if (removalObserver) vm.runInContext('var stack = window.__sqModalStack = []; window.sqModal = {};\n' + registerSource + '\n' + observerSource, context);
  const originalPrimary = context.__sqPlayerStatsPrimary;
  context.__sqPlayerStatsPrimary = (...args) => { const value = originalPrimary(...args); primaries.push(value); return value; };
  const originalXp = context.SQ_XP.forNameState.bind(context.SQ_XP); const xpPromises = [];
  context.SQ_XP.forNameState = (name, force) => { calls.push({ source: 'xp-service', name, force: !!force }); const promise = unexpectedXp ? Promise.reject(Error('unexpected XP source rejection')) : originalXp(name, force); xpPromises.push(promise); return promise; };
  return { context, doc, calls, queries, primaries, views, timers, xpPromises,
    resolve(name = 'Thom', result = { data: [{ name, total_xp: 0 }], error: null }) { const query = queries.find(item => item.value === name && !item.done); assert(query, 'Actual XP query pending'); query.done = true; query.pending.resolve(result); },
    fire(ms) { const matches = [...timers].filter(([, job]) => job.ms === ms); for (const [id, job] of matches) { timers.delete(id); job.callback(); } },
    hub() { return doc.body.querySelector('.sq-player-stats-hub')?.closest('.modal-backdrop'); }, child() { return doc.body.querySelector('.sq-player-stats-content')?.closest('.modal-backdrop'); },
    secondaryNames() { return calls.filter(c => ['games', 'rank'].includes(c.source)).map(c => c.source + ':' + c.name); }
  };
}
const results = [];
async function test(name, run) { const detail = await run(); results.push({ name, status: 'PASS', ...detail }); }
// This legacy32 suite retains its immediate history model; advance the real
// Hub1200 owner queue and faithfully resolve its actual new History handoff.
// Actual services/full builders and prequeue cancellation are additive controls.
async function bootHub(e) { e.context.openPlayerStatsHub('Thom'); await flush(); assert(e.hub()?.isConnected); assert.equal(e.primaries.length, 1); e.fire(1200); await flush(); return e.primaries[0]; }
function button(root, name) { const found = root.querySelectorAll('button').find(item => item.textContent === name || item.getAttribute('aria-label') === name); assert(found, 'Actual button present: ' + name); return found; }
function row(root, name) { const found = root.querySelectorAll('button').find(item => item.innerHTML.includes('>' + name + '</span>')); assert(found, 'Actual menu row present: ' + name); return found; }
const cancelMessage = /Player statistics request is no longer active/;
await test('frozen original starts games and rank while initial XP is unresolved', async () => {
  const e = environment({ primarySource: originalPrimary }); const primary = e.context.__sqPlayerStatsPrimary('Thom', () => true);
  await flush(); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); assert.deepEqual(e.calls.slice(0, 4).map(c => c.source), ['games', 'xp-service', 'xp-query', 'rank']);
  e.resolve(); await primary.xp; return { baselineConcurrentReadReproduced: true };
});
await test('unresolved initial XP starts neither source; zero XP settles both once and retains original promise', async () => {
  const e = environment(); const primary = e.context.__sqPlayerStatsPrimary('Thom', () => true);
  assert.equal(primary.xp, e.xpPromises[0]); await flush(); assert.deepEqual(e.secondaryNames(), []);
  e.resolve(); const xp = await primary.xp; assert.equal(xp.available, true); assert.equal(xp.row.total_xp, 0); await Promise.all([primary.games, primary.rank]); await flush(); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { zeroXPIsAvailableTruth: true };
});
await test('successful positive XP retains exact source row and dispatches each canonical secondary once', async () => {
  const e = environment(); const p = e.context.__sqPlayerStatsPrimary('Thom', () => true); const row = { name: 'Thom', total_xp: 131050, points_scored: 164015, games_won: 215, matches_won: 73 }; e.resolve('Thom', { data: [row], error: null }); const xp = await p.xp; await Promise.all([p.games, p.rank]); assert.equal(xp.row, row); assert.equal(xp.available, true); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { sourceRowUntouched: true };
});
await test('existing game/rank source rejection remains exact rejection and does not alter successful XP', async () => {
  const gamesError = Error('game source failure'), rankError = Error('rank source failure'); const e = environment({ gamesError, rankError }); const p = e.context.__sqPlayerStatsPrimary('Thom', () => true); e.resolve(); assert.equal((await p.xp).available, true); await assert.rejects(p.games, error => error === gamesError); await assert.rejects(p.rank, error => error === rankError); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { sourceFailuresNotReplaced: true };
});
await test('actual fresh all-player XP cache reuses zero row with no XP query and dispatches secondaries once', async () => {
  const e = environment(); const row = { name: 'Thom', total_xp: 0 }; Object.assign(e.context.SQ_XP, { _cache: [row], _cacheAt: Date.now(), _allAvailable: true });
  const p = e.context.__sqPlayerStatsPrimary('Thom', () => true); const xp = await p.xp; await Promise.all([p.games, p.rank]); assert.equal(xp.row, row); assert.equal(xp.available, true); assert.equal(e.queries.length, 0); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { actualCachePathTested: true };
});
await test('actual unavailable XP error remains unavailable and still dispatches both secondaries', async () => {
  const e = environment(); const p = e.context.__sqPlayerStatsPrimary('Thom', () => true); e.resolve('Thom', { data: null, error: { code: '57014' } }); const xp = await p.xp; await Promise.all([p.games, p.rank]); assert.equal(xp.available, false); assert.equal(xp.row, null); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { noReplacementXPValue: true };
});
await test('unexpected XP rejection remains rejected while settlement permits existing secondaries', async () => {
  const e = environment({ unexpectedXp: true }); const p = e.context.__sqPlayerStatsPrimary('Thom', () => true); await assert.rejects(p.xp, /unexpected XP/); await Promise.all([p.games, p.rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { originalRejectionRetained: true };
});
await test('never-settling games and rank do not hold successful XP', async () => {
  const e = environment({ neverGames: true, neverRank: true }); const p = e.context.__sqPlayerStatsPrimary('Thom', () => true); e.resolve(); const xp = await p.xp; await flush(); assert.equal(xp.available, true); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); let secondarySettled = false; p.games.then(() => { secondarySettled = true; }); p.rank.then(() => { secondarySettled = true; }); await flush(); assert.equal(secondarySettled, false); return { XPIndependentOfSecondaries: true };
});
await test('hub Close invalidates unresolved owner and deferred promises reject without starting reads', async () => {
  const e = environment(); const p = await bootHub(e); button(e.hub(), 'Close').onclick(); assert(!e.hub()); e.resolve(); await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []); return { cancellationSettlesAfterXP: true };
});
await test('hub Back invalidates owner and returns to actual picker callback', async () => {
  const e = environment(); const p = await bootHub(e); button(e.hub(), 'Back').onclick(); e.resolve(); await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []); assert(e.calls.some(c => c.source === 'picker')); return {};
});
await test('player switch supersedes first owner and only current player secondaries start', async () => {
  const e = environment(); const old = await bootHub(e); const select = e.hub().querySelector('select'); select.value = 'Chris'; select.onchange(); await flush(); e.fire(1200); await flush(); assert.equal(e.primaries.length, 2); e.resolve('Thom'); e.resolve('Chris'); await assert.rejects(old.games, cancelMessage); await assert.rejects(old.rank, cancelMessage); await Promise.all([e.primaries[1].games, e.primaries[1].rank]); assert.deepEqual(e.secondaryNames(), ['games:Chris', 'rank:Chris']); return {};
});
await test('leaving hub through Latest Matches suppresses future deferred sources', async () => {
  const e = environment(); const p = await bootHub(e); row(e.hub(), 'Latest Matches').onclick(); assert(!e.hub()); e.resolve(); await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []); assert(e.calls.some(c => c.source === 'navigation')); return {};
});
for (const [tab, label] of [[1, 'XP'], [2, 'Achievements']]) {
  await test('shared ' + label + ' child keeps detached hub owner active; Back restores same primary', async () => {
    const e = environment(); const p = await bootHub(e); const hub = e.hub(); e.views[0].tabs[tab].onclick(); await flush(); assert(!hub.isConnected); const child = e.child(); assert(child?.isConnected); assert.equal(e.primaries.length, 1);
    e.resolve(); await p.xp; await flush(); button(child, 'Back').onclick(); e.fire(1200); await Promise.all([p.games, p.rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); assert(hub.isConnected); assert.equal(e.primaries.length, 1); return { sharedOwnerRetained: true };
  });
}
await test('shared child Back before XP settles restores owner and dispatches only once', async () => {
  const e = environment(); const p = await bootHub(e); const hub = e.hub(); e.views[0].tabs[1].onclick(); await flush(); button(e.child(), 'Back').onclick(); assert(hub.isConnected); e.fire(1200); e.resolve(); await Promise.all([p.games, p.rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return {};
});
await test('actual child analytics Retry removes old child and new hub supersedes pending owner', async () => {
  const e = environment(); const p = await bootHub(e); e.views[0].tabs[1].onclick(); await flush(); const child = e.child(); assert(child?.isConnected);
  vm.runInContext('globalThis.__testNotice = (() => { const name = "Thom", unavailableSources = ["Target Points"]; ' + notice + ' return notice(); })();', e.context);
  child.querySelector('.modal-body').appendChild(e.context.__testNotice); button(e.context.__testNotice, 'Retry').onclick(); await flush(); assert(!child.isConnected); assert(e.hub()?.isConnected); assert.equal(e.primaries.length, 2);
  e.resolve(); e.fire(1200); await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); await Promise.all([e.primaries[1].games, e.primaries[1].rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { oldAndNewXPServiceSharedInflight: true };
});
await test('standalone dialog Close owns its fallback and prevents deferred reads', async () => {
  const e = environment(); const pending = e.context.openPlayerStatsDialog('Thom'); const p = e.primaries[0]; assert(p); button(e.child(), 'Close').onclick(); e.resolve(); await pending; await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []); return { actualStandaloneFallbackTested: true };
});
await test('active standalone Stats dialog renders through its actual fallback with one shared primary', async () => {
  const e = environment(); const pending = e.context.openPlayerStatsDialog('Thom'); assert.equal(e.primaries.length, 1); const p = e.primaries[0]; await flush(); assert.deepEqual(e.secondaryNames(), []); e.resolve(); await pending; assert(e.child()?.isConnected); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); assert.equal(e.views[0].primary, p); return {};
});
await test('standalone XP tab keeps its original direct source and launches no automatic games/rank reads', async () => {
  const e = environment(); await e.context.openPlayerStatsDialog('Thom', { tab: 1 }); assert.equal(e.primaries.length, 0); assert.equal(e.queries.length, 1); e.resolve(); await flush(); assert.deepEqual(e.secondaryNames(), []); assert(e.child()?.isConnected); assert.equal(e.child().querySelector('.pp-xp-content').querySelector('div').dataset.xp, '0'); return { directXPSourceUnchanged: true };
});
await test('dialog profile fallback for a nonstandard tab receives the actual local dialog owner', async () => {
  const e = environment(); const pending = e.context.openPlayerStatsDialog('Thom', { tab: 3 }); const p = e.primaries[0]; assert(p); button(e.child(), 'Close').onclick(); e.resolve(); await pending; await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []); return {};
});
await test('shared Stats child Close restores hub ownership before initial XP settles', async () => {
  const e = environment(); const p = await bootHub(e); const hub = e.hub(); e.views[0].tabs[0].onclick(); await flush(); assert(!hub.isConnected && e.child()?.isConnected); button(e.child(), 'Close').onclick(); assert(hub.isConnected); e.resolve(); await Promise.all([p.games, p.rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); assert.equal(e.primaries.length, 1); return { sharedCloseReturnsToHub: true };
});
await test('missing owner fails closed after XP settles and never fabricates secondary truth', async () => {
  const e = environment(); const p = e.context.__sqPlayerStatsPrimary('Thom'); e.resolve(); await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []); return { productionCreationPathsAuditedSeparately: true };
});
await test('profile fallback preserves caller owner and reused primary retains original owner', async () => {
  const e = environment(); let active = true; const pending = e.context.__sqBuildPlayerStatsProfile('Thom', null, () => active); const p = e.primaries[0]; active = false; e.resolve(); await assert.rejects(pending, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.deepEqual(e.secondaryNames(), []);
  const f = environment(); const supplied = f.context.__sqPlayerStatsPrimary('Thom', () => false); const reused = f.context.__sqBuildPlayerStatsProfile('Thom', supplied, () => true); f.resolve(); await assert.rejects(reused, cancelMessage); await assert.rejects(supplied.rank, cancelMessage); assert.equal(f.primaries.length, 1); assert.deepEqual(f.secondaryNames(), []); return { callerCannotReplaceSharedOwner: true };
});
await test('closed pending source settles through unchanged actual 10000ms XP deadline without reads', async () => {
  const e = environment(); const p = await bootHub(e); button(e.hub(), 'Close').onclick(); assert([...e.timers.values()].some(t => t.ms === 10000)); e.fire(10000); const xp = await p.xp; await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); assert.equal(xp.available, false); assert.deepEqual(e.secondaryNames(), []); assert.equal(e.timers.size, 0); return { originalTimeoutMs: 10000, underlyingQueryNotCancelled: true };
});
await test('actual XP Retry preserves force truth and may overlap already-started secondaries', async () => {
  const e = environment({ neverGames: true, neverRank: true }); const p = await bootHub(e); e.resolve('Thom', { data: null, error: { code: '57014' } }); await p.xp; await flush(); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']);
  const host = e.hub().querySelector('.pp-progression'); assert(host.textContent === '' && host.querySelector('p').textContent.includes('unavailable'));
  button(host, 'Retry').onclick(); assert.equal(p.xp, e.xpPromises[1]); await flush(); assert.equal(e.queries.length, 2); e.resolve('Thom', { data: null, error: { code: '57014' } }); await p.xp; await flush(); button(host, 'Retry').onclick(); assert.equal(p.xp, e.xpPromises[2]); e.resolve(); const xp = await p.xp; await flush(); assert.equal(xp.available, true); assert.equal(xp.row.total_xp, 0); assert.deepEqual(e.calls.filter(c => c.source === 'xp-service').map(c => c.force), [false, true, true]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { retryIsolationClaimed: false, originalForceBehaviorRetained: true };
});
// The original 25 cases above retain their lightweight model qualification.
// These additional cases execute the actual shared-register/removal callbacks;
// removal delivery is a controlled microtask model, not a native MutationObserver.
const successorGuard = `            if ([...document.querySelectorAll('.sq-player-stats-hub')].some(hub => hub.isConnected && !overlay.contains(hub))){
              clearTimeout(profileHydrateTimer);
              ++profileRequest;
              releaseHistory();
              return;
            }
`;
assert.equal(windowFn('openPlayerStatsHub').split(successorGuard).length, 2, 'One bounded successor-hub guard');
await test('frozen v1 actual register/removal callbacks reproduce revival and duplicate source dispatch', async () => {
  const e = environment({ removalObserver: true, hubSource: windowFn('openPlayerStatsHub').replace(successorGuard, '') }); const p = await bootHub(e); const oldHub = e.hub(); e.views[0].tabs[1].onclick(); await flush(); e.child().remove(); e.context.openPlayerStatsHub('Thom'); await flush(); assert(oldHub.isConnected); assert.equal(e.doc.querySelectorAll('.sq-player-stats-hub').length, 2); e.resolve(); e.fire(1200); await Promise.all([p.games, p.rank, e.primaries[1].games, e.primaries[1].rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom', 'games:Thom', 'rank:Thom']); return { controlledRemovalDelivery: true, baselineRevivalReproduced: true };
});
await test('v2 actual register/removal callbacks keep one successor hub and reject old deferred sources', async () => {
  const e = environment({ removalObserver: true }); const p = await bootHub(e); const oldHub = e.hub(); e.views[0].tabs[1].onclick(); await flush(); e.child().remove(); e.context.openPlayerStatsHub('Thom'); await flush(); assert(!oldHub.isConnected); assert.equal(e.doc.querySelectorAll('.sq-player-stats-hub').length, 1); assert.equal(e.context.__sqModalStack.length, 0); e.resolve(); e.fire(1200); await assert.rejects(p.games, cancelMessage); await assert.rejects(p.rank, cancelMessage); await Promise.all([e.primaries[1].games, e.primaries[1].rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { controlledRemovalDelivery: true, oldRequestSuperseded: true };
});
await test('post-XP actual analytics notice Retry plus removal callbacks does not revive an old hydration owner', async () => {
  const e = environment({ removalObserver: true }); const p = await bootHub(e); const oldHub = e.hub(); e.resolve(); await Promise.all([p.games, p.rank]); e.views[0].tabs[0].onclick(); await flush(); const child = e.child(); assert(child?.isConnected); assert.equal([...e.timers.values()].filter(timer => timer.ms === 1200).length, 0);
  vm.runInContext('globalThis.__testNotice = (() => { const name = "Thom", unavailableSources = ["Target Points"]; ' + notice + ' return notice(); })();', e.context);
  child.querySelector('.modal-body').appendChild(e.context.__testNotice); button(e.context.__testNotice, 'Retry').onclick(); await flush(); assert(!oldHub.isConnected); assert.equal(e.doc.querySelectorAll('.sq-player-stats-hub').length, 1); assert.equal(e.primaries.length, 2); assert.equal([...e.timers.values()].filter(timer => timer.ms === 1200).length, 1); e.fire(1200); await Promise.all([e.primaries[1].games, e.primaries[1].rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom', 'games:Thom', 'rank:Thom']); return { actualNoticeHandlerAfterXP: true, onlyNewHubHydrationTimer: true, noticeMountedInControlledFixture: true };
});
for (const action of ['Back', 'Close', 'registered Escape']) {
  await test('actual register/removal callbacks preserve child ' + action + ' with no successor hub', async () => {
    const e = environment({ removalObserver: true }); const p = await bootHub(e); const hub = e.hub(); e.views[0].tabs[1].onclick(); await flush(); if (action === 'registered Escape') e.context.__sqModalStack[0].close('escape'); else button(e.child(), action).onclick(); await flush(); assert(hub.isConnected); assert.equal(e.doc.querySelectorAll('.sq-player-stats-hub').length, 1); assert.equal(e.primaries.length, 1); assert.equal(e.context.__sqModalStack.length, 0); e.resolve(); await Promise.all([p.games, p.rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { controlledRemovalDelivery: true };
  });
}
await test('legacy raw child removal with no successor still restores its hub as before', async () => {
  const e = environment({ removalObserver: true }); const p = await bootHub(e); const hub = e.hub(); e.views[0].tabs[1].onclick(); await flush(); e.child().remove(); await flush(); assert(hub.isConnected); assert.equal(e.doc.querySelectorAll('.sq-player-stats-hub').length, 1); e.resolve(); await Promise.all([p.games, p.rank]); assert.deepEqual(e.secondaryNames(), ['games:Thom', 'rank:Thom']); return { genericRawRemovalDiscardClaimed: false };
});
const receipt = { status: 'SC-063 PRIMARY SCHEDULING CONTROLLED REGRESSION PASS', sourcePath, sourceSHA256: hash(source), cases: results.length, originalLightweightModelCases: 25, actualRegisterObserverControlledCases: 7, bootPath, bootSourceSHA256: hash(bootSource), results, canonicalExtractSHA256: hash(canonical.join('\n') + xpService + windowFn('openPlayerStatsDialog') + windowFn('openPlayerStatsHub')), scope: 'Actual extracted Promise/service/modal owner transitions; original25 lightweight DOM model plus7 actual shared-register/removal callbacks with controlled microtask delivery. Native MutationObserver/public acceptance separate.', budgetsChanged: [], browserRuns: [], SQLRuns: [], performanceClaim: false };
console.log(JSON.stringify(receipt, null, 2));
