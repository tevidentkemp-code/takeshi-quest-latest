// Real UI journeys, with all production data traffic blocked by the harness.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const GAME_STORAGE_KEY = 'shateki_quest_scorer_v6';
const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

async function installRacePacketCapture(page){
  await page.evaluate(() => {
    const original = window.__sqDrawArcadeRace;
    if (typeof original !== 'function') throw new Error('Race renderer unavailable');
    window.__sc021RacePackets = [];
    window.__sqDrawArcadeRace = function(canvas, packet, st, now){
      if (packet){
        const currentState = (typeof state !== 'undefined' && state) ? state : (window.state || {});
        const match = currentState.match || {};
        const packets = window.__sc021RacePackets;
        packets.push({
          classicThrowRace: packet.classicThrowRace === true,
          mode: currentState.mode ?? null,
          gameMode: currentState.gameMode ?? null,
          game_mode: currentState.game_mode ?? null,
          matchMode: match.mode ?? null,
          matchGameMode: match.gameMode ?? null,
          matchGame_mode: match.game_mode ?? null,
          forcePractice: match.forcePractice === true,
          practiceType: match.practiceType ?? null,
          shadowRuntime: (typeof __sqIsVsShadowRuntime === 'function') ? __sqIsVsShadowRuntime() : false
        });
        if (packets.length > 24) packets.shift();
      }
      return original.apply(this, arguments);
    };
  });
}

async function clearRacePackets(page){
  await page.evaluate(() => { window.__sc021RacePackets = []; });
}

async function waitForRacePacket(page, classicThrowRace, markers = {}){
  await page.waitForFunction(({ expected, markers }) => {
    return Array.isArray(window.__sc021RacePackets) && window.__sc021RacePackets.some(packet =>
      packet.classicThrowRace === expected && Object.entries(markers).every(([key, value]) => packet[key] === value)
    );
  }, { expected: classicThrowRace, markers });
  return page.evaluate(({ expected, markers }) => {
    return window.__sc021RacePackets.slice().reverse().find(packet =>
      packet.classicThrowRace === expected && Object.entries(markers).every(([key, value]) => packet[key] === value)
    );
  }, { expected: classicThrowRace, markers });
}

function assertNoUnexpectedErrors(consoleErrs, label){
  const unexpected = consoleErrs.filter(error => !BROWSER_NOISE.test(error));
  assert.deepEqual(unexpected, [], `${label}: ${unexpected.join('\n')}`);
}

async function waitForV2Shots(page, expected){
  await page.waitForFunction(expectedTokens => {
    const actual = [...document.querySelectorAll('#liveV2Panel .v2Dot')]
      .map(slot => `${slot.dataset.shotState || ''}:${String(slot.textContent || '').trim()}`);
    return actual.length === expectedTokens.length && actual.every((token, i) => token === expectedTokens[i]);
  }, expected);
  return page.evaluate(() => [...document.querySelectorAll('#liveV2Panel .v2Dot')].map(slot => ({
    state: slot.dataset.shotState || '',
    mark: String(slot.textContent || '').trim(),
    classes: [...slot.classList]
  })));
}

