// SC-043: real UI remains useful under independent slow/failed cloud sources.
// Production traffic is blocked by the shared harness; values are known fixtures.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const FX = require('./pstats-fixture');
let checks = 0;
const check = (label, pass, detail) => { assert.ok(pass, label + (detail ? ': ' + JSON.stringify(detail) : '')); checks++; console.log('PASS ' + label); };
const hub = '.sq-player-stats-hub';
const child = '.sq-player-stats-content';
const shots = process.env.SQ_SCREENSHOTS || 'output/playwright/sc043';
fs.mkdirSync(shots, { recursive:true });
async function install(page, mode){
  await FX.install(page);
  await page.evaluate(({ mode, xp }) => {
    window.__sc043Mode = mode; window.__sc043Reads = {}; window.__sc043Games = 0;
    window.__sc043Players = [
      { name:'Alex S', nickname:'The Atomic', avatar_id:17 }, { name:'Jo R' }, { name:'Mia K' }, { name:'Sam T', avatar_id:6 }
    ];
    cloudListPlayers = async () => window.__sc043Players;
    const games = cloudFetchAllGamesAsLocal;
    cloudFetchAllGamesAsLocal = () => { window.__sc043Games++; return window.__sc043Mode === 'games_hang' ? new Promise(() => {}) : games(); };
    const from = window.sb.from.bind(window.sb);
    const query = (result, hang=false) => {
      const q = { select(){return q;}, eq(){return q;}, ilike(){return q;}, or(){return q;}, order(){return q;}, limit(){return q;}, range(){return q;},
        then(resolve){ if (!hang) resolve(result); } }; return q;
    };
    window.sb = window.__sb = { from(table){
      window.__sc043Reads[table] = (window.__sc043Reads[table] || 0) + 1;
      const m = window.__sc043Mode;
      if (table === 'v_player_xp' && ['directory_hang','xp_hang'].includes(m)) return query(null, true);
      if (table === 'v_player_misfires' && m === 'misfire_hang') return query(null, true);
      if ((table === 'v_player_xp' && m === 'xp_error') || (table === 'v_player_game_scores_official_clean' && m === 'rank_error') ||
          (['v_ach_base','v_ach_david_goliath'].includes(table) && m === 'history_error')) return query({ data:null, error:{ message:'fixture timeout' } });
      if (table === 'v_player_xp' && m === 'zero') return query({ data:[{...xp, total_xp:0}], error:null });
      if (m === 'targets_hang' && ['v_player_last30_targets','v_player_last30_target_rates'].includes(table)) return query(null, true);
      return from(table);
    } };
    SQ_XP._cache = null; SQ_XP._cacheAt = 0; SQ_XP._inflight = null;
    SQ_XP._oneCache.clear(); SQ_XP._oneInflight.clear(); SQ_XP._oneAvailable.clear();
  }, { mode, xp:FX.FIXTURE.views.v_player_xp[0] });
}
async function closeAll(page){
  // Use the real controls: removing a registered child DOM node deliberately
  // invokes its Return-to-hub callback and is not equivalent to closing the hub.
  while (await page.locator(child).count()) await page.locator(child+' .modal-footer button').filter({hasText:/BACK/i}).last().click();
  while (await page.locator(hub).count()) await page.locator(hub+' [aria-label=Close]').last().click();
  while (await page.locator('.sq-player-stats-directory').count()) await page.locator('.sq-player-stats-directory [aria-label=Close]').last().click();
}
// Additive SC063 native DOM seam. The shared harness still aborts every
// production request; only local fixture XP transport completion is controlled.
// These tests do not change actual service methods or source timer deadlines.
async function installFreshDirectoryRace(page){
  await install(page, 'healthy');
  await page.evaluate(xp => {
    window.__sc063FallbackQueries = [];
    window.__sc063FallbackReceipts = [];
    // The generic historical fixture uses p1. This additive typed-row seam
    // supplies a canonical UUID only for its own XP rows; other fixtures stay exact.
    const nativeRow = { ...xp, name:'Native XP', player_id:'11111111-1111-4111-8111-111111111111' };
    // A distinct fixture name prevents earlier deliberately hung Alex reads
    // from mutating this seam's one-row flags when their real deadline fires.
    window.__sc043Players = [{name:nativeRow.name,id:nativeRow.player_id,avatar_id:17}];
    cloudListPlayers = async () => window.__sc043Players;
    const from = window.sb.from.bind(window.sb);
    window.sb = window.__sb = { from(table){
      if (table !== 'v_player_xp') return from(table);
      window.__sc043Reads[table] = (window.__sc043Reads[table] || 0) + 1;
      let deliver;
      const pending = new Promise(resolve => { deliver = resolve; });
      const q = { field:null, value:null, limitValue:null, observed:false, delivered:false,
        select(){return q;}, eq(field,value){q.field=field;q.value=value;return q;},
        ilike(field,value){q.field=field;q.value=value;return q;},
        order(){return q;}, or(){return q;}, range(){return q;},
        limit(value){q.limitValue=value;return q;},
        then(resolve,reject){q.observed=true;return pending.then(resolve,reject);},
        deliver
      };
      window.__sc063FallbackQueries.push(q); return q;
    } };
    SQ_XP._allAvailable = false;
    window.__sc063FallbackComplete = (kind, outcome) => {
      const q = window.__sc063FallbackQueries.find(q => !q.delivered &&
        (kind === 'selected' ? q.limitValue === 1 : q.limitValue == null));
      if (!q || !q.observed) throw new Error('Missing observed native '+kind+' fixture query');
      q.delivered = true;
      const data = outcome === 'success'
        ? [{ ...nativeRow, ...(kind === 'selected' ? {total_xp:152} : {}) }]
        : null;
      const error = outcome === 'success' ? null : {code:'57014',message:'controlled native selected/all timeout'};
      window.__sc063FallbackReceipts.push({kind,outcome,field:q.field,value:q.value,limit:q.limitValue,errorCode:error?.code||null});
      q.deliver({data,error});
    };
  }, FX.FIXTURE.views.v_player_xp[0]);
}
async function openFreshDirectoryRace(page){
  await page.evaluate(() => openPlayerStatsSelect());
  await page.getByRole('button',{name:'Choose player Native XP',exact:true}).waitFor({timeout:2000});
  assert.equal(await page.evaluate(()=>__sc063FallbackQueries.length),0,'Ordinary directory names must not start all-XP');
  // This seam intentionally exercises concurrent all/selected sources: request
  // the actual Top control before selecting, preserving every existing oracle.
  await page.locator('.sq-player-stats-directory [data-f=top]').click();
  await page.waitForFunction(()=>__sc063FallbackQueries.length===1 &&
    __sc063FallbackQueries[0].observed && __sc063FallbackQueries[0].limitValue==null, null, {timeout:2000});
  await page.getByRole('button',{name:'Choose player Native XP',exact:true}).click();
  await page.waitForFunction(() => __sc063FallbackQueries.length===2 &&
    __sc063FallbackQueries.every(q=>q.observed) &&
    __sc063FallbackQueries.some(q=>q.limitValue==null) &&
    __sc063FallbackQueries.some(q=>q.limitValue===1&&q.field==='name'&&q.value==='Native XP'), null, {timeout:2000});
  // A real XP child keeps the original primary owner and clears the hub's
  // optional hydration timer. No different service/owner implementation is used.
  await page.locator(hub+' .pp-tab').nth(1).click();
  await page.waitForSelector(child+' .pp-source-state', {timeout:2000});
}
async function main(width){
  const {browser, page, consoleErrs} = await H.launch({width, height:844});
  try {
    // The offline harness serves Supabase locally; omit its external TLS hint.
    await page.route(H.APP_URL, async route => {
      if (route.request().method() !== 'GET' || route.request().resourceType() !== 'document') return route.fallback();
      const response = await route.fetch({ maxRedirects:0, timeout:8000 });
      const body = (await response.text()).replace('<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>', '');
      const headers = { ...response.headers(), 'content-length':String(Buffer.byteLength(body)) };
      await route.fulfill({ response, headers, body });
    });
    await H.boot(page, {settle:500}); await page.emulateMedia({reducedMotion:'reduce'});
    await install(page, 'directory_hang');
    await page.evaluate(() => { __sqPlayerStatsSelectedName = 'Sam T'; openPlayerStatsSelect(); });
    await page.waitForSelector('.ps-pick-search', {timeout:2000});
    check(width + ': alphabetical directory starts no XP before Top intent', await page.evaluate(()=>
      !__sc043Reads.v_player_xp && !document.querySelector('.ps-pick-controls [data-f=top]').disabled
    ));
    await page.locator('.sq-player-stats-directory [data-f=top]').click();
    const picker = await page.evaluate(() => ({
      names:[...document.querySelectorAll('.sq-player-stats-directory .menu-list .menu-row-title')].map(x => x.textContent),
      selected:document.querySelector('.menu-row.is-selected')?.getAttribute('aria-label'),
      letters:[...document.querySelectorAll('.ps-pick-alphabet button:not(:disabled)')].map(x => x.textContent),
      sizes:[...document.querySelectorAll('.ps-pick-alphabet button')].map(x => [x.getBoundingClientRect().width,x.getBoundingClientRect().height]),
      topDisabled:document.querySelector('.ps-pick-controls [data-f=top]').disabled
    }));
    check(width + ': directory appears despite hung XP and keeps alphabetical order', JSON.stringify(picker.names) === JSON.stringify(['Alex S','Jo R','Mia K','Sam T']), picker);
    check(width + ': actual population enables only available letters', picker.letters.join('') === 'AJMS' && picker.sizes.every(([w,h]) => w>=44 && h>=44), picker);
    check(width + ': selected player stays clear; unavailable Top is disabled', /Sam T/.test(picker.selected) && picker.topDisabled, picker);
    await page.getByRole('button', {name:'Jump to names beginning with M', exact:true}).click();
    const jump = await page.evaluate(() => { const row=document.activeElement, r=row.getBoundingClientRect(), rail=document.querySelector('.ps-pick-controls').getBoundingClientRect(); return {letter:row.dataset.playerLetter, top:r.top, railBottom:rail.bottom, selected:__sqPlayerStatsSelectedName, hub:!!document.querySelector('.sq-player-stats-hub')}; });
    check(width + ': alphabet focuses and reveals the first matching player without selecting it', jump.letter==='M' && jump.top>=jump.railBottom-2 && jump.selected==='Sam T' && !jump.hub, jump);
    await page.locator('.ps-pick-search').fill('Alex');
    check(width + ': search updates letter availability from the filtered names', await page.locator('.ps-pick-alphabet button:not(:disabled)').count()===1);
    await page.locator('.ps-pick-search').fill('');
    const pickerFit = await page.locator('.sq-player-stats-directory').evaluate(el => ({width:el.getBoundingClientRect().width, viewport:innerWidth, scroll:el.scrollWidth, client:el.clientWidth}));
    check(width + ': horizontally scrolling alphabet stays contained', pickerFit.width<=pickerFit.viewport && pickerFit.scroll<=pickerFit.client+1, pickerFit);
    await page.screenshot({path:path.join(shots, `sc043-picker-${width}.png`)});
    // Keyboard activation selects a row; using the rail alone did not.
    await page.getByRole('button', {name:'Jump to names beginning with A',exact:true}).click();
    await page.keyboard.press('Enter'); await page.waitForSelector(hub+' .pp-hero-name');
    check(width + ': keyboard activation selects the intended player', await page.locator('.pp-hero-name').textContent()==='Alex S');
    await closeAll(page);

    await install(page, 'games_hang'); await page.evaluate(() => openPlayerStatsHub('Alex S'));
    await page.waitForFunction(() => /151 XP/.test(document.querySelector('.pp-progression')?.textContent || ''), null, {timeout:2000});
    const independent = await page.locator('.pp-hero').evaluate(el => ({text:el.innerText, avatar:el.querySelector('.pp-identity-avatar').dataset.avatarId, tiles:[...el.querySelectorAll('.pp-tile-value')].map(x=>x.textContent)}));
    check(width + ': canonical avatar and real XP/level appear while games are hung', independent.avatar==='17' && /LV 2/.test(independent.text) && /151 XP/.test(independent.text) && independent.tiles[1]==='Loading…', independent);
    await page.locator(hub+' .pp-tab').nth(1).click(); await page.waitForSelector('.pp-orb-xp');
    check(width + ': XP content is independent of game history', await page.locator('.pp-orb-xp').textContent()==='151');
    await page.locator(child+' .modal-footer button').filter({hasText:/Back/i}).click();
    await page.waitForSelector(hub+' .pp-hero');
    check(width + ': Back restores the player and XP selection without another XP read', await page.evaluate(()=>__sc043Reads.v_player_xp===1 && document.querySelector('.pp-tab.active').textContent==='XP'));
    await page.screenshot({path:path.join(shots, `sc043-independent-${width}.png`)});
    await closeAll(page);

    await install(page, 'targets_hang'); await page.evaluate(() => openPlayerStatsHub('Alex S'));
    await page.waitForFunction(() => JSON.stringify([...document.querySelectorAll('.pp-tile-value')].map(x=>x.textContent))===JSON.stringify(['8.75 (#3)','5','126.0']), null, {timeout:2000});
    assert.equal(await page.evaluate(()=>__sc043Reads.v_player_last30_targets||0),0,'Primary header must not request optional analytics before Stats intent');
    await page.locator(hub+' .pp-tab').first().click();
    await page.waitForFunction(()=>__sc043Reads.v_player_last30_targets===1);
    check(width + ': primary rank, games and average are visible before target analytics', await page.locator(child+' .pp-source-state [role=status]').textContent()==='Loading target analytics…');
    // The real Stats child remains pending. Back restores the same Hub so its
    // independent Achievements path can render while target transports stall.
    await page.locator(child+' .modal-footer button').filter({hasText:/Back/i}).click();
    await page.waitForSelector(hub+' .pp-hero');
    await page.locator(hub+' .pp-tab').nth(2).click();
    await page.waitForFunction(()=>document.querySelector('.pp-vault-count')?.textContent==='2 / 58');
    const history = await page.evaluate(()=>({count:document.querySelector('.pp-vault-count').textContent, misfires:document.querySelector('.pp-misfires').textContent, reads:__sc043Reads}));
    check(width + ': actual trophies and Misfires appear despite stalled targets', history.count==='2 / 58' && /6 historical occurrences/.test(history.misfires), history);
    check(width + ': opening trophies reuses the selected player sources', history.reads.v_player_xp===1 && history.reads.v_ach_base===1 && history.reads.v_ach_david_goliath===1 && history.reads.v_player_misfires===1, history.reads);
    await page.screenshot({path:path.join(shots, `sc043-history-${width}.png`)});
    await page.locator(child+' .modal-footer button').filter({hasText:/Close/i}).click();
    await page.waitForSelector(hub+' .pp-hero'); await page.locator(hub+' [aria-label=Close]').click();
    await page.waitForTimeout(100);
    check(width + ': delayed data cannot reopen a closed profile', await page.locator(hub).count()===0 && await page.locator(child).count()===0);
    if (width===390){
      await install(page, 'xp_error'); await page.evaluate(()=>{ const from=window.sb.from.bind(window.sb); window.sb=window.__sb={from(table){ const q=from(table); if(['v_player_last30_targets','v_player_last30_target_rates'].includes(table)){const then=q.then.bind(q); q.then=resolve=>setTimeout(()=>then(resolve),2000);} return q; }}; openPlayerStatsHub('Alex S'); });
      await page.waitForFunction(()=>/XP is unavailable/.test(document.querySelector('.pp-progression')?.textContent || ''));
      const failed = await page.locator('.pp-progression').innerText();
      check('failed XP shows no invented level, title or zero', !/LV 1|ROOKIE|0 XP|No ranked games/i.test(failed), failed);
      await page.evaluate(()=>__sc043Mode='healthy'); await page.locator('.pp-progression').getByRole('button',{name:'Retry',exact:true}).click();
      await page.waitForFunction(()=>/151 XP/.test(document.querySelector('.pp-progression')?.textContent || ''));
      check('XP Retry performs a fresh read and recovers the genuine level', await page.evaluate(()=>__sc043Reads.v_player_xp===2 && /LV 2/.test(document.querySelector('.pp-progression').textContent)));
      // Request the actual full Stats view after force recovery. Waiting for its
      // real cards preserves the existing delayed-analytics hydration check.
      await page.locator(hub+' .pp-tab').first().click();
      await page.waitForFunction(()=>__sc043Reads.v_player_last30_targets===1);
      await page.waitForSelector(child+' .pp-cards');
      await page.locator(child+' .modal-footer button').filter({hasText:/Back/i}).click();
      await page.waitForSelector(hub+' .sq-player-stats-profile > [aria-busy="false"]');
      check('recovered XP survives delayed profile hydration', /151 XP/.test(await page.locator('.pp-progression').innerText()) && await page.getByRole('button',{name:'Retry',exact:true}).count()===0);
      await closeAll(page);
      await install(page, 'history_error'); await page.evaluate(()=>{
        // Observation only: preserve every fixture/source result and native timer.
        window.__sc063HistoryReadEvents=[]; window.__sc063HistoryPhase='automatic hub';
        const from=window.sb.from.bind(window.sb);
        window.sb=window.__sb={from(table){
          if(['v_ach_base','v_ach_david_goliath','v_player_misfires'].includes(table))
            window.__sc063HistoryReadEvents.push({table,phase:window.__sc063HistoryPhase});
          return from(table);
        }};
        openPlayerStatsHub('Alex S');
      });
      await page.waitForSelector(hub+' .pp-tab');
      await page.evaluate(()=>__sc063HistoryPhase='opening Achievements child');
      await page.locator(hub+' .pp-tab').nth(2).click();
      await page.waitForFunction(()=>/unavailable/.test(document.querySelector('.pp-vault-sub')?.textContent || ''));
      check('failed positive history remains unknown while genuine Misfires render', await page.locator('.pp-vault-count').textContent()==='— / 58' && /6 historical occurrences/.test(await page.locator('.pp-misfires').innerText()));
      // The unavailable child has settled. Capture existing automatic/open reads
      // before the one explicit action; keep them visible in the diagnostic.
      const beforeHistoryRetry=await page.evaluate(()=>({
        base:__sc043Reads.v_ach_base||0,dg:__sc043Reads.v_ach_david_goliath||0,mf:__sc043Reads.v_player_misfires||0,
        events:__sc063HistoryReadEvents.slice()
      }));
      await page.evaluate(()=>{__sc043Mode='healthy';__sc063HistoryPhase='explicit Retry';});
      await page.getByRole('button',{name:'Retry unavailable history',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.pp-vault-count')?.textContent==='2 / 58');
      const afterHistoryRetry=await page.evaluate(()=>({
        base:__sc043Reads.v_ach_base||0,dg:__sc043Reads.v_ach_david_goliath||0,mf:__sc043Reads.v_player_misfires||0,
        events:__sc063HistoryReadEvents.slice()
      }));
      // Observe after real source recovery too; late extra reads fail the delta.
      await page.waitForTimeout(100);
      const settledHistoryRetry=await page.evaluate(()=>({
        base:__sc043Reads.v_ach_base||0,dg:__sc043Reads.v_ach_david_goliath||0,mf:__sc043Reads.v_player_misfires||0,
        events:__sc063HistoryReadEvents.slice()
      }));
      console.log('SC063_NATIVE_HISTORY_RETRY_DIAGNOSTIC '+JSON.stringify({before:beforeHistoryRetry,after:afterHistoryRetry,settled:settledHistoryRetry}));
      check('history Retry recovers from the source instead of accepting a cached failure',
        beforeHistoryRetry.base===beforeHistoryRetry.dg && [1,2].includes(beforeHistoryRetry.base) &&
        JSON.stringify(beforeHistoryRetry.events.map(event=>event.table))===JSON.stringify(beforeHistoryRetry.base===1
          ? ['v_ach_base','v_ach_david_goliath','v_player_misfires']
          : ['v_ach_base','v_ach_david_goliath','v_player_misfires','v_ach_base','v_ach_david_goliath']) &&
        beforeHistoryRetry.events.filter(event=>event.table!=='v_player_misfires').every((event,index,events)=>
          ['automatic hub','opening Achievements child'].includes(event.phase) && event.phase===events[index-index%2].phase) &&
        afterHistoryRetry.base===beforeHistoryRetry.base+1 && afterHistoryRetry.dg===beforeHistoryRetry.dg+1 &&
        beforeHistoryRetry.mf===1 && afterHistoryRetry.mf===beforeHistoryRetry.mf && settledHistoryRetry.mf===1 &&
        settledHistoryRetry.base===afterHistoryRetry.base && settledHistoryRetry.dg===afterHistoryRetry.dg &&
        JSON.stringify(afterHistoryRetry.events.slice(beforeHistoryRetry.events.length).map(event=>event.table))===JSON.stringify(['v_ach_base','v_ach_david_goliath']) &&
        JSON.stringify(settledHistoryRetry.events)===JSON.stringify(afterHistoryRetry.events),
        {before:beforeHistoryRetry,after:afterHistoryRetry,settled:settledHistoryRetry});
      await closeAll(page);
      await install(page, 'zero'); await page.evaluate(()=>openPlayerStatsDialog('Alex S',{tab:1}));
      await page.waitForSelector('.pp-orb-xp');
      check('healthy authoritative zero XP is distinct from failure', await page.locator('.pp-orb-xp').textContent()==='0' && await page.locator('.pp-orb-level').textContent()==='1');
      await closeAll(page);
      await install(page, 'healthy'); await page.evaluate(()=>openPlayerStatsHub('Alex S'));
      await page.waitForSelector(hub+' .pp-tab'); await page.locator(hub+' [aria-label=Close]').click();
      await page.waitForTimeout(1400);
      check('closing the hub cancels deferred history and target reads', await page.evaluate(()=>!__sc043Reads.v_ach_base && !__sc043Reads.v_player_misfires && !__sc043Reads.v_player_last30_targets));
      await install(page, 'healthy');
      const cachedXp = await page.evaluate(async()=>{
        const realNow = Date.now;
        let now = realNow();
        Date.now = () => now;
        try{
          await SQ_XP.all(true);
          const directoryAt = SQ_XP._cacheAt;
          now += 59000;
          const state = await SQ_XP.forNameState('Alex S');
          const reused = { reads:__sc043Reads.v_player_xp || 0, at:SQ_XP._oneCache.get('name:alex s').at, available:state.available, xp:Number(state.row && state.row.total_xp) };
          now += 1001;
          const renewed = await SQ_XP.forNameState('Alex S');
          const expired = { reads:__sc043Reads.v_player_xp || 0, available:renewed.available, xp:Number(renewed.row && renewed.row.total_xp) };
          now += 1;
          const retry = await SQ_XP.forNameState('Alex S', true);
          return { directoryAt, reused, expired, forced:{ reads:__sc043Reads.v_player_xp || 0, available:retry.available, xp:Number(retry.row && retry.row.total_xp) } };
        }finally{ Date.now = realNow; }
      });
      check('59-second directory XP is reused without a duplicate read or renewed cache age', cachedXp.reused.reads===1 && cachedXp.reused.at===cachedXp.directoryAt && cachedXp.reused.available && cachedXp.reused.xp===151, cachedXp);
      check('selected XP expires at the original directory 60-second boundary', cachedXp.expired.reads===2 && cachedXp.expired.available && cachedXp.expired.xp===151, cachedXp);
      check('explicit XP Retry bypasses a fresh selected-player cache', cachedXp.forced.reads===3 && cachedXp.forced.available && cachedXp.forced.xp===151, cachedXp);

      await install(page, 'xp_hang'); await page.evaluate(()=>openPlayerStatsHub('Alex S'));
      await page.waitForTimeout(1500);
      check('hung primary XP prevents automatic games/rank/history/target stampede', await page.evaluate(()=>
        __sc043Games === 0 && !__sc043Reads.v_player_game_scores_official_clean &&
        !__sc043Reads.v_ach_base && !__sc043Reads.v_ach_david_goliath && !__sc043Reads.v_player_misfires && !__sc043Reads.v_player_last30_targets
      ), await page.evaluate(()=>({ games:__sc043Games, reads:__sc043Reads })));
      await closeAll(page);

      await install(page, 'misfire_hang'); await page.evaluate(()=>openPlayerStatsHub('Alex S'));
      await page.waitForTimeout(1700);
      check('in-flight Misfire history is prioritised before automatic target analytics', await page.evaluate(()=>
        __sc043Reads.v_player_misfires===1 && !__sc043Reads.v_player_last30_targets && !__sc043Reads.v_player_last30_target_rates &&
        __sc043Games === 0 && !__sc043Reads.v_player_game_scores_official_clean
      ), await page.evaluate(()=>__sc043Reads));
      await closeAll(page);

      await install(page, 'rank_error'); await page.evaluate(()=>openPlayerStatsHub('Alex S'));
      await page.getByRole('button',{name:'Retry rank',exact:true}).waitFor();
      await page.evaluate(()=>__sc043Mode='healthy'); await page.getByRole('button',{name:'Retry rank',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.pp-tile-value')?.textContent==='8.75 (#3)');
      check('failed rank has a scoped fresh retry', await page.evaluate(()=>__sc043Reads.v_player_game_scores_official_clean===2 && __sc043Games===1));
    }
    if(width===390){
      await closeAll(page); await install(page, 'rank_error');
      await page.evaluate(()=>{ __fetchThrowsForGames=async()=>Array.from({length:28},(_,i)=>({player:'Alex S',game_id:'fixture-game-'+Math.floor(i/14),round_index:i%14,points:10})); openPlayerStatsHub('Alex S'); });
      await page.waitForSelector(hub+' .sq-player-stats-profile > [aria-busy="false"]');
      check('canonical rank failure does not become a guessed hero rank', await page.locator('.pp-tile-value').first().textContent()==='Unavailable');
      await page.locator(hub+' .pp-tab').first().click();
      await page.waitForSelector(child+' .pp-cards');
      check('Quick Stats uses the same unavailable rank instead of a partial-board position', /Current Power Rank\s+Unavailable/.test(await page.locator(child).innerText()));
    }
    if (width===390){
      // Existing source/value assertions are preserved with explicit Stats intent.
      // This additional seam uses real directory selection, XP panel, Back and Retry.
      await closeAll(page); await installFreshDirectoryRace(page); await openFreshDirectoryRace(page);
      check('native fallback selected request starts independently before directory XP settles', await page.evaluate(()=>
        __sc063FallbackQueries.length===2 && __sc063FallbackQueries.every(q=>!q.delivered) &&
        !__sc043Games && !__sc043Reads.v_player_game_scores_official_clean
      ));
      await page.evaluate(()=>__sc063FallbackComplete('all','success'));
      await page.waitForFunction(()=>SQ_XP._allAvailable && !SQ_XP._inflight, null, {timeout:2000});
      await page.evaluate(()=>{ __sc063AllCacheIdentity=SQ_XP._cache; __sc063AllCacheAt=SQ_XP._cacheAt; });
      check('native fresh directory completion does not settle pending selected XP or launch statistics', await page.evaluate(()=>
        /Loading XP/.test(document.querySelector('.sq-player-stats-content')?.textContent||'') &&
        __sc063FallbackQueries.filter(q=>q.limitValue===1).every(q=>!q.delivered) &&
        !__sc043Games && !__sc043Reads.v_player_game_scores_official_clean
      ));
      await page.evaluate(()=>__sc063FallbackComplete('selected','error'));
      await page.waitForFunction(()=>document.querySelector('.pp-orb-xp')?.textContent==='151' &&
        document.querySelector('.pp-orb-level')?.textContent==='2', null, {timeout:2000});
      check('native fresh directory row renders true XP while selected57014 and failed maps remain intact', await page.evaluate(()=>
        !document.querySelector('.sq-player-stats-content .pp-source-state') &&
        SQ_XP._oneAvailable.get('name:native xp')===false && !SQ_XP._oneCache.has('name:native xp') &&
        SQ_XP._cache===__sc063AllCacheIdentity && SQ_XP._cacheAt===__sc063AllCacheAt &&
        __sc043Reads.v_player_xp===2 && __sc063FallbackReceipts.at(-1).errorCode==='57014'
      ));
      await page.locator(child+' .modal-footer button').filter({hasText:/BACK/i}).click();
      await page.waitForFunction(()=>/151 XP/.test(document.querySelector('.pp-progression')?.textContent||''), null, {timeout:2000});
      check('native fallback Back restores the same progression without a new XP read', await page.evaluate(()=>
        /LV 2/.test(document.querySelector('.pp-progression')?.textContent||'') &&
        !document.querySelector('.sq-player-stats-content') && __sc043Reads.v_player_xp===2
      ));
      await closeAll(page);

      await installFreshDirectoryRace(page); await openFreshDirectoryRace(page);
      await page.evaluate(()=>__sc063FallbackComplete('all','success'));
      await page.waitForFunction(()=>SQ_XP._allAvailable && !SQ_XP._inflight, null, {timeout:2000});
      // Age the actual successful cache only in this offline fixture. Native
      // timers and every source deadline remain unchanged; no sixty-second sleep.
      await page.evaluate(()=>{ SQ_XP._cacheAt=Date.now()-60000; __sc063AllCacheAt=SQ_XP._cacheAt; });
      await page.evaluate(()=>__sc063FallbackComplete('selected','error'));
      await page.waitForFunction(()=>/XP is unavailable/.test(document.querySelector('.sq-player-stats-content')?.textContent||''), null, {timeout:2000});
      check('native expired directory row cannot invent a level or zero after selected failure', await page.evaluate(()=>
        !document.querySelector('.pp-orb-xp') && !/LV 1|ROOKIE|0 XP/.test(document.querySelector('.sq-player-stats-content')?.textContent||'') &&
        SQ_XP._cacheAt===__sc063AllCacheAt && SQ_XP._oneAvailable.get('name:native xp')===false &&
        __sc043Reads.v_player_xp===2
      ));
      await closeAll(page);

      await installFreshDirectoryRace(page); await openFreshDirectoryRace(page);
      await page.evaluate(()=>{ __sc063FallbackComplete('all','error'); __sc063FallbackComplete('selected','error'); });
      await page.waitForFunction(()=>/XP is unavailable/.test(document.querySelector('.sq-player-stats-content')?.textContent||''), null, {timeout:2000});
      check('native unavailable directory and selected sources retain unknown XP with both failures', await page.evaluate(()=>
        !SQ_XP._allAvailable && SQ_XP._cache===null && !document.querySelector('.pp-orb-xp') &&
        !/LV 1|ROOKIE|0 XP/.test(document.querySelector('.sq-player-stats-content')?.textContent||'') &&
        __sc063FallbackReceipts.length===2 && __sc063FallbackReceipts.every(r=>r.errorCode==='57014')
      ));
      await closeAll(page);

      await installFreshDirectoryRace(page); await openFreshDirectoryRace(page);
      await page.evaluate(()=>__sc063FallbackComplete('selected','error'));
      await page.waitForFunction(()=>/XP is unavailable/.test(document.querySelector('.sq-player-stats-content')?.textContent||''), null, {timeout:2000});
      check('native selected failure returns while all-XP stays pending', await page.evaluate(()=>
        !!SQ_XP._inflight && __sc063FallbackQueries.filter(q=>q.limitValue==null).every(q=>!q.delivered) &&
        __sc043Reads.v_player_xp===2
      ));
      await page.evaluate(()=>__sc063FallbackComplete('all','success'));
      await page.waitForFunction(()=>SQ_XP._allAvailable && !SQ_XP._inflight, null, {timeout:2000});
      await page.evaluate(()=>{ __sc063AllCacheIdentity=SQ_XP._cache; __sc063AllCacheAt=SQ_XP._cacheAt; });
      check('native late directory success does not retroactively heal an unavailable panel', await page.evaluate(()=>
        /XP is unavailable/.test(document.querySelector('.sq-player-stats-content')?.textContent||'') &&
        !document.querySelector('.pp-orb-xp') && SQ_XP._oneAvailable.get('name:native xp')===false
      ));
      await page.locator(child).getByRole('button',{name:'Retry',exact:true}).click();
      await page.waitForFunction(()=>__sc063FallbackQueries.length===3 && __sc063FallbackQueries.at(-1).observed, null, {timeout:2000});
      await page.evaluate(()=>__sc063FallbackComplete('selected','error'));
      await page.waitForFunction(()=>/XP is unavailable/.test(document.querySelector('.sq-player-stats-content')?.textContent||''), null, {timeout:2000});
      check('native forced Retry failure stays unavailable despite fresh directory data', await page.evaluate(()=>
        !document.querySelector('.pp-orb-xp') && SQ_XP._cache===__sc063AllCacheIdentity && SQ_XP._cacheAt===__sc063AllCacheAt &&
        SQ_XP._oneAvailable.get('name:native xp')===false && !SQ_XP._oneCache.has('name:native xp') &&
        __sc043Reads.v_player_xp===3 && __sc063FallbackReceipts.at(-1).errorCode==='57014'
      ));
      await page.locator(child).getByRole('button',{name:'Retry',exact:true}).click();
      await page.waitForFunction(()=>__sc063FallbackQueries.length===4 && __sc063FallbackQueries.at(-1).observed, null, {timeout:2000});
      await page.evaluate(()=>__sc063FallbackComplete('selected','success'));
      await page.waitForFunction(()=>document.querySelector('.pp-orb-xp')?.textContent==='152' &&
        document.querySelector('.pp-orb-level')?.textContent==='2', null, {timeout:2000});
      check('native fresh forced success uses its own152XP row over the151XP directory row', await page.evaluate(()=>
        SQ_XP._oneAvailable.get('name:native xp')===true && SQ_XP._oneCache.get('name:native xp')?.row.total_xp===152 &&
        SQ_XP._cache===__sc063AllCacheIdentity && SQ_XP._cache[0].total_xp===151 &&
        SQ_XP._cacheAt===__sc063AllCacheAt && __sc043Reads.v_player_xp===4
      ));
      await page.locator(child+' .modal-footer button').filter({hasText:/BACK/i}).click();
      await page.waitForFunction(()=>/152 XP/.test(document.querySelector('.pp-progression')?.textContent||''), null, {timeout:2000});
      check('native Retry Back updates the same hub to its actual fresh selected value', await page.evaluate(()=>
        /LV 2/.test(document.querySelector('.pp-progression')?.textContent||'') &&
        !document.querySelector('.sq-player-stats-content') && __sc043Reads.v_player_xp===4
      ));
      await closeAll(page);
    }
    const unexpected=consoleErrs.filter(e=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e) && !/^syncSavedPlayersFromCloud failed.*TypeError: Load failed/i.test(e));
    check(width + ': no unexpected JavaScript errors', !unexpected.length, unexpected);
  } finally { await browser.close(); }
}
(async()=>{for(const width of [320,390,430]) await main(width); console.log('ALL PASS ('+checks+' checks)');})().catch(e=>{console.error(e);process.exit(1);});
