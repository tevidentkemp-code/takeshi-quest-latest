// SC-030 final responsive contract. Exercises the real Live V2 render path
// against representative mobile widths and verifies the large-layout visit
// strip mirrors the authoritative state after ordinary gameplay actions.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

function assertNoUnexpectedErrors(errors){
  const unexpected = errors.filter(error => !BROWSER_NOISE.test(error));
  assert.deepEqual(unexpected, [], `no unexpected browser errors: ${unexpected.join('\n')}`);
}

async function layout(page, width, height){
  await page.setViewportSize({width, height});
  await page.waitForTimeout(350);
  return page.evaluate((width) => {
    const panel = document.getElementById('liveV2Panel');
    const wrap = panel?.querySelector('.v2RowsWrap');
    const visible = (el, host = null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const hostRect = host?.getBoundingClientRect();
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0
        && (!hostRect || r.top >= hostRect.top - 1 && r.bottom <= hostRect.bottom + 1);
    };
    const badges = [...(wrap?.querySelectorAll('.v2Badge') || [])].filter(el => visible(el, wrap));
    const current = panel?.querySelector('.v2Badge.active');
    const graph = panel?.querySelector('.v2InfoPager');
    const pad = document.querySelector('.pad-bar');
    const padRect = pad?.getBoundingClientRect();
    const currentRect = current?.getBoundingClientRect();
    const graphRect = graph?.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    const progress = panel?.querySelector('.v2VisitProgress');
    const scoreBoxes = [...(panel?.querySelectorAll('.v2ScoreBox') || [])];
    const miniAvgs = [...(panel?.querySelectorAll('.v2MiniAvg') || [])];
    const liveCells = [...(panel?.querySelectorAll('.v2Rows .v2Cell.liveRow') || [])];
    const liveBadge = panel?.querySelector('.v2Rows .v2Badge.liveRow');
    const box = el => {
      const r = el?.getBoundingClientRect();
      return r ? {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height} : null;
    };
    return {
      width,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      historicRows: Math.max(0, badges.length - (current && visible(current, wrap) ? 1 : 0)),
      currentVisible: !!(current && visible(current, wrap)),
      currentAboveGraph: !!(currentRect && graphRect && currentRect.bottom <= graphRect.top + 1),
      graphAbovePad: !!(graphRect && padRect && graphRect.bottom <= padRect.top + 1),
      panelWithinViewport: !!(panelRect && panelRect.left >= -1 && panelRect.right <= innerWidth + 1),
      padWithinViewport: !!(padRect && padRect.left >= -1 && padRect.right <= innerWidth + 1),
      padButtonsFit: [...(pad?.querySelectorAll('button') || [])].every(button => {
        const r = button.getBoundingClientRect();
        return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1;
      }),
      oldDotsDisplay: panel ? getComputedStyle(panel.querySelector('.v2DotsCol')).display : 'none',
      progressDisplay: progress ? getComputedStyle(progress).display : 'none',
      progressBorderWidth: progress ? parseFloat(getComputedStyle(progress).borderTopWidth) : -1,
      progressLabels: panel?.querySelectorAll('.v2VisitLabel').length || 0,
      liveBadgeRect: box(liveBadge),
      progressPlayers: [...(panel?.querySelectorAll('.v2VisitPlayer') || [])].map(player => ({
        count: player.querySelectorAll('.v2VisitDot').length,
        text: player.textContent.trim(),
        borderWidth: parseFloat(getComputedStyle(player).borderTopWidth),
        rect: box(player),
        scoreRect: box(scoreBoxes[Number(player.dataset.p)]),
        infoRect: box(miniAvgs[Number(player.dataset.p)]),
        roundRect: box(liveCells[Number(player.dataset.p)]),
      })),
    };
  }, width);
}

async function visitState(page){
  return page.evaluate(() => {
    const host = document.querySelector('.v2VisitProgress');
    const dots = player => [...document.querySelectorAll(`.v2VisitPlayer[data-p="${player}"] .v2VisitDot`)]
      .map(dot => dot.dataset.shotState || '');
    const turn = Number(state.currentPlayer || 0);
    const round = Number(state.currentRound || 0);
    const displayRound = Number(host?.dataset.displayRound ?? round);
    const roundHold = host?.dataset.roundHold === 'true';
    const entries = (state.players || []).map((_, player) => ({
      darts: Array.isArray(state.score?.[player]?.[displayRound]?.darts)
        ? state.score[player][displayRound].darts.filter(dart => dart != null).length
        : 0,
      dots: dots(player),
    }));
    return {
      turn,
      round,
      displayRound,
      roundHold,
      finished: !!state.finished,
      currentDart: Number(state.currentDart || 0),
      entries,
    };
  });
}