async function verifySc022HudPolish(){
  const {browser, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['HUD ALPHA', 'HUD BETA']);
    await H.startMatch(page);

    let shots = await waitForV2Shots(page, ['next:', 'idle:', 'idle:']);
    assert(shots[0].classes.includes('next'), 'first shot position starts active');
    assert.equal(await page.locator('#liveV2Panel .v2Dot.next').evaluate(slot => getComputedStyle(slot).animationName), 'v3SlotNext', 'current shot reuses the Beta pulse');

    for (const size of [{width:390,height:844},{width:320,height:844}]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(900);
      const layout = await page.evaluate(() => {
        const rect = el => el && el.getBoundingClientRect();
        const centre = r => ({x:r.left+r.width/2,y:r.top+r.height/2});
        const panel = rect(document.getElementById('liveV2Panel'));
        const pad = rect(document.getElementById('padBar'));
        const scoreGrid = rect(document.querySelector('#liveV2Panel .v2ScoreGrid'));
        const shotRects = [...document.querySelectorAll('#liveV2Panel .v2Dot')].map(rect);
        const shotGroupCentre = (Math.min(...shotRects.map(r => r.top)) + Math.max(...shotRects.map(r => r.bottom))) / 2;
        const mini = document.querySelector('#liveV2Panel .v2MiniAvg[data-p="0"]');
        const metrics = [...mini.querySelectorAll('.v2MiniMetric')].map(metric => {
          const mr=rect(metric), lr=rect(metric.querySelector('.v2MiniLab')), vr=rect(metric.querySelector('strong'));
          return {
            width:mr.width,
            direction:getComputedStyle(metric).flexDirection,
            labelAbove:lr.bottom <= vr.top + .5,
            centred:Math.abs(centre(lr).x-centre(vr).x) <= 1
          };
        });
        const actions = ['miss','undo','skip'].map(name => {
          const button = document.querySelector(`#pad .dtActBtn.${name}`);
          const br=rect(button), ir=rect(button.querySelector('.dtIcon')), lr=rect(button.querySelector('.dtLbl'));
          return {
            name,
            icon:String(button.querySelector('.dtIcon').textContent || '').trim(),
            direction:getComputedStyle(button).flexDirection,
            vertical:ir.bottom <= lr.top + .5,
            centred:Math.abs(centre(br).x-centre(ir).x) <= 1.5 && Math.abs(centre(br).x-centre(lr).x) <= 1.5,
            fits:br.width >= 43.9 && br.height >= 43.9 && ir.left >= br.left && ir.right <= br.right && lr.left >= br.left && lr.right <= br.right
          };
        });
        return {
          overflow:document.documentElement.scrollWidth > innerWidth + 1,
          padFits:pad.left >= -.5 && pad.right <= innerWidth + .5 && pad.top >= -.5 && pad.bottom <= innerHeight + .5,
          panelPadGap:pad.top-panel.bottom,
          shotCentreDelta:Math.abs(shotGroupCentre-centre(scoreGrid).y),
          miniHeight:rect(mini).height,
          equalMetricWidths:Math.abs(metrics[0].width-metrics[1].width) <= 1,
          metrics,
          actions
        };
      });
      assert(!layout.overflow, `${size.width}px HUD has no horizontal overflow`);
      assert(layout.padFits, `${size.width}px throwpad stays inside the viewport`);
      assert(layout.panelPadGap >= 5, `${size.width}px live panel does not push into the throwpad`);
      assert(layout.shotCentreDelta <= 1.5, `${size.width}px shot track is vertically centred on player info`);
      assert(layout.miniHeight >= 47.5 && layout.miniHeight <= 49.5, `${size.width}px average strip keeps its 48px footprint`);
      assert(layout.equalMetricWidths, `${size.width}px average metrics keep equal widths`);
      assert(layout.metrics.every(metric => metric.direction === 'column' && metric.labelAbove && metric.centred), `${size.width}px 3AV/MAV labels stack above centred values`);
      assert.deepEqual(layout.actions.map(action => action.icon), ['⊘','◀◀','▶▶'], `${size.width}px action glyphs`);
      assert(layout.actions.every(action => action.direction === 'column' && action.vertical && action.centred && action.fits), `${size.width}px action icons stack above labels inside existing tap targets`);
      if (process.env.SQ_SCREENSHOTS) {
        fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`sc022-hud-${size.width}.png`)});
      }
    }
    await page.setViewportSize({width:390,height:844});

    await page.locator('#pad [data-score-label="Single"]').click();
    shots = await waitForV2Shots(page, ['done:S', 'next:', 'idle:']);
    assert(shots[0].classes.includes('single'), 'Dart 1 uses the Beta single-hit mapping');

    await page.locator('#pad [data-score-label="Double"]').click();
    shots = await waitForV2Shots(page, ['done:S', 'done:D', 'next:']);
    assert(shots[1].classes.includes('double'), 'Dart 2 uses the Beta double-hit mapping');

    await page.locator('#pad .dtActBtn.undo').click();
    await waitForV2Shots(page, ['done:S', 'next:', 'idle:']);
    await page.locator('#pad .dtActBtn.miss').click();
    shots = await waitForV2Shots(page, ['done:S', 'done:X', 'next:']);
    assert(shots[1].classes.includes('miss'), 'MISS uses the Beta miss mapping');
    await page.locator('#pad .dtActBtn.undo').click();
    await waitForV2Shots(page, ['done:S', 'next:', 'idle:']);

    await page.locator('#pad [data-score-label="Double"]').click();
    await waitForV2Shots(page, ['done:S', 'done:D', 'next:']);
    await page.locator('#pad [data-score-label="Treble"]').click();
    await page.waitForFunction(() => state.currentPlayer === 1 && state.currentRound === 0 && state.currentDart === 0);
    shots = await waitForV2Shots(page, ['done:S', 'done:D', 'done:T']);
    assert(shots[2].classes.includes('treble'), 'Dart 3 uses the Beta treble-hit mapping');
    const liveAverages = await page.evaluate(() => {
      const pair = __sqV2LiveAveragePair(0, state.currentRound);
      return {expected3:__sqFmtAvg(pair.r3), expectedMatch:__sqFmtAvg(pair.mtc), actual3:document.getElementById('v2Mini3R0').textContent, actualMatch:document.getElementById('v2MiniMtc0').textContent};
    });
    assert.notEqual(liveAverages.actual3, '–', '3AV updates after a completed round');
    assert.equal(liveAverages.actual3, liveAverages.expected3, '3AV display keeps the existing calculation');
    assert.equal(liveAverages.actualMatch, liveAverages.expectedMatch, 'MAV display keeps the existing calculation');
    await page.waitForTimeout(1150);
    await waitForV2Shots(page, ['next:', 'idle:', 'idle:']);

    await page.locator('#pad .dtActBtn.miss').click();
    await waitForV2Shots(page, ['done:X', 'next:', 'idle:']);
    await page.locator('#pad .dtX3').click();
    await page.waitForFunction(() => state.currentPlayer === 0 && state.currentRound === 1 && state.currentDart === 0);
    await waitForV2Shots(page, ['done:X', 'done:X', 'done:X']);
    await page.waitForTimeout(1150);
    await waitForV2Shots(page, ['next:', 'idle:', 'idle:']);

    await page.locator('#pad .dtActBtn.skip').click();
    await page.waitForFunction(() => state.currentPlayer === 1 && state.currentRound === 1 && state.currentDart === 0);
    await waitForV2Shots(page, ['done:X', 'done:X', 'done:X']);
    await page.locator('#pad .dtActBtn.undo').click();
    await page.waitForFunction(() => state.currentPlayer === 0 && state.currentRound === 1 && state.currentDart === 2);
    await waitForV2Shots(page, ['done:X', 'done:X', 'next:']);

    assertNoUnexpectedErrors(consoleErrs, 'SC-022 HUD polish');
    console.log('PASS SC-022 stacked averages / action controls / shot state, reset and Undo');
  } finally { await browser.close(); }
}

