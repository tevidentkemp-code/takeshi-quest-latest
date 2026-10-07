// Actual Turbo setup, strict timer and score entry; all Supabase traffic blocked.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

async function isolate(ctx) {
  await ctx.route('**.supabase.co/rest/v1/**', route => {
    const u = new URL(route.request().url()), table = u.pathname.split('/').pop();
    const select = u.searchParams.get('select'), limit = u.searchParams.get('limit');
    const record = ['high_scores', 'high_scores_sp'].includes(table);
    if (route.request().method() === 'GET' && (
      (table === 'v_player_game_scores_official_clean' && select === 'game_id,ts,player_index,player_name,score' && limit === '260') ||
      (record && select === 'player_id,name,score,ts,game_id' && limit === '1')
    )) return route.fulfill({status:200, contentType:'application/json', body:'[]'});
    if (route.request().method() === 'HEAD' && record && select === 'game_id' && limit === '1') return route.fulfill({status:503, body:''});
    return route.abort('failed');
  });
}

async function readPresentation(page) {
  return page.evaluate(() => {
    const css = (selector, pseudo) => {
      const e = document.querySelector(selector), s = getComputedStyle(e, pseudo);
      return {border:s.borderColor, background:s.backgroundImage, fill:s.backgroundColor, color:s.color, animation:s.animationName, transition:s.transitionDuration, overflow:s.overflow};
    };
    const panel = document.getElementById('liveV2Panel'), p = getComputedStyle(panel, '::before');
    const r = panel.getBoundingClientRect(), dmd = document.querySelector('.sq-dmd').getBoundingClientRect();
    const boxes = [...panel.querySelectorAll('.v2ScoreBox')].map(e => {
      const rect = e.getBoundingClientRect();
      return {left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom};
    });
    return {
      active:css('#liveV2Panel .v2ScoreBox.active'), badge:css('#v2Rows .v2Badge.liveRow'),
      cell:css('#v2Rows .v2Cell.active'), dmd:css('.sq-dmd'),
      single:css('#pad [data-score-label="Single"]'), double:css('#pad [data-score-label="Double"]'), treble:css('#pad [data-score-label="Treble"]'),
      label:{text:p.content, top:r.top + parseFloat(p.top), bottom:r.top + parseFloat(p.top) + parseFloat(p.height)},
      dmdBottom:dmd.bottom, boxes, overflow:document.documentElement.scrollWidth > innerWidth + 1,
      players:state.players.map(p=>({id:p.id,name:p.name,color:p.color})),
      round:state.currentRound, dart:state.currentDart, timer:window.__sqTurboTimerStatus?.(),
    };
  });
}

