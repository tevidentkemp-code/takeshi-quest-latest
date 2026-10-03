// VIS-002: real modal controls and geometry with deterministic offline sources.
// Every production request is blocked by the shared harness. Fixture values are
// deliberately distinctive; CSS must preserve source rank gaps and eligibility.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const L = require('./league-fixture');
const P = require('./pstats-fixture');
let checks = 0;
const check = (name, ok, detail) => { assert.ok(ok, name + (detail ? ': ' + JSON.stringify(detail) : '')); checks++; console.log('PASS ' + name); };
const shots = process.env.SQ_SCREENSHOTS || 'output/playwright/vis002';
fs.mkdirSync(shots, {recursive:true});
const longName = 'Alexandria Montgomery The Unhurried Dart Thrower';
const fixture = JSON.parse(JSON.stringify(L.FIXTURE));
fixture.views.v_power_rankings_official_current_clean[0].rank_pos = 3;
fixture.views.v_power_rankings_official_current_clean[1].rank_pos = 5;
fixture.views.v_power_rankings_official_current_clean[2].rank_pos = 6;
fixture.views.v_power_rankings_official_current_clean[3].rank_pos = 9;
fixture.views.v_power_rankings_official_current_clean[2].player = longName;
fixture.views.v_power_rankings_official_current_clean[2].player_key = longName.toLowerCase();
fixture.players.push({name:longName});
for (let i=0; i<24; i++) {
  const name = 'League Fixture ' + String(i+1).padStart(2,'0');
  fixture.players.push({name});
  fixture.games.push({players:[name,'Sam T'], totals:[87+i,110], ts:new Date(Date.now()-86400000).toISOString()});
}
for (const mode of ['turbo','practice']) {
  fixture.views['v_power_rankings_last56_'+mode+'_clean'] = [{...fixture.views.v_power_rankings_official_current_clean[2], rank_pos:8}];
}
const surfaces = [
  ['powerRankingsBtn','.sq132-bd','power','.pw-row','v_power_rankings_official_current_clean'],
  ['premierLeagueBtn','.sq136-pl-bd','premier','.pl-row',null],
  ['highScoreLeagueBtn','.sq-hs-league-backdrop','high-score','.hs-row','v_high_score_league_official_from_games_clean'],
  ['streakLeagueBtn','.sq-streak-league-backdrop','streak','.sk-row','v_player_target_streaks'],
  ['leagueRoundHighScoresBtn','.sq-rhs-fix97-backdrop','round-high','.rh-rec','v_round_high_scores_official_clean_app'],
  ['leagueTop50ScoresBtn','.sq-fix166-top50','top50','.t5-row','v_top50_scores_official'],
  ['leagueLatestScoresBtn','.sq-latest-scores-backdrop','latest','.ls-card','v_player_game_scores_official_clean'],
];
async function install(page, state='healthy') {
  await page.evaluate(({FX,state}) => {
    window.__vis002State=state; window.__vis002Reads=[];
    const qFor = table => {
      const filters=[]; let start=0, end=Infinity;
      const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},ilike(){return q;},or(){return q;},order(){return q;},limit(){return q;},range(a,b){start=a;end=b;return q;},
        then(resolve){
          __vis002Reads.push({table,filters});
          let rows = state==='empty' ? [] : (FX.views[table] || []);
          filters.forEach(([k,v])=>{rows=rows.filter(r=>String(r[k])===String(v));});
          resolve(state==='failed' ? {data:null,error:{code:'57014',message:'fixture source unavailable'}} : {data:rows.slice(start,end+1).map(r=>({...r})),error:null});
        },catch(){return q;}};
      return q;
    };
    window.sb=window.__sb={from:qFor};
    window.cloudListPlayers=async()=>FX.players.map(p=>({...p}));
    window.cloudFetchAllGamesAsLocal=async()=>state==='healthy' ? FX.games.map(g=>({...g})) : [];
    window.__sqGetAllGamesNormalized=undefined;
    window.getGamesForMode=async()=>state==='failed' ? new Promise(()=>{}) : (state==='empty' ? [] : FX.games.map(g=>({...g})));
    // Trigger only Premier's existing cloud-timeout branch immediately; its
    // source catches rejected reads, so an unresolved read is the actual seam.
    window.__vis002Timeout ||= window.__sqWithCloudTimeout;
    window.__sqWithCloudTimeout=(promise,ms,label)=>state==='failed' && label==='premier-league'
      ? Promise.reject(new Error('fixture source unavailable')) : window.__vis002Timeout(promise,ms,label);
    window.__sqInvalidatePowerOfficialFetchCache?.('VIS002 fixture');
  }, {FX:fixture,state});
}
async function geometry(page, selector, label) {
  const g = await page.locator(selector).evaluate(root => {
    const modal=root.matches('.modal') ? root : root.querySelector('.modal');
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const buttons=[...modal.querySelectorAll('button')].filter(visible);
    const spills=[modal,...modal.querySelectorAll('*')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>({class:e.className,...box(e)}));
    return {box:box(modal),viewport:innerWidth,buttons:buttons.map(e=>({text:(e.getAttribute('aria-label')||e.textContent).trim(),...box(e)})),spills};
  });
  check(label+' controls meet 44px touch size', g.buttons.every(b=>b.width>=43.99&&b.height>=43.99), g.buttons);
  check(label+' stays inside the mobile viewport', !g.spills.length, g.spills);
  return g;
}
async function visibleDialogs(page) {
  return page.evaluate(()=>[...document.querySelectorAll('.modal')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}).length);
}
async function open(page, entry, selector) {
  await page.evaluate(()=>openLeagueRankingsDialog());
  await page.locator('#'+entry).click();
  await page.waitForSelector(selector+' .modal');
  await page.waitForFunction(s=>!document.querySelector(s+' .sq-modal-loading'), selector);
}
async function close(page, selector) {
  await page.locator(selector+' button').filter({hasText:/^Close$/i}).last().click();
  check('Close leaves no visible dialog', await visibleDialogs(page)===0);
}
async function main(width) {
  const {browser,ctx,page}=await H.launch({width,height:844});
  const pageErrors=[]; page.on('pageerror',e=>pageErrors.push(String(e)));
  try {
    await ctx.route('**.supabase.co/rest/v1/**', route=>{
      const u=new URL(route.request().url()), table=u.pathname.split('/').pop(), method=route.request().method();
      const select=u.searchParams.get('select'), limit=u.searchParams.get('limit');
      if(method==='GET' && ((table==='v_player_game_scores_official_clean'&&select==='game_id,ts,player_index,player_name,score'&&limit==='260') || (['high_scores','high_scores_sp'].includes(table)&&select==='player_id,name,score,ts,game_id'&&limit==='1'))) return route.fulfill({status:200,contentType:'application/json',body:'[]'});
      if(method==='HEAD'&&['high_scores','high_scores_sp'].includes(table)&&select==='game_id'&&limit==='1')return route.fulfill({status:503,body:''});
      return route.abort('failed');
    });
    await H.boot(page,{settle:500}); await page.emulateMedia({reducedMotion:'reduce'});
    await install(page);
    await page.locator('#leagueRankingsBtn').click();
    await geometry(page,'.sq-league-rankings-backdrop',width+' League menu');
    const subtitles=await page.locator('.sq-league-rankings-backdrop .menu-row-desc').evaluateAll(nodes=>nodes.map(e=>({scroll:e.scrollWidth,client:e.clientWidth})));
    check(width+' League descriptions wrap inside their cards',subtitles.every(e=>e.scroll<=e.client+1),subtitles);
    await page.locator('.sq-league-rankings-backdrop [aria-label=Close]').click();
    check(width+' menu Close hides dialogs despite hidden static nodes',await visibleDialogs(page)===0);

    // Repeated real menu visits activate the older delayed document-wide wiring.
    // The detail Turbo tabs must remain with their own modal and fetch path.
    for(let visit=0;visit<3;visit++){
      await page.locator('#leagueRankingsBtn').click();
      await page.locator('#powerRankingsBtn').click();
      await page.locator('.sq132-bd .sq132-close').click();
    }

    for (const [entry,selector,name,rows,source] of surfaces) {
      await open(page,entry,selector);
      check(width+' '+name+' renders populated fixture',await page.locator(selector+' '+rows).count()>0);
      await geometry(page,selector,width+' '+name);
      if(source)check(width+' '+name+' retains its established source',await page.evaluate(s=>__vis002Reads.some(r=>r.table===s),source));
      if(name==='power'){
        const ranks=await page.locator(selector+' .pw-row:not(.benched) .pw-rank').allTextContents();
        check(width+' Power retains source rank gaps',JSON.stringify(ranks.slice(0,3))===JSON.stringify(['#3','#5','#6']),ranks);
        const long=await page.locator(selector+' .pw-row-name').filter({hasText:longName}).evaluate(e=>({text:e.textContent,scroll:e.scrollWidth,client:e.clientWidth,height:e.getBoundingClientRect().height}));
        check(width+' Power shows full long name without chip squeeze',long.text===longName&&long.scroll<=long.client+1,long);
      }
      const modes=await page.locator(selector+' [data-mode]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mode));
      for(const mode of modes){
        await page.waitForTimeout(120); // allow the existing 80ms wiring callback
        await page.locator(selector+' [data-mode="'+mode+'"]').click();
        check(width+' '+name+' '+mode+' stays in its own dialog after repeated menus',await page.locator(selector).count()===1);
        await page.waitForFunction(s=>document.querySelector(s)&&!document.querySelector(s+' .sq-modal-loading'),selector);
        await geometry(page,selector,width+' '+name+' '+mode);
        check(width+' '+name+' '+mode+' selected state retained',await page.locator(selector+' [data-mode="'+mode+'"].active').count()===1);
      }
      if(name==='streak'){
        await page.locator(selector+' [data-mode=official]').click();
        await page.locator(selector+' [data-metric=round]').click();
        await page.waitForFunction(()=>document.querySelector('.sq-streak-league-backdrop .sk-row'));
        check(width+' Streak metric stays selectable',await page.locator(selector+' [data-metric=round].active').count()===1);
      }
      if(name==='premier'){
        const filters=await page.locator(selector+' [data-filter-id]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.filterId,text:n.textContent})));
        for(const f of filters){await page.locator(selector+' [data-filter-id="'+f.id+'"]').click();check(width+' Premier filter '+f.text+' remains selectable',await page.locator(selector+' [data-filter-id="'+f.id+'"].active').count()===1);}
        await page.getByRole('button',{name:'All Time',exact:true}).click();
        const pl=await page.locator(selector).evaluate(bd=>{
          const a=bd.querySelector('.pl-arena'),f=bd.querySelector('.sq136-pl-footer'),nav=()=>[...f.querySelectorAll('button')].map(e=>e.getBoundingClientRect().top),before=nav();a.scrollTop=a.scrollHeight;
          return {note:bd.querySelector('.sq136-pl-note').textContent,arenaBottom:a.getBoundingClientRect().bottom,footerTop:f.getBoundingClientRect().top,lastBottom:a.lastElementChild.getBoundingClientRect().bottom,scrollTop:a.scrollTop,navBefore:before,navAfter:nav(),rows:[...a.querySelectorAll('.pl-row.unq')].map(row=>{const main=row.querySelector('.pl-main').getBoundingClientRect(),side=row.querySelector('.pl-side').getBoundingClientRect(),sub=row.querySelector('.pl-sub').getBoundingClientRect(),dots=row.querySelector('.pl-dots').getBoundingClientRect(),label=row.querySelector('.pl-sub>span:last-child').getBoundingClientRect();return {mainRight:main.right,sideLeft:side.left,subRight:sub.right,dotsRight:dots.right,labelRight:label.right};})};
        });
        check(width+' Premier preserves All Time eligibility copy',/15 Games Minimum/.test(pl.note),pl.note);
        check(width+' Premier final row remains above its fixed navigation',pl.scrollTop>0&&pl.lastBottom<=pl.arenaBottom+1&&pl.arenaBottom<=pl.footerTop&&JSON.stringify(pl.navBefore)===JSON.stringify(pl.navAfter),pl);
        check(width+' Premier qualification text stays clear of BEST values',pl.rows.length>10&&pl.rows.every(r=>r.subRight<r.sideLeft&&r.dotsRight<=r.mainRight+1&&r.labelRight<=r.mainRight+1),pl.rows);
      }
      await page.screenshot({path:path.join(shots,`${width}-${name}.png`)});
      await page.locator(selector+' button').filter({hasText:/^Back$/i}).last().click();
      check(width+' '+name+' Back returns one visible League menu',await page.locator('.sq-league-rankings-backdrop #powerRankingsBtn').isVisible()&&await visibleDialogs(page)===1);
      await page.locator('.sq-league-rankings-backdrop [aria-label=Close]').click();
      check(width+' '+name+' menu Close leaves no visible dialogs',await visibleDialogs(page)===0);
      // Verify the detail Close destination independently of Back.
      await open(page,entry,selector); await close(page,selector);
    }
    for(const state of ['empty','failed']){
      await install(page,state);
      for(const [entry,selector,name,rows] of surfaces){
        await open(page,entry,selector);
        check(width+' '+name+' '+state+' renders no invented ranking rows',await page.locator(selector+' '+rows).count()===0);
        const text=await page.locator(selector).innerText();
        check(width+' '+name+' '+state+' keeps an honest source status',/no |not available|missing|empty|unclaimed|unable|unavailable|could not|failed/i.test(text),text);
        await geometry(page,selector,width+' '+name+' '+state); await close(page,selector);
      }
    }
    await P.install(page);
    await page.evaluate(()=>{SQ_XP._oneCache.clear();SQ_XP._oneInflight.clear();SQ_XP._oneAvailable.clear();openPlayerStatsHub('Alex S');});
    await page.waitForFunction(()=>document.querySelector('.pp-tile-value')?.textContent==='8.75 (#3)');
    const healthy=await page.locator('.pp-tiles').evaluate(e=>({columns:getComputedStyle(e).gridTemplateColumns.split(' ').length,values:[...e.querySelectorAll('.pp-tile-value')].map(x=>x.textContent)}));
    check(width+' Stats healthy three-tile layout and values remain unchanged',healthy.columns===3&&JSON.stringify(healthy.values)===JSON.stringify(['8.75 (#3)','5','126.0']),healthy);
    await geometry(page,'.sq-player-stats-hub',width+' Stats healthy');
    await page.locator('.sq-player-stats-hub [aria-label=Close]').click();
    await page.evaluate(()=>{
      const from=window.sb.from.bind(window.sb);
      window.sb=window.__sb={from(table){if(table!=='v_player_game_scores_official_clean')return from(table);const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},range(){return q;},then(resolve){resolve({data:null,error:{code:'57014',message:'fixture source unavailable'}});}};return q;}};
      openPlayerStatsHub('Alex S');
    });
    await page.getByRole('button',{name:'Retry rank',exact:true}).waitFor();
    const unavailable=await page.locator('.sq-player-stats-hub .pp-tile-value[data-source-state=unavailable]').evaluate(e=>({text:e.textContent,size:parseFloat(getComputedStyle(e).fontSize),wrap:getComputedStyle(e).whiteSpace,scroll:e.scrollWidth,client:e.clientWidth,columns:getComputedStyle(e.closest('.pp-tiles')).gridTemplateColumns.split(' ').length}));
    check(width+' Unavailable stays readable and contained without changing copy',unavailable.text==='Unavailable'&&unavailable.size>=12&&unavailable.wrap==='nowrap'&&unavailable.scroll<=unavailable.client+1,unavailable);
    check(width+' unavailable layout follows the accepted narrow-only reflow',unavailable.columns===(width<=390?2:3),unavailable);
    await geometry(page,'.sq-player-stats-hub',width+' Stats unavailable');
    await page.screenshot({path:path.join(shots,`${width}-stats-unavailable.png`)});
    await page.locator('.sq-player-stats-hub [aria-label=Back]').click();
    check(width+' Stats Back returns its visible player directory',await page.locator('.sq-player-stats-directory').isVisible()&&await visibleDialogs(page)===1);
    await page.locator('.sq-player-stats-directory [aria-label=Close]').click();
    check(width+' Stats Close leaves zero visible dialogs',await visibleDialogs(page)===0);
    check(width+' no unexpected JavaScript page errors',!pageErrors.length,pageErrors);
  } finally {await browser.close();}
}
(async()=>{for(const width of [320,390,430])await main(width);console.log('ALL PASS ('+checks+' checks)');})().catch(e=>{console.error(e);process.exit(1);});