async function startNewRaceGame(page, mode){
  await page.click('#startGameBtn'); await page.waitForTimeout(400);
  await page.click(mode === 'practice' ? '#practiceBtn' : '#questBtn'); await page.waitForTimeout(400);
  await page.click(mode === 'practice' ? '#practiceClassicBtn' : '#matchTurboBtn'); await page.waitForTimeout(700);
  await H.addGuests(page, ['QA ALPHA', 'QA BETA']);
  await H.startMatch(page);
}

async function verifyNewRaceRoute(mode, expected){
  const {browser, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await H.boot(page);
    await installRacePacketCapture(page);
    await startNewRaceGame(page, mode);
    const packet = await waitForRacePacket(page, expected, {matchMode:mode});
    assert.equal(packet.classicThrowRace, expected, `${mode} new-game routing`);
    assertNoUnexpectedErrors(consoleErrs, `${mode} new-game routing`);
    const savedState = await page.evaluate(key => localStorage.getItem(key), GAME_STORAGE_KEY);
    assert(savedState, `${mode} new game writes a resumable cache`);
    console.log(`PASS SC-021 new-game ${mode} routes classicThrowRace=${expected}`);
    return savedState;
  } finally { await browser.close(); }
}

async function verifyResumedRaceRoute(label, savedState, expected){
  const {browser, ctx, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await ctx.addInitScript(({key, value}) => localStorage.setItem(key, value), {key:GAME_STORAGE_KEY, value:savedState});
    await H.boot(page);
    await installRacePacketCapture(page);
    assert(await page.isVisible('#resumeBtn'), `${label}: Resume Game is visible`);
    await page.click('#resumeBtn');
    await page.waitForFunction(() => document.body.dataset.page === 'game');
    const packet = await waitForRacePacket(page, expected);
    assert.equal(packet.classicThrowRace, expected, `${label} Resume routing`);
    assertNoUnexpectedErrors(consoleErrs, `${label} Resume routing`);
    console.log(`PASS SC-021 resumed ${label} routes classicThrowRace=${expected}`);
  } finally { await browser.close(); }
}

