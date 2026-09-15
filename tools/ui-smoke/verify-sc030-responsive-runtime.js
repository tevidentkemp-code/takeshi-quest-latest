// SC-030 final responsive contract. Exercises the real Live V2 render path
// against representative mobile widths and verifies current-round target
// squares embedded in the live score cells after ordinary gameplay actions.
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
    const liveCells = [...(panel?.querySelectorAll('.v2Rows .v2Cell.liveRow') || [])];
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
      progressPresent: !!panel?.querySelector('.v2VisitProgress'),
      historicTargetCells: panel?.querySelectorAll('.v2Cell:not(.liveRow) .v2CellShots').length || 0,
      liveTargets: liveCells.map(cell => ({
        player: Number(cell.dataset.p),
        cellRect: box(cell),
        scoreRect: box(cell.querySelector('.v2CellScore')),
        shotsRect: box(cell.querySelector('.v2CellShots')),
        count: cell.querySelectorAll('.v2CellShots .v2Dot').length,
        dots: [...cell.querySelectorAll('.v2CellShots .v2Dot')].map(dot => ({
          rect: box(dot),
          state: dot.dataset.shotState || '',
        })),
      })),
    };
  }, width);
}

async function visitState(page){
  return page.evaluate(() => {
    const dots = player => [...document.querySelectorAll(`.v2Cell.liveRow[data-p="${player}"] .v2CellShots .v2Dot`)]
      .map(dot => dot.dataset.shotState || '');
    const turn = Number(state.currentPlayer || 0);
    const round = Number(state.currentRound || 0);
    const entries = (state.players || []).map((_, player) => ({
      darts: Array.isArray(state.score?.[player]?.[round]?.darts)
        ? state.score[player][round].darts.filter(dart => dart != null).length
        : 0,
      dots: dots(player),
    }));
    return {
      turn,
      round,
      displayRound: round,
      roundHold: false,
      finished: !!state.finished,
      currentDart: Number(state.currentDart || 0),
      entries,
    };
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
    assert.equal(narrow.progressPresent, false, '320px has no standalone target strip');
    assert.equal(narrow.liveTargets.length, 2, '320px renders one current-round target group per player');
    assert(narrow.liveTargets.every(player => player.count === 3), '320px renders three square targets per player');
    assert.equal(narrow.historicTargetCells, 0, '320px keeps targets out of historic round cells');
    assert(!narrow.overflow, '320px has no horizontal overflow');
    assert(narrow.padWithinViewport && narrow.padButtonsFit, '320px Throwpad fits viewport');

    const standard = await layout(page, 390, 844);
    await capture(page, 'responsive-390');
    assert.equal(standard.historicRows, 3, '390px shows three historic rows');
    assert(standard.currentVisible && standard.currentAboveGraph, '390px current score remains visible');
    assert.equal(standard.oldDotsDisplay, 'none', '390px removes the duplicate left-hand indicators');
    assert.equal(standard.progressPresent, false, '390px has no standalone target strip');
    assert.equal(standard.liveTargets.length, 2, '390px renders one current-round target group per player');
    assert(standard.liveTargets.every(player => player.count === 3), '390px renders three square targets per player');
    assert.equal(standard.historicTargetCells, 0, '390px keeps targets out of historic round cells');
    assert(!standard.overflow && standard.padButtonsFit, '390px has no layout regression');

    const large = await layout(page, 430, 932);
    await capture(page, 'large-zero-darts');
    assert.equal(large.historicRows, 3, '430px keeps three historic rows');
    assert(large.currentVisible && large.currentAboveGraph, '430px current score remains visible');
    assert.equal(large.progressPresent, false, '430px has no standalone target strip');
    assert.equal(large.liveTargets.length, 2, '430px renders one current-round target group per player');
    assert(large.liveTargets.every(player => player.count === 3), '430px renders three square targets per player');
    assert.equal(large.historicTargetCells, 0, '430px keeps targets out of historic round cells');
    assert.equal(large.oldDotsDisplay, 'none', '430px removes the duplicate left-hand indicators');
    assert(!large.overflow && large.padButtonsFit, '430px has no layout regression');
    for (const [player, geometry] of large.liveTargets.entries()) {
      assert(geometry.scoreRect.top < geometry.shotsRect.top, `player ${player} score sits above targets`);
      assert(geometry.shotsRect.bottom <= geometry.cellRect.bottom + 1, `player ${player} targets stay inside score cell`);
      assert(geometry.dots.every(dot => Math.abs(dot.rect.width - dot.rect.height) <= 1),
        `player ${player} targets keep square shapes`);
      assert(geometry.dots[0].rect.left < geometry.dots[1].rect.left &&
        geometry.dots[1].rect.left < geometry.dots[2].rect.left,
      `player ${player} targets remain evenly laid out`);
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

    await page.click('#pad .dtX3:not([disabled])');
    await page.waitForTimeout(450);
    const resetRound = await visitState(page);
    assert.equal(resetRound.round, 1, 'round cursor advances immediately');
    assert.equal(resetRound.displayRound, 1, 'targets stay in the current round score after completion');
    assert.equal(resetRound.roundHold, false, 'round completion does not create a separate target hold');
    assert.deepEqual(resetRound.entries.map(entry => entry.dots.filter(value => value === 'done').length), [0, 0],
      'all current-round targets reset in place for the new round');
    assertStateParity(resetRound, 'after current-round target reset');
    const resetSurface = await page.evaluate(() => ({
      historicTargetCells: document.querySelectorAll('.v2Cell:not(.liveRow) .v2CellShots').length,
      liveTargetCells: [...document.querySelectorAll('.v2Cell.liveRow .v2CellShots')].map(group => ({
        count: group.querySelectorAll('.v2Dot').length,
        states: [...group.querySelectorAll('.v2Dot')].map(dot => dot.dataset.shotState || ''),
      })),
    }));
    assert.equal(resetSurface.historicTargetCells, 0, 'completed rounds never retain target cells');
    assert.equal(resetSurface.liveTargetCells.length, 2, 'new current round keeps one target group per player');
    assert(resetSurface.liveTargetCells.every(group => group.count === 3 &&
      group.states.every(state => state === 'idle' || state === 'next')),
    'new current-round target groups reset to orange idle/next squares');
    await capture(page, 'large-round-complete-reset');

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
