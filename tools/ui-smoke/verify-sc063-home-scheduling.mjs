// SC063 controlled Home request/cache scheduling. Actual canonical bodies;
// no browser, database connection or native/API performance claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const path = process.argv[2] || fileURLToPath(new URL('../../src/legacy/quarantine/core-pre-modals.js', import.meta.url));
const source = fs.readFileSync(path, 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function helper(name) { const m = source.match(new RegExp('^      const ' + name + ' = [\\s\\S]*?^      };', 'm')); assert(m, 'Actual helper missing: ' + name); return m[0]; }
const guard = `        // Stats covers Home; keep prior derived records until its normal poll
        // can rebuild them without starting full history behind the modal.
        if (document.querySelector('.sq-player-stats-directory, .sq-player-stats-hub, .sq-player-stats-content')) {
          return Array.isArray(st.derivedItems) ? st.derivedItems : [];
        }
`;
assert.equal(source.split(guard).length, 2, 'One bounded Home guard');
const candidate = helper('lpBuildDerivedPrinterItems'), original = candidate.replace(guard, '');
assert.notEqual(original, candidate);
const helpers = ['lpCloudOK', 'lpIsTurboGame', 'lpIsPracticeGame', 'lpRoundKey', 'lpExtractDarts', 'lpCountSummary', 'lpRoundTotal', 'lpFetchRelevantMatchRows', 'lpBuildCompletedMatchResultItems', 'lpSync'].map(helper);
const constants = source.match(/^      const LP_BUFFER = [\s\S]*?^      const LP_LOCAL_EVENT_KEY = .*?;/m)?.[0]; assert(constants);
const pollStart = source.indexOf('        window.__homeLivePrinterInterval = setInterval(()=>{');
const pollEnd = source.indexOf('        }, 1000);', pollStart) + '        }, 1000);'.length;
assert(pollStart > 0 && pollEnd > pollStart);
const poll = source.slice(pollStart, pollEnd);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const game = (id, mode, name, points, total = 300) => ({ id, ts:'2026-10-03T20:0' + id.slice(-1) + ':00Z', mode, is_practice: mode === 'practice', state:{ mode, is_practice: mode === 'practice' }, players:[{ name },{ name:'FILLER' }], totals:[total,200], board:[[{ roundTotal:points, darts:[] }],[{ roundTotal:0,darts:[] }]] });
const fixture = [game('g0','official','OFFICIAL LEADER',60),game('g1','official','MODE B',50),game('g2','turbo','TURBO LEADER',60),game('g3','turbo','MODE B',40),game('g4','practice','PRACTICE ONLY',70,400),{ ...game('g5','official','ARCHIVED',999), archived_at:'2026-10-04' }];
function environment({ control = false, parkedMatches = false, parkedAll = false, allError = false, visibleError = false, cloudMissing = false, pollMs = 15000, paused = false } = {}) {
  const time = { now:Date.parse('2026-10-04T08:00:00Z') }, visible = new Set(), calls = [], nodes = new Map(), all = deferred(), matches = deferred();
  class ModelDate extends Date { constructor(...args) { super(...(args.length ? args : [time.now])); } static now() { return time.now; } }
  const node = { classList:{ add(){}, remove(){} }, style:{} };
  const document = { querySelector(selector) { if (selector.startsWith('.')) return selector.split(',').map(x=>x.trim().slice(1)).some(name=>visible.has(name)) ? node : null; return node; }, getElementById(id) { if (!nodes.has(id)) nodes.set(id, { ...node, textContent:'' }); return nodes.get(id); } };
  const state = { syncing:false, tick:0, syncCount:0, forceFullEvery:4, lastSyncMs:time.now, paused, hold:0, nextHold:0, bufLines:[], displayLines:Array(15).fill(''), lpStarted:true, recentInjectedLines:[], lastSig:'' };
  let timer, allCalls = 0;
  const context = { window:null, document, Date:ModelDate, Set, Map, Array, Number, String, Promise, Math, SQ_GAMES_VISIBLE_MIN_POLL_MS:pollMs,
    __homeLivePrinterState:state, ensureCloudInit:()=>true,
    cloudFetchLatestVisibleGamesAsLocal:async limit=>{ calls.push({ source:'visible', limit, at:time.now }); if (visibleError) throw Error('visible source failure'); return [{ ...fixture[0], match_id:'m1' }]; },
    cloudListPlayers:async()=>{ calls.push({ source:'players', at:time.now }); return []; },
    cloudFetchAllGamesAsLocal:()=>{ allCalls++; calls.push({ source:'all', at:time.now }); if (allError) return Promise.reject(Error('all source failure')); return parkedAll ? all.promise : Promise.resolve(fixture.map(g=>({ ...g }))); },
    sb:{ from(table) { assert.equal(table, 'matches'); const q = { select(columns) { assert.equal(columns,'id,created_at,players,wins,history,total_games,target_wins'); return q; }, in(field, ids) { calls.push({ source:'matches', field, ids:Array.from(ids), at:time.now }); return parkedMatches ? matches.promise : Promise.resolve({ data:[], error:null }); } }; return q; } },
    setInterval(callback, interval) { assert.equal(interval,1000); timer = callback; return 1; },
    lpEnsureRows(lines) { calls.push({ source:'render', lines:Array.from(lines) }); }, lpScrollStep() { calls.push({ source:'motion', at:time.now }); },
    lpPlayerScoreText:(name,score)=>name + ' (' + score + ')', lpUnder100Names:()=>[], lpBeerAlertLineForGame:()=>'', lpFmtLine:item=>item.line_text || 'recent visible result', lpCollapseRoundPBOverflow:lines=>lines, lpSig:item=>String(item.event_id || item.id || item.ts || item.event_ts || '')
  };
  if (cloudMissing) delete context.cloudFetchAllGamesAsLocal;
  context.window = context; vm.createContext(context); vm.runInContext(constants + '\n' + helpers.join('\n') + '\n' + (control ? original : candidate) + '\n' + poll + '\nglobalThis.derived = lpBuildDerivedPrinterItems; globalThis.sync = lpSync;', context);
  return { context, state, time, calls, visible, all, matches, show:name=>visible.add('sq-player-stats-' + name), hide:name=>visible.delete('sq-player-stats-' + name), allCount:()=>allCalls, tick:async at=>{time.now=at;timer();await flush();}, derived:()=>context.derived(), sync:()=>context.sync(true) };
}
const plain = value => JSON.parse(JSON.stringify(value));
const results = [];
async function test(name, run) { const detail = await run(); results.push({ name, status:'PASS', ...detail }); }
await test('original control starts full history after parked match resolves beneath Stats', async()=>{
  const e = environment({ control:true, parkedMatches:true }); const pending=e.sync(); await flush(); assert.equal(e.allCount(),0); e.show('hub'); e.matches.resolve({ data:[],error:null }); await pending; assert.equal(e.allCount(),1); return { observedOriginalDispatch:true };
});
for (const modal of ['directory','hub','content']) {
  await test(modal + ' covering Home after actual matches await prevents full-history dispatch', async()=>{
    const e=environment({ parkedMatches:true }); const pending=e.sync(); await flush(); assert.equal(e.calls.filter(c=>c.source==='matches').length,1); e.show(modal); e.matches.resolve({ data:[],error:null }); await pending; assert.equal(e.allCount(),0); assert.equal(Object.hasOwn(e.state,'derivedItems'),false); assert.equal(Object.hasOwn(e.state,'derivedFetchedAt'),false); assert(e.state.bufLines.includes('recent visible result')); assert.equal(e.state.syncing,false); return { recentGamesAndMatchesPreserved:true, cacheNotStamped:true };
  });
  await test(modal + ' preserves stale derived array identity, contents and original timestamp', async()=>{
    const e=environment(); const prior=[{ event_ts:'2026-10-02',line_text:'existing cloud-derived record' }]; e.state.derivedItems=prior;e.state.derivedFetchedAt=e.time.now-300001;e.show(modal);const value=await e.derived();assert.equal(value,prior);assert.equal(e.state.derivedItems,prior);assert.equal(e.state.derivedFetchedAt,e.time.now-300001);assert.equal(e.allCount(),0);return{};
  });
}
await test('fresh nonempty cache returns same array before visibility guard and source work', async()=>{
  const e=environment();const prior=[{ line_text:'fresh record' }];e.state.derivedItems=prior;e.state.derivedFetchedAt=e.time.now-1000;e.show('hub');assert.equal(await e.derived(),prior);assert.equal(e.allCount(),0);assert.equal(e.state.derivedFetchedAt,e.time.now-1000);return{};
});
await test('covered empty cache retains identity and age; close permits unchanged recomputation', async()=>{
  const e=environment();const prior=[];e.state.derivedItems=prior;e.state.derivedFetchedAt=e.time.now-1000;e.show('hub');assert.equal(await e.derived(),prior);assert.equal(e.state.derivedFetchedAt,e.time.now-1000);e.hide('hub');const values=await e.derived();assert(values.length>0);assert.equal(e.allCount(),1);return{};
});
await test('detached hub plus connected shared child remains covered; unrelated modal does not defer', async()=>{
  const e=environment();e.show('content');assert.equal((await e.derived()).length,0);assert.equal(e.allCount(),0);e.hide('content');e.visible.add('unrelated-modal');assert((await e.derived()).length>0);assert.equal(e.allCount(),1);return{};
});
await test('uncovered complete derived outputs equal original modes, ordering and archive behavior', async()=>{
  const old=environment({control:true}),candidate=environment();const originalRows=await old.derived(),rows=await candidate.derived();assert.deepEqual(plain(rows),plain(originalRows));assert(rows.some(r=>/ROUND PB.*MODE B.*\(50\)/.test(r.line_text)));assert(rows.some(r=>/ROUND PB.*MODE B.*\(40\)/.test(r.line_text)));assert(!rows.some(r=>/ROUND (?:PB|WR).*PRACTICE ONLY|ARCHIVED/.test(r.line_text)));assert(rows.some(r=>/NEW GAME RECORD SCORE - PRACTICE ONLY - 400/.test(r.line_text)));return{completeTypedJSONOutputsEqual:true,practiceRoundExclusionPreserved:true,existingGameRecordSemanticsPreserved:true};
});
await test('closing Stats uses exact existing15s eligibility and1s tick to rebuild stale records', async()=>{
  const e=environment({parkedMatches:true});e.show('hub');const pending=e.sync();await flush();e.matches.resolve({data:[],error:null});await pending;e.hide('hub');const start=e.time.now;await e.tick(start+14999);assert.equal(e.allCount(),0);await e.tick(start+15000);await flush();assert.equal(e.allCount(),1);assert(e.state.derivedItems.length>0);assert.equal(e.state.derivedFetchedAt,start+15000);assert.equal(e.state.lastSyncMs,start+15000);return{minimumPollMs:15000,intervalMs:1000};
});
await test('larger existing minimum poll remains effective without early retry', async()=>{
  const e=environment({pollMs:30000});e.show('directory');await e.sync();e.hide('directory');const start=e.time.now;await e.tick(start+15000);assert.equal(e.allCount(),0);await e.tick(start+29999);assert.equal(e.allCount(),0);await e.tick(start+30000);assert.equal(e.allCount(),1);return{configuredPollMs:30000};
});
await test('pause continues existing cloud sync while suppressing motion', async()=>{
  const e=environment({paused:true});const start=e.time.now;await e.tick(start+15000);assert.equal(e.allCount(),1);assert.equal(e.calls.filter(c=>c.source==='motion').length,0);assert.equal(e.state.paused,true);return{};
});
await test('already-started full-history work remains uncancelled; actual syncing guard prevents duplicate sync', async()=>{
  const e=environment({parkedAll:true});const pending=e.sync();await flush();assert.equal(e.allCount(),1);e.show('hub');await e.sync();assert.equal(e.allCount(),1);e.all.resolve(fixture.map(g=>({...g})));await pending;assert(e.state.derivedItems.length>0);assert.equal(e.state.syncing,false);return{requestNotCancelled:true};
});
await test('source failure and missing-source cache/error outputs remain captured-original', async()=>{
  for(const opts of [{allError:true},{cloudMissing:true},{visibleError:true}]){const old=environment({...opts,control:true}),e=environment(opts);await old.sync();await e.sync();assert.deepEqual(plain(e.state),plain(old.state));assert.equal(e.state.syncing,false);}return{originalFailureStatePreserved:true};
});
await test('covered missing source is not marked fetched; later uncovered fallback stays original', async()=>{
  const e=environment({cloudMissing:true});e.show('content');assert.equal((await e.derived()).length,0);assert.equal(Object.hasOwn(e.state,'derivedFetchedAt'),false);e.hide('content');assert.equal((await e.derived()).length,0);assert.equal(e.state.derivedFetchedAt,e.time.now);return{};
});
console.log(JSON.stringify({status:'SC063 HOME SCHEDULING CONTROLLED REGRESSION PASS',cases:results.length,sourcePath:path,sourceSHA256:hash(source),results,scope:'Actual derived-record helpers, lpSync and original1s interval callback with modeled DOM/clock/cloud seams; existing nativeSC047/realAPI acceptance separate',budgetsChanged:[],browserRuns:[],SQLRuns:[],performanceClaim:false},null,2));