async function verifyVsShadowAndPracticeAliasRoutes(){
  const {browser, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await H.boot(page);
    await installRacePacketCapture(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['QA ALPHA', 'QA BETA']);
    await H.startMatch(page);
    await waitForRacePacket(page, true, {matchMode:'match'});

    await clearRacePackets(page);
    await page.evaluate(() => {
      state.match = Object.assign({}, state.match || {}, {mode:'match', forcePractice:false, practiceType:'vsShadow'});
      state.shadow = {mode:'vsShadow'};
      window.__sqV2InfoDmdUpdate();
    });
    await waitForRacePacket(page, false, {shadowRuntime:true, practiceType:'vsShadow'});
    console.log('PASS SC-021 Vs Shadow runtime helper routes classicThrowRace=false');

    for (const field of ['gameMode', 'game_mode']){
      await clearRacePackets(page);
      await page.evaluate(field => {
        delete state.shadow;
        state.match = Object.assign({}, state.match || {}, {mode:'match', forcePractice:false, practiceType:null});
        delete state.match.gameMode;
        delete state.match.game_mode;
        state.match[field] = 'practice';
        window.__sqV2InfoDmdUpdate();
      }, field);
      await waitForRacePacket(page, false, {[field === 'gameMode' ? 'matchGameMode' : 'matchGame_mode']:'practice'});
    }
    assertNoUnexpectedErrors(consoleErrs, 'Vs Shadow and Practice alias routing');
    console.log('PASS SC-021 match.gameMode and match.game_mode route classicThrowRace=false');
  } finally { await browser.close(); }
}

