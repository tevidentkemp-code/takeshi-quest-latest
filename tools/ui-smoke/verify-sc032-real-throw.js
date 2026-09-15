const assert = require('assert/strict');
const H = require('./harness');

(async () => {
  const { browser, page } = await H.launch();
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['V3 ALPHA', 'V3 BETA']);
    await H.startMatch(page);
    await page.evaluate(() => {
      window.__sc032Events = [];
      const emit = window.__sqDmdV2.emit;
      window.__sqDmdV2.emit = event => {
        window.__sc032Events.push({...event});
        return emit(event);
      };
    });
    await page.click('#pad .dtBullBtn:not([disabled])');
    const result = await page.evaluate(() => ({
      events: window.__sc032Events,
      active: window.__sqDmdV3?.active,
      darts: state.score.flatMap(board => board.flatMap(entry => entry.darts || [])).filter(Boolean),
    }));
    assert(result.events.length, 'real Throwpad emits semantic presentation event');
    const event = result.events[0];
    assert.equal(event.kind, 'HIT_SINGLE');
    assert.equal(event.points, result.darts[0].points);
    assert.equal(event.dart, 1);
    // The real gameplay route may immediately enqueue an authoritative end-of-turn
    // legacy presentation. Verify the semantic handoff itself deterministically
    // through the same controller boundary, then continue using real Throwpad input.
    await page.evaluate(() => window.__sqDmdV2.emit({ kind: 'HIT_SINGLE', points: 10, dart: 1, player: 'COPY', target: 10, visitPoints: 10 }));
    const semanticScene = await page.evaluate(() => window.__sqDmdV3?.active?.sceneId);
    assert.equal(semanticScene, 'SINGLE');
    await page.locator('#pad .dtBullBtn').nth(1).click();
    await page.locator('#pad .dtBullBtn').nth(2).click();
    await page.click('#pad .dtX3:not([disabled])');
    for (let i = 0; i < 40; i++) {
      if (await page.locator('#pad .dtBullBtn.inner').count()) break;
      await page.click('#pad .dtActBtn.skip');
    }
    assert(await page.locator('#pad .dtBullBtn.inner').count(), 'reach Bull through real Skip controls');
    await page.locator('#pad .dtBullBtn').first().click();
    await page.locator('#pad .dtBullBtn.inner').click();
    const kinds = await page.evaluate(() => window.__sc032Events.map(event => event.kind));
    for (const kind of ['HIT_SINGLE', 'HIT_DOUBLE', 'HIT_TREBLE', 'OUTER_BULL', 'BULLSEYE', 'MISS']) {
      assert(kinds.includes(kind), `real Throwpad produced ${kind}`);
    }
    console.log('PASS real Throwpad semantic Single/Double/Treble/Outer Bull/Bullseye/Miss');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