async function gameplaySnapshot(page){
  return page.evaluate(() => JSON.stringify({
    score: state.score,
    history: state.history,
    currentPlayer: state.currentPlayer,
    currentRound: state.currentRound,
    currentDart: state.currentDart,
    finished: state.finished,
  }));
}

async function observeRoundWipe(page){
  await page.evaluate(() => {
    const host = document.querySelector('.v2VisitProgress');
    const dots = [...document.querySelectorAll('.v2VisitDot')];
    window.__sc030RoundWipeBatches = [];
    window.__sc030RoundWipeStartedAt = performance.now();
    window.__sc030RoundWipeObserver?.disconnect?.();
    window.__sc030RoundWipeObserver = new MutationObserver(records => {
      const changed = [...new Set(records
        .filter(record => record.type === 'attributes' && record.attributeName === 'data-shot-state')
        .map(record => dots.indexOf(record.target))
        .filter(index => index >= 0))];
      if (!changed.length) return;
      window.__sc030RoundWipeBatches.push({
        changed,
        states: dots.map(dot => dot.dataset.shotState || ''),
        roundHold: host?.dataset.roundHold || '',
        elapsed: performance.now() - window.__sc030RoundWipeStartedAt,
      });
    });
    window.__sc030RoundWipeObserver.observe(host, {
      subtree:true,
      attributes:true,
      attributeFilter:['data-shot-state'],
    });
  });
}