async function verifyTrainingRoute(){
  const {browser, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await H.boot(page);
    await installRacePacketCapture(page);
    await page.evaluate(() => {
      const makeQuery = () => {
        const base = {then:resolve => resolve({data:[], error:null}), catch(){ return query; }};
        const query = new Proxy(base, {get(target, property){ return property in target ? target[property] : () => query; }});
        return query;
      };
      const offlineSb = {from:() => makeQuery()};
      window.sb = offlineSb;
      window.__sb = offlineSb;
      const loadPlayers = async () => [{id:'qa-training', name:'QA TRAINER', nickname:'Route Fixture'}];
      window.__sqLoadPlayerStatsPlayers = loadPlayers;
      try{ __sqLoadPlayerStatsPlayers = loadPlayers; }catch(_){ }
    });
    await page.click('#startGameBtn'); await page.waitForTimeout(500);
    await page.click('#trainingBtn');
    const clickTrainingPill = label => page.evaluate(text => {
      const button = Array.from(document.querySelectorAll('#startGameModalBody .sg-tournament-pill'))
        .find(node => String(node.textContent || '').toUpperCase().includes(text));
      if (button) button.click();
      return !!button;
    }, label);
    await page.waitForFunction(() => /TRAINING/.test(document.querySelector('#startGameModalBody .sg-tournament-title')?.textContent || ''));
    assert(await clickTrainingPill('QA TRAINER'), 'Training player route available');
    await page.waitForFunction(() => /TRAINING MODE/.test(document.querySelector('#startGameModalBody .sg-tournament-title')?.textContent || ''));
    assert(await clickTrainingPill('STANDARD'), 'Training mode route available');
    await page.waitForFunction(() => /SESSION LENGTH/.test(document.querySelector('#startGameModalBody .sg-tournament-title')?.textContent || ''));
    assert(await clickTrainingPill('10 ROUNDS'), 'Training length route available');
    await page.waitForFunction(() => !!document.querySelector('.tr-overlay'));
    await page.waitForTimeout(300);
    const rendering = await page.evaluate(() => ({
      training: !!document.querySelector('.tr-overlay'),
      liveRaceVisible: !!document.querySelector('#liveV2Panel')?.offsetParent,
      packets: (window.__sc021RacePackets || []).length
    }));
    assert.deepEqual(rendering, {training:true, liveRaceVisible:false, packets:0}, 'Training stays on its separate renderer');
    assertNoUnexpectedErrors(consoleErrs, 'Training routing');
    console.log('PASS SC-021 Training stays on its separate rendering path');
  } finally { await browser.close(); }
}

