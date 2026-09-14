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
      progressDisplay: panel ? getComputedStyle(panel.querySelector('.v2VisitProgress')).display : 'none',
      progressPlayers: [...(panel?.querySelectorAll('.v2VisitPlayer') || [])].map(player => ({
        count: player.querySelectorAll('.v2VisitDot').length,
        rect: (() => { const r = player.getBoundingClientRect(); return {left:r.left,right:r.right}; })(),
      })),
    };
  }, width);
}

async function visitState(page){
  return page.evaluate(() => {
    const dots = player => [...document.querySelectorAll(`.v2VisitPlayer[data-p="${player}"] .v2VisitDot`)]
      .map(dot => dot.dataset.shotState || '');
    const turn = Number(state.currentPlayer || 0);
    const round = Number(state.currentRound || 0);
    const held = state.uiLastGo && Number(state.uiLastGo.showUntil || 0) > Date.now()
      ? { player: Number(state.uiLastGo.player), darts: (state.uiLastGo.darts || []).filter(dart => dart != null).length }
      : null;
    const entries = (state.players || []).map((_, player) => ({
      darts: Math.max(
        Array.isArray(state.score?.[player]?.[round]?.darts)
          ? state.score[player][round].darts.filter(dart => dart != null).length
          : 0,
        held?.player === player ? held.darts : 0,
      ),
      dots: dots(player),
    }));
    return { turn, round, currentDart: Number(state.currentDart || 0), entries };
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
    if (player === snapshot.turn && snapshot.currentDart < 3 && darts < 3) {
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
    assert.equal(large.oldDotsDisplay, 'none', '430px removes the old top-left indicators');
    assert(!large.overflow && large.padButtonsFit, '430px has no layout regression');
    assert(large.progressPlayers[0].rect.left < large.progressPlayers[1].rect.left, 'progress columns are aligned left-to-right');

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
    assertStateParity(await visitState(page), 'after dart 3 and handover');
    await capture(page, 'large-after-handover');

    await page.click('#pad .dtX3:not([disabled])');
    await page.waitForTimeout(500);
    assertStateParity(await visitState(page), 'after Miss');
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