async function runTurbo(count) {
  const {browser,ctx,page,consoleErrs} = await H.launch({width:390,height:844});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  try {
    await isolate(ctx); await H.boot(page,{settle:1000});
    await page.click('#startGameBtn'); await page.click('#questBtn'); await page.click('#matchTurboBtn');
    await H.addGuests(page, Array.from({length:count},(_,i)=>'QA TURBO '+String.fromCharCode(65+i)));
    await H.startMatch(page);
    assert(await page.locator('.sq-turbo-ready-start').isVisible(), 'Existing Turbo ready gate is retained');
    await page.locator('.sq-turbo-ready-start').click();
    await page.waitForFunction(()=>__sqTurboTimerStatus().active && document.querySelector('#liveV2Panel .v2ScoreBox.active .sqTurboSvg'));
    const snapshots=[];
    for (const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#liveV2Panel .v2ScoreBox.active')).borderColor === 'rgba(0, 245, 255, 0.72)');
      const s=await readPresentation(page); snapshots.push({width,...s});
      assert.equal(s.active.border,'rgba(0, 245, 255, 0.72)', 'Turbo active card remains cyan after shared styling');
      assert.equal(s.active.overflow,'visible', 'Turbo timer perimeter is not clipped by the shared player-card skin');
      assert.equal(s.badge.border,'rgba(0, 245, 255, 0.58)', 'Turbo target badge remains cyan');
      assert.equal(s.cell.border,'rgba(0, 245, 255, 0.58)', 'Turbo current cell remains cyan');
      assert.equal(s.dmd.border,'rgba(0, 245, 255, 0.35)', 'Current DMD bezel uses the existing blue palette');
      assert.notEqual(s.single.fill,s.double.fill,'Single/Double hit-category colours remain distinct');
      assert.notEqual(s.double.fill,s.treble.fill,'Double/Treble hit-category colours remain distinct');
      assert.equal(s.label.text,'"TURBO"');
      assert(s.label.top >= s.dmdBottom - 1, 'Turbo label does not overlap the DMD');
      assert(s.boxes.every(b=>b.top >= s.label.bottom - 1), 'Turbo label does not obscure a player initial');
      assert(s.boxes.every(b=>b.left >= -1 && b.right <= width + 1), 'Every player card stays within the viewport');
      assert.equal(s.overflow,false); assert.equal(s.round,7); assert.equal(s.dart,0); assert(s.timer.active);
      if(process.env.SQ_SCREENSHOTS){fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`sc067-${count}p-${width}.png`)});}
    }
    const before=snapshots.at(-1), timerKey=before.timer.timer.key;
    await page.locator('#pad [data-score-label="Single"]').click();
    await page.waitForFunction(()=>state.currentDart === 1);
    await page.waitForFunction(()=>document.getElementById('v2Mini3R0').textContent === '51' && document.getElementById('v2MiniMtc0').textContent === '51');
    let scored=await page.evaluate(()=>({points:state.score[0][7].darts[0].points,gav:document.getElementById('v2Mini3R0').textContent,mav:document.getElementById('v2MiniMtc0').textContent,timer:__sqTurboTimerStatus()}));
    assert.equal(scored.points,17);assert.equal(scored.gav,'51');assert.equal(scored.mav,'51');
    assert.equal(scored.timer.timer.key,timerKey,'Presentation does not restart the per-visit timer');
    await page.locator('#pad .dtActBtn.miss').click(); await page.waitForFunction(()=>state.currentDart===2);
    await page.waitForFunction(()=>document.getElementById('v2Mini3R0').textContent === '25.5');
    assert.equal(await page.locator('#v2Mini3R0').textContent(),'25.5');
    await page.locator('#pad .dtActBtn.undo').click(); await page.waitForFunction(()=>state.currentDart===1);
    await page.waitForFunction(()=>document.getElementById('v2Mini3R0').textContent === '51');
    assert.equal(await page.locator('#v2Mini3R0').textContent(),'51');
    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced=await readPresentation(page);
    assert.equal(reduced.active.transition,'0s','Restored card transitions respect reduced motion');
    assert.deepEqual(reduced.players,before.players,'Blue styling never changes participant identity colours');
    if(count===2){
      await page.waitForFunction(()=>document.querySelector('#liveV2Panel .v2ScoreBox.active.sqTurboWarn'),null,{timeout:15000});
      assert.equal(await page.locator('#liveV2Panel .sqTurboProgress').first().evaluate(e=>getComputedStyle(e).stroke),'rgb(255, 34, 42)','Canonical warning remains red');
      await page.waitForFunction(()=>document.querySelector('#liveV2Panel .v2ScoreBox.active.sqTurboDanger'),null,{timeout:9000});
      assert.equal(await page.locator('#liveV2Panel .sqTurboProgress').first().evaluate(e=>getComputedStyle(e).stroke),'rgb(255, 34, 42)','Canonical danger remains red');
    }
    assert.deepEqual(pageErrors,[], 'No uncaught runtime errors');
    const expectedBlockedRead = /TypeError: Load failed/.test.bind(/TypeError: Load failed/);
    assert.deepEqual(consoleErrs.filter(e=>!(/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|connect-src/i.test(e)) &&
      !(expectedBlockedRead(e) && /syncSavedPlayersFromCloud failed|__fetchOfficialGames failed|task failed: v2_pbwr_snapshot_refresh/.test(e))),[]);
    console.log(`PASS SC-067 real Turbo ${count}P320/390/430 blue identity/labels/scoring/Miss/Undo/strict timer/identity/reduced motion`);
  } finally {await browser.close();}
}

async function classicIsolation() {
  const {browser,ctx,page}=await H.launch({width:390,height:844});
  try {
    await isolate(ctx);await H.boot(page,{settle:1000});await H.toMatchCard(page);await H.addGuests(page,['QA CLASSIC A','QA CLASSIC B']);await H.startMatch(page);
    const s=await readPresentation(page);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('sq-mode-turbo')),false);
    assert.equal(s.active.border,'rgba(255, 149, 0, 0.78)','Classic keeps its released amber active card');
    assert.equal(s.active.overflow,'hidden','Classic keeps its released card clipping outside Turbo timer state');
    assert.notEqual(s.badge.border,'rgba(0, 245, 255, 0.58)');
    assert.notEqual(s.label.text,'"TURBO"');
    console.log('PASS SC-067 actual Classic isolation');
  } finally {await browser.close();}
}
(async()=>{await runTurbo(2);await runTurbo(5);await classicIsolation();})().catch(e=>{console.error(e);process.exit(1);});