async function capture(page, name){
  const dir = process.env.SQ_SCREENSHOTS || path.join(process.cwd(), 'output', 'playwright', 'sc030-responsive');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

function assertStateParity(snapshot, label){
  for (let player = 0; player < snapshot.entries.length; player++) {
    const { darts, dots } = snapshot.entries[player];
    assert.equal(dots.length, 3, `${label}: player ${player} has exactly three indicators`);
    const done = dots.filter(value => value === 'done').length;
    assert.equal(done, Math.min(3, darts), `${label}: player ${player} done count follows live score state`);
    if (!snapshot.roundHold && !snapshot.finished && snapshot.displayRound === snapshot.round &&
        player === snapshot.turn && snapshot.currentDart < 3 && darts < 3) {
      assert.equal(dots[snapshot.currentDart], 'next', `${label}: active dart slot follows currentDart`);
    }
  }
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width:430, height:932 });
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['RESPONSIVE ALPHA', 'RESPONSIVE BETA']);
    await H.startMatch(page);
    await page.waitForSelector('#liveV2Panel:not([hidden])');

    const narrow = await layout(page, 320, 844);
    await capture(page, 'responsive-320');
    assert.equal(narrow.historicRows, 2, '320px shows two historic rows');
    assert(narrow.currentVisible, '320px current-round row is visible');
    assert(narrow.currentAboveGraph, '320px current-round row stays above graph');
    assert(!narrow.overflow, '320px has no horizontal overflow');
    assert(narrow.padWithinViewport && narrow.padButtonsFit, '320px Throwpad fits viewport');

    const standard = await layout(page, 390, 844);
    await capture(page, 'responsive-390');
    assert.equal(standard.historicRows, 3, '390px shows three historic rows');
    assert(standard.currentVisible && standard.currentAboveGraph, '390px current score remains visible');
    assert.equal(standard.oldDotsDisplay, 'flex', '390px keeps the existing dart indicators');
    assert.equal(standard.progressDisplay, 'none', '390px does not inherit the large strip');
    assert(!standard.overflow && standard.padButtonsFit, '390px has no layout regression');

    const large = await layout(page, 430, 932);
    await capture(page, 'large-zero-darts');
    assert.equal(large.historicRows, 3, '430px keeps three historic rows');
    assert(large.currentVisible && large.currentAboveGraph, '430px current score remains visible');
    assert.equal(large.progressDisplay, 'grid', '430px renders the visit progress strip');
    assert.equal(large.progressPlayers.length, 2, '430px renders one strip column per player');
    assert(large.progressPlayers.every(player => player.count === 3), '430px renders exactly three indicators per player');
    assert.equal(large.progressLabels, 0, '430px shot cells do not repeat player names');
    assert(large.progressPlayers.every(player => player.text === ''), 'empty shot cells contain no visible name text');
    assert.equal(large.progressBorderWidth, 0, 'shot cells are not wrapped in one shared bordered cell');
    assert(large.progressPlayers.every(player => player.borderWidth > 0), 'each player owns a bordered shot cell');
    assert.equal(large.oldDotsDisplay, 'none', '430px removes the old top-left indicators');
    assert(!large.overflow && large.padButtonsFit, '430px has no layout regression');
    assert(large.progressPlayers[0].rect.right < large.progressPlayers[1].rect.left, 'shot cells remain visually separate');
    assert(large.liveBadgeRect.right < large.progressPlayers[0].rect.left, 'left gutter remains clear above round labels');
    for (const [player, geometry] of large.progressPlayers.entries()) {
      assert(Math.abs(geometry.scoreRect.left - geometry.rect.left) <= 1 &&
        Math.abs(geometry.scoreRect.right - geometry.rect.right) <= 1,
      `player ${player} info and shot cells align`);
      assert(Math.abs(geometry.infoRect.left - geometry.rect.left) <= 1 &&
        Math.abs(geometry.infoRect.right - geometry.rect.right) <= 1,
      `player ${player} average info and shot cells align`);
      assert(Math.abs(geometry.roundRect.left - geometry.rect.left) <= 1 &&
        Math.abs(geometry.roundRect.right - geometry.rect.right) <= 1,
      `player ${player} info and shot cells sit above their round scores`);
    }

    assertStateParity(await visitState(page), 'start of visit');
    await page.click('#pad .dtBullBtn:not([disabled])');
    await page.waitForTimeout(250);
    assertStateParity(await visitState(page), 'after dart 1');
    await capture(page, 'large-after-dart-1');
    await page.click('#pad .dtBullBtn:not([disabled])');
    await page.waitForTimeout(250);
    assertStateParity(await visitState(page), 'after dart 2');
    await capture(page, 'large-after-dart-2');
    await page.click('#pad .dtActBtn.undo');
    await page.waitForTimeout(220);
    assertStateParity(await visitState(page), 'undo after dart 2');
    await capture(page, 'large-after-undo');
    await page.click('#pad .dtBullBtn:not([disabled])');
    await page.waitForTimeout(220);
    await page.click('#pad .dtBullBtn:not([disabled])');
    await page.waitForTimeout(500);
    const handover = await visitState(page);
    assert.equal(handover.roundHold, false, 'ordinary player handover does not trigger a whole-round hold');
    assert.deepEqual(handover.entries.map(entry => entry.dots.filter(value => value === 'done').length), [3, 0],
      'completed first-player visit remains while the second player starts');
    assertStateParity(handover, 'after dart 3 and handover');
    await capture(page, 'large-after-handover');

    await observeRoundWipe(page);
    await page.click('#pad .dtX3:not([disabled])');
    await page.waitForTimeout(450);
    const heldRound = await visitState(page);
    assert.equal(heldRound.round, 1, 'round cursor advances immediately');
    assert.equal(heldRound.displayRound, 0, 'completed round remains displayed during the hold');
    assert.equal(heldRound.roundHold, true, 'all shot cells share the round-complete hold');
    assert.deepEqual(heldRound.entries.map(entry => entry.dots.filter(value => value === 'done').length), [3, 3],
      'all completed target cells remain visible for one second');
    assertStateParity(heldRound, 'during completed-round hold');
    const stateDuringHold = await gameplaySnapshot(page);
    await capture(page, 'large-round-complete-hold');

    await page.waitForFunction(() => {
      const host = document.querySelector('.v2VisitProgress');
      const dots = [...document.querySelectorAll('.v2VisitDot')];
      return host?.dataset.roundHold === 'false' && dots.length === 6 &&
        dots.every(dot => dot.dataset.shotState !== 'done');
    }, {timeout:2500});
    const wipedRound = await visitState(page);
    assert.equal(wipedRound.displayRound, 1, 'shot cells move to the new round after the hold');
    assert.deepEqual(wipedRound.entries.map(entry => entry.dots.filter(value => value === 'done').length), [0, 0],
      'all completed targets wipe together');
    assertStateParity(wipedRound, 'after synchronized round wipe');
    assert.equal(await gameplaySnapshot(page), stateDuringHold, 'the timed wipe does not mutate gameplay state');
    const wipeEvidence = await page.evaluate(() => {
      window.__sc030RoundWipeObserver?.disconnect?.();
      const dots = [...document.querySelectorAll('.v2VisitDot')];
      return {
        batches: window.__sc030RoundWipeBatches || [],
        pipColors: dots.map(dot => getComputedStyle(dot, '::before').backgroundColor),
      };
    });
    assert(wipeEvidence.batches.some(batch => batch.elapsed >= 900 && batch.changed.length === 6 &&
      batch.states.every(state => state === 'idle' || state === 'next')),
    'all six targets hold for one second, then reset in one render batch');
    assert(wipeEvidence.pipColors.every(color => color === 'rgb(255, 106, 0)'),
      'wiped targets all return to orange dots');
    await capture(page, 'large-round-wiped');

    await page.click('#pad .dtActBtn.skip');
    await page.waitForTimeout(500);
    assertStateParity(await visitState(page), 'after Skip / next visit');

    assertNoUnexpectedErrors(consoleErrs);
    console.log('SC-030 RESPONSIVE LIVE GAME: ALL PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