(async () => {
  let classicSavedState = null;
  const {browser, page, consoleErrs} = await H.launch({width:390,height:844});
  try {
    await page.addInitScript(() => {
      window.__imageBounds = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(im,...a){
        if (this.canvas.width === 640 && this.canvas.height === 160 && im instanceof HTMLImageElement && a.length === 4) {
          window.__imageBounds.push(a);
        }
        return draw.call(this,im,...a);
      };
    });
    await H.boot(page);
    await installRacePacketCapture(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['QA ALPHA','QA BETA']);
    await H.startMatch(page);
    const classicRoute = await waitForRacePacket(page, true, {matchMode:'match'});
    assert.equal(classicRoute.classicThrowRace, true, 'two-player Classic with guests enables SC-021');
    console.log('PASS SC-021 new-game Classic with guests routes classicThrowRace=true');
    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(650);
    classicSavedState = await page.evaluate(key => localStorage.getItem(key), GAME_STORAGE_KEY);
    assert(classicSavedState, 'Classic game writes a resumable cache');
    assert(await page.locator('#liveV2Panel .v2Total').allTextContents().then(v=>v.some(x=>Number(x)>0)), 'score totals update');
    console.log('PASS score totals update after a real button press');
    assert.equal(await page.locator('#liveV2Panel .v2MiniAvg').count(), 2, 'one mini-average strip per player');
    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('3AV'), '3AV label present');
    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('MAV'), 'MAV label present');
    const avgAttachGap = await page.evaluate(() => {
      const score=document.querySelector('#liveV2Panel .v2ScoreBox[data-p="0"]')?.getBoundingClientRect();
      const avg=document.querySelector('#liveV2Panel .v2MiniAvg[data-p="0"]')?.getBoundingClientRect();
      return score&&avg ? Math.abs(avg.top-score.bottom) : 999;
    });
    assert(avgAttachGap<2,'mini-average strip attaches directly below player cell');
    const miniAv = await page.evaluate(async () => {
      const pIdx = 0;
      const beforeScores = structuredClone(state.score?.[pIdx] || []);
      const beforeRound = state.currentRound;
      const beforeDart = state.currentDart;
      try{
        state.score[pIdx] = [10,11,12,13].map(points => ({
          darts:[{kind:'S',points},{kind:'S',points},{kind:'S',points}],
          roundTotal:points*3
        }));
        state.currentRound = 3;
        state.currentDart = 3;
        const pair = __sqV2LiveAveragePair(pIdx, 3);
        liveV2Render();
        await new Promise(resolve => setTimeout(resolve, 140));
        return {
          pairR3: __sqFmtAvg(pair.r3),
          pairMtc: __sqFmtAvg(pair.mtc),
          r3: document.getElementById('v2Mini3R0')?.textContent || '',
          mtc: document.getElementById('v2MiniMtc0')?.textContent || ''
        };
      } finally {
        state.score[pIdx] = beforeScores;
        state.currentRound = beforeRound;
        state.currentDart = beforeDart;
        liveV2Render();
        await new Promise(resolve => setTimeout(resolve, 140));
      }
    });
    assert.equal(miniAv.pairR3, '36', '3R helper uses the latest three completed rounds');
    assert.equal(miniAv.pairMtc, '34.5', 'MTC helper uses every completed round');
    assert.notEqual(miniAv.pairR3, miniAv.pairMtc, '3AV and MAV fixtures remain independently testable');
    assert.equal(miniAv.r3, miniAv.pairR3, 'rendered 3AV matches helper');
    assert.equal(miniAv.mtc, miniAv.pairMtc, 'rendered MAV matches helper');
    console.log('PASS distinct 3AV / MAV values and compact strip');
    for (const size of [{width:390,height:844},{width:430,height:932},{width:320,height:568},{width:1366,height:936}]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(900);
      const fit = await page.evaluate(() => {
        const panel=document.getElementById('liveV2Panel').getBoundingClientRect();
        const pad=document.getElementById('padBar').getBoundingClientRect();
        const canvas=document.getElementById('v2InfoDmd');
        const host=canvas.parentElement.getBoundingClientRect();
        const mini=document.querySelector('#liveV2Panel .v2MiniAvg[data-p="0"]');
        const miniRect=mini?.getBoundingClientRect();
        const miniMetrics=[...document.querySelectorAll('#liveV2Panel .v2MiniMetric')];
        return {gap:pad.top-panel.bottom, height:host.height, width:host.width, canvasWidth:canvas.getBoundingClientRect().width, overflow:document.documentElement.scrollWidth>innerWidth+1, miniHeight:miniRect?.height||0, miniOverflow:miniMetrics.some(el=>el.scrollWidth>el.clientWidth+1)};
      });
      console.log('GEOMETRY', size, fit);
      assert(!fit.overflow, 'no horizontal overflow');
      assert(!fit.miniOverflow, '3AV / MAV metrics fit their rectangle width');
      assert(fit.miniHeight>=47.5 && fit.miniHeight<=49.5, 'mini-average rectangle is doubled from 24px to 48px');
      assert(Math.abs(fit.canvasWidth-fit.width)<2,'canvas fits actual host width');
      if (size.height>=800) assert(fit.gap>=5 && fit.gap<=18,'panel reaches fixed controls with clearance');
      assert(fit.height>=80,'graph retains readable height');
      if (process.env.SQ_SCREENSHOTS) {
        fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`classic-fit-${size.width}.png`)});
      }
    }
    // Use the shared visual renderer with synthetic fixtures, never database rows.
    const graph = await page.evaluate(() => {
      const c=document.createElement('canvas'); const host=document.createElement('div');
      host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
      const ctx=c.getContext('2d'); const dashed=[]; let dash=[]; let path=[];
      const setDash=ctx.setLineDash.bind(ctx), begin=ctx.beginPath.bind(ctx), move=ctx.moveTo.bind(ctx), line=ctx.lineTo.bind(ctx), stroke=ctx.stroke.bind(ctx);
      ctx.setLineDash=(v)=>{dash=Array.from(v||[]);return setDash(v);};
      ctx.beginPath=()=>{path=[];return begin();};
      ctx.moveTo=(x,y)=>{path.push([x,y]);return move(x,y);};
      ctx.lineTo=(x,y)=>{path.push([x,y]);return line(x,y);};
      ctx.stroke=()=>{if(dash.join(',')==='5,4'&&path.length)dashed.push(path.slice());return stroke();};
      const motion={grow:[],combo:[],burst:[],lastLen:[],lastFull:[],maxV:0};
      __sqDrawArcadeRace(c,{labels:Array.from({length:14},(_,i)=>String(i+10)),series:[{data:[10,...Array(13).fill(null)],color:'#7bdcff'}],record:{data:Array.from({length:14},(_,i)=>(i+1)*50)}},motion,performance.now());
      const recordPath=dashed.sort((a,b)=>b.length-a.length)[0]||[];
      const topY=19; const out={max:motion.maxV,last:recordPath[recordPath.length-1]||null,topHits:recordPath.filter(p=>Math.abs(p[1]-topY)<.75).length,pathLen:recordPath.length};
      host.remove();return out;
    });
    assert(graph.max<150,'early scores scale against played rounds, not full-game record');
    assert(graph.last&&Math.abs(graph.last[1]-19)<.75,'high-score reference terminates at chart ceiling');
    assert.equal(graph.topHits,1,'high-score reference hits the chart ceiling once without a horizontal plateau');
    assert(graph.pathLen<14,'off-scale high-score continuation is not drawn across later rounds');
    console.log('PASS local graph scale with clipped high-score reference');

    const sc021 = await page.evaluate(() => {
      function inspect(classicThrowRace){
        const c=document.createElement('canvas'); const host=document.createElement('div');
        host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
        const ctx=c.getContext('2d'), texts=[], strokes=[]; let dash=[], path=[];
        const setDash=ctx.setLineDash.bind(ctx), begin=ctx.beginPath.bind(ctx), move=ctx.moveTo.bind(ctx), line=ctx.lineTo.bind(ctx), stroke=ctx.stroke.bind(ctx), fillText=ctx.fillText.bind(ctx);
        ctx.setLineDash=(v)=>{dash=Array.from(v||[]);return setDash(v);};
        ctx.beginPath=()=>{path=[];return begin();};
        ctx.moveTo=(x,y)=>{path.push([x,y]);return move(x,y);};
        ctx.lineTo=(x,y)=>{path.push([x,y]);return line(x,y);};
        ctx.stroke=()=>{strokes.push({dash:dash.slice(),path:path.slice(),style:String(ctx.strokeStyle)});return stroke();};
        ctx.fillText=(t,x,y,...rest)=>{texts.push({text:String(t),x,y});return fillText(t,x,y,...rest);};
        const labels=['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
        const motion={grow:[],combo:[],burst:[],lastLen:[classicThrowRace?4:1],lastFull:[0],maxV:0};
        __sqDrawArcadeRace(c,{
          labels,offset:0,classicThrowRace,
          series:[{name:'QA',color:'#7bdcff',data:[30,...Array(13).fill(null)],throwData:[0,10,10,30],dotted:false}],
          record:{label:'HS',color:'rgba(255,214,110,.92)',data:Array.from({length:14},(_,i)=>(i+1)*50)}
        },motion,performance.now()+1000);
        const player=strokes.filter(s=>s.dash.join(',')==='1.5,3.5').sort((a,b)=>b.path.length-a.path.length)[0]||{path:[]};
        const record=strokes.filter(s=>s.dash.join(',')==='5,4'&&s.path.length>2).sort((a,b)=>b.path.length-a.path.length)[0]||{path:[]};
        const legend=strokes.find(s=>s.dash.join(',')==='5,4'&&s.path.length===2)||{path:[]};
        const start=texts.find(t=>t.text==='START'), ten=texts.find(t=>t.text==='10'), highScore=texts.find(t=>t.text==='High Score');
        const out={
          texts:texts.map(t=>t.text),start,ten,highScore,legend:legend.path,player:player.path,record:record.path,
          topHits:record.path.filter(p=>Math.abs(p[1]-(classicThrowRace?29:19))<.75).length,
          dotted:strokes.some(s=>s.dash.join(',')==='1.5,3.5')
        };
        host.remove(); return out;
      }
      return {classic:inspect(true),legacy:inspect(false)};
    });
    assert(sc021.classic.texts.includes('START'),'Classic race labels START origin');
    assert(sc021.classic.texts.includes('High Score'),'Classic race moves High Score into legend');
    assert(!sc021.classic.texts.includes('HS'),'Classic race removes in-chart HS tip');
    assert(sc021.classic.highScore && sc021.classic.legend.length===2 && sc021.classic.legend[0][0] > sc021.classic.highScore.x,'Classic legend renders High Score before its dashed key');
    assert(sc021.classic.start && sc021.classic.ten && sc021.classic.start.x < sc021.classic.ten.x,'10 is first target notch after START');
    assert(sc021.classic.dotted,'Classic player trajectory is faint dotted');
    assert.equal(sc021.classic.player.length,4,'START plus three throw positions are plotted');
    const dx1=sc021.classic.player[1][0]-sc021.classic.player[0][0], dx2=sc021.classic.player[2][0]-sc021.classic.player[1][0], dx3=sc021.classic.player[3][0]-sc021.classic.player[2][0];
    assert(Math.max(dx1,dx2,dx3)-Math.min(dx1,dx2,dx3)<0.75,'three throw steps are evenly spaced');
    assert(Math.abs(sc021.classic.player[2][1]-sc021.classic.player[1][1])<0.75,'miss advances horizontally without changing Y');
    assert(sc021.classic.player[3][1] < sc021.classic.player[2][1],'scoring dart advances horizontally and upward');
    assert.equal(sc021.classic.topHits,1,'Classic high-score reference still terminates once at chart ceiling');
    assert(!sc021.legacy.texts.includes('START') && !sc021.legacy.texts.includes('High Score') && !sc021.legacy.dotted,'non-Classic renderer path stays unchanged');
    console.log('PASS SC-021 START / per-throw motion / dotted trajectory / High Score --- legend isolation');

    await page.setViewportSize({width:390,height:844});
    for (const type of ['lastDartImg','desmondImg','voldyImg']) {
      await page.evaluate(type=>{window.__sqDmdHardClearQueue?.();window.__imageBounds=[];window.sqDmdShowZones({z2:'',z3:''},{type,ms:1500,amp:3.6});},type);
      await page.waitForFunction(() => Array.isArray(window.__imageBounds) && window.__imageBounds.length > 0, undefined, {timeout:4000,polling:50});
      const boxes=await page.evaluate(()=>window.__imageBounds);
      assert(boxes.length>0,type+' drew frames');
      assert(boxes.every(([x,y,w,h])=>x>=0&&y>=0&&x+w<=640&&y+h<=160),type+' stays inside display');
      console.log('PASS '+type+' animation bounds');
      if (process.env.SQ_SCREENSHOTS) await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`classic-${type}.png`)});
    }
    await page.evaluate(()=>{window.__sqDmdHardClearQueue?.();window.sqDmdShowZones({z2:'DESMOND DELIGHT',z3:'LAST DART HERO'},{type:'hold',ms:2000});});
    await page.waitForTimeout(400);
    if (process.env.SQ_SCREENSHOTS) await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'classic-long-callout.png')});
    assert(!consoleErrs.some(x=>x.startsWith('pageerror:')),consoleErrs.filter(x=>x.startsWith('pageerror:')).join('\n'));
    console.log('PASS no uncaught browser errors');
  } finally { await browser.close(); }

  await verifySc022HudPolish();
  await verifyResumedRaceRoute('Classic', classicSavedState, true);
  const practiceSavedState = await verifyNewRaceRoute('practice', false);
  const resumedPractice = JSON.parse(practiceSavedState);
  resumedPractice.match = Object.assign({}, resumedPractice.match || {}, {mode:'practice'});
  delete resumedPractice.match.forcePractice;
  delete resumedPractice.match.gameMode;
  delete resumedPractice.match.game_mode;
  delete resumedPractice.mode;
  delete resumedPractice.gameMode;
  delete resumedPractice.game_mode;
  delete resumedPractice.isPractice;
  delete resumedPractice.is_practice;
  delete resumedPractice.practice;
  await verifyResumedRaceRoute('Practice without forcePractice', JSON.stringify(resumedPractice), false);
  await verifyNewRaceRoute('turbo', false);
  await verifyVsShadowAndPracticeAliasRoutes();
  await verifyTrainingRoute();
})().catch(e=>{console.error(e);process.exit(1);});
